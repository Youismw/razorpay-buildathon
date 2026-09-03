"""
Guardrail Shell — Schema Validator (FR-GRD-001, Appendix C.1)
Validates ProposalObject emitted by the LLM Reasoning Core.
Rejects unknown fields, enforces required fields, max 2 retries then escalate.
"""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field, model_validator
from enum import Enum


class ProposalStatus(str, Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    ESCALATED = "ESCALATED"


class ProposalItem(BaseModel):
    product_id: str = Field(..., min_length=1)
    product_name: str = Field(..., min_length=1)
    merchant_id: str = Field(..., min_length=1)
    offer_price_paise: int = Field(..., gt=0, description="Offered price in paise")
    quantity: int = Field(default=1, ge=1)
    currency: str = Field(default="INR")
    category: Optional[str] = None
    grounding_manifest_hash: Optional[str] = None

    model_config = ConfigDict(extra="forbid")  # Reject unknown fields immediately


class ProposalObject(BaseModel):
    """
    Canonical ProposalObject (Appendix C.1 from SRS).
    This is the ONLY schema the LLM is allowed to emit.
    """
    proposal_id: str = Field(..., min_length=1)
    intent_id: str = Field(..., min_length=1)
    constraint_hash: str = Field(..., min_length=1, description="Must match the original CompiledConstraints hash")
    items: List[ProposalItem] = Field(..., min_length=1)
    total_price_paise: int = Field(..., gt=0)
    reasoning_summary: Optional[str] = Field(default=None, max_length=2000)
    llm_invocation_id: Optional[str] = None

    model_config = ConfigDict(extra="forbid")

    @model_validator(mode="after")
    def validate_total_matches_items(self):
        computed_total = sum(item.offer_price_paise * item.quantity for item in self.items)
        if computed_total != self.total_price_paise:
            raise ValueError(
                f"total_price_paise ({self.total_price_paise}) does not match "
                f"sum of item prices ({computed_total})"
            )
        return self


class SchemaValidationResult(BaseModel):
    valid: bool
    errors: List[str] = Field(default_factory=list)
    proposal: Optional[ProposalObject] = None
    retry_count: int = 0


MAX_SCHEMA_RETRIES = 2


def validate_proposal_schema(raw_dict: Dict[str, Any], retry_count: int = 0) -> SchemaValidationResult:
    """
    Validate a raw dictionary against the ProposalObject schema.
    Returns validation result. On failure after MAX_SCHEMA_RETRIES, signals escalation.
    """
    errors = []

    try:
        proposal = ProposalObject(**raw_dict)
        return SchemaValidationResult(valid=True, proposal=proposal, retry_count=retry_count)
    except Exception as e:
        error_msg = str(e)
        errors.append(error_msg)

        if retry_count >= MAX_SCHEMA_RETRIES:
            errors.append(f"Schema validation failed after {MAX_SCHEMA_RETRIES} retries. Escalating to HITL.")

        return SchemaValidationResult(valid=False, errors=errors, retry_count=retry_count)
