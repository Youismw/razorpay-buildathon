"""
Tests for Live UPI Autopay Tokenization & Deterministic Guardrail Performance Benchmarks.
Covers:
  - POST /api/mandates/tokenize (NPCI registration & UMN assignment)
  - POST /api/webhooks/razorpay (mandate.authenticated & token.confirmed callbacks)
  - POST /api/webhooks/razorpay (mandate.revoked callback)
  - POST /api/guardrail/evaluate (high-speed single-shot evaluation)
  - GET /api/guardrail/benchmark (throughput and SLA validation >1,500 RPS)
"""

import hmac
import hashlib
import json
import pytest
from fastapi.testclient import TestClient
from modules.orchestrator.main import app, WEBHOOK_SECRET, LIVE_MANDATES, revocation_engine


@pytest.fixture
def client():
    return TestClient(app)


def test_tokenize_mandate_api_creates_active_token(client):
    """Verify that POST /api/mandates/tokenize registers a mandate with NPCI UMN and Token ID."""
    req_payload = {
        "merchant_id": "demo-merchant.myshopify.com",
        "max_amount_inr": 7500.0,
        "vpa": "rohit@okhdfcbank",
        "customer_id": "cust_test_99",
        "frequency": "as_presented",
        "simulate_instant_auth": True,
    }
    resp = client.post("/api/mandates/tokenize", json=req_payload)
    assert resp.status_code == 200
    data = resp.json()

    assert data["status"] == "TOKENIZED"
    assert "mandate" in data
    mandate = data["mandate"]
    assert mandate["state"] == "PAYMENT_ACTIVE"
    assert mandate["max_amount_inr"] == 7500.0
    assert mandate["vpa"] == "rohit@okhdfcbank"
    assert mandate["token_id"].startswith("token_")
    assert mandate["umn"].startswith("UMN-NPCI-")

    # Verify presence in GET /api/mandates
    list_resp = client.get("/api/mandates")
    assert list_resp.status_code == 200
    mandates = list_resp.json().get("mandates", [])
    found = any(m["id"] == mandate["id"] for m in mandates)
    assert found, f"Mandate {mandate['id']} should appear in mandates list"


def test_webhook_mandate_authenticated_callback(client):
    """Verify that an incoming mandate.authenticated webhook activates the mandate and stores UMN."""
    mandate_id = "man_live_npci_test_001"
    token_id = "token_live_npci_9988"
    umn = "UMN-NPCI-2026-LIVE-889"

    payload = {
        "event": "mandate.authenticated",
        "account_id": "acc_demo_razorpay",
        "payload": {
            "mandate": {
                "entity": {
                    "id": mandate_id,
                    "token_id": token_id,
                    "customer_id": "cust_live_01",
                    "max_amount": 800000,
                    "status": "active",
                    "umn": umn,
                    "vpa": "buyer@okhdfcbank",
                    "merchant_id": "demo-merchant.myshopify.com",
                }
            },
            "token": {
                "entity": {
                    "id": token_id,
                    "customer_id": "cust_live_01",
                    "max_amount": 800000,
                    "status": "confirmed",
                }
            },
        },
    }

    body_bytes = json.dumps(payload, sort_keys=True).encode("utf-8")
    sig = hmac.new(WEBHOOK_SECRET.encode("utf-8"), body_bytes, hashlib.sha256).hexdigest()

    resp = client.post(
        "/api/webhooks/razorpay",
        json=payload,
        headers={"x-razorpay-signature": sig},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "PROCESSED"
    assert data["accepted"] is True
    assert data["signature_verified"] is True
    assert data["mandate_id"] == mandate_id
    assert data["token_id"] == token_id
    assert data["umn"] == umn

    # Verify mandate in LIVE_MANDATES
    mandates = client.get("/api/mandates").json().get("mandates", [])
    matched = [m for m in mandates if m["id"] == mandate_id]
    assert len(matched) == 1
    assert matched[0]["state"] == "PAYMENT_ACTIVE"
    assert matched[0]["token_id"] == token_id
    assert matched[0]["umn"] == umn


def test_webhook_mandate_revoked_callback(client):
    """Verify that an incoming mandate.revoked webhook transitions mandate state to REVOKED."""
    # First tokenize
    tokenize_resp = client.post("/api/mandates/tokenize", json={"max_amount_inr": 3000.0}).json()
    mid = tokenize_resp["mandate"]["id"]

    # Send mandate.revoked webhook
    payload = {
        "event": "mandate.revoked",
        "account_id": "acc_demo_razorpay",
        "payload": {
            "mandate": {
                "entity": {
                    "id": mid,
                    "status": "revoked",
                }
            }
        },
    }
    body_bytes = json.dumps(payload, sort_keys=True).encode("utf-8")
    sig = hmac.new(WEBHOOK_SECRET.encode("utf-8"), body_bytes, hashlib.sha256).hexdigest()

    resp = client.post(
        "/api/webhooks/razorpay",
        json=payload,
        headers={"x-razorpay-signature": sig},
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "PROCESSED"

    # Verify state is REVOKED
    mandates = client.get("/api/mandates").json().get("mandates", [])
    m_record = next(m for m in mandates if m["id"] == mid)
    assert m_record["state"] == "REVOKED"


def test_guardrail_evaluate_api_endpoint(client):
    """Verify that POST /api/guardrail/evaluate evaluates the 4-stage gate within <5ms SLA."""
    resp = client.post("/api/guardrail/evaluate", json={"max_spend_inr": 5000.0})
    assert resp.status_code == 200
    data = resp.json()

    assert data["decision"] == "APPROVED"
    assert data["confidence_score"] >= 0.85
    assert data["schema_valid"] is True
    assert data["policy_passed"] is True
    assert data["grounding_verified"] is True
    assert data["latency_ms"] < 5.0
    assert data["sla_satisfied"] is True


def test_guardrail_benchmark_api_endpoint(client):
    """Verify that GET /api/guardrail/benchmark sustains >=1,500 decisions/sec with <5ms latency."""
    resp = client.get("/api/guardrail/benchmark?iterations=1000")
    assert resp.status_code == 200
    data = resp.json()

    assert data["status"] == "SUCCESS"
    assert data["iterations"] == 1000
    assert data["throughput_decisions_per_sec"] >= 1500
    assert data["p99_latency_ms"] < 5.0
    assert data["sla_passed"] is True
    assert data["margin_over_target_pct"] > 0
