"""
Audit Exporter & Persistence Module (DR-001, DR-004, NFR-OBS-003)
Generates comprehensive per-transaction audit trail files:
1. audit_trail_<trace_id>.json  (Machine-readable canonical payload)
2. audit_trail_<trace_id>.md    (Human-readable formatted Markdown report with AI thoughts)
3. ledger_stream.jsonl          (Unified append-only JSONL stream)
"""

import json
import datetime
import threading
from typing import Any, Dict, List, Optional
from pathlib import Path


AUDIT_LOGS_DIR = Path("audit_logs")
_jsonl_lock = threading.Lock()


def ensure_audit_dir() -> Path:
    """Ensure the audit_logs directory exists."""
    AUDIT_LOGS_DIR.mkdir(parents=True, exist_ok=True)
    return AUDIT_LOGS_DIR


def write_transaction_audit_files(
    trace_id: str,
    status: str,
    decision: str,
    raw_intent: str,
    constraint_hash: Optional[str],
    total_price_paise: Optional[int],
    confidence_score: Optional[float],
    reasoning_summary: Optional[str],
    ai_thought_steps: Optional[List[str]],
    mandate_id: Optional[str],
    compact_jws: Optional[str],
    audit_trail: List[Dict[str, Any]],
    error: Optional[str] = None,
) -> Dict[str, str]:
    """
    Writes structured JSON and human-readable Markdown audit files for the transaction.
    Returns dictionary with file paths: {"json_path": ..., "md_path": ..., "jsonl_path": ...}
    """
    audit_dir = ensure_audit_dir()
    now = datetime.datetime.now(datetime.timezone.utc)
    ts_slug = now.strftime("%Y%m%d_%H%M%S")
    
    file_prefix = f"audit_{trace_id}_{ts_slug}"
    json_path = audit_dir / f"{file_prefix}.json"
    md_path = audit_dir / f"{file_prefix}.md"
    jsonl_path = audit_dir / "ledger_stream.jsonl"

    total_inr = (total_price_paise / 100.0) if total_price_paise is not None else 0.0

    # 1. Machine-readable JSON
    audit_record = {
        "trace_id": trace_id,
        "timestamp": now.isoformat(),
        "status": status,
        "decision": decision,
        "raw_intent": raw_intent,
        "constraint_hash": constraint_hash,
        "total_amount_inr": total_inr,
        "total_price_paise": total_price_paise,
        "confidence_score": confidence_score,
        "ai_reasoning": {
            "summary": reasoning_summary,
            "thought_steps": ai_thought_steps or [],
        },
        "mandate": {
            "mandate_id": mandate_id,
            "compact_jws": compact_jws,
            "algorithm": "ES256" if compact_jws else None,
        },
        "error": error,
        "audit_trail_events": audit_trail,
    }

    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(audit_record, f, indent=2, default=str)

    # 2. Append to unified JSONL stream (DR-004) with thread lock
    with _jsonl_lock:
        with open(jsonl_path, "a", encoding="utf-8") as f:
            f.write(json.dumps(audit_record, default=str) + "\n")

    # 3. Human-readable Markdown Audit Trail Report
    md_lines = [
        f"# Transaction Audit Report: `{trace_id}`",
        "",
        f"**Timestamp:** `{now.isoformat()}`  ",
        f"**Status:** `{'✅ ' + status if status == 'SUCCESS' else '⚠️ ' + status}`  ",
        f"**Decision:** `{decision}`  ",
        f"**Settlement Amount:** ₹{total_inr:.2f} ({total_price_paise} paise)  ",
        f"**Confidence Score:** `{confidence_score}`  ",
        "",
        "---",
        "",
        "## 1. User Intent & Constraint Compilation",
        f"- **Raw Intent:** *\"{raw_intent}\"*",
        f"- **Constraint Hash:** `{constraint_hash}`",
        "",
        "---",
        "",
        "## 2. AI Reasoning & Step-by-Step Thought Trail",
        f"**High-Level Justification:** {reasoning_summary or 'N/A'}",
        "",
        "**AI Deliberation Steps:**",
    ]

    if ai_thought_steps:
        for i, step_text in enumerate(ai_thought_steps, 1):
            md_lines.append(f"{i}. {step_text}")
    else:
        md_lines.append("- *Direct proposal generated based on catalog constraints.*")

    md_lines.extend([
        "",
        "---",
        "",
        "## 3. Guardrail Shell Verification Matrix",
        "| Gate | Result | Details |",
        "| :--- | :--- | :--- |",
    ])

    # Extract stages from audit trail
    for event in audit_trail:
        stage = event.get("stage", "UNKNOWN")
        if stage == "SCHEMA_VALIDATION":
            v = event.get("valid", False)
            md_lines.append(f"| **Schema Validator** | {'✅ PASS' if v else '❌ FAIL'} | Proposal matches `ProposalObject` schema (Appendix C.1) |")
        elif stage == "POLICY_ENFORCEMENT":
            p = event.get("passed", False)
            violations = event.get("violations", [])
            detail = "Zero policy violations" if p else f"Violations: {json.dumps(violations)}"
            md_lines.append(f"| **Policy Engine (INV-010)** | {'✅ PASS' if p else '❌ FAIL'} | {detail} |")
        elif stage == "GROUNDING_VERIFICATION":
            g = event.get("verified", False)
            manifest = event.get("manifest_hash", "N/A")
            md_lines.append(f"| **Grounding Oracle** | {'✅ PASS' if g else '❌ FAIL'} | Verified against catalog manifest `{manifest}` |")
        elif stage == "CONFIDENCE_GATE":
            d = event.get("decision", "UNKNOWN")
            c = event.get("confidence_score", 0.0)
            md_lines.append(f"| **Confidence Gate** | {'✅ ' + d if d == 'APPROVED' else '⚠️ ' + d} | Composite score: `{c}` (Threshold: 0.85) |")

    md_lines.extend([
        "",
        "---",
        "",
        "## 4. Cryptographic Proof & Mandate Authorization",
        f"- **Mandate ID:** `{mandate_id or 'None (Not Signed)'}`",
        "- **Algorithm:** `ES256` (ECDSA with P-256 + SHA-256)",
    ])

    if compact_jws:
        md_lines.append(f"- **Compact JWS:** `{compact_jws[:60]}...` *(verified)*")
    else:
        md_lines.append("- **Compact JWS:** *None (Signing blocked by guardrail)*")

    md_lines.extend([
        "",
        "---",
        "",
        "## 5. Decision Timeline & Chronological Events",
    ])

    for i, ev in enumerate(audit_trail, 1):
        md_lines.append(f"{i}. **`{ev.get('timestamp', '')}`** — `{ev.get('stage')}`")

    if error:
        md_lines.extend([
            "",
            "---",
            "",
            f"## ⚠️ Error Details\n`{error}`"
        ])

    with open(md_path, "w", encoding="utf-8") as f:
        f.write("\n".join(md_lines) + "\n")

    return {
        "json_path": str(json_path),
        "md_path": str(md_path),
        "jsonl_path": str(jsonl_path),
    }
