"use client";

import React from "react";
import {
  Shield,
  ArrowLeft,
  Search,
  Package,
  Sliders,
  ShieldCheck,
  Receipt,
  CreditCard,
  Cpu,
  Bot,
  UserCheck,
} from "lucide-react";

export type BuyerTab = "search" | "catalog" | "profile" | "security" | "history" | "mandates" | "advanced";

interface BuyerNavbarProps {
  activeTab: BuyerTab;
  setActiveTab: (tab: BuyerTab) => void;
  searchMode: "basic" | "advanced";
  onToggleSearchMode: () => void;
  onBack: () => void;
  backendOnline: boolean;
  autonomyMode?: "autonomous" | "pin_required";
  onToggleAutonomyMode?: () => void;
}

const BUYER_NAV_ITEMS = [
  { id: "search", label: "Search", icon: Search },
  { id: "catalog", label: "Catalog", icon: Package },
  { id: "profile", label: "Personalization & Limits", icon: Sliders },
  { id: "security", label: "Security Rules", icon: ShieldCheck },
  { id: "history", label: "Transaction History", icon: Receipt },
  { id: "mandates", label: "UPI Mandates", icon: CreditCard },
  { id: "advanced", label: "Advanced Tools", icon: Cpu },
] as const;

export const BuyerNavbar: React.FC<BuyerNavbarProps> = ({
  activeTab,
  setActiveTab,
  searchMode,
  onToggleSearchMode,
  onBack,
  backendOnline,
  autonomyMode = "autonomous",
  onToggleAutonomyMode,
}) => {
  return (
    <header className="sticky top-0 z-40 backdrop-blur-md bg-[var(--white)]/90 border-b border-[rgba(92,61,46,0.08)] shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        {/* Left: Back + Buyer Branding */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={onBack}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--brown)] hover:bg-[var(--brown-faint)] transition-colors inline-flex items-center gap-1.5 text-xs font-medium"
            title="Switch to Role Selection"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Role Selection</span>
          </button>

          <div className="h-4 w-[1px] bg-[rgba(92,61,46,0.15)]" />

          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-[var(--brown)] flex items-center justify-center shadow-sm">
              <Shield className="w-3.5 h-3.5 text-[var(--gold-light)]" />
            </div>
            <div>
              <span className="text-xs font-bold text-[var(--brown-dark)] block leading-tight">
                AP2 Buyer
              </span>
              <span className="text-[10px] font-mono text-[var(--text-faint)]">
                Autonomous Bridge
              </span>
            </div>
          </div>
        </div>

        {/* Center: Tabs in 1 Unified Row */}
        <nav className="hidden xl:flex items-center gap-1 bg-[var(--brown-faint)]/50 p-1 rounded-xl border border-[rgba(92,61,46,0.06)]">
          {BUYER_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as BuyerTab)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? "bg-[var(--white)] text-[var(--brown-dark)] font-semibold shadow-xs"
                    : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--white)]/50"
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? "text-[var(--brown)]" : "text-[var(--text-faint)]"}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Right: Mode Switcher + Autonomy Indicator */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Mode Switcher (Basic / Advanced Toggle) */}
          <div className="flex items-center bg-[var(--brown-faint)] p-0.5 rounded-lg border border-[rgba(92,61,46,0.08)]">
            <button
              onClick={() => searchMode !== "basic" && onToggleSearchMode()}
              className={`px-2 py-1 rounded-md text-[11px] font-medium transition-all ${
                searchMode === "basic"
                  ? "bg-white text-[var(--brown-dark)] shadow-xs font-semibold"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
            >
              Basic
            </button>
            <button
              onClick={() => searchMode !== "advanced" && onToggleSearchMode()}
              className={`px-2 py-1 rounded-md text-[11px] font-medium transition-all ${
                searchMode === "advanced"
                  ? "bg-white text-[var(--brown-dark)] shadow-xs font-semibold"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
            >
              Advanced
            </button>
          </div>

          {/* Autonomy Badge / PIN Toggle Button */}
          <button
            type="button"
            onClick={onToggleAutonomyMode}
            title="Click to toggle between Autonomous AI mode and PIN-required manual confirmation"
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-mono border cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98] ${
              autonomyMode === "autonomous"
                ? "bg-[var(--gold-faint)] border-[var(--gold)] text-[var(--brown)] font-medium hover:bg-[var(--gold-faint)]/80"
                : "bg-emerald-50 border-emerald-300 text-emerald-800 font-medium hover:bg-emerald-100/70"
            }`}
          >
            {autonomyMode === "autonomous" ? (
              <>
                <Bot className="w-3.5 h-3.5 text-[var(--brown)]" />
                <span className="hidden sm:inline">Autonomous AI</span>
              </>
            ) : (
              <>
                <UserCheck className="w-3.5 h-3.5 text-emerald-700" />
                <span className="hidden sm:inline">PIN Required (1234)</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Responsive View (below xl screen width) */}
      <div className="xl:hidden flex items-center gap-1 overflow-x-auto px-4 py-1.5 border-t border-[rgba(92,61,46,0.06)] bg-[var(--white)]">
        {BUYER_NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as BuyerTab)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] whitespace-nowrap transition-all ${
                isActive
                  ? "bg-[var(--brown-faint)] text-[var(--brown-dark)] font-semibold"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
            >
              <Icon className="w-3 h-3" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </header>
  );
};
