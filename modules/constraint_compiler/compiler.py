"""
Constraint Compiler Core Logic (FR-CC-002, FR-CC-003)
Compiles natural language purchase intent into deterministic, hashed CompiledConstraints.

For Thread 0 MVP: uses regex/heuristic extraction with optional LLM structured decoding.
"""

import re
import uuid
import datetime
from typing import Optional, Tuple

from modules.constraint_compiler.models import (
    CompiledConstraints,
    CompileRequest,
    SpendLimit,
    MerchantScope,
    ValidityWindow,
)
from modules.ledger.writer import canonicalize_json, compute_sha256


# Common INR amount patterns (supports decimals e.g. 499.50)
_AMOUNT_PATTERNS = [
    r"(?:under|below|less than|max|maximum|upto|up to|within|budget)\s*(?:rs\.?|₹|inr)?\s*(\d[\d,]*(?:\.\d{1,2})?)",
    r"(?:rs\.?|₹|inr)\s*(\d[\d,]*(?:\.\d{1,2})?)",
    r"(\d[\d,]*(?:\.\d{1,2})?)\s*(?:rs\.?|₹|inr|rupees|rupee)",
]

# Common product keywords to strip when extracting the product query
_INTENT_PREFIXES = [
    r"^(?:buy|purchase|order|get|find|search for|look for|i want|i need|i'd like)\s+",
    r"^(?:me\s+)?(?:a|an|the|some)\s+",
]


def extract_amount_from_intent(raw_intent: str) -> Optional[int]:
    """Extract max spend amount in paise from natural language intent."""
    text = raw_intent.lower().strip()
    # Strip unit rate specifications e.g. (Rate: ₹72/L) or @ ₹50/unit so they are not mistaken for spend ceilings
    text = re.sub(r'\(?\s*rate\s*:\s*(?:rs\.?|₹|inr)?\s*\d+(?:\.\d{1,2})?(?:\s*/\s*[a-zA-Z]+)?\s*\)?', '', text, flags=re.I)
    text = re.sub(r'(?:rs\.?|₹|inr)?\s*\d+(?:\.\d{1,2})?\s*/\s*(?:l|liter|litres|kg|g|gm|unit|pc|piece|pack|box)\b', '', text, flags=re.I)
    for pattern in _AMOUNT_PATTERNS:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            amount_str = match.group(1).replace(",", "")
            try:
                amount_inr = float(amount_str)
                return int(amount_inr * 100)  # Convert to paise
            except ValueError:
                continue
    return None


def extract_quantity_from_intent(raw_intent: str) -> int:
    """Extract item quantity if specified in natural language (e.g. '2 units', '3 bottles', '3L of milk', 'buy 2 headphones')."""
    text = raw_intent.strip()
    m = re.search(r"\b(\d+)\s*(?:l|liter|liters|litre|litres|kg|kgs|g|gm|ml|units?|items?|packs?|packets?|pcs?|pieces?|bottles?|pairs?|boxes?)\b", text, re.IGNORECASE)
    if m:
        try:
            val = int(m.group(1))
            if val > 0:
                return val
        except ValueError:
            pass
    m2 = re.search(r"\b(?:buy|order|get|purchase)\s+(\d+)\s*(?:l|liter|liters|litre|litres|kg|kgs|g|gm|ml)?\s+(?:of\s+)?([a-zA-Z]+)", text, re.IGNORECASE)
    if m2:
        try:
            val = int(m2.group(1))
            if val > 0:
                return val
        except ValueError:
            pass
    return 1


