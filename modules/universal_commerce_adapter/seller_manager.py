"""
Universal Commerce Adapter — Seller Manager & Business Intelligence Core (FR-UCP-002)
Orchestrates AI Competitor Price Intelligence, Multi-Channel Listing,
Autonomous Logistics Dispatch, Cryptographic Order Audit Logs, and AI Strategy Advisory.
"""

import os
import json
import uuid
import datetime
import re
from typing import Any, Dict, List, Optional
from modules.universal_commerce_adapter.models import (
    SellerProfile,
    MarketplaceConnection,
    RoutineRestockItem,
    SettlementPreferences,
    CompetitorPricePoint,
    CompetitorScanResult,
    LogisticsDispatch,
    SellerOrder,
    AIStrategyRecommendation,
    AnalyticsSummary,
)

# In-memory mutable profile state for Thread 0
DEFAULT_SELLER_PROFILE = SellerProfile(
    merchant_id="demo-merchant.myshopify.com",
    store_name="Apex Goods & Electronics",
    business_type="electronics",
    autonomy_mode="autonomous",
    default_margin_pct=25.0,
    auto_clearance_enabled=True,
    clearance_discount_14d_pct=15.0,
    clearance_discount_30d_pct=30.0,
    marketplaces=[
        MarketplaceConnection(marketplace="ap2_gateway", account_id="AP2-MERCH-8821", fee_percentage=2.0),
        MarketplaceConnection(marketplace="amazon", account_id="AMZ-IN-99321", fee_percentage=9.5),
        MarketplaceConnection(marketplace="flipkart", account_id="FK-SELL-44129", fee_percentage=8.0),
        MarketplaceConnection(marketplace="ondc", account_id="ONDC-NODE-1029", fee_percentage=3.5),
    ],
    settlement=SettlementPreferences(
        payout_schedule="daily_t1",
        refund_policy="replacement_only_7d",
        dispute_resolution="ai_autonomous_arbitration",
        business_type="electronics",
        bank_account_last4="4921",
        auto_sweep_enabled=True,
    ),
    routine_restock_items=[
        RoutineRestockItem(
            id="restock-1",
            product_name="Sony WH-CH520 Wireless Headphones",
            category="electronics",
            supplier_cost_inr=3600.0,
            current_stock=42,
            restock_threshold=15,
            restock_quantity=50,
            restock_interval_days=14,
            preferred_margin_pct=28.0,
        ),
        RoutineRestockItem(
            id="restock-2",
            product_name="Amul Taaza Homogenised Toned Milk (1L)",
            category="groceries",
            supplier_cost_inr=58.0,
            current_stock=120,
            restock_threshold=30,
            restock_quantity=200,
            restock_interval_days=2,
            preferred_margin_pct=19.4,
        ),
        RoutineRestockItem(
            id="restock-3",
            product_name="Blue Tokai Attikan Dark Roast (250g)",
            category="groceries",
            supplier_cost_inr=330.0,
            current_stock=28,
            restock_threshold=10,
            restock_quantity=40,
            restock_interval_days=7,
            preferred_margin_pct=29.8,
        ),
    ],
)

_current_profile = DEFAULT_SELLER_PROFILE.model_copy(deep=True)


def get_seller_profile() -> SellerProfile:
    """Retrieve current merchant profile and governance settings."""
    return _current_profile


def update_seller_profile(profile_data: Dict[str, Any]) -> SellerProfile:
    """Update merchant profile and automatically sync routine restock staples into universal catalog."""
    global _current_profile
    _current_profile = SellerProfile.model_validate(profile_data)

    from modules.guardrail_shell.grounding_oracle import add_or_update_product
    merchant_id = _current_profile.merchant_id
    for item in _current_profile.routine_restock_items:
        clean_slug = re.sub(r"[^a-zA-Z0-9]+", "-", item.product_name).strip("-").upper()
        prod_id = f"PROD-{clean_slug[:14]}-{uuid.uuid4().hex[:6].upper()}"
        cost_inr = item.supplier_cost_inr or 100.0
        margin_mult = 1.0 + ((item.preferred_margin_pct or _current_profile.default_margin_pct or 25.0) / 100.0)
        selling_inr = round(cost_inr * margin_mult, 2)
        price_paise = int(selling_inr * 100)
        cost_paise = int(cost_inr * 100)

        add_or_update_product(
            merchant_id=merchant_id,
            product_id=prod_id,
            product_data={
                "name": item.product_name,
                "price_paise": price_paise,
                "category": item.category or "groceries",
                "in_stock": (item.current_stock or 25) > 0,
                "stock": item.current_stock or 25,
                "supplier_cost_paise": cost_paise,
            },
        )
        register_merchant_product(merchant_id, prod_id)

    return _current_profile


