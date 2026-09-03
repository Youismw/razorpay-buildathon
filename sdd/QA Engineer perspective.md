# ***QUESTIONS***



answer these queations by \[(  AI / LLM Engineer = Confidence Gate Calibration Dataset: What is the precise sample composition of the golden dataset used to validate the $C \\ge 0.85$ threshold, and how will we baseline the fallback metric ($S\_{\\text{schema}}$ + self-consistency voting) if token logprobs are omitted by a backend provider?  Property-Based Testing Boundaries: What specific Hypothesis generators will be defined to stress-test ProposalObject serialization against numeric edge cases (e.g., zero-price offers, extreme float precision) and Unicode homoglyphs?  CI Execution of Prompt-Injection Suite: How will the 500-vector prompt injection benchmark (SEC-PI-003) be executed in automated PR pipelines without hitting upstream LLM provider rate limits or incurring excessive API costs?  WireMock/Mountebank Stubs for Async UPI Settlement: What contract stubs are being prepared to simulate Razorpay webhook latencies, network partitions during complete\_in\_progress, and ambiguous payment statuses during nightly E2E runs?  ) , (system Architect / Protocol Engineer  = 1. Golden Dataset for Confidence Threshold Validation (FR-GRD-006)

The SRS states you must validate the 0.85 threshold against a golden dataset before SDD commencement. Do you have 20–30 labeled negotiation scenarios ready that span: (a) obvious pass, (b) obvious fail, (c) edge cases near the threshold? If not, who generates them — you, or the AI/LLM Engineer? The SDD needs to reference this dataset as the acceptance criteria for the Guardrail Shell's decision gate.

2\. Testing Non-Determinism: How Do We Gate CI on an LLM?

The Test Pyramid (§6.1) has unit → contract → integration → E2E tiers, but the LLM is inherently probabilistic. For the SDD, how do you want to handle flaky CI due to LLM variance? Options: (a) mock the LLM layer entirely in unit/contract/integration tiers, (b) use temperature=0 with seeded prompts, (c) accept a non-zero flake rate and retry logic. This determines whether the SDD's CI pipeline includes an LLM sandbox or stubs it with recorded responses.

3\. Graceful Failure Demo Evidence (§6.5)

The buildathon judges require at least one gracefully handled failure "shown on camera." Which failure mode are we designing the demo around: expired mandate, revoked mandate racing an in-flight debit, or amount exceeding compiled constraints? The SDD needs a dedicated "Demo Sequence Diagram" showing the exact HTTP status code, audit log entry, and trace span for this failure. Have you selected the scenario?

4\. Prompt Injection Benchmark Scope for MVP (SEC-PI-003)

The SRS requires ≥500 vectors across 7 classes for production, but §8 Open Item 2 says 20–30 hand-crafted vectors are acceptable for the MVP demo. For the SDD, are you defining the MVP benchmark suite (20–30 vectors) as a subset of the full 500-vector taxonomy, or as an independently curated "critical path" set? I need the vector class list to design the sanitization pipeline's test hooks.

) , (Technical Lead + Backend Engineer = Confidence gate deterministic testing:

The confidence score depends on LLM outputs, which are non‑deterministic. How will we build a golden dataset and a validation framework to test that the gate (threshold = 0.85) behaves as expected? Will we freeze model versions and logprobs, or use synthetic LLM outputs with known scores to simulate?



Prompt‑injection benchmark integration:

The SRS requires 500 examples across 7 vector classes in CI. Who will curate these examples? How will we run this benchmark without slowing down every commit—can we run a reduced subset on push and the full suite nightly? What will be the pass/fail criteria?



End‑to‑end test cleanup and idempotency:

The nightly E2E tests against Razorpay Test Mode need to be self‑cleaning to avoid leaving residual test data (customers, mandates, payments). How will you ensure idempotency keys are unique across runs and that we can replay tests without collisions? What is the strategy for resetting the test environment?



Fail‑closed behavior simulation:

How will you verify that the system fails closed when dependencies (Vault, Policy Engine, Payment Adapter) are unavailable? Will you use mountebank/wiremock to simulate timeouts and errors, and have a dedicated suite that runs in CI (or pre‑merge) to ensure we never accidentally allow a fall‑through?), (Cryptography / Security Engineer = The SRS explicitly treats the security invariants as formal, checkable properties, not aspirations.



Q1. Security invariant verification



Question:

For each invariant INV-001 through INV-010, what is the concrete automated test, test fixture, attack input, expected state transition, and observable evidence that proves the invariant held?



SDD output needed: invariant → test-case traceability matrix.



Q2. Cryptographic negative testing



The SRS requires fail-closed behavior for signature, algorithm, and canonicalization mismatches.



Question:

Which malformed or adversarial cryptographic artifacts will you test—wrong algorithm, alg:none, wrong key, wrong key ID, altered canonical bytes, expired credential, revoked key, malformed JWS, schema/version mismatch—and what exact rejection behavior must each produce?



SDD output needed: cryptographic negative-test matrix with expected error/state.



Q3. Replay and concurrency testing



Question:

How will you test simultaneous duplicate debit requests, replayed valid requests, reused idempotency keys, stale nonces, mandate revocation during an in-flight debit, and retry after an ambiguous Razorpay response? Which database/API observations constitute proof that only one payment was executed?



SDD output needed: concurrency test design + oracle/evidence definition.



Q4. Prompt-injection security oracle



The SRS defines injection success behaviorally: unauthorized policy changes, payment-limit changes, tool invocation, merchant selection, payment, secret access, or validation bypass are failures.



Question:

What is your automated security oracle for deciding whether an injection succeeded? Specifically, how will tests observe policy state, tool invocation, signing requests, payment API calls, secrets, and audit records so that an attack cannot appear “blocked” merely because the model produced a harmless-looking final answer?



SDD output needed: security-test harness + observability hooks + pass/fail oracle.) , (devops engineer = Which of the graceful-failure scenarios in SRS §6.5 will you require us to demonstrate live on camera? List the exact sequence of API calls / UI actions and the evidence bundle (audit record + trace + ledger state) that must be visible in the recording.

For the CI pipeline (NFR-CI-001), what is the precise ordered list of stages and the tools you expect for each (lint, unit, schema/contract, integration)? Confirm that the integration tier remains hermetic (no live Razorpay/Shopify) and that only the nightly job may hit Test Mode.

How will you instrument the Guardrail Shell so that every decision span carries the mandatory attributes listed in NFR-OBS-002 (constraint\_hash, llm\_invocation\_id, payment\_mandate\_nonce, guardrail\_decision, grounding\_status)? Provide the OpenTelemetry attribute names and types you will assert in the contract tests.

What is the minimal set of chaos experiments you want us to run against the Docker Compose stack before the pitch (dependency kill, network partition, delayed Razorpay webhook)? For each experiment, state the expected fail-closed behaviour and the metric we must collect.)]

