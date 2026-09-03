"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Send,
  Sparkles,
  Bot,
  TrendingUp,
  Tag,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Layers,
  ShoppingBag,
  ExternalLink,
  Search,
  X,
} from "lucide-react";
import { SellerProfile, CompetitorScanResult } from "@/lib/sellerStore";
import { BACKEND_URL } from "@/lib/api";

interface SellerChatAssistantProps {
  profile: SellerProfile;
  sellerMode: "basic" | "advanced";
  onProductListed?: (product: any) => void;
  onRestockTriggered?: (items: any[]) => void;
  onNavigateToCatalog?: () => void;
}

interface ChatMessage {
  id: string;
  sender: "merchant" | "ai";
  text: string;
  timestamp: string;
  actionCard?: {
    type: "competitor_scan" | "listing_success" | "discount_rule" | "restock_order" | "price_updated";
    data: any;
  };
}

const CATALOG_SCAN_PRESETS = [
  { name: "Sony WH-CH520 Wireless Headphones", category: "Audio", currentPrice: 4999 },
  { name: "Sony WF-1000XM5 Noise Canceling Earbuds", category: "Audio", currentPrice: 19999 },
  { name: "Bose QuietComfort 45 Bluetooth Headphones", category: "Audio", currentPrice: 24990 },
  { name: "JBL Tune 350BT On-Ear Wireless Headphones", category: "Audio", currentPrice: 2999 },
  { name: "Keychron K2 Wireless Mechanical Keyboard", category: "Electronics", currentPrice: 7499 },
  { name: "Logitech MX Master 3S Wireless Mouse", category: "Electronics", currentPrice: 8995 },
  { name: "Anker Soundcore Mini 3 Bluetooth Speaker", category: "Audio", currentPrice: 999 },
];