# Primary industry-to-category mapping for merchant catalogs
BUSINESS_TYPE_CATEGORIES: Dict[str, set] = {
    "electronics": {"electronics", "audio"},
    "groceries": {"groceries"},
    "fashion": {"fashion", "beauty"},
    "home": {"home"},
    "books": {"books"},
    "beauty": {"beauty"},
    "hardware": {"hardware", "construction"},
    "construction": {"construction", "hardware"},
}

# Persistent registry of custom or imported products owned by a specific merchant
_MERCHANT_OWNED_SKUS: Dict[str, set] = {}
MERCHANT_SKUS_FILE_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "data", "merchant_skus.json")


def save_merchant_skus_to_disk() -> None:
    """Save merchant registered SKUs to persistent disk storage."""
    try:
        os.makedirs(os.path.dirname(MERCHANT_SKUS_FILE_PATH), exist_ok=True)
        serializable = {m_id: sorted(list(skus)) for m_id, skus in _MERCHANT_OWNED_SKUS.items()}
        with open(MERCHANT_SKUS_FILE_PATH, "w", encoding="utf-8") as f:
            json.dump(serializable, f, indent=2)
    except Exception as e:
        print(f"[MERCHANT SKUS PERSISTENCE] Warning: failed to save merchant skus: {e}")


def load_merchant_skus_from_disk() -> None:
    """Load merchant registered SKUs from persistent disk storage."""
    global _MERCHANT_OWNED_SKUS
    try:
        if os.path.exists(MERCHANT_SKUS_FILE_PATH):
            with open(MERCHANT_SKUS_FILE_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, dict):
                    for m_id, skus in data.items():
                        _MERCHANT_OWNED_SKUS.setdefault(m_id, set()).update(skus)
    except Exception as e:
        print(f"[MERCHANT SKUS PERSISTENCE] Warning: failed to load merchant skus: {e}")


# Initialize SKUs from disk
load_merchant_skus_from_disk()


def register_merchant_product(merchant_id: str, product_id: str) -> None:
    """Register a product as explicitly owned/sold by a merchant."""
    _MERCHANT_OWNED_SKUS.setdefault(merchant_id, set()).add(product_id)
    save_merchant_skus_to_disk()


def is_product_sold_by_merchant(
    product_id: str,
    merchant_id: str = "demo-merchant.myshopify.com",
    business_type: Optional[str] = None,
    product_category: Optional[str] = None,
) -> bool:
    """
    Check whether a merchant has selling and editing authority over a product.
    A merchant sells a product if:
      1. The product ID is in their explicitly registered/imported store SKUs, OR
      2. The product category matches the merchant profile's primary business type (e.g. 'electronics' -> 'electronics', 'audio').
    """
    # Check explicitly registered/imported SKUs
    if product_id in _MERCHANT_OWNED_SKUS.get(merchant_id, set()):
        return True

    # Check routine restock items
    profile = get_seller_profile()
    for it in profile.routine_restock_items:
        clean_slug = re.sub(r"[^a-zA-Z0-9]+", "-", it.product_name).strip("-").upper()
        if product_id == it.id or product_id.startswith(f"PROD-{clean_slug[:14]}") or product_id.startswith(f"PROD-{clean_slug[:20]}"):
            return True

    # If category wasn't passed, find it from DEMO_MERCHANT_CATALOG
    if not product_category:
        from modules.guardrail_shell.grounding_oracle import DEMO_MERCHANT_CATALOG
        for m_id, m_data in DEMO_MERCHANT_CATALOG.items():
            if product_id in m_data.get("products", {}):
                product_category = m_data["products"][product_id].get("category", "")
                break

    # Check business type
    b_type = business_type or profile.business_type or "electronics"
    allowed_cats = BUSINESS_TYPE_CATEGORIES.get(b_type, {b_type})
    if product_category and product_category.lower() in allowed_cats:
        return True

    return False


