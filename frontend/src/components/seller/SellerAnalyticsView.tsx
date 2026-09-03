"use client";

import React, { useState, useEffect } from "react";
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  Package,
  Sparkles,
  Shield,
  ArrowUpRight,
  ArrowRight,
  Clock,
  Layers,
  ShoppingBag,
} from "lucide-react";
import {
  AnalyticsSummary,
  AIStrategyRecommendation,
  SellerProfile,
} from "@/lib/sellerStore";
import { StrategyExecutionModal } from "./StrategyExecutionModal";

interface SellerAnalyticsViewProps {
  profile: SellerProfile;
  onNavigateToOrders?: () => void;
}

export const SellerAnalyticsView: React.FC<SellerAnalyticsViewProps> = ({
  profile,
  onNavigateToOrders,
}) => {
  const [timeframe, setTimeframe] = useState<"1m" | "3m" | "6m" | "1y">("3m");
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeRecommendation, setActiveRecommendation] = useState<AIStrategyRecommendation | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`http://127.0.0.1:8000/api/seller/analytics?timeframe=${timeframe}`)
      .then((res) => res.json())
      .then((data) => setAnalytics(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [timeframe]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Header + Timeframe Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="display-heading text-2xl mb-1">Merchant Sales & Revenue Analytics</h2>
          <p className="text-sm text-[var(--text-muted)]">
            AI-driven performance metrics, channel breakdowns, and strategic business advice.
          </p>
        </div>

        {/* Timeframe Switcher */}
        <div className="flex items-center bg-[var(--brown-faint)] p-1 rounded-xl border border-[rgba(92,61,46,0.08)]">
          {(["1m", "3m", "6m", "1y"] as const).map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                timeframe === tf
                  ? "bg-white text-[var(--brown-dark)] shadow-xs font-semibold"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
            >
              {tf === "1m" ? "1 Month" : tf === "3m" ? "3 Months" : tf === "6m" ? "6 Months" : "1 Year"}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      {analytics && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card p-5 space-y-2">
            <span className="text-[11px] font-mono text-[var(--text-faint)] uppercase tracking-wider block">
              Gross Revenue
            </span>
            <div className="text-2xl font-bold text-[var(--brown-dark)] tabular-nums">
              ₹{analytics.gross_revenue_inr.toLocaleString("en-IN")}
            </div>
            <div className="flex items-center gap-1 text-xs text-[var(--stage-green)] font-semibold">
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>+18.4% vs prev period</span>
            </div>
          </div>

          <div className="card p-5 space-y-2">
            <span className="text-[11px] font-mono text-[var(--text-faint)] uppercase tracking-wider block">
              Net Profit
            </span>
            <div className="text-2xl font-bold text-[var(--brown-dark)] tabular-nums">
              ₹{analytics.net_profit_inr.toLocaleString("en-IN")}
            </div>
            <div className="text-xs font-mono text-[var(--text-muted)]">
              Avg Margin: <span className="font-bold text-[var(--stage-green)]">+{analytics.average_margin_pct}%</span>
            </div>
          </div>

          {/* Clickable Orders Settled Card -> redirects to Orders & Logistics tab */}
          <div
            onClick={onNavigateToOrders}
            className="card p-5 space-y-2 hover:border-[var(--brown)] cursor-pointer transition-all group hover:shadow-xs"
            title="Click to view full order logbook in Orders & Logistics tab"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono text-[var(--text-faint)] uppercase tracking-wider block">
                Orders Settled
              </span>
              <span className="text-[10px] font-mono text-[var(--brown)] group-hover:underline flex items-center gap-0.5">
                View Logbook <ArrowRight className="w-3 h-3" />
              </span>
            </div>
            <div className="text-2xl font-bold text-[var(--brown-dark)] tabular-nums group-hover:text-[var(--brown)] transition-colors">
              {analytics.total_orders_count} orders
            </div>
            <div className="text-xs font-mono text-[var(--text-muted)]">
              Delivery SLA: <span className="font-bold text-[var(--stage-green)]">{analytics.successful_deliveries_pct}%</span>
            </div>
          </div>

          <div className="card p-5 space-y-2">
            <span className="text-[11px] font-mono text-[var(--text-faint)] uppercase tracking-wider block">
              Primary Channel
            </span>
            <div className="text-xl font-bold text-[var(--brown-dark)]">
              AP2 Agentic Network
            </div>
            <div className="text-xs font-mono text-[var(--text-muted)]">
              45% volume share
            </div>
          </div>
        </div>
      )}

      {/* Channel Distribution */}
      {analytics && (
        <div className="card p-6 space-y-4 shadow-xs">
          <h3 className="text-sm font-bold text-[var(--brown-dark)]">
            Marketplace Revenue Contribution
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(analytics.channel_breakdown).map(([channel, rev]) => {
              const pct = ((rev / analytics.gross_revenue_inr) * 100).toFixed(1);
              return (
                <div key={channel} className="p-4 rounded-xl bg-[var(--brown-faint)]/40 border border-[rgba(92,61,46,0.08)] space-y-2">
                  <span className="text-xs font-semibold text-[var(--text-primary)] block">
                    {channel}
                  </span>
                  <div className="text-lg font-bold text-[var(--brown-dark)] tabular-nums">
                    ₹{rev.toLocaleString("en-IN")}
                  </div>
                  <div className="w-full bg-[rgba(92,61,46,0.1)] h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-[var(--brown)] h-full rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-mono text-[var(--text-faint)] block">
                    {pct}% of total sales
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* AI Strategy Advisory Panel */}
      {analytics && (
        <div className="card p-6 space-y-4 border-[rgba(196,162,101,0.3)] bg-gradient-to-b from-white to-[var(--gold-faint)]/20 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[var(--gold)] flex items-center justify-center text-[var(--brown-dark)] shadow-sm">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[var(--brown-dark)]">
                  AI Business Strategy Recommendations
                </h3>
                <p className="text-[11px] text-[var(--text-muted)]">
                  Actionable insights generated from real-time buyer patterns and competitor inventory movements.
                </p>
              </div>
            </div>
            <span className="text-[10px] font-mono px-2.5 py-1 rounded-md bg-[var(--gold-faint)] border border-[var(--gold)] text-[var(--brown)] font-bold">
              Autonomous Advisor
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {analytics.recommendations.map((rec) => (
              <div
                key={rec.id}
                className="p-4 rounded-xl bg-white border border-[rgba(92,61,46,0.1)] space-y-3 hover:border-[var(--brown)] transition-all shadow-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-[var(--brown-faint)] text-[var(--brown)] font-bold">
                    {rec.category}
                  </span>
                  <span className="text-xs font-bold font-mono text-[var(--stage-green)]">
                    {rec.potential_impact}
                  </span>
                </div>

                <div className="space-y-1">
                  <h4 className="text-sm font-semibold text-[var(--text-primary)]">
                    {rec.title}
                  </h4>
                  <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                    {rec.description}
                  </p>
                </div>

                <div className="pt-2 border-t border-[rgba(92,61,46,0.06)] flex items-center justify-between">
                  <span className="text-[10px] font-mono text-[var(--text-faint)]">
                    Urgency: <span className="font-bold text-[var(--brown)] uppercase">{rec.urgency}</span>
                  </span>
                  <button
                    onClick={() => setActiveRecommendation(rec)}
                    className="btn-primary py-1.5 px-3 text-xs font-semibold inline-flex items-center gap-1.5 shadow-xs"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Execute Strategy</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Strategy Execution Modal */}
      {activeRecommendation && (
        <StrategyExecutionModal
          recommendation={activeRecommendation}
          profile={profile}
          onClose={() => setActiveRecommendation(null)}
          onExecutionComplete={() => {
            fetch(`http://127.0.0.1:8000/api/seller/analytics?timeframe=${timeframe}`)
              .then((res) => res.json())
              .then((data) => setAnalytics(data))
              .catch(() => {});
          }}
        />
      )}
    </div>
  );
};