export const SellerChatAssistant: React.FC<SellerChatAssistantProps> = ({
  profile,
  sellerMode,
  onProductListed,
  onRestockTriggered,
  onNavigateToCatalog,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome-msg",
      sender: "ai",
      text: `Hello ${profile.storeName || "Merchant"}! I am your Autonomous Commerce Merchant Agent. I can help you scan competitor prices across Amazon & Flipkart, list new products with optimal profit margins, automate clearance discounts, and handle routine restocks. What would you like to do today?`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [showScanModal, setShowScanModal] = useState(false);
  const [selectedProductToScan, setSelectedProductToScan] = useState("Sony WH-CH520 Wireless Headphones");
  const [customScanInput, setCustomScanInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking]);

  const handleSend = async (customPrompt?: string) => {
    const query = customPrompt || input.trim();
    if (!query || isThinking) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: "merchant",
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!customPrompt) setInput("");
    setIsThinking(true);

    try {
      const res = await fetch(`${BACKEND_URL}/api/seller/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: query,
          merchant_id: "demo-merchant.myshopify.com",
          store_name: profile.storeName || "Aura Soundworks",
          business_type: profile.businessType || "electronics",
          autonomy_mode: profile.autonomyMode || "semiautonomous",
          default_margin_pct: profile.defaultMarginPct || 25.0,
          history: messages.slice(-10).map((m) => ({
            role: m.sender === "merchant" ? "user" : "assistant",
            content: m.text,
          })),
        }),
      });

      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`);
      }

      const data = await res.json();
      const replyText = data.reply_text || "Action executed successfully.";

      let actionCard: ChatMessage["actionCard"] = undefined;

      if (data.action_type === "add_product" && data.added_product) {
        actionCard = {
          type: "listing_success",
          data: {
            product_name: data.added_product.product_name,
            listing_price_inr: data.added_product.listing_price_inr,
            supplier_cost_inr: data.added_product.supplier_cost_inr,
            margin_pct: data.added_product.margin_pct,
            channels: profile.marketplaces.filter((m) => m.enabled),
            clearance_rule: profile.autoClearanceEnabled
              ? "Auto-discount 15% if unsold in 14 days, 30% in 30 days"
              : "Manual pricing",
          },
        };
        // Notify parent to refresh catalog inventory in real-time
        if (onProductListed) {
          onProductListed(data.added_product);
        }
      } else if (data.action_type === "competitor_scan" && data.competitor_scan) {
        actionCard = {
          type: "competitor_scan",
          data: data.competitor_scan,
        };
      } else if (data.action_type === "update_price" && data.updated_product) {
        actionCard = {
          type: "price_updated",
          data: data.updated_product,
        };
      } else if (data.action_type === "clearance_rule") {
        actionCard = {
          type: "discount_rule",
          data: {
            rule_14d: "15% markdown on stock aged 14+ days",
            rule_30d: "30% markdown on stock aged 30+ days",
            affected_items: ["Ray-Ban Aviator Sunglasses (18 days idle)", "Summer Linen Shirts (22 days idle)"],
          },
        };
      } else if (query.toLowerCase().includes("restock") || query.toLowerCase().includes("routine")) {
        const items = profile.routineRestockItems || [];
        actionCard = {
          type: "restock_order",
          data: {
            items,
            total_cost_inr: items.reduce((sum, item) => sum + item.supplierCostInr * item.restockQuantity, 0),
          },
        };
        if (onRestockTriggered) {
          onRestockTriggered(items);
        }
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          sender: "ai",
          text: replyText,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          actionCard,
        },
      ]);
    } catch (err: any) {
      console.error("[SellerChatAssistant] Error:", err);
      // Fallback response if backend service is restarting or unreachable
      setMessages((prev) => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          sender: "ai",
          text: `I encountered an issue contacting the merchant agent backend: ${err?.message || "Connection refused"}. Please ensure the orchestrator backend is online and reachable.`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setIsThinking(false);
    }
  };

  const PROMPT_SHORTCUTS = [
    { label: "📊 Scan Competitor Prices", isModal: true },
    { label: "🏷️ List Product with 25% Margin", prompt: "List Sony WH-CH520 on Amazon and Flipkart with 25% profit margin" },
    { label: "⚡ Apply 14-Day Auto-Clearance", prompt: "Apply 15% clearance discount on slow-moving inventory > 14 days" },
    { label: "🛒 Run Routine Restock", prompt: "Order routine restock for staple groceries and headphones" },
  ];

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-3.5rem)] max-w-5xl mx-auto px-4 sm:px-6 py-4">
      {/* Quick Action Prompt Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-3 shrink-0">
        {PROMPT_SHORTCUTS.map((sc) => (
          <button
            key={sc.label}
            onClick={() => {
              if (sc.isModal) {
                setShowScanModal(true);
              } else {
                handleSend(sc.prompt);
              }
            }}
            disabled={isThinking}
            className="px-3 py-1.5 rounded-lg bg-[var(--white)] border border-[rgba(92,61,46,0.12)] text-xs font-medium text-[var(--brown-dark)] hover:border-[var(--brown)] hover:bg-[var(--brown-faint)] transition-all shrink-0 shadow-xs cursor-pointer"
          >
            {sc.label}
          </button>
        ))}
      </div>

      {/* Chat Transcript Area */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1 pb-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.sender === "merchant" ? "items-end" : "items-start"}`}
          >
            <div
              className={`max-w-2xl rounded-2xl p-4 space-y-3 ${
                msg.sender === "merchant"
                  ? "bg-[var(--brown)] text-white"
                  : "bg-[var(--white)] border border-[rgba(92,61,46,0.12)] text-[var(--text-primary)] shadow-sm"
              }`}
            >
              <div className="flex items-center gap-2">
                {msg.sender === "ai" ? (
                  <div className="w-5 h-5 rounded-md bg-[var(--gold)] flex items-center justify-center shrink-0">
                    <Bot className="w-3 h-3 text-[var(--brown-dark)]" />
                  </div>
                ) : (
                  <span className="text-[11px] font-medium text-white/80">You (Merchant)</span>
                )}
                <span className={`text-[10px] font-mono ${msg.sender === "merchant" ? "text-white/70" : "text-[var(--text-faint)]"}`}>
                  {msg.timestamp}
                </span>
              </div>

              <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>

              {/* Action Cards */}
              {msg.actionCard?.type === "competitor_scan" && (
                <div className="p-3.5 rounded-xl bg-[var(--brown-faint)]/50 border border-[rgba(92,61,46,0.1)] space-y-3 text-[var(--text-primary)]">
                  <div className="flex items-center justify-between border-b border-[rgba(92,61,46,0.08)] pb-2">
                    <span className="text-xs font-bold text-[var(--brown-dark)]">
                      Competitor Price Intelligence
                    </span>
                    <span className="text-[11px] font-mono text-[var(--text-faint)]">
                      Median: ₹{msg.actionCard.data.median_market_price_inr}
                    </span>
                  </div>

                  {/* Competitor Price Points */}
                  <div className="space-y-1.5">
                    {msg.actionCard.data.competitor_prices.map((cp: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between text-xs p-2 rounded-lg bg-white border border-[rgba(92,61,46,0.06)]">
                        <span className="font-medium text-[var(--text-primary)]">{cp.marketplace} ({cp.merchant_name})</span>
                        <span className="font-bold text-[var(--brown-dark)] tabular-nums">₹{cp.price_inr}</span>
                      </div>
                    ))}
                  </div>

                  {/* Recommended Listing */}
                  <div className="p-3 rounded-lg bg-[var(--gold-faint)] border border-[var(--gold)] flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-mono text-[var(--brown)] block">
                        AI Recommended Price
                      </span>
                      <span className="text-base font-bold text-[var(--brown-dark)] tabular-nums">
                        ₹{msg.actionCard.data.recommended_listing_price_inr}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-mono text-[var(--text-muted)] block">Est. Net Margin</span>
                      <span className="text-xs font-bold text-[var(--stage-green)]">
                        +{msg.actionCard.data.estimated_margin_pct}%
                      </span>
                    </div>
                  </div>

                  {/* Deliberation Thought Steps */}
                  <div className="space-y-1 pt-1">
                    <span className="text-[10px] font-mono uppercase text-[var(--text-faint)] block">AI Thought Trail:</span>
                    {msg.actionCard.data.ai_deliberation.map((step: string, sIdx: number) => (
                      <p key={sIdx} className="text-[11px] font-mono text-[var(--text-muted)] pl-2 border-l-2 border-[var(--brown)]/30">
                        {step}
                      </p>
                    ))}
                  </div>

                  {/* 1-Click Price Adjustment Button */}
                  <button
                    type="button"
                    onClick={() => handleSend(`Apply recommendation and update price to ₹${msg.actionCard?.data.recommended_listing_price_inr}`)}
                    className="w-full py-2 px-3 rounded-lg bg-[var(--brown)] text-white text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-[var(--brown-dark)] transition-all shadow-xs cursor-pointer mt-2"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-[var(--gold-light)]" />
                    <span>Apply Recommended Price (₹{msg.actionCard.data.recommended_listing_price_inr}) to Store</span>
                  </button>
                </div>
              )}

              {msg.actionCard?.type === "price_updated" && (
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 space-y-1.5 text-emerald-950">
                  <div className="flex items-center gap-2 text-emerald-700 text-xs font-bold">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Catalog Price Updated in Live Store</span>
                  </div>
                  <div className="flex items-center justify-between text-xs font-mono pt-1 border-t border-emerald-100">
                    <span className="font-semibold">{msg.actionCard.data.product_name}</span>
                    <span className="font-bold text-emerald-800">
                      New Price: ₹{msg.actionCard.data.new_price_inr}
                    </span>
                  </div>
                </div>
              )}

              {msg.actionCard?.type === "listing_success" && (
                <div className="p-3.5 rounded-xl bg-white border border-[rgba(92,61,46,0.1)] space-y-2 text-[var(--text-primary)]">
                  <div className="flex items-center gap-2 text-[var(--stage-green)] text-xs font-bold">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Multi-Marketplace Syndication Active</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                    <div className="p-2 rounded-lg bg-[var(--brown-faint)]/40">
                      <span className="text-[10px] text-[var(--text-faint)] block">Listing Price</span>
                      <span className="font-bold text-[var(--brown-dark)]">₹{msg.actionCard.data.listing_price_inr}</span>
                    </div>
                    <div className="p-2 rounded-lg bg-[var(--brown-faint)]/40">
                      <span className="text-[10px] text-[var(--text-faint)] block">Target Margin</span>
                      <span className="font-bold text-[var(--stage-green)]">+{msg.actionCard.data.margin_pct}%</span>
                    </div>
                  </div>
                  <div className="text-[11px] font-mono text-[var(--text-muted)] pt-1">
                    <span className="font-semibold text-[var(--brown-dark)]">Clearance Policy: </span>
                    {msg.actionCard.data.clearance_rule}
                  </div>
                  {onNavigateToCatalog && (
                    <button
                      type="button"
                      onClick={onNavigateToCatalog}
                      className="w-full mt-2 py-1.5 px-3 rounded-lg bg-[var(--brown)] hover:bg-[var(--brown-dark)] text-white text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 shadow-xs"
                    >
                      <span>View in Merchant Catalog</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}

              {msg.actionCard?.type === "restock_order" && (
                <div className="p-3.5 rounded-xl bg-white border border-[rgba(92,61,46,0.1)] space-y-2 text-[var(--text-primary)]">
                  <div className="flex items-center justify-between border-b border-[rgba(92,61,46,0.08)] pb-1.5">
                    <span className="text-xs font-bold text-[var(--brown-dark)]">Routine Restock Order</span>
                    <span className="text-xs font-bold text-[var(--brown-dark)]">Total: ₹{msg.actionCard.data.total_cost_inr}</span>
                  </div>
                  <div className="space-y-1.5">
                    {msg.actionCard.data.items.map((it: any) => (
                      <div key={it.id} className="flex items-center justify-between text-xs p-2 rounded-lg bg-[var(--brown-faint)]/30">
                        <div>
                          <span className="font-medium text-[var(--text-primary)] block">{it.productName}</span>
                          <span className="text-[10px] font-mono text-[var(--text-faint)]">Qty: {it.restockQuantity} units @ ₹{it.supplierCostInr}/unit</span>
                        </div>
                        <span className="font-bold text-[var(--brown-dark)]">₹{it.supplierCostInr * it.restockQuantity}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {isThinking && (
          <div className="flex items-center gap-2 p-3 rounded-2xl bg-[var(--white)] border border-[rgba(92,61,46,0.12)] w-fit text-xs text-[var(--text-muted)]">
            <RefreshCw className="w-3.5 h-3.5 text-[var(--brown)] animate-spin" />
            <span>Scanning competitor market data & calculating optimal listing margins...</span>
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      {/* Input Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="flex items-center gap-2 bg-[var(--white)] p-2 rounded-2xl border border-[rgba(92,61,46,0.15)] shadow-md shrink-0"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            sellerMode === "basic"
              ? "Describe product or type 'Scan competitor prices'..."
              : "Set listing price, margin %, marketplace syndication, or dynamic discount rules..."
          }
          className="flex-1 bg-transparent px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-faint)] outline-none"
        />
        <button
          type="submit"
          disabled={!input.trim() || isThinking}
          className="btn-primary p-2.5 rounded-xl text-xs font-semibold shadow-xs disabled:opacity-50"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>

      {/* ═══ Competitor Scan Selection Modal ═══ */}
      {showScanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl border border-[rgba(92,61,46,0.15)] shadow-2xl max-w-lg w-full p-6 space-y-4 relative">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[var(--gold-faint)] flex items-center justify-center text-[var(--brown)]">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[var(--brown-dark)]">
                    Scan Competitor Intelligence
                  </h3>
                  <p className="text-xs text-[var(--text-muted)]">
                    Select a product from your catalog or specify a custom item to benchmark
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowScanModal(false)}
                className="p-1 rounded-lg text-[var(--text-faint)] hover:text-[var(--text-primary)] hover:bg-[var(--brown-faint)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Catalog Selection */}
            <div className="space-y-2">
              <label className="text-[11px] font-mono uppercase font-bold text-[var(--text-faint)]">
                Active Catalog Products
              </label>
              <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                {CATALOG_SCAN_PRESETS.map((item) => {
                  const isSelected = selectedProductToScan === item.name && !customScanInput.trim();
                  return (
                    <button
                      key={item.name}
                      type="button"
                      onClick={() => {
                        setSelectedProductToScan(item.name);
                        setCustomScanInput("");
                      }}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition-all cursor-pointer ${
                        isSelected
                          ? "bg-[var(--brown)] text-white font-medium shadow-xs"
                          : "bg-[var(--bg-main)] hover:bg-[var(--brown-faint)] text-[var(--text-secondary)] border border-[rgba(92,61,46,0.08)]"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <ShoppingBag className={`w-3.5 h-3.5 ${isSelected ? "text-white" : "text-[var(--brown)]"}`} />
                        <span>{item.name}</span>
                      </div>
                      <span className={`font-mono text-[11px] ${isSelected ? "text-white/90" : "text-[var(--text-muted)]"}`}>
                        ₹{item.currentPrice.toLocaleString("en-IN")}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Input */}
            <div className="space-y-1.5 pt-2 border-t border-[rgba(92,61,46,0.08)]">
              <label className="text-[11px] font-mono uppercase font-bold text-[var(--text-faint)]">
                Or Search Custom Product
              </label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)]" />
                <input
                  type="text"
                  placeholder="e.g. Apple AirPods Pro 2, Sennheiser Momentum..."
                  value={customScanInput}
                  onChange={(e) => setCustomScanInput(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-[var(--bg-main)] border border-[rgba(92,61,46,0.15)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] outline-none focus:border-[var(--brown)]"
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowScanModal(false)}
                className="btn-secondary text-xs py-1.5 px-3 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const targetProduct = customScanInput.trim() || selectedProductToScan;
                  if (!targetProduct) return;
                  setShowScanModal(false);
                  handleSend(`Scan competitor prices for ${targetProduct}`);
                }}
                className="btn-primary text-xs py-1.5 px-4 flex items-center gap-1.5 cursor-pointer"
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Scan Market Prices</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
