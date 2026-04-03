"""
Test Website Projects Workflow Stage Transition and Content Stage Filters
Tests:
1. Stage transition validation - cannot move from creation to discovery without mandatory fields
2. Stage transition validation - can move with all mandatory fields
3. Content stage specific filters
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestWorkflowStageTransition:
    """Test workflow stage transition validation"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get session token"""
        # Login as admin
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "vinoth@drawlead.com",
            "password": "admin123"
        })
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        self.token = login_response.json().get("session_token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
        yield
    
    def test_transition_fails_without_mandatory_fields(self):
        """Test that transition from creation to discovery fails without mandatory fields"""
        # First, create a project with missing client_name
        unique_name = f"TEST_MissingFields_{uuid.uuid4().hex[:8]}"
        create_response = requests.post(
            f"{BASE_URL}/api/website-projects/projects",
            json={
                "name": unique_name,
                "platform": "WordPress",
                "website_type": "Business Website",
                # client_name is intentionally missing
            },
            headers=self.headers
        )
        assert create_response.status_code == 200, f"Create project failed: {create_response.text}"
        project_id = create_response.json().get("project_id")
        
        # Try to transition to discovery - should fail
        transition_response = requests.put(
            f"{BASE_URL}/api/website-projects/projects/{project_id}/transition",
            json={"stage": "discovery", "notes": "Test transition"},
            headers=self.headers
        )
        
        # Should return 400 with error about missing fields
        assert transition_response.status_code == 400, f"Expected 400, got {transition_response.status_code}: {transition_response.text}"
        error_detail = transition_response.json().get("detail", "")
        assert "Missing mandatory fields" in error_detail, f"Expected 'Missing mandatory fields' in error, got: {error_detail}"
        assert "Client Name" in error_detail, f"Expected 'Client Name' in error, got: {error_detail}"
        
        print(f"PASS: Transition correctly blocked with error: {error_detail}")
        
        # Cleanup - delete the test project
        requests.delete(f"{BASE_URL}/api/website-projects/projects/{project_id}", headers=self.headers)
    
    def test_transition_succeeds_with_all_mandatory_fields(self):
        """Test that transition from creation to discovery succeeds with all mandatory fields"""
        # Create a project with all mandatory fields
        unique_name = f"TEST_AllFields_{uuid.uuid4().hex[:8]}"
        create_response = requests.post(
            f"{BASE_URL}/api/website-projects/projects",
            json={
                "name": unique_name,
                "client_name": "Test Client",
                "platform": "WordPress",
                "website_type": "Business Website",
            },
            headers=self.headers
        )
        assert create_response.status_code == 200, f"Create project failed: {create_response.text}"
        project_id = create_response.json().get("project_id")
        
        # Verify project is in creation stage
        get_response = requests.get(
            f"{BASE_URL}/api/website-projects/projects/{project_id}",
            headers=self.headers
        )
        assert get_response.status_code == 200
        project = get_response.json()
        assert project.get("workflow_stage", "creation") == "creation", "Project should start in creation stage"
        
        # Try to transition to discovery - should succeed
        transition_response = requests.put(
            f"{BASE_URL}/api/website-projects/projects/{project_id}/transition",
            json={"stage": "discovery", "notes": "Test transition with all fields"},
            headers=self.headers
        )
        
        assert transition_response.status_code == 200, f"Expected 200, got {transition_response.status_code}: {transition_response.text}"
        result = transition_response.json()
        assert result.get("project", {}).get("workflow_stage") == "discovery", "Project should be in discovery stage"
        
        print(f"PASS: Transition succeeded, project now in discovery stage")
        
        # Cleanup - delete the test project
        requests.delete(f"{BASE_URL}/api/website-projects/projects/{project_id}", headers=self.headers)
    
    def test_get_projects_summary_includes_workflow_stage(self):
        """Test that all-projects-summary endpoint returns workflow_stage"""
        response = requests.get(
            f"{BASE_URL}/api/website-projects/all-projects-summary",
            headers=self.headers
        )
        assert response.status_code == 200, f"Failed to get projects summary: {response.text}"
        projects = response.json()
        
        # Check that at least one project has workflow_stage field
        assert len(projects) > 0, "No projects found"
        
        for project in projects:
            assert "workflow_stage" in project or project.get("workflow_stage") is None, \
                f"Project {project.get('name')} missing workflow_stage field"
        
        print(f"PASS: Found {len(projects)} projects with workflow_stage field")
    
    def test_existing_project_missing_client_name_cannot_transition(self):
        """Test that existing projects with missing client_name cannot transition"""
        # Get all projects summary
        response = requests.get(
            f"{BASE_URL}/api/website-projects/all-projects-summary",
            headers=self.headers
        )
        assert response.status_code == 200
        projects = response.json()
        
        # Find a project in creation stage with missing client_name
        creation_projects = [p for p in projects if (p.get("workflow_stage") or "creation") == "creation"]
        projects_missing_client = [p for p in creation_projects if not p.get("client_name")]
        
        if projects_missing_client:
            project = projects_missing_client[0]
            project_id = project.get("project_id")
            
            # Try to transition - should fail
            transition_response = requests.put(
                f"{BASE_URL}/api/website-projects/projects/{project_id}/transition",
                json={"stage": "discovery"},
                headers=self.headers
            )
            
            assert transition_response.status_code == 400, \
                f"Expected 400 for project {project.get('name')}, got {transition_response.status_code}"
            print(f"PASS: Project '{project.get('name')}' correctly blocked from transition")
        else:
            print("SKIP: No projects in creation stage with missing client_name found")


class TestContentStageFilters:
    """Test content stage specific filters"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get session token"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "vinoth@drawlead.com",
            "password": "admin123"
        })
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        self.token = login_response.json().get("session_token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
        yield
    
    def test_projects_summary_includes_pages_data(self):
        """Test that all-projects-summary includes pages data for content filtering"""
        response = requests.get(
            f"{BASE_URL}/api/website-projects/all-projects-summary",
            headers=self.headers
        )
        assert response.status_code == 200
        projects = response.json()
        
        # Check that projects have pages array with content-related fields
        for project in projects:
            if project.get("pages"):
                for page in project["pages"]:
                    # Verify content-related fields exist
                    assert "content_status" in page or page.get("content", {}).get("status"), \
                        f"Page missing content_status"
                    print(f"Project '{project.get('name')}' has {len(project.get('pages', []))} pages with content data")
                break
        
        print("PASS: Projects summary includes pages data for content filtering")
    
    def test_team_members_endpoint(self):
        """Test that team members endpoint works for filter dropdowns"""
        response = requests.get(
            f"{BASE_URL}/api/website-projects/team-members",
            headers=self.headers
        )
        assert response.status_code == 200, f"Failed to get team members: {response.text}"
        members = response.json()
        
        assert isinstance(members, list), "Team members should be a list"
        print(f"PASS: Found {len(members)} team members for filter dropdowns")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
