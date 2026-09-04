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

---

## Feature: Multi-Provider Tiered Routing & Live Frontier Flow

```gherkin
Feature: Production Resilience & Multi-Provider Cascade
  As an autonomous purchasing co-pilot
  I want basic tasks routed to high-throughput models (Groq) and complex reasoning to frontier models (Gemini 3.6 Flash)
  So that latency and API quotas are optimized while preserving high reasoning depth

  Scenario: Tiered execution with live Razorpay S2S Order creation
    Given a buyer enters a complex purchasing query
    When the Orchestrator evaluates task complexity
    Then it routes the request through the tiered cascade (Groq ➔ Gemini 3.6 Flash ➔ OpenRouter)
    And the model produces structured ProposalObject JSON
    And the Mandate Vault signs an ES256 JWS token verified against public JWKS
    And the UPI Payment Adapter creates a live order on the Razorpay S2S Gateway (https://api.razorpay.com/v1/orders)
    And Razorpay returns a genuine order ID (e.g. order_TXwHcsU45R9c3D)
    And the ledger records the transaction status as SETTLED
```

---

## Feature: Seller Autonomous Governance & Dynamic Pricing

```gherkin
Feature: Autonomous Merchant Dynamic Pricing & Competitor Intelligence
  As a verified store merchant
  I want my AI Co-Pilot to scan competitor prices across Amazon, Flipkart, and ONDC
  So that I can adjust margins, list new SKUs, and trigger automated clearance discounts

  Scenario: Merchant initiates competitor price scan and adjusts listing price
    Given a merchant sells "Sony WH-CH520 Wireless Headphones" with wholesale cost 3500 INR
    When the merchant asks the Seller Co-Pilot to compare market prices
    Then the system scans competitor rates across marketplace channels
    And the AI calculates median market price and suggests an optimal margin (e.g. 25%)
    And upon merchant confirmation, the unified catalog price is updated atomically
    And live orders trigger automated inventory decrements and logistics AWB generation
```

---

## Feature: Live UPI Autopay Tokenization & NPCI Webhook Authentication

```gherkin
Feature: Real-Time NPCI Mandate Authentication & Token Binding
  As a buyer and merchant ecosystem
  I want UPI Autopay recurring mandates tokenized via live NPCI registration callbacks
  So that future autonomous debits execute instantly without re-prompting the customer

  Scenario: Real-time NPCI mandate.authenticated callback activates mandate token
    Given a customer sets an autonomous spend ceiling of 5000 INR with VPA "merchant@okhdfcbank"
    When the system dispatches mandate registration to the Razorpay UPI Autopay rail
    And NPCI asynchronously returns a "mandate.authenticated" webhook callback
    Then the webhook handler extracts the Unique Mandate Number (UMN) and Token ID
    And the mandate state transitions to "PAYMENT_ACTIVE" in the orchestrator registry
    And the merchant dashboard displays a verified NPCI UMN badge
    And subsequent autonomous debits within the spend limit are authorized against the active token
```

---

## Feature: Deterministic Guardrail Gate High-Throughput Stress Benchmark

```gherkin
Feature: High-Throughput Sub-Millisecond Policy & Invariant Verification
  As a FinTech infrastructure architect
  I want the Deterministic Guardrail Gate to sustain high-volume decision throughput
  So that enterprise autonomous agent traffic experiences sub-millisecond latency without compromising safety

  Scenario: Guardrail Gate evaluates 10,000 consecutive purchase proposals
    Given 10,000 valid and boundary-testing proposal objects from parallel purchasing agents
    When the in-process stress test harness executes the 4-stage Guardrail pipeline
      | Stage 1: Pydantic v2 Schema Validator (extra="forbid") |
      | Stage 2: Pure Python Arithmetic Policy Engine (INV-010) |
      | Stage 3: Cryptographic Grounding Oracle (SHA-256 Manifest)|
      | Stage 4: Mathematical Confidence Gate (C >= 0.85)       |
    Then the sustained throughput exceeds 1,500 decisions per second (sustaining 80,000+ decisions/s)
    And the average decision latency is strictly below 1.0 millisecond (averaging ~0.012 ms)
    And the P99 latency is strictly below 5.0 milliseconds (P99 <= 0.025 ms)
    And 0.00% of invalid or over-budget proposals slip past the gate
```


