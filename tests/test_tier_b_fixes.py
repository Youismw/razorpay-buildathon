"""
Unit and Integration Tests for Tier B Bug Fixes (Bugs 17-38).
Validates cross-stack edge cases, multi-merchant provenance,
logistics order progression, decimal pricing, and schema robustness.
"""

import os
import json
import uuid
import pytest
from fastapi.testclient import TestClient

from modules.constraint_compiler.compiler import extract_amount_from_intent, extract_quantity_from_intent, compile_intent
from modules.constraint_compiler.models import CompileRequest
from modules.sanitizer import normalize_unicode, strip_injection_patterns, neutralize_delimiters, sanitize_for_llm
from modules.reasoning_core.agent import _clean_and_parse_json
from modules.guardrail_shell.grounding_oracle import verify_grounding, DEMO_MERCHANT_CATALOG
from modules.guardrail_shell.schema_validator import ProposalItem
from modules.universal_commerce_adapter.seller_manager import (
    dispatch_order_logistics,
    get_analytics_summary,
    register_merchant_product,
    is_product_sold_by_merchant,
    LIVE_SELLER_ORDERS,
    SellerOrder,
    save_orders_to_disk,
    update_seller_profile,
    get_seller_profile,
)
from modules.orchestrator.main import app

client = TestClient(app)


def test_bug33_decimal_amount_extraction():
    """Bug 33: Regex must extract decimal amounts without dropping paise/cents."""
    # Under Rs 499.50 -> 49950 paise
    paise_1 = extract_amount_from_intent("Buy earbuds under Rs 499.50")
    assert paise_1 == 49950

    # ₹1299.99 -> 129999 paise
    paise_2 = extract_amount_from_intent("Find a power bank for ₹1299.99")
    assert paise_2 == 129999

    # 49.5 inr -> 4950 paise
    paise_3 = extract_amount_from_intent("49.5 inr notebook")
    assert paise_3 == 4950

    # Standard integer remains intact: under Rs 5000 -> 500000 paise
    paise_4 = extract_amount_from_intent("Buy headphones under Rs 5000")
    assert paise_4 == 500000


def test_bug34_natural_quantity_extraction():
    """Bug 34: Natural language quantities must be parsed into compiled constraints."""
    q1 = extract_quantity_from_intent("Buy 3 bottles of cold-pressed olive oil")
    assert q1 == 3

    q2 = extract_quantity_from_intent("Order 2 packs of organic coffee")
    assert q2 == 2

    q3 = extract_quantity_from_intent("Buy 5 units of USB-C cables")
    assert q3 == 5

    # Default without explicit quantity is 1
    q4 = extract_quantity_from_intent("Buy Sony WH-CH520 headphones")
    assert q4 == 1

    # End-to-end compilation preserves quantity
    compiled, _, _ = compile_intent(CompileRequest(raw_intent="Buy 4 units of AAA batteries under Rs 500"))
    assert compiled.quantity == 4
    assert "units of" not in compiled.product_query


def test_bug35_sanitizer_null_safety():
    """Bug 35: Sanitizer functions must gracefully handle None without raising TypeError."""
    assert normalize_unicode(None) == ""
    assert strip_injection_patterns(None) == ""
    assert neutralize_delimiters(None) == ""
    assert sanitize_for_llm(None) == ""

    # Empty string also handled cleanly
    assert sanitize_for_llm("") == ""


def test_bug29_clean_and_parse_json_preamble_resilience():
    """Bug 29: JSON parser must strip leading conversational text and markdown fences."""
    # Markdown fence with leading text
    text_with_preamble = (
        "Here is the structured purchase proposal you requested:\n"
        "```json\n"
        "{\"proposal_id\": \"prop-test-01\", \"total_price_paise\": 499900}\n"
        "```\n"
        "Please let me know if you need changes."
    )
    parsed = _clean_and_parse_json(text_with_preamble)
    assert parsed["proposal_id"] == "prop-test-01"
    assert parsed["total_price_paise"] == 499900

    # Bare JSON without markdown
    bare_json = "{\"proposal_id\": \"prop-test-02\", \"total_price_paise\": 150000}"
    parsed_bare = _clean_and_parse_json(bare_json)
    assert parsed_bare["proposal_id"] == "prop-test-02"


