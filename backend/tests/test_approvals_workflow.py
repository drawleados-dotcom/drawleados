"""
Test Approvals Workflow - LinkApprovalModal and ApprovalsPage
Tests the centralized approvals workflow for Website Development module
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestApprovalsWorkflow:
    """Test approvals workflow including LinkApprovalModal and ApprovalsPage"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get session token
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "vinoth@drawlead.com",
            "password": "admin123"
        })
        
        if login_response.status_code == 200:
            data = login_response.json()
            self.token = data.get("session_token") or data.get("token")
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
            print(f"Login successful, token obtained")
        else:
            pytest.skip(f"Login failed: {login_response.status_code}")
    
    # ==================== APPROVALS PAGE TESTS ====================
    
    def test_get_pending_approvals(self):
        """Test GET /api/approvals/pending - Fetch pending approvals"""
        response = self.session.get(f"{BASE_URL}/api/approvals/pending")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"Found {len(data)} pending approvals")
        
        # Check structure of approval items
        if len(data) > 0:
            approval = data[0]
            assert "approval_id" in approval, "Approval should have approval_id"
            assert "title" in approval, "Approval should have title"
            assert "department" in approval, "Approval should have department"
            print(f"First approval: {approval.get('title')} - {approval.get('department')}")
    
    def test_get_pending_approvals_with_department_filter(self):
        """Test GET /api/approvals/pending with department filter"""
        response = self.session.get(f"{BASE_URL}/api/approvals/pending", params={
            "department": "website"
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"Found {len(data)} website approvals")
    
    def test_get_pending_approvals_with_date_filter(self):
        """Test GET /api/approvals/pending with date filter"""
        today = time.strftime("%Y-%m-%d")
        response = self.session.get(f"{BASE_URL}/api/approvals/pending", params={
            "date": today
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"Found {len(data)} approvals for {today}")
    
    # ==================== WEBSITE PROJECTS TESTS ====================
    
    def test_get_website_projects(self):
        """Test GET /api/website-projects/projects - List all projects"""
        response = self.session.get(f"{BASE_URL}/api/website-projects/projects")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"Found {len(data)} website projects")
        
        if len(data) > 0:
            project = data[0]
            assert "project_id" in project, "Project should have project_id"
            assert "name" in project, "Project should have name"
            self.project_id = project["project_id"]
            print(f"First project: {project.get('name')} ({project.get('project_id')})")
    
    def test_get_project_stage_tasks(self):
        """Test GET /api/website-projects/projects/{project_id}/stage-tasks"""
        # First get a project
        projects_response = self.session.get(f"{BASE_URL}/api/website-projects/projects")
        if projects_response.status_code != 200 or len(projects_response.json()) == 0:
            pytest.skip("No projects available")
        
        project_id = projects_response.json()[0]["project_id"]
        
        response = self.session.get(f"{BASE_URL}/api/website-projects/projects/{project_id}/stage-tasks")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, dict), "Response should be a dict with stages"
        
        # Check for expected stages
        expected_stages = ["content", "wireframe", "ui", "dev", "test"]
        for stage in expected_stages:
            assert stage in data, f"Stage '{stage}' should be in response"
        
        print(f"Stage tasks retrieved: {list(data.keys())}")
    
    # ==================== TASK SUBMISSION TESTS ====================
    
    def test_submit_task_for_approval_with_operations_approver(self):
        """Test PUT /api/website-projects/stage-tasks/{task_id}/submit with Operations approver"""
        # Get a project and its stage tasks
        projects_response = self.session.get(f"{BASE_URL}/api/website-projects/projects")
        if projects_response.status_code != 200 or len(projects_response.json()) == 0:
            pytest.skip("No projects available")
        
        project_id = projects_response.json()[0]["project_id"]
        
        # Get stage tasks
        tasks_response = self.session.get(f"{BASE_URL}/api/website-projects/projects/{project_id}/stage-tasks")
        if tasks_response.status_code != 200:
            pytest.skip("Could not get stage tasks")
        
        tasks = tasks_response.json()
        
        # Find a pending task to submit
        task_id = None
        for stage, stage_tasks in tasks.items():
            for task in stage_tasks:
                if task.get("status") == "pending":
                    task_id = task["task_id"]
                    break
            if task_id:
                break
        
        if not task_id:
            print("No pending tasks found, skipping submission test")
            return
        
        # Submit task with Operations approver
        response = self.session.put(f"{BASE_URL}/api/website-projects/stage-tasks/{task_id}/submit", json={
            "stage": "content",
            "link": "https://docs.google.com/document/d/test-operations-link",
            "assignee_type": "operations"
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Submission should be successful"
        print(f"Task submitted with Operations approver: {data}")
    
    def test_submit_task_for_approval_with_pm_approver(self):
        """Test PUT /api/website-projects/stage-tasks/{task_id}/submit with PM approver"""
        # Get a project and its stage tasks
        projects_response = self.session.get(f"{BASE_URL}/api/website-projects/projects")
        if projects_response.status_code != 200 or len(projects_response.json()) == 0:
            pytest.skip("No projects available")
        
        project_id = projects_response.json()[0]["project_id"]
        
        # Get stage tasks
        tasks_response = self.session.get(f"{BASE_URL}/api/website-projects/projects/{project_id}/stage-tasks")
        if tasks_response.status_code != 200:
            pytest.skip("Could not get stage tasks")
        
        tasks = tasks_response.json()
        
        # Find a pending task to submit
        task_id = None
        for stage, stage_tasks in tasks.items():
            for task in stage_tasks:
                if task.get("status") == "pending":
                    task_id = task["task_id"]
                    break
            if task_id:
                break
        
        if not task_id:
            print("No pending tasks found, skipping submission test")
            return
        
        # Submit task with PM approver
        response = self.session.put(f"{BASE_URL}/api/website-projects/stage-tasks/{task_id}/submit", json={
            "stage": "content",
            "link": "https://docs.google.com/document/d/test-pm-link",
            "assignee_type": "project_manager"
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Submission should be successful"
        print(f"Task submitted with PM approver: {data}")
    
    def test_submit_task_for_approval_with_ceo_approver(self):
        """Test PUT /api/website-projects/stage-tasks/{task_id}/submit with CEO approver"""
        # Get a project and its stage tasks
        projects_response = self.session.get(f"{BASE_URL}/api/website-projects/projects")
        if projects_response.status_code != 200 or len(projects_response.json()) == 0:
            pytest.skip("No projects available")
        
        project_id = projects_response.json()[0]["project_id"]
        
        # Get stage tasks
        tasks_response = self.session.get(f"{BASE_URL}/api/website-projects/projects/{project_id}/stage-tasks")
        if tasks_response.status_code != 200:
            pytest.skip("Could not get stage tasks")
        
        tasks = tasks_response.json()
        
        # Find a pending task to submit
        task_id = None
        for stage, stage_tasks in tasks.items():
            for task in stage_tasks:
                if task.get("status") == "pending":
                    task_id = task["task_id"]
                    break
            if task_id:
                break
        
        if not task_id:
            print("No pending tasks found, skipping submission test")
            return
        
        # Submit task with CEO approver
        response = self.session.put(f"{BASE_URL}/api/website-projects/stage-tasks/{task_id}/submit", json={
            "stage": "content",
            "link": "https://docs.google.com/document/d/test-ceo-link",
            "assignee_type": "ceo"
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Submission should be successful"
        print(f"Task submitted with CEO approver: {data}")
    
    # ==================== APPROVAL/REJECTION TESTS ====================
    
    def test_approve_task_from_approvals_page(self):
        """Test PUT /api/approvals/{approval_id}/approve"""
        # Get pending approvals
        approvals_response = self.session.get(f"{BASE_URL}/api/approvals/pending")
        if approvals_response.status_code != 200 or len(approvals_response.json()) == 0:
            print("No pending approvals to test")
            return
        
        approval = approvals_response.json()[0]
        approval_id = approval["approval_id"]
        
        # Approve the task
        response = self.session.put(f"{BASE_URL}/api/approvals/{approval_id}/approve")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Approval should be successful"
        print(f"Task approved: {data}")
    
    def test_reject_task_with_corrections(self):
        """Test PUT /api/approvals/{approval_id}/reject with remarks"""
        # Get pending approvals
        approvals_response = self.session.get(f"{BASE_URL}/api/approvals/pending")
        if approvals_response.status_code != 200 or len(approvals_response.json()) == 0:
            print("No pending approvals to test")
            return
        
        approval = approvals_response.json()[0]
        approval_id = approval["approval_id"]
        
        # Reject with corrections
        response = self.session.put(f"{BASE_URL}/api/approvals/{approval_id}/reject", json={
            "remarks": "Please update the content formatting and add more details"
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Rejection should be successful"
        print(f"Task sent back for corrections: {data}")
    
    # ==================== APPROVER BADGE VERIFICATION ====================
    
    def test_approvals_contain_assignee_type(self):
        """Verify that approvals contain assignee_type field for badge display"""
        response = self.session.get(f"{BASE_URL}/api/approvals/pending")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        
        # Check if any approval has assignee_type
        has_assignee_type = False
        for approval in data:
            if "assignee_type" in approval:
                has_assignee_type = True
                assignee_type = approval["assignee_type"]
                assert assignee_type in ["operations", "project_manager", "ceo"], \
                    f"Invalid assignee_type: {assignee_type}"
                print(f"Approval '{approval.get('title')}' has assignee_type: {assignee_type}")
        
        if not has_assignee_type and len(data) > 0:
            print("Warning: No approvals have assignee_type field")
    
    # ==================== SEQUENTIAL WORKFLOW TESTS ====================
    
    def test_stage_tasks_have_correct_status(self):
        """Verify stage tasks have correct status (locked/pending/approved)"""
        # Get a project
        projects_response = self.session.get(f"{BASE_URL}/api/website-projects/projects")
        if projects_response.status_code != 200 or len(projects_response.json()) == 0:
            pytest.skip("No projects available")
        
        project_id = projects_response.json()[0]["project_id"]
        
        # Get stage tasks
        response = self.session.get(f"{BASE_URL}/api/website-projects/projects/{project_id}/stage-tasks")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        
        # Check that tasks have status field
        for stage, tasks in data.items():
            for task in tasks:
                assert "status" in task, f"Task in {stage} should have status"
                status = task["status"]
                valid_statuses = ["pending", "in_progress", "waiting_approval", "approved", "corrections", "locked"]
                assert status in valid_statuses, f"Invalid status '{status}' in {stage}"
                print(f"Task '{task.get('page_name')}' in {stage}: {status}")


class TestTeamMembers:
    """Test team members endpoint for assignee dropdowns"""
    
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
            data = login_response.json()
            self.token = data.get("session_token") or data.get("token")
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        else:
            pytest.skip("Login failed")
    
    def test_get_team_members(self):
        """Test GET /api/website-projects/team-members"""
        response = self.session.get(f"{BASE_URL}/api/website-projects/team-members")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"Found {len(data)} team members")
        
        if len(data) > 0:
            member = data[0]
            assert "user_id" in member, "Member should have user_id"
            assert "name" in member, "Member should have name"
            print(f"First member: {member.get('name')}")
