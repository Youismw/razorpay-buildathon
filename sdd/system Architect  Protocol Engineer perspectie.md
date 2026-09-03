# ***QUESTIONS***



answer these queations by \[(AI / LLM Engineer = gRPC vs. JSON-String Payload Contract: For the interface between the Node.js Negotiation Engine and the Python Guardrail Shell, are we defining ProposalObject strictly using Protobuf v3 schema definitions, or passing an RFC 8785 canonicalized JSON string inside a generic gRPC wrapper to prevent IEEE 754 float serialization drift?  AP2-to-Autopay Failure Signals: When an AP2 Payment Mandate hits a PAYMENT\_PENDING\_REGISTRATION timeout during the user's manual UPI-app approval step, what exact signal payload must be returned to the orchestration layer to clean up locked cart sessions?  Canonical Module Mapping: Can we formally freeze the SDD module numbering as: Module 1 (Constraint Compiler), Module 2 (Reasoning Core), Module 3 (Negotiation Engine), Module 4 (Guardrail Shell), Module 5 (Mandate Vault), Module 6 (UPI Payment Adapter), Module 7 (Universal Commerce Adapter), and Module 8 (Audit Ledger)?  Constraint Downgrade Propagation: When a UCP manifest signals an AP2 requirement unsupported by UPI Autopay (e.g., partial fulfillment), how will the protocol bridge structure the constraint\_enforcement\_audit signal back to the LLM so sub-agents adapt utility scoring without violating policy? ) , (Technical Lead + Backend Engineer = Canonical module numbering:

The SRS notes inconsistent module numbering across sources. Please propose a final, authoritative module numbering (1 through 8, or similar) that matches the component table in SRS §3.1. This will be the basis for all SDD references.



A2A Task lifecycle state persistence:

We need to implement the A2A Task state machine (SUBMITTED → WORKING → INPUT\_REQUIRED → COMPLETED/FAILED). Will we use a library (e.g., XState, Spring State Machine) or hand‑code the transitions? How will task state be persisted across pod restarts (for production) and for the MVP (in‑memory or with Redis)? Provide the state diagram and transition conditions.



Constraint downgrade audit record:

For protocol‑to‑settlement mapping (SRS §4.4), any downgrade must be recorded in a constraint\_enforcement\_audit event. Define the exact schema of this event (fields like original\_ap2\_field, downgrade\_action, reason, timestamp). Also, how will we enforce the rule that a constraint is never silently dropped—will we have a static check or a runtime guard?



Interface between Python and Node.js services:

The system is polyglot: Python for guardrail/ledger/adapter, Node.js for negotiation engine. For the MVP, SRS permits a simpler REST/async‑queue boundary. Exactly which transport and serialization (e.g., REST + JSON, gRPC + Protobuf) will we use for the MVP? What is the contract for the ProposalObject and RejectionContext across this boundary? And how will we evolve this to gRPC/Protobuf for production without breaking changes?) , (QA Engineer = Focus: AP2/UCP/A2A protocol mapping, state machines, and resolving architectural open items.

Protocol-to-Settlement Mapping: When mapping AP2 constraints to UPI Autopay (e.g., handling partial fulfillment or unenforceable refundability), how will the state machine explicitly record the constraint\_enforcement\_audit event (FR-MAP-001) without blocking the main execution thread? What is the exact JSON schema for this audit event?

UCP Checkout State Machine TTLs: For the UCP Checkout Session State Machine (§4.2.3.1), what specific message broker, cron mechanism, or event loop will trigger the state transitions on TTL expiry (e.g., incomplete -> canceled after 6 hours)? How do we guarantee at-least-once delivery for these timeout events in the MVP?

Module Numbering \& Interface Contracts: To resolve Open Item #1 in §7, please provide the definitive 1-to-8 module numbering map. More importantly, define the exact gRPC/Protobuf (or REST fallback) interface contract between the Mandate Vault and the UPI Payment Adapter, including the exact protobuf message definitions for the signed PaymentMandate.

Untrusted Ingestion Parsing: How will the Untrusted Ingestion Zone structurally parse and validate A2A Agent Cards and UCP manifests before they enter the LLM Context Zone? Are we using the official Google SDKs for this, and what are the exact rejection criteria and HTTP status codes for malformed manifests?) , (Cryptography / Security Engineer = The SRS establishes that AP2 is the protocol layer, UPI Autopay is the settlement primitive, and constraints that UPI cannot natively enforce must be explicitly downgraded, escalated, or rejected.



Q1. Exact AP2 → UPI constraint mapping



Question:

For every AP2 mandate field that affects authorization—amount, merchant scope, expiry, frequency, refundability, partial fulfillment, and any other relevant field—what is the exact mapping to Razorpay/UPI behavior, what is enforced cryptographically, what is enforced by the Policy Engine, and what happens when there is no equivalent UPI capability?



SDD output needed: normative constraint-mapping matrix with enforcement owner and failure mode.



Q2. Protocol artifact and signature lifecycle



The SRS requires Intent → Cart → Payment Mandate chaining and JWS signing over canonicalized mandate objects, with an explicit algorithm allowlist.



Question:

Define the exact lifecycle and dependency graph between Intent, Cart, and Payment Mandates: which fields are inherited versus newly introduced, what exactly is signed at each stage, what identifiers bind the stages together, and which AP2 version/schema is authoritative for validation?



SDD output needed: protocol sequence diagram + artifact schemas + cryptographic binding rules.



Q3. Counterparty identity and trust



The system uses A2A Agent Cards, merchant identity, and KYA-style verification while explicitly distinguishing cryptographic identity from reputation/trust.



Question:

What exact evidence is required before a merchant agent becomes eligible for autonomous negotiation, how are identity keys discovered and validated, how are key IDs/status/expiry/revocation represented, and what is the precise state transition from UNKNOWN → VERIFIED → REVOKED/EXPIRED?



SDD output needed: identity verification flow + trust-state machine + key-resolution rules.



Q4. State authority and race conditions



The SRS makes the external ledger the SSOT for mandate/revocation state and requires revocation to win races against in-flight debit attempts.



Question:

Define the authoritative state machine for Intent, Cart, Payment Mandate, registration, active mandate, debit, revocation, and expiry, including which component owns each transition and exactly how concurrent transitions are serialized.



SDD output needed: state machines + transition ownership + concurrency model.) , (devops engineer = Confirm the exact internal interface contract (gRPC service + protobuf messages preferred, REST fallback acceptable) between Guardrail Shell → Mandate Vault → UPI Payment Adapter. List the three mandatory RPCs/methods and the precise error codes the Adapter must return for the graceful-failure cases in SRS §6.5.

For the AP2 Mandate → Razorpay Autopay state mapping (SRS §4.4.1), what is the authoritative source of truth for the current ledger state during a race between revocation and an in-flight debit (INV-004 / FR-MAP-003)? Is it a single Postgres row with SELECT … FOR UPDATE, or do you want an explicit outbox + consumer?

How should the Universal Commerce Adapter (Module 8) expose the IInventoryProvider abstraction so that the Negotiation Engine and Guardrail Shell never import Shopify-specific types? Provide the minimal Python protocol / interface definition you expect us to implement.

What is the single canonical place (service + endpoint) that will own the UCP checkout session state machine TTLs listed in SRS §4.2.3.1? Should the Guardrail Shell, Negotiation Engine, or a new thin Session Manager service be responsible for enforcing those timeouts and writing the corresponding audit events?)]



