"use client";

import React, { useState, useRef } from "react";
import { Search, ExternalLink } from "lucide-react";
import { TransactionAuditRecord } from "@/lib/types";
import { useCardGlow } from "@/hooks/useCardGlow";
import { AuditReportModal } from "@/components/history/AuditReportModal";

interface HistoryViewProps {
  transactions: TransactionAuditRecord[];
  onSelectTransaction?: (tx: TransactionAuditRecord) => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  transactions,
  onSelectTransaction,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [selectedTx, setSelectedTx] = useState<TransactionAuditRecord | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  useCardGlow(containerRef);

  const filtered = transactions.filter((tx) => {
    const matchesSearch =
      tx.raw_intent.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tx.trace_id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      statusFilter === "ALL" ||
      (statusFilter === "SUCCESS" && tx.status === "SUCCESS") ||
      (statusFilter === "FAILED" && tx.status !== "SUCCESS");
    return matchesSearch && matchesStatus;
  });

  const handleRowClick = (tx: TransactionAuditRecord) => {
    setSelectedTx(tx);
    onSelectTransaction?.(tx);
  };

  return (
    <div ref={containerRef} className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6 overflow-y-auto">
      <div>
        <h2 className="display-heading text-2xl mb-1">Transaction History & Audit Ledger</h2>
        <p className="text-sm text-[var(--text-muted)]">
          Immutable, append-only audit ledger of all governed purchases. Click any row to view cryptographic proof and AI thought trail.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search intent, trace ID..."
            className="input pl-10 text-sm py-2.5"
          />
        </div>
        <div className="flex items-center gap-1.5">
          {["ALL", "SUCCESS", "FAILED"].map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === f
                  ? "bg-[var(--brown)] text-white"
                  : "text-[var(--text-muted)] hover:bg-[var(--brown-faint)]"
              }`}
            >
              {f === "ALL" ? "All" : f === "SUCCESS" ? "Settled" : "Blocked"}
            </button>
          ))}
        </div>
      </div>

      {/* Transaction List */}
      <div className="space-y-2">
        {filtered.length > 0 ? (
          filtered.map((tx, idx) => {
            const isSuccess = tx.status === "SUCCESS";
            return (
              <div
                key={`${tx.trace_id}-${tx.timestamp || idx}-${idx}`}
                onClick={() => handleRowClick(tx)}
                className="card p-4 cursor-pointer transition-all hover:shadow-md flex items-center justify-between gap-4 group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`badge text-[10px] ${isSuccess ? "badge-success" : "badge-error"}`}>
                    {isSuccess ? "Settled" : "Blocked"}
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-[var(--text-primary)] truncate group-hover:text-[var(--brown)]">
                      {tx.raw_intent}
                    </div>
                    <div className="text-xs text-[var(--text-faint)] font-mono">
                      {new Date(tx.timestamp).toLocaleString("en-IN")} · {tx.trace_id}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 shrink-0">
                  <span className="text-sm font-bold text-[var(--brown-dark)] tabular-nums">
                    ₹{(tx.total_amount_inr || (tx.total_price_paise || 0) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                  <ExternalLink className="w-4 h-4 text-[var(--text-faint)] group-hover:text-[var(--brown)] transition-colors" />
                </div>
              </div>
            );
          })
        ) : (
          <div className="py-16 text-center text-sm text-[var(--text-faint)]">
            {transactions.length === 0
              ? "No transactions yet. Run a purchase flow to generate records."
              : "No transactions match your filters."}
          </div>
        )}
      </div>

      {/* Audit Report Modal */}
      <AuditReportModal
        transaction={selectedTx}
        onClose={() => setSelectedTx(null)}
      />
    </div>
  );
};
