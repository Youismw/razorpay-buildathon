"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  ChevronDown,
  Sparkles,
  Search,
  Mic,
  MicOff,
  Eye,
  EyeOff,
  X,
  CreditCard,
  ExternalLink,
  Plus,
  Minus,
  CheckCircle2,
  ShieldCheck,
  Tag,
  Check,
} from "lucide-react";
import { BuyRequest, PipelineStageState } from "@/lib/types";
import { VerticalPipeline } from "@/components/pipeline/VerticalPipeline";
import { useCardGlow } from "@/hooks/useCardGlow";
import { UserProfileState } from "@/lib/profileStore";
import { BACKEND_URL } from "@/lib/api";

interface SearchViewProps {
  stages: PipelineStageState[];
  isStreaming: boolean;
  currentTraceId?: string;
  failureExplanation?: string;
  liveThoughts?: string[];
  searchMode: "basic" | "advanced";
  profile?: UserProfileState;
  onExecute: (req: BuyRequest) => void;
  onReset: () => void;
}

interface DetectedStaple {
  keyword: string;
  name: string;
  unitRateInr: number;
  unitLabel: string;
  defaultQty: number;
  quickQtys: number[];
}

const COMMON_STAPLES: DetectedStaple[] = [
  { keyword: "milk", name: "Amul Taaza Homogenised Toned Milk (1L)", unitRateInr: 72, unitLabel: "L", defaultQty: 1, quickQtys: [1, 2, 3, 5] },
  { keyword: "bread", name: "Britannia 100% Whole Wheat Bread (400g)", unitRateInr: 45, unitLabel: "Loaf", defaultQty: 1, quickQtys: [1, 2, 3] },
  { keyword: "coffee", name: "Nescafé Classic Instant Coffee (100g)", unitRateInr: 180, unitLabel: "Jar", defaultQty: 1, quickQtys: [1, 2] },
  { keyword: "butter", name: "Amul Pasteurized Salted Table Butter (500g)", unitRateInr: 275, unitLabel: "Pack", defaultQty: 1, quickQtys: [1, 2] },
  { keyword: "eggs", name: "Farm Fresh White Eggs (Pack of 6)", unitRateInr: 65, unitLabel: "Pack", defaultQty: 1, quickQtys: [1, 2, 4] },
  { keyword: "atta", name: "Aashirvaad Superior MP Shudh Chakki Atta (5kg)", unitRateInr: 320, unitLabel: "Bag", defaultQty: 1, quickQtys: [1, 2] },
  { keyword: "headphones", name: "Sony WH-CH520 Wireless Headphones", unitRateInr: 4999, unitLabel: "Unit", defaultQty: 1, quickQtys: [1] },
];

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
      { id: "fail-compiler", label: "Stage 1 Fail: Intent Too Short (< 3 chars)", intent: "No", maxSpend: 5000, simulateFailureStage: 1, tag: "Compiler Rejection" },
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
  profile,
  onExecute,
  onReset,
}) => {
  const [rawIntent, setRawIntent] = useState("");
  const [maxSpendInr, setMaxSpendInr] = useState<number>(5000);
  const [llmProvider, setLlmProvider] = useState<"auto" | "groq" | "gemini" | "openrouter" | "mock">("auto");
  const [merchant, setMerchant] = useState("demo-merchant.myshopify.com");
  const [showPresets, setShowPresets] = useState(false);
  const [showPipeline, setShowPipeline] = useState(false);

  // Voice Command State
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Diagram Hide/Show State
  const [isDiagramVisible, setIsDiagramVisible] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("ap2_hide_diagram_pref") !== "true";
    }
    return true;
  });
  const [show4sCloud, setShow4sCloud] = useState(false);
  const [showPersistentBar, setShowPersistentBar] = useState(false);
  const [dontAskAgain, setDontAskAgain] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("ap2_dont_ask_hide_diagram") === "true";
    }
    return false;
  });

  // Quantity Clarifier State
  const [selectedQty, setSelectedQty] = useState<number>(1);
  const [liveStaples, setLiveStaples] = useState<DetectedStaple[]>(COMMON_STAPLES);

  // Synchronize dynamic catalog items from server in real time
  useEffect(() => {
    let isMounted = true;
    const fetchLiveStaples = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/seller/catalog`, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (data.items && Array.isArray(data.items) && isMounted) {
          const dynamicStaples: DetectedStaple[] = data.items.map((it: any) => {
            const nameLower = (it.name || it.title || "").toLowerCase();
            let kw = (it.id || "").toLowerCase().replace("prod-", "");
            if (nameLower.includes("milk")) kw = "milk";
            else if (nameLower.includes("coffee")) kw = "coffee";
            else if (nameLower.includes("bread")) kw = "bread";
            else if (nameLower.includes("butter")) kw = "butter";
            else if (nameLower.includes("egg")) kw = "egg";
            else if (nameLower.includes("atta") || nameLower.includes("flour")) kw = "atta";
            else if (nameLower.includes("headphone") || nameLower.includes("earphone")) kw = "headphone";
            else if (nameLower.includes("earbud")) kw = "earbud";
            else if (nameLower.includes("watch")) kw = "watch";
            else if (nameLower.includes("mouse")) kw = "mouse";
            else if (nameLower.includes("keyboard")) kw = "keyboard";
            else if (nameLower.includes("speaker")) kw = "speaker";
            else kw = nameLower.split(" ")[0] || kw;

            let unitLabel = "Unit";
            if (nameLower.includes("(1l)") || nameLower.includes("liter") || nameLower.includes("1l")) unitLabel = "L";
            else if (nameLower.includes("400g") || nameLower.includes("bread")) unitLabel = "Loaf";
            else if (nameLower.includes("jar") || nameLower.includes("coffee")) unitLabel = "Jar";
            else if (nameLower.includes("pack") || nameLower.includes("butter") || nameLower.includes("egg")) unitLabel = "Pack";
            else if (nameLower.includes("5kg") || nameLower.includes("atta")) unitLabel = "Bag";

            return {
              keyword: kw,
              name: it.name || it.title,
              unitRateInr: Number(it.sellingPrice || it.sellingPriceInr || 100),
              unitLabel,
              defaultQty: 1,
              quickQtys: unitLabel === "L" ? [1, 2, 3, 5] : [1, 2, 3],
            };
          });

          const merged = [...dynamicStaples];
          for (const cs of COMMON_STAPLES) {
            if (!merged.some((m) => m.keyword === cs.keyword)) {
              merged.push(cs);
            }
          }
          setLiveStaples(merged);
        }
      } catch {
        // Fallback silently
      }
    };

    fetchLiveStaples();
    const interval = setInterval(fetchLiveStaples, 2500);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

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

  const isPipelineActive = showPipeline || isStreaming || stages.some((s) => s.status !== "idle");

  // Show 4-second diagram prompt when execution begins
  useEffect(() => {
    if (isPipelineActive) {
      if (typeof window !== "undefined") {
        const suppressed = localStorage.getItem("ap2_dont_ask_hide_diagram") === "true";
        if (!suppressed && isDiagramVisible) {
          setShow4sCloud(true);
          const timer = setTimeout(() => {
            setShow4sCloud(false);
          }, 4000);
          return () => clearTimeout(timer);
        }
      }
    } else {
      setShow4sCloud(false);
    }
  }, [isPipelineActive, isDiagramVisible]);

  // Voice Recognition Handler
  const handleToggleVoice = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Voice search is not supported in this browser. Please use Chrome, Edge, or Safari.");
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = "en-IN";
      recognition.continuous = false;
      recognition.interimResults = true;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        let transcript = "";
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        if (transcript) {
          setRawIntent(transcript);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn("Speech recognition error:", event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error("Failed to start speech recognition:", err);
      setIsListening(false);
    }
  };

  // Item & Quantity Clarifier logic
  const lowerQuery = rawIntent.toLowerCase().trim();
  const hideRateRequested =
    lowerQuery.includes("dont show rate") ||
    lowerQuery.includes("don't show rate") ||
    lowerQuery.includes("no rate") ||
    lowerQuery.includes("without rate") ||
    profile?.showRatesInChat === false;

  const hasExplicitQuantity =
    /\b\d+\s*(?:l|liter|liters|litre|litres|kg|kgs|packet|packets|pack|packs|bottle|bottles|pcs|units?|items?)?\b/.test(lowerQuery) ||
    /\b(one|two|three|four|five|six)\b/.test(lowerQuery);

  const detectedStaple = liveStaples.find((s) => lowerQuery.includes(s.keyword));
  const showQuantityClarifier = Boolean(detectedStaple && !hasExplicitQuantity && profile?.alwaysConfirmQuantity !== false);

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

  const settlementStage = stages.find((s) => s.id === "SETTLEMENT");

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
                Describe your purchase in plain language or use the mic. The AI agent will find,
                verify, and execute the best deal within your budget constraints.
              </p>
            </div>

            {/* Search Bar — Centerpiece */}
            <form onSubmit={handleSubmit} className="w-full max-w-2xl space-y-4">
              <div className="card p-2 flex items-center gap-2">
                <div className="flex-1 flex items-center gap-2.5 px-3">
                  <Search className="w-5 h-5 text-[var(--text-faint)] shrink-0" />
                  <input
                    type="text"
                    value={rawIntent}
                    onChange={(e) => setRawIntent(e.target.value)}
                    placeholder="Buy 2 liters of milk under ₹200..."
                    className="w-full bg-transparent text-base text-[var(--text-primary)] placeholder-[var(--text-faint)] focus:outline-none py-3"
                  />
                  {/* Voice Command Button */}
                  <button
                    type="button"
                    onClick={handleToggleVoice}
                    title={isListening ? "Listening... Click to stop" : "Speak Voice Command"}
                    className={`p-2 rounded-xl transition-all cursor-pointer shrink-0 ${
                      isListening
                        ? "bg-red-500 text-white animate-pulse shadow-md"
                        : "text-[var(--text-muted)] hover:text-[var(--brown)] hover:bg-[var(--brown-faint)]"
                    }`}
                  >
                    {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </button>
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

              {/* Listening Voice Indicator */}
              {isListening && (
                <div className="flex items-center justify-center gap-2 text-xs font-mono text-red-600 bg-red-50 py-1.5 px-3 rounded-lg border border-red-200 animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-red-600" />
                  <span>Listening... Speak your order now (e.g. &ldquo;Buy 2 liters of milk&rdquo;)</span>
                </div>
              )}

              {/* ═══ Quantity & Rate Clarifier Card ═══ */}
              {showQuantityClarifier && !isStreaming && detectedStaple && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="card p-4 bg-gradient-to-br from-amber-50/70 to-orange-50/50 border border-amber-200/80 rounded-2xl shadow-sm space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--brown-dark)]">
                        <Tag className="w-3.5 h-3.5 text-amber-700" />
                        <span>Item Clarification</span>
                      </div>
                      <div className="text-sm font-semibold text-[var(--text-primary)] mt-0.5">
                        {detectedStaple.name}
                      </div>
                      {!hideRateRequested && (
                        <div className="text-xs font-mono font-medium text-emerald-700 mt-0.5">
                          🏷️ Rate: ₹{detectedStaple.unitRateInr}.00 / {detectedStaple.unitLabel}
                        </div>
                      )}
                    </div>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-medium">
                      Catalog Match
                    </span>
                  </div>

                  {/* Quantity Controls & Quick Picks */}
                  <div className="pt-2 border-t border-amber-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-medium text-[var(--text-secondary)]">Quantity:</span>
                      <div className="flex items-center border border-[rgba(92,61,46,0.2)] rounded-lg bg-white overflow-hidden shadow-2xs">
                        <button
                          type="button"
                          onClick={() => setSelectedQty((q) => Math.max(1, q - 1))}
                          className="p-1.5 hover:bg-gray-100 text-[var(--text-muted)] cursor-pointer"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-10 text-center text-xs font-bold font-mono text-[var(--brown-dark)]">
                          {selectedQty} {detectedStaple.unitLabel}
                        </span>
                        <button
                          type="button"
                          onClick={() => setSelectedQty((q) => q + 1)}
                          className="p-1.5 hover:bg-gray-100 text-[var(--text-muted)] cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Quick Picks */}
                      <div className="flex items-center gap-1.5">
                        {detectedStaple.quickQtys.map((q) => (
                          <button
                            key={q}
                            type="button"
                            onClick={() => setSelectedQty(q)}
                            className={`px-2 py-0.5 text-xs font-mono rounded-md border transition-colors cursor-pointer ${
                              selectedQty === q
                                ? "bg-[var(--brown)] text-white border-[var(--brown)]"
                                : "bg-white text-[var(--text-secondary)] border-[rgba(92,61,46,0.15)] hover:border-[var(--brown)]"
                            }`}
                          >
                            {q}{detectedStaple.unitLabel}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3">
                      <div className="text-right">
                        <span className="text-[10px] text-[var(--text-muted)] block">Estimated Total</span>
                        <span className="text-sm font-bold font-mono text-emerald-800">
                          ₹{detectedStaple.unitRateInr * selectedQty}.00
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          const intentWithQty = `Buy ${selectedQty}${detectedStaple.unitLabel} of ${detectedStaple.name}${
                            hideRateRequested ? " (don't show rate)" : ` (Rate: ₹${detectedStaple.unitRateInr}/${detectedStaple.unitLabel})`
                          }`;
                          setRawIntent(intentWithQty);
                          setMaxSpendInr(Math.max(500, detectedStaple.unitRateInr * selectedQty + 100));
                          setShowPipeline(true);
                          onExecute({
                            raw_intent: intentWithQty,
                            max_spend_inr: Math.max(500, detectedStaple.unitRateInr * selectedQty + 100),
                            allowed_merchants: [merchant],
                            validity_hours: 24,
                            mode: searchMode,
                            llm_provider: llmProvider,
                          });
                        }}
                        className="btn-primary py-2 px-4 text-xs font-semibold shrink-0"
                      >
                        <span>Confirm & Order</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}

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
          /* ═══ Pipeline Execution View ═══ */
          <motion.div
            key="pipeline"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col px-4 py-8 overflow-y-auto"
          >
            {/* Header with trace + diagram toggle + new search */}
            <div className="flex items-center justify-between mb-4 max-w-lg mx-auto w-full">
              <div>
                <h3 className="text-sm font-semibold text-[var(--brown-dark)]">
                  Purchase Execution
                </h3>
                {currentTraceId && (
                  <span className="text-xs font-mono text-[var(--text-faint)]">
                    Trace: {currentTraceId}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const next = !isDiagramVisible;
                    setIsDiagramVisible(next);
                    if (!next) {
                      setShowPersistentBar(true);
                    }
                  }}
                  className="btn-secondary text-xs py-1.5 px-3 inline-flex items-center gap-1.5 cursor-pointer"
                  title={isDiagramVisible ? "Hide technical 5-stage diagram" : "Show technical 5-stage diagram"}
                >
                  {isDiagramVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  <span>{isDiagramVisible ? "Hide Diagram" : "Show Diagram"}</span>
                </button>
                <button
                  onClick={handleNewSearch}
                  disabled={isStreaming}
                  className="btn-secondary text-xs py-1.5 px-3"
                >
                  <ArrowRight className="w-3 h-3 rotate-180" />
                  <span>New Search</span>
                </button>
              </div>
            </div>

            {/* ═══ 4-Second Speech Bubble / Text Cloud ═══ */}
            {show4sCloud && isDiagramVisible && (
              <div className="max-w-lg mx-auto w-full mb-3 flex justify-end">
                <div className="bg-white border border-[rgba(92,61,46,0.18)] shadow-xl rounded-xl px-3 py-2 flex items-center gap-3 text-xs z-30 animate-in fade-in slide-in-from-top-2 duration-200">
                  <span className="text-[var(--text-secondary)] font-medium">
                    💡 Do you want to hide this diagram?
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setIsDiagramVisible(false);
                      setShow4sCloud(false);
                      setShowPersistentBar(true);
                      localStorage.setItem("ap2_hide_diagram_pref", "true");
                    }}
                    className="px-2.5 py-1 rounded-lg bg-[var(--brown)] hover:bg-[var(--brown-dark)] text-white font-medium text-[11px] transition-colors cursor-pointer"
                  >
                    Hide
                  </button>
                  <button
                    type="button"
                    onClick={() => setShow4sCloud(false)}
                    className="px-2 py-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] text-[11px] transition-colors cursor-pointer"
                  >
                    Keep
                  </button>
                </div>
              </div>
            )}

            {/* ═══ Non-Timed Persistent Notification Bar ═══ */}
            {showPersistentBar && !isDiagramVisible && (
              <div className="max-w-lg mx-auto w-full mb-4 p-2.5 rounded-xl bg-amber-50/90 border border-amber-200 text-xs text-amber-900 flex items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-2">
                  <span>Visual diagram is hidden.</span>
                  <label className="flex items-center gap-1.5 text-[11px] text-amber-800 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={dontAskAgain}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setDontAskAgain(checked);
                        if (checked) {
                          localStorage.setItem("ap2_dont_ask_hide_diagram", "true");
                          localStorage.setItem("ap2_hide_diagram_pref", "true");
                        } else {
                          localStorage.removeItem("ap2_dont_ask_hide_diagram");
                          localStorage.removeItem("ap2_hide_diagram_pref");
                        }
                      }}
                      className="rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                    />
                    <span>Do not ask me this again</span>
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsDiagramVisible(true)}
                    className="text-[11px] font-medium underline text-amber-900 hover:text-amber-950 cursor-pointer"
                  >
                    Show Diagram
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPersistentBar(false)}
                    className="p-1 text-amber-600 hover:text-amber-800 rounded-md cursor-pointer"
                    title="Close notification"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* Intent & Rate Display */}
            {rawIntent && (
              <div className="max-w-lg mx-auto w-full mb-4 px-4 py-3 rounded-xl bg-[var(--brown-faint)] text-sm text-[var(--text-secondary)] flex items-center justify-between">
                <div>
                  <span className="font-semibold text-[var(--brown-dark)]">&ldquo;{rawIntent}&rdquo;</span>
                  {detectedStaple && !hideRateRequested && (
                    <span className="block text-xs font-mono text-emerald-700 mt-0.5">
                      Rate: ₹{detectedStaple.unitRateInr}.00 / {detectedStaple.unitLabel}
                    </span>
                  )}
                </div>
                <span className="text-xs font-mono text-[var(--text-faint)] shrink-0 ml-2">
                  Budget: ₹{maxSpendInr.toLocaleString("en-IN")}
                </span>
              </div>
            )}

            {/* ═══ Diagram Rendering: Visual or Simplified Executive ═══ */}
            {isDiagramVisible ? (
              <VerticalPipeline
                stages={stages}
                failureExplanation={failureExplanation}
                liveThoughts={liveThoughts}
              />
            ) : (
              /* Compact Executive Order Card when Diagram is Hidden */
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-lg mx-auto w-full space-y-4"
              >
                <div className="card p-5 space-y-4 shadow-sm border border-[rgba(92,61,46,0.12)] bg-white">
                  <div className="flex items-center justify-between border-b border-[rgba(92,61,46,0.06)] pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-[var(--brown-dark)]">Purchase Order Summary</h4>
                        <span className="text-[11px] text-[var(--text-muted)] font-mono">
                          Trace: {currentTraceId || "TRC-2026-LIVE"}
                        </span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800">
                      {settlementStage?.status === "success" || (settlementStage as any)?.status === "passed"
                        ? "SETTLED"
                        : "PROCESSING"}
                    </span>
                  </div>

                  {/* Summary Details */}
                  <div className="space-y-2 text-xs text-[var(--text-secondary)]">
                    <div className="flex justify-between py-1 border-b border-[rgba(92,61,46,0.04)]">
                      <span className="text-[var(--text-muted)]">Order Intent:</span>
                      <span className="font-semibold text-[var(--brown-dark)]">{rawIntent}</span>
                    </div>
                    {detectedStaple && !hideRateRequested && (
                      <div className="flex justify-between py-1 border-b border-[rgba(92,61,46,0.04)]">
                        <span className="text-[var(--text-muted)]">Catalog Unit Rate:</span>
                        <span className="font-mono text-emerald-700 font-medium">
                          ₹{detectedStaple.unitRateInr}.00 / {detectedStaple.unitLabel}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between py-1 border-b border-[rgba(92,61,46,0.04)]">
                      <span className="text-[var(--text-muted)]">Security Clearance:</span>
                      <span className="text-emerald-700 font-medium flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>ES256 Mandate Signed · RFC 8785 Verified</span>
                      </span>
                    </div>
                    <div className="flex justify-between py-1 font-semibold text-sm pt-2">
                      <span>Settlement Amount:</span>
                      <span className="font-mono text-emerald-800">
                        ₹{settlementStage?.data?.total_inr ? Number(settlementStage.data.total_inr).toFixed(2) : maxSpendInr.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* If Settlement Complete, Show prominent Razorpay Payment Button */}
                  {(settlementStage?.status === "success" || (settlementStage as any)?.status === "passed") && (() => {
                    const stageData = settlementStage?.data || {};
                    const rzpOrderId = typeof stageData.razorpay_order_id === "string" ? stageData.razorpay_order_id : "order_test_demo";
                    const amountPaise = Number(
                      stageData.total_price_paise ||
                      Number(stageData.total_inr || maxSpendInr) * 100
                    );
                    const keyId = typeof stageData.razorpay_key_id === "string" ? stageData.razorpay_key_id : "rzp_test_TXG9px2n22l1sG";

                    return (
                      <div className="pt-2 border-t border-[rgba(92,61,46,0.06)] space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-emerald-900 font-medium">Standard Web Checkout (S2S)</span>
                          <span className="font-mono text-[10px] text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                            {rzpOrderId}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (typeof window !== "undefined" && (window as any).Razorpay) {
                              const options: any = {
                                key: keyId,
                                amount: amountPaise,
                                currency: "INR",
                                name: "AP2 Agentic Commerce Bridge",
                                description: "Governed Purchase Settlement (Razorpay Test Mode)",
                                prefill: {
                                  name: "Rohit Chauhan",
                                  email: "buyer@ap2bridge.dev",
                                  contact: "9999999999",
                                },
                                theme: { color: "#059669" },
                                handler: (res: any) => {
                                  alert(`Payment successfully completed in Razorpay! Payment ID: ${res.razorpay_payment_id}`);
                                },
                              };
                              if (rzpOrderId && !rzpOrderId.startsWith("order_test_")) {
                                options.order_id = rzpOrderId;
                              }
                              const rzp = new (window as any).Razorpay(options);
                              rzp.open();
                            } else {
                              alert("Razorpay Checkout SDK is still loading. Please retry in a moment.");
                            }
                          }}
                          className="w-full py-2.5 px-4 rounded-xl bg-[#059669] hover:bg-[#047857] text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-sm cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99]"
                        >
                          <CreditCard className="w-4 h-4" />
                          <span>Open Razorpay Payment Modal</span>
                          <ExternalLink className="w-3.5 h-3.5 opacity-90" />
                        </button>
                      </div>
                    );
                  })()}
                </div>

                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => setIsDiagramVisible(true)}
                    className="text-xs text-[var(--brown)] hover:underline inline-flex items-center gap-1.5 cursor-pointer font-medium"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>View 5-Stage Technical Pipeline Diagram</span>
                  </button>
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
