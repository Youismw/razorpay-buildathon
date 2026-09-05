import datetime
from fastapi.testclient import TestClient
from modules.guardrail_shell.main import app
from modules.guardrail_shell.schema_validator import validate_proposal_schema
from modules.guardrail_shell.policy_engine import enforce_policy
from modules.guardrail_shell.grounding_oracle import verify_grounding
from modules.guardrail_shell.confidence_gate import compute_confidence


# --- Helpers ---

def _make_valid_proposal(
    offer_price_paise: int = 449900,
    merchant_id: str = "demo-merchant.myshopify.com",
    product_id: str = "PROD-WH-CH520",
    constraint_hash: str = "sha256:test_hash",
):
    return {
        "proposal_id": "prop-001",
        "intent_id": "intent-abc123",
        "constraint_hash": constraint_hash,
        "items": [{
            "product_id": product_id,
            "product_name": "Sony WH-CH520",
            "merchant_id": merchant_id,
            "offer_price_paise": offer_price_paise,
            "quantity": 1,
            "currency": "INR",
            "category": "electronics",
        }],
        "total_price_paise": offer_price_paise,
    }


def _make_valid_constraints(
    max_paise: int = 500000,
    constraint_hash: str = "sha256:test_hash",
    allowed_merchants: list = None,
):
    now = datetime.datetime.now(datetime.timezone.utc)
    return {
        "intent_id": "intent-abc123",
        "raw_intent": "Buy headphones under Rs 5000",
        "spend_limit": {"max_amount_paise": max_paise, "currency": "INR"},
        "merchant_scope": {
            "allowed_merchants": allowed_merchants or ["demo-merchant.myshopify.com"],
            "category_blocklist": [],
        },
        "validity_window": {
            "valid_from_iso": now.isoformat(),
            "valid_until_iso": (now + datetime.timedelta(hours=24)).isoformat(),
            "validity_window_hours": 24,
        },
        "product_query": "headphones",
        "quantity": 1,
        "soft_preferences": [],
        "constraint_hash": constraint_hash,
        "compiled_at_iso": now.isoformat(),
    }


# --- Schema Validator Tests ---

def test_schema_rejects_unknown_fields():
    proposal = _make_valid_proposal()
    proposal["malicious_field"] = "injected"
    result = validate_proposal_schema(proposal)
    assert not result.valid


def test_schema_rejects_missing_required_fields():
    result = validate_proposal_schema({"proposal_id": "x"})
    assert not result.valid


def test_schema_accepts_valid_proposal():
    proposal = _make_valid_proposal()
    result = validate_proposal_schema(proposal)
    assert result.valid
    assert result.proposal is not None


def test_schema_rejects_total_mismatch():
    proposal = _make_valid_proposal()
    proposal["total_price_paise"] = 999999  # Doesn't match items sum
    result = validate_proposal_schema(proposal)
    assert not result.valid


# --- Policy Engine Tests (INV-010) ---

def test_policy_rejects_overspend():
    """INV-010: offer_price = max_spend + 1 → Policy Engine rejects."""
    from modules.guardrail_shell.schema_validator import ProposalObject
    from modules.constraint_compiler.models import CompiledConstraints

    proposal = ProposalObject(**_make_valid_proposal(offer_price_paise=500100))
    constraints = CompiledConstraints(**_make_valid_constraints(max_paise=500000))
    result = enforce_policy(proposal, constraints)
    assert not result.passed
    assert any(v.code == "MAX_SPEND_EXCEEDED" for v in result.violations)


def test_policy_accepts_within_budget():
    from modules.guardrail_shell.schema_validator import ProposalObject
    from modules.constraint_compiler.models import CompiledConstraints

    proposal = ProposalObject(**_make_valid_proposal(offer_price_paise=449900))
    constraints = CompiledConstraints(**_make_valid_constraints(max_paise=500000))
    result = enforce_policy(proposal, constraints)
    assert result.passed


def test_policy_rejects_unlisted_merchant():
    from modules.guardrail_shell.schema_validator import ProposalObject
    from modules.constraint_compiler.models import CompiledConstraints

    proposal = ProposalObject(**_make_valid_proposal(merchant_id="evil-merchant.com"))
    constraints = CompiledConstraints(**_make_valid_constraints(
        allowed_merchants=["demo-merchant.myshopify.com"]
    ))
    result = enforce_policy(proposal, constraints)
    assert not result.passed
    assert any(v.code == "MERCHANT_NOT_ALLOWED" for v in result.violations)


