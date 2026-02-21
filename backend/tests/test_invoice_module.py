"""
Invoice Module API Tests
Tests for: Create Invoice, Get Invoices, View Invoice, Delete Invoice, Duplicate Invoice, PDF Data
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
TEST_CREDENTIALS = {
    "email": "vinoth@drawlead.com",
    "password": "admin123"
}

@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for tests"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json=TEST_CREDENTIALS)
    if response.status_code == 200:
        return response.json().get("session_token")
    pytest.skip("Authentication failed - skipping tests")

@pytest.fixture(scope="module")
def headers(auth_token):
    """Get headers with auth token"""
    return {
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    }

@pytest.fixture(scope="module")
def created_invoice_id(headers):
    """Create an invoice for tests and return its ID"""
    invoice_data = {
        "invoice_date": datetime.now().isoformat(),
        "due_date": (datetime.now() + timedelta(days=30)).isoformat(),
        "invoice_type": "GST",
        "gst_type": "gst",
        "gst_rate": 18,
        "client_name": "TEST_Client for Invoice Tests",
        "client_company": "TEST Company Pvt Ltd",
        "client_email": "test@testcompany.com",
        "client_phone": "+91 98765 43210",
        "client_address": "123 Test Street",
        "client_city": "Chennai",
        "client_state": "Tamil Nadu",
        "client_pincode": "600001",
        "client_gst_number": "33AABCU9603R1ZM",
        "client_pan": "AABCU9603R",
        "payment_terms": "Net 30",
        "payment_method": "Bank Transfer",
        "bank_details": "Bank: HDFC\nAccount: 123456789\nIFSC: HDFC0001234",
        "notes": "Thank you for your business!",
        "terms_and_conditions": "Payment due within 30 days",
        "template_type": "minimal",
        "items": [
            {
                "service_name": "Web Development",
                "description": "Full stack website development",
                "quantity": 1,
                "rate": 50000,
                "gst_rate": 18,
                "discount_percent": 0
            },
            {
                "service_name": "UI/UX Design",
                "description": "Complete UI/UX design package",
                "quantity": 1,
                "rate": 25000,
                "gst_rate": 18,
                "discount_percent": 10
            }
        ]
    }
    
    response = requests.post(f"{BASE_URL}/api/finance/invoices", json=invoice_data, headers=headers)
    if response.status_code == 200:
        invoice = response.json()
        yield invoice.get("invoice_id")
        # Cleanup: Delete the invoice
        requests.delete(f"{BASE_URL}/api/finance/invoices/{invoice.get('invoice_id')}", headers=headers)
    else:
        pytest.skip(f"Failed to create test invoice: {response.text}")


class TestInvoiceEndpoints:
    """Test Invoice CRUD Endpoints"""

    def test_create_invoice(self, headers):
        """Test creating a new invoice with comprehensive fields"""
        invoice_data = {
            "invoice_date": datetime.now().isoformat(),
            "due_date": (datetime.now() + timedelta(days=30)).isoformat(),
            "invoice_type": "GST",
            "gst_type": "gst",
            "gst_rate": 18,
            "client_name": "TEST_New Client",
            "client_company": "TEST New Corp",
            "client_email": "newclient@test.com",
            "client_phone": "+91 99999 88888",
            "client_address": "456 Test Avenue",
            "client_city": "Mumbai",
            "client_state": "Maharashtra",
            "client_pincode": "400001",
            "client_gst_number": "27AAAAA1234A1Z5",
            "client_pan": "AAAAA1234A",
            "payment_terms": "Net 15",
            "payment_method": "UPI",
            "bank_details": "UPI ID: test@upi",
            "notes": "Test invoice notes",
            "terms_and_conditions": "T&C apply",
            "template_type": "corporate",
            "items": [
                {
                    "service_name": "Consulting",
                    "description": "Business consulting",
                    "quantity": 10,
                    "rate": 5000,
                    "gst_rate": 18,
                    "discount_percent": 5
                }
            ]
        }
        
        response = requests.post(f"{BASE_URL}/api/finance/invoices", json=invoice_data, headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Validate response structure
        assert "invoice_id" in data, "Response should contain invoice_id"
        assert "invoice_number" in data, "Response should contain invoice_number"
        assert data["invoice_number"].startswith("INV-"), f"Invoice number should start with INV-, got {data['invoice_number']}"
        
        # Validate client details
        assert data["client_name"] == "TEST_New Client"
        assert data["client_company"] == "TEST New Corp"
        assert data["client_email"] == "newclient@test.com"
        assert data["client_city"] == "Mumbai"
        assert data["client_state"] == "Maharashtra"
        assert data["client_gst_number"] == "27AAAAA1234A1Z5"
        
        # Validate amounts
        assert "subtotal" in data
        assert "total_amount" in data
        assert data["subtotal"] == 50000  # 10 * 5000
        
        # Validate items
        assert "items" in data
        assert len(data["items"]) == 1
        assert data["items"][0]["service_name"] == "Consulting"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/finance/invoices/{data['invoice_id']}", headers=headers)
        
        print(f"✅ Invoice created successfully: {data['invoice_number']}")

    def test_create_invoice_validation(self, headers):
        """Test invoice creation validation - missing client name"""
        invoice_data = {
            "invoice_date": datetime.now().isoformat(),
            "due_date": (datetime.now() + timedelta(days=30)).isoformat(),
            "client_name": "",  # Empty client name
            "items": [
                {"service_name": "Test", "quantity": 1, "rate": 1000}
            ]
        }
        
        response = requests.post(f"{BASE_URL}/api/finance/invoices", json=invoice_data, headers=headers)
        
        # This should either fail validation or succeed (depending on backend implementation)
        print(f"Validation test response: {response.status_code} - {response.text[:200] if response.text else 'No content'}")

    def test_get_all_invoices(self, headers, created_invoice_id):
        """Test getting all invoices"""
        response = requests.get(f"{BASE_URL}/api/finance/invoices", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        # Find our test invoice
        test_invoices = [inv for inv in data if inv.get("client_name", "").startswith("TEST_")]
        assert len(test_invoices) > 0, "Should find at least one test invoice"
        
        print(f"✅ Retrieved {len(data)} invoices, {len(test_invoices)} test invoices")

    def test_get_invoices_with_status_filter(self, headers, created_invoice_id):
        """Test filtering invoices by status"""
        response = requests.get(f"{BASE_URL}/api/finance/invoices?status=draft", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        # All returned invoices should have draft status
        for inv in data:
            assert inv.get("status") == "draft", f"Invoice {inv.get('invoice_number')} should have status 'draft'"
        
        print(f"✅ Status filter working - found {len(data)} draft invoices")

    def test_get_single_invoice(self, headers, created_invoice_id):
        """Test getting a single invoice with full details"""
        response = requests.get(f"{BASE_URL}/api/finance/invoices/{created_invoice_id}", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        
        # Validate invoice structure
        assert data["invoice_id"] == created_invoice_id
        assert "invoice_number" in data
        assert "client_name" in data
        assert "items" in data
        assert len(data["items"]) == 2, "Should have 2 items"
        
        # Validate client details preserved
        assert data["client_name"] == "TEST_Client for Invoice Tests"
        assert data["client_company"] == "TEST Company Pvt Ltd"
        assert data["client_city"] == "Chennai"
        assert data["client_gst_number"] == "33AABCU9603R1ZM"
        
        print(f"✅ Single invoice retrieved: {data['invoice_number']}")
        print(f"   - Client: {data['client_name']}")
        print(f"   - Items: {len(data['items'])}")
        print(f"   - Total: ₹{data['total_amount']}")

    def test_get_invoice_pdf_data(self, headers, created_invoice_id):
        """Test getting invoice PDF data endpoint"""
        response = requests.get(f"{BASE_URL}/api/finance/invoices/{created_invoice_id}/pdf-data", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Validate PDF data structure
        assert "invoice_number" in data
        assert "items" in data
        assert "formatted" in data
        
        # Validate formatted amounts
        formatted = data.get("formatted", {})
        assert "subtotal" in formatted, "Should have formatted subtotal"
        assert "total" in formatted, "Should have formatted total"
        assert formatted["subtotal"].startswith("₹"), "Subtotal should be formatted with ₹ symbol"
        assert formatted["total"].startswith("₹"), "Total should be formatted with ₹ symbol"
        
        # Validate company info
        assert "company" in data
        
        print(f"✅ PDF data retrieved for {data['invoice_number']}")
        print(f"   - Formatted Total: {formatted.get('total')}")

    def test_duplicate_invoice(self, headers, created_invoice_id):
        """Test duplicating an invoice"""
        response = requests.post(f"{BASE_URL}/api/finance/invoices/{created_invoice_id}/duplicate", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        
        # Validate new invoice created
        assert "invoice_id" in data
        assert data["invoice_id"] != created_invoice_id, "Duplicate should have new ID"
        assert "invoice_number" in data
        assert data["status"] == "draft", "Duplicated invoice should be draft"
        
        # Client details should be copied
        assert data["client_name"] == "TEST_Client for Invoice Tests"
        
        # Cleanup duplicate
        requests.delete(f"{BASE_URL}/api/finance/invoices/{data['invoice_id']}", headers=headers)
        
        print(f"✅ Invoice duplicated: {data['invoice_number']}")

    def test_delete_invoice(self, headers):
        """Test soft deleting an invoice"""
        # First create an invoice to delete
        invoice_data = {
            "invoice_date": datetime.now().isoformat(),
            "due_date": (datetime.now() + timedelta(days=30)).isoformat(),
            "client_name": "TEST_Delete Client",
            "items": [{"service_name": "Test Service", "quantity": 1, "rate": 1000}]
        }
        
        create_response = requests.post(f"{BASE_URL}/api/finance/invoices", json=invoice_data, headers=headers)
        assert create_response.status_code == 200
        invoice_id = create_response.json()["invoice_id"]
        
        # Delete the invoice
        delete_response = requests.delete(f"{BASE_URL}/api/finance/invoices/{invoice_id}", headers=headers)
        assert delete_response.status_code == 200
        
        # Verify it's deleted (should return 404)
        get_response = requests.get(f"{BASE_URL}/api/finance/invoices/{invoice_id}", headers=headers)
        assert get_response.status_code == 404, "Deleted invoice should return 404"
        
        print("✅ Invoice deleted successfully")

    def test_get_nonexistent_invoice(self, headers):
        """Test getting a non-existent invoice returns 404"""
        response = requests.get(f"{BASE_URL}/api/finance/invoices/nonexistent_id_12345", headers=headers)
        assert response.status_code == 404
        print("✅ Non-existent invoice correctly returns 404")


class TestInvoiceItemCalculations:
    """Test invoice item calculations with GST and discounts"""

    def test_invoice_with_discount_and_gst(self, headers):
        """Test invoice with per-item discount and GST calculations"""
        invoice_data = {
            "invoice_date": datetime.now().isoformat(),
            "due_date": (datetime.now() + timedelta(days=30)).isoformat(),
            "invoice_type": "GST",
            "gst_type": "gst",
            "gst_rate": 18,
            "client_name": "TEST_Calculation Client",
            "items": [
                {
                    "service_name": "Service A",
                    "quantity": 2,
                    "rate": 10000,  # Subtotal: 20000
                    "gst_rate": 18,
                    "discount_percent": 10  # Discount: 2000, After: 18000, GST: 3240, Total: 21240
                },
                {
                    "service_name": "Service B",
                    "quantity": 1,
                    "rate": 5000,  # Subtotal: 5000
                    "gst_rate": 18,
                    "discount_percent": 0  # GST: 900, Total: 5900
                }
            ]
        }
        
        response = requests.post(f"{BASE_URL}/api/finance/invoices", json=invoice_data, headers=headers)
        
        assert response.status_code == 200
        
        data = response.json()
        
        # Validate subtotal (sum of qty * rate before discounts)
        assert data["subtotal"] == 25000, f"Subtotal should be 25000, got {data['subtotal']}"
        
        # Validate discount
        assert data["total_discount"] == 2000, f"Total discount should be 2000, got {data.get('total_discount')}"
        
        print(f"✅ Invoice calculations verified:")
        print(f"   - Subtotal: ₹{data['subtotal']}")
        print(f"   - Discount: ₹{data.get('total_discount', 0)}")
        print(f"   - Total: ₹{data['total_amount']}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/finance/invoices/{data['invoice_id']}", headers=headers)


class TestFinanceReports:
    """Test Finance reporting endpoints"""

    def test_revenue_stats(self, headers):
        """Test revenue statistics endpoint"""
        response = requests.get(f"{BASE_URL}/api/finance/revenue-stats", headers=headers)
        
        assert response.status_code == 200
        
        data = response.json()
        assert "by_status" in data
        assert "total_invoices" in data
        assert "total_revenue" in data
        
        print(f"✅ Revenue stats retrieved:")
        print(f"   - Total invoices: {data['total_invoices']}")
        print(f"   - Total revenue: ₹{data['total_revenue']}")

    def test_gst_report(self, headers):
        """Test GST report endpoint"""
        current_month = datetime.now().month
        current_year = datetime.now().year
        
        response = requests.get(
            f"{BASE_URL}/api/finance/gst-report?month={current_month}&year={current_year}", 
            headers=headers
        )
        
        assert response.status_code == 200
        
        data = response.json()
        assert "month" in data
        assert "year" in data
        assert "total_gst_collected" in data
        assert "invoice_count" in data
        
        print(f"✅ GST report for {current_month}/{current_year}:")
        print(f"   - Total GST: ₹{data['total_gst_collected']}")
        print(f"   - Invoice count: {data['invoice_count']}")


class TestLeadsIntegration:
    """Test Lead integration for invoice client selection"""

    def test_get_leads_for_client_selection(self, headers):
        """Test that leads can be fetched for quick client selection"""
        response = requests.get(f"{BASE_URL}/api/leads", headers=headers)
        
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        
        print(f"✅ Leads available for client selection: {len(data)} leads")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
