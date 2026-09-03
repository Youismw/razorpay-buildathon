-- ============================================================
-- Agentic UPI Commerce Bridge — MVP Database Schema (001_init.sql)
-- PostgreSQL 15 | SERIALIZABLE isolation on critical paths
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Mandates Table (SSOT for mandate lifecycle)
CREATE TABLE IF NOT EXISTS mandates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    state VARCHAR(35) NOT NULL CHECK (state IN (
        'INTENT_RECORDED', 'CART_APPROVED', 'PAYMENT_PENDING_REGISTRATION',
        'PAYMENT_ACTIVE', 'SETTLED', 'REVOKED', 'EXPIRED'
    )),
    mandate_type VARCHAR(20) NOT NULL CHECK (mandate_type IN ('INTENT', 'CART', 'PAYMENT')),
    constraint_hash TEXT NOT NULL,
    max_amount DECIMAL(12,2) NOT NULL,
    merchant_scope JSONB NOT NULL DEFAULT '[]',
    validity_window_hours INT NOT NULL DEFAULT 24,
    expire_at TIMESTAMP WITH TIME ZONE NOT NULL,
    token_id VARCHAR(255),
    buyer_did VARCHAR(255),
    merchant_did VARCHAR(255),
    parent_mandate_id UUID REFERENCES mandates(id),
    signed_jws TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mandates_state ON mandates(state);
CREATE INDEX IF NOT EXISTS idx_mandates_expire_at ON mandates(expire_at);
CREATE INDEX IF NOT EXISTS idx_mandates_buyer ON mandates(buyer_did);

-- 2. Debits Table (Idempotency + Settlement)
CREATE TABLE IF NOT EXISTS debits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mandate_id UUID NOT NULL REFERENCES mandates(id),
    idempotency_key VARCHAR(255) NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    razorpay_payment_id VARCHAR(255),
    razorpay_order_id VARCHAR(255),
    status VARCHAR(20) NOT NULL CHECK (status IN ('PENDING', 'SUCCESS', 'FAILED', 'RECONCILING')),
    retry_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_mandate_idempotency UNIQUE(mandate_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_debits_mandate ON debits(mandate_id);
CREATE INDEX IF NOT EXISTS idx_debits_status ON debits(status);

-- 3. Audit Events Table (Append-Only, Hash-Chained, Tamper-Evident)
CREATE TABLE IF NOT EXISTS audit_events (
    id BIGSERIAL PRIMARY KEY,
    event_id UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    source_component VARCHAR(50) NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    mandate_id UUID,
    transaction_id UUID,
    constraint_hash TEXT,
    llm_invocation_id UUID,
    payload JSONB NOT NULL,
    previous_hash TEXT NOT NULL,
    hash TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_mandate ON audit_events(mandate_id);
CREATE INDEX IF NOT EXISTS idx_audit_event_id ON audit_events(event_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_events(created_at);

-- 4. Checkout Sessions (UCP State Machine)
CREATE TABLE IF NOT EXISTS checkout_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    buyer_id VARCHAR(255) NOT NULL,
    cart_id UUID,
    state VARCHAR(30) NOT NULL CHECK (state IN (
        'incomplete', 'requires_escalation', 'ready_for_complete',
        'complete_in_progress', 'completed', 'cancelled'
    )),
    locked_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    hitl_payload JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_checkout_state ON checkout_sessions(state);
CREATE INDEX IF NOT EXISTS idx_checkout_expires ON checkout_sessions(expires_at);

-- 5. A2A Tasks
CREATE TABLE IF NOT EXISTS a2a_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id VARCHAR(255) NOT NULL UNIQUE,
    status VARCHAR(20) NOT NULL CHECK (status IN ('SUBMITTED', 'WORKING', 'INPUT_REQUIRED', 'COMPLETED', 'FAILED')),
    merchant_did VARCHAR(255),
    proposal JSONB,
    rejection_context JSONB,
    retry_count INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_a2a_status ON a2a_tasks(status);

-- 6. Vault Outbox (Transactional Outbox Pattern)
CREATE TABLE IF NOT EXISTS vault_outbox (
    id BIGSERIAL PRIMARY KEY,
    guardrail_decision_id UUID NOT NULL,
    mandate_type VARCHAR(20) NOT NULL,
    payload JSONB NOT NULL,
    constraint_hash TEXT NOT NULL,
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outbox_unprocessed ON vault_outbox(processed_at) WHERE processed_at IS NULL;

-- 7. Revoked Keys (Identity & Key Verification)
CREATE TABLE IF NOT EXISTS revoked_keys (
    kid VARCHAR(255) PRIMARY KEY,
    revoked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reason TEXT
);

-- 8. Constraint Enforcement Audit (Protocol Capability Mapping Audit)
CREATE TABLE IF NOT EXISTS constraint_enforcement_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    mandate_id UUID,
    transaction_id UUID,
    original_ap2_field TEXT NOT NULL,
    original_ap2_value JSONB,
    upi_capability TEXT NOT NULL,
    downgrade_action VARCHAR(20) NOT NULL CHECK (downgrade_action IN ('DEGRADE', 'ESCALATE', 'REJECT')),
    chosen_replacement_value JSONB,
    reason TEXT NOT NULL,
    enforced_by VARCHAR(50) NOT NULL,
    constraint_hash TEXT NOT NULL,
    srs_reference VARCHAR(50) NOT NULL
);

-- App Roles Configuration (INV-006 & DR-002: Deny UPDATE/DELETE on audit_events)
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'ledger_writer') THEN
        CREATE ROLE ledger_writer WITH LOGIN PASSWORD 'ledger_writer_pw_dev';
    END IF;
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'guardrail_reader') THEN
        CREATE ROLE guardrail_reader WITH LOGIN PASSWORD 'guardrail_reader_pw_dev';
    END IF;
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'adapter_reader') THEN
        CREATE ROLE adapter_reader WITH LOGIN PASSWORD 'adapter_reader_pw_dev';
    END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO ledger_writer, guardrail_reader, adapter_reader;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ledger_writer;

GRANT INSERT, SELECT ON audit_events TO ledger_writer;
GRANT INSERT, UPDATE, SELECT ON mandates TO ledger_writer;
GRANT INSERT, UPDATE, SELECT ON debits TO ledger_writer;
GRANT INSERT, SELECT ON constraint_enforcement_audit TO ledger_writer;
GRANT INSERT, UPDATE, SELECT ON checkout_sessions TO ledger_writer;
GRANT INSERT, UPDATE, SELECT ON a2a_tasks TO ledger_writer;
GRANT INSERT, UPDATE, SELECT ON vault_outbox TO ledger_writer;

GRANT SELECT ON mandates TO guardrail_reader, adapter_reader;
GRANT SELECT ON debits TO guardrail_reader, adapter_reader;
GRANT SELECT ON audit_events TO guardrail_reader, adapter_reader;
GRANT SELECT ON constraint_enforcement_audit TO guardrail_reader, adapter_reader;

-- Enforce append-only: No UPDATE or DELETE privileges are granted on audit_events or constraint_enforcement_audit
