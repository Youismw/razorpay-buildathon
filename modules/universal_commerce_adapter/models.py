"""
Universal Commerce Adapter — Seller & Merchant Models (FR-UCP-001)
Pydantic v2 data models for Seller Governance, Multi-Marketplace Syndication,
Competitor Price Intelligence, Logistics Dispatch, and Settlement Preferences.
"""

from typing import Any, Dict, List, Optional, Literal
from pydantic import BaseModel, Field


class MarketplaceConnection(BaseModel):
    marketplace: Literal["amazon", "flipkart", "ondc", "ap2_gateway"]
    enabled: bool = True
    account_id: str
    status: Literal["connected", "syncing", "error"] = "connected"
    fee_percentage: float = 8.5


class RoutineRestockItem(BaseModel):
    id: str
    product_name: str
    category: str
    supplier_cost_inr: float
    current_stock: int
    restock_threshold: int
    restock_quantity: int
    restock_interval_days: int
    preferred_margin_pct: float = 25.0


class SettlementPreferences(BaseModel):
    payout_schedule: Literal["instant_t0", "daily_t1", "weekly_t7"] = "daily_t1"
    refund_policy: Literal["no_questions_asked_14d", "replacement_only_7d", "final_sale"] = "replacement_only_7d"
    dispute_resolution: Literal["ai_autonomous_arbitration", "manual_merchant_review"] = "ai_autonomous_arbitration"
    business_type: Literal["groceries", "electronics", "fashion", "home", "beauty", "hardware", "construction"] = "electronics"
    bank_account_last4: str = "4921"
    auto_sweep_enabled: bool = True


class SellerProfile(BaseModel):
    merchant_id: str = "demo-merchant.myshopify.com"
    store_name: str = "Apex Goods & Electronics"
    business_type: Literal["groceries", "electronics", "fashion", "home", "beauty", "hardware", "construction"] = "electronics"
    autonomy_mode: Literal["autonomous", "manual_approval"] = "autonomous"
    default_margin_pct: float = 25.0
    auto_clearance_enabled: bool = True
    clearance_discount_14d_pct: float = 15.0
    clearance_discount_30d_pct: float = 30.0
    marketplaces: List[MarketplaceConnection] = Field(default_factory=lambda: [
        MarketplaceConnection(marketplace="ap2_gateway", account_id="AP2-MERCH-8821", fee_percentage=2.0),
        MarketplaceConnection(marketplace="amazon", account_id="AMZ-IN-99321", fee_percentage=9.5),
        MarketplaceConnection(marketplace="flipkart", account_id="FK-SELL-44129", fee_percentage=8.0),
        MarketplaceConnection(marketplace="ondc", account_id="ONDC-NODE-1029", fee_percentage=3.5),
    ])
    settlement: SettlementPreferences = Field(default_factory=SettlementPreferences)
    routine_restock_items: List[RoutineRestockItem] = Field(default_factory=list)


class CompetitorPricePoint(BaseModel):
    marketplace: str
    merchant_name: str
    price_inr: float
    delivery_days: int
    rating: float


class CompetitorScanResult(BaseModel):
    product_name: str
    category: str
    competitor_prices: List[CompetitorPricePoint]
    lowest_market_price_inr: float
    highest_market_price_inr: float
    median_market_price_inr: float
    recommended_listing_price_inr: float
    estimated_margin_pct: float
    ai_deliberation: List[str] = Field(default_factory=list)


class LogisticsDispatch(BaseModel):
    order_id: str
    carrier: Literal["BlueDart Express", "Delhivery Air", "Shadowfax Hyperlocal", "Dunzo Hyperlocal"]
    tracking_id: str
    estimated_delivery: str
    shipping_cost_inr: float
    dispatch_status: Literal["AWB_GENERATED", "PICKUP_SCHEDULED", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED"]
    recipient_type: Literal["human_buyer", "ai_purchasing_agent"]
    recipient_name: str
    delivery_address: str


class SellerOrder(BaseModel):
    order_id: str
    trace_id: str
    timestamp: str
    product_id: str
    product_name: str
    category: str
    quantity: int
    supplier_cost_inr: float
    selling_price_inr: float
    net_profit_inr: float
    profit_margin_pct: float
    channel: Literal["ap2_gateway", "amazon", "flipkart", "ondc"]
    buyer_type: Literal["human_buyer", "ai_purchasing_agent"]
    buyer_identifier: str
    order_status: Literal["PROCESSING", "CONFIRMED", "PAID_CONFIRMED", "DISPATCHED", "DELIVERED", "FAILED", "REFUNDED"]
    failure_stage: Optional[str] = None
    failure_reason: Optional[str] = None
    manifest_hash: str
    jws_token_preview: str
    razorpay_order_id: Optional[str] = None
    razorpay_payment_id: Optional[str] = None
    ai_deliberation_steps: List[str] = Field(default_factory=list)
    logistics: Optional[LogisticsDispatch] = None


class AIStrategyRecommendation(BaseModel):
    id: str
    category: Literal["pricing", "logistics", "marketing", "inventory"]
    title: str
    description: str
    potential_impact: str
    urgency: Literal["high", "medium", "low"]
    action_command: str


class AnalyticsSummary(BaseModel):
    timeframe: Literal["1m", "3m", "6m", "1y"]
    gross_revenue_inr: float
    total_orders_count: int
    net_profit_inr: float
    average_margin_pct: float
    successful_deliveries_pct: float
    channel_breakdown: Dict[str, float]
    monthly_trend: List[Dict[str, Any]]
    recent_orders: List[SellerOrder]
    recommendations: List[AIStrategyRecommendation]
