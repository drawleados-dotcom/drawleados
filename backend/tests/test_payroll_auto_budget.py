"""Backend tests for iteration 74: auto-computed Payroll budget.

Covers:
  - GET /api/finance/expense-split/budgets returns auto `budget` for the
    sub-category literally named "Payroll" (sum of payslip base_salary, fallback
    to net_salary) when no manual budget is stored.
  - `is_auto_budget` is True in auto mode.
  - PUT /budgets/{payroll_sub_id} with a manual amount overrides the auto value
    and flips `is_auto_budget` to False.
  - Setting the manual amount back to 0 restores the auto value.
"""
import os
import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
ADMIN_EMAIL = "vinoth@drawlead.com"
ADMIN_PASS = "Admin@123"

MONTH = 6
YEAR = 2026


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login",
               json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=30)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    data = r.json()
    token = data.get("session_token") or data.get("token")
    if token:
        s.headers.update({"Authorization": f"Bearer {token}"})
    return s


def _find_payroll_sub(session):
    r = session.get(f"{BASE_URL}/api/finance/expense-split/budgets",
                    params={"month": MONTH, "year": YEAR}, timeout=30)
    assert r.status_code == 200, r.text
    for top in r.json()["categories"]:
        for s in top.get("sub_categories", []):
            if (s.get("name") or "").strip().lower() == "payroll":
                return s, top
    return None, None


def _expected_payroll_total(session):
    """Replicate backend's payroll auto calc against /api/finance/payroll."""
    r = session.get(f"{BASE_URL}/api/finance/payroll",
                    params={"month": MONTH, "year": YEAR}, timeout=30)
    if r.status_code != 200:
        return None
    payslips = r.json() if isinstance(r.json(), list) else r.json().get("payslips", [])
    total = 0.0
    for p in payslips:
        gross = float(p.get("base_salary") or 0)
        net = float(p.get("net_salary") or 0)
        total += gross if gross > 0 else net
    return total


class TestPayrollAutoBudget:
    def test_payroll_sub_present(self, session):
        sub, top = _find_payroll_sub(session)
        if sub is None:
            pytest.skip("No 'Payroll' sub-category seeded — skipping")
        assert top is not None
        # Top should be Overhead per design
        assert (top.get("name") or "").strip().lower() == "overhead"

    def test_payroll_auto_budget_value(self, session):
        sub, _top = _find_payroll_sub(session)
        if sub is None:
            pytest.skip("No 'Payroll' sub-category present")

        # First clear any manual override so the auto path is exercised
        session.put(
            f"{BASE_URL}/api/finance/expense-split/budgets/{sub['category_id']}",
            json={"amount": 0, "month": MONTH, "year": YEAR}, timeout=30,
        )

        sub2, _ = _find_payroll_sub(session)
        assert sub2 is not None
        budget = float(sub2["budget"])
        assert budget > 0, "Auto Payroll budget should be > 0 with seeded payslips"
        assert sub2.get("is_auto_budget") is True, \
            f"Expected is_auto_budget=True in auto mode, got {sub2.get('is_auto_budget')}"

        # If /api/finance/payroll is available, cross-check the math
        expected = _expected_payroll_total(session)
        if expected is not None and expected > 0:
            assert abs(budget - expected) < 1.0, \
                f"Auto budget {budget} != expected payslip total {expected}"

    def test_manual_override_takes_precedence_and_restore(self, session):
        sub, _top = _find_payroll_sub(session)
        if sub is None:
            pytest.skip("No 'Payroll' sub-category present")

        sub_id = sub["category_id"]
        # 1) Ensure starting in auto mode (no manual override)
        session.put(
            f"{BASE_URL}/api/finance/expense-split/budgets/{sub_id}",
            json={"amount": 0, "month": MONTH, "year": YEAR}, timeout=30,
        )
        s_auto, _ = _find_payroll_sub(session)
        auto_value = float(s_auto["budget"])
        assert s_auto.get("is_auto_budget") is True

        # 2) Apply a manual override well above the auto total
        manual_value = auto_value + 99999.0
        r = session.put(
            f"{BASE_URL}/api/finance/expense-split/budgets/{sub_id}",
            json={"amount": manual_value, "month": MONTH, "year": YEAR}, timeout=30,
        )
        assert r.status_code == 200, r.text

        s_manual, _ = _find_payroll_sub(session)
        assert abs(float(s_manual["budget"]) - manual_value) < 0.01, \
            f"Manual override not honoured: {s_manual['budget']} vs {manual_value}"
        assert s_manual.get("is_auto_budget") in (False, None), \
            f"is_auto_budget should be False under manual override, got {s_manual.get('is_auto_budget')}"

        # 3) Restore back to auto by setting amount=0
        r = session.put(
            f"{BASE_URL}/api/finance/expense-split/budgets/{sub_id}",
            json={"amount": 0, "month": MONTH, "year": YEAR}, timeout=30,
        )
        assert r.status_code == 200, r.text
        s_restored, _ = _find_payroll_sub(session)
        assert abs(float(s_restored["budget"]) - auto_value) < 0.01, \
            f"After restore, expected auto {auto_value}, got {s_restored['budget']}"
        assert s_restored.get("is_auto_budget") is True

    def test_overhead_top_includes_payroll_auto(self, session):
        sub, top = _find_payroll_sub(session)
        if sub is None or top is None:
            pytest.skip("No Payroll/Overhead present")
        # Reset to auto mode
        session.put(
            f"{BASE_URL}/api/finance/expense-split/budgets/{sub['category_id']}",
            json={"amount": 0, "month": MONTH, "year": YEAR}, timeout=30,
        )
        r = session.get(f"{BASE_URL}/api/finance/expense-split/budgets",
                        params={"month": MONTH, "year": YEAR}, timeout=30)
        cats = r.json()["categories"]
        overhead = next(t for t in cats if t["category_id"] == top["category_id"])
        # top budget should be >= the auto payroll value (sum of subs)
        payroll = next(s for s in overhead["sub_categories"]
                       if (s.get("name") or "").strip().lower() == "payroll")
        assert overhead["budget"] >= payroll["budget"] - 0.01, \
            f"Overhead top budget {overhead['budget']} should include Payroll auto {payroll['budget']}"
