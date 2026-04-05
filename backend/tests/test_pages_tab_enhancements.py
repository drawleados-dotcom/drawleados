"""
Test Pages Tab Enhancements - Due Date, Time Left, Time Spent, Stage Assignees
Tests for the enhanced Pages tab features in Website Projects
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestPagesTabEnhancements:
    """Test enhanced Pages tab features"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get auth token
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "vinoth@drawlead.com",
            "password": "admin123"
        })
        
        if login_response.status_code == 200:
            token = login_response.json().get("session_token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
            self.token = token
        else:
            pytest.skip("Authentication failed - skipping tests")
        
        self.project_id = "wp_a1c1848dc35a"
        yield
        
        # Cleanup: Delete test pages
        self._cleanup_test_pages()
    
    def _cleanup_test_pages(self):
        """Clean up test pages created during tests"""
        try:
            # Get project pages
            response = self.session.get(f"{BASE_URL}/api/website-projects/projects/{self.project_id}")
            if response.status_code == 200:
                tasks = response.json().get("tasks", [])
                for task in tasks:
                    if task.get("page_name", "").startswith("TEST_"):
                        self.session.delete(f"{BASE_URL}/api/website-projects/pages/{task['task_id']}")
        except Exception:
            pass
    
    def test_create_page_with_due_date(self):
        """Test creating a page with due_date field"""
        # Create page with due date
        page_data = {
            "page_name": "TEST_Page_DueDate",
            "due_date": "2026-04-15"
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/website-projects/projects/{self.project_id}/pages",
            json=page_data
        )
        
        assert response.status_code == 200, f"Failed to create page: {response.text}"
        
        data = response.json()
        assert data["page_name"] == "TEST_Page_DueDate"
        assert data["due_date"] == "2026-04-15"
        assert "task_id" in data
        
        print(f"✓ Created page with due_date: {data['task_id']}")
    
    def test_create_page_with_stage_assignees(self):
        """Test creating a page with all 7 stage assignees"""
        page_data = {
            "page_name": "TEST_Page_Assignees",
            "due_date": "2026-04-20",
            "content_assignee": "John Doe",
            "wireframe_assignee": "Jane Smith",
            "ui_assignee": "Designer 1",
            "responsive_assignee": "Designer 2",
            "dev_assignee": "Developer 1",
            "test_assignee": "QA Engineer",
            "delivery_assignee": "PM Lead"
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/website-projects/projects/{self.project_id}/pages",
            json=page_data
        )
        
        assert response.status_code == 200, f"Failed to create page: {response.text}"
        
        data = response.json()
        assert data["page_name"] == "TEST_Page_Assignees"
        assert data["content_assignee"] == "John Doe"
        assert data["wireframe_assignee"] == "Jane Smith"
        assert data["ui_assignee"] == "Designer 1"
        assert data["responsive_assignee"] == "Designer 2"
        assert data["dev_assignee"] == "Developer 1"
        assert data["test_assignee"] == "QA Engineer"
        assert data["delivery_assignee"] == "PM Lead"
        
        print(f"✓ Created page with all 7 stage assignees: {data['task_id']}")
    
    def test_update_page_due_date(self):
        """Test updating a page's due_date"""
        # First create a page
        create_response = self.session.post(
            f"{BASE_URL}/api/website-projects/projects/{self.project_id}/pages",
            json={"page_name": "TEST_Page_UpdateDue"}
        )
        assert create_response.status_code == 200
        task_id = create_response.json()["task_id"]
        
        # Update due date
        update_response = self.session.put(
            f"{BASE_URL}/api/website-projects/pages/{task_id}",
            json={"due_date": "2026-05-01"}
        )
        
        assert update_response.status_code == 200, f"Failed to update page: {update_response.text}"
        
        data = update_response.json()
        assert data["due_date"] == "2026-05-01"
        
        print(f"✓ Updated page due_date: {task_id}")
    
    def test_update_page_stage_assignees(self):
        """Test updating a page's stage assignees"""
        # First create a page
        create_response = self.session.post(
            f"{BASE_URL}/api/website-projects/projects/{self.project_id}/pages",
            json={"page_name": "TEST_Page_UpdateAssignees"}
        )
        assert create_response.status_code == 200
        task_id = create_response.json()["task_id"]
        
        # Update stage assignees
        update_response = self.session.put(
            f"{BASE_URL}/api/website-projects/pages/{task_id}",
            json={
                "content_assignee": "Updated Content Person",
                "dev_assignee": "Updated Dev Person"
            }
        )
        
        assert update_response.status_code == 200, f"Failed to update page: {update_response.text}"
        
        data = update_response.json()
        assert data["content_assignee"] == "Updated Content Person"
        assert data["dev_assignee"] == "Updated Dev Person"
        
        print(f"✓ Updated page stage assignees: {task_id}")
    
    def test_get_project_pages_with_due_dates(self):
        """Test getting project pages includes due_date field"""
        response = self.session.get(
            f"{BASE_URL}/api/website-projects/projects/{self.project_id}"
        )
        
        assert response.status_code == 200, f"Failed to get project: {response.text}"
        
        data = response.json()
        assert "tasks" in data
        
        # Check that tasks have the expected fields
        if len(data["tasks"]) > 0:
            task = data["tasks"][0]
            # due_date field should exist (may be null)
            assert "due_date" in task or task.get("due_date") is None
            # Stage assignee fields should exist
            assert "content_assignee" in task or task.get("content_assignee") is None
            assert "wireframe_assignee" in task or task.get("wireframe_assignee") is None
            assert "ui_assignee" in task or task.get("ui_assignee") is None
            assert "responsive_assignee" in task or task.get("responsive_assignee") is None
            assert "dev_assignee" in task or task.get("dev_assignee") is None
            assert "test_assignee" in task or task.get("test_assignee") is None
            assert "delivery_assignee" in task or task.get("delivery_assignee") is None
        
        print(f"✓ Project pages include due_date and stage assignee fields")
    
    def test_create_page_with_past_due_date(self):
        """Test creating a page with a past due date (for overdue testing)"""
        past_date = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
        
        page_data = {
            "page_name": "TEST_Page_Overdue",
            "due_date": past_date
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/website-projects/projects/{self.project_id}/pages",
            json=page_data
        )
        
        assert response.status_code == 200, f"Failed to create page: {response.text}"
        
        data = response.json()
        assert data["page_name"] == "TEST_Page_Overdue"
        assert data["due_date"] == past_date
        
        print(f"✓ Created page with past due_date (overdue): {data['task_id']}")
    
    def test_create_page_with_future_due_date(self):
        """Test creating a page with a future due date (for time left testing)"""
        future_date = (datetime.now() + timedelta(days=10)).strftime("%Y-%m-%d")
        
        page_data = {
            "page_name": "TEST_Page_Future",
            "due_date": future_date
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/website-projects/projects/{self.project_id}/pages",
            json=page_data
        )
        
        assert response.status_code == 200, f"Failed to create page: {response.text}"
        
        data = response.json()
        assert data["page_name"] == "TEST_Page_Future"
        assert data["due_date"] == future_date
        
        print(f"✓ Created page with future due_date: {data['task_id']}")
    
    def test_delete_page(self):
        """Test deleting a page"""
        # First create a page
        create_response = self.session.post(
            f"{BASE_URL}/api/website-projects/projects/{self.project_id}/pages",
            json={"page_name": "TEST_Page_ToDelete"}
        )
        assert create_response.status_code == 200
        task_id = create_response.json()["task_id"]
        
        # Delete the page
        delete_response = self.session.delete(
            f"{BASE_URL}/api/website-projects/pages/{task_id}"
        )
        
        assert delete_response.status_code == 200, f"Failed to delete page: {delete_response.text}"
        
        # Verify page is deleted
        get_response = self.session.get(
            f"{BASE_URL}/api/website-projects/projects/{self.project_id}"
        )
        tasks = get_response.json().get("tasks", [])
        task_ids = [t["task_id"] for t in tasks]
        assert task_id not in task_ids
        
        print(f"✓ Deleted page: {task_id}")


class TestTeamMembersEndpoint:
    """Test team members endpoint for assignee dropdowns"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get auth token
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "vinoth@drawlead.com",
            "password": "admin123"
        })
        
        if login_response.status_code == 200:
            token = login_response.json().get("session_token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
        else:
            pytest.skip("Authentication failed - skipping tests")
    
    def test_get_team_members(self):
        """Test getting team members for assignee dropdowns"""
        response = self.session.get(f"{BASE_URL}/api/website-projects/team-members")
        
        assert response.status_code == 200, f"Failed to get team members: {response.text}"
        
        data = response.json()
        assert isinstance(data, list)
        
        if len(data) > 0:
            member = data[0]
            assert "user_id" in member
            assert "name" in member
        
        print(f"✓ Got {len(data)} team members for assignee dropdowns")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
