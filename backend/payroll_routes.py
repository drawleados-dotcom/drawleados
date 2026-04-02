"""
Payroll Management Routes
- Salary history tracking
- Salary hikes with conditions
- Payroll details by month/year
"""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
import os
import uuid

payroll_router = APIRouter(prefix="/payroll", tags=["payroll"])

# MongoDB connection
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "drawlead_db")
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]


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
    notes: Optional[str] = ""

class CreatePayslipRequest(BaseModel):
    user_id: str
    month: int
    year: int
    hr_remarks: Optional[str] = ""

class ReviewPayslipRequest(BaseModel):
    review_text: str
    
class CompanySettingsRequest(BaseModel):
    company_name: str
    company_address: str
    company_logo_url: Optional[str] = ""
    company_phone: Optional[str] = ""
    company_email: Optional[str] = ""
    company_website: Optional[str] = ""


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

@payroll_router.post("/payslip/create")
async def create_payslip(data: CreatePayslipRequest, request: Request):
    """HR creates a payslip for an employee for a specific month"""
    from server import get_current_user
    current_user = await get_current_user(request)
    
    if current_user.role not in ["admin", "super_admin", "hr_manager"]:
        raise HTTPException(status_code=403, detail="Only HR can create payslips")
    
    # Check if payslip already exists for this month
    existing = await db.payslips.find_one({
        "user_id": data.user_id,
        "month": data.month,
        "year": data.year
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="Payslip already exists for this month")
    
    # Get salary at that date
    target_date = datetime(data.year, data.month, 1)
    salary_record = await db.salary_history.find_one(
        {"user_id": data.user_id, "effective_from": {"$lte": target_date}},
        sort=[("effective_from", -1)]
    )
    
    base_salary = salary_record["amount"] if salary_record else 0
    
    # Get attendance data
    import calendar as cal
    total_days_in_month = cal.monthrange(data.year, data.month)[1]
    
    # Get calendar for working days
    calendar_data = await db.company_calendars.find_one({"month": data.month, "year": data.year})
    total_working_days = calendar_data.get("working_days", 22) if calendar_data else 22
    holidays = calendar_data.get("holidays", []) if calendar_data else []
    
    # Get attendance records
    month_start = datetime(data.year, data.month, 1)
    month_end = datetime(data.year, data.month + 1, 1) if data.month < 12 else datetime(data.year + 1, 1, 1)
    
    attendance_records = await db.attendance.find({
        "user_id": data.user_id,
        "date": {"$gte": month_start, "$lt": month_end}
    }).to_list(31)
    
    days_present = len([r for r in attendance_records if r.get("status") == "present"])
    
    # Get leave records
    leave_records = await db.leave_requests.find({
        "user_id": data.user_id,
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
    
    # Deductions
    pf_deduction = round(base_salary * 0.12, 2)
    professional_tax = 200 if base_salary > 15000 else 0
    lop_deduction = round(per_day_salary * absent_days, 2)
    total_deductions = pf_deduction + professional_tax + lop_deduction
    net_salary = round(earned_salary - pf_deduction - professional_tax, 2)
    
    # Get employee info
    employee = await db.users.find_one({"user_id": data.user_id}, {"_id": 0, "name": 1, "email": 1, "designation": 1, "employee_id": 1})
    
    payslip_id = f"payslip_{uuid.uuid4().hex[:12]}"
    
    payslip = {
        "payslip_id": payslip_id,
        "user_id": data.user_id,
        "employee_name": employee.get("name", ""),
        "employee_email": employee.get("email", ""),
        "employee_designation": employee.get("designation", ""),
        "employee_id": employee.get("employee_id", ""),
        "month": data.month,
        "year": data.year,
        "base_salary": base_salary,
        "attendance": {
            "total_working_days": total_working_days,
            "holidays": len(holidays),
            "days_present": days_present,
            "casual_leaves": casual_leaves,
            "sick_leaves": sick_leaves,
            "absent_days": absent_days
        },
        "calculation": {
            "per_day_salary": per_day_salary,
            "days_paid": days_paid,
            "earned_salary": earned_salary
        },
        "deductions": {
            "pf": pf_deduction,
            "professional_tax": professional_tax,
            "lop_deduction": lop_deduction,
            "total_deductions": total_deductions
        },
        "net_salary": net_salary,
        "status": "draft",  # draft -> operations_review -> ceo_review -> approved -> generated
        "hr_remarks": data.hr_remarks,
        "operations_review": None,
        "ceo_review": None,
        "created_by": current_user.user_id,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    
    await db.payslips.insert_one(payslip)
    payslip.pop("_id", None)
    
    return payslip


@payroll_router.get("/payslips")
async def get_payslips(month: int, year: int, status: Optional[str] = None, request: Request = None):
    """Get all payslips for a month with optional status filter"""
    from server import get_current_user
    current_user = await get_current_user(request)
    
    query = {"month": month, "year": year}
    
    # Non-admin users can only see approved payslips for themselves
    if current_user.role not in ["admin", "super_admin", "hr_manager", "operations_admin", "ceo"]:
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
    
    # Check access
    if current_user.role not in ["admin", "super_admin", "hr_manager", "operations_admin", "ceo"]:
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
    """HR submits payslip for Operations review"""
    from server import get_current_user
    current_user = await get_current_user(request)
    
    if current_user.role not in ["admin", "super_admin", "hr_manager"]:
        raise HTTPException(status_code=403, detail="Only HR can submit for review")
    
    result = await db.payslips.update_one(
        {"payslip_id": payslip_id, "status": "draft"},
        {"$set": {"status": "operations_review", "updated_at": datetime.now(timezone.utc)}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=400, detail="Payslip not found or already submitted")
    
    return {"message": "Submitted for Operations review"}


@payroll_router.put("/payslip/{payslip_id}/operations-review")
async def add_operations_review(payslip_id: str, data: ReviewPayslipRequest, request: Request):
    """Operations adds their review (without seeing salary)"""
    from server import get_current_user
    current_user = await get_current_user(request)
    
    if current_user.role not in ["admin", "super_admin", "operations_admin"]:
        raise HTTPException(status_code=403, detail="Only Operations can add review")
    
    result = await db.payslips.update_one(
        {"payslip_id": payslip_id, "status": "operations_review"},
        {"$set": {
            "operations_review": {
                "reviewer_id": current_user.user_id,
                "reviewer_name": current_user.name,
                "review_text": data.review_text,
                "reviewed_at": datetime.now(timezone.utc)
            },
            "status": "ceo_review",
            "updated_at": datetime.now(timezone.utc)
        }}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=400, detail="Payslip not found or not in operations review")
    
    return {"message": "Operations review added, submitted for CEO review"}


@payroll_router.put("/payslip/{payslip_id}/ceo-review")
async def add_ceo_review(payslip_id: str, data: ReviewPayslipRequest, request: Request):
    """CEO adds review and approves"""
    from server import get_current_user
    current_user = await get_current_user(request)
    
    if current_user.role not in ["super_admin", "ceo"]:
        raise HTTPException(status_code=403, detail="Only CEO can approve payslips")
    
    result = await db.payslips.update_one(
        {"payslip_id": payslip_id, "status": "ceo_review"},
        {"$set": {
            "ceo_review": {
                "reviewer_id": current_user.user_id,
                "reviewer_name": current_user.name,
                "review_text": data.review_text,
                "reviewed_at": datetime.now(timezone.utc)
            },
            "status": "approved",
            "updated_at": datetime.now(timezone.utc)
        }}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=400, detail="Payslip not found or not in CEO review")
    
    return {"message": "CEO approved payslip"}


@payroll_router.put("/payslip/{payslip_id}/generate")
async def generate_payslip(payslip_id: str, request: Request):
    """HR generates final payslip (marks as generated)"""
    from server import get_current_user
    current_user = await get_current_user(request)
    
    if current_user.role not in ["admin", "super_admin", "hr_manager"]:
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
    
    if current_user.role not in ["admin", "super_admin", "hr_manager"]:
        raise HTTPException(status_code=403, detail="Only HR can submit for review")
    
    result = await db.payslips.update_many(
        {"month": month, "year": year, "status": "draft"},
        {"$set": {"status": "operations_review", "updated_at": datetime.now(timezone.utc)}}
    )
    
    return {"message": f"Submitted {result.modified_count} payslips for Operations review"}


# ========== SALARY MANAGEMENT ==========

@payroll_router.get("/salary-history/{user_id}")
async def get_salary_history(user_id: str, request: Request):
    """Get complete salary history for a user"""
    from server import get_current_user
    current_user = await get_current_user(request)
    
    # Only admin or the user themselves can view
    if current_user.role not in ["admin", "super_admin", "hr_manager"] and current_user.user_id != user_id:
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
    
    if current_user.role not in ["admin", "super_admin", "hr_manager"]:
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
    
    if current_user.role not in ["admin", "super_admin", "hr_manager"]:
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
    
    # Only admin or the user themselves can view
    if current_user.role not in ["admin", "super_admin", "hr_manager"] and current_user.user_id != user_id:
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
    """Get salary overview for all employees (admin only)"""
    from server import get_current_user
    current_user = await get_current_user(request)
    
    if current_user.role not in ["admin", "super_admin", "hr_manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Get all users
    users = await db.users.find({}, {"_id": 0, "user_id": 1, "name": 1, "email": 1, "designation": 1, "join_date": 1}).to_list(100)
    
    result = []
    for user in users:
        # Get current salary (most recent)
        salary_record = await db.salary_history.find_one(
            {"user_id": user["user_id"]},
            {"_id": 0},
            sort=[("effective_from", -1)]
        )
        
        # Count total hikes
        hikes_count = await db.salary_history.count_documents({"user_id": user["user_id"]})
        
        result.append({
            **user,
            "current_salary": salary_record["amount"] if salary_record else 0,
            "total_hikes": max(0, hikes_count - 1)  # Exclude initial salary
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