# --- Grounding Oracle Tests ---

def test_grounding_verifies_known_product():
    from modules.guardrail_shell.schema_validator import ProposalItem
    items = [ProposalItem(
        product_id="PROD-WH-CH520",
        product_name="Sony WH-CH520",
        merchant_id="demo-merchant.myshopify.com",
        offer_price_paise=449900,
    )]
    result = verify_grounding(items)
    assert result.verified


def test_grounding_rejects_unknown_product():
    from modules.guardrail_shell.schema_validator import ProposalItem
    items = [ProposalItem(
        product_id="PROD-FAKE-999",
        product_name="Fake Product",
        merchant_id="demo-merchant.myshopify.com",
        offer_price_paise=100,
    )]
    result = verify_grounding(items)
    assert not result.verified


def test_grounding_rejects_inflated_price():
    from modules.guardrail_shell.schema_validator import ProposalItem
    items = [ProposalItem(
        product_id="PROD-WH-CH520",
        product_name="Sony WH-CH520",
        merchant_id="demo-merchant.myshopify.com",
        offer_price_paise=999900,  # Way above catalog price of 499900
    )]
    result = verify_grounding(items)
    assert not result.verified


def test_grounding_rejects_insufficient_stock():
    from modules.guardrail_shell.schema_validator import ProposalItem
    items = [ProposalItem(
        product_id="PROD-WH-CH520",
        product_name="Sony WH-CH520",
        merchant_id="demo-merchant.myshopify.com",
        offer_price_paise=449900,
        quantity=500,  # Exceeds available stock
    )]
    result = verify_grounding(items)
    assert not result.verified
    assert "insufficient stock" in result.unverified_items[0].lower()


# --- Confidence Gate Tests ---

def test_confidence_approves_when_all_pass():
    result = compute_confidence(schema_valid=True, grounding_verified=True, policy_passed=True)
    assert result.decision == "APPROVED"
    assert result.confidence_score >= 0.85


def test_confidence_escalates_on_policy_failure():
    result = compute_confidence(schema_valid=True, grounding_verified=True, policy_passed=False)
    assert result.decision == "ESCALATED"
    assert result.confidence_score == 0.0
    assert result.hitl_payload is not None


def test_confidence_escalates_on_grounding_failure():
    result = compute_confidence(schema_valid=True, grounding_verified=False, policy_passed=True)
    assert result.decision == "ESCALATED"


# --- Unified API Endpoint Tests ---

def test_guardrail_api_approves_valid_proposal():
    client = TestClient(app)
    req = {
        "proposal_raw": _make_valid_proposal(),
        "compiled_constraints": _make_valid_constraints(),
    }
    res = client.post("/v1/guardrail/evaluate", json=req)
    assert res.status_code == 200
    data = res.json()
    assert data["decision"] == "APPROVED"
    assert data["schema_valid"] is True
    assert data["policy_passed"] is True
    assert data["grounding_verified"] is True


def test_guardrail_api_rejects_overspend():
    """INV-010: The Mandate Vault is never invoked for over-budget proposals."""
    client = TestClient(app)
    req = {
        "proposal_raw": _make_valid_proposal(offer_price_paise=500100),
        "compiled_constraints": _make_valid_constraints(max_paise=500000),
    }
    res = client.post("/v1/guardrail/evaluate", json=req)
    assert res.status_code == 200
    data = res.json()
    assert data["decision"] == "ESCALATED"
    assert data["policy_passed"] is False


def test_guardrail_api_rejects_bad_schema():
    """INV-007: Unsupported constraint → rejection, never silent drop."""
    client = TestClient(app)
    req = {
        "proposal_raw": {"garbage": "data"},
        "compiled_constraints": _make_valid_constraints(),
    }
    res = client.post("/v1/guardrail/evaluate", json=req)
    assert res.status_code == 200
    data = res.json()
    assert data["decision"] == "ESCALATED"
    assert data["schema_valid"] is False
