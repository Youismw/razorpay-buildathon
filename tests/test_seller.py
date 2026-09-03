"""
Tests for Universal Commerce Adapter & Seller Management (FR-UCP-001, FR-UCP-002)
Validates competitor price scanning, dynamic margin calculations, logistics dispatch,
and settlement presets.
"""

from fastapi.testclient import TestClient
from modules.orchestrator.main import app

client = TestClient(app)


def test_seller_profile_get_and_update():
    # 1. Get profile
    res = client.get("/api/seller/profile")
    assert res.status_code == 200
    data = res.json()
    assert data["merchant_id"] == "demo-merchant.myshopify.com"
    assert data["business_type"] in ["electronics", "groceries", "fashion", "beauty", "hardware", "construction"]
    assert len(data["marketplaces"]) >= 3

    # 2. Update profile
    data["default_margin_pct"] = 30.0
    data["autonomy_mode"] = "autonomous"
    res_update = client.post("/api/seller/profile", json=data)
    assert res_update.status_code == 200
    updated = res_update.json()
    assert updated["default_margin_pct"] == 30.0


def test_competitor_scan_intelligence():
    res = client.post(
        "/api/seller/competitor-scan",
        json={
            "product_name": "Sony WH-CH520 Wireless Headphones",
            "base_cost_inr": 3600.0,
            "target_margin_pct": 25.0,
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert len(data["competitor_prices"]) >= 3
    assert data["recommended_listing_price_inr"] > 3600.0
    assert data["estimated_margin_pct"] >= 15.0
    assert len(data["ai_deliberation"]) >= 2


def test_logistics_dispatch():
    res = client.post(
        "/api/seller/logistics/dispatch",
        json={
            "order_id": "ORD-TEST-100",
            "carrier_preference": "BlueDart Express",
            "recipient_type": "ai_purchasing_agent",
            "recipient_name": "AP2 Subagent",
            "delivery_address": "Bengaluru, KA",
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["order_id"] == "ORD-TEST-100"
    assert data["carrier"] == "BlueDart Express"
    assert data["tracking_id"].startswith("AWB-")
    assert data["dispatch_status"] == "IN_TRANSIT"


def test_seller_analytics_and_orders():
    # Analytics
    res_analytics = client.get("/api/seller/analytics?timeframe=3m")
    assert res_analytics.status_code == 200
    analytics = res_analytics.json()
    assert analytics["gross_revenue_inr"] > 0
    assert len(analytics["recommendations"]) >= 3
    assert "AP2 Agentic Gateway" in analytics["channel_breakdown"]

    # Orders with cryptographic proof
    res_orders = client.get("/api/seller/orders")
    assert res_orders.status_code == 200
    orders = res_orders.json()["orders"]
    assert len(orders) >= 3
    for o in orders:
        assert "manifest_hash" in o
        assert "order_status" in o


def test_industry_settlement_presets():
    for ind in ["groceries", "electronics", "fashion", "beauty", "construction"]:
        res = client.get(f"/api/seller/settlement/presets/{ind}")
        assert res.status_code == 200
        preset = res.json()
        assert preset["business_type"] == ind
        assert preset["payout_schedule"] in ["instant_t0", "daily_t1", "weekly_t7"]


def test_universal_catalog_and_buyer_seller_sync():
    # 1. Seller adds a new product to the universal AP2 catalog
    res_add = client.post(
        "/api/seller/catalog/add",
        json={
            "name": "Bose QuietComfort 45 Noise Canceling Headphones",
            "price_inr": 24999.0,
            "category": "electronics",
            "stock": 10,
            "supplier_cost_inr": 18500.0,
        },
    )
    assert res_add.status_code == 200
    prod_id = res_add.json()["product_id"]

    # 2. Verify universal catalog exposes the new item to the buyer
    res_cat = client.get("/api/catalog")
    assert res_cat.status_code == 200
    cat_data = res_cat.json()
    assert prod_id in cat_data["demo-merchant.myshopify.com"]["products"]
    initial_stock = cat_data["demo-merchant.myshopify.com"]["products"][prod_id]["stock"]
    assert initial_stock == 10

    # 3. Buyer purchases the product via the AP2 deterministic sandwich
    res_buy = client.post(
        "/buy",
        json={
            "raw_intent": "Buy Bose QuietComfort 45 Noise Canceling Headphones",
            "max_spend_inr": 30000.0,
            "allowed_merchants": ["demo-merchant.myshopify.com"],
            "validity_hours": 24,
            "llm_provider": "mock",
            "buyer_did": "agent-buyer-rohit@ap2",
        },
    )
    assert res_buy.status_code == 200
    buy_data = res_buy.json()
    assert buy_data["status"] == "SUCCESS"
    constraint_hash = buy_data["constraint_hash"]

    # 4. Verify inventory in universal catalog was decremented by 1
    res_cat2 = client.get("/api/catalog")
    assert res_cat2.json()["demo-merchant.myshopify.com"]["products"][prod_id]["stock"] == 9

    # 5. Verify the order is recorded in the seller portal with the EXACT same cryptographic hash
    res_orders = client.get("/api/seller/orders")
    assert res_orders.status_code == 200
    seller_orders = res_orders.json()["orders"]
    latest_order = seller_orders[0]
    assert latest_order["product_id"] == prod_id
    assert latest_order["manifest_hash"] == constraint_hash
    assert latest_order["buyer_identifier"] == "agent-buyer-rohit@ap2"
    assert latest_order["order_status"] == "CONFIRMED"

    # 6. Verify seller analytics reflects increased revenue
    res_analytics = client.get("/api/seller/analytics?timeframe=1m")
    assert res_analytics.status_code == 200
    analytics_data = res_analytics.json()
    assert analytics_data["gross_revenue_inr"] > 184500.0

