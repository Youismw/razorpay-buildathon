"""
Guardrail Shell — Policy Engine (FR-GRD-002, INV-010)
Pure deterministic Python. Zero LLM trust.
Re-checks offer_price <= max_spend, merchant_id in allowed_merchants, valid_until > now.
"""

import datetime
from typing import Any, List
from pydantic import BaseModel, Field
from modules.guardrail_shell.schema_validator import ProposalObject
from modules.constraint_compiler.models import CompiledConstraints


class PolicyViolation(BaseModel):
    code: str
    message: str
    field: str
    actual_value: Any = None
    allowed_value: Any = None


class PolicyResult(BaseModel):
    passed: bool
    violations: List[PolicyViolation] = Field(default_factory=list)


def enforce_policy(
    proposal: ProposalObject,
    constraints: CompiledConstraints,
) -> PolicyResult:
    """
    Deterministic policy enforcement (INV-010).
    The Policy Engine has absolute authority over spending bounds.
    No LLM output, confidence score, or reasoning can override these checks.
    """
    violations: List[PolicyViolation] = []
    now = datetime.datetime.now(datetime.timezone.utc)

    # --- CHECK 1: Total spend must not exceed max_spend (INV-010) ---
    if proposal.total_price_paise > constraints.spend_limit.max_amount_paise:
        violations.append(PolicyViolation(
            code="MAX_SPEND_EXCEEDED",
            message=(
                f"Total price {proposal.total_price_paise} paise exceeds "
                f"max allowed {constraints.spend_limit.max_amount_paise} paise"
            ),
            field="total_price_paise",
            actual_value=proposal.total_price_paise,
            allowed_value=constraints.spend_limit.max_amount_paise,
        ))

    # --- CHECK 2: Each item price must not individually exceed max_spend ---
    for i, item in enumerate(proposal.items):
        item_total = item.offer_price_paise * item.quantity
        if item_total > constraints.spend_limit.max_amount_paise:
            violations.append(PolicyViolation(
                code="ITEM_SPEND_EXCEEDED",
                message=(
                    f"Item '{item.product_name}' total {item_total} paise "
                    f"exceeds max allowed {constraints.spend_limit.max_amount_paise} paise"
                ),
                field=f"items[{i}].offer_price_paise",
                actual_value=item_total,
                allowed_value=constraints.spend_limit.max_amount_paise,
            ))

    # --- CHECK 3: Merchant allowlist (if specified) ---
    if constraints.merchant_scope.allowed_merchants:
        for i, item in enumerate(proposal.items):
            if item.merchant_id not in constraints.merchant_scope.allowed_merchants:
                violations.append(PolicyViolation(
                    code="MERCHANT_NOT_ALLOWED",
                    message=(
                        f"Merchant '{item.merchant_id}' is not in the allowed list: "
                        f"{constraints.merchant_scope.allowed_merchants}"
                    ),
                    field=f"items[{i}].merchant_id",
                    actual_value=item.merchant_id,
                    allowed_value=constraints.merchant_scope.allowed_merchants,
                ))

    # --- CHECK 4: Category blocklist ---
    if constraints.merchant_scope.category_blocklist:
        for i, item in enumerate(proposal.items):
            if item.category and item.category in constraints.merchant_scope.category_blocklist:
                violations.append(PolicyViolation(
                    code="CATEGORY_BLOCKED",
                    message=f"Category '{item.category}' is in the blocklist",
                    field=f"items[{i}].category",
                    actual_value=item.category,
                    allowed_value=f"Not in {constraints.merchant_scope.category_blocklist}",
                ))

    # --- CHECK 5: Validity window ---
    try:
        valid_until = datetime.datetime.fromisoformat(constraints.validity_window.valid_until_iso)
        if now > valid_until:
            violations.append(PolicyViolation(
                code="VALIDITY_EXPIRED",
                message=f"Constraint validity expired at {valid_until.isoformat()}",
                field="validity_window.valid_until_iso",
                actual_value=now.isoformat(),
                allowed_value=valid_until.isoformat(),
            ))
    except (ValueError, TypeError):
        violations.append(PolicyViolation(
            code="INVALID_VALIDITY_TIMESTAMP",
            message="Could not parse validity_window.valid_until_iso",
            field="validity_window.valid_until_iso",
        ))

    # --- CHECK 6: Constraint hash must match ---
    if proposal.constraint_hash != constraints.constraint_hash:
        violations.append(PolicyViolation(
            code="CONSTRAINT_HASH_MISMATCH",
            message="Proposal constraint_hash does not match the compiled constraint_hash",
            field="constraint_hash",
            actual_value=proposal.constraint_hash,
            allowed_value=constraints.constraint_hash,
        ))

    return PolicyResult(
        passed=len(violations) == 0,
        violations=violations,
    )
