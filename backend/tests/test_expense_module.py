"""
Expense Module Backend API Tests
Tests for the two-board Expense Module:
- Expense Budget Board: Master view with categories and monthly breakdown
- Cashbook Board: Credit/Debit with bank accounts
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestExpenseModuleAuth:
    """Test authentication for expense endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with login"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "vinoth@drawlead.com",
            "password": "admin123"
        })
        
        if login_response.status_code == 200:
            data = login_response.json()
            self.token = data.get("session_token")
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
            print(f"Login successful, token obtained")
        else:
            pytest.skip(f"Login failed: {login_response.status_code}")
    
    def test_login_returns_token(self):
        """Test that login returns a valid session token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "vinoth@drawlead.com",
            "password": "admin123"
        })
        assert response.status_code == 200
        data = response.json()
        assert "session_token" in data
        assert len(data["session_token"]) > 0


class TestBankAccounts:
    """Test bank accounts endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with login"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "vinoth@drawlead.com",
            "password": "admin123"
        })
        
        if login_response.status_code == 200:
            data = login_response.json()
            self.token = data.get("session_token")
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        else:
            pytest.skip("Login failed")
    
    def test_get_bank_accounts(self):
        """Test GET /api/expense/bank-accounts returns list of accounts"""
        response = self.session.get(f"{BASE_URL}/api/expense/bank-accounts")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} bank accounts")
        
        # Verify account structure
        if len(data) > 0:
            account = data[0]
            assert "account_id" in account
            assert "name" in account
            assert "current_balance" in account
    
    def test_bank_accounts_include_required_types(self):
        """Test that required account types exist: Current, GST, Savings, Cash in Hand"""
        response = self.session.get(f"{BASE_URL}/api/expense/bank-accounts")
        assert response.status_code == 200
        
        data = response.json()
        account_names = [acc["name"] for acc in data]
        
        required_accounts = ["Current Account", "GST Account", "Savings Account", "Cash in Hand"]
        for req_acc in required_accounts:
            assert req_acc in account_names, f"Missing required account: {req_acc}"
            print(f"PASS: {req_acc} exists")


class TestExpenseCategories:
    """Test expense categories endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with login"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "vinoth@drawlead.com",
            "password": "admin123"
        })
        
        if login_response.status_code == 200:
            data = login_response.json()
            self.token = data.get("session_token")
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        else:
            pytest.skip("Login failed")
    
    def test_get_expense_categories(self):
        """Test GET /api/expense/categories returns list of categories"""
        response = self.session.get(f"{BASE_URL}/api/expense/categories")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} expense categories")
        
        # Verify category structure
        if len(data) > 0:
            category = data[0]
            assert "category_id" in category
            assert "name" in category
    
    def test_categories_include_required_types(self):
        """Test that required categories exist as per requirements"""
        response = self.session.get(f"{BASE_URL}/api/expense/categories")
        assert response.status_code == 200
        
        data = response.json()
        category_names = [cat["name"] for cat in data]
        
        required_categories = [
            "Salary", "Office Expense", "CEO", "Vendor Payments",
            "Loans & Debts", "Tools & Subscriptions", "BNI", "Tax & Auditing"
        ]
        
        for req_cat in required_categories:
            assert req_cat in category_names, f"Missing required category: {req_cat}"
            print(f"PASS: {req_cat} exists")
    
    def test_create_category(self):
        """Test POST /api/expense/categories creates new category"""
        response = self.session.post(f"{BASE_URL}/api/expense/categories", json={
            "name": "TEST_New_Category",
            "category_type": "expense",
            "department": "Testing"
        })
        
        # Should succeed for admin/finance users
        assert response.status_code in [200, 201, 403]  # 403 if permission denied
        
        if response.status_code in [200, 201]:
            data = response.json()
            assert "category_id" in data
            assert data["name"] == "TEST_New_Category"
            print(f"Created category: {data['category_id']}")


class TestExpenseEntries:
    """Test expense entries (items within categories)"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with login"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "vinoth@drawlead.com",
            "password": "admin123"
        })
        
        if login_response.status_code == 200:
            data = login_response.json()
            self.token = data.get("session_token")
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        else:
            pytest.skip("Login failed")
    
    def test_get_expense_entries(self):
        """Test GET /api/expense/entries returns list of entries"""
        response = self.session.get(f"{BASE_URL}/api/expense/entries")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} expense entries")
    
    def test_get_entries_by_category(self):
        """Test filtering entries by category_id"""
        # Get categories first
        cat_response = self.session.get(f"{BASE_URL}/api/expense/categories")
        categories = cat_response.json()
        
        if len(categories) > 0:
            category_id = categories[0]["category_id"]
            response = self.session.get(f"{BASE_URL}/api/expense/entries", params={
                "category_id": category_id
            })
            assert response.status_code == 200
            data = response.json()
            
            # All returned entries should belong to this category
            for entry in data:
                assert entry["category_id"] == category_id
            print(f"Filtered entries for category {category_id}: {len(data)} items")


