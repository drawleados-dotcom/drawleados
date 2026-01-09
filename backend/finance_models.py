from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
from datetime import datetime
import uuid

# ============== FINANCE MODELS ==============

class Invoice(BaseModel):
    invoice_id: str
    invoice_number: str  # INV-2025-0001
    invoice_date: datetime
    due_date: datetime
    lead_id: Optional[str] = None
    client_name: str
    client_address: Optional[str] = None
    client_gst_number: Optional[str] = None
    client_email: Optional[str] = None
    client_phone: Optional[str] = None
    status: str  # draft, sent, paid, overdue, cancelled
    subtotal: float
    gst_type: str  # gst, non-gst
    gst_rate: float = 0.0  # 18, 12, 5, 28
    cgst: float = 0.0
    sgst: float = 0.0
    igst: float = 0.0
    total_amount: float
    payment_terms: Optional[str] = None
    notes: Optional[str] = None
    template_type: str = "minimal"  # minimal, corporate, modern
    created_by: str
    created_at: datetime
    updated_at: datetime
    is_deleted: bool = False

class InvoiceItem(BaseModel):
    item_id: str
    invoice_id: str
    service_name: str
    description: Optional[str] = None
    quantity: float = 1.0
    rate: float
    amount: float

class InvoiceCreate(BaseModel):
    invoice_date: datetime
    due_date: datetime
    lead_id: Optional[str] = None
    client_name: str
    client_address: Optional[str] = None
    client_gst_number: Optional[str] = None
    client_email: Optional[str] = None
    client_phone: Optional[str] = None
    gst_type: str
    gst_rate: float = 0.0
    payment_terms: Optional[str] = None
    notes: Optional[str] = None
    template_type: str = "minimal"
    items: List[Dict[str, Any]]

class InvoiceUpdate(BaseModel):
    invoice_date: Optional[datetime] = None
    due_date: Optional[datetime] = None
    client_name: Optional[str] = None
    client_address: Optional[str] = None
    client_gst_number: Optional[str] = None
    client_email: Optional[str] = None
    client_phone: Optional[str] = None
    status: Optional[str] = None
    gst_type: Optional[str] = None
    gst_rate: Optional[float] = None
    payment_terms: Optional[str] = None
    notes: Optional[str] = None
    template_type: Optional[str] = None
    items: Optional[List[Dict[str, Any]]] = None

class Employee(BaseModel):
    employee_id: str
    employee_code: str
    user_id: Optional[str] = None  # Link to User if they have login
    name: str
    email: EmailStr
    phone: str
    role: str  # designation
    department: str
    date_of_joining: datetime
    ctc: float  # Annual CTC
    basic_salary: float  # 50% of CTC/12
    hra: float  # 20% of CTC/12
    special_allowance: float  # 30% of CTC/12
    pf_applicable: bool = True
    pf_number: Optional[str] = None
    esi_applicable: bool = False
    esi_number: Optional[str] = None
    bank_name: Optional[str] = None
    bank_account_number: Optional[str] = None
    bank_ifsc: Optional[str] = None
    upi_id: Optional[str] = None
    pan_number: Optional[str] = None
    aadhar_number: Optional[str] = None
    is_active: bool = True
    created_at: datetime
    updated_at: datetime

class EmployeeCreate(BaseModel):
    name: str
    email: EmailStr
    phone: str
    role: str
    department: str
    date_of_joining: datetime
    ctc: float
    pf_applicable: bool = True
    pf_number: Optional[str] = None
    esi_applicable: bool = False
    esi_number: Optional[str] = None
    bank_name: Optional[str] = None
    bank_account_number: Optional[str] = None
    bank_ifsc: Optional[str] = None
    upi_id: Optional[str] = None
    pan_number: Optional[str] = None
    aadhar_number: Optional[str] = None

class Attendance(BaseModel):
    attendance_id: str
    employee_id: str
    month: int  # 1-12
    year: int
    present_days: int
    absent_days: int
    leaves: int
    total_working_days: int
    created_by: str
    created_at: datetime
    updated_at: datetime

class AttendanceCreate(BaseModel):
    employee_id: str
    month: int
    year: int
    present_days: int
    absent_days: int
    leaves: int
    total_working_days: int

class Payslip(BaseModel):
    payslip_id: str
    employee_id: str
    employee_name: str
    employee_code: str
    month: int
    year: int
    basic_salary: float
    hra: float
    special_allowance: float
    gross_salary: float
    pf_deduction: float  # 12% of basic
    esi_deduction: float
    tds_deduction: float
    other_deductions: float
    total_deductions: float
    net_salary: float
    present_days: int
    absent_days: int
    paid_days: int
    status: str  # draft, processed, sent
    generated_by: str
    generated_at: datetime
    is_deleted: bool = False

class PayslipGenerate(BaseModel):
    employee_id: str
    month: int
    year: int
    other_deductions: float = 0.0

class Budget(BaseModel):
    budget_id: str
    category: str  # marketing, salary, operations, misc
    month: int
    year: int
    allocated_amount: float
    spent_amount: float
    remaining_amount: float
    created_by: str
    created_at: datetime
    updated_at: datetime

class BudgetCreate(BaseModel):
    category: str
    month: int
    year: int
    allocated_amount: float

class BudgetUpdate(BaseModel):
    allocated_amount: Optional[float] = None
    spent_amount: Optional[float] = None

class CompanySettings(BaseModel):
    settings_id: str
    company_name: str
    company_address: str
    company_gst_number: Optional[str] = None
    company_pan: Optional[str] = None
    company_email: str
    company_phone: str
    company_website: Optional[str] = None
    bank_name: Optional[str] = None
    bank_account_number: Optional[str] = None
    bank_ifsc: Optional[str] = None
    upi_id: Optional[str] = None
    logo_url: Optional[str] = None
    invoice_terms: Optional[str] = None
    invoice_footer: Optional[str] = None
    updated_by: str
    updated_at: datetime

class CompanySettingsUpdate(BaseModel):
    company_name: Optional[str] = None
    company_address: Optional[str] = None
    company_gst_number: Optional[str] = None
    company_pan: Optional[str] = None
    company_email: Optional[str] = None
    company_phone: Optional[str] = None
    company_website: Optional[str] = None
    bank_name: Optional[str] = None
    bank_account_number: Optional[str] = None
    bank_ifsc: Optional[str] = None
    upi_id: Optional[str] = None
    logo_url: Optional[str] = None
    invoice_terms: Optional[str] = None
    invoice_footer: Optional[str] = None
