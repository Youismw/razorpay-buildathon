# ***QUESTIONS*** 

&#x20;\[by System Architect / Protocol Engineer = 1. Module 6 (Universal Commerce Adapter) Interface Contract

Module 6 is the critical path bridge to real merchant inventory. For the SRS, I need the exact interface contract between the Shopify polling service and the UCP Manifest generator: Do we abstract the transport layer to support both REST and GraphQL from day one, or do we commit to Shopify's REST Admin API for the MVP and version the abstraction later? What is the polling frequency, backpressure strategy, and inventory delta detection mechanism?

2\. Inter-Service Communication \& Distributed Checkout State

The 8-layer architecture spans Python (Modules 1, 4, 5, 6), Node.js (Module 3), and potentially Rust/Go for hot paths. For the SRS, what is our canonical inter-service standard — gRPC with Protobuf, async events via Kafka, or HTTP/3 with JSON — and how do we handle distributed transactions across the UCP checkout state machine (cart locking → mandate generation → payment authorization → settlement)? Do we implement an outbox pattern, Saga orchestration, or accept at-least-once delivery with idempotency keys?

3\. Data Consistency Boundaries

For the MVP, do we mandate PostgreSQL as the system of record across all modules, or do we allow polyglot persistence (Redis for cart TTL locking, Elasticsearch for discovery ranking, PostgreSQL for mandates)? Specifically, what is our consistency model for mandate propagation — does the Payment Mandate require strong consistency (synchronous cross-module commit) or can it tolerate eventual consistency with a maximum propagation latency SLA?

] , \[by AI / LLM Engineer = ngestion \& Latency: What memory limits and concurrency thresholds will the FastAPI ingestion service enforce when streaming structured merchant feed data to the LLM agent to keep evaluation latency within target budgets?



Telemetry \& Audit Logging: What exact JSON schema must the LLM emit to log candidate utility scores, ranking metadata, and token usage to the audit ledger?



Fallback Routing: If the LLM inference service experiences high latency or complete outage during catalog scoring, what is the exact deterministic fallback algorithm for candidate selection?] , \[by QA Engineer = Focus: Data consistency, API contracts, concurrency, Module 6 (Shopify Adapter), and observability.

Eventual Consistency \& Reconciliation (Module 6): The Universal Commerce Adapter polls Shopify to generate UCP manifests. If Shopify's inventory changes after we generate the manifest but before the cart lock is finalized, what is the exact reconciliation mechanism? I need to specify the data integrity requirements and define the edge-case tests for inventory race conditions.

Concurrency \& Isolation Levels: In the parallel multi-merchant negotiation engine (Module 3), how are we managing concurrent state updates? Specifically, what database isolation level (e.g., Read Committed, Serializable) and locking strategy (e.g., optimistic vs. pessimistic) are mandated for PostgreSQL to prevent double-selling or cart collision during high-concurrency checkout sessions?

Observability \& Distributed Tracing: To meet our operational SRS, what specific telemetry and tracing standards (e.g., OpenTelemetry) are mandated? How exactly do we propagate a single transaction\_id across the probabilistic AI layer (Module 7) and the deterministic payment layer (Module 2) so QA can trace a failed end-to-end transaction in a single dashboard?] , \[by Cryptography / Security Engineer = Q4 — Atomicity and authorization-to-payment race



What guarantees that the policy decision, mandate validation, and UPI payment execution cannot become inconsistent—for example, a mandate is valid when checked but revoked immediately before the payment is executed?



Ask specifically about:



transaction boundaries;

locking/versioning;

idempotency;

concurrent agent requests;

retry behaviour;

duplicate payment prevention.



Why I am asking:

This converts directly into backend SRS requirements such as:



A payment MUST NOT be executed using a superseded mandate version.



A retried request MUST NOT produce multiple financial transactions.



This is one of the places where "the check passed" is not enough; the system needs a defined consistency model.



Q5 — Secrets, keys, and cryptographic material



Where are API credentials, signing keys, verification keys, mandate identifiers, and other security-sensitive material stored and used, and which components are explicitly prohibited from accessing them?



Also establish:



key generation;

key rotation;

key revocation;

environment separation;

logging restrictions;

whether the LLM process can ever see credentials.



Why I am asking:

This creates concrete SRS requirements for:



secret isolation;

credential handling;

cryptographic key lifecycle;

least privilege;

test-vs-production separation.



The LLM should not become an accidental credential-bearing component.



Q6 — Audit ledger integrity and forensic requirements



What exactly must be recorded for every payment attempt, successful or rejected, and what guarantees are required against modification or deletion of the audit history?



Minimum questions to settle:



request/action;

mandate ID/version;

policy decision;

reason for rejection;

timestamp;

agent identity;

payment reference;

UPI response;

human escalation;

final outcome.



Why I am asking:

The architecture already calls for an external audit ledger.



The SRS needs to distinguish between a debug log and a security audit trail. ***Those are not the same thing.]***



