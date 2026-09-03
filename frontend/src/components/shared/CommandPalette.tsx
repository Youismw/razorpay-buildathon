"use client";

import React, { useState, useEffect, useRef } from "react";
import { Search, Zap, Lock, Database, Store, CreditCard, ShieldAlert, Radio, Sparkles } from "lucide-react";
import { BuyerTab } from "@/components/layout/Navbar";

interface CommandItem {
  id: string;
  title: string;
  category: "Navigation" | "Quick Demos" | "Security Tests";
  icon: React.ElementType;
  shortcut?: string;
  action: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (tab: BuyerTab) => void;
  onTriggerPreset: (presetId: string) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onNavigate,
  onTriggerPreset,
}) => {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands: CommandItem[] = [
    {
      id: "nav-search",
      title: "Go to Search & Pipeline Flow",
      category: "Navigation",
      icon: Sparkles,
      shortcut: "⌘1",
      action: () => { onNavigate("search"); onClose(); },
    },
    {
      id: "nav-catalog",
      title: "Go to Verified Merchant Catalog",
      category: "Navigation",
      icon: Store,
      shortcut: "⌘2",
      action: () => { onNavigate("catalog"); onClose(); },
    },
    {
      id: "nav-security",
      title: "Go to Security Rules (10 Invariants)",
      category: "Navigation",
      icon: Lock,
      shortcut: "⌘3",
      action: () => { onNavigate("security"); onClose(); },
    },
    {
      id: "nav-history",
      title: "Go to Transaction Audit Ledger",
      category: "Navigation",
      icon: Database,
      shortcut: "⌘4",
      action: () => { onNavigate("history"); onClose(); },
    },
    {
      id: "nav-mandates",
      title: "Go to UPI Autopay Mandates",
      category: "Navigation",
      icon: CreditCard,
      shortcut: "⌘5",
      action: () => { onNavigate("mandates"); onClose(); },
    },
    {
      id: "nav-advanced",
      title: "Go to Advanced Developer Tools",
      category: "Navigation",
      icon: Radio,
      shortcut: "⌘6",
      action: () => { onNavigate("advanced"); onClose(); },
    },
    {
      id: "demo-happy",
      title: "Run Standard Purchase: Sony WH-CH520 (< ₹5,000)",
      category: "Quick Demos",
      icon: Zap,
      action: () => { onNavigate("search"); onTriggerPreset("happy-path"); onClose(); },
    },
    {
      id: "demo-earbuds",
      title: "Run High-End Purchase: Sony XM5 Earbuds",
      category: "Quick Demos",
      icon: Zap,
      action: () => { onNavigate("search"); onTriggerPreset("earbuds-high"); onClose(); },
    },
    {
      id: "test-overspend",
      title: "Test Policy Limit: Over-Budget Violation (INV-010)",
      category: "Security Tests",
      icon: ShieldAlert,
      action: () => { onNavigate("search"); onTriggerPreset("fail-guardrail"); onClose(); },
    },
    {
      id: "test-injection",
      title: "Test Input Sanitizer: Prompt Injection Attack (SEC-PI-001)",
      category: "Security Tests",
      icon: ShieldAlert,
      action: () => { onNavigate("search"); onTriggerPreset("fail-vault"); onClose(); },
    },
  ];

  const filtered = commands.filter((c) =>
    c.title.toLowerCase().includes(query.toLowerCase()) ||
    c.category.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % Math.max(1, filtered.length));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filtered.length) % Math.max(1, filtered.length));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (filtered[selectedIndex]) {
          filtered[selectedIndex].action();
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, filtered, selectedIndex, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-24 p-4 bg-black/40 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-[var(--white)] border border-[rgba(92,61,46,0.15)] rounded-xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[rgba(92,61,46,0.08)] bg-white">
          <Search className="w-4 h-4 text-[var(--text-faint)] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Type a command, search pages, or run presets..."
            className="w-full bg-transparent text-sm text-[var(--text-primary)] placeholder-[var(--text-faint)] focus:outline-none font-sans"
          />
          <kbd className="px-2 py-0.5 rounded bg-[var(--bg-subtle)] border border-[rgba(92,61,46,0.1)] text-[10px] font-mono text-[var(--text-muted)]">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2 space-y-1">
          {filtered.length > 0 ? (
            filtered.map((item, idx) => {
              const Icon = item.icon;
              const isSelected = idx === selectedIndex;
              return (
                <button
                  key={item.id}
                  onClick={() => item.action()}
                  className={`w-full flex items-center justify-between p-2.5 rounded-lg text-left text-xs transition-colors ${isSelected
                      ? "bg-[var(--brown)] text-white"
                      : "hover:bg-[var(--brown-faint)] text-[var(--text-secondary)]"
                    }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <Icon className={`w-3.5 h-3.5 shrink-0 ${isSelected ? "text-[var(--gold-light)]" : "text-[var(--text-muted)]"}`} />
                    <span className="truncate font-medium">{item.title}</span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded ${isSelected ? "bg-white/20 text-white" : "bg-[var(--bg-subtle)] text-[var(--text-muted)]"
                      }`}>
                      {item.category}
                    </span>
                    {item.shortcut && (
                      <kbd className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${isSelected ? "bg-white/20 text-white" : "bg-[var(--bg-subtle)] text-[var(--text-muted)]"
                        }`}>
                        {item.shortcut}
                      </kbd>
                    )}
                  </div>
                </button>
              );
            })
          ) : (
            <div className="py-8 text-center text-xs text-[var(--text-muted)] font-mono">
              No matching commands found
            </div>
          )}
        </div>

        {/* Footer Hint */}
        <div className="px-4 py-2.5 bg-[var(--bg-subtle)] border-t border-[rgba(92,61,46,0.08)] text-[11px] font-mono text-[var(--text-muted)] flex items-center justify-between">
          <span>Navigate with ↑ ↓ • Select with Enter</span>
          <span>AP2 Command Engine</span>
        </div>
      </div>
    </div>
  );
};
