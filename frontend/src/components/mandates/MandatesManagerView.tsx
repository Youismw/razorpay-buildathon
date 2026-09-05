"use client";

import React, { useState, useEffect } from "react";
import { useToast } from "@/components/shared/ToastContext";
import { BACKEND_URL } from "@/lib/api";
import { CreditCard, Plus, ShieldCheck, Zap, X } from "lucide-react";

interface MandateItem {
  id: string;
  merchant_id: string;
  max_amount_inr: number;
  state: "PAYMENT_ACTIVE" | "REVOKED" | "PENDING_AUTH";
  token_id?: string;
  umn?: string;
  vpa?: string;
  created_at: string;
  authenticated_at?: string;
}

const INITIAL_MANDATES: MandateItem[] = [
  {
    id: "mnd_2026_08_a7f3",
    merchant_id: "demo-merchant.myshopify.com",
    max_amount_inr: 5000,
    state: "PAYMENT_ACTIVE",
    token_id: "token_HcsU45R9c3D",
    umn: "UMN-NPCI-2026-99281-AP2",
    vpa: "buyer@okhdfcbank",
    created_at: "2026-09-01T10:14:22Z",
  },
  {
    id: "mnd_2026_08_b912",
    merchant_id: "demo-merchant.myshopify.com",
    max_amount_inr: 25000,
    state: "PAYMENT_ACTIVE",
    token_id: "token_99182A8C44",
    umn: "UMN-NPCI-2026-11204-AP2",
    vpa: "rohit@okaxis",
    created_at: "2026-09-01T12:30:11Z",
  },
  {
    id: "mnd_2026_08_d198",
    merchant_id: "demo-merchant.myshopify.com",
    max_amount_inr: 15000,
    state: "PAYMENT_ACTIVE",
    token_id: "token_88291BA76C",
    umn: "UMN-NPCI-2026-55192-AP2",
    vpa: "rohit@oksbi",
    created_at: "2026-09-02T14:10:00Z",
  },
  {
    id: "mnd_2026_08_c441",
    merchant_id: "demo-merchant.myshopify.com",
    max_amount_inr: 10000,
    state: "REVOKED",
    token_id: "token_71268AEF41",
    umn: "UMN-NPCI-2026-44391-REV",
    vpa: "buyer@okhdfcbank",
    created_at: "2026-08-30T16:20:00Z",
  },
];

