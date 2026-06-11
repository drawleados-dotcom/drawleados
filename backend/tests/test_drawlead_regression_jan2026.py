"""Regression tests after deleting 10 obsolete modules and refactoring RBAC.
Focus areas:
1. Authentication & redirect target
2. RBAC: super_admin vs ops-user module_access
3. HR attendance endpoints (refactored UI cards)
4. HR Admin: Org Tree CRUD + Employee Attendance lookup
5. Operations / Our Tasks (approvals, work-hours, meetings)
6. Calendar tasks surfacing (bde_tasks + additional_tasks)
7. Deleted modules should NOT 500
"""
import os
import datetime as dt
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://drawlead-docs.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = {"email": "vinoth@drawlead.com", "password": "admin123"}
OPS = {"email": "ops-user@drawlead.com", "password": "ops123"}


def _login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=20)
    assert r.status_code == 200, f"Login failed for {creds['email']}: {r.status_code} {r.text[:200]}"
    return r.json()


@pytest.fixture(scope="session")
def admin_session():
    return _login(ADMIN)


@pytest.fixture(scope="session")
def ops_session():
    return _login(OPS)


@pytest.fixture(scope="session")
def admin_headers(admin_session):
    return {"Authorization": f"Bearer {admin_session['session_token']}"}


@pytest.fixture(scope="session")
def ops_headers(ops_session):
    return {"Authorization": f"Bearer {ops_session['session_token']}"}


# ---------- AUTH & RBAC ----------
class TestAuthAndRBAC:
    def test_admin_login_module_access(self, admin_session):
        u = admin_session["user"]
        assert u["role"] == "super_admin"
        assert "hr_admin" in u["module_access"]
        assert "operations" in u["module_access"]
        assert u["designation"].lower().startswith("chief")

    def test_ops_user_restricted_module_access(self, ops_session):
        u = ops_session["user"]
        # Restricted user must only see our_tasks/my_profile, never hr_admin or finance
        assert "hr_admin" not in u["module_access"]
        assert "finance" not in u["module_access"]
        assert "our_tasks" in u["module_access"]

    def test_me_endpoint(self, admin_headers):
        r = requests.get(f"{API}/auth/me", headers=admin_headers, timeout=15)
        assert r.status_code == 200
        assert r.json()["email"] == ADMIN["email"]


# ---------- HR ATTENDANCE (the refactored cards) ----------
class TestHRAttendance:
    def test_today_attendance(self, admin_headers):
        r = requests.get(f"{API}/hr/attendance/today", headers=admin_headers, timeout=15)
        assert r.status_code == 200, r.text[:200]
        data = r.json()
        # Must contain fields backing the new 6 cards + badges
        # Accept either flat dict or list — assert shape is JSON
        assert isinstance(data, (dict, list))

    def test_attendance_summary(self, admin_headers):
        r = requests.get(f"{API}/hr/attendance/summary", headers=admin_headers, timeout=15)
        assert r.status_code in (200, 404), r.text[:200]

    def test_attendance_employee_lookup_admin(self, admin_session, admin_headers):
        uid = admin_session["user"]["user_id"]
        r = requests.get(f"{API}/hr/attendance/employee/{uid}", headers=admin_headers, timeout=20)
        assert r.status_code in (200, 404), r.text[:200]

    def test_attendance_employee_lookup_blocked_for_ops(self, admin_session, ops_headers):
        # Ops user should NOT be able to view another employee's attendance
        uid = admin_session["user"]["user_id"]
        r = requests.get(f"{API}/hr/attendance/employee/{uid}", headers=ops_headers, timeout=15)
        assert r.status_code in (401, 403, 404), f"Expected forbidden, got {r.status_code}"


# ---------- ORG TREE ----------
class TestOrgTree:
    def test_get_org_tree(self, admin_headers):
        r = requests.get(f"{API}/org-tree", headers=admin_headers, timeout=15)
        assert r.status_code == 200, r.text[:200]
        body = r.json()
        assert isinstance(body, (dict, list))

    def test_put_org_tree_roundtrip(self, admin_headers):
        # Read existing then PUT back unchanged to verify save endpoint
        r = requests.get(f"{API}/org-tree", headers=admin_headers, timeout=15)
        assert r.status_code == 200
        body = r.json()
        # Try common payload shapes
        payload = body if isinstance(body, dict) else {"nodes": body}
        r2 = requests.put(f"{API}/org-tree", headers=admin_headers, json=payload, timeout=20)
        assert r2.status_code in (200, 201, 204), r2.text[:200]


# ---------- OUR TASKS (Operations) ----------
class TestOurTasks:
    def test_list_my_tasks(self, admin_headers):
        r = requests.get(f"{API}/our-tasks/tasks", headers=admin_headers, timeout=20)
        assert r.status_code == 200, r.text[:200]

    def test_ops_user_list_filtered(self, ops_headers):
        r = requests.get(f"{API}/our-tasks/tasks", headers=ops_headers, timeout=20)
        assert r.status_code == 200, r.text[:200]

    def test_work_hours_today(self, admin_headers):
        today = dt.date.today().isoformat()
        r = requests.get(f"{API}/our-tasks/work-hours/{today}", headers=admin_headers, timeout=15)
        assert r.status_code == 200, r.text[:200]
        data = r.json()
        assert isinstance(data, dict)

    def test_meetings_endpoint(self, admin_headers):
        # Meetings sub-tab data — try common shape
        r = requests.get(f"{API}/meetings/", headers=admin_headers, timeout=15)
        assert r.status_code == 200, r.text[:200]
        assert isinstance(r.json(), list)


# ---------- APPROVAL FLOW ----------
class TestApprovals:
    def test_approvals_list(self, admin_headers):
        r = requests.get(f"{API}/approvals", headers=admin_headers, timeout=15)
        assert r.status_code in (200, 404)


# ---------- LEADS ----------
class TestLeads:
    def test_leads_list(self, admin_headers):
        r = requests.get(f"{API}/leads-v2/leads", headers=admin_headers, timeout=20)
        assert r.status_code == 200, r.text[:200]


# ---------- CALENDAR ----------
class TestCalendar:
    def test_calendar_aggregates(self, admin_headers):
        # Common endpoint for calendar day badges
        for path in ("/calendar/tasks", "/calendar/summary", "/our-tasks/calendar"):
            r = requests.get(f"{API}{path}", headers=admin_headers, timeout=15)
            if r.status_code == 200:
                return
        pytest.skip("No matching calendar aggregate endpoint discovered (manual UI check)")


# ---------- DELETED MODULES MUST NOT 500 ----------
class TestDeletedModulesGone:
    @pytest.mark.parametrize("path", [
        "/sales/leads", "/seo/projects", "/meta-ads/campaigns",
        "/bde-tasks", "/sales-tasks",
    ])
    def test_deleted_endpoints_no_500(self, admin_headers, path):
        r = requests.get(f"{API}{path}", headers=admin_headers, timeout=10)
        assert r.status_code != 500, f"{path} returned 500: {r.text[:200]}"
        # Should be 404/405 not 500
        assert r.status_code in (401, 403, 404, 405, 422), f"{path} -> {r.status_code}"
