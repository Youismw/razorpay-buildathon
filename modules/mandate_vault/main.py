import uuid
from typing import Any, Dict, Optional
from fastapi import FastAPI, HTTPException, status
from pydantic import BaseModel, Field
from modules.mandate_vault.crypto import _key_manager, sign_canonical_payload, verify_jws_signature
from modules.ledger.writer import canonicalize_json, compute_sha256

app = FastAPI(title="Isolated Mandate Vault Service", version="1.0.0")


class MandateSignRequest(BaseModel):
    mandate_type: str = Field(..., description="INTENT | CART | PAYMENT")
    payload_canonical_json: Dict[str, Any]
    expected_canonical_sha256: str
    key_id: str = "2026-08-ap2-1"
    guardrail_decision_id: str
    constraint_hash: str
    expires_at_unix: Optional[int] = None


class MandateSignResponse(BaseModel):
    mandate_id: str
    compact_jws: str
    kid: str
    canonical_sha256: str


class MandateVerifyRequest(BaseModel):
    compact_jws: str


@app.get("/healthz")
def healthz():
    return {"status": "ok", "service": "mandate-vault"}


@app.get("/.well-known/jwks.json")
def get_jwks():
    """Public JWKS for verification without exposing private key material."""
    return _key_manager.get_public_jwks()


@app.post("/v1/mandate/sign", response_model=MandateSignResponse)
def sign_mandate(req: MandateSignRequest):
    """
    Mandate Vault Signing API Contract (SDD §5.3 / FR-MV-001 / INV-009).
    Strict checks before signing:
    1. Canonicalizes payload via RFC 8785
    2. Verifies computed hash matches expected_canonical_sha256
    3. Verifies key_id is authorized
    4. Issues compact ES256 JWS
    """
    if req.mandate_type not in {"INTENT", "CART", "PAYMENT"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid mandate type: {req.mandate_type}. Must be INTENT, CART, or PAYMENT."
        )

    # INV-002: Mandate Vault Gate Verification
    if not req.guardrail_decision_id or len(req.guardrail_decision_id.strip()) < 3:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Guardrail gate check failed: Missing or unauthorized guardrail_decision_id (INV-002)."
        )

    if not req.constraint_hash or not req.constraint_hash.startswith("sha256:"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid constraint_hash format. Must be a valid sha256 digest."
        )
    
    # Verify hash integrity before signing
    canonical_str = canonicalize_json(req.payload_canonical_json)
    computed_hash = compute_sha256(canonical_str)
    
    if computed_hash != req.expected_canonical_sha256:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Canonical hash mismatch! Expected {req.expected_canonical_sha256}, got {computed_hash}. Rejecting sign request."
        )
    
    try:
        compact_jws, canonical_sha256 = sign_canonical_payload(
            req.payload_canonical_json,
            key_id=req.key_id
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    
    mandate_id = str(uuid.uuid4())
    return MandateSignResponse(
        mandate_id=mandate_id,
        compact_jws=compact_jws,
        kid=req.key_id,
        canonical_sha256=canonical_sha256
    )


@app.post("/v1/mandate/verify")
def verify_mandate(req: MandateVerifyRequest):
    """Verify an AP2 Mandate JWS signature."""
    try:
        verified_payload = verify_jws_signature(req.compact_jws)
        return {
            "status": "VALID",
            "payload": verified_payload
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Signature verification failed: {str(e)}"
        )
