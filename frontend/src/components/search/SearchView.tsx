"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, ChevronDown, Sparkles, Search } from "lucide-react";
import { BuyRequest, PipelineStageState } from "@/lib/types";
import { VerticalPipeline } from "@/components/pipeline/VerticalPipeline";
import { useCardGlow } from "@/hooks/useCardGlow";

interface SearchViewProps {
  stages: PipelineStageState[];
  isStreaming: boolean;
  currentTraceId?: string;
  failureExplanation?: string;
  liveThoughts?: string[];
  searchMode: "basic" | "advanced";
  onExecute: (req: BuyRequest) => void;
  onReset: () => void;
}

const PRESETS: Array<{
  group: string;
  items: Array<{
    id: string;
    label: string;
    intent: string;
    maxSpend: number;
    tag: string;
    allowedMerchants?: string[];
    simulateFailureStage?: number;
  }>;
}> = [
  {
    group: "Happy Path (Standard Execution)",
    items: [
      { id: "happy-path", label: "Standard: Sony WH-CH520 (₹4,999)", intent: "Buy noise-canceling headphones under Rs 5000 from DemoMerchant", maxSpend: 5000, tag: "Settled" },
      { id: "earbuds-high", label: "Premium: Sony XM5 Earbuds (₹19,999)", intent: "Purchase Sony WF-1000XM5 earbuds with fast delivery", maxSpend: 25000, tag: "Grounded" },
      { id: "grocery-bundle", label: "🛒 Groceries: Usual List with Brand Substitution", intent: "Order my usual grocery list with dairy and breakfast staples", maxSpend: 2000, tag: "Multi-Brand" },
    ],
  },
  {
    group: "Per-Stage Failure Scenarios",
    items: [
      { id: "fail-compiler", label: "Stage 1 Fail: Intent Too Short (< 5 chars)", intent: "Buy", maxSpend: 5000, simulateFailureStage: 1, tag: "Compiler Rejection" },
      { id: "fail-reasoning", label: "Stage 2 Fail: Reasoning Hallucination", intent: "Purchase quantum teleportation hyperdrive module", maxSpend: 5000, simulateFailureStage: 2, tag: "Reasoning Non-Match" },
      { id: "fail-guardrail", label: "Stage 3 Fail: Budget Limit Overspend (INV-010)", intent: "Buy Sony WH-CH520 Wireless Headphones", maxSpend: 50, simulateFailureStage: 3, tag: "Guardrail Policy Block" },
      { id: "fail-vault", label: "Stage 4 Fail: Cryptographic Key Fault (INV-009)", intent: "Authorize purchase with simulated ES256 key mismatch", maxSpend: 5000, simulateFailureStage: 4, tag: "Vault Signing Fault" },
      { id: "fail-settlement", label: "Stage 5 Fail: Revocation Race (INV-004)", intent: "Purchase Sony WH-CH520 with concurrent mandate revocation", maxSpend: 5000, simulateFailureStage: 5, tag: "Revocation (403)" },
    ],
  },
];