&#x20;\[devops engineer What is the definitive choice for the primary UPI settlement primitive (Reserve Pay / SBMD vs Autopay) for the MVP, and what are the exact state-machine transitions, idempotency keys, and retry/backoff policies the backend must implement around Razorpay’s test-mode and (later) production APIs?

What are the required persistence and durability guarantees for the audit-trail ledger and mandate store (database technology class, RPO/RTO targets, retention period, and whether the ledger must be append-only and cryptographically hash-chained)?

What runtime environment constraints and configuration surface must the service expose for DevOps (container base image preferences, required environment variables / secrets, health-check / readiness probe contracts, and graceful shutdown behaviour when a mandate is mid-flight***)?]***



# 

# ***ANSWERS***



As requested, I will answer the questions posed to each role, providing concrete technical decisions to feed directly into the SRS.



\---



\## System Architect / Protocol Engineer



\### 1. Module 6 (Universal Commerce Adapter) Interface Contract



\*\*Decision:\*\*  

For the MVP, we commit to \*\*Shopify’s REST Admin API\*\* and \*\*abstract the transport layer behind a well-defined interface\*\* from day one, but we \*\*do not implement GraphQL support initially\*\*. The abstraction will be a simple provider interface (e.g., `IInventoryProvider`) with methods like `GetProducts`, `GetInventoryLevels`, and `GetProductUpdates`. The Shopify implementation uses REST. Adding GraphQL later only requires a new adapter class; the rest of the system does not change.



\*\*Polling frequency:\*\*  

We poll every \*\*5 seconds\*\* for inventory updates for merchants whose products are currently part of an active negotiation or cart. For inactive merchants, we poll every \*\*60 seconds\*\*. This balances freshness with API rate limits.



\*\*Backpressure strategy:\*\*  

The polling service uses a \*\*bounded queue\*\* (size 1000) for incoming inventory change events. If the queue is full, we drop the oldest events and log a warning, but we also trigger an immediate full re-sync for that merchant. This prevents unbounded memory growth.



\*\*Inventory delta detection:\*\*  

We use Shopify’s `updated\_at` field on product/variant objects and compare it to the last poll timestamp. Only objects with `updated\_at > last\_poll` are processed. Additionally, we subscribe to Shopify webhooks for real-time inventory changes (but webhooks are best-effort; polling remains the source of truth for consistency). The UCP Manifest generator receives a list of changed SKUs and updates only those manifests.



\### 2. Inter-Service Communication \& Distributed Checkout State



\*\*Decision:\*\*  

We use \*\*gRPC with Protobuf\*\* as the canonical synchronous communication standard for all internal services. It provides strong typing, efficient serialization, and is well-supported in Python and Node.js. For asynchronous event-driven flows (e.g., inventory updates, webhook processing, audit logging), we use \*\*Redis Streams\*\* (or Kafka if we had more time, but Redis Streams is simpler and sufficient). We do not use HTTP/3 internally; gRPC over HTTP/2 is adequate.



\*\*Distributed transactions:\*\*  

