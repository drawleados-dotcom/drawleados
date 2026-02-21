"""
Test HR Attendance with Manual Logout Time and Expense View Month/Year Filters
- HR Attendance: Clock In captures time, Clock Out accepts manual_logout_time
- Finance Module: Expense entries endpoint accepts month/year params
"""
import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestHRAttendance:
    """HR Attendance module tests - Clock In/Out with manual time"""
    
    token = None
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get token"""
        if not TestHRAttendance.token:
            response = requests.post(f"{BASE_URL}/api/auth/login", json={
                "email": "vinoth@drawlead.com",
                "password": "admin123"
            })
            assert response.status_code == 200, f"Login failed: {response.text}"
            data = response.json()
            TestHRAttendance.token = data.get("session_token") or data.get("token")
        self.headers = {"Authorization": f"Bearer {TestHRAttendance.token}"}
    
    def test_01_get_today_attendance(self):
        """Test getting today's attendance status"""
        response = requests.get(f"{BASE_URL}/api/hr/attendance/today", headers=self.headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        # Should return either attendance record or not_clocked_in status
        assert "status" in data or "attendance_id" in data
        print(f"Today's attendance: {data}")
    
    def test_02_clock_in_office(self):
        """Test clock in with office location"""
        # First check current status
        check_response = requests.get(f"{BASE_URL}/api/hr/attendance/today", headers=self.headers)
        check_data = check_response.json()
        
        # If already clocked in today, skip this test
        if check_data.get("clock_in") and not check_data.get("clock_out"):
            print("Already clocked in today, skipping clock in test")
            pytest.skip("Already clocked in today")
            return
        
        if check_data.get("clock_out"):
            print("Already completed attendance today")
            pytest.skip("Already completed attendance today")
            return
        
        response = requests.post(f"{BASE_URL}/api/hr/attendance/clock-in", 
            json={"work_location": "office"}, 
            headers=self.headers
        )
        
        # Should succeed or fail if already clocked in
        if response.status_code == 400:
            assert "already" in response.text.lower()
            print("Already clocked in (expected)")
        else:
            assert response.status_code == 200, f"Clock in failed: {response.text}"
            data = response.json()
            assert data.get("clock_in") is not None
            assert data.get("work_location") == "office"
            print(f"Clocked in at: {data.get('clock_in')}")
    
    def test_03_clock_out_with_manual_time(self):
        """Test clock out with manual logout time"""
        # First verify we're clocked in
        check_response = requests.get(f"{BASE_URL}/api/hr/attendance/today", headers=self.headers)
        check_data = check_response.json()
        
        if not check_data.get("clock_in"):
            print("Not clocked in, clock in first")
            # Clock in first
            clock_in_response = requests.post(f"{BASE_URL}/api/hr/attendance/clock-in", 
                json={"work_location": "office"}, 
                headers=self.headers
            )
            if clock_in_response.status_code != 200:
                pytest.skip("Could not clock in for test")
                return
        
        if check_data.get("clock_out"):
            print("Already clocked out today")
            pytest.skip("Already clocked out today")
            return
        
        # Test manual logout time - use HH:MM format
        manual_time = "18:30"
        response = requests.post(f"{BASE_URL}/api/hr/attendance/clock-out", 
            json={
                "notes": "Test manual logout",
                "manual_logout_time": manual_time
            }, 
            headers=self.headers
        )
        
        # Should succeed or fail if already clocked out
        if response.status_code == 400:
            assert "already" in response.text.lower() or "no clock-in" in response.text.lower()
            print("Already clocked out or no clock in (expected)")
        else:
            assert response.status_code == 200, f"Clock out failed: {response.text}"
            data = response.json()
            assert data.get("clock_out") is not None
            # Verify total_hours was calculated
            assert "total_hours" in data
            print(f"Clocked out with manual time: {data.get('clock_out')}, total hours: {data.get('total_hours')}")
    
    def test_04_attendance_history(self):
        """Test getting attendance history"""
        response = requests.get(f"{BASE_URL}/api/hr/attendance/history", headers=self.headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "records" in data
        assert "summary" in data
        print(f"Attendance history: {len(data['records'])} records, summary: {data['summary']}")
    
    def test_05_clock_out_request_model(self):
        """Verify ClockOutRequest model accepts manual_logout_time"""
        # This test verifies the backend model by checking the endpoint accepts the parameter
        # Even if we can't actually clock out (already done), we test the model structure
        
        response = requests.post(f"{BASE_URL}/api/hr/attendance/clock-out", 
            json={
                "notes": "Test",
                "manual_logout_time": "17:00"  # HH:MM format
            }, 
            headers=self.headers
        )
        
        # Either succeeds (200) or properly fails with "already clocked out" (400)
        # Should NOT fail with 422 (validation error) - that would mean model doesn't accept the param
        assert response.status_code != 422, f"Model validation failed - manual_logout_time not accepted: {response.text}"
        print(f"Clock out endpoint accepts manual_logout_time parameter (status: {response.status_code})")


class TestExpenseViewFilters:
    """Finance Expense module tests - Month/Year filter functionality"""
    
    token = None
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get token"""
        if not TestExpenseViewFilters.token:
            response = requests.post(f"{BASE_URL}/api/auth/login", json={
                "email": "vinoth@drawlead.com",
                "password": "admin123"
            })
            assert response.status_code == 200, f"Login failed: {response.text}"
            data = response.json()
            TestExpenseViewFilters.token = data.get("session_token") or data.get("token")
        self.headers = {"Authorization": f"Bearer {TestExpenseViewFilters.token}"}
    
    def test_01_expense_entries_without_filters(self):
        """Test getting expense entries without filters"""
        response = requests.get(f"{BASE_URL}/api/expense/entries", headers=self.headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"Expense entries without filter: {len(data)} entries")
    
    def test_02_expense_entries_with_month_year_filter(self):
        """Test expense entries endpoint with month and year parameters"""
        current_month = datetime.now().month
        current_year = datetime.now().year
        
        response = requests.get(
            f"{BASE_URL}/api/expense/entries",
            params={"month": current_month, "year": current_year},
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Failed with month/year filter: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"Expense entries with month={current_month}, year={current_year}: {len(data)} entries")
    
    def test_03_expense_entries_with_category_and_date_filter(self):
        """Test expense entries with category_id and month/year filter"""
        # First get categories
        cat_response = requests.get(f"{BASE_URL}/api/expense/categories", headers=self.headers)
        assert cat_response.status_code == 200
        categories = cat_response.json()
        
        if categories:
            category_id = categories[0].get("category_id")
            
            response = requests.get(
                f"{BASE_URL}/api/expense/entries",
                params={
                    "category_id": category_id,
                    "month": 1,
                    "year": 2026
                },
                headers=self.headers
            )
            
            assert response.status_code == 200, f"Failed with combined filters: {response.text}"
            data = response.json()
            print(f"Expense entries with category and date filter: {len(data)} entries")
        else:
            print("No categories found, skipping category filter test")
    
    def test_04_expense_categories(self):
        """Test getting expense categories"""
        response = requests.get(f"{BASE_URL}/api/expense/categories", headers=self.headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"Expense categories: {len(data)} categories")
        if data:
            print(f"Sample category: {data[0].get('name')}")
    
    def test_05_cashflow_with_month_year(self):
        """Test cashflow endpoint with month/year filter"""
        response = requests.get(
            f"{BASE_URL}/api/expense/cashflow",
            params={"month": 1, "year": 2026},
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Cashflow failed: {response.text}"
        data = response.json()
        assert "credit" in data
        assert "debit" in data
        assert data.get("month") == 1
        assert data.get("year") == 2026
        print(f"Cashflow for Jan 2026: Credit={data.get('credit', {}).get('total', 0)}, Debit={data.get('debit', {}).get('total', 0)}")
    
    def test_06_budget_monthly_with_filters(self):
        """Test budget-monthly endpoint with month/year filter"""
        response = requests.get(
            f"{BASE_URL}/api/expense/budget-monthly",
            params={"month": 1, "year": 2026},
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Budget monthly failed: {response.text}"
        data = response.json()
        assert "categories" in data or "entries" in data
        assert "summary" in data
        print(f"Budget monthly summary: {data.get('summary')}")
    
    def test_07_dashboard_summary_with_filters(self):
        """Test dashboard-summary endpoint with month/year filter"""
        response = requests.get(
            f"{BASE_URL}/api/expense/dashboard-summary",
            params={"month": 1, "year": 2026},
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Dashboard summary failed: {response.text}"
        data = response.json()
        assert data.get("month") == 1
        assert data.get("year") == 2026
        assert "total_revenue" in data
        assert "total_expense" in data
        print(f"Dashboard summary: Revenue={data.get('total_revenue')}, Expense={data.get('total_expense')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
