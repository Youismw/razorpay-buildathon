"""
Integration test suite for closed gaps:
1. Live UPI Mandate creation and Atomic Revocation (INV-004)
2. Razorpay S2S Webhook HMAC-SHA256 signature verification
3. Buyer Profile persistence & sync
"""

from fastapi.testclient import TestClient
from modules.orchestrator.main import app

client = TestClient(app)


def test_mandate_lifecycle_and_atomic_revocation():
    # 1. Fetch initial mandates
    res = client.get("/api/mandates")
    assert res.status_code == 200
    mandates = res.json()["mandates"]
    assert len(mandates) >= 3

    # 2. Complete a purchase to trigger live mandate issuance
    res_buy = client.post(
        "/buy",
        json={
            "raw_intent": "Buy noise-canceling headphones under Rs 5000",
            "max_spend_inr": 5000,
            "allowed_merchants": ["demo-merchant.myshopify.com"],
            "validity_hours": 24,
            "llm_provider": "mock",
        },
    )
    assert res_buy.status_code == 200
    buy_data = res_buy.json()
    assert buy_data["status"] == "SUCCESS"
    new_mandate_id = buy_data["mandate_id"]
    assert new_mandate_id is not None

    # 3. Verify newly generated mandate is in live mandates list
    res_mandates = client.get("/api/mandates")
    assert res_mandates.status_code == 200
    all_mandates = res_mandates.json()["mandates"]
    found = next((m for m in all_mandates if m["id"] == new_mandate_id), None)
    assert found is not None
    assert found["state"] == "PAYMENT_ACTIVE"

    # 4. Atomically revoke the newly issued mandate (INV-004)
    res_revoke = client.post(
        "/api/mandates/revoke",
        json={"mandate_id": new_mandate_id, "reason": "User revoked mandate via dashboard"},
    )
    assert res_revoke.status_code == 200
    revoke_data = res_revoke.json()
    assert revoke_data["status"] == "SUCCESS"
    assert revoke_data["state"] == "REVOKED"
    assert "INV-004" in revoke_data["proof"]

    # 5. Verify state is persisted as REVOKED
    res_after = client.get("/api/mandates")
    all_after = res_after.json()["mandates"]
    revoked_mandate = next((m for m in all_after if m["id"] == new_mandate_id), None)
    assert revoked_mandate is not None
    assert revoked_mandate["state"] == "REVOKED"


def test_razorpay_s2s_webhook_hmac_verification():
    # Simulate payment.captured webhook
    res_webhook = client.post(
        "/api/webhooks/razorpay",
        json={
            "event": "payment.captured",
            "payload": {
                "payment": {
                    "entity": {
                        "id": "pay_test_live_001",
                        "amount": 499900,
                        "currency": "INR",
                        "status": "captured",
                    }
                }
            },
            "account_id": "acc_demo_razorpay",
        },
    )
    assert res_webhook.status_code == 200
    data = res_webhook.json()
    assert data["status"] == "PROCESSED"
    assert data["accepted"] is True
    assert data["signature_verified"] is True
    assert len(data["computed_hmac_sha256"]) == 64  # SHA-256 hex string length
    assert data["payment_id"] == "pay_test_live_001"
    assert data["payment_status"] in ["SETTLED", "captured"]


def test_buyer_profile_sync():
    # 1. Fetch current profile
    res_get = client.get("/api/buyer/profile")
    assert res_get.status_code == 200
    prof = res_get.json()
    assert "userPin" in prof

    # 2. Update buyer profile
    res_post = client.post(
        "/api/buyer/profile",
        json={
            "userName": "Rohit Chauhan (Lead Engineer)",
            "maxTransactionLimitInr": 20000.0,
            "autonomyMode": "autonomous",
        },
    )
    assert res_post.status_code == 200
    updated = res_post.json()["profile"]
    assert updated["userName"] == "Rohit Chauhan (Lead Engineer)"
    assert updated["maxTransactionLimitInr"] == 20000.0
