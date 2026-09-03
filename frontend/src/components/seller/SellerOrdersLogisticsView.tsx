"use client";

import React, { useState, useEffect } from "react";
import {
  Truck,
  Package,
  CheckCircle2,
  AlertTriangle,
  Bot,
  User,
  ExternalLink,
  Shield,
  Copy,
  Clock,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { SellerOrder, LogisticsDispatch } from "@/lib/sellerStore";

interface SellerOrdersLogisticsViewProps {
  orders?: SellerOrder[];
}

export const SellerOrdersLogisticsView: React.FC<SellerOrdersLogisticsViewProps> = () => {
  const [orders, setOrders] = useState<SellerOrder[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<SellerOrder | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [isDispatching, setIsDispatching] = useState<string | null>(null);
  const [copiedHash, setCopiedHash] = useState(false);

  useEffect(() => {
    fetch("http://127.0.0.1:8000/api/seller/orders")
      .then((res) => res.json())
      .then((data) => setOrders(data.orders || []))
      .catch(() => {});
  }, []);

  const handleAutoDispatch = async (orderId: string) => {
    setIsDispatching(orderId);
    try {
      const res = await fetch("http://127.0.0.1:8000/api/seller/logistics/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id: orderId,
          carrier_preference: "BlueDart Express",
          recipient_type: "ai_purchasing_agent",
          recipient_name: "Rohit Chauhan (via AP2 Agent)",
          delivery_address: "Koramangala 4th Block, Bengaluru, KA 560034",
        }),
      });
      const dispatchData: LogisticsDispatch = await res.json();

      setOrders((prev) =>
        prev.map((o) =>
          o.order_id === orderId
            ? { ...o, order_status: "DISPATCHED", logistics: dispatchData }
            : o
        )
      );
    } catch (e) {
      console.error("Dispatch error:", e);
    } finally {
      setIsDispatching(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  const filteredOrders = orders.filter((o) => {
    if (filterStatus === "ALL") return true;
    return o.order_status === filterStatus;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="display-heading text-2xl mb-1">Live Orders & Autonomous Logistics</h2>
          <p className="text-sm text-[var(--text-muted)]">
            Real-time fulfillment pipeline for AI purchasing agents and human buyers.
          </p>
        </div>

        {/* Status Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {["ALL", "DELIVERED", "DISPATCHED", "CONFIRMED", "FAILED"].map((st) => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filterStatus === st
                  ? "bg-[var(--brown)] text-white"
                  : "bg-white border border-[rgba(92,61,46,0.1)] text-[var(--text-muted)] hover:bg-[var(--brown-faint)]"
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Orders Grid */}
      <div className="space-y-3">
        {filteredOrders.map((order) => {
          const isDelivered = order.order_status === "DELIVERED";
          const isFailed = order.order_status === "FAILED";
          const isDispatched = order.order_status === "DISPATCHED";

          return (
            <div
              key={order.order_id}
              className="card p-5 hover:border-[rgba(92,61,46,0.3)] transition-all space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[rgba(92,61,46,0.06)] pb-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                      isDelivered
                        ? "bg-[rgba(34,197,94,0.1)] text-[var(--stage-green)]"
                        : isFailed
                        ? "bg-[rgba(239,68,68,0.1)] text-[var(--stage-red)]"
                        : "bg-[var(--gold-faint)] text-[var(--brown)]"
                    }`}
                  >
                    {isDelivered ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : isFailed ? (
                      <AlertTriangle className="w-5 h-5" />
                    ) : (
                      <Truck className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-[var(--brown-dark)]">
                        {order.order_id}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-[var(--brown-faint)] text-[var(--brown)]">
                        {order.channel}
                      </span>
                    </div>
                    <span className="text-[11px] font-mono text-[var(--text-faint)]">
                      {new Date(order.timestamp).toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="text-base font-bold text-[var(--brown-dark)] tabular-nums block">
                      ₹{order.selling_price_inr.toLocaleString("en-IN")}
                    </span>
                    <span className="text-[10px] text-[var(--stage-green)] font-semibold font-mono">
                      +₹{order.net_profit_inr} profit ({order.profit_margin_pct}%)
                    </span>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold ${
                      isDelivered
                        ? "bg-[rgba(34,197,94,0.1)] text-[var(--stage-green)] border border-[rgba(34,197,94,0.2)]"
                        : isFailed
                        ? "bg-[rgba(239,68,68,0.1)] text-[var(--stage-red)] border border-[rgba(239,68,68,0.2)]"
                        : "bg-[var(--gold-faint)] text-[var(--brown)] border border-[var(--gold)]"
                    }`}
                  >
                    {order.order_status}
                  </span>
                </div>
              </div>

              {/* Order Content */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                {/* Product & Buyer */}
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-mono text-[var(--text-faint)] block">
                    Product Item
                  </span>
                  <div className="font-semibold text-[var(--text-primary)]">
                    {order.product_name}
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)] pt-1">
                    {order.buyer_type === "ai_purchasing_agent" ? (
                      <>
                        <Bot className="w-3.5 h-3.5 text-[var(--brown)]" />
                        <span className="font-mono text-[10px]">{order.buyer_identifier}</span>
                      </>
                    ) : (
                      <>
                        <User className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                        <span>{order.buyer_identifier}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Logistics Info */}
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-mono text-[var(--text-faint)] block">
                    Logistics Carrier & Tracking
                  </span>
                  {order.logistics ? (
                    <div className="space-y-0.5">
                      <div className="font-semibold text-[var(--brown-dark)]">
                        {order.logistics.carrier}
                      </div>
                      <span className="font-mono text-[11px] text-[var(--brown)] block">
                        {order.logistics.tracking_id}
                      </span>
                      <span className="text-[10px] text-[var(--text-muted)] block">
                        ETA: {order.logistics.estimated_delivery}
                      </span>
                    </div>
                  ) : isFailed ? (
                    <div className="text-[var(--stage-red)] text-xs font-mono">
                      Dispatch halted: {order.failure_stage}
                    </div>
                  ) : (
                    <div className="text-[var(--text-muted)]">
                      <span>Ready for dispatch</span>
                    </div>
                  )}
                </div>

                {/* Actions & Inspection */}
                <div className="flex flex-col justify-between items-end gap-2">
                  <span className="text-[10px] font-mono text-[var(--text-faint)]">
                    Trace: {order.trace_id}
                  </span>

                  <div className="flex items-center gap-2">
                    {!isDelivered && !isFailed && !order.logistics && (
                      <button
                        onClick={() => handleAutoDispatch(order.order_id)}
                        disabled={isDispatching === order.order_id}
                        className="btn-primary py-1.5 px-3 text-xs inline-flex items-center gap-1.5 shadow-xs"
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>{isDispatching === order.order_id ? "Booking Carrier..." : "Auto-Dispatch with AI"}</span>
                      </button>
                    )}
                    <button
                      onClick={() => setSelectedOrder(order)}
                      className="btn-secondary py-1.5 px-3 text-xs inline-flex items-center gap-1"
                    >
                      <Shield className="w-3 h-3 text-[var(--brown)]" />
                      <span>Audit Proof</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Cryptographic Order Inspection Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="card w-full max-w-xl p-6 bg-white border border-[rgba(92,61,46,0.18)] rounded-2xl shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[rgba(92,61,46,0.08)] pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[var(--gold-faint)] flex items-center justify-center text-[var(--brown)]">
                  <Shield className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[var(--text-primary)]">
                    Cryptographic Order Audit Proof
                  </h3>
                  <span className="text-[10px] font-mono text-[var(--text-faint)]">
                    Order ID: {selectedOrder.order_id}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                ✕ Close
              </button>
            </div>

            {/* Manifest SHA-256 Hash */}
            <div className="p-3 rounded-xl bg-[var(--brown-faint)]/40 border border-[rgba(92,61,46,0.08)] space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-mono text-[var(--text-faint)]">
                  Merchant Manifest Hash (RFC 8785 SHA-256)
                </span>
                <button
                  onClick={() => copyToClipboard(selectedOrder.manifest_hash)}
                  className="text-[10px] font-mono text-[var(--brown)] flex items-center gap-1 hover:underline"
                >
                  <Copy className="w-3 h-3" />
                  <span>{copiedHash ? "Copied!" : "Copy"}</span>
                </button>
              </div>
              <p className="text-xs font-mono text-[var(--brown-dark)] break-all select-all">
                {selectedOrder.manifest_hash}
              </p>
            </div>

            {/* JWS Compact Proof */}
            <div className="p-3 rounded-xl bg-[var(--brown-faint)]/40 border border-[rgba(92,61,46,0.08)] space-y-1">
              <span className="text-[10px] uppercase font-mono text-[var(--text-faint)] block">
                ES256 ECDSA JWS Signature Token
              </span>
              <p className="text-xs font-mono text-[var(--brown-dark)] break-all select-all">
                {selectedOrder.jws_token_preview}
              </p>
            </div>

            {/* AI Thought Deliberation */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-[var(--brown-dark)] block">
                AI Deliberation & Fulfillment Steps
              </span>
              <div className="space-y-1.5">
                {selectedOrder.ai_deliberation_steps.map((step, idx) => (
                  <div
                    key={idx}
                    className="text-xs font-mono text-[var(--text-muted)] p-2 rounded-lg bg-[var(--brown-faint)]/30 border-l-2 border-[var(--brown)]"
                  >
                    {step}
                  </div>
                ))}
              </div>
            </div>

            {/* Failure diagnosis if failed */}
            {selectedOrder.failure_reason && (
              <div className="p-3 rounded-xl bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.2)] text-[var(--stage-red)] text-xs space-y-1">
                <span className="font-bold block">Failure Root Cause Diagnosis:</span>
                <p>{selectedOrder.failure_reason}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
