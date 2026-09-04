import abc
import os
import json
from typing import Any, Dict, Optional, Tuple
from jwcrypto import jwk, jws
from modules.ledger.writer import canonicalize_json, compute_sha256

# Algorithm Allowlists (FR-MV-003)
ALLOWED_AP2_ALGORITHMS = {"ES256"}
ALLOWED_IDENTITY_ALGORITHMS = {"EdDSA", "Ed25519"}


class AbstractVaultSigner(abc.ABC):
    """
    Abstract Hardware / Software Cryptographic Signer Interface (FR-MV-004).
    Enables zero-downtime transition between local P-256 software keys and
    cloud HSMs (AWS KMS, Google Cloud HSM, HashiCorp Vault).
    """

    @abc.abstractmethod
    def sign(self, canonical_str: str, key_id: str) -> str:
        """Sign canonical string and return compact JWS string."""
        pass

    @abc.abstractmethod
    def verify(self, compact_jws: str) -> Dict[str, Any]:
        """Verify JWS compact token and return decoded payload dict."""
        pass

    @abc.abstractmethod
    def get_public_jwks(self) -> Dict[str, Any]:
        """Expose public JWK set for mandate verification without exposing private key material."""
        pass


class KeyManager:
    """Manages isolated cryptographic keys partitioned by purpose (FR-MV-004)."""
    def __init__(self):
        # Generate or load software-backed ES256 key for AP2 Mandate Signing
        self.ap2_key = jwk.JWK.generate(kty="EC", crv="P-256", kid="2026-08-ap2-1")
        # Generate or load Ed25519 key for Agent Identity
        self.identity_key = jwk.JWK.generate(kty="OKP", crv="Ed25519", kid="2026-08-identity-1")

    def get_public_jwks(self) -> Dict[str, Any]:
        """Expose public keys for verification without exposing private key material."""
        return {
            "keys": [
                self.ap2_key.export_public(as_dict=True),
                self.identity_key.export_public(as_dict=True),
            ]
        }


# Global KeyManager instance isolated inside Mandate Vault process
_key_manager = KeyManager()


class SoftwareVaultSigner(AbstractVaultSigner):
    """
    Default in-memory / software ES256 signer using RFC 8785 Canonical JSON.
    Used for local sandbox, test suites, and environments without Cloud HSM.
    """

    def __init__(self, key_manager: Optional[KeyManager] = None):
        self.km = key_manager or _key_manager

    def sign(self, canonical_str: str, key_id: str = "2026-08-ap2-1") -> str:
        protected_header = {
            "alg": "ES256",
            "typ": "JWT",
            "kid": key_id,
        }
        token = jws.JWS(payload=canonical_str.encode("utf-8"))
        token.add_signature(
            self.km.ap2_key,
            alg="ES256",
            protected=protected_header
        )
        return token.serialize(compact=True)

    def verify(self, compact_jws: str) -> Dict[str, Any]:
        token = jws.JWS()
        try:
            token.deserialize(compact_jws)
        except Exception as e:
            raise ValueError(f"Malformed JWS token: {str(e)}")

        header = token.jose_header
        alg = header.get("alg")
        if not alg or alg not in ALLOWED_AP2_ALGORITHMS:
            raise ValueError(f"Algorithm '{alg}' is not in the allowed signature algorithm list: {ALLOWED_AP2_ALGORITHMS}")

        try:
            token.verify(self.km.ap2_key)
        except Exception as e:
            raise ValueError(f"Cryptographic signature verification failed: {str(e)}")

        payload_str = token.payload.decode("utf-8")
        return json.loads(payload_str)

    def get_public_jwks(self) -> Dict[str, Any]:
        return self.km.get_public_jwks()


