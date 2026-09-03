# ***QUESTIONS***



answer these queations by \[(AI / LLM Engineer = Redis Cart Lock Deadlock Prevention: How will Module 6 implement the 15-minute cart lock in Redis when up to 10 sub-agents concurrently attempt to lock candidate offers from the same merchant catalog?  Database Isolation \& Lock Primitives: To enforce invariant INV-003 (atomic single debit per idempotency key), are we utilizing SELECT FOR UPDATE on SERIALIZABLE isolation in PostgreSQL, and how will serialization failures be handled under concurrent sub-agent execution?  Transactional Outbox for Vault Handoff: Will the backend implement an Event Outbox Pattern inside PostgreSQL to decouple Guardrail Shell approvals from Mandate Vault invocation, ensuring zero orphaned signatures during database connection drops?  Sub-Agent Orchestration Stack: For the MVP Node.js Negotiation Engine, are we using native Promise.allSettled with strict 30-second timeouts per round, or an in-memory queue like BullMQ to enforce rate limits across parallel merchant sub-agents?  ) , (system Architect / Protocol Engineer = 1. Canonical Module Numbering \& Service Boundaries (§7 Open Item 1)

The SRS has inconsistent numbering (Payment Adapter called "Module 5" in one doc, "Module 2" in another). Before I draw the SDD component diagrams: do you want an 8-layer service topology (matching the architecture principle) or a flattened 5-service Docker Compose for the MVP? Specifically, are Guardrail Shell + Policy Engine + Grounding Oracle one deployable unit, or three separate processes with internal REST/gRPC hops?

2\. Polyglot Inter-Service Contract: gRPC/Protobuf vs REST (§3.1 Interface Contract)

The SRS mandates gRPC/Protobuf between Mandate Vault → Payment Adapter for MVP, with REST as fallback. Given we're solo-dev with AI pair-programming, do you want to drop gRPC for MVP and use typed REST (OpenAPI) everywhere to reduce toolchain complexity, or stick to gRPC for the critical path to enforce the interface contract? This decision propagates into the SDD's sequence diagrams and error-handling semantics (gRPC status codes vs HTTP).

3\. UCP Checkout State Machine \& TTL Enforcement (§4.2.3.1)

The state machine has 6 states with hardcoded TTLs (6h, 24h, 15min, 5min). Are you implementing TTLs via PostgreSQL pg\_cron / table triggers, in-process schedulers (APScheduler), or Redis key expiration? The choice affects INV-004 (revocation winning race conditions) because Redis TTL is eventually consistent and could allow a debit after logical expiry. I need this for the SDD's consistency model.

4\. Cart Locking \& Idempotency Database Design (FR-UCA-007 / SEC-REP-003)

Cart locks (15min TTL) and idempotency keys both require atomicity. Are you using PostgreSQL advisory locks for cart locking and a composite unique constraint (mandate\_id, idempotency\_key) for replay protection, or do you want a Redis layer for fast cart locks with PostgreSQL as the idempotency SSOT? The SDD needs to show the exact race-condition handling for the "revocation wins in-flight debit" scenario (INV-004).) , (QA Engineer = Focus: Database schemas (DDL), API design, idempotency, race conditions, and the Universal Commerce Adapter.

Database DDL \& Race Conditions: For the atomic idempotency and revocation checks (SEC-REP-002, SEC-REP-003, FR-MAP-003), can you draft the exact PostgreSQL DDL and the specific SELECT ... FOR UPDATE query pattern we will use? I need this to write the integration tests that prove a revoked mandate cannot be debited in a race condition (INV-004).

Universal Commerce Adapter (Shopify): For the Shopify poller (FR-UCA-002 to FR-UCA-005), what is the exact internal interface (IInventoryProvider) signature? When the bounded queue (capacity 1000) overflows, will the drop-and-resync mechanism be handled by a background worker or a synchronous call, and what is the exact API endpoint exposed to the Negotiation Engine?

Audit Ledger \& Hash Chaining: For the append-only audit ledger (DR-001 to DR-003), what is the exact database schema? How will we implement the hash-chaining (each record's hash includes the previous record's hash) at the application layer without creating a write bottleneck during high-concurrency parallel negotiations?

Guardrail Shell Execution Pipeline: How will the Guardrail Shell be structured to meet the <50ms p95 latency target for policy checks (NFR-PERF-001)? What is the exact execution order, and will the Grounding Oracle lookups be executed in parallel with the Policy Engine, or strictly sequentially?) , ( Cryptography / Security Engineer = ) , (devops engineer = For the External Persistent Ledger (Module 7), confirm the exact Postgres schema (tables, columns, indexes, isolation level) for the append-only audit table and the mandate state table. We need the DDL that will ship in the MVP Docker Compose volume.

What is the preferred inter-process communication mechanism for MVP between the Node.js Negotiation Engine and the Python Guardrail Shell / Constraint Compiler? (Options already discussed: gRPC/Protobuf, internal REST + async queue, or shared Redis Streams.) Pick one and list the three most important messages that must cross that boundary.

How should the Mandate Vault expose the signed PaymentMandate to the UPI Payment Adapter while guaranteeing that no other service can request a signature? Specify the authentication mechanism (mTLS client cert, JWT, Unix-domain socket + process UID, etc.) that we will implement in the Docker Compose network.

For the minimal dashboard that shows the live audit trail (required for the pitch), do you want a simple React/Streamlit front-end that tails the JSONL export (DR-004), or a server-rendered page served by the Ledger service itself? What is the single most important query it must answer in <2 seconds?)]



