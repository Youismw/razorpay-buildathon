from fastapi.testclient import TestClient
from modules.orchestrator.main import app

client = TestClient(app)

def test_stage1_failure():
    res = client.post("/buy", json={"raw_intent": "Buy", "max_spend_inr": 5000, "simulate_failure_stage": 1})
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "FAILED"
    assert data["decision"] == "COMPILATION_ERROR"

def test_stage2_failure():
    res = client.post("/buy", json={"raw_intent": "Purchase quantum teleportation hyperdrive module", "max_spend_inr": 5000, "simulate_failure_stage": 2})
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "FAILED"
    assert data["decision"] == "REASONING_ERROR"

def test_stage3_failure():
    res = client.post("/buy", json={"raw_intent": "Buy Sony WH-CH520 Wireless Headphones", "max_spend_inr": 50, "simulate_failure_stage": 3})
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ESCALATED"
    assert data["decision"] in ["SCHEMA_REJECTED", "ESCALATED", "POLICY_BLOCKED"]

def test_stage4_failure():
    res = client.post("/buy", json={"raw_intent": "Authorize purchase with simulated ES256 key mismatch", "max_spend_inr": 5000, "simulate_failure_stage": 4})
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "FAILED"
    assert data["decision"] == "VAULT_SIGNING_ERROR"

def test_stage5_failure():
    res = client.post("/buy", json={"raw_intent": "Purchase Sony WH-CH520 with concurrent mandate revocation", "max_spend_inr": 5000, "simulate_failure_stage": 5})
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "FAILED"
    assert data["decision"] == "SETTLEMENT_ERROR"
