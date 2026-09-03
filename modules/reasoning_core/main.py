"""
Reasoning Core — FastAPI Service (Module 2)
POST /v1/reason — Generate a structured ProposalObject from CompiledConstraints.
"""

from fastapi import FastAPI, HTTPException, status
from modules.reasoning_core.agent import ReasoningRequest, ReasoningResponse, generate_proposal_sync
from modules.constraint_compiler.models import CompiledConstraints

app = FastAPI(title="Reasoning Core Service", version="1.0.0")


@app.get("/healthz")
def healthz():
    return {"status": "ok", "service": "reasoning-core"}


@app.post("/v1/reason", response_model=ReasoningResponse)
def reason_endpoint(req: ReasoningRequest):
    """Generate a ProposalObject from compiled constraints using the configured LLM provider."""
    try:
        constraints = CompiledConstraints(**req.compiled_constraints)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid compiled constraints: {str(e)}"
        )

    response = generate_proposal_sync(
        constraints=constraints,
        catalog=req.merchant_context,
        provider=req.llm_provider,
    )
    return response
