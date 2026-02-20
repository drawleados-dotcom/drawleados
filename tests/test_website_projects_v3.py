"""
Website Projects API Tests V3
Tests for the Operations Head features:
- All Projects Summary view (Dev %, Overall %, filters)
- Cross-Project Tasks (filter by due date and developer)
- Team Members listing
- Page Subtasks (auto-generated date)
- Page Screenshots (paste URL and add)
- Phase assignee and due date on pages
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "vinoth@drawlead.com"
ADMIN_PASSWORD = "admin123"


@pytest.fixture(scope="module")
def auth_token():
    """Get auth token for tests"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    )
    if response.status_code == 200:
        return response.json()["session_token"]
    pytest.skip("Authentication failed")


@pytest.fixture(scope="module")
def api_client(auth_token):
    """Create authenticated session"""
    session = requests.Session()
    session.headers.update({
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    })
    return session


# Module level storage
class TestData:
    project_id = None
    page_task_id = None
    subtask_id = None
    screenshot_id = None
    user_id = None


class TestAllProjectsSummary:
    """Test All Projects Summary endpoint for Operations Head view"""
    
    def test_get_all_projects_summary(self, api_client):
        """Get all projects summary with Dev %, Overall %"""
        response = api_client.get(
            f"{BASE_URL}/api/website-projects/all-projects-summary"
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list)
        print(f"Found {len(data)} projects in summary")
        
        # Verify structure if we have projects
        if len(data) > 0:
            project = data[0]
            assert "project_id" in project
            assert "name" in project
            assert "dev_percent" in project
            assert "overall_percent" in project
            assert "total_pages" in project
            assert "developer" in project
            assert "onboarding_date" in project
            assert "deadline" in project
            assert "phase_stats" in project
            
            # Verify phase_stats has all phases
            phase_stats = project["phase_stats"]
            assert "wireframe" in phase_stats
            assert "ui" in phase_stats
            assert "content" in phase_stats
            assert "dev" in phase_stats
            
            print(f"First project: {project['name']}, Dev%: {project['dev_percent']}, Overall%: {project['overall_percent']}")


class TestCrossProjectTasks:
    """Test cross-project tasks endpoint with filters"""
    
    def test_get_all_tasks_no_filter(self, api_client):
        """Get all tasks across projects without filters"""
        response = api_client.get(
            f"{BASE_URL}/api/website-projects/all-tasks"
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list)
        print(f"Found {len(data)} tasks across all projects")
        
        # Verify structure if we have tasks
        if len(data) > 0:
            task = data[0]
            assert "project_name" in task
            assert "title" in task
            assert "status" in task
            assert "task_type" in task
            print(f"Sample task: {task.get('title', 'N/A')} - {task.get('status', 'N/A')}")
    
    def test_get_all_tasks_with_date_filter(self, api_client):
        """Get tasks filtered by due date"""
        today = datetime.now().strftime("%Y-%m-%d")
        
        response = api_client.get(
            f"{BASE_URL}/api/website-projects/all-tasks?due_date={today}"
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list)
        print(f"Found {len(data)} tasks due on {today}")


class TestTeamMembers:
    """Test team members endpoint"""
    
    def test_get_team_members(self, api_client):
        """Get list of team members for assignee dropdowns"""
        response = api_client.get(
            f"{BASE_URL}/api/website-projects/team-members"
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list)
        assert len(data) >= 1, "Should have at least one team member"
        
        # Verify structure
        member = data[0]
        assert "user_id" in member
        assert "name" in member
        assert "email" in member
        assert "role" in member
        
        TestData.user_id = member["user_id"]
        print(f"Found {len(data)} team members")
        print(f"First member: {member['name']} ({member['role']})")


