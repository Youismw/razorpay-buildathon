"""
Constraint Compiler FastAPI Service (Module 1)
POST /v1/compile — Converts natural language purchase intent into deterministic CompiledConstraints.
"""

from fastapi import FastAPI, HTTPException, status
from modules.constraint_compiler.models import CompileRequest, CompileResponse
from modules.constraint_compiler.compiler import compile_intent

app = FastAPI(title="Constraint Compiler Service", version="1.0.0")


@app.get("/healthz")
def healthz():
    return {"status": "ok", "service": "constraint-compiler"}


@app.post("/v1/compile", response_model=CompileResponse)
def compile_endpoint(req: CompileRequest):
    """
    Compile a natural language purchase intent into deterministic constraints (FR-CC-001).
    Returns CompiledConstraints with RFC 8785 canonical hash (FR-CC-002).
    """
    try:
        compiled, constraint_hash, canonical_json = compile_intent(req)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Failed to compile intent: {str(e)}"
        )

    return CompileResponse(
        intent_id=compiled.intent_id,
        compiled_constraints=compiled,
        constraint_hash=constraint_hash,
        canonical_json=canonical_json,
    )
