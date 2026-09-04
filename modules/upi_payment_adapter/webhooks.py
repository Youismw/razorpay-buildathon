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
    mandate_id: Optional[str] = None
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
    Parse a Razorpay webhook event and extract payment/mandate status.
    Handles:
    - Payment events: payment.captured, payment.failed, payment.authorized
    - UPI Autopay / Mandate events: mandate.authenticated, mandate.active, mandate.revoked, mandate.paused
    - Subscription events: subscription.authenticated, subscription.activated, subscription.cancelled, subscription.paused
    """
    event_type = body.get("event", "unknown")
    payload = body.get("payload", {})
    payment_entity = payload.get("payment", {}).get("entity", {})
    mandate_entity = payload.get("mandate", {}).get("entity", {})
    subscription_entity = payload.get("subscription", {}).get("entity", {})

    payment_id = payment_entity.get("id")
    order_id = (
        payment_entity.get("order_id")
        or mandate_entity.get("order_id")
        or subscription_entity.get("order_id")
    )
    mandate_id = (
        mandate_entity.get("id")
        or subscription_entity.get("id")
        or payment_entity.get("mandate_id")
    )

    if event_type == "payment.captured":
        return WebhookResult(
            accepted=True,
            event_type=event_type,
            payment_id=payment_id,
            order_id=order_id,
            mandate_id=mandate_id,
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
            mandate_id=mandate_id,
            status="FAILED",
            error=error_desc,
        )
    elif event_type == "payment.authorized":
        return WebhookResult(
            accepted=True,
            event_type=event_type,
            payment_id=payment_id,
            order_id=order_id,
            mandate_id=mandate_id,
            status="AUTHORIZED",
        )
    elif event_type in ("mandate.authenticated", "mandate.active", "subscription.authenticated", "subscription.activated"):
        return WebhookResult(
            accepted=True,
            event_type=event_type,
            payment_id=payment_id,
            order_id=order_id,
            mandate_id=mandate_id,
            status="ACTIVE",
        )
    elif event_type in ("mandate.revoked", "subscription.cancelled", "subscription.halted"):
        return WebhookResult(
            accepted=True,
            event_type=event_type,
            payment_id=payment_id,
            order_id=order_id,
            mandate_id=mandate_id,
            status="REVOKED",
        )
    elif event_type in ("mandate.paused", "subscription.paused"):
        return WebhookResult(
            accepted=True,
            event_type=event_type,
            payment_id=payment_id,
            order_id=order_id,
            mandate_id=mandate_id,
            status="PAUSED",
        )
    else:
        return WebhookResult(
            accepted=False,
            event_type=event_type,
            error=f"Unhandled webhook event type: {event_type}",
        )