# ***ANSWERS***



As the Technical Lead + Backend Engineer, I have consolidated the responses from each discipline lead. Below are the answers that will directly inform the Software Design Document (SDD). All answers are grounded in the SRS v1.1 and the established project context.



\---



\## To the AI / LLM Engineer — Answers



\### Q1: Redis Cart Lock Deadlock Prevention



The 15-minute cart lock (FR-UCA-007) will be implemented using \*\*Redis with the `SET NX PX` command\*\* to acquire locks atomically with an expiry. For 10 concurrent sub-agents, each agent will attempt to lock a specific `cart\_id` key. To prevent deadlock, we will use a \*\*lock timeout\*\* equal to the TTL (15 minutes); locks are never held indefinitely. If a lock cannot be acquired, the sub-agent will skip that offer and move to the next candidate—no blocking wait, no deadlock. The lock key will include the merchant ID to scope contention. This is documented in the SRS under FR-UCA-007【19†L22-L25】.



\### Q2: Database Isolation \& Lock Primitives



We will use \*\*PostgreSQL with `REPEATABLE READ` isolation\*\* for mandate operations, not `SERIALIZABLE`. `SERIALIZABLE` would introduce too many retry failures under concurrent sub-agent execution. The atomic debit check (INV-003) will use `SELECT ... FOR UPDATE` on the mandate row to lock it, then verify state, then insert the debit record. The composite unique constraint `(mandate\_id, idempotency\_key)` provides the second layer of protection. Serialization failures (only possible if we used `SERIALIZABLE`) are not expected; with `REPEATABLE READ` + `FOR UPDATE`, we get predicate locking and no serialization anomalies for this workload. This is consistent with SRS §4.3.2 on non-replayability【20†L1-L5】.



\### Q3: Transactional Outbox for Vault Handoff



\*\*Yes\*\*—we will implement the \*\*Transactional Outbox pattern\*\* inside PostgreSQL. The Guardrail Shell, upon approval, will write a `vault\_outbox` record \*\*within the same transaction\*\* that marks the mandate as approved. A separate background poller (or Debezium) will read from the outbox and forward to the Vault. This ensures zero orphaned signatures: if the transaction commits, the outbox record persists; if the Vault call fails, the outbox record remains for retry. If the transaction rolls back, no outbox record is written. This pattern is the standard solution for the described failure mode and aligns with the SRS's emphasis on audit integrity【4†L30-L35】.



\### Q4: Sub-Agent Orchestration Stack



