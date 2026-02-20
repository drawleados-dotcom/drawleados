"""
Website Projects API Tests V2
Tests for the enhanced website projects features:
- Project Tasks (separate from Page Tasks)
- Page Sections (with screenshots and phase tracking)
- Section Feedback (Google Docs style comments)
"""
import pytest
import requests
import os
from datetime import datetime

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
    section_id = None
    feedback_id = None
    project_task_id = None


class TestSetup:
    """Setup test data - create project and get a page"""
    
    def test_create_test_project(self, api_client):
        """Create a test project for section/feedback tests"""
        project_data = {
            "name": "TEST_SectionFeedback Project",
            "domain_url": "www.testsectionfeedback.com",
            "platform": "Website",
            "website_type": "Business Website"
        }
        
        response = api_client.post(
            f"{BASE_URL}/api/website-projects/projects",
            json=project_data
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "project_id" in data
        assert data["pages_created"] == 8
        
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


class TestProjectTasks:
    """Test project-level tasks (separate from page tasks)"""
    
    def test_create_project_task(self, api_client):
        """Create a new project task"""
        task_data = {
            "title": "TEST_Setup hosting environment",
            "description": "Configure AWS server for deployment",
            "priority": "high"
        }
        
        response = api_client.post(
            f"{BASE_URL}/api/website-projects/projects/{TestData.project_id}/tasks",
            json=task_data
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "task_id" in data
        assert data["title"] == task_data["title"]
        assert data["description"] == task_data["description"]
        assert data["priority"] == "high"
        assert data["status"] == "To-Do"
        
        TestData.project_task_id = data["task_id"]
        print(f"Project task created: {data['task_id']}")
    
    def test_get_project_tasks(self, api_client):
        """Get all tasks for the project"""
        response = api_client.get(
            f"{BASE_URL}/api/website-projects/projects/{TestData.project_id}/tasks"
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list)
        assert len(data) >= 1
        
        # Find our task
        our_task = next((t for t in data if t["task_id"] == TestData.project_task_id), None)
        assert our_task is not None
        assert our_task["title"] == "TEST_Setup hosting environment"
        
        print(f"Found {len(data)} project tasks")
    
    def test_update_project_task(self, api_client):
        """Update a project task status"""
        update_data = {
            "status": "In Progress",
            "priority": "medium"
        }
        
        response = api_client.put(
            f"{BASE_URL}/api/website-projects/tasks/{TestData.project_task_id}",
            json=update_data
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data["status"] == "In Progress"
        assert data["priority"] == "medium"
        
        print(f"Project task updated: status={data['status']}")
    
    def test_complete_project_task(self, api_client):
        """Mark project task as completed"""
        update_data = {"status": "Completed"}
        
        response = api_client.put(
            f"{BASE_URL}/api/website-projects/tasks/{TestData.project_task_id}",
            json=update_data
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data["status"] == "Completed"
        print(f"Project task completed")
    
    def test_delete_project_task(self, api_client):
        """Delete project task"""
        response = api_client.delete(
            f"{BASE_URL}/api/website-projects/tasks/{TestData.project_task_id}"
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data["message"] == "Task deleted"
        print(f"Project task deleted")


class TestPageSections:
    """Test page section operations (Hero, About, etc.)"""
    
    def test_create_section(self, api_client):
        """Create a new section for a page"""
        section_data = {
            "name": "TEST_Hero Section",
            "description": "Main hero banner with CTA",
            "screenshot_url": "https://example.com/screenshot.png"
        }
        
        response = api_client.post(
            f"{BASE_URL}/api/website-projects/pages/{TestData.page_task_id}/sections",
            json=section_data
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "section_id" in data
        assert data["name"] == section_data["name"]
        assert data["description"] == section_data["description"]
        assert data["screenshot_url"] == section_data["screenshot_url"]
        assert data["wireframe_status"] == "To-Do"
        assert data["ui_status"] == "To-Do"
        assert data["dev_status"] == "To-Do"
        assert data["content_status"] == "To-Do"
        
        TestData.section_id = data["section_id"]
        print(f"Section created: {data['section_id']}")
    
    def test_get_page_sections(self, api_client):
        """Get all sections for a page"""
        response = api_client.get(
            f"{BASE_URL}/api/website-projects/pages/{TestData.page_task_id}/sections"
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list)
        assert len(data) >= 1
        
        # Find our section
        our_section = next((s for s in data if s["section_id"] == TestData.section_id), None)
        assert our_section is not None
        assert our_section["name"] == "TEST_Hero Section"
        
        print(f"Found {len(data)} sections")
    
    def test_update_section_wireframe_status(self, api_client):
        """Update section wireframe status and URL"""
        update_data = {
            "wireframe_status": "In Progress",
            "wireframe_url": "https://figma.com/wireframe123"
        }
        
        response = api_client.put(
            f"{BASE_URL}/api/website-projects/sections/{TestData.section_id}",
            json=update_data
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data["wireframe_status"] == "In Progress"
        assert data["wireframe_url"] == "https://figma.com/wireframe123"
        
        print(f"Section wireframe status updated")
    
    def test_update_section_ui_status(self, api_client):
        """Update section UI status"""
        update_data = {
            "ui_status": "Client Review",
            "ui_url": "https://figma.com/ui123"
        }
        
        response = api_client.put(
            f"{BASE_URL}/api/website-projects/sections/{TestData.section_id}",
            json=update_data
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data["ui_status"] == "Client Review"
        assert data["ui_url"] == "https://figma.com/ui123"
        
        print(f"Section UI status updated")
    
    def test_update_section_dev_status(self, api_client):
        """Update section dev status"""
        update_data = {
            "dev_status": "In Progress",
            "dev_url": "https://github.com/dev123"
        }
        
        response = api_client.put(
            f"{BASE_URL}/api/website-projects/sections/{TestData.section_id}",
            json=update_data
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data["dev_status"] == "In Progress"
        assert data["dev_url"] == "https://github.com/dev123"
        
        print(f"Section dev status updated")
    
    def test_update_section_content_status(self, api_client):
        """Update section content status"""
        update_data = {
            "content_status": "Completed",
            "content_url": "https://docs.google.com/content123"
        }
        
        response = api_client.put(
            f"{BASE_URL}/api/website-projects/sections/{TestData.section_id}",
            json=update_data
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data["content_status"] == "Completed"
        assert data["content_url"] == "https://docs.google.com/content123"
        
        print(f"Section content status updated")


class TestSectionFeedback:
    """Test section feedback (Google Docs style comments)"""
    
    def test_create_feedback_comment(self, api_client):
        """Create a feedback comment on section"""
        feedback_data = {
            "content": "TEST_Please make the CTA button more prominent",
            "feedback_type": "comment"
        }
        
        response = api_client.post(
            f"{BASE_URL}/api/website-projects/sections/{TestData.section_id}/feedback",
            json=feedback_data
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "feedback_id" in data
        assert data["content"] == feedback_data["content"]
        assert data["feedback_type"] == "comment"
        assert data["status"] == "open"
        assert "created_by_name" in data
        
        TestData.feedback_id = data["feedback_id"]
        print(f"Feedback created: {data['feedback_id']}")
    
    def test_get_section_feedback(self, api_client):
        """Get all feedback for a section"""
        response = api_client.get(
            f"{BASE_URL}/api/website-projects/sections/{TestData.section_id}/feedback"
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list)
        assert len(data) >= 1
        
        # Find our feedback
        our_feedback = next((f for f in data if f["feedback_id"] == TestData.feedback_id), None)
        assert our_feedback is not None
        assert our_feedback["status"] == "open"
        
        print(f"Found {len(data)} feedback items")
    
    def test_resolve_feedback(self, api_client):
        """Resolve a feedback item"""
        response = api_client.put(
            f"{BASE_URL}/api/website-projects/feedback/{TestData.feedback_id}?status=resolved"
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data["status"] == "resolved"
        print(f"Feedback resolved")
    
    def test_reopen_feedback(self, api_client):
        """Reopen a resolved feedback"""
        response = api_client.put(
            f"{BASE_URL}/api/website-projects/feedback/{TestData.feedback_id}?status=open"
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data["status"] == "open"
        print(f"Feedback reopened")
    
    def test_create_revision_feedback(self, api_client):
        """Create a revision request feedback"""
        feedback_data = {
            "content": "TEST_Need to change hero image to brand colors",
            "feedback_type": "revision"
        }
        
        response = api_client.post(
            f"{BASE_URL}/api/website-projects/sections/{TestData.section_id}/feedback",
            json=feedback_data
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data["feedback_type"] == "revision"
        print(f"Revision feedback created")
    
    def test_delete_feedback(self, api_client):
        """Delete a feedback item"""
        response = api_client.delete(
            f"{BASE_URL}/api/website-projects/feedback/{TestData.feedback_id}"
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data["message"] == "Feedback deleted"
        print(f"Feedback deleted")


class TestCleanup:
    """Cleanup test data"""
    
    def test_delete_section(self, api_client):
        """Delete section (should also delete its feedback)"""
        response = api_client.delete(
            f"{BASE_URL}/api/website-projects/sections/{TestData.section_id}"
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data["message"] == "Section deleted"
        print(f"Section deleted")
    
    def test_verify_section_deleted(self, api_client):
        """Verify section is deleted by checking page sections"""
        response = api_client.get(
            f"{BASE_URL}/api/website-projects/pages/{TestData.page_task_id}/sections"
        )
        assert response.status_code == 200
        data = response.json()
        
        # Our section should not exist
        our_section = next((s for s in data if s["section_id"] == TestData.section_id), None)
        assert our_section is None
        print(f"Section confirmed deleted")
    
    def test_delete_test_project(self, api_client):
        """Delete the test project"""
        response = api_client.delete(
            f"{BASE_URL}/api/website-projects/projects/{TestData.project_id}"
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        print(f"Test project deleted")


class TestCheckPermission:
    """Test permission check endpoint"""
    
    def test_check_edit_permission(self, api_client):
        """Check edit permission for current user"""
        response = api_client.get(
            f"{BASE_URL}/api/website-projects/check-permission"
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "can_edit" in data
        assert "role" in data
        assert data["can_edit"] == True  # Admin should have edit permission
        
        print(f"Permission check: can_edit={data['can_edit']}, role={data['role']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