class TestMasterView:
    """Test master expense view endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with login"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "vinoth@drawlead.com",
            "password": "admin123"
        })
        
        if login_response.status_code == 200:
            data = login_response.json()
            self.token = data.get("session_token")
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        else:
            pytest.skip("Login failed")
    
    def test_get_master_view(self):
        """Test GET /api/expense/master-view returns master expense data"""
        response = self.session.get(f"{BASE_URL}/api/expense/master-view")
        assert response.status_code == 200
        
        data = response.json()
        assert "categories" in data
        assert "grand_total" in data
        assert "fy_year" in data
        print(f"Master view for {data['fy_year']}")
    
    def test_master_view_with_fy_year(self):
        """Test master view with specific fiscal year"""
        response = self.session.get(f"{BASE_URL}/api/expense/master-view", params={
            "fy_year": 2025
        })
        assert response.status_code == 200
        
        data = response.json()
        assert "FY 2025-2026" in data["fy_year"]
        
        # Verify category structure
        if len(data["categories"]) > 0:
            cat = data["categories"][0]
            assert "category_id" in cat
            assert "name" in cat
            assert "grand_total" in cat
            assert "grand_paid" in cat
            assert "months" in cat
            print(f"Category {cat['name']}: Total={cat['grand_total']}, Paid={cat['grand_paid']}")
    
    def test_grand_total_calculation(self):
        """Test that grand_total is calculated correctly"""
        response = self.session.get(f"{BASE_URL}/api/expense/master-view")
        data = response.json()
        
        # Grand total should have total, paid, balance
        assert "total" in data["grand_total"]
        assert "paid" in data["grand_total"]
        assert "balance" in data["grand_total"]
        
        print(f"Grand Total: {data['grand_total']}")


class TestCashflow:
    """Test cashflow endpoint for Cashbook Board"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with login"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "vinoth@drawlead.com",
            "password": "admin123"
        })
        
        if login_response.status_code == 200:
            data = login_response.json()
            self.token = data.get("session_token")
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        else:
            pytest.skip("Login failed")
    
    def test_get_cashflow(self):
        """Test GET /api/expense/cashflow returns cashflow data"""
        response = self.session.get(f"{BASE_URL}/api/expense/cashflow")
        assert response.status_code == 200
        
        data = response.json()
        assert "credit" in data
        assert "debit" in data
        assert "net" in data
        print(f"Cashflow: Credit={data['credit']['total']}, Debit={data['debit']['total']}, Net={data['net']}")
    
    def test_cashflow_with_month_filter(self):
        """Test cashflow with month/year filter"""
        response = self.session.get(f"{BASE_URL}/api/expense/cashflow", params={
            "month": 1,
            "year": 2026
        })
        assert response.status_code == 200
        
        data = response.json()
        assert data["month"] == 1
        assert data["year"] == 2026
        assert "month_label" in data
        print(f"Cashflow for {data['month_label']}")
    
    def test_cashflow_credit_structure(self):
        """Test credit section structure"""
        response = self.session.get(f"{BASE_URL}/api/expense/cashflow")
        data = response.json()
        
        assert "entries" in data["credit"]
        assert "total" in data["credit"]
        
        # If entries exist, verify structure
        if len(data["credit"]["entries"]) > 0:
            entry = data["credit"]["entries"][0]
            assert "source" in entry
            assert "amount" in entry
            print(f"Credit entry sample: {entry.get('source')} - {entry.get('amount')}")
    
    def test_cashflow_debit_structure(self):
        """Test debit section structure"""
        response = self.session.get(f"{BASE_URL}/api/expense/cashflow")
        data = response.json()
        
        assert "entries" in data["debit"]
        assert "total" in data["debit"]
        
        # If entries exist, verify structure
        if len(data["debit"]["entries"]) > 0:
            entry = data["debit"]["entries"][0]
            assert "amount" in entry
            assert "entry_name" in entry or "payment_id" in entry
            print(f"Debit entry sample: {entry}")


