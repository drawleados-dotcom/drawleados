"""
Test Documentation Module - Testing Sheets and Docs CRUD operations
Tests: GET documents, POST document, PUT document, DELETE document, GET stats
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test data prefix for cleanup
TEST_PREFIX = f"TEST_DOC_{uuid.uuid4().hex[:8]}"

# Module level token storage
_token = None
_created_sheet_id = None
_created_doc_id = None


def get_auth_token():
    """Get or create auth token"""
    global _token
    if not _token:
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "vinoth@drawlead.com", "password": "admin123"}
        )
        if login_response.status_code == 200:
            _token = login_response.json().get("session_token")
    return _token


def get_headers():
    return {"Authorization": f"Bearer {get_auth_token()}"}


# ============== AUTHENTICATION TEST ==============
def test_01_admin_login():
    """Test admin login to get auth token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": "vinoth@drawlead.com", "password": "admin123"}
    )
    assert response.status_code == 200, f"Login failed: {response.text}"
    data = response.json()
    assert "session_token" in data
    global _token
    _token = data["session_token"]
    print(f"PASS: Admin login successful, token: {_token[:20]}...")


# ============== INITIAL STATS TEST ==============
def test_02_get_initial_stats():
    """Test getting document stats endpoint"""
    response = requests.get(
        f"{BASE_URL}/api/docs/stats",
        headers=get_headers()
    )
    assert response.status_code == 200, f"Stats failed: {response.text}"
    data = response.json()
    assert "sheets" in data
    assert "docs" in data
    assert "total" in data
    print(f"PASS: Initial stats - Sheets: {data['sheets']}, Docs: {data['docs']}, Total: {data['total']}")


# ============== CREATE SHEET TEST ==============
def test_03_create_sheet():
    """Test creating a new sheet document"""
    global _created_sheet_id
    sheet_data = {
        "name": f"{TEST_PREFIX}_Test Sales Report",
        "link": "https://docs.google.com/spreadsheets/d/1234567890/edit",
        "doc_type": "sheet",
        "description": "Test sheet for automation testing"
    }
    response = requests.post(
        f"{BASE_URL}/api/docs/documents",
        json=sheet_data,
        headers=get_headers()
    )
    assert response.status_code == 200, f"Create sheet failed: {response.text}"
    data = response.json()
    assert data["name"] == sheet_data["name"]
    assert data["link"] == sheet_data["link"]
    assert data["doc_type"] == "sheet"
    assert "doc_id" in data
    _created_sheet_id = data["doc_id"]
    print(f"PASS: Sheet created with ID: {data['doc_id']}")


# ============== CREATE DOCUMENT TEST ==============
def test_04_create_document():
    """Test creating a new doc document"""
    global _created_doc_id
    doc_data = {
        "name": f"{TEST_PREFIX}_Test Project Proposal",
        "link": "https://docs.google.com/document/d/abcdefghij/edit",
        "doc_type": "doc",
        "description": "Test document for automation testing"
    }
    response = requests.post(
        f"{BASE_URL}/api/docs/documents",
        json=doc_data,
        headers=get_headers()
    )
    assert response.status_code == 200, f"Create doc failed: {response.text}"
    data = response.json()
    assert data["name"] == doc_data["name"]
    assert data["link"] == doc_data["link"]
    assert data["doc_type"] == "doc"
    assert "doc_id" in data
    _created_doc_id = data["doc_id"]
    print(f"PASS: Document created with ID: {data['doc_id']}")


# ============== GET ALL DOCUMENTS TEST ==============
def test_05_get_all_documents():
    """Test getting all documents"""
    response = requests.get(
        f"{BASE_URL}/api/docs/documents",
        headers=get_headers()
    )
    assert response.status_code == 200, f"Get documents failed: {response.text}"
    data = response.json()
    assert isinstance(data, list)
    # Verify our created documents exist
    doc_ids = [d["doc_id"] for d in data]
    assert _created_sheet_id in doc_ids, "Created sheet not found in list"
    assert _created_doc_id in doc_ids, "Created doc not found in list"
    print(f"PASS: Retrieved {len(data)} documents, created sheet and doc found")


# ============== GET DOCUMENTS BY TYPE TEST ==============
def test_06_get_sheets_only():
    """Test filtering documents by type=sheet"""
    response = requests.get(
        f"{BASE_URL}/api/docs/documents?doc_type=sheet",
        headers=get_headers()
    )
    assert response.status_code == 200, f"Get sheets failed: {response.text}"
    data = response.json()
    assert isinstance(data, list)
    for doc in data:
        assert doc["doc_type"] == "sheet", f"Expected sheet but got {doc['doc_type']}"
    print(f"PASS: Retrieved {len(data)} sheets only")


