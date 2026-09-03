"""
UPI Payment Adapter — Unified FastAPI Service (Module 6)
Bridges AP2 Payment Mandates to Razorpay UPI Autopay.

Endpoints:
  POST /v1/adapter/charge     — Execute a debit against a registered mandate
  POST /v1/adapter/revoke     — Revoke a mandate atomically
  POST /v1/adapter/webhook    — Receive Razorpay webhook callbacks
  GET  /v1/adapter/mandate/:id — Query mandate state
"""

import json
from typing import Optional
from fastapi import FastAPI, HTTPException, Request, status
from pydantic import BaseModel, Field

from modules.upi_payment_adapter.razorpay_client import (
    RazorpayClient,
    RazorpayOrder,
    RazorpayRecurringCharge,
)
from modules.upi_payment_adapter.idempotency import IdempotencyStore, IdempotencyError
from modules.upi_payment_adapter.revocation import (
    RevocationEngine,
    MandateRevocationError,
)
from modules.upi_payment_adapter.webhooks import verify_razorpay_signature, parse_webhook_event


app = FastAPI(title="UPI Payment Adapter Service", version="1.0.0")

# Shared state (in production these would be backed by PostgreSQL)
_idempotency_store = IdempotencyStore()
_revocation_engine = RevocationEngine()
_razorpay_client = RazorpayClient()


class ChargeRequest(BaseModel):
    mandate_id: str
    idempotency_key: str
    amount_paise: int = Field(..., gt=0)
    token_id: str = Field(default="tok_demo_placeholder")
    description: str = Field(default="AP2 Mandate Debit")
    constraint_hash: Optional[str] = None


class ChargeResponse(BaseModel):
    success: bool
    debit_id: Optional[str] = None
    mandate_id: str
    amount_paise: int
    status: str
    razorpay_order_id: Optional[str] = None
    razorpay_payment_id: Optional[str] = None
    error: Optional[str] = None


class RevokeRequest(BaseModel):
    mandate_id: str
    reason: str = Field(default="User requested revocation")


class RegisterMandateRequest(BaseModel):
    mandate_id: str
    max_amount_paise: int = Field(..., gt=0)
    token_id: Optional[str] = None


@app.get("/healthz")
def healthz():
    return {"status": "ok", "service": "upi-payment-adapter"}


@app.post("/v1/adapter/register")
def register_mandate(req: RegisterMandateRequest):
    """Register a mandate for debit eligibility."""
    _revocation_engine.register_mandate(
        mandate_id=req.mandate_id,
        max_amount_paise=req.max_amount_paise,
        token_id=req.token_id,
    )
    return {"status": "registered", "mandate_id": req.mandate_id}


@app.post("/v1/adapter/charge", response_model=ChargeResponse)
def charge_mandate(req: ChargeRequest):
    """
    Execute a debit against a registered mandate (FR-UPI-001).
    Flow: Idempotency Check → Revocation Lock → Create Order → Recurring Payment.
    """

    # Step 1: Idempotency check (INV-003)
    try:
        debit_record = _idempotency_store.check_and_insert(
            mandate_id=req.mandate_id,
            idempotency_key=req.idempotency_key,
            amount_paise=req.amount_paise,
        )
    except IdempotencyError as e:
        # Return original result, do not re-process
        original = e.original_result
        return ChargeResponse(
            success=original.status == "SUCCESS",
            debit_id=original.debit_id,
            mandate_id=original.mandate_id,
            amount_paise=original.amount_paise,
            status=original.status,
            razorpay_order_id=original.razorpay_order_id,
            razorpay_payment_id=original.razorpay_payment_id,
            error="Duplicate idempotency key — returning original result",
        )

    # Step 2: Atomic mandate state check (INV-004)
    try:
        _revocation_engine.acquire_for_debit(
            mandate_id=req.mandate_id,
            amount_paise=req.amount_paise,
        )
    except MandateRevocationError as e:
        # Mandate was revoked — reject with 403 semantics
        _idempotency_store.update_status(
            req.mandate_id, req.idempotency_key, "FAILED"
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e),
        )
    except ValueError as e:
        _idempotency_store.update_status(
            req.mandate_id, req.idempotency_key, "FAILED"
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    # Step 3: Create Razorpay order
    order_result = _razorpay_client.create_order(RazorpayOrder(
        amount_paise=req.amount_paise,
        currency="INR",
        receipt=f"mandate_{req.mandate_id}_{req.idempotency_key}",
        notes={"mandate_id": req.mandate_id, "constraint_hash": req.constraint_hash or ""},
    ))

    if not order_result.success:
        _idempotency_store.update_status(
            req.mandate_id, req.idempotency_key, "FAILED"
        )
        return ChargeResponse(
            success=False,
            debit_id=debit_record.debit_id,
            mandate_id=req.mandate_id,
            amount_paise=req.amount_paise,
            status="FAILED",
            error=f"Order creation failed: {order_result.error}",
        )

    # Step 4: Execute recurring payment
    payment_result = _razorpay_client.create_recurring_payment(RazorpayRecurringCharge(
        razorpay_order_id=order_result.razorpay_order_id,
        token_id=req.token_id,
        amount_paise=req.amount_paise,
        description=req.description,
    ))

    final_status = "SUCCESS" if payment_result.success else "FAILED"
    _idempotency_store.update_status(
        req.mandate_id,
        req.idempotency_key,
        final_status,
        razorpay_payment_id=payment_result.razorpay_payment_id,
        razorpay_order_id=order_result.razorpay_order_id,
    )

    if payment_result.success:
        _revocation_engine.mark_settled(req.mandate_id)

    return ChargeResponse(
        success=payment_result.success,
        debit_id=debit_record.debit_id,
        mandate_id=req.mandate_id,
        amount_paise=req.amount_paise,
        status=final_status,
        razorpay_order_id=order_result.razorpay_order_id,
        razorpay_payment_id=payment_result.razorpay_payment_id,
        error=payment_result.error,
    )


@app.post("/v1/adapter/revoke")
def revoke_mandate(req: RevokeRequest):
    """Revoke a mandate atomically (INV-004). Wins any race against in-flight debits."""
    try:
        state = _revocation_engine.revoke(req.mandate_id, reason=req.reason)
        return {
            "status": "REVOKED",
            "mandate_id": req.mandate_id,
            "revoked_at": state.revoked_at,
        }
    except MandateRevocationError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@app.get("/v1/adapter/mandate/{mandate_id}")
def get_mandate_state(mandate_id: str):
    """Query current mandate state."""
    state = _revocation_engine.get_state(mandate_id)
    if state is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mandate not found")
    return state.model_dump()


@app.post("/v1/adapter/webhook")
async def receive_webhook(request: Request):
    """
    Receive and verify Razorpay webhook callback (FR-UPI-004).
    Verifies HMAC-SHA256 signature before processing.
    """
    body_bytes = await request.body()
    signature = request.headers.get("X-Razorpay-Signature", "")

    if not verify_razorpay_signature(body_bytes, signature):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid webhook signature",
        )

    try:
        body = json.loads(body_bytes)
    except json.JSONDecodeError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid JSON body")

    result = parse_webhook_event(body)
    return {
        "accepted": result.accepted,
        "event_type": result.event_type,
        "status": result.status,
    }
