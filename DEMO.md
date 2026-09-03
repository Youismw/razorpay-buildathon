# Acceptance Criteria & Gherkin Demo Specifications
**Project:** Agentic UPI Commerce Bridge (AP2/UCP × Razorpay UPI Autopay)  
**Track:** AI Growth & Agentic Commerce  
**Version:** 1.0 (Governed Steel Thread Acceptance Suite)

---

## Feature: Governed Agentic Commerce Flow (Happy Path)

```gherkin
Feature: End-to-End Governed Autonomous Purchase
  As a buyer principal
  I want an LLM agent to negotiate and settle a purchase within strict cryptographic constraints
  So that no unauthorized or ungrounded money-moving action can ever occur

  Scenario: Autonomous purchase within spend limit and verified grounding
    Given a human has compiled a purchase intent with max_spend = 5000 INR
    And the Constraint Compiler outputs a canonical RFC 8785 SHA-256 constraint hash
    And a merchant has offered a verified product "Sony WH-CH520" at 4999 INR in the UCP manifest
    When the LLM Reasoning Core proposes candidate product "Sony WH-CH520" at offer_price = 4999 INR
    And the Guardrail Shell validates schema, confirms policy compliance, and checks UCP grounding
    And the Guardrail Shell computes confidence score C >= 0.85
    And the Mandate Vault cryptographically signs the AP2 Payment Mandate (ES256 JWS)
    And the UPI Payment Adapter executes the recurring charge against Razorpay Test Mode API
    Then the debit status is recorded as SUCCESS
    And the immutable audit ledger records a SETTLED event with matching constraint_hash
    And the JSONL audit export stream reflects the complete decision path within 30 seconds
```

---

## Feature: Graceful Failure — Revocation Racing In-Flight Debit (INV-004)

```gherkin
Feature: Mandate Revocation Safety Guarantee
  As a buyer principal
  I want my mandate revocation to atomically block any concurrent in-flight debit
  So that my money is never debited after I revoke authorization

  Scenario: User revokes mandate while debit is in-flight
    Given an active AP2 Payment Mandate with registered max_spend = 5000 INR
    And an autonomous debit attempt of 4999 INR is initiated
    When the buyer principal triggers a mandate revocation concurrently
    Then the database atomic lock (SELECT ... FOR UPDATE) ensures the revocation executes first
    And the mandate state transitions to REVOKED in the ledger
    And the in-flight debit attempt is rejected with HTTP 403 "MANDATE_REVOKED"
    And the audit log records the REVOKED event strictly before any DEBIT_ATTEMPT finalization
    And no money is transferred
```

---

## Feature: Hard Policy Constraint Enforcement (INV-010)

```gherkin
Feature: LLM Prompt Injection & Constraint Boundary Defense
  As the system security guardian
  I want the Policy Engine to deterministically reject proposals that exceed spending limits
  Even if an adversarial prompt claims authorization

  Scenario: LLM proposes an offer exceeding max_spend
    Given a compiled constraint with max_spend = 5000 INR
    When the LLM proposes an offer of 5001 INR citing promotional discounts
    Then the Policy Engine rejects the proposal with "MAX_SPEND_EXCEEDED"
    And the Mandate Vault is never invoked
    And the audit ledger logs a POLICY_VIOLATION event
```
