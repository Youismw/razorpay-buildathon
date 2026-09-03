"use client";

import React, { useState, useEffect } from "react";
import { Lock, ShieldCheck, X, AlertCircle } from "lucide-react";

interface PinPromptModalProps {
  isOpen: boolean;
  expectedPin: string;
  totalAmountInr: number;
  rawIntent: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export const PinPromptModal: React.FC<PinPromptModalProps> = ({
  isOpen,
  expectedPin,
  totalAmountInr,
  rawIntent,
  onSuccess,
  onCancel,
}) => {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setPin("");
      setError(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === expectedPin) {
      setError(false);
      onSuccess();
    } else {
      setError(true);
      setPin("");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="card w-full max-w-sm p-6 shadow-2xl bg-white border border-[rgba(92,61,46,0.18)] rounded-2xl space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[var(--brown-faint)] flex items-center justify-center text-[var(--brown)]">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[var(--text-primary)]">
                Authorize UPI Payment
              </h3>
              <span className="text-[10px] font-mono text-[var(--text-faint)]">
                Governed Agentic Debit
              </span>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--brown-faint)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Amount Box */}
        <div className="p-3.5 rounded-xl bg-[var(--brown-faint)]/40 border border-[rgba(92,61,46,0.08)] text-center space-y-1">
          <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-muted)]">
            Total Purchase Amount
          </span>
          <div className="text-2xl font-bold font-mono text-[var(--brown-dark)]">
            ₹{totalAmountInr.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
          <p className="text-xs text-[var(--text-secondary)] truncate px-2">
            {rawIntent}
          </p>
        </div>

        {/* PIN Input Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5 text-center">
            <label className="text-xs font-medium text-[var(--text-secondary)] block">
              Enter 4-Digit Security PIN
            </label>
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              autoFocus
              value={pin}
              onChange={(e) => {
                setError(false);
                setPin(e.target.value.replace(/\D/g, ""));
              }}
              className="input py-2.5 px-4 text-center font-mono text-xl tracking-[0.5em] w-44 mx-auto"
              placeholder="••••"
            />
            {error && (
              <div className="flex items-center justify-center gap-1.5 text-xs text-[var(--stage-red)] mt-1.5">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Incorrect PIN. Please try again.</span>
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="btn-secondary py-2 px-4 text-xs flex-1"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pin.length !== 4}
              className="btn-primary py-2 px-4 text-xs flex-1 inline-flex items-center justify-center gap-1.5"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Authorize</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
