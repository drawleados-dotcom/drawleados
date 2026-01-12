"""
Test Google Docs/Sheets Integration for Operations Module
Tests the document attachment feature for projects
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "vinoth@drawlead.com"
TEST_PASSWORD = "admin123"

# Sample Google URLs for testing
SAMPLE_SHEET_URL = "https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit"
SAMPLE_DOC_URL = "https://docs.google.com/document/d/1abc123def456/edit"
INVALID_URL = "https://example.com/not-a-google-doc"


@pytest.fixture(scope="module")
def session():
    """Create a requests session"""
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def auth_token(session):
    """Get authentication token"""
    response = session.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    if response.status_code == 200:
        token = response.json().get("session_token")
        session.headers.update({"Authorization": f"Bearer {token}"})
        return token
    pytest.skip(f"Authentication failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="module")
def test_database(session, auth_token):
    """Create a test database for document testing"""
    response = session.post(f"{BASE_URL}/api/notion/databases", json={
        "name": "TEST_DocIntegration_DB",
        "icon": "📄",
        "description": "Test database for Google Docs integration"
    })
    assert response.status_code == 200, f"Failed to create database: {response.text}"
    db = response.json()
    yield db
    # Cleanup
    session.delete(f"{BASE_URL}/api/notion/databases/{db['database_id']}")


@pytest.fixture(scope="module")
def test_project(session, auth_token, test_database):
    """Create a test project within the database"""
    response = session.post(
        f"{BASE_URL}/api/notion/databases/{test_database['database_id']}/projects",
        json={"name": "TEST_DocProject", "icon": "📁"}
    )
    assert response.status_code == 200, f"Failed to create project: {response.text}"
    project = response.json()
    yield project
    # Cleanup handled by database deletion


class TestGoogleDocsAPI:
    """Test Google Docs/Sheets API endpoints"""
    
    def test_get_project_documents_empty(self, session, auth_token, test_project):
        """Test getting documents from a project with no documents"""
        response = session.get(f"{BASE_URL}/api/notion/projects/{test_project['project_id']}/documents")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET /projects/{test_project['project_id']}/documents returns empty list")
    
    def test_add_google_sheet_to_project(self, session, auth_token, test_project):
        """Test adding a Google Sheet to a project"""
        response = session.post(
            f"{BASE_URL}/api/notion/projects/{test_project['project_id']}/documents",
            json={
                "url": SAMPLE_SHEET_URL,
                "name": "TEST_Sample Sheet"
            }
        )
        assert response.status_code == 200, f"Failed to add sheet: {response.text}"
        doc = response.json()
        
        # Verify response structure
        assert "doc_id" in doc
        assert doc["file_type"] == "sheet"
        assert doc["name"] == "TEST_Sample Sheet"
        assert "embed_url" in doc
        assert "file_id" in doc
        print(f"✓ POST /projects/{test_project['project_id']}/documents - Sheet added successfully")
        
        # Store for cleanup
        test_project["test_doc_id"] = doc["doc_id"]
        return doc
    
    def test_add_google_doc_to_project(self, session, auth_token, test_project):
        """Test adding a Google Doc to a project"""
        response = session.post(
            f"{BASE_URL}/api/notion/projects/{test_project['project_id']}/documents",
            json={
                "url": SAMPLE_DOC_URL,
                "name": "TEST_Sample Doc"
            }
        )
        assert response.status_code == 200, f"Failed to add doc: {response.text}"
        doc = response.json()
        
        # Verify response structure
        assert "doc_id" in doc
        assert doc["file_type"] == "doc"
        assert doc["name"] == "TEST_Sample Doc"
        print(f"✓ POST /projects/{test_project['project_id']}/documents - Doc added successfully")
        
        # Store for later tests
        test_project["test_doc_id_2"] = doc["doc_id"]
        return doc
    
    def test_add_invalid_url_fails(self, session, auth_token, test_project):
        """Test that invalid URLs are rejected"""
        response = session.post(
            f"{BASE_URL}/api/notion/projects/{test_project['project_id']}/documents",
            json={
                "url": INVALID_URL,
                "name": "Invalid Doc"
            }
        )
        assert response.status_code == 400, f"Expected 400 for invalid URL, got {response.status_code}"
        data = response.json()
        assert "detail" in data
        print(f"✓ Invalid URL correctly rejected with 400")
    
    def test_add_duplicate_document_fails(self, session, auth_token, test_project):
        """Test that duplicate documents are rejected"""
        # Try to add the same sheet again
        response = session.post(
            f"{BASE_URL}/api/notion/projects/{test_project['project_id']}/documents",
            json={
                "url": SAMPLE_SHEET_URL,
                "name": "Duplicate Sheet"
            }
        )
        assert response.status_code == 400, f"Expected 400 for duplicate, got {response.status_code}"
        data = response.json()
        assert "already added" in data.get("detail", "").lower()
        print(f"✓ Duplicate document correctly rejected")
    
    def test_get_project_documents_with_docs(self, session, auth_token, test_project):
        """Test getting documents after adding some"""
        response = session.get(f"{BASE_URL}/api/notion/projects/{test_project['project_id']}/documents")
        assert response.status_code == 200
        docs = response.json()
        
        assert isinstance(docs, list)
        assert len(docs) >= 2  # We added 2 documents
        
        # Verify document structure
        for doc in docs:
            assert "doc_id" in doc
            assert "file_type" in doc
            assert "name" in doc
            assert "url" in doc
            assert "embed_url" in doc
        
        print(f"✓ GET /projects/{test_project['project_id']}/documents returns {len(docs)} documents")
    
    def test_update_document_name(self, session, auth_token, test_project):
        """Test updating a document's name"""
        doc_id = test_project.get("test_doc_id")
        if not doc_id:
            pytest.skip("No test document available")
        
        response = session.put(
            f"{BASE_URL}/api/notion/projects/{test_project['project_id']}/documents/{doc_id}",
            json={"name": "TEST_Updated Sheet Name"}
        )
        assert response.status_code == 200, f"Failed to update: {response.text}"
        doc = response.json()
        assert doc["name"] == "TEST_Updated Sheet Name"
        print(f"✓ PUT /projects/{test_project['project_id']}/documents/{doc_id} - Name updated")
    
    def test_delete_document(self, session, auth_token, test_project):
        """Test removing a document from a project"""
        doc_id = test_project.get("test_doc_id_2")
        if not doc_id:
            pytest.skip("No test document available")
        
        response = session.delete(
            f"{BASE_URL}/api/notion/projects/{test_project['project_id']}/documents/{doc_id}"
        )
        assert response.status_code == 200, f"Failed to delete: {response.text}"
        
        # Verify it's gone
        response = session.get(f"{BASE_URL}/api/notion/projects/{test_project['project_id']}/documents")
        docs = response.json()
        doc_ids = [d["doc_id"] for d in docs]
        assert doc_id not in doc_ids
        print(f"✓ DELETE /projects/{test_project['project_id']}/documents/{doc_id} - Document removed")
    
    def test_get_project_activity(self, session, auth_token, test_project):
        """Test getting project activity log"""
        response = session.get(f"{BASE_URL}/api/notion/projects/{test_project['project_id']}/activity")
        assert response.status_code == 200
        activities = response.json()
        
        assert isinstance(activities, list)
        # Should have activity for document add/remove
        if len(activities) > 0:
            activity = activities[0]
            assert "activity_id" in activity
            assert "type" in activity
            assert "description" in activity
        print(f"✓ GET /projects/{test_project['project_id']}/activity returns {len(activities)} activities")
    
    def test_document_not_found(self, session, auth_token, test_project):
        """Test deleting non-existent document"""
        response = session.delete(
            f"{BASE_URL}/api/notion/projects/{test_project['project_id']}/documents/nonexistent_doc_id"
        )
        assert response.status_code == 404
        print(f"✓ DELETE non-existent document returns 404")
    
    def test_project_not_found_for_document(self, session, auth_token):
        """Test adding document to non-existent project"""
        response = session.post(
            f"{BASE_URL}/api/notion/projects/nonexistent_project_id/documents",
            json={
                "url": SAMPLE_SHEET_URL,
                "name": "Test"
            }
        )
        assert response.status_code == 404
        print(f"✓ POST to non-existent project returns 404")


