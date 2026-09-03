Final Roadmap: Thread 0 Steel Demo
Track: AI Growth & Agentic Commerce
Deadline: September 5, 2026
Today: August 29, 2026
Compute Budget: 25 hours (5 hrs/day × 5 days)
Stack: Python (FastAPI/Pydantic), PostgreSQL, Docker Compose, Razorpay Test Mode
Strategic Premise
You are not building 6 modules. You are building one narrow steel thread:
Human Intent → Constraint Compiler → LLM Proposal → Guardrail Shell → Mandate Vault → Razorpay UPI Autopay → Ledger
Everything else is stubbed or hardcoded for the demo. The probabilistic layer (parallel negotiation, MCP adapter, Shopify polling) is explicitly deferred to post-demo. The guardrail is the product.
Day 1 — The Skeleton & The Vault (Aug 29/30)
Goal: The deterministic bread is bakeable. Money cannot move yet, but the path exists and is guarded.
Table
Hour	Task	Output
0.0–1.0	Repo & Docker Compose scaffold: docker-compose.yml (Postgres 15, Redis, app container), .env.example, pyproject.toml with fastapi, pydantic, cryptography, psycopg2, jwcrypto, httpx	git init, running docker compose up
1.0–2.5	PostgreSQL Schema (DDL): mandates, audit_log, ledger, idempotency_keys. Audit table: no UPDATE/DELETE grants, append-only by design. Hash-chain: each row stores previous_hash, row_hash	migrations/001_init.sql
2.5–3.5	Mandate Vault (/vault): ES256 JWS signing using jwcrypto. Key loaded from env (software-backed, documented as MVP limitation). Exposes one internal endpoint: POST /sign guarded by API key. Signs AP2 Payment Mandates only.	vault/main.py with sign/verify
3.5–4.5	Constraint Compiler (/compiler): POST /compile takes NL intent, outputs CompiledConstraints (RFC 8785 canonicalized + SHA-256). Hard constraints: max_spend, allowed_merchants, valid_until, category_blocklist. Soft preferences separated.	compiler/main.py, JSON schema for output
4.5–5.0	Daily Steel Check + stub the Guardrail Shell interface. Write the Gherkin demo spec in DEMO.md.	DEMO.md with Given/When/Then
End-of-Day Invariant Proof:
[ ] INV-001: LLM container (doesn't exist yet) has no env var access to vault key. Verify via docker inspect.
[ ] INV-006: Run DELETE FROM audit_log → expect permission denied.
Stubbed: LLM layer, Razorpay adapter, Grounding Oracle (returns True with mock hash).
Day 2 — The Guardrail Shell (Aug 30/31)
Goal: No LLM output reaches the vault without passing schema, policy, grounding, and confidence checks.
Table
Hour	Task	Output
0.0–1.5	Schema Validator (/guardrail/schema.py): Validates ProposalObject (Appendix C.1 from SRS). Rejects unknown fields. Max 2 retries, then escalate.	Pydantic models + validator
1.5–2.5	Policy Engine (/guardrail/policy.py): Re-checks offer_price ≤ max_spend, merchant_id ∈ allowed_merchants, valid_until > now. Pure Python, zero LLM trust.	Unit tests: pass/fail/boundary
2.5–3.5	Grounding Oracle (/guardrail/grounding.py): Mock for Thread 0. Accepts merchant_id, offer_price, product_id. Returns verified: true + manifest_hash (hardcoded for demo merchant). Real implementation: compares against injected UCP manifest.	Mock with deterministic output
3.5–4.5	Confidence Gate (/guardrail/confidence.py): C = 0.40*S_logprob + 0.40*S_grounding + 0.20*S_schema. For MVP without logprobs, use self-consistency voting (FR-GRD-006a): run LLM 3×, check consensus. Threshold 0.85. Below → HITL payload.	Confidence calculator + HITL payload builder
4.5–5.0	Guardrail Integration (/guardrail/main.py): Single POST /evaluate endpoint. Pipeline: Schema → Policy → Grounding → Confidence. Returns APPROVED or ESCALATED.	Integrated FastAPI service
End-of-Day Invariant Proof:
[ ] INV-002: Only Guardrail Shell can reach Vault. Verify via network policy / code review.
[ ] INV-007: Feed random unsupported constraint → expect rejection, never silent drop.
[ ] INV-010: Proposal with offer_price = max_spend + 1 → Policy Engine rejects regardless of LLM "confidence".
Stubbed: LLM proposal generation (Day 4), actual Razorpay calls.
Day 3 — Razorpay Adapter & The Ledger (Aug 31/Sept 1)
Goal: Money can move from mandate to Razorpay Test Mode. The ledger records it atomically.
Table
Hour	Task	Output
0.0–1.5	UPI Payment Adapter (/adapter): POST /charge maps AP2 Payment Mandate → Razorpay UPI Autopay. Creates order, fires /payments/create/recurring with token_id. Enforces amount ≤ token.max_amount.	adapter/razorpay_client.py
1.5–2.5	Idempotency & Race Safety (/adapter/idempotency.py): DB unique constraint on (mandate_id, idempotency_key). SELECT ... FOR UPDATE on mandate state before debit.	Concurrency test with pytest-asyncio
2.5–3.5	Webhook Handler (/adapter/webhooks.py): Verifies Razorpay webhook HMAC-SHA256. On payment.captured → ledger SETTLED. On failure → FAILED.	Webhook endpoint + signature verify
3.5–4.5	Graceful Failure: Revocation Race (/adapter/revocation.py): Endpoint POST /revoke. Sets mandate REVOKED. If debit in flight, atomic check sees REVOKED → rejects with 403 MANDATE_REVOKED. Build the demo script for this.	Revocation service + race test
4.5–5.0	Ledger Writer (/ledger): Every component writes its own audit events. Append-only. JSONL export endpoint: GET /ledger/export.	ledger/writer.py, GET /ledger/export
End-of-Day Invariant Proof:
[ ] INV-003: Submit duplicate (mandate_id, idempotency_key) → rejected, original result returned.
[ ] INV-004: Revoke mandate → immediately attempt debit → 403 MANDATE_REVOKED. Audit shows REVOKED before DEBIT_ATTEMPT.
[ ] INV-005: Every audit record timestamp ≥ execution timestamp.
Stubbed: Actual LLM (still), Shopify adapter (manual manifest file).
Day 4 — The Probabilistic Filling (Sept 1/2)
Goal: The LLM generates a proposal, the guardrail approves it, and the full Thread 0 flow executes end-to-end.
Table
Hour	Task	Output
0.0–1.5	LLM Sub-Agent (/reasoning): Single merchant only. Takes CompiledConstraints + merchant context (hardcoded UCP manifest). Uses OpenAI/Anthropic API with structured output (JSON mode) to emit ProposalObject. No tool calls, no secrets in context.	reasoning/agent.py
1.5–2.5	Orchestrator (/orchestrator): Ties the sandwich together. POST /buy accepts NL intent. Flow: Compile → Reason → Guardrail → (if APPROVED) → Vault Sign → Adapter Charge → Ledger Record. Returns trace ID.	orchestrator/main.py
2.5–3.5	Prompt Injection Guard (/guardrail/sanitize.py): Sanitizes all external text before LLM ingestion. Structural stripping of instruction-like patterns, delimiter neutralization, Unicode NFKC normalization.	Sanitizer + 5 hand-crafted test vectors
3.5–4.5	End-to-End Happy Path Test: "Buy noise-canceling headphones under ₹5000 from DemoMerchant." Expect: SETTLED in ledger, Razorpay test charge created, JSONL export shows full trace.	tests/e2e/test_happy_path.py
4.5–5.0	End-to-End Failure Test: Same flow, but revoke mandate mid-flight. Expect: 403 MANDATE_REVOKED, audit trail explains why.	tests/e2e/test_revocation_race.py
End-of-Day Invariant Proof:
[ ] INV-008: Feed malicious manifest with instruction-like text → sanitizer strips it, LLM never sees raw instructions.
[ ] Full Gherkin spec from Day 1 now passes in CI.
Stubbed: Parallel negotiation (1 merchant), MCP adapter (direct HTTP), Shopify polling (static manifest.json file).
Day 5 — Demo Polish & Submission (Sept 2/3)
Goal: The repository is submission-ready. The 5-minute pitch video is recorded. The demo is reproducible.
Table
Hour	Task	Output
0.0–1.0	Observability for Demo: Structured JSON logs to stdout with mandate_id, transaction_id, decision, constraint_hash. docker compose logs is the "trace UI."	Log format spec in README.md
1.0–2.0	README & Architecture Doc: Setup instructions (docker compose up && ./demo.sh). Architecture diagram (ASCII or Mermaid). Security boundaries explained. Explicit [MVP] vs [Production] tagging.	README.md, ARCHITECTURE.md
2.0–3.0	Demo Script Automation (demo.sh): Runs the happy path + revocation race. Exports JSONL audit trail live. No manual typing during video.	demo.sh
3.0–4.0	Pitch Video Recording (5 min): 1 min problem, 1 min architecture (Deterministic Sandwich), 2 min live demo (happy path + graceful failure), 1 min roadmap.	pitch.mp4 uploaded
4.0–5.0	Repo Cleanup & Final CI: pytest passes. No secrets in git. .env.example has placeholders. GitHub Actions runs unit + integration tests. Push to public repo.	Clean public repository
End-of-Day Checklist:
[ ] docker compose up → ./demo.sh → happy path passes
[ ] ./demo.sh --failure → revocation race passes
[ ] GET /ledger/export returns JSONL with complete decision path
[ ] Pitch video under 5 minutes
[ ] Repo is public, README has setup instructions
What Is Explicitly NOT Built (Deferred)
Table
Item	Why Deferred	Post-Demo Path
Parallel negotiation (10 merchants)	Thread 1 scope. Adds complexity without proving the core safety model.	Add Redis Streams + sub-agent pool
Shopify Universal Commerce Adapter	Manual manifest.json suffices for one demo merchant.	Poll REST Admin API → auto-generate UCP manifest
MCP Adapter	Direct HTTP calls between components for Thread 0.	Wrap as MCP tools for Claude/GPT
OpenTelemetry / Jaeger	Structured JSON logs to stdout satisfy the demo bar.	Replace with OTel + Jaeger in Thread 2
HSM / KMS	Software keys with process isolation, documented as limitation.	AWS KMS / HashiCorp Vault
TLA+ Verification	Formal model is [Production] per SRS.	Model UCP state machine post-hackathon
500-vector injection suite	5 hand-crafted vectors for MVP.	Scale to 500 with property-based testing
Daily Steel Check (Ask at 5h mark each day)
What moved? (Functional) — Did money flow, or did a guardrail block it correctly?
What is now impossible? (Governed) — Which attack vector did we close today?
What can I prove? (Observable) — Which audit record / test / trace demonstrates it?
Final Deliverables for Sept 5
Table
Deliverable	Location	Bar
Public Repository	GitHub	README.md + ARCHITECTURE.md + working docker compose up
5-Min Pitch Video	YouTube / Drive	Problem → Sandwich Architecture → Live Demo → Roadmap
Live Demo Evidence	demo.sh + JSONL export	Happy path + one graceful failure (revocation race)
Gherkin Spec	DEMO.md	Written Day 1, passing by Day 4
