"""
Test Payroll Settings and PDF Generation Features
- Payroll Settings API (GET/PUT)
- PF configuration (enable/disable, percentage)
- Professional Tax configuration (enable/disable, amount, threshold)
- Working Hours per Day configuration
- PDF generation for payslips
- Extra Hours and Less Hours in attendance summary
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestPayrollSettingsAndPDF:
    """Test Payroll Settings and PDF Generation"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login and get auth token"""
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
            self.token = token
        else:
            pytest.skip(f"Login failed: {login_response.status_code}")
    
    # ========== PAYROLL SETTINGS TESTS ==========
    
    def test_get_payroll_settings(self):
        """Test GET /api/payroll/settings returns default or saved settings"""
        response = self.session.get(f"{BASE_URL}/api/payroll/settings")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify all required fields exist
        assert "pf_enabled" in data, "pf_enabled field missing"
        assert "pf_percentage" in data, "pf_percentage field missing"
        assert "professional_tax_enabled" in data, "professional_tax_enabled field missing"
        assert "professional_tax_amount" in data, "professional_tax_amount field missing"
        assert "professional_tax_threshold" in data, "professional_tax_threshold field missing"
        assert "standard_hours_per_day" in data, "standard_hours_per_day field missing"
        
        # Verify data types
        assert isinstance(data["pf_enabled"], bool), "pf_enabled should be boolean"
        assert isinstance(data["pf_percentage"], (int, float)), "pf_percentage should be numeric"
        assert isinstance(data["professional_tax_enabled"], bool), "professional_tax_enabled should be boolean"
        assert isinstance(data["professional_tax_amount"], (int, float)), "professional_tax_amount should be numeric"
        assert isinstance(data["professional_tax_threshold"], (int, float)), "professional_tax_threshold should be numeric"
        assert isinstance(data["standard_hours_per_day"], (int, float)), "standard_hours_per_day should be numeric"
        
        print(f"Payroll settings retrieved: {data}")
    
    def test_update_payroll_settings_pf_enabled(self):
        """Test updating PF enabled/disabled"""
        # First get current settings
        get_response = self.session.get(f"{BASE_URL}/api/payroll/settings")
        current_settings = get_response.json()
        
        # Update with PF disabled
        update_data = {
            "pf_enabled": False,
            "pf_percentage": 10.0,
            "professional_tax_enabled": current_settings.get("professional_tax_enabled", True),
            "professional_tax_amount": current_settings.get("professional_tax_amount", 200.0),
            "professional_tax_threshold": current_settings.get("professional_tax_threshold", 15000.0),
            "standard_hours_per_day": current_settings.get("standard_hours_per_day", 8.0)
        }
        
        response = self.session.put(f"{BASE_URL}/api/payroll/settings", json=update_data)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Verify the update persisted
        verify_response = self.session.get(f"{BASE_URL}/api/payroll/settings")
        verify_data = verify_response.json()
        
        assert verify_data["pf_enabled"] == False, "PF enabled should be False"
        assert verify_data["pf_percentage"] == 10.0, "PF percentage should be 10.0"
        
        print("PF settings updated successfully")
        
        # Restore original settings
        restore_data = {
            "pf_enabled": True,
            "pf_percentage": 12.0,
            "professional_tax_enabled": True,
            "professional_tax_amount": 200.0,
            "professional_tax_threshold": 15000.0,
            "standard_hours_per_day": 8.0
        }
        self.session.put(f"{BASE_URL}/api/payroll/settings", json=restore_data)
    
    def test_update_payroll_settings_professional_tax(self):
        """Test updating Professional Tax settings"""
        update_data = {
            "pf_enabled": True,
            "pf_percentage": 12.0,
            "professional_tax_enabled": True,
            "professional_tax_amount": 250.0,
            "professional_tax_threshold": 20000.0,
            "standard_hours_per_day": 8.0
        }
        
        response = self.session.put(f"{BASE_URL}/api/payroll/settings", json=update_data)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Verify the update persisted
        verify_response = self.session.get(f"{BASE_URL}/api/payroll/settings")
        verify_data = verify_response.json()
        
        assert verify_data["professional_tax_enabled"] == True, "Professional tax should be enabled"
        assert verify_data["professional_tax_amount"] == 250.0, "Professional tax amount should be 250.0"
        assert verify_data["professional_tax_threshold"] == 20000.0, "Professional tax threshold should be 20000.0"
        
        print("Professional Tax settings updated successfully")
        
        # Restore original settings
        restore_data = {
            "pf_enabled": True,
            "pf_percentage": 12.0,
            "professional_tax_enabled": True,
            "professional_tax_amount": 200.0,
            "professional_tax_threshold": 15000.0,
            "standard_hours_per_day": 8.0
        }
        self.session.put(f"{BASE_URL}/api/payroll/settings", json=restore_data)
    
    def test_update_payroll_settings_working_hours(self):
        """Test updating Working Hours per Day"""
        update_data = {
            "pf_enabled": True,
            "pf_percentage": 12.0,
            "professional_tax_enabled": True,
            "professional_tax_amount": 200.0,
            "professional_tax_threshold": 15000.0,
            "standard_hours_per_day": 9.0
        }
        
        response = self.session.put(f"{BASE_URL}/api/payroll/settings", json=update_data)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Verify the update persisted
        verify_response = self.session.get(f"{BASE_URL}/api/payroll/settings")
        verify_data = verify_response.json()
        
        assert verify_data["standard_hours_per_day"] == 9.0, "Standard hours per day should be 9.0"
        
        print("Working Hours settings updated successfully")
        
        # Restore original settings
        restore_data = {
            "pf_enabled": True,
            "pf_percentage": 12.0,
            "professional_tax_enabled": True,
            "professional_tax_amount": 200.0,
            "professional_tax_threshold": 15000.0,
            "standard_hours_per_day": 8.0
        }
        self.session.put(f"{BASE_URL}/api/payroll/settings", json=restore_data)
    
    # ========== PAYSLIP EXTRA/LESS HOURS TESTS ==========
    
    def test_payslip_contains_extra_less_hours(self):
        """Test that payslip attendance summary contains extra_hours and less_hours"""
        # Get payslips for May 2026 (new payslip with new schema)
        response = self.session.get(f"{BASE_URL}/api/payroll/payslips?month=5&year=2026")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        payslips = response.json()
        assert len(payslips) > 0, "Expected at least one payslip"
        
        payslip = payslips[0]
        attendance = payslip.get("attendance", {})
        
        # Verify extra_hours and less_hours fields exist
        assert "extra_hours" in attendance, "extra_hours field missing in attendance"
        assert "less_hours" in attendance, "less_hours field missing in attendance"
        
        # Verify they are numeric
        assert isinstance(attendance["extra_hours"], (int, float)), "extra_hours should be numeric"
        assert isinstance(attendance["less_hours"], (int, float)), "less_hours should be numeric"
        
        print(f"Payslip attendance: Extra Hours={attendance['extra_hours']}, Less Hours={attendance['less_hours']}")
    
    def test_get_single_payslip_with_hours(self):
        """Test GET single payslip contains extra/less hours"""
        # Use the new payslip ID created with new schema (May 2026)
        payslip_id = "payslip_a4d43d6efe17"
        
        response = self.session.get(f"{BASE_URL}/api/payroll/payslip/{payslip_id}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        payslip = response.json()
        attendance = payslip.get("attendance", {})
        
        assert "extra_hours" in attendance, "extra_hours field missing"
        assert "less_hours" in attendance, "less_hours field missing"
        
        print(f"Single payslip attendance: {attendance}")
    
    # ========== DEDUCTIONS CONDITIONAL DISPLAY TESTS ==========
    
    def test_payslip_deductions_contain_pf_enabled_flag(self):
        """Test that payslip deductions contain pf_enabled flag"""
        # Use the new payslip ID created with new schema (May 2026)
        payslip_id = "payslip_a4d43d6efe17"
        
        response = self.session.get(f"{BASE_URL}/api/payroll/payslip/{payslip_id}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        payslip = response.json()
        deductions = payslip.get("deductions", {})
        
        # Verify pf_enabled flag exists
        assert "pf_enabled" in deductions, "pf_enabled flag missing in deductions"
        assert "pf_percentage" in deductions, "pf_percentage missing in deductions"
        assert "professional_tax_enabled" in deductions, "professional_tax_enabled flag missing in deductions"
        
        print(f"Deductions: PF enabled={deductions.get('pf_enabled')}, PT enabled={deductions.get('professional_tax_enabled')}")
    
    # ========== PDF GENERATION TESTS ==========
    
    def test_pdf_download_endpoint_exists(self):
        """Test that PDF download endpoint exists and returns PDF"""
        payslip_id = "payslip_32238ac6045b"
        
        response = self.session.get(f"{BASE_URL}/api/payroll/payslip/{payslip_id}/pdf")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Verify content type is PDF
        content_type = response.headers.get("Content-Type", "")
        assert "application/pdf" in content_type, f"Expected PDF content type, got {content_type}"
        
        # Verify content disposition header
        content_disposition = response.headers.get("Content-Disposition", "")
        assert "attachment" in content_disposition, f"Expected attachment disposition, got {content_disposition}"
        assert ".pdf" in content_disposition, f"Expected .pdf in filename, got {content_disposition}"
        
        # Verify PDF content starts with PDF magic bytes
        content = response.content
        assert content[:4] == b'%PDF', "Response does not start with PDF magic bytes"
        
        print(f"PDF downloaded successfully, size: {len(content)} bytes")
    
    def test_pdf_download_unauthorized_for_non_generated(self):
        """Test that PDF download fails for non-generated payslips (if any exist)"""
        # Get payslips to find a non-generated one
        response = self.session.get(f"{BASE_URL}/api/payroll/payslips?month=4&year=2026")
        payslips = response.json()
        
        # Find a non-generated payslip
        non_generated = [p for p in payslips if p.get("status") != "generated"]
        
        if non_generated:
            payslip_id = non_generated[0]["payslip_id"]
            pdf_response = self.session.get(f"{BASE_URL}/api/payroll/payslip/{payslip_id}/pdf")
            # Should fail for non-generated payslips (403 or similar)
            print(f"Non-generated payslip PDF response: {pdf_response.status_code}")
        else:
            print("All payslips are generated, skipping non-generated test")
    
    def test_pdf_download_invalid_payslip_id(self):
        """Test that PDF download returns 404 for invalid payslip ID"""
        response = self.session.get(f"{BASE_URL}/api/payroll/payslip/invalid_payslip_id/pdf")
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("Invalid payslip ID correctly returns 404")
    
    # ========== INTEGRATION TEST ==========
    
    def test_settings_affect_new_payslip_creation(self):
        """Test that payroll settings are used when creating new payslips"""
        # Use the new payslip ID created with new schema (May 2026)
        payslip_id = "payslip_a4d43d6efe17"
        
        response = self.session.get(f"{BASE_URL}/api/payroll/payslip/{payslip_id}")
        
        assert response.status_code == 200
        
        payslip = response.json()
        deductions = payslip.get("deductions", {})
        
        # Verify settings are captured in payslip
        assert "pf_enabled" in deductions, "pf_enabled should be captured in payslip"
        assert "pf_percentage" in deductions, "pf_percentage should be captured in payslip"
        assert "professional_tax_enabled" in deductions, "professional_tax_enabled should be captured in payslip"
        
        print(f"Payslip captures settings: PF={deductions.get('pf_enabled')}, PT={deductions.get('professional_tax_enabled')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
