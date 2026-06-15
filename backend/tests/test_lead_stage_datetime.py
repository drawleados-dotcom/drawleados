"""Backend tests for PUT /api/leads-v2/leads/{lead_id}/stage with optional
appointment_at / followup_at payload (Jan 2026 feature)."""

import os
import uuid
from datetime import datetime, timezone, timedelta

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
ADMIN_EMAIL = "vinoth@drawlead.com"
ADMIN_PASSWORD = "Admin@123"


@pytest.fixture(scope="module")
def auth_session():
    s = requests.Session()
    r = s.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=30,
    )
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    token = r.json().get("token") or r.json().get("access_token") or r.json().get("session_token")
    assert token, f"no token in login response: {r.text}"
    s.headers.update({"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def first_stage_id(auth_session):
    r = auth_session.get(f"{BASE_URL}/api/leads-v2/stages", timeout=30)
    assert r.status_code == 200, r.text
    stages = r.json()
    assert isinstance(stages, list) and len(stages) > 0
    return stages[0]["stage_id"]


@pytest.fixture(scope="module")
def second_stage_id(auth_session):
    r = auth_session.get(f"{BASE_URL}/api/leads-v2/stages", timeout=30)
    assert r.status_code == 200, r.text
    stages = r.json()
    return stages[1]["stage_id"] if len(stages) > 1 else stages[0]["stage_id"]


@pytest.fixture
def test_lead(auth_session, first_stage_id):
    # Create a test lead
    payload = {
        "name": f"TEST_StageDT_{uuid.uuid4().hex[:6]}",
        "contact_number": "9999000111",
        "email": "test_stagedt@example.com",
        "source": "Direct",
        "location": "Test City",
        "stage_id": first_stage_id,
    }
    r = auth_session.post(f"{BASE_URL}/api/leads-v2/leads", json=payload, timeout=30)
    assert r.status_code in (200, 201), r.text
    lead = r.json()
    lead_id = lead.get("lead_id") or lead.get("id")
    assert lead_id
    yield lead_id
    # Cleanup
    try:
        auth_session.delete(f"{BASE_URL}/api/leads-v2/leads/{lead_id}/permanent", timeout=30)
    except Exception:
        pass


class TestStageDateTime:
    def test_stage_update_without_dates_still_works(self, auth_session, test_lead, second_stage_id):
        """Regression: existing callers that send only stage_id continue to work."""
        r = auth_session.put(
            f"{BASE_URL}/api/leads-v2/leads/{test_lead}/stage",
            json={"stage_id": second_stage_id},
            timeout=30,
        )
        assert r.status_code == 200, r.text

        # Verify persistence — list endpoint, filter by lead_id
        g = auth_session.get(f"{BASE_URL}/api/leads-v2/leads", timeout=30)
        assert g.status_code == 200, g.text
        leads = g.json()
        match = next((l for l in leads if l.get("lead_id") == test_lead), None)
        assert match, f"lead {test_lead} not found in list"
        assert match["stage_id"] == second_stage_id

    def test_stage_update_with_appointment_at(self, auth_session, test_lead, second_stage_id):
        """appointment_at ISO string is stored on the lead doc."""
        appt = (datetime.now(timezone.utc) + timedelta(days=2)).replace(microsecond=0).isoformat()
        r = auth_session.put(
            f"{BASE_URL}/api/leads-v2/leads/{test_lead}/stage",
            json={"stage_id": second_stage_id, "appointment_at": appt},
            timeout=30,
        )
        assert r.status_code == 200, r.text

        g = auth_session.get(f"{BASE_URL}/api/leads-v2/leads", timeout=30)
        assert g.status_code == 200, g.text
        leads = g.json()
        data = next((l for l in leads if l.get("lead_id") == test_lead), None)
        assert data, f"lead {test_lead} not found in list"
        assert data.get("appointment_at"), f"appointment_at not persisted: {data}"
        assert appt[:19] in str(data["appointment_at"])

    def test_stage_update_with_followup_at(self, auth_session, test_lead, first_stage_id):
        """followup_at ISO string is stored on the lead doc."""
        fup = (datetime.now(timezone.utc) + timedelta(days=5)).replace(microsecond=0).isoformat()
        r = auth_session.put(
            f"{BASE_URL}/api/leads-v2/leads/{test_lead}/stage",
            json={"stage_id": first_stage_id, "followup_at": fup},
            timeout=30,
        )
        assert r.status_code == 200, r.text

        g = auth_session.get(f"{BASE_URL}/api/leads-v2/leads", timeout=30)
        assert g.status_code == 200, g.text
        leads = g.json()
        data = next((l for l in leads if l.get("lead_id") == test_lead), None)
        assert data, f"lead {test_lead} not found in list"
        assert data.get("followup_at"), f"followup_at not persisted: {data}"
        assert fup[:19] in str(data["followup_at"])

    def test_lead_update_persists_notes_as_remarks(self, auth_session, test_lead):
        """Remarks textarea is bound to lead.notes — verify PUT /leads/{id} persists notes."""
        remark = "TEST_REMARK call summary blockers next move " + uuid.uuid4().hex[:6]
        r = auth_session.put(
            f"{BASE_URL}/api/leads-v2/leads/{test_lead}",
            json={"notes": remark},
            timeout=30,
        )
        assert r.status_code == 200, r.text

        g = auth_session.get(f"{BASE_URL}/api/leads-v2/leads", timeout=30)
        assert g.status_code == 200
        leads = g.json()
        data = next((l for l in leads if l.get("lead_id") == test_lead), None)
        assert data, f"lead {test_lead} not found in list"
        assert data.get("notes") == remark
