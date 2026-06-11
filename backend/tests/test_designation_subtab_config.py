"""
Tests for the per-designation Operations sub-tab access feature (Feb 2026).

Covers:
- F1: Designation CRUD with new fields (operations_projects, operations_departments_tab,
       operations_approvals_tab, operations_meetings_tab)
- F2: /api/auth/me returns enriched `designation_config`
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
assert BASE_URL, "REACT_APP_BACKEND_URL must be set"

SUPER_ADMIN_EMAIL = "vinoth@drawlead.com"
SUPER_ADMIN_PASSWORD = "Admin@123"


# ---------- fixtures ----------
@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def auth_token(session):
    r = session.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": SUPER_ADMIN_EMAIL, "password": SUPER_ADMIN_PASSWORD},
    )
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    data = r.json()
    # Login endpoint sets cookie + returns user; session cookie already in jar
    token = data.get("session_token") or data.get("token")
    if token:
        session.headers.update({"Authorization": f"Bearer {token}"})
    return token


@pytest.fixture(scope="module")
def created_designation_id(session, auth_token):
    """Create a designation with new fields, yield id, clean up at end."""
    title = f"TEST_Desg_{uuid.uuid4().hex[:8]}"
    payload = {
        "title": title,
        "description": "auto test",
        "module_access": ["operations"],
        "operations_my_tasks": True,
        "operations_assign_to_team": True,
        "operations_projects": "edit",
        "operations_departments_tab": True,
        "operations_approvals_tab": True,
        "operations_meetings_tab": True,
    }
    r = session.post(f"{BASE_URL}/api/designations/", json=payload)
    assert r.status_code == 200, f"Create failed: {r.status_code} {r.text}"
    body = r.json()
    desg = body.get("designation") or {}
    desg_id = desg.get("designation_id")
    assert desg_id, f"No designation_id in response: {body}"

    yield desg_id

    # teardown
    session.delete(f"{BASE_URL}/api/designations/{desg_id}")


# ---------- F1: Designation CRUD with new fields ----------
class TestDesignationCRUDNewFields:
    def test_create_persists_new_fields(self, session, auth_token, created_designation_id):
        r = session.get(f"{BASE_URL}/api/designations/{created_designation_id}")
        assert r.status_code == 200
        body = r.json()
        assert body["operations_projects"] == "edit"
        assert body["operations_departments_tab"] is True
        assert body["operations_approvals_tab"] is True
        assert body["operations_meetings_tab"] is True
        assert body["operations_my_tasks"] is True
        assert body["operations_assign_to_team"] is True

    def test_update_flips_projects_to_view(self, session, auth_token, created_designation_id):
        r = session.put(
            f"{BASE_URL}/api/designations/{created_designation_id}",
            json={"operations_projects": "view"},
        )
        assert r.status_code == 200, f"Update failed: {r.text}"
        updated = r.json().get("designation") or {}
        assert updated.get("operations_projects") == "view"

        # GET re-verify
        g = session.get(f"{BASE_URL}/api/designations/{created_designation_id}")
        assert g.status_code == 200
        assert g.json()["operations_projects"] == "view"
        # other booleans untouched
        assert g.json()["operations_departments_tab"] is True
        assert g.json()["operations_approvals_tab"] is True
        assert g.json()["operations_meetings_tab"] is True

    def test_update_all_sub_tab_flags(self, session, auth_token, created_designation_id):
        r = session.put(
            f"{BASE_URL}/api/designations/{created_designation_id}",
            json={
                "operations_departments_tab": False,
                "operations_approvals_tab": False,
                "operations_meetings_tab": False,
            },
        )
        assert r.status_code == 200
        g = session.get(f"{BASE_URL}/api/designations/{created_designation_id}").json()
        assert g["operations_departments_tab"] is False
        assert g["operations_approvals_tab"] is False
        assert g["operations_meetings_tab"] is False

    def test_create_defaults_for_omitted_fields(self, session, auth_token):
        """When omitted, new sub-tab booleans should default to False, projects to 'none'."""
        title = f"TEST_DesgDefaults_{uuid.uuid4().hex[:8]}"
        r = session.post(
            f"{BASE_URL}/api/designations/",
            json={"title": title, "module_access": []},
        )
        assert r.status_code == 200, r.text
        desg = r.json()["designation"]
        try:
            assert desg["operations_projects"] == "none"
            assert desg["operations_departments_tab"] is False
            assert desg["operations_approvals_tab"] is False
            assert desg["operations_meetings_tab"] is False
        finally:
            session.delete(f"{BASE_URL}/api/designations/{desg['designation_id']}")


# ---------- F2: /api/auth/me returns designation_config ----------
class TestAuthMeDesignationConfig:
    def test_auth_me_contains_designation_config(self, session, auth_token):
        r = session.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 200, f"/auth/me failed: {r.status_code} {r.text}"
        data = r.json()
        assert "designation_config" in data, f"Missing key designation_config. Keys: {list(data.keys())}"

        cfg = data["designation_config"]
        # super_admin user might have a designation row. If None, that's allowed
        # (super_admin bypasses config). But test_credentials note CEO designation exists.
        if cfg is None:
            pytest.skip(
                "designation_config is None — super_admin's designation has no row. "
                "Test passes presence-of-key contract."
            )

        expected_keys = {
            "operations_my_tasks",
            "operations_assign_to_team",
            "operations_departments",
            "operations_approval_queue",
            "operations_projects",
            "operations_departments_tab",
            "operations_approvals_tab",
            "operations_meetings_tab",
        }
        missing = expected_keys - set(cfg.keys())
        assert not missing, f"designation_config missing keys: {missing}"

        # Type sanity
        assert isinstance(cfg["operations_my_tasks"], bool)
        assert isinstance(cfg["operations_assign_to_team"], bool)
        assert isinstance(cfg["operations_departments_tab"], bool)
        assert isinstance(cfg["operations_approvals_tab"], bool)
        assert isinstance(cfg["operations_meetings_tab"], bool)
        assert isinstance(cfg["operations_projects"], str)
        assert cfg["operations_projects"] in ("none", "view", "edit")
        assert isinstance(cfg["operations_departments"], list)
