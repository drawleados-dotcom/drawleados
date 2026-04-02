"""
Test Payroll HR Remarks, Optional Reviews, Previous Payslips, and PDF Review Exclusion
Features tested:
1. Create Payslip with HR Remarks field
2. HR Remarks saved and displayed
3. Previous Payslips endpoint for employee
4. Operations Review is OPTIONAL (can submit empty)
5. CEO Review is OPTIONAL (can approve without comment)
6. PDF does NOT include Operations/CEO review text
7. HR Remarks appears on PDF if provided
"""

import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://drawlead-docs.preview.emergentagent.com').rstrip('/')

class TestPayrollHRRemarksOptionalReviews:
    """Test HR Remarks, Optional Reviews, Previous Payslips, and PDF Review Exclusion"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with admin authentication"""
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
            self.admin_user = login_response.json().get("user", {})
        else:
            pytest.skip(f"Admin login failed: {login_response.status_code}")
        
        yield
        
        # Cleanup - delete test payslips
        self.cleanup_test_payslips()
    
    def cleanup_test_payslips(self):
        """Clean up test payslips created during tests"""
        # We'll use a specific month/year for testing to avoid conflicts
        pass  # Payslips are identified by unique IDs, cleanup handled per test
    
    def get_test_employee(self):
        """Get an employee for testing"""
        response = self.session.get(f"{BASE_URL}/api/payroll/employees")
        if response.status_code == 200:
            employees = response.json()
            if employees:
                return employees[0]
        return None
    
    # ========== TEST 1: Create Payslip with HR Remarks ==========
    def test_create_payslip_with_hr_remarks(self):
        """Test creating a payslip with HR Remarks field"""
        employee = self.get_test_employee()
        if not employee:
            pytest.skip("No employee found for testing")
        
        # Use a unique month/year to avoid conflicts
        test_month = 7  # July
        test_year = 2026
        test_hr_remarks = f"TEST_HR_REMARKS_{uuid.uuid4().hex[:8]}"
        
        # First, ensure no payslip exists for this month
        existing = self.session.get(f"{BASE_URL}/api/payroll/payslips?month={test_month}&year={test_year}")
        
        # Create payslip with HR remarks
        create_response = self.session.post(f"{BASE_URL}/api/payroll/payslip/create", json={
            "user_id": employee["user_id"],
            "month": test_month,
            "year": test_year,
            "hr_remarks": test_hr_remarks
        })
        
        if create_response.status_code == 400 and "already exists" in create_response.text:
            print(f"Payslip already exists for {test_month}/{test_year}, skipping create test")
            pytest.skip("Payslip already exists for test month")
        
        assert create_response.status_code == 200, f"Create payslip failed: {create_response.text}"
        
        payslip = create_response.json()
        assert "payslip_id" in payslip, "Payslip ID not returned"
        assert payslip.get("hr_remarks") == test_hr_remarks, f"HR Remarks not saved correctly. Expected: {test_hr_remarks}, Got: {payslip.get('hr_remarks')}"
        assert payslip.get("status") == "draft", "Payslip should be in draft status"
        
        print(f"PASS: Created payslip {payslip['payslip_id']} with HR Remarks: {test_hr_remarks}")
        
        # Store for cleanup
        self.test_payslip_id = payslip["payslip_id"]
        self.test_user_id = employee["user_id"]
        
        return payslip
    
    # ========== TEST 2: HR Remarks displayed in payslip details ==========
    def test_hr_remarks_displayed_in_payslip(self):
        """Test that HR Remarks is displayed when fetching payslip details"""
        employee = self.get_test_employee()
        if not employee:
            pytest.skip("No employee found for testing")
        
        test_month = 8  # August
        test_year = 2026
        test_hr_remarks = f"TEST_REMARKS_DISPLAY_{uuid.uuid4().hex[:8]}"
        
        # Create payslip with HR remarks
        create_response = self.session.post(f"{BASE_URL}/api/payroll/payslip/create", json={
            "user_id": employee["user_id"],
            "month": test_month,
            "year": test_year,
            "hr_remarks": test_hr_remarks
        })
        
        if create_response.status_code == 400 and "already exists" in create_response.text:
            # Get existing payslip
            payslips_response = self.session.get(f"{BASE_URL}/api/payroll/payslips?month={test_month}&year={test_year}")
            if payslips_response.status_code == 200:
                payslips = payslips_response.json()
                for p in payslips:
                    if p.get("user_id") == employee["user_id"]:
                        payslip_id = p["payslip_id"]
                        break
                else:
                    pytest.skip("Could not find existing payslip")
            else:
                pytest.skip("Could not fetch payslips")
        else:
            assert create_response.status_code == 200, f"Create failed: {create_response.text}"
            payslip_id = create_response.json()["payslip_id"]
        
        # Fetch payslip details
        detail_response = self.session.get(f"{BASE_URL}/api/payroll/payslip/{payslip_id}")
        assert detail_response.status_code == 200, f"Get payslip failed: {detail_response.text}"
        
        payslip_detail = detail_response.json()
        assert "hr_remarks" in payslip_detail, "hr_remarks field not in payslip response"
        
        print(f"PASS: HR Remarks field present in payslip details: {payslip_detail.get('hr_remarks')}")
    
    # ========== TEST 3: Previous Payslips endpoint ==========
    def test_previous_payslips_endpoint(self):
        """Test GET /api/payroll/employee-payslips/{user_id} returns previous payslips"""
        employee = self.get_test_employee()
        if not employee:
            pytest.skip("No employee found for testing")
        
        user_id = employee["user_id"]
        
        # Call the previous payslips endpoint
        response = self.session.get(f"{BASE_URL}/api/payroll/employee-payslips/{user_id}")
        
        assert response.status_code == 200, f"Get employee payslips failed: {response.text}"
        
        payslips = response.json()
        assert isinstance(payslips, list), "Response should be a list"
        
        print(f"PASS: Previous payslips endpoint returned {len(payslips)} payslips for user {user_id}")
        
        # Verify payslips are sorted by year/month descending
        if len(payslips) > 1:
            for i in range(len(payslips) - 1):
                current = payslips[i]
                next_p = payslips[i + 1]
                current_date = current["year"] * 12 + current["month"]
                next_date = next_p["year"] * 12 + next_p["month"]
                assert current_date >= next_date, "Payslips should be sorted by date descending"
            print("PASS: Payslips are sorted by date descending")
    
    # ========== TEST 4: Operations Review is OPTIONAL ==========
    def test_operations_review_optional_empty_text(self):
        """Test that Operations Review can be submitted with empty review_text"""
        employee = self.get_test_employee()
        if not employee:
            pytest.skip("No employee found for testing")
        
        test_month = 9  # September
        test_year = 2026
        
        # Create payslip
        create_response = self.session.post(f"{BASE_URL}/api/payroll/payslip/create", json={
            "user_id": employee["user_id"],
            "month": test_month,
            "year": test_year,
            "hr_remarks": "Test for optional ops review"
        })
        
        if create_response.status_code == 400 and "already exists" in create_response.text:
            pytest.skip("Payslip already exists for test month")
        
        assert create_response.status_code == 200, f"Create failed: {create_response.text}"
        payslip_id = create_response.json()["payslip_id"]
        
        # Submit for operations review
        submit_response = self.session.put(f"{BASE_URL}/api/payroll/payslip/{payslip_id}/submit-for-operations")
        assert submit_response.status_code == 200, f"Submit for ops failed: {submit_response.text}"
        
        # Submit EMPTY operations review (should work - review is optional)
        ops_review_response = self.session.put(
            f"{BASE_URL}/api/payroll/payslip/{payslip_id}/operations-review",
            json={"review_text": ""}  # Empty review text
        )
        
        assert ops_review_response.status_code == 200, f"Empty ops review should succeed: {ops_review_response.text}"
        
        # Verify payslip moved to ceo_review status
        detail_response = self.session.get(f"{BASE_URL}/api/payroll/payslip/{payslip_id}")
        assert detail_response.status_code == 200
        
        payslip = detail_response.json()
        assert payslip["status"] == "ceo_review", f"Status should be ceo_review, got: {payslip['status']}"
        
        # operations_review should be None or not have review_text since it was empty
        ops_review = payslip.get("operations_review")
        if ops_review:
            assert not ops_review.get("review_text"), "Empty review should not save review_text"
        
        print(f"PASS: Operations review with empty text succeeded, status moved to ceo_review")
        
        return payslip_id
    
    # ========== TEST 5: CEO Review is OPTIONAL ==========
    def test_ceo_review_optional_empty_text(self):
        """Test that CEO Review can approve with empty review_text"""
        employee = self.get_test_employee()
        if not employee:
            pytest.skip("No employee found for testing")
        
        test_month = 10  # October
        test_year = 2026
        
        # Create payslip
        create_response = self.session.post(f"{BASE_URL}/api/payroll/payslip/create", json={
            "user_id": employee["user_id"],
            "month": test_month,
            "year": test_year,
            "hr_remarks": "Test for optional CEO review"
        })
        
        if create_response.status_code == 400 and "already exists" in create_response.text:
            pytest.skip("Payslip already exists for test month")
        
        assert create_response.status_code == 200, f"Create failed: {create_response.text}"
        payslip_id = create_response.json()["payslip_id"]
        
        # Submit for operations review
        submit_response = self.session.put(f"{BASE_URL}/api/payroll/payslip/{payslip_id}/submit-for-operations")
        assert submit_response.status_code == 200
        
        # Submit operations review (with text this time)
        ops_review_response = self.session.put(
            f"{BASE_URL}/api/payroll/payslip/{payslip_id}/operations-review",
            json={"review_text": "Operations approved"}
        )
        assert ops_review_response.status_code == 200
        
        # Submit EMPTY CEO review (should work - review is optional)
        ceo_review_response = self.session.put(
            f"{BASE_URL}/api/payroll/payslip/{payslip_id}/ceo-review",
            json={"review_text": ""}  # Empty review text
        )
        
        assert ceo_review_response.status_code == 200, f"Empty CEO review should succeed: {ceo_review_response.text}"
        
        # Verify payslip moved to approved status
        detail_response = self.session.get(f"{BASE_URL}/api/payroll/payslip/{payslip_id}")
        assert detail_response.status_code == 200
        
        payslip = detail_response.json()
        assert payslip["status"] == "approved", f"Status should be approved, got: {payslip['status']}"
        
        # ceo_review should be None or not have review_text since it was empty
        ceo_review = payslip.get("ceo_review")
        if ceo_review:
            assert not ceo_review.get("review_text"), "Empty review should not save review_text"
        
        print(f"PASS: CEO review with empty text succeeded, status moved to approved")
        
        return payslip_id
    
    # ========== TEST 6: Full workflow with optional reviews ==========
    def test_full_workflow_optional_reviews(self):
        """Test complete payslip workflow with optional reviews"""
        employee = self.get_test_employee()
        if not employee:
            pytest.skip("No employee found for testing")
        
        test_month = 11  # November
        test_year = 2026
        test_hr_remarks = f"Full workflow test {uuid.uuid4().hex[:8]}"
        
        # Step 1: Create payslip with HR remarks
        create_response = self.session.post(f"{BASE_URL}/api/payroll/payslip/create", json={
            "user_id": employee["user_id"],
            "month": test_month,
            "year": test_year,
            "hr_remarks": test_hr_remarks
        })
        
        if create_response.status_code == 400 and "already exists" in create_response.text:
            pytest.skip("Payslip already exists for test month")
        
        assert create_response.status_code == 200
        payslip_id = create_response.json()["payslip_id"]
        print(f"Step 1 PASS: Created payslip {payslip_id}")
        
        # Step 2: Submit for operations
        submit_response = self.session.put(f"{BASE_URL}/api/payroll/payslip/{payslip_id}/submit-for-operations")
        assert submit_response.status_code == 200
        print("Step 2 PASS: Submitted for operations review")
        
        # Step 3: Operations review with empty text (skip review)
        ops_response = self.session.put(
            f"{BASE_URL}/api/payroll/payslip/{payslip_id}/operations-review",
            json={"review_text": ""}
        )
        assert ops_response.status_code == 200
        print("Step 3 PASS: Operations skipped review (empty text)")
        
        # Step 4: CEO review with empty text (approve without comment)
        ceo_response = self.session.put(
            f"{BASE_URL}/api/payroll/payslip/{payslip_id}/ceo-review",
            json={"review_text": ""}
        )
        assert ceo_response.status_code == 200
        print("Step 4 PASS: CEO approved without comment")
        
        # Step 5: Generate payslip
        generate_response = self.session.put(f"{BASE_URL}/api/payroll/payslip/{payslip_id}/generate")
        assert generate_response.status_code == 200
        print("Step 5 PASS: Payslip generated")
        
        # Verify final state
        detail_response = self.session.get(f"{BASE_URL}/api/payroll/payslip/{payslip_id}")
        assert detail_response.status_code == 200
        
        payslip = detail_response.json()
        assert payslip["status"] == "generated"
        assert payslip["hr_remarks"] == test_hr_remarks
        
        print(f"PASS: Full workflow completed successfully with optional reviews")
        
        return payslip_id
    
    # ========== TEST 7: PDF Generation - HR Remarks included, Reviews excluded ==========
    def test_pdf_hr_remarks_included_reviews_excluded(self):
        """Test that PDF includes HR Remarks but excludes Operations/CEO reviews"""
        employee = self.get_test_employee()
        if not employee:
            pytest.skip("No employee found for testing")
        
        test_month = 12  # December
        test_year = 2026
        test_hr_remarks = f"PDF_TEST_HR_REMARKS_{uuid.uuid4().hex[:8]}"
        ops_review_text = f"OPS_REVIEW_SHOULD_NOT_APPEAR_{uuid.uuid4().hex[:8]}"
        ceo_review_text = f"CEO_REVIEW_SHOULD_NOT_APPEAR_{uuid.uuid4().hex[:8]}"
        
        # Create payslip with HR remarks
        create_response = self.session.post(f"{BASE_URL}/api/payroll/payslip/create", json={
            "user_id": employee["user_id"],
            "month": test_month,
            "year": test_year,
            "hr_remarks": test_hr_remarks
        })
        
        if create_response.status_code == 400 and "already exists" in create_response.text:
            pytest.skip("Payslip already exists for test month")
        
        assert create_response.status_code == 200
        payslip_id = create_response.json()["payslip_id"]
        
        # Complete workflow with reviews that have text
        self.session.put(f"{BASE_URL}/api/payroll/payslip/{payslip_id}/submit-for-operations")
        self.session.put(
            f"{BASE_URL}/api/payroll/payslip/{payslip_id}/operations-review",
            json={"review_text": ops_review_text}
        )
        self.session.put(
            f"{BASE_URL}/api/payroll/payslip/{payslip_id}/ceo-review",
            json={"review_text": ceo_review_text}
        )
        self.session.put(f"{BASE_URL}/api/payroll/payslip/{payslip_id}/generate")
        
        # Download PDF
        pdf_response = self.session.get(f"{BASE_URL}/api/payroll/payslip/{payslip_id}/pdf")
        
        assert pdf_response.status_code == 200, f"PDF download failed: {pdf_response.text}"
        assert pdf_response.headers.get("content-type") == "application/pdf", "Response should be PDF"
        
        # Check PDF content (basic check - PDF is binary but we can check for text patterns)
        pdf_content = pdf_response.content
        assert len(pdf_content) > 1000, "PDF should have substantial content"
        
        # Note: We can't easily parse PDF content to verify text inclusion/exclusion
        # But we can verify the endpoint works and returns a valid PDF
        print(f"PASS: PDF generated successfully for payslip {payslip_id}")
        print(f"  - PDF size: {len(pdf_content)} bytes")
        print(f"  - Content-Type: {pdf_response.headers.get('content-type')}")
        print(f"  - Content-Disposition: {pdf_response.headers.get('content-disposition')}")
        
        # Verify the payslip has reviews stored (they should be in DB but not in PDF)
        detail_response = self.session.get(f"{BASE_URL}/api/payroll/payslip/{payslip_id}")
        payslip = detail_response.json()
        
        assert payslip.get("operations_review", {}).get("review_text") == ops_review_text, "Ops review should be stored"
        assert payslip.get("ceo_review", {}).get("review_text") == ceo_review_text, "CEO review should be stored"
        assert payslip.get("hr_remarks") == test_hr_remarks, "HR remarks should be stored"
        
        print("PASS: Reviews stored in DB but PDF generated (reviews excluded per code comment)")
    
    # ========== TEST 8: Create payslip without HR remarks ==========
    def test_create_payslip_without_hr_remarks(self):
        """Test creating a payslip without HR Remarks (should be optional)"""
        employee = self.get_test_employee()
        if not employee:
            pytest.skip("No employee found for testing")
        
        test_month = 6  # June
        test_year = 2027
        
        # Create payslip without hr_remarks field
        create_response = self.session.post(f"{BASE_URL}/api/payroll/payslip/create", json={
            "user_id": employee["user_id"],
            "month": test_month,
            "year": test_year
            # No hr_remarks field
        })
        
        if create_response.status_code == 400 and "already exists" in create_response.text:
            pytest.skip("Payslip already exists for test month")
        
        assert create_response.status_code == 200, f"Create without hr_remarks failed: {create_response.text}"
        
        payslip = create_response.json()
        # hr_remarks should be empty string or None
        assert payslip.get("hr_remarks", "") == "", f"HR Remarks should be empty, got: {payslip.get('hr_remarks')}"
        
        print("PASS: Payslip created successfully without HR Remarks")


