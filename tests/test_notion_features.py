"""
Backend API Tests for Notion-like Database Features
Tests: Context menu actions (Favorite, Duplicate, Rename, Delete), Projects/Groups, View modes
"""
import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://drawlead-marketing.preview.emergentagent.com').rstrip('/')
SESSION_TOKEN = os.environ.get('SESSION_TOKEN', 'session_8a6198bf3e284b40a5ebd4bae372e0ca')

class TestNotionDatabases:
    """Notion Database CRUD and context menu actions"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.headers = {
            "Authorization": f"Bearer {SESSION_TOKEN}",
            "Content-Type": "application/json"
        }
    
    def test_get_databases_list(self):
        """Test /api/notion/databases returns list of databases"""
        response = requests.get(f"{BASE_URL}/api/notion/databases", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        if len(data) > 0:
            db = data[0]
            assert "database_id" in db
            assert "name" in db
            assert "columns" in db
        print(f"✓ Databases list returned {len(data)} databases")
    
    def test_create_database(self):
        """Test creating a new database"""
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        db_data = {
            "name": f"TEST_Database_{timestamp}",
            "icon": "📊",
            "description": "Test database for API testing",
            "category": "Testing"
        }
        
        response = requests.post(f"{BASE_URL}/api/notion/databases", headers=self.headers, json=db_data)
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == db_data["name"]
        assert "database_id" in data
        assert "columns" in data
        assert len(data["columns"]) >= 4  # Default columns: Name, Status, Priority, Due Date
        print(f"✓ Created database: {data['name']} with {len(data['columns'])} columns")
        return data["database_id"]
    
    def test_add_to_favorites(self):
        """Test adding database to favorites (context menu action)"""
        # First create a test database
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        db_data = {"name": f"TEST_Favorite_{timestamp}", "icon": "⭐"}
        create_response = requests.post(f"{BASE_URL}/api/notion/databases", headers=self.headers, json=db_data)
        assert create_response.status_code == 200
        database_id = create_response.json()["database_id"]
        
        # Add to favorites
        update_response = requests.put(
            f"{BASE_URL}/api/notion/databases/{database_id}", 
            headers=self.headers, 
            json={"is_favorite": True}
        )
        assert update_response.status_code == 200
        data = update_response.json()
        assert data.get("is_favorite") == True
        print(f"✓ Added database to favorites: {data['name']}")
        
        # Remove from favorites
        remove_response = requests.put(
            f"{BASE_URL}/api/notion/databases/{database_id}", 
            headers=self.headers, 
            json={"is_favorite": False}
        )
        assert remove_response.status_code == 200
        data = remove_response.json()
        assert data.get("is_favorite") == False
        print(f"✓ Removed database from favorites: {data['name']}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/notion/databases/{database_id}", headers=self.headers)
    
    def test_duplicate_database(self):
        """Test duplicating a database (context menu action)"""
        # First create a test database with a project and row
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        db_data = {"name": f"TEST_Original_{timestamp}", "icon": "📋"}
        create_response = requests.post(f"{BASE_URL}/api/notion/databases", headers=self.headers, json=db_data)
        assert create_response.status_code == 200
        original_id = create_response.json()["database_id"]
        
        # Add a project to original
        project_data = {"name": "Test Project", "icon": "📁"}
        proj_response = requests.post(
            f"{BASE_URL}/api/notion/databases/{original_id}/projects", 
            headers=self.headers, 
            json=project_data
        )
        assert proj_response.status_code == 200
        
        # Add a row to original
        row_data = {"values": {"test": "value"}}
        row_response = requests.post(
            f"{BASE_URL}/api/notion/databases/{original_id}/rows", 
            headers=self.headers, 
            json=row_data
        )
        assert row_response.status_code == 200
        
        # Duplicate the database
        dup_response = requests.post(
            f"{BASE_URL}/api/notion/databases/{original_id}/duplicate", 
            headers=self.headers, 
            json={}
        )
        assert dup_response.status_code == 200
        dup_data = dup_response.json()
        assert "(Copy)" in dup_data["name"]
        assert dup_data["database_id"] != original_id
        print(f"✓ Duplicated database: {dup_data['name']}")
        
        # Verify duplicate has projects
        dup_projects = requests.get(
            f"{BASE_URL}/api/notion/databases/{dup_data['database_id']}/projects", 
            headers=self.headers
        )
        assert dup_projects.status_code == 200
        assert len(dup_projects.json()) >= 1
        print(f"✓ Duplicate has {len(dup_projects.json())} projects")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/notion/databases/{original_id}", headers=self.headers)
        requests.delete(f"{BASE_URL}/api/notion/databases/{dup_data['database_id']}", headers=self.headers)
    
    def test_rename_database(self):
        """Test renaming a database (context menu action)"""
        # Create a test database
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        db_data = {"name": f"TEST_Rename_{timestamp}", "icon": "📝"}
        create_response = requests.post(f"{BASE_URL}/api/notion/databases", headers=self.headers, json=db_data)
        assert create_response.status_code == 200
        database_id = create_response.json()["database_id"]
        
        # Rename the database
        new_name = f"TEST_Renamed_{timestamp}"
        rename_response = requests.put(
            f"{BASE_URL}/api/notion/databases/{database_id}", 
            headers=self.headers, 
            json={"name": new_name}
        )
        assert rename_response.status_code == 200
        data = rename_response.json()
        assert data["name"] == new_name
        print(f"✓ Renamed database to: {data['name']}")
        
        # Verify rename persisted
        get_response = requests.get(f"{BASE_URL}/api/notion/databases/{database_id}", headers=self.headers)
        assert get_response.status_code == 200
        assert get_response.json()["name"] == new_name
        print(f"✓ Rename persisted in database")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/notion/databases/{database_id}", headers=self.headers)
    
    def test_delete_database(self):
        """Test deleting a database (context menu action - Move to Trash)"""
        # Create a test database
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        db_data = {"name": f"TEST_Delete_{timestamp}", "icon": "🗑️"}
        create_response = requests.post(f"{BASE_URL}/api/notion/databases", headers=self.headers, json=db_data)
        assert create_response.status_code == 200
        database_id = create_response.json()["database_id"]
        
        # Delete the database
        delete_response = requests.delete(f"{BASE_URL}/api/notion/databases/{database_id}", headers=self.headers)
        assert delete_response.status_code == 200
        print(f"✓ Deleted database: {database_id}")
        
        # Verify deletion
        get_response = requests.get(f"{BASE_URL}/api/notion/databases/{database_id}", headers=self.headers)
        assert get_response.status_code == 404
        print(f"✓ Database no longer exists (404)")


class TestNotionProjects:
    """Notion Projects/Groups within databases"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.headers = {
            "Authorization": f"Bearer {SESSION_TOKEN}",
            "Content-Type": "application/json"
        }
    
    def test_get_projects_in_database(self):
        """Test getting projects within a database"""
        # Get existing databases
        dbs_response = requests.get(f"{BASE_URL}/api/notion/databases", headers=self.headers)
        databases = dbs_response.json()
        
        if not databases:
            pytest.skip("No databases available")
        
        database_id = databases[0]["database_id"]
        response = requests.get(f"{BASE_URL}/api/notion/databases/{database_id}/projects", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Projects list returned {len(data)} projects for database {databases[0]['name']}")
    
    def test_create_project_in_database(self):
        """Test creating a new project/group within a database"""
        # Create a test database first
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        db_data = {"name": f"TEST_ProjectDB_{timestamp}", "icon": "📁"}
        db_response = requests.post(f"{BASE_URL}/api/notion/databases", headers=self.headers, json=db_data)
        assert db_response.status_code == 200
        database_id = db_response.json()["database_id"]
        
        # Create a project
        project_data = {"name": f"TEST_Project_{timestamp}", "icon": "📂"}
        response = requests.post(
            f"{BASE_URL}/api/notion/databases/{database_id}/projects", 
            headers=self.headers, 
            json=project_data
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == project_data["name"]
        assert "project_id" in data
        assert data["database_id"] == database_id
        print(f"✓ Created project: {data['name']} in database")
        
        # Verify project persisted
        get_response = requests.get(f"{BASE_URL}/api/notion/databases/{database_id}/projects", headers=self.headers)
        assert get_response.status_code == 200
        projects = get_response.json()
        assert any(p["project_id"] == data["project_id"] for p in projects)
        print(f"✓ Project persisted in database")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/notion/databases/{database_id}", headers=self.headers)
    
    def test_add_task_to_project(self):
        """Test adding a task/row to a specific project"""
        # Create a test database
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        db_data = {"name": f"TEST_TaskProjectDB_{timestamp}", "icon": "📋"}
        db_response = requests.post(f"{BASE_URL}/api/notion/databases", headers=self.headers, json=db_data)
        assert db_response.status_code == 200
        database_id = db_response.json()["database_id"]
        
        # Create a project
        project_data = {"name": f"TEST_TaskProject_{timestamp}", "icon": "📁"}
        proj_response = requests.post(
            f"{BASE_URL}/api/notion/databases/{database_id}/projects", 
            headers=self.headers, 
            json=project_data
        )
        assert proj_response.status_code == 200
        project_id = proj_response.json()["project_id"]
        
        # Create a row/task linked to the project
        row_data = {"values": {"name": "Test Task"}, "project_id": project_id}
        row_response = requests.post(
            f"{BASE_URL}/api/notion/databases/{database_id}/rows", 
            headers=self.headers, 
            json=row_data
        )
        assert row_response.status_code == 200
        row = row_response.json()
        assert row["project_id"] == project_id
        print(f"✓ Created task linked to project: {project_id}")
        
        # Verify task has project_id
        rows_response = requests.get(f"{BASE_URL}/api/notion/databases/{database_id}/rows", headers=self.headers)
        assert rows_response.status_code == 200
        rows = rows_response.json()["rows"]
        task = next((r for r in rows if r["row_id"] == row["row_id"]), None)
        assert task is not None
        assert task["project_id"] == project_id
        print(f"✓ Task project_id persisted correctly")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/notion/databases/{database_id}", headers=self.headers)
    
    def test_delete_project(self):
        """Test deleting a project moves tasks to ungrouped"""
        # Create a test database
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        db_data = {"name": f"TEST_DeleteProjectDB_{timestamp}", "icon": "📋"}
        db_response = requests.post(f"{BASE_URL}/api/notion/databases", headers=self.headers, json=db_data)
        assert db_response.status_code == 200
        database_id = db_response.json()["database_id"]
        
        # Create a project
        project_data = {"name": f"TEST_DeleteProject_{timestamp}", "icon": "📁"}
        proj_response = requests.post(
            f"{BASE_URL}/api/notion/databases/{database_id}/projects", 
            headers=self.headers, 
            json=project_data
        )
        assert proj_response.status_code == 200
        project_id = proj_response.json()["project_id"]
        
        # Create a task in the project
        row_data = {"values": {"name": "Task to be ungrouped"}, "project_id": project_id}
        row_response = requests.post(
            f"{BASE_URL}/api/notion/databases/{database_id}/rows", 
            headers=self.headers, 
            json=row_data
        )
        assert row_response.status_code == 200
        row_id = row_response.json()["row_id"]
        
        # Delete the project
        delete_response = requests.delete(
            f"{BASE_URL}/api/notion/databases/{database_id}/projects/{project_id}", 
            headers=self.headers
        )
        assert delete_response.status_code == 200
        print(f"✓ Deleted project: {project_id}")
        
        # Verify task is now ungrouped (project_id = null)
        rows_response = requests.get(f"{BASE_URL}/api/notion/databases/{database_id}/rows", headers=self.headers)
        rows = rows_response.json()["rows"]
        task = next((r for r in rows if r["row_id"] == row_id), None)
        assert task is not None
        assert task["project_id"] is None
        print(f"✓ Task moved to ungrouped (project_id = null)")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/notion/databases/{database_id}", headers=self.headers)


class TestNotionRows:
    """Notion Rows/Tasks CRUD operations"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.headers = {
            "Authorization": f"Bearer {SESSION_TOKEN}",
            "Content-Type": "application/json"
        }
    
    def test_get_rows_in_database(self):
        """Test getting rows from a database"""
        # Get existing databases
        dbs_response = requests.get(f"{BASE_URL}/api/notion/databases", headers=self.headers)
        databases = dbs_response.json()
        
        if not databases:
            pytest.skip("No databases available")
        
        database_id = databases[0]["database_id"]
        response = requests.get(f"{BASE_URL}/api/notion/databases/{database_id}/rows", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert "rows" in data
        assert isinstance(data["rows"], list)
        print(f"✓ Rows list returned {len(data['rows'])} rows for database {databases[0]['name']}")
    
    def test_create_row(self):
        """Test creating a new row/task"""
        # Create a test database
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        db_data = {"name": f"TEST_RowDB_{timestamp}", "icon": "📋"}
        db_response = requests.post(f"{BASE_URL}/api/notion/databases", headers=self.headers, json=db_data)
        assert db_response.status_code == 200
        database_id = db_response.json()["database_id"]
        
        # Create a row
        row_data = {"values": {"name": f"TEST_Task_{timestamp}"}}
        response = requests.post(
            f"{BASE_URL}/api/notion/databases/{database_id}/rows", 
            headers=self.headers, 
            json=row_data
        )
        assert response.status_code == 200
        data = response.json()
        assert "row_id" in data
        assert data["database_id"] == database_id
        print(f"✓ Created row: {data['row_id']}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/notion/databases/{database_id}", headers=self.headers)
    
    def test_update_cell(self):
        """Test updating a single cell value"""
        # Create a test database
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        db_data = {"name": f"TEST_CellDB_{timestamp}", "icon": "📋"}
        db_response = requests.post(f"{BASE_URL}/api/notion/databases", headers=self.headers, json=db_data)
        assert db_response.status_code == 200
        database = db_response.json()
        database_id = database["database_id"]
        
        # Get the first column ID (Name column)
        name_column = next((c for c in database["columns"] if c.get("is_primary") or c["name"] == "Name"), None)
        assert name_column is not None
        column_id = name_column["column_id"]
        
        # Create a row
        row_data = {"values": {}}
        row_response = requests.post(
            f"{BASE_URL}/api/notion/databases/{database_id}/rows", 
            headers=self.headers, 
            json=row_data
        )
        assert row_response.status_code == 200
        row_id = row_response.json()["row_id"]
        
        # Update the cell
        cell_data = {"column_id": column_id, "value": "Updated Task Name"}
        update_response = requests.put(
            f"{BASE_URL}/api/notion/databases/{database_id}/rows/{row_id}/cell", 
            headers=self.headers, 
            json=cell_data
        )
        assert update_response.status_code == 200
        data = update_response.json()
        assert data["values"].get(column_id) == "Updated Task Name"
        print(f"✓ Updated cell value to: {data['values'].get(column_id)}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/notion/databases/{database_id}", headers=self.headers)
    
    def test_delete_row(self):
        """Test deleting a row/task"""
        # Create a test database
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        db_data = {"name": f"TEST_DeleteRowDB_{timestamp}", "icon": "📋"}
        db_response = requests.post(f"{BASE_URL}/api/notion/databases", headers=self.headers, json=db_data)
        assert db_response.status_code == 200
        database_id = db_response.json()["database_id"]
        
        # Create a row
        row_data = {"values": {"name": "Task to delete"}}
        row_response = requests.post(
            f"{BASE_URL}/api/notion/databases/{database_id}/rows", 
            headers=self.headers, 
            json=row_data
        )
        assert row_response.status_code == 200
        row_id = row_response.json()["row_id"]
        
        # Delete the row
        delete_response = requests.delete(
            f"{BASE_URL}/api/notion/databases/{database_id}/rows/{row_id}", 
            headers=self.headers
        )
        assert delete_response.status_code == 200
        print(f"✓ Deleted row: {row_id}")
        
        # Verify deletion
        rows_response = requests.get(f"{BASE_URL}/api/notion/databases/{database_id}/rows", headers=self.headers)
        rows = rows_response.json()["rows"]
        assert not any(r["row_id"] == row_id for r in rows)
        print(f"✓ Row no longer exists")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/notion/databases/{database_id}", headers=self.headers)


class TestNotionTemplates:
    """Notion Templates tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.headers = {
            "Authorization": f"Bearer {SESSION_TOKEN}",
            "Content-Type": "application/json"
        }
    
    def test_get_templates(self):
        """Test getting available templates"""
        response = requests.get(f"{BASE_URL}/api/notion/templates", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 5  # Should have at least 5 templates
        
        # Verify template structure
        template = data[0]
        assert "id" in template
        assert "name" in template
        assert "icon" in template
        assert "columns" in template
        print(f"✓ Templates list returned {len(data)} templates")
    
    def test_create_from_template(self):
        """Test creating a database from template"""
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        
        response = requests.post(
            f"{BASE_URL}/api/notion/databases/from-template/project_tracker", 
            headers=self.headers, 
            json={"name": f"TEST_FromTemplate_{timestamp}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "database_id" in data
        assert len(data["columns"]) >= 5  # Project tracker has multiple columns
        print(f"✓ Created database from template: {data['name']} with {len(data['columns'])} columns")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/notion/databases/{data['database_id']}", headers=self.headers)


class TestNotionUsers:
    """Notion Users for person field"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.headers = {
            "Authorization": f"Bearer {SESSION_TOKEN}",
            "Content-Type": "application/json"
        }
    
    def test_get_users_for_assignment(self):
        """Test getting users for person field assignment"""
        response = requests.get(f"{BASE_URL}/api/notion/users", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        if len(data) > 0:
            user = data[0]
            assert "user_id" in user
            assert "name" in user
            assert "email" in user
        print(f"✓ Users list returned {len(data)} users for assignment")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
