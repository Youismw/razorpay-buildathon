"""
Shared runtime state and singleton services for the AP2 Orchestrator.
Eliminates circular imports between modular sub-routers and preserves in-memory state.
"""

import time
from typing import Any, Dict, List
from modules.upi_payment_adapter.revocation import RevocationEngine
from modules.upi_payment_adapter.webhooks import WEBHOOK_SECRET
from modules.upi_payment_adapter.razorpay_client import RazorpayClient, _get_credentials
from modules.upi_payment_adapter.idempotency import IdempotencyStore

# Global catalog version timestamp for cache invalidation
CATALOG_VERSION: float = time.time()


def get_catalog_version() -> float:
    """Return the current timestamp version of the global catalog."""
    global CATALOG_VERSION
    return CATALOG_VERSION


def touch_catalog_version() -> float:
    """Bump the catalog version timestamp and return the new version."""
    global CATALOG_VERSION
    CATALOG_VERSION = time.time()
    return CATALOG_VERSION


# Initialize revocation mutex lock engine (INV-004)
revocation_engine = RevocationEngine()

# Initialize Idempotency store (INV-003)
_orchestrator_idempotency_store = IdempotencyStore()

# Initialize Razorpay Client for live S2S Standard Checkout and UPI Autopay
_razorpay_client = RazorpayClient()

LIVE_MANDATES: List[Dict[str, Any]] = [
    {
        "id": "mnd_2026_08_a7f3",
        "merchant_id": "demo-merchant.myshopify.com",
        "max_amount_inr": 5000.0,
        "state": "PAYMENT_ACTIVE",
        "created_at": "2026-09-01T10:14:22Z",
    },
    {
        "id": "mnd_2026_08_b912",
        "merchant_id": "demo-merchant.myshopify.com",
        "max_amount_inr": 25000.0,
        "state": "PAYMENT_ACTIVE",
        "created_at": "2026-09-01T12:30:11Z",
    },
    {
        "id": "mnd_2026_08_c441",
        "merchant_id": "demo-merchant.myshopify.com",
        "max_amount_inr": 10000.0,
        "state": "REVOKED",
        "created_at": "2026-08-30T16:20:00Z",
    },
]

# Pre-register default active mandates in engine
revocation_engine.register_mandate("mnd_2026_08_a7f3", 500000)
revocation_engine.register_mandate("mnd_2026_08_b912", 2500000)
revocation_engine.register_mandate("mnd_2026_08_c441", 1000000)
try:
    revocation_engine.revoke("mnd_2026_08_c441", reason="Initial test revocation")
except Exception:
    pass

_current_buyer_profile: Dict[str, Any] = {
    "buyerDid": "agent-buyer-rohit@ap2",
    "maxTransactionAmountInr": 15000.0,
    "dailyBudgetInr": 50000.0,
    "userPin": "1234",
    "autonomyMode": "ask_above_limit",
    "favoriteBrands": ["Sony", "Amul", "Blue Tokai", "Organic India"],
    "staples": [
        {"id": "staple-1", "name": "Amul Taaza Milk (1L)", "brand": "Amul", "frequency": "Weekly", "maxPriceInr": 70.0, "autoBuy": True},
        {"id": "staple-2", "name": "Blue Tokai Coffee Beans", "brand": "Blue Tokai", "frequency": "Bi-weekly", "maxPriceInr": 500.0, "autoBuy": False},
    ],
}
