"""
Website Projects API Tests
Tests for the website projects management system including:
- Project CRUD operations
- Page task management
- Status updates
- Phase tracking (Wireframe, UI, Content, Dev)
"""
import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "vinoth@drawlead.com"
ADMIN_PASSWORD = "admin123"


class TestAuth:
    """Authentication tests"""
    
    def test_login_admin(self):
        """Test admin login"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "session_token" in data
        assert "user" in data
        assert data["user"]["email"] == ADMIN_EMAIL
        print(f"Admin login successful - user_id: {data['user']['user_id']}")
        return data["session_token"]


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


class TestWebsiteProjectsOptions:
    """Test options endpoint for dropdowns"""
    
    def test_get_options(self, api_client):
        """Test getting dropdown options"""
        response = api_client.get(f"{BASE_URL}/api/website-projects/options")
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify structure
        assert "statuses" in data
        assert "platforms" in data
        assert "website_types" in data
        assert "default_pages" in data
        
        # Verify statuses
        assert "To-Do" in data["statuses"]
        assert "In Progress" in data["statuses"]
        assert "Completed" in data["statuses"]
        
        # Verify default pages
        assert "Home Page" in data["default_pages"]
        assert "About Us" in data["default_pages"]
        assert "Contact Us" in data["default_pages"]
        
        print(f"Options retrieved: {len(data['statuses'])} statuses, {len(data['default_pages'])} default pages")


class TestWebsiteProjectsCRUD:
    """Test Website Projects CRUD operations"""
    
    created_project_id = None
    
    def test_create_project(self, api_client):
        """Test creating a new website project with default pages"""
        project_data = {
            "name": "TEST_Company Website",
            "domain_url": "www.testcompany.com",
            "platform": "Website",
            "website_type": "Business Website",
            "developer": "Test Developer",
            "onboarding_date": "2026-01-15",
            "deadline": "2026-03-15",
            "server_details": "AWS",
            "client_drive_url": "https://drive.google.com/test"
        }
        
        response = api_client.post(
            f"{BASE_URL}/api/website-projects/projects",
            json=project_data
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify response
        assert "project_id" in data
        assert data["name"] == project_data["name"]
        assert data["domain_url"] == project_data["domain_url"]
        assert data["platform"] == project_data["platform"]
        assert data["pages_created"] == 8  # 8 default pages
        
        TestWebsiteProjectsCRUD.created_project_id = data["project_id"]
        print(f"Project created: {data['project_id']} with {data['pages_created']} pages")
    
    def test_get_projects_list(self, api_client):
        """Test getting list of projects"""
        response = api_client.get(f"{BASE_URL}/api/website-projects/projects")
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list)
        assert len(data) >= 1  # At least our created project
        
        # Find our project
        our_project = next((p for p in data if p["project_id"] == TestWebsiteProjectsCRUD.created_project_id), None)
        assert our_project is not None
        
        # Verify project stats are included
        assert "total_pages" in our_project
        assert "completed_pages" in our_project
        assert "progress" in our_project
        
        print(f"Found {len(data)} projects")
    
    def test_get_project_detail(self, api_client):
        """Test getting single project with all tasks"""
        project_id = TestWebsiteProjectsCRUD.created_project_id
        response = api_client.get(f"{BASE_URL}/api/website-projects/projects/{project_id}")
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify project fields
        assert data["project_id"] == project_id
        assert data["name"] == "TEST_Company Website"
        assert "tasks" in data
        assert "stats" in data
        
        # Verify tasks (default pages)
        tasks = data["tasks"]
        assert len(tasks) == 8
        
        # Verify task structure
        task = tasks[0]
        assert "task_id" in task
        assert "page_name" in task
        assert "wireframe_status" in task
        assert "ui_status" in task
        assert "content_status" in task
        assert "dev_status" in task
        assert "overall_status" in task
        
        # Verify stats structure
        stats = data["stats"]
        assert stats["total_pages"] == 8
        assert "wireframe" in stats
        assert "ui" in stats
        assert "content" in stats
        assert "dev" in stats
        
        print(f"Project detail: {len(tasks)} tasks, stats retrieved")
    
    def test_update_project(self, api_client):
        """Test updating project metadata"""
        project_id = TestWebsiteProjectsCRUD.created_project_id
        update_data = {
            "developer": "Updated Developer",
            "server_details": "DigitalOcean"
        }
        
        response = api_client.put(
            f"{BASE_URL}/api/website-projects/projects/{project_id}",
            json=update_data
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data["developer"] == "Updated Developer"
        assert data["server_details"] == "DigitalOcean"
        
        print(f"Project updated successfully")


class TestWebsitePageTasks:
    """Test page task operations"""
    
    created_task_id = None
    
    def test_add_custom_page(self, api_client):
        """Test adding a custom page to project"""
        project_id = TestWebsiteProjectsCRUD.created_project_id
        page_data = {
            "page_name": "TEST_Gallery Page"
        }
        
        response = api_client.post(
            f"{BASE_URL}/api/website-projects/projects/{project_id}/pages",
            json=page_data
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "task_id" in data
        assert data["page_name"] == "TEST_Gallery Page"
        assert data["wireframe_status"] == "To-Do"
        assert data["ui_status"] == "To-Do"
        assert data["content_status"] == "To-Do"
        assert data["dev_status"] == "To-Do"
        assert data["overall_status"] == "To-Do"
        
        TestWebsitePageTasks.created_task_id = data["task_id"]
        print(f"Custom page added: {data['task_id']}")
    
    def test_update_wireframe_status(self, api_client):
        """Test updating wireframe phase status"""
        task_id = TestWebsitePageTasks.created_task_id
        update_data = {"wireframe_status": "In Progress"}
        
        response = api_client.put(
            f"{BASE_URL}/api/website-projects/pages/{task_id}",
            json=update_data
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data["wireframe_status"] == "In Progress"
        assert data["overall_status"] == "In Progress"  # Auto-calculated
        
        print(f"Wireframe status updated to In Progress")
    
    def test_update_ui_status(self, api_client):
        """Test updating UI phase status"""
        task_id = TestWebsitePageTasks.created_task_id
        update_data = {"ui_status": "Client Review"}
        
        response = api_client.put(
            f"{BASE_URL}/api/website-projects/pages/{task_id}",
            json=update_data
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data["ui_status"] == "Client Review"
        assert data["overall_status"] == "Client Review"  # Auto-calculated
        
        print(f"UI status updated to Client Review")
    
    def test_update_content_status(self, api_client):
        """Test updating content phase status"""
        task_id = TestWebsitePageTasks.created_task_id
        update_data = {"content_status": "In Progress"}
        
        response = api_client.put(
            f"{BASE_URL}/api/website-projects/pages/{task_id}",
            json=update_data
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data["content_status"] == "In Progress"
        print(f"Content status updated to In Progress")
    
    def test_update_dev_status(self, api_client):
        """Test updating development phase status"""
        task_id = TestWebsitePageTasks.created_task_id
        update_data = {"dev_status": "To-Do"}
        
        response = api_client.put(
            f"{BASE_URL}/api/website-projects/pages/{task_id}",
            json=update_data
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data["dev_status"] == "To-Do"
        print(f"Dev status updated to To-Do")
    
    def test_update_all_phases_completed(self, api_client):
        """Test that overall status becomes Completed when all phases are Completed"""
        task_id = TestWebsitePageTasks.created_task_id
        update_data = {
            "wireframe_status": "Completed",
            "ui_status": "Completed",
            "content_status": "Completed",
            "dev_status": "Completed"
        }
        
        response = api_client.put(
            f"{BASE_URL}/api/website-projects/pages/{task_id}",
            json=update_data
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data["wireframe_status"] == "Completed"
        assert data["ui_status"] == "Completed"
        assert data["content_status"] == "Completed"
        assert data["dev_status"] == "Completed"
        assert data["overall_status"] == "Completed"  # Auto-calculated
        
        print(f"All phases completed - overall status is Completed")
    
    def test_update_overall_status_directly(self, api_client):
        """Test updating overall status directly"""
        task_id = TestWebsitePageTasks.created_task_id
        update_data = {"overall_status": "On Hold"}
        
        response = api_client.put(
            f"{BASE_URL}/api/website-projects/pages/{task_id}",
            json=update_data
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data["overall_status"] == "On Hold"
        print(f"Overall status updated directly to On Hold")
    
    def test_delete_page(self, api_client):
        """Test deleting a page task"""
        task_id = TestWebsitePageTasks.created_task_id
        
        response = api_client.delete(f"{BASE_URL}/api/website-projects/pages/{task_id}")
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data["message"] == "Task deleted"
        print(f"Page deleted successfully")


class TestWebsiteProjectsDashboard:
    """Test dashboard stats endpoint"""
    
    def test_get_dashboard(self, api_client):
        """Test getting dashboard stats"""
        response = api_client.get(f"{BASE_URL}/api/website-projects/dashboard")
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "total_projects" in data
        assert "active_projects" in data
        assert "by_developer" in data
        assert "by_platform" in data
        assert "recent_projects" in data
        
        print(f"Dashboard: {data['total_projects']} total, {data['active_projects']} active")


class TestWebsiteProjectsCleanup:
    """Cleanup test data"""
    
    def test_delete_project(self, api_client):
        """Test deleting project and all its pages"""
        project_id = TestWebsiteProjectsCRUD.created_project_id
        
        response = api_client.delete(f"{BASE_URL}/api/website-projects/projects/{project_id}")
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data["message"] == "Project deleted"
        print(f"Project and pages deleted successfully")
    
    def test_verify_deletion(self, api_client):
        """Verify project is deleted"""
        project_id = TestWebsiteProjectsCRUD.created_project_id
        
        response = api_client.get(f"{BASE_URL}/api/website-projects/projects/{project_id}")
        assert response.status_code == 404
        print(f"Project confirmed deleted")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