We implement the \*\*Saga pattern with choreography\*\* for the checkout state machine. Each step (cart locking, mandate generation, payment authorization, settlement) is a local transaction. If a step fails, a compensating action is triggered via an event. We add \*\*idempotency keys\*\* to every outgoing request and rely on at-least-once delivery with idempotent handlers. For the critical payment execution step, we use an \*\*outbox pattern\*\*: the payment instruction is first written to an outbox table in the same DB transaction as the state change, then a background worker sends it to Razorpay and updates the status. This ensures no payment instruction is lost.



\### 3. Data Consistency Boundaries



\*\*Decision:\*\*  

For the MVP, we mandate \*\*PostgreSQL\*\* as the single system of record for all transactional data (mandates, cart state, audit ledger, checkout sessions). We allow \*\*Redis\*\* for ephemeral data: cart TTL locks, rate limiting, and caching of frequently read inventory. We do \*\*not\*\* use Elasticsearch in the MVP; simple SQL queries with indexes suffice for discovery.



\*\*Consistency model for mandate propagation:\*\*  

The Payment Mandate must be \*\*strongly consistent\*\* between the guardrail shell, the ledger, and the Razorpay adapter. That is, when a mandate is created or revoked, the change must be committed to PostgreSQL and acknowledged before any subsequent payment attempt can proceed. We achieve this by writing the mandate state to PostgreSQL in the same transaction as the AP2 mandate validation. The Razorpay API call is made only after the PostgreSQL transaction commits. We do not allow eventual consistency for mandate status because a delay could allow an unauthorized payment. For inventory updates, we accept eventual consistency (up to 5 seconds) as specified in Module 6.



\---



\## AI / LLM Engineer



\### 1. Ingestion \& Latency



\*\*Memory limits:\*\*  

The FastAPI ingestion service enforces a \*\*per-request payload limit of 10 MB\*\* and a \*\*maximum of 50 merchant items per batch\*\*. The LLM context window is capped at \*\*4000 tokens\*\* for the ranking prompt. The service runs with a \*\*concurrency limit of 20 simultaneous LLM requests\*\* (using a semaphore). If the request queue exceeds 100, new requests are rejected with a 429 and the client retries.



\*\*Latency budget:\*\*  

The target end-to-end latency for a single candidate scoring call (from ingestion to LLM response) is \*\*< 2 seconds\*\* at P95. If latency exceeds 3 seconds, the request is aborted and the fallback routing (below) is used.



\### 2. Telemetry \& Audit Logging



\*\*JSON schema for LLM audit log entries:\*\*



```json

{

&#x20; "event\_type": "llm\_scoring",

&#x20; "timestamp": "ISO8601",

&#x20; "session\_id": "uuid",

&#x20; "transaction\_id": "uuid",

&#x20; "agent\_id": "string",

&#x20; "input\_merchants": \["merchant\_id"],

&#x20; "candidate\_skus": \["sku1", "sku2"],

&#x20; "scores": \[

&#x20;   {

&#x20;     "merchant\_id": "string",

&#x20;     "sku": "string",

&#x20;     "utility\_score": 0.0,

&#x20;     "confidence": 0.0,

&#x20;     "explanation": "string",

&#x20;     "token\_usage": {

&#x20;       "prompt\_tokens": 0,

&#x20;       "completion\_tokens": 0

&#x20;     }

&#x20;   }

&#x20; ],

&#x20; "model": "string",

&#x20; "latency\_ms": 0,

&#x20; "fallback\_used": false

}

```



This is written directly to the audit ledger (PostgreSQL) by the ingestion service after receiving the LLM response.



\### 3. Fallback Routing



If the LLM inference service times out (latency > 3s) or returns an error, the system uses a \*\*deterministic fallback algorithm\*\*:



1\. Sort candidates by \*\*price ascending\*\* (lowest price first).

2\. Filter out any candidate that violates hard constraints (max price, merchant allowlist) using the guardrail policy engine.

3\. If multiple candidates remain, pick the one with the highest \*\*seller reputation score\*\* (a numeric field from the UCP manifest, not LLM-generated).

4\. If still tied, pick the first in alphabetical order of merchant ID.



This fallback is purely deterministic and does not rely on LLM output, ensuring availability.



\---



\## QA Engineer



