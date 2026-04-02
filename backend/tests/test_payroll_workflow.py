"""
Payroll Management Workflow Tests
Tests the complete payslip workflow: Draft -> Operations Review -> CEO Review -> Generate
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://drawlead-docs.preview.emergentagent.com')

class TestPayrollWorkflow:
    """Test payslip workflow APIs"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login and get token"""
        # Login as admin
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "vinoth@drawlead.com",
            "password": "admin123"
        })
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        self.token = login_response.json().get("token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
        self.user_id = login_response.json().get("user", {}).get("user_id")
        print(f"Logged in as user_id: {self.user_id}")
    
    def test_01_get_payroll_employees(self):
        """Test GET /api/payroll/employees - Get all employees with salary info"""
        response = requests.get(f"{BASE_URL}/api/payroll/employees", headers=self.headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        employees = response.json()
        assert isinstance(employees, list), "Response should be a list"
        print(f"Found {len(employees)} employees")
        
        # Check employee data structure
        if employees:
            emp = employees[0]
            assert "user_id" in emp, "Employee should have user_id"
            assert "name" in emp, "Employee should have name"
            assert "current_salary" in emp, "Employee should have current_salary"
            print(f"First employee: {emp.get('name')} - Salary: {emp.get('current_salary')}")
    
    def test_02_get_hike_reasons(self):
        """Test GET /api/payroll/hike-reasons - Get hike reason options"""
        response = requests.get(f"{BASE_URL}/api/payroll/hike-reasons", headers=self.headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        reasons = response.json()
        assert isinstance(reasons, list), "Response should be a list"
        assert len(reasons) > 0, "Should have hike reasons"
        
        # Check reason structure
        reason = reasons[0]
        assert "id" in reason, "Reason should have id"
        assert "label" in reason, "Reason should have label"
        print(f"Found {len(reasons)} hike reasons: {[r['id'] for r in reasons]}")
    
    def test_03_get_payslips_for_month(self):
        """Test GET /api/payroll/payslips - Get payslips for April 2026"""
        response = requests.get(f"{BASE_URL}/api/payroll/payslips?month=4&year=2026", headers=self.headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        payslips = response.json()
        assert isinstance(payslips, list), "Response should be a list"
        print(f"Found {len(payslips)} payslips for April 2026")
        
        # Find the draft payslip for vinoth
        draft_payslips = [p for p in payslips if p.get("status") == "draft"]
        print(f"Draft payslips: {len(draft_payslips)}")
        
        if payslips:
            payslip = payslips[0]
            # Check payslip structure
            assert "payslip_id" in payslip, "Payslip should have payslip_id"
            assert "user_id" in payslip, "Payslip should have user_id"
            assert "status" in payslip, "Payslip should have status"
            assert "attendance" in payslip, "Payslip should have attendance"
            assert "calculation" in payslip, "Payslip should have calculation"
            assert "deductions" in payslip, "Payslip should have deductions"
            assert "net_salary" in payslip, "Payslip should have net_salary"
            
            print(f"Payslip: {payslip.get('employee_name')} - Status: {payslip.get('status')} - Net: {payslip.get('net_salary')}")
            
            # Store payslip_id for workflow tests
            self.__class__.payslip_id = payslip.get("payslip_id")
            self.__class__.payslip_status = payslip.get("status")
    
    def test_04_get_salary_history(self):
        """Test GET /api/payroll/salary-history/{user_id} - Get salary history"""
        # Get employees first to get a user_id
        emp_response = requests.get(f"{BASE_URL}/api/payroll/employees", headers=self.headers)
        employees = emp_response.json()
        
        if employees:
            user_id = employees[0].get("user_id")
            response = requests.get(f"{BASE_URL}/api/payroll/salary-history/{user_id}", headers=self.headers)
            assert response.status_code == 200, f"Failed: {response.text}"
            
            data = response.json()
            assert "salary_history" in data, "Response should have salary_history"
            assert "current_salary" in data, "Response should have current_salary"
            
            history = data.get("salary_history", [])
            print(f"Salary history for {employees[0].get('name')}: {len(history)} records")
            
            if history:
                record = history[0]
                assert "amount" in record, "Record should have amount"
                assert "effective_from" in record, "Record should have effective_from"
                assert "reason" in record, "Record should have reason"
    
    def test_05_submit_for_operations_review(self):
        """Test PUT /api/payroll/payslip/{id}/submit-for-operations - Submit draft payslip"""
        # Get payslips to find a draft one
        response = requests.get(f"{BASE_URL}/api/payroll/payslips?month=4&year=2026", headers=self.headers)
        payslips = response.json()
        
        draft_payslip = next((p for p in payslips if p.get("status") == "draft"), None)
        
        if draft_payslip:
            payslip_id = draft_payslip.get("payslip_id")
            print(f"Submitting payslip {payslip_id} for operations review")
            
            submit_response = requests.put(
                f"{BASE_URL}/api/payroll/payslip/{payslip_id}/submit-for-operations",
                headers=self.headers
            )
            assert submit_response.status_code == 200, f"Failed: {submit_response.text}"
            
            result = submit_response.json()
            assert "message" in result, "Response should have message"
            print(f"Submit result: {result.get('message')}")
            
            # Store for next test
            self.__class__.payslip_id = payslip_id
        else:
            print("No draft payslip found - may already be submitted")
            # Get any payslip for next tests
            if payslips:
                self.__class__.payslip_id = payslips[0].get("payslip_id")
    
    def test_06_operations_review(self):
        """Test PUT /api/payroll/payslip/{id}/operations-review - Add operations review"""
        # Get payslips to find one in operations_review status
        response = requests.get(f"{BASE_URL}/api/payroll/payslips?month=4&year=2026", headers=self.headers)
        payslips = response.json()
        
        ops_payslip = next((p for p in payslips if p.get("status") == "operations_review"), None)
        
        if ops_payslip:
            payslip_id = ops_payslip.get("payslip_id")
            print(f"Adding operations review for payslip {payslip_id}")
            
            review_response = requests.put(
                f"{BASE_URL}/api/payroll/payslip/{payslip_id}/operations-review",
                headers=self.headers,
                json={"review_text": "Attendance verified. Employee performance satisfactory."}
            )
            assert review_response.status_code == 200, f"Failed: {review_response.text}"
            
            result = review_response.json()
            print(f"Operations review result: {result.get('message')}")
            
            self.__class__.payslip_id = payslip_id
        else:
            print("No payslip in operations_review status found")
    
    def test_07_ceo_review(self):
        """Test PUT /api/payroll/payslip/{id}/ceo-review - CEO approval"""
        # Get payslips to find one in ceo_review status
        response = requests.get(f"{BASE_URL}/api/payroll/payslips?month=4&year=2026", headers=self.headers)
        payslips = response.json()
        
        ceo_payslip = next((p for p in payslips if p.get("status") == "ceo_review"), None)
        
        if ceo_payslip:
            payslip_id = ceo_payslip.get("payslip_id")
            print(f"Adding CEO review for payslip {payslip_id}")
            
            review_response = requests.put(
                f"{BASE_URL}/api/payroll/payslip/{payslip_id}/ceo-review",
                headers=self.headers,
                json={"review_text": "Approved. Good work this month."}
            )
            assert review_response.status_code == 200, f"Failed: {review_response.text}"
            
            result = review_response.json()
            print(f"CEO review result: {result.get('message')}")
            
            self.__class__.payslip_id = payslip_id
        else:
            print("No payslip in ceo_review status found")
    
    def test_08_generate_payslip(self):
        """Test PUT /api/payroll/payslip/{id}/generate - Generate final payslip"""
        # Get payslips to find one in approved status
        response = requests.get(f"{BASE_URL}/api/payroll/payslips?month=4&year=2026", headers=self.headers)
        payslips = response.json()
        
        approved_payslip = next((p for p in payslips if p.get("status") == "approved"), None)
        
        if approved_payslip:
            payslip_id = approved_payslip.get("payslip_id")
            print(f"Generating payslip {payslip_id}")
            
            generate_response = requests.put(
                f"{BASE_URL}/api/payroll/payslip/{payslip_id}/generate",
                headers=self.headers
            )
            assert generate_response.status_code == 200, f"Failed: {generate_response.text}"
            
            result = generate_response.json()
            print(f"Generate result: {result.get('message')}")
        else:
            print("No payslip in approved status found")
    
    def test_09_verify_final_status(self):
        """Verify the payslip workflow completed"""
        response = requests.get(f"{BASE_URL}/api/payroll/payslips?month=4&year=2026", headers=self.headers)
        payslips = response.json()
        
        print("\nFinal payslip statuses:")
        for p in payslips:
            print(f"  - {p.get('employee_name')}: {p.get('status')}")
        
        # Check if any payslip reached generated status
        generated = [p for p in payslips if p.get("status") == "generated"]
        print(f"\nGenerated payslips: {len(generated)}")
    
    def test_10_get_company_settings(self):
        """Test GET /api/payroll/company-settings"""
        response = requests.get(f"{BASE_URL}/api/payroll/company-settings", headers=self.headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        settings = response.json()
        assert "company_name" in settings, "Should have company_name"
        print(f"Company settings: {settings.get('company_name')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
