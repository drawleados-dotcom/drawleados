"""Tests for the new GET /api/hr/admin/payslip/preview/{user_id}/{year}/{month}
endpoint.  The endpoint must:
  • require auth
  • return a fully-computed payslip payload
  • be idempotent — calling it N times must NOT create any rows in db.payslips
"""

import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://drawlead-docs.preview.emergentagent.com").rstrip("/")
SUPER_ADMIN = {"email": "vinoth@drawlead.com", "password": "Admin@123"}


# ---------------------------------------------------------------- fixtures --
@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/auth/login", json=SUPER_ADMIN, timeout=15)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    body = r.json()
    tok = body.get("access_token") or body.get("token") or body.get("session_token")
    assert tok, f"no token in response: {body}"
    s.headers.update({"Authorization": f"Bearer {tok}"})
    return s


@pytest.fixture(scope="module")
def target_user(session):
    """Pick an employee with salary_details (Vinothkumar Babu typically)."""
    r = session.get(f"{BASE_URL}/api/users", timeout=15)
    assert r.status_code == 200, r.text
    users = r.json()
    # prefer Vinoth (super admin himself has salary in this seed)
    vinoth = next((u for u in users if u.get("email") == SUPER_ADMIN["email"]), None)
    if vinoth:
        return vinoth["user_id"] if "user_id" in vinoth else vinoth.get("id")
    # fallback first employee
    assert users, "no users in system"
    return users[0].get("user_id") or users[0].get("id")


# ----------------------------------------------------- preview endpoint tests
class TestPayslipPreview:
    YEAR = 2026
    MONTH = 6  # June 2026 (seeded attendance)

    REQUIRED_KEYS = [
        "employee_name", "employee_id", "designation", "joining_date",
        "total_working_days", "days_present", "days_absent", "paid_leaves",
        "extra_days", "gross_salary", "per_day_salary", "net_salary",
        "salary_date",
    ]

    def test_requires_auth(self, target_user):
        anon = requests.Session()
        r = anon.get(
            f"{BASE_URL}/api/hr/admin/payslip/preview/{target_user}/{self.YEAR}/{self.MONTH}",
            timeout=15,
        )
        assert r.status_code in (401, 403), f"expected auth-block, got {r.status_code}"

    def test_returns_full_payload(self, session, target_user):
        r = session.get(
            f"{BASE_URL}/api/hr/admin/payslip/preview/{target_user}/{self.YEAR}/{self.MONTH}",
            timeout=15,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        missing = [k for k in self.REQUIRED_KEYS if k not in data]
        assert not missing, f"missing keys in preview response: {missing}"
        # type/sanity checks
        assert isinstance(data["total_working_days"], int)
        assert isinstance(data["days_present"], int)
        assert isinstance(data["days_absent"], int)
        assert data["month"] == self.MONTH
        assert data["year"] == self.YEAR
        assert data["per_day_salary"] >= 0
        assert data["net_salary"] >= 0
        assert isinstance(data["salary_date"], str) and "/" in data["salary_date"]

    def test_is_idempotent_no_db_write(self, session, target_user):
        """Calling preview twice must not produce a payslip row and must
        return identical payload (allow salary_date to differ if day rolls)."""
        # count payslips before
        list_url = f"{BASE_URL}/api/hr/admin/payslips?month={self.MONTH}&year={self.YEAR}"
        before = session.get(list_url, timeout=15)
        # tolerate either /payslips (super-admin) or /admin/payslips
        if before.status_code == 404:
            list_url = f"{BASE_URL}/api/hr/admin/payslips"
            before = session.get(list_url, timeout=15)
        assert before.status_code == 200, before.text
        before_payslips = before.json() if isinstance(before.json(), list) else before.json().get("payslips", [])
        before_match = [p for p in before_payslips
                        if p.get("user_id") == target_user
                        and p.get("month") == self.MONTH
                        and p.get("year") == self.YEAR]
        before_count = len(before_match)

        url = f"{BASE_URL}/api/hr/admin/payslip/preview/{target_user}/{self.YEAR}/{self.MONTH}"
        r1 = session.get(url, timeout=15)
        r2 = session.get(url, timeout=15)
        assert r1.status_code == 200 and r2.status_code == 200
        d1, d2 = r1.json(), r2.json()
        # numeric/structural fields must match exactly
        for k in ["total_working_days", "days_present", "days_absent",
                  "paid_leaves", "extra_days", "gross_salary",
                  "per_day_salary", "net_salary", "month", "year",
                  "employee_name"]:
            assert d1.get(k) == d2.get(k), f"non-idempotent field {k}: {d1.get(k)} vs {d2.get(k)}"

        # count payslips after — must be unchanged
        after = session.get(list_url, timeout=15)
        assert after.status_code == 200, after.text
        after_payslips = after.json() if isinstance(after.json(), list) else after.json().get("payslips", [])
        after_match = [p for p in after_payslips
                       if p.get("user_id") == target_user
                       and p.get("month") == self.MONTH
                       and p.get("year") == self.YEAR]
        assert len(after_match) == before_count, (
            f"preview leaked into db.payslips — before={before_count}, after={len(after_match)}"
        )

    def test_handles_unknown_user(self, session):
        r = session.get(
            f"{BASE_URL}/api/hr/admin/payslip/preview/__nonexistent__/{self.YEAR}/{self.MONTH}",
            timeout=15,
        )
        assert r.status_code == 404
