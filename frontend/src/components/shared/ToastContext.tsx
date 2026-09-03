"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from "lucide-react";

export type ToastType = "success" | "error" | "warning" | "info";

export interface Toast {
  id: string;
  title: string;
  message?: string;
  type: ToastType;
  duration?: number;
}

interface ToastContextType {
  showToast: (title: string, message?: string, type?: ToastType, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (title: string, message?: string, type: ToastType = "info", duration = 4000) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const newToast: Toast = { id, title, message, type, duration };

      setToasts((prev) => [...prev.slice(-3), newToast]);

      if (duration > 0) {
        setTimeout(() => {
          dismissToast(id);
        }, duration);
      }
    },
    [dismissToast]
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {/* Toast Notification Container */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map((toast) => {
          const isSuccess = toast.type === "success";
          const isError = toast.type === "error";
          const isWarning = toast.type === "warning";

          return (
            <div
              key={toast.id}
              className="pointer-events-auto p-3 rounded-xl bg-white border border-[rgba(92,61,46,0.12)] shadow-lg flex items-start gap-2.5 transition-all"
            >
              <div className="mt-0.5 shrink-0">
                {isSuccess ? (
                  <CheckCircle2 className="w-4 h-4 text-[var(--stage-green)]" />
                ) : isError ? (
                  <AlertCircle className="w-4 h-4 text-[var(--stage-red)]" />
                ) : isWarning ? (
                  <AlertTriangle className="w-4 h-4 text-[var(--stage-orange)]" />
                ) : (
                  <Info className="w-4 h-4 text-[var(--gold)]" />
                )}
              </div>

              <div className="flex-1 text-xs font-sans">
                <div className="font-medium text-[var(--brown-dark)]">{toast.title}</div>
                {toast.message && (
                  <div className="text-[11px] text-[var(--text-muted)] mt-0.5 leading-snug">
                    {toast.message}
                  </div>
                )}
              </div>

              <button
                onClick={() => dismissToast(toast.id)}
                className="text-[var(--text-faint)] hover:text-[var(--brown)] transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
};
