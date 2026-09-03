"""
UPI Payment Adapter — Webhook Handler (FR-UPI-004)
Verifies Razorpay webhook HMAC-SHA256 signature.
On payment.captured → ledger SETTLED.
On payment.failed → ledger FAILED.
"""

import os
import hashlib
import hmac
from typing import Any, Dict, Optional
from pydantic import BaseModel, Field


WEBHOOK_SECRET = os.environ.get("RAZORPAY_WEBHOOK_SECRET", "webhook_secret_dev_placeholder")


class WebhookEvent(BaseModel):
    event: str
    payload: Dict[str, Any] = Field(default_factory=dict)
    account_id: Optional[str] = None


class WebhookResult(BaseModel):
    accepted: bool
    event_type: str
    payment_id: Optional[str] = None
    order_id: Optional[str] = None
    status: Optional[str] = None
    error: Optional[str] = None


def verify_razorpay_signature(payload_body: bytes, signature: str, secret: Optional[str] = None) -> bool:
    """
    Verify Razorpay webhook HMAC-SHA256 signature.
    Fail-closed: returns False on any error.
    """
    try:
        webhook_secret = secret or WEBHOOK_SECRET
        expected = hmac.new(
            webhook_secret.encode("utf-8"),
            payload_body,
            hashlib.sha256,
        ).hexdigest()
        return hmac.compare_digest(expected, signature)
    except Exception:
        return False


def parse_webhook_event(body: Dict[str, Any]) -> WebhookResult:
    """
    Parse a Razorpay webhook event and extract payment status.
    Handles: payment.captured, payment.failed, payment.authorized.
    """
    event_type = body.get("event", "unknown")
    payment_entity = (
        body.get("payload", {})
        .get("payment", {})
        .get("entity", {})
    )

    payment_id = payment_entity.get("id")
    order_id = payment_entity.get("order_id")

    if event_type == "payment.captured":
        return WebhookResult(
            accepted=True,
            event_type=event_type,
            payment_id=payment_id,
            order_id=order_id,
            status="SETTLED",
        )
    elif event_type == "payment.failed":
        error_desc = (
            payment_entity.get("error_description")
            or payment_entity.get("error_reason")
            or "Payment failed"
        )
        return WebhookResult(
            accepted=True,
            event_type=event_type,
            payment_id=payment_id,
            order_id=order_id,
            status="FAILED",
            error=error_desc,
        )
    elif event_type == "payment.authorized":
        return WebhookResult(
            accepted=True,
            event_type=event_type,
            payment_id=payment_id,
            order_id=order_id,
            status="AUTHORIZED",
        )
    else:
        return WebhookResult(
            accepted=False,
            event_type=event_type,
            error=f"Unhandled webhook event type: {event_type}",
        )