def get_merchant_owned_products(
    merchant_id: str = "demo-merchant.myshopify.com",
    business_type: Optional[str] = None,
) -> Dict[str, Any]:
    """Filter the universal catalog and return only items owned/sold by this merchant."""
    from modules.guardrail_shell.grounding_oracle import DEMO_MERCHANT_CATALOG

    profile = get_seller_profile()
    b_type = business_type or profile.business_type or "electronics"
    allowed_cats = BUSINESS_TYPE_CATEGORIES.get(b_type, {b_type})
    owned_pids = set(_MERCHANT_OWNED_SKUS.get(merchant_id, set()))

    # Also add restock item IDs
    for it in profile.routine_restock_items:
        clean_slug = re.sub(r"[^a-zA-Z0-9]+", "-", it.product_name).strip("-").upper()
        owned_pids.add(f"PROD-{clean_slug[:20]}")

    m_data = DEMO_MERCHANT_CATALOG.get(merchant_id, {})
    all_prods = m_data.get("products", {})

    filtered = {}
    for pid, pdata in all_prods.items():
        cat = (pdata.get("category") or "").lower()
        if pid in owned_pids or cat in allowed_cats:
            filtered[pid] = pdata

    return filtered



def scan_competitor_prices(
    product_name: str,
    base_cost_inr: float = 3500.0,
    target_margin_pct: float = 25.0,
) -> CompetitorScanResult:
    """
    Live competitor price intelligence scanner.
    Scans Amazon, Flipkart, ONDC, and AP2 networks to recommend optimal pricing.
    """
    product_lower = product_name.lower()
    thought_steps: List[str] = [
        f"Initiating live competitor scan for '{product_name}' across all active marketplaces.",
        f"Base supplier cost provided: ₹{base_cost_inr:.2f} | Desired margin: {target_margin_pct:.1f}%.",
    ]

    # Synthetic realistic competitor points based on query keywords
    if "sony" in product_lower and ("520" in product_lower or "headphone" in product_lower):
        competitors = [
            CompetitorPricePoint(marketplace="Amazon India", merchant_name="Cloudtail Electronic", price_inr=5190.0, delivery_days=1, rating=4.4),
            CompetitorPricePoint(marketplace="Flipkart", merchant_name="RetailNet Pro", price_inr=4999.0, delivery_days=2, rating=4.3),
            CompetitorPricePoint(marketplace="ONDC Direct", merchant_name="AudioHub Express", price_inr=4850.0, delivery_days=3, rating=4.2),
            CompetitorPricePoint(marketplace="Croma Online", merchant_name="Croma Official", price_inr=5490.0, delivery_days=2, rating=4.5),
        ]
        category = "electronics"
    elif "milk" in product_lower or "dairy" in product_lower:
        competitors = [
            CompetitorPricePoint(marketplace="Blinkit Quick", merchant_name="Local Hub", price_inr=74.0, delivery_days=1, rating=4.8),
            CompetitorPricePoint(marketplace="Zepto Express", merchant_name="Darkstore 04", price_inr=72.0, delivery_days=1, rating=4.7),
            CompetitorPricePoint(marketplace="Amazon Fresh", merchant_name="Fresh Direct", price_inr=75.0, delivery_days=1, rating=4.6),
        ]
        category = "groceries"
    elif "coffee" in product_lower:
        competitors = [
            CompetitorPricePoint(marketplace="Amazon India", merchant_name="Blue Tokai Official", price_inr=480.0, delivery_days=2, rating=4.6),
            CompetitorPricePoint(marketplace="Flipkart", merchant_name="Gourmet Pantry", price_inr=490.0, delivery_days=3, rating=4.4),
            CompetitorPricePoint(marketplace="ONDC Direct", merchant_name="Specialty Roasters", price_inr=465.0, delivery_days=2, rating=4.7),
        ]
        category = "groceries"
    else:
        # General product synthesis
        competitors = [
            CompetitorPricePoint(marketplace="Amazon India", merchant_name="Premier Retailers", price_inr=round(base_cost_inr * 1.38, 2), delivery_days=2, rating=4.3),
            CompetitorPricePoint(marketplace="Flipkart", merchant_name="SuperCom India", price_inr=round(base_cost_inr * 1.34, 2), delivery_days=2, rating=4.2),
            CompetitorPricePoint(marketplace="ONDC Direct", merchant_name="Direct Manufacturer", price_inr=round(base_cost_inr * 1.29, 2), delivery_days=3, rating=4.1),
        ]
        category = "general"

    prices = [c.price_inr for c in competitors]
    lowest_price = min(prices)
    highest_price = max(prices)
    median_price = sorted(prices)[len(prices) // 2]

    # Target calculation: cost * (1 + margin) adjusted to beat median slightly
    desired_price = round(base_cost_inr * (1 + (target_margin_pct / 100.0)), 2)
    # Competitive adjustment: don't exceed median if desired margin permits
    if desired_price > median_price and (median_price - base_cost_inr) / base_cost_inr >= 0.15:
        recommended_price = median_price - 10.0
        thought_steps.append(
            f"Competitor Analysis: Market median price is ₹{median_price:.2f}. "
            f"Adjusting recommended price to ₹{recommended_price:.2f} to capture Buy Box on Amazon/Flipkart."
        )
    else:
        recommended_price = desired_price
        thought_steps.append(
            f"Competitor Analysis: Pricing set to ₹{recommended_price:.2f} preserving target margin {target_margin_pct:.1f}%."
        )

    est_margin = round(((recommended_price - base_cost_inr) / recommended_price) * 100.0, 1)

    thought_steps.append(
        f"Final Recommendation: List '{product_name}' at ₹{recommended_price:.2f} (Estimated Net Margin: {est_margin}%). "
        f"Active competitor spread: ₹{lowest_price:.2f} to ₹{highest_price:.2f}."
    )

    return CompetitorScanResult(
        product_name=product_name,
        category=category,
        competitor_prices=competitors,
        lowest_market_price_inr=lowest_price,
        highest_market_price_inr=highest_price,
        median_market_price_inr=median_price,
        recommended_listing_price_inr=recommended_price,
        estimated_margin_pct=est_margin,
        ai_deliberation=thought_steps,
    )


def get_industry_settlement_presets(business_type: str) -> SettlementPreferences:
    """Return recommended settlement rules and policies by industry."""
    presets = {
        "groceries": SettlementPreferences(
            payout_schedule="instant_t0",
            refund_policy="replacement_only_7d",
            dispute_resolution="ai_autonomous_arbitration",
            business_type="groceries",
            bank_account_last4="4921",
            auto_sweep_enabled=True,
        ),
        "electronics": SettlementPreferences(
            payout_schedule="daily_t1",
            refund_policy="replacement_only_7d",
            dispute_resolution="ai_autonomous_arbitration",
            business_type="electronics",
            bank_account_last4="4921",
            auto_sweep_enabled=True,
        ),
        "fashion": SettlementPreferences(
            payout_schedule="daily_t1",
            refund_policy="no_questions_asked_14d",
            dispute_resolution="ai_autonomous_arbitration",
            business_type="fashion",
            bank_account_last4="4921",
            auto_sweep_enabled=True,
        ),
        "beauty": SettlementPreferences(
            payout_schedule="daily_t1",
            refund_policy="final_sale",
            dispute_resolution="ai_autonomous_arbitration",
            business_type="beauty",
            bank_account_last4="4921",
            auto_sweep_enabled=True,
        ),
        "construction": SettlementPreferences(
            payout_schedule="weekly_t7",
            refund_policy="replacement_only_7d",
            dispute_resolution="manual_merchant_review",
            business_type="construction",
            bank_account_last4="4921",
            auto_sweep_enabled=True,
        ),
    }
    return presets.get(business_type, presets["electronics"])


def dispatch_order_logistics(
    order_id: str,
    carrier_preference: Optional[str] = None,
    recipient_type: str = "human_buyer",
    recipient_name: str = "Rohit Chauhan",
    delivery_address: str = "Koramangala 4th Block, Bengaluru, KA 560034",
) -> LogisticsDispatch:
    """
    Automated logistics carrier booking and airway bill (AWB) generation.
    Supports both human buyers and AI purchasing agents.
    """
    carriers = [
        {"name": "BlueDart Express", "cost": 120.0, "eta": "Tomorrow by 2:00 PM"},
        {"name": "Delhivery Air", "cost": 95.0, "eta": "2 Days (Standard Air)"},
        {"name": "Shadowfax Hyperlocal", "cost": 65.0, "eta": "Same Day (Within 4 Hours)"},
        {"name": "Dunzo Hyperlocal", "cost": 50.0, "eta": "Instant (45 Minutes)"},
    ]

    selected = next((c for c in carriers if c["name"] == carrier_preference), carriers[0])
    tracking_id = f"AWB-{uuid.uuid4().hex[:8].upper()}"

    dispatch = LogisticsDispatch(
        order_id=order_id,
        carrier=selected["name"],  # type: ignore
        tracking_id=tracking_id,
        estimated_delivery=selected["eta"],
        shipping_cost_inr=selected["cost"],
        dispatch_status="IN_TRANSIT",
        recipient_type=recipient_type,  # type: ignore
        recipient_name=recipient_name,
        delivery_address=delivery_address,
    )

    # Attach dispatch and transition order to DISPATCHED
    for order in LIVE_SELLER_ORDERS:
        if order.order_id == order_id:
            order.order_status = "DISPATCHED"
            order.logistics = dispatch
            save_orders_to_disk()
            break

    return dispatch


def generate_mock_seller_orders() -> List[SellerOrder]:
    """Generate realistic cryptographic orders with full audit records and failure diagnosis."""
    orders = [
        SellerOrder(
            order_id="ORD-882190",
            trace_id="trace-77a9f2e01b",
            timestamp=(datetime.datetime.now() - datetime.timedelta(hours=2)).isoformat(),
            product_id="PROD-WH-CH520",
            product_name="Sony WH-CH520 Wireless Headphones",
            category="electronics",
            quantity=1,
            supplier_cost_inr=3600.0,
            selling_price_inr=4999.0,
            net_profit_inr=1399.0,
            profit_margin_pct=28.0,
            channel="ap2_gateway",
            buyer_type="ai_purchasing_agent",
            buyer_identifier="agent-buyer-sub01@ap2",
            order_status="DELIVERED",
            manifest_hash="sha256:7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069",
            jws_token_preview="eyJhbGciOiJFUzI1NiIsImtpZCI6IjIwMjYtMDgtYXAyLTEifQ.eyJtYW5kYXRlX2lkIjoiTUFO...MEUCIQD",
            ai_deliberation_steps=[
                "Step 1: Buyer DID 'agent-buyer-sub01@ap2' verified against AP2 trust registry with active debit delegation.",
                "Step 2: Canonical constraint hash sha256:7f83b1657... verified against signed merchant manifest.",
                "Step 3: Profit margin validation: Supplier cost ₹3,600.00 vs Selling price ₹4,999.00 -> Net profit ₹1,399.00 (+28.0% margin).",
                "Step 4: Real-time logistics rate shopping: BlueDart Express chosen for guaranteed 1-day SLA (₹120.00).",
                "Step 5: Cryptographic Vault Settlement: ES256 ECDSA JWS compact token signed by Merchant Vault and recorded to append-only ledger.",
                "Step 6: Automated Airway Bill 'AWB-BLUEDART-88291' booked; webhook dispatch confirmed to Buyer Agent.",
            ],
            logistics=LogisticsDispatch(
                order_id="ORD-882190",
                carrier="BlueDart Express",
                tracking_id="AWB-BLUEDART-88291",
                estimated_delivery="Delivered Today at 3:15 PM",
                shipping_cost_inr=120.0,
                dispatch_status="DELIVERED",
                recipient_type="ai_purchasing_agent",
                recipient_name="Rohit Chauhan (via AP2 Agent)",
                delivery_address="Indiranagar 100ft Rd, Bengaluru 560038",
            ),
        ),
        SellerOrder(
            order_id="ORD-882189",
            trace_id="trace-33c8b1a40e",
            timestamp=(datetime.datetime.now() - datetime.timedelta(days=1)).isoformat(),
            product_id="PROD-MILK-AMUL",
            product_name="Amul Taaza Homogenised Toned Milk (1L)",
            category="groceries",
            quantity=6,
            supplier_cost_inr=348.0,
            selling_price_inr=432.0,
            net_profit_inr=84.0,
            profit_margin_pct=19.4,
            channel="ap2_gateway",
            buyer_type="ai_purchasing_agent",
            buyer_identifier="agent-staple-bot@ap2",
            order_status="DELIVERED",
            manifest_hash="sha256:45d53c52df75e6f4d06269e00de00a1a9409776174b0696b99b51950d",
            jws_token_preview="eyJhbGciOiJFUzI1NiIsImtpZCI6IjIwMjYtMDgtYXAyLTEifQ.eyJ0b3RhbCI6NDMyMDB9.MEUCIQD",
            ai_deliberation_steps=[
                "Step 1: Inbound buyer grocery intent: 'Order usual grocery list'. Identified Nandini Milk preferred brand.",
                "Step 2: Inventory check detected Nandini Milk stock = 0. Dynamic replacement engine matched Amul Taaza Homogenised Toned Milk (1L).",
                "Step 3: Buyer constraint check: 6 units @ ₹72.00 = ₹432.00 satisfies compiled ₹500 grocery spend ceiling.",
                "Step 4: Hyperlocal carrier selection: Shadowfax selected for instant 45-min delivery route.",
                "Step 5: Micro-mandate settlement authorized with RFC 8785 canonical hash; zero fraud signals detected.",
            ],
            logistics=LogisticsDispatch(
                order_id="ORD-882189",
                carrier="Shadowfax Hyperlocal",
                tracking_id="AWB-SHADOW-1029",
                estimated_delivery="Delivered yesterday in 38 mins",
                shipping_cost_inr=65.0,
                dispatch_status="DELIVERED",
                recipient_type="ai_purchasing_agent",
                recipient_name="Priya Sharma (via Grocery Agent)",
                delivery_address="HSR Layout Sector 2, Bengaluru 560102",
            ),
        ),
        SellerOrder(
            order_id="ORD-882188",
            trace_id="trace-99120e8b2a",
            timestamp=(datetime.datetime.now() - datetime.timedelta(days=2)).isoformat(),
            product_id="PROD-BUDS-XM5",
            product_name="Sony WF-1000XM5 Noise Canceling Earbuds",
            category="electronics",
            quantity=1,
            supplier_cost_inr=15200.0,
            selling_price_inr=19999.0,
            net_profit_inr=4799.0,
            profit_margin_pct=24.0,
            channel="amazon",
            buyer_type="human_buyer",
            buyer_identifier="amz-cust-99102",
            order_status="DELIVERED",
            manifest_hash="sha256:99f82b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd2001",
            jws_token_preview="eyJhbGciOiJFUzI1NiIsImtpZCI6IjIwMjYtMDgtYXAyLTEifQ.eyJtYW5kYXRlIjoiQU1aIn0.MEUCIQD",
            ai_deliberation_steps=[
                "Step 1: Amazon Buy Box monitoring detected competitor price match at ₹19,999.00.",
                "Step 2: AI Pricing policy maintained listing price at ₹19,999 preserving 24.0% net margin (supplier cost ₹15,200.00).",
                "Step 3: Verified human buyer payment token via Amazon Pay bridge.",
                "Step 4: Air shipment booked with Delhivery Air; 2-day delivery SLA fulfilled on schedule.",
            ],
        ),
        SellerOrder(
            order_id="ORD-882185",
            trace_id="trace-fail-0091",
            timestamp=(datetime.datetime.now() - datetime.timedelta(days=4)).isoformat(),
            product_id="PROD-SUN-AVIO",
            product_name="Ray-Ban Aviator Gradient Sunglasses",
            category="fashion",
            quantity=1,
            supplier_cost_inr=8500.0,
            selling_price_inr=11999.0,
            net_profit_inr=0.0,
            profit_margin_pct=0.0,
            channel="flipkart",
            buyer_type="human_buyer",
            buyer_identifier="fk-cust-44120",
            order_status="FAILED",
            failure_stage="GROUNDING_ORACLE (Stage 3)",
            failure_reason="Inventory Stockout: Item marked 0 quantity in verified merchant manifest.",
            manifest_hash="sha256:0000000000000000000000000000000000000000000000000000000000000000",
            jws_token_preview="N/A — Blocked by Guardrail",
            ai_deliberation_steps=[
                "Step 1: Inbound purchase request for Ray-Ban Aviator Gradient Sunglasses @ ₹11,999.00.",
                "Step 2: Guardrail Shell Grounding Oracle performed inventory lock check against live warehouse stock.",
                "Step 3: Verification failed: Stock count = 0 units (INV-007 Grounding Invariant violated).",
                "Step 4: Fail-closed policy triggered: Mandate Vault debit blocked, transaction aborted immediately with 0 funds moved.",
            ],
        ),
    ]
    return orders


# In-memory store for live orders executed by buyers
LIVE_SELLER_ORDERS: List[SellerOrder] = generate_mock_seller_orders()


ORDERS_FILE_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "data", "global_orders.json")


