"""
UPI Payment Adapter — Razorpay Client (SDD §6, FR-UPI-001)
Maps AP2 Payment Mandates to Razorpay UPI Autopay S2S API (Test Mode).

Endpoints used:
  - POST /v1/orders (create order)
  - POST /v1/payments/create/recurring (execute recurring charge)
  - GET  /v1/payments/:id (fetch payment status)
"""

import os
import hashlib
import hmac
import uuid
from typing import Any, Dict, Optional, Tuple
from pydantic import BaseModel, Field
import httpx


RAZORPAY_BASE_URL = "https://api.razorpay.com"

# Test mode credentials loaded from environment
def _get_credentials() -> Tuple[str, str]:
    key_id = os.environ.get("RAZORPAY_KEY_ID") or os.environ.get("RAZORPAY_TEST_KEY_ID", "rzp_test_placeholder")
    key_secret = os.environ.get("RAZORPAY_KEY_SECRET") or os.environ.get("RAZORPAY_TEST_KEY_SECRET", "placeholder_secret")
    return key_id, key_secret


class RazorpayOrder(BaseModel):
    amount_paise: int = Field(..., gt=0)
    currency: str = Field(default="INR")
    receipt: str = Field(default="")
    notes: Dict[str, str] = Field(default_factory=dict)


class RazorpayRecurringCharge(BaseModel):
    razorpay_order_id: str
    token_id: str
    amount_paise: int = Field(..., gt=0)
    currency: str = Field(default="INR")
    description: str = Field(default="AP2 Mandate Debit")
    customer_id: Optional[str] = None


class RazorpayClientResponse(BaseModel):
    success: bool
    razorpay_order_id: Optional[str] = None
    razorpay_payment_id: Optional[str] = None
    refund_id: Optional[str] = None
    status: Optional[str] = None
    raw_response: Dict[str, Any] = Field(default_factory=dict)
    error: Optional[str] = None


