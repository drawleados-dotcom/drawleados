"""
Creative Design Board API Tests
Tests: Projects, Tasks, Design Types endpoints
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestCreativeDesignBoard:
    """Creative Design Board API tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup for each test - login and get token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "vinoth@drawlead.com",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        self.token = data.get("session_token")
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
        self.created_project_id = None
        self.created_task_id = None
        self.created_design_type_id = None
        yield
        # Cleanup
        if self.created_task_id:
            requests.delete(f"{BASE_URL}/api/creative/tasks/{self.created_task_id}", headers=self.headers)
        if self.created_project_id:
            requests.delete(f"{BASE_URL}/api/creative/projects/{self.created_project_id}", headers=self.headers)
        if self.created_design_type_id:
            requests.delete(f"{BASE_URL}/api/creative/design-types/{self.created_design_type_id}", headers=self.headers)
    
    # ============== PROJECT TESTS ==============
    
    def test_get_projects(self):
        """Test GET /api/creative/projects"""
        response = requests.get(f"{BASE_URL}/api/creative/projects", headers=self.headers)
        assert response.status_code == 200, f"Get projects failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Expected list of projects"
        print(f"Found {len(data)} projects")
    
    def test_create_project(self):
        """Test POST /api/creative/projects"""
        project_data = {
            "name": "TEST_Creative_Project",
            "description": "Test project for design tasks",
            "client_name": "Test Client",
            "deadline": "2026-03-15",
            "assigned_to": "Vinoth",
            "tag": "created"
        }
        response = requests.post(f"{BASE_URL}/api/creative/projects", json=project_data, headers=self.headers)
        assert response.status_code == 200, f"Create project failed: {response.text}"
        data = response.json()
        assert "project_id" in data, "Missing project_id in response"
        self.created_project_id = data["project_id"]
        print(f"Created project: {self.created_project_id}")
        
        # Verify by GET
        get_response = requests.get(f"{BASE_URL}/api/creative/projects", headers=self.headers)
        assert get_response.status_code == 200
        projects = get_response.json()
        project_names = [p.get("name") for p in projects]
        assert "TEST_Creative_Project" in project_names, "Created project not found in list"
    
    def test_update_project(self):
        """Test PUT /api/creative/projects/{project_id}"""
        # Create project first
        create_response = requests.post(f"{BASE_URL}/api/creative/projects", json={
            "name": "TEST_Update_Project",
            "client_name": "Original Client"
        }, headers=self.headers)
        assert create_response.status_code == 200
        project_id = create_response.json()["project_id"]
        self.created_project_id = project_id
        
        # Update project
        update_data = {"client_name": "Updated Client", "deadline": "2026-04-01"}
        update_response = requests.put(f"{BASE_URL}/api/creative/projects/{project_id}", json=update_data, headers=self.headers)
        assert update_response.status_code == 200, f"Update project failed: {update_response.text}"
        assert update_response.json().get("message") == "Project updated"
        print(f"Updated project: {project_id}")
    
    def test_delete_project(self):
        """Test DELETE /api/creative/projects/{project_id}"""
        # Create project
        create_response = requests.post(f"{BASE_URL}/api/creative/projects", json={
            "name": "TEST_Delete_Project"
        }, headers=self.headers)
        project_id = create_response.json()["project_id"]
        
        # Delete project
        delete_response = requests.delete(f"{BASE_URL}/api/creative/projects/{project_id}", headers=self.headers)
        assert delete_response.status_code == 200, f"Delete project failed: {delete_response.text}"
        print(f"Deleted project: {project_id}")
    
    # ============== TASK TESTS ==============
    
    def test_get_tasks(self):
        """Test GET /api/creative/tasks"""
        response = requests.get(f"{BASE_URL}/api/creative/tasks", headers=self.headers)
        assert response.status_code == 200, f"Get tasks failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Expected list of tasks"
        print(f"Found {len(data)} tasks")
    
    def test_create_task_poster(self):
        """Test POST /api/creative/tasks - Create Poster task"""
        task_data = {
            "title": "TEST_Poster_Task",
            "description": "Test poster design",
            "design_type": "poster",
            "design_size": "A4",
            "stages": {
                "design_content": {"due_date": "2026-02-25", "assignee": "Designer1", "link": "", "status": "To-Do"},
                "design_file": {"due_date": "2026-02-26", "assignee": "Designer1", "link": "", "status": "To-Do"},
                "review": {"due_date": "2026-02-27", "assignee": "Vinoth", "link": "", "status": "To-Do"},
                "final": {"due_date": "2026-02-28", "assignee": "", "link": "", "status": "To-Do"}
            },
            "overall_status": "To-Do",
            "tag": "created"
        }
        response = requests.post(f"{BASE_URL}/api/creative/tasks", json=task_data, headers=self.headers)
        assert response.status_code == 200, f"Create task failed: {response.text}"
        data = response.json()
        assert "task_id" in data, "Missing task_id in response"
        self.created_task_id = data["task_id"]
        print(f"Created poster task: {self.created_task_id}")
        
        # Verify by GET
        get_response = requests.get(f"{BASE_URL}/api/creative/tasks", headers=self.headers)
        assert get_response.status_code == 200
        tasks = get_response.json()
        task_titles = [t.get("title") for t in tasks]
        assert "TEST_Poster_Task" in task_titles, "Created task not found"
    
    def test_create_task_story(self):
        """Test POST /api/creative/tasks - Create Story task"""
        task_data = {
            "title": "TEST_Story_Task",
            "design_type": "story",
            "design_size": "1080x1920",
            "stages": {
                "design_content": {"due_date": "", "assignee": "", "link": "", "status": "To-Do"},
                "design_file": {"due_date": "", "assignee": "", "link": "", "status": "To-Do"},
                "review": {"due_date": "", "assignee": "", "link": "", "status": "To-Do"},
                "final": {"due_date": "", "assignee": "", "link": "", "status": "To-Do"}
            },
            "overall_status": "To-Do"
        }
        response = requests.post(f"{BASE_URL}/api/creative/tasks", json=task_data, headers=self.headers)
        assert response.status_code == 200, f"Create story task failed: {response.text}"
        self.created_task_id = response.json()["task_id"]
        print(f"Created story task: {self.created_task_id}")
    
    def test_create_task_brochure(self):
        """Test POST /api/creative/tasks - Create Brochure task"""
        task_data = {
            "title": "TEST_Brochure_Task",
            "design_type": "brochure",
            "design_size": "A4 Tri-fold",
            "stages": {
                "design_content": {"due_date": "", "assignee": "", "link": "", "status": "To-Do"},
                "design_file": {"due_date": "", "assignee": "", "link": "", "status": "To-Do"},
                "review": {"due_date": "", "assignee": "", "link": "", "status": "To-Do"},
                "final": {"due_date": "", "assignee": "", "link": "", "status": "To-Do"}
            },
            "overall_status": "To-Do"
        }
        response = requests.post(f"{BASE_URL}/api/creative/tasks", json=task_data, headers=self.headers)
        assert response.status_code == 200, f"Create brochure task failed: {response.text}"
        self.created_task_id = response.json()["task_id"]
        print(f"Created brochure task: {self.created_task_id}")
    
    def test_update_task_status(self):
        """Test PUT /api/creative/tasks/{task_id} - Update status"""
        # Create task
        create_response = requests.post(f"{BASE_URL}/api/creative/tasks", json={
            "title": "TEST_Update_Status_Task",
            "design_type": "poster",
            "overall_status": "To-Do"
        }, headers=self.headers)
        task_id = create_response.json()["task_id"]
        self.created_task_id = task_id
        
        # Update status to In Progress
        update_response = requests.put(f"{BASE_URL}/api/creative/tasks/{task_id}", json={
            "overall_status": "In Progress"
        }, headers=self.headers)
        assert update_response.status_code == 200, f"Update task status failed: {update_response.text}"
        print(f"Updated task status to In Progress")
    
    def test_update_stage_status(self):
        """Test PUT /api/creative/tasks/{task_id} - Update stage status"""
        # Create task
        create_response = requests.post(f"{BASE_URL}/api/creative/tasks", json={
            "title": "TEST_Stage_Update_Task",
            "design_type": "story",
            "stages": {
                "design_content": {"due_date": "", "assignee": "", "link": "", "status": "To-Do"},
                "design_file": {"due_date": "", "assignee": "", "link": "", "status": "To-Do"},
                "review": {"due_date": "", "assignee": "", "link": "", "status": "To-Do"},
                "final": {"due_date": "", "assignee": "", "link": "", "status": "To-Do"}
            }
        }, headers=self.headers)
        task_id = create_response.json()["task_id"]
        self.created_task_id = task_id
        
        # Update design_content stage to Completed
        update_response = requests.put(f"{BASE_URL}/api/creative/tasks/{task_id}", json={
            "stages": {
                "design_content": {"due_date": "", "assignee": "", "link": "https://drive.google.com/test", "status": "Completed"},
                "design_file": {"due_date": "", "assignee": "", "link": "", "status": "In Progress"},
                "review": {"due_date": "", "assignee": "", "link": "", "status": "To-Do"},
                "final": {"due_date": "", "assignee": "", "link": "", "status": "To-Do"}
            }
        }, headers=self.headers)
        assert update_response.status_code == 200, f"Update stage status failed: {update_response.text}"
        print(f"Updated stage statuses")
    
    def test_delete_task(self):
        """Test DELETE /api/creative/tasks/{task_id}"""
        # Create task
        create_response = requests.post(f"{BASE_URL}/api/creative/tasks", json={
            "title": "TEST_Delete_Task",
            "design_type": "banner"
        }, headers=self.headers)
        task_id = create_response.json()["task_id"]
        
        # Delete task
        delete_response = requests.delete(f"{BASE_URL}/api/creative/tasks/{task_id}", headers=self.headers)
        assert delete_response.status_code == 200, f"Delete task failed: {delete_response.text}"
        print(f"Deleted task: {task_id}")
    
    # ============== DESIGN TYPES TESTS ==============
    
    def test_get_design_types(self):
        """Test GET /api/creative/design-types"""
        response = requests.get(f"{BASE_URL}/api/creative/design-types", headers=self.headers)
        assert response.status_code == 200, f"Get design types failed: {response.text}"
        data = response.json()
        
        # Verify structure
        assert "built_in" in data, "Missing built_in design types"
        assert "custom" in data, "Missing custom design types"
        
        # Verify built-in types include Poster, Story, Brochure
        built_in_names = [t.get("name") for t in data["built_in"]]
        assert "Poster" in built_in_names, "Poster type missing"
        assert "Story" in built_in_names, "Story type missing"
        assert "Brochure" in built_in_names, "Brochure type missing"
        
        # Verify sizes for Poster
        poster = next((t for t in data["built_in"] if t["name"] == "Poster"), None)
        assert poster, "Poster type not found"
        assert "A4" in poster.get("sizes", []), "A4 size missing for Poster"
        
        print(f"Found {len(data['built_in'])} built-in types, {len(data['custom'])} custom types")
    
    def test_create_custom_design_type(self):
        """Test POST /api/creative/design-types - Create custom type"""
        custom_type = {
            "id": "test_flyer",
            "name": "TEST_Flyer",
            "sizes": ["A5", "A6", "DL", "Custom"]
        }
        response = requests.post(f"{BASE_URL}/api/creative/design-types", json=custom_type, headers=self.headers)
        assert response.status_code == 200, f"Create design type failed: {response.text}"
        self.created_design_type_id = "test_flyer"
        
        # Verify by GET
        get_response = requests.get(f"{BASE_URL}/api/creative/design-types", headers=self.headers)
        assert get_response.status_code == 200
        data = get_response.json()
        custom_names = [t.get("name") for t in data["custom"]]
        assert "TEST_Flyer" in custom_names, "Custom type not found in list"
        print(f"Created custom design type: TEST_Flyer")
    
    def test_delete_custom_design_type(self):
        """Test DELETE /api/creative/design-types/{type_id}"""
        # Create custom type
        create_response = requests.post(f"{BASE_URL}/api/creative/design-types", json={
            "id": "test_delete_type",
            "name": "TEST_Delete_Type",
            "sizes": ["A4"]
        }, headers=self.headers)
        assert create_response.status_code == 200
        
        # Delete custom type
        delete_response = requests.delete(f"{BASE_URL}/api/creative/design-types/test_delete_type", headers=self.headers)
        assert delete_response.status_code == 200, f"Delete design type failed: {delete_response.text}"
        print(f"Deleted custom design type: test_delete_type")
    
    # ============== INTEGRATION TESTS ==============
    
    def test_full_task_workflow(self):
        """Test complete task workflow: Create -> Update Stages -> Complete"""
        # 1. Create project
        proj_response = requests.post(f"{BASE_URL}/api/creative/projects", json={
            "name": "TEST_Workflow_Project",
            "client_name": "Workflow Client"
        }, headers=self.headers)
        project_id = proj_response.json()["project_id"]
        self.created_project_id = project_id
        
        # 2. Create task with project
        task_data = {
            "title": "TEST_Workflow_Task",
            "project_id": project_id,
            "design_type": "poster",
            "design_size": "A3",
            "stages": {
                "design_content": {"due_date": "2026-02-25", "assignee": "Designer", "link": "", "status": "To-Do"},
                "design_file": {"due_date": "2026-02-26", "assignee": "Designer", "link": "", "status": "To-Do"},
                "review": {"due_date": "2026-02-27", "assignee": "Reviewer", "link": "", "status": "To-Do"},
                "final": {"due_date": "2026-02-28", "assignee": "", "link": "", "status": "To-Do"}
            },
            "overall_status": "To-Do"
        }
        task_response = requests.post(f"{BASE_URL}/api/creative/tasks", json=task_data, headers=self.headers)
        task_id = task_response.json()["task_id"]
        self.created_task_id = task_id
        
        # 3. Update stages progressively
        # Design content completed
        requests.put(f"{BASE_URL}/api/creative/tasks/{task_id}", json={
            "stages": {
                "design_content": {"due_date": "2026-02-25", "assignee": "Designer", "link": "https://figma.com/design", "status": "Completed"},
                "design_file": {"due_date": "2026-02-26", "assignee": "Designer", "link": "", "status": "In Progress"},
                "review": {"due_date": "2026-02-27", "assignee": "Reviewer", "link": "", "status": "To-Do"},
                "final": {"due_date": "2026-02-28", "assignee": "", "link": "", "status": "To-Do"}
            },
            "overall_status": "In Progress"
        }, headers=self.headers)
        
        # 4. Verify task is updated
        get_response = requests.get(f"{BASE_URL}/api/creative/tasks", headers=self.headers)
        tasks = get_response.json()
        task = next((t for t in tasks if t["task_id"] == task_id), None)
        assert task, "Task not found after update"
        assert task["overall_status"] == "In Progress", "Status not updated"
        assert task["stages"]["design_content"]["status"] == "Completed", "Stage status not updated"
        
        print(f"Full workflow test passed")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
