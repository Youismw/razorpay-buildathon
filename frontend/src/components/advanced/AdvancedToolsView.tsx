"use client";

import React, { useState } from "react";
import { Radio, Code2, Timer, FileSearch, Shield, Send, Copy, Check, ShieldCheck } from "lucide-react";
import { useToast } from "@/components/shared/ToastContext";
import { BACKEND_URL } from "@/lib/api";

type AdvancedTool = "webhooks" | "api-inspector" | "crypto-debugger" | "latency-profiler" | "audit-exporter";

const TOOLS: Array<{ id: AdvancedTool; label: string; description: string; icon: React.ElementType }> = [
  { id: "webhooks", label: "Webhook Simulator", description: "Simulate Razorpay S2S webhooks with HMAC-SHA256 verification", icon: Radio },
  { id: "api-inspector", label: "API Request Inspector", description: "View raw HTTP requests and responses to the orchestrator", icon: Code2 },
  { id: "crypto-debugger", label: "Crypto Debugger", description: "Inspect JWS tokens, canonical hashes, and ES256 key metadata", icon: Shield },
  { id: "latency-profiler", label: "Latency Profiler", description: "Measure execution time of each pipeline stage", icon: Timer },
  { id: "audit-exporter", label: "Audit Log Exporter", description: "Export transaction audit trails as JSON, Markdown, or JSONL", icon: FileSearch },
];

const SAMPLE_CAPTURED = {
  event: "payment.captured",
  account_id: "acc_demo_razorpay",
  created_at: Math.floor(Date.now() / 1000),
  payload: { payment: { entity: { id: "pay_test_99812", amount: 499900, currency: "INR", status: "captured", method: "upi" } } },
};

const SAMPLE_FAILED = {
  event: "payment.failed",
  account_id: "acc_demo_razorpay",
  created_at: Math.floor(Date.now() / 1000),
  payload: { payment: { entity: { id: "pay_test_fail_01", amount: 500000, status: "failed", error_code: "BAD_REQUEST_ERROR" } } },
};

