"""
WFH/Remote Work Request API Tests
Tests for the Remote tab in HR Admin > Approvals section
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Module-level token storage
_auth_token = None
_created_wfh_ids = []

def get_auth_token():
    """Get authentication token"""
    global _auth_token
    if _auth_token:
        return _auth_token
    
    login_response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": "vinoth@drawlead.com", "password": "admin123"}
    )
    if login_response.status_code == 200:
        _auth_token = login_response.json().get("session_token")
    return _auth_token

def get_headers():
    token = get_auth_token()
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


class TestWFHRemoteRequests:
    """Test WFH/Remote Work Request APIs"""
    
    # ============ Authentication Tests ============
    def test_01_login_success(self):
        """Test admin login works"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "vinoth@drawlead.com", "password": "admin123"}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "session_token" in data, "session_token not in response"
        print(f"✓ Login successful, session_token received")
    
    # ============ WFH Request Creation Tests ============
    def test_02_create_wfh_request(self):
        """Test creating a WFH request"""
        token = get_auth_token()
        if not token:
            pytest.skip("No auth token available")
        
        start_date = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
        end_date = (datetime.now() + timedelta(days=9)).strftime("%Y-%m-%d")
        
        payload = {
            "start_date": start_date,
            "end_date": end_date,
            "reason": "TEST_WFH_Request - Family emergency",
            "work_plan": "Will complete all assigned tasks remotely",
            "contact_number": "+91-9876543210",
            "work_location": "home"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/hr/wfh/request",
            json=payload,
            headers=get_headers()
        )
        
        assert response.status_code == 200, f"Create WFH failed: {response.text}"
        data = response.json()
        assert "wfh_id" in data, "wfh_id not in response"
        assert "message" in data, "message not in response"
        
        _created_wfh_ids.append(data["wfh_id"])
        print(f"✓ WFH request created: {data['wfh_id']}")
    
    # ============ WFH Request Retrieval Tests ============
    def test_03_get_pending_wfh_requests(self):
        """Test getting pending WFH requests (HR admin)"""
        token = get_auth_token()
        if not token:
            pytest.skip("No auth token available")
        
        response = requests.get(
            f"{BASE_URL}/api/hr/wfh/pending",
            headers=get_headers()
        )
        
        assert response.status_code == 200, f"Get pending WFH failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ Got {len(data)} pending WFH requests")
        
        # Verify structure if there are requests
        if len(data) > 0:
            req = data[0]
            assert "wfh_id" in req, "wfh_id missing"
            assert "employee_name" in req, "employee_name missing"
            assert "status" in req, "status missing"
            assert "start_date" in req, "start_date missing"
            assert "end_date" in req, "end_date missing"
            assert "days" in req, "days missing"
            assert "reason" in req, "reason missing"
            print(f"✓ WFH request structure verified")
    
    def test_04_get_all_wfh_requests(self):
        """Test getting all WFH requests with filters"""
        token = get_auth_token()
        if not token:
            pytest.skip("No auth token available")
        
        response = requests.get(
            f"{BASE_URL}/api/hr/wfh/all",
            headers=get_headers()
        )
        
        assert response.status_code == 200, f"Get all WFH failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ Got {len(data)} total WFH requests")
    
    def test_05_get_all_wfh_with_status_filter(self):
        """Test getting WFH requests filtered by status"""
        token = get_auth_token()
        if not token:
            pytest.skip("No auth token available")
        
        for status in ['pending', 'approved', 'rejected', 'all']:
            response = requests.get(
                f"{BASE_URL}/api/hr/wfh/all?status={status}",
                headers=get_headers()
            )
            assert response.status_code == 200, f"Get WFH with status={status} failed: {response.text}"
            print(f"✓ Status filter '{status}' works")
    
    def test_06_get_my_wfh_requests(self):
        """Test getting current user's WFH requests"""
        token = get_auth_token()
        if not token:
            pytest.skip("No auth token available")
        
        response = requests.get(
            f"{BASE_URL}/api/hr/wfh/my-requests",
            headers=get_headers()
        )
        
        assert response.status_code == 200, f"Get my WFH failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ Got {len(data)} of my WFH requests")
    
    # ============ WFH Request Detail Tests ============
    def test_07_get_single_wfh_request(self):
        """Test getting a single WFH request by ID"""
        token = get_auth_token()
        if not token:
            pytest.skip("No auth token available")
        
        # First create a request
        start_date = (datetime.now() + timedelta(days=10)).strftime("%Y-%m-%d")
        end_date = (datetime.now() + timedelta(days=11)).strftime("%Y-%m-%d")
        
        create_response = requests.post(
            f"{BASE_URL}/api/hr/wfh/request",
            json={
                "start_date": start_date,
                "end_date": end_date,
                "reason": "TEST_WFH_Detail - Testing detail view",
                "work_plan": "Complete project documentation",
                "contact_number": "+91-1234567890",
                "work_location": "home"
            },
            headers=get_headers()
        )
        assert create_response.status_code == 200
        wfh_id = create_response.json()["wfh_id"]
        _created_wfh_ids.append(wfh_id)
        
        response = requests.get(
            f"{BASE_URL}/api/hr/wfh/{wfh_id}",
            headers=get_headers()
        )
        
        assert response.status_code == 200, f"Get single WFH failed: {response.text}"
        data = response.json()
        assert data["wfh_id"] == wfh_id, "wfh_id mismatch"
        assert "employee_name" in data, "employee_name missing"
        assert "reason" in data, "reason missing"
        assert "work_plan" in data, "work_plan missing"
        assert "contact_number" in data, "contact_number missing"
        assert "work_location" in data, "work_location missing"
        print(f"✓ Single WFH request retrieved with all details")
    
    # ============ WFH Approval Tests ============
    def test_08_approve_wfh_request(self):
        """Test approving a WFH request with remarks"""
        token = get_auth_token()
        if not token:
            pytest.skip("No auth token available")
        
        # First create a request
        start_date = (datetime.now() + timedelta(days=12)).strftime("%Y-%m-%d")
        end_date = (datetime.now() + timedelta(days=13)).strftime("%Y-%m-%d")
        
        create_response = requests.post(
            f"{BASE_URL}/api/hr/wfh/request",
            json={
                "start_date": start_date,
                "end_date": end_date,
                "reason": "TEST_WFH_Approve - Testing approval",
                "work_plan": "Complete sprint tasks",
                "contact_number": "+91-9999999999",
                "work_location": "home"
            },
            headers=get_headers()
        )
        assert create_response.status_code == 200
        wfh_id = create_response.json()["wfh_id"]
        _created_wfh_ids.append(wfh_id)
        
        response = requests.post(
            f"{BASE_URL}/api/hr/wfh/{wfh_id}/approve",
            json={"remarks": "Approved for remote work. Please ensure availability during work hours."},
            headers=get_headers()
        )
        
        assert response.status_code == 200, f"Approve WFH failed: {response.text}"
        data = response.json()
        assert "message" in data, "message missing"
        print(f"✓ WFH request approved with remarks")
        
        # Verify the status changed
        verify_response = requests.get(
            f"{BASE_URL}/api/hr/wfh/{wfh_id}",
            headers=get_headers()
        )
        assert verify_response.status_code == 200
        verify_data = verify_response.json()
        assert verify_data["status"] == "approved", f"Status should be approved, got {verify_data['status']}"
        assert "approved_by" in verify_data, "approved_by missing"
        assert "approved_by_name" in verify_data, "approved_by_name missing"
        assert verify_data["remarks"] == "Approved for remote work. Please ensure availability during work hours."
        print(f"✓ WFH approval verified - status: {verify_data['status']}")
    
    # ============ WFH Rejection Tests ============
    def test_09_reject_wfh_request(self):
        """Test rejecting a WFH request with reason"""
        token = get_auth_token()
        if not token:
            pytest.skip("No auth token available")
        
        # First create a request
        start_date = (datetime.now() + timedelta(days=14)).strftime("%Y-%m-%d")
        end_date = (datetime.now() + timedelta(days=15)).strftime("%Y-%m-%d")
        
        create_response = requests.post(
            f"{BASE_URL}/api/hr/wfh/request",
            json={
                "start_date": start_date,
                "end_date": end_date,
                "reason": "TEST_WFH_Reject - Testing rejection",
                "work_plan": "Complete testing tasks",
                "contact_number": "+91-8888888888",
                "work_location": "home"
            },
            headers=get_headers()
        )
        assert create_response.status_code == 200
        wfh_id = create_response.json()["wfh_id"]
        _created_wfh_ids.append(wfh_id)
        
        response = requests.post(
            f"{BASE_URL}/api/hr/wfh/{wfh_id}/reject",
            json={"reason": "Critical project deadline requires office presence."},
            headers=get_headers()
        )
        
        assert response.status_code == 200, f"Reject WFH failed: {response.text}"
        data = response.json()
        assert "message" in data, "message missing"
        print(f"✓ WFH request rejected with reason")
        
        # Verify the status changed
        verify_response = requests.get(
            f"{BASE_URL}/api/hr/wfh/{wfh_id}",
            headers=get_headers()
        )
        assert verify_response.status_code == 200
        verify_data = verify_response.json()
        assert verify_data["status"] == "rejected", f"Status should be rejected, got {verify_data['status']}"
        assert "rejected_by" in verify_data, "rejected_by missing"
        assert "rejected_by_name" in verify_data, "rejected_by_name missing"
        assert verify_data["rejection_reason"] == "Critical project deadline requires office presence."
        print(f"✓ WFH rejection verified - status: {verify_data['status']}")
    
    def test_10_reject_wfh_without_reason_fails(self):
        """Test that rejecting without reason fails"""
        token = get_auth_token()
        if not token:
            pytest.skip("No auth token available")
        
        # First create a request
        start_date = (datetime.now() + timedelta(days=16)).strftime("%Y-%m-%d")
        end_date = (datetime.now() + timedelta(days=17)).strftime("%Y-%m-%d")
        
        create_response = requests.post(
            f"{BASE_URL}/api/hr/wfh/request",
            json={
                "start_date": start_date,
                "end_date": end_date,
                "reason": "TEST_WFH_NoReason - Testing rejection without reason",
                "work_plan": "Test work plan",
                "contact_number": "+91-7777777777",
                "work_location": "home"
            },
            headers=get_headers()
        )
        assert create_response.status_code == 200
        wfh_id = create_response.json()["wfh_id"]
        _created_wfh_ids.append(wfh_id)
        
        response = requests.post(
            f"{BASE_URL}/api/hr/wfh/{wfh_id}/reject",
            json={"reason": ""},  # Empty reason
            headers=get_headers()
        )
        
        assert response.status_code == 400, f"Should fail with 400, got {response.status_code}"
        print(f"✓ Rejection without reason correctly fails with 400")
    
    # ============ WFH Cancellation Tests ============
    def test_11_cancel_wfh_request(self):
        """Test cancelling a pending WFH request"""
        token = get_auth_token()
        if not token:
            pytest.skip("No auth token available")
        
        # First create a request
        start_date = (datetime.now() + timedelta(days=18)).strftime("%Y-%m-%d")
        end_date = (datetime.now() + timedelta(days=19)).strftime("%Y-%m-%d")
        
        create_response = requests.post(
            f"{BASE_URL}/api/hr/wfh/request",
            json={
                "start_date": start_date,
                "end_date": end_date,
                "reason": "TEST_WFH_Cancel - Testing cancellation",
                "work_plan": "Test work plan",
                "contact_number": "+91-6666666666",
                "work_location": "home"
            },
            headers=get_headers()
        )
        assert create_response.status_code == 200
        wfh_id = create_response.json()["wfh_id"]
        
        response = requests.delete(
            f"{BASE_URL}/api/hr/wfh/{wfh_id}",
            headers=get_headers()
        )
        
        assert response.status_code == 200, f"Cancel WFH failed: {response.text}"
        data = response.json()
        assert "message" in data, "message missing"
        print(f"✓ WFH request cancelled")
        
        # Verify it's deleted
        verify_response = requests.get(
            f"{BASE_URL}/api/hr/wfh/{wfh_id}",
            headers=get_headers()
        )
        assert verify_response.status_code == 404, "Deleted request should return 404"
        print(f"✓ Cancelled WFH request no longer exists")
    
    # ============ WFH Request Not Found Tests ============
    def test_12_get_nonexistent_wfh_request(self):
        """Test getting a non-existent WFH request returns 404"""
        token = get_auth_token()
        if not token:
            pytest.skip("No auth token available")
        
        response = requests.get(
            f"{BASE_URL}/api/hr/wfh/wfh_nonexistent123",
            headers=get_headers()
        )
        
        assert response.status_code == 404, f"Should return 404, got {response.status_code}"
        print(f"✓ Non-existent WFH request returns 404")
    
    def test_13_approve_nonexistent_wfh_request(self):
        """Test approving a non-existent WFH request returns 404"""
        token = get_auth_token()
        if not token:
            pytest.skip("No auth token available")
        
        response = requests.post(
            f"{BASE_URL}/api/hr/wfh/wfh_nonexistent123/approve",
            json={"remarks": "Test"},
            headers=get_headers()
        )
        
        assert response.status_code == 404, f"Should return 404, got {response.status_code}"
        print(f"✓ Approve non-existent WFH request returns 404")


def test_cleanup():
    """Cleanup test data"""
    global _created_wfh_ids
    token = get_auth_token()
    if token:
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        for wfh_id in _created_wfh_ids:
            try:
                requests.delete(f"{BASE_URL}/api/hr/wfh/{wfh_id}", headers=headers)
            except:
                pass
    _created_wfh_ids = []
    print(f"✓ Cleanup completed")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
