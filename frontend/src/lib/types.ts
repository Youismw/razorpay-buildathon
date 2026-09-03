export interface SpendLimit {
  max_amount_paise: number;
  currency: string;
}

export interface MerchantScope {
  allowed_merchants: string[];
  category_blocklist: string[];
}

export interface ValidityWindow {
  valid_from_iso: string;
  valid_until_iso: string;
  validity_window_hours: number;
}

export interface CompiledConstraints {
  intent_id: string;
  raw_intent: string;
  spend_limit: SpendLimit;
  merchant_scope: MerchantScope;
  validity_window: ValidityWindow;
  product_query: string;
  quantity: number;
  soft_preferences: Array<{ key: string; value: string; weight: number }>;
  constraint_hash: string;
  compiled_at_iso: string;
}

export interface ProposalItem {
  product_id: string;
  product_name: string;
  merchant_id: string;
  offer_price_paise: number;
  quantity: number;
  currency: string;
  category?: string;
  grounding_manifest_hash?: string;
}

export interface ProposalObject {
  proposal_id: string;
  intent_id: string;
  constraint_hash: string;
  items: ProposalItem[];
  total_price_paise: number;
  reasoning_summary?: string;
  llm_invocation_id?: string;
}

export interface PolicyViolation {
  code: string;
  message: string;
  field: string;
  actual_value?: string | number | boolean | null;
  allowed_value?: string | number | boolean | null;
}

export interface ConfidenceScores {
  s_logprob: number;
  s_grounding: number;
  s_schema: number;
}

export interface GuardrailStageData {
  decision: "APPROVED" | "ESCALATED";
  confidence_score: number;
  schema_valid: boolean;
  policy_passed: boolean;
  grounding_verified: boolean;
  violations?: PolicyViolation[];
  manifest_hash?: string;
  scores?: ConfidenceScores;
}

export interface VaultStageData {
  mandate_id: string;
  compact_jws: string;
  canonical_sha256: string;
  algorithm: string;
  key_id: string;
}

export interface SettlementStageData {
  status: "SETTLED" | "FAILED" | "REVOKED";
  mandate_id: string;
  total_price_paise: number;
  total_inr: number;
  audit_json_path?: string;
  audit_md_path?: string;
  audit_jsonl_path?: string;
}

export type StageId =
  | "CONSTRAINT_COMPILATION"
  | "LLM_REASONING"
  | "GUARDRAIL_SHELL"
  | "VAULT_SIGNING"
  | "SETTLEMENT";

export type StageStatus = "idle" | "running" | "success" | "failed" | "escalated";

export interface PipelineStageState {
  id: StageId;
  name: string;
  subtitle: string;
  status: StageStatus;
  data?: Record<string, unknown>;
  durationMs?: number;
  error?: string;
}

export interface BuyRequest {
  raw_intent: string;
  buyer_did?: string;
  max_spend_inr?: number;
  allowed_merchants?: string[];
  validity_hours?: number;
  mode?: "basic" | "advanced";
  llm_provider?: "auto" | "groq" | "gemini" | "openrouter" | "mock";
  simulate_failure_stage?: number;
}

export interface BuyResponse {
  trace_id: string;
  status: "SUCCESS" | "ESCALATED" | "FAILED";
  decision: string;
  mandate_id?: string;
  compact_jws?: string;
  total_price_paise?: number;
  constraint_hash?: string;
  confidence_score?: number;
  reasoning_summary?: string;
  ai_thought_steps?: string[];
  audit_trail?: Array<{ stage: string; timestamp: string;[key: string]: unknown }>;
  audit_json_path?: string;
  audit_md_path?: string;
  audit_jsonl_path?: string;
  razorpay_order_id?: string;
  razorpay_key_id?: string;
  error?: string;
}

export interface Invariant {
  id: string;
  name: string;
  description: string;
  enforcement: string;
  status: "ENFORCED" | "ACTIVE" | "VERIFIED";
}

export interface MerchantProduct {
  name: string;
  price_paise: number;
  category: string;
  in_stock: boolean;
}

export interface MerchantCatalog {
  manifest_hash: string;
  products: Record<string, MerchantProduct>;
}

export interface TransactionAuditRecord {
  trace_id: string;
  timestamp: string;
  status: string;
  decision: string;
  raw_intent: string;
  constraint_hash?: string;
  total_amount_inr?: number;
  total_price_paise?: number;
  confidence_score?: number;
  ai_reasoning?: {
    summary?: string;
    thought_steps?: string[];
  };
  mandate?: {
    mandate_id?: string;
    compact_jws?: string;
    algorithm?: string;
  };
  error?: string;
  audit_trail_events?: Array<{ stage: string; timestamp: string;[key: string]: unknown }>;
}
