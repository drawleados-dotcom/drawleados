"""
Test Employee Reviews API - HR Admin Review Tab
Tests for /api/hr/employee-reviews/ and /api/hr/performance-reviews endpoints
"""
import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestEmployeeReviewsAPI:
    """Test Employee Reviews endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with auth"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
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
    
    # ===== GET /api/hr/employee-reviews/employees =====
    def test_get_employees_for_review(self):
        """Test getting list of employees for review"""
        response = self.session.get(f"{BASE_URL}/api/hr/employee-reviews/employees")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        if len(data) > 0:
            employee = data[0]
            assert "user_id" in employee, "Employee should have user_id"
            assert "name" in employee, "Employee should have name"
            print(f"✓ Found {len(data)} employees for review")
    
    # ===== GET /api/hr/employee-reviews/employee/{employee_id}/summary =====
    def test_get_employee_review_summary_monthly(self):
        """Test getting employee summary for monthly review"""
        # First get an employee
        employees_response = self.session.get(f"{BASE_URL}/api/hr/employee-reviews/employees")
        if employees_response.status_code != 200 or len(employees_response.json()) == 0:
            pytest.skip("No employees available")
        
        employee_id = employees_response.json()[0]["user_id"]
        period = f"{datetime.now().year}-{datetime.now().month:02d}"
        
        response = self.session.get(
            f"{BASE_URL}/api/hr/employee-reviews/employee/{employee_id}/summary",
            params={"review_type": "monthly", "period": period}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "employee_id" in data, "Response should have employee_id"
        assert "attendance" in data, "Response should have attendance"
        assert "working_hours" in data, "Response should have working_hours"
        assert "delivery_timeline" in data, "Response should have delivery_timeline"
        
        # Validate attendance structure
        attendance = data["attendance"]
        assert "present_days" in attendance, "Attendance should have present_days"
        assert "absent_days" in attendance, "Attendance should have absent_days"
        assert "leave_days" in attendance, "Attendance should have leave_days"
        
        # Validate working hours structure
        working_hours = data["working_hours"]
        assert "total_hours" in working_hours, "Working hours should have total_hours"
        assert "extra_hours" in working_hours, "Working hours should have extra_hours"
        assert "average_daily" in working_hours, "Working hours should have average_daily"
        
        # Validate delivery timeline structure
        delivery = data["delivery_timeline"]
        assert "total_tasks" in delivery, "Delivery timeline should have total_tasks"
        assert "on_time" in delivery, "Delivery timeline should have on_time"
        assert "overdue" in delivery, "Delivery timeline should have overdue"
        
        print(f"✓ Monthly summary: Present={attendance['present_days']}, Tasks={delivery['total_tasks']}")
    
    def test_get_employee_review_summary_quarterly(self):
        """Test getting employee summary for quarterly review"""
        employees_response = self.session.get(f"{BASE_URL}/api/hr/employee-reviews/employees")
        if employees_response.status_code != 200 or len(employees_response.json()) == 0:
            pytest.skip("No employees available")
        
        employee_id = employees_response.json()[0]["user_id"]
        quarter = (datetime.now().month - 1) // 3 + 1
        period = f"{datetime.now().year}-Q{quarter}"
        
        response = self.session.get(
            f"{BASE_URL}/api/hr/employee-reviews/employee/{employee_id}/summary",
            params={"review_type": "quarterly", "period": period}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["review_type"] == "quarterly"
        assert data["period"] == period
        print(f"✓ Quarterly summary for {period}")
    
    def test_get_employee_review_summary_yearly(self):
        """Test getting employee summary for yearly review"""
        employees_response = self.session.get(f"{BASE_URL}/api/hr/employee-reviews/employees")
        if employees_response.status_code != 200 or len(employees_response.json()) == 0:
            pytest.skip("No employees available")
        
        employee_id = employees_response.json()[0]["user_id"]
        period = str(datetime.now().year)
        
        response = self.session.get(
            f"{BASE_URL}/api/hr/employee-reviews/employee/{employee_id}/summary",
            params={"review_type": "yearly", "period": period}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["review_type"] == "yearly"
        assert data["period"] == period
        print(f"✓ Yearly summary for {period}")
    
    # ===== GET /api/hr/employee-reviews/employee/{employee_id}/tasks =====
    def test_get_employee_tasks_all(self):
        """Test getting all employee tasks for review"""
        employees_response = self.session.get(f"{BASE_URL}/api/hr/employee-reviews/employees")
        if employees_response.status_code != 200 or len(employees_response.json()) == 0:
            pytest.skip("No employees available")
        
        employee_id = employees_response.json()[0]["user_id"]
        period = f"{datetime.now().year}-{datetime.now().month:02d}"
        
        response = self.session.get(
            f"{BASE_URL}/api/hr/employee-reviews/employee/{employee_id}/tasks",
            params={"review_type": "monthly", "period": period, "status_filter": "all"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ Found {len(data)} tasks for employee")
    
    def test_get_employee_tasks_on_time_filter(self):
        """Test getting on-time tasks only"""
        employees_response = self.session.get(f"{BASE_URL}/api/hr/employee-reviews/employees")
        if employees_response.status_code != 200 or len(employees_response.json()) == 0:
            pytest.skip("No employees available")
        
        employee_id = employees_response.json()[0]["user_id"]
        period = f"{datetime.now().year}-{datetime.now().month:02d}"
        
        response = self.session.get(
            f"{BASE_URL}/api/hr/employee-reviews/employee/{employee_id}/tasks",
            params={"review_type": "monthly", "period": period, "status_filter": "on_time"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("✓ On-time tasks filter works")
    
    def test_get_employee_tasks_overdue_filter(self):
        """Test getting overdue tasks only"""
        employees_response = self.session.get(f"{BASE_URL}/api/hr/employee-reviews/employees")
        if employees_response.status_code != 200 or len(employees_response.json()) == 0:
            pytest.skip("No employees available")
        
        employee_id = employees_response.json()[0]["user_id"]
        period = f"{datetime.now().year}-{datetime.now().month:02d}"
        
        response = self.session.get(
            f"{BASE_URL}/api/hr/employee-reviews/employee/{employee_id}/tasks",
            params={"review_type": "monthly", "period": period, "status_filter": "overdue"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("✓ Overdue tasks filter works")


class TestPerformanceReviewsCRUD:
    """Test Performance Reviews CRUD operations"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with auth"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
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
        
        # Get an employee for testing
        employees_response = self.session.get(f"{BASE_URL}/api/hr/employee-reviews/employees")
        if employees_response.status_code == 200 and len(employees_response.json()) > 0:
            self.test_employee_id = employees_response.json()[0]["user_id"]
        else:
            self.test_employee_id = None
    
    # ===== POST /api/hr/performance-reviews =====
    def test_create_performance_review_hr(self):
        """Test creating a performance review as HR"""
        if not self.test_employee_id:
            pytest.skip("No employee available for testing")
        
        # Use a unique period to avoid conflicts
        import uuid
        test_period = f"TEST-{uuid.uuid4().hex[:6]}"
        
        response = self.session.post(f"{BASE_URL}/api/hr/performance-reviews", json={
            "employee_id": self.test_employee_id,
            "review_type": "monthly",
            "period": test_period,
            "reviewer_role": "hr",
            "rating": 4,
            "review_text": "TEST_REVIEW: Good performance this month"
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "review_id" in data, "Response should have review_id"
        assert data["rating"] == 4, "Rating should be 4"
        assert data["reviewer_role"] == "hr", "Reviewer role should be hr"
        
        # Store for cleanup
        self.created_review_id = data["review_id"]
        print(f"✓ Created HR review: {data['review_id']}")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/hr/performance-reviews/{data['review_id']}")
    
    def test_create_performance_review_operations(self):
        """Test creating a performance review as Operations"""
        if not self.test_employee_id:
            pytest.skip("No employee available for testing")
        
        import uuid
        test_period = f"TEST-{uuid.uuid4().hex[:6]}"
        
        response = self.session.post(f"{BASE_URL}/api/hr/performance-reviews", json={
            "employee_id": self.test_employee_id,
            "review_type": "monthly",
            "period": test_period,
            "reviewer_role": "operations",
            "rating": 5,
            "review_text": "TEST_REVIEW: Excellent work on operations tasks"
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["rating"] == 5
        print(f"✓ Created Operations review: {data['review_id']}")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/hr/performance-reviews/{data['review_id']}")
    
    def test_create_performance_review_ceo(self):
        """Test creating a performance review as CEO"""
        if not self.test_employee_id:
            pytest.skip("No employee available for testing")
        
        import uuid
        test_period = f"TEST-{uuid.uuid4().hex[:6]}"
        
        response = self.session.post(f"{BASE_URL}/api/hr/performance-reviews", json={
            "employee_id": self.test_employee_id,
            "review_type": "monthly",
            "period": test_period,
            "reviewer_role": "ceo",
            "rating": 3,
            "review_text": "TEST_REVIEW: CEO review - meets expectations"
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["rating"] == 3
        print(f"✓ Created CEO review: {data['review_id']}")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/hr/performance-reviews/{data['review_id']}")
    
    def test_create_review_with_5_star_rating(self):
        """Test creating review with 5-star rating"""
        if not self.test_employee_id:
            pytest.skip("No employee available for testing")
        
        import uuid
        test_period = f"TEST-{uuid.uuid4().hex[:6]}"
        
        response = self.session.post(f"{BASE_URL}/api/hr/performance-reviews", json={
            "employee_id": self.test_employee_id,
            "review_type": "quarterly",
            "period": test_period,
            "reviewer_role": "hr",
            "rating": 5,
            "review_text": "TEST_REVIEW: Outstanding performance!"
        })
        
        assert response.status_code == 200
        data = response.json()
        assert data["rating"] == 5, "5-star rating should be saved"
        print("✓ 5-star rating works")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/hr/performance-reviews/{data['review_id']}")
    
    # ===== GET /api/hr/performance-reviews =====
    def test_get_performance_reviews_with_filters(self):
        """Test getting reviews with filters"""
        if not self.test_employee_id:
            pytest.skip("No employee available for testing")
        
        # Create a test review first
        import uuid
        test_period = f"TEST-{uuid.uuid4().hex[:6]}"
        
        create_response = self.session.post(f"{BASE_URL}/api/hr/performance-reviews", json={
            "employee_id": self.test_employee_id,
            "review_type": "monthly",
            "period": test_period,
            "reviewer_role": "hr",
            "rating": 4,
            "review_text": "TEST_REVIEW: Test review for filtering"
        })
        
        if create_response.status_code != 200:
            pytest.skip("Could not create test review")
        
        review_id = create_response.json()["review_id"]
        
        # Test filtering by employee_id
        response = self.session.get(
            f"{BASE_URL}/api/hr/performance-reviews",
            params={"employee_id": self.test_employee_id}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Found {len(data)} reviews for employee")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/hr/performance-reviews/{review_id}")
    
    # ===== PUT /api/hr/performance-reviews/{review_id} =====
    def test_update_performance_review(self):
        """Test updating a review"""
        if not self.test_employee_id:
            pytest.skip("No employee available for testing")
        
        import uuid
        test_period = f"TEST-{uuid.uuid4().hex[:6]}"
        
        # Create a review
        create_response = self.session.post(f"{BASE_URL}/api/hr/performance-reviews", json={
            "employee_id": self.test_employee_id,
            "review_type": "monthly",
            "period": test_period,
            "reviewer_role": "hr",
            "rating": 3,
            "review_text": "TEST_REVIEW: Initial review"
        })
        
        assert create_response.status_code == 200
        review_id = create_response.json()["review_id"]
        
        # Update the review
        update_response = self.session.put(f"{BASE_URL}/api/hr/performance-reviews/{review_id}", json={
            "rating": 5,
            "review_text": "TEST_REVIEW: Updated review - improved rating"
        })
        
        assert update_response.status_code == 200, f"Expected 200, got {update_response.status_code}: {update_response.text}"
        
        data = update_response.json()
        assert data["rating"] == 5, "Rating should be updated to 5"
        assert "Updated review" in data["review_text"], "Review text should be updated"
        print("✓ Review updated successfully")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/hr/performance-reviews/{review_id}")
    
    # ===== DELETE /api/hr/performance-reviews/{review_id} =====
    def test_delete_performance_review(self):
        """Test deleting a review"""
        if not self.test_employee_id:
            pytest.skip("No employee available for testing")
        
        import uuid
        test_period = f"TEST-{uuid.uuid4().hex[:6]}"
        
        # Create a review
        create_response = self.session.post(f"{BASE_URL}/api/hr/performance-reviews", json={
            "employee_id": self.test_employee_id,
            "review_type": "monthly",
            "period": test_period,
            "reviewer_role": "hr",
            "rating": 4,
            "review_text": "TEST_REVIEW: Review to be deleted"
        })
        
        assert create_response.status_code == 200
        review_id = create_response.json()["review_id"]
        
        # Delete the review
        delete_response = self.session.delete(f"{BASE_URL}/api/hr/performance-reviews/{review_id}")
        
        assert delete_response.status_code == 200, f"Expected 200, got {delete_response.status_code}: {delete_response.text}"
        
        data = delete_response.json()
        assert data.get("message") == "Review deleted"
        print("✓ Review deleted successfully")
        
        # Verify deletion
        get_response = self.session.get(
            f"{BASE_URL}/api/hr/performance-reviews",
            params={"employee_id": self.test_employee_id}
        )
        reviews = get_response.json()
        review_ids = [r.get("review_id") for r in reviews]
        assert review_id not in review_ids, "Deleted review should not appear in list"
    
    def test_duplicate_review_prevention(self):
        """Test that duplicate reviews for same period/role are prevented"""
        if not self.test_employee_id:
            pytest.skip("No employee available for testing")
        
        import uuid
        test_period = f"TEST-{uuid.uuid4().hex[:6]}"
        
        # Create first review
        first_response = self.session.post(f"{BASE_URL}/api/hr/performance-reviews", json={
            "employee_id": self.test_employee_id,
            "review_type": "monthly",
            "period": test_period,
            "reviewer_role": "hr",
            "rating": 4,
            "review_text": "TEST_REVIEW: First review"
        })
        
        assert first_response.status_code == 200
        review_id = first_response.json()["review_id"]
        
        # Try to create duplicate
        duplicate_response = self.session.post(f"{BASE_URL}/api/hr/performance-reviews", json={
            "employee_id": self.test_employee_id,
            "review_type": "monthly",
            "period": test_period,
            "reviewer_role": "hr",
            "rating": 5,
            "review_text": "TEST_REVIEW: Duplicate review"
        })
        
        assert duplicate_response.status_code == 400, "Duplicate review should be rejected"
        print("✓ Duplicate review prevention works")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/hr/performance-reviews/{review_id}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