def extract_product_query(raw_intent: str) -> str:
    """Extract the product search query by stripping intent prefixes, rate clauses, and amount clauses."""
    text = raw_intent.strip()
    for prefix in _INTENT_PREFIXES:
        text = re.sub(prefix, "", text, flags=re.IGNORECASE).strip()
    # Strip rate expressions like (Rate: ₹72/L) or Rate: 72/unit
    text = re.sub(r"[\(\[\{]?\s*rate\s*:\s*(?:rs\.?|₹|inr)?\s*\d+(?:\.\d{1,2})?(?:\s*/\s*[a-zA-Z]+)?\s*[\)\]\}]?", "", text, flags=re.IGNORECASE).strip()
    text = re.sub(r"(?:rs\.?|₹|inr)?\s*\d+(?:\.\d{1,2})?\s*/\s*(?:l|liter|litres|kg|g|gm|unit|pc|piece|pack|box)\b", "", text, flags=re.IGNORECASE).strip()
    # Remove quantity clauses including volume/mass units
    text = re.sub(r"^\d+\s*(?:l|liter|liters|litre|litres|kg|kgs|g|gm|ml|units?|items?|packs?|packets?|pcs?|pieces?|bottles?|pairs?|boxes?)\s+(?:of\s+)?", "", text, flags=re.IGNORECASE).strip()
    text = re.sub(r"^\d+\s+(?:of\s+)?", "", text, flags=re.IGNORECASE).strip()
    # Remove amount clauses
    for pattern in _AMOUNT_PATTERNS:
        text = re.sub(pattern, "", text, flags=re.IGNORECASE).strip()
    # Clean up trailing prepositions left behind
    text = re.sub(r"\s+(under|below|less than|from|at|for)\s*$", "", text, flags=re.IGNORECASE).strip()
    return text if text else raw_intent.strip()


def compile_intent(req: CompileRequest) -> Tuple[CompiledConstraints, str, str]:
    """
    Compile a natural language intent into deterministic CompiledConstraints.
    Returns (compiled_constraints, constraint_hash, canonical_json_str).
    """
    now = datetime.datetime.now(datetime.timezone.utc)
    intent_id = f"intent-{uuid.uuid4().hex[:12]}"

    # 1. Extract or use explicit max spend
    if req.max_spend_inr is not None:
        max_paise = int(req.max_spend_inr * 100)
    else:
        extracted = extract_amount_from_intent(req.raw_intent)
        max_paise = extracted if extracted else 500000  # Default 5000 INR

    spend_limit = SpendLimit(max_amount_paise=max_paise, currency="INR")

    # 2. Merchant scope
    merchant_scope = MerchantScope(
        allowed_merchants=req.allowed_merchants or [],
        category_blocklist=req.category_blocklist or [],
    )

    # 3. Validity window
    validity_hours = req.validity_hours or 24
    valid_from = now.isoformat()
    valid_until = (now + datetime.timedelta(hours=validity_hours)).isoformat()
    validity_window = ValidityWindow(
        valid_from_iso=valid_from,
        valid_until_iso=valid_until,
        validity_window_hours=validity_hours,
    )

    # 4. Quantity extraction (Bug 34)
    if getattr(req, "quantity", None) is not None:
        target_quantity = req.quantity
    else:
        target_quantity = extract_quantity_from_intent(req.raw_intent)

    # 5. Product query extraction
    product_query = extract_product_query(req.raw_intent)

    # 6. Build CompiledConstraints (hard constraints only, soft preferences empty for Thread 0)
    compiled = CompiledConstraints(
        intent_id=intent_id,
        raw_intent=req.raw_intent,
        spend_limit=spend_limit,
        merchant_scope=merchant_scope,
        validity_window=validity_window,
        product_query=product_query,
        quantity=target_quantity,
        soft_preferences=[],
        compiled_at_iso=now.isoformat(),
    )

    # 6. Compute canonical hash (FR-CC-002: RFC 8785 + SHA-256)
    # Hash only the hard constraint fields to ensure determinism
    hashable_dict = {
        "intent_id": compiled.intent_id,
        "spend_limit": compiled.spend_limit.model_dump(),
        "merchant_scope": compiled.merchant_scope.model_dump(),
        "validity_window": compiled.validity_window.model_dump(),
        "product_query": compiled.product_query,
        "quantity": compiled.quantity,
    }
    canonical_json_str = canonicalize_json(hashable_dict)
    constraint_hash = compute_sha256(canonical_json_str)
    compiled.constraint_hash = constraint_hash

    return compiled, constraint_hash, canonical_json_str
