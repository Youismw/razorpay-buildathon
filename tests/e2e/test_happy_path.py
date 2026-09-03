"""
E2E Test: Happy Path — Full Steel Thread (DEMO.md Scenario 1)
"Buy noise-canceling headphones under ₹5000 from DemoMerchant."

Expected: SETTLED in ledger, vault-signed mandate, JSONL export shows full trace.
"""

from fastapi.testclient import TestClient
from modules.orchestrator.main import app


def test_happy_path_full_steel_thread():
    """
    Gherkin: Autonomous purchase within spend limit and verified grounding.
    Validates the complete Deterministic Sandwich flow.
    """
    client = TestClient(app)

    # Execute full flow
    res = client.post("/buy", json={
        "raw_intent": "Buy noise-canceling headphones under Rs 5000",
        "max_spend_inr": 5000,
        "allowed_merchants": ["demo-merchant.myshopify.com"],
        "validity_hours": 24,
        "llm_provider": "mock",
    })

    assert res.status_code == 200
    data = res.json()

    # Verify final outcome
    assert data["status"] == "SUCCESS"
    assert data["decision"] == "APPROVED"
    assert data["mandate_id"] is not None
    assert data["compact_jws"] is not None
    assert data["constraint_hash"].startswith("sha256:")
    assert data["confidence_score"] >= 0.85
    assert data["total_price_paise"] <= 500000  # ₹5000 = 500000 paise

    # Verify audit trail completeness
    stages = [step["stage"] for step in data["audit_trail"]]
    assert "CONSTRAINT_COMPILATION" in stages
    assert "LLM_REASONING" in stages
    assert "SCHEMA_VALIDATION" in stages
    assert "POLICY_ENFORCEMENT" in stages
    assert "GROUNDING_VERIFICATION" in stages
    assert "CONFIDENCE_GATE" in stages
    assert "VAULT_SIGNING" in stages
    assert "SETTLEMENT" in stages

    # Verify policy enforcement passed
    policy_step = next(s for s in data["audit_trail"] if s["stage"] == "POLICY_ENFORCEMENT")
    assert policy_step["passed"] is True

    # Verify grounding passed
    grounding_step = next(s for s in data["audit_trail"] if s["stage"] == "GROUNDING_VERIFICATION")
    assert grounding_step["verified"] is True


def test_happy_path_overspend_blocked():
    """
    INV-010: Proposal exceeding max_spend → ESCALATED.
    Budget set to ₹100 (10000 paise), cheapest demo item is ₹999.
    """
    client = TestClient(app)

    res = client.post("/buy", json={
        "raw_intent": "Buy headphones under Rs 100",
        "max_spend_inr": 100,
        "allowed_merchants": ["demo-merchant.myshopify.com"],
        "llm_provider": "mock",
    })

    assert res.status_code == 200
    data = res.json()

    # The mock will find no product within ₹100 budget, so schema validation
    # should fail (offer_price_paise = 0 fails gt=0 constraint) or policy fails
    assert data["status"] in ("ESCALATED", "FAILED")
    assert data["decision"] != "APPROVED"
