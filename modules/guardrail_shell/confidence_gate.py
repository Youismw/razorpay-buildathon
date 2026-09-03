"""
Guardrail Shell — Confidence Gate (FR-GRD-006, FR-GRD-006a)
Computes composite confidence score and determines APPROVED vs ESCALATED.

C = 0.40 * S_logprob + 0.40 * S_grounding + 0.20 * S_schema

For Thread 0 MVP without logprobs: uses self-consistency voting (FR-GRD-006a).
If C < 0.85 → build HITL payload and ESCALATE.
"""

from typing import Any, Dict, Optional
from pydantic import BaseModel, Field

CONFIDENCE_THRESHOLD = 0.85

WEIGHT_LOGPROB = 0.40
WEIGHT_GROUNDING = 0.40
WEIGHT_SCHEMA = 0.20


class ConfidenceScores(BaseModel):
    s_logprob: float = Field(default=0.0, ge=0.0, le=1.0, description="Log-probability / self-consistency score")
    s_grounding: float = Field(default=0.0, ge=0.0, le=1.0, description="Grounding verification score")
    s_schema: float = Field(default=0.0, ge=0.0, le=1.0, description="Schema validation score")


class HITLPayload(BaseModel):
    """Human-In-The-Loop escalation payload (Appendix C.3 from SRS)."""
    escalation_reason: str
    confidence_score: float
    threshold: float = CONFIDENCE_THRESHOLD
    proposal_summary: Dict[str, Any] = Field(default_factory=dict)
    constraint_summary: Dict[str, Any] = Field(default_factory=dict)
    grounding_details: Dict[str, Any] = Field(default_factory=dict)
    recommended_action: str = "HUMAN_REVIEW_REQUIRED"


class ConfidenceResult(BaseModel):
    decision: str  # "APPROVED" or "ESCALATED"
    confidence_score: float
    scores: ConfidenceScores
    threshold: float = CONFIDENCE_THRESHOLD
    hitl_payload: Optional[HITLPayload] = None


def compute_confidence(
    schema_valid: bool,
    grounding_verified: bool,
    policy_passed: bool,
    logprob_score: Optional[float] = None,
    proposal_summary: Optional[Dict[str, Any]] = None,
    constraint_summary: Optional[Dict[str, Any]] = None,
    grounding_details: Optional[Dict[str, Any]] = None,
) -> ConfidenceResult:
    """
    Compute the composite confidence score.
    For MVP without logprobs, s_logprob defaults to 0.70 (conservative self-consistency estimate).
    """

    # Schema score: binary (1.0 if valid, 0.0 if not)
    s_schema = 1.0 if schema_valid else 0.0

    # Grounding score: binary (1.0 if all items verified, 0.0 if not)
    s_grounding = 1.0 if grounding_verified else 0.0

    # Logprob / self-consistency score
    if logprob_score is not None:
        s_logprob = max(0.0, min(1.0, logprob_score))
    else:
        # Thread 0 MVP: conservative default (FR-GRD-006a)
        s_logprob = 0.70 if (schema_valid and grounding_verified and policy_passed) else 0.30

    scores = ConfidenceScores(
        s_logprob=s_logprob,
        s_grounding=s_grounding,
        s_schema=s_schema,
    )

    # Weighted composite
    C = (WEIGHT_LOGPROB * s_logprob) + (WEIGHT_GROUNDING * s_grounding) + (WEIGHT_SCHEMA * s_schema)
    C = round(C, 4)

    # Policy failure is an absolute override — confidence is irrelevant
    if not policy_passed:
        C = 0.0

    if C >= CONFIDENCE_THRESHOLD:
        return ConfidenceResult(
            decision="APPROVED",
            confidence_score=C,
            scores=scores,
        )
    else:
        # Build HITL escalation payload
        reasons = []
        if not schema_valid:
            reasons.append("Schema validation failed")
        if not grounding_verified:
            reasons.append("Grounding verification failed")
        if not policy_passed:
            reasons.append("Policy engine rejected proposal")
        if C < CONFIDENCE_THRESHOLD and policy_passed:
            reasons.append(f"Confidence {C} below threshold {CONFIDENCE_THRESHOLD}")

        hitl = HITLPayload(
            escalation_reason="; ".join(reasons),
            confidence_score=C,
            proposal_summary=proposal_summary or {},
            constraint_summary=constraint_summary or {},
            grounding_details=grounding_details or {},
        )

        return ConfidenceResult(
            decision="ESCALATED",
            confidence_score=C,
            scores=scores,
            hitl_payload=hitl,
        )
