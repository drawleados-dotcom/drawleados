"""
Unit tests for the Lead/Prospect sheet tab helpers (pure functions — no
Google calls, no DB).
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import sheets_routes as s  # noqa: E402


def test_col_letter():
    assert [s._col_letter(n) for n in (1, 26, 27, 52, 702, 703)] == ["A", "Z", "AA", "AZ", "ZZ", "AAA"]


def test_quote_tab_escapes_apostrophes():
    assert s._quote_tab("Leads") == "'Leads'"
    assert s._quote_tab("Vinoth's leads") == "'Vinoth''s leads'"


def test_tab_summary_counts_new_vs_existing():
    rows = [
        ["Full Name", "Phone Number", "Email"],
        ["A", "+91 98765 43210", ""],          # phone already a lead (last-10-digit match)
        ["B", "", "B@Example.com"],            # email already a lead (case-insensitive)
        ["C", "9000000000", "c@example.com"],  # new
        ["", "", ""],                          # blank row -> ignored
        ["D", "", ""],                         # no phone/email -> counts as new
    ]
    out = s.tab_summary(rows, {"b@example.com"}, {"9876543210"})
    assert out["total"] == 4 and out["existing"] == 2 and out["new"] == 2
    assert out["headers"] == ["Full Name", "Phone Number", "Email"]


def test_tab_summary_empty_tab():
    assert s.tab_summary([], set(), set())["total"] == 0
    assert s.tab_summary([["Name"]], set(), set())["total"] == 0


def test_config_tabs_legacy_uses_first_tab():
    tabs = [{"title": "Form 1"}, {"title": "Form 2"}]
    assert s._config_tabs({}, tabs) == ["Form 1"]
    assert s._config_tabs({"tabs": ["Form 2"]}, tabs) == ["Form 2"]
    assert s._config_tabs({}, []) == []