# 

# ***ANSWER***



As the technical team, we have reviewed the QA Engineer’s questions. Below are our definitive answers, locked in to serve as the direct inputs for the System Design Document (SDD). All answers strictly adhere to the MVP constraints, the "Deterministic Sandwich" architecture, and the SRS v1.1 ground truth.



\---



\### 1. AI / LLM Engineer



\*\*Confidence Gate Calibration Dataset \& Fallback:\*\*

The golden dataset will consist of 100 hand-crafted scenarios: 40 obvious passes (within bounds, fully grounded), 40 obvious fails (out of bounds, hallucinated prices), and 20 edge cases (near the 0.85 threshold, partial grounding). 

\*Fallback Metric:\* If the backend omits token logprobs, we will use self-consistency voting (N=5 samples). The fallback score will be baselined as $S\_{fallback} = \\text{agreement\\\_ratio}$. If agreement $\\ge 0.8$, $S\_{fallback} = 1.0$, else $0.0$. The confidence formula dynamically shifts to $C = 0.5 \\times S\_{fallback} + 0.3 \\times S\_{grounding} + 0.2 \\times S\_{schema}$.



\*\*Property-Based Testing Boundaries:\*\*

We will use Python’s `hypothesis` library. Generators will include:

\- `floats(allow\_nan=False, allow\_infinity=False, min\_value=0.0, max\_value=1e9)` for extreme price precision.

\- `strings()` mapped through Unicode NFC normalization to test homoglyphs (e.g., Cyrillic 'а' vs Latin 'a' in merchant names).

\- Injection of null bytes (`\\x00`) and zero-width spaces to ensure the JSON schema validator and RFC 8785 canonicalizer fail closed rather than crashing.



\*\*CI Execution of Prompt-Injection Suite:\*\*

To avoid rate limits and API costs in PR pipelines, we will run a reduced subset of 30 critical-path vectors on every PR using a local, quantized open-source model (e.g., Llama-3-8B via vLLM) hosted in the CI runner. The full 500-vector suite against the production target model (e.g., GPT-4o/Claude 3.5) will run exclusively in the nightly E2E pipeline.



\*\*WireMock/Mountebank Stubs for Async UPI Settlement:\*\*

We will define specific Mountebank stubs for the nightly E2E runs:

\- `razorpay\_webhook\_delay`: Injects a 15-second delay on the `/payments/create/recurring` response to simulate network partitions.

