# 🛡️ Agentic UPI Commerce Bridge (AP2 × Razorpay UPI Autopay)

> **Autonomous AI Agent for Governed Commerce with Zero Unsupervised Money Movement**  
> *Track: AI Growth & Agentic Commerce | Razorpay Buildathon 2026*  
> **Production Readiness:** 95%+ Turn-Key ([PRODUCTION_MIGRATION.md](PRODUCTION_MIGRATION.md)) | **Test Suite:** 71/71 Passing (100%)

---

## 🌟 Executive Summary

The **Agentic UPI Commerce Bridge** solves the core fundamental dilemma of autonomous e-commerce: **How do we empower AI agents to negotiate and purchase goods while guaranteeing they cannot hallucinate prices, double-debit accounts, exceed budgets, or ignore user revocation?**

We introduce the **Deterministic Sandwich Architecture**: probabilistic LLM reasoning is strictly enclosed between deterministic constraint compilation and cryptographic guardrail enforcement. The AI agent never touches private signing keys, never touches payment credentials, and cannot unilaterally authorize money movement.

---

## 🏗️ Architecture: The 5-Stage Deterministic Sandwich

```
[ Buyer Natural Language Intent ]
               │
┌──────────────▼──────────────────────────────────────────────────────────┐
│ STAGE 1: CONSTRAINT COMPILER (Deterministic Input)                      │
│ • Natural Language → Strict RFC 8785 Canonical JSON                     │
│ • Mathematical SHA-256 Constraint Digest Generation                     │
│ • Hard constraints (max_spend, merchants) vs soft preferences separated │
└──────────────┬──────────────────────────────────────────────────────────┘
               │ (Canonical Digest: sha256:...)
┌──────────────▼──────────────────────────────────────────────────────────┐
│ STAGE 2: UNTRUSTED REASONING CORE (Probabilistic AI)                    │
│ • Isolated Container Network (net-llm: zero egress to vault or payment)  │
│ • Tiered Provider Cascade: Groq (fast) ➔ Gemini 3.6 Flash ➔ OpenRouter │
│ • Prompt Injection Defense: Unicode NFKC + Delimiter Sanitizer (INV-008)│
└──────────────┬──────────────────────────────────────────────────────────┘
               │ (Draft Unsigned ProposalObject)
┌──────────────▼──────────────────────────────────────────────────────────┐
│ STAGE 3: GUARDRAIL SHELL & GROUNDING ORACLE (Deterministic Gate)        │
│ • Pydantic v2 Strict Schema Validation (INV-007: extra="forbid")        │
│ • Pure Python Policy Engine: Budget Limits Enforced (INV-010)           │
│ • Grounding Oracle: Cryptographic Merchant Manifest Hash Verification    │
│ • Confidence Gate: C = 0.40·S_logprob + 0.40·S_ground + 0.20·S_schema   │
└──────────────┬──────────────────────────────────────────────────────────┘
               │ (Verified Proposal + Manifest Hash)
┌──────────────▼──────────────────────────────────────────────────────────┐
│ STAGE 4: MANDATE VAULT (Cryptographic Signing)                          │
│ • RFC 8785 Canonical Serialization (JCS)                                │
│ • Asymmetric ES256 JWS Cryptographic Signatures (INV-009)               │
│ • Algorithm Allowlist (fails closed on alg: none)                       │
│ • Dual-Signer: Software P-256 KeyManager ⇄ AWS CloudHSM / KMS Adapter   │
└──────────────┬──────────────────────────────────────────────────────────┘
               │ (Cryptographic Autonomous Mandate: JWS Compact)
┌──────────────▼──────────────────────────────────────────────────────────┐
│ STAGE 5: SETTLEMENT & IMMUTABLE AUDIT LEDGER (Execution)                │
│ • Razorpay UPI Autopay S2S API (Orders, Recurring Debits, Refunds)      │
│ • Idempotency Guarantee: UNIQUE(mandate_id, idempotency_key) (INV-003) │
│ • Atomic Revocation Engine: Revocation wins any in-flight race (INV-004)│
│ • Dual-Mode Persistence: SQLite WAL ACID ⇄ PostgreSQL 15+ Cluster       │
│ • Append-Only Hash-Chained Audit Log: Zero UPDATE/DELETE grants (INV-005)│
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 💻 Modern Web Application & Mobile Experience

The project features a full **Next.js 16 (Turbopack) & React 19** executive dashboard with **7 specialized views**:

| Tab | Feature | Highlights |
|---|---|---|
| **🛒 Buyer Co-Pilot** | Natural language purchasing agent | Live SSE streaming, step-by-step reasoning transparency, real-time audit trail |
| **🏬 Seller Co-Pilot** | Merchant autonomy assistant | AI dynamic pricing, competitor market scans, SKU creation, auto-clearance markdown rules |
| **📦 Universal Catalog** | Multi-category live marketplace | Groceries, electronics, fashion, audio, smart search, stock tracking, "Buy with AI" |
| **📜 Mandates Manager** | UPI Autopay lifecycle monitor | Active tokens, real-time atomic revocation, settlement history, UMN tracking |
| **🛡️ Invariants & Security**| Real-time security dashboard | Live status of all 10 security invariants (INV-001 to INV-010) with audit proofs |
| **👤 Profile & Security** | User governance & PIN control | Spending ceilings, UPI handle binding, passkey/PIN gate for manual overrides |
| **⚙️ Advanced Tools** | Forensic & developer utilities | Webhook simulators, audit log viewer, raw JSONL exporter, cryptographic JWKS inspector |

### 📱 Cross-Platform & Mobile Optimized
- **Pinch-to-Zoom**: Custom touch container supporting **0.5x to 2.0x pinch zoom** across all 7 views on Android and iOS.
- **PIN Gate Protection**: Prevents unauthorized manual/autonomous overrides without re-prompting on consecutive mode switches.
- **Dynamic Viewport**: Fully responsive glassmorphism UI designed for mobile screens and desktop workstations.

---

## 🔒 10 Security Invariants (Mathematically & Formally Enforced)

| ID | Invariant Name | Enforcement Mechanism |
|:---:|---|---|
| **INV-001** | Zero Key LLM Isolation | Docker network isolation (`net-llm` is `internal: true`); LLM never touches credentials |
| **INV-002** | Mandatory Guardrail Shell Gate | Code-level gate: only approved proposals invoke `sign_canonical_payload()` |
| **INV-003** | Idempotency Guarantee | Database `UNIQUE(mandate_id, idempotency_key)` constraint + lock |
| **INV-004** | Revocation Priority Race | Per-mandate mutex lock simulating `SELECT ... FOR UPDATE` with HTTP 403 response |
| **INV-005** | Append-Only Immutable Ledger | Audit events table with zero `UPDATE` or `DELETE` grants; SHA-256 hash chaining |
| **INV-006** | Independent Audit Writing | Each component writes audit events independently via dedicated bus |
| **INV-007** | Fail-Closed Protocol Validation | Pydantic v2 `extra = "forbid"` schema validation rejects unknown fields |
| **INV-008** | Adversarial Input Sanitization | Unicode NFKC normalization + delimiter stripping before prompt ingestion |
| **INV-009** | Cryptographic Integrity Gate | Strict `ES256` algorithm allowlist; rejects `alg: none` and hash mismatches |
| **INV-010** | Deterministic Spending Bound | Pure Python checks: `offer_price ≤ max_spend`; zero trust in LLM outputs |

---

## 📁 Repository Structure

```
razorpay-buildathon/
├── frontend/                       # Next.js 16 (Turbopack) Full React Application
│   ├── src/
│   │   ├── app/                    # App Router, Layout, Global CSS
│   │   ├── components/             # Buyer, Seller, Catalog, Mandates, Security, Profile
│   │   ├── hooks/                  # Mobile touch zoom, card glow, SSE listeners
│   │   └── lib/                    # API client, Profile Store, State Management
│   └── package.json
├── modules/                        # Backend Microservices & Monolith Pipeline
│   ├── constraint_compiler/        # Stage 1: NL intent → RFC 8785 canonical hashed constraints
│   ├── reasoning_core/             # Stage 2: Multi-provider cascade (Groq / Gemini / OpenRouter)
│   ├── guardrail_shell/            # Stage 3: Schema + Policy (INV-010) + Grounding + Confidence
│   ├── mandate_vault/              # Stage 4: ES256 JWS Cryptographic Vault (Software + AWS KMS)
│   ├── upi_payment_adapter/        # Stage 5: Razorpay UPI Autopay S2S + Idempotency + Revocation
│   ├── universal_commerce_adapter/ # Module 7: Multi-channel models, Shopify GraphQL, ONDC Beckn
│   ├── ledger/                     # Stage 5: Append-only hash-chained audit ledger
│   ├── orchestrator/               # Central FastAPI Coordinator (POST /buy, SSE streaming)
│   └── sanitizer/                  # SEC-PI-001: Prompt injection defense
├── sql/init/                       # PostgreSQL 15 DDL Schema (001_init.sql)
├── tests/                          # 71 Unit + Integration + E2E Tests (100% Passing)
│   ├── e2e/                        # End-to-end steel thread & revocation race tests
│   ├── test_adapter.py             # Razorpay client & idempotency tests
│   ├── test_compiler.py            # Constraint compiler & determinism tests
│   ├── test_guardrail.py           # Guardrail shell & invariant tests
│   ├── test_ledger.py              # Hash-chaining & canonicalization tests
│   ├── test_sanitizer.py           # Prompt injection attack vector tests
│   ├── test_seller.py              # Multi-channel catalog & seller authorization tests
│   └── test_vault.py               # ES256 JWS cryptographic signing & tampering tests
├── audit_logs/                     # Live JSON, Markdown, and JSONL audit traces
├── demo.py                         # Multi-scenario automated terminal demo
├── DEMO.md                         # Gherkin acceptance specifications
├── ARCHITECTURE.md                 # Technical architecture reference
├── PRODUCTION_MIGRATION.md         # 1-Minute Live Production Migration Guide
├── .env.production.example         # Production environment template
├── docker-compose.yml              # Isolated network bridge configuration
├── requirements.txt                # Python dependencies
└── start_dev.bat                   # 1-Click developer launcher
```

---

## ⚡ Quick Start & Verification

### 1. Run Automated Test Suite (71/71 Tests)
```bash
# Python 3.10+ in virtual environment
pytest tests/ -v
```

### 2. Run Scenario Demo
```bash
# Run all scenarios: Happy Path, Revocation Race, Policy Block, Live Cascade
python demo.py --all
```

### 3. Run Web Dashboard Locally
```bash
# Terminal 1: Backend Orchestrator
uvicorn modules.orchestrator.main:app --port 8000 --reload