# ***ANSWERS***



\# System Architect / Protocol Engineer — SDD Arbitration Decisions



These answers resolve the open items blocking SDD commencement. Every decision is tagged with the governing SRS requirement ID or System Invariant. Where the SRS is ambiguous or timeline-risky for a solo dev, I am making an explicit \*\*SDD override\*\* with justification.



\---



\## To AI / LLM Engineer



\### 1. gRPC vs. JSON-String Payload Contract (Negotiation Engine → Guardrail Shell)

\*\*Decision: REST + RFC 8785 canonicalized JSON body for MVP; gRPC/Protobuf for production.\*\*



\- \*\*Envelope\*\*: MVP uses HTTP/1.1 REST (`POST /v1/guardrail/validate`) with W3C `traceparent` header. This eliminates protoc toolchain friction for a solo 8-day build.

\- \*\*Payload\*\*: The `ProposalObject` is transmitted as an \*\*RFC 8785 canonicalized JSON string\*\* inside a `application/json` body. This prevents IEEE 754 float drift because the Guardrail Shell recomputes the canonical bytes and verifies them against a `content-digest: sha256=...` header before schema validation (FR-CC-002, SEC-KEY-003).

\- \*\*Production evolution\*\*: The canonical JSON string becomes a `bytes canonical\_json\_payload` field in a Protobuf `ValidateRequest` message. The schema never changes — only the transport wrapper.



