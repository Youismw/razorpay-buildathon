"use client";

import React from "react";
import { Shield, ArrowLeft, Settings } from "lucide-react";

export type BuyerTab = "search" | "catalog" | "profile" | "security" | "history" | "mandates" | "advanced";

interface BuyerNavbarProps {
  activeTab: BuyerTab;
  setActiveTab: (tab: BuyerTab) => void;
  searchMode: "basic" | "advanced";
  onToggleSearchMode: () => void;
  onBack: () => void;
  backendOnline: boolean;
  autonomyMode?: "autonomous" | "pin_required";
}

export const BuyerNavbar: React.FC<BuyerNavbarProps> = ({
  activeTab,
  setActiveTab,
  searchMode,
  onToggleSearchMode,
  onBack,
  backendOnline,
  autonomyMode = "autonomous",
}) => {
  const tabs: Array<{ id: BuyerTab; label: string }> = [
    { id: "search", label: "Search" },
    { id: "catalog", label: "Catalog" },
    { id: "profile", label: "Personalization & Limits" },
    { id: "security", label: "Security Rules" },
    { id: "history", label: "Transaction History" },
    { id: "mandates", label: "UPI Mandates" },
    { id: "advanced", label: "Advanced Tools" },
  ];

  return (
    <header className="sticky top-0 z-40 backdrop-blur-md bg-[var(--white)]/80 border-b border-[rgba(92,61,46,0.08)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Top row */}
        <div className="h-14 flex items-center justify-between">
          {/* Left: Back + Brand */}
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--brown)] hover:bg-[var(--brown-faint)] transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md bg-[var(--brown)] flex items-center justify-center">
                <Shield className="w-3.5 h-3.5 text-[var(--gold-light)]" />
              </div>
              <span className="text-sm font-semibold text-[var(--brown-dark)]">
                AP2 Buyer
              </span>
            </div>
          </div>

          {/* Right: Mode toggle + status */}
          <div className="flex items-center gap-3">
            {/* Basic / Advanced toggle */}
            <button
              onClick={onToggleSearchMode}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border border-[rgba(92,61,46,0.12)] hover:border-[var(--gold)]"
            >
              <Settings className="w-3.5 h-3.5 text-[var(--text-muted)]" />
              <span className="text-[var(--text-secondary)]">
                {searchMode === "basic" ? "Basic Mode" : "Advanced Mode"}
              </span>
              <span className={`w-1.5 h-1.5 rounded-full ${
                searchMode === "advanced" ? "bg-[var(--gold)]" : "bg-[var(--text-faint)]"
              }`} />
            </button>

            {/* Backend status */}
            <div className="flex items-center gap-1.5 text-xs font-mono text-[var(--text-muted)]">
              <span className={`w-1.5 h-1.5 rounded-full ${backendOnline ? "bg-[var(--stage-green)]" : "bg-[var(--gold)]"}`} />
              <span>{backendOnline ? "Live" : "Simulated"}</span>
            </div>
          </div>
        </div>

        {/* Tab strip */}
        <nav className="flex items-center gap-1 -mb-px overflow-x-auto">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-2.5 px-4 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                  isActive
                    ? "border-[var(--gold)] text-[var(--brown-dark)] font-semibold"
                    : "border-transparent text-[var(--text-muted)] hover:text-[var(--brown)] hover:border-[rgba(196,162,101,0.3)]"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
