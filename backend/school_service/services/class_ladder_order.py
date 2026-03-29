"""Derive promotion chains from class names (Form 1…4, Grade 10…13)."""

from __future__ import annotations

import re
from typing import TYPE_CHECKING, List, Optional, Tuple

if TYPE_CHECKING:
    from school_service.models.academic_class import AcademicClass

FORM_RE = re.compile(r"form\s*(\d+)", re.IGNORECASE)
GRADE_RE = re.compile(r"grade\s*(\d+)", re.IGNORECASE)


def parse_form_or_grade_level(name: str) -> Optional[Tuple[str, int]]:
    """
    Return ("form", n) or ("grade", n) if the class name contains Form N / Grade N.
    """
    m = FORM_RE.search(name or "")
    if m:
        return ("form", int(m.group(1)))
    m = GRADE_RE.search(name or "")
    if m:
        return ("grade", int(m.group(1)))
    return None


def build_promotion_chains(classes: List["AcademicClass"], limit_to_ids: Optional[set[int]] = None) -> List[List[int]]:
    """
    Split classes into ordered chains: all Form* sorted by number, all Grade* sorted by number.
    Only includes chains with at least 2 classes. Unrecognized names are ignored.

    If limit_to_ids is set, only those class ids participate.
    """
    form: list[tuple[int, int]] = []
    grade: list[tuple[int, int]] = []
    for c in classes:
        if limit_to_ids is not None and c.id not in limit_to_ids:
            continue
        p = parse_form_or_grade_level(c.name)
        if not p:
            continue
        kind, n = p
        if kind == "form":
            form.append((n, c.id))
        else:
            grade.append((n, c.id))

    chains: list[list[int]] = []
    if len(form) >= 2:
        chains.append([cid for _, cid in sorted(form, key=lambda x: x[0])])
    if len(grade) >= 2:
        chains.append([cid for _, cid in sorted(grade, key=lambda x: x[0])])
    return chains


def sort_single_chain_ladder(class_by_id: dict[int, "AcademicClass"], ladder_ids: List[int]) -> List[int]:
    """
    Re-order a user-supplied ladder when every class matches the same kind (all Form or all Grade).
    If mixed Form/Grade, returns ladder_ids unchanged (caller should use build_promotion_chains instead).
    """
    parsed: list[tuple[str, int, int]] = []
    for cid in ladder_ids:
        c = class_by_id.get(cid)
        if not c:
            continue
        p = parse_form_or_grade_level(c.name)
        if not p:
            return list(ladder_ids)
        parsed.append((p[0], p[1], cid))
    if len(parsed) != len(ladder_ids):
        return list(ladder_ids)
    kinds = {x[0] for x in parsed}
    if len(kinds) != 1:
        return list(ladder_ids)
    return [cid for _, _, cid in sorted(parsed, key=lambda x: x[1])]