def test_bug28_multi_merchant_grounding_composite_hash():
    """Bug 28: Grounding verification across multiple merchants must aggregate all manifest hashes."""
    # Catalog with two merchants
    multi_catalog = {
        "merchant-alpha.com": {
            "manifest_hash": "sha256:alpha_manifest_111",
            "products": {
                "PROD-A": {"name": "Alpha Item", "price_paise": 10000, "in_stock": True, "stock": 10}
            }
        },
        "merchant-beta.com": {
            "manifest_hash": "sha256:beta_manifest_222",
            "products": {
                "PROD-B": {"name": "Beta Item", "price_paise": 20000, "in_stock": True, "stock": 10}
            }
        }
    }

    items = [
        ProposalItem(product_id="PROD-A", product_name="Alpha Item", merchant_id="merchant-alpha.com", offer_price_paise=10000, quantity=1),
        ProposalItem(product_id="PROD-B", product_name="Beta Item", merchant_id="merchant-beta.com", offer_price_paise=20000, quantity=1),
    ]

    result = verify_grounding(items, multi_catalog)
    assert result.verified is True
    # Must produce a composite sha256 committing to both manifests
    assert result.manifest_hash is not None
    assert result.manifest_hash.startswith("sha256:")
    assert result.manifest_hash != "sha256:beta_manifest_222"
    assert result.manifest_hash != "sha256:alpha_manifest_111"


def test_bug26_logistics_dispatch_order_state_progression():
    """Bug 26: dispatch_order_logistics must update order status to DISPATCHED and attach dispatch record."""
    test_ord_id = f"ORD-TEST-DISP-{uuid.uuid4().hex[:6].upper()}"
    test_order = SellerOrder(
        order_id=test_ord_id,
        trace_id=f"trace-{test_ord_id.lower()}",
        timestamp="2026-09-04T12:00:00Z",
        product_id="PROD-WH-CH520",
        product_name="Sony WH-CH520 Headphones",
        category="electronics",
        quantity=1,
        supplier_cost_inr=3600.0,
        selling_price_inr=4999.0,
        net_profit_inr=1399.0,
        profit_margin_pct=28.0,
        channel="ap2_gateway",
        buyer_type="ai_purchasing_agent",
        buyer_identifier="buyer-test",
        order_status="CONFIRMED",
        manifest_hash="sha256:test_manifest_hash_123",
        jws_token_preview="eyJhbGciOiJFUzI1NiJ9...",
    )
    LIVE_SELLER_ORDERS.append(test_order)

    # Dispatch order
    dispatch = dispatch_order_logistics(
        order_id=test_ord_id,
        carrier_preference="BlueDart Express",
        recipient_name="Tester",
        delivery_address="Indiranagar, Bengaluru",
    )

    assert dispatch.order_id == test_ord_id
    assert dispatch.tracking_id.startswith("AWB-")

    # Check that the order in LIVE_SELLER_ORDERS was updated
    matched = next((o for o in LIVE_SELLER_ORDERS if o.order_id == test_ord_id), None)
    assert matched is not None
    assert matched.order_status == "DISPATCHED"
    assert matched.logistics is not None
    assert matched.logistics.tracking_id == dispatch.tracking_id

    # Clean up
    LIVE_SELLER_ORDERS.remove(test_order)


