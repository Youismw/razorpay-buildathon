"use client";

import React, { useState } from "react";
import {
  Settings2,
  DollarSign,
  ShieldCheck,
  RefreshCw,
  Zap,
  CheckCircle2,
  Sparkles,
  Building2,
  AlertCircle,
  X,
} from "lucide-react";
import { SellerProfile, SettlementPreferences } from "@/lib/sellerStore";

interface SellerSettlementViewProps {
  profile: SellerProfile;
  onUpdatePreferences: (settlement: SettlementPreferences) => void;
}

export const SellerSettlementView: React.FC<SellerSettlementViewProps> = ({
  profile,
  onUpdatePreferences,
}) => {
  const [settlement, setSettlement] = useState<SettlementPreferences>(profile.settlement);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [presetLoadedName, setPresetLoadedName] = useState<string | null>(null);
  const [showSaveToast, setShowSaveToast] = useState(false);

  const handleApplyPreset = async (industry: string, label: string) => {
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/seller/settlement/presets/${industry}`);
      const presetData = await res.json();
      const normalized: SettlementPreferences = {
        payoutSchedule: presetData.payoutSchedule || presetData.payout_schedule || "daily_t1",
        refundPolicy: presetData.refundPolicy || presetData.refund_policy || "replacement_only_7d",
        disputeResolution: presetData.disputeResolution || presetData.dispute_resolution || "ai_autonomous_arbitration",
        businessType: presetData.businessType || presetData.business_type || (industry as any) || "electronics",
        bankAccountLast4: presetData.bankAccountLast4 || presetData.bank_account_last4 || "4921",
        autoSweepEnabled: presetData.autoSweepEnabled ?? presetData.auto_sweep_enabled ?? true,
      };
      setSettlement(normalized);
      setPresetLoadedName(label);
      setHasUnsavedChanges(true);
    } catch (err) {
      console.error("Failed to load preset:", err);
    }
  };

  const handleSave = () => {
    onUpdatePreferences(settlement);
    setHasUnsavedChanges(false);
    setShowSaveToast(true);
    setTimeout(() => setShowSaveToast(false), 4000);
  };

  const INDUSTRY_PRESETS = [
    { id: "groceries", label: "🛒 Groceries & FMCG", desc: "Instant T+0 payout • 7-day replacement • AI dispute arbitration" },
    { id: "electronics", label: "💻 Tech Hardware & Audio", desc: "Daily T+1 payout • 7-day replacement • AI dispute arbitration" },
    { id: "fashion", label: "👗 Fashion & Apparel", desc: "Daily T+1 payout • 14-day free return window • AI dispute arbitration" },
    { id: "beauty", label: "💄 Beauty & Personal Care", desc: "Daily T+1 payout • Final Sale policy • AI dispute arbitration" },
    { id: "construction", label: "🏗️ Construction & Bulk", desc: "Weekly T+7 payout • Replacement only • Manual merchant review" },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8 relative">
      {/* Header */}
      <div>
        <h2 className="display-heading text-2xl mb-1">Settlement & Policy Preferences</h2>
        <p className="text-sm text-[var(--text-muted)]">
          Configure automated payout schedules, dispute resolution, and industry-tailored return policies.
        </p>
      </div>

      {/* Industry 1-Click Recommendation Presets */}
      <div className="card p-6 space-y-4 border-[rgba(196,162,101,0.3)] bg-gradient-to-b from-white to-[var(--gold-faint)]/20 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[var(--brown)]" />
            <h3 className="text-sm font-bold text-[var(--brown-dark)]">
              Industry Recommended Presets (1-Click Optimization)
            </h3>
          </div>
          {presetLoadedName && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[var(--gold-faint)] border border-[var(--gold)] text-[var(--brown)] font-bold">
              Active: {presetLoadedName}
            </span>
          )}
        </div>
        <p className="text-xs text-[var(--text-muted)]">
          Click any preset to auto-populate vetted settlement settings. The granular boxes below will highlight the loaded rules. Click <strong>"Save Preferences"</strong> to apply.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          {INDUSTRY_PRESETS.map((preset) => {
            const isSelected = settlement.businessType === preset.id;
            return (
              <button
                key={preset.id}
                onClick={() => handleApplyPreset(preset.id, preset.label)}
                className={`p-3.5 rounded-xl border text-left transition-all ${
                  isSelected
                    ? "bg-white border-2 border-[var(--brown)] shadow-sm"
                    : "bg-white/80 border-[rgba(92,61,46,0.12)] hover:border-[var(--brown)] hover:bg-white"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs font-bold ${isSelected ? "text-[var(--brown-dark)]" : "text-[var(--text-primary)]"}`}>
                    {preset.label}
                  </span>
                  {isSelected && (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-[var(--stage-green)] font-mono">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Loaded</span>
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">{preset.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Granular Settlement Box with Distinct Active Highlighting */}
      <div className="card p-6 space-y-6 shadow-xs border border-[rgba(92,61,46,0.15)]">
        <div className="flex items-center justify-between border-b border-[rgba(92,61,46,0.08)] pb-3">
          <div>
            <h3 className="text-sm font-bold text-[var(--brown-dark)]">
              Granular Settlement Configuration
            </h3>
            <p className="text-[11px] text-[var(--text-muted)]">
              Active selections are highlighted with bold brown borders. Click options to customize.
            </p>
          </div>
          {hasUnsavedChanges && (
            <span className="px-2.5 py-1 rounded-full bg-[var(--gold-faint)] text-[var(--brown)] text-[10px] font-mono font-bold border border-[var(--gold)] animate-pulse">
              ● Unsaved Changes
            </span>
          )}
        </div>

        {/* Payout Schedule */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-[var(--text-primary)]">
              Payout Frequency & Auto-Sweep
            </label>
            <span className="text-[10px] font-mono text-[var(--text-faint)]">
              Active: {(settlement?.payoutSchedule || "daily_t1").toUpperCase()}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { id: "instant_t0", label: "Instant T+0", desc: "Settled immediately on delivery confirmation" },
              { id: "daily_t1", label: "Daily T+1 (Standard)", desc: "Automated midnight balance sweep" },
              { id: "weekly_t7", label: "Weekly T+7", desc: "Batch settlement every Monday morning" },
            ].map((sch) => {
              const isActive = (settlement?.payoutSchedule || "daily_t1") === sch.id;
              return (
                <button
                  key={sch.id}
                  onClick={() => {
                    setSettlement({ ...settlement, payoutSchedule: sch.id as any });
                    setHasUnsavedChanges(true);
                  }}
                  className={`p-3.5 rounded-xl border text-left transition-all ${
                    isActive
                      ? "border-2 border-[var(--brown)] bg-[var(--brown-faint)]/70 shadow-xs font-medium"
                      : "bg-white border-[rgba(92,61,46,0.12)] hover:bg-[var(--brown-faint)]/30"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-bold ${isActive ? "text-[var(--brown-dark)]" : "text-[var(--text-primary)]"}`}>
                      {sch.label}
                    </span>
                    {isActive && <CheckCircle2 className="w-4 h-4 text-[var(--brown)]" />}
                  </div>
                  <div className="text-[10px] text-[var(--text-muted)] mt-1 leading-snug">{sch.desc}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Refund Policy */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-[var(--text-primary)]">
              Return & Refund Governance
            </label>
            <span className="text-[10px] font-mono text-[var(--text-faint)]">
              Active: {(settlement?.refundPolicy || "replacement_only_7d").replace(/_/g, " ").toUpperCase()}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { id: "no_questions_asked_14d", label: "14-Day Free Returns", desc: "Full refund within 14 days of receipt" },
              { id: "replacement_only_7d", label: "7-Day Replacement", desc: "Defective item replacement only" },
              { id: "final_sale", label: "Final Sale", desc: "No returns except verified carrier damage" },
            ].map((pol) => {
              const isActive = (settlement?.refundPolicy || "replacement_only_7d") === pol.id;
              return (
                <button
                  key={pol.id}
                  onClick={() => {
                    setSettlement({ ...settlement, refundPolicy: pol.id as any });
                    setHasUnsavedChanges(true);
                  }}
                  className={`p-3.5 rounded-xl border text-left transition-all ${
                    isActive
                      ? "border-2 border-[var(--brown)] bg-[var(--brown-faint)]/70 shadow-xs font-medium"
                      : "bg-white border-[rgba(92,61,46,0.12)] hover:bg-[var(--brown-faint)]/30"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-bold ${isActive ? "text-[var(--brown-dark)]" : "text-[var(--text-primary)]"}`}>
                      {pol.label}
                    </span>
                    {isActive && <CheckCircle2 className="w-4 h-4 text-[var(--brown)]" />}
                  </div>
                  <div className="text-[10px] text-[var(--text-muted)] mt-1 leading-snug">{pol.desc}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Dispute Resolution */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-[var(--text-primary)]">
              Dispute Resolution Flow
            </label>
            <span className="text-[10px] font-mono text-[var(--text-faint)]">
              Active: {(settlement?.disputeResolution || "ai_autonomous_arbitration").replace(/_/g, " ").toUpperCase()}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              {
                id: "ai_autonomous_arbitration",
                label: "AI Autonomous Arbitration",
                desc: "AI evaluates delivery proof & carrier logs automatically within 2 hours",
              },
              {
                id: "manual_merchant_review",
                label: "Manual Merchant Review",
                desc: "Escalate buyer disputes to merchant support portal for manual sign-off",
              },
            ].map((dr) => {
              const isActive = settlement.disputeResolution === dr.id;
              return (
                <button
                  key={dr.id}
                  onClick={() => {
                    setSettlement({ ...settlement, disputeResolution: dr.id as any });
                    setHasUnsavedChanges(true);
                  }}
                  className={`p-3.5 rounded-xl border text-left transition-all ${
                    isActive
                      ? "border-2 border-[var(--brown)] bg-[var(--brown-faint)]/70 shadow-xs font-medium"
                      : "bg-white border-[rgba(92,61,46,0.12)] hover:bg-[var(--brown-faint)]/30"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-bold ${isActive ? "text-[var(--brown-dark)]" : "text-[var(--text-primary)]"}`}>
                      {dr.label}
                    </span>
                    {isActive && <CheckCircle2 className="w-4 h-4 text-[var(--brown)]" />}
                  </div>
                  <div className="text-[10px] text-[var(--text-muted)] mt-1 leading-snug">{dr.desc}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Save Bar */}
        <div className="pt-4 border-t border-[rgba(92,61,46,0.08)] flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="text-xs font-mono text-[var(--text-muted)]">
            Payout Account: <span className="font-bold text-[var(--brown-dark)]">HDFC Bank (••••{settlement.bankAccountLast4})</span>
          </span>

          <button
            onClick={handleSave}
            className="btn-primary py-2.5 px-6 text-xs font-semibold shadow-sm w-full sm:w-auto"
          >
            Save Preferences
          </button>
        </div>
      </div>

      {/* Pop-up Notification Banner when Saved */}
      {showSaveToast && (
        <div className="fixed bottom-6 right-6 z-50 p-4 rounded-2xl bg-[var(--brown-dark)] text-white shadow-2xl border border-[rgba(196,162,101,0.4)] animate-in fade-in slide-in-from-bottom-4 duration-300 max-w-sm space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[var(--gold)]" />
              <span className="text-xs font-bold text-white">Settlement Rules Saved!</span>
            </div>
            <button
              onClick={() => setShowSaveToast(false)}
              className="text-white/60 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-[11px] text-white/80 leading-snug">
            Updated to <strong>{settlement.payoutSchedule.toUpperCase()}</strong> payout schedule, <strong>{settlement.refundPolicy.replace(/_/g, " ")}</strong>, and <strong>{settlement.disputeResolution.replace(/_/g, " ")}</strong>.
          </p>
        </div>
      )}
    </div>
  );
};
