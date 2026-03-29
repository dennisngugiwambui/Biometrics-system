"""
Normalize and canonicalize class/stream names for bulk import.

- Fix common typos (e.g. Farm -> Form).
- Collapse ranges (Form 3-6 -> Form 3) so each student gets a single class.
- Produce a canonical name for matching and for creating new classes/streams.
"""

import re
from typing import Optional


def normalize_class_name(raw: Optional[str]) -> str:
    """
    Normalize a class name from import data to a single, canonical form.

    - Strips and collapses spaces.
    - Fixes "Farm" -> "Form" (case-insensitive).
    - Ranges like "Form 3-6", "Form 4-7" become the first part: "Form 3", "Form 4".
    - Returns canonical form suitable for DB (e.g. "Form 3", "Grade 5").
    """
    if not raw or not str(raw).strip():
        return ""
    s = str(raw).strip()
    s = re.sub(r"\s+", " ", s)
    # Fix common typo
    s = re.sub(r"\bFarm\b", "Form", s, flags=re.IGNORECASE)
    # Collapse range: "Form 3-6" or "Form 3 - 6" or "Grade 5-7" -> first part only
    range_match = re.match(r"^(Form|Grade)\s*(\d+)\s*[-–]\s*\d+\s*$", s, re.IGNORECASE)
    if range_match:
        prefix = range_match.group(1)
        num = range_match.group(2)
        s = f"{prefix.title()} {num}"
    else:
        # Title-case first word (Form/Grade) and keep rest
        parts = s.split(None, 1)
        if parts:
            parts[0] = parts[0].title()
            s = " ".join(parts)
    return s.strip()


def normalize_stream_name(raw: Optional[str]) -> str:
    """
    Normalize a stream name (e.g. East, West, A, B).

    - Strips and collapses spaces.
    - Returns a canonical form (title case) for matching/creating.
    """
    if not raw or not str(raw).strip():
        return ""
    s = str(raw).strip()
    s = re.sub(r"\s+", " ", s)
    return s.title().strip() if s else ""


def class_names_match(a: str, b: str) -> bool:
    """True if two class names are considered the same (case-insensitive, normalized)."""
    if not a or not b:
        return not a and not b
    return normalize_class_name(a).lower() == normalize_class_name(b).lower()


def stream_names_match(a: str, b: str) -> bool:
    """True if two stream names are considered the same (case-insensitive)."""
    if not a or not b:
        return not a and not b
    return normalize_stream_name(a).lower() == normalize_stream_name(b).lower()
