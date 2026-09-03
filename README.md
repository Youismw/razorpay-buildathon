# Agentic UPI Commerce Bridge

> **AP2/UCP × Razorpay UPI Autopay — Governed Agentic Commerce**  
> Track: AI Growth & Agentic Commerce | Razorpay Buildathon 2026

An AI agent that can autonomously negotiate and settle purchases via UPI Autopay — with **zero unsupervised money movement**. Every LLM proposal passes through a deterministic guardrail shell before reaching the cryptographic mandate vault.

---

## 🏗️ Architecture: The Deterministic Sandwich

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         ORCHESTRATOR (POST /buy)                        │
│                                                                         │
│  ┌─────────────┐   ┌──────────────┐   ┌───────────────┐   ┌─────────┐ │
│  │  Constraint  │──▶│   Reasoning  │──▶│   Guardrail   │──▶│ Mandate │ │
│  │  Compiler    │   │   Core (LLM) │   │   Shell       │   │ Vault   │ │
│  │              │   │              │   │               │   │ (ES256) │ │
│  │  RFC 8785    │   │  Gemini /    │   │ Schema        │   │         │ │
│  │  SHA-256     │   │  Mock        │   │ Policy        │   │ JWS     │ │
│  │              │   │              │   │ Grounding     │   │ Sign    │ │
│  │              │   │  Sanitized   │   │ Confidence    │   │         │ │
│  └─────────────┘   └──────────────┘   └───────────────┘   └────┬────┘ │
│                                                                  │      │
│  ┌─────────────────────────────────────┐   ┌─────────────────────▼────┐ │
│  │  UPI Payment Adapter               │   │  Append-Only Ledger      │ │
│  │  Razorpay Autopay S2S              │   │  Hash-Chained Audit      │ │
│  │  Idempotency + Revocation Race     │   │  JSONL Export             │ │
│  └─────────────────────────────────────┘   └──────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

**Key invariant:** The LLM has **zero** signing keys, **zero** payment credentials, and **zero** direct access to the vault or payment adapter.

---

## 🚀 Quick Start

### Prerequisites
- **Docker Desktop** (running)
- **Python 3.10+** (for local tests/demo)
- **Git**

### Setup

```bash
# 1. Clone the repo
git clone <repo-url>
cd razorpay-buildathon

# 2. Copy environment config
cp .env.example .env
# Edit .env and set your GEMINI_API_KEY (optional for mock mode)

# 3. Install Python dependencies
pip install -r requirements.txt

# 4. Start infrastructure (PostgreSQL, Redis, Jaeger)
docker compose up -d

# 5. Run the demo
python demo.py --all
```

### Demo Commands

```bash
python demo.py              # Happy path only
python demo.py --failure    # Revocation race (graceful failure)
python demo.py --policy     # Policy enforcement (over-budget blocked)
python demo.py --all        # All 3 scenarios
```

---

## 📁 Project Structure

```
razorpay-buildathon/
├── modules/
│   ├── constraint_compiler/    # Module 1: NL intent → RFC 8785 hashed constraints
│   ├── reasoning_core/         # Module 2: LLM proposal generation (Gemini/mock)
│   ├── guardrail_shell/        # Module 4: Schema + Policy + Grounding + Confidence
│   ├── mandate_vault/          # Module 5: ES256 JWS signing (jwcrypto)
│   ├── upi_payment_adapter/    # Module 6: Razorpay Autopay + Idempotency + Revocation
│   ├── universal_commerce_adapter/  # Module 7: [Stubbed] Shopify UCP adapter
│   ├── ledger/                 # Module 8: Hash-chained append-only audit log
│   ├── orchestrator/           # Coordinator: POST /buy full steel thread
│   └── sanitizer/              # SEC-PI-001: Prompt injection defense
├── sql/init/                   # PostgreSQL DDL (001_init.sql)
├── tests/                      # Unit + integration tests
│   ├── e2e/                    # End-to-end steel thread tests
│   ├── test_ledger.py
│   ├── test_vault.py
│   ├── test_compiler.py
│   ├── test_guardrail.py
│   ├── test_adapter.py
│   └── test_sanitizer.py
├── demo.py                     # Automated demo runner
├── DEMO.md                     # Gherkin acceptance specs
├── ARCHITECTURE.md             # Detailed architecture doc
├── docker-compose.yml          # Infrastructure (Postgres, Redis, Jaeger)
├── requirements.txt
├── .env.example
└── .gitignore
```

---

## 🔒 Security Invariants

| ID | Invariant | Enforcement |
|---|---|---|
| INV-001 | LLM never touches private keys or payment credentials | Docker network isolation (`net-llm` is `internal: true`) |
| INV-002 | Guardrail Shell is the single mandatory gate to Vault | Code-level: only guardrail-approved proposals reach `sign_canonical_payload()` |
| INV-003 | `(mandate_id, idempotency_key)` uniqueness at DB level | DB `UNIQUE` constraint + in-memory `IdempotencyStore` |
| INV-004 | Revocation wins any race against in-flight debits | Per-mandate `threading.Lock` simulating `SELECT ... FOR UPDATE` |
| INV-005 | All actions recorded in append-only hash-chained ledger | `audit_events` table: no `UPDATE`/`DELETE` grants |
| INV-006 | Independent component audit writing | Each module writes its own events via `POST /v1/audit/event` |
| INV-007 | Protocol mismatches explicitly rejected, never silently dropped | Schema validator `extra = "forbid"` + unknown field rejection |
| INV-008 | External inputs can influence proposals but never constitute payment authorizations | Sanitizer strips injection patterns before LLM ingestion |
| INV-009 | Signature/canonicalization mismatches fail closed | Algorithm allowlist (`ES256` only) + hash verification before signing |
| INV-010 | Spending bounds enforced strictly in deterministic Policy Engine | Pure Python checks: `offer_price ≤ max_spend`, zero LLM trust |

---

## 🧪 Running Tests

```bash
# All tests
pytest tests/ -v

# Specific modules
pytest tests/test_ledger.py -v
pytest tests/test_vault.py -v
pytest tests/test_guardrail.py -v
pytest tests/test_adapter.py -v
pytest tests/test_sanitizer.py -v

# E2E tests
pytest tests/e2e/ -v
```

---

## 🏷️ MVP Limitations vs Production

| Feature | Thread 0 (MVP) | Production |
|---|---|---|
| Key Storage | Software-backed (`jwcrypto`) | AWS KMS / HashiCorp Vault |
| Grounding Oracle | Hardcoded demo catalog | Live UCP manifest polling |
| LLM Provider | Mock / Gemini single-call | Multi-provider with self-consistency voting |
| Merchant Negotiation | Single merchant | Parallel 10-merchant negotiation via Redis Streams |
| Observability | Structured JSON logs + JSONL export | OpenTelemetry + Jaeger |
| Formal Verification | Manual invariant checks | TLA+ state machine model |
| Injection Defense | 5 hand-crafted vectors | 500-vector property-based test suite |

---

## 📜 License

MIT
