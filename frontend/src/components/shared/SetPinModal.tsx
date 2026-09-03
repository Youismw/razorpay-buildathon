"use client";

import React, { useState } from "react";
import { ShieldCheck, Lock, X, KeyRound, AlertCircle } from "lucide-react";

interface SetPinModalProps {
  isOpen: boolean;
  onSave: (newPin: string) => void;
  onCancel: () => void;
}

export const SetPinModal: React.FC<SetPinModalProps> = ({ isOpen, onSave, onCancel }) => {
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length < 4) {
      setError("PIN must be at least 4 digits.");
      return;
    }
    if (pin !== confirmPin) {
      setError("PINs do not match. Please re-enter.");
      return;
    }
    setError(null);
    onSave(pin);
    setPin("");
    setConfirmPin("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl border border-[rgba(92,61,46,0.12)] relative">
        <button
          onClick={onCancel}
          className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex flex-col items-center text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-[var(--gold-faint)] flex items-center justify-center border border-[var(--gold)]">
            <KeyRound className="w-6 h-6 text-[var(--brown)]" />
          </div>

          <h3 className="text-base font-bold text-[var(--brown-dark)]">
            Set Manual Approval PIN
          </h3>
          <p className="text-xs text-[var(--text-muted)] leading-relaxed">
            Switching to <strong>Manual Mode</strong> requires PIN authorization before each transaction and manual payment through Razorpay.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">
              Choose 4-Digit PIN
            </label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              autoFocus
              value={pin}
              onChange={(e) => {
                setPin(e.target.value);
                setError(null);
              }}
              placeholder="••••"
              className="w-full px-3 py-2 text-center text-lg tracking-widest font-mono rounded-lg border border-[rgba(92,61,46,0.2)] focus:outline-none focus:border-[var(--brown)] focus:ring-1 focus:ring-[var(--brown)]"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">
              Confirm PIN
            </label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={confirmPin}
              onChange={(e) => {
                setConfirmPin(e.target.value);
                setError(null);
              }}
              placeholder="••••"
              className="w-full px-3 py-2 text-center text-lg tracking-widest font-mono rounded-lg border border-[rgba(92,61,46,0.2)] focus:outline-none focus:border-[var(--brown)] focus:ring-1 focus:ring-[var(--brown)]"
            />
          </div>

          {error && (
            <div className="flex items-center gap-1.5 text-xs text-red-600 bg-red-50 p-2 rounded-lg border border-red-100">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-2 rounded-lg border border-[rgba(92,61,46,0.2)] text-xs font-medium text-[var(--text-muted)] hover:bg-gray-50 transition-colors cursor-pointer"
            >
              Keep Autonomous
            </button>
            <button
              type="submit"
              className="flex-1 py-2 rounded-lg bg-[var(--brown)] hover:bg-[var(--brown-dark)] text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer"
            >
              Enable Manual Mode
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