export const SearchView: React.FC<SearchViewProps> = ({
  stages,
  isStreaming,
  currentTraceId,
  failureExplanation,
  liveThoughts,
  searchMode,
  onExecute,
  onReset,
}) => {
  const [rawIntent, setRawIntent] = useState("");
  const [maxSpendInr, setMaxSpendInr] = useState<number>(5000);
  const [llmProvider, setLlmProvider] = useState<"auto" | "groq" | "gemini" | "openrouter" | "mock">("auto");
  const [merchant, setMerchant] = useState("demo-merchant.myshopify.com");
  const [showPresets, setShowPresets] = useState(false);
  const [showPipeline, setShowPipeline] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  useCardGlow(containerRef);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowPresets(false);
      }
    };
    if (showPresets) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showPresets]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawIntent.trim() || isStreaming) return;

    setShowPipeline(true);
    onExecute({
      raw_intent: rawIntent.trim(),
      max_spend_inr: maxSpendInr,
      allowed_merchants: [merchant],
      validity_hours: 24,
      mode: searchMode,
      llm_provider: llmProvider,
    });
  };

  const handlePreset = (preset: { id: string; intent: string; maxSpend: number; allowedMerchants?: string[]; simulateFailureStage?: number }) => {
    setRawIntent(preset.intent);
    setMaxSpendInr(preset.maxSpend);
    setShowPresets(false);
    setShowPipeline(true);

    onExecute({
      raw_intent: preset.intent,
      max_spend_inr: preset.maxSpend,
      allowed_merchants: preset.allowedMerchants || [merchant],
      validity_hours: 24,
      mode: searchMode,
      llm_provider: llmProvider,
      simulate_failure_stage: preset.simulateFailureStage,
    });
  };

  const handleNewSearch = () => {
    onReset();
    setShowPipeline(false);
    setRawIntent("");
  };

  const isPipelineActive = showPipeline || isStreaming || stages.some((s) => s.status !== "idle");

  return (
    <div ref={containerRef} className="flex-1 flex flex-col overflow-y-scroll overflow-x-hidden" style={{ scrollbarGutter: "stable" }}>
      <AnimatePresence mode="wait">
        {!isPipelineActive ? (
          /* ═══ Chat-First Search View ═══ */
          <motion.div
            key="search"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-2xl mx-auto pt-20 sm:pt-28 pb-16 px-4"
          >
            {/* Headline */}
            <div className="text-center mb-10">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200/80 text-emerald-800 text-xs font-mono mb-4 shadow-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-medium">Live AI Engine: Gemini 3.5 Flash</span>
                <span className="text-emerald-400">·</span>
                <span>Razorpay S2S Checkout</span>
              </div>
              <h2 className="display-heading text-3xl sm:text-4xl mb-3">
                What would you like to buy?
              </h2>
              <p className="text-sm text-[var(--text-muted)] max-w-md mx-auto">
                Describe your purchase in plain language. The AI agent will find,
                verify, and execute the best deal within your budget constraints.
              </p>
            </div>

            {/* Search Bar — Centerpiece */}
            <form onSubmit={handleSubmit} className="w-full max-w-2xl space-y-4">
              <div className="card p-2 flex items-center gap-2">
                <div className="flex-1 flex items-center gap-3 px-3">
                  <Search className="w-5 h-5 text-[var(--text-faint)] shrink-0" />
                  <input
                    type="text"
                    value={rawIntent}
                    onChange={(e) => setRawIntent(e.target.value)}
                    placeholder="Buy noise-canceling headphones under ₹5,000..."
                    className="w-full bg-transparent text-base text-[var(--text-primary)] placeholder-[var(--text-faint)] focus:outline-none py-3"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!rawIntent.trim() || isStreaming}
                  className="btn-primary py-3 px-6 text-sm shrink-0"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Run Flow</span>
                </button>
              </div>

              {/* Controls Row — Budget + Presets */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  width: "100%",
                  position: "relative",
                  flexWrap: "nowrap",
                }}
                className="px-1"
              >
                {/* Budget pill */}
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                  <span className="text-sm text-[var(--text-muted)]">Budget:</span>
                  <div className="flex items-center gap-1 input py-1.5 px-3 w-32 text-sm">
                    <span className="text-[var(--text-faint)]">₹</span>
                    <input
                      type="number"
                      value={maxSpendInr}
                      onChange={(e) => setMaxSpendInr(Number(e.target.value))}
                      className="w-full bg-transparent focus:outline-none font-mono font-medium text-[var(--text-primary)]"
                      min={1}
                    />
                  </div>
                </div>

                {/* Presets Dropdown */}
                <div ref={dropdownRef} style={{ position: "relative", flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={() => setShowPresets(!showPresets)}
                    style={{ whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: "6px" }}
                    className="btn-secondary text-xs py-1.5 px-3"
                  >
                    <span>Presets & Test Scenarios</span>
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showPresets ? "rotate-180" : ""}`} />
                  </button>

                  {showPresets && (
                    <div
                      style={{
                        position: "absolute",
                        right: 0,
                        top: "100%",
                        marginTop: "8px",
                        width: "360px",
                        maxHeight: "320px",
                        overflowY: "auto",
                        zIndex: 9999,
                      }}
                      className="card p-2.5 shadow-2xl bg-white/95 backdrop-blur-sm border border-[rgba(92,61,46,0.15)] rounded-xl"
                    >
                      {PRESETS.map((group) => (
                        <div key={group.group} className="mb-2 last:mb-0">
                          <div className="text-[10px] font-mono font-bold text-[var(--text-faint)] uppercase tracking-wider px-3 py-1.5">
                            {group.group}
                          </div>
                          {group.items.map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => handlePreset(item)}
                              className="w-full text-left px-3 py-2 text-xs rounded-lg hover:bg-[var(--brown-faint)] transition-colors flex items-center justify-between group"
                            >
                              <span className="text-[var(--text-secondary)] font-medium group-hover:text-[var(--brown-dark)]">{item.label}</span>
                              <span className="text-[10px] font-mono text-[var(--text-faint)] shrink-0 ml-2">{item.tag}</span>
                            </button>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Advanced mode extras */}
              {searchMode === "advanced" && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  className="card p-4 space-y-3"
                >
                  <div className="text-xs font-medium text-[var(--text-secondary)] mb-2">
                    Advanced Parameters
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-[var(--text-muted)] block mb-1">Merchant Scope</label>
                      <select
                        value={merchant}
                        onChange={(e) => setMerchant(e.target.value)}
                        className="input text-sm py-2 cursor-pointer"
                      >
                        <option value="demo-merchant.myshopify.com">demo-merchant.myshopify.com</option>
                        <option value="unauthorized-merchant.com">unauthorized-merchant.com</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-[var(--text-muted)] block mb-1">AI Routing & Fallback Cascade</label>
                      <select
                        value={llmProvider}
                        onChange={(e) => setLlmProvider(e.target.value as any)}
                        className="input text-sm py-2 cursor-pointer"
                      >
                        <option value="auto">Auto Hierarchy (Tiered Routing & Cascade)</option>
                        <option value="groq">Groq (openai/gpt-oss-20b · Ultra-Fast)</option>
                        <option value="gemini">Gemini 3.6 Flash (Frontier Reasoning)</option>
                        <option value="openrouter">OpenRouter (DeepSeek / Qwen)</option>
                        <option value="mock">Local Deterministic Engine</option>
                      </select>
                    </div>
                  </div>
                </motion.div>
              )}
            </form>
          </motion.div>
        ) : (
          /* ═══ Pipeline Full-Screen View ═══ */
          <motion.div
            key="pipeline"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col px-4 py-8 overflow-y-auto"
          >
            {/* Header with trace + new search */}
            <div className="flex items-center justify-between mb-6 max-w-lg mx-auto w-full">
              <div>
                <h3 className="text-sm font-semibold text-[var(--brown-dark)]">
                  Pipeline Execution
                </h3>
                {currentTraceId && (
                  <span className="text-xs font-mono text-[var(--text-faint)]">
                    Trace: {currentTraceId}
                  </span>
                )}
              </div>
              <button
                onClick={handleNewSearch}
                disabled={isStreaming}
                className="btn-secondary text-xs py-1.5 px-3"
              >
                <ArrowRight className="w-3 h-3 rotate-180" />
                <span>New Search</span>
              </button>
            </div>

            {/* Intent display */}
            {rawIntent && (
              <div className="max-w-lg mx-auto w-full mb-4 px-4 py-3 rounded-xl bg-[var(--brown-faint)] text-sm text-[var(--text-secondary)]">
                &ldquo;{rawIntent}&rdquo;
                <span className="text-xs text-[var(--text-faint)] ml-2">
                  · Budget: ₹{maxSpendInr.toLocaleString("en-IN")}
                </span>
              </div>
            )}

            {/* Vertical Pipeline */}
            <VerticalPipeline
              stages={stages}
              failureExplanation={failureExplanation}
              liveThoughts={liveThoughts}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
