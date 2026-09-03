import pytest
from fastapi.testclient import TestClient
from modules.mandate_vault.main import app
from modules.mandate_vault.crypto import sign_canonical_payload, verify_jws_signature
from modules.ledger.writer import canonicalize_json, compute_sha256


def test_crypto_sign_and_verify():
    payload = {
        "intent_id": "test-intent-123",
        "constraint_hash": "sha256:abc123def456",
        "max_amount_paise": 499900,
        "merchant_scope": ["demo-merchant.myshopify.com"],
    }
    
    compact_jws, sha = sign_canonical_payload(payload)
    assert compact_jws is not None
    assert sha.startswith("sha256:")
    
    # Verification
    decoded_payload = verify_jws_signature(compact_jws)
    assert decoded_payload["intent_id"] == "test-intent-123"
    assert decoded_payload["max_amount_paise"] == 499900


def test_tampered_signature_fails_closed():
    payload = {"intent_id": "test-intent-tamper", "amount": 1000}
    compact_jws, _ = sign_canonical_payload(payload)
    
    # Tamper with the compact JWS token (flip characters in the payload/signature part)
    parts = compact_jws.split(".")
    tampered_parts = [parts[0], parts[1] + "tamper", parts[2]]
    tampered_jws = ".".join(tampered_parts)
    
    with pytest.raises(ValueError, match="failed|Malformed"):
        verify_jws_signature(tampered_jws)


def test_vault_sign_endpoint_hash_mismatch_fails_closed():
    client = TestClient(app)
    
    payload = {"buyer_id": "buyer_1", "max_spend": 5000}
    correct_hash = compute_sha256(canonicalize_json(payload))
    bogus_hash = "sha256:0000000000000000000000000000000000000000000000000000000000000000"
    
    sign_req = {
        "mandate_type": "PAYMENT",
        "payload_canonical_json": payload,
        "expected_canonical_sha256": bogus_hash,
        "key_id": "2026-08-ap2-1",
        "guardrail_decision_id": "dec-123",
        "constraint_hash": correct_hash
    }
    
    res = client.post("/v1/mandate/sign", json=sign_req)
    assert res.status_code == 400
    assert "Canonical hash mismatch" in res.json()["detail"]


def test_vault_sign_and_verify_endpoint_success():
    client = TestClient(app)
    
    payload = {
        "buyer_id": "buyer_99",
        "max_amount_paise": 500000,
        "merchant_scope": ["amazon.in"]
    }
    canonical_hash = compute_sha256(canonicalize_json(payload))
    
    sign_req = {
        "mandate_type": "PAYMENT",
        "payload_canonical_json": payload,
        "expected_canonical_sha256": canonical_hash,
        "key_id": "2026-08-ap2-1",
        "guardrail_decision_id": "dec-456",
        "constraint_hash": canonical_hash
    }
    
    res = client.post("/v1/mandate/sign", json=sign_req)
    assert res.status_code == 200
    data = res.json()
    assert "compact_jws" in data
    assert data["kid"] == "2026-08-ap2-1"
    
    # Verify via verify endpoint
    verify_res = client.post("/v1/mandate/verify", json={"compact_jws": data["compact_jws"]})
    assert verify_res.status_code == 200
    verify_data = verify_res.json()
    assert verify_data["status"] == "VALID"
    assert verify_data["payload"]["buyer_id"] == "buyer_99"