def test_07_get_docs_only():
    """Test filtering documents by type=doc"""
    response = requests.get(
        f"{BASE_URL}/api/docs/documents?doc_type=doc",
        headers=get_headers()
    )
    assert response.status_code == 200, f"Get docs failed: {response.text}"
    data = response.json()
    assert isinstance(data, list)
    for doc in data:
        assert doc["doc_type"] == "doc", f"Expected doc but got {doc['doc_type']}"
    print(f"PASS: Retrieved {len(data)} docs only")


# ============== UPDATE DOCUMENT TEST ==============
def test_08_update_sheet():
    """Test updating a sheet document"""
    update_data = {
        "name": f"{TEST_PREFIX}_Updated Sales Report",
        "description": "Updated description for testing"
    }
    response = requests.put(
        f"{BASE_URL}/api/docs/documents/{_created_sheet_id}",
        json=update_data,
        headers=get_headers()
    )
    assert response.status_code == 200, f"Update sheet failed: {response.text}"
    data = response.json()
    assert data["name"] == update_data["name"]
    assert data["description"] == update_data["description"]
    print(f"PASS: Sheet updated successfully")


# ============== VERIFY UPDATE PERSISTED ==============
def test_09_verify_update_persisted():
    """Verify that the update was persisted in database"""
    response = requests.get(
        f"{BASE_URL}/api/docs/documents",
        headers=get_headers()
    )
    assert response.status_code == 200
    data = response.json()
    updated_sheet = next((d for d in data if d["doc_id"] == _created_sheet_id), None)
    assert updated_sheet is not None
    assert f"{TEST_PREFIX}_Updated Sales Report" == updated_sheet["name"]
    print(f"PASS: Update verified in database")


# ============== STATS AFTER CREATION TEST ==============
def test_10_stats_after_creation():
    """Test stats reflect new documents"""
    response = requests.get(
        f"{BASE_URL}/api/docs/stats",
        headers=get_headers()
    )
    assert response.status_code == 200, f"Stats failed: {response.text}"
    data = response.json()
    # Should have at least our 2 created documents
    assert data["sheets"] >= 1, "Should have at least 1 sheet"
    assert data["docs"] >= 1, "Should have at least 1 doc"
    assert data["total"] >= 2, "Should have at least 2 total documents"
    print(f"PASS: Stats after creation - Sheets: {data['sheets']}, Docs: {data['docs']}, Total: {data['total']}")


# ============== DELETE DOCUMENT TEST ==============
def test_11_delete_document():
    """Test soft deleting a document"""
    response = requests.delete(
        f"{BASE_URL}/api/docs/documents/{_created_doc_id}",
        headers=get_headers()
    )
    assert response.status_code == 200, f"Delete failed: {response.text}"
    data = response.json()
    assert data.get("message") == "Document deleted"
    print(f"PASS: Document soft deleted")


# ============== VERIFY DELETE ==============
def test_12_verify_delete():
    """Verify deleted document doesn't appear in list"""
    response = requests.get(
        f"{BASE_URL}/api/docs/documents",
        headers=get_headers()
    )
    assert response.status_code == 200
    data = response.json()
    doc_ids = [d["doc_id"] for d in data]
    assert _created_doc_id not in doc_ids, "Deleted doc should not appear in list"
    print(f"PASS: Deleted document not in list")


# ============== AUTHENTICATION REQUIRED TEST ==============
def test_13_auth_required_for_stats():
    """Test that authentication is required for stats endpoint"""
    response = requests.get(f"{BASE_URL}/api/docs/stats")
    assert response.status_code == 401, f"Should require auth: {response.text}"
    print(f"PASS: Stats endpoint requires authentication")


def test_14_auth_required_for_documents():
    """Test that authentication is required for documents endpoint"""
    response = requests.get(f"{BASE_URL}/api/docs/documents")
    assert response.status_code == 401, f"Should require auth: {response.text}"
    print(f"PASS: Documents endpoint requires authentication")


# ============== CLEANUP ==============
def test_15_cleanup_test_data():
    """Clean up remaining test sheet"""
    # Delete the sheet we created
    if _created_sheet_id:
        response = requests.delete(
            f"{BASE_URL}/api/docs/documents/{_created_sheet_id}",
            headers=get_headers()
        )
        assert response.status_code == 200
    print(f"PASS: Test data cleaned up")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
