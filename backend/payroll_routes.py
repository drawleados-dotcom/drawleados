"""
Payroll Management Routes
- Salary history tracking
- Salary hikes with conditions
- Payroll details by month/year
- PDF Generation
"""

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
import os
import uuid
import io

payroll_router = APIRouter(prefix="/payroll", tags=["payroll"])

# MongoDB connection
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "drawlead_db")
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]


# ---- Access helpers ----
# Roles that always have HR / Payroll access by virtue of seniority.
HR_PRIVILEGED_ROLES = {"admin", "super_admin", "hr_manager"}


def _has_hr_access(user) -> bool:
    """User can manage HR/Payroll if they have a privileged role OR their
    designation grants 'hr_admin' in module_access. This matches the frontend's
    gating logic so granting "HR Admin" via designation actually works."""
    role = getattr(user, "role", None) or (user.get("role") if isinstance(user, dict) else None)
    if role in HR_PRIVILEGED_ROLES:
        return True
    modules = getattr(user, "module_access", None)
    if modules is None and isinstance(user, dict):
        modules = user.get("module_access")
    return "hr_admin" in (modules or [])


def _can_submit_payroll_for_approval(user) -> bool:
    """Submitting a month's payroll for CEO approval is deliberately stricter
    than general HR/Payroll access: HR & Finance only — never Super
    Admin/Admin, and never the CEO themselves, since the CEO is the approver
    of this batch, not the submitter.

    Matches on the `hr_manager`/`finance` role values first, then falls back
    to designation-granted `hr_admin`/`finance` module access (most real HR
    and Finance staff are set up this way rather than via the coarse `role`
    field) — but Admin/Super Admin/CEO are excluded outright regardless of
    what module access their designation happens to carry."""
    role = (getattr(user, "role", None) or (user.get("role") if isinstance(user, dict) else "") or "").lower()
    if role in ("hr_manager", "finance"):
        return True
    if role in ("admin", "super_admin", "ceo"):
        return False
    modules = getattr(user, "module_access", None)
    if modules is None and isinstance(user, dict):
        modules = user.get("module_access")
    modules = {str(m).lower() for m in (modules or [])}
    return bool(modules & {"hr_admin", "finance"})


# Pydantic Models
class SalaryRecord(BaseModel):
    amount: float
    effective_from: str  # YYYY-MM-DD
    reason: str  # performance, confirmation, annual_increase, 6_month_review, 3_month_review, initial
    notes: Optional[str] = ""

class AddSalaryRequest(BaseModel):
    user_id: str
    amount: float
    effective_from: str
    reason: str
    reason_label: Optional[str] = None  # human label for custom reasons
    notes: Optional[str] = ""

class CreatePayslipRequest(BaseModel):
    user_id: str
    month: int
    year: int
    hr_remarks: Optional[str] = ""

class ReviewPayslipRequest(BaseModel):
    review_text: Optional[str] = ""  # Optional review text
    
class CompanySettingsRequest(BaseModel):
    company_name: str
    company_address: str
    company_logo_url: Optional[str] = ""
    company_phone: Optional[str] = ""
    company_email: Optional[str] = ""
    company_website: Optional[str] = ""

class PayrollSettingsRequest(BaseModel):
    pf_enabled: bool = True
    pf_percentage: float = 12.0
    professional_tax_enabled: bool = True
    professional_tax_amount: float = 200.0
    professional_tax_threshold: float = 15000.0
    standard_hours_per_day: float = 8.0


# ========== PAYROLL SETTINGS ==========

@payroll_router.get("/settings")
async def get_payroll_settings(request: Request):
    """Get payroll calculation settings"""
    from server import get_current_user
    current_user = await get_current_user(request)
    
    settings = await db.payroll_settings.find_one({"type": "payroll_config"})
    if not settings:
        # Return defaults
        return {
            "pf_enabled": True,
            "pf_percentage": 12.0,
            "professional_tax_enabled": True,
            "professional_tax_amount": 200.0,
            "professional_tax_threshold": 15000.0,
            "standard_hours_per_day": 8.0
        }
    
    settings.pop("_id", None)
    return settings

@payroll_router.put("/settings")
async def update_payroll_settings(data: PayrollSettingsRequest, request: Request):
    """Update payroll calculation settings (HR Admin only)"""
    from server import get_current_user
    current_user = await get_current_user(request)
    
    if not _has_hr_access(current_user):
        raise HTTPException(status_code=403, detail="Only HR can update payroll settings")
    
    await db.payroll_settings.update_one(
        {"type": "payroll_config"},
        {"$set": {
            "type": "payroll_config",
            "pf_enabled": data.pf_enabled,
            "pf_percentage": data.pf_percentage,
            "professional_tax_enabled": data.professional_tax_enabled,
            "professional_tax_amount": data.professional_tax_amount,
            "professional_tax_threshold": data.professional_tax_threshold,
            "standard_hours_per_day": data.standard_hours_per_day,
            "updated_at": datetime.now(timezone.utc)
        }},
        upsert=True
    )
    
    return {"message": "Payroll settings updated successfully"}


# ========== COMPANY SETTINGS ==========

@payroll_router.get("/company-settings")
async def get_company_settings(request: Request):
    """Get company settings for payslip PDF"""
    from server import get_current_user
    current_user = await get_current_user(request)
    
    settings = await db.company_settings.find_one({"type": "payroll"})
    if not settings:
        # Return defaults
        return {
            "company_name": "Drawlead",
            "company_address": "",
            "company_logo_url": "",
            "company_phone": "",
            "company_email": "",
            "company_website": ""
        }
    
    settings.pop("_id", None)
    return settings

@payroll_router.put("/company-settings")
async def update_company_settings(data: CompanySettingsRequest, request: Request):
    """Update company settings (super_admin only)"""
    from server import get_current_user
    current_user = await get_current_user(request)
    
    if current_user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Only super admin can update company settings")
    
    await db.company_settings.update_one(
        {"type": "payroll"},
        {"$set": {
            "type": "payroll",
            "company_name": data.company_name,
            "company_address": data.company_address,
            "company_logo_url": data.company_logo_url,
            "company_phone": data.company_phone,
            "company_email": data.company_email,
            "company_website": data.company_website,
            "updated_at": datetime.now(timezone.utc)
        }},
        upsert=True
    )
    
    return {"message": "Company settings updated successfully"}


