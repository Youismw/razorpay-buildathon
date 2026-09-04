import uuid
import datetime
import json
import threading
from typing import Any, Dict, List, Optional
from fastapi import FastAPI, HTTPException, Response
from pydantic import BaseModel
from modules.ledger.writer import calculate_audit_hash

app = FastAPI(title="External Persistent Ledger Service", version="1.0.0")

# Primary in-memory store for hermetic fast path & fallback
_in_memory_audit_log: List[Dict[str, Any]] = []
_in_memory_mandates: Dict[str, Dict[str, Any]] = {}
_in_memory_debits: Dict[str, Dict[str, Any]] = {}
_last_hash: str = "0" * 64
_ledger_chain_lock = threading.Lock()


class AuditEventRequest(BaseModel):
    source_component: str
    event_type: str
    mandate_id: Optional[str] = None
    transaction_id: Optional[str] = None
    constraint_hash: Optional[str] = None
    llm_invocation_id: Optional[str] = None
    payload: Dict[str, Any]


class AuditEventResponse(BaseModel):
    event_id: str
    source_component: str
    event_type: str
    mandate_id: Optional[str] = None
    transaction_id: Optional[str] = None
    constraint_hash: Optional[str] = None
    previous_hash: str
    hash: str
    created_at: str


class MandateRecord(BaseModel):
    mandate_id: str
    state: str = "INTENT_RECORDED"
    mandate_type: str = "INTENT"
    constraint_hash: str
    max_amount: float
    merchant_scope: List[str] = []
    validity_window_hours: int = 24
    expire_at: str
    token_id: Optional[str] = None
    buyer_did: Optional[str] = None
    merchant_did: Optional[str] = None
    signed_jws: Optional[str] = None


@app.get("/healthz")
def healthz():
    return {"status": "ok", "service": "ledger", "events_count": len(_in_memory_audit_log)}


@app.post("/v1/audit/event", response_model=AuditEventResponse)
def record_audit_event(req: AuditEventRequest):
    """Record an immutable, hash-chained audit event (DR-001, DR-003, DR-006)."""
    global _last_hash
    
    event_id = str(uuid.uuid4())
    ts = datetime.datetime.now(datetime.timezone.utc).isoformat()
    
    with _ledger_chain_lock:
        prev_hash = _last_hash
        current_hash = calculate_audit_hash(prev_hash, req.payload)
        event_record = {
            "event_id": event_id,
            "source_component": req.source_component,
            "event_type": req.event_type,
            "mandate_id": req.mandate_id,
            "transaction_id": req.transaction_id,
            "constraint_hash": req.constraint_hash,
            "llm_invocation_id": req.llm_invocation_id,
            "payload": req.payload,
            "previous_hash": prev_hash,
            "hash": current_hash,
            "created_at": ts,
        }
        _in_memory_audit_log.append(event_record)
        _last_hash = current_hash
    
    return AuditEventResponse(
        event_id=event_id,
        source_component=req.source_component,
        event_type=req.event_type,
        mandate_id=req.mandate_id,
        transaction_id=req.transaction_id,
        constraint_hash=req.constraint_hash,
        previous_hash=prev_hash,
        hash=current_hash,
        created_at=ts,
    )


@app.post("/v1/mandates")
def create_or_update_mandate(mandate: MandateRecord):
    """SSOT for Mandate Lifecycle (INTENT_RECORDED -> CART_APPROVED -> PAYMENT_ACTIVE -> SETTLED / REVOKED / EXPIRED)."""
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    m_dict = mandate.model_dump()
    m_dict["updated_at"] = now_iso
    if mandate.mandate_id not in _in_memory_mandates:
        m_dict["created_at"] = now_iso
    _in_memory_mandates[mandate.mandate_id] = m_dict
    return {"status": "success", "mandate": m_dict}


@app.get("/v1/mandates/{mandate_id}")
def get_mandate(mandate_id: str):
    if mandate_id not in _in_memory_mandates:
        raise HTTPException(status_code=404, detail="Mandate not found")
    return _in_memory_mandates[mandate_id]


@app.post("/v1/mandates/{mandate_id}/revoke")
def revoke_mandate(mandate_id: str, reason: str = "User requested cancellation"):
    """Revoke a mandate immediately (INV-004)."""
    if mandate_id not in _in_memory_mandates:
        raise HTTPException(status_code=404, detail="Mandate not found")
    
    mandate = _in_memory_mandates[mandate_id]
    mandate["state"] = "REVOKED"
    mandate["updated_at"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
    
    # Record revocation event in audit log
    record_audit_event(AuditEventRequest(
        source_component="ledger",
        event_type="MANDATE_REVOKED",
        mandate_id=mandate_id,
        payload={"reason": reason, "previous_state": mandate.get("state")}
    ))
    return {"status": "revoked", "mandate_id": mandate_id, "state": "REVOKED"}


@app.get("/ledger/export")
def export_ledger_jsonl():
    """Canonical audit export format SHALL be JSONL, viewable/streamable live (DR-004)."""
    lines = [json.dumps(event) for event in _in_memory_audit_log]
    jsonl_content = "\n".join(lines)
    return Response(content=jsonl_content, media_type="application/x-ndjson")
