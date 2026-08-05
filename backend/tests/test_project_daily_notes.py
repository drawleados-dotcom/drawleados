"""
Test Project Daily Notes — the per-project "what happened today" log that sits
next to Tasks in Operations > Projects > (project) for every department.

Covers: filing today's update, the all-days list + its filters, editing,
validation, and delete.
"""
import pytest
import requests
import os
from datetime import datetime, timezone, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

IST = timezone(timedelta(hours=5, minutes=30))


class TestProjectDailyNotes:

    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})

        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "vinoth@drawlead.com",
            "password": "admin123"
        })
        if login_response.status_code != 200:
            pytest.skip("Authentication failed - skipping tests")
        self.session.headers.update({"Authorization": f"Bearer {login_response.json().get('session_token')}"})

        projects = self.session.get(f"{BASE_URL}/api/projects").json()
        if not projects:
            pytest.skip("No projects available - skipping tests")
        self.project_id = projects[0]["project_id"]
        self.created_note_ids = []

        yield

        for note_id in self.created_note_ids:
            try:
                self.session.delete(f"{BASE_URL}/api/projects/{self.project_id}/daily-notes/{note_id}")
            except Exception:
                pass

    def _add_note(self, **payload):
        payload.setdefault("note", "TEST_ daily update")
        response = self.session.post(f"{BASE_URL}/api/projects/{self.project_id}/daily-notes", json=payload)
        assert response.status_code == 200, f"Failed to add daily note: {response.text}"
        note = response.json()
        self.created_note_ids.append(note["note_id"])
        return note

    def test_add_note_defaults_to_today_ist(self):
        """No note_date supplied → the entry lands on today's IST date."""
        note = self._add_note(note="TEST_ shipped the login page")
        assert note["note"] == "TEST_ shipped the login page"
        assert note["note_date"] == datetime.now(IST).date().isoformat()
        assert note["project_id"] == self.project_id
        assert note["created_by_name"]

    def test_list_returns_notes_newest_day_first(self):
        older = self._add_note(note="TEST_ older", note_date="2020-01-01")
        newer = self._add_note(note="TEST_ newer", note_date="2020-06-01")

        response = self.session.get(f"{BASE_URL}/api/projects/{self.project_id}/daily-notes")
        assert response.status_code == 200
        dates = [n["note_date"] for n in response.json()]
        assert dates == sorted(dates, reverse=True)

        ids = [n["note_id"] for n in response.json()]
        assert older["note_id"] in ids and newer["note_id"] in ids

    def test_filter_by_single_date_and_range(self):
        self._add_note(note="TEST_ in range", note_date="2020-03-15")
        self._add_note(note="TEST_ out of range", note_date="2020-09-15")

        single = self.session.get(
            f"{BASE_URL}/api/projects/{self.project_id}/daily-notes",
            params={"note_date": "2020-03-15"},
        )
        assert single.status_code == 200
        assert all(n["note_date"] == "2020-03-15" for n in single.json())

        ranged = self.session.get(
            f"{BASE_URL}/api/projects/{self.project_id}/daily-notes",
            params={"from_date": "2020-01-01", "to_date": "2020-06-30"},
        )
        assert ranged.status_code == 200
        assert all("2020-01-01" <= n["note_date"] <= "2020-06-30" for n in ranged.json())

    def test_edit_note(self):
        note = self._add_note(note="TEST_ first draft")
        response = self.session.patch(
            f"{BASE_URL}/api/projects/{self.project_id}/daily-notes/{note['note_id']}",
            json={"note": "TEST_ corrected draft"},
        )
        assert response.status_code == 200, response.text
        updated = response.json()
        assert updated["note"] == "TEST_ corrected draft"
        assert updated["updated_at"] != note["created_at"]

    def test_empty_note_rejected(self):
        response = self.session.post(
            f"{BASE_URL}/api/projects/{self.project_id}/daily-notes",
            json={"note": "   "},
        )
        assert response.status_code == 400

    def test_bad_date_rejected(self):
        response = self.session.post(
            f"{BASE_URL}/api/projects/{self.project_id}/daily-notes",
            json={"note": "TEST_ bad date", "note_date": "03-08-2026"},
        )
        assert response.status_code == 400

    def test_delete_note(self):
        note = self._add_note(note="TEST_ to be deleted")
        response = self.session.delete(
            f"{BASE_URL}/api/projects/{self.project_id}/daily-notes/{note['note_id']}"
        )
        assert response.status_code == 200
        self.created_note_ids.remove(note["note_id"])

        remaining = self.session.get(f"{BASE_URL}/api/projects/{self.project_id}/daily-notes").json()
        assert note["note_id"] not in [n["note_id"] for n in remaining]

    def test_unknown_project_404s(self):
        response = self.session.get(f"{BASE_URL}/api/projects/prj_does_not_exist/daily-notes")
        assert response.status_code == 404