\- `razorpay\_ambiguous\_status`: Returns HTTP 200 but with `status: "pending"` or drops the webhook entirely.

\- `razorpay\_timeout`: Drops the TCP connection before sending a response to test the exponential backoff and HITL escalation (FR-GRD-010).



\---



\### 2. System Architect / Protocol Engineer



\*\*Golden Dataset for Confidence Threshold Validation:\*\*

I do not have them ready. The AI/LLM Engineer and I will co-generate the 30 labeled scenarios (10 pass, 10 fail, 10 edge) during Sprint 1. The AI engineer will generate the LLM interaction traces, and I will define the ground-truth constraint hashes and expected Guardrail decisions. This will be locked in the SDD as `golden\_dataset.json`.



\*\*Testing Non-Determinism in CI:\*\*

We will strictly mock the LLM layer in Unit, Contract, and Integration tiers using pre-recorded JSON responses (VCR.py style). We will \*not\* rely on `temperature=0` for CI, as it is not perfectly deterministic across provider updates. The nightly E2E tier will use the live LLM with `temperature=0.1` and accept a 0.5% flake rate, handled by a CI retry mechanism (max 2 retries).



\*\*Graceful Failure Demo Evidence:\*\*

We will demo the \*\*Revoked Mandate Racing an In-flight Debit (INV-004)\*\*. 

\*Sequence:\* 1) Agent initiates debit. 2) Guardrail approves. 3) \*Simultaneously\*, a webhook triggers mandate revocation. 4) The atomic DB lock (`SELECT ... FOR UPDATE`) ensures the revocation wins. 5) The Payment Adapter returns `403 MANDATE\_REVOKED`. The camera will show the Jaeger trace highlighting the race condition resolution and the append-only ledger showing the `REVOKED` state transition blocking the debit.



\*\*Prompt Injection Benchmark Scope for MVP:\*\*

The 20-30 MVP vectors will be an independently curated "critical path" subset, specifically focusing on the 3 highest-risk classes: Direct Instruction Override, Homoglyph Obfuscation, and Multi-hop via UCP Manifest. This ensures we cover the most likely attack vectors for the demo without bloating the MVP CI pipeline.



\---



\### 3. Technical Lead + Backend Engineer



\*\*Confidence Gate Deterministic Testing:\*\*

We will use synthetic LLM outputs with known scores for the Guardrail Shell unit tests. We will mock the `LLMClient` to return hardcoded `ProposalObject` and logprob arrays. This allows us to mathematically verify the $C \\ge 0.85$ threshold logic deterministically without relying on live model outputs.



\*\*Prompt-Injection Benchmark Integration:\*\*

The Crypto/Sec Engineer will curate the 500 examples. To prevent CI slowdown, the 30 critical vectors run on every PR (must pass 100%). The full 500 runs nightly. Pass criteria: 0% Injection Success Rate (ISR) for the PR subset; <1% ISR for the nightly full suite.



\*\*End-to-End Test Cleanup and Idempotency:\*\*

We will implement a `TestTeardownWorker`. Every E2E test will generate a unique `test\_run\_id` (UUID). All idempotency keys will be formatted as `{test\_run\_id}\_{mandate\_id}\_{attempt}`. After the test, a cleanup script will call the Razorpay API to cancel/revoke any created test mandates. We will also use a dedicated "burner" Razorpay customer ID for E2E tests, which gets wiped via a DB-level cleanup script in our test harness if API cleanup fails.



\*\*Fail-Closed Behavior Simulation:\*\*

We will use Mountebank to simulate dependency failures. We will create a dedicated `fail\_closed\_test\_suite` in our integration tier. Tests will explicitly kill the Vault, Policy Engine, or Payment Adapter containers (or block their ports via `iptables` in the test runner) and assert that the Guardrail Shell returns `503 SERVICE\_UNAVAILABLE` and logs a `FAIL\_CLOSED\_TRIGGERED` audit event. This suite will run on every PR.



\---



\### 4. Cryptography / Security Engineer



\*\*Security Invariant Verification:\*\*

I will provide a traceability matrix in the SDD. Example for INV-001 (LLM holds no keys): Test fixture spins up the Reasoning Core container. Attack input: LLM attempts to read `/etc/vault/keys`. Expected state: `EACCES`. Evidence: Container seccomp profile blocks it, and an audit log records `UNAUTHORIZED\_KEY\_ACCESS\_ATTEMPT`. For INV-004 (Revocation wins race): Test uses `pgbench` to fire 50 concurrent debit requests and 1 revocation. Evidence: Exactly 0 debits succeed, and the ledger shows `REVOKED`.



\*\*Cryptographic Negative Testing:\*\*

