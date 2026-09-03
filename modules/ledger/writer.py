import hashlib
from typing import Any, Dict
import rfc8785


def canonicalize_json(data: Dict[str, Any]) -> str:
    """Canonicalize a JSON dictionary strictly according to RFC 8785 (JCS)."""
    canonical_bytes = rfc8785.dumps(data)
    return canonical_bytes.decode("utf-8")


def compute_sha256(canonical_str: str) -> str:
    """Compute SHA-256 hexadecimal digest with standard sha256: prefix."""
    return f"sha256:{hashlib.sha256(canonical_str.encode('utf-8')).hexdigest()}"


def calculate_audit_hash(previous_hash: str, payload: Dict[str, Any]) -> str:
    """
    Compute tamper-evident chain hash (DR-003):
    current_hash = SHA256(previous_hash + SHA256(RFC8785(payload)))
    """
    payload_canonical = canonicalize_json(payload)
    payload_hash = hashlib.sha256(payload_canonical.encode("utf-8")).hexdigest()
    combined = f"{previous_hash}{payload_hash}".encode("utf-8")
    return f"sha256:{hashlib.sha256(combined).hexdigest()}"
