"""
Website Department in Tasks Module - Backend API Tests
Tests for Website department with special functionality:
- Website department shows as first with dept_type='website'
- Website projects with 8 default pages
- Page status dropdowns for Wireframe, UI Design, Content, Development, Overall
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "vinoth@drawlead.com"
TEST_PASSWORD = "admin123"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("session_token")
    pytest.skip(f"Authentication failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="module")
def headers(auth_token):
    """Headers with auth token"""
    return {
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    }


class TestWebsiteDepartment:
    """Test Website department appears first with dept_type='website'"""
    
    def test_get_departments_returns_website_first(self, headers):
        """GET /api/departments should return Website as first department"""
        response = requests.get(f"{BASE_URL}/api/departments", headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        departments = response.json()
        assert len(departments) > 0, "No departments returned"
        
        # Website should be first
        first_dept = departments[0]
        assert first_dept["name"] == "Website", f"First department should be Website, got {first_dept['name']}"
        assert first_dept.get("dept_type") == "website", f"Website dept_type should be 'website', got {first_dept.get('dept_type')}"
        assert first_dept.get("order") == 0, f"Website order should be 0, got {first_dept.get('order')}"
        print(f"✓ Website department is first with dept_type='website'")
    
    def test_website_department_has_correct_icon(self, headers):
        """Website department should have globe icon"""
        response = requests.get(f"{BASE_URL}/api/departments", headers=headers)
        assert response.status_code == 200
        
        departments = response.json()
        website_dept = next((d for d in departments if d["name"] == "Website"), None)
        assert website_dept is not None, "Website department not found"
        assert website_dept.get("icon") == "🌐", f"Website icon should be 🌐, got {website_dept.get('icon')}"
        print(f"✓ Website department has correct icon: {website_dept.get('icon')}")


class TestWebsiteProjectsList:
    """Test GET /api/departments/website/projects"""
    
    def test_get_website_projects(self, headers):
        """GET /api/departments/website/projects returns list of website projects"""
        response = requests.get(f"{BASE_URL}/api/departments/website/projects", headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        projects = response.json()
        assert isinstance(projects, list), "Response should be a list"
        print(f"✓ GET /api/departments/website/projects returned {len(projects)} projects")
        
        # Check project structure if any exist
        if len(projects) > 0:
            project = projects[0]
            required_fields = ["project_id", "name", "status", "dev_percent", "overall_percent", "total_pages"]
            for field in required_fields:
                assert field in project, f"Project missing field: {field}"
            print(f"✓ Project has all required fields: {required_fields}")
    
    def test_get_website_projects_with_status_filter(self, headers):
        """GET /api/departments/website/projects?status=active filters by status"""
        response = requests.get(f"{BASE_URL}/api/departments/website/projects?status=active", headers=headers)
        assert response.status_code == 200
        
        projects = response.json()
        for project in projects:
            assert project.get("status") == "active", f"Expected status 'active', got {project.get('status')}"
        print(f"✓ Status filter works - {len(projects)} active projects")


class TestCreateWebsiteProject:
    """Test POST /api/departments/website/projects creates project with 8 default pages"""
    
    test_project_id = None
    
    def test_create_website_project(self, headers):
        """POST /api/departments/website/projects creates new project with 8 default pages"""
        project_data = {
            "name": "TEST_Website_Project_" + str(int(time.time())),
            "onboarding_date": "2026-01-15",
            "deadline": "2026-03-15",
            "status": "active",
            "platform": "Website",
            "website_type": "Business Website",
            "domain_url": "https://test-website.com"
        }
        
        response = requests.post(f"{BASE_URL}/api/departments/website/projects", 
                                json=project_data, headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        project = response.json()
        TestCreateWebsiteProject.test_project_id = project.get("project_id")
        
        assert project.get("name") == project_data["name"], "Project name mismatch"
        assert project.get("total_pages") == 8, f"Expected 8 default pages, got {project.get('total_pages')}"
        assert project.get("dev_percent") == 0, "New project should have 0% dev progress"
        assert project.get("overall_percent") == 0, "New project should have 0% overall progress"
        print(f"✓ Created website project with 8 default pages: {project.get('project_id')}")
    
    def test_get_created_project_detail(self, headers):
        """GET /api/departments/website/projects/{project_id} returns project with pages array"""
        if not TestCreateWebsiteProject.test_project_id:
            pytest.skip("No test project created")
        
        response = requests.get(
            f"{BASE_URL}/api/departments/website/projects/{TestCreateWebsiteProject.test_project_id}",
            headers=headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        project = response.json()
        assert "pages" in project, "Project should have 'pages' array"
        assert len(project["pages"]) == 8, f"Expected 8 pages, got {len(project['pages'])}"
        
        # Verify default page names
        expected_pages = [
            "Home Page", "About Us", "Services", "Projects/Portfolio",
            "Contact Us", "Blog", "Privacy Policy", "Terms & Conditions"
        ]
        actual_pages = [p["page_name"] for p in project["pages"]]
        for expected in expected_pages:
            assert expected in actual_pages, f"Missing default page: {expected}"
        
        print(f"✓ Project detail has 8 default pages: {actual_pages}")
    
    def test_default_pages_have_status_fields(self, headers):
        """Default pages should have status fields for Wireframe, UI, Content, Dev, Overall"""
        if not TestCreateWebsiteProject.test_project_id:
            pytest.skip("No test project created")
        
        response = requests.get(
            f"{BASE_URL}/api/departments/website/projects/{TestCreateWebsiteProject.test_project_id}",
            headers=headers
        )
        assert response.status_code == 200
        
        project = response.json()
        page = project["pages"][0]
        
        status_fields = ["wireframe_status", "ui_status", "content_status", "dev_status", "overall_status"]
        for field in status_fields:
            assert field in page, f"Page missing status field: {field}"
            assert page[field] == "To-Do", f"Default status should be 'To-Do', got {page[field]}"
        
        print(f"✓ Pages have all status fields with default 'To-Do': {status_fields}")


class TestUpdateWebsitePage:
    """Test PUT /api/departments/website/pages/{task_id} updates page status"""
    
    def test_update_page_wireframe_status(self, headers):
        """PUT /api/departments/website/pages/{task_id} updates wireframe status"""
        # First get a project with pages
        response = requests.get(f"{BASE_URL}/api/departments/website/projects", headers=headers)
        assert response.status_code == 200
        
        projects = response.json()
        if len(projects) == 0:
            pytest.skip("No website projects available")
        
        # Get project detail to get page task_id
        project_id = projects[0]["project_id"]
        detail_response = requests.get(
            f"{BASE_URL}/api/departments/website/projects/{project_id}",
            headers=headers
        )
        assert detail_response.status_code == 200
        
        project = detail_response.json()
        if len(project.get("pages", [])) == 0:
            pytest.skip("No pages in project")
        
        page = project["pages"][0]
        task_id = page["task_id"]
        
        # Update wireframe status
        update_data = {"wireframe_status": "In Progress"}
        update_response = requests.put(
            f"{BASE_URL}/api/departments/website/pages/{task_id}",
            json=update_data, headers=headers
        )
        assert update_response.status_code == 200, f"Expected 200, got {update_response.status_code}"
        
        updated_page = update_response.json()
        assert updated_page.get("wireframe_status") == "In Progress", "Wireframe status not updated"
        print(f"✓ Updated page wireframe_status to 'In Progress'")
    
    def test_update_page_ui_status(self, headers):
        """Update UI design status"""
        response = requests.get(f"{BASE_URL}/api/departments/website/projects", headers=headers)
        projects = response.json()
        if len(projects) == 0:
            pytest.skip("No website projects available")
        
        project_id = projects[0]["project_id"]
        detail_response = requests.get(
            f"{BASE_URL}/api/departments/website/projects/{project_id}",
            headers=headers
        )
        project = detail_response.json()
        page = project["pages"][0]
        task_id = page["task_id"]
        
        update_data = {"ui_status": "Client Review"}
        update_response = requests.put(
            f"{BASE_URL}/api/departments/website/pages/{task_id}",
            json=update_data, headers=headers
        )
        assert update_response.status_code == 200
        
        updated_page = update_response.json()
        assert updated_page.get("ui_status") == "Client Review"
        print(f"✓ Updated page ui_status to 'Client Review'")
    
    def test_update_page_content_status(self, headers):
        """Update content status"""
        response = requests.get(f"{BASE_URL}/api/departments/website/projects", headers=headers)
        projects = response.json()
        if len(projects) == 0:
            pytest.skip("No website projects available")
        
        project_id = projects[0]["project_id"]
        detail_response = requests.get(
            f"{BASE_URL}/api/departments/website/projects/{project_id}",
            headers=headers
        )
        project = detail_response.json()
        page = project["pages"][0]
        task_id = page["task_id"]
        
        update_data = {"content_status": "Completed"}
        update_response = requests.put(
            f"{BASE_URL}/api/departments/website/pages/{task_id}",
            json=update_data, headers=headers
        )
        assert update_response.status_code == 200
        
        updated_page = update_response.json()
        assert updated_page.get("content_status") == "Completed"
        print(f"✓ Updated page content_status to 'Completed'")
    
    def test_update_page_dev_status(self, headers):
        """Update development status"""
        response = requests.get(f"{BASE_URL}/api/departments/website/projects", headers=headers)
        projects = response.json()
        if len(projects) == 0:
            pytest.skip("No website projects available")
        
        project_id = projects[0]["project_id"]
        detail_response = requests.get(
            f"{BASE_URL}/api/departments/website/projects/{project_id}",
            headers=headers
        )
        project = detail_response.json()
        page = project["pages"][0]
        task_id = page["task_id"]
        
        update_data = {"dev_status": "Completed"}
        update_response = requests.put(
            f"{BASE_URL}/api/departments/website/pages/{task_id}",
            json=update_data, headers=headers
        )
        assert update_response.status_code == 200
        
        updated_page = update_response.json()
        assert updated_page.get("dev_status") == "Completed"
        print(f"✓ Updated page dev_status to 'Completed'")
    
    def test_update_page_overall_status(self, headers):
        """Update overall status"""
        response = requests.get(f"{BASE_URL}/api/departments/website/projects", headers=headers)
        projects = response.json()
        if len(projects) == 0:
            pytest.skip("No website projects available")
        
        project_id = projects[0]["project_id"]
        detail_response = requests.get(
            f"{BASE_URL}/api/departments/website/projects/{project_id}",
            headers=headers
        )
        project = detail_response.json()
        page = project["pages"][0]
        task_id = page["task_id"]
        
        update_data = {"overall_status": "Completed"}
        update_response = requests.put(
            f"{BASE_URL}/api/departments/website/pages/{task_id}",
            json=update_data, headers=headers
        )
        assert update_response.status_code == 200
        
        updated_page = update_response.json()
        assert updated_page.get("overall_status") == "Completed"
        print(f"✓ Updated page overall_status to 'Completed'")


class TestDeleteWebsitePage:
    """Test DELETE /api/departments/website/pages/{task_id}"""
    
    def test_add_and_delete_page(self, headers):
        """Add a page then delete it"""
        # Get a project
        response = requests.get(f"{BASE_URL}/api/departments/website/projects", headers=headers)
        projects = response.json()
        if len(projects) == 0:
            pytest.skip("No website projects available")
        
        project_id = projects[0]["project_id"]
        
        # Add a new page
        add_response = requests.post(
            f"{BASE_URL}/api/departments/website/projects/{project_id}/pages",
            json={"page_name": "TEST_Page_To_Delete"},
            headers=headers
        )
        assert add_response.status_code == 200, f"Failed to add page: {add_response.text}"
        
        new_page = add_response.json()
        task_id = new_page["task_id"]
        print(f"✓ Added test page: {task_id}")
        
        # Delete the page
        delete_response = requests.delete(
            f"{BASE_URL}/api/departments/website/pages/{task_id}",
            headers=headers
        )
        assert delete_response.status_code == 200, f"Failed to delete page: {delete_response.text}"
        print(f"✓ Deleted test page: {task_id}")
        
        # Verify page is deleted
        detail_response = requests.get(
            f"{BASE_URL}/api/departments/website/projects/{project_id}",
            headers=headers
        )
        project = detail_response.json()
        page_ids = [p["task_id"] for p in project.get("pages", [])]
        assert task_id not in page_ids, "Page should be deleted"
        print(f"✓ Verified page is deleted from project")


class TestWebsiteProjectProgress:
    """Test progress calculation (DEV % and OVERALL %)"""
    
    def test_progress_calculation(self, headers):
        """Progress percentages should update based on completed pages"""
        response = requests.get(f"{BASE_URL}/api/departments/website/projects", headers=headers)
        projects = response.json()
        if len(projects) == 0:
            pytest.skip("No website projects available")
        
        project = projects[0]
        
        # Verify progress fields exist
        assert "dev_percent" in project, "Missing dev_percent field"
        assert "overall_percent" in project, "Missing overall_percent field"
        assert "total_pages" in project, "Missing total_pages field"
        
        # Progress should be between 0 and 100
        assert 0 <= project["dev_percent"] <= 100, f"Invalid dev_percent: {project['dev_percent']}"
        assert 0 <= project["overall_percent"] <= 100, f"Invalid overall_percent: {project['overall_percent']}"
        
        print(f"✓ Project progress: DEV {project['dev_percent']}%, OVERALL {project['overall_percent']}%")


class TestWebsiteDevelopers:
    """Test GET /api/departments/website/developers"""
    
    def test_get_developers(self, headers):
        """GET /api/departments/website/developers returns list of users"""
        response = requests.get(f"{BASE_URL}/api/departments/website/developers", headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        developers = response.json()
        assert isinstance(developers, list), "Response should be a list"
        
        if len(developers) > 0:
            dev = developers[0]
            assert "user_id" in dev, "Developer missing user_id"
            assert "name" in dev, "Developer missing name"
        
        print(f"✓ GET /api/departments/website/developers returned {len(developers)} users")


class TestCleanup:
    """Cleanup test data"""
    
    def test_cleanup_test_project(self, headers):
        """Delete test project created during tests"""
        if TestCreateWebsiteProject.test_project_id:
            response = requests.delete(
                f"{BASE_URL}/api/departments/website/projects/{TestCreateWebsiteProject.test_project_id}",
                headers=headers
            )
            assert response.status_code == 200, f"Failed to delete test project: {response.text}"
            print(f"✓ Cleaned up test project: {TestCreateWebsiteProject.test_project_id}")
        else:
            print("✓ No test project to clean up")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
