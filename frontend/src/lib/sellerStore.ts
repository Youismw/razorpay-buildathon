/**
 * Seller Profile & Commerce Store (FR-UCP-001)
 * Manages seller state, marketplace channels, competitor scans,
 * logistics dispatch, and settlement configurations with localStorage persistence.
 */

export interface MarketplaceConnection {
  marketplace: "amazon" | "flipkart" | "ondc" | "ap2_gateway";
  enabled: boolean;
  accountId: string;
  status: "connected" | "syncing" | "error";
  feePercentage: number;
}

export interface RoutineRestockItem {
  id: string;
  productName: string;
  category: string;
  supplierCostInr: number;
  currentStock: number;
  restockThreshold: number;
  restockQuantity: number;
  restockIntervalDays: number;
  preferredMarginPct: number;
}

export interface SettlementPreferences {
  payoutSchedule: "instant_t0" | "daily_t1" | "weekly_t7";
  refundPolicy: "no_questions_asked_14d" | "replacement_only_7d" | "final_sale";
  disputeResolution: "ai_autonomous_arbitration" | "manual_merchant_review";
  businessType: "groceries" | "electronics" | "fashion" | "home" | "beauty" | "hardware" | "construction";
  bankAccountLast4: string;
  autoSweepEnabled: boolean;
}

export interface SellerProfile {
  merchantId: string;
  storeName: string;
  businessType: "groceries" | "electronics" | "fashion" | "home" | "beauty" | "hardware" | "construction";
  autonomyMode: "autonomous" | "manual_approval";
  defaultMarginPct: number;
  autoClearanceEnabled: boolean;
  clearanceDiscount14dPct: number;
  clearanceDiscount30dPct: number;
  marketplaces: MarketplaceConnection[];
  settlement: SettlementPreferences;
  routineRestockItems: RoutineRestockItem[];
}

export interface CompetitorPricePoint {
  marketplace: string;
  merchant_name: string;
  price_inr: number;
  delivery_days: number;
  rating: number;
}

export interface CompetitorScanResult {
  product_name: string;
  category: string;
  competitor_prices: CompetitorPricePoint[];
  lowest_market_price_inr: number;
  highest_market_price_inr: number;
  median_market_price_inr: number;
  recommended_listing_price_inr: number;
  estimated_margin_pct: number;
  ai_deliberation: string[];
}

export interface LogisticsDispatch {
  order_id: string;
  carrier: "BlueDart Express" | "Delhivery Air" | "Shadowfax Hyperlocal" | "Dunzo Hyperlocal";
  tracking_id: string;
  estimated_delivery: string;
  shipping_cost_inr: number;
  dispatch_status: "AWB_GENERATED" | "PICKUP_SCHEDULED" | "IN_TRANSIT" | "OUT_FOR_DELIVERY" | "DELIVERED";
  recipient_type: "human_buyer" | "ai_purchasing_agent";
  recipient_name: string;
  delivery_address: string;
}

export interface SellerOrder {
  order_id: string;
  trace_id: string;
  timestamp: string;
  product_id: string;
  product_name: string;
  category: string;
  quantity: number;
  supplier_cost_inr: number;
  selling_price_inr: number;
  net_profit_inr: number;
  profit_margin_pct: number;
  channel: "ap2_gateway" | "amazon" | "flipkart" | "ondc";
  buyer_type: "human_buyer" | "ai_purchasing_agent";
  buyer_identifier: string;
  order_status: "PROCESSING" | "CONFIRMED" | "DISPATCHED" | "DELIVERED" | "FAILED" | "REFUNDED";
  failure_stage?: string;
  failure_reason?: string;
  manifest_hash: string;
  jws_token_preview: string;
  ai_deliberation_steps: string[];
  logistics?: LogisticsDispatch;
}

export interface AIStrategyRecommendation {
  id: string;
  category: "pricing" | "logistics" | "marketing" | "inventory";
  title: string;
  description: string;
  potential_impact: string;
  urgency: "high" | "medium" | "low";
  action_command: string;
}

export interface AnalyticsSummary {
  timeframe: "1m" | "3m" | "6m" | "1y";
  gross_revenue_inr: number;
  total_orders_count: number;
  net_profit_inr: number;
  average_margin_pct: number;
  successful_deliveries_pct: number;
  channel_breakdown: Record<string, number>;
  monthly_trend: Array<{ month: string; revenue_inr: number; profit_inr: number; orders: number }>;
  recent_orders: SellerOrder[];
  recommendations: AIStrategyRecommendation[];
}

const SELLER_PROFILE_KEY = "ap2_seller_profile_v1";

export const DEFAULT_SELLER_PROFILE: SellerProfile = {
  merchantId: "demo-merchant.myshopify.com",
  storeName: "Apex Goods & Electronics",
  businessType: "electronics",
  autonomyMode: "autonomous",
  defaultMarginPct: 25.0,
  autoClearanceEnabled: true,
  clearanceDiscount14dPct: 15.0,
  clearanceDiscount30dPct: 30.0,
  marketplaces: [
    { marketplace: "ap2_gateway", enabled: true, accountId: "AP2-MERCH-8821", status: "connected", feePercentage: 2.0 },
    { marketplace: "amazon", enabled: true, accountId: "AMZ-IN-99321", status: "connected", feePercentage: 9.5 },
    { marketplace: "flipkart", enabled: true, accountId: "FK-SELL-44129", status: "connected", feePercentage: 8.0 },
    { marketplace: "ondc", enabled: true, accountId: "ONDC-NODE-1029", status: "connected", feePercentage: 3.5 },
  ],
  settlement: {
    payoutSchedule: "daily_t1",
    refundPolicy: "replacement_only_7d",
    disputeResolution: "ai_autonomous_arbitration",
    businessType: "electronics",
    bankAccountLast4: "4921",
    autoSweepEnabled: true,
  },
  routineRestockItems: [
    {
      id: "restock-1",
      productName: "Sony WH-CH520 Wireless Headphones",
      category: "electronics",
      supplierCostInr: 3600.0,
      currentStock: 42,
      restockThreshold: 15,
      restockQuantity: 50,
      restockIntervalDays: 14,
      preferredMarginPct: 28.0,
    },
    {
      id: "restock-2",
      productName: "Amul Taaza Homogenised Toned Milk (1L)",
      category: "groceries",
      supplierCostInr: 58.0,
      currentStock: 120,
      restockThreshold: 30,
      restockQuantity: 200,
      restockIntervalDays: 2,
      preferredMarginPct: 19.4,
    },
    {
      id: "restock-3",
      productName: "Blue Tokai Attikan Dark Roast (250g)",
      category: "groceries",
      supplierCostInr: 330.0,
      currentStock: 28,
      restockThreshold: 10,
      restockQuantity: 40,
      restockIntervalDays: 7,
      preferredMarginPct: 29.8,
    },
  ],
};

export function loadSellerProfile(): SellerProfile {
  if (typeof window === "undefined") return DEFAULT_SELLER_PROFILE;
  try {
    const raw = localStorage.getItem(SELLER_PROFILE_KEY);
    if (!raw) return DEFAULT_SELLER_PROFILE;
    return { ...DEFAULT_SELLER_PROFILE, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SELLER_PROFILE;
  }
}

export function saveSellerProfile(profile: SellerProfile): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SELLER_PROFILE_KEY, JSON.stringify(profile));
  } catch (e) {
    console.error("Failed to save seller profile to localStorage:", e);
  }
}
