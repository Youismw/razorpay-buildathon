from fastapi.testclient import TestClient
from modules.orchestrator.main import app

client = TestClient(app)

def test_grocery_bundle_with_brand_alternatives():
    res = client.post(
        "/buy",
        json={
            "raw_intent": "Order my usual grocery list with dairy and breakfast staples",
            "max_spend_inr": 2000,
            "allowed_merchants": ["demo-merchant.myshopify.com"],
            "llm_provider": "mock",
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "SUCCESS"
    assert data["decision"] == "APPROVED"
    assert len(data.get("ai_thought_steps", [])) > 0
    # Verify thought trail mentions alternative substitution for out-of-stock brand
    thought_text = " ".join(data.get("ai_thought_steps", []))
    assert "OUT OF STOCK" in thought_text or "alternative brand" in thought_text

def test_catalog_purchase_over_budget_fails_guardrail():
    # Attempting to buy a ₹19,999 item with a ₹5,000 max transaction limit
    res = client.post(
        "/buy",
        json={
            "raw_intent": "Buy Sony WF-1000XM5 Noise Canceling Earbuds",
            "max_spend_inr": 5000,
            "allowed_merchants": ["demo-merchant.myshopify.com"],
        },
    )
    assert res.status_code == 200
    data = res.json()
    # Guardrail ceiling policy blocks this because the catalog item costs ₹19,999 > ₹5,000
    assert data["status"] in ["ESCALATED", "FAILED"]
    assert data["decision"] in ["SCHEMA_REJECTED", "ESCALATED", "POLICY_BLOCKED"]
