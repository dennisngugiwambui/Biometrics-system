"""Tests for promotion ladder parsing (Form / Grade / Year naming)."""

import importlib.util
from pathlib import Path

# Load module by path so importing ``school_service`` does not pull Settings/.env.
_mod_path = Path(__file__).resolve().parent.parent / "services" / "class_ladder_order.py"
_spec = importlib.util.spec_from_file_location("class_ladder_order_standalone", _mod_path)
assert _spec and _spec.loader
_cl = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_cl)
parse_form_or_grade_level = _cl.parse_form_or_grade_level
build_promotion_chains = _cl.build_promotion_chains
sort_single_chain_ladder = _cl.sort_single_chain_ladder


class _C:
    def __init__(self, id_: int, name: str):
        self.id = id_
        self.name = name


def test_parse_form_basic():
    assert parse_form_or_grade_level("Form 1") == ("form", 1)
    assert parse_form_or_grade_level("form 4") == ("form", 4)


def test_parse_grade_two_digit_and_dash():
    assert parse_form_or_grade_level("Grade 10") == ("grade", 10)
    assert parse_form_or_grade_level("Grade – 11") == ("grade", 11)
    assert parse_form_or_grade_level("Grade—12") == ("grade", 12)


def test_parse_grade_compact():
    assert parse_form_or_grade_level("Grade10") == ("grade", 10)
    assert parse_form_or_grade_level("grade11") == ("grade", 11)


def test_parse_year_senior_only():
    assert parse_form_or_grade_level("Year 10") == ("grade", 10)
    assert parse_form_or_grade_level("Year 13") == ("grade", 13)
    assert parse_form_or_grade_level("Year 2024") is None
    assert parse_form_or_grade_level("Year 5") is None


def test_parse_gr_abbrev():
    assert parse_form_or_grade_level("Gr. 10") == ("grade", 10)
    assert parse_form_or_grade_level("Gr11") == ("grade", 11)


def test_no_false_positive_inform():
    assert parse_form_or_grade_level("Information desk 1") is None
    assert parse_form_or_grade_level("Transform 2") is None


def test_build_promotion_chains_grade_sequence():
    classes = [
        _C(1, "Grade 11"),
        _C(2, "Grade 10"),
        _C(3, "Grade 13"),
        _C(4, "Grade 12"),
    ]
    chains = build_promotion_chains(classes)
    assert len(chains) == 1
    assert chains[0] == [2, 1, 4, 3]


def test_build_promotion_chains_form_and_grade_separate():
    classes = [
        _C(1, "Form 1"),
        _C(2, "Form 2"),
        _C(3, "Grade 10"),
        _C(4, "Year 11"),
        _C(5, "Gr. 12"),
    ]
    chains = build_promotion_chains(classes)
    assert len(chains) == 2
    form_chain = next(c for c in chains if len(c) == 2)
    grade_chain = next(c for c in chains if len(c) == 3)
    assert form_chain == [1, 2]
    assert grade_chain == [3, 4, 5]


def test_sort_single_chain_ladder_grade_ordered():
    by_id = {
        1: _C(1, "Grade 12"),
        2: _C(2, "Grade 10"),
        3: _C(3, "Grade 11"),
    }
    assert sort_single_chain_ladder(by_id, [1, 2, 3]) == [2, 3, 1]