\### 2. AP2-to-Autopay Failure Signal (PAYMENT\_PENDING\_REGISTRATION timeout)

\*\*Decision: Structured `MandateTimeoutEvent` emitted to the outbox, cart lock released deterministically.\*\*



When the 24h `requires\_escalation` TTL expires (§4.2.3.1) or the user never completes manual UPI approval (FR-EXT-006), the Payment Adapter emits:



```json

{

&#x20; "event\_type": "MANDATE\_REGISTRATION\_TIMEOUT",

&#x20; "mandate\_id": "uuid",

&#x20; "ap2\_state": "EXPIRED",

&#x20; "razorpay\_token\_state": "cancelled",

&#x20; "cart\_action": "RELEASE\_LOCK",

&#x20; "checkout\_session\_transition": "requires\_escalation → SESSION\_EXPIRED",

&#x20; "hitl\_notified": false,

&#x20; "audit\_reference": "uuid"

}

```



The \*\*Session Manager\*\* (sub-module of Guardrail Shell, see DevOps Q4) consumes this event, releases the cart lock (FR-UCA-007), and transitions the checkout session. No probabilistic component touches the lock.



\### 3. Canonical Module Numbering

\*\*Decision: Frozen as proposed. Resolves §7 Open Item 1.\*\*



| Module | Component |

|--------|-----------|

| 1 | Constraint Compiler |

| 2 | Probabilistic Reasoning Core |

| 3 | Negotiation Engine |

| 4 | Guardrail Shell \*(includes Session Manager sub-module)\* |

| 5 | Mandate Vault |

| 6 | UPI Payment Adapter |

| 7 | Universal Commerce Adapter |

| 8 | External Persistent Ledger |



All SDD diagrams, API paths, and database schemas shall reference these numbers.



\### 4. Constraint Downgrade Propagation to LLM Sub-Agents

\*\*Decision: Downgrade notices are injected as read-only structured context, never as instructions.\*\*



Per INV-008, untrusted external content cannot authorize; per SEC-PI-002, data must be structurally delimited. The protocol bridge structures the signal as a `ConstraintDowngradeNotice` object:



```json

{

&#x20; "notice\_type": "CONSTRAINT\_DOWNGRADE",

&#x20; "original\_ap2\_constraint": "partial\_fulfillment",

&#x20; "upi\_capability": "unsupported",

&#x20; "downgrade\_action": "REJECT",

&#x20; "policy\_impact": "EXCLUDE\_MERCHANT",

&#x20; "audit\_event\_id": "uuid"

}

```



This object is appended to the \*\*validated context blob\*\* injected into the sub-agent's prompt under a `## System Data: Constraint Downgrades` delimiter. The sub-agent may adjust utility scoring, but the Policy Engine's hard filters (FR-NEG-005) run downstream and will reject any proposal that violates the compiled constraints regardless of the LLM's scoring.



\---



\## To Technical Lead + Backend Engineer



\### 1. Canonical Module Numbering

\*\*Frozen.\*\* See AI/LLM Engineer response #3 above. This is now non-negotiable for SDD.



\### 2. A2A Task Lifecycle State Persistence

\*\*Decision: Hand-coded enum state machine in Python; PostgreSQL for MVP persistence; Redis Streams for production.\*\*



\- \*\*Implementation\*\*: A Python `Enum` + transition guard table inside the Negotiation Engine (Module 3). No external state-machine library — the Google A2A sample repo already models this, and we fork it.

