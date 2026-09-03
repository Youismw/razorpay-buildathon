import json
from typing import Any, Dict, Tuple
from jwcrypto import jwk, jws
from modules.ledger.writer import canonicalize_json, compute_sha256

# Algorithm Allowlists (FR-MV-003)
ALLOWED_AP2_ALGORITHMS = {"ES256"}
ALLOWED_IDENTITY_ALGORITHMS = {"EdDSA", "Ed25519"}


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


def sign_canonical_payload(payload: Dict[str, Any], key_id: str = "2026-08-ap2-1") -> Tuple[str, str]:
    """
    Sign an RFC 8785 canonical JSON payload with ES256 (FR-MV-002, INV-009).
    Returns (compact_jws, canonical_sha256).
    """
    if key_id != "2026-08-ap2-1":
        raise ValueError(f"Unauthorized or unknown signing key_id: {key_id}")
    
    canonical_str = canonicalize_json(payload)
    canonical_sha256 = compute_sha256(canonical_str)
    
    # Construct protected JWS Header
    protected_header = {
        "alg": "ES256",
        "typ": "JWT",
        "kid": key_id,
    }
    
    token = jws.JWS(payload=canonical_str.encode("utf-8"))
    token.add_signature(
        _key_manager.ap2_key,
        alg="ES256",
        protected=protected_header
    )
    compact_jws = token.serialize(compact=True)
    return compact_jws, canonical_sha256


def verify_jws_signature(compact_jws: str) -> Dict[str, Any]:
    """
    Verify JWS signature against public key and algorithm allowlist (INV-009, FR-MV-003).
    Rejects alg: none or non-allowlisted algorithms immediately (Fail-Closed).
    """
    token = jws.JWS()
    try:
        token.deserialize(compact_jws)
    except Exception as e:
        raise ValueError(f"Malformed JWS token: {str(e)}")
    
    # Check protected header algorithm
    header = token.jose_header
    alg = header.get("alg")
    if not alg or alg not in ALLOWED_AP2_ALGORITHMS:
        raise ValueError(f"Algorithm '{alg}' is not in the allowed signature algorithm list: {ALLOWED_AP2_ALGORITHMS}")
    
    # Verify using the Vault's public key
    try:
        token.verify(_key_manager.ap2_key)
    except Exception as e:
        raise ValueError(f"Cryptographic signature verification failed: {str(e)}")
    
    payload_str = token.payload.decode("utf-8")
    return json.loads(payload_str)
