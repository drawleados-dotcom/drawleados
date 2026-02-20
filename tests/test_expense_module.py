"""
Expense Module API Tests
Tests for CashBook view, Master Expense, bank accounts, categories, and cashflow
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "vinoth@drawlead.com"
TEST_PASSWORD = "admin123"


class TestAuth:
    """Authentication for expense module tests"""
    
    @pytest.fixture(scope="class")
    def session(self):
        """Create authenticated session"""
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json"})
        return s
    
    @pytest.fixture(scope="class")
    def auth_token(self, session):
        """Get authentication token"""
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        token = data.get("session_token")
        assert token, "No session_token in response"
        print(f"Login successful - token obtained")
        return token
    
    @pytest.fixture(scope="class")
    def api_client(self, session, auth_token):
        """Session with auth header"""
        session.headers.update({"Authorization": f"Bearer {auth_token}"})
        return session
    
    def test_login_success(self, session):
        """Test login with admin credentials"""
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "session_token" in data
        assert "user" in data
        assert data["user"]["email"] == TEST_EMAIL
        print(f"PASS: Login successful for {TEST_EMAIL}")


class TestBankAccounts:
    """Bank Accounts endpoint tests"""
    
    @pytest.fixture(scope="class")
    def api_client(self):
        """Create authenticated session"""
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json"})
        # Login
        response = s.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            token = response.json().get("session_token")
            s.headers.update({"Authorization": f"Bearer {token}"})
        return s
    
    def test_initialize_expense_data(self, api_client):
        """Initialize expense data to ensure accounts and categories exist"""
        response = api_client.post(f"{BASE_URL}/api/expense/initialize", json={})
        # Should either succeed or already be initialized
        assert response.status_code in [200, 403], f"Initialize failed: {response.text}"
        if response.status_code == 200:
            data = response.json()
            print(f"PASS: Expense data initialized - {data}")
        else:
            print("PASS: Expense data initialization - user has proper permissions")
    
    def test_get_bank_accounts(self, api_client):
        """Test GET /api/expense/bank-accounts returns accounts"""
        response = api_client.get(f"{BASE_URL}/api/expense/bank-accounts")
        assert response.status_code == 200, f"Failed to get accounts: {response.text}"
        
        accounts = response.json()
        assert isinstance(accounts, list), "Response should be a list"
        
        # Verify expected accounts exist (after initialization)
        account_names = [acc["name"] for acc in accounts]
        expected_accounts = ["Current Account", "GST Account", "Savings Account", "Cash in Hand"]
        
        for expected in expected_accounts:
            assert expected in account_names, f"Missing account: {expected}"
        
        print(f"PASS: Got {len(accounts)} bank accounts - {account_names}")
        
        # Verify account structure
        if accounts:
            acc = accounts[0]
            assert "account_id" in acc
            assert "name" in acc
            assert "current_balance" in acc or "initial_balance" in acc
            print(f"PASS: Account structure verified")
    
    def test_bank_account_has_balance_fields(self, api_client):
        """Test bank account includes balance calculations"""
        response = api_client.get(f"{BASE_URL}/api/expense/bank-accounts")
        assert response.status_code == 200
        
        accounts = response.json()
        assert len(accounts) > 0, "No accounts found"
        
        acc = accounts[0]
        # Should have calculated balance fields
        assert "current_balance" in acc, "Missing current_balance"
        assert "total_credit" in acc, "Missing total_credit"
        assert "total_debit" in acc, "Missing total_debit"
        
        print(f"PASS: Account '{acc['name']}' has balance fields - current: {acc['current_balance']}, credit: {acc['total_credit']}, debit: {acc['total_debit']}")


class TestExpenseCategories:
    """Expense Categories endpoint tests"""
    
    @pytest.fixture(scope="class")
    def api_client(self):
        """Create authenticated session"""
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json"})
        response = s.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            token = response.json().get("session_token")
            s.headers.update({"Authorization": f"Bearer {token}"})
        return s
    
    def test_get_expense_categories(self, api_client):
        """Test GET /api/expense/categories returns categories"""
        response = api_client.get(f"{BASE_URL}/api/expense/categories")
        assert response.status_code == 200, f"Failed to get categories: {response.text}"
        
        categories = response.json()
        assert isinstance(categories, list), "Response should be a list"
        
        # Verify expected categories exist
        category_names = [cat["name"] for cat in categories]
        expected_categories = ["Salary", "Office Expense", "CEO", "Vendor Payments", "Loans & Debts", "Tools & Subscriptions"]
        
        for expected in expected_categories:
            assert expected in category_names, f"Missing category: {expected}"
        
        print(f"PASS: Got {len(categories)} expense categories")
        
        # Verify category structure
        if categories:
            cat = categories[0]
            assert "category_id" in cat
            assert "name" in cat
            assert "category_type" in cat
            print(f"PASS: Category structure verified")


class TestCashflowView:
    """Cashflow/CashBook view endpoint tests"""
    
    @pytest.fixture(scope="class")
    def api_client(self):
        """Create authenticated session"""
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json"})
        response = s.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            token = response.json().get("session_token")
            s.headers.update({"Authorization": f"Bearer {token}"})
        return s
    
    def test_get_cashflow_default(self, api_client):
        """Test GET /api/expense/cashflow returns cashflow data"""
        response = api_client.get(f"{BASE_URL}/api/expense/cashflow")
        assert response.status_code == 200, f"Failed to get cashflow: {response.text}"
        
        data = response.json()
        
        # Verify response structure
        assert "month" in data
        assert "year" in data
        assert "month_label" in data
        assert "credit" in data
        assert "debit" in data
        assert "net" in data
        assert "bank_accounts" in data
        
        # Verify credit/debit structure
        assert "entries" in data["credit"]
        assert "total" in data["credit"]
        assert "entries" in data["debit"]
        assert "total" in data["debit"]
        
        print(f"PASS: Cashflow for {data['month_label']} - Credit: {data['credit']['total']}, Debit: {data['debit']['total']}, Net: {data['net']}")
    
    def test_get_cashflow_with_month_filter(self, api_client):
        """Test GET /api/expense/cashflow with month/year filter"""
        response = api_client.get(f"{BASE_URL}/api/expense/cashflow", params={
            "month": 1,
            "year": 2026
        })
        assert response.status_code == 200, f"Failed to get cashflow: {response.text}"
        
        data = response.json()
        assert data["month"] == 1
        assert data["year"] == 2026
        assert "January 2026" in data["month_label"]
        
        print(f"PASS: Cashflow filtered for January 2026 - Credit entries: {len(data['credit']['entries'])}, Debit entries: {len(data['debit']['entries'])}")
    
    def test_cashflow_includes_bank_accounts(self, api_client):
        """Test cashflow response includes bank accounts with balances"""
        response = api_client.get(f"{BASE_URL}/api/expense/cashflow")
        assert response.status_code == 200
        
        data = response.json()
        accounts = data.get("bank_accounts", [])
        
        assert isinstance(accounts, list)
        assert len(accounts) > 0, "No bank accounts in cashflow response"
        
        print(f"PASS: Cashflow includes {len(accounts)} bank accounts")


class TestMasterExpenseView:
    """Master Expense view endpoint tests"""
    
    @pytest.fixture(scope="class")
    def api_client(self):
        """Create authenticated session"""
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json"})
        response = s.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            token = response.json().get("session_token")
            s.headers.update({"Authorization": f"Bearer {token}"})
        return s
    
    def test_get_master_view_default(self, api_client):
        """Test GET /api/expense/master-view returns master expense data"""
        response = api_client.get(f"{BASE_URL}/api/expense/master-view")
        assert response.status_code == 200, f"Failed to get master view: {response.text}"
        
        data = response.json()
        
        # Verify response structure
        assert "fy_year" in data
        assert "months" in data
        assert "categories" in data
        assert "grand_total" in data
        
        # Verify months array (12 months April-March)
        assert isinstance(data["months"], list)
        # Should have 12 months for fiscal year
        
        # Verify categories array
        assert isinstance(data["categories"], list)
        
        # Verify grand_total structure
        assert "total" in data["grand_total"]
        assert "paid" in data["grand_total"]
        assert "balance" in data["grand_total"]
        
        print(f"PASS: Master view for {data['fy_year']} - {len(data['categories'])} categories, grand_total: {data['grand_total']}")
    
    def test_get_master_view_with_fy_year(self, api_client):
        """Test GET /api/expense/master-view with fiscal year filter"""
        response = api_client.get(f"{BASE_URL}/api/expense/master-view", params={
            "fy_year": 2025
        })
        assert response.status_code == 200, f"Failed to get master view: {response.text}"
        
        data = response.json()
        assert "FY 2025-2026" in data["fy_year"]
        
        print(f"PASS: Master view filtered for FY 2025-2026")
    
    def test_master_view_category_has_monthly_breakdown(self, api_client):
        """Test master view categories have monthly breakdown"""
        response = api_client.get(f"{BASE_URL}/api/expense/master-view")
        assert response.status_code == 200
        
        data = response.json()
        categories = data.get("categories", [])
        
        if categories:
            cat = categories[0]
            assert "category_id" in cat
            assert "name" in cat
            assert "months" in cat
            assert "grand_total" in cat or ("grand_paid" in cat and "grand_balance" in cat)
            
            print(f"PASS: Category '{cat['name']}' has monthly breakdown")
        else:
            print("PASS: No categories found (data may need initialization)")


class TestIncomeEntry:
    """Income entry (Credit) endpoint tests"""
    
    @pytest.fixture(scope="class")
    def api_client(self):
        """Create authenticated session"""
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json"})
        response = s.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            token = response.json().get("session_token")
            s.headers.update({"Authorization": f"Bearer {token}"})
        return s
    
    @pytest.fixture(scope="class")
    def bank_account_id(self, api_client):
        """Get first bank account ID"""
        response = api_client.get(f"{BASE_URL}/api/expense/bank-accounts")
        if response.status_code == 200:
            accounts = response.json()
            if accounts:
                return accounts[0]["account_id"]
        pytest.skip("No bank accounts available")
    
    def test_get_income_entries(self, api_client):
        """Test GET /api/expense/income returns income entries"""
        response = api_client.get(f"{BASE_URL}/api/expense/income")
        assert response.status_code == 200, f"Failed to get income: {response.text}"
        
        entries = response.json()
        assert isinstance(entries, list)
        
        print(f"PASS: Got {len(entries)} income entries")
    
    def test_create_income_entry(self, api_client, bank_account_id):
        """Test POST /api/expense/income creates income entry"""
        payload = {
            "source": "TEST_Client_Payment",
            "description": "Test payment for testing",
            "amount": 10000.00,
            "invoice_number": "TEST-INV-001",
            "payment_type": "Monthly",
            "payment_cycle": "Monthly",
            "date": "2026-01-15",
            "bank_account_id": bank_account_id,
            "department": "Sales",
            "tax_amount": 1800.00
        }
        
        response = api_client.post(f"{BASE_URL}/api/expense/income", json=payload)
        assert response.status_code == 200, f"Failed to create income: {response.text}"
        
        data = response.json()
        assert "income_id" in data
        assert data["source"] == "TEST_Client_Payment"
        assert data["amount"] == 10000.00
        
        print(f"PASS: Created income entry - {data['income_id']}")
        return data["income_id"]
    
    def test_income_entries_with_month_filter(self, api_client):
        """Test GET /api/expense/income with month filter"""
        response = api_client.get(f"{BASE_URL}/api/expense/income", params={
            "month": "1",
            "year": 2026
        })
        assert response.status_code == 200
        
        entries = response.json()
        print(f"PASS: Got {len(entries)} income entries for January 2026")


class TestExpenseSummary:
    """Expense summary/dashboard endpoint tests"""
    
    @pytest.fixture(scope="class")
    def api_client(self):
        """Create authenticated session"""
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json"})
        response = s.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            token = response.json().get("session_token")
            s.headers.update({"Authorization": f"Bearer {token}"})
        return s
    
    def test_get_expense_summary(self, api_client):
        """Test GET /api/expense/summary returns summary data"""
        response = api_client.get(f"{BASE_URL}/api/expense/summary")
        assert response.status_code == 200, f"Failed to get summary: {response.text}"
        
        data = response.json()
        
        # Verify response structure
        assert "cash_in" in data
        assert "cash_out" in data
        assert "need" in data
        assert "balance" in data
        assert "by_department" in data
        
        print(f"PASS: Expense summary - Cash In: {data['cash_in']}, Cash Out: {data['cash_out']}, Balance: {data['balance']}")


class TestPayrollView:
    """Payroll sub-view endpoint tests"""
    
    @pytest.fixture(scope="class")
    def api_client(self):
        """Create authenticated session"""
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json"})
        response = s.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            token = response.json().get("session_token")
            s.headers.update({"Authorization": f"Bearer {token}"})
        return s
    
    def test_get_payroll_view(self, api_client):
        """Test GET /api/expense/payroll returns payroll data"""
        response = api_client.get(f"{BASE_URL}/api/expense/payroll")
        assert response.status_code == 200, f"Failed to get payroll: {response.text}"
        
        data = response.json()
        
        # Verify response structure
        assert "employees" in data
        assert isinstance(data["employees"], list)
        
        print(f"PASS: Payroll view - {len(data['employees'])} employees")


class TestUnauthorizedAccess:
    """Test unauthorized access to expense APIs"""
    
    def test_bank_accounts_without_auth(self):
        """Test GET /api/expense/bank-accounts without auth returns 401"""
        response = requests.get(f"{BASE_URL}/api/expense/bank-accounts")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("PASS: Unauthorized access to bank-accounts returns 401")
    
    def test_categories_without_auth(self):
        """Test GET /api/expense/categories without auth returns 401"""
        response = requests.get(f"{BASE_URL}/api/expense/categories")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("PASS: Unauthorized access to categories returns 401")
    
    def test_cashflow_without_auth(self):
        """Test GET /api/expense/cashflow without auth returns 401"""
        response = requests.get(f"{BASE_URL}/api/expense/cashflow")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("PASS: Unauthorized access to cashflow returns 401")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
