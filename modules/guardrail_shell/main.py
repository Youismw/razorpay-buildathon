"""
Guardrail Shell — Unified Evaluation Pipeline (FR-GRD-001 through FR-GRD-006)
Single POST /v1/guardrail/evaluate endpoint.
Pipeline: Schema → Policy → Grounding → Confidence.
Returns APPROVED or ESCALATED. Never silently drops (INV-007).
"""

from typing import Any, Dict, Optional
from fastapi import FastAPI
from pydantic import BaseModel, Field

from modules.guardrail_shell.schema_validator import validate_proposal_schema
from modules.guardrail_shell.policy_engine import enforce_policy
from modules.guardrail_shell.grounding_oracle import verify_grounding
from modules.guardrail_shell.confidence_gate import compute_confidence
from modules.constraint_compiler.models import CompiledConstraints


app = FastAPI(title="Guardrail Shell Service", version="1.0.0")


class GuardrailEvaluateRequest(BaseModel):
    proposal_raw: Dict[str, Any] = Field(..., description="Raw ProposalObject dict from LLM")
    compiled_constraints: Dict[str, Any] = Field(..., description="CompiledConstraints dict")
    logprob_score: Optional[float] = Field(default=None, description="Optional LLM logprob score")


class GuardrailEvaluateResponse(BaseModel):
    decision: str  # "APPROVED" or "ESCALATED"
    confidence_score: float
    schema_valid: bool
    policy_passed: bool
    grounding_verified: bool
    policy_violations: list = Field(default_factory=list)
    grounding_details: Dict[str, Any] = Field(default_factory=dict)
    hitl_payload: Optional[Dict[str, Any]] = None
    audit_trail: list = Field(default_factory=list)


@app.get("/healthz")
def healthz():
    return {"status": "ok", "service": "guardrail-shell"}


@app.post("/v1/guardrail/evaluate", response_model=GuardrailEvaluateResponse)
def evaluate_proposal(req: GuardrailEvaluateRequest):
    """
    Unified guardrail evaluation pipeline (INV-002).
    This is the ONLY path to the Mandate Vault.
    Order: Schema → Policy → Grounding → Confidence.
    """
    audit_trail = []

    # --- STAGE 1: Schema Validation ---
    schema_result = validate_proposal_schema(req.proposal_raw)
    audit_trail.append({
        "stage": "SCHEMA_VALIDATION",
        "passed": schema_result.valid,
        "errors": schema_result.errors,
    })

    if not schema_result.valid:
        # Schema failed — cannot proceed to policy or grounding
        confidence = compute_confidence(
            schema_valid=False,
            grounding_verified=False,
            policy_passed=False,
            proposal_summary=req.proposal_raw,
            constraint_summary=req.compiled_constraints,
        )
        return GuardrailEvaluateResponse(
            decision="ESCALATED",
            confidence_score=confidence.confidence_score,
            schema_valid=False,
            policy_passed=False,
            grounding_verified=False,
            policy_violations=[],
            hitl_payload=confidence.hitl_payload.model_dump() if confidence.hitl_payload else None,
            audit_trail=audit_trail,
        )

    proposal = schema_result.proposal

    # --- STAGE 2: Policy Enforcement ---
    try:
        constraints = CompiledConstraints(**req.compiled_constraints)
    except Exception as e:
        audit_trail.append({"stage": "CONSTRAINT_PARSE", "error": str(e)})
        return GuardrailEvaluateResponse(
            decision="ESCALATED",
            confidence_score=0.0,
            schema_valid=True,
            policy_passed=False,
            grounding_verified=False,
            policy_violations=[{"code": "CONSTRAINT_PARSE_ERROR", "message": str(e)}],
            audit_trail=audit_trail,
        )

    policy_result = enforce_policy(proposal, constraints)
    audit_trail.append({
        "stage": "POLICY_ENFORCEMENT",
        "passed": policy_result.passed,
        "violations": [v.model_dump() for v in policy_result.violations],
    })

    # --- STAGE 3: Grounding Verification ---
    grounding_result = verify_grounding(proposal.items)
    audit_trail.append({
        "stage": "GROUNDING_VERIFICATION",
        "verified": grounding_result.verified,
        "manifest_hash": grounding_result.manifest_hash,
        "unverified_items": grounding_result.unverified_items,
    })

    # --- STAGE 4: Confidence Gate ---
    confidence = compute_confidence(
        schema_valid=True,
        grounding_verified=grounding_result.verified,
        policy_passed=policy_result.passed,
        logprob_score=req.logprob_score,
        proposal_summary={"proposal_id": proposal.proposal_id, "total_price_paise": proposal.total_price_paise},
        constraint_summary={"max_amount_paise": constraints.spend_limit.max_amount_paise},
        grounding_details=grounding_result.details,
    )
    audit_trail.append({
        "stage": "CONFIDENCE_GATE",
        "decision": confidence.decision,
        "confidence_score": confidence.confidence_score,
        "scores": confidence.scores.model_dump(),
    })

    return GuardrailEvaluateResponse(
        decision=confidence.decision,
        confidence_score=confidence.confidence_score,
        schema_valid=True,
        policy_passed=policy_result.passed,
        grounding_verified=grounding_result.verified,
        policy_violations=[v.model_dump() for v in policy_result.violations],
        grounding_details=grounding_result.details,
        hitl_payload=confidence.hitl_payload.model_dump() if confidence.hitl_payload else None,
        audit_trail=audit_trail,
    )
