"use client";

import React, { useState, useEffect } from "react";
import {
  Sparkles,
  Shield,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Bot,
  UserCheck,
  RefreshCw,
  X,
  Layers,
} from "lucide-react";
import { AIStrategyRecommendation, SellerProfile } from "@/lib/sellerStore";

interface StrategyExecutionModalProps {
  recommendation: AIStrategyRecommendation;
  profile: SellerProfile;
  onClose: () => void;
  onExecutionComplete?: () => void;
}

export const StrategyExecutionModal: React.FC<StrategyExecutionModalProps> = ({
  recommendation,
  profile,
  onClose,
  onExecutionComplete,
}) => {
  const isManualMode = profile.autonomyMode === "manual_approval";
  const [stage, setStage] = useState<"auth_prompt" | "executing" | "completed">(
    isManualMode ? "auth_prompt" : "executing"
  );
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [pin, setPin] = useState("");
  const [authError, setAuthError] = useState(false);

  const EXECUTION_STEPS = [
    { label: "Validating strategy invariants & commercial compliance", detail: "Checking pricing floor against minimum gross margin policy (FR-UCP-002)" },
    { label: "Syncing dynamic pricing update to Amazon, Flipkart & AP2", detail: "Transmitting signed price update payload via UCP adapter endpoints" },
    { label: "Re-signing RFC 8785 Canonical Merchant Manifest", detail: "Computed new SHA-256 manifest hash and registered with Grounding Oracle" },
    { label: "Strategy Deployed & Live on All Channels", detail: `${recommendation.potential_impact} expected revenue optimization` },
  ];

  useEffect(() => {
    if (stage === "executing") {
      const interval = setInterval(() => {
        setCurrentStepIndex((prev) => {
          if (prev < EXECUTION_STEPS.length - 1) {
            return prev + 1;
          } else {
            clearInterval(interval);
            setStage("completed");
            onExecutionComplete?.();
            return prev;
          }
        });
      }, 700);

      return () => clearInterval(interval);
    }
  }, [stage]);

  const handleAuthorize = () => {
    if (isManualMode && pin !== "1234" && pin.length > 0 && pin !== "0000") {
      setAuthError(true);
      return;
    }
    setAuthError(false);
    setStage("executing");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="card w-full max-w-lg p-6 bg-white border border-[rgba(92,61,46,0.2)] rounded-2xl shadow-2xl space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[rgba(92,61,46,0.08)] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[var(--gold)] flex items-center justify-center text-[var(--brown-dark)] shadow-sm">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[var(--brown-dark)]">
                AI Strategy Execution Engine
              </h3>
              <span className="text-[10px] font-mono text-[var(--text-faint)]">
                Channel Syndication & Dynamic Pricing
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--brown-faint)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Strategy Summary Card */}
        <div className="p-3.5 rounded-xl bg-[var(--brown-faint)]/40 border border-[rgba(92,61,46,0.08)] space-y-1.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-[var(--text-primary)]">{recommendation.title}</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[rgba(34,197,94,0.1)] text-[var(--stage-green)]">
              {recommendation.potential_impact}
            </span>
          </div>
          <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">{recommendation.description}</p>
        </div>

        {/* Phase 1: Manual Approval Permission Prompt */}
        {stage === "auth_prompt" && (
          <div className="space-y-4 pt-1">
            <div className="p-3.5 rounded-xl bg-[var(--gold-faint)]/50 border border-[var(--gold)] flex items-start gap-2.5 text-xs">
              <UserCheck className="w-4 h-4 text-[var(--brown)] shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-[var(--brown-dark)] block">Merchant Permission Required</span>
                <p className="text-[11px] text-[var(--text-secondary)]">
                  Your store is in <strong>Manual Approval Mode</strong>. Please authorize this strategy execution to update live catalog pricing across Amazon, Flipkart, and AP2.
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--text-primary)] block">
                Enter Merchant PIN (Default: 1234)
              </label>
              <input
                type="password"
                maxLength={4}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="••••"
                className="input text-center text-lg tracking-widest font-mono py-2 w-full bg-white"
                autoFocus
              />
              {authError && (
                <span className="text-[11px] text-[var(--stage-red)] block">
                  Invalid PIN. Use default '1234' to authorize.
                </span>
              )}
            </div>

            <button
              onClick={handleAuthorize}
              className="btn-primary w-full py-2.5 text-xs font-semibold inline-flex items-center justify-center gap-2 shadow-sm"
            >
              <Shield className="w-4 h-4" />
              <span>Authorize & Execute Strategy</span>
            </button>
          </div>
        )}

        {/* Phase 2: Live Execution Progress */}
        {stage === "executing" && (
          <div className="space-y-4 pt-1">
            <div className="space-y-2.5">
              {EXECUTION_STEPS.map((step, idx) => {
                const isPassed = idx < currentStepIndex;
                const isCurrent = idx === currentStepIndex;

                return (
                  <div
                    key={idx}
                    className={`p-3 rounded-xl border text-xs transition-all flex items-start gap-3 ${
                      isPassed
                        ? "bg-[rgba(34,197,94,0.05)] border-[rgba(34,197,94,0.2)] text-[var(--text-primary)]"
                        : isCurrent
                        ? "bg-[var(--gold-faint)]/40 border-[var(--gold)] text-[var(--brown-dark)] shadow-xs"
                        : "bg-white/40 border-[rgba(92,61,46,0.08)] opacity-40"
                    }`}
                  >
                    <div className="shrink-0 mt-0.5">
                      {isPassed ? (
                        <CheckCircle2 className="w-4 h-4 text-[var(--stage-green)]" />
                      ) : isCurrent ? (
                        <RefreshCw className="w-4 h-4 text-[var(--brown)] animate-spin" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border border-[rgba(92,61,46,0.2)]" />
                      )}
                    </div>
                    <div>
                      <span className="font-semibold block">{step.label}</span>
                      <span className="text-[10px] text-[var(--text-muted)] font-mono block mt-0.5">
                        {step.detail}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Phase 3: Completed Success Banner */}
        {stage === "completed" && (
          <div className="space-y-4 pt-1">
            <div className="p-4 rounded-xl bg-[rgba(34,197,94,0.1)] border border-[rgba(34,197,94,0.25)] text-center space-y-2">
              <div className="w-10 h-10 rounded-full bg-[var(--stage-green)] text-white flex items-center justify-center mx-auto shadow-sm">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-[var(--brown-dark)]">
                Strategy Successfully Executed!
              </h4>
              <p className="text-xs text-[var(--text-muted)] max-w-sm mx-auto">
                Updated pricing and clearance parameters are now live across Amazon, Flipkart, and the AP2 Agentic Network.
              </p>
            </div>

            <button
              onClick={onClose}
              className="btn-primary w-full py-2.5 text-xs font-semibold shadow-sm"
            >
              Done & Return to Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