\### 1. Eventual Consistency \& Reconciliation (Module 6)



\*\*Reconciliation mechanism:\*\*  

When the Shopify adapter detects an inventory change after a cart lock has been initiated but before the cart is finalized, it triggers a \*\*revalidation check\*\*. The cart service queries the UCP manifest generator for the latest inventory status of the items in the cart. If any item is now out of stock or its price has changed beyond a threshold (±5%), the cart is \*\*invalidated\*\* and the checkout is aborted with a user-visible error: "Price/inventory changed, please review your cart." If the changes are within threshold, the checkout proceeds with the original prices.



\*\*Edge-case tests:\*\*



\- Inventory reaches zero between manifest generation and cart lock.

\- Price changes from ₹100 to ₹105 (within threshold) – should proceed.

\- Price changes from ₹100 to ₹110 (outside threshold) – should abort.

\- Multiple concurrent carts for the last item – only one should succeed.



\### 2. Concurrency \& Isolation Levels



We mandate \*\*PostgreSQL with `SERIALIZABLE` isolation level\*\* for all checkout-related transactions involving cart state, inventory deduction, and mandate creation. This prevents phantom reads and write skew. We use \*\*optimistic locking\*\* via a `version` column on inventory items and cart records. When updating inventory, the `UPDATE ... WHERE version = ?` pattern is used; if the affected row count is zero, the transaction is retried up to 3 times before failing. For the payment execution step, we use a \*\*database-level unique constraint\*\* on `(mandate\_id, idempotency\_key)` to prevent duplicate payments.



\### 3. Observability \& Distributed Tracing



We mandate \*\*OpenTelemetry\*\* for all services. Every incoming request generates a `transaction\_id` (UUID) in the API gateway (or first service). This ID is propagated via gRPC metadata (key `x-transaction-id`) and via HTTP headers for external calls. All logs, metrics, and traces are tagged with this ID.



For the probabilistic AI layer (Module 7) and deterministic payment layer (Module 2), the trace context is passed explicitly as a parameter in the internal API calls. The AI service logs its LLM calls with the `transaction\_id` and `span\_id`. The payment service logs the Razorpay API call with the same `transaction\_id`.



We use \*\*Jaeger\*\* as the tracing backend and \*\*Prometheus + Grafana\*\* for metrics. A single Grafana dashboard can filter by `transaction\_id` to show the full waterfall from LLM decision to payment result.



\---



\## Cryptography / Security Engineer



\### Q4 — Atomicity and authorization-to-payment race



\*\*Guarantees:\*\*



\- \*\*Transaction boundary:\*\* The policy decision, mandate validation, and payment execution are not in a single database transaction because the payment is an external call. Instead, we use a \*\*state machine with an outbox pattern\*\*:

&#x20; 1. The guardrail shell validates the mandate and writes a `payment\_intent` record with status `PENDING` and a unique `idempotency\_key` to the outbox table, all in one PostgreSQL transaction. The mandate record has a `version` number; we read the current version and include it in the intent.

&#x20; 2. A background worker reads the `PENDING` intent and calls Razorpay with the `idempotency\_key`.

&#x20; 3. If Razorpay succeeds, the worker updates the intent status to `SUCCESS` and the mandate's `used\_count` if applicable.

&#x20; 4. If Razorpay fails with a retriable error, the worker retries with the same `idempotency\_key` (Razorpay ensures idempotency on its side).

&#x20; 5. If the mandate is revoked while the intent is `PENDING`, a separate process updates the mandate status to `REVOKED`. The worker, before calling Razorpay, rechecks the mandate status in the same transaction as marking the intent as `IN\_FLIGHT`? Better: the worker locks the mandate row (`SELECT ... FOR UPDATE`) and checks status; if revoked, it marks the intent as `REJECTED` and does not call Razorpay. This prevents the race.



\- \*\*Locking/versioning:\*\* The mandate row is locked with `SELECT ... FOR UPDATE` during the check-and-reserve step. The mandate version is incremented on every change, and the payment intent stores that version. If a revocation occurs, the version changes, and any in-flight worker will see the updated version and abort.



