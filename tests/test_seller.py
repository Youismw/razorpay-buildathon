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


def test_seller_inventory_authorization_and_category_scoping():
    # 1. Fetch store catalog scoped to electronics
    res_store = client.get("/api/seller/catalog?scope=store&business_type=electronics")
    assert res_store.status_code == 200
    store_items = res_store.json()["items"]
    # Verify all returned items are in electronics or audio
    assert len(store_items) > 0
    for item in store_items:
        assert item["category"] in ["electronics", "audio"] or item["is_owned"] is True
        assert item["can_edit"] is True

    # 2. An electronics seller attempts to edit an unowned universal grocery item (Farm Fresh White Eggs)
    res_unauth = client.post(
        "/api/seller/catalog/update",
        json={
            "product_id": "PROD-EGG-REG",
            "merchant_id": "demo-merchant.myshopify.com",
            "business_type": "electronics",
            "stock": 999,
        },
    )
    assert res_unauth.status_code == 403
    assert "Permission Denied" in res_unauth.json()["detail"]

    # 3. An electronics seller edits a store-owned product (Logitech Mouse) -> allowed
    res_auth = client.post(
        "/api/seller/catalog/update",
        json={
            "product_id": "PROD-LOGI-MX3S",
            "merchant_id": "demo-merchant.myshopify.com",
            "business_type": "electronics",
            "stock": 77,
            "price_inr": 8995.0,
        },
    )
    assert res_auth.status_code == 200
    assert res_auth.json()["product"]["stock"] == 77

    # 4. Import a common market product (e.g. coffee dripper from home category) into the store
    res_import = client.post(
        "/api/seller/catalog/import",
        json={
            "product_id": "PROD-COF-V60",
            "merchant_id": "demo-merchant.myshopify.com",
            "stock": 35,
            "price_inr": 1899.0,
        },
    )
    assert res_import.status_code == 200
    assert res_import.json()["status"] == "SUCCESS"

    # Now editing the imported product succeeds
    res_edit_imported = client.post(
        "/api/seller/catalog/update",
        json={
            "product_id": "PROD-COF-V60",
            "merchant_id": "demo-merchant.myshopify.com",
            "business_type": "electronics",
            "stock": 40,
        },
    )
    assert res_edit_imported.status_code == 200
    assert res_edit_imported.json()["product"]["stock"] == 40


def test_pack_size_does_not_inflate_order_quantity():
    # Verify initial stock of eggs (ensure sufficient stock if depleted by prior runs)
    from modules.guardrail_shell.grounding_oracle import DEMO_MERCHANT_CATALOG
    if DEMO_MERCHANT_CATALOG["demo-merchant.myshopify.com"]["products"]["PROD-EGG-REG"]["stock"] <= 0:
        DEMO_MERCHANT_CATALOG["demo-merchant.myshopify.com"]["products"]["PROD-EGG-REG"]["stock"] = 25
        DEMO_MERCHANT_CATALOG["demo-merchant.myshopify.com"]["products"]["PROD-EGG-REG"]["in_stock"] = True

    res_cat = client.get("/api/catalog")
    init_stock = res_cat.json()["demo-merchant.myshopify.com"]["products"]["PROD-EGG-REG"]["stock"]

    # Buyer orders "Buy Farm Fresh White Eggs (Pack of 6)"
    res_buy = client.post(
        "/buy",
        json={
            "raw_intent": "Buy Farm Fresh White Eggs (Pack of 6)",
            "max_spend_inr": 500.0,
            "allowed_merchants": ["demo-merchant.myshopify.com"],
            "validity_hours": 24,
            "llm_provider": "mock",
        },
    )
    assert res_buy.status_code == 200
    buy_data = res_buy.json()
    assert buy_data["status"] == "SUCCESS"

    # Inventory must decrement by EXACTLY 1, NOT 6!
    res_cat_after = client.get("/api/catalog")
    after_stock = res_cat_after.json()["demo-merchant.myshopify.com"]["products"]["PROD-EGG-REG"]["stock"]
    assert after_stock == init_stock - 1

    # Check seller order record has quantity 1
    res_orders = client.get("/api/seller/orders")
    latest_order = res_orders.json()["orders"][0]
    assert latest_order["product_id"] == "PROD-EGG-REG"
    assert latest_order["quantity"] == 1


