"""
Test Calendar Page, Monthly Leave Balance, and Leave Verification Workflow
Tests for Drawlead OS HR Management features
"""
import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from previous iterations
SUPER_ADMIN_EMAIL = "vinoth@drawlead.com"
SUPER_ADMIN_PASSWORD = "admin123"

class TestAuthentication:
    """Test authentication and get token"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token for super admin"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        
        if response.status_code == 200:
            data = response.json()
            return data.get("session_token") or data.get("token")
        
        # Try alternate credentials
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "Vinoth@drawlead.com",
            "password": "6383145061"
        })
        
        if response.status_code == 200:
            data = response.json()
            return data.get("session_token") or data.get("token")
        
        pytest.skip(f"Authentication failed: {response.status_code} - {response.text}")
    
    def test_login_success(self, auth_token):
        """Verify login works"""
        assert auth_token is not None
        assert len(auth_token) > 0
        print(f"✓ Login successful, token obtained")


class TestMonthlyLeaveBalance:
    """Test /api/hr/leave/monthly-balance endpoint"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        
        if response.status_code == 200:
            data = response.json()
            return data.get("session_token") or data.get("token")
        
        # Try alternate credentials
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "Vinoth@drawlead.com",
            "password": "6383145061"
        })
        
        if response.status_code == 200:
            data = response.json()
            return data.get("session_token") or data.get("token")
        
        pytest.skip("Authentication failed")
    
    def test_monthly_balance_returns_correct_structure(self, auth_token):
        """Test monthly leave balance returns correct structure with 2 casual + 2 sick"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # Get current month balance
        now = datetime.now()
        response = requests.get(
            f"{BASE_URL}/api/hr/leave/monthly-balance?month={now.month}&year={now.year}",
            headers=headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify structure
        assert "month" in data, "Response should contain 'month'"
        assert "year" in data, "Response should contain 'year'"
        assert "monthly_allocation" in data, "Response should contain 'monthly_allocation'"
        assert "used" in data, "Response should contain 'used'"
        assert "remaining" in data, "Response should contain 'remaining'"
        
        # Verify monthly allocation is 2 casual + 2 sick
        assert data["monthly_allocation"]["casual"] == 2, "Monthly casual allocation should be 2"
        assert data["monthly_allocation"]["sick"] == 2, "Monthly sick allocation should be 2"
        
        # Verify remaining structure
        assert "casual" in data["remaining"], "Remaining should have 'casual'"
        assert "sick" in data["remaining"], "Remaining should have 'sick'"
        
        print(f"✓ Monthly leave balance structure correct: {data['monthly_allocation']}")
        print(f"  Remaining: casual={data['remaining']['casual']}, sick={data['remaining']['sick']}")
    
    def test_monthly_balance_without_params(self, auth_token):
        """Test monthly balance defaults to current month"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        response = requests.get(
            f"{BASE_URL}/api/hr/leave/monthly-balance",
            headers=headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        now = datetime.now()
        
        assert data["month"] == now.month, f"Should default to current month {now.month}"
        assert data["year"] == now.year, f"Should default to current year {now.year}"
        
        print(f"✓ Monthly balance defaults to current month: {data['month']}/{data['year']}")


class TestGoogleCalendarStatus:
    """Test /api/oauth/calendar/status endpoint"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        
        if response.status_code == 200:
            data = response.json()
            return data.get("session_token") or data.get("token")
        
        # Try alternate credentials
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "Vinoth@drawlead.com",
            "password": "6383145061"
        })
        
        if response.status_code == 200:
            data = response.json()
            return data.get("session_token") or data.get("token")
        
        pytest.skip("Authentication failed")
    
    def test_calendar_status_returns_connection_status(self, auth_token):
        """Test Google Calendar status endpoint returns connection status"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        response = requests.get(
            f"{BASE_URL}/api/oauth/calendar/status",
            headers=headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify structure - should have 'connected' field
        assert "connected" in data, "Response should contain 'connected' field"
        assert isinstance(data["connected"], bool), "'connected' should be boolean"
        
        print(f"✓ Google Calendar status: connected={data['connected']}")
        
        if data["connected"]:
            assert "google_email" in data, "If connected, should have google_email"
            print(f"  Connected email: {data.get('google_email')}")


class TestLeaveVerification:
    """Test /api/hr/leave/pending-verification endpoint"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        
        if response.status_code == 200:
            data = response.json()
            return data.get("session_token") or data.get("token")
        
        # Try alternate credentials
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "Vinoth@drawlead.com",
            "password": "6383145061"
        })
        
        if response.status_code == 200:
            data = response.json()
            return data.get("session_token") or data.get("token")
        
        pytest.skip("Authentication failed")
    
    def test_pending_verification_returns_list(self, auth_token):
        """Test pending verification endpoint returns list"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        response = requests.get(
            f"{BASE_URL}/api/hr/leave/pending-verification",
            headers=headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Should return a list (empty or with items)
        assert isinstance(data, list), "Response should be a list"
        
        print(f"✓ Pending verification returns list with {len(data)} items")
        
        # If there are items, verify structure
        if len(data) > 0:
            item = data[0]
            assert "leave_id" in item, "Leave item should have leave_id"
            assert "user_id" in item, "Leave item should have user_id"
            assert "status" in item, "Leave item should have status"
            print(f"  First item: {item.get('user_name')} - {item.get('leave_type')}")


