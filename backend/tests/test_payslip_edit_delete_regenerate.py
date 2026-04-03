"""
Test Payslip Edit, Delete, and Regenerate functionality
Tests the new payslip management features:
1. DELETE /api/hr/admin/payslip/{id} - Delete payslip
2. PUT /api/hr/admin/payslip/{id}/edit - Edit payslip HR remarks
3. POST /api/hr/admin/payslip/{id}/regenerate - Regenerate payslip
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestPayslipEditDeleteRegenerate:
    """Test payslip edit, delete, and regenerate endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test - login as admin"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "vinoth@drawlead.com",
            "password": "admin123"
        })
        
        if login_response.status_code == 200:
            data = login_response.json()
            self.token = data.get("session_token") or data.get("token")
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
            self.user_id = data.get("user", {}).get("user_id")
        else:
            pytest.skip(f"Login failed: {login_response.status_code}")
    
    def test_01_get_payslips_list(self):
        """Test getting list of payslips to find test payslip"""
        response = self.session.get(f"{BASE_URL}/api/payroll/payslips", params={
            "month": 4,
            "year": 2026
        })
        
        assert response.status_code == 200, f"Failed to get payslips: {response.text}"
        payslips = response.json()
        print(f"Found {len(payslips)} payslips for Jan 2026")
        
        # Store payslips for later tests
        self.payslips = payslips
        
        # Find a draft payslip for testing
        draft_payslips = [p for p in payslips if p.get("status") in ["draft", "operations_review", "ceo_review"]]
        print(f"Found {len(draft_payslips)} non-finalized payslips")
        
        if draft_payslips:
            print(f"Draft payslip IDs: {[p.get('payslip_id') for p in draft_payslips]}")
    
    def test_02_edit_payslip_endpoint_exists(self):
        """Test that edit payslip endpoint exists and responds"""
        # First get a payslip to edit
        response = self.session.get(f"{BASE_URL}/api/payroll/payslips", params={
            "month": 4,
            "year": 2026
        })
        
        assert response.status_code == 200
        payslips = response.json()
        
        # Find a non-finalized payslip
        editable_payslips = [p for p in payslips if p.get("status") in ["draft", "operations_review", "ceo_review"]]
        
        if not editable_payslips:
            pytest.skip("No editable payslips found")
        
        payslip = editable_payslips[0]
        payslip_id = payslip.get("payslip_id")
        print(f"Testing edit on payslip: {payslip_id} (status: {payslip.get('status')})")
        
        # Test edit endpoint
        edit_response = self.session.put(
            f"{BASE_URL}/api/hr/admin/payslip/{payslip_id}/edit",
            json={"hr_remarks": "Test HR remarks from automated test"}
        )
        
        print(f"Edit response status: {edit_response.status_code}")
        print(f"Edit response: {edit_response.text[:500] if edit_response.text else 'No response body'}")
        
        assert edit_response.status_code == 200, f"Edit failed: {edit_response.text}"
        
        # Verify the update
        updated_payslip = edit_response.json()
        assert updated_payslip.get("hr_remarks") == "Test HR remarks from automated test"
        print("Edit payslip endpoint working correctly")
    
    def test_03_edit_payslip_invalid_field(self):
        """Test that editing invalid fields is rejected"""
        response = self.session.get(f"{BASE_URL}/api/payroll/payslips", params={
            "month": 4,
            "year": 2026
        })
        
        payslips = response.json()
        editable_payslips = [p for p in payslips if p.get("status") in ["draft", "operations_review", "ceo_review"]]
        
        if not editable_payslips:
            pytest.skip("No editable payslips found")
        
        payslip_id = editable_payslips[0].get("payslip_id")
        
        # Try to edit a field that's not allowed
        edit_response = self.session.put(
            f"{BASE_URL}/api/hr/admin/payslip/{payslip_id}/edit",
            json={"net_salary": 999999}  # This should not be allowed
        )
        
        # Should return 400 because net_salary is not an allowed field
        assert edit_response.status_code == 400, f"Expected 400 for invalid field, got {edit_response.status_code}"
        print("Invalid field edit correctly rejected")
    
    def test_04_regenerate_payslip_endpoint_exists(self):
        """Test that regenerate payslip endpoint exists and responds"""
        response = self.session.get(f"{BASE_URL}/api/payroll/payslips", params={
            "month": 4,
            "year": 2026
        })
        
        assert response.status_code == 200
        payslips = response.json()
        
        if not payslips:
            pytest.skip("No payslips found")
        
        # Regenerate can work on any payslip
        payslip = payslips[0]
        payslip_id = payslip.get("payslip_id")
        print(f"Testing regenerate on payslip: {payslip_id} (status: {payslip.get('status')})")
        
        # Test regenerate endpoint
        regenerate_response = self.session.post(
            f"{BASE_URL}/api/hr/admin/payslip/{payslip_id}/regenerate"
        )
        
        print(f"Regenerate response status: {regenerate_response.status_code}")
        print(f"Regenerate response: {regenerate_response.text[:500] if regenerate_response.text else 'No response body'}")
        
        assert regenerate_response.status_code == 200, f"Regenerate failed: {regenerate_response.text}"
        print("Regenerate payslip endpoint working correctly")
    
    def test_05_delete_payslip_finalized_blocked(self):
        """Test that deleting finalized payslips is blocked"""
        response = self.session.get(f"{BASE_URL}/api/payroll/payslips", params={
            "month": 4,
            "year": 2026
        })
        
        payslips = response.json()
        
        # Find a generated/finalized payslip
        finalized_payslips = [p for p in payslips if p.get("status") in ["generated", "acknowledged", "pending_finance", "paid"]]
        
        if not finalized_payslips:
            pytest.skip("No finalized payslips found to test deletion block")
        
        payslip_id = finalized_payslips[0].get("payslip_id")
        print(f"Testing delete block on finalized payslip: {payslip_id}")
        
        # Try to delete - should be blocked
        delete_response = self.session.delete(
            f"{BASE_URL}/api/hr/admin/payslip/{payslip_id}"
        )
        
        assert delete_response.status_code == 400, f"Expected 400 for finalized payslip delete, got {delete_response.status_code}"
        print("Finalized payslip deletion correctly blocked")
    
    def test_06_delete_payslip_not_found(self):
        """Test delete with non-existent payslip ID"""
        delete_response = self.session.delete(
            f"{BASE_URL}/api/hr/admin/payslip/nonexistent_payslip_id"
        )
        
        assert delete_response.status_code == 404, f"Expected 404 for non-existent payslip, got {delete_response.status_code}"
        print("Non-existent payslip delete correctly returns 404")
    
    def test_07_edit_payslip_not_found(self):
        """Test edit with non-existent payslip ID"""
        edit_response = self.session.put(
            f"{BASE_URL}/api/hr/admin/payslip/nonexistent_payslip_id/edit",
            json={"hr_remarks": "Test"}
        )
        
        assert edit_response.status_code == 404, f"Expected 404 for non-existent payslip, got {edit_response.status_code}"
        print("Non-existent payslip edit correctly returns 404")
    
    def test_08_regenerate_payslip_not_found(self):
        """Test regenerate with non-existent payslip ID"""
        regenerate_response = self.session.post(
            f"{BASE_URL}/api/hr/admin/payslip/nonexistent_payslip_id/regenerate"
        )
        
        assert regenerate_response.status_code == 404, f"Expected 404 for non-existent payslip, got {regenerate_response.status_code}"
        print("Non-existent payslip regenerate correctly returns 404")
    
    def test_09_find_swathi_draft_payslip(self):
        """Find Swathi's draft payslip as mentioned in test requirements"""
        response = self.session.get(f"{BASE_URL}/api/payroll/payslips", params={
            "month": 4,
            "year": 2026
        })
        
        assert response.status_code == 200
        payslips = response.json()
        
        # Look for Swathi's payslip
        swathi_payslips = [p for p in payslips if "swathi" in p.get("employee_name", "").lower()]
        
        if swathi_payslips:
            for p in swathi_payslips:
                print(f"Swathi payslip: {p.get('payslip_id')} - Status: {p.get('status')}")
                if p.get("status") in ["draft", "operations_review", "ceo_review"]:
                    print(f"  -> This payslip should show Edit, Delete, and Regenerate buttons")
        else:
            print("No payslip found for Swathi")
        
        # Also look for the specific payslip ID mentioned
        specific_payslip = [p for p in payslips if p.get("payslip_id") == "payslip_0f36cf9dee68"]
        if specific_payslip:
            print(f"Found specific payslip payslip_0f36cf9dee68: Status = {specific_payslip[0].get('status')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