\- \*\*Idempotency:\*\* Every payment request to Razorpay includes a unique `idempotency\_key` derived from `mandate\_id + transaction\_id + attempt\_number`. Razorpay guarantees that a given key is processed only once.



\- \*\*Duplicate payment prevention:\*\* The unique constraint on `(mandate\_id, idempotency\_key)` in the payment\_intents table ensures no duplicate local attempts.



\- \*\*Retry behavior:\*\* The worker retries failed payments up to 3 times with exponential backoff, using the same `idempotency\_key`. After 3 failures, it marks the intent as `FAILED` and triggers a human escalation event.



\### Q5 — Secrets, keys, and cryptographic material



\*\*Storage:\*\*  

All secrets (Razorpay API keys, signing private keys, database credentials, etc.) are stored in \*\*HashiCorp Vault\*\* (or AWS Secrets Manager) and never in configuration files, environment variables of containers, or source code. In the MVP, we may use a `.env` file for local development only, but for any shared environment we use Vault.



\*\*Key generation:\*\*  

Signing keys for AP2 mandates are generated using \*\*Ed25519\*\* (or ECDSA P-256) by a dedicated key management service. Keys are stored in Vault with access policies.



\*\*Key rotation:\*\*  

Keys are rotated every 90 days automatically. Old keys are kept for verification for an additional 90 days, then archived.



\*\*Revocation:\*\*  

Issuer keys can be revoked by adding them to a CRL or by updating the verification key set in the credentials provider.



\*\*Environment separation:\*\*  

Strict separation between test and production: separate Vault instances, separate Razorpay test/live keys, separate signing keys. No shared credentials.



\*\*Logging restrictions:\*\*  

Secrets are never logged. Logging middleware redacts any field that matches patterns like `\*key\*`, `\*secret\*`, `\*token\*`, `\*password\*`. The LLM process does not have access to any secret; it only sees non-sensitive data fields. The guardrail shell and payment adapter are the only components with permission to read secrets, and they do so at runtime via Vault.



\### Q6 — Audit ledger integrity and forensic requirements



\*\*What must be recorded for every payment attempt (successful or rejected):\*\*



| Field | Description |

|-------|-------------|

| `timestamp` | ISO8601 with timezone |

| `transaction\_id` | UUID for the whole checkout |

| `agent\_id` | Identifier of the requesting agent |

| `user\_id` | End user on whose behalf the agent acts |

| `action` | Proposed action (e.g., "purchase", "refund") |

| `merchant\_id` | Merchant identifier |

| `sku` | Product SKU(s) |

| `amount` | Amount in paise |

| `mandate\_id` | UPI Autopay mandate ID |

| `mandate\_version` | Version of the mandate used |

| `policy\_decision` | "ALLOW", "DENY", "ESCALATE" |

| `rejection\_reason` | If denied, reason code (e.g., "AMOUNT\_EXCEEDS\_CAP", "MERCHANT\_NOT\_ALLOWED") |

| `llm\_confidence` | Confidence score from LLM (if used) |

| `payment\_reference` | Razorpay payment ID if executed |

| `upi\_response` | Raw response from Razorpay (truncated) |

| `final\_outcome` | "SUCCESS", "FAILED", "REJECTED", "ESCALATED" |

| `human\_escalation` | Boolean, whether escalated to human |

| `idempotency\_key` | Unique key used for payment |



\*\*Integrity guarantees:\*\*



\- The audit ledger is stored in a \*\*separate PostgreSQL schema\*\* with append-only semantics. No `UPDATE` or `DELETE` is allowed on audit tables; only `INSERT` and `SELECT`.

\- Each entry is signed with an HMAC using a key held only by the audit service. The signature is stored in a separate column. This ensures that any tampering with the data will invalidate the signature.

\- Periodic hash-chaining is implemented: each new entry includes the hash of the previous entry, creating a tamper-evident chain.

\- Access to the audit ledger is restricted to a dedicated service account with read-only permissions for most components, and write-only for the audit writer service. No other service can modify it.

\- The LLM never writes directly to the audit ledger; it can only emit logs that are forwarded by the ingestion service.







