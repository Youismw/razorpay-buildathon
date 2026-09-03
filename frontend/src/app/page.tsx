"use client";

import React, { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { RoleSelector } from "@/components/landing/RoleSelector";
import { BuyerNavbar, BuyerTab } from "@/components/layout/Navbar";
import { SearchView } from "@/components/search/SearchView";
import { CatalogView } from "@/components/catalog/CatalogBrowser";
import { ProfileView } from "@/components/profile/ProfileView";
import { SecurityView } from "@/components/security/InvariantsView";
import { HistoryView } from "@/components/history/TransactionHistory";
import { MandatesView } from "@/components/mandates/MandatesManagerView";
import { AdvancedToolsView } from "@/components/advanced/AdvancedToolsView";
import { SellerDashboard } from "@/components/seller/SellerDashboard";
import { PinPromptModal } from "@/components/shared/PinPromptModal";
import { SetPinModal } from "@/components/shared/SetPinModal";
import { ToastProvider, useToast } from "@/components/shared/ToastContext";
import {
  BuyRequest,
  PipelineStageState,
  Invariant,
  MerchantCatalog,
  TransactionAuditRecord,
} from "@/lib/types";
import {
  checkBackendHealth,
  fetchInvariants,
  fetchCatalog,
  fetchAuditLogs,
  streamBuyIntent,
  getBackendUrl,
} from "@/lib/api";
import {
  UserProfileState,
  DEFAULT_USER_PROFILE,
  loadUserProfile,
  saveUserProfile,
} from "@/lib/profileStore";

const INITIAL_STAGES: PipelineStageState[] = [
  { id: "CONSTRAINT_COMPILATION", name: "1. Compiler", subtitle: "RFC 8785 Hash", status: "idle" },
  { id: "LLM_REASONING", name: "2. Reasoning", subtitle: "AI Deliberation", status: "idle" },
  { id: "GUARDRAIL_SHELL", name: "3. Guardrail", subtitle: "Policy & Grounding", status: "idle" },
  { id: "VAULT_SIGNING", name: "4. Vault", subtitle: "ES256 Signature", status: "idle" },
  { id: "SETTLEMENT", name: "5. Settlement", subtitle: "Razorpay Ledger", status: "idle" },
];

const EXTENDED_CATALOG: Record<string, MerchantCatalog> = {
  "demo-merchant.myshopify.com": {
    manifest_hash: "sha256:demo_manifest_v2_2026",
    products: {
      "PROD-WH-CH520": { name: "Sony WH-CH520 Wireless Headphones", price_paise: 499900, category: "electronics", in_stock: true },
      "PROD-BUDS-XM5": { name: "Sony WF-1000XM5 Noise Canceling Earbuds", price_paise: 1999900, category: "electronics", in_stock: true },
      "PROD-SPK-MINI3": { name: "Anker Soundcore Mini 3 Bluetooth Speaker", price_paise: 99900, category: "audio", in_stock: true },
      "PROD-WATCH-GT4": { name: "Huawei Watch GT 4 (46mm)", price_paise: 1699900, category: "electronics", in_stock: true },
      "PROD-AIR-350": { name: "JBL Tune 350BT On-Ear Headphones", price_paise: 299900, category: "audio", in_stock: true },
      "PROD-SNK-550": { name: "New Balance 550 Sneakers (White/Brown)", price_paise: 1099900, category: "fashion", in_stock: true },
      "PROD-BAG-ROLL": { name: "Samsonite Rolltop Backpack — 22L", price_paise: 399900, category: "fashion", in_stock: true },
      "PROD-SUN-AVIO": { name: "Ray-Ban Aviator Gradient Sunglasses", price_paise: 1199900, category: "fashion", in_stock: false },
      "PROD-COF-V60": { name: "Hario V60 Pour Over Coffee Set", price_paise: 189900, category: "home", in_stock: true },
      "PROD-LAMP-LED": { name: "BenQ ScreenBar Monitor Desk Lamp", price_paise: 899900, category: "home", in_stock: true },
      "PROD-AIR-PUR": { name: "Mi Smart Air Purifier 4 Lite", price_paise: 849900, category: "home", in_stock: true },
      "PROD-BOOK-DDIA": { name: "Designing Data-Intensive Applications", price_paise: 349900, category: "books", in_stock: true },
      // Groceries
      "PROD-MILK-AMUL": { name: "Amul Taaza Homogenised Toned Milk (1L)", price_paise: 7200, category: "groceries", in_stock: true },
      "PROD-MILK-CD": { name: "Country Delight Pure Cow Milk (1L)", price_paise: 8500, category: "groceries", in_stock: true },
      "PROD-MILK-NANDINI": { name: "Nandini Special Pasteurized Milk (1L)", price_paise: 5600, category: "groceries", in_stock: false },
      "PROD-COF-NES": { name: "Nescafé Classic Instant Coffee Jar (100g)", price_paise: 36000, category: "groceries", in_stock: true },
      "PROD-COF-BT": { name: "Blue Tokai Attikan Dark Roast (250g)", price_paise: 47000, category: "groceries", in_stock: true },
      "PROD-ATTA-AASH": { name: "Aashirvaad Superior MP Shudh Atta (5kg)", price_paise: 27500, category: "groceries", in_stock: true },
      "PROD-BRD-BRIT": { name: "Britannia 100% Whole Wheat Bread (400g)", price_paise: 5500, category: "groceries", in_stock: true },
      "PROD-BTR-AMUL": { name: "Amul Pasteurized Salted Butter (500g)", price_paise: 28500, category: "groceries", in_stock: true },
      "PROD-EGG-REG": { name: "Farm Fresh White Eggs (Pack of 6)", price_paise: 4800, category: "groceries", in_stock: true },
    },
  },
};

function AppContent() {
  const [role, setRole] = useState<"none" | "buyer" | "seller">("none");
  const [activeTab, setActiveTab] = useState<BuyerTab>("search");
  const [searchMode, setSearchMode] = useState<"basic" | "advanced">("basic");
  const [stages, setStages] = useState<PipelineStageState[]>(INITIAL_STAGES);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentTraceId, setCurrentTraceId] = useState<string | undefined>();
  const [failureExplanation, setFailureExplanation] = useState<string | undefined>();
  const [liveThoughts, setLiveThoughts] = useState<string[]>([]);
  const [backendOnline, setBackendOnline] = useState(false);
  const [invariants, setInvariants] = useState<Invariant[]>([]);
  const [catalogs, setCatalogs] = useState<Record<string, MerchantCatalog>>(EXTENDED_CATALOG);
  const [transactions, setTransactions] = useState<TransactionAuditRecord[]>([]);
  const [profile, setProfile] = useState<UserProfileState>(DEFAULT_USER_PROFILE);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [isSetPinModalOpen, setIsSetPinModalOpen] = useState(false);
  const [pendingReq, setPendingReq] = useState<BuyRequest | null>(null);
  const { showToast } = useToast();

  // Load user profile & backend data
  useEffect(() => {
    setProfile(loadUserProfile());

    async function initData() {
      const health = await checkBackendHealth();
      setBackendOnline(health.online);
      const invs = await fetchInvariants();
      setInvariants(invs);
      try {
        const cat = await fetchCatalog();
        if (Object.keys(cat).length > 0) setCatalogs(cat);
      } catch { /* use extended fallback */ }
      const logs = await fetchAuditLogs();
      setTransactions(logs);
    }
    initData();
  }, []);

  // Refetch universal catalog whenever switching to Catalog tab or returning from Seller portal
  useEffect(() => {
    if (activeTab === "catalog" || role === "none" || role === "buyer") {
      fetchCatalog()
        .then((cat) => {
          if (Object.keys(cat).length > 0) setCatalogs(cat);
        })
        .catch(() => {});
    }
  }, [activeTab, role]);

  const updateStage = useCallback(
    (stageId: string, update: Partial<PipelineStageState>) => {
      setStages((prev) =>
        prev.map((s) => (s.id === stageId ? { ...s, ...update } : s))
      );
    },
    []
  );

  const executePipelineStream = useCallback(
    async (req: BuyRequest) => {
      setStages(INITIAL_STAGES);
      setIsStreaming(true);
      setFailureExplanation(undefined);
      setCurrentTraceId(undefined);
      setLiveThoughts([]);

      const stageOrder = [
        "CONSTRAINT_COMPILATION",
        "LLM_REASONING",
        "GUARDRAIL_SHELL",
        "VAULT_SIGNING",
        "SETTLEMENT",
      ];
      let currentStageIndex = 0;

      // Start first stage
      updateStage(stageOrder[0], { status: "running" });

      await streamBuyIntent(req, {
        onInit: ({ trace_id }) => {
          setCurrentTraceId(trace_id);
        },
        onThought: (_stepIndex, text) => {
          setLiveThoughts((prev) => [...prev, text]);
        },
        onStageComplete: (stage, data) => {
          updateStage(stage, { status: "success", data });
          currentStageIndex = stageOrder.indexOf(stage) + 1;
          if (currentStageIndex < stageOrder.length) {
            updateStage(stageOrder[currentStageIndex], { status: "running" });
          }
        },
        onStageFailed: (stage, error, data) => {
          setStages((prev) =>
            prev.map((s) => {
              if (s.id === stage) return { ...s, status: "failed", error, data: data || s.data };
              if (s.status === "running" && s.id !== stage) return { ...s, status: "idle" };
              return s;
            })
          );
          setFailureExplanation(
            `Stage [${stage}] failed: ${error}. The pipeline has been halted. No payment was authorized.`
          );
          setIsStreaming(false);
          showToast("Pipeline Rejected", `${stage}: ${error}`, "error");
        },
        onFinalStatus: (status, data) => {
          setIsStreaming(false);
          if (status === "SUCCESS") {
            showToast("Purchase Settled", "All 5 pipeline stages passed successfully.", "success");
          } else {
            setStages((prev) => {
              const hasFailed = prev.some((s) => s.status === "failed" || s.status === "escalated");
              if (!hasFailed) {
                return prev.map((s) =>
                  s.status === "running"
                    ? { ...s, status: "failed", error: String(data.error || "Policy Blocked") }
                    : s
                );
              }
              return prev;
            });
            const explanation = String(
              data.error || data.reason || `Pipeline ended with status: ${status}. Zero unsupervised money movement.`
            );
            setFailureExplanation((prev) => prev || explanation);
            showToast("Flow Blocked", `Status: ${status}`, "warning");
          }
          const newRecord: TransactionAuditRecord = {
            trace_id: String(data.trace_id || currentTraceId || `trace-${Date.now()}`),
            timestamp: new Date().toISOString(),
            status,
            decision: String(data.decision || status),
            raw_intent: req.raw_intent,
            total_price_paise: Number(data.total_price_paise || 0),
            total_amount_inr: Number(data.total_price_paise || 0) / 100,
            confidence_score: Number(data.confidence_score || 0),
          };

          setTransactions((prev) => {
            const filtered = prev.filter((t) => t.trace_id !== newRecord.trace_id);
            return [newRecord, ...filtered];
          });

          // Refresh universal catalog inventory in real-time
          fetchCatalog().then((cat) => {
            if (Object.keys(cat).length > 0) setCatalogs(cat);
          }).catch(() => {});
        },
        onError: (stage, error) => {
          setStages((prev) =>
            prev.map((s) =>
              s.status === "running" ? { ...s, status: "failed", error } : s
            )
          );
          setFailureExplanation(
            `Stage [${stage}] failed: ${error}. The pipeline has been halted. No payment was authorized.`
          );
          setIsStreaming(false);
          showToast("Pipeline Error", `${stage}: ${error}`, "error");
        },
      });
    },
    [updateStage, showToast, currentTraceId]
  );

  const handleExecute = useCallback(
    (req: BuyRequest) => {
      // If PIN confirmation is required, prompt user before executing settlement
      if (profile.autonomyMode === "pin_required" && !req.simulate_failure_stage) {
        setPendingReq(req);
        setIsPinModalOpen(true);
      } else {
        executePipelineStream(req);
      }
    },
    [profile.autonomyMode, executePipelineStream]
  );

  const handlePinSuccess = () => {
    setIsPinModalOpen(false);
    if (pendingReq) {
      executePipelineStream(pendingReq);
      setPendingReq(null);
    }
  };

  const handleReset = useCallback(() => {
    setStages(INITIAL_STAGES);
    setIsStreaming(false);
    setCurrentTraceId(undefined);
    setFailureExplanation(undefined);
  }, []);

  const handleBuyFromCatalog = useCallback(
    (productName: string, priceInr: number, merchantId: string) => {
      setActiveTab("search");
      // Respect user's configured Max Transaction Limit from Profile
      handleExecute({
        raw_intent: `Buy ${productName}`,
        max_spend_inr: profile.maxTransactionLimitInr,
        allowed_merchants: [merchantId],
        validity_hours: 24,
        llm_provider: "mock",
      });
    },
    [handleExecute, profile.maxTransactionLimitInr]
  );

  // ═══ Render ═══
  if (role === "none") {
    return <RoleSelector onSelectRole={setRole} />;
  }

  if (role === "seller") {
    return <SellerDashboard onBack={() => setRole("none")} />;
  }

  return (
    <div className="min-h-screen relative flex flex-col bg-[var(--bg-main)]">
      {/* Background artwork */}
      <div className="fixed inset-0 opacity-[0.10] mix-blend-multiply pointer-events-none z-0">
        <Image src="/buyer-bg.jpg" alt="" fill sizes="100vw" className="object-cover" priority />
      </div>

      <BuyerNavbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        searchMode={searchMode}
        onToggleSearchMode={() => setSearchMode((m) => (m === "basic" ? "advanced" : "basic"))}
        onBack={() => setRole("none")}
        backendOnline={backendOnline}
        autonomyMode={profile.autonomyMode}
        onToggleAutonomyMode={() => {
          if (profile.autonomyMode === "autonomous") {
            // Prompt user to choose and set their password before entering manual mode
            setIsSetPinModalOpen(true);
          } else {
            const updated: UserProfileState = { ...profile, autonomyMode: "autonomous" };
            setProfile(updated);
            saveUserProfile(updated);
            showToast("Autonomous AI Enabled", "Transactions settle automatically via UPI Autopay", "info");
          }
        }}
      />

      {!backendOnline && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-1.5 text-xs flex items-center justify-between text-amber-900 z-30 relative backdrop-blur-xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span>
              Backend Disconnected. Target: <strong className="font-mono text-amber-950">{getBackendUrl()}</strong>
            </span>
          </div>
          <button
            onClick={() => {
              const current = getBackendUrl();
              const url = prompt("Enter your Render Backend URL (e.g. https://your-backend.onrender.com):", current);
              if (url && url.trim()) {
                localStorage.setItem("ap2_backend_url", url.trim());
                window.location.reload();
              }
            }}
            className="px-2 py-0.5 rounded bg-amber-200/80 hover:bg-amber-300 text-amber-950 font-medium text-[11px] transition-colors cursor-pointer"
          >
            Configure Backend URL
          </button>
        </div>
      )}

      <main className="flex-1 relative z-10 flex flex-col min-h-0 w-full">
        {activeTab === "search" && (
          <SearchView
            stages={stages}
            isStreaming={isStreaming}
            currentTraceId={currentTraceId}
            failureExplanation={failureExplanation}
            liveThoughts={liveThoughts}
            searchMode={searchMode}
            profile={profile}
            onExecute={handleExecute}
            onReset={handleReset}
          />
        )}
        {activeTab === "catalog" && (
          <CatalogView catalogs={catalogs} onBuyItem={handleBuyFromCatalog} />
        )}
        {activeTab === "profile" && (
          <ProfileView
            profile={profile}
            onUpdateProfile={(updated) => setProfile(updated)}
            onShowToast={showToast}
          />
        )}
        {activeTab === "security" && <SecurityView invariants={invariants} />}
        {activeTab === "history" && (
          <HistoryView
            transactions={transactions}
            onSelectTransaction={(tx) => showToast("Trace Selected", tx.trace_id, "info")}
          />
        )}
        {activeTab === "mandates" && <MandatesView />}
        {activeTab === "advanced" && <AdvancedToolsView />}
      </main>

      {/* UPI PIN Confirmation Modal */}
      <PinPromptModal
        isOpen={isPinModalOpen}
        expectedPin={profile.userPin || "1234"}
        totalAmountInr={pendingReq?.max_spend_inr || 0}
        rawIntent={pendingReq?.raw_intent || ""}
        onSuccess={handlePinSuccess}
        onCancel={() => {
          setIsPinModalOpen(false);
          setPendingReq(null);
        }}
      />

      {/* Set Password / PIN Modal when switching to Manual Mode */}
      <SetPinModal
        isOpen={isSetPinModalOpen}
        onSave={(newPin) => {
          const updated: UserProfileState = { ...profile, autonomyMode: "pin_required", userPin: newPin };
          setProfile(updated);
          saveUserProfile(updated);
          setIsSetPinModalOpen(false);
          showToast("Manual Mode Enabled", "PIN successfully set! All transactions will require this PIN.", "success");
        }}
        onCancel={() => setIsSetPinModalOpen(false)}
      />
    </div>
  );
}

export default function Home() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}
