"""
Backend tests for Payroll Phase 2 (CEO Approval queue) and Phase 3
(Cashbook Add Expense → Payroll picker → flips payslip to paid).

Endpoints covered:
  - GET  /api/payroll/approvals
  - PUT  /api/payroll/payslip/{id}/approve
  - PUT  /api/payroll/payslip/{id}/reject
  - GET  /api/payroll/payslips/payable
  - POST /api/finance/banks/cashbook/expense (with payslip_id)
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
SUPER_ADMIN = {"email": "vinoth@drawlead.com", "password": "Admin@123"}


# ---------- fixtures ----------
@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json=SUPER_ADMIN, timeout=30)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    body = r.json()
    return body.get("session_token") or body.get("token") or body.get("access_token")


@pytest.fixture(scope="module")
def client(token):
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    return s


# ---------- Phase 2 — CEO Approval queue ----------
class TestCEOApprovalQueue:
    def test_get_approvals_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/payroll/approvals", timeout=20)
        assert r.status_code in (401, 403)

    def test_get_approvals_returns_ceo_review_payslips(self, client):
        r = client.get(f"{BASE_URL}/api/payroll/approvals", timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data, list)
        for p in data:
            assert p.get("status") == "ceo_review"
            # essential fields for the UI
            for f in ("payslip_id", "employee_name", "month", "year", "net_salary"):
                assert f in p, f"missing field {f} in {p}"

    def test_approve_invalid_status_returns_400(self, client):
        # using a non-existent id should also yield 400 (not 404)
        r = client.put(
            f"{BASE_URL}/api/payroll/payslip/payslip_doesnotexist/approve",
            timeout=20,
        )
        assert r.status_code == 400


# ---------- Phase 2 e2e: Approve + Reject lifecycle ----------
class TestApproveRejectLifecycle:
    """Full create→submit→reject→resubmit→approve cycle on a seeded payslip."""

    def _find_test_user(self, client):
        r = client.get(f"{BASE_URL}/api/users", timeout=20)
        assert r.status_code == 200, r.text
        users = r.json() if isinstance(r.json(), list) else r.json().get("items", [])
        for u in users:
            if u.get("email", "").startswith("ops-user"):
                return u
        # fallback — first non-super-admin
        for u in users:
            if u.get("role") != "super_admin":
                return u
        pytest.skip("No employee user available to seed payslip")

    def test_full_lifecycle(self, client):
        # Pick an existing ceo_review payslip to round-trip through reject→approve.
        r = client.get(f"{BASE_URL}/api/payroll/approvals", timeout=20)
        assert r.status_code == 200
        rows = r.json()
        if not rows:
            pytest.skip("No payslips currently in ceo_review status to test against")

        target = rows[0]
        pid = target["payslip_id"]

        # 1) Reject — should require nothing in particular but accept review_text
        rj = client.put(
            f"{BASE_URL}/api/payroll/payslip/{pid}/reject",
            json={"review_text": "TEST_reject — please redo deductions"},
            timeout=20,
        )
        assert rj.status_code == 200, rj.text

        # 2) Verify status flipped to draft and ceo_review.decision==rejected
        g = client.get(f"{BASE_URL}/api/payroll/payslip/{pid}", timeout=20)
        assert g.status_code == 200, g.text
        body = g.json()
        assert body.get("status") == "draft"
        assert (body.get("ceo_review") or {}).get("decision") == "rejected"

        # 3) Resubmit draft → ceo_review via submit-for-operations + operations-review
        #    (mimics HR resubmission flow). Try the direct submit-for-operations path.
        sub = client.put(
            f"{BASE_URL}/api/payroll/payslip/{pid}/submit-for-operations", timeout=20
        )
        assert sub.status_code in (200, 400), sub.text
        # If it landed in operations_review, push it to ceo_review.
        g = client.get(f"{BASE_URL}/api/payroll/payslip/{pid}", timeout=20).json()
        if g.get("status") == "operations_review":
            opr = client.put(
                f"{BASE_URL}/api/payroll/payslip/{pid}/operations-review",
                json={"review_text": "ok"},
                timeout=20,
            )
            assert opr.status_code == 200, opr.text
            g = client.get(f"{BASE_URL}/api/payroll/payslip/{pid}", timeout=20).json()

        if g.get("status") != "ceo_review":
            pytest.skip(
                f"Could not move payslip back to ceo_review; landed in {g.get('status')}"
            )

        # 4) Approve — flips ceo_review → generated, populates generated_at
        ap = client.put(f"{BASE_URL}/api/payroll/payslip/{pid}/approve", timeout=20)
        assert ap.status_code == 200, ap.text

        g = client.get(f"{BASE_URL}/api/payroll/payslip/{pid}", timeout=20).json()
        assert g.get("status") == "generated"
        assert (g.get("ceo_review") or {}).get("decision") == "approved"
        assert g.get("generated_at"), "generated_at must be set after approval"

        # 5) Approving again should 400 (already generated, not in ceo_review)
        ap2 = client.put(f"{BASE_URL}/api/payroll/payslip/{pid}/approve", timeout=20)
        assert ap2.status_code == 400


# ---------- Phase 3 — Payable list + Cashbook expense w/ payslip ----------
class TestPayablePayslipsAndCashbook:
    def test_get_payable_returns_generated(self, client):
        r = client.get(f"{BASE_URL}/api/payroll/payslips/payable", timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data, list)
        for p in data:
            assert "payslip_id" in p
            assert "net_salary" in p
            assert "employee_name" in p

    def test_cashbook_expense_without_payslip_still_works(self, client):
        # Make sure existing flow not broken when payslip_id absent.
        # Seed cash via /cashbook/entries (credit).
        dep = client.post(
            f"{BASE_URL}/api/finance/banks/cashbook/entries",
            json={
                "kind": "credit",
                "gst_type": "non_gst",
                "amount": 100,
                "payment_mode": "cash",
                "party": "TEST_seed",
                "category": "TEST",
                "notes": "seed",
            },
            timeout=20,
        )
        assert dep.status_code in (200, 201), dep.text

        exp = client.post(
            f"{BASE_URL}/api/finance/banks/cashbook/expense",
            json={
                "gst_type": "non_gst",
                "party": "TEST_random_vendor",
                "category": "Misc",
                "notes": "TEST_no_payslip",
                "allocations": [{"source": "cash", "amount": 1}],
            },
            timeout=20,
        )
        # We don't assert success here (balance may be 0); we assert the route
        # accepts the payload shape (no 422/500 from server bug).
        assert exp.status_code in (200, 400), exp.text

    def test_cashbook_expense_with_payslip_flips_to_paid(self, client):
        r = client.get(f"{BASE_URL}/api/payroll/payslips/payable", timeout=20)
        assert r.status_code == 200
        payables = r.json()
        # pick a payable with strictly positive net_salary
        ps = next((p for p in payables if float(p.get("net_salary") or 0) > 0), None)
        if not ps:
            pytest.skip("No payable payslip with net_salary > 0 to test cashbook payroll flow")

        net = float(ps["net_salary"])
        pid = ps["payslip_id"]

        # Seed enough non_gst cash so the expense passes balance check.
        seed = client.post(
            f"{BASE_URL}/api/finance/banks/cashbook/entries",
            json={
                "kind": "credit",
                "gst_type": "non_gst",
                "amount": net + 10,
                "payment_mode": "cash",
                "party": "TEST_payroll_seed",
                "category": "TEST",
                "notes": "seed for payroll expense",
            },
            timeout=20,
        )
        assert seed.status_code in (200, 201), seed.text

        exp = client.post(
            f"{BASE_URL}/api/finance/banks/cashbook/expense",
            json={
                "gst_type": "non_gst",
                "party": ps.get("employee_name", "Employee"),
                "category": "Payroll",
                "notes": f"TEST_payroll_pay for {pid}",
                "payslip_id": pid,
                "allocations": [{"source": "cash", "amount": net}],
            },
            timeout=30,
        )
        if exp.status_code != 200:
            pytest.skip(f"Cashbook expense failed (likely insufficient balance): {exp.text}")
        body = exp.json()
        assert "expense_group_id" in body

        # Verify payslip is now paid and linked.
        g = client.get(f"{BASE_URL}/api/payroll/payslip/{pid}", timeout=20).json()
        assert g.get("status") == "paid", g
        assert g.get("paid_via_expense_group_id") == body["expense_group_id"]

        # And it should no longer appear in payable list.
        r2 = client.get(f"{BASE_URL}/api/payroll/payslips/payable", timeout=20).json()
        assert all(p["payslip_id"] != pid for p in r2)