class TestURLParsing:
    """Test URL parsing for different Google URL formats"""
    
    def test_standard_sheets_url(self, session, auth_token, test_database):
        """Test standard Google Sheets URL format"""
        # Create a new project for this test
        proj_response = session.post(
            f"{BASE_URL}/api/notion/databases/{test_database['database_id']}/projects",
            json={"name": "TEST_URLParsing", "icon": "🔗"}
        )
        project = proj_response.json()
        
        # Test standard sheets URL
        url = "https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit#gid=0"
        response = session.post(
            f"{BASE_URL}/api/notion/projects/{project['project_id']}/documents",
            json={"url": url, "name": "Standard Sheet URL"}
        )
        assert response.status_code == 200
        doc = response.json()
        assert doc["file_type"] == "sheet"
        assert doc["file_id"] == "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
        print(f"✓ Standard Sheets URL parsed correctly")
    
    def test_standard_docs_url(self, session, auth_token, test_database):
        """Test standard Google Docs URL format"""
        # Create a new project for this test
        proj_response = session.post(
            f"{BASE_URL}/api/notion/databases/{test_database['database_id']}/projects",
            json={"name": "TEST_DocsURLParsing", "icon": "📝"}
        )
        project = proj_response.json()
        
        # Test standard docs URL
        url = "https://docs.google.com/document/d/1abc123def456ghi789/edit"
        response = session.post(
            f"{BASE_URL}/api/notion/projects/{project['project_id']}/documents",
            json={"url": url, "name": "Standard Doc URL"}
        )
        assert response.status_code == 200
        doc = response.json()
        assert doc["file_type"] == "doc"
        assert doc["file_id"] == "1abc123def456ghi789"
        print(f"✓ Standard Docs URL parsed correctly")


