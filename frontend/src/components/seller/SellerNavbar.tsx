"use client";

import React from "react";
import {
  Store,
  MessageSquare,
  Package,
  Truck,
  BarChart3,
  Settings2,
  Building2,
  ArrowLeft,
  Bot,
  UserCheck,
  Zap,
} from "lucide-react";
import { SellerProfile } from "@/lib/sellerStore";

export type SellerTab = "chat" | "catalog" | "orders" | "analytics" | "settlement" | "profile";

interface SellerNavbarProps {
  activeTab: SellerTab;
  onSelectTab: (tab: SellerTab) => void;
  onBackToBuyer: () => void;
  sellerMode: "basic" | "advanced";
  onToggleSellerMode: (mode: "basic" | "advanced") => void;
  profile: SellerProfile;
}

const SELLER_NAV_ITEMS = [
  { id: "chat", label: "AI Listing Assistant", icon: MessageSquare },
  { id: "catalog", label: "Inventory & Catalog", icon: Package },
  { id: "orders", label: "Orders & Logistics", icon: Truck },
  { id: "analytics", label: "Revenue & Ledger", icon: BarChart3 },
  { id: "settlement", label: "Settlement & Policies", icon: Settings2 },
  { id: "profile", label: "Merchant Profile", icon: Building2 },
] as const;

export const SellerNavbar: React.FC<SellerNavbarProps> = ({
  activeTab,
  onSelectTab,
  onBackToBuyer,
  sellerMode,
  onToggleSellerMode,
  profile,
}) => {
  return (
    <header className="sticky top-0 z-40 backdrop-blur-md bg-[var(--white)]/90 border-b border-[rgba(92,61,46,0.08)] shadow-sm">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 h-14 flex items-center justify-between gap-2 sm:gap-4 overflow-hidden">
        {/* Left: Back + Merchant Branding */}
        <div className="flex items-center gap-2 sm:gap-3 shrink min-w-0">
          <button
            onClick={onBackToBuyer}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--brown)] hover:bg-[var(--brown-faint)] transition-colors inline-flex items-center gap-1.5 text-xs font-medium shrink-0 cursor-pointer"
            title="Switch to Buyer Portal"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Buyer Portal</span>
          </button>

          <div className="h-4 w-[1px] bg-[rgba(92,61,46,0.15)] shrink-0" />

          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <div className="w-7 h-7 rounded-md bg-[var(--gold)] flex items-center justify-center shadow-sm shrink-0">
              <Store className="w-3.5 h-3.5 text-[var(--brown-dark)]" />
            </div>
            <div className="min-w-0">
              <span className="text-xs font-bold text-[var(--brown-dark)] block leading-tight truncate max-w-[100px] xs:max-w-[140px] sm:max-w-[200px] md:max-w-none">
                {profile.storeName || "Merchant Gateway"}
              </span>
              <span className="text-[10px] font-mono text-[var(--text-faint)] block truncate max-w-[100px] xs:max-w-[140px] sm:max-w-[200px] md:max-w-none">
                {profile.merchantId}
              </span>
            </div>
          </div>
        </div>

        {/* Center: Tabs */}
        <nav className="hidden xl:flex items-center gap-1 bg-[var(--brown-faint)]/50 p-1 rounded-xl border border-[rgba(92,61,46,0.06)]">
          {SELLER_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id as SellerTab)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
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
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Mode Switcher */}
          <div className="flex items-center bg-[var(--brown-faint)] p-0.5 rounded-lg border border-[rgba(92,61,46,0.08)] shadow-2xs">
            <button
              onClick={() => onToggleSellerMode("basic")}
              className={`px-2 py-1 rounded-md text-[10px] sm:text-[11px] font-medium transition-all cursor-pointer ${
                sellerMode === "basic"
                  ? "bg-white text-[var(--brown-dark)] shadow-xs font-semibold"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
            >
              Basic
            </button>
            <button
              onClick={() => onToggleSellerMode("advanced")}
              className={`px-2 py-1 rounded-md text-[10px] sm:text-[11px] font-medium transition-all cursor-pointer ${
                sellerMode === "advanced"
                  ? "bg-white text-[var(--brown-dark)] shadow-xs font-semibold"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
            >
              Advanced
            </button>
          </div>

          {/* Autonomy Badge */}
          <div
            className={`inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-lg text-[10px] sm:text-[11px] font-mono border ${
              profile.autonomyMode === "autonomous"
                ? "bg-[var(--gold-faint)] border-[var(--gold)] text-[var(--brown)] font-medium"
                : "bg-[rgba(92,61,46,0.05)] border-[rgba(92,61,46,0.15)] text-[var(--text-muted)]"
            }`}
            title={profile.autonomyMode === "autonomous" ? "Autonomous AI Active" : "Manual Approval Active"}
          >
            {profile.autonomyMode === "autonomous" ? (
              <>
                <Bot className="w-3.5 h-3.5 text-[var(--brown)] shrink-0" />
                <span className="hidden sm:inline">Autonomous AI</span>
              </>
            ) : (
              <>
                <UserCheck className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
                <span className="hidden sm:inline">Manual Approval</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Nav Bar */}
      <div className="xl:hidden flex items-center gap-1 overflow-x-auto px-4 py-1.5 border-t border-[rgba(92,61,46,0.06)] bg-[var(--white)]">
        {SELLER_NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id as SellerTab)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] whitespace-nowrap ${
                isActive
                  ? "bg-[var(--brown-faint)] text-[var(--brown-dark)] font-semibold"
                  : "text-[var(--text-muted)]"
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