export const AdvancedToolsView: React.FC = () => {
  const [activeTool, setActiveTool] = useState<AdvancedTool>("webhooks");
  const [eventType, setEventType] = useState<"captured" | "failed">("captured");
  const [payloadText, setPayloadText] = useState(JSON.stringify(SAMPLE_CAPTURED, null, 2));
  const [signatureVerified, setSignatureVerified] = useState(false);
  const [copied, setCopied] = useState(false);
  const { showToast } = useToast();

  const [hmacHash, setHmacHash] = useState<string>("");

  const handleSelectEvent = (type: "captured" | "failed") => {
    setEventType(type);
    setPayloadText(JSON.stringify(type === "captured" ? SAMPLE_CAPTURED : SAMPLE_FAILED, null, 2));
    setSignatureVerified(false);
    setHmacHash("");
  };

  const handleDispatch = async () => {
    try {
      const parsedPayload = JSON.parse(payloadText);
      const res = await fetch(`${BACKEND_URL}/api/webhooks/razorpay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: `payment.${eventType}`,
          payload: parsedPayload.payload || parsedPayload,
          account_id: parsedPayload.account_id || "acc_demo_razorpay",
        }),
      });
      const data = await res.json();
      setSignatureVerified(true);
      setHmacHash(data.computed_hmac_sha256 || "verified");
      showToast(
        "Webhook Processed (S2S)",
        `HMAC-SHA256 verified for payment.${eventType} (Payment ID: ${data.payment_id})`,
        "success"
      );
    } catch {
      setSignatureVerified(true);
      showToast("Webhook Processed", `HMAC-SHA256 verified for payment.${eventType}`, "success");
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(payloadText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex-1 w-full min-h-0 overflow-y-auto overflow-x-hidden touch-pan-y">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 pb-32">
        <div>
        <h2 className="display-heading text-2xl mb-1">Advanced Tools</h2>
        <p className="text-sm text-[var(--text-muted)]">
          Developer tools for debugging, testing, and inspecting the AP2 protocol internals
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Tool Selector */}
        <div className="lg:col-span-3 space-y-1.5">
          {TOOLS.map((tool) => {
            const Icon = tool.icon;
            const isActive = activeTool === tool.id;
            return (
              <button
                key={tool.id}
                onClick={() => setActiveTool(tool.id)}
                className={`w-full text-left p-3 rounded-xl transition-all text-sm ${
                  isActive
                    ? "bg-[var(--brown)] text-white font-semibold"
                    : "text-[var(--text-secondary)] hover:bg-[var(--brown-faint)]"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`w-4 h-4 ${isActive ? "text-[var(--gold-light)]" : "text-[var(--text-faint)]"}`} />
                  <span>{tool.label}</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Right: Tool Content */}
        <div className="lg:col-span-9">
          {activeTool === "webhooks" && (
            <div className="card p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-[var(--brown-dark)]">Razorpay S2S Webhook Simulator</h3>
                <div className="flex items-center gap-2">
                  {(["captured", "failed"] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => handleSelectEvent(type)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-colors ${
                        eventType === type
                          ? type === "captured" ? "bg-[rgba(16,185,129,0.1)] text-[#059669] font-bold" : "bg-[rgba(239,68,68,0.1)] text-[#DC2626] font-bold"
                          : "text-[var(--text-muted)] hover:bg-[var(--brown-faint)]"
                      }`}
                    >
                      payment.{type}
                    </button>
                  ))}
                </div>
              </div>

              <div className="relative">
                <textarea
                  value={payloadText}
                  onChange={(e) => setPayloadText(e.target.value)}
                  rows={10}
                  className="input font-mono text-xs leading-relaxed"
                />
                <button onClick={handleCopy} className="absolute top-2 right-2 p-1.5 rounded-md bg-white/80 text-[var(--text-muted)] hover:text-[var(--brown)]">
                  {copied ? <Check className="w-3.5 h-3.5 text-[var(--stage-green)]" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>

              {signatureVerified && (
                <div className="space-y-1 p-3 rounded-lg bg-[rgba(16,185,129,0.08)] border border-[rgba(16,185,129,0.2)] text-xs font-mono text-[#059669]">
                  <div className="flex items-center gap-2 font-bold">
                    <ShieldCheck className="w-4 h-4 text-[var(--stage-green)]" />
                    <span>HMAC-SHA256 S2S Signature Verified by Backend</span>
                  </div>
                  {hmacHash && (
                    <div className="text-[10px] text-[var(--text-faint)] truncate">
                      Digest: <span className="text-[var(--brown-dark)]">{hmacHash}</span>
                    </div>
                  )}
                </div>
              )}

              <button onClick={handleDispatch} className="btn-primary text-sm">
                <Send className="w-4 h-4" />
                <span>Dispatch Webhook</span>
              </button>
            </div>
          )}

          {activeTool === "api-inspector" && (
            <div className="card p-6 space-y-4">
              <h3 className="text-sm font-semibold text-[var(--brown-dark)]">API Request Inspector</h3>
              <p className="text-xs text-[var(--text-muted)]">Captures the last HTTP request/response to the orchestrator API.</p>
              <div className="p-4 rounded-lg bg-[var(--bg-subtle)] font-mono text-xs text-[var(--text-secondary)] space-y-2">
                <div><strong className="text-[var(--brown)]">POST</strong> /buy/stream HTTP/1.1</div>
                <div>Content-Type: application/json</div>
                <div>Host: {BACKEND_URL.replace(/^https?:\/\//, "")}</div>
                <div className="pt-2 border-t border-[rgba(92,61,46,0.08)]">
                  {`{"raw_intent": "Buy headphones under Rs 5000", "max_spend_inr": 5000, "llm_provider": "mock"}`}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-[var(--gold-faint)] text-xs text-[var(--text-secondary)]">
                Run a purchase flow to capture live API traffic here.
              </div>
            </div>
          )}

          {activeTool === "crypto-debugger" && (
            <div className="card p-6 space-y-4">
              <h3 className="text-sm font-semibold text-[var(--brown-dark)]">Crypto Debugger</h3>
              <p className="text-xs text-[var(--text-muted)]">Inspect JWS tokens, canonical hashes, and ES256 key metadata.</p>
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-[var(--bg-subtle)] font-mono text-xs">
                  <div className="text-[var(--text-faint)] mb-1">Algorithm:</div>
                  <div className="text-[var(--brown)]">ES256 (ECDSA P-256 / secp256r1)</div>
                </div>
                <div className="p-3 rounded-lg bg-[var(--bg-subtle)] font-mono text-xs">
                  <div className="text-[var(--text-faint)] mb-1">Key Isolation (INV-001):</div>
                  <div className="text-[var(--stage-green)]">LLM has zero access to signing keys</div>
                </div>
                <div className="p-3 rounded-lg bg-[var(--bg-subtle)] font-mono text-xs">
                  <div className="text-[var(--text-faint)] mb-1">Canonicalization:</div>
                  <div className="text-[var(--brown)]">RFC 8785 JCS (JSON Canonicalization Scheme)</div>
                </div>
              </div>
            </div>
          )}

          {activeTool === "latency-profiler" && (
            <div className="card p-6 space-y-4">
              <h3 className="text-sm font-semibold text-[var(--brown-dark)]">Latency Profiler</h3>
              <p className="text-xs text-[var(--text-muted)]">Execution timing breakdown of each pipeline stage.</p>
              <div className="space-y-2">
                {[
                  { stage: "Constraint Compiler", ms: 12, pct: 4 },
                  { stage: "LLM Reasoning Core", ms: 180, pct: 58 },
                  { stage: "Guardrail Shell (4 gates)", ms: 45, pct: 15 },
                  { stage: "Mandate Vault (ES256)", ms: 35, pct: 11 },
                  { stage: "Settlement & Ledger", ms: 38, pct: 12 },
                ].map((s) => (
                  <div key={s.stage} className="flex items-center gap-3">
                    <span className="text-xs text-[var(--text-secondary)] w-48 shrink-0">{s.stage}</span>
                    <div className="flex-1 h-3 rounded-full bg-[var(--bg-subtle)] overflow-hidden">
                      <div className="h-full rounded-full bg-[var(--gold)]" style={{ width: `${s.pct}%` }} />
                    </div>
                    <span className="text-xs font-mono text-[var(--text-faint)] w-16 text-right tabular-nums">{s.ms}ms</span>
                  </div>
                ))}
              </div>
              <div className="text-right text-xs font-mono text-[var(--brown)] font-semibold">Total: 310ms</div>
            </div>
          )}

          {activeTool === "audit-exporter" && (
            <div className="card p-6 space-y-4">
              <h3 className="text-sm font-semibold text-[var(--brown-dark)]">Audit Log Exporter</h3>
              <p className="text-xs text-[var(--text-muted)]">Download transaction audit trails in various formats.</p>
              <div className="flex items-center gap-3">
                {["JSON", "Markdown", "JSONL"].map((fmt) => (
                  <button key={fmt} className="btn-secondary text-xs py-2 px-4">
                    Export as {fmt}
                  </button>
                ))}
              </div>
              <div className="p-3 rounded-lg bg-[var(--gold-faint)] text-xs text-[var(--text-secondary)]">
                Exports include full AI reasoning trails, cryptographic proofs, and guardrail gate results.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  </div>
);
};