\- \*\*MVP persistence\*\*: Task states are rows in PostgreSQL (`a2a\_tasks` table) with `updated\_at` timestamps. On pod restart, the engine recovers in-flight tasks by querying `WHERE status NOT IN ('COMPLETED', 'FAILED')`.

\- \*\*State diagram\*\*:



```

SUBMITTED ──accept()──► WORKING ──complete()──► COMPLETED

&#x20;                           │

&#x20;                           ├──need\_input()──► INPUT\_REQUIRED ──provide\_input()──► WORKING

&#x20;                           │

&#x20;                           └──fail() / timeout()────────────────────────────────► FAILED

```



\- \*\*Production\*\*: Replace PostgreSQL task table with Redis Streams + consumer group for horizontal scaling (tagged \[Production]).



\### 3. Constraint Downgrade Audit Record Schema \& Enforcement

\*\*Decision: Runtime guard in Policy Engine; schema defined below.\*\*



```json

{

&#x20; "event\_type": "CONSTRAINT\_ENFORCEMENT\_AUDIT",

&#x20; "timestamp": "2026-08-28T21:38:00+05:30",

&#x20; "mandate\_id": "uuid",

&#x20; "transaction\_id": "uuid",

&#x20; "original\_ap2\_field": "refundability\_requirement",

&#x20; "original\_ap2\_value": {"guaranteed": true},

&#x20; "upi\_capability": "not\_enforceable",

&#x20; "downgrade\_action": "ESCALATE",

&#x20; "chosen\_replacement\_value": null,

&#x20; "reason": "UPI Autopay cannot guarantee refundability at debit time per FR-MAP-001",

&#x20; "enforced\_by": "POLICY\_ENGINE",

&#x20; "constraint\_hash": "sha256:...",

&#x20; "srs\_reference": "FR-MAP-001"

}

```



\*\*Runtime guard\*\*: The `ConstraintMapper` class (inside Policy Engine) has an explicit allowlist. Every AP2 field passes through `map\_to\_upi(ap2\_field)`. If the return is `UNSUPPORTED` and the code path does not explicitly emit the above audit event within the same DB transaction, the Policy Engine raises `ConstraintMappingError` and fails closed (INV-007, FR-MAP-002: silent loss = Sev-1 defect).



\### 4. Python ↔ Node.js Interface for MVP

\*\*Decision: REST + JSON with OpenAPI 3.0 contract; gRPC/Protobuf for production.\*\*



\- \*\*Transport\*\*: HTTP/1.1 REST between Module 3 (Node.js/Express) and Module 4 (Python/FastAPI).

\- \*\*Serialization\*\*: JSON. `ProposalObject` and `RejectionContext` use Pydantic models (Python) and Zod schemas (Node.js), both generated from a single OpenAPI 3.0 spec (`contracts/openapi.yaml`) committed to the repo.

\- \*\*Contract endpoint\*\*: `POST /v1/negotiation/proposal` (Module 3 → Module 4) with body conforming to Appendix C.1/C.2.

\- \*\*Evolution path\*\*: The OpenAPI spec is the SSOT. For production, generate `.proto` from OpenAPI using `openapi2proto`. The canonical JSON payload field (see AI/LLM Q1) ensures the wire format is identical in both transports.



\---



\## To QA Engineer



\### 1. Constraint Enforcement Audit Without Blocking Main Thread

\*\*Decision: Outbox pattern inside the same PostgreSQL transaction.\*\*



The Policy Engine writes the mandate decision and the `constraint\_enforcement\_audit` event to an `outbox` table in the same `SERIALIZABLE` transaction as the state transition. A background thread (APScheduler `IntervalTrigger` every 5s) polls `outbox WHERE processed\_at IS NULL`, publishes to the Ledger's REST endpoint, and marks processed. The main thread returns the guardrail decision in <50ms (NFR-PERF-001). The outbox guarantees at-least-once delivery; the Ledger deduplicates on `event\_id`.



\### 2. UCP Checkout State Machine TTL Triggers

\*\*Decision: APScheduler in-process inside Guardrail Shell (Module 4) for MVP.\*\*