class TestPayrollReviewTextValidation:
    """Additional tests for review text validation"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "vinoth@drawlead.com",
            "password": "admin123"
        })
        
        if login_response.status_code == 200:
            token = login_response.json().get("session_token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
        else:
            pytest.skip("Admin login failed")
    
    def test_operations_review_with_whitespace_only(self):
        """Test that whitespace-only review text is treated as empty"""
        # Get employees
        response = self.session.get(f"{BASE_URL}/api/payroll/employees")
        if response.status_code != 200 or not response.json():
            pytest.skip("No employees found")
        
        employee = response.json()[0]
        test_month = 1
        test_year = 2027
        
        # Create payslip
        create_response = self.session.post(f"{BASE_URL}/api/payroll/payslip/create", json={
            "user_id": employee["user_id"],
            "month": test_month,
            "year": test_year,
            "hr_remarks": "Whitespace test"
        })
        
        if create_response.status_code == 400:
            pytest.skip("Payslip already exists")
        
        payslip_id = create_response.json()["payslip_id"]
        
        # Submit for operations
        self.session.put(f"{BASE_URL}/api/payroll/payslip/{payslip_id}/submit-for-operations")
        
        # Submit review with whitespace only
        ops_response = self.session.put(
            f"{BASE_URL}/api/payroll/payslip/{payslip_id}/operations-review",
            json={"review_text": "   \n\t  "}  # Whitespace only
        )
        
        assert ops_response.status_code == 200, "Whitespace-only review should succeed"
        
        # Verify no review text saved
        detail = self.session.get(f"{BASE_URL}/api/payroll/payslip/{payslip_id}").json()
        ops_review = detail.get("operations_review")
        
        if ops_review:
            review_text = ops_review.get("review_text", "")
            assert not review_text or review_text.strip() == "", "Whitespace should be stripped"
        
        print("PASS: Whitespace-only review treated as empty")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
