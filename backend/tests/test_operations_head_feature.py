"""
Test Operations Head Feature - Tasks-only module access
Tests:
1. /api/departments/my-tasks - Returns tasks assigned to current user
2. /api/docs/my-documents - Returns documents created by current user
3. Login and redirect behavior for tasks-only users
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
OPS_HEAD_EMAIL = "opshead@drawlead.com"
OPS_HEAD_PASSWORD = "admin123"
ADMIN_EMAIL = "vinoth@drawlead.com"
ADMIN_PASSWORD = "admin123"


class TestOperationsHeadBackend:
    """Test backend APIs for Operations Head (tasks-only) user"""
    
    @pytest.fixture(scope="class")
    def ops_head_token(self):
        """Login as Operations Head user and get token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": OPS_HEAD_EMAIL,
            "password": OPS_HEAD_PASSWORD
        })
        if response.status_code == 200:
            data = response.json()
            return data.get("session_token") or data.get("token")
        pytest.skip(f"Operations Head login failed: {response.status_code} - {response.text}")
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Login as Super Admin and get token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            data = response.json()
            return data.get("session_token") or data.get("token")
        pytest.skip(f"Admin login failed: {response.status_code} - {response.text}")
    
    # ========== MY TASKS ENDPOINT ==========
    
    def test_my_tasks_endpoint_exists(self, ops_head_token):
        """Test that /api/departments/my-tasks endpoint exists and returns 200"""
        headers = {"Authorization": f"Bearer {ops_head_token}"}
        response = requests.get(f"{BASE_URL}/api/departments/my-tasks", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Expected list response"
        print(f"✓ /api/departments/my-tasks returns {len(data)} tasks")
    
    def test_my_tasks_returns_list(self, ops_head_token):
        """Test that my-tasks returns a list of tasks"""
        headers = {"Authorization": f"Bearer {ops_head_token}"}
        response = requests.get(f"{BASE_URL}/api/departments/my-tasks", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        # If there are tasks, verify structure
        if len(data) > 0:
            task = data[0]
            # Check expected fields
            assert "task_id" in task, "Task should have task_id"
            assert "task_name" in task, "Task should have task_name"
            print(f"✓ Task structure verified: {task.get('task_name')}")
    
    def test_my_tasks_requires_auth(self):
        """Test that my-tasks requires authentication"""
        response = requests.get(f"{BASE_URL}/api/departments/my-tasks")
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
        print("✓ /api/departments/my-tasks requires authentication")
    
    # ========== MY DOCUMENTS ENDPOINT ==========
    
    def test_my_documents_endpoint_exists(self, ops_head_token):
        """Test that /api/docs/my-documents endpoint exists and returns 200"""
        headers = {"Authorization": f"Bearer {ops_head_token}"}
        response = requests.get(f"{BASE_URL}/api/docs/my-documents", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Expected list response"
        print(f"✓ /api/docs/my-documents returns {len(data)} documents")
    
    def test_my_documents_returns_list(self, ops_head_token):
        """Test that my-documents returns a list of documents"""
        headers = {"Authorization": f"Bearer {ops_head_token}"}
        response = requests.get(f"{BASE_URL}/api/docs/my-documents", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        # If there are documents, verify structure
        if len(data) > 0:
            doc = data[0]
            assert "doc_id" in doc, "Document should have doc_id"
            assert "name" in doc, "Document should have name"
            print(f"✓ Document structure verified: {doc.get('name')}")
    
    def test_my_documents_requires_auth(self):
        """Test that my-documents requires authentication"""
        response = requests.get(f"{BASE_URL}/api/docs/my-documents")
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
        print("✓ /api/docs/my-documents requires authentication")
    
    def test_create_my_document(self, ops_head_token):
        """Test creating a personal document"""
        headers = {"Authorization": f"Bearer {ops_head_token}"}
        doc_data = {
            "name": "TEST_OpsHead_Personal_Sheet",
            "link": "https://docs.google.com/spreadsheets/d/test123",
            "doc_type": "sheet",
            "description": "Test personal document"
        }
        
        response = requests.post(f"{BASE_URL}/api/docs/my-documents", json=doc_data, headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("name") == doc_data["name"]
        assert data.get("doc_type") == "sheet"
        assert "doc_id" in data
        print(f"✓ Created personal document: {data.get('doc_id')}")
        
        # Cleanup - delete the test document
        doc_id = data.get("doc_id")
        if doc_id:
            requests.delete(f"{BASE_URL}/api/docs/documents/{doc_id}", headers=headers)
    
    # ========== USER MODULE ACCESS ==========
    
    def test_ops_head_user_has_tasks_module(self, ops_head_token):
        """Verify Operations Head user has tasks in module_access"""
        headers = {"Authorization": f"Bearer {ops_head_token}"}
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        user = response.json()
        
        module_access = user.get("module_access", [])
        assert "tasks" in module_access, f"Expected 'tasks' in module_access, got {module_access}"
        print(f"✓ Operations Head has module_access: {module_access}")
        
        # Verify user is NOT admin
        role = user.get("role", "")
        assert role not in ["admin", "super_admin"], f"Operations Head should not be admin, got role: {role}"
        print(f"✓ Operations Head role: {role}")
    
    def test_admin_user_has_full_access(self, admin_token):
        """Verify Admin user has full access (not tasks-only)"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        
        assert response.status_code == 200
        user = response.json()
        
        role = user.get("role", "")
        assert role in ["admin", "super_admin"], f"Expected admin role, got: {role}"
        print(f"✓ Admin user role: {role}")
    
    # ========== ADMIN CAN ACCESS ALL ENDPOINTS ==========
    
    def test_admin_can_access_my_tasks(self, admin_token):
        """Admin should also be able to access my-tasks endpoint"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/departments/my-tasks", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("✓ Admin can access /api/departments/my-tasks")
    
    def test_admin_can_access_my_documents(self, admin_token):
        """Admin should also be able to access my-documents endpoint"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/docs/my-documents", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("✓ Admin can access /api/docs/my-documents")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
