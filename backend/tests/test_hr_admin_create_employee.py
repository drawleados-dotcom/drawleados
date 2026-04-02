"""
HR Admin Create Employee Module Tests
Tests the Add Employee feature in HR Admin page
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://drawlead-docs.preview.emergentagent.com').rstrip('/')

# Test credentials
ADMIN_EMAIL = "vinoth@drawlead.com"
ADMIN_PASSWORD = "admin123"


class TestHRAdminCreateEmployee:
    """Test HR Admin Create Employee functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get admin token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        self.token = data.get("session_token")
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        
        # Track created employees for cleanup
        self.created_employees = []
        
        yield
        
        # Cleanup - Note: No delete endpoint available, so we just track what was created
    
    def test_hr_admin_dashboard_stats(self):
        """Test HR Admin dashboard stats endpoint"""
        response = self.session.get(f"{BASE_URL}/api/hr/admin/dashboard-stats")
        assert response.status_code == 200, f"Dashboard stats failed: {response.text}"
        
        data = response.json()
        assert "total_employees" in data
        assert "present_today" in data
        assert "pending_leaves" in data
        print(f"Dashboard stats: {data}")
    
    def test_hr_admin_employees_list(self):
        """Test HR Admin employees list endpoint"""
        response = self.session.get(f"{BASE_URL}/api/hr/admin/employees")
        assert response.status_code == 200, f"Employees list failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} employees")
        
        # Verify employee structure
        if len(data) > 0:
            emp = data[0]
            assert "user_id" in emp
            assert "email" in emp
            assert "name" in emp
            assert "role" in emp
    
    def test_create_employee_basic(self):
        """Test creating a new employee with basic details"""
        unique_id = uuid.uuid4().hex[:6]
        test_email = f"test.basic.{unique_id}@drawlead.com"
        
        employee_data = {
            "full_name": f"Test Basic Employee {unique_id}",
            "email": test_email,
            "phone": "+91 9876543210",
            "role": "employee",
            "password": "TestPass123!",
            "module_access": ["leads"]
        }
        
        response = self.session.post(f"{BASE_URL}/api/hr/admin/create-employee", json=employee_data)
        assert response.status_code == 200, f"Create employee failed: {response.text}"
        
        data = response.json()
        assert data.get("message") == "Employee created successfully"
        assert "user_id" in data
        assert "employee_id" in data
        assert data.get("email") == test_email
        assert data.get("credentials_sent") == True
        
        self.created_employees.append(data.get("user_id"))
        print(f"Created employee: {data}")
        
        return data
    
    def test_create_employee_full_details(self):
        """Test creating employee with all details filled"""
        unique_id = uuid.uuid4().hex[:6]
        test_email = f"test.full.{unique_id}@drawlead.com"
        
        employee_data = {
            "full_name": f"Test Full Employee {unique_id}",
            "email": test_email,
            "phone": "+91 9876543210",
            "date_of_birth": "1990-01-15",
            "gender": "male",
            "blood_group": "O+",
            # Account Details
            "bank_name": "HDFC Bank",
            "account_number": "1234567890",
            "ifsc_code": "HDFC0001234",
            "pan_number": "ABCDE1234F",
            "aadhar_number": "123456789012",
            # Employment Details
            "employee_id": f"EMP{unique_id}",
            "designation": "Senior Developer",
            "department": "Engineering",
            "employment_type": "full-time",
            "joining_date": "2026-01-01",
            "reporting_manager": "Vinoth",
            "work_location": "office",
            # Documents
            "resume_link": "https://drive.google.com/resume",
            "id_proof_link": "https://drive.google.com/id",
            # Role & Access
            "role": "website_developer",
            "module_access": ["leads", "operations", "hr"],
            "password": "SecurePass456!",
            # Emergency Contact
            "emergency_contact_name": "Emergency Contact",
            "emergency_contact_phone": "+91 9999999999",
            "emergency_contact_relation": "Spouse",
            # Address
            "address": "123 Test Street",
            "city": "Chennai",
            "state": "Tamil Nadu",
            "pincode": "600001"
        }
        
        response = self.session.post(f"{BASE_URL}/api/hr/admin/create-employee", json=employee_data)
        assert response.status_code == 200, f"Create full employee failed: {response.text}"
        
        data = response.json()
        assert data.get("message") == "Employee created successfully"
        assert data.get("employee_id") == f"EMP{unique_id}"
        
        self.created_employees.append(data.get("user_id"))
        print(f"Created full employee: {data}")
        
        return data
    
    def test_new_employee_can_login(self):
        """Test that newly created employee can login"""
        # First create an employee
        unique_id = uuid.uuid4().hex[:6]
        test_email = f"test.login.{unique_id}@drawlead.com"
        test_password = "LoginTest123!"
        
        employee_data = {
            "full_name": f"Test Login Employee {unique_id}",
            "email": test_email,
            "role": "employee",
            "password": test_password,
            "module_access": ["leads"]
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/hr/admin/create-employee", json=employee_data)
        assert create_response.status_code == 200, f"Create employee failed: {create_response.text}"
        
        created_data = create_response.json()
        self.created_employees.append(created_data.get("user_id"))
        
        # Now try to login as the new employee
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": test_email,
            "password": test_password
        })
        assert login_response.status_code == 200, f"New employee login failed: {login_response.text}"
        
        login_data = login_response.json()
        assert "session_token" in login_data
        assert login_data.get("user", {}).get("email") == test_email
        assert login_data.get("user", {}).get("role") == "employee"
        
        print(f"New employee logged in successfully: {login_data.get('user', {}).get('name')}")
    
    def test_create_employee_with_different_roles(self):
        """Test creating employees with different roles"""
        roles_to_test = ["admin", "project_manager", "hr_manager", "content_writer", "graphic_designer"]
        
        for role in roles_to_test:
            unique_id = uuid.uuid4().hex[:6]
            test_email = f"test.{role}.{unique_id}@drawlead.com"
            
            employee_data = {
                "full_name": f"Test {role.replace('_', ' ').title()} {unique_id}",
                "email": test_email,
                "role": role,
                "password": "RoleTest123!",
                "module_access": ["leads"]
            }
            
            response = self.session.post(f"{BASE_URL}/api/hr/admin/create-employee", json=employee_data)
            assert response.status_code == 200, f"Create {role} employee failed: {response.text}"
            
            data = response.json()
            self.created_employees.append(data.get("user_id"))
            print(f"Created {role} employee: {data.get('email')}")
    
    def test_create_employee_duplicate_email_fails(self):
        """Test that creating employee with duplicate email fails"""
        unique_id = uuid.uuid4().hex[:6]
        test_email = f"test.dup.{unique_id}@drawlead.com"
        
        # Create first employee
        employee_data = {
            "full_name": f"Test Duplicate {unique_id}",
            "email": test_email,
            "role": "employee",
            "password": "DupTest123!",
            "module_access": []
        }
        
        response1 = self.session.post(f"{BASE_URL}/api/hr/admin/create-employee", json=employee_data)
        assert response1.status_code == 200
        self.created_employees.append(response1.json().get("user_id"))
        
        # Try to create second employee with same email
        response2 = self.session.post(f"{BASE_URL}/api/hr/admin/create-employee", json=employee_data)
        assert response2.status_code == 400, "Should fail for duplicate email"
        assert "already registered" in response2.json().get("detail", "").lower()
        print("Duplicate email correctly rejected")
    
    def test_create_employee_missing_required_fields(self):
        """Test that creating employee without required fields fails"""
        # Missing password
        response = self.session.post(f"{BASE_URL}/api/hr/admin/create-employee", json={
            "full_name": "Test Missing",
            "email": "test.missing@drawlead.com"
        })
        assert response.status_code == 422, "Should fail for missing password"
        print("Missing required fields correctly rejected")
    
    def test_employee_profile_created(self):
        """Test that employee profile is created along with user"""
        unique_id = uuid.uuid4().hex[:6]
        test_email = f"test.profile.{unique_id}@drawlead.com"
        
        employee_data = {
            "full_name": f"Test Profile {unique_id}",
            "email": test_email,
            "phone": "+91 1234567890",
            "designation": "Test Designation",
            "department": "Engineering",
            "role": "employee",
            "password": "ProfileTest123!",
            "module_access": ["leads"]
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/hr/admin/create-employee", json=employee_data)
        assert create_response.status_code == 200
        
        created_data = create_response.json()
        user_id = created_data.get("user_id")
        self.created_employees.append(user_id)
        
        # Verify profile was created by fetching it
        profile_response = self.session.get(f"{BASE_URL}/api/hr/profile/{user_id}")
        assert profile_response.status_code == 200, f"Profile fetch failed: {profile_response.text}"
        
        profile = profile_response.json()
        assert profile.get("full_name") == f"Test Profile {unique_id}"
        assert profile.get("email") == test_email
        assert profile.get("designation") == "Test Designation"
        assert profile.get("department") == "Engineering"
        print(f"Employee profile verified: {profile.get('full_name')}")
    
    def test_employee_appears_in_list(self):
        """Test that newly created employee appears in employees list"""
        unique_id = uuid.uuid4().hex[:6]
        test_email = f"test.list.{unique_id}@drawlead.com"
        test_name = f"Test List Employee {unique_id}"
        
        employee_data = {
            "full_name": test_name,
            "email": test_email,
            "role": "employee",
            "password": "ListTest123!",
            "module_access": []
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/hr/admin/create-employee", json=employee_data)
        assert create_response.status_code == 200
        self.created_employees.append(create_response.json().get("user_id"))
        
        # Fetch employees list
        list_response = self.session.get(f"{BASE_URL}/api/hr/admin/employees")
        assert list_response.status_code == 200
        
        employees = list_response.json()
        employee_emails = [emp.get("email") for emp in employees]
        
        assert test_email in employee_emails, f"New employee {test_email} not found in list"
        print(f"Employee {test_name} found in employees list")
    
    def test_non_admin_cannot_create_employee(self):
        """Test that non-admin users cannot create employees"""
        # First create a regular employee
        unique_id = uuid.uuid4().hex[:6]
        test_email = f"test.nonadmin.{unique_id}@drawlead.com"
        test_password = "NonAdmin123!"
        
        employee_data = {
            "full_name": f"Test Non Admin {unique_id}",
            "email": test_email,
            "role": "employee",
            "password": test_password,
            "module_access": []
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/hr/admin/create-employee", json=employee_data)
        assert create_response.status_code == 200
        self.created_employees.append(create_response.json().get("user_id"))
        
        # Login as the new employee
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": test_email,
            "password": test_password
        })
        assert login_response.status_code == 200
        emp_token = login_response.json().get("session_token")
        
        # Try to create another employee as non-admin
        emp_session = requests.Session()
        emp_session.headers.update({
            "Content-Type": "application/json",
            "Authorization": f"Bearer {emp_token}"
        })
        
        another_employee = {
            "full_name": "Should Fail",
            "email": f"should.fail.{unique_id}@drawlead.com",
            "role": "employee",
            "password": "ShouldFail123!",
            "module_access": []
        }
        
        fail_response = emp_session.post(f"{BASE_URL}/api/hr/admin/create-employee", json=another_employee)
        assert fail_response.status_code == 403, "Non-admin should not be able to create employees"
        print("Non-admin correctly denied access to create employee")


class TestHRAdminLeaveRequests:
    """Test HR Admin Leave Requests functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get admin token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        self.token = response.json().get("session_token")
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
    
    def test_get_all_leave_requests(self):
        """Test fetching all leave requests"""
        response = self.session.get(f"{BASE_URL}/api/hr/admin/all-requests")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} leave requests")
    
    def test_get_pending_leave_requests(self):
        """Test fetching pending leave requests"""
        response = self.session.get(f"{BASE_URL}/api/hr/admin/all-requests?status=pending")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        # All should be pending
        for req in data:
            assert req.get("status") == "pending"
        print(f"Found {len(data)} pending leave requests")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
