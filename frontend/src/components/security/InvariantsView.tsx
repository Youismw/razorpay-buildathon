"use client";

import React, { useState } from "react";
import { Lock, ToggleLeft, ToggleRight, AlertTriangle } from "lucide-react";
import { Invariant } from "@/lib/types";

interface SecurityViewProps {
  invariants: Invariant[];
}

const PERMANENT_IDS = ["INV-001", "INV-002", "INV-005", "INV-007", "INV-008", "INV-009", "INV-010"];

export const SecurityView: React.FC<SecurityViewProps> = ({ invariants }) => {
  const [disabledRules, setDisabledRules] = useState<Set<string>>(new Set());
  const [confirmingToggle, setConfirmingToggle] = useState<string | null>(null);
  const [selectedInvariant, setSelectedInvariant] = useState<Invariant | null>(invariants[0] || null);

  const permanent = invariants.filter((i) => PERMANENT_IDS.includes(i.id));
  const toggleable = invariants.filter((i) => !PERMANENT_IDS.includes(i.id));

  const handleToggle = (id: string) => {
    if (disabledRules.has(id)) {
      setDisabledRules((prev) => { const next = new Set(prev); next.delete(id); return next; });
      setConfirmingToggle(null);
    } else {
      setConfirmingToggle(id);
    }
  };

  const confirmDisable = (id: string) => {
    setDisabledRules((prev) => new Set(prev).add(id));
    setConfirmingToggle(null);
  };

  return (
    <div className="flex-1 w-full min-h-0 overflow-y-auto overflow-x-hidden touch-pan-y">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 pb-32">
        {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="display-heading text-2xl mb-1">Security Invariants</h2>
          <p className="text-sm text-[var(--text-muted)]">
            10 formal rules guaranteeing zero unsupervised money movement
          </p>
        </div>
        <span className="badge badge-success">
          {invariants.length - disabledRules.size} / {invariants.length} Active
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Rules List */}
        <div className="lg:col-span-5 space-y-4">
          {/* Permanent Rules */}
          <div>
            <div className="text-xs font-mono font-bold text-[var(--text-faint)] uppercase tracking-wider mb-2 px-1">
              Permanent — Cannot Be Disabled
            </div>
            <div className="space-y-1.5">
              {permanent.map((inv) => (
                <div
                  key={inv.id}
                  onClick={() => setSelectedInvariant(inv)}
                  className={`card p-3.5 cursor-pointer transition-all ${
                    selectedInvariant?.id === inv.id ? "ring-1 ring-[var(--gold)]" : ""
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Lock className="w-3.5 h-3.5 text-[var(--brown)]" />
                      <span className="text-xs font-mono font-bold text-[var(--brown)]">{inv.id}</span>
                    </div>
                    <span className="text-[10px] font-mono text-[var(--text-faint)]">Permanent</span>
                  </div>
                  <h4 className="text-sm font-medium text-[var(--text-primary)] mt-1">{inv.name}</h4>
                </div>
              ))}
            </div>
          </div>

          {/* Toggleable Rules */}
          <div>
            <div className="text-xs font-mono font-bold text-[var(--text-faint)] uppercase tracking-wider mb-2 px-1">
              Configurable — Can Be Toggled
            </div>
            <div className="space-y-1.5">
              {toggleable.map((inv) => {
                const isDisabled = disabledRules.has(inv.id);
                const isConfirming = confirmingToggle === inv.id;

                return (
                  <div key={inv.id}>
                    <div
                      onClick={() => setSelectedInvariant(inv)}
                      className={`card p-3.5 cursor-pointer transition-all ${
                        selectedInvariant?.id === inv.id ? "ring-1 ring-[var(--gold)]" : ""
                      } ${isDisabled ? "opacity-60" : ""}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-[var(--brown)]">{inv.id}</span>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleToggle(inv.id); }}
                          className="transition-colors"
                        >
                          {isDisabled ? (
                            <ToggleLeft className="w-6 h-6 text-[var(--text-faint)]" />
                          ) : (
                            <ToggleRight className="w-6 h-6 text-[var(--stage-green)]" />
                          )}
                        </button>
                      </div>
                      <h4 className={`text-sm font-medium mt-1 ${isDisabled ? "text-[var(--text-faint)] line-through" : "text-[var(--text-primary)]"}`}>
                        {inv.name}
                      </h4>
                    </div>

                    {/* Confirmation Dialog */}
                    {isConfirming && (
                      <div className="mt-1.5 p-3 rounded-xl bg-[rgba(239,68,68,0.06)] border border-[rgba(239,68,68,0.15)] text-xs space-y-2">
                        <div className="flex items-center gap-1.5 font-semibold text-[var(--stage-red)]">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>Are you sure you want to turn this off?</span>
                        </div>
                        <p className="text-[var(--text-secondary)] leading-relaxed">
                          Disabling <strong>{inv.id}</strong> removes {inv.name.toLowerCase()}.
                          This may weaken the system&apos;s protection against {
                            inv.id === "INV-003" ? "duplicate transactions and replay attacks"
                            : inv.id === "INV-004" ? "race conditions between revocation and in-flight debits"
                            : "incomplete audit trails from independent components"
                          }.
                        </p>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => confirmDisable(inv.id)}
                            className="px-3 py-1.5 rounded-md bg-[var(--stage-red)] text-white text-xs font-medium"
                          >
                            Yes, Disable
                          </button>
                          <button
                            onClick={() => setConfirmingToggle(null)}
                            className="px-3 py-1.5 rounded-md text-xs font-medium text-[var(--text-muted)] hover:text-[var(--brown)]"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: Selected Invariant Detail */}
        <div className="lg:col-span-7">
          {selectedInvariant ? (
            <div className="card p-6 space-y-4 sticky top-24">
              <div className="flex items-center justify-between pb-3 border-b border-[rgba(92,61,46,0.08)]">
                <div>
                  <span className="text-xs font-mono text-[var(--text-faint)]">{selectedInvariant.id}</span>
                  <h3 className="text-lg font-semibold text-[var(--brown-dark)]">{selectedInvariant.name}</h3>
                </div>
                <span className={`badge ${
                  disabledRules.has(selectedInvariant.id) ? "badge-error" : "badge-success"
                }`}>
                  {disabledRules.has(selectedInvariant.id) ? "Disabled" : "Active"}
                </span>
              </div>

              <div>
                <span className="text-xs font-medium text-[var(--text-muted)] block mb-1">Description</span>
                <p className="text-sm text-[var(--text-primary)] leading-relaxed">
                  {selectedInvariant.description}
                </p>
              </div>

              <div>
                <span className="text-xs font-medium text-[var(--text-muted)] block mb-1">Enforcement Mechanism</span>
                <div className="p-3 rounded-lg bg-[var(--bg-subtle)] text-xs font-mono text-[var(--brown)] leading-relaxed">
                  {selectedInvariant.enforcement}
                </div>
              </div>

              <div className="p-3 rounded-lg bg-[var(--gold-faint)] text-xs text-[var(--text-secondary)] leading-relaxed">
                <strong className="text-[var(--brown)]">Guarantee:</strong> This invariant ensures the system
                fails closed before any payment authorization occurs, regardless of LLM behavior.
              </div>
            </div>
          ) : (
            <div className="card p-16 text-center text-sm text-[var(--text-faint)]">
              Select a rule to view details
            </div>
          )}
        </div>
      </div>
    </div>
  </div>
);
};