def save_orders_to_disk() -> None:
    """Save live seller orders to persistent disk storage."""
    try:
        os.makedirs(os.path.dirname(ORDERS_FILE_PATH), exist_ok=True)
        with open(ORDERS_FILE_PATH, "w", encoding="utf-8") as f:
            json.dump([o.model_dump() for o in LIVE_SELLER_ORDERS], f, indent=2)
    except Exception as e:
        print(f"[ORDERS PERSISTENCE] Warning: failed to save orders: {e}")


def load_orders_from_disk() -> None:
    """Load saved seller orders from persistent disk storage with order_id deduplication."""
    global LIVE_SELLER_ORDERS
    try:
        if os.path.exists(ORDERS_FILE_PATH):
            with open(ORDERS_FILE_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, list) and len(data) > 0:
                    seen_ids = set()
                    loaded = []
                    for item in data:
                        oid = item.get("order_id")
                        if oid and oid not in seen_ids:
                            seen_ids.add(oid)
                            loaded.append(SellerOrder(**item))
                    LIVE_SELLER_ORDERS.clear()
                    LIVE_SELLER_ORDERS.extend(loaded)
    except Exception as e:
        print(f"[ORDERS PERSISTENCE] Warning: failed to load orders: {e}")


# Initialize from disk if persistent file exists
load_orders_from_disk()


