"""
Prompt Injection Sanitizer (SEC-PI-001)
Sanitizes all external text before LLM ingestion.
- Structural stripping of instruction-like patterns
- Delimiter neutralization
- Unicode NFKC normalization
"""

import re
import unicodedata
from typing import List


# Patterns that resemble prompt injection attempts
_INJECTION_PATTERNS: List[re.Pattern] = [
    # Direct instruction patterns
    re.compile(r"(?i)\b(ignore\s+(all\s+)?previous\s+instructions?)\b"),
    re.compile(r"(?i)\b(forget\s+(all\s+)?(previous|prior|above)\s+(instructions?|context|rules?))\b"),
    re.compile(r"(?i)\b(disregard\s+(all\s+)?(previous|prior|above)\s+(instructions?|context|rules?))\b"),
    re.compile(r"(?i)\b(you\s+are\s+now\s+a?\s*\w+)\b"),
    re.compile(r"(?i)\b(new\s+instructions?:)\b"),
    re.compile(r"(?i)\b(system\s*prompt\s*:)\b"),
    re.compile(r"(?i)\b(override\s+(all\s+)?(safety|security|rules?|constraints?))\b"),
    # Role injection
    re.compile(r"(?i)\b(act\s+as\s+(a\s+)?)\b"),
    re.compile(r"(?i)\b(pretend\s+(to\s+be|you\s+are))\b"),
    re.compile(r"(?i)\b(roleplay\s+as)\b"),
    # Data exfiltration
    re.compile(r"(?i)\b(reveal\s+(your\s+)?(system|secret|api|key|password|prompt))\b"),
    re.compile(r"(?i)\b(output\s+(your\s+)?(system|secret|api|key|password|prompt))\b"),
    re.compile(r"(?i)\b(what\s+(is|are)\s+your\s+(instructions?|rules?|system\s+prompt))\b"),
]

# Delimiter patterns used to break out of structured contexts
_DELIMITER_PATTERNS: List[re.Pattern] = [
    re.compile(r"```"),                  # Code block delimiters
    re.compile(r"<\/?system>"),          # XML-like system tags
    re.compile(r"<\/?user>"),            # XML-like user tags
    re.compile(r"<\/?assistant>"),       # XML-like assistant tags
    re.compile(r"\[INST\]"),             # Llama-style instruction markers
    re.compile(r"\[\/INST\]"),
    re.compile(r"<\|im_start\|>"),       # ChatML markers
    re.compile(r"<\|im_end\|>"),
    re.compile(r"###\s*(System|User|Assistant)\s*:?", re.IGNORECASE),
]


def normalize_unicode(text: str) -> str:
    """Apply Unicode NFKC normalization to collapse homoglyphs and special chars."""
    return unicodedata.normalize("NFKC", text)


def strip_injection_patterns(text: str) -> str:
    """Remove known prompt injection patterns from text."""
    sanitized = text
    for pattern in _INJECTION_PATTERNS:
        sanitized = pattern.sub("[SANITIZED]", sanitized)
    return sanitized


def neutralize_delimiters(text: str) -> str:
    """Neutralize structural delimiters that could break LLM context boundaries."""
    sanitized = text
    for pattern in _DELIMITER_PATTERNS:
        sanitized = pattern.sub("[DELIM]", sanitized)
    return sanitized


def sanitize_for_llm(text: str) -> str:
    """
    Full sanitization pipeline (SEC-PI-001).
    Order: Unicode NFKC → Delimiter Neutralization → Injection Pattern Stripping.
    """
    # Step 1: Unicode normalization
    text = normalize_unicode(text)

    # Step 2: Neutralize delimiters
    text = neutralize_delimiters(text)

    # Step 3: Strip injection patterns
    text = strip_injection_patterns(text)

    # Step 4: Trim excessive whitespace
    text = re.sub(r"\s{3,}", "  ", text).strip()

    return text