\- \*\*Trigger mechanism\*\*: APScheduler with `DateTrigger` jobs scheduled at session creation time (`run\_date = now + TTL`).

\- \*\*At-least-once guarantee\*\*: The TTL job writes a `timeout\_event` to the PostgreSQL outbox (same pattern as Q1). If the Guardrail Shell crashes before the job fires, on restart it queries `checkout\_sessions WHERE state IN ('incomplete', 'requires\_escalation', 'ready\_for\_complete') AND expires\_at < now()` and replays the timeouts.

\- \*\*No message broker for MVP\*\* — PostgreSQL is the single source of truth for timeout events.



\### 3. Module Numbering \& Mandate Vault ↔ Payment Adapter Contract

\*\*Module map\*\*: See AI/LLM Q3.



\*\*Interface contract (MVP REST fallback)\*\*:



```http

POST /v1/payment/execute

Content-Type: application/json

X-Idempotency-Key: <key>



{

&#x20; "mandate\_id": "uuid",

&#x20; "signed\_payment\_mandate\_jws": "eyJhbGciOiJFUzI1NiJ9...",

&#x20; "idempotency\_key": "string",

&#x20; "amount\_paise": 499900,

&#x20; "currency": "INR",

&#x20; "constraint\_hash": "sha256:..."

}

```



\*\*Production protobuf\*\* (documented in SDD, not implemented for MVP):



```protobuf

message SignedPaymentMandate {

&#x20; string mandate\_id = 1;

&#x20; string compact\_jws = 2;

&#x20; string idempotency\_key = 3;

&#x20; int64 amount\_paise = 4;

&#x20; string currency = 5;

&#x20; string constraint\_hash = 6;

}



service PaymentAdapter {

&#x20; rpc ExecutePayment(SignedPaymentMandate) returns (PaymentResult);

&#x20; rpc GetPaymentStatus(TransactionQuery) returns (PaymentResult);

}

```



\### 4. Untrusted Ingestion Parsing

\*\*Decision: Official Google A2A SDK + Pydantic UCP models; fail closed.\*\*



\- \*\*A2A Agent Cards\*\*: Parse with the official `google-a2a` Python package (forked from their samples). Verify JWS signature against the `kid` in the card before any field is accessible to the LLM.

\- \*\*UCP manifests\*\*: Pydantic models (`UCPManifest`, `MerchantOffer`) derived from the NRF Jan 2026 spec. Validate structure before passing to Reasoning Core.

\- \*\*Rejection criteria \& HTTP status codes\*\*:

&#x20; - Invalid JSON / unparseable → `400 BAD\_REQUEST`

&#x20; - Schema validation failure → `400 SCHEMA\_VIOLATION`

&#x20; - Signature verification failure → `401 UNAUTHORIZED`

&#x20; - Missing required fields (`merchant\_id`, `payment\_methods`) → `422 UNPROCESSABLE\_ENTITY`

&#x20; - Sanitization pipeline failure (homoglyph, delimiter injection) → `400 SANITIZATION\_FAILURE`

\- \*\*Audit\*\*: Every rejection is written independently to the Ledger by the Ingestion service (INV-006, DR-006). Raw payload is logged as a SHA-256 hash, never the full payload (SEC-SEC-003).



\---



\## To Cryptography / Security Engineer



\### 1. Exact AP2 → UPI Constraint Mapping Matrix



| AP2 Constraint Field | UPI Autopay Representation | Cryptographically Enforced? | Policy Engine Enforced? | If UPI Cannot Enforce |

|---|---|---|---|---|

| `amount` | `token.max\_amount` (paise) | No — Razorpay API enforces at settlement | Yes — pre-debit check against compiled constraints | REJECT if > cap |

| `merchant\_scope` | Not a UPI token concept; enforced in order metadata | No | Yes — allowlist check against `CompiledConstraints.merchants` | REJECT if merchant not in scope |

| `expiry` | `token.expire\_at` | Yes — signed into Payment Mandate JWS | Yes — pre-debit timestamp check | REJECT if `now() > expire\_at` |

| `frequency` / `recurrence` | NPCI enum (`daily`, `weekly`, `monthly`, etc.) | Partial — token creation binds enum | Yes — validate enum membership | DEGRADE to nearest supported enum + audit (never silent) |