class RazorpayClient:
    """
    Razorpay S2S API client for UPI Autopay recurring payments.
    Uses httpx for async-capable HTTP calls with Basic Auth.
    """

    def __init__(self, key_id: Optional[str] = None, key_secret: Optional[str] = None):
        if key_id and key_secret:
            self._key_id = key_id
            self._key_secret = key_secret
        else:
            self._key_id, self._key_secret = _get_credentials()

        self._base_url = RAZORPAY_BASE_URL
        self._auth = (self._key_id, self._key_secret)

    def _headers(self) -> Dict[str, str]:
        return {"Content-Type": "application/json"}

    def create_order(self, order: RazorpayOrder) -> RazorpayClientResponse:
        """Create a Razorpay order for the mandate debit."""
        payload = {
            "amount": order.amount_paise,
            "currency": order.currency,
            "receipt": order.receipt or f"rcpt_{uuid.uuid4().hex[:12]}",
            "notes": order.notes,
        }

        try:
            with httpx.Client(timeout=30.0) as client:
                resp = client.post(
                    f"{self._base_url}/v1/orders",
                    json=payload,
                    auth=self._auth,
                    headers=self._headers(),
                )
                data = resp.json()

                if resp.status_code == 200:
                    return RazorpayClientResponse(
                        success=True,
                        razorpay_order_id=data.get("id"),
                        status=data.get("status"),
                        raw_response=data,
                    )
                else:
                    return RazorpayClientResponse(
                        success=False,
                        error=data.get("error", {}).get("description", resp.text),
                        raw_response=data,
                    )
        except Exception as e:
            return RazorpayClientResponse(success=False, error=str(e))

    def create_recurring_payment(self, charge: RazorpayRecurringCharge) -> RazorpayClientResponse:
        """Execute a recurring charge against a registered UPI Autopay token."""
        payload = {
            "email": "buyer@ap2bridge.dev",
            "contact": "9999999999",
            "amount": charge.amount_paise,
            "currency": charge.currency,
            "order_id": charge.razorpay_order_id,
            "customer_id": charge.customer_id or os.environ.get("RAZORPAY_CUSTOMER_ID", "cust_ap2_buyer"),
            "token": charge.token_id,
            "recurring": "1",
            "description": charge.description,
        }

        try:
            with httpx.Client(timeout=30.0) as client:
                resp = client.post(
                    f"{self._base_url}/v1/payments/create/recurring",
                    json=payload,
                    auth=self._auth,
                    headers=self._headers(),
                )
                data = resp.json()

                if resp.status_code in (200, 201):
                    return RazorpayClientResponse(
                        success=True,
                        razorpay_payment_id=data.get("razorpay_payment_id", data.get("id")),
                        razorpay_order_id=charge.razorpay_order_id,
                        status=data.get("status"),
                        raw_response=data,
                    )
                else:
                    return RazorpayClientResponse(
                        success=False,
                        razorpay_order_id=charge.razorpay_order_id,
                        error=data.get("error", {}).get("description", resp.text),
                        raw_response=data,
                    )
        except Exception as e:
            return RazorpayClientResponse(
                success=False,
                razorpay_order_id=charge.razorpay_order_id,
                error=str(e),
            )

    def fetch_payment(self, payment_id: str) -> RazorpayClientResponse:
        """Fetch payment status by Razorpay payment ID."""
        try:
            with httpx.Client(timeout=30.0) as client:
                resp = client.get(
                    f"{self._base_url}/v1/payments/{payment_id}",
                    auth=self._auth,
                    headers=self._headers(),
                )
                data = resp.json()
                return RazorpayClientResponse(
                    success=resp.status_code == 200,
                    razorpay_payment_id=payment_id,
                    status=data.get("status"),
                    raw_response=data,
                    error=None if resp.status_code == 200 else data.get("error", {}).get("description"),
                )
        except Exception as e:
            return RazorpayClientResponse(success=False, error=str(e))

    def fetch_order(self, order_id: str) -> RazorpayClientResponse:
        """Fetch order status by Razorpay order ID."""
        try:
            with httpx.Client(timeout=30.0) as client:
                resp = client.get(
                    f"{self._base_url}/v1/orders/{order_id}",
                    auth=self._auth,
                    headers=self._headers(),
                )
                data = resp.json()
                return RazorpayClientResponse(
                    success=resp.status_code == 200,
                    razorpay_order_id=order_id,
                    status=data.get("status"),
                    raw_response=data,
                    error=None if resp.status_code == 200 else data.get("error", {}).get("description"),
                )
        except Exception as e:
            return RazorpayClientResponse(success=False, error=str(e))

    def create_refund(
        self,
        payment_id: str,
        amount_paise: Optional[int] = None,
        notes: Optional[Dict[str, str]] = None,
    ) -> RazorpayClientResponse:
        """Create a full or partial refund for a captured payment."""
        payload: Dict[str, Any] = {}
        if amount_paise is not None:
            payload["amount"] = amount_paise
        if notes:
            payload["notes"] = notes

        try:
            with httpx.Client(timeout=30.0) as client:
                resp = client.post(
                    f"{self._base_url}/v1/payments/{payment_id}/refund",
                    json=payload,
                    auth=self._auth,
                    headers=self._headers(),
                )
                data = resp.json()
                return RazorpayClientResponse(
                    success=resp.status_code in (200, 201),
                    razorpay_payment_id=payment_id,
                    refund_id=data.get("id"),
                    status=data.get("status"),
                    raw_response=data,
                    error=None if resp.status_code in (200, 201) else data.get("error", {}).get("description"),
                )
        except Exception as e:
            return RazorpayClientResponse(success=False, error=str(e))

    @staticmethod
    def verify_webhook_signature(payload_body: bytes, signature: str, webhook_secret: str) -> bool:
        """
        Verify Razorpay webhook HMAC-SHA256 signature.
        Returns True only if signature matches. Fail-closed on any error.
        """
        try:
            expected = hmac.new(
                webhook_secret.encode("utf-8"),
                payload_body,
                hashlib.sha256,
            ).hexdigest()
            return hmac.compare_digest(expected, signature)
        except Exception:
            return False

    @staticmethod
    def verify_payment_signature(order_id: str, payment_id: str, signature: str, secret: str) -> bool:
        """
        Verify Razorpay Standard Checkout HMAC-SHA256 signature:
        generated_signature = HMAC_SHA256(order_id + "|" + payment_id, secret)
        """
        try:
            msg = f"{order_id}|{payment_id}".encode("utf-8")
            expected = hmac.new(secret.encode("utf-8"), msg, hashlib.sha256).hexdigest()
            return hmac.compare_digest(expected, signature)
        except Exception:
            return False

