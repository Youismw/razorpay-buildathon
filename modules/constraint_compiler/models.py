"""
Constraint Compiler Data Models (FR-CC-001, FR-CC-003)
Pydantic v2 schemas for CompiledConstraints, separating hard bounds from soft preferences.
"""

from typing import List, Optional
from pydantic import BaseModel, Field
from enum import Enum


class ConstraintPriority(str, Enum):
    HARD = "HARD"
    SOFT = "SOFT"


class SpendLimit(BaseModel):
    max_amount_paise: int = Field(..., gt=0, description="Maximum spend in paise (INR × 100)")
    currency: str = Field(default="INR", description="ISO 4217 currency code")


class MerchantScope(BaseModel):
    allowed_merchants: List[str] = Field(default_factory=list, description="Allowlisted merchant DIDs or domain identifiers")
    category_blocklist: List[str] = Field(default_factory=list, description="Blocked merchant category codes (MCC)")


class ValidityWindow(BaseModel):
    valid_from_iso: str = Field(..., description="ISO 8601 start timestamp")
    valid_until_iso: str = Field(..., description="ISO 8601 expiry timestamp")
    validity_window_hours: int = Field(default=24, gt=0)


class SoftPreference(BaseModel):
    key: str = Field(..., description="Preference identifier (e.g. 'brand', 'color', 'shipping_speed')")
    value: str
    weight: float = Field(default=0.5, ge=0.0, le=1.0)


class CompiledConstraints(BaseModel):
    """
    The canonical output of the Constraint Compiler (FR-CC-001).
    Hard constraints are deterministically enforced by the Policy Engine.
    Soft preferences guide the LLM Reasoning Core but never override hard bounds.
    """
    intent_id: str = Field(..., description="Unique identifier for this compiled intent")
    raw_intent: str = Field(..., description="Original natural language intent from the buyer")
    spend_limit: SpendLimit
    merchant_scope: MerchantScope
    validity_window: ValidityWindow
    product_query: str = Field(default="", description="Extracted product search query")
    quantity: int = Field(default=1, ge=1)
    soft_preferences: List[SoftPreference] = Field(default_factory=list)
    constraint_hash: str = Field(default="", description="SHA-256 of RFC 8785 canonical JSON (computed after compilation)")
    compiled_at_iso: str = Field(default="", description="ISO 8601 timestamp of compilation")


class CompileRequest(BaseModel):
    raw_intent: str = Field(..., min_length=3, description="Natural language purchase intent from buyer")
    buyer_did: Optional[str] = Field(default=None, description="Buyer decentralized identifier")
    max_spend_inr: Optional[float] = Field(default=None, gt=0, description="Optional explicit max spend override in INR")
    allowed_merchants: Optional[List[str]] = Field(default=None, description="Optional merchant allowlist override")
    category_blocklist: Optional[List[str]] = Field(default=None, description="Optional category blocklist override")
    validity_hours: Optional[int] = Field(default=24, gt=0, le=720, description="Validity window in hours (max 30 days)")
    quantity: Optional[int] = Field(default=None, ge=1, description="Optional explicit quantity override")


class CompileResponse(BaseModel):
    intent_id: str
    compiled_constraints: CompiledConstraints
    constraint_hash: str
    canonical_json: str
