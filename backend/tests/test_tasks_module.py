"""
Tasks Module Backend Tests
- Departments CRUD (SEO, Meta, Social Media, Design, ERP)
- Projects CRUD within departments
- Tasks CRUD within projects
- Documents CRUD within projects
- Timer functionality for tasks
"""

import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "vinoth@drawlead.com"
ADMIN_PASSWORD = "admin123"


class TestTasksModuleAuth:
    """Authentication for Tasks Module tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token for admin user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "session_token" in data, "No session_token in response"
        return data["session_token"]
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        """Get headers with auth token"""
        return {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        }


class TestDepartments(TestTasksModuleAuth):
    """Department CRUD tests"""
    
    def test_get_departments_returns_default_five(self, headers):
        """GET /api/departments - Should return 5 default departments"""
        response = requests.get(f"{BASE_URL}/api/departments", headers=headers)
        assert response.status_code == 200, f"Failed to get departments: {response.text}"
        
        departments = response.json()
        assert isinstance(departments, list), "Response should be a list"
        assert len(departments) >= 5, f"Expected at least 5 departments, got {len(departments)}"
        
        # Verify default department names exist
        dept_names = [d["name"] for d in departments]
        expected_names = ["SEO", "Meta", "Social Media", "Design", "ERP"]
        for name in expected_names:
            assert name in dept_names, f"Expected department '{name}' not found"
        
        # Verify department structure
        for dept in departments:
            assert "department_id" in dept, "Missing department_id"
            assert "name" in dept, "Missing name"
            assert "icon" in dept, "Missing icon"
            assert "color" in dept, "Missing color"
            assert "project_count" in dept, "Missing project_count"
        
        print(f"✓ Found {len(departments)} departments with expected defaults")
    
    def test_create_department_admin_only(self, headers):
        """POST /api/departments - Admin can create new department"""
        new_dept = {
            "name": "TEST_Content Writing",
            "icon": "✍️",
            "color": "#22c55e",
            "description": "Content writing department for testing"
        }
        
        response = requests.post(f"{BASE_URL}/api/departments", json=new_dept, headers=headers)
        assert response.status_code == 200, f"Failed to create department: {response.text}"
        
        created = response.json()
        assert created["name"] == new_dept["name"], "Name mismatch"
        assert created["icon"] == new_dept["icon"], "Icon mismatch"
        assert created["color"] == new_dept["color"], "Color mismatch"
        assert "department_id" in created, "Missing department_id"
        
        # Store for cleanup
        self.__class__.test_dept_id = created["department_id"]
        print(f"✓ Created department: {created['name']} ({created['department_id']})")
    
    def test_department_appears_in_list(self, headers):
        """Verify created department appears in list"""
        response = requests.get(f"{BASE_URL}/api/departments", headers=headers)
        assert response.status_code == 200
        
        departments = response.json()
        dept_ids = [d["department_id"] for d in departments]
        assert hasattr(self.__class__, 'test_dept_id'), "No test department created"
        assert self.__class__.test_dept_id in dept_ids, "Created department not in list"
        print("✓ Created department appears in list")
    
    def test_delete_department(self, headers):
        """DELETE /api/departments/{id} - Soft delete department"""
        if not hasattr(self.__class__, 'test_dept_id'):
            pytest.skip("No test department to delete")
        
        response = requests.delete(
            f"{BASE_URL}/api/departments/{self.__class__.test_dept_id}", 
            headers=headers
        )
        assert response.status_code == 200, f"Failed to delete department: {response.text}"
        print(f"✓ Deleted test department: {self.__class__.test_dept_id}")


class TestProjects(TestTasksModuleAuth):
    """Project CRUD tests within departments"""
    
    @pytest.fixture(scope="class")
    def seo_department_id(self, headers):
        """Get SEO department ID for testing"""
        response = requests.get(f"{BASE_URL}/api/departments", headers=headers)
        assert response.status_code == 200
        
        departments = response.json()
        seo_dept = next((d for d in departments if d["name"] == "SEO"), None)
        assert seo_dept is not None, "SEO department not found"
        return seo_dept["department_id"]
    
    def test_get_projects_in_department(self, headers, seo_department_id):
        """GET /api/departments/{dept_id}/projects - Get projects in department"""
        response = requests.get(
            f"{BASE_URL}/api/departments/{seo_department_id}/projects", 
            headers=headers
        )
        assert response.status_code == 200, f"Failed to get projects: {response.text}"
        
        projects = response.json()
        assert isinstance(projects, list), "Response should be a list"
        
        # Verify project structure if any exist
        if projects:
            project = projects[0]
            assert "project_id" in project, "Missing project_id"
            assert "name" in project, "Missing name"
            assert "status" in project, "Missing status"
            assert "total_tasks" in project, "Missing total_tasks"
            assert "completed_tasks" in project, "Missing completed_tasks"
        
        print(f"✓ Found {len(projects)} projects in SEO department")
    
    def test_create_project(self, headers, seo_department_id):
        """POST /api/departments/{dept_id}/projects - Create project"""
        new_project = {
            "name": "TEST_SEO Campaign",
            "client_name": "Test Client Corp",
            "description": "Test project for automated testing",
            "start_date": "2026-01-15",
            "end_date": "2026-03-15",
            "status": "active",
            "team_members": []
        }
        
        response = requests.post(
            f"{BASE_URL}/api/departments/{seo_department_id}/projects",
            json=new_project,
            headers=headers
        )
        assert response.status_code == 200, f"Failed to create project: {response.text}"
        
        created = response.json()
        assert created["name"] == new_project["name"], "Name mismatch"
        assert created["client_name"] == new_project["client_name"], "Client name mismatch"
        assert created["status"] == "active", "Status should be active"
        assert "project_id" in created, "Missing project_id"
        assert created["total_tasks"] == 0, "New project should have 0 tasks"
        
        # Store for later tests
        self.__class__.test_project_id = created["project_id"]
        print(f"✓ Created project: {created['name']} ({created['project_id']})")
    
    def test_get_project_detail(self, headers):
        """GET /api/departments/projects/{project_id} - Get project with tasks and documents"""
        if not hasattr(self.__class__, 'test_project_id'):
            pytest.skip("No test project created")
        
        response = requests.get(
            f"{BASE_URL}/api/departments/projects/{self.__class__.test_project_id}",
            headers=headers
        )
        assert response.status_code == 200, f"Failed to get project detail: {response.text}"
        
        project = response.json()
        assert project["project_id"] == self.__class__.test_project_id
        assert "tasks" in project, "Missing tasks array"
        assert "documents" in project, "Missing documents array"
        assert "department" in project, "Missing department info"
        
        print(f"✓ Got project detail with {len(project['tasks'])} tasks and {len(project['documents'])} documents")
    
    def test_update_project(self, headers):
        """PUT /api/departments/projects/{project_id} - Update project"""
        if not hasattr(self.__class__, 'test_project_id'):
            pytest.skip("No test project created")
        
        update_data = {
            "description": "Updated description for testing",
            "status": "active"
        }
        
        response = requests.put(
            f"{BASE_URL}/api/departments/projects/{self.__class__.test_project_id}",
            json=update_data,
            headers=headers
        )
        assert response.status_code == 200, f"Failed to update project: {response.text}"
        
        updated = response.json()
        assert updated["description"] == update_data["description"], "Description not updated"
        print("✓ Updated project successfully")
    
    def test_filter_projects_by_status(self, headers, seo_department_id):
        """GET /api/departments/{dept_id}/projects?status=active - Filter by status"""
        response = requests.get(
            f"{BASE_URL}/api/departments/{seo_department_id}/projects?status=active",
            headers=headers
        )
        assert response.status_code == 200, f"Failed to filter projects: {response.text}"
        
        projects = response.json()
        for project in projects:
            assert project["status"] == "active", f"Project {project['name']} has wrong status"
        
        print(f"✓ Filtered {len(projects)} active projects")


class TestTasks(TestTasksModuleAuth):
    """Task CRUD tests within projects"""
    
    @pytest.fixture(scope="class")
    def test_project_id(self, headers):
        """Get or create a test project for task tests"""
        # First get SEO department
        response = requests.get(f"{BASE_URL}/api/departments", headers=headers)
        departments = response.json()
        seo_dept = next((d for d in departments if d["name"] == "SEO"), None)
        
        # Get existing projects
        response = requests.get(
            f"{BASE_URL}/api/departments/{seo_dept['department_id']}/projects",
            headers=headers
        )
        projects = response.json()
        
        # Use existing project or create new one
        if projects:
            return projects[0]["project_id"]
        else:
            # Create a project for testing
            new_project = {
                "name": "TEST_Task Testing Project",
                "client_name": "Test Client",
                "status": "active"
            }
            response = requests.post(
                f"{BASE_URL}/api/departments/{seo_dept['department_id']}/projects",
                json=new_project,
                headers=headers
            )
            return response.json()["project_id"]
    
    def test_create_task(self, headers, test_project_id):
        """POST /api/departments/projects/{project_id}/tasks - Create task"""
        new_task = {
            "task_name": "TEST_Keyword Research",
            "description": "Research keywords for SEO campaign",
            "priority": "high",
            "type": "general",
            "due_date": "2026-01-20",
            "due_time": "17:00",
            "status": "pending"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/departments/projects/{test_project_id}/tasks",
            json=new_task,
            headers=headers
        )
        assert response.status_code == 200, f"Failed to create task: {response.text}"
        
        created = response.json()
        assert created["task_name"] == new_task["task_name"], "Task name mismatch"
        assert created["priority"] == "high", "Priority mismatch"
        assert created["status"] == "pending", "Status should be pending"
        assert "task_id" in created, "Missing task_id"
        
        # Store for later tests
        self.__class__.test_task_id = created["task_id"]
        self.__class__.test_project_id = test_project_id
        print(f"✓ Created task: {created['task_name']} ({created['task_id']})")
    
    def test_get_project_tasks(self, headers, test_project_id):
        """GET /api/departments/projects/{project_id}/tasks - Get all tasks"""
        response = requests.get(
            f"{BASE_URL}/api/departments/projects/{test_project_id}/tasks",
            headers=headers
        )
        assert response.status_code == 200, f"Failed to get tasks: {response.text}"
        
        tasks = response.json()
        assert isinstance(tasks, list), "Response should be a list"
        
        if tasks:
            task = tasks[0]
            assert "task_id" in task, "Missing task_id"
            assert "task_name" in task, "Missing task_name"
            assert "priority" in task, "Missing priority"
            assert "status" in task, "Missing status"
        
        print(f"✓ Found {len(tasks)} tasks in project")
    
    def test_update_task_status(self, headers):
        """PUT /api/departments/projects/{project_id}/tasks/{task_id} - Update task status"""
        if not hasattr(self.__class__, 'test_task_id'):
            pytest.skip("No test task created")
        
        update_data = {"status": "in_progress"}
        
        response = requests.put(
            f"{BASE_URL}/api/departments/projects/{self.__class__.test_project_id}/tasks/{self.__class__.test_task_id}",
            json=update_data,
            headers=headers
        )
        assert response.status_code == 200, f"Failed to update task: {response.text}"
        
        updated = response.json()
        assert updated["status"] == "in_progress", "Status not updated"
        print("✓ Updated task status to in_progress")
    
    def test_update_task_priority(self, headers):
        """PUT /api/departments/projects/{project_id}/tasks/{task_id} - Update task priority"""
        if not hasattr(self.__class__, 'test_task_id'):
            pytest.skip("No test task created")
        
        update_data = {"priority": "medium"}
        
        response = requests.put(
            f"{BASE_URL}/api/departments/projects/{self.__class__.test_project_id}/tasks/{self.__class__.test_task_id}",
            json=update_data,
            headers=headers
        )
        assert response.status_code == 200, f"Failed to update task: {response.text}"
        
        updated = response.json()
        assert updated["priority"] == "medium", "Priority not updated"
        print("✓ Updated task priority to medium")
    
    def test_filter_tasks_by_status(self, headers, test_project_id):
        """GET /api/departments/projects/{project_id}/tasks?status=pending - Filter tasks"""
        response = requests.get(
            f"{BASE_URL}/api/departments/projects/{test_project_id}/tasks?status=pending",
            headers=headers
        )
        assert response.status_code == 200, f"Failed to filter tasks: {response.text}"
        
        tasks = response.json()
        for task in tasks:
            assert task["status"] == "pending", f"Task {task['task_name']} has wrong status"
        
        print(f"✓ Filtered {len(tasks)} pending tasks")
    
    def test_delete_task(self, headers):
        """DELETE /api/departments/projects/{project_id}/tasks/{task_id} - Delete task"""
        if not hasattr(self.__class__, 'test_task_id'):
            pytest.skip("No test task created")
        
        response = requests.delete(
            f"{BASE_URL}/api/departments/projects/{self.__class__.test_project_id}/tasks/{self.__class__.test_task_id}",
            headers=headers
        )
        assert response.status_code == 200, f"Failed to delete task: {response.text}"
        print(f"✓ Deleted test task: {self.__class__.test_task_id}")


class TestDocuments(TestTasksModuleAuth):
    """Document CRUD tests within projects"""
    
    @pytest.fixture(scope="class")
    def test_project_id(self, headers):
        """Get or create a test project for document tests"""
        response = requests.get(f"{BASE_URL}/api/departments", headers=headers)
        departments = response.json()
        seo_dept = next((d for d in departments if d["name"] == "SEO"), None)
        
        response = requests.get(
            f"{BASE_URL}/api/departments/{seo_dept['department_id']}/projects",
            headers=headers
        )
        projects = response.json()
        
        if projects:
            return projects[0]["project_id"]
        else:
            new_project = {
                "name": "TEST_Document Testing Project",
                "client_name": "Test Client",
                "status": "active"
            }
            response = requests.post(
                f"{BASE_URL}/api/departments/{seo_dept['department_id']}/projects",
                json=new_project,
                headers=headers
            )
            return response.json()["project_id"]
    
    def test_add_document(self, headers, test_project_id):
        """POST /api/departments/projects/{project_id}/documents - Add document"""
        new_doc = {
            "name": "TEST_Project Brief",
            "link": "https://docs.google.com/document/d/test123",
            "doc_type": "doc"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/departments/projects/{test_project_id}/documents",
            json=new_doc,
            headers=headers
        )
        assert response.status_code == 200, f"Failed to add document: {response.text}"
        
        created = response.json()
        assert created["name"] == new_doc["name"], "Name mismatch"
        assert created["link"] == new_doc["link"], "Link mismatch"
        assert created["doc_type"] == "doc", "Doc type mismatch"
        assert "doc_id" in created, "Missing doc_id"
        
        # Store for later tests
        self.__class__.test_doc_id = created["doc_id"]
        self.__class__.test_project_id = test_project_id
        print(f"✓ Added document: {created['name']} ({created['doc_id']})")
    
    def test_get_project_documents(self, headers, test_project_id):
        """GET /api/departments/projects/{project_id}/documents - Get all documents"""
        response = requests.get(
            f"{BASE_URL}/api/departments/projects/{test_project_id}/documents",
            headers=headers
        )
        assert response.status_code == 200, f"Failed to get documents: {response.text}"
        
        documents = response.json()
        assert isinstance(documents, list), "Response should be a list"
        
        if documents:
            doc = documents[0]
            assert "doc_id" in doc, "Missing doc_id"
            assert "name" in doc, "Missing name"
            assert "link" in doc, "Missing link"
            assert "doc_type" in doc, "Missing doc_type"
        
        print(f"✓ Found {len(documents)} documents in project")
    
    def test_document_in_project_detail(self, headers, test_project_id):
        """Verify document appears in project detail"""
        response = requests.get(
            f"{BASE_URL}/api/departments/projects/{test_project_id}",
            headers=headers
        )
        assert response.status_code == 200
        
        project = response.json()
        assert "documents" in project, "Missing documents in project detail"
        
        if hasattr(self.__class__, 'test_doc_id'):
            doc_ids = [d["doc_id"] for d in project["documents"]]
            assert self.__class__.test_doc_id in doc_ids, "Created document not in project detail"
        
        print("✓ Document appears in project detail")
    
    def test_remove_document(self, headers):
        """DELETE /api/departments/projects/{project_id}/documents/{doc_id} - Remove document"""
        if not hasattr(self.__class__, 'test_doc_id'):
            pytest.skip("No test document created")
        
        response = requests.delete(
            f"{BASE_URL}/api/departments/projects/{self.__class__.test_project_id}/documents/{self.__class__.test_doc_id}",
            headers=headers
        )
        assert response.status_code == 200, f"Failed to remove document: {response.text}"
        print(f"✓ Removed test document: {self.__class__.test_doc_id}")


class TestTimerFunctionality(TestTasksModuleAuth):
    """Timer functionality tests for tasks"""
    
    @pytest.fixture(scope="class")
    def task_for_timer(self, headers):
        """Create a task for timer testing"""
        # Get SEO department
        response = requests.get(f"{BASE_URL}/api/departments", headers=headers)
        departments = response.json()
        seo_dept = next((d for d in departments if d["name"] == "SEO"), None)
        
        # Get or create project
        response = requests.get(
            f"{BASE_URL}/api/departments/{seo_dept['department_id']}/projects",
            headers=headers
        )
        projects = response.json()
        
        if projects:
            project_id = projects[0]["project_id"]
        else:
            new_project = {
                "name": "TEST_Timer Testing Project",
                "status": "active"
            }
            response = requests.post(
                f"{BASE_URL}/api/departments/{seo_dept['department_id']}/projects",
                json=new_project,
                headers=headers
            )
            project_id = response.json()["project_id"]
        
        # Create task for timer testing
        new_task = {
            "task_name": "TEST_Timer Task",
            "priority": "medium",
            "status": "pending"
        }
        response = requests.post(
            f"{BASE_URL}/api/departments/projects/{project_id}/tasks",
            json=new_task,
            headers=headers
        )
        task = response.json()
        return {"task_id": task["task_id"], "project_id": project_id}
    
    def test_start_timer(self, headers, task_for_timer):
        """POST /api/departments/tasks/{task_id}/timer/start - Start timer"""
        response = requests.post(
            f"{BASE_URL}/api/departments/tasks/{task_for_timer['task_id']}/timer/start",
            headers=headers
        )
        assert response.status_code == 200, f"Failed to start timer: {response.text}"
        
        result = response.json()
        assert "timer_id" in result, "Missing timer_id"
        assert "start_time" in result, "Missing start_time"
        
        self.__class__.timer_task = task_for_timer
        print(f"✓ Started timer for task: {task_for_timer['task_id']}")
    
    def test_get_timer_status(self, headers, task_for_timer):
        """GET /api/departments/tasks/{task_id}/timer - Get timer status"""
        response = requests.get(
            f"{BASE_URL}/api/departments/tasks/{task_for_timer['task_id']}/timer",
            headers=headers
        )
        assert response.status_code == 200, f"Failed to get timer status: {response.text}"
        
        result = response.json()
        assert "running" in result, "Missing running status"
        print(f"✓ Timer running: {result['running']}")
    
    def test_stop_timer(self, headers, task_for_timer):
        """POST /api/departments/tasks/{task_id}/timer/stop - Stop timer"""
        response = requests.post(
            f"{BASE_URL}/api/departments/tasks/{task_for_timer['task_id']}/timer/stop",
            headers=headers
        )
        assert response.status_code == 200, f"Failed to stop timer: {response.text}"
        
        result = response.json()
        assert "duration" in result, "Missing duration"
        assert "end_time" in result, "Missing end_time"
        print(f"✓ Stopped timer, duration: {result['duration']} seconds")
    
    def test_cleanup_timer_task(self, headers, task_for_timer):
        """Cleanup: Delete the timer test task"""
        response = requests.delete(
            f"{BASE_URL}/api/departments/projects/{task_for_timer['project_id']}/tasks/{task_for_timer['task_id']}",
            headers=headers
        )
        assert response.status_code == 200
        print("✓ Cleaned up timer test task")


class TestCleanup(TestTasksModuleAuth):
    """Cleanup test data"""
    
    def test_cleanup_test_projects(self, headers):
        """Delete all TEST_ prefixed projects"""
        response = requests.get(f"{BASE_URL}/api/departments", headers=headers)
        departments = response.json()
        
        deleted_count = 0
        for dept in departments:
            response = requests.get(
                f"{BASE_URL}/api/departments/{dept['department_id']}/projects",
                headers=headers
            )
            projects = response.json()
            
            for project in projects:
                if project["name"].startswith("TEST_"):
                    requests.delete(
                        f"{BASE_URL}/api/departments/projects/{project['project_id']}",
                        headers=headers
                    )
                    deleted_count += 1
        
        print(f"✓ Cleaned up {deleted_count} test projects")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