| `refundability\_requirement` | No native UPI support at debit time | No | No | ESCALATE to HITL (FR-MAP-001) |

| `partial\_fulfillment` | Single-block debit only | No | Yes — block partial-fulfillment mandates | REJECT for MVP (FR-MAP-001) |

| `billing\_cycle\_cap` | NPCI rule: max 1 successful debit per token per cycle | No | Yes — ledger tracks last\_debit\_date per mandate | REJECT if cycle already debited |



\*\*SDD output\*\*: This table is normative. Every row must have a corresponding unit test in the Policy Engine.



\### 2. Protocol Artifact \& Signature Lifecycle



\*\*Dependency graph\*\*:



```

IntentMandate (signed by buyer identity key)

&#x20;   │

&#x20;   ├──► contains: intent\_id, constraint\_hash, buyer\_did, validity\_window

&#x20;   │

&#x20;   ▼

CartMandate (signed by buyer mandate signing key)

&#x20;   │

&#x20;   ├──► inherits: intent\_id, constraint\_hash

&#x20;   ├──► introduces: cart\_id, merchant\_did, offer\_snapshot\_hash, agreed\_price\_paise

&#x20;   └──► parent\_hash: SHA-256(IntentMandate canonical bytes)

&#x20;   │

&#x20;   ▼

PaymentMandate (signed by buyer mandate signing key)

&#x20;   │

&#x20;   ├──► inherits: cart\_id, constraint\_hash

&#x20;   ├──► introduces: payment\_mandate\_id, razorpay\_token\_id, max\_amount\_paise, frequency\_enum, expire\_at

&#x20;   └──► parent\_hash: SHA-256(CartMandate canonical bytes)

```



\*\*What is signed at each stage\*\*:

\- \*\*Intent\*\*: Canonical JSON of the intent object (RFC 8785) + buyer DID proof.

\- \*\*Cart\*\*: Canonical JSON of cart object + `parent\_hash`.

\- \*\*Payment\*\*: Canonical JSON of payment object + `parent\_hash` + Razorpay token reference.



\*\*Binding identifiers\*\*: `intent\_id` → `cart\_id` → `payment\_mandate\_id`. Each downstream artifact includes the parent's hash, creating a cryptographic chain.



\*\*AP2 version\*\*: v0.1 (Google samples repo, January 2026). The SDD will reference the exact commit hash.



\### 3. Counterparty Identity \& Trust State Machine



\*\*Evidence required before autonomous negotiation\*\*:

1\. A2A Agent Card with valid JWS (`ES256`) from a resolvable DID.

2\. UCP manifest served over HTTPS at `/.well-known/ucp` with matching `merchant\_did`.

3\. Agent Card `updated\_at` within last 7 days (freshness check).

4\. Key ID (`kid`) not present in the revocation list.



\*\*Key discovery \& validation\*\*:

\- Agent Card exposes `publicKeyJwk` inline.

\- Key rotation: new `kid` published in updated Agent Card; old `kid` expires per `validUntil`.

\- Revocation list: a simple PostgreSQL table `revoked\_keys(kid, revoked\_at, reason)` checked by the Grounding Oracle.



\*\*Key status representation\*\*:

```json

{

&#x20; "did": "did:web:merchant.example.com",

&#x20; "kid": "2026-08-key-1",

&#x20; "publicKeyJwk": {"kty":"EC","crv":"P-256","x":"...","y":"..."},

&#x20; "status": "ACTIVE",

&#x20; "validFrom": "2026-08-01T00:00:00Z",

&#x20; "validUntil": "2026-11-01T00:00:00Z"

}

```



\*\*State transitions\*\*:

```

UNKNOWN ──\[schema valid + signature ok + not revoked + fresh]──► VERIFIED

VERIFIED ──\[expiry reached]────────────────────────────────────► EXPIRED

VERIFIED ──\[explicit revocation]───────────────────────────────► REVOKED

EXPIRED ──\[renewal with new validUntil]────────────────────────► VERIFIED

REVOKED ──(no transition back)────────────────────────────────► terminal

```



