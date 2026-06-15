"""Backend tests for Expense Budget + Payroll feature (iteration 73).

Covers:
  - GET  /api/finance/expense-split/budgets
  - PUT  /api/finance/expense-split/budgets/{category_id}
  - Budget balance math via cashbook debit with split_category_id
"""
import os
import time
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


# ---------- Budget GET / PUT ----------
class TestBudgetEndpoints:
    def test_get_budgets_shape(self, session):
        r = session.get(f"{BASE_URL}/api/finance/expense-split/budgets",
                        params={"month": MONTH, "year": YEAR}, timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["month"] == MONTH and body["year"] == YEAR
        assert isinstance(body["categories"], list)
        # Each top must have budget/spent/balance/sub_categories
        for top in body["categories"]:
            assert "budget" in top and "spent" in top and "balance" in top
            assert "sub_categories" in top
            for sub in top["sub_categories"]:
                for f in ("budget", "spent", "balance", "over_budget"):
                    assert f in sub, f"Sub missing {f}"

    def test_get_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/finance/expense-split/budgets",
                         params={"month": MONTH, "year": YEAR}, timeout=30)
        assert r.status_code in (401, 403)

    def test_put_budget_upsert_and_topsum(self, session):
        # Find any sub-category
        r = session.get(f"{BASE_URL}/api/finance/expense-split/budgets",
                        params={"month": MONTH, "year": YEAR}, timeout=30)
        cats = r.json()["categories"]
        target_top = next((t for t in cats if t.get("sub_categories")), None)
        if not target_top:
            pytest.skip("No sub-categories present to test budget upsert")
        sub = target_top["sub_categories"][0]
        sub_id = sub["category_id"]
        top_id = target_top["category_id"]
        old_sub_budgets = sum(s["budget"] for s in target_top["sub_categories"])
        # PUT new amount
        new_amount = 12345.0
        r = session.put(
            f"{BASE_URL}/api/finance/expense-split/budgets/{sub_id}",
            json={"amount": new_amount, "month": MONTH, "year": YEAR}, timeout=30,
        )
        assert r.status_code == 200, r.text
        assert r.json()["amount"] == new_amount

        # Verify GET reflects
        r = session.get(f"{BASE_URL}/api/finance/expense-split/budgets",
                        params={"month": MONTH, "year": YEAR}, timeout=30)
        cats2 = r.json()["categories"]
        top2 = next(t for t in cats2 if t["category_id"] == top_id)
        sub2 = next(s for s in top2["sub_categories"] if s["category_id"] == sub_id)
        assert sub2["budget"] == new_amount

        # Top budget = sum of subs' budgets
        expected_top = sum(s["budget"] for s in top2["sub_categories"])
        assert abs(top2["budget"] - expected_top) < 0.01, \
            f"Top budget {top2['budget']} != sum of subs {expected_top}"

        # Reset to old value to keep state clean
        # restore the modified sub to its previous budget
        prev_amount = float(sub["budget"]) if sub.get("budget") else 0.0
        session.put(
            f"{BASE_URL}/api/finance/expense-split/budgets/{sub_id}",
            json={"amount": prev_amount, "month": MONTH, "year": YEAR}, timeout=30,
        )
        # ensure full restoration of old sum
        _ = old_sub_budgets  # informational

    def test_put_invalid_category_returns_404(self, session):
        r = session.put(
            f"{BASE_URL}/api/finance/expense-split/budgets/does_not_exist",
            json={"amount": 100, "month": MONTH, "year": YEAR}, timeout=30,
        )
        assert r.status_code == 404


# ---------- Balance math via cashbook ----------
class TestBudgetSpentMath:
    def _find_sub(self, session):
        r = session.get(f"{BASE_URL}/api/finance/expense-split/budgets",
                        params={"month": MONTH, "year": YEAR}, timeout=30)
        for top in r.json()["categories"]:
            if top.get("sub_categories"):
                return top["sub_categories"][0]
        return None

    def _find_bank(self, session):
        """Return (bank_id_or_None, gst_type) with sufficient balance."""
        for gst_type in ("non_gst", "gst"):
            r = session.get(f"{BASE_URL}/api/finance/banks/cashbook/balances",
                            params={"gst_type": gst_type}, timeout=30)
            if r.status_code != 200:
                continue
            data = r.json()
            for b in data.get("banks", []):
                if float(b.get("balance", 0)) >= 100:
                    return b["bank_id"], gst_type
            for src in ("cash", "upi", "cheque"):
                if float(data.get(src, {}).get("balance", 0)) >= 100:
                    return None, gst_type
        return None

    def test_balance_math(self, session):
        sub = self._find_sub(session)
        if not sub:
            pytest.skip("No sub-categories")
        bank_res = self._find_bank(session)
        if not bank_res:
            pytest.skip("No bank/source with sufficient balance")
        bank_id, gst_type = bank_res[0], bank_res[1]

        sub_id = sub["category_id"]

        # Set budget to 10000
        r = session.put(
            f"{BASE_URL}/api/finance/expense-split/budgets/{sub_id}",
            json={"amount": 10000, "month": MONTH, "year": YEAR}, timeout=30,
        )
        assert r.status_code == 200

        # Create cashbook debit tagged with split_category_id via grouped expense
        unique_amount = 50 + (int(time.time()) % 30)
        date_str = f"{YEAR:04d}-{MONTH:02d}-15"
        if bank_id:
            allocation = {"source": "bank", "bank_id": bank_id, "amount": unique_amount}
        else:
            allocation = {"source": "cash", "amount": unique_amount}
        payload = {
            "gst_type": gst_type,
            "date": date_str,
            "party": "TEST",
            "category": "TEST budget spent",
            "notes": "budget test",
            "split_category_id": sub_id,
            "split_top_category_id": None,
            "payslip_id": None,
            "allocations": [allocation],
        }
        r = session.post(f"{BASE_URL}/api/finance/banks/cashbook/expense",
                         json=payload, timeout=30)
        assert r.status_code in (200, 201), f"Cashbook create failed: {r.status_code} {r.text}"

        # Re-read budgets; spent must reflect the added expense
        r = session.get(f"{BASE_URL}/api/finance/expense-split/budgets",
                        params={"month": MONTH, "year": YEAR}, timeout=30)
        cats = r.json()["categories"]
        found_sub = None
        for top in cats:
            for s in top["sub_categories"]:
                if s["category_id"] == sub_id:
                    found_sub = s
                    break
        assert found_sub is not None
        assert found_sub["budget"] == 10000.0
        # spent should be >= unique_amount (other prior tests/data may add too)
        assert found_sub["spent"] >= unique_amount, \
            f"Spent {found_sub['spent']} < {unique_amount}"
        assert abs(found_sub["balance"] - (found_sub["budget"] - found_sub["spent"])) < 0.01

        # Over-budget: set budget below current spent
        r = session.put(
            f"{BASE_URL}/api/finance/expense-split/budgets/{sub_id}",
            json={"amount": 1, "month": MONTH, "year": YEAR}, timeout=30,
        )
        assert r.status_code == 200
        r = session.get(f"{BASE_URL}/api/finance/expense-split/budgets",
                        params={"month": MONTH, "year": YEAR}, timeout=30)
        for top in r.json()["categories"]:
            for s in top["sub_categories"]:
                if s["category_id"] == sub_id:
                    assert s["over_budget"] is True
                    assert s["balance"] < 0
                    return
        pytest.fail("Sub not found in second read")
