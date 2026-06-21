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
    project_id: Optional[str] = None
    client_id: Optional[str] = None
    # Client Information
    client_name: str
    client_company: Optional[str] = None
    client_address: Optional[str] = None
    client_city: Optional[str] = None
    client_state: Optional[str] = None
    client_pincode: Optional[str] = None
    client_country: str = "India"
    client_gst_number: Optional[str] = None
    client_pan: Optional[str] = None
    client_email: Optional[str] = None
    client_phone: Optional[str] = None
    # Billing Details
    billing_address: Optional[str] = None
    shipping_address: Optional[str] = None
    po_number: Optional[str] = None  # Purchase Order
    reference_number: Optional[str] = None
    # Status and Type
    status: str  # draft, sent, paid, partial, overdue, cancelled
    invoice_type: str = "GST"  # GST, Non-GST, Proforma, Credit Note
    payment_status: str = "unpaid"  # unpaid, partial, paid
    # Amounts
    subtotal: float
    total_discount: float = 0.0
    discount_type: str = "percentage"  # percentage, fixed
    # Tax Details
    gst_type: str  # gst, non-gst
    gst_rate: float = 0.0  # 18, 12, 5, 28
    cgst: float = 0.0
    sgst: float = 0.0
    igst: float = 0.0
    cess: float = 0.0
    tds_rate: float = 0.0
    tds_amount: float = 0.0
    # Totals
    total_tax: float = 0.0
    total_amount: float
    paid_amount: float = 0.0
    balance_due: float = 0.0
    # Additional Info
    currency: str = "INR"
    payment_terms: Optional[str] = None
    payment_method: Optional[str] = None  # Bank Transfer, UPI, Cash, Cheque
    bank_details: Optional[str] = None
    terms_and_conditions: Optional[str] = None
    notes: Optional[str] = None
    internal_notes: Optional[str] = None
    # Template
    template_type: str = "minimal"  # minimal, corporate, modern, professional
    # Recurring
    is_recurring: bool = False
    recurring_frequency: Optional[str] = None  # weekly, monthly, quarterly, yearly
    next_invoice_date: Optional[datetime] = None
    # Tracking
    sent_date: Optional[datetime] = None
    viewed_date: Optional[datetime] = None
    payment_date: Optional[datetime] = None
    # Meta
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
    discount_percent: float = 0.0
    discount_amount: float = 0.0
    amount_before_tax: float
    gst_rate: float = 0.0
    gst_amount: float = 0.0
    amount: float

class InvoiceCreate(BaseModel):
    invoice_number: Optional[str] = None  # user can override; backend auto-generates if blank
    invoice_date: datetime
    due_date: datetime
    lead_id: Optional[str] = None
    project_id: Optional[str] = None
    client_id: Optional[str] = None
    # Client Info
    client_name: str
    client_company: Optional[str] = None
    client_address: Optional[str] = None
    client_city: Optional[str] = None
    client_state: Optional[str] = None
    client_pincode: Optional[str] = None
    client_country: str = "India"
    client_gst_number: Optional[str] = None
    client_pan: Optional[str] = None
    client_email: Optional[str] = None
    client_phone: Optional[str] = None
    # Billing
    billing_address: Optional[str] = None
    shipping_address: Optional[str] = None
    po_number: Optional[str] = None
    reference_number: Optional[str] = None
    # Type
    invoice_type: str = "GST"
    gst_type: str = "gst"
    gst_rate: float = 0.0
    discount_type: str = "percentage"
    total_discount: float = 0.0
    tds_rate: float = 0.0
    # Payment
    payment_terms: Optional[str] = None
    payment_method: Optional[str] = None
    bank_details: Optional[str] = None
    terms_and_conditions: Optional[str] = None
    notes: Optional[str] = None
    internal_notes: Optional[str] = None
    template_type: str = "minimal"
    # Recurring
    is_recurring: bool = False
    recurring_frequency: Optional[str] = None
    # Items
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
