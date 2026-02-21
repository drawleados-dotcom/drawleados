"""
Expense & Cashflow Management Module
- Master expense tracking with categories
- Monthly breakdown (Total/Paid/Balance)
- Cashflow with Credit/Debit and multiple bank accounts
- Payment recording by Finance/CEO only
- FY April-March
"""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
from bson import ObjectId
import uuid

expense_router = APIRouter(prefix="/expense", tags=["expense"])

# Database reference - will be set from server.py
db = None

def set_expense_db(database):
    global db
    db = database

# ============== MODELS ==============

class BankAccountCreate(BaseModel):
    name: str  # Current Account, Savings, GST, Cash in Hand
    account_number: Optional[str] = None
    bank_name: Optional[str] = None
    initial_balance: float = 0

class ExpenseCategoryCreate(BaseModel):
    name: str  # Salary, Office Exp, CEO, Vendor Payments, etc.
    category_type: str = "expense"  # expense, income
    department: Optional[str] = None  # Sales, Marketing, Operations, HR, Finance, etc.

class ExpenseEntryCreate(BaseModel):
    category_id: str
    name: str  # e.g., "Anbu Salary", "Office Rent"
    description: Optional[str] = None
    total_amount: float
    recurring: bool = False
    recurring_type: Optional[str] = None  # monthly, quarterly, yearly
    department: Optional[str] = None
    # For payroll
    employee_name: Optional[str] = None
    position: Optional[str] = None
    standard_salary: Optional[float] = None

class PaymentRecordCreate(BaseModel):
    entry_id: str
    amount: float
    payment_date: str  # YYYY-MM-DD
    bank_account_id: str
    notes: Optional[str] = None
    tax_amount: Optional[float] = 0
    verified: bool = False

class IncomeEntryCreate(BaseModel):
    source: str  # Client name, Project name
    description: Optional[str] = None
    amount: float
    invoice_number: Optional[str] = None
    payment_type: str  # Monthly, Partial Payment, Full Payment
    payment_cycle: Optional[str] = None
    date: str
    bank_account_id: str
    department: Optional[str] = None
    tax_amount: Optional[float] = 0

# ============== AUTH HELPER ==============

async def get_current_user(request: Request):
    """Get current user from session token"""
    session_token = None
    
    # Check cookie first
    if "session_token" in request.cookies:
        session_token = request.cookies.get("session_token")
    
    # Fallback to Authorization header
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header.split(" ")[1]
    
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    session = await db.user_sessions.find_one({"session_token": session_token})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    # Check expiry
    expires_at = session.get("expires_at")
    if expires_at:
        if isinstance(expires_at, str):
            expires_at = datetime.fromisoformat(expires_at)
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at < datetime.now(timezone.utc):
            raise HTTPException(status_code=401, detail="Session expired")
    
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    return user

def can_manage_finance(user):
    """Only Finance and CEO can manage expenses"""
    return user.get("role") in ["super_admin", "admin", "finance"]

# ============== BANK ACCOUNTS ==============

