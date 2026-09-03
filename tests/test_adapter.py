import pytest
import threading
import time
import hashlib
import hmac
import json
from fastapi.testclient import TestClient

from modules.upi_payment_adapter.idempotency import IdempotencyStore, IdempotencyError
from modules.upi_payment_adapter.revocation import RevocationEngine, MandateRevocationError
from modules.upi_payment_adapter.webhooks import verify_razorpay_signature, parse_webhook_event
from modules.upi_payment_adapter.main import app


# --- Idempotency Tests (INV-003) ---

def test_idempotency_rejects_duplicate():
    """INV-003: Submit duplicate (mandate_id, idempotency_key) → rejected, original result returned."""
    store = IdempotencyStore()
    record = store.check_and_insert("mandate-1", "key-1", 499900)
    assert record.status == "PENDING"

    with pytest.raises(IdempotencyError) as exc_info:
        store.check_and_insert("mandate-1", "key-1", 499900)

    assert exc_info.value.original_result.debit_id == record.debit_id


def test_idempotency_allows_different_keys():
    store = IdempotencyStore()
    r1 = store.check_and_insert("mandate-1", "key-a", 100)
    r2 = store.check_and_insert("mandate-1", "key-b", 200)
    assert r1.debit_id != r2.debit_id


# --- Revocation Race Tests (INV-004) ---

def test_revocation_blocks_debit():
    """INV-004: Revoke mandate → immediately attempt debit → 403 MANDATE_REVOKED."""
    engine = RevocationEngine()
    engine.register_mandate("m-race-1", max_amount_paise=500000)

    # Revoke first
    engine.revoke("m-race-1")

    # Attempt debit after revocation
    with pytest.raises(MandateRevocationError, match="MANDATE_REVOKED"):
        engine.acquire_for_debit("m-race-1", 499900)


def test_revocation_concurrent_race():
    """INV-004: Concurrent revoke + debit — revocation must win."""
    engine = RevocationEngine()
    engine.register_mandate("m-race-2", max_amount_paise=500000)

    results = {"debit_succeeded": False, "debit_error": None, "revoke_done": False}

    def revoke_thread():
        time.sleep(0.01)  # Tiny delay to let debit thread start
        engine.revoke("m-race-2")
        results["revoke_done"] = True

    def debit_thread():
        time.sleep(0.02)  # Debit attempts slightly after revocation
        try:
            engine.acquire_for_debit("m-race-2", 499900)
            results["debit_succeeded"] = True
        except MandateRevocationError as e:
            results["debit_error"] = str(e)

    t_revoke = threading.Thread(target=revoke_thread)
    t_debit = threading.Thread(target=debit_thread)
    t_revoke.start()
    t_debit.start()
    t_revoke.join(timeout=5)
    t_debit.join(timeout=5)

    assert results["revoke_done"] is True
    assert results["debit_succeeded"] is False
    assert "MANDATE_REVOKED" in (results["debit_error"] or "")


def test_debit_rejects_over_max_amount():
    engine = RevocationEngine()
    engine.register_mandate("m-over", max_amount_paise=500000)

    with pytest.raises(ValueError, match="exceeds mandate max"):
        engine.acquire_for_debit("m-over", 600000)


def test_debit_succeeds_within_budget():
    engine = RevocationEngine()
    engine.register_mandate("m-ok", max_amount_paise=500000)
    state = engine.acquire_for_debit("m-ok", 499900)
    assert state.state == "PAYMENT_ACTIVE"


# --- Webhook Signature Tests ---

def test_webhook_valid_signature():
    secret = "test_webhook_secret"
    payload = json.dumps({"event": "payment.captured"}).encode("utf-8")
    sig = hmac.new(secret.encode("utf-8"), payload, hashlib.sha256).hexdigest()
    assert verify_razorpay_signature(payload, sig, secret=secret) is True


def test_webhook_invalid_signature():
    secret = "test_webhook_secret"
    payload = json.dumps({"event": "payment.captured"}).encode("utf-8")
    assert verify_razorpay_signature(payload, "bad_signature", secret=secret) is False


def test_webhook_parses_captured_event():
    body = {
        "event": "payment.captured",
        "payload": {
            "payment": {
                "entity": {
                    "id": "pay_test123",
                    "order_id": "order_test456",
                    "status": "captured",
                }
            }
        }
    }
    result = parse_webhook_event(body)
    assert result.accepted is True
    assert result.status == "SETTLED"
    assert result.payment_id == "pay_test123"


def test_webhook_parses_failed_event():
    body = {
        "event": "payment.failed",
        "payload": {
            "payment": {
                "entity": {
                    "id": "pay_fail789",
                    "order_id": "order_fail012",
                    "status": "failed",
                    "error_description": "Insufficient funds",
                }
            }
        }
    }
    result = parse_webhook_event(body)
    assert result.accepted is True
    assert result.status == "FAILED"
    assert result.error == "Insufficient funds"


# --- Adapter API Endpoint Tests ---

def test_adapter_register_and_query():
    client = TestClient(app)
    res = client.post("/v1/adapter/register", json={
        "mandate_id": "m-api-1",
        "max_amount_paise": 500000,
    })
    assert res.status_code == 200
    assert res.json()["status"] == "registered"

    res = client.get("/v1/adapter/mandate/m-api-1")
    assert res.status_code == 200
    assert res.json()["state"] == "PAYMENT_ACTIVE"


def test_adapter_revoke_endpoint():
    client = TestClient(app)
    client.post("/v1/adapter/register", json={
        "mandate_id": "m-api-revoke",
        "max_amount_paise": 500000,
    })
    res = client.post("/v1/adapter/revoke", json={
        "mandate_id": "m-api-revoke",
        "reason": "Test revocation",
    })
    assert res.status_code == 200
    assert res.json()["status"] == "REVOKED"

    # Verify state is REVOKED
    res = client.get("/v1/adapter/mandate/m-api-revoke")
    assert res.json()["state"] == "REVOKED"


def test_adapter_mandate_not_found():
    client = TestClient(app)
    res = client.get("/v1/adapter/mandate/nonexistent")
    assert res.status_code == 404