\### 4. State Authority, Race Conditions \& Concurrency Model



\*\*Authoritative state machine\*\* (simplified):



```

INTENT\_RECORDED ──► CART\_APPROVED ──► PAYMENT\_PENDING\_REGISTRATION ──► PAYMENT\_ACTIVE ──► SETTLED

&#x20;                                             │

&#x20;                                             ├──► REVOKED (AFA required)

&#x20;                                             └──► EXPIRED

```



\*\*Transition ownership\*\*:

| Transition | Owner Component | Serialization |

|---|---|---|

| `INTENT\_RECORDED` | Constraint Compiler | INSERT into ledger |

| `CART\_APPROVED` | Guardrail Shell | INSERT into ledger |

| `PAYMENT\_PENDING\_REGISTRATION` | Mandate Vault | INSERT into ledger |

| `PAYMENT\_ACTIVE` | Payment Adapter (on Razorpay webhook) | INSERT into ledger |

| `SETTLED` | Payment Adapter (on Razorpay success webhook) | INSERT into ledger |

| `REVOKED` | Guardrail Shell (on user/system request) | `SELECT ... FOR UPDATE` on mandate row, then INSERT revocation record |

| `EXPIRED` | Session Manager / Scheduler | Same as above |



\*\*Race condition handling (INV-004 / FR-MAP-003)\*\*:

The Payment Adapter must execute the following atomically:



```sql

BEGIN ISOLATION LEVEL SERIALIZABLE;

SELECT state FROM mandates WHERE mandate\_id = $1 FOR UPDATE;

\-- If state is REVOKED or EXPIRED: ROLLBACK, return MANDATE\_REVOKED / MANDATE\_EXPIRED

\-- If state is ACTIVE: proceed to debit, generate idempotency\_key, INSERT debit record

COMMIT;

```



The `SELECT ... FOR UPDATE` on the mandate state row (or the latest state row in an append-only design) ensures revocation wins any race. The ledger records the revocation before the debit attempt is allowed to proceed.



\---



\## To DevOps Engineer



\### 1. Internal Interface Contract \& Error Codes



\*\*Guardrail Shell → Mandate Vault\*\* (MVP REST):



```http

POST /v1/mandate/sign

{

&#x20; "mandate\_type": "INTENT | CART | PAYMENT",

&#x20; "payload\_canonical\_json": "string", // RFC 8785

&#x20; "key\_purpose": "ap2\_mandate\_signing"

}



Response 200:

{

&#x20; "compact\_jws": "eyJhbGciOiJFUzI1NiJ9...",

&#x20; "kid": "2026-08-ap2-1",

&#x20; "mandate\_hash": "sha256:..."

}

```



\*\*Mandate Vault → UPI Payment Adapter\*\* (MVP REST):



```http

POST /v1/payment/execute

GET  /v1/payment/status?transaction\_id=...

```



\*\*Graceful-failure error codes\*\* (SRS §6.5):



| Failure Mode | HTTP Status | Code | Returned By |

|---|---|---|---|

| Unauthorized merchant | 403 | `UNAUTHORIZED\_MERCHANT` | Guardrail Shell |

| Amount above cap | 400 | `AMOUNT\_EXCEEDED` | Guardrail Shell / Payment Adapter |

| Expired mandate | 403 | `MANDATE\_EXPIRED` | Guardrail Shell |

| Revoked mandate | 403 | `MANDATE\_REVOKED` | Payment Adapter (post-atomic check) |

| Schema violation | 400 | `SCHEMA\_VIOLATION` | Guardrail Shell |

| Grounding failure | 400 | `GROUNDING\_FAILURE` | Guardrail Shell |

| Duplicate request | 409 | `DUPLICATE\_REQUEST` | Payment Adapter (idempotency check) |

| Razorpay timeout/ambiguous | 202 | `PENDING\_RECONCILIATION` + HITL flag | Payment Adapter |



\### 2. Authoritative Source of Truth During Revocation/Debit Race

\*\*Decision: Single PostgreSQL row with `SELECT ... FOR UPDATE` for MVP.\*\*



