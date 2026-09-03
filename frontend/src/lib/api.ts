import { BuyRequest, BuyResponse, Invariant, MerchantCatalog, TransactionAuditRecord } from "./types";

export function getBackendUrl(): string {
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem("ap2_backend_url");
    if (saved && saved.trim()) {
      return saved.trim().replace(/\/+$/, "");
    }
    if (process.env.NEXT_PUBLIC_API_URL && process.env.NEXT_PUBLIC_API_URL.trim()) {
      return process.env.NEXT_PUBLIC_API_URL.trim().replace(/\/+$/, "");
    }
    const host = window.location.hostname;
    if (host.includes("onrender.com")) {
      if (host.includes("-frontend")) {
        return `https://${host.replace("-frontend", "-backend")}`;
      }
      if (host.includes("frontend")) {
        return `https://${host.replace("frontend", "backend")}`;
      }
    }
    // On all client browsers (desktop & mobile LAN), relative paths leverage Next.js proxy rewrites
    return "";
  }
  return (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");
}

export const BACKEND_URL = "";

export async function checkBackendHealth(): Promise<{ status: string; online: boolean }> {
  try {
    const base = getBackendUrl();
    const res = await fetch(`${base}/healthz`, { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      return { status: data.status, online: true };
    }
  } catch {
    // Backend offline or unreachable
  }
  return { status: "offline", online: false };
}

export async function fetchInvariants(): Promise<Invariant[]> {
  try {
    const base = getBackendUrl();
    const res = await fetch(`${base}/api/invariants`, { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      return data.invariants;
    }
  } catch {
    // Fallback to built-in invariants list
  }
  return [
    { id: "INV-001", name: "Zero Key LLM Isolation", description: "LLM never touches private keys or payment credentials", enforcement: "Docker network isolation ('net-llm' internal only)", status: "ENFORCED" },
    { id: "INV-002", name: "Mandatory Guardrail Shell Gate", description: "Guardrail Shell is the single mandatory gate to Mandate Vault", enforcement: "Code-level gate: only approved proposals invoke sign_canonical_payload()", status: "ENFORCED" },
    { id: "INV-003", name: "Idempotency Guarantee", description: "(mandate_id, idempotency_key) uniqueness at database level", enforcement: "PostgreSQL UNIQUE constraint + IdempotencyStore memory lock", status: "ENFORCED" },
    { id: "INV-004", name: "Revocation Priority Race", description: "Revocation wins any race against in-flight debits", enforcement: "Per-mandate Lock simulating SELECT ... FOR UPDATE with 403 response", status: "ENFORCED" },
    { id: "INV-005", name: "Append-Only Immutable Ledger", description: "All actions recorded in append-only hash-chained audit log", enforcement: "audit_events table with zero UPDATE/DELETE grants", status: "ENFORCED" },
    { id: "INV-006", name: "Independent Audit Writing", description: "Each component writes audit events independently to SSOT ledger", enforcement: "Dedicated ledger writer role + REST event bus", status: "ENFORCED" },
    { id: "INV-007", name: "Fail-Closed Protocol Validation", description: "Protocol mismatches explicitly rejected, never silently dropped", enforcement: "Pydantic v2 extra='forbid' validation + schema strict mode", status: "ENFORCED" },
    { id: "INV-008", name: "Adversarial Input Sanitization", description: "External inputs can influence proposals but never authorize payments", enforcement: "Sanitizer NFKC normalization + prompt injection filter", status: "ENFORCED" },
    { id: "INV-009", name: "Cryptographic Integrity Gate", description: "Signature and canonicalization mismatches fail closed", enforcement: "ES256 allowlist + RFC 8785 canonical hash verification", status: "ENFORCED" },
    { id: "INV-010", name: "Deterministic Spending Bound", description: "Spending bounds enforced strictly in deterministic Policy Engine", enforcement: "Pure Python arithmetic check: offer_price <= max_spend", status: "ENFORCED" },
  ];
}

export async function fetchCatalog(): Promise<Record<string, MerchantCatalog>> {
  try {
    const res = await fetch(`${getBackendUrl()}/api/catalog`, { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      return data.merchants;
    }
  } catch {
    // Fallback catalog
  }
  return {
    "demo-merchant.myshopify.com": {
      manifest_hash: "sha256:demo_manifest_v1_2026",
      products: {
        "PROD-WH-CH520": {
          name: "Sony WH-CH520 Wireless Headphones",
          price_paise: 499900,
          category: "electronics",
          in_stock: true,
        },
        "PROD-BUDS-XM5": {
          name: "Sony WF-1000XM5 Noise Canceling Earbuds",
          price_paise: 1999900,
          category: "electronics",
          in_stock: true,
        },
        "PROD-GENERIC-001": {
          name: "Anker Soundcore Mini 3 Bluetooth Speaker",
          price_paise: 99900,
          category: "audio",
          in_stock: true,
        },
      },
    },
  };
}

export async function fetchAuditLogs(): Promise<TransactionAuditRecord[]> {
  try {
    const res = await fetch(`${getBackendUrl()}/api/audit-logs`, { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      return data.transactions;
    }
  } catch {
    // Fallback
  }
  return [];
}

export async function submitBuyIntent(req: BuyRequest): Promise<BuyResponse> {
  const res = await fetch(`${getBackendUrl()}/buy`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });

  if (!res.ok) {
    const errData = (await res.json().catch(() => ({ detail: "Unknown error" }))) as { detail?: string };
    throw new Error(errData.detail || `Request failed with status ${res.status}`);
  }

  return res.json();
}

export interface StreamCallbacks {
  onInit?: (data: { trace_id: string; raw_intent: string }) => void;
  onThought?: (stepIndex: number, text: string) => void;
  onStageComplete?: (stage: string, data: Record<string, unknown>) => void;
  onStageFailed?: (stage: string, error: string, data?: Record<string, unknown>) => void;
  onFinalStatus?: (status: string, data: Record<string, unknown>) => void;
  onError?: (stage: string, error: string) => void;
}

export async function streamBuyIntent(
  req: BuyRequest,
  callbacks: StreamCallbacks
): Promise<void> {
  try {
    const res = await fetch(`${getBackendUrl()}/buy/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    });

    if (!res.ok || !res.body) {
      throw new Error(`Streaming failed: HTTP ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("data:")) {
          try {
            const payload = JSON.parse(trimmed.slice(5).trim()) as {
              event: string;
              trace_id?: string;
              raw_intent?: string;
              step_index?: number;
              text?: string;
              stage?: string;
              data?: Record<string, unknown>;
              status?: string;
              error?: string;
              errors?: unknown;
              decision?: string;
              reason?: string;
              [key: string]: unknown;
            };

            if (payload.event === "INIT") {
              callbacks.onInit?.({
                trace_id: payload.trace_id || "",
                raw_intent: payload.raw_intent || "",
              });
            } else if (payload.event === "AI_THOUGHT") {
              callbacks.onThought?.(payload.step_index || 1, payload.text || "");
            } else if (payload.event === "STAGE_COMPLETE") {
              callbacks.onStageComplete?.(payload.stage || "", payload.data || {});
            } else if (payload.event === "STAGE_FAILED" || payload.event === "GUARDRAIL_FAILED") {
              const stageName = payload.stage || "GUARDRAIL_SHELL";
              const errorText = payload.error || (payload.errors ? JSON.stringify(payload.errors) : "Stage failed verification");
              callbacks.onStageFailed?.(stageName, errorText, payload.data || payload);
            } else if (payload.event === "FINAL_STATUS") {
              callbacks.onFinalStatus?.(payload.status || "", payload);
            } else if (payload.event === "ERROR") {
              callbacks.onError?.(payload.stage || "PIPELINE", payload.error || "Unknown stage error");
            }
          } catch (e) {
            console.error("Error parsing SSE line:", trimmed, e);
          }
        }
      }
    }
  } catch (err: unknown) {
    console.warn("Backend stream failed, attempting standard /buy fallback:", err);
    try {
      const result = await submitBuyIntent(req);
      callbacks.onInit?.({ trace_id: result.trace_id, raw_intent: req.raw_intent });
      
      if (result.ai_thought_steps) {
        result.ai_thought_steps.forEach((step, idx) => {
          callbacks.onThought?.(idx + 1, step);
        });
      }

      if (result.status === "FAILED" && result.decision === "COMPILATION_ERROR") {
        callbacks.onStageFailed?.("CONSTRAINT_COMPILATION", result.error || "Constraint Compilation Failed", result as unknown as Record<string, unknown>);
        callbacks.onFinalStatus?.("FAILED", result as unknown as Record<string, unknown>);
        return;
      }

      callbacks.onStageComplete?.("CONSTRAINT_COMPILATION", {
        constraint_hash: result.constraint_hash,
      });

      if (result.status === "FAILED" && result.decision === "REASONING_ERROR") {
        callbacks.onStageFailed?.("LLM_REASONING", result.error || "AI Reasoning Failed", result as unknown as Record<string, unknown>);
        callbacks.onFinalStatus?.("FAILED", result as unknown as Record<string, unknown>);
        return;
      }

      callbacks.onStageComplete?.("LLM_REASONING", {
        thought_steps: result.ai_thought_steps,
        total_price_paise: result.total_price_paise,
      });

      if (result.status === "ESCALATED" || result.decision === "SCHEMA_REJECTED" || result.decision === "ESCALATED") {
        callbacks.onStageFailed?.("GUARDRAIL_SHELL", result.error || "Guardrail Verification Rejected: Policy or Grounding bounds exceeded", result as unknown as Record<string, unknown>);
        callbacks.onFinalStatus?.("ESCALATED", result as unknown as Record<string, unknown>);
        return;
      }

      callbacks.onStageComplete?.("GUARDRAIL_SHELL", {
        decision: result.decision,
        confidence_score: result.confidence_score,
        schema_valid: true,
        policy_passed: true,
        grounding_verified: true,
      });

      if (result.status === "SUCCESS") {
        callbacks.onStageComplete?.("VAULT_SIGNING", {
          mandate_id: result.mandate_id,
          compact_jws: result.compact_jws,
          algorithm: "ES256 (ECDSA P-256)",
        });

        callbacks.onStageComplete?.("SETTLEMENT", {
          status: "SETTLED",
          mandate_id: result.mandate_id,
          total_price_paise: result.total_price_paise,
          total_inr: (result.total_price_paise || 0) / 100,
          razorpay_order_id: result.razorpay_order_id,
          razorpay_key_id: result.razorpay_key_id,
        });

        callbacks.onFinalStatus?.("SUCCESS", result as unknown as Record<string, unknown>);
      } else {
        callbacks.onStageFailed?.("SETTLEMENT", result.error || "Settlement failed", result as unknown as Record<string, unknown>);
        callbacks.onFinalStatus?.(result.status, result as unknown as Record<string, unknown>);
      }
    } catch (fallbackErr: unknown) {
      const msg = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
      callbacks.onError?.("NETWORK", msg);
    }
  }
}

/**
 * Razorpay Standard Web Checkout: Create Order
 */
export async function createRazorpayOrder(amountPaise: number, currency: string = "INR"): Promise<{
  order_id: string;
  amount: number;
  currency: string;
  key_id?: string;
}> {
  const res = await fetch(`${getBackendUrl()}/api/create-order`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount: amountPaise, currency }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to create order" }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

/**
 * Razorpay Standard Web Checkout: Verify Payment Signature
 */
export async function verifyRazorpayPayment(payload: {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}): Promise<{ status: string; message: string; order_id?: string; payment_id?: string }> {
  const res = await fetch(`${getBackendUrl()}/api/verify-payment`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Payment verification failed" }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

/**
 * Public JWKS Keys (RFC 7517)
 */
export async function getPublicJwks(): Promise<{ keys: Array<Record<string, unknown>> }> {
  const res = await fetch(`${getBackendUrl()}/.well-known/jwks.json`);
  if (!res.ok) {
    throw new Error(`Failed to fetch JWKS: HTTP ${res.status}`);
  }
  return res.json();
}

/**
 * Cryptographic JWS Token Verification
 */
export async function verifyJwsToken(compactJws: string): Promise<{
  valid: boolean;
  status: string;
  algorithm: string;
  key_id: string;
  payload: Record<string, unknown>;
  verification_message: string;
}> {
  const res = await fetch(`${getBackendUrl()}/api/vault/verify-jws`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ compact_jws: compactJws }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "JWS Verification failed" }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

/**
 * Human-In-The-Loop Governance Override
 */
export async function submitGovernanceOverride(payload: {
  override_token: string;
  buyer_pin: string;
  approved: boolean;
  override_reason?: string;
}): Promise<{
  status: string;
  message: string;
  authorized: boolean;
  timestamp?: string;
}> {
  const res = await fetch(`${getBackendUrl()}/api/governance/override`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Governance override failed" }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

/**
 * Razorpay Dispute / Cancellation Refund
 */
export async function requestRefund(
  paymentId: string,
  amountPaise?: number,
  reason?: string
): Promise<{
  status: string;
  message: string;
  refund_id?: string;
  payment_id: string;
  amount_paise?: number;
}> {
  const res = await fetch(`${getBackendUrl()}/api/refund`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      payment_id: paymentId,
      amount_paise: amountPaise,
      reason: reason || "AP2 Dispute Resolution",
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Refund request failed" }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}