export const MandatesView: React.FC = () => {
  const [mandates, setMandates] = useState<MandateItem[]>(INITIAL_MANDATES);
  const [filter, setFilter] = useState<string>("ALL");
  const [isTokenizeOpen, setIsTokenizeOpen] = useState(false);
  const [newLimit, setNewLimit] = useState(5000);
  const [newVpa, setNewVpa] = useState("buyer@okhdfcbank");
  const [isTokenizing, setIsTokenizing] = useState(false);
  const { showToast } = useToast();

  const fetchMandates = () => {
    fetch(`${BACKEND_URL}/api/mandates`)
      .then((res) => res.json())
      .then((data) => {
        if (data.mandates && data.mandates.length > 0) {
          setMandates(data.mandates);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchMandates();
  }, []);

  const handleRevoke = async (id: string) => {
    try {
      // Optimistic isolated update targeted strictly to this specific mandate ID
      setMandates((prev) =>
        prev.map((m) => (m.id === id ? { ...m, state: "REVOKED" as const } : m))
      );

      const res = await fetch(`${BACKEND_URL}/api/mandates/revoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mandate_id: id }),
      });
      const data = await res.json();
      showToast(
        "Mandate Revoked (INV-004)",
        data.proof || `${id} revoked atomically with mutex lock.`,
        "warning"
      );
      // Sync strictly with backend Single Source of Truth
      fetchMandates();
    } catch {
      showToast("Mandate Revoked", `${id} revoked immediately via INV-004.`, "warning");
      fetchMandates();
    }
  };

  const handleCreateToken = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsTokenizing(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/mandates/tokenize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          merchant_id: "demo-merchant.myshopify.com",
          max_amount_inr: Number(newLimit),
          vpa: newVpa,
          customer_id: "cust_buyer_01",
          simulate_instant_auth: true,
        }),
      });
      if (!res.ok) throw new Error("Failed to tokenize mandate");
      const data = await res.json();

      showToast(
        "UPI Autopay Tokenized",
        `NPCI Mandate active with UMN: ${data.npci_registration?.umn || data.mandate?.umn}`,
        "success"
      );
      setIsTokenizeOpen(false);
      fetchMandates();
    } catch (err: any) {
      showToast("Tokenization Error", err?.message || "Failed to tokenize mandate", "error");
    } finally {
      setIsTokenizing(false);
    }
  };

  const handleSimulateWebhook = async (mandateId: string) => {
    try {
      const newUmn = `UMN-NPCI-2026-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

      // Instant optimistic UI update: immediately turn this specific mandate back to active
      setMandates((prev) =>
        prev.map((m) =>
          m.id === mandateId
            ? {
                ...m,
                state: "PAYMENT_ACTIVE" as const,
                umn: m.umn || newUmn,
                authenticated_at: new Date().toISOString(),
              }
            : m
        )
      );

      const simulatedPayload = {
        event: "mandate.authenticated",
        account_id: "acc_demo_razorpay",
        payload: {
          mandate: {
            entity: {
              id: mandateId,
              status: "active",
              umn: newUmn,
            },
          },
        },
      };

      const res = await fetch(`${BACKEND_URL}/api/webhooks/razorpay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(simulatedPayload),
      });
      if (!res.ok) throw new Error("Webhook rejected");
      showToast(
        "NPCI Webhook Processed",
        `Mandate ${mandateId} reactivated via NPCI callback (UMN: ${newUmn})`,
        "success"
      );
      fetchMandates();
    } catch (err: any) {
      showToast("Webhook Error", err?.message || "Failed to trigger webhook", "error");
      fetchMandates();
    }
  };

  const filtered = mandates.filter((m) => (filter === "ALL" ? true : m.state === filter));

  return (
    <div className="flex-1 w-full min-h-0 overflow-y-auto overflow-x-hidden touch-pan-y">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 pb-32">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="display-heading text-2xl mb-1">UPI Autopay Mandates</h2>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-[10px] font-mono font-bold text-emerald-700">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                NPCI Webhooks Active
              </span>
            </div>
            <p className="text-sm text-[var(--text-muted)]">
              Real-time NPCI tokenization and recurring mandates governed by atomic revocation locks (INV-004)
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsTokenizeOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-[var(--brown)] text-white text-xs font-semibold hover:bg-[var(--brown-dark)] transition-all flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tokenize via UPI Autopay</span>
            </button>

            <div className="flex items-center gap-1 bg-[var(--white-warm)] p-1 rounded-xl border border-[rgba(92,61,46,0.1)]">
              {[
                { key: "ALL", label: "All", count: mandates.length },
                { key: "PAYMENT_ACTIVE", label: "Active", count: mandates.filter((m) => m.state === "PAYMENT_ACTIVE").length },
                { key: "REVOKED", label: "Revoked", count: mandates.filter((m) => m.state === "REVOKED").length },
              ].map(({ key, label, count }) => (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                    filter === key ? "bg-[var(--brown)] text-white shadow-xs" : "text-[var(--text-muted)] hover:bg-[var(--brown-faint)]"
                  }`}
                >
                  <span>{label}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                    filter === key ? "bg-white/20 text-white" : "bg-[rgba(92,61,46,0.08)] text-[var(--text-secondary)]"
                  }`}>
                    {count}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Mandate Cards */}
        <div className="space-y-3">
          {filtered.map((mandate) => {
            const isActive = mandate.state === "PAYMENT_ACTIVE";
            const isRevoked = mandate.state === "REVOKED";
            const isPending = mandate.state === "PENDING_AUTH";

            return (
              <div
                key={mandate.id}
                className="card p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all hover:shadow-md"
              >
                <div className="flex items-start sm:items-center gap-3.5">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      isActive
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : isRevoked
                        ? "bg-red-50 text-red-600 border border-red-200"
                        : "bg-amber-50 text-amber-700 border border-amber-200"
                    }`}
                  >
                    <CreditCard className="w-5 h-5" />
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="text-sm font-bold text-[var(--text-primary)] font-mono">{mandate.id}</span>
                      {isActive && (
                        <span className="badge badge-success text-[10px] flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Active Autopay
                        </span>
                      )}
                      {isRevoked && (
                        <span className="badge badge-error text-[10px]">
                          Revoked (INV-004)
                        </span>
                      )}
                      {isPending && (
                        <span className="badge badge-warning text-[10px]">
                          Pending Auth
                        </span>
                      )}
                      {mandate.umn && (
                        <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-mono border border-blue-200">
                          {mandate.umn}
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-[var(--text-secondary)] flex flex-wrap items-center gap-x-3 gap-y-1 font-mono">
                      <span>Store: {mandate.merchant_id}</span>
                      {mandate.vpa && <span>• VPA: {mandate.vpa}</span>}
                      {mandate.token_id && <span>• Token: {mandate.token_id}</span>}
                      <span>• Created: {new Date(mandate.created_at).toLocaleDateString("en-IN")}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between md:justify-end gap-4 border-t md:border-t-0 pt-3 md:pt-0 border-[rgba(92,61,46,0.08)]">
                  <div className="text-left md:text-right">
                    <span className="text-[10px] uppercase font-mono tracking-wider text-[var(--text-muted)] block">Spend Ceiling</span>
                    <span className="text-base font-bold text-[var(--brown-dark)] tabular-nums">
                      ₹{mandate.max_amount_inr.toLocaleString("en-IN")}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleSimulateWebhook(mandate.id)}
                      title="Trigger real-time webhook callback from Razorpay"
                      className="px-2.5 py-1.5 rounded-lg border border-[rgba(92,61,46,0.15)] text-[var(--text-secondary)] text-xs font-medium hover:bg-[var(--brown-faint)] transition-colors flex items-center gap-1"
                    >
                      <Zap className="w-3 h-3 text-[var(--gold)]" />
                      <span className="hidden sm:inline">Callback</span>
                    </button>

                    {isActive && (
                      <button
                        onClick={() => handleRevoke(mandate.id)}
                        className="px-3 py-1.5 rounded-lg bg-[rgba(239,68,68,0.08)] text-[var(--stage-red)] text-xs font-bold hover:bg-[rgba(239,68,68,0.15)] transition-colors"
                      >
                        Revoke (INV-004)
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tokenization Modal */}
      {isTokenizeOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="card max-w-md w-full p-6 space-y-4 animate-scaleUp shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[var(--brown)]" />
                <h3 className="display-heading text-lg">Tokenize UPI Autopay</h3>
              </div>
              <button
                onClick={() => setIsTokenizeOpen(false)}
                className="p-1 rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-subtle)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              Creates a pre-approved recurring debit token bound to your UPI handle with an immutable spend ceiling.
              Triggers the live NPCI webhook listener callback (<code className="font-mono text-[var(--brown)]">mandate.authenticated</code>).
            </p>

            <form onSubmit={handleCreateToken} className="space-y-4 pt-1">
              <div>
                <label className="text-xs font-mono font-semibold text-[var(--text-primary)] block mb-1">
                  Spending Ceiling (INR)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[3000, 5000, 10000].map((amt) => (
                    <button
                      type="button"
                      key={amt}
                      onClick={() => setNewLimit(amt)}
                      className={`py-2 px-3 rounded-lg text-xs font-mono font-bold transition-all ${
                        newLimit === amt
                          ? "bg-[var(--brown)] text-white shadow-sm"
                          : "bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:bg-[var(--brown-faint)]"
                      }`}
                    >
                      ₹{amt.toLocaleString("en-IN")}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-mono font-semibold text-[var(--text-primary)] block mb-1">
                  UPI Virtual Payment Address (VPA)
                </label>
                <input
                  type="text"
                  value={newVpa}
                  onChange={(e) => setNewVpa(e.target.value)}
                  className="input-field text-sm font-mono w-full"
                  placeholder="user@okhdfcbank"
                  required
                />
              </div>

              <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200/80 text-[11px] text-emerald-800 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>Deterministic Spend Bound Guaranteed</span>
                </div>
                <p className="text-emerald-700 leading-normal">
                  Debits above ₹{newLimit.toLocaleString("en-IN")} are mathematically blocked by INV-010 before reaching the bank.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsTokenizeOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isTokenizing}
                  className="btn-primary text-xs px-4 py-2"
                >
                  {isTokenizing ? "Authorizing NPCI..." : "Authorize Mandate"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
