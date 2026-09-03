"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PipelineStageState } from "@/lib/types";
import {
  AlertOctagon,
  CheckCircle2,
  ShieldAlert,
  CreditCard,
  ExternalLink,
  Sparkles,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { verifyRazorpayPayment } from "@/lib/api";

interface VerticalPipelineProps {
  stages: PipelineStageState[];
  failureExplanation?: string;
  liveThoughts?: string[];
}

interface FriendlyErrorInfo {
  title: string;
  summary: string;
  action: string;
  invariantBadge: string;
  technicalDetails: string;
}

function formatHumanFriendlyError(rawError: string, stageId: string): FriendlyErrorInfo {
  const err = (rawError || "").trim();
  const lower = err.toLowerCase();

  // 1. Mandate Revocation (INV-004)
  if (
    lower.includes("mandate_revoked") ||
    lower.includes("revoked") ||
    lower.includes("inv-004") ||
    lower.includes("403")
  ) {
    return {
      title: "Payment Mandate Revoked",
      summary:
        "The payment authorization mandate was revoked before settlement could occur. Your account was not charged and your funds remain completely safe.",
      action: "To proceed, issue a new purchase request or renew your merchant payment mandate.",
      invariantBadge: "INV-004 · Atomic Revocation Priority",
      technicalDetails:
        err || "403 MANDATE_REVOKED: Mandate was revoked prior to settlement (Atomic Lock INV-004).",
    };
  }

  // 2. Cryptographic Key Mismatch / Vault Signing (INV-009 / INV-008)
  if (
    lower.includes("es256") ||
    lower.includes("key mismatch") ||
    lower.includes("cryptographic integrity") ||
    lower.includes("inv-009") ||
    lower.includes("inv-008") ||
    stageId === "VAULT_SIGNING"
  ) {
    return {
      title: "Cryptographic Security Check Triggered",
      summary:
        "The hardware-isolated security vault detected an integrity failure or mismatched cryptographic key. The transaction was instantly aborted to prevent unauthorized funds transfer.",
      action: "Your wallet is secure. No authorization token was signed or dispatched.",
      invariantBadge: "INV-009 / INV-008 · ECDSA Non-Exportability & Canonical Hash",
      technicalDetails:
        err ||
        "Vault Signing Error: Cryptographic integrity failure: ES256 key mismatch / adversarial security gate block.",
    };
  }

  // 3. Ambiguous / Unintelligible Request (Stage 1 / Stage 2)
  if (
    lower.includes("ambiguous") ||
    lower.includes("elaborate") ||
    lower.includes("clarify") ||
    lower.includes("unintelligible") ||
    lower.includes("gibberish") ||
    err.startsWith("Ambiguous Request: ")
  ) {
    const cleanReason = err.startsWith("Ambiguous Request: ")
      ? err.replace("Ambiguous Request: ", "")
      : "";

    return {
      title: "Please Elaborate on Your Request",
      summary:
        cleanReason ||
        "The request does not describe a recognizable product or shopping category. Please clarify what you are looking to purchase.",
      action: "Try specifying an item name, brand, or category (e.g., 'Buy wireless headphones under ₹5,000' or 'Order groceries').",
      invariantBadge: "INTENT · Natural Language Disambiguation",
      technicalDetails:
        err || "Reasoning Core: Unintelligible or ambiguous natural language query.",
    };
  }

  // 4. Reasoning / Product Not Found in Catalog (Stage 2)
  if (
    stageId === "LLM_REASONING" ||
    lower.includes("not found") ||
    lower.includes("no matching product") ||
    lower.includes("no in-stock product") ||
    lower.includes("ungrounded") ||
    lower.includes("prod-not-found") ||
    lower.includes("product not found") ||
    lower.includes("reasoning failure") ||
    lower.includes("zero candidate") ||
    lower.includes("zero matching")
  ) {
    const cleanReason = err.startsWith("Product Not Found: ")
      ? err.replace("Product Not Found: ", "")
      : err.startsWith("Reasoning Intercept: ")
      ? err.replace("Reasoning Intercept: ", "")
      : "";

    return {
      title: "No Matching Product in Catalog",
      summary:
        cleanReason ||
        "The AI reasoning agent searched registered merchant catalogs and inventories, but found no verified product matching your request.",
      action: "Check the Catalog tab to see available products (e.g., Electronics, Audio, Groceries) or ask the merchant to list this SKU.",
      invariantBadge: "GROUNDING · Grounding Oracle Gate",
      technicalDetails:
        err || "Reasoning Core: No verifiable catalog candidate found matching prompt constraints.",
    };
  }

  // 4. Policy Ceiling Breach / Budget Overspend (INV-010)
  if (
    lower.includes("ceiling") ||
    lower.includes("spend_exceeded") ||
    lower.includes("inv-010") ||
    (stageId === "GUARDRAIL_SHELL" && (lower.includes("budget") || lower.includes("spend") || lower.includes("limit")))
  ) {
    return {
      title: "Transaction Exceeds Spending Ceiling",
      summary:
        "The purchase price exceeds the maximum single-order budget ceiling configured in your Autonomous Buyer Policy.",
      action: "Increase your transaction spend limit in the Buyer Profile tab or choose a lower-priced item.",
      invariantBadge: "INV-010 · Autonomous Spend Ceiling Gate",
      technicalDetails:
        err || "Guardrail Block: Proposed amount exceeds user-configured maximum single transaction ceiling.",
    };
  }

  // 5. Merchant Scope Unauthorized (INV-002)
  if (
    lower.includes("merchant") ||
    lower.includes("scope") ||
    lower.includes("unauthorized") ||
    lower.includes("whitelist")
  ) {
    return {
      title: "Merchant Not In Approved Directory",
      summary:
        "This vendor is not part of your pre-authorized merchant whitelist. Unsupervised money movement to unverified sellers is prohibited.",
      action: "Add this seller to your approved merchant list in Security Governance to enable purchases.",
      invariantBadge: "INV-002 · Mandatory Guardrail Shell Gate",
      technicalDetails: err || "Guardrail Block: Merchant not authorized within buyer mandate scope.",
    };
  }

  // 6. Short or Ambiguous Intent (Stage 1)
  if (
    stageId === "CONSTRAINT_COMPILATION" ||
    lower.includes("compiler") ||
    lower.includes("intent") ||
    lower.includes("short")
  ) {
    return {
      title: "Ambiguous Purchase Request",
      summary:
        "The request could not be compiled into a strict deterministic contract. Autonomous agents require clear item descriptions and price constraints.",
      action: "Try a clear query like: 'Buy Sony WH-CH520 headphones under ₹5,000'.",
      invariantBadge: "RFC 8785 · Canonical Constraint Compiler",
      technicalDetails:
        err || "Compiler Rejection: Buyer intent string too short or lacks unambiguous target entity.",
    };
  }

  // 7. General Fallback
  return {
    title: "Security Gate Enforced — Zero Unsupervised Money Movement",
    summary:
      "The transaction was intercepted and safely halted by the deterministic security gate before payment authorization.",
    action: "Review your purchase parameters and retry.",
    invariantBadge: "DETERMINISTIC SANDWICH · Fail-Closed Invariant",
    technicalDetails: err || "Security gate triggered: zero unsupervised money movement invariant enforced.",
  };
}

const STAGE_COLORS: Record<string, { bg: string; text: string; lightBg: string; border: string }> = {
  CONSTRAINT_COMPILATION: {
    bg: "#2563EB",
    text: "#FFFFFF",
    lightBg: "rgba(37, 99, 235, 0.08)",
    border: "rgba(37, 99, 235, 0.35)",
  },
  LLM_REASONING: {
    bg: "#D97706",
    text: "#FFFFFF",
    lightBg: "rgba(217, 119, 6, 0.08)",
    border: "rgba(217, 119, 6, 0.35)",
  },
  GUARDRAIL_SHELL: {
    bg: "#EA580C",
    text: "#FFFFFF",
    lightBg: "rgba(234, 88, 12, 0.08)",
    border: "rgba(234, 88, 12, 0.35)",
  },
  VAULT_SIGNING: {
    bg: "#7C3AED",
    text: "#FFFFFF",
    lightBg: "rgba(124, 58, 237, 0.08)",
    border: "rgba(124, 58, 237, 0.35)",
  },
  SETTLEMENT: {
    bg: "#059669",
    text: "#FFFFFF",
    lightBg: "rgba(5, 150, 105, 0.08)",
    border: "rgba(5, 150, 105, 0.35)",
  },
};

const STAGE_LABELS: Record<string, { title: string; sub: string }> = {
  CONSTRAINT_COMPILATION: { title: "1. Constraint Compiler", sub: "RFC 8785 canonical hash & schema strictness" },
  LLM_REASONING: { title: "2. AI Reasoning Core", sub: "Candidate evaluation & probabilistic proposal" },
  GUARDRAIL_SHELL: { title: "3. Guardrail Shell", sub: "Deterministic gate · Policy INV-010 · Grounding" },
  VAULT_SIGNING: { title: "4. Mandate Vault", sub: "ES256 ECDSA cryptographic payload signature" },
  SETTLEMENT: { title: "5. Razorpay Settlement", sub: "UPI Autopay immutable ledger finalization" },
};

export const VerticalPipeline: React.FC<VerticalPipelineProps> = ({
  stages,
  failureExplanation,
  liveThoughts,
}) => {
  const [expandedErrorStage, setExpandedErrorStage] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<
    Record<string, { status: "idle" | "verifying" | "success" | "failed"; paymentId?: string; error?: string }>
  >({});

  const handleOpenRazorpayCheckout = (orderId: string, amountPaise: number, keyId?: string) => {
    if (typeof window === "undefined" || !(window as any).Razorpay) {
      alert("Razorpay Checkout SDK is still loading. Please retry in a few seconds.");
      return;
    }

    const razorpayKey = keyId || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "rzp_test_TXG9px2n22l1sG";

    const options = {
      key: razorpayKey,
      amount: amountPaise,
      currency: "INR",
      name: "AP2 Agentic Commerce Bridge",
      description: "Governed Purchase Settlement (Razorpay Test Mode)",
      order_id: orderId,
      prefill: {
        name: "Rohit Chauhan",
        email: "buyer@ap2bridge.dev",
        contact: "9999999999",
      },
      theme: {
        color: "#059669",
      },
      modal: {
        ondismiss: function () {
          console.log("Razorpay modal dismissed by user");
        },
      },
      handler: async function (response: any) {
        setPaymentStatus((prev) => ({
          ...prev,
          [orderId]: { status: "verifying" },
        }));
        try {
          const verifyRes = await verifyRazorpayPayment({
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
          });
          if (verifyRes.status === "success") {
            setPaymentStatus((prev) => ({
              ...prev,
              [orderId]: { status: "success", paymentId: response.razorpay_payment_id },
            }));
          } else {
            setPaymentStatus((prev) => ({
              ...prev,
              [orderId]: { status: "failed", error: "Signature verification failed" },
            }));
          }
        } catch (err: any) {
          setPaymentStatus((prev) => ({
            ...prev,
            [orderId]: { status: "failed", error: err.message || "Verification request failed" },
          }));
        }
      },
    };

    const rzpInstance = new (window as any).Razorpay(options);
    rzpInstance.open();
  };

  const lastAutoLaunchedOrder = useRef<string | null>(null);
  useEffect(() => {
    const settlementStage = stages.find((s) => s.id === "SETTLEMENT" && ((s as any).status === "passed" || (s as any).status === "success"));
    if (settlementStage?.data?.razorpay_order_id) {
      const orderId = String(settlementStage.data.razorpay_order_id);
      if (lastAutoLaunchedOrder.current !== orderId) {
        lastAutoLaunchedOrder.current = orderId;
        const amountPaise = Number(settlementStage.data.total_price_paise || (Number(settlementStage.data.total_inr || 0) * 100));
        const keyId = typeof settlementStage.data.razorpay_key_id === "string" ? settlementStage.data.razorpay_key_id : undefined;
        const timer = setTimeout(() => {
          handleOpenRazorpayCheckout(orderId, amountPaise, keyId);
        }, 700);
        return () => clearTimeout(timer);
      }
    }
  }, [stages]);

  return (
    <div className="flex flex-col items-center w-full max-w-lg mx-auto py-8 space-y-0 relative">
      {stages.map((stage, idx) => {
        const isActive = stage.status === "running";
        const isComplete = stage.status === "success";
        const isFailed = stage.status === "failed" || stage.status === "escalated";
        const isIdle = stage.status === "idle";
        const colorConfig = STAGE_COLORS[stage.id] || {
          bg: "#5C3D2E",
          text: "#FFFFFF",
          lightBg: "rgba(92, 61, 46, 0.08)",
          border: "rgba(92, 61, 46, 0.2)",
        };
        const labels = STAGE_LABELS[stage.id] || { title: stage.name, sub: stage.subtitle };
        const isLast = idx === stages.length - 1;

        return (
          <div key={stage.id} className="flex flex-col items-center w-full relative">
            {/* Stage Box Container */}
            <div className="w-full relative flex items-center justify-center">
              {/* Shockwave Burst Ring for Failure */}
              {isFailed && (
                <motion.div
                  initial={{ scale: 0.95, opacity: 0.9 }}
                  animate={{ scale: 1.35, opacity: 0 }}
                  transition={{ duration: 0.9, repeat: Infinity, ease: "easeOut" }}
                  className="absolute inset-0 rounded-2xl bg-red-500/40 pointer-events-none z-0"
                />
              )}

              {/* Glowing Pulse Halo for Active Stage */}
              {isActive && (
                <motion.div
                  animate={{
                    opacity: [0.35, 0.75, 0.35],
                    scale: [1, 1.05, 1],
                  }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute -inset-1 rounded-2xl blur-md pointer-events-none z-0"
                  style={{ background: colorConfig.bg }}
                />
              )}

              {/* Main Swelling / Bursting Stage Box */}
              <motion.div
                className="w-full relative overflow-hidden transition-colors z-10"
                initial={false}
                animate={
                  isFailed
                    ? {
                        scale: [1, 1.22, 0.94, 1.08, 1],
                        rotate: [0, -3, 3, -2, 2, 0],
                        borderRadius: "16px",
                      }
                    : isActive
                    ? {
                        scale: 1.12,
                        y: -3,
                        borderRadius: "18px",
                      }
                    : {
                        scale: 1,
                        y: 0,
                        borderRadius: "12px",
                      }
                }
                transition={
                  isFailed
                    ? { duration: 0.65, times: [0, 0.2, 0.4, 0.7, 1], ease: "easeOut" }
                    : { type: "spring", stiffness: 350, damping: 22 }
                }
                style={{
                  background: isFailed
                    ? "#DC2626"
                    : isActive
                    ? colorConfig.bg
                    : isComplete
                    ? colorConfig.lightBg
                    : "var(--bg-card)",
                  border: isFailed
                    ? "2px solid #EF4444"
                    : isActive
                    ? `2px solid #FFFFFF`
                    : isComplete
                    ? `1.5px solid ${colorConfig.border}`
                    : "1px solid rgba(92, 61, 46, 0.08)",
                  boxShadow: isFailed
                    ? "0 14px 35px rgba(220, 38, 38, 0.6), 0 0 25px rgba(239, 68, 68, 0.5)"
                    : isActive
                    ? `0 14px 36px -4px ${colorConfig.bg}80, 0 0 20px ${colorConfig.bg}50`
                    : "none",
                  color: isActive || isFailed ? "#FFFFFF" : "var(--text-primary)",
                }}
              >
                <div className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className="text-xs font-mono font-bold"
                          style={{
                            color: isActive || isFailed ? "rgba(255,255,255,0.8)" : "var(--text-faint)",
                          }}
                        >
                          0{idx + 1}
                        </span>
                        <span className={`text-sm font-semibold tracking-wide ${isActive || isFailed ? "text-white" : ""}`}>
                          {labels.title}
                        </span>
                        {isActive && (
                          <span className="px-2 py-0.5 rounded-full bg-white/25 text-[10px] font-mono uppercase font-bold text-white tracking-wider animate-pulse">
                            Processing
                          </span>
                        )}
                        {isFailed && (
                          <span className="px-2 py-0.5 rounded-full bg-white/30 text-[10px] font-mono uppercase font-bold text-white tracking-wider">
                            Halted
                          </span>
                        )}
                      </div>
                      <p
                        className="text-xs mt-1 leading-snug"
                        style={{
                          color: isActive || isFailed ? "rgba(255,255,255,0.88)" : "var(--text-muted)",
                        }}
                      >
                        {labels.sub}
                      </p>
                    </div>

                    {/* Status Indicator Icon */}
                    <div className="flex items-center shrink-0 ml-3">
                      {isActive && (
                        <div className="w-6 h-6 rounded-full border-2 border-white border-t-transparent animate-spin" />
                      )}
                      {isComplete && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="w-7 h-7 rounded-full flex items-center justify-center bg-white shadow-sm"
                        >
                          <CheckCircle2 className="w-4 h-4" style={{ color: colorConfig.bg }} />
                        </motion.div>
                      )}
                      {isFailed && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="w-7 h-7 rounded-full bg-white flex items-center justify-center shadow-lg"
                        >
                          <AlertOctagon className="w-4 h-4 text-red-600" />
                        </motion.div>
                      )}
                      {isIdle && (
                        <div className="w-5 h-5 rounded-full border border-[rgba(92,61,46,0.2)]" />
                      )}
                    </div>
                  </div>

                  {/* Live Thought Stream during AI Deliberation */}
                  {isActive && stage.id === "LLM_REASONING" && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="mt-3 p-3 rounded-xl bg-amber-500/20 border border-white/20 text-xs text-white space-y-1.5 backdrop-blur-sm"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 font-bold text-white">
                          <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-spin" />
                          <span>Gemini 3.5 Flash Deliberation</span>
                        </div>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/20 text-amber-100 uppercase tracking-wider">
                          Live Reasoning
                        </span>
                      </div>
                      {liveThoughts && liveThoughts.length > 0 ? (
                        <div className="space-y-1 pt-1">
                          {liveThoughts.map((thought, tIdx) => (
                            <div
                              key={tIdx}
                              className="flex items-start gap-1.5 text-[11px] font-mono text-white/90 pl-2 border-l-2 border-amber-300"
                            >
                              <span className="font-bold text-amber-300">{tIdx + 1}.</span>
                              <span>{thought}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[11px] text-amber-100 italic">
                          Grounding intent against merchant catalogs & inventory constraints...
                        </p>
                      )}
                    </motion.div>
                  )}

                  {/* Inline Stage Data when Completed */}
                  {isComplete && stage.data && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      transition={{ duration: 0.3 }}
                      className="mt-3 pt-3 border-t text-xs font-mono space-y-1"
                      style={{ borderColor: colorConfig.border, color: "var(--text-secondary)" }}
                    >
                      {stage.id === "CONSTRAINT_COMPILATION" && stage.data.constraint_hash != null && (
                        <div className="truncate">Hash: {String(stage.data.constraint_hash).slice(0, 32)}...</div>
                      )}
                      {stage.id === "LLM_REASONING" && (
                        <div className="space-y-2 pt-1">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-semibold text-amber-900 flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                              <span>Deliberation: {String(stage.data?.provider || "Gemini 3.5 Flash")}</span>
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-mono">
                              4-STEP REASONING
                            </span>
                          </div>
                          {(() => {
                            const steps =
                              (Array.isArray(stage.data.thought_steps) && stage.data.thought_steps.length > 0
                                ? stage.data.thought_steps
                                : liveThoughts && liveThoughts.length > 0
                                ? liveThoughts
                                : [
                                    "Extracted product candidate entity from buyer intent query",
                                    "Verified merchant catalog grounding and inventory availability",
                                    "Calculated total settlement with delivery and tax",
                                    "Synthesized strict JSON purchase proposal for Guardrail Shell",
                                  ]) as string[];
                            return (
                              <div className="space-y-1 pt-1">
                                {steps.map((step: string, sIdx: number) => (
                                  <div
                                    key={sIdx}
                                    className="flex items-start gap-1.5 text-[11px] font-mono text-[var(--text-secondary)] pl-2 border-l-2 border-amber-400/60"
                                  >
                                    <span className="text-amber-600 font-bold shrink-0">{sIdx + 1}.</span>
                                    <span className="text-[var(--text-primary)]">{step}</span>
                                  </div>
                                ))}
                              </div>
                            );
                          })()}
                        </div>
                      )}
                      {stage.id === "GUARDRAIL_SHELL" && (
                        <div className="flex items-center gap-3">
                          <span>Decision: {String(stage.data.decision ?? "APPROVED")}</span>
                          <span>Confidence: {String(stage.data.confidence_score ?? "1.00")}</span>
                        </div>
                      )}
                      {stage.id === "VAULT_SIGNING" && stage.data.mandate_id != null && (
                        <div>Mandate: {String(stage.data.mandate_id)} (ES256)</div>
                      )}
                      {stage.id === "SETTLEMENT" && stage.data.total_inr != null && (() => {
                        const rzpOrderId = typeof stage.data.razorpay_order_id === "string" ? stage.data.razorpay_order_id : null;
                        const rzpKeyId = typeof stage.data.razorpay_key_id === "string" ? stage.data.razorpay_key_id : undefined;
                        const amountPaise = Number(stage.data.total_price_paise || Number(stage.data.total_inr) * 100);

                        return (
                          <div className="space-y-2 pt-1">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-emerald-700 tabular-nums">
                                Settled: ₹{Number(stage.data.total_inr).toFixed(2)} via UPI Autopay
                              </span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-mono">
                                AUTOPAY ACTIVE
                              </span>
                            </div>

                            {rzpOrderId ? (
                              <div className="mt-2 p-2.5 rounded-lg bg-emerald-50/80 border border-emerald-200 text-xs font-sans space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-emerald-900 font-medium">Standard Web Checkout (S2S)</span>
                                  <span className="font-mono text-[10px] text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                                    {rzpOrderId}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleOpenRazorpayCheckout(rzpOrderId, amountPaise, rzpKeyId)}
                                  className="w-full py-1.5 px-3 rounded-lg bg-[#059669] hover:bg-[#047857] text-white font-medium text-xs flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                                >
                                  <CreditCard className="w-3.5 h-3.5" />
                                  <span>Open Razorpay Payment Modal</span>
                                  <ExternalLink className="w-3 h-3 ml-0.5 opacity-80" />
                                </button>

                                {paymentStatus[rzpOrderId] && (
                                  <div className="text-[11px] font-mono pt-1">
                                    {paymentStatus[rzpOrderId].status === "verifying" && (
                                      <span className="text-amber-600 flex items-center gap-1">
                                        <Loader2 className="w-3 h-3 animate-spin" /> Verifying HMAC-SHA256 signature...
                                      </span>
                                    )}
                                    {paymentStatus[rzpOrderId].status === "success" && (
                                      <span className="text-emerald-700 flex items-center gap-1 font-semibold">
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Payment Verified! ID: {paymentStatus[rzpOrderId].paymentId}
                                      </span>
                                    )}
                                    {paymentStatus[rzpOrderId].status === "failed" && (
                                      <span className="text-red-600">
                                        Verification Failed: {paymentStatus[rzpOrderId].error}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            ) : null}
                          </div>
                        );
                      })()}
                    </motion.div>
                  )}
                </div>
              </motion.div>
            </div>

            {/* Failure Explanation Card (renders immediately when stage fails) */}
            <AnimatePresence>
              {isFailed && (() => {
                const friendly = formatHumanFriendlyError(stage.error || failureExplanation || "", stage.id);
                const isDetailsOpen = expandedErrorStage === stage.id;

                return (
                  <motion.div
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.35, delay: 0.1 }}
                    className="w-full mt-3 p-4 rounded-xl bg-red-50 border-2 border-red-200 text-sm shadow-md z-20 space-y-2.5"
                  >
                    {/* Header with human-friendly title & safety badge */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 font-bold text-red-800">
                        <ShieldAlert className="w-5 h-5 text-red-600 shrink-0" />
                        <span className="text-sm font-semibold">{friendly.title}</span>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-red-100 text-red-700 border border-red-200 shrink-0">
                        {friendly.invariantBadge.split(" · ")[0]}
                      </span>
                    </div>

                    {/* Plain-English summary */}
                    <p className="text-red-900 text-xs leading-relaxed">
                      {friendly.summary}
                    </p>

                    {/* Suggested Action */}
                    <div className="p-2.5 rounded-lg bg-white/80 border border-red-200/80 text-[11px] text-red-800 flex items-center gap-2">
                      <span className="font-semibold text-red-900 shrink-0">Suggested Action:</span>
                      <span>{friendly.action}</span>
                    </div>

                    {/* Expandable Technical Protocol Code for Judges & Engineers */}
                    <div className="pt-1 border-t border-red-200/60">
                      <button
                        type="button"
                        onClick={() => setExpandedErrorStage(isDetailsOpen ? null : stage.id)}
                        className="text-[11px] font-mono text-red-700 hover:text-red-900 flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <span>{isDetailsOpen ? "Hide Protocol Details" : "View Protocol Details & Security Invariant"}</span>
                        {isDetailsOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>

                      {isDetailsOpen && (
                        <div className="mt-2 p-2.5 rounded-lg bg-red-950 text-red-100 font-mono text-[11px] space-y-1.5 break-all animate-in fade-in">
                          <div className="text-[10px] text-red-400 font-bold uppercase">
                            Security Gate Invariant: {friendly.invariantBadge}
                          </div>
                          <div className="text-red-200">
                            {friendly.technicalDetails}
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })()}
            </AnimatePresence>

            {/* Animated Pipe Connector between Stages */}
            {!isLast && (
              <div className="relative w-1 h-10 my-0.5 flex items-center justify-center">
                {/* Static pipe line */}
                <div
                  className="w-0.5 h-full"
                  style={{
                    background: isComplete
                      ? `linear-gradient(to bottom, ${colorConfig.bg}, ${STAGE_COLORS[stages[idx + 1]?.id]?.bg || colorConfig.bg})`
                      : "rgba(92, 61, 46, 0.15)",
                  }}
                />

                {/* Fluid Flowing Orb */}
                {isComplete && stages[idx + 1]?.status === "running" && (
                  <motion.div
                    className="absolute w-2.5 h-2.5 rounded-full shadow-md z-20"
                    style={{ background: STAGE_COLORS[stages[idx + 1]?.id]?.bg || colorConfig.bg }}
                    initial={{ y: -16, opacity: 0.95, scale: 1.2 }}
                    animate={{ y: 16, opacity: 0.25, scale: 0.8 }}
                    transition={{ duration: 0.75, repeat: Infinity, ease: "easeInOut" }}
                  />
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
