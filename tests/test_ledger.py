import json
from fastapi.testclient import TestClient
from modules.ledger.writer import canonicalize_json, compute_sha256, calculate_audit_hash
from modules.ledger.main import app


def test_rfc8785_canonicalization_and_hash():
    # RFC 8785 guarantees dictionary key ordering determinism
    dict_a = {"b": 2, "a": 1, "nested": {"z": 9, "y": 8}}
    dict_b = {"nested": {"y": 8, "z": 9}, "a": 1, "b": 2}
    
    canonical_a = canonicalize_json(dict_a)
    canonical_b = canonicalize_json(dict_b)
    
    assert canonical_a == canonical_b
    assert compute_sha256(canonical_a) == compute_sha256(canonical_b)


def test_hash_chaining_integrity():
    genesis_hash = "0" * 64
    event_1 = {"action": "INTENT_COMPILED", "max_spend": 5000}
    hash_1 = calculate_audit_hash(genesis_hash, event_1)
    
    event_2 = {"action": "GUARDRAIL_APPROVED", "decision": "APPROVED"}
    hash_2 = calculate_audit_hash(hash_1, event_2)
    
    assert hash_1.startswith("sha256:")
    assert hash_2.startswith("sha256:")
    assert hash_1 != hash_2
    
    # Tampering check: altering event_1 payload produces different hash_1 and breaks downstream chain
    tampered_event_1 = {"action": "INTENT_COMPILED", "max_spend": 999999}
    tampered_hash_1 = calculate_audit_hash(genesis_hash, tampered_event_1)
    assert tampered_hash_1 != hash_1


def test_ledger_api_record_and_export():
    client = TestClient(app)
    
    # Test healthcheck
    res = client.get("/healthz")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"
    
    # Record Event 1
    ev1 = {
        "source_component": "compiler",
        "event_type": "INTENT_COMPILED",
        "constraint_hash": "sha256:1111",
        "payload": {"max_spend": 5000, "currency": "INR"}
    }
    r1 = client.post("/v1/audit/event", json=ev1)
    assert r1.status_code == 200
    data1 = r1.json()
    assert data1["event_type"] == "INTENT_COMPILED"
    assert data1["hash"].startswith("sha256:")
    
    # Record Event 2
    ev2 = {
        "source_component": "guardrail",
        "event_type": "GUARDRAIL_EVALUATED",
        "constraint_hash": "sha256:1111",
        "payload": {"decision": "APPROVED", "confidence_score": 0.92}
    }
    r2 = client.post("/v1/audit/event", json=ev2)
    assert r2.status_code == 200
    data2 = r2.json()
    assert data2["previous_hash"] == data1["hash"]
    
    # Export JSONL stream (DR-004)
    r_export = client.get("/ledger/export")
    assert r_export.status_code == 200
    lines = r_export.text.strip().split("\n")
    assert len(lines) >= 2
    parsed_last = json.loads(lines[-1])
    assert parsed_last["event_type"] == "GUARDRAIL_EVALUATED"