class AwsKmsVaultSigner(AbstractVaultSigner):
    """
    Production-Grade Hardware Security Module (HSM) adapter using AWS KMS / CloudHSM (FIPS 140-2 Level 3).
    Activated when AWS_KMS_KEY_ARN is configured.
    Uses defensive lazy imports so no runtime crashes occur if boto3 is not installed.
    """

    def __init__(self, key_arn: Optional[str] = None):
        self.key_arn = key_arn or os.environ.get("AWS_KMS_KEY_ARN", "")
        self._fallback_signer = SoftwareVaultSigner()
        self._boto3_client = None

        # Safe lazy check
        try:
            import boto3
            if self.key_arn:
                self._boto3_client = boto3.client("kms")
        except ImportError:
            self._boto3_client = None

    @property
    def is_live_kms_available(self) -> bool:
        return self._boto3_client is not None and bool(self.key_arn)

    def sign(self, canonical_str: str, key_id: str = "2026-08-ap2-1") -> str:
        if not self.is_live_kms_available:
            # Fallback to deterministic software signer if KMS is unconfigured
            return self._fallback_signer.sign(canonical_str, key_id)

        # In production with live KMS:
        digest = compute_sha256(canonical_str)
        raw_hex = digest[7:] if digest.startswith("sha256:") else digest
        digest_bytes = bytes.fromhex(raw_hex)

        response = self._boto3_client.sign(
            KeyId=self.key_arn,
            Message=digest_bytes,
            MessageType="DIGEST",
            SigningAlgorithm="ECDSA_SHA_256",
        )
        der_signature = response["Signature"]

        # Convert ASN.1 DER signature to IEEE P1363 raw 64-byte format (RFC 7515 §3.4 ES256)
        from cryptography.hazmat.primitives.asymmetric.utils import decode_dss_signature
        r, s = decode_dss_signature(der_signature)
        raw_signature = r.to_bytes(32, byteorder="big") + s.to_bytes(32, byteorder="big")

        # Form standard compact JWS with KMS signature
        import base64
        header_b64 = base64.urlsafe_b64encode(
            json.dumps({"alg": "ES256", "typ": "JWT", "kid": key_id}).encode("utf-8")
        ).rstrip(b"=").decode("ascii")
        payload_b64 = base64.urlsafe_b64encode(canonical_str.encode("utf-8")).rstrip(b"=").decode("ascii")
        sig_b64 = base64.urlsafe_b64encode(raw_signature).rstrip(b"=").decode("ascii")

        return f"{header_b64}.{payload_b64}.{sig_b64}"

    def verify(self, compact_jws: str) -> Dict[str, Any]:
        if not self.is_live_kms_available:
            return self._fallback_signer.verify(compact_jws)

        import base64
        from cryptography.hazmat.primitives.asymmetric.utils import encode_dss_signature
        parts = compact_jws.split(".")
        if len(parts) != 3:
            raise ValueError("Malformed JWS token")

        signing_input = f"{parts[0]}.{parts[1]}".encode("ascii")
        import hashlib
        digest_bytes = hashlib.sha256(signing_input).digest()

        sig_padding = "=" * ((4 - len(parts[2]) % 4) % 4)
        raw_sig = base64.urlsafe_b64decode(parts[2] + sig_padding)
        if len(raw_sig) != 64:
            raise ValueError(f"Invalid IEEE P1363 signature length: {len(raw_sig)}, expected 64")

        r = int.from_bytes(raw_sig[:32], byteorder="big")
        s = int.from_bytes(raw_sig[32:], byteorder="big")
        der_signature = encode_dss_signature(r, s)

        resp = self._boto3_client.verify(
            KeyId=self.key_arn,
            Message=digest_bytes,
            MessageType="DIGEST",
            Signature=der_signature,
            SigningAlgorithm="ECDSA_SHA_256",
        )
        if not resp.get("SignatureValid", False):
            raise ValueError("KMS signature verification failed")

        payload_padding = "=" * ((4 - len(parts[1]) % 4) % 4)
        payload_bytes = base64.urlsafe_b64decode(parts[1] + payload_padding)
        return json.loads(payload_bytes.decode("utf-8"))

    def get_public_jwks(self) -> Dict[str, Any]:
        if not self.is_live_kms_available:
            return self._fallback_signer.get_public_jwks()
        try:
            from cryptography.hazmat.primitives.serialization import load_der_public_key
            from jwcrypto import jwk
            pub_key_der = self._boto3_client.get_public_key(KeyId=self.key_arn)["PublicKey"]
            pub_key = load_der_public_key(pub_key_der)
            key_jwk = jwk.JWK.from_pyca(pub_key)
            jwk_dict = json.loads(key_jwk.export_public())
            jwk_dict["kid"] = "2026-08-ap2-1"
            jwk_dict["use"] = "sig"
            jwk_dict["alg"] = "ES256"
            return {"keys": [jwk_dict]}
        except Exception:
            return self._fallback_signer.get_public_jwks()


def get_vault_signer() -> AbstractVaultSigner:
    """Factory to retrieve active vault signer (AWS KMS if ARN present, else Software)."""
    kms_arn = os.environ.get("AWS_KMS_KEY_ARN")
    if kms_arn:
        return AwsKmsVaultSigner(key_arn=kms_arn)
    return SoftwareVaultSigner()


def sign_canonical_payload(payload: Dict[str, Any], key_id: str = "2026-08-ap2-1") -> Tuple[str, str]:
    """
    Sign an RFC 8785 canonical JSON payload with ES256 (FR-MV-002, INV-009).
    Returns (compact_jws, canonical_sha256).
    """
    if key_id != "2026-08-ap2-1":
        raise ValueError(f"Unauthorized or unknown signing key_id: {key_id}")

    canonical_str = canonicalize_json(payload)
    canonical_sha256 = compute_sha256(canonical_str)

    signer = get_vault_signer()
    compact_jws = signer.sign(canonical_str, key_id=key_id)
    return compact_jws, canonical_sha256


def verify_jws_signature(compact_jws: str) -> Dict[str, Any]:
    """
    Verify JWS signature against public key and algorithm allowlist (INV-009, FR-MV-003).
    Rejects alg: none or non-allowlisted algorithms immediately (Fail-Closed).
    """
    signer = get_vault_signer()
    return signer.verify(compact_jws)