def record_seller_order(order: SellerOrder) -> SellerOrder:
    """Record a newly settled buyer order into the merchant's live order ledger, updating in-place if order_id exists."""
    for idx, existing in enumerate(LIVE_SELLER_ORDERS):
        if existing.order_id == order.order_id:
            LIVE_SELLER_ORDERS[idx] = order
            save_orders_to_disk()
            return order
    LIVE_SELLER_ORDERS.insert(0, order)
    save_orders_to_disk()
    return order


def update_order_status_by_razorpay(
    razorpay_order_id: Optional[str],
    payment_id: str,
    new_status: str = "PAID_CONFIRMED",
) -> Optional[SellerOrder]:
    """Update order payment status when verified by Razorpay Standard Checkout or Webhook."""
    if not razorpay_order_id and not payment_id:
        return None

    for order in LIVE_SELLER_ORDERS:
        matched = False
        if razorpay_order_id and (order.razorpay_order_id == razorpay_order_id or razorpay_order_id in order.trace_id or order.order_id == razorpay_order_id):
            matched = True
        elif payment_id and order.razorpay_payment_id == payment_id:
            matched = True

        if matched:
            order.order_status = new_status  # type: ignore
            order.razorpay_payment_id = payment_id
            if razorpay_order_id:
                order.razorpay_order_id = razorpay_order_id
            save_orders_to_disk()
            return order

    return None