# ========== PAYSLIP WORKFLOW ==========

async def _compute_payslip_doc(user_id: str, month: int, year: int, hr_remarks: str, created_by: str) -> dict:
    """Compute a fresh (unsaved) draft payslip document for one employee/month.

    Shared by the single "Create Payslip" action and the bulk "Send to
    Approval" monthly action so the salary/attendance calculation logic
    lives in exactly one place."""
    data_user_id, data_month, data_year = user_id, month, year
    # Get payroll settings
    payroll_settings = await db.payroll_settings.find_one({"type": "payroll_config"})
    if not payroll_settings:
        payroll_settings = {
            "pf_enabled": True,
            "pf_percentage": 12.0,
            "professional_tax_enabled": True,
            "professional_tax_amount": 200.0,
            "professional_tax_threshold": 15000.0,
            "standard_hours_per_day": 8.0
        }
    
    standard_hours = payroll_settings.get("standard_hours_per_day", 8.0)

    # Get salary at that date
    target_date = datetime(data_year, data_month, 1)
    salary_record = await db.salary_history.find_one(
        {"user_id": data_user_id, "effective_from": {"$lte": target_date}},
        sort=[("effective_from", -1)]
    )

    base_salary = salary_record["amount"] if salary_record else 0

    # Get calendar for working days
    calendar_data = await db.company_calendars.find_one({"month": data_month, "year": data_year})
    total_working_days = calendar_data.get("working_days", 22) if calendar_data else 22
    holidays = calendar_data.get("holidays", []) if calendar_data else []

    # Get attendance records
    month_start = datetime(data_year, data_month, 1)
    month_end = datetime(data_year, data_month + 1, 1) if data_month < 12 else datetime(data_year + 1, 1, 1)

    attendance_records = await db.attendance.find({
        "user_id": data_user_id,
        "date": {"$gte": month_start, "$lt": month_end}
    }).to_list(31)

    days_present = len([r for r in attendance_records if r.get("status") == "present"])

    # Calculate total hours worked and extra/less hours
    total_hours_worked = sum(r.get("total_hours", 0) for r in attendance_records if r.get("status") == "present")
    expected_hours = days_present * standard_hours
    extra_hours = max(0, total_hours_worked - expected_hours)
    less_hours = max(0, expected_hours - total_hours_worked)

    # Get leave records
    leave_records = await db.leave_requests.find({
        "user_id": data_user_id,
        "status": "approved",
        "start_date": {"$lte": month_end.strftime("%Y-%m-%d")},
        "end_date": {"$gte": month_start.strftime("%Y-%m-%d")}
    }).to_list(20)

    casual_leaves = sum(r.get("days", 1) for r in leave_records if r.get("leave_type", "").lower() == "casual")
    sick_leaves = sum(r.get("days", 1) for r in leave_records if r.get("leave_type", "").lower() == "sick")
    total_leaves = casual_leaves + sick_leaves

    # Calculate absent days
    absent_days = max(0, total_working_days - days_present - total_leaves - len(holidays))

    # Calculate salary
    per_day_salary = round(base_salary / total_working_days, 2) if total_working_days > 0 else 0
    days_paid = days_present + casual_leaves + sick_leaves
    earned_salary = round(per_day_salary * days_paid, 2)

    # Deductions based on settings
    pf_enabled = payroll_settings.get("pf_enabled", True)
    pf_percentage = payroll_settings.get("pf_percentage", 12.0)
    pf_deduction = round(base_salary * (pf_percentage / 100), 2) if pf_enabled else 0

    pt_enabled = payroll_settings.get("professional_tax_enabled", True)
    pt_amount = payroll_settings.get("professional_tax_amount", 200.0)
    pt_threshold = payroll_settings.get("professional_tax_threshold", 15000.0)
    professional_tax = pt_amount if pt_enabled and base_salary > pt_threshold else 0

    lop_deduction = round(per_day_salary * absent_days, 2)
    total_deductions = pf_deduction + professional_tax + lop_deduction
    net_salary = round(earned_salary - pf_deduction - professional_tax, 2)

    # Get employee info
    employee = await db.users.find_one({"user_id": data_user_id}, {"_id": 0, "name": 1, "email": 1, "designation": 1, "employee_id": 1}) or {}

    payslip_id = f"payslip_{uuid.uuid4().hex[:12]}"

    return {
        "payslip_id": payslip_id,
        "user_id": data_user_id,
        "employee_name": employee.get("name", ""),
        "employee_email": employee.get("email", ""),
        "employee_designation": employee.get("designation", ""),
        "employee_id": employee.get("employee_id", ""),
        "month": data_month,
        "year": data_year,
        "base_salary": base_salary,
        "attendance": {
            "total_working_days": total_working_days,
            "holidays": len(holidays),
            "days_present": days_present,
            "casual_leaves": casual_leaves,
            "sick_leaves": sick_leaves,
            "absent_days": absent_days,
            "total_hours_worked": round(total_hours_worked, 2),
            "expected_hours": round(expected_hours, 2),
            "extra_hours": round(extra_hours, 2),
            "less_hours": round(less_hours, 2)
        },
        "calculation": {
            "per_day_salary": per_day_salary,
            "days_paid": days_paid,
            "earned_salary": earned_salary
        },
        "deductions": {
            "pf_enabled": pf_enabled,
            "pf_percentage": pf_percentage,
            "pf": pf_deduction,
            "professional_tax_enabled": pt_enabled,
            "professional_tax": professional_tax,
            "lop_deduction": lop_deduction,
            "total_deductions": total_deductions
        },
        "net_salary": net_salary,
        "status": "draft",  # draft -> ceo_review -> generated
        "hr_remarks": hr_remarks,
        "operations_review": None,
        "ceo_review": None,
        "created_by": created_by,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }


