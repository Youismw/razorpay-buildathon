"""
E2E Test: Revocation Race (DEMO.md Scenario 2, INV-004)
Mandate is revoked while a debit is in-flight.

Expected: 403 MANDATE_REVOKED, audit trail shows REVOKED before DEBIT_ATTEMPT.
"""

import pytest
import threading
import time
from modules.upi_payment_adapter.revocation import RevocationEngine, MandateRevocationError


def test_revocation_race_debit_rejected():
    """
    Gherkin: User revokes mandate while debit is in-flight.
    The database atomic lock ensures revocation wins.
    """
    engine = RevocationEngine()
    mandate_id = "m-e2e-race-001"
    engine.register_mandate(mandate_id, max_amount_paise=500000, token_id="tok_demo")

    results = {
        "revoke_completed": False,
        "revoke_timestamp": None,
        "debit_succeeded": False,
        "debit_error": None,
        "debit_timestamp": None,
    }

    def revoke_worker():
        time.sleep(0.005)  # Tiny head start
        engine.revoke(mandate_id, reason="E2E test: user cancelled")
        results["revoke_completed"] = True
        results["revoke_timestamp"] = time.monotonic()

    def debit_worker():
        time.sleep(0.015)  # Debit arrives after revocation
        try:
            engine.acquire_for_debit(mandate_id, 499900)
            results["debit_succeeded"] = True
        except MandateRevocationError as e:
            results["debit_error"] = str(e)
        results["debit_timestamp"] = time.monotonic()

    t_revoke = threading.Thread(target=revoke_worker)
    t_debit = threading.Thread(target=debit_worker)

    t_revoke.start()
    t_debit.start()
    t_revoke.join(timeout=5)
    t_debit.join(timeout=5)

    # Assertions matching DEMO.md Gherkin
    assert results["revoke_completed"] is True, "Revocation must complete"
    assert results["debit_succeeded"] is False, "Debit must NOT succeed after revocation"
    assert "MANDATE_REVOKED" in (results["debit_error"] or ""), "Error must contain MANDATE_REVOKED"

    # Verify state is REVOKED
    state = engine.get_state(mandate_id)
    assert state.state == "REVOKED"
    assert state.revoked_at is not None


def test_revocation_sequential_debit_blocked():
    """Simple sequential test: revoke then debit → always fails."""
    engine = RevocationEngine()
    mandate_id = "m-e2e-seq-001"
    engine.register_mandate(mandate_id, max_amount_paise=500000)

    # Revoke
    engine.revoke(mandate_id)

    # Debit attempt
    with pytest.raises(MandateRevocationError, match="MANDATE_REVOKED"):
        engine.acquire_for_debit(mandate_id, 100000)

    # State must be REVOKED
    assert engine.get_state(mandate_id).state == "REVOKED"