def test_bug18_analytics_includes_paid_confirmed():
    """Bug 18: get_analytics_summary must include orders with status PAID_CONFIRMED."""
    # Initial summary
    initial_summary = get_analytics_summary("3m")
    initial_orders = initial_summary.total_orders_count

    # Insert a PAID_CONFIRMED order
    paid_order = SellerOrder(
        order_id="ORD-TEST-PAID-01",
        trace_id="trace-test-paid-01",
        timestamp="2026-09-04T12:00:00Z",
        product_id="PROD-WH-CH520",
        product_name="Sony WH-CH520 Headphones",
        category="electronics",
        quantity=1,
        supplier_cost_inr=3600.0,
        selling_price_inr=4999.0,
        net_profit_inr=1399.0,
        profit_margin_pct=28.0,
        channel="ap2_gateway",
        buyer_type="ai_purchasing_agent",
        buyer_identifier="buyer-test",
        order_status="PAID_CONFIRMED",
        manifest_hash="sha256:test_paid_manifest_hash",
        jws_token_preview="eyJhbGciOiJFUzI1NiJ9...",
    )
    LIVE_SELLER_ORDERS.append(paid_order)

    updated_summary = get_analytics_summary("3m")
    assert updated_summary.total_orders_count == initial_orders + 1
    assert updated_summary.gross_revenue_inr >= initial_summary.gross_revenue_inr + 4999.0

    # Clean up
    LIVE_SELLER_ORDERS.remove(paid_order)


def test_bug25_merchant_sku_persistence():
    """Bug 25: Registered merchant SKUs must be tracked in _MERCHANT_OWNED_SKUS."""
    test_pid = "PROD-CUSTOM-TEST-SKU"
    register_merchant_product("demo-merchant.myshopify.com", test_pid)
    assert is_product_sold_by_merchant(test_pid, "demo-merchant.myshopify.com") is True


def test_bug27_governance_override_userpin():
    """Bug 27: Governance override must authenticate against configured userPin."""
    # Update profile with custom userPin
    client.post("/api/buyer/profile", json={"userPin": "7744", "userName": "Rohit"})

    # 1. Authorize with correct userPin 7744 -> APPROVED_BY_USER
    res_ok = client.post(
        "/api/governance/override",
        json={"override_token": "ovr-tok-1", "buyer_pin": "7744", "approved": True},
    )
    assert res_ok.status_code == 200
    assert res_ok.json()["status"] == "APPROVED_BY_USER"

    # 2. Authorize with wrong PIN -> 403 Forbidden
    res_bad = client.post(
        "/api/governance/override",
        json={"override_token": "ovr-tok-1", "buyer_pin": "0000", "approved": True},
    )
    assert res_bad.status_code == 403

    # Reset profile
    client.post("/api/buyer/profile", json={"userPin": "1234", "autonomyMode": "ask_above_limit", "maxTransactionLimitInr": 15000.0})


def test_bug38_unique_restock_product_ids():
    """Bug 38: Multiple restock items sharing name prefix must generate distinct product IDs."""
    profile_data = {
        "merchant_id": "demo-merchant.myshopify.com",
        "store_name": "Apex Goods & Electronics",
        "business_type": "groceries",
        "routine_restock_items": [
            {
                "id": "r1",
                "product_name": "ORGANIC COLD PRESSED APPLE JUICE 500ML",
                "category": "groceries",
                "supplier_cost_inr": 120.0,
                "current_stock": 20,
                "restock_threshold": 10,
                "restock_quantity": 25,
                "restock_interval_days": 14,
            },
            {
                "id": "r2",
                "product_name": "ORGANIC COLD PRESSED APPLE JUICE 1000ML",
                "category": "groceries",
                "supplier_cost_inr": 200.0,
                "current_stock": 20,
                "restock_threshold": 10,
                "restock_quantity": 25,
                "restock_interval_days": 14,
            }
        ]
    }
    updated = update_seller_profile(profile_data)
    assert updated is not None
    # Both items registered and distinct
    from modules.guardrail_shell.grounding_oracle import DEMO_MERCHANT_CATALOG
    m_prods = DEMO_MERCHANT_CATALOG["demo-merchant.myshopify.com"]["products"]
    juice_pids = [pid for pid, p in m_prods.items() if "APPLE JUICE" in p["name"].upper()]
    assert len(juice_pids) >= 2
    # Verify IDs are unique
    assert len(set(juice_pids)) == len(juice_pids)