@payroll_router.post("/payslip/create")
async def create_payslip(data: CreatePayslipRequest, request: Request):
    """HR creates a payslip for an employee for a specific month"""
    from server import get_current_user
    current_user = await get_current_user(request)

    if not _has_hr_access(current_user):
        raise HTTPException(status_code=403, detail="Only HR can create payslips")

    existing = await db.payslips.find_one({
        "user_id": data.user_id,
        "month": data.month,
        "year": data.year
    })
    if existing:
        raise HTTPException(status_code=400, detail="Payslip already exists for this month")

    payslip = await _compute_payslip_doc(data.user_id, data.month, data.year, data.hr_remarks, current_user.user_id)
    await db.payslips.insert_one(payslip)
    payslip.pop("_id", None)
    return payslip


@payroll_router.put("/payslips/bulk-send-for-approval")
async def bulk_send_payroll_for_approval(month: int, year: int, request: Request):
    """HR's single monthly action: auto-creates a draft payslip for every
    employee who doesn't already have one this month, then submits every
    draft payslip for the month straight to CEO review as one batch — the
    CEO then approves or rejects the whole month in a single action rather
    than per-employee."""
    from server import get_current_user
    current_user = await get_current_user(request)

    if not _can_submit_payroll_for_approval(current_user):
        raise HTTPException(status_code=403, detail="Only HR or Finance can submit payroll for approval")

    existing_rows = await db.payslips.find(
        {"month": month, "year": year}, {"_id": 0, "user_id": 1}
    ).to_list(1000)
    existing_user_ids = {r["user_id"] for r in existing_rows}

    users = await db.users.find({}, {"_id": 0, "user_id": 1}).to_list(1000)
    created = 0
    for u in users:
        if u["user_id"] in existing_user_ids:
            continue
        payslip = await _compute_payslip_doc(u["user_id"], month, year, "", current_user.user_id)
        await db.payslips.insert_one(payslip)
        created += 1

    result = await db.payslips.update_many(
        {"month": month, "year": year, "status": "draft"},
        {"$set": {"status": "ceo_review", "updated_at": datetime.now(timezone.utc)}},
    )
    return {"created": created, "submitted": result.modified_count}


@payroll_router.put("/payslips/bulk-approve")
async def bulk_ceo_approve_payroll(month: int, year: int, request: Request):
    """CEO approves the ENTIRE month's payroll batch in one action — every
    payslip currently awaiting CEO review for the month flips straight to
    `generated` (ready to be paid from Cashbook)."""
    from server import get_current_user
    current_user = await get_current_user(request)

    if not _has_ceo_approval_access(current_user):
        raise HTTPException(status_code=403, detail="Only CEO can approve payroll")

    now = datetime.now(timezone.utc)
    result = await db.payslips.update_many(
        {"month": month, "year": year, "status": "ceo_review"},
        {"$set": {
            "status": "generated",
            "ceo_review": {
                "reviewer_id": current_user.user_id,
                "reviewer_name": current_user.name,
                "decision": "approved",
                "reviewed_at": now,
            },
            "generated_by": current_user.user_id,
            "generated_at": now,
            "updated_at": now,
        }},
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=400, detail="No payslips awaiting approval for this month")
    return {"message": f"Approved {result.modified_count} payslips", "approved": result.modified_count}


@payroll_router.put("/payslips/bulk-reject")
async def bulk_ceo_reject_payroll(month: int, year: int, data: ReviewPayslipRequest, request: Request):
    """CEO rejects the whole month's payroll batch with a single shared
    reason — every payslip awaiting CEO review for the month goes back to
    draft so HR can fix it and resubmit via bulk-send-for-approval."""
    from server import get_current_user
    current_user = await get_current_user(request)

    if not _has_ceo_approval_access(current_user):
        raise HTTPException(status_code=403, detail="Only CEO can reject payroll")

    now = datetime.now(timezone.utc)
    result = await db.payslips.update_many(
        {"month": month, "year": year, "status": "ceo_review"},
        {"$set": {
            "status": "draft",
            "ceo_review": {
                "reviewer_id": current_user.user_id,
                "reviewer_name": current_user.name,
                "decision": "rejected",
                "review_text": (data.review_text or "").strip(),
                "reviewed_at": now,
            },
            "updated_at": now,
        }},
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=400, detail="No payslips awaiting approval for this month")
    return {"message": f"Rejected {result.modified_count} payslips", "rejected": result.modified_count}


@payroll_router.get("/payslips")
async def get_payslips(month: int, year: int, status: Optional[str] = None, request: Request = None):
    """Get all payslips for a month with optional status filter"""
    from server import get_current_user
    current_user = await get_current_user(request)
    
    query = {"month": month, "year": year}
    
    # Non-privileged users only see approved payslips for themselves.
    # HR access (role OR hr_admin module), operations_admin, and CEO get the broader view.
    is_privileged = (
        _has_hr_access(current_user)
        or current_user.role in ("operations_admin", "ceo")
    )
    if not is_privileged:
        query["user_id"] = current_user.user_id
        query["status"] = "generated"
    elif status:
        query["status"] = status
    
    payslips = await db.payslips.find(query).to_list(100)
    for p in payslips:
        p.pop("_id", None)
        # Hide salary details for operations review
        if current_user.role == "operations_admin" and p.get("status") == "operations_review":
            p["base_salary"] = "HIDDEN"
            p["net_salary"] = "HIDDEN"
            p["calculation"] = "HIDDEN"
            p["deductions"] = "HIDDEN"
    
    return payslips


@payroll_router.get("/payslip/{payslip_id}")
async def get_payslip(payslip_id: str, request: Request):
    """Get single payslip details"""
    from server import get_current_user
    current_user = await get_current_user(request)
    
    payslip = await db.payslips.find_one({"payslip_id": payslip_id})
    if not payslip:
        raise HTTPException(status_code=404, detail="Payslip not found")
    
    # Check access — HR-privileged users + operations_admin + CEO can view all.
    is_privileged = (
        _has_hr_access(current_user)
        or current_user.role in ("operations_admin", "ceo")
    )
    if not is_privileged:
        if payslip["user_id"] != current_user.user_id or payslip["status"] != "generated":
            raise HTTPException(status_code=403, detail="Not authorized")
    
    payslip.pop("_id", None)
    
    # Hide salary for operations admin during review
    if current_user.role == "operations_admin" and payslip.get("status") == "operations_review":
        payslip["base_salary"] = "HIDDEN"
        payslip["net_salary"] = "HIDDEN"
        payslip["calculation"] = "HIDDEN"
        payslip["deductions"] = "HIDDEN"
    
    return payslip


