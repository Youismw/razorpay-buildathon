import os
from typing import List, Optional
from pydantic import BaseModel, Field


class BuyRequest(BaseModel):
    raw_intent: str = Field(..., min_length=3, description="Natural language purchase intent")
    buyer_did: Optional[str] = Field(default="buyer-default")
    max_spend_inr: Optional[float] = Field(default=None, gt=0)
    allowed_merchants: Optional[list] = None
    validity_hours: int = Field(default=24, gt=0)
    mode: str = Field(default="basic", description="basic | advanced")
    llm_provider: str = Field(
        default_factory=lambda: "mock" if os.environ.get("PYTEST_CURRENT_TEST") else "auto",
        description="auto | gemini | groq | openrouter | mock",
    )
    simulate_failure_stage: Optional[int] = Field(default=None, description="1..5 to simulate failure at specific pipeline stage")
    idempotency_key: Optional[str] = Field(default=None, description="Client idempotency key (INV-003)")
    pin: Optional[str] = Field(default=None, description="Buyer security PIN for transactions exceeding policy ceiling (INV-001)")


class BuyResponse(BaseModel):
    trace_id: str
    status: str  # SUCCESS | ESCALATED | FAILED
    decision: str
    mandate_id: Optional[str] = None
    compact_jws: Optional[str] = None
    total_price_paise: Optional[int] = None
    constraint_hash: Optional[str] = None
    confidence_score: Optional[float] = None
    reasoning_summary: Optional[str] = None
    ai_thought_steps: List[str] = Field(default_factory=list)
    audit_trail: list = Field(default_factory=list)
    audit_json_path: Optional[str] = None
    audit_md_path: Optional[str] = None
    audit_jsonl_path: Optional[str] = None
    razorpay_order_id: Optional[str] = None
    razorpay_key_id: Optional[str] = None
    error: Optional[str] = None
