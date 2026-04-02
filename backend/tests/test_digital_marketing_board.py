"""
Test Digital Marketing Board Features for Operations Module
Tests:
- Operations page API endpoints
- Digital Marketing Board template
- Approval workflow statuses
- Department options
- Priority options
- Task CRUD operations
- Kanban view data
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestDigitalMarketingBoard:
    """Test Digital Marketing Board features in Operations module"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
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
    
    # ============== TEMPLATE TESTS ==============
    
    def test_get_templates_includes_dm_board(self):
        """Test that templates endpoint includes Digital Marketing Board"""
        response = self.session.get(f"{BASE_URL}/api/notion/templates")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        templates = response.json()
        assert isinstance(templates, list), "Templates should be a list"
        
        # Find Digital Marketing Board template
        dm_template = None
        for t in templates:
            if t.get("id") == "dm_task_board" or "Digital Marketing" in t.get("name", ""):
                dm_template = t
                break
        
        assert dm_template is not None, "Digital Marketing Board template not found"
        print(f"Found DM template: {dm_template.get('name')}")
        
        # Verify template has correct columns
        columns = dm_template.get("columns", [])
        column_names = [c.get("name") for c in columns]
        
        expected_columns = ["Task Name", "Department", "Status", "Priority", "Due Date", "Assigned To"]
        for expected in expected_columns:
            assert expected in column_names, f"Missing column: {expected}"
        
        print(f"Template columns: {column_names}")
    
    def test_dm_template_has_correct_departments(self):
        """Test that DM template has all 6 departments"""
        response = self.session.get(f"{BASE_URL}/api/notion/templates")
        assert response.status_code == 200
        
        templates = response.json()
        dm_template = next((t for t in templates if t.get("id") == "dm_task_board"), None)
        assert dm_template is not None
        
        # Find Department column
        dept_col = next((c for c in dm_template.get("columns", []) if c.get("name") == "Department"), None)
        assert dept_col is not None, "Department column not found"
        
        dept_options = [o.get("name") for o in dept_col.get("options", [])]
        expected_depts = ["Website", "SEO", "Meta Ads", "Content", "Design", "Social Media"]
        
        for dept in expected_depts:
            assert dept in dept_options, f"Missing department: {dept}"
        
        assert len(dept_options) == 6, f"Expected 6 departments, got {len(dept_options)}"
        print(f"Departments: {dept_options}")
    
    def test_dm_template_has_approval_workflow_statuses(self):
        """Test that DM template has correct approval workflow statuses"""
        response = self.session.get(f"{BASE_URL}/api/notion/templates")
        assert response.status_code == 200
        
        templates = response.json()
        dm_template = next((t for t in templates if t.get("id") == "dm_task_board"), None)
        assert dm_template is not None
        
        # Find Status column
        status_col = next((c for c in dm_template.get("columns", []) if c.get("name") == "Status"), None)
        assert status_col is not None, "Status column not found"
        
        status_options = [o.get("name") for o in status_col.get("options", [])]
        expected_statuses = [
            "To Do", 
            "In Progress", 
            "Operations Approval", 
            "Vinoth Approval", 
            "Client Approval", 
            "Revision", 
            "Done"
        ]
        
        for status in expected_statuses:
            assert status in status_options, f"Missing status: {status}"
        
        assert len(status_options) == 7, f"Expected 7 statuses, got {len(status_options)}"
        print(f"Statuses: {status_options}")
    
    def test_dm_template_has_priority_options(self):
        """Test that DM template has 4 priority options"""
        response = self.session.get(f"{BASE_URL}/api/notion/templates")
        assert response.status_code == 200
        
        templates = response.json()
        dm_template = next((t for t in templates if t.get("id") == "dm_task_board"), None)
        assert dm_template is not None
        
        # Find Priority column
        priority_col = next((c for c in dm_template.get("columns", []) if c.get("name") == "Priority"), None)
        assert priority_col is not None, "Priority column not found"
        
        priority_options = [o.get("name") for o in priority_col.get("options", [])]
        expected_priorities = ["Low", "Medium", "High", "Urgent"]
        
        for priority in expected_priorities:
            assert priority in priority_options, f"Missing priority: {priority}"
        
        assert len(priority_options) == 4, f"Expected 4 priorities, got {len(priority_options)}"
        print(f"Priorities: {priority_options}")
    
    # ============== DATABASE CREATION TESTS ==============
    
    def test_create_database_from_dm_template(self):
        """Test creating a database from Digital Marketing Board template"""
        response = self.session.post(
            f"{BASE_URL}/api/notion/databases/from-template/dm_task_board",
            json={"name": "TEST_DM_Board"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        db = response.json()
        assert db.get("name") == "TEST_DM_Board"
        assert db.get("database_id") is not None
        
        # Verify columns
        columns = db.get("columns", [])
        column_names = [c.get("name") for c in columns]
        
        assert "Task Name" in column_names
        assert "Department" in column_names
        assert "Status" in column_names
        assert "Priority" in column_names
        
        print(f"Created database: {db.get('database_id')}")
        
        # Store for cleanup
        self.test_db_id = db.get("database_id")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/notion/databases/{self.test_db_id}")
    
    def test_default_database_has_approval_workflow(self):
        """Test that default database creation includes approval workflow statuses"""
        response = self.session.post(
            f"{BASE_URL}/api/notion/databases",
            json={"name": "TEST_Default_DB", "icon": "📋"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        db = response.json()
        db_id = db.get("database_id")
        
        # Find Status column
        columns = db.get("columns", [])
        status_col = next((c for c in columns if c.get("name") == "Status"), None)
        assert status_col is not None, "Status column not found in default database"
        
        status_options = [o.get("name") for o in status_col.get("options", [])]
        
        # Check for approval workflow statuses
        expected_statuses = ["To Do", "In Progress", "Operations Approval", "Vinoth Approval", "Client Approval", "Revision", "Done"]
        for status in expected_statuses:
            assert status in status_options, f"Missing status in default DB: {status}"
        
        print(f"Default DB statuses: {status_options}")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/notion/databases/{db_id}")
    
    def test_default_database_has_department_column(self):
        """Test that default database includes Department column with 6 options"""
        response = self.session.post(
            f"{BASE_URL}/api/notion/databases",
            json={"name": "TEST_Dept_Check", "icon": "📋"}
        )
        assert response.status_code == 200
        
        db = response.json()
        db_id = db.get("database_id")
        
        # Find Department column
        columns = db.get("columns", [])
        dept_col = next((c for c in columns if c.get("name") == "Department"), None)
        assert dept_col is not None, "Department column not found in default database"
        
        dept_options = [o.get("name") for o in dept_col.get("options", [])]
        expected_depts = ["Website", "SEO", "Meta Ads", "Content", "Design", "Social Media"]
        
        for dept in expected_depts:
            assert dept in dept_options, f"Missing department: {dept}"
        
        print(f"Default DB departments: {dept_options}")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/notion/databases/{db_id}")
    
    # ============== TASK CRUD TESTS ==============
    
    def test_create_task_with_status(self):
        """Test creating a task and setting status"""
        # First create a database
        db_response = self.session.post(
            f"{BASE_URL}/api/notion/databases/from-template/dm_task_board",
            json={"name": "TEST_Task_CRUD"}
        )
        assert db_response.status_code == 200
        db = db_response.json()
        db_id = db.get("database_id")
        
        # Find column IDs
        columns = db.get("columns", [])
        name_col = next((c for c in columns if c.get("name") == "Task Name"), None)
        status_col = next((c for c in columns if c.get("name") == "Status"), None)
        dept_col = next((c for c in columns if c.get("name") == "Department"), None)
        
        # Get status option ID for "In Progress"
        in_progress_opt = next((o for o in status_col.get("options", []) if o.get("name") == "In Progress"), None)
        website_opt = next((o for o in dept_col.get("options", []) if o.get("name") == "Website"), None)
        
        # Create task
        task_values = {
            name_col["column_id"]: "TEST Task 1",
            status_col["column_id"]: in_progress_opt["id"],
            dept_col["column_id"]: website_opt["id"]
        }
        
        task_response = self.session.post(
            f"{BASE_URL}/api/notion/databases/{db_id}/rows",
            json={"values": task_values}
        )
        assert task_response.status_code == 200, f"Failed to create task: {task_response.text}"
        
        task = task_response.json()
        assert task.get("row_id") is not None
        assert task.get("values", {}).get(status_col["column_id"]) == in_progress_opt["id"]
        
        print(f"Created task: {task.get('row_id')}")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/notion/databases/{db_id}")
    
    def test_update_task_status(self):
        """Test updating task status through approval workflow"""
        # Create database
        db_response = self.session.post(
            f"{BASE_URL}/api/notion/databases/from-template/dm_task_board",
            json={"name": "TEST_Status_Update"}
        )
        db = db_response.json()
        db_id = db.get("database_id")
        
        columns = db.get("columns", [])
        name_col = next((c for c in columns if c.get("name") == "Task Name"), None)
        status_col = next((c for c in columns if c.get("name") == "Status"), None)
        
        # Get status options
        todo_opt = next((o for o in status_col.get("options", []) if o.get("name") == "To Do"), None)
        ops_approval_opt = next((o for o in status_col.get("options", []) if o.get("name") == "Operations Approval"), None)
        
        # Create task with "To Do" status
        task_response = self.session.post(
            f"{BASE_URL}/api/notion/databases/{db_id}/rows",
            json={"values": {name_col["column_id"]: "TEST Approval Task", status_col["column_id"]: todo_opt["id"]}}
        )
        task = task_response.json()
        row_id = task.get("row_id")
        
        # Update to "Operations Approval"
        update_response = self.session.put(
            f"{BASE_URL}/api/notion/databases/{db_id}/rows/{row_id}/cell",
            json={"column_id": status_col["column_id"], "value": ops_approval_opt["id"]}
        )
        assert update_response.status_code == 200
        
        updated_task = update_response.json()
        assert updated_task.get("values", {}).get(status_col["column_id"]) == ops_approval_opt["id"]
        
        print(f"Updated task status to Operations Approval")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/notion/databases/{db_id}")
    
    # ============== KANBAN VIEW DATA TESTS ==============
    
    def test_get_rows_for_kanban_view(self):
        """Test getting rows grouped by status for Kanban view"""
        # Create database with tasks
        db_response = self.session.post(
            f"{BASE_URL}/api/notion/databases/from-template/dm_task_board",
            json={"name": "TEST_Kanban_View"}
        )
        db = db_response.json()
        db_id = db.get("database_id")
        
        columns = db.get("columns", [])
        name_col = next((c for c in columns if c.get("name") == "Task Name"), None)
        status_col = next((c for c in columns if c.get("name") == "Status"), None)
        
        # Get status options
        todo_opt = next((o for o in status_col.get("options", []) if o.get("name") == "To Do"), None)
        in_progress_opt = next((o for o in status_col.get("options", []) if o.get("name") == "In Progress"), None)
        
        # Create tasks with different statuses
        self.session.post(f"{BASE_URL}/api/notion/databases/{db_id}/rows", json={
            "values": {name_col["column_id"]: "Task A", status_col["column_id"]: todo_opt["id"]}
        })
        self.session.post(f"{BASE_URL}/api/notion/databases/{db_id}/rows", json={
            "values": {name_col["column_id"]: "Task B", status_col["column_id"]: in_progress_opt["id"]}
        })
        
        # Get rows
        rows_response = self.session.get(f"{BASE_URL}/api/notion/databases/{db_id}/rows")
        assert rows_response.status_code == 200
        
        data = rows_response.json()
        rows = data.get("rows", [])
        assert len(rows) >= 2, f"Expected at least 2 rows, got {len(rows)}"
        
        print(f"Retrieved {len(rows)} rows for Kanban view")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/notion/databases/{db_id}")
    
    # ============== USER ASSIGNMENT TESTS ==============
    
    def test_get_users_for_assignment(self):
        """Test getting users list for task assignment"""
        response = self.session.get(f"{BASE_URL}/api/notion/users")
        assert response.status_code == 200
        
        users = response.json()
        assert isinstance(users, list)
        assert len(users) > 0, "No users found for assignment"
        
        # Check user structure
        user = users[0]
        assert "user_id" in user
        assert "name" in user or "email" in user
        
        print(f"Found {len(users)} users for assignment")
    
    def test_assign_task_to_user(self):
        """Test assigning a task to a user"""
        # Get users
        users_response = self.session.get(f"{BASE_URL}/api/notion/users")
        users = users_response.json()
        if not users:
            pytest.skip("No users available for assignment")
        
        user_id = users[0].get("user_id")
        
        # Create database
        db_response = self.session.post(
            f"{BASE_URL}/api/notion/databases/from-template/dm_task_board",
            json={"name": "TEST_Assignment"}
        )
        db = db_response.json()
        db_id = db.get("database_id")
        
        columns = db.get("columns", [])
        name_col = next((c for c in columns if c.get("name") == "Task Name"), None)
        person_col = next((c for c in columns if c.get("name") == "Assigned To"), None)
        
        # Create task with assignment
        task_response = self.session.post(
            f"{BASE_URL}/api/notion/databases/{db_id}/rows",
            json={"values": {name_col["column_id"]: "Assigned Task", person_col["column_id"]: user_id}}
        )
        assert task_response.status_code == 200
        
        task = task_response.json()
        assert task.get("values", {}).get(person_col["column_id"]) == user_id
        
        print(f"Assigned task to user: {user_id}")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/notion/databases/{db_id}")
    
    # ============== DATABASE OPERATIONS TESTS ==============
    
    def test_get_all_databases(self):
        """Test getting all databases"""
        response = self.session.get(f"{BASE_URL}/api/notion/databases")
        assert response.status_code == 200
        
        databases = response.json()
        assert isinstance(databases, list)
        print(f"Found {len(databases)} databases")
    
    def test_get_single_database(self):
        """Test getting a single database with columns"""
        # Create a database first
        db_response = self.session.post(
            f"{BASE_URL}/api/notion/databases",
            json={"name": "TEST_Single_DB"}
        )
        db = db_response.json()
        db_id = db.get("database_id")
        
        # Get the database
        get_response = self.session.get(f"{BASE_URL}/api/notion/databases/{db_id}")
        assert get_response.status_code == 200
        
        fetched_db = get_response.json()
        assert fetched_db.get("database_id") == db_id
        assert fetched_db.get("name") == "TEST_Single_DB"
        assert "columns" in fetched_db
        
        print(f"Fetched database: {fetched_db.get('name')}")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/notion/databases/{db_id}")
    
    def test_delete_database(self):
        """Test deleting a database"""
        # Create a database
        db_response = self.session.post(
            f"{BASE_URL}/api/notion/databases",
            json={"name": "TEST_Delete_DB"}
        )
        db = db_response.json()
        db_id = db.get("database_id")
        
        # Delete it
        delete_response = self.session.delete(f"{BASE_URL}/api/notion/databases/{db_id}")
        assert delete_response.status_code == 200
        
        # Verify it's gone
        get_response = self.session.get(f"{BASE_URL}/api/notion/databases/{db_id}")
        assert get_response.status_code == 404
        
        print(f"Successfully deleted database: {db_id}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
