"""
Website Projects Redesign Tests
Tests for the redesigned Website Project Detail View with:
- Project header with name, status, Docs/Drive/Edit buttons, progress bar
- Project details info row (Domain, Developer, Platform, Type, Client, Location)
- Pages/Tasks tabs
- Enhanced pages table with per-column controls
- CRUD operations for website projects and pages
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestWebsiteProjectsRedesign:
    """Tests for Website Projects CRUD and redesigned features"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with authentication"""
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
            self.authenticated = True
        else:
            self.authenticated = False
            pytest.skip("Authentication failed - skipping tests")
        
        yield
        
        # Cleanup: Delete test projects created during tests
        if hasattr(self, 'test_project_ids'):
            for project_id in self.test_project_ids:
                try:
                    self.session.delete(f"{BASE_URL}/api/departments/website/projects/{project_id}")
                except:
                    pass
    
    def test_get_website_projects_list(self):
        """Test GET /api/departments/website/projects - List all website projects"""
        response = self.session.get(f"{BASE_URL}/api/departments/website/projects")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        # Check project structure if projects exist
        if len(data) > 0:
            project = data[0]
            assert "project_id" in project, "Project should have project_id"
            assert "name" in project, "Project should have name"
            assert "status" in project, "Project should have status"
            assert "total_pages" in project, "Project should have total_pages"
            assert "dev_percent" in project, "Project should have dev_percent"
            assert "overall_percent" in project, "Project should have overall_percent"
            print(f"Found {len(data)} website projects")
    
    def test_get_website_projects_with_filters(self):
        """Test GET /api/departments/website/projects with status and developer filters"""
        # Test status filter
        response = self.session.get(f"{BASE_URL}/api/departments/website/projects?status=active")
        assert response.status_code == 200
        
        # Test developer filter
        response = self.session.get(f"{BASE_URL}/api/departments/website/projects?developer=all")
        assert response.status_code == 200
        print("Filters working correctly")
    
    def test_create_website_project(self):
        """Test POST /api/departments/website/projects - Create new project with all fields"""
        if not hasattr(self, 'test_project_ids'):
            self.test_project_ids = []
        
        unique_id = uuid.uuid4().hex[:8]
        project_data = {
            "name": f"TEST_Project_{unique_id}",
            "client_name": "Test Client Corp",
            "location": "Chennai, India",
            "website_type": "Business Website",
            "status": "active",
            "onboarding_date": "2026-01-15",
            "deadline": "2026-03-15",
            "developer": "",  # Will be set later
            "domain_url": "https://testproject.com",
            "documents_url": "https://docs.google.com/test",
            "client_drive_url": "https://drive.google.com/test"
        }
        
        response = self.session.post(f"{BASE_URL}/api/departments/website/projects", json=project_data)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["name"] == project_data["name"], "Project name should match"
        assert data["client_name"] == project_data["client_name"], "Client name should match"
        assert data["location"] == project_data["location"], "Location should match"
        assert data["website_type"] == project_data["website_type"], "Website type should match"
        assert data["status"] == project_data["status"], "Status should match"
        assert data["domain_url"] == project_data["domain_url"], "Domain URL should match"
        assert data["documents_url"] == project_data["documents_url"], "Documents URL should match"
        assert data["client_drive_url"] == project_data["client_drive_url"], "Drive URL should match"
        assert "project_id" in data, "Should return project_id"
        assert data["total_pages"] == 8, "Should create 8 default pages"
        
        self.test_project_ids.append(data["project_id"])
        print(f"Created project: {data['project_id']} with {data['total_pages']} default pages")
        
        return data["project_id"]
    
    def test_get_website_project_detail(self):
        """Test GET /api/departments/website/projects/{project_id} - Get project with pages"""
        # First create a project
        project_id = self.test_create_website_project()
        
        response = self.session.get(f"{BASE_URL}/api/departments/website/projects/{project_id}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data["project_id"] == project_id
        assert "pages" in data, "Should include pages array"
        assert len(data["pages"]) == 8, "Should have 8 default pages"
        
        # Check page structure with per-column fields
        page = data["pages"][0]
        required_fields = [
            "task_id", "page_name", "sno",
            # Wireframe column
            "wireframe_status", "wireframe_assignee", "wireframe_due", "wireframe_url",
            # UI Design column
            "ui_status", "ui_assignee", "ui_due", "ui_url",
            # Content column
            "content_status", "content_assignee", "content_due", "content_url",
            # Development column
            "dev_status", "dev_assignee", "dev_due", "dev_url",
            # Overall
            "overall_status", "overall_url"
        ]
        
        for field in required_fields:
            assert field in page, f"Page should have {field} field"
        
        print(f"Project detail has {len(data['pages'])} pages with all per-column fields")
    
    def test_update_website_project(self):
        """Test PUT /api/departments/website/projects/{project_id} - Update project"""
        # First create a project
        project_id = self.test_create_website_project()
        
        update_data = {
            "name": "TEST_Updated Project Name",
            "client_name": "Updated Client",
            "location": "Mumbai, India",
            "status": "on-hold",
            "deadline": "2026-04-15"
        }
        
        response = self.session.put(f"{BASE_URL}/api/departments/website/projects/{project_id}", json=update_data)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data["name"] == update_data["name"], "Name should be updated"
        assert data["client_name"] == update_data["client_name"], "Client name should be updated"
        assert data["location"] == update_data["location"], "Location should be updated"
        assert data["status"] == update_data["status"], "Status should be updated"
        
        # Verify persistence with GET
        get_response = self.session.get(f"{BASE_URL}/api/departments/website/projects/{project_id}")
        assert get_response.status_code == 200
        get_data = get_response.json()
        assert get_data["name"] == update_data["name"], "Update should persist"
        
        print(f"Project {project_id} updated successfully")
    
    def test_delete_website_project(self):
        """Test DELETE /api/departments/website/projects/{project_id}"""
        # First create a project
        project_id = self.test_create_website_project()
        
        response = self.session.delete(f"{BASE_URL}/api/departments/website/projects/{project_id}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        # Verify deletion
        get_response = self.session.get(f"{BASE_URL}/api/departments/website/projects/{project_id}")
        assert get_response.status_code == 404, "Deleted project should return 404"
        
        # Remove from cleanup list since already deleted
        if project_id in self.test_project_ids:
            self.test_project_ids.remove(project_id)
        
        print(f"Project {project_id} deleted successfully")


class TestWebsitePages:
    """Tests for Website Page CRUD operations"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "vinoth@drawlead.com",
            "password": "admin123"
        })
        
        if login_response.status_code == 200:
            token = login_response.json().get("session_token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
        else:
            pytest.skip("Authentication failed")
        
        # Create a test project for page tests
        unique_id = uuid.uuid4().hex[:8]
        project_response = self.session.post(f"{BASE_URL}/api/departments/website/projects", json={
            "name": f"TEST_PageTest_{unique_id}",
            "status": "active"
        })
        
        if project_response.status_code == 200:
            self.test_project_id = project_response.json()["project_id"]
        else:
            pytest.skip("Failed to create test project")
        
        yield
        
        # Cleanup
        try:
            self.session.delete(f"{BASE_URL}/api/departments/website/projects/{self.test_project_id}")
        except:
            pass
    
    def test_add_website_page(self):
        """Test POST /api/departments/website/projects/{project_id}/pages - Add new page"""
        page_data = {
            "page_name": "TEST_Custom Page",
            "wireframe_assignee": None,
            "ui_assignee": None,
            "content_assignee": None,
            "dev_assignee": None,
            "notes": "Test page notes"
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/departments/website/projects/{self.test_project_id}/pages",
            json=page_data
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["page_name"] == page_data["page_name"], "Page name should match"
        assert "task_id" in data, "Should return task_id"
        assert data["wireframe_status"] == "To-Do", "Default wireframe status should be To-Do"
        assert data["ui_status"] == "To-Do", "Default UI status should be To-Do"
        assert data["content_status"] == "To-Do", "Default content status should be To-Do"
        assert data["dev_status"] == "To-Do", "Default dev status should be To-Do"
        assert data["overall_status"] == "To-Do", "Default overall status should be To-Do"
        
        print(f"Added page: {data['task_id']}")
        return data["task_id"]
    
    def test_update_website_page_status(self):
        """Test PUT /api/departments/website/pages/{task_id} - Update page status"""
        # Get existing pages
        project_response = self.session.get(f"{BASE_URL}/api/departments/website/projects/{self.test_project_id}")
        pages = project_response.json()["pages"]
        task_id = pages[0]["task_id"]
        
        # Update wireframe status
        update_data = {"wireframe_status": "In Progress"}
        response = self.session.put(f"{BASE_URL}/api/departments/website/pages/{task_id}", json=update_data)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data["wireframe_status"] == "In Progress", "Wireframe status should be updated"
        
        print(f"Updated page {task_id} wireframe status to 'In Progress'")
    
    def test_update_website_page_per_column_assignee(self):
        """Test updating per-column assignees (wireframe_assignee, ui_assignee, etc.)"""
        # Get existing pages
        project_response = self.session.get(f"{BASE_URL}/api/departments/website/projects/{self.test_project_id}")
        pages = project_response.json()["pages"]
        task_id = pages[0]["task_id"]
        
        # Get a user to assign
        users_response = self.session.get(f"{BASE_URL}/api/users/basic")
        if users_response.status_code == 200 and len(users_response.json()) > 0:
            user_id = users_response.json()[0]["user_id"]
            
            # Update wireframe assignee
            update_data = {"wireframe_assignee": user_id}
            response = self.session.put(f"{BASE_URL}/api/departments/website/pages/{task_id}", json=update_data)
            
            assert response.status_code == 200
            data = response.json()
            assert data["wireframe_assignee"] == user_id, "Wireframe assignee should be updated"
            
            # Update UI assignee
            update_data = {"ui_assignee": user_id}
            response = self.session.put(f"{BASE_URL}/api/departments/website/pages/{task_id}", json=update_data)
            
            assert response.status_code == 200
            data = response.json()
            assert data["ui_assignee"] == user_id, "UI assignee should be updated"
            
            print(f"Updated page {task_id} with per-column assignees")
        else:
            pytest.skip("No users available for assignee test")
    
    def test_update_website_page_per_column_due_dates(self):
        """Test updating per-column due dates"""
        # Get existing pages
        project_response = self.session.get(f"{BASE_URL}/api/departments/website/projects/{self.test_project_id}")
        pages = project_response.json()["pages"]
        task_id = pages[0]["task_id"]
        
        # Update all column due dates
        update_data = {
            "wireframe_due": "2026-01-20",
            "ui_due": "2026-01-25",
            "content_due": "2026-01-30",
            "dev_due": "2026-02-05"
        }
        
        response = self.session.put(f"{BASE_URL}/api/departments/website/pages/{task_id}", json=update_data)
        
        assert response.status_code == 200
        data = response.json()
        assert data["wireframe_due"] == "2026-01-20", "Wireframe due should be updated"
        assert data["ui_due"] == "2026-01-25", "UI due should be updated"
        assert data["content_due"] == "2026-01-30", "Content due should be updated"
        assert data["dev_due"] == "2026-02-05", "Dev due should be updated"
        
        print(f"Updated page {task_id} with per-column due dates")
    
    def test_update_website_page_per_column_urls(self):
        """Test updating per-column URLs"""
        # Get existing pages
        project_response = self.session.get(f"{BASE_URL}/api/departments/website/projects/{self.test_project_id}")
        pages = project_response.json()["pages"]
        task_id = pages[0]["task_id"]
        
        # Update all column URLs
        update_data = {
            "wireframe_url": "https://figma.com/wireframe",
            "ui_url": "https://figma.com/ui-design",
            "content_url": "https://docs.google.com/content",
            "dev_url": "https://staging.example.com",
            "overall_url": "https://live.example.com"
        }
        
        response = self.session.put(f"{BASE_URL}/api/departments/website/pages/{task_id}", json=update_data)
        
        assert response.status_code == 200
        data = response.json()
        assert data["wireframe_url"] == update_data["wireframe_url"], "Wireframe URL should be updated"
        assert data["ui_url"] == update_data["ui_url"], "UI URL should be updated"
        assert data["content_url"] == update_data["content_url"], "Content URL should be updated"
        assert data["dev_url"] == update_data["dev_url"], "Dev URL should be updated"
        assert data["overall_url"] == update_data["overall_url"], "Overall URL should be updated"
        
        print(f"Updated page {task_id} with per-column URLs")
    
    def test_update_website_page_all_status_options(self):
        """Test all status options: To-Do, In Progress, Client Review, Client Approved, Completed, On Hold"""
        # Get existing pages
        project_response = self.session.get(f"{BASE_URL}/api/departments/website/projects/{self.test_project_id}")
        pages = project_response.json()["pages"]
        task_id = pages[0]["task_id"]
        
        status_options = ["To-Do", "In Progress", "Client Review", "Client Approved", "Completed", "On Hold"]
        
        for status in status_options:
            update_data = {"wireframe_status": status}
            response = self.session.put(f"{BASE_URL}/api/departments/website/pages/{task_id}", json=update_data)
            
            assert response.status_code == 200, f"Failed to set status to {status}"
            data = response.json()
            assert data["wireframe_status"] == status, f"Status should be {status}"
        
        print(f"All 6 status options work correctly")
    
    def test_delete_website_page(self):
        """Test DELETE /api/departments/website/pages/{task_id}"""
        # Add a page first
        task_id = self.test_add_website_page()
        
        response = self.session.delete(f"{BASE_URL}/api/departments/website/pages/{task_id}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        # Verify deletion by checking project pages
        project_response = self.session.get(f"{BASE_URL}/api/departments/website/projects/{self.test_project_id}")
        pages = project_response.json()["pages"]
        page_ids = [p["task_id"] for p in pages]
        assert task_id not in page_ids, "Deleted page should not be in pages list"
        
        print(f"Page {task_id} deleted successfully")


class TestWebsiteDevelopers:
    """Tests for Website Developers endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "vinoth@drawlead.com",
            "password": "admin123"
        })
        
        if login_response.status_code == 200:
            token = login_response.json().get("session_token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
        else:
            pytest.skip("Authentication failed")
    
    def test_get_website_developers(self):
        """Test GET /api/departments/website/developers - Get users for assignment"""
        response = self.session.get(f"{BASE_URL}/api/departments/website/developers")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        if len(data) > 0:
            user = data[0]
            assert "user_id" in user, "User should have user_id"
            assert "name" in user, "User should have name"
            print(f"Found {len(data)} users available for assignment")


class TestProgressCalculation:
    """Tests for progress bar calculation"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "vinoth@drawlead.com",
            "password": "admin123"
        })
        
        if login_response.status_code == 200:
            token = login_response.json().get("session_token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
        else:
            pytest.skip("Authentication failed")
        
        # Create a test project
        unique_id = uuid.uuid4().hex[:8]
        project_response = self.session.post(f"{BASE_URL}/api/departments/website/projects", json={
            "name": f"TEST_Progress_{unique_id}",
            "status": "active"
        })
        
        if project_response.status_code == 200:
            self.test_project_id = project_response.json()["project_id"]
        else:
            pytest.skip("Failed to create test project")
        
        yield
        
        # Cleanup
        try:
            self.session.delete(f"{BASE_URL}/api/departments/website/projects/{self.test_project_id}")
        except:
            pass
    
    def test_progress_calculation(self):
        """Test that progress bar calculates correctly based on completed pages"""
        # Get project with pages
        response = self.session.get(f"{BASE_URL}/api/departments/website/projects/{self.test_project_id}")
        data = response.json()
        
        # Initially all pages should be To-Do, so progress should be 0
        assert data["overall_percent"] == 0, "Initial progress should be 0%"
        
        # Mark 2 pages as Completed
        pages = data["pages"][:2]
        for page in pages:
            self.session.put(f"{BASE_URL}/api/departments/website/pages/{page['task_id']}", json={
                "overall_status": "Completed"
            })
        
        # Check progress again
        response = self.session.get(f"{BASE_URL}/api/departments/website/projects/{self.test_project_id}")
        data = response.json()
        
        # 2 out of 8 pages completed = 25%
        assert data["overall_percent"] == 25, f"Progress should be 25%, got {data['overall_percent']}%"
        
        print(f"Progress calculation working: {data['overall_percent']}%")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