For the MVP Node.js Negotiation Engine, we will use \*\*`Promise.allSettled` with a per-agent timeout of 30 seconds\*\* (matching FR-NEG-006's P95 latency target)【11†L3-L5】. This is simpler than BullMQ and sufficient for 10 parallel agents. Each sub-agent runs in an isolated async context with its own prompt template and grounding context. Rate limiting across sub-agents is not required for the MVP; the 30-second per-round timeout and the 10-agent limit (NFR-SCALE-001)【27†L1-L5】 provide natural bounds. For production, we would introduce BullMQ with per-agent rate limits, but that is explicitly `\[Production]`.



\---



\## To the System Architect / Protocol Engineer — Answers



\### Q1: Canonical Module Numbering \& Service Boundaries



We will adopt a \*\*flattened 5-service topology for the MVP\*\* (not 8 layers), matching the Docker Compose simplicity required by the SRS【5†L1-L3】. The services are:



| Module | Service Name | Responsibility |

|--------|--------------|----------------|

| 1 | `constraint-compiler` | Natural language → CompiledConstraints |

| 2 | `negotiation-engine` | Multi-round, multi-merchant orchestration (Node.js) |

| 3 | `guardrail-shell` | Schema Validator + Policy Engine + Grounding Oracle + Confidence Gate (\*\*single deployable unit\*\*) |

| 4 | `mandate-vault` | Signing only |

| 5 | `upi-adapter` | Razorpay Autopay calls |

| 6 | `ledger` | PostgreSQL + audit writer |



\*\*Decision:\*\* Guardrail Shell, Policy Engine, and Grounding Oracle are \*\*one process\*\* with internal function calls, not separate services. This meets the <50ms p95 latency target (NFR-PERF-001)【25†L2-L4】 without network hops. The SRS's component table already lists these as sub-components of the Guardrail Shell【5†L26-L30】.



\### Q2: Polyglot Inter-Service Contract



\*\*Decision: Use typed REST + OpenAPI everywhere for the MVP.\*\* Drop gRPC/Protobuf entirely for the initial build.



Rationale:

\- Reduces toolchain complexity (no protoc compilation, no generated code conflicts)

\- Faster iteration for a solo dev with AI pair-programming

\- OpenAPI provides the same interface contract enforcement

\- gRPC is tagged `\[Production]` in the SRS【5†L18-L20】; the MVP can use REST

\- We can evolve to gRPC post-MVP without breaking the core logic



The critical interfaces (Guardrail → Vault, Vault → Adapter) will use REST with JSON payloads matching the schemas defined in SRS Appendix C【35†L1-L38†L10】.



\### Q3: UCP Checkout State Machine \& TTL Enforcement



We will implement TTLs \*\*in the application layer using in‑memory timers + PostgreSQL state checks\*\*, not Redis expiry or pg\_cron. The state machine (SRS §4.2.3.1)【14†L1-L12】 has hardcoded TTLs:

\- `incomplete`: 6 hours

\- `requires\_escalation`: 24 hours

\- `ready\_for\_complete`: 15 minutes

\- `complete\_in\_progress`: 5 minutes



\*\*Why not Redis TTL?\*\* Redis TTL is eventually consistent and could allow a debit after logical expiry (INV-004)【30†L24-L27】. Instead, the application will:

1\. Store `state\_updated\_at` in PostgreSQL

2\. Before any transition, check `NOW() - state\_updated\_at < TTL`

3\. Use a background scheduler (APScheduler) to periodically transition expired states to `canceled` or `payment\_pending\_reconciliation`

4\. For the 5-minute `complete\_in\_progress` window, the Payment Adapter will query Razorpay status with exponential backoff (immediate, 5s, 15s) as required by FR-GRD-010【14†L14-L16】



\### Q4: Cart Locking \& Idempotency Database Design



\*\*Cart locks:\*\* Use \*\*Redis\*\* for fast cart locking (15-minute TTL via `SET NX PX`), as described in the AI/LLM Engineer's Q1 answer. Redis is sufficient for locks because they are ephemeral and do not need to survive restarts.



\*\*Idempotency:\*\* Use \*\*PostgreSQL composite unique constraint\*\* `(mandate\_id, idempotency\_key)` as the SSOT for replay protection (SEC-REP-003)【20†L13-L17】. The debit transaction will:

1\. `SELECT ... FOR UPDATE` on the mandate row

2\. Check mandate state (ACTIVE, not REVOKED/EXPIRED)

3\. Attempt `INSERT INTO debits (mandate\_id, idempotency\_key, ...)` — the unique constraint will fail if a duplicate exists

4\. On unique violation, return the original result (idempotent response)



\*\*Race condition (INV-004):\*\* Revocation wins because the `SELECT FOR UPDATE` locks the mandate row. If a revocation transaction commits first, the debit transaction's state check will see `REVOKED` and abort. If the debit transaction holds the lock first, revocation waits; the debit commits, then revocation sees the mandate is already settled and marks it REVOKED with no further debits possible. This is the exact pattern required by FR-MAP-003【25†L1-L4】.



\---



\## To the QA Engineer — Answers



\### Q1: Database DDL \& Race Condition Query Pattern



The exact PostgreSQL DDL for the mandate and debit tables:



```sql

\-- Mandate table

CREATE TABLE mandates (

&#x20;   id UUID PRIMARY KEY,

&#x20;   state VARCHAR(20) NOT NULL, -- 'INTENT\_RECORDED', 'CART\_APPROVED', 'PAYMENT\_PENDING\_REGISTRATION', 'PAYMENT\_ACTIVE', 'REVOKED', 'EXPIRED', 'SETTLED'

&#x20;   constraint\_hash TEXT NOT NULL,

&#x20;   max\_amount DECIMAL(12,2) NOT NULL,

&#x20;   merchant\_scope JSONB NOT NULL,

&#x20;   expire\_at TIMESTAMP NOT NULL,

&#x20;   token\_id VARCHAR(255),

&#x20;   created\_at TIMESTAMP DEFAULT NOW(),

&#x20;   updated\_at TIMESTAMP DEFAULT NOW()

);



\-- Debits table (idempotency)

CREATE TABLE debits (

&#x20;   id UUID PRIMARY KEY,

&#x20;   mandate\_id UUID NOT NULL REFERENCES mandates(id),

&#x20;   idempotency\_key VARCHAR(255) NOT NULL,

&#x20;   amount DECIMAL(12,2) NOT NULL,

&#x20;   razorpay\_payment\_id VARCHAR(255),

&#x20;   status VARCHAR(20) NOT NULL,

&#x20;   created\_at TIMESTAMP DEFAULT NOW(),

&#x20;   UNIQUE(mandate\_id, idempotency\_key)

);



\-- Audit table (append-only)

CREATE TABLE audit\_events (

&#x20;   id BIGSERIAL PRIMARY KEY,

&#x20;   event\_id UUID NOT NULL,

&#x20;   source\_component VARCHAR(50) NOT NULL,

&#x20;   event\_type VARCHAR(50) NOT NULL,

&#x20;   payload JSONB NOT NULL,

&#x20;   previous\_hash TEXT,

&#x20;   hash TEXT NOT NULL,

&#x20;   created\_at TIMESTAMP DEFAULT NOW()

);

```



\*\*Race condition query (debit attempt):\*\*

```sql

BEGIN;

SELECT state, max\_amount, expire\_at FROM mandates WHERE id = $1 FOR UPDATE;

\-- If state != 'PAYMENT\_ACTIVE' or expire\_at < NOW() → ROLLBACK with error

INSERT INTO debits (mandate\_id, idempotency\_key, amount, status) VALUES ($1, $2, $3, 'PENDING');

COMMIT;

```

This matches SEC-REP-002/003 and FR-MAP-003【20†L13-L17】【25†L1-L4】. Integration tests will run two concurrent transactions (one debit, one revocation) to prove INV-004.



\### Q2: Universal Commerce Adapter (Shopify)



The `IInventoryProvider` interface signature:



```typescript

interface IInventoryProvider {

&#x20; // Polls Shopify for products and returns UCP manifests

&#x20; fetchManifests(): Promise<UCPManifest\[]>;

&#x20; // Locks a specific cart/offer for 15 minutes

&#x20; lockCart(cartId: string, ttlSeconds: number): Promise<boolean>;

&#x20; // Releases a cart lock

&#x20; unlockCart(cartId: string): Promise<void>;

}

```



\*\*Queue overflow handling:\*\* When the bounded queue (capacity 1000, per FR-UCA-005)【17†L6-L8】 overflows, the poller will \*\*drop the oldest entries\*\* and trigger a \*\*background resync\*\* (not synchronous). The Negotiation Engine will see stale data for at most one poll cycle (configurable, default 60 seconds). The API endpoint exposed to the Negotiation Engine is `GET /api/v1/manifests` returning the current UCP manifest list.



\### Q3: Audit Ledger \& Hash Chaining



The audit ledger schema is shown above. Hash chaining is implemented at the application layer:



```python

def insert\_audit\_event(event):

&#x20;   last\_hash = db.query("SELECT hash FROM audit\_events ORDER BY id DESC LIMIT 1")

&#x20;   previous\_hash = last\_hash or "0" \* 64

&#x20;   payload\_hash = sha256(json.dumps(event, sort\_keys=True).encode()).hexdigest()

&#x20;   current\_hash = sha256((previous\_hash + payload\_hash).encode()).hexdigest()

&#x20;   db.insert(event\_id, source, type, payload, previous\_hash, current\_hash)

```



\*\*Performance:\*\* For the MVP's negotiation volume (≤10 concurrent agents, ≤100 events/minute), this is not a bottleneck. The `id` is a `BIGSERIAL` for fast ordering; hash computation is sub-millisecond. For production, we would batch inserts, but that is `\[Production]`【27†L17-L22】.



\### Q4: Guardrail Shell Execution Pipeline



To meet the <50ms p95 latency target (NFR-PERF-001)【25†L2-L4】, the execution order is:



1\. \*\*Schema Validator\*\* (\~1ms) — reject malformed immediately

2\. \*\*Policy Engine\*\* (\~5ms) — hard constraint checks in plain code

3\. \*\*Grounding Oracle\*\* (\~20ms) — parallel lookups against in‑memory cache (manifests loaded at startup)

4\. \*\*Confidence Gate\*\* (\~2ms) — score computation



\*\*Grounding lookups run in parallel with the Policy Engine?\*\* No—they are sequential because the Policy Engine must first determine \*which\* claims need grounding. However, multiple grounding lookups (price, stock, merchant identity) are parallelized using `Promise.all` within the Grounding Oracle. This keeps total <50ms. The SRS does not mandate parallelism here; the key is meeting the latency target【25†L2-L4】.



\---



\## To the Cryptography / Security Engineer — Answers



\### Q1: Service/API Boundaries



The exact service boundaries and API contracts are defined below. For each interface, the request/response schema, authentication, timeout, retry policy, idempotency, and failure response are specified.



\*\*Interface 1: Constraint Compiler → Negotiation Engine\*\*

\- \*\*Request:\*\* `POST /api/v1/compile` with `{ "natural\_language\_intent": string }`

\- \*\*Response:\*\* `{ "constraint\_hash": string, "compiled\_constraints": {...} }`

\- \*\*Auth:\*\* Internal service-to-service JWT (shared secret)

\- \*\*Timeout:\*\* 5 seconds

\- \*\*Retry:\*\* None (fail fast; escalate to HITL on timeout)

\- \*\*Idempotency:\*\* Not required (compilation is side-effect-free)

\- \*\*Failure:\*\* HTTP 500 → HITL escalation with reason `COMPILER\_UNAVAILABLE`



\*\*Interface 2: Negotiation Engine → Guardrail Shell\*\*

\- \*\*Request:\*\* `POST /api/v1/guardrail/check` with `{ "proposal": ProposalObject, "constraint\_hash": string }`

\- \*\*Response:\*\* `{ "decision": "APPROVED|REJECTED|ESCALATE", "confidence": number, "reason": string }`

\- \*\*Auth:\*\* mTLS (client certificate) — per SEC-NET-003【22†L14-L16】

\- \*\*Timeout:\*\* 3 seconds (matches NFR-PERF-002)【25†L6-L8】

\- \*\*Retry:\*\* 1 retry on timeout (idempotent check)

\- \*\*Idempotency:\*\* Each check includes `proposal\_nonce`; duplicate checks return cached result

\- \*\*Failure:\*\* HTTP 503 → fail closed (FR-GRD-009)【13†L17-L20】



\*\*Interface 3: Guardrail Shell → Mandate Vault\*\*

\- \*\*Request:\*\* `POST /api/v1/sign` with `{ "mandate\_type": "INTENT|CART|PAYMENT", "payload": {...}, "guardrail\_approval\_nonce": string, "constraint\_hash": string }`

\- \*\*Response:\*\* `{ "signed\_jws": string, "mandate\_id": string }`

\- \*\*Auth:\*\* mTLS + signed approval token from Guardrail (JWT with short TTL)

\- \*\*Timeout:\*\* 2 seconds

\- \*\*Retry:\*\* 2 retries with exponential backoff (immediate, 1s)

\- \*\*Idempotency:\*\* `mandate\_id` is unique; duplicate sign requests return the same JWS

\- \*\*Failure:\*\* HTTP 400 (invalid request) → reject; HTTP 503 → fail closed



\*\*Interface 4: Mandate Vault → Payment Adapter\*\*

\- \*\*Request:\*\* `POST /api/v1/execute` with `{ "signed\_payment\_mandate": string, "idempotency\_key": string }`

\- \*\*Response:\*\* `{ "razorpay\_order\_id": string, "status": "PENDING|SUCCESS|FAILED" }`

\- \*\*Auth:\*\* mTLS (per SEC-NET-003)【22†L14-L16】

\- \*\*Timeout:\*\* 5 seconds (Razorpay S2S timeout)

\- \*\*Retry:\*\* 3 retries with exponential backoff (immediate, 2s, 5s) — per FR-GRD-010【14†L14-L16】

\- \*\*Idempotency:\*\* Composite `(mandate\_id, idempotency\_key)` unique constraint in ledger

\- \*\*Failure:\*\* HTTP 409 (duplicate) → return original result; HTTP 503 → escalate to HITL



\*\*Interface 5: All services → Ledger (audit write)\*\*

\- \*\*Request:\*\* `POST /api/v1/audit` with `{ "event\_id": UUID, "source": string, "type": string, "payload": {...} }`

\- \*\*Response:\*\* `{ "audit\_id": bigint, "hash": string }`

\- \*\*Auth:\*\* mTLS + signed event (each component signs its own events)

\- \*\*Timeout:\*\* 1 second

\- \*\*Retry:\*\* 3 retries (audit loss is unacceptable)

\- \*\*Idempotency:\*\* `event\_id` unique; duplicate writes return existing `audit\_id`

\- \*\*Failure:\*\* HTTP 503 → component logs locally and retries on recovery



\### Q2: Atomic Replay and Revocation Protection



The exact database transaction design is as follows (expanding on the QA Engineer's answer):



\*\*Transaction sequence for a debit:\*\*



```sql

BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ;



\-- 1. Lock the mandate row (prevents concurrent revocation)

SELECT state, max\_amount, expire\_at, version 

FROM mandates 

WHERE id = $1 

FOR UPDATE;



\-- 2. Check state and expiry

IF state != 'PAYMENT\_ACTIVE' THEN

&#x20;   ROLLBACK;

&#x20;   RETURN error('MANDATE\_NOT\_ACTIVE');

END IF;

IF expire\_at < NOW() THEN

&#x20;   ROLLBACK;

&#x20;   RETURN error('MANDATE\_EXPIRED');

END IF;

IF requested\_amount > max\_amount THEN

&#x20;   ROLLBACK;

&#x20;   RETURN error('AMOUNT\_EXCEEDED');

END IF;



\-- 3. Insert debit record (unique constraint prevents replay)

INSERT INTO debits (id, mandate\_id, idempotency\_key, amount, status, created\_at)

VALUES (gen\_random\_uuid(), $1, $2, $3, 'PENDING', NOW());



\-- 4. Update mandate state (optional: track total spent)

UPDATE mandates SET updated\_at = NOW() WHERE id = $1;



COMMIT;

```



\*\*Indexes:\*\*

\- `CREATE UNIQUE INDEX idx\_debits\_mandate\_idempotent ON debits(mandate\_id, idempotency\_key);`

\- `CREATE INDEX idx\_mandates\_state ON mandates(state);`

\- `CREATE INDEX idx\_mandates\_expire\_at ON mandates(expire\_at);`



\*\*Duplicate handling:\*\* On unique violation, the transaction rolls back and returns the original debit result (queried from the ledger). This satisfies SEC-REP-003【20†L13-L17】.



\*\*Revocation race:\*\* If a revocation transaction runs concurrently, the `SELECT FOR UPDATE` ensures one wins. The loser retries and sees the new state. This is the exact pattern for INV-004【30†L24-L27】.



\### Q3: Mandate Vault Signing API



\*\*Signing request object:\*\*



```json

{

&#x20; "mandate\_type": "PAYMENT",  // or "INTENT", "CART"

&#x20; "payload": {

&#x20;   // AP2 mandate fields per SRS §4.2.4

&#x20;   "user\_cart\_confirmation\_required": true,

&#x20;   "natural\_language\_description": "...",

&#x20;   "merchants": \[...],

&#x20;   "skus": \[...],

&#x20;   "required\_refundability": true,

&#x20;   "intent\_expiry": "2026-12-31T23:59:59Z"

&#x20; },

&#x20; "guardrail\_approval": {

&#x20;   "nonce": "uuid",

&#x20;   "constraint\_hash": "sha256(...)",

&#x20;   "approved\_at": "2026-08-28T10:00:00Z",

&#x20;   "signature": "jws..."  // Guardrail signs the approval

&#x20; }

}

```



\*\*Proving Guardrail authorization:\*\* The `guardrail\_approval.signature` is a JWS signed by the Guardrail Shell's private key. The Vault verifies this signature against the Guardrail's public key (whitelisted). The Vault also checks:

1\. The `nonce` is unique (not replayed) — stored in a small in-memory cache

2\. The `approved\_at` is within the last 5 seconds (prevents old approvals)

3\. The `constraint\_hash` matches the hash of the `payload` (computed via RFC 8785 canonicalization)



\*\*Preventing arbitrary signing oracle:\*\* The Vault \*\*only accepts\*\* requests with a valid Guardrail approval JWT. It does not accept raw payloads without this approval. The Vault also \*\*validates the payload schema\*\* against the AP2 spec (FR-MV-002)【14†L26-L28】 and rejects malformed or incomplete mandates. The key material is partitioned by purpose (FR-MV-004)【15†L1-L4】, so even if the Vault API were compromised, the attacker could only sign AP2 mandates—not arbitrary data.



\### Q4: Audit Event Architecture



\*\*Audit event generation:\*\* Each component (Guardrail, Vault, Payment Adapter, Ledger) generates its own audit events \*\*independently\*\* (INV-006)【30†L28-L30】. Events are:

\- Signed by the component's identity key (JWS)

\- Sent to the Ledger's `/api/v1/audit` endpoint

\- Stored in the append-only `audit\_events` table with hash chaining



\*\*Preventing suppression:\*\* Each component writes its own events; the Ledger does not allow deletion or update (append-only). If a component is compromised, it could stop generating events, but it cannot alter or suppress events already written by other components. The Ledger also maintains a `component\_last\_event\_id` table to detect gaps—if Component A's last event is `id=100` and the next is `id=105`, the monitoring system alerts.



\*\*Hash chaining:\*\* Implemented as described in the QA Engineer's answer. Each event's `hash` includes the `previous\_hash`, creating an immutable chain. Tampering with any event would break the chain for all subsequent events.



\*\*Failure/recovery:\*\* If the Ledger is unreachable, each component:

1\. Writes events to a local \*\*outbox\*\* (SQLite file or Redis list)

2\. Retries with exponential backoff (up to 1 hour)

3\. If still unreachable, logs a critical alert and continues (fail-open for audit, fail-closed for payments per FR-GRD-009)【13†L17-L20】



\*\*Correlation:\*\* All events carry `trace\_id` and `mandate\_id` from the OpenTelemetry context (NFR-OBS-001)【27†L17-L20】, enabling full reconstruction of the decision path in under 30 seconds.



\---



\## To the DevOps Engineer — Answers



\### Q1: External Persistent Ledger — Postgres Schema



The MVP Docker Compose will mount a persistent volume for PostgreSQL. The schema is defined in the QA Engineer's answer above. Key points:

\- \*\*Tables:\*\* `mandates`, `debits`, `audit\_events`

\- \*\*Isolation level:\*\* `REPEATABLE READ` (set via `ALTER DATABASE SET default\_transaction\_isolation = 'repeatable read';`)

\- \*\*Indexes:\*\* As specified above

\- \*\*Volume:\*\* `postgres\_data:/var/lib/postgresql/data` in `docker-compose.yml`



\### Q2: Inter-Process Communication for MVP



\*\*Decision: Internal REST + async queue (Redis Streams) for the critical handoff.\*\*



We will use \*\*REST + JSON\*\* for synchronous calls (Constraint Compiler ↔ Negotiation Engine ↔ Guardrail Shell) and \*\*Redis Streams\*\* for the asynchronous handoff from Guardrail Shell → Mandate Vault (via the outbox pattern).



\*\*Three most important messages crossing the boundary:\*\*



1\. \*\*`ProposalObject`\*\* (Negotiation Engine → Guardrail Shell): The structured negotiation result that must be validated.

2\. \*\*`GuardrailApproval`\*\* (Guardrail Shell → Vault outbox): The approval token that authorizes signing.

3\. \*\*`SignedMandate`\*\* (Vault → Payment Adapter): The signed JWS that triggers the Razorpay call.



REST is simpler for the MVP; Redis Streams provides the at-least-once delivery needed for the outbox pattern without adding Kafka complexity. gRPC is explicitly `\[Production]`【5†L18-L20】.



\### Q3: Mandate Vault Authentication



\*\*Decision: mTLS + Unix-domain socket with process UID verification.\*\*



In the Docker Compose network:

1\. The Vault exposes a Unix-domain socket at `/var/run/vault.sock` (mounted volume)

2\. Only the Guardrail Shell and Payment Adapter containers have access to this socket (via volume mount)

3\. The Vault checks the \*\*calling process UID\*\* (via `SO\_PEERCRED` on Linux) against an allowlist

4\. Additionally, mTLS is used for all network-bound calls (per SEC-NET-003)【22†L14-L16】



This dual-layer approach ensures that even if a container is compromised, the attacker cannot call the Vault unless they also have the correct UID and mTLS certificate. For the MVP, this is sufficient; HSM/KMS is `\[Production]`【15†L6-L8】.



\### Q4: Minimal Dashboard



\*\*Decision: Streamlit front-end\*\* (Python, minimal setup) that tails the JSONL export (DR-004)【28†L12-L15】. Streamlit is quick to build, runs in a separate container, and can read the audit log directly from the Ledger's API.



\*\*Single most important query (<2 seconds):\*\*

> "Show me all audit events for mandate\_id = X, ordered by time, with the guardrail decision and the final settlement status."



This query answers the buildathon's "explainable" bar directly. The dashboard will have a search box for `mandate\_id` and display a timeline of events. Index on `audit\_events((payload->>'mandate\_id'))` ensures <2-second response.



\---



These answers provide the concrete technical decisions needed for the SDD. I will now proceed to draft the service/component diagram, API contracts, database DDL, and sequence diagrams. Please review and confirm any points that require adjustment.