class TestTaskDocumentLinking:
    """Test linking documents to tasks"""
    
    def test_link_document_to_task(self, session, auth_token, test_database, test_project):
        """Test linking a document to a task"""
        # First, create a task
        task_response = session.post(
            f"{BASE_URL}/api/notion/databases/{test_database['database_id']}/rows",
            json={"values": {}, "project_id": test_project['project_id']}
        )
        assert task_response.status_code == 200
        task = task_response.json()
        
        # Get a document ID
        docs_response = session.get(f"{BASE_URL}/api/notion/projects/{test_project['project_id']}/documents")
        docs = docs_response.json()
        if not docs:
            pytest.skip("No documents available for linking")
        
        doc_id = docs[0]["doc_id"]
        
        # Link document to task
        response = session.post(
            f"{BASE_URL}/api/notion/rows/{task['row_id']}/link-document",
            json={"doc_id": doc_id}
        )
        assert response.status_code == 200
        print(f"✓ Document linked to task successfully")
    
    def test_unlink_document_from_task(self, session, auth_token, test_database, test_project):
        """Test unlinking a document from a task"""
        # Create a task and link a document
        task_response = session.post(
            f"{BASE_URL}/api/notion/databases/{test_database['database_id']}/rows",
            json={"values": {}, "project_id": test_project['project_id']}
        )
        task = task_response.json()
        
        docs_response = session.get(f"{BASE_URL}/api/notion/projects/{test_project['project_id']}/documents")
        docs = docs_response.json()
        if not docs:
            pytest.skip("No documents available")
        
        doc_id = docs[0]["doc_id"]
        
        # Link first
        session.post(
            f"{BASE_URL}/api/notion/rows/{task['row_id']}/link-document",
            json={"doc_id": doc_id}
        )
        
        # Then unlink
        response = session.delete(
            f"{BASE_URL}/api/notion/rows/{task['row_id']}/link-document/{doc_id}"
        )
        assert response.status_code == 200
        print(f"✓ Document unlinked from task successfully")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
