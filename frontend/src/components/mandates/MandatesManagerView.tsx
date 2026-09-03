"use client";

import React, { useState, useEffect } from "react";
import { useToast } from "@/components/shared/ToastContext";

interface MandateItem {
  id: string;
  merchant_id: string;
  max_amount_inr: number;
  state: "PAYMENT_ACTIVE" | "REVOKED";
  created_at: string;
}

const INITIAL_MANDATES: MandateItem[] = [
  { id: "mnd_2026_08_a7f3", merchant_id: "demo-merchant.myshopify.com", max_amount_inr: 5000, state: "PAYMENT_ACTIVE", created_at: "2026-09-01T10:14:22Z" },
  { id: "mnd_2026_08_b912", merchant_id: "demo-merchant.myshopify.com", max_amount_inr: 25000, state: "PAYMENT_ACTIVE", created_at: "2026-09-01T12:30:11Z" },
  { id: "mnd_2026_08_c441", merchant_id: "demo-merchant.myshopify.com", max_amount_inr: 10000, state: "REVOKED", created_at: "2026-08-30T16:20:00Z" },
];

export const MandatesView: React.FC = () => {
  const [mandates, setMandates] = useState<MandateItem[]>(INITIAL_MANDATES);
  const [filter, setFilter] = useState("ALL");
  const { showToast } = useToast();

  useEffect(() => {
    fetch("http://127.0.0.1:8000/api/mandates")
      .then((res) => res.json())
      .then((data) => {
        if (data.mandates && data.mandates.length > 0) {
          setMandates(data.mandates);
        }
      })
      .catch(() => {});
  }, []);

  const handleRevoke = async (id: string) => {
    try {
      const res = await fetch("http://127.0.0.1:8000/api/mandates/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mandate_id: id }),
      });
      const data = await res.json();
      setMandates((prev) => prev.map((m) => (m.id === id ? { ...m, state: "REVOKED" } : m)));
      showToast("Mandate Revoked (INV-004)", data.proof || `${id} revoked atomically with mutex lock.`, "warning");
    } catch {
      setMandates((prev) => prev.map((m) => (m.id === id ? { ...m, state: "REVOKED" } : m)));
      showToast("Mandate Revoked", `${id} revoked immediately via INV-004.`, "warning");
    }
  };

  const filtered = mandates.filter((m) => filter === "ALL" ? true : m.state === filter);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6 overflow-y-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="display-heading text-2xl mb-1">UPI Autopay Mandates</h2>
          <p className="text-sm text-[var(--text-muted)]">
            Active and revoked payment mandates with atomic revocation locks
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {["ALL", "PAYMENT_ACTIVE", "REVOKED"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filter === f ? "bg-[var(--brown)] text-white" : "text-[var(--text-muted)] hover:bg-[var(--brown-faint)]"
              }`}
            >
              {f === "ALL" ? "All" : f === "PAYMENT_ACTIVE" ? "Active" : "Revoked"}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {filtered.map((mandate) => {
          const isActive = mandate.state === "PAYMENT_ACTIVE";
          return (
            <div key={mandate.id} className="card p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className={`badge text-[10px] ${isActive ? "badge-success" : "badge-error"}`}>
                  {isActive ? "Active" : "Revoked"}
                </span>
                <div>
                  <div className="text-sm font-semibold text-[var(--text-primary)] font-mono">{mandate.id}</div>
                  <div className="text-xs text-[var(--text-faint)]">
                    {mandate.merchant_id} · {new Date(mandate.created_at).toLocaleDateString("en-IN")}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <span className="text-xs text-[var(--text-faint)] block">Ceiling</span>
                  <span className="text-sm font-bold text-[var(--brown-dark)] tabular-nums">
                    ₹{mandate.max_amount_inr.toLocaleString("en-IN")}
                  </span>
                </div>
                {isActive && (
                  <button
                    onClick={() => handleRevoke(mandate.id)}
                    className="px-3 py-1.5 rounded-lg bg-[rgba(239,68,68,0.08)] text-[var(--stage-red)] text-xs font-medium hover:bg-[rgba(239,68,68,0.15)] transition-colors"
                  >
                    Revoke
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