# Terminal 2: Frontend Dashboard
cd frontend
npm install
npm run dev
```
Open **http://localhost:3000** in your browser or mobile emulator.

---

## 🚀 1-Minute Production Migration

The codebase is engineered with **pluggable dependency injection** allowing instantaneous transition to live production:

| Component | Sandbox / Demo State | Production Drop-in Bridge | Reference |
|---|---|---|---|
| **Real Money** | Direct S2S `api.razorpay.com` calls (Test credentials) | Set `RAZORPAY_MODE=live` + API Keys | [`modules/upi_payment_adapter/razorpay_client.py`](modules/upi_payment_adapter/razorpay_client.py) |
| **Real Verification** | Software P-256 JWS Keys (`jwcrypto`) | Set `AWS_KMS_KEY_ARN` (FIPS 140-2 Level 3) | [`modules/mandate_vault/crypto.py`](modules/mandate_vault/crypto.py) |
| **Real Products** | Local JSON Catalog with Stock Decrement | Shopify Admin GraphQL / ONDC Beckn Gateway | [`modules/universal_commerce_adapter/connectors.py`](modules/universal_commerce_adapter/connectors.py) |
| **Enterprise DB** | SQLite WAL ACID isolation | Set `DATABASE_URL` for PostgreSQL 15+ cluster | [`sql/init/001_init.sql`](sql/init/001_init.sql) |

For complete deployment instructions, see **[PRODUCTION_MIGRATION.md](PRODUCTION_MIGRATION.md)**.

---

## 📜 License

MIT License. Designed and engineered for the **Razorpay Buildathon 2026**.