class TestPageSubtasksSetup:
    """Setup: Create test project for subtask tests"""
    
    def test_create_test_project(self, api_client):
        """Create a test project for subtask/screenshot tests"""
        project_data = {
            "name": "TEST_SubtasksScreenshots Project",
            "domain_url": "www.test-subtasks.com",
            "platform": "Website",
            "website_type": "Business Website",
            "deadline": (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")
        }
        
        response = api_client.post(
            f"{BASE_URL}/api/website-projects/projects",
            json=project_data
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "project_id" in data
        TestData.project_id = data["project_id"]
        print(f"Test project created: {data['project_id']}")
    
    def test_get_first_page_task(self, api_client):
        """Get the first page task from the project"""
        response = api_client.get(
            f"{BASE_URL}/api/website-projects/projects/{TestData.project_id}"
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        tasks = data["tasks"]
        assert len(tasks) >= 1
        
        TestData.page_task_id = tasks[0]["task_id"]
        print(f"Using page task: {TestData.page_task_id} - {tasks[0]['page_name']}")


class TestPageSubtasks:
    """Test page subtasks (Tasks/Notes section in Page Detail view)"""
    
    def test_create_subtask(self, api_client):
        """Create a subtask with auto-generated date"""
        subtask_data = {
            "title": "TEST_Review hero image design"
        }
        
        response = api_client.post(
            f"{BASE_URL}/api/website-projects/pages/{TestData.page_task_id}/subtasks",
            json=subtask_data
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "subtask_id" in data
        assert data["title"] == subtask_data["title"]
        assert data["completed"] == False
        assert "created_at" in data  # Auto-generated date
        assert "created_by_name" in data
        
        TestData.subtask_id = data["subtask_id"]
        print(f"Subtask created: {data['subtask_id']}")
    
    def test_get_page_subtasks(self, api_client):
        """Get all subtasks for a page"""
        response = api_client.get(
            f"{BASE_URL}/api/website-projects/pages/{TestData.page_task_id}/subtasks"
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list)
        assert len(data) >= 1
        
        # Find our subtask
        our_subtask = next((s for s in data if s["subtask_id"] == TestData.subtask_id), None)
        assert our_subtask is not None
        assert our_subtask["title"] == "TEST_Review hero image design"
        
        print(f"Found {len(data)} subtasks")
    
    def test_toggle_subtask_completion(self, api_client):
        """Toggle subtask completion status"""
        update_data = {"completed": True}
        
        response = api_client.put(
            f"{BASE_URL}/api/website-projects/subtasks/{TestData.subtask_id}",
            json=update_data
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data["completed"] == True
        print(f"Subtask marked as completed")
    
    def test_update_subtask_title(self, api_client):
        """Update subtask title"""
        update_data = {"title": "TEST_Review hero image design - Updated"}
        
        response = api_client.put(
            f"{BASE_URL}/api/website-projects/subtasks/{TestData.subtask_id}",
            json=update_data
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data["title"] == update_data["title"]
        print(f"Subtask title updated")
    
    def test_delete_subtask(self, api_client):
        """Delete a subtask"""
        response = api_client.delete(
            f"{BASE_URL}/api/website-projects/subtasks/{TestData.subtask_id}"
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data["message"] == "Sub-task deleted"
        print(f"Subtask deleted")


class TestPageScreenshots:
    """Test page screenshots (paste URL and add)"""
    
    def test_add_screenshot(self, api_client):
        """Add a screenshot URL to page"""
        screenshot_data = {
            "url": "https://example.com/homepage-mockup.png",
            "caption": "Homepage mockup v1"
        }
        
        response = api_client.post(
            f"{BASE_URL}/api/website-projects/pages/{TestData.page_task_id}/screenshots",
            json=screenshot_data
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "screenshot_id" in data
        assert data["url"] == screenshot_data["url"]
        assert data["caption"] == screenshot_data["caption"]
        assert "created_at" in data
        
        TestData.screenshot_id = data["screenshot_id"]
        print(f"Screenshot added: {data['screenshot_id']}")
    
    def test_get_page_screenshots(self, api_client):
        """Get all screenshots for a page"""
        response = api_client.get(
            f"{BASE_URL}/api/website-projects/pages/{TestData.page_task_id}/screenshots"
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list)
        assert len(data) >= 1
        
        # Find our screenshot
        our_ss = next((s for s in data if s["screenshot_id"] == TestData.screenshot_id), None)
        assert our_ss is not None
        assert our_ss["url"] == "https://example.com/homepage-mockup.png"
        
        print(f"Found {len(data)} screenshots")
    
    def test_add_second_screenshot(self, api_client):
        """Add another screenshot (without caption)"""
        screenshot_data = {
            "url": "https://example.com/homepage-v2.png"
        }
        
        response = api_client.post(
            f"{BASE_URL}/api/website-projects/pages/{TestData.page_task_id}/screenshots",
            json=screenshot_data
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data["url"] == screenshot_data["url"]
        assert data["caption"] is None  # Optional
        print(f"Second screenshot added")
    
    def test_delete_screenshot(self, api_client):
        """Delete a screenshot"""
        response = api_client.delete(
            f"{BASE_URL}/api/website-projects/screenshots/{TestData.screenshot_id}"
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data["message"] == "Screenshot deleted"
        print(f"Screenshot deleted")


class TestPhaseAssigneeDueDate:
    """Test phase-level assignee and due date updates on pages"""
    
    def test_update_page_wireframe_phase(self, api_client):
        """Update wireframe phase with status, assignee, due date"""
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        
        update_data = {
            "wireframe_status": "In Progress",
            "wireframe_assignee": TestData.user_id,
            "wireframe_due": tomorrow
        }
        
        response = api_client.put(
            f"{BASE_URL}/api/website-projects/pages/{TestData.page_task_id}",
            json=update_data
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data["wireframe_status"] == "In Progress"
        assert data["wireframe_assignee"] == TestData.user_id
        assert data["wireframe_due"] == tomorrow
        
        print(f"Wireframe phase updated with assignee and due date")
    
    def test_update_page_ui_phase(self, api_client):
        """Update UI phase with status, assignee, due date"""
        future_date = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
        
        update_data = {
            "ui_status": "To-Do",
            "ui_assignee": TestData.user_id,
            "ui_due": future_date
        }
        
        response = api_client.put(
            f"{BASE_URL}/api/website-projects/pages/{TestData.page_task_id}",
            json=update_data
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data["ui_status"] == "To-Do"
        assert data["ui_assignee"] == TestData.user_id
        assert data["ui_due"] == future_date
        
        print(f"UI phase updated with assignee and due date")
    
    def test_update_page_content_phase(self, api_client):
        """Update content phase with status, assignee, due date"""
        future_date = (datetime.now() + timedelta(days=14)).strftime("%Y-%m-%d")
        
        update_data = {
            "content_status": "Client Review",
            "content_assignee": TestData.user_id,
            "content_due": future_date
        }
        
        response = api_client.put(
            f"{BASE_URL}/api/website-projects/pages/{TestData.page_task_id}",
            json=update_data
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data["content_status"] == "Client Review"
        assert data["content_assignee"] == TestData.user_id
        assert data["content_due"] == future_date
        
        print(f"Content phase updated with assignee and due date")
    
    def test_update_page_dev_phase(self, api_client):
        """Update development phase with status, assignee, due date"""
        future_date = (datetime.now() + timedelta(days=21)).strftime("%Y-%m-%d")
        
        update_data = {
            "dev_status": "To-Do",
            "dev_assignee": TestData.user_id,
            "dev_due": future_date
        }
        
        response = api_client.put(
            f"{BASE_URL}/api/website-projects/pages/{TestData.page_task_id}",
            json=update_data
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data["dev_status"] == "To-Do"
        assert data["dev_assignee"] == TestData.user_id
        assert data["dev_due"] == future_date
        
        print(f"Dev phase updated with assignee and due date")


class TestCrossProjectTasksWithDeveloper:
    """Test cross-project tasks filtering by developer"""
    
    def test_get_tasks_by_developer(self, api_client):
        """Get tasks filtered by developer"""
        if not TestData.user_id:
            pytest.skip("No user_id available")
        
        response = api_client.get(
            f"{BASE_URL}/api/website-projects/all-tasks?developer={TestData.user_id}"
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list)
        print(f"Found {len(data)} tasks for developer {TestData.user_id}")
        
        # Verify all tasks are assigned to the developer
        for task in data:
            assert task.get("assignee") == TestData.user_id or task.get("assigned_to") == TestData.user_id
    
    def test_get_tasks_by_date_and_developer(self, api_client):
        """Get tasks filtered by both date and developer"""
        if not TestData.user_id:
            pytest.skip("No user_id available")
        
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        
        response = api_client.get(
            f"{BASE_URL}/api/website-projects/all-tasks?due_date={tomorrow}&developer={TestData.user_id}"
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list)
        print(f"Found {len(data)} tasks for developer {TestData.user_id} due on {tomorrow}")


class TestCleanup:
    """Cleanup test data"""
    
    def test_delete_test_project(self, api_client):
        """Delete the test project"""
        if not TestData.project_id:
            pytest.skip("No project to delete")
        
        response = api_client.delete(
            f"{BASE_URL}/api/website-projects/projects/{TestData.project_id}"
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        print(f"Test project deleted")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