@payroll_router.put("/payslip/{payslip_id}/submit-for-operations")
async def submit_for_operations_review(payslip_id: str, request: Request):
    """HR submits payslip → goes directly to CEO Review (Operations step removed per business rule)."""
    from server import get_current_user
    current_user = await get_current_user(request)
    
    if not _has_hr_access(current_user):
        raise HTTPException(status_code=403, detail="Only HR can submit for review")
    
    result = await db.payslips.update_one(
        {"payslip_id": payslip_id, "status": "draft"},
        {"$set": {"status": "ceo_review", "updated_at": datetime.now(timezone.utc)}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=400, detail="Payslip not found or already submitted")
    
    return {"message": "Submitted for CEO review"}


@payroll_router.put("/payslip/{payslip_id}/operations-review")
async def add_operations_review(payslip_id: str, data: ReviewPayslipRequest, request: Request):
    """Operations adds their review (without seeing salary) - review text is optional"""
    from server import get_current_user
    current_user = await get_current_user(request)
    
    if current_user.role not in ["admin", "super_admin", "operations_admin"]:
        raise HTTPException(status_code=403, detail="Only Operations can add review")
    
    # Review text is optional - if empty, just skip to CEO review
    update_data = {
        "status": "ceo_review",
        "updated_at": datetime.now(timezone.utc)
    }
    
    # Only add operations_review if review text is provided
    if data.review_text and data.review_text.strip():
        update_data["operations_review"] = {
            "reviewer_id": current_user.user_id,
            "reviewer_name": current_user.name,
            "review_text": data.review_text.strip(),
            "reviewed_at": datetime.now(timezone.utc)
        }
    
    result = await db.payslips.update_one(
        {"payslip_id": payslip_id, "status": "operations_review"},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=400, detail="Payslip not found or not in operations review")
    
    return {"message": "Submitted for CEO review"}


# ---- CEO access helper ----
def _has_ceo_approval_access(user) -> bool:
    """CEO approval allowed if role is super_admin/admin/ceo OR designation indicates CEO."""
    role = (getattr(user, "role", None) or (user.get("role") if isinstance(user, dict) else "") or "").lower()
    if role in ("super_admin", "admin", "ceo"):
        return True
    designation = (
        getattr(user, "designation", None)
        or (user.get("designation") if isinstance(user, dict) else "")
        or ""
    ).lower()
    return designation == "ceo" or "chief executive" in designation


@payroll_router.get("/approvals")
async def get_pending_ceo_approvals(request: Request):
    """List payslips waiting for CEO approval (status = ceo_review)."""
    from server import get_current_user
    current_user = await get_current_user(request)

    if not (_has_ceo_approval_access(current_user) or _has_hr_access(current_user)):
        raise HTTPException(status_code=403, detail="Not authorized")

    rows = await db.payslips.find(
        {"status": "ceo_review"}, {"_id": 0}
    ).sort([("year", -1), ("month", -1), ("created_at", -1)]).to_list(500)
    return rows


@payroll_router.put("/payslip/{payslip_id}/approve")
async def ceo_approve_payslip(payslip_id: str, request: Request):
    """CEO approves a payslip → flips ceo_review to generated directly."""
    from server import get_current_user
    current_user = await get_current_user(request)

    if not _has_ceo_approval_access(current_user):
        raise HTTPException(status_code=403, detail="Only CEO can approve payslips")

    now = datetime.now(timezone.utc)
    result = await db.payslips.update_one(
        {"payslip_id": payslip_id, "status": "ceo_review"},
        {"$set": {
            "status": "generated",
            "ceo_review": {
                "reviewer_id": current_user.user_id,
                "reviewer_name": current_user.name,
                "decision": "approved",
                "reviewed_at": now,
            },
            "generated_by": current_user.user_id,
            "generated_at": now,
            "updated_at": now,
        }},
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=400, detail="Payslip not found or not awaiting CEO approval")
    return {"message": "Payslip approved and generated"}


@payroll_router.put("/payslip/{payslip_id}/reject")
async def ceo_reject_payslip(payslip_id: str, data: ReviewPayslipRequest, request: Request):
    """CEO rejects a payslip → sends it back to draft so HR can correct & resubmit."""
    from server import get_current_user
    current_user = await get_current_user(request)

    if not _has_ceo_approval_access(current_user):
        raise HTTPException(status_code=403, detail="Only CEO can reject payslips")

    now = datetime.now(timezone.utc)
    result = await db.payslips.update_one(
        {"payslip_id": payslip_id, "status": "ceo_review"},
        {"$set": {
            "status": "draft",
            "ceo_review": {
                "reviewer_id": current_user.user_id,
                "reviewer_name": current_user.name,
                "decision": "rejected",
                "review_text": (data.review_text or "").strip(),
                "reviewed_at": now,
            },
            "updated_at": now,
        }},
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=400, detail="Payslip not found or not awaiting CEO approval")
    return {"message": "Payslip rejected and sent back to draft"}


@payroll_router.get("/payslips/payable")
async def get_payable_payslips(request: Request):
    """CEO-approved payslips still awaiting payment (fully or partially) —
    feeds the Cashbook Payroll picker. A partially-paid payslip stays in this
    list (with `amount_paid` set) so the remaining balance can be paid in a
    later cashbook entry."""
    from server import get_current_user
    current_user = await get_current_user(request)

    if not _has_hr_access(current_user):
        raise HTTPException(status_code=403, detail="Not authorized")

    rows = await db.payslips.find(
        {"status": {"$in": ["generated", "partially_paid"]}},
        {"_id": 0, "payslip_id": 1, "user_id": 1, "employee_name": 1, "employee_id": 1,
         "employee_designation": 1, "month": 1, "year": 1, "net_salary": 1, "base_salary": 1,
         "status": 1, "amount_paid": 1},
    ).sort([("year", -1), ("month", -1), ("employee_name", 1)]).to_list(500)
    for r in rows:
        r["amount_paid"] = float(r.get("amount_paid") or 0)
        r["remaining_amount"] = float(r.get("net_salary") or 0) - r["amount_paid"]
    return rows


@payroll_router.put("/payslip/{payslip_id}/mark-paid")
async def mark_payslip_paid(
    payslip_id: str,
    request: Request,
    expense_group_id: Optional[str] = None,
):
    """Mark a generated payslip as paid (called from cashbook payroll expense flow)."""
    from server import get_current_user
    current_user = await get_current_user(request)

    if not _has_hr_access(current_user):
        raise HTTPException(status_code=403, detail="Not authorized")

    now = datetime.now(timezone.utc)
    update = {
        "status": "paid",
        "paid_by": current_user.user_id,
        "paid_at": now,
        "updated_at": now,
    }
    if expense_group_id:
        update["paid_via_expense_group_id"] = expense_group_id

    result = await db.payslips.update_one(
        {"payslip_id": payslip_id, "status": "generated"},
        {"$set": update},
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=400, detail="Payslip not found or not in generated status")
    return {"message": "Payslip marked as paid"}


@payroll_router.put("/payslip/{payslip_id}/ceo-review")
async def add_ceo_review(payslip_id: str, data: ReviewPayslipRequest, request: Request):
    """CEO adds review and approves - review text is optional"""
    from server import get_current_user
    current_user = await get_current_user(request)
    
    if current_user.role not in ["super_admin", "ceo"]:
        raise HTTPException(status_code=403, detail="Only CEO can approve payslips")
    
    # Review text is optional
    update_data = {
        "status": "approved",
        "updated_at": datetime.now(timezone.utc)
    }
    
    # Only add ceo_review if review text is provided
    if data.review_text and data.review_text.strip():
        update_data["ceo_review"] = {
            "reviewer_id": current_user.user_id,
            "reviewer_name": current_user.name,
            "review_text": data.review_text.strip(),
            "reviewed_at": datetime.now(timezone.utc)
        }
    
    result = await db.payslips.update_one(
        {"payslip_id": payslip_id, "status": "ceo_review"},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=400, detail="Payslip not found or not in CEO review")
    
    return {"message": "CEO approved payslip"}


@payroll_router.put("/payslip/{payslip_id}/generate")
async def generate_payslip(payslip_id: str, request: Request):
    """HR generates final payslip (marks as generated)"""
    from server import get_current_user
    current_user = await get_current_user(request)
    
    if not _has_hr_access(current_user):
        raise HTTPException(status_code=403, detail="Only HR can generate payslips")
    
    result = await db.payslips.update_one(
        {"payslip_id": payslip_id, "status": "approved"},
        {"$set": {
            "status": "generated",
            "generated_by": current_user.user_id,
            "generated_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        }}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=400, detail="Payslip not found or not approved yet")
    
    return {"message": "Payslip generated and available for employee"}


@payroll_router.get("/employee-payslips/{user_id}")
async def get_employee_payslips(user_id: str, request: Request):
    """Get all payslips for a specific employee (for HR Admin to see previous payslips)"""
    from server import get_current_user
    current_user = await get_current_user(request)
    
    # Only HR/Admin can view other employee's payslips
    if not _has_hr_access(current_user):
        if current_user.user_id != user_id:
            raise HTTPException(status_code=403, detail="Not authorized")
    
    payslips = await db.payslips.find({"user_id": user_id}).sort([("year", -1), ("month", -1)]).to_list(24)
    for p in payslips:
        p.pop("_id", None)
    
    return payslips


@payroll_router.get("/my-payslips")
async def get_my_payslips(month: Optional[int] = None, year: Optional[int] = None, request: Request = None):
    """Employee gets their own generated payslips"""
    from server import get_current_user
    current_user = await get_current_user(request)
    
    query = {"user_id": current_user.user_id, "status": "generated"}
    if month and year:
        query["month"] = month
        query["year"] = year
    
    payslips = await db.payslips.find(query).sort([("year", -1), ("month", -1)]).to_list(24)
    for p in payslips:
        p.pop("_id", None)
    
    return payslips


@payroll_router.put("/payslip/{payslip_id}/bulk-submit-operations")
async def bulk_submit_for_operations(month: int, year: int, request: Request):
    """HR submits all draft payslips for a month for Operations review"""
    from server import get_current_user
    current_user = await get_current_user(request)
    
    if not _has_hr_access(current_user):
        raise HTTPException(status_code=403, detail="Only HR can submit for review")
    
    result = await db.payslips.update_many(
        {"month": month, "year": year, "status": "draft"},
        {"$set": {"status": "ceo_review", "updated_at": datetime.now(timezone.utc)}}
    )
    
    return {"message": f"Submitted {result.modified_count} payslips for CEO review"}


# ========== SALARY MANAGEMENT ==========

@payroll_router.get("/salary-history/{user_id}")
async def get_salary_history(user_id: str, request: Request):
    """Get complete salary history for a user"""
    from server import get_current_user
    current_user = await get_current_user(request)
    
    # Only HR-privileged users or the user themselves can view
    if not _has_hr_access(current_user) and current_user.user_id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Get salary history sorted by effective_from date descending
    history = await db.salary_history.find(
        {"user_id": user_id}
    ).sort("effective_from", -1).to_list(100)
    
    # Remove _id from results
    for record in history:
        record.pop("_id", None)
    
    # Get employee info
    employee = await db.users.find_one({"user_id": user_id}, {"_id": 0, "name": 1, "email": 1, "designation": 1, "join_date": 1})
    
    return {
        "employee": employee,
        "salary_history": history,
        "current_salary": history[0]["amount"] if history else 0,
        "total_hikes": len(history) - 1 if history else 0
    }


@payroll_router.post("/salary/add")
async def add_salary_record(salary_data: AddSalaryRequest, request: Request):
    """Add a new salary record (hike)"""
    from server import get_current_user
    current_user = await get_current_user(request)
    
    if not _has_hr_access(current_user):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Verify user exists
    user = await db.users.find_one({"user_id": salary_data.user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Parse effective date
    try:
        effective_date = datetime.strptime(salary_data.effective_from, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    
    # Create salary record
    record_id = f"sal_{uuid.uuid4().hex[:12]}"
    salary_record = {
        "record_id": record_id,
        "user_id": salary_data.user_id,
        "amount": salary_data.amount,
        "effective_from": effective_date,
        "reason": salary_data.reason,
        "reason_label": salary_data.reason_label or salary_data.reason,
        "notes": salary_data.notes or "",
        "created_by": current_user.user_id,
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.salary_history.insert_one(salary_record)
    salary_record.pop("_id", None)
    
    return salary_record


@payroll_router.delete("/salary/{record_id}")
async def delete_salary_record(record_id: str, request: Request):
    """Delete a salary record"""
    from server import get_current_user
    current_user = await get_current_user(request)
    
    if not _has_hr_access(current_user):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    result = await db.salary_history.delete_one({"record_id": record_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Record not found")
    
    return {"message": "Salary record deleted"}


@payroll_router.get("/salary-at-date/{user_id}")
async def get_salary_at_date(user_id: str, month: int, year: int, request: Request):
    """Get the salary that was active at a specific month/year"""
    from server import get_current_user
    current_user = await get_current_user(request)
    
    # Build the target date (first day of the month)
    target_date = datetime(year, month, 1)
    
    # Find the salary record that was effective at that date
    # (the most recent salary record where effective_from <= target_date)
    salary_record = await db.salary_history.find_one(
        {
            "user_id": user_id,
            "effective_from": {"$lte": target_date}
        },
        {"_id": 0},
        sort=[("effective_from", -1)]
    )
    
    if not salary_record:
        return {"salary": 0, "message": "No salary record found for this period"}
    
    return {
        "salary": salary_record["amount"],
        "effective_from": salary_record["effective_from"].strftime("%Y-%m-%d") if isinstance(salary_record["effective_from"], datetime) else salary_record["effective_from"],
        "reason": salary_record["reason"]
    }


# ========== PAYROLL DETAILS ==========

@payroll_router.get("/details/{user_id}")
async def get_payroll_details(user_id: str, month: int, year: int, request: Request):
    """Get detailed payroll for a specific month/year with attendance-based calculations"""
    from server import get_current_user
    current_user = await get_current_user(request)
    
    # Only HR-privileged users or the user themselves can view
    if not _has_hr_access(current_user) and current_user.user_id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Get the salary at that date
    target_date = datetime(year, month, 1)
    salary_record = await db.salary_history.find_one(
        {
            "user_id": user_id,
            "effective_from": {"$lte": target_date}
        },
        {"_id": 0},
        sort=[("effective_from", -1)]
    )
    
    base_salary = salary_record["amount"] if salary_record else 0
    
    # Get calendar for the month to know total working days
    calendar_data = await db.company_calendars.find_one({
        "month": month,
        "year": year
    })
    
    # Calculate total working days in the month (excluding weekends and holidays)
    import calendar as cal
    total_days_in_month = cal.monthrange(year, month)[1]
    
    # Default to 22 working days if no calendar data
    total_working_days = calendar_data.get("working_days", 22) if calendar_data else 22
    holidays = calendar_data.get("holidays", []) if calendar_data else []
    
    # Get attendance for the month
    month_start = datetime(year, month, 1)
    if month == 12:
        month_end = datetime(year + 1, 1, 1)
    else:
        month_end = datetime(year, month + 1, 1)
    
    attendance_records = await db.attendance.find({
        "user_id": user_id,
        "date": {"$gte": month_start, "$lt": month_end}
    }).to_list(31)
    
    days_present = len([r for r in attendance_records if r.get("status") == "present"])
    
    # Get leave records for the month - separate casual and sick
    leave_records = await db.leave_requests.find({
        "user_id": user_id,
        "status": "approved",
        "start_date": {"$lte": month_end.strftime("%Y-%m-%d")},
        "end_date": {"$gte": month_start.strftime("%Y-%m-%d")}
    }).to_list(20)
    
    casual_leaves = 0
    sick_leaves = 0
    for leave in leave_records:
        leave_type = leave.get("leave_type", "casual").lower()
        days = leave.get("days", 1)
        if leave_type == "casual":
            casual_leaves += days
        elif leave_type == "sick":
            sick_leaves += days
    
    total_leaves = casual_leaves + sick_leaves
    
    # Calculate absents (working days - present days - leaves - future days)
    today = datetime.now()
    current_day = today.day if today.year == year and today.month == month else total_days_in_month
    
    # For past months, use full month; for current month, calculate up to today
    if year < today.year or (year == today.year and month < today.month):
        # Past month - use total working days
        accountable_days = total_working_days
    else:
        # Current or future month - prorate working days
        accountable_days = min(current_day, total_working_days)
    
    absent_days = max(0, accountable_days - days_present - total_leaves - len(holidays))
    
    # Per day salary calculation
    per_day_salary = round(base_salary / total_working_days, 2) if total_working_days > 0 else 0
    
    # Calculate actual earnings based on days worked
    actual_working_days = days_present + casual_leaves + sick_leaves  # Paid leaves count as worked
    loss_of_pay_days = absent_days  # Only unpaid absences are deducted
    
    # Calculate salary
    earned_salary = round(per_day_salary * actual_working_days, 2)
    lop_deduction = round(per_day_salary * loss_of_pay_days, 2)
    
    # Standard deductions
    pf_deduction = round(base_salary * 0.12, 2)  # 12% PF on base
    professional_tax = 200 if base_salary > 15000 else 0
    
    total_deductions = pf_deduction + professional_tax + lop_deduction
    net_salary = round(earned_salary - pf_deduction - professional_tax, 2)
    
    # Get employee info
    employee = await db.users.find_one({"user_id": user_id}, {"_id": 0, "name": 1, "email": 1, "designation": 1, "join_date": 1})
    
    return {
        "employee": employee,
        "month": month,
        "year": year,
        "base_salary": base_salary,
        "attendance_summary": {
            "total_working_days": total_working_days,
            "total_holidays": len(holidays),
            "days_present": days_present,
            "casual_leaves": casual_leaves,
            "sick_leaves": sick_leaves,
            "absent_days": absent_days,
            "loss_of_pay_days": loss_of_pay_days
        },
        "salary_breakdown": {
            "per_day_salary": per_day_salary,
            "days_paid": actual_working_days,
            "earned_salary": earned_salary
        },
        "deductions": {
            "pf": pf_deduction,
            "professional_tax": professional_tax,
            "lop_deduction": lop_deduction
        },
        "total_deductions": round(total_deductions, 2),
        "net_salary": net_salary,
        # Keep legacy fields for backward compatibility
        "earnings": {
            "basic": base_salary,
            "hra": round(base_salary * 0.40, 2),
            "special_allowance": round(base_salary * 0.10, 2)
        },
        "gross_salary": round(base_salary * 1.5, 2),
        "attendance": {
            "days_present": days_present,
            "leave_days": total_leaves
        }
    }


# ========== EMPLOYEE SALARY OVERVIEW (for admin) ==========

@payroll_router.get("/employees")
async def get_all_employees_salary(request: Request):
    """Salary overview for all employees (admin only).

    Optimized: 2 queries total regardless of headcount, instead of 1 + 2·N (N+1 anti-pattern).
    On a 20-employee tenant on production this dropped the response from ~3-5s to <100ms.
    """
    from server import get_current_user
    current_user = await get_current_user(request)

    if not _has_hr_access(current_user):
        raise HTTPException(status_code=403, detail="Not authorized")

    # 1) All users — single round trip
    users = await db.users.find(
        {},
        {"_id": 0, "user_id": 1, "name": 1, "email": 1, "designation": 1, "join_date": 1},
    ).to_list(1000)

    if not users:
        return []

    user_ids = [u["user_id"] for u in users]

    # 2) Aggregate salary history grouped by user — one round trip for all
    sal_rows = await db.salary_history.aggregate([
        {"$match": {"user_id": {"$in": user_ids}}},
        {"$sort": {"user_id": 1, "effective_from": -1}},
        {"$group": {
            "_id": "$user_id",
            "current_amount": {"$first": "$amount"},
            "count": {"$sum": 1},
        }},
    ]).to_list(2000)
    sal_map = {r["_id"]: r for r in sal_rows}

    result = []
    for u in users:
        s = sal_map.get(u["user_id"])
        result.append({
            **u,
            "current_salary": (s or {}).get("current_amount", 0),
            "total_hikes": max(0, (s or {}).get("count", 0) - 1),  # exclude initial salary
        })
    return result


# ========== HIKE CONDITIONS ==========

HIKE_REASONS = [
    {"id": "initial", "label": "Initial Salary", "description": "Salary at joining"},
    {"id": "performance", "label": "Performance", "description": "Based on performance review"},
    {"id": "confirmation", "label": "Job Confirmation", "description": "After probation completion"},
    {"id": "annual_increase", "label": "Annual Increase", "description": "Yearly increment"},
    {"id": "6_month_review", "label": "6 Month Review", "description": "6 month performance review"},
    {"id": "3_month_review", "label": "3 Month Review", "description": "3 month probation review"},
    {"id": "promotion", "label": "Promotion", "description": "Role promotion"},
    {"id": "market_adjustment", "label": "Market Adjustment", "description": "Salary market correction"}
]

@payroll_router.get("/hike-reasons")
async def get_hike_reasons():
    """Get list of hike reasons/conditions"""
    return HIKE_REASONS



# ========== PDF GENERATION ==========

@payroll_router.get("/payslip/{payslip_id}/pdf")
async def generate_payslip_pdf(payslip_id: str, request: Request):
    """Generate and download payslip PDF"""
    from server import get_current_user
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import inch, mm
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
    from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT
    
    current_user = await get_current_user(request)
    
    # Get payslip
    payslip = await db.payslips.find_one({"payslip_id": payslip_id})
    if not payslip:
        raise HTTPException(status_code=404, detail="Payslip not found")
    
    # Check access - only generated payslips can be downloaded
    if not _has_hr_access(current_user):
        if payslip["user_id"] != current_user.user_id or payslip["status"] != "generated":
            raise HTTPException(status_code=403, detail="Not authorized")
    
    # Get company settings
    company = await db.company_settings.find_one({"type": "payroll"})
    if not company:
        company = {
            "company_name": "Drawlead",
            "company_address": "Chennai, India",
            "company_phone": "",
            "company_email": "",
            "company_website": ""
        }
    
    # Month names
    months = ['January', 'February', 'March', 'April', 'May', 'June', 
              'July', 'August', 'September', 'October', 'November', 'December']
    month_name = months[payslip['month'] - 1]
    
    # Create PDF in memory
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=20*mm, bottomMargin=20*mm, leftMargin=15*mm, rightMargin=15*mm)
    
    # Styles
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle('Title', parent=styles['Title'], fontSize=18, textColor=colors.HexColor('#6366f1'), alignment=TA_CENTER)
    subtitle_style = ParagraphStyle('Subtitle', parent=styles['Normal'], fontSize=10, textColor=colors.gray, alignment=TA_CENTER)
    header_style = ParagraphStyle('Header', parent=styles['Heading2'], fontSize=12, textColor=colors.HexColor('#1f2937'))
    normal_style = ParagraphStyle('Normal', parent=styles['Normal'], fontSize=10)
    bold_style = ParagraphStyle('Bold', parent=styles['Normal'], fontSize=10, fontName='Helvetica-Bold')
    amount_style = ParagraphStyle('Amount', parent=styles['Normal'], fontSize=10, alignment=TA_RIGHT)
    green_style = ParagraphStyle('Green', parent=styles['Normal'], fontSize=14, textColor=colors.HexColor('#10b981'), fontName='Helvetica-Bold')
    
    elements = []
    
    # Header with company name
    elements.append(Paragraph(company.get('company_name', 'Company'), title_style))
    if company.get('company_address'):
        elements.append(Paragraph(company['company_address'], subtitle_style))
    elements.append(Spacer(1, 10*mm))
    
    # Payslip title
    elements.append(Paragraph(f"PAYSLIP - {month_name} {payslip['year']}", ParagraphStyle('PayslipTitle', fontSize=14, fontName='Helvetica-Bold', alignment=TA_CENTER, textColor=colors.HexColor('#374151'))))
    elements.append(Spacer(1, 8*mm))
    
    # Employee Info Table
    emp_data = [
        ['Employee Name:', payslip.get('employee_name', 'N/A'), 'Employee ID:', payslip.get('employee_id', 'N/A')],
        ['Designation:', payslip.get('employee_designation', 'N/A'), 'Email:', payslip.get('employee_email', 'N/A')],
        ['Pay Period:', f"{month_name} {payslip['year']}", 'Generated:', datetime.now().strftime('%d %b %Y')]
    ]
    emp_table = Table(emp_data, colWidths=[80, 150, 80, 150])
    emp_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTNAME', (2, 0), (2, -1), 'Helvetica-Bold'),
        ('TEXTCOLOR', (0, 0), (0, -1), colors.gray),
        ('TEXTCOLOR', (2, 0), (2, -1), colors.gray),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    elements.append(emp_table)
    elements.append(Spacer(1, 8*mm))
    
    # Attendance Summary
    elements.append(Paragraph("ATTENDANCE SUMMARY", header_style))
    attendance = payslip.get('attendance', {})
    att_data = [
        ['Working Days', 'Present', 'Casual Leave', 'Sick Leave', 'Absent (LOP)', 'Extra Hrs', 'Less Hrs'],
        [
            str(attendance.get('total_working_days', 0)),
            str(attendance.get('days_present', 0)),
            str(attendance.get('casual_leaves', 0)),
            str(attendance.get('sick_leaves', 0)),
            str(attendance.get('absent_days', 0)),
            f"{attendance.get('extra_hours', 0):.1f}",
            f"{attendance.get('less_hours', 0):.1f}"
        ]
    ]
    att_table = Table(att_data, colWidths=[70, 60, 70, 60, 70, 50, 50])
    att_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f3f4f6')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.HexColor('#374151')),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e5e7eb')),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('TEXTCOLOR', (1, 1), (1, 1), colors.HexColor('#10b981')),  # Present - green
        ('TEXTCOLOR', (4, 1), (4, 1), colors.HexColor('#ef4444')),  # Absent - red
    ]))
    elements.append(att_table)
    elements.append(Spacer(1, 8*mm))
    
    # Earnings and Deductions side by side
    calculation = payslip.get('calculation', {})
    deductions = payslip.get('deductions', {})
    
    # Earnings
    earnings_data = [
        ['EARNINGS', ''],
        ['Base Salary', f"₹{payslip.get('base_salary', 0):,.2f}"],
        ['Per Day Salary', f"₹{calculation.get('per_day_salary', 0):,.2f}"],
        ['Days Paid', str(calculation.get('days_paid', 0))],
        ['Earned Salary', f"₹{calculation.get('earned_salary', 0):,.2f}"]
    ]
    
    # Deductions
    deductions_data = [['DEDUCTIONS', '']]
    
    if deductions.get('pf_enabled', True):
        pf_pct = deductions.get('pf_percentage', 12)
        deductions_data.append([f'PF ({pf_pct}%)', f"-₹{deductions.get('pf', 0):,.2f}"])
    
    if deductions.get('professional_tax_enabled', True) and deductions.get('professional_tax', 0) > 0:
        deductions_data.append(['Professional Tax', f"-₹{deductions.get('professional_tax', 0):,.2f}"])
    
    if deductions.get('lop_deduction', 0) > 0:
        deductions_data.append(['LOP Deduction', f"-₹{deductions.get('lop_deduction', 0):,.2f}"])
    
    deductions_data.append(['Total Deductions', f"-₹{deductions.get('total_deductions', 0):,.2f}"])
    
    # Create side-by-side tables
    earn_table = Table(earnings_data, colWidths=[100, 100])
    earn_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#dcfce7')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.HexColor('#166534')),
        ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e5e7eb')),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ('TEXTCOLOR', (1, -1), (1, -1), colors.HexColor('#10b981')),
    ]))
    
    ded_table = Table(deductions_data, colWidths=[100, 100])
    ded_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#fee2e2')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.HexColor('#991b1b')),
        ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e5e7eb')),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ('TEXTCOLOR', (1, -1), (1, -1), colors.HexColor('#ef4444')),
    ]))
    
    # Combined table
    combined_data = [[earn_table, Spacer(20, 0), ded_table]]
    combined_table = Table(combined_data)
    elements.append(combined_table)
    elements.append(Spacer(1, 10*mm))
    
    # Net Salary Box
    net_salary = payslip.get('net_salary', 0)
    net_data = [
        ['NET SALARY', f"₹{net_salary:,.2f}"]
    ]
    net_table = Table(net_data, colWidths=[200, 200])
    net_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 14),
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f0fdf4') if net_salary >= 0 else colors.HexColor('#fef2f2')),
        ('TEXTCOLOR', (0, 0), (0, 0), colors.HexColor('#374151')),
        ('TEXTCOLOR', (1, 0), (1, 0), colors.HexColor('#10b981') if net_salary >= 0 else colors.HexColor('#ef4444')),
        ('ALIGN', (0, 0), (0, 0), 'LEFT'),
        ('ALIGN', (1, 0), (1, 0), 'RIGHT'),
        ('BOX', (0, 0), (-1, -1), 2, colors.HexColor('#10b981') if net_salary >= 0 else colors.HexColor('#ef4444')),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
        ('TOPPADDING', (0, 0), (-1, -1), 12),
        ('LEFTPADDING', (0, 0), (-1, -1), 15),
        ('RIGHTPADDING', (0, 0), (-1, -1), 15),
    ]))
    elements.append(net_table)
    elements.append(Spacer(1, 10*mm))
    
    # Note: Reviews are NOT included in PDF per user request - only professional salary details
    
    # HR Remarks (optional)
    if payslip.get('hr_remarks'):
        elements.append(Paragraph("REMARKS", header_style))
        elements.append(Paragraph(payslip['hr_remarks'], normal_style))
        elements.append(Spacer(1, 8*mm))
    
    # Footer
    elements.append(Spacer(1, 10*mm))
    footer_text = "This is a computer-generated document. No signature required."
    elements.append(Paragraph(footer_text, ParagraphStyle('Footer', fontSize=8, textColor=colors.gray, alignment=TA_CENTER)))
    
    # Build PDF
    doc.build(elements)
    buffer.seek(0)
    
    # Return PDF
    filename = f"payslip_{payslip['employee_name'].replace(' ', '_')}_{month_name}_{payslip['year']}.pdf"
    
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