The `mandates` table has a materialized `current\_state` column that is updated within the atomic lock. The append-only audit trail is maintained in a separate `mandate\_state\_history` table (INSERT-only). The `current\_state` row is the performance-optimized read model; the history table is the compliance/audit model. This satisfies both INV-004 (revocation wins race) and DR-002 (append-only audit).



\*\*Production\*\*: Migrate to outbox + Kafka consumer for async ledger writes, but the `SELECT ... FOR UPDATE` on the read model remains the concurrency control.



\### 3. IInventoryProvider Abstraction



```python

from typing import Protocol, List, Optional

from dataclasses import dataclass

from decimal import Decimal

from datetime import datetime



@dataclass(frozen=True)

class Product:

&#x20;   product\_id: str

&#x20;   name: str

&#x20;   price: Decimal          # Never float. Use Decimal for INR.

&#x20;   currency: str           # "INR" for MVP

&#x20;   available\_quantity: int

&#x20;   merchant\_id: str

&#x20;   updated\_at: datetime



@dataclass(frozen=True)

class MerchantCatalog:

&#x20;   merchant\_id: str

&#x20;   products: List\[Product]

&#x20;   last\_synced\_at: datetime



class IInventoryProvider(Protocol):

&#x20;   """Universal Commerce Adapter (Module 7) implements this.

&#x20;   Negotiation Engine (Module 3) and Guardrail Shell (Module 4)

&#x20;   consume only this protocol. No Shopify types leak above Module 7."""

&#x20;   

&#x20;   async def get\_product(self, product\_id: str) -> Optional\[Product]: ...

&#x20;   async def list\_products(self, merchant\_id: str) -> List\[Product]: ...

&#x20;   async def check\_availability(self, product\_id: str, quantity: int) -> bool: ...

&#x20;   async def get\_price(self, product\_id: str) -> Decimal: ...

&#x20;   async def get\_catalog(self, merchant\_id: str) -> MerchantCatalog: ...

```



\### 4. UCP Checkout Session TTL Ownership

\*\*Decision: Guardrail Shell (Module 4) owns TTL enforcement via an internal `SessionManager` sub-module.\*\*



Rationale:

\- The Guardrail Shell is deterministic and already owns policy, grounding, and confidence gating (FR-GRD-001–009).

\- Session timeout is a \*\*temporal policy check\*\* (e.g., "is this session still within its validity window?").

\- The Negotiation Engine (Module 3) is probabilistic and must never own stateful timeouts.

\- No new service for MVP — the Session Manager is a Python class inside the Guardrail Shell container, using APScheduler.



The Session Manager writes `SESSION\_TIMEOUT` audit events to the Ledger independently (DR-006).



\---



\## SDD Unblock Summary



| Blocker | Status | Governing Decision |

|---|---|---|

| Module numbering | \*\*Resolved\*\* | 1–8 frozen (see table) |

| Inter-service transport | \*\*Resolved\*\* | REST + JSON for MVP; gRPC/proto spec documented for production |

| ProposalObject serialization | \*\*Resolved\*\* | RFC 8785 canonical JSON in REST body; prevents float drift |

| Constraint audit schema | \*\*Resolved\*\* | Runtime guard + explicit JSON schema (see TL Q3) |

| Revocation race handling | \*\*Resolved\*\* | `SELECT ... FOR UPDATE` on mandate row |

| TTL trigger mechanism | \*\*Resolved\*\* | APScheduler in Guardrail Shell Session Manager |

| Identity state machine | \*\*Resolved\*\* | UNKNOWN → VERIFIED → (EXPIRED \\| REVOKED) |

| Failure signal payloads | \*\*Resolved\*\* | 8 explicit HTTP status + code mappings (see DevOps Q1) |



\*\*What is still needed before SDD drafting begins:\*\*

1\. \*\*LLM backend selection\*\* (GPT-4 vs Claude vs Gemini) — gates FR-GRD-006 implementation.

2\. \*\*Shopify dev store credentials\*\* — gates Module 7 integration test scope.



\*\*Ready to generate:\*\* Component interaction sequence diagram, PostgreSQL DDL, and OpenAPI contract YAML. Shall I proceed?

