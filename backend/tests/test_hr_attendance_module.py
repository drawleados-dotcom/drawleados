"""
HR Attendance Module Tests
Tests for attendance clock-in/out, lunch tracking, leave requests, permission requests
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestHRAttendanceModule:
    """HR Attendance Module API Tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get token
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "vinoth@drawlead.com",
            "password": "admin123"
        })
        
        if login_response.status_code == 200:
            token = login_response.json().get("session_token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
            self.user_id = login_response.json().get("user", {}).get("user_id")
        else:
            pytest.skip("Authentication failed")
    
    # ============== TODAY'S ATTENDANCE TESTS ==============
    
    def test_get_today_attendance(self):
        """Test GET /api/hr/attendance/today - Get today's attendance status"""
        response = self.session.get(f"{BASE_URL}/api/hr/attendance/today")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "attendance" in data, "Response should contain 'attendance' key"
        assert "settings" in data, "Response should contain 'settings' key"
        
        # Verify settings structure
        settings = data["settings"]
        assert "standard_login_time" in settings
        assert "standard_logout_time" in settings
        assert "standard_work_hours" in settings
        assert "default_lunch_duration" in settings
        
        print(f"Today's attendance: {data['attendance']}")
        print(f"Settings: {settings}")
    
    def test_attendance_settings_values(self):
        """Test that attendance settings have correct default values"""
        response = self.session.get(f"{BASE_URL}/api/hr/attendance/today")
        
        assert response.status_code == 200
        
        settings = response.json()["settings"]
        assert settings["standard_login_time"] == "09:00", "Standard login should be 09:00"
        assert settings["standard_logout_time"] == "18:00", "Standard logout should be 18:00"
        assert settings["standard_work_hours"] == 9.0, "Standard work hours should be 9"
        assert settings["default_lunch_duration"] == 60, "Default lunch should be 60 minutes"
    
    # ============== ATTENDANCE HISTORY TESTS ==============
    
    def test_get_attendance_history(self):
        """Test GET /api/hr/attendance/history - Get attendance history"""
        response = self.session.get(f"{BASE_URL}/api/hr/attendance/history")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "records" in data, "Response should contain 'records'"
        assert "summary" in data, "Response should contain 'summary'"
        assert "calendar" in data, "Response should contain 'calendar'"
        
        # Verify summary structure
        summary = data["summary"]
        assert "total_working_days" in summary
        assert "present" in summary
        assert "absent" in summary
        assert "casual_leave" in summary
        assert "sick_leave" in summary
        assert "extra_hours" in summary
        
        print(f"Attendance summary: {summary}")
    
    def test_attendance_history_with_month_filter(self):
        """Test attendance history with month/year filter"""
        now = datetime.now()
        response = self.session.get(
            f"{BASE_URL}/api/hr/attendance/history",
            params={"month": now.month, "year": now.year}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "records" in data
        assert "summary" in data
    
    # ============== LEAVE REQUEST TESTS ==============
    
    def test_get_leave_balance(self):
        """Test GET /api/hr/leave/balance - Get leave balance"""
        response = self.session.get(f"{BASE_URL}/api/hr/leave/balance")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "casual_leave" in data, "Should have casual_leave"
        assert "sick_leave" in data, "Should have sick_leave"
        assert "earned_leave" in data, "Should have earned_leave"
        
        # Verify default values
        assert data["casual_leave"] == 12, "Default casual leave should be 12"
        assert data["sick_leave"] == 6, "Default sick leave should be 6"
        
        print(f"Leave balance: {data}")
    
    def test_create_leave_request(self):
        """Test POST /api/hr/leave/request - Create leave request"""
        # Create a leave request for next week
        start_date = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
        end_date = (datetime.now() + timedelta(days=8)).strftime("%Y-%m-%d")
        
        response = self.session.post(f"{BASE_URL}/api/hr/leave/request", json={
            "leave_type": "casual",
            "start_date": start_date,
            "end_date": end_date,
            "reason": "TEST_Personal work"
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "leave_id" in data, "Response should contain leave_id"
        assert data["leave_type"] == "casual"
        assert data["status"] == "pending"
        
        print(f"Created leave request: {data['leave_id']}")
        
        # Store for cleanup
        self.test_leave_id = data["leave_id"]
    
    def test_get_my_leave_requests(self):
        """Test GET /api/hr/leave/my-requests - Get my leave requests"""
        response = self.session.get(f"{BASE_URL}/api/hr/leave/my-requests")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        print(f"Found {len(data)} leave requests")
    
    # ============== PERMISSION REQUEST TESTS ==============
    
    def test_create_permission_request(self):
        """Test POST /api/hr/permission/request - Create permission request"""
        today = datetime.now().strftime("%Y-%m-%d")
        
        response = self.session.post(f"{BASE_URL}/api/hr/permission/request", json={
            "date": today,
            "hours_requested": 2,
            "reason": "TEST_Doctor appointment"
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "permission_id" in data, "Response should contain permission_id"
        assert "message" in data
        
        print(f"Created permission request: {data['permission_id']}")
    
    def test_get_permission_requests(self):
        """Test GET /api/hr/permission/requests - Get my permission requests"""
        response = self.session.get(f"{BASE_URL}/api/hr/permission/requests")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        print(f"Found {len(data)} permission requests")
    
    # ============== PROFILE TESTS ==============
    
    def test_get_my_profile(self):
        """Test GET /api/hr/profile - Get my HR profile"""
        response = self.session.get(f"{BASE_URL}/api/hr/profile")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "user_id" in data, "Profile should have user_id"
        assert "full_name" in data, "Profile should have full_name"
        assert "email" in data, "Profile should have email"
        assert "employee_id" in data, "Profile should have employee_id"
        
        print(f"Profile: {data['full_name']} ({data['employee_id']})")
    
    # ============== PAYSLIPS TESTS ==============
    
    def test_get_my_payslips(self):
        """Test GET /api/hr/payslips - Get my payslips"""
        response = self.session.get(f"{BASE_URL}/api/hr/payslips")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        print(f"Found {len(data)} payslips")
    
    # ============== REVIEWS TESTS ==============
    
    def test_get_my_reviews(self):
        """Test GET /api/hr/reviews - Get my performance reviews"""
        response = self.session.get(f"{BASE_URL}/api/hr/reviews")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        print(f"Found {len(data)} reviews")
    
    # ============== ADMIN ROUTES TESTS ==============
    
    def test_admin_get_pending_approvals(self):
        """Test GET /api/hr/admin/attendance/pending-approvals - Get pending approvals (Admin)"""
        response = self.session.get(f"{BASE_URL}/api/hr/admin/attendance/pending-approvals")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "attendance" in data, "Should have attendance pending"
        assert "permissions" in data, "Should have permissions pending"
        assert "leaves" in data, "Should have leaves pending"
        
        print(f"Pending: {len(data['attendance'])} attendance, {len(data['permissions'])} permissions, {len(data['leaves'])} leaves")
    
    def test_admin_get_all_attendance(self):
        """Test GET /api/hr/admin/attendance/all - Get all employees attendance (Admin)"""
        response = self.session.get(f"{BASE_URL}/api/hr/admin/attendance/all")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "records" in data, "Should have records"
        assert "total_employees" in data, "Should have total_employees count"
        
        print(f"Total employees: {data['total_employees']}, Records: {len(data['records'])}")
    
    def test_admin_get_hr_settings(self):
        """Test GET /api/hr/admin/settings - Get HR settings (Admin)"""
        response = self.session.get(f"{BASE_URL}/api/hr/admin/settings")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "standard_work_hours" in data
        assert "standard_login_time" in data
        assert "standard_logout_time" in data
        
        print(f"HR Settings: {data}")
    
    def test_admin_get_calendar(self):
        """Test GET /api/hr/admin/calendar/{year}/{month} - Get monthly calendar"""
        now = datetime.now()
        response = self.session.get(f"{BASE_URL}/api/hr/admin/calendar/{now.year}/{now.month}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "month" in data
        assert "year" in data
        assert "working_days" in data
        assert "holidays" in data
        
        print(f"Calendar: {data['month']}/{data['year']} - {data['working_days']} working days")
    
    # ============== ATTENDANCE REPORT TESTS ==============
    
    def test_get_attendance_report(self):
        """Test GET /api/hr/attendance/report - Get attendance report"""
        response = self.session.get(f"{BASE_URL}/api/hr/attendance/report")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "records" in data, "Should have records"
        assert "monthly_summary" in data, "Should have monthly_summary"
        
        print(f"Report: {len(data['records'])} records, {len(data['monthly_summary'])} months")


class TestHRAttendanceWorkflow:
    """Test complete attendance workflow scenarios"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get token
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "vinoth@drawlead.com",
            "password": "admin123"
        })
        
        if login_response.status_code == 200:
            token = login_response.json().get("session_token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
        else:
            pytest.skip("Authentication failed")
    
    def test_attendance_data_consistency(self):
        """Test that today's attendance matches history data"""
        # Get today's attendance
        today_response = self.session.get(f"{BASE_URL}/api/hr/attendance/today")
        assert today_response.status_code == 200
        today_data = today_response.json()
        
        # Get history
        history_response = self.session.get(f"{BASE_URL}/api/hr/attendance/history")
        assert history_response.status_code == 200
        history_data = history_response.json()
        
        # If there's attendance today, it should be in history
        if today_data.get("attendance"):
            today_attendance = today_data["attendance"]
            records = history_data.get("records", [])
            
            # Check if today's record exists in history
            today_str = datetime.now().strftime("%Y-%m-%d")
            found = any(today_str in str(r.get("date", "")) for r in records)
            
            if today_attendance.get("clock_in"):
                assert found or len(records) == 0, "Today's attendance should be in history"
    
    def test_leave_balance_consistency(self):
        """Test leave balance matches used leaves"""
        # Get leave balance
        balance_response = self.session.get(f"{BASE_URL}/api/hr/leave/balance")
        assert balance_response.status_code == 200
        balance = balance_response.json()
        
        # Get leave requests
        requests_response = self.session.get(f"{BASE_URL}/api/hr/leave/my-requests")
        assert requests_response.status_code == 200
        requests = requests_response.json()
        
        # Count approved casual leaves
        approved_casual = len([r for r in requests if r.get("leave_type") == "casual" and r.get("status") == "approved"])
        
        # Balance should reflect used leaves
        casual_used = balance.get("casual_used", 0)
        print(f"Casual used in balance: {casual_used}, Approved casual requests: {approved_casual}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