@expense_router.get("/bank-accounts")
async def get_bank_accounts(request: Request):
    """Get all bank accounts with balances"""
    user = await get_current_user(request)
    
    accounts = await db.bank_accounts.find({}, {"_id": 0}).to_list(20)
    
    # Calculate current balance for each account
    for acc in accounts:
        # Sum all income to this account
        income = await db.income_entries.aggregate([
            {"$match": {"bank_account_id": acc["account_id"]}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
        ]).to_list(1)
        
        # Sum all payments from this account
        payments = await db.expense_payments.aggregate([
            {"$match": {"bank_account_id": acc["account_id"]}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
        ]).to_list(1)
        
        income_total = income[0]["total"] if income else 0
        payment_total = payments[0]["total"] if payments else 0
        
        acc["current_balance"] = acc.get("initial_balance", 0) + income_total - payment_total
        acc["total_credit"] = income_total
        acc["total_debit"] = payment_total
    
    return accounts

@expense_router.post("/bank-accounts")
async def create_bank_account(request: Request, data: BankAccountCreate):
    """Create a new bank account"""
    user = await get_current_user(request)
    if not can_manage_finance(user):
        raise HTTPException(status_code=403, detail="Only Finance/CEO can manage accounts")
    
    account_id = f"acc_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc)
    
    account = {
        "account_id": account_id,
        "name": data.name,
        "account_number": data.account_number,
        "bank_name": data.bank_name,
        "initial_balance": data.initial_balance,
        "created_at": now,
        "created_by": user["user_id"]
    }
    
    await db.bank_accounts.insert_one(account)
    account.pop("_id", None)
    return account

# ============== EXPENSE CATEGORIES ==============

@expense_router.get("/categories")
async def get_expense_categories(request: Request):
    """Get all expense categories"""
    user = await get_current_user(request)
    
    categories = await db.expense_categories.find({}, {"_id": 0}).to_list(50)
    return categories

@expense_router.post("/categories")
async def create_expense_category(request: Request, data: ExpenseCategoryCreate):
    """Create a new expense category"""
    user = await get_current_user(request)
    if not can_manage_finance(user):
        raise HTTPException(status_code=403, detail="Only Finance/CEO can manage categories")
    
    category_id = f"expcat_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc)
    
    category = {
        "category_id": category_id,
        "name": data.name,
        "category_type": data.category_type,
        "department": data.department,
        "created_at": now,
        "created_by": user["user_id"]
    }
    
    await db.expense_categories.insert_one(category)
    category.pop("_id", None)
    return category

# ============== EXPENSE ENTRIES ==============

@expense_router.get("/entries")
async def get_expense_entries(
    request: Request, 
    category_id: Optional[str] = None, 
    department: Optional[str] = None,
    month: Optional[int] = None,
    year: Optional[int] = None
):
    """Get expense entries with filters"""
    user = await get_current_user(request)
    
    query = {}
    if category_id:
        query["category_id"] = category_id
    if department:
        query["department"] = department
    
    # Date filters for month/year
    if month and year:
        from datetime import datetime, timezone
        start_date = datetime(year, month, 1, tzinfo=timezone.utc)
        if month == 12:
            end_date = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
        else:
            end_date = datetime(year, month + 1, 1, tzinfo=timezone.utc)
        query["created_at"] = {"$gte": start_date.isoformat(), "$lt": end_date.isoformat()}
    
    entries = await db.expense_entries.find(query, {"_id": 0}).to_list(500)
    
    # Get payments for each entry
    for entry in entries:
        payments = await db.expense_payments.find(
            {"entry_id": entry["entry_id"]},
            {"_id": 0}
        ).to_list(100)
        
        entry["payments"] = payments
        entry["total_paid"] = sum(p["amount"] for p in payments)
        entry["balance"] = entry["total_amount"] - entry["total_paid"]
    
    return entries

@expense_router.post("/entries")
async def create_expense_entry(request: Request, data: ExpenseEntryCreate):
    """Create a new expense entry"""
    user = await get_current_user(request)
    if not can_manage_finance(user):
        raise HTTPException(status_code=403, detail="Only Finance/CEO can add expenses")
    
    entry_id = f"exp_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc)
    
    entry = {
        "entry_id": entry_id,
        "category_id": data.category_id,
        "name": data.name,
        "description": data.description,
        "total_amount": data.total_amount,
        "recurring": data.recurring,
        "recurring_type": data.recurring_type,
        "department": data.department,
        "employee_name": data.employee_name,
        "position": data.position,
        "standard_salary": data.standard_salary,
        "created_at": now,
        "created_by": user["user_id"]
    }
    
    await db.expense_entries.insert_one(entry)
    entry.pop("_id", None)
    return entry

@expense_router.delete("/entries/{entry_id}")
async def delete_expense_entry(request: Request, entry_id: str):
    """Delete an expense entry"""
    user = await get_current_user(request)
    if not can_manage_finance(user):
        raise HTTPException(status_code=403, detail="Only Finance/CEO can delete expenses")
    
    # Delete related payments first
    await db.expense_payments.delete_many({"entry_id": entry_id})
    
    result = await db.expense_entries.delete_one({"entry_id": entry_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Entry not found")
    
    return {"message": "Entry deleted"}

# ============== PAYMENT RECORDS ==============

@expense_router.post("/payments")
async def record_payment(request: Request, data: PaymentRecordCreate):
    """Record a payment for an expense entry"""
    user = await get_current_user(request)
    if not can_manage_finance(user):
        raise HTTPException(status_code=403, detail="Only Finance/CEO can record payments")
    
    # Verify entry exists
    entry = await db.expense_entries.find_one({"entry_id": data.entry_id})
    if not entry:
        raise HTTPException(status_code=404, detail="Expense entry not found")
    
    # Verify bank account exists
    account = await db.bank_accounts.find_one({"account_id": data.bank_account_id})
    if not account:
        raise HTTPException(status_code=404, detail="Bank account not found")
    
    payment_id = f"pay_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc)
    
    payment = {
        "payment_id": payment_id,
        "entry_id": data.entry_id,
        "amount": data.amount,
        "payment_date": data.payment_date,
        "bank_account_id": data.bank_account_id,
        "bank_account_name": account["name"],
        "notes": data.notes,
        "tax_amount": data.tax_amount,
        "verified": data.verified,
        "created_at": now,
        "created_by": user["user_id"],
        "created_by_name": user.get("name", "Unknown")
    }
    
    await db.expense_payments.insert_one(payment)
    payment.pop("_id", None)
    return payment

@expense_router.get("/payments")
async def get_payments(request: Request, month: Optional[str] = None, year: Optional[int] = None):
    """Get all payments with optional month/year filter"""
    user = await get_current_user(request)
    
    query = {}
    if month and year:
        # Filter by month (format: YYYY-MM)
        start_date = f"{year}-{month.zfill(2)}-01"
        if int(month) == 12:
            end_date = f"{year + 1}-01-01"
        else:
            end_date = f"{year}-{str(int(month) + 1).zfill(2)}-01"
        query["payment_date"] = {"$gte": start_date, "$lt": end_date}
    
    payments = await db.expense_payments.find(query, {"_id": 0}).sort("payment_date", -1).to_list(500)
    return payments

# ============== INCOME ENTRIES ==============

@expense_router.get("/income")
async def get_income_entries(request: Request, month: Optional[str] = None, year: Optional[int] = None):
    """Get income entries"""
    user = await get_current_user(request)
    
    query = {}
    if month and year:
        start_date = f"{year}-{month.zfill(2)}-01"
        if int(month) == 12:
            end_date = f"{year + 1}-01-01"
        else:
            end_date = f"{year}-{str(int(month) + 1).zfill(2)}-01"
        query["date"] = {"$gte": start_date, "$lt": end_date}
    
    entries = await db.income_entries.find(query, {"_id": 0}).sort("date", -1).to_list(500)
    return entries

@expense_router.post("/income")
async def create_income_entry(request: Request, data: IncomeEntryCreate):
    """Record income/credit"""
    user = await get_current_user(request)
    if not can_manage_finance(user):
        raise HTTPException(status_code=403, detail="Only Finance/CEO can record income")
    
    income_id = f"inc_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc)
    
    # Get bank account name
    account = await db.bank_accounts.find_one({"account_id": data.bank_account_id})
    
    entry = {
        "income_id": income_id,
        "source": data.source,
        "description": data.description,
        "amount": data.amount,
        "invoice_number": data.invoice_number,
        "payment_type": data.payment_type,
        "payment_cycle": data.payment_cycle,
        "date": data.date,
        "bank_account_id": data.bank_account_id,
        "bank_account_name": account["name"] if account else "Unknown",
        "department": data.department,
        "tax_amount": data.tax_amount,
        "created_at": now,
        "created_by": user["user_id"]
    }
    
    await db.income_entries.insert_one(entry)
    entry.pop("_id", None)
    return entry

# ============== MASTER VIEW / DASHBOARD ==============

@expense_router.get("/master-view")
async def get_master_expense_view(request: Request, fy_year: Optional[int] = None):
    """Get master expense view with all categories and monthly breakdown"""
    user = await get_current_user(request)
    
    # Default to current FY (April-March)
    now = datetime.now()
    if fy_year is None:
        fy_year = now.year if now.month >= 4 else now.year - 1
    
    # FY months: April (4) to March (3)
    fy_months = []
    for i in range(12):
        month = ((4 + i - 1) % 12) + 1
        year = fy_year if month >= 4 else fy_year + 1
        fy_months.append({"month": month, "year": year, "label": f"{datetime(year, month, 1).strftime('%b %Y')}"})
    
    # Get all categories
    categories = await db.expense_categories.find({"category_type": "expense"}, {"_id": 0}).to_list(50)
    
    result = []
    grand_total = {"total": 0, "paid": 0, "balance": 0}
    monthly_totals = {m["label"]: {"total": 0, "paid": 0, "balance": 0} for m in fy_months}
    
    for cat in categories:
        # Get all entries for this category
        entries = await db.expense_entries.find({"category_id": cat["category_id"]}, {"_id": 0}).to_list(500)
        
        cat_data = {
            "category_id": cat["category_id"],
            "name": cat["name"],
            "grand_total": 0,
            "grand_paid": 0,
            "grand_balance": 0,
            "months": {}
        }
        
        for entry in entries:
            cat_data["grand_total"] += entry["total_amount"]
            
            # Get payments for this entry
            payments = await db.expense_payments.find({"entry_id": entry["entry_id"]}, {"_id": 0}).to_list(100)
            
            for pay in payments:
                cat_data["grand_paid"] += pay["amount"]
                
                # Add to monthly breakdown
                pay_date = datetime.strptime(pay["payment_date"], "%Y-%m-%d")
                month_label = pay_date.strftime("%b %Y")
                
                if month_label not in cat_data["months"]:
                    cat_data["months"][month_label] = {"total": 0, "paid": 0, "balance": 0}
                
                cat_data["months"][month_label]["paid"] += pay["amount"]
                monthly_totals.get(month_label, {"paid": 0})["paid"] = monthly_totals.get(month_label, {"paid": 0}).get("paid", 0) + pay["amount"]
        
        cat_data["grand_balance"] = cat_data["grand_total"] - cat_data["grand_paid"]
        
        # Calculate monthly totals based on recurring entries
        for m in fy_months:
            month_label = m["label"]
            if month_label not in cat_data["months"]:
                cat_data["months"][month_label] = {"total": 0, "paid": 0, "balance": 0}
            
            # For recurring entries, add monthly total
            recurring_total = sum(e["total_amount"] for e in entries if e.get("recurring"))
            cat_data["months"][month_label]["total"] = recurring_total
            cat_data["months"][month_label]["balance"] = cat_data["months"][month_label]["total"] - cat_data["months"][month_label]["paid"]
        
        grand_total["total"] += cat_data["grand_total"]
        grand_total["paid"] += cat_data["grand_paid"]
        grand_total["balance"] += cat_data["grand_balance"]
        
        result.append(cat_data)
    
    return {
        "fy_year": f"FY {fy_year}-{fy_year + 1}",
        "months": fy_months,
        "categories": result,
        "grand_total": grand_total
    }

@expense_router.get("/cashflow")
async def get_cashflow_view(request: Request, month: Optional[int] = None, year: Optional[int] = None):
    """Get cashflow view with Credit (Inward) and Debit (Outward)"""
    user = await get_current_user(request)
    
    now = datetime.now()
    if month is None:
        month = now.month
    if year is None:
        year = now.year
    
    # Date range for the month
    start_date = f"{year}-{str(month).zfill(2)}-01"
    if month == 12:
        end_date = f"{year + 1}-01-01"
    else:
        end_date = f"{year}-{str(month + 1).zfill(2)}-01"
    
    # Get income (Credit/Inward)
    income = await db.income_entries.find(
        {"date": {"$gte": start_date, "$lt": end_date}},
        {"_id": 0}
    ).sort("date", -1).to_list(500)
    
    # Get expense payments (Debit/Outward)
    payments = await db.expense_payments.find(
        {"payment_date": {"$gte": start_date, "$lt": end_date}},
        {"_id": 0}
    ).sort("payment_date", -1).to_list(500)
    
    # Enrich payments with entry info
    for pay in payments:
        entry = await db.expense_entries.find_one({"entry_id": pay["entry_id"]}, {"_id": 0})
        if entry:
            pay["entry_name"] = entry["name"]
            pay["category_id"] = entry["category_id"]
            # Get category name
            cat = await db.expense_categories.find_one({"category_id": entry["category_id"]})
            pay["category_name"] = cat["name"] if cat else "Unknown"
    
    # Calculate totals
    total_credit = sum(i["amount"] for i in income)
    total_debit = sum(p["amount"] for p in payments)
    
    # Get bank accounts with balances
    accounts = await get_bank_accounts(request)
    
    return {
        "month": month,
        "year": year,
        "month_label": datetime(year, month, 1).strftime("%B %Y"),
        "credit": {
            "entries": income,
            "total": total_credit
        },
        "debit": {
            "entries": payments,
            "total": total_debit
        },
        "net": total_credit - total_debit,
        "bank_accounts": accounts
    }

@expense_router.get("/summary")
async def get_expense_summary(request: Request):
    """Get summary for dashboard - Cash In, Cash Out, Need"""
    user = await get_current_user(request)
    
    # Total income
    income_total = await db.income_entries.aggregate([
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]).to_list(1)
    
    # Total expense payments
    expense_total = await db.expense_payments.aggregate([
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]).to_list(1)
    
    # Total outstanding (need)
    entries = await db.expense_entries.find({}, {"_id": 0, "entry_id": 1, "total_amount": 1}).to_list(500)
    total_expected = sum(e["total_amount"] for e in entries)
    
    cash_in = income_total[0]["total"] if income_total else 0
    cash_out = expense_total[0]["total"] if expense_total else 0
    
    # Get department-wise breakdown
    dept_summary = await db.expense_entries.aggregate([
        {"$group": {
            "_id": "$department",
            "total": {"$sum": "$total_amount"}
        }}
    ]).to_list(20)
    
    return {
        "cash_in": cash_in,
        "cash_out": cash_out,
        "need": total_expected - cash_out,
        "balance": cash_in - cash_out,
        "by_department": [{"department": d["_id"] or "General", "total": d["total"]} for d in dept_summary]
    }

# ============== PAYROLL SUB-VIEW ==============

@expense_router.get("/payroll")
async def get_payroll_view(request: Request, month: Optional[int] = None, year: Optional[int] = None):
    """Get payroll view with employees and monthly payments"""
    user = await get_current_user(request)
    
    # Get salary category
    salary_cat = await db.expense_categories.find_one({"name": {"$regex": "salary", "$options": "i"}})
    if not salary_cat:
        return {"employees": [], "totals": {}}
    
    # Get all salary entries (employees)
    entries = await db.expense_entries.find(
        {"category_id": salary_cat["category_id"]},
        {"_id": 0}
    ).to_list(100)
    
    # Get payments for each employee
    for entry in entries:
        payments = await db.expense_payments.find(
            {"entry_id": entry["entry_id"]},
            {"_id": 0}
        ).to_list(50)
        
        entry["payments"] = payments
        entry["total_paid"] = sum(p["amount"] for p in payments)
        
        # Group payments by month
        entry["by_month"] = {}
        for pay in payments:
            pay_date = datetime.strptime(pay["payment_date"], "%Y-%m-%d")
            month_key = pay_date.strftime("%Y-%m")
            if month_key not in entry["by_month"]:
                entry["by_month"][month_key] = {"paid": 0, "balance": 0}
            entry["by_month"][month_key]["paid"] += pay["amount"]
    
    return {
        "category_id": salary_cat["category_id"],
        "employees": entries,
        "grand_total": sum(e.get("standard_salary", e["total_amount"]) for e in entries),
        "total_paid": sum(e["total_paid"] for e in entries)
    }

# ============== INITIALIZE DEFAULT DATA ==============

@expense_router.post("/initialize")
async def initialize_expense_data(request: Request):
    """Initialize default expense categories and bank accounts"""
    user = await get_current_user(request)
    if not can_manage_finance(user):
        raise HTTPException(status_code=403, detail="Only Finance/CEO can initialize")
    
    now = datetime.now(timezone.utc)
    
    # Default bank accounts
    default_accounts = [
        {"name": "Current Account", "account_number": "", "bank_name": ""},
        {"name": "GST Account", "account_number": "", "bank_name": ""},
        {"name": "Savings Account", "account_number": "", "bank_name": ""},
        {"name": "Cash in Hand", "account_number": "", "bank_name": ""}
    ]
    
    for acc in default_accounts:
        exists = await db.bank_accounts.find_one({"name": acc["name"]})
        if not exists:
            await db.bank_accounts.insert_one({
                "account_id": f"acc_{uuid.uuid4().hex[:12]}",
                **acc,
                "initial_balance": 0,
                "created_at": now,
                "created_by": user["user_id"]
            })
    
    # Default expense categories
    default_categories = [
        {"name": "Salary", "category_type": "expense", "department": "HR"},
        {"name": "Office Expense", "category_type": "expense", "department": "Operations"},
        {"name": "CEO", "category_type": "expense", "department": "Executive"},
        {"name": "Vendor Payments", "category_type": "expense", "department": "Operations"},
        {"name": "Loans & Debts", "category_type": "expense", "department": "Finance"},
        {"name": "Tools & Subscriptions", "category_type": "expense", "department": "Operations"},
        {"name": "BNI", "category_type": "expense", "department": "Marketing"},
        {"name": "Tax & Auditing", "category_type": "expense", "department": "Finance"},
        {"name": "Mentorship", "category_type": "expense", "department": "HR"},
        {"name": "Events & Networking", "category_type": "expense", "department": "Marketing"},
        {"name": "Courses & Books", "category_type": "expense", "department": "HR"},
        {"name": "Marketing & Branding", "category_type": "expense", "department": "Marketing"}
    ]
    
    for cat in default_categories:
        exists = await db.expense_categories.find_one({"name": cat["name"]})
        if not exists:
            await db.expense_categories.insert_one({
                "category_id": f"expcat_{uuid.uuid4().hex[:12]}",
                **cat,
                "created_at": now,
                "created_by": user["user_id"]
            })
    
    return {"message": "Expense data initialized", "accounts": len(default_accounts), "categories": len(default_categories)}

# ============== OUTSTANDING REVENUE ==============

class OutstandingRevenueCreate(BaseModel):
    project_name: str
    project_type: str  # WhatsApp Marketing, Website, Product, Shopify, SEO, Brochure, Meta
    amount: float
    revenue_type: str  # One-time, Monthly, Quarterly
    expected_date: str  # YYYY-MM-DD
    client_name: Optional[str] = None
    remarks: Optional[str] = None
    invoice_id: Optional[str] = None

class OutstandingPaymentRecord(BaseModel):
    outstanding_id: str
    amount: float
    payment_date: str
    bank_account_id: str
    payment_type: str  # Advance, Partial, Full
    invoice_id: Optional[str] = None
    notes: Optional[str] = None

@expense_router.post("/outstanding")
async def create_outstanding_revenue(data: OutstandingRevenueCreate, request: Request):
    """Create outstanding revenue entry"""
    user = await get_current_user(request)
    
    outstanding_id = f"out_{uuid.uuid4().hex[:12]}"
    doc = {
        "outstanding_id": outstanding_id,
        "project_name": data.project_name,
        "project_type": data.project_type,
        "amount": data.amount,
        "revenue_type": data.revenue_type,
        "expected_date": data.expected_date,
        "client_name": data.client_name,
        "remarks": data.remarks,
        "invoice_id": data.invoice_id,
        "received_amount": 0,
        "balance": data.amount,
        "status": "pending",  # pending, partial, received
        "payments": [],
        "created_at": datetime.now(timezone.utc),
        "created_by": user["user_id"]
    }
    
    await db.outstanding_revenue.insert_one(doc)
    doc.pop("_id", None)
    return doc

@expense_router.get("/outstanding")
async def get_outstanding_revenue(request: Request, status: Optional[str] = None, month: Optional[int] = None, year: Optional[int] = None):
    """Get all outstanding revenue entries"""
    await get_current_user(request)
    
    query = {}
    if status:
        query["status"] = status
    if month and year:
        # Filter by expected_date month/year
        start_date = f"{year}-{str(month).zfill(2)}-01"
        if month == 12:
            end_date = f"{year + 1}-01-01"
        else:
            end_date = f"{year}-{str(month + 1).zfill(2)}-01"
        query["expected_date"] = {"$gte": start_date, "$lt": end_date}
    
    outstanding = await db.outstanding_revenue.find(query, {"_id": 0}).sort("expected_date", 1).to_list(500)
    return outstanding

@expense_router.put("/outstanding/{outstanding_id}")
async def update_outstanding_revenue(outstanding_id: str, data: OutstandingRevenueCreate, request: Request):
    """Update outstanding revenue entry"""
    user = await get_current_user(request)
    
    update_data = data.model_dump(exclude_unset=True)
    update_data["updated_at"] = datetime.now(timezone.utc)
    update_data["updated_by"] = user["user_id"]
    
    # Recalculate balance
    existing = await db.outstanding_revenue.find_one({"outstanding_id": outstanding_id})
    if existing:
        received = existing.get("received_amount", 0)
        update_data["balance"] = data.amount - received
    
    await db.outstanding_revenue.update_one(
        {"outstanding_id": outstanding_id},
        {"$set": update_data}
    )
    
    result = await db.outstanding_revenue.find_one({"outstanding_id": outstanding_id}, {"_id": 0})
    return result

@expense_router.delete("/outstanding/{outstanding_id}")
async def delete_outstanding_revenue(outstanding_id: str, request: Request):
    """Delete outstanding revenue entry"""
    await get_current_user(request)
    await db.outstanding_revenue.delete_one({"outstanding_id": outstanding_id})
    return {"message": "Deleted"}

@expense_router.post("/outstanding/{outstanding_id}/payment")
async def record_outstanding_payment(outstanding_id: str, data: OutstandingPaymentRecord, request: Request):
    """Record payment for outstanding revenue - connects to Cash In"""
    user = await get_current_user(request)
    
    # Get outstanding entry
    outstanding = await db.outstanding_revenue.find_one({"outstanding_id": outstanding_id})
    if not outstanding:
        raise HTTPException(status_code=404, detail="Outstanding entry not found")
    
    payment_id = f"outpay_{uuid.uuid4().hex[:12]}"
    payment = {
        "payment_id": payment_id,
        "amount": data.amount,
        "payment_date": data.payment_date,
        "bank_account_id": data.bank_account_id,
        "payment_type": data.payment_type,
        "invoice_id": data.invoice_id,
        "notes": data.notes,
        "recorded_at": datetime.now(timezone.utc).isoformat(),
        "recorded_by": user["user_id"]
    }
    
    # Update outstanding entry
    new_received = outstanding.get("received_amount", 0) + data.amount
    new_balance = outstanding["amount"] - new_received
    new_status = "received" if new_balance <= 0 else "partial" if new_received > 0 else "pending"
    
    await db.outstanding_revenue.update_one(
        {"outstanding_id": outstanding_id},
        {
            "$push": {"payments": payment},
            "$set": {
                "received_amount": new_received,
                "balance": max(0, new_balance),
                "status": new_status
            }
        }
    )
    
    # Also record as income entry (Cash In)
    income_id = f"inc_{uuid.uuid4().hex[:12]}"
    income_doc = {
        "income_id": income_id,
        "source": outstanding["project_name"],
        "description": f"{data.payment_type} payment - {outstanding['project_type']}",
        "amount": data.amount,
        "invoice_number": data.invoice_id,
        "payment_type": data.payment_type,
        "payment_cycle": outstanding["revenue_type"],
        "date": data.payment_date,
        "bank_account_id": data.bank_account_id,
        "outstanding_id": outstanding_id,
        "tax_amount": 0,
        "created_at": datetime.now(timezone.utc),
        "created_by": user["user_id"]
    }
    await db.income_entries.insert_one(income_doc)
    
    # Update bank account balance
    await db.bank_accounts.update_one(
        {"account_id": data.bank_account_id},
        {"$inc": {"current_balance": data.amount}}
    )
    
    result = await db.outstanding_revenue.find_one({"outstanding_id": outstanding_id}, {"_id": 0})
    return result

# ============== DASHBOARD SUMMARY ==============

@expense_router.get("/dashboard-summary")
async def get_dashboard_summary(request: Request, month: Optional[int] = None, year: Optional[int] = None):
    """Get dashboard summary with key financial metrics"""
    await get_current_user(request)
    
    now = datetime.now(timezone.utc)
    if not month:
        month = now.month
    if not year:
        year = now.year
    
    # Date range for current month
    start_date = f"{year}-{str(month).zfill(2)}-01"
    if month == 12:
        end_date = f"{year + 1}-01-01"
    else:
        end_date = f"{year}-{str(month + 1).zfill(2)}-01"
    
    # Total Revenue (income received this month)
    income_pipeline = [
        {"$match": {"date": {"$gte": start_date, "$lt": end_date}}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]
    income_result = await db.income_entries.aggregate(income_pipeline).to_list(1)
    total_revenue = income_result[0]["total"] if income_result else 0
    
    # Total Expenses this month
    expense_pipeline = [
        {"$match": {"payment_date": {"$gte": start_date, "$lt": end_date}}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]
    expense_result = await db.expense_payments.aggregate(expense_pipeline).to_list(1)
    total_expense = expense_result[0]["total"] if expense_result else 0
    
    # Outstanding Amount (pending + partial payments expected this month)
    outstanding_pipeline = [
        {"$match": {"status": {"$in": ["pending", "partial"]}}},
        {"$group": {"_id": None, "total": {"$sum": "$balance"}}}
    ]
    outstanding_result = await db.outstanding_revenue.aggregate(outstanding_pipeline).to_list(1)
    outstanding_amount = outstanding_result[0]["total"] if outstanding_result else 0
    
    # Payment Due this month (sum of expense entries for this month)
    due_pipeline = [
        {"$match": {"expected_date": {"$gte": start_date, "$lt": end_date}, "status": {"$ne": "received"}}},
        {"$group": {"_id": None, "total": {"$sum": "$balance"}}}
    ]
    due_result = await db.outstanding_revenue.aggregate(due_pipeline).to_list(1)
    payment_due = due_result[0]["total"] if due_result else 0
    
    # Profit
    profit = total_revenue - total_expense
    
    # Bank account balances
    accounts = await db.bank_accounts.find({}, {"_id": 0}).to_list(10)
    total_bank_balance = sum(acc.get("current_balance", acc.get("initial_balance", 0)) for acc in accounts)
    
    return {
        "month": month,
        "year": year,
        "total_revenue": total_revenue,
        "total_expense": total_expense,
        "outstanding_amount": outstanding_amount,
        "payment_due": payment_due,
        "profit": profit,
        "total_bank_balance": total_bank_balance,
        "accounts": accounts
    }

# ============== EXPENSE BUDGET MONTHLY VIEW ==============

@expense_router.get("/budget-monthly")
async def get_budget_monthly(request: Request, month: int, year: int, category_id: Optional[str] = None):
    """Get expense budget for a specific month with detailed breakdown"""
    await get_current_user(request)
    
    start_date = f"{year}-{str(month).zfill(2)}-01"
    if month == 12:
        end_date = f"{year + 1}-01-01"
    else:
        end_date = f"{year}-{str(month + 1).zfill(2)}-01"
    
    if category_id:
        # Get specific category items for this month
        entries = await db.expense_entries.find({"category_id": category_id}, {"_id": 0}).to_list(500)
        
        result_entries = []
        for entry in entries:
            # Get payments for this month
            payments = await db.expense_payments.find({
                "entry_id": entry["entry_id"],
                "payment_date": {"$gte": start_date, "$lt": end_date}
            }, {"_id": 0}).to_list(100)
            
            total_paid = sum(p["amount"] for p in payments)
            balance = entry["total_amount"] - total_paid
            
            # Determine status
            if total_paid >= entry["total_amount"]:
                status = "Paid"
            elif total_paid > 0:
                status = "Partial"
            else:
                status = "Pending"
            
            result_entries.append({
                "entry_id": entry["entry_id"],
                "name": entry["name"],
                "total_amount": entry["total_amount"],
                "paid": total_paid,
                "balance": balance,
                "status": status,
                "remarks": entry.get("description", ""),
                "payments": payments,
                "transaction_ids": [p.get("payment_id", "") for p in payments]
            })
        
        return {
            "month": month,
            "year": year,
            "category_id": category_id,
            "entries": result_entries,
            "summary": {
                "total": sum(e["total_amount"] for e in result_entries),
                "paid": sum(e["paid"] for e in result_entries),
                "balance": sum(e["balance"] for e in result_entries)
            }
        }
    else:
        # Get all categories summary for this month
        categories = await db.expense_categories.find({"category_type": "expense"}, {"_id": 0}).to_list(50)
        
        result_categories = []
        grand_total = 0
        grand_paid = 0
        
        for cat in categories:
            entries = await db.expense_entries.find({"category_id": cat["category_id"]}, {"_id": 0}).to_list(100)
            
            cat_total = sum(e["total_amount"] for e in entries)
            
            # Get payments for this category this month
            entry_ids = [e["entry_id"] for e in entries]
            payments = await db.expense_payments.find({
                "entry_id": {"$in": entry_ids},
                "payment_date": {"$gte": start_date, "$lt": end_date}
            }, {"_id": 0}).to_list(500)
            
            cat_paid = sum(p["amount"] for p in payments)
            
            result_categories.append({
                "category_id": cat["category_id"],
                "name": cat["name"],
                "total": cat_total,
                "paid": cat_paid,
                "balance": cat_total - cat_paid,
                "entry_count": len(entries)
            })
            
            grand_total += cat_total
            grand_paid += cat_paid
        
        return {
            "month": month,
            "year": year,
            "categories": result_categories,
            "summary": {
                "total": grand_total,
                "paid": grand_paid,
                "balance": grand_total - grand_paid
            }
        }

