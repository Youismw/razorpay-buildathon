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
    token_id: Optional[str] = None
    customer_id: Optional[str] = None
    max_amount_paise: Optional[int] = None
    vpa: Optional[str] = None
    umn: Optional[str] = None
    status: Optional[str] = None
    error: Optional[str] = None
    raw_payload: Dict[str, Any] = Field(default_factory=dict)


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
    - UPI Autopay / Mandate events: mandate.authenticated, mandate.active, mandate.revoked, mandate.paused, token.confirmed
    - Subscription events: subscription.authenticated, subscription.activated, subscription.cancelled, subscription.paused
    """
    event_type = body.get("event", "unknown")
    payload = body.get("payload", {})
    payment_entity = payload.get("payment", {}).get("entity", {})
    mandate_entity = payload.get("mandate", {}).get("entity", {})
    subscription_entity = payload.get("subscription", {}).get("entity", {})
    token_entity = payload.get("token", {}).get("entity", {})

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
    token_id = (
        token_entity.get("id")
        or mandate_entity.get("token_id")
        or payment_entity.get("token_id")
    )
    customer_id = (
        token_entity.get("customer_id")
        or payment_entity.get("customer_id")
        or mandate_entity.get("customer_id")
    )
    umn = (
        mandate_entity.get("umn")
        or payment_entity.get("umn")
        or mandate_entity.get("mandate_number")
        or (f"UMN-NPCI-{mandate_id.replace('man_', '').replace('mandate-', '')[:10].upper()}" if mandate_id else None)
    )
    max_amount_paise = (
        mandate_entity.get("max_amount")
        or token_entity.get("max_amount")
        or payment_entity.get("amount")
    )
    vpa = (
        payment_entity.get("vpa")
        or token_entity.get("vpa")
        or mandate_entity.get("vpa")
    )

    if event_type == "payment.captured":
        return WebhookResult(
            accepted=True,
            event_type=event_type,
            payment_id=payment_id,
            order_id=order_id,
            mandate_id=mandate_id,
            token_id=token_id,
            customer_id=customer_id,
            max_amount_paise=max_amount_paise,
            vpa=vpa,
            umn=umn,
            status="SETTLED",
            raw_payload=payload,
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
            token_id=token_id,
            customer_id=customer_id,
            max_amount_paise=max_amount_paise,
            vpa=vpa,
            umn=umn,
            status="FAILED",
            error=error_desc,
            raw_payload=payload,
        )
    elif event_type == "payment.authorized":
        return WebhookResult(
            accepted=True,
            event_type=event_type,
            payment_id=payment_id,
            order_id=order_id,
            mandate_id=mandate_id,
            token_id=token_id,
            customer_id=customer_id,
            max_amount_paise=max_amount_paise,
            vpa=vpa,
            umn=umn,
            status="AUTHORIZED",
            raw_payload=payload,
        )
    elif event_type in (
        "mandate.authenticated",
        "mandate.active",
        "token.confirmed",
        "subscription.authenticated",
        "subscription.activated",
    ):
        return WebhookResult(
            accepted=True,
            event_type=event_type,
            payment_id=payment_id,
            order_id=order_id,
            mandate_id=mandate_id,
            token_id=token_id,
            customer_id=customer_id,
            max_amount_paise=max_amount_paise,
            vpa=vpa,
            umn=umn,
            status="ACTIVE",
            raw_payload=payload,
        )
    elif event_type in ("mandate.revoked", "subscription.cancelled", "subscription.halted", "token.rejected"):
        return WebhookResult(
            accepted=True,
            event_type=event_type,
            payment_id=payment_id,
            order_id=order_id,
            mandate_id=mandate_id,
            token_id=token_id,
            customer_id=customer_id,
            max_amount_paise=max_amount_paise,
            vpa=vpa,
            umn=umn,
            status="REVOKED",
            raw_payload=payload,
        )
    elif event_type in ("mandate.paused", "subscription.paused"):
        return WebhookResult(
            accepted=True,
            event_type=event_type,
            payment_id=payment_id,
            order_id=order_id,
            mandate_id=mandate_id,
            token_id=token_id,
            customer_id=customer_id,
            max_amount_paise=max_amount_paise,
            vpa=vpa,
            umn=umn,
            status="PAUSED",
            raw_payload=payload,
        )
    else:
        return WebhookResult(
            accepted=False,
            event_type=event_type,
            error=f"Unhandled webhook event type: {event_type}",
            raw_payload=payload,
        )