def refund_order_by_payment_id(payment_id: str, refund_id: str) -> Optional[SellerOrder]:
    """Mark an order as REFUNDED upon Razorpay refund execution."""
    if not payment_id:
        return None

    for order in LIVE_SELLER_ORDERS:
        if order.razorpay_payment_id == payment_id:
            order.order_status = "REFUNDED"
            order.failure_stage = "REFUND_EXECUTION"
            order.failure_reason = f"Refunded in full via Razorpay Refund ID: {refund_id}"
            save_orders_to_disk()
            return order
    return None


def get_all_seller_orders() -> List[SellerOrder]:
    """Retrieve all settled and in-flight orders for the merchant."""
    return LIVE_SELLER_ORDERS


def get_analytics_summary(timeframe: str = "3m") -> AnalyticsSummary:
    """Compute revenue metrics and AI strategy recommendations by timeframe including live buyer orders."""
    multipliers = {"1m": 1.0, "3m": 2.8, "6m": 5.4, "1y": 11.2}
    mult = multipliers.get(timeframe, 2.8)

    # Calculate additional revenue and profit from live buyer orders (including PAID_CONFIRMED)
    live_additional_rev = sum(o.selling_price_inr for o in LIVE_SELLER_ORDERS if o.order_status in ["CONFIRMED", "PAID_CONFIRMED", "DISPATCHED", "DELIVERED"])
    live_additional_profit = sum(o.net_profit_inr for o in LIVE_SELLER_ORDERS if o.order_status in ["CONFIRMED", "PAID_CONFIRMED", "DISPATCHED", "DELIVERED"])
    live_additional_orders = len([o for o in LIVE_SELLER_ORDERS if o.order_status in ["CONFIRMED", "PAID_CONFIRMED", "DISPATCHED", "DELIVERED"]])

    base_channel_rev = 184500.0 * mult
    base_rev = round(base_channel_rev + live_additional_rev, 2)
    base_orders = int(48 * mult) + live_additional_orders
    base_profit = round((46125.0 * mult) + live_additional_profit, 2)
    avg_margin = round((base_profit / base_rev) * 100.0, 1) if base_rev > 0 else 25.0

    monthly_trends = [
        {"month": "May 2026", "revenue_inr": 162000, "profit_inr": 40500, "orders": 42},
        {"month": "Jun 2026", "revenue_inr": 178000, "profit_inr": 44500, "orders": 46},
        {"month": "Jul 2026", "revenue_inr": round(184500 + live_additional_rev, 2), "profit_inr": round(46125 + live_additional_profit, 2), "orders": 48 + live_additional_orders},
    ]

    recommendations = [
        AIStrategyRecommendation(
            id="rec-1",
            category="pricing",
            title="Reprice Sony WH-CH520 to capture Amazon Buy Box",
            description="Competitors have dropped prices to ₹4,899. Lowering by ₹100 preserves 24% margin while increasing expected sales volume by 35%.",
            potential_impact="+₹18,500/mo net profit",
            urgency="high",
            action_command="Reprice Sony WH-CH520 to ₹4,899 across all channels",
        ),
        AIStrategyRecommendation(
            id="rec-2",
            category="inventory",
            title="Restock Nandini Milk to capture 100% of recurring Grocery Lists",
            description="32 buyer AI agents attempted to purchase Nandini Milk in the last 7 days and had to be substituted. Restocking 100L will eliminate drop-offs.",
            potential_impact="+₹5,600/wk gross revenue",
            urgency="high",
            action_command="Order 100L Nandini Milk restock from dairy supplier",
        ),
        AIStrategyRecommendation(
            id="rec-3",
            category="logistics",
            title="Enable Shadowfax Hyperlocal for 1-Hour Grocery Delivery",
            description="Switching Bengaluru urban pincodes to Shadowfax Hyperlocal reduces delivery cost by ₹30/order with 45-minute average fulfillment.",
            potential_impact="-15% logistics overhead",
            urgency="medium",
            action_command="Set Shadowfax Hyperlocal as default for Bangalore pincodes",
        ),
        AIStrategyRecommendation(
            id="rec-4",
            category="marketing",
            title="Activate 14-Day Auto-Clearance on Slow-Moving Fashion Stock",
            description="Ray-Ban Aviators and Winter Apparel have been idle for 18 days. A 15% discount will release ₹34,000 in working capital.",
            potential_impact="₹34,000 capital unlocked",
            urgency="medium",
            action_command="Apply 15% clearance discount on fashion inventory > 14 days",
        ),
    ]

    return AnalyticsSummary(
        timeframe=timeframe,  # type: ignore
        gross_revenue_inr=round(base_rev, 2),
        total_orders_count=base_orders,
        net_profit_inr=round(base_profit, 2),
        average_margin_pct=avg_margin,
        successful_deliveries_pct=97.8,
        channel_breakdown={
            "AP2 Agentic Gateway": round((base_channel_rev * 0.45) + live_additional_rev, 2),
            "Amazon India": round(base_channel_rev * 0.32, 2),
            "Flipkart": round(base_channel_rev * 0.15, 2),
            "ONDC Network": round(base_rev - (round((base_channel_rev * 0.45) + live_additional_rev, 2) + round(base_channel_rev * 0.32, 2) + round(base_channel_rev * 0.15, 2)), 2),
        },
        monthly_trend=monthly_trends,
        recent_orders=LIVE_SELLER_ORDERS,
        recommendations=recommendations,
    )