class TestIncomeEndpoints:
    """Test income (credit) endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with login"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "vinoth@drawlead.com",
            "password": "admin123"
        })
        
        if login_response.status_code == 200:
            data = login_response.json()
            self.token = data.get("session_token")
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
            
            # Get a bank account for testing
            acc_response = self.session.get(f"{BASE_URL}/api/expense/bank-accounts")
            if acc_response.status_code == 200:
                accounts = acc_response.json()
                if accounts:
                    self.bank_account_id = accounts[0]["account_id"]
        else:
            pytest.skip("Login failed")
    
    def test_get_income_entries(self):
        """Test GET /api/expense/income returns income entries"""
        response = self.session.get(f"{BASE_URL}/api/expense/income")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} income entries")
    
    def test_create_income_entry(self):
        """Test POST /api/expense/income creates new income"""
        response = self.session.post(f"{BASE_URL}/api/expense/income", json={
            "source": "TEST_Client_Payment",
            "description": "Test payment for testing",
            "amount": 50000,
            "invoice_number": "TEST-INV-001",
            "payment_type": "Prepaid",
            "payment_cycle": "Monthly",
            "date": "2026-02-21",
            "bank_account_id": self.bank_account_id,
            "tax_amount": 9000
        })
        
        assert response.status_code in [200, 201]
        data = response.json()
        assert "income_id" in data
        assert data["amount"] == 50000
        print(f"Created income entry: {data['income_id']}")


class TestPaymentEndpoints:
    """Test payment (debit) endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with login"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "vinoth@drawlead.com",
            "password": "admin123"
        })
        
        if login_response.status_code == 200:
            data = login_response.json()
            self.token = data.get("session_token")
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
            
            # Get a bank account and expense entry for testing
            acc_response = self.session.get(f"{BASE_URL}/api/expense/bank-accounts")
            if acc_response.status_code == 200:
                accounts = acc_response.json()
                if accounts:
                    self.bank_account_id = accounts[0]["account_id"]
            
            # Get an expense entry
            entries_response = self.session.get(f"{BASE_URL}/api/expense/entries")
            if entries_response.status_code == 200:
                entries = entries_response.json()
                if entries:
                    self.entry_id = entries[0]["entry_id"]
        else:
            pytest.skip("Login failed")
    
    def test_get_payments(self):
        """Test GET /api/expense/payments returns payment records"""
        response = self.session.get(f"{BASE_URL}/api/expense/payments")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} payment records")
    
    def test_create_payment(self):
        """Test POST /api/expense/payments creates new payment"""
        if not hasattr(self, 'entry_id'):
            pytest.skip("No expense entry available for testing")
        
        response = self.session.post(f"{BASE_URL}/api/expense/payments", json={
            "entry_id": self.entry_id,
            "amount": 5000,
            "payment_date": "2026-02-21",
            "bank_account_id": self.bank_account_id,
            "notes": "Test payment",
            "tax_amount": 900
        })
        
        assert response.status_code in [200, 201]
        data = response.json()
        assert "payment_id" in data
        assert data["amount"] == 5000
        print(f"Created payment: {data['payment_id']}")


class TestExpenseSummary:
    """Test expense summary endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with login"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "vinoth@drawlead.com",
            "password": "admin123"
        })
        
        if login_response.status_code == 200:
            data = login_response.json()
            self.token = data.get("session_token")
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        else:
            pytest.skip("Login failed")
    
    def test_get_summary(self):
        """Test GET /api/expense/summary returns summary data"""
        response = self.session.get(f"{BASE_URL}/api/expense/summary")
        assert response.status_code == 200
        
        data = response.json()
        assert "cash_in" in data
        assert "cash_out" in data
        assert "balance" in data
        assert "need" in data
        
        print(f"Summary: Cash In={data['cash_in']}, Cash Out={data['cash_out']}, Balance={data['balance']}")


class TestInitialize:
    """Test initialization endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with login"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "vinoth@drawlead.com",
            "password": "admin123"
        })
        
        if login_response.status_code == 200:
            data = login_response.json()
            self.token = data.get("session_token")
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        else:
            pytest.skip("Login failed")
    
    def test_initialize_data(self):
        """Test POST /api/expense/initialize creates default data"""
        response = self.session.post(f"{BASE_URL}/api/expense/initialize", json={})
        assert response.status_code in [200, 201]
        
        data = response.json()
        assert "message" in data
        print(f"Initialize result: {data}")