class TestCompanyCalendar:
    """Test /api/hr/admin/calendar/{year}/{month} endpoint"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        
        if response.status_code == 200:
            data = response.json()
            return data.get("session_token") or data.get("token")
        
        # Try alternate credentials
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "Vinoth@drawlead.com",
            "password": "6383145061"
        })
        
        if response.status_code == 200:
            data = response.json()
            return data.get("session_token") or data.get("token")
        
        pytest.skip("Authentication failed")
    
    def test_get_company_calendar(self, auth_token):
        """Test getting company calendar for current month"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        now = datetime.now()
        response = requests.get(
            f"{BASE_URL}/api/hr/admin/calendar/{now.year}/{now.month}",
            headers=headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify structure
        assert "month" in data, "Response should contain 'month'"
        assert "year" in data, "Response should contain 'year'"
        assert "holidays" in data, "Response should contain 'holidays'"
        assert "working_days" in data, "Response should contain 'working_days'"
        
        assert data["month"] == now.month, f"Month should be {now.month}"
        assert data["year"] == now.year, f"Year should be {now.year}"
        assert isinstance(data["holidays"], list), "Holidays should be a list"
        
        print(f"✓ Company calendar for {now.month}/{now.year}")
        print(f"  Working days: {data['working_days']}, Holidays: {len(data['holidays'])}")


class TestAttendanceCalendar:
    """Test /api/hr/attendance/calendar/{year}/{month} endpoint"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        
        if response.status_code == 200:
            data = response.json()
            return data.get("session_token") or data.get("token")
        
        # Try alternate credentials
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "Vinoth@drawlead.com",
            "password": "6383145061"
        })
        
        if response.status_code == 200:
            data = response.json()
            return data.get("session_token") or data.get("token")
        
        pytest.skip("Authentication failed")
    
    def test_get_attendance_calendar(self, auth_token):
        """Test getting attendance calendar for current month"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        now = datetime.now()
        response = requests.get(
            f"{BASE_URL}/api/hr/attendance/calendar/{now.year}/{now.month}",
            headers=headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify structure
        assert "year" in data, "Response should contain 'year'"
        assert "month" in data, "Response should contain 'month'"
        assert "calendar_data" in data, "Response should contain 'calendar_data'"
        assert "summary" in data, "Response should contain 'summary'"
        
        print(f"✓ Attendance calendar for {now.month}/{now.year}")
        print(f"  Summary: {data.get('summary', {})}")


class TestHRAdminLeaveRequests:
    """Test HR Admin leave request endpoints"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        
        if response.status_code == 200:
            data = response.json()
            return data.get("session_token") or data.get("token")
        
        # Try alternate credentials
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "Vinoth@drawlead.com",
            "password": "6383145061"
        })
        
        if response.status_code == 200:
            data = response.json()
            return data.get("session_token") or data.get("token")
        
        pytest.skip("Authentication failed")
    
    def test_get_all_leave_requests(self, auth_token):
        """Test getting all leave requests for HR Admin"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        response = requests.get(
            f"{BASE_URL}/api/hr/admin/all-requests",
            headers=headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        print(f"✓ HR Admin all requests: {len(data)} leave requests")
    
    def test_get_pending_leave_requests(self, auth_token):
        """Test getting pending leave requests"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        response = requests.get(
            f"{BASE_URL}/api/hr/admin/all-requests?status=pending",
            headers=headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        # All items should have pending status
        for item in data:
            assert item.get("status") == "pending", f"Expected pending status, got {item.get('status')}"
        
        print(f"✓ Pending leave requests: {len(data)} items")


class TestLeaveTasksEndpoint:
    """Test /api/hr/leave/{leave_id}/tasks endpoint"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        
        if response.status_code == 200:
            data = response.json()
            return data.get("session_token") or data.get("token")
        
        # Try alternate credentials
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "Vinoth@drawlead.com",
            "password": "6383145061"
        })
        
        if response.status_code == 200:
            data = response.json()
            return data.get("session_token") or data.get("token")
        
        pytest.skip("Authentication failed")
    
    def test_get_leave_tasks_with_invalid_id(self, auth_token):
        """Test getting tasks for non-existent leave returns 404"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        response = requests.get(
            f"{BASE_URL}/api/hr/leave/invalid_leave_id/tasks",
            headers=headers
        )
        
        # Should return 404 for non-existent leave
        assert response.status_code == 404, f"Expected 404 for invalid leave_id, got {response.status_code}"
        
        print(f"✓ Leave tasks endpoint returns 404 for invalid leave_id")


class TestDashboardStats:
    """Test HR Admin dashboard stats"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        
        if response.status_code == 200:
            data = response.json()
            return data.get("session_token") or data.get("token")
        
        # Try alternate credentials
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "Vinoth@drawlead.com",
            "password": "6383145061"
        })
        
        if response.status_code == 200:
            data = response.json()
            return data.get("session_token") or data.get("token")
        
        pytest.skip("Authentication failed")
    
    def test_dashboard_stats(self, auth_token):
        """Test HR Admin dashboard stats endpoint"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        response = requests.get(
            f"{BASE_URL}/api/hr/admin/dashboard-stats",
            headers=headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify some expected fields
        assert isinstance(data, dict), "Response should be a dict"
        
        print(f"✓ Dashboard stats: {data}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