We will test: `alg: none`, `alg: RS256` (when ES256 is required), mismatched `kid`, truncated JWS payload, and altered canonical bytes (changing a single bit in the JSON before signing). Expected behavior: The Mandate Vault and Guardrail Shell must immediately throw `SignatureVerificationError` and transition the mandate state to `REJECTED`, logging the exact byte mismatch.



\*\*Replay and Concurrency Testing:\*\*

We will use a multi-threaded Python script (`asyncio`) to fire 10 identical debit requests with the same `idempotency\_key` simultaneously. DB observation: Only one row in the `transactions` table will have `status=SUCCESS`. The other 9 will hit the unique constraint on `(mandate\_id, idempotency\_key)` and return `409 DUPLICATE\_REQUEST`. For revocation racing: we will use DB transaction delays to hold the debit in `PREPARE` state while executing the revocation, proving the `SELECT ... FOR UPDATE` blocks the debit until revocation commits.



\*\*Prompt-Injection Security Oracle:\*\*

The oracle will not just look at the final LLM text. It will hook into the Guardrail Shell's execution pipeline. If the LLM outputs a `ProposalObject` that attempts to invoke a tool outside the allowed list, or if the `offer\_price` exceeds the `CompiledConstraints.max\_spend`, the oracle flags it as an injection success. We will also monitor the audit ledger for any `UNAUTHORIZED\_TOOL\_CALL` or `POLICY\_BYPASS\_ATTEMPT` events. An injection is only "blocked" if the Guardrail Shell explicitly rejects it with a `GROUNDING\_FAILURE` or `POLICY\_VIOLATION`.



\---



\### 5. DevOps Engineer



\*\*Graceful-Failure Demo on Camera:\*\*

We will demo the "Revoked Mandate Racing In-Flight Debit".

\- \*UI Action:\* User types "Buy 5 items from Merchant A, max $100".

\- \*API:\* Agent discovers, negotiates, and generates `PaymentMandate`.

\- \*UI Action:\* User clicks "Revoke Mandate" in the dashboard at the exact moment the Agent clicks "Execute Payment".

\- \*Evidence Bundle:\* Jaeger UI showing the `guardrail\_check` span and `payment\_adapter` span. The trace will show the `payment\_adapter` receiving a `403 MANDATE\_REVOKED` from the DB lock. The live JSONL audit log will be tailed on screen, showing the `REVOKED` state transition timestamp occurring \*before\* the `DEBIT\_ATTEMPT` is finalized.



\*\*CI Pipeline Stages:\*\*

1\. `lint`: `ruff` (Python), `eslint` (Node).

2\. `unit-tests`: `pytest` (Python), `jest` (Node). Hermetic.

3\. `contract-tests`: `schemathesis` / `pytest` with JSON schema validation. Hermetic.

4\. `integration-tests`: `pytest` with `testcontainers` (spins up Postgres, Redis, Mountebank). Hermetic (no live Razorpay/Shopify).

5\. `security-scan`: `trivy` (images), `bandit` (Python).

6\. `nightly-e2e`: Runs only on `main` branch at 2 AM. Hits live Razorpay Test Mode and Shopify Sandbox.



\*\*Guardrail Shell Instrumentation (NFR-OBS-002):\*\*

The Guardrail Shell will inject the following attributes into the root span via the OpenTelemetry Python SDK:

\- `constraint\_hash` (string, SHA-256 hex)

\- `llm\_invocation\_id` (string, UUID)

\- `payment\_mandate\_nonce` (string, UUID)

\- `guardrail\_decision` (string, enum: `APPROVED`, `REJECTED`, `ESCALATED`)

\- `grounding\_status` (string, enum: `FULLY\_GROUNDED`, `PARTIAL`, `FAILED`)

\- `confidence\_score` (float, 0.0-1.0)

These will be asserted in the contract tests using OTel test utilities.



\*\*Chaos Experiments:\*\*

We will use `toxiproxy` integrated into the `docker-compose.yml`.

\- \*Exp 1: Razorpay Timeout.\* Toxiproxy drops packets to `api.razorpay.com`. Expected: Payment Adapter returns `504 GATEWAY\_TIMEOUT`, transitions to `PENDING`, and triggers HITL. Metric: `razorpay\_timeout\_count`.

\- \*Exp 2: Vault Network Partition.\* `iptables` blocks Guardrail Shell from reaching Mandate Vault. Expected: Guardrail Shell returns `503 SERVICE\_UNAVAILABLE`. Metric: `vault\_unreachable\_count`.

\- \*Exp 3: Shopify Webhook Delay.\* Toxiproxy adds 10s latency to Shopify webhook receiver. Expected: UCA bounded queue absorbs it; no negotiation blocks. Metric: `uca\_queue\_depth`.

