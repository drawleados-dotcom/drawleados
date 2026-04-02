"""
HR Module Routes - Employee profiles, attendance, leave management, payroll, reviews
"""
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel, EmailStr
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
import uuid
import os
import asyncio
import logging

# Import notification service
from notification_service import (
    notify_leave_request, notify_leave_decision,
    notify_permission_request, notify_permission_decision,
    notify_attendance_approval_needed,
    notify_payslip_ready, notify_payslip_acknowledged, notify_payment_released,
    get_hr_admin_emails, get_finance_emails, get_user_email_by_id
)

# Email setup
try:
    import resend
    resend.api_key = os.environ.get("RESEND_API_KEY", "")
    SENDER_EMAIL = os.environ.get("SENDER_EMAIL", "onboarding@resend.dev")
    ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@drawlead.com")
    EMAIL_ENABLED = bool(resend.api_key and resend.api_key != "re_your_api_key_here")
except ImportError:
    EMAIL_ENABLED = False
    SENDER_EMAIL = ""
    ADMIN_EMAIL = ""

logger = logging.getLogger(__name__)

hr_router = APIRouter(prefix="/hr", tags=["HR"])

# Database reference - will be set by init function
db = None

def init_hr_db(database):
    global db
    db = database

# ============== EMAIL HELPER ==============

async def send_email_notification(to_email: str, subject: str, html_content: str):
    """Send email notification asynchronously"""
    if not EMAIL_ENABLED:
        logger.info(f"Email disabled - would send to {to_email}: {subject}")
        return {"status": "mocked", "message": "Email service not configured"}
    
    try:
        params = {
            "from": SENDER_EMAIL,
            "to": [to_email],
            "subject": subject,
            "html": html_content
        }
        result = await asyncio.to_thread(resend.Emails.send, params)
        logger.info(f"Email sent to {to_email}: {subject}")
        return {"status": "success", "email_id": result.get("id")}
    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {str(e)}")
        return {"status": "error", "message": str(e)}

# ============== MODELS ==============

class EmployeeProfile(BaseModel):
    user_id: str
    # Personal Info
    full_name: str
    email: str
    phone: str = ""
    address: str = ""
    city: str = ""
    state: str = ""
    pincode: str = ""
    date_of_birth: Optional[datetime] = None
    gender: str = ""
    blood_group: str = ""
    # Employment Info
    employee_id: str = ""
    designation: str = ""
    department: str = ""
    joining_date: Optional[datetime] = None
    employment_type: str = "full-time"  # full-time, part-time, contract
    reporting_manager: str = ""
    # Bank Details
    bank_name: str = ""
    account_number: str = ""
    ifsc_code: str = ""
    pan_number: str = ""
    # Emergency Contact
    emergency_contact_name: str = ""
    emergency_contact_phone: str = ""
    emergency_contact_relation: str = ""
    # Profile
    profile_picture: str = ""
    created_at: datetime
    updated_at: datetime

class EmployeeProfileUpdate(BaseModel):
    phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    emergency_contact_relation: Optional[str] = None

class AttendanceRecord(BaseModel):
    attendance_id: str
    user_id: str
    date: datetime
    clock_in: Optional[datetime] = None
    clock_out: Optional[datetime] = None
    lunch_start: Optional[datetime] = None
    lunch_end: Optional[datetime] = None
    lunch_duration: float = 0.0  # in minutes
    work_location: str = "office"  # office, home
    total_hours: float = 0.0
    extra_hours: float = 0.0
    permission_hours: float = 0.0  # approved permission time
    status: str = "present"  # present, absent, half-day, on-leave
    approval_status: str = "auto"  # auto, pending_early_login, pending_early_logout, approved, rejected
    approval_notes: str = ""
    approved_by: Optional[str] = None
    notes: str = ""
    created_at: datetime

class ClockInRequest(BaseModel):
    work_location: str = "office"  # office, remote
    work_mode: Optional[str] = None  # Alternative field name for work_location
    login_time: Optional[str] = None  # HH:MM format - employee enters their time
    time: Optional[str] = None  # Alternative field name for login_time

class ClockOutRequest(BaseModel):
    notes: Optional[str] = ""
    logout_time: Optional[str] = None  # HH:MM format
    time: Optional[str] = None  # Alternative field name for logout_time

class LunchStartRequest(BaseModel):
    lunch_start_time: Optional[str] = None  # HH:MM format
    time: Optional[str] = None  # Alternative field name for lunch_start_time

class LunchEndRequest(BaseModel):
    lunch_end_time: Optional[str] = None  # HH:MM format
    time: Optional[str] = None  # Alternative field name for lunch_end_time

class PermissionRequest(BaseModel):
    permission_id: str
    user_id: str
    user_name: str
    date: datetime
    hours_requested: float
    reason: str
    status: str = "pending"  # pending, approved, rejected
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    created_at: datetime

class PermissionRequestCreate(BaseModel):
    date: datetime
    hours_requested: float
    reason: str

class HRSettings(BaseModel):
    settings_id: str
    standard_work_hours: float = 9.0
    standard_login_time: str = "09:00"  # HH:MM
    standard_logout_time: str = "18:00"  # HH:MM
    early_login_threshold_minutes: int = 60  # If login more than 60 mins early, needs approval
    grace_period_minutes: int = 15  # Grace period for late login
    default_lunch_duration: int = 60  # minutes
    overtime_rate_multiplier: float = 1.5
    updated_by: Optional[str] = None
    updated_at: Optional[datetime] = None

class MonthlyCalendar(BaseModel):
    calendar_id: str
    month: int
    year: int
    holidays: List[Dict[str, Any]] = []  # [{date: "2026-01-26", name: "Republic Day"}]
    working_days: int = 0
    special_working_days: List[str] = []  # Saturdays that are working
    created_by: str
    created_at: datetime

class SalaryDetails(BaseModel):
    salary_id: str
    user_id: str
    basic_salary: float
    hra: float = 0.0
    conveyance: float = 0.0
    medical: float = 0.0
    special_allowance: float = 0.0
    pf_percentage: float = 12.0
    esi_percentage: float = 0.0
    professional_tax: float = 0.0
    effective_from: datetime
    created_by: str
    created_at: datetime

class PayslipCreate(BaseModel):
    user_id: str
    month: int
    year: int
    adjustments: Optional[Dict[str, float]] = None  # bonus, deductions, etc.

class PayslipApproval(BaseModel):
    payslip_id: str
    action: str  # approve, reject
    comments: Optional[str] = None

class LeaveRequest(BaseModel):
    leave_id: str
    user_id: str
    user_name: str
    leave_type: str  # casual, sick, earned, unpaid, wfh
    start_date: datetime
    end_date: datetime
    reason: str
    status: str = "pending"  # pending, approved, rejected
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    created_at: datetime

class LeaveRequestCreate(BaseModel):
    leave_type: str
    start_date: datetime
    end_date: datetime
    reason: str

class LeaveBalance(BaseModel):
    user_id: str
    year: int
    casual_leave: int = 12
    sick_leave: int = 6
    earned_leave: int = 15
    unpaid_leave: int = 0
    casual_used: int = 0
    sick_used: int = 0
    earned_used: int = 0
    unpaid_used: int = 0

class Payslip(BaseModel):
    payslip_id: str
    user_id: str
    employee_name: str
    employee_id: str
    designation: str
    department: str
    joining_date: Optional[datetime] = None
    month: int
    year: int
    # Salary Components
    basic_salary: float
    hra: float = 0.0
    conveyance: float = 0.0
    medical: float = 0.0
    special_allowance: float = 0.0
    gross_salary: float
    # Deductions
    pf_deduction: float = 0.0
    esi_deduction: float = 0.0
    professional_tax: float = 0.0
    other_deductions: float = 0.0
    # Attendance Details
    total_working_days: int = 0
    days_present: int = 0
    days_absent: int = 0
    paid_leaves: int = 0
    extra_days: int = 0
    per_day_salary: float = 0.0
    # Net
    net_salary: float
    # Workflow
    status: str = "draft"  # draft, pending_super_admin, approved, acknowledged, pending_finance, payment_released
    created_by: str
    created_at: datetime
    super_admin_approved_by: Optional[str] = None
    super_admin_approved_at: Optional[datetime] = None
    employee_acknowledged_at: Optional[datetime] = None
    finance_released_by: Optional[str] = None
    finance_released_at: Optional[datetime] = None
    comments: str = ""

class PerformanceReview(BaseModel):
    review_id: str
    user_id: str
    reviewer_id: str
    reviewer_name: str
    quarter: str  # Q1, Q2, Q3, Q4
    year: int
    goals: List[Dict[str, Any]] = []
    achievements: str = ""
    areas_of_improvement: str = ""
    overall_rating: int = 0  # 1-5
    comments: str = ""
    employee_comments: str = ""
    status: str = "draft"  # draft, submitted, acknowledged
    created_at: datetime
    updated_at: datetime

# ============== AUTH HELPER ==============

async def get_current_user_hr(request: Request):
    """Get current user for HR routes"""
    from server import get_current_user
    return await get_current_user(request)

# ============== EMPLOYEE PROFILE ROUTES ==============

@hr_router.get("/profile")
async def get_my_profile(request: Request):
    """Get current employee's profile"""
    from server import get_current_user
    user = await get_current_user(request)
    
    profile = await db.employee_profiles.find_one(
        {"user_id": user.user_id},
        {"_id": 0}
    )
    
    if not profile:
        # Create default profile from user data
        profile = {
            "user_id": user.user_id,
            "full_name": user.name,
            "email": user.email,
            "phone": "",
            "address": "",
            "city": "",
            "state": "",
            "pincode": "",
            "date_of_birth": None,
            "gender": "",
            "blood_group": "",
            "employee_id": f"EMP{user.user_id[-6:].upper()}",
            "designation": user.role.replace("_", " ").title(),
            "department": "",
            "joining_date": user.created_at if hasattr(user, 'created_at') else datetime.now(timezone.utc),
            "employment_type": "full-time",
            "reporting_manager": "",
            "bank_name": "",
            "account_number": "",
            "ifsc_code": "",
            "pan_number": "",
            "emergency_contact_name": "",
            "emergency_contact_phone": "",
            "emergency_contact_relation": "",
            "profile_picture": user.picture or "",
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        }
        await db.employee_profiles.insert_one(profile)
        profile = await db.employee_profiles.find_one({"user_id": user.user_id}, {"_id": 0})
    
    return profile

@hr_router.put("/profile")
async def update_my_profile(update_data: EmployeeProfileUpdate, request: Request):
    """Update current employee's profile (limited fields)"""
    from server import get_current_user
    user = await get_current_user(request)
    
    update_dict = update_data.model_dump(exclude_unset=True)
    update_dict["updated_at"] = datetime.now(timezone.utc)
    
    await db.employee_profiles.update_one(
        {"user_id": user.user_id},
        {"$set": update_dict},
        upsert=True
    )
    
    return await db.employee_profiles.find_one({"user_id": user.user_id}, {"_id": 0})

@hr_router.get("/profile/{user_id}")
async def get_employee_profile(user_id: str, request: Request):
    """Get employee profile by ID (Admin only)"""
    from server import get_current_user
    current_user = await get_current_user(request)
    
    if current_user.role not in ["admin", "super_admin", "project_manager"]:
        if current_user.user_id != user_id:
            raise HTTPException(status_code=403, detail="Access denied")
    
    profile = await db.employee_profiles.find_one({"user_id": user_id}, {"_id": 0})
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    return profile

@hr_router.put("/profile/{user_id}/admin")
async def admin_update_profile(user_id: str, update_data: Dict[str, Any], request: Request):
    """Admin update employee profile (all fields)"""
    from server import get_current_user
    current_user = await get_current_user(request)
    
    if current_user.role not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    await db.employee_profiles.update_one(
        {"user_id": user_id},
        {"$set": update_data},
        upsert=True
    )
    
    return await db.employee_profiles.find_one({"user_id": user_id}, {"_id": 0})

# ============== ATTENDANCE ROUTES ==============

async def get_hr_settings():
    """Get or create default HR settings"""
    settings = await db.hr_settings.find_one({}, {"_id": 0})
    if not settings:
        settings = {
            "settings_id": f"hrs_{uuid.uuid4().hex[:8]}",
            "standard_work_hours": 9.0,
            "standard_login_time": "09:00",
            "standard_logout_time": "18:00",
            "early_login_threshold_minutes": 60,
            "grace_period_minutes": 15,
            "default_lunch_duration": 60,
            "overtime_rate_multiplier": 1.5,
            "updated_at": datetime.now(timezone.utc)
        }
        await db.hr_settings.insert_one(settings)
    return settings

def parse_time_string(time_str: str, base_date: datetime) -> datetime:
    """Parse time string and combine with date. Supports HH:MM, HH:MM AM/PM formats"""
    try:
        time_str = time_str.strip().upper()
        
        # Handle AM/PM format (e.g., "09:30 AM", "06:49 am")
        if 'AM' in time_str or 'PM' in time_str:
            # Remove AM/PM and parse
            is_pm = 'PM' in time_str
            time_str = time_str.replace('AM', '').replace('PM', '').strip()
            hours, minutes = map(int, time_str.split(':'))
            
            # Convert to 24-hour format
            if is_pm and hours != 12:
                hours += 12
            elif not is_pm and hours == 12:
                hours = 0
            
            return base_date.replace(hour=hours, minute=minutes, second=0, microsecond=0)
        else:
            # Standard HH:MM format
            hours, minutes = map(int, time_str.split(':'))
            return base_date.replace(hour=hours, minute=minutes, second=0, microsecond=0)
    except Exception as e:
        raise HTTPException(status_code=400, detail="Invalid time format. Use HH:MM or HH:MM AM/PM")

@hr_router.post("/attendance/clock-in")
async def clock_in(clock_data: ClockInRequest, request: Request):
    """Clock in for the day with time entry"""
    from server import get_current_user
    user = await get_current_user(request)
    
    settings = await get_hr_settings()
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    
    # Check if already clocked in today
    existing = await db.attendance.find_one({
        "user_id": user.user_id,
        "date": {"$gte": today, "$lt": today + timedelta(days=1)}
    })
    
    if existing and existing.get("clock_in"):
        raise HTTPException(status_code=400, detail="Already clocked in today")
    
    # Determine login time (support both field names)
    login_time_str = clock_data.login_time or clock_data.time
    if login_time_str:
        now = parse_time_string(login_time_str, today)
    else:
        now = datetime.now(timezone.utc)
    
    # Determine work location/mode (support both field names)
    work_mode = clock_data.work_mode or clock_data.work_location or "office"
    
    # Check if early login needs approval
    standard_login = parse_time_string(settings["standard_login_time"], today)
    early_threshold = timedelta(minutes=settings["early_login_threshold_minutes"])
    
    approval_status = "auto"
    if now < (standard_login - early_threshold):
        approval_status = "pending_early_login"
    
    attendance_id = f"att_{uuid.uuid4().hex[:12]}"
    attendance_doc = {
        "attendance_id": attendance_id,
        "user_id": user.user_id,
        "user_name": user.name,
        "date": today,
        "clock_in": now,
        "clock_out": None,
        "lunch_start": None,
        "lunch_end": None,
        "lunch_duration": 0.0,
        "work_location": work_mode,
        "work_mode": work_mode,
        "total_hours": 0.0,
        "extra_hours": 0.0,
        "permission_hours": 0.0,
        "status": "present",
        "approval_status": approval_status,
        "approval_notes": "",
        "approved_by": None,
        "notes": "",
        "created_at": datetime.now(timezone.utc)
    }
    
    if existing:
        await db.attendance.update_one(
            {"attendance_id": existing["attendance_id"]},
            {"$set": attendance_doc}
        )
        attendance_id = existing["attendance_id"]
    else:
        await db.attendance.insert_one(attendance_doc)
    
    # Send notification if early login needs approval
    if approval_status == "pending_early_login":
        hr_emails = await get_hr_admin_emails(db)
        asyncio.create_task(notify_attendance_approval_needed(
            employee_name=user.name,
            date=today.strftime("%Y-%m-%d"),
            approval_type="early_login",
            hr_admin_emails=hr_emails,
            attendance_id=attendance_id
        ))
    
    result = await db.attendance.find_one({"attendance_id": attendance_id}, {"_id": 0})
    result["needs_approval"] = approval_status != "auto"
    return result

@hr_router.post("/attendance/lunch-start")
@hr_router.post("/attendance/lunch-out")
async def lunch_start(lunch_data: LunchStartRequest, request: Request):
    """Record lunch start time"""
    from server import get_current_user
    user = await get_current_user(request)
    
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    
    existing = await db.attendance.find_one({
        "user_id": user.user_id,
        "date": {"$gte": today, "$lt": today + timedelta(days=1)}
    })
    
    if not existing:
        raise HTTPException(status_code=400, detail="Please clock in first")
    
    if existing.get("lunch_start"):
        raise HTTPException(status_code=400, detail="Lunch already started")
    
    # Support both field names
    lunch_time_str = lunch_data.lunch_start_time or lunch_data.time
    if lunch_time_str:
        lunch_time = parse_time_string(lunch_time_str, today)
    else:
        lunch_time = datetime.now(timezone.utc)
    
    await db.attendance.update_one(
        {"attendance_id": existing["attendance_id"]},
        {"$set": {"lunch_start": lunch_time, "lunch_out": lunch_time}}
    )
    
    return await db.attendance.find_one({"attendance_id": existing["attendance_id"]}, {"_id": 0})

@hr_router.post("/attendance/lunch-end")
@hr_router.put("/attendance/lunch-in")
async def lunch_end(lunch_data: LunchEndRequest, request: Request):
    """Record lunch end time"""
    from server import get_current_user
    user = await get_current_user(request)
    
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    
    existing = await db.attendance.find_one({
        "user_id": user.user_id,
        "date": {"$gte": today, "$lt": today + timedelta(days=1)}
    })
    
    if not existing:
        raise HTTPException(status_code=400, detail="Please clock in first")
    
    if not existing.get("lunch_start"):
        raise HTTPException(status_code=400, detail="Lunch not started yet")
    
    if existing.get("lunch_end"):
        raise HTTPException(status_code=400, detail="Lunch already ended")
    
    # Support both field names
    lunch_end_str = lunch_data.lunch_end_time or lunch_data.time
    if lunch_end_str:
        end_time = parse_time_string(lunch_data.lunch_end_time, today)
    else:
        end_time = datetime.now(timezone.utc)
    
    lunch_start = existing.get("lunch_start")
    if isinstance(lunch_start, str):
        lunch_start = datetime.fromisoformat(lunch_start.replace('Z', '+00:00'))
    if lunch_start.tzinfo is None:
        lunch_start = lunch_start.replace(tzinfo=timezone.utc)
    
    lunch_duration = (end_time - lunch_start).total_seconds() / 60  # minutes
    
    await db.attendance.update_one(
        {"attendance_id": existing["attendance_id"]},
        {"$set": {
            "lunch_end": end_time,
            "lunch_in": end_time,
            "lunch_duration": round(lunch_duration, 0)
        }}
    )
    
    return await db.attendance.find_one({"attendance_id": existing["attendance_id"]}, {"_id": 0})

@hr_router.post("/attendance/clock-out")
@hr_router.put("/attendance/clock-out")
async def clock_out(clock_data: ClockOutRequest, request: Request):
    """Clock out for the day"""
    from server import get_current_user
    user = await get_current_user(request)
    
    settings = await get_hr_settings()
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    
    existing = await db.attendance.find_one({
        "user_id": user.user_id,
        "date": {"$gte": today, "$lt": today + timedelta(days=1)}
    })
    
    if not existing:
        raise HTTPException(status_code=400, detail="No clock-in record found for today")
    
    if existing.get("clock_out"):
        raise HTTPException(status_code=400, detail="Already clocked out today")
    
    # Determine logout time (support both field names)
    logout_time_str = clock_data.logout_time or clock_data.time
    if logout_time_str:
        now = parse_time_string(logout_time_str, today)
    else:
        now = datetime.now(timezone.utc)
    
    clock_in_time = existing.get("clock_in")
    if isinstance(clock_in_time, str):
        clock_in_time = datetime.fromisoformat(clock_in_time.replace('Z', '+00:00'))
    if clock_in_time.tzinfo is None:
        clock_in_time = clock_in_time.replace(tzinfo=timezone.utc)
    
    # Calculate total hours
    total_seconds = (now - clock_in_time).total_seconds()
    lunch_duration_seconds = existing.get("lunch_duration", 0) * 60
    permission_hours_seconds = existing.get("permission_hours", 0) * 3600
    
    work_seconds = total_seconds - lunch_duration_seconds - permission_hours_seconds
    total_hours = work_seconds / 3600
    
    # Calculate extra hours (over standard 9 hours)
    standard_hours = settings["standard_work_hours"]
    extra_hours = max(0, total_hours - standard_hours)
    
    # Check if early logout needs approval
    standard_logout = parse_time_string(settings["standard_logout_time"], today)
    approval_status = existing.get("approval_status", "auto")
    
    # If clocking out early (before standard hours completed)
    if total_hours < standard_hours and approval_status == "auto":
        approval_status = "pending_early_logout"
    
    await db.attendance.update_one(
        {"attendance_id": existing["attendance_id"]},
        {"$set": {
            "clock_out": now,
            "total_hours": round(total_hours, 2),
            "extra_hours": round(extra_hours, 2),
            "approval_status": approval_status,
            "notes": clock_data.notes or ""
        }}
    )
    
    # Send notification if early logout needs approval
    if approval_status == "pending_early_logout":
        hr_emails = await get_hr_admin_emails(db)
        asyncio.create_task(notify_attendance_approval_needed(
            employee_name=user.name,
            date=today.strftime("%Y-%m-%d"),
            approval_type="early_logout",
            hr_admin_emails=hr_emails,
            attendance_id=existing["attendance_id"]
        ))
    
    result = await db.attendance.find_one({"attendance_id": existing["attendance_id"]}, {"_id": 0})
    result["needs_approval"] = "pending" in approval_status
    return result

@hr_router.get("/attendance/today")
async def get_today_attendance(request: Request):
    """Get today's attendance status"""
    from server import get_current_user
    user = await get_current_user(request)
    
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    settings = await get_hr_settings()
    
    attendance = await db.attendance.find_one({
        "user_id": user.user_id,
        "date": {"$gte": today, "$lt": today + timedelta(days=1)}
    }, {"_id": 0})
    
    return {
        "attendance": attendance,
        "settings": {
            "standard_login_time": settings["standard_login_time"],
            "standard_logout_time": settings["standard_logout_time"],
            "standard_work_hours": settings["standard_work_hours"],
            "default_lunch_duration": settings["default_lunch_duration"]
        }
    }

@hr_router.get("/attendance/history")
async def get_attendance_history(
    request: Request,
    month: Optional[int] = None,
    year: Optional[int] = None
):
    """Get attendance history with full details"""
    from server import get_current_user
    user = await get_current_user(request)
    
    now = datetime.now(timezone.utc)
    target_month = month or now.month
    target_year = year or now.year
    
    start_date = datetime(target_year, target_month, 1, tzinfo=timezone.utc)
    if target_month == 12:
        end_date = datetime(target_year + 1, 1, 1, tzinfo=timezone.utc)
    else:
        end_date = datetime(target_year, target_month + 1, 1, tzinfo=timezone.utc)
    
    records = await db.attendance.find({
        "user_id": user.user_id,
        "date": {"$gte": start_date, "$lt": end_date}
    }, {"_id": 0}).sort("date", -1).to_list(100)
    
    # Get calendar for the month
    calendar = await db.hr_calendar.find_one({
        "month": target_month,
        "year": target_year
    }, {"_id": 0})
    
    # Get leave records for the month
    leaves = await db.leave_requests.find({
        "user_id": user.user_id,
        "status": "approved",
        "start_date": {"$lte": end_date},
        "end_date": {"$gte": start_date}
    }, {"_id": 0}).to_list(50)
    
    # Get permissions for the month
    permissions = await db.permissions.find({
        "user_id": user.user_id,
        "status": "approved",
        "date": {"$gte": start_date, "$lt": end_date}
    }, {"_id": 0}).to_list(50)
    
    # Calculate summary
    total_working_days = calendar.get("working_days", 22) if calendar else 22
    holidays = calendar.get("holidays", []) if calendar else []
    
    present_days = len([r for r in records if r.get("status") == "present" and r.get("approval_status") in ["auto", "approved"]])
    absent_days = total_working_days - present_days - len([l for l in leaves if l.get("leave_type") in ["casual", "sick", "earned"]])
    
    total_hours = sum(r.get("total_hours", 0) for r in records)
    extra_hours = sum(r.get("extra_hours", 0) for r in records)
    
    # Count leaves by type
    casual_used = len([l for l in leaves if l.get("leave_type") == "casual"])
    sick_used = len([l for l in leaves if l.get("leave_type") == "sick"])
    
    # Get leave balance
    balance = await db.leave_balance.find_one({
        "user_id": user.user_id,
        "year": target_year
    }, {"_id": 0})
    
    return {
        "records": records,
        "leaves": leaves,
        "permissions": permissions,
        "calendar": {
            "holidays": holidays,
            "working_days": total_working_days
        },
        "summary": {
            "total_working_days": total_working_days,
            "present": present_days,
            "absent": max(0, absent_days),
            "casual_leave": casual_used,
            "sick_leave": sick_used,
            "total_hours": round(total_hours, 2),
            "extra_hours": round(extra_hours, 2),
            "average_hours": round(total_hours / present_days, 2) if present_days > 0 else 0
        },
        "leave_balance": balance or {
            "casual_leave": 12,
            "sick_leave": 6,
            "casual_used": casual_used,
            "sick_used": sick_used
        }
    }

@hr_router.get("/attendance/report")
async def get_attendance_report(request: Request, user_id: Optional[str] = None):
    """Get comprehensive attendance report (Admin)"""
    from server import get_current_user
    current_user = await get_current_user(request)
    
    target_user_id = user_id or current_user.user_id
    
    # Non-admins can only see their own report
    if current_user.role not in ["admin", "super_admin", "project_manager", "hr_manager"]:
        target_user_id = current_user.user_id
    
    # Get last 6 months of attendance
    now = datetime.now(timezone.utc)
    six_months_ago = now - timedelta(days=180)
    
    records = await db.attendance.find({
        "user_id": target_user_id,
        "date": {"$gte": six_months_ago}
    }, {"_id": 0}).sort("date", -1).to_list(500)
    
    # Calculate monthly summary
    monthly_summary = {}
    for record in records:
        date = record.get("date")
        if isinstance(date, str):
            date = datetime.fromisoformat(date.replace('Z', '+00:00'))
        month_key = f"{date.year}-{date.month:02d}"
        
        if month_key not in monthly_summary:
            monthly_summary[month_key] = {
                "days_present": 0,
                "total_hours": 0,
                "extra_hours": 0,
                "wfh_days": 0,
                "wfo_days": 0,
                "pending_approvals": 0
            }
        
        monthly_summary[month_key]["days_present"] += 1
        monthly_summary[month_key]["total_hours"] += record.get("total_hours", 0)
        monthly_summary[month_key]["extra_hours"] += record.get("extra_hours", 0)
        if record.get("work_location") == "home":
            monthly_summary[month_key]["wfh_days"] += 1
        else:
            monthly_summary[month_key]["wfo_days"] += 1
        if "pending" in record.get("approval_status", ""):
            monthly_summary[month_key]["pending_approvals"] += 1
    
    return {
        "records": records,
        "monthly_summary": monthly_summary
    }

# ============== PERMISSION REQUEST ROUTES ==============

@hr_router.post("/permission/request")
async def create_permission_request(perm_data: PermissionRequestCreate, request: Request):
    """Request permission (time off during work)"""
    from server import get_current_user
    user = await get_current_user(request)
    
    permission_id = f"perm_{uuid.uuid4().hex[:12]}"
    
    perm_doc = {
        "permission_id": permission_id,
        "user_id": user.user_id,
        "user_name": user.name,
        "date": perm_data.date,
        "hours_requested": perm_data.hours_requested,
        "reason": perm_data.reason,
        "status": "pending",
        "approved_by": None,
        "approved_at": None,
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.permissions.insert_one(perm_doc)
    
    # Send notification to HR Admin
    hr_emails = await get_hr_admin_emails(db)
    perm_date = perm_data.date
    if isinstance(perm_date, datetime):
        perm_date = perm_date.strftime("%Y-%m-%d")
    asyncio.create_task(notify_permission_request(
        requester_name=user.name,
        date=str(perm_date),
        hours=perm_data.hours_requested,
        reason=perm_data.reason,
        hr_admin_emails=hr_emails,
        permission_id=permission_id
    ))
    
    return {"message": "Permission request submitted", "permission_id": permission_id}

@hr_router.get("/permission/requests")
async def get_permission_requests(request: Request, status: Optional[str] = None):
    """Get my permission requests"""
    from server import get_current_user
    user = await get_current_user(request)
    
    query = {"user_id": user.user_id}
    if status:
        query["status"] = status
    
    requests = await db.permissions.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return requests

# ============== HR ADMIN ROUTES ==============

@hr_router.get("/admin/attendance/pending-approvals")
async def get_pending_approvals(request: Request):
    """Get all pending attendance approvals (HR Admin)"""
    from server import get_current_user
    user = await get_current_user(request)
    
    if user.role not in ["admin", "super_admin", "hr_manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Get pending attendance approvals
    attendance_pending = await db.attendance.find({
        "approval_status": {"$in": ["pending_early_login", "pending_early_logout"]}
    }, {"_id": 0}).sort("date", -1).to_list(100)
    
    # Get pending permission requests
    permission_pending = await db.permissions.find({
        "status": "pending"
    }, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    # Get pending leave requests
    leave_pending = await db.leave_requests.find({
        "status": "pending"
    }, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    return {
        "attendance": attendance_pending,
        "permissions": permission_pending,
        "leaves": leave_pending
    }

@hr_router.post("/admin/attendance/approve/{attendance_id}")
async def approve_attendance(attendance_id: str, request: Request, action: str = "approve", notes: str = ""):
    """Approve or reject attendance (HR Admin)"""
    from server import get_current_user
    user = await get_current_user(request)
    
    if user.role not in ["admin", "super_admin", "hr_manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    attendance = await db.attendance.find_one({"attendance_id": attendance_id})
    if not attendance:
        raise HTTPException(status_code=404, detail="Attendance record not found")
    
    new_status = "approved" if action == "approve" else "rejected"
    
    await db.attendance.update_one(
        {"attendance_id": attendance_id},
        {"$set": {
            "approval_status": new_status,
            "approval_notes": notes,
            "approved_by": user.user_id
        }}
    )
    
    return {"message": f"Attendance {new_status}", "attendance_id": attendance_id}

@hr_router.post("/admin/permission/approve/{permission_id}")
async def approve_permission(permission_id: str, request: Request, action: str = "approve"):
    """Approve or reject permission request (HR Admin)"""
    from server import get_current_user
    user = await get_current_user(request)
    
    if user.role not in ["admin", "super_admin", "hr_manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    permission = await db.permissions.find_one({"permission_id": permission_id})
    if not permission:
        raise HTTPException(status_code=404, detail="Permission request not found")
    
    new_status = "approved" if action == "approve" else "rejected"
    
    await db.permissions.update_one(
        {"permission_id": permission_id},
        {"$set": {
            "status": new_status,
            "approved_by": user.user_id,
            "approved_at": datetime.now(timezone.utc)
        }}
    )
    
    # If approved, update the attendance record
    if new_status == "approved":
        perm_date = permission.get("date")
        if isinstance(perm_date, str):
            perm_date = datetime.fromisoformat(perm_date.replace('Z', '+00:00'))
        day_start = perm_date.replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)
        
        await db.attendance.update_one(
            {
                "user_id": permission.get("user_id"),
                "date": {"$gte": day_start, "$lt": day_end}
            },
            {"$inc": {"permission_hours": permission.get("hours_requested", 0)}}
        )
    
    # Notify employee about the decision
    employee_email = await get_user_email_by_id(db, permission.get("user_id"))
    if employee_email:
        perm_date = permission.get("date")
        if isinstance(perm_date, datetime):
            perm_date = perm_date.strftime("%Y-%m-%d")
        asyncio.create_task(notify_permission_decision(
            employee_email=employee_email,
            employee_name=permission.get("user_name", "Employee"),
            date=str(perm_date),
            hours=permission.get("hours_requested", 0),
            status=new_status,
            approved_by=user.name
        ))
    
    return {"message": f"Permission {new_status}", "permission_id": permission_id}

@hr_router.get("/admin/attendance/all")
async def get_all_attendance(
    request: Request,
    date: Optional[str] = None,
    month: Optional[int] = None,
    year: Optional[int] = None
):
    """Get all employees' attendance for a day or month (HR Admin)"""
    from server import get_current_user
    user = await get_current_user(request)
    
    if user.role not in ["admin", "super_admin", "hr_manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    now = datetime.now(timezone.utc)
    
    if date:
        # Specific date
        try:
            target_date = datetime.fromisoformat(date).replace(tzinfo=timezone.utc)
        except:
            target_date = now
        start = target_date.replace(hour=0, minute=0, second=0, microsecond=0)
        end = start + timedelta(days=1)
    else:
        # Month view
        target_month = month or now.month
        target_year = year or now.year
        start = datetime(target_year, target_month, 1, tzinfo=timezone.utc)
        if target_month == 12:
            end = datetime(target_year + 1, 1, 1, tzinfo=timezone.utc)
        else:
            end = datetime(target_year, target_month + 1, 1, tzinfo=timezone.utc)
    
    records = await db.attendance.find({
        "date": {"$gte": start, "$lt": end}
    }, {"_id": 0}).sort("date", -1).to_list(1000)
    
    # Get all users for reference
    users = await db.users.find({}, {"_id": 0, "user_id": 1, "name": 1, "email": 1, "department": 1}).to_list(500)
    user_map = {u["user_id"]: u for u in users}
    
    # Enrich records with user info
    for record in records:
        user_info = user_map.get(record.get("user_id"), {})
        record["employee_name"] = user_info.get("name", record.get("user_name", "Unknown"))
        record["department"] = user_info.get("department", "")
    
    return {
        "records": records,
        "total_employees": len(users),
        "present_today": len([r for r in records if r.get("status") == "present"]) if date else None
    }

# ============== HR SETTINGS ROUTES ==============

@hr_router.get("/admin/settings")
async def get_settings(request: Request):
    """Get HR settings"""
    from server import get_current_user
    user = await get_current_user(request)
    
    if user.role not in ["admin", "super_admin", "hr_manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    return await get_hr_settings()

@hr_router.put("/admin/settings")
async def update_settings(request: Request, settings_data: dict):
    """Update HR settings"""
    from server import get_current_user
    user = await get_current_user(request)
    
    if user.role not in ["admin", "super_admin", "hr_manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    current = await get_hr_settings()
    
    allowed_fields = [
        "standard_work_hours", "standard_login_time", "standard_logout_time",
        "early_login_threshold_minutes", "grace_period_minutes",
        "default_lunch_duration", "overtime_rate_multiplier"
    ]
    
    update_data = {k: v for k, v in settings_data.items() if k in allowed_fields}
    update_data["updated_by"] = user.user_id
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    await db.hr_settings.update_one(
        {"settings_id": current["settings_id"]},
        {"$set": update_data}
    )
    
    return await get_hr_settings()

# ============== CALENDAR ROUTES ==============

@hr_router.get("/admin/calendar/{year}/{month}")
async def get_calendar(year: int, month: int, request: Request):
    """Get monthly calendar with holidays"""
    from server import get_current_user
    user = await get_current_user(request)
    
    calendar = await db.hr_calendar.find_one({
        "month": month,
        "year": year
    }, {"_id": 0})
    
    if not calendar:
        # Create default calendar
        import calendar as cal
        _, days_in_month = cal.monthrange(year, month)
        
        # Count weekdays (Mon-Fri)
        working_days = 0
        for day in range(1, days_in_month + 1):
            weekday = cal.weekday(year, month, day)
            if weekday < 5:  # Mon-Fri
                working_days += 1
        
        calendar = {
            "calendar_id": f"cal_{year}_{month:02d}",
            "month": month,
            "year": year,
            "holidays": [],
            "working_days": working_days,
            "special_working_days": [],
            "created_by": user.user_id,
            "created_at": datetime.now(timezone.utc)
        }
        await db.hr_calendar.insert_one(calendar)
        # Re-fetch without _id
        calendar = await db.hr_calendar.find_one({
            "month": month,
            "year": year
        }, {"_id": 0})
    
    return calendar

@hr_router.put("/admin/calendar/{year}/{month}")
async def update_calendar(year: int, month: int, request: Request, calendar_data: dict):
    """Update monthly calendar (HR Admin)"""
    from server import get_current_user
    user = await get_current_user(request)
    
    if user.role not in ["admin", "super_admin", "hr_manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    calendar = await db.hr_calendar.find_one({"month": month, "year": year})
    
    if calendar:
        await db.hr_calendar.update_one(
            {"month": month, "year": year},
            {"$set": {
                "holidays": calendar_data.get("holidays", []),
                "working_days": calendar_data.get("working_days", calendar.get("working_days", 22)),
                "special_working_days": calendar_data.get("special_working_days", [])
            }}
        )
    else:
        await db.hr_calendar.insert_one({
            "calendar_id": f"cal_{year}_{month:02d}",
            "month": month,
            "year": year,
            "holidays": calendar_data.get("holidays", []),
            "working_days": calendar_data.get("working_days", 22),
            "special_working_days": calendar_data.get("special_working_days", []),
            "created_by": user.user_id,
            "created_at": datetime.now(timezone.utc)
        })
    
    return await db.hr_calendar.find_one({"month": month, "year": year}, {"_id": 0})

# ============== SALARY DETAILS ROUTES ==============

@hr_router.get("/admin/salary/{user_id}")
async def get_salary_details(user_id: str, request: Request):
    """Get employee salary details (HR Admin)"""
    from server import get_current_user
    user = await get_current_user(request)
    
    if user.role not in ["admin", "super_admin", "hr_manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    salary = await db.salary_details.find_one(
        {"user_id": user_id},
        {"_id": 0}
    )
    
    return salary or {"message": "No salary details found"}

@hr_router.post("/admin/salary/{user_id}")
async def set_salary_details(user_id: str, request: Request, salary_data: dict):
    """Set or update employee salary details (HR Admin)"""
    from server import get_current_user
    user = await get_current_user(request)
    
    if user.role not in ["admin", "super_admin", "hr_manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    existing = await db.salary_details.find_one({"user_id": user_id})
    
    salary_doc = {
        "user_id": user_id,
        "basic_salary": salary_data.get("basic_salary", 0),
        "hra": salary_data.get("hra", 0),
        "conveyance": salary_data.get("conveyance", 0),
        "medical": salary_data.get("medical", 0),
        "special_allowance": salary_data.get("special_allowance", 0),
        "pf_percentage": salary_data.get("pf_percentage", 12.0),
        "esi_percentage": salary_data.get("esi_percentage", 0),
        "professional_tax": salary_data.get("professional_tax", 0),
        "effective_from": datetime.now(timezone.utc),
        "created_by": user.user_id,
        "updated_at": datetime.now(timezone.utc)
    }
    
    if existing:
        await db.salary_details.update_one(
            {"user_id": user_id},
            {"$set": salary_doc}
        )
    else:
        salary_doc["salary_id"] = f"sal_{uuid.uuid4().hex[:12]}"
        salary_doc["created_at"] = datetime.now(timezone.utc)
        await db.salary_details.insert_one(salary_doc)
    
    return await db.salary_details.find_one({"user_id": user_id}, {"_id": 0})

# ============== PAYSLIP ROUTES ==============

@hr_router.post("/admin/payslip/generate")
async def generate_payslip(request: Request, payslip_data: dict):
    """Generate payslip for an employee (HR Admin)"""
    from server import get_current_user
    user = await get_current_user(request)
    
    if user.role not in ["admin", "super_admin", "hr_manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    user_id = payslip_data.get("user_id")
    month = payslip_data.get("month")
    year = payslip_data.get("year")
    
    # Check if payslip already exists
    existing = await db.payslips.find_one({
        "user_id": user_id,
        "month": month,
        "year": year
    })
    if existing:
        raise HTTPException(status_code=400, detail="Payslip already exists for this month")
    
    # Get employee details
    employee = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    # Get profile for additional details
    profile = await db.employee_profiles.find_one({"user_id": user_id}, {"_id": 0})
    
    # Get salary details
    salary = await db.salary_details.find_one({"user_id": user_id}, {"_id": 0})
    if not salary:
        raise HTTPException(status_code=400, detail="Salary details not found for employee")
    
    # Get attendance for the month
    start_date = datetime(year, month, 1, tzinfo=timezone.utc)
    if month == 12:
        end_date = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
    else:
        end_date = datetime(year, month + 1, 1, tzinfo=timezone.utc)
    
    attendance_records = await db.attendance.find({
        "user_id": user_id,
        "date": {"$gte": start_date, "$lt": end_date},
        "approval_status": {"$in": ["auto", "approved"]}
    }, {"_id": 0}).to_list(50)
    
    # Get calendar for working days
    calendar = await db.hr_calendar.find_one({
        "month": month,
        "year": year
    }, {"_id": 0})
    
    total_working_days = calendar.get("working_days", 22) if calendar else 22
    days_present = len(attendance_records)
    
    # Get approved leaves for the month
    leaves = await db.leave_requests.find({
        "user_id": user_id,
        "status": "approved",
        "start_date": {"$lte": end_date},
        "end_date": {"$gte": start_date}
    }, {"_id": 0}).to_list(20)
    
    paid_leaves = len([l for l in leaves if l.get("leave_type") in ["casual", "sick", "earned"]])
    days_absent = max(0, total_working_days - days_present - paid_leaves)
    
    # Calculate extra hours/days
    total_extra_hours = sum(r.get("extra_hours", 0) for r in attendance_records)
    extra_days = int(total_extra_hours / 9)  # 9 hours = 1 extra day
    
    # Calculate salary
    basic = salary.get("basic_salary", 0)
    hra = salary.get("hra", 0)
    conveyance = salary.get("conveyance", 0)
    medical = salary.get("medical", 0)
    special = salary.get("special_allowance", 0)
    
    gross = basic + hra + conveyance + medical + special
    per_day = gross / total_working_days if total_working_days > 0 else 0
    
    # Calculate deductions
    pf = (basic * salary.get("pf_percentage", 12) / 100)
    esi = (gross * salary.get("esi_percentage", 0) / 100)
    pt = salary.get("professional_tax", 0)
    
    # Apply adjustments
    adjustments = payslip_data.get("adjustments", {})
    bonus = adjustments.get("bonus", 0)
    other_deductions = adjustments.get("deductions", 0)
    
    # Calculate net based on attendance
    effective_days = days_present + paid_leaves + extra_days
    actual_gross = per_day * min(effective_days, total_working_days)
    total_deductions = pf + esi + pt + other_deductions
    net_salary = actual_gross + bonus - total_deductions
    
    # Create payslip
    payslip_id = f"pay_{uuid.uuid4().hex[:12]}"
    payslip_doc = {
        "payslip_id": payslip_id,
        "user_id": user_id,
        "employee_name": employee.get("name", ""),
        "employee_id": profile.get("employee_id", "") if profile else "",
        "designation": profile.get("designation", employee.get("role", "")) if profile else employee.get("role", ""),
        "department": profile.get("department", "") if profile else "",
        "joining_date": profile.get("joining_date") if profile else None,
        "month": month,
        "year": year,
        # Salary components
        "basic_salary": basic,
        "hra": hra,
        "conveyance": conveyance,
        "medical": medical,
        "special_allowance": special,
        "gross_salary": gross,
        # Deductions
        "pf_deduction": round(pf, 2),
        "esi_deduction": round(esi, 2),
        "professional_tax": pt,
        "other_deductions": other_deductions,
        "bonus": bonus,
        # Attendance
        "total_working_days": total_working_days,
        "days_present": days_present,
        "days_absent": days_absent,
        "paid_leaves": paid_leaves,
        "extra_days": extra_days,
        "per_day_salary": round(per_day, 2),
        # Net
        "net_salary": round(net_salary, 2),
        # Workflow
        "status": "draft",
        "created_by": user.user_id,
        "created_at": datetime.now(timezone.utc),
        "comments": payslip_data.get("comments", "")
    }
    
    await db.payslips.insert_one(payslip_doc)
    
    return await db.payslips.find_one({"payslip_id": payslip_id}, {"_id": 0})

@hr_router.get("/admin/payslips")
async def get_all_payslips(
    request: Request,
    month: Optional[int] = None,
    year: Optional[int] = None,
    status: Optional[str] = None
):
    """Get all payslips (HR Admin)"""
    from server import get_current_user
    user = await get_current_user(request)
    
    if user.role not in ["admin", "super_admin", "hr_manager", "finance"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    query = {}
    if month:
        query["month"] = month
    if year:
        query["year"] = year
    if status:
        query["status"] = status
    
    payslips = await db.payslips.find(query, {"_id": 0}).sort([("year", -1), ("month", -1)]).to_list(500)
    return payslips

@hr_router.put("/admin/payslip/{payslip_id}/submit")
async def submit_payslip_for_approval(payslip_id: str, request: Request):
    """Submit payslip for Super Admin approval"""
    from server import get_current_user
    user = await get_current_user(request)
    
    if user.role not in ["admin", "super_admin", "hr_manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    payslip = await db.payslips.find_one({"payslip_id": payslip_id})
    if not payslip:
        raise HTTPException(status_code=404, detail="Payslip not found")
    
    await db.payslips.update_one(
        {"payslip_id": payslip_id},
        {"$set": {
            "status": "pending_super_admin",
            "submitted_by": user.user_id,
            "submitted_at": datetime.now(timezone.utc)
        }}
    )
    
    return {"message": "Payslip submitted for approval"}

@hr_router.put("/admin/payslip/{payslip_id}/approve")
async def approve_payslip(payslip_id: str, request: Request, action: str = "approve"):
    """Approve payslip (Super Admin)"""
    from server import get_current_user
    user = await get_current_user(request)
    
    if user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Only Super Admin can approve payslips")
    
    payslip = await db.payslips.find_one({"payslip_id": payslip_id})
    if not payslip:
        raise HTTPException(status_code=404, detail="Payslip not found")
    
    if action == "approve":
        await db.payslips.update_one(
            {"payslip_id": payslip_id},
            {"$set": {
                "status": "approved",
                "super_admin_approved_by": user.user_id,
                "super_admin_approved_at": datetime.now(timezone.utc)
            }}
        )
        return {"message": "Payslip approved"}
    else:
        await db.payslips.update_one(
            {"payslip_id": payslip_id},
            {"$set": {"status": "rejected"}}
        )
        return {"message": "Payslip rejected"}

@hr_router.put("/payslip/{payslip_id}/acknowledge")
async def acknowledge_payslip(payslip_id: str, request: Request):
    """Employee acknowledges payslip"""
    from server import get_current_user
    user = await get_current_user(request)
    
    payslip = await db.payslips.find_one({"payslip_id": payslip_id, "user_id": user.user_id})
    if not payslip:
        raise HTTPException(status_code=404, detail="Payslip not found")
    
    if payslip.get("status") != "approved":
        raise HTTPException(status_code=400, detail="Payslip must be approved first")
    
    await db.payslips.update_one(
        {"payslip_id": payslip_id},
        {"$set": {
            "status": "acknowledged",
            "employee_acknowledged_at": datetime.now(timezone.utc)
        }}
    )
    
    return {"message": "Payslip acknowledged"}

@hr_router.put("/admin/payslip/{payslip_id}/send-to-finance")
async def send_to_finance(payslip_id: str, request: Request):
    """Send acknowledged payslip to finance"""
    from server import get_current_user
    user = await get_current_user(request)
    
    if user.role not in ["admin", "super_admin", "hr_manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    payslip = await db.payslips.find_one({"payslip_id": payslip_id})
    if not payslip:
        raise HTTPException(status_code=404, detail="Payslip not found")
    
    if payslip.get("status") != "acknowledged":
        raise HTTPException(status_code=400, detail="Employee must acknowledge first")
    
    await db.payslips.update_one(
        {"payslip_id": payslip_id},
        {"$set": {
            "status": "pending_finance",
            "sent_to_finance_by": user.user_id,
            "sent_to_finance_at": datetime.now(timezone.utc)
        }}
    )
    
    return {"message": "Payslip sent to finance"}

@hr_router.put("/finance/payslip/{payslip_id}/release")
async def release_payment(payslip_id: str, request: Request):
    """Finance releases payment"""
    from server import get_current_user
    user = await get_current_user(request)
    
    if user.role not in ["admin", "super_admin", "finance"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    payslip = await db.payslips.find_one({"payslip_id": payslip_id})
    if not payslip:
        raise HTTPException(status_code=404, detail="Payslip not found")
    
    await db.payslips.update_one(
        {"payslip_id": payslip_id},
        {"$set": {
            "status": "payment_released",
            "finance_released_by": user.user_id,
            "finance_released_at": datetime.now(timezone.utc)
        }}
    )
    
    # Send email to employee
    employee = await db.users.find_one({"user_id": payslip.get("user_id")}, {"_id": 0})
    if employee:
        month_names = ["", "January", "February", "March", "April", "May", "June", 
                      "July", "August", "September", "October", "November", "December"]
        month_name = month_names[payslip.get("month", 1)]
        
        email_html = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #10b981;">Salary Credited - {month_name} {payslip.get('year')}</h2>
            <p>Dear {employee.get('name', 'Employee')},</p>
            <p>Your salary for {month_name} {payslip.get('year')} has been credited.</p>
            <p><strong>Net Amount:</strong> ₹{payslip.get('net_salary', 0):,.2f}</p>
            <p>Please login to Drawlead OS to view and download your payslip.</p>
            <br>
            <p>Best regards,<br>HR Team<br>Drawlead</p>
        </div>
        """
        
        await send_email_notification(
            employee.get("email", ""),
            f"Salary Credited - {month_name} {payslip.get('year')}",
            email_html
        )
    
    return {"message": "Payment released and employee notified"}

@hr_router.get("/payslips/my")
async def get_my_payslips(request: Request):
    """Get my payslips"""
    from server import get_current_user
    user = await get_current_user(request)
    
    payslips = await db.payslips.find(
        {"user_id": user.user_id, "status": {"$in": ["approved", "acknowledged", "pending_finance", "payment_released"]}},
        {"_id": 0}
    ).sort([("year", -1), ("month", -1)]).to_list(50)
    
    return payslips

@hr_router.get("/payslip/{payslip_id}")
async def get_payslip(payslip_id: str, request: Request):
    """Get single payslip"""
    from server import get_current_user
    user = await get_current_user(request)
    
    # HR Admin can see all, employees can see their own
    if user.role in ["admin", "super_admin", "hr_manager", "finance"]:
        payslip = await db.payslips.find_one({"payslip_id": payslip_id}, {"_id": 0})
    else:
        payslip = await db.payslips.find_one(
            {"payslip_id": payslip_id, "user_id": user.user_id},
            {"_id": 0}
        )
    
    if not payslip:
        raise HTTPException(status_code=404, detail="Payslip not found")
    
    return payslip

# ============== LEAVE MANAGEMENT ROUTES ==============

@hr_router.post("/leave/request")
async def create_leave_request(leave_data: LeaveRequestCreate, request: Request):
    """Create a leave request"""
    from server import get_current_user
    user = await get_current_user(request)
    
    leave_id = f"leave_{uuid.uuid4().hex[:12]}"
    
    # Get user email
    user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0, "email": 1})
    user_email = user_doc.get("email", "") if user_doc else ""
    
    leave_doc = {
        "leave_id": leave_id,
        "user_id": user.user_id,
        "user_name": user.name,
        "user_email": user_email,
        "leave_type": leave_data.leave_type,
        "start_date": leave_data.start_date,
        "end_date": leave_data.end_date,
        "reason": leave_data.reason,
        "status": "pending",
        "approved_by": None,
        "approved_at": None,
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.leave_requests.insert_one(leave_doc)
    
    # Format dates
    start_str = leave_data.start_date.strftime("%d %b %Y") if hasattr(leave_data.start_date, 'strftime') else str(leave_data.start_date)[:10]
    end_str = leave_data.end_date.strftime("%d %b %Y") if hasattr(leave_data.end_date, 'strftime') else str(leave_data.end_date)[:10]
    
    # Send notification to HR Admins using the new notification service
    hr_emails = await get_hr_admin_emails(db)
    asyncio.create_task(notify_leave_request(
        requester_name=user.name,
        requester_email=user_email,
        leave_type=leave_data.leave_type,
        start_date=start_str,
        end_date=end_str,
        reason=leave_data.reason,
        hr_admin_emails=hr_emails,
        leave_id=leave_id
    ))
    
    return await db.leave_requests.find_one({"leave_id": leave_id}, {"_id": 0})

@hr_router.get("/leave/my-requests")
async def get_my_leave_requests(request: Request):
    """Get current user's leave requests"""
    from server import get_current_user
    user = await get_current_user(request)
    
    requests = await db.leave_requests.find(
        {"user_id": user.user_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return requests

@hr_router.get("/leave/pending")
async def get_pending_leave_requests(request: Request):
    """Get pending leave requests (Admin/Manager)"""
    from server import get_current_user
    user = await get_current_user(request)
    
    if user.role not in ["admin", "super_admin", "project_manager"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    requests = await db.leave_requests.find(
        {"status": "pending"},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return requests

@hr_router.put("/leave/{leave_id}/approve")
async def approve_leave_request(leave_id: str, request: Request):
    """Approve a leave request"""
    from server import get_current_user
    user = await get_current_user(request)
    
    if user.role not in ["admin", "super_admin", "project_manager", "hr_manager"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    leave = await db.leave_requests.find_one({"leave_id": leave_id})
    if not leave:
        raise HTTPException(status_code=404, detail="Leave request not found")
    
    await db.leave_requests.update_one(
        {"leave_id": leave_id},
        {"$set": {
            "status": "approved",
            "approved_by": user.user_id,
            "approved_by_name": user.name,
            "approved_at": datetime.now(timezone.utc)
        }}
    )
    
    # Update leave balance
    start = leave["start_date"]
    end = leave["end_date"]
    if isinstance(start, str):
        start = datetime.fromisoformat(start.replace('Z', '+00:00'))
    if isinstance(end, str):
        end = datetime.fromisoformat(end.replace('Z', '+00:00'))
    days = (end - start).days + 1
    
    leave_type = leave["leave_type"]
    year = start.year
    
    await db.leave_balance.update_one(
        {"user_id": leave["user_id"], "year": year},
        {"$inc": {f"{leave_type}_used": days}},
        upsert=True
    )
    
    # Send approval notification to employee using new service
    start_str = start.strftime("%d %b %Y")
    end_str = end.strftime("%d %b %Y")
    employee_email = leave.get("user_email", "")
    
    if employee_email:
        asyncio.create_task(notify_leave_decision(
            employee_email=employee_email,
            employee_name=leave.get("user_name", "Employee"),
            leave_type=leave_type,
            start_date=start_str,
            end_date=end_str,
            status="approved",
            approved_by=user.name
        ))
    
    return await db.leave_requests.find_one({"leave_id": leave_id}, {"_id": 0})

@hr_router.put("/leave/{leave_id}/reject")
async def reject_leave_request(leave_id: str, request: Request, reason: str = ""):
    """Reject a leave request"""
    from server import get_current_user
    user = await get_current_user(request)
    
    if user.role not in ["admin", "super_admin", "project_manager", "hr_manager"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    leave = await db.leave_requests.find_one({"leave_id": leave_id})
    if not leave:
        raise HTTPException(status_code=404, detail="Leave request not found")
    
    await db.leave_requests.update_one(
        {"leave_id": leave_id},
        {"$set": {
            "status": "rejected",
            "rejection_reason": reason,
            "approved_by": user.user_id,
            "approved_by_name": user.name,
            "approved_at": datetime.now(timezone.utc)
        }}
    )
    
    # Send rejection notification to employee
    start = leave["start_date"]
    end = leave["end_date"]
    if isinstance(start, str):
        start = datetime.fromisoformat(start.replace('Z', '+00:00'))
    if isinstance(end, str):
        end = datetime.fromisoformat(end.replace('Z', '+00:00'))
    
    start_str = start.strftime("%d %b %Y")
    end_str = end.strftime("%d %b %Y")
    leave_type = leave.get("leave_type", "leave")
    employee_email = leave.get("user_email", "")
    
    if employee_email:
        asyncio.create_task(notify_leave_decision(
            employee_email=employee_email,
            employee_name=leave.get("user_name", "Employee"),
            leave_type=leave_type,
            start_date=start_str,
            end_date=end_str,
            status="rejected",
            approved_by=user.name
        ))
    
    return await db.leave_requests.find_one({"leave_id": leave_id}, {"_id": 0})

@hr_router.get("/leave/balance")
async def get_leave_balance(request: Request):
    """Get leave balance for current year"""
    from server import get_current_user
    user = await get_current_user(request)
    
    year = datetime.now(timezone.utc).year
    
    balance = await db.leave_balance.find_one(
        {"user_id": user.user_id, "year": year},
        {"_id": 0}
    )
    
    if not balance:
        # Create default balance
        balance = {
            "user_id": user.user_id,
            "year": year,
            "casual_leave": 12,
            "sick_leave": 6,
            "earned_leave": 15,
            "casual_used": 0,
            "sick_used": 0,
            "earned_used": 0
        }
        await db.leave_balance.insert_one(balance)
        balance = await db.leave_balance.find_one(
            {"user_id": user.user_id, "year": year},
            {"_id": 0}
        )
    
    return balance

# ============== PAYROLL ROUTES ==============

@hr_router.get("/payslips")
async def get_my_payslips(request: Request):
    """Get all payslips for current user"""
    from server import get_current_user
    user = await get_current_user(request)
    
    payslips = await db.payslips.find(
        {"user_id": user.user_id},
        {"_id": 0}
    ).sort([("year", -1), ("month", -1)]).to_list(100)
    
    return payslips

@hr_router.get("/payslips/{year}/{month}")
async def get_payslip(year: int, month: int, request: Request):
    """Get specific payslip"""
    from server import get_current_user
    user = await get_current_user(request)
    
    payslip = await db.payslips.find_one({
        "user_id": user.user_id,
        "year": year,
        "month": month
    }, {"_id": 0})
    
    if not payslip:
        raise HTTPException(status_code=404, detail="Payslip not found")
    
    return payslip

@hr_router.post("/payslips/generate")
async def generate_payslip(payslip_data: Dict[str, Any], request: Request):
    """Generate payslip (Admin only)"""
    from server import get_current_user
    user = await get_current_user(request)
    
    if user.role not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    payslip_id = f"pay_{uuid.uuid4().hex[:12]}"
    
    gross = payslip_data.get("basic_salary", 0) + payslip_data.get("hra", 0) + payslip_data.get("other_allowances", 0)
    deductions = payslip_data.get("pf_deduction", 0) + payslip_data.get("tax_deduction", 0) + payslip_data.get("other_deductions", 0)
    
    payslip_doc = {
        "payslip_id": payslip_id,
        "user_id": payslip_data["user_id"],
        "month": payslip_data["month"],
        "year": payslip_data["year"],
        "basic_salary": payslip_data.get("basic_salary", 0),
        "hra": payslip_data.get("hra", 0),
        "other_allowances": payslip_data.get("other_allowances", 0),
        "gross_salary": gross,
        "pf_deduction": payslip_data.get("pf_deduction", 0),
        "tax_deduction": payslip_data.get("tax_deduction", 0),
        "other_deductions": payslip_data.get("other_deductions", 0),
        "net_salary": gross - deductions,
        "payment_date": None,
        "payment_status": "pending",
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.payslips.insert_one(payslip_doc)
    return await db.payslips.find_one({"payslip_id": payslip_id}, {"_id": 0})

# ============== PERFORMANCE REVIEW ROUTES ==============

@hr_router.get("/reviews")
async def get_my_reviews(request: Request):
    """Get all performance reviews for current user"""
    from server import get_current_user
    user = await get_current_user(request)
    
    reviews = await db.performance_reviews.find(
        {"user_id": user.user_id},
        {"_id": 0}
    ).sort([("year", -1), ("quarter", -1)]).to_list(50)
    
    return reviews

@hr_router.get("/reviews/{review_id}")
async def get_review(review_id: str, request: Request):
    """Get specific review"""
    from server import get_current_user
    user = await get_current_user(request)
    
    review = await db.performance_reviews.find_one(
        {"review_id": review_id},
        {"_id": 0}
    )
    
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    
    # Check access
    if review["user_id"] != user.user_id and user.role not in ["admin", "super_admin", "project_manager"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return review

@hr_router.post("/reviews")
async def create_review(review_data: Dict[str, Any], request: Request):
    """Create performance review (Admin/Manager only)"""
    from server import get_current_user
    user = await get_current_user(request)
    
    if user.role not in ["admin", "super_admin", "project_manager"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    review_id = f"review_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc)
    
    review_doc = {
        "review_id": review_id,
        "user_id": review_data["user_id"],
        "reviewer_id": user.user_id,
        "reviewer_name": user.name,
        "quarter": review_data["quarter"],
        "year": review_data["year"],
        "goals": review_data.get("goals", []),
        "achievements": review_data.get("achievements", ""),
        "areas_of_improvement": review_data.get("areas_of_improvement", ""),
        "overall_rating": review_data.get("overall_rating", 0),
        "comments": review_data.get("comments", ""),
        "employee_comments": "",
        "status": "draft",
        "created_at": now,
        "updated_at": now
    }
    
    await db.performance_reviews.insert_one(review_doc)
    return await db.performance_reviews.find_one({"review_id": review_id}, {"_id": 0})

@hr_router.put("/reviews/{review_id}/acknowledge")
async def acknowledge_review(review_id: str, comments: str, request: Request):
    """Employee acknowledges review"""
    from server import get_current_user
    user = await get_current_user(request)
    
    review = await db.performance_reviews.find_one({"review_id": review_id})
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    
    if review["user_id"] != user.user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    await db.performance_reviews.update_one(
        {"review_id": review_id},
        {"$set": {
            "employee_comments": comments,
            "status": "acknowledged",
            "updated_at": datetime.now(timezone.utc)
        }}
    )
    
    return await db.performance_reviews.find_one({"review_id": review_id}, {"_id": 0})

# ============== TEAM MANAGEMENT (Admin) ==============

@hr_router.get("/team/all-employees")
async def get_all_employees(request: Request):
    """Get all employees (Admin only)"""
    from server import get_current_user
    user = await get_current_user(request)
    
    if user.role not in ["admin", "super_admin", "project_manager"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    employees = await db.users.find(
        {"is_active": True},
        {"_id": 0, "password_hash": 0}
    ).to_list(500)
    
    # Get profiles
    for emp in employees:
        profile = await db.employee_profiles.find_one(
            {"user_id": emp["user_id"]},
            {"_id": 0}
        )
        if profile:
            emp["profile"] = profile
    
    return employees

@hr_router.get("/team/attendance-overview")
async def get_team_attendance_overview(request: Request):
    """Get team attendance overview for today (Admin only)"""
    from server import get_current_user
    user = await get_current_user(request)
    
    if user.role not in ["admin", "super_admin", "project_manager"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    
    # Get all active users
    users = await db.users.find({"is_active": True}, {"_id": 0, "user_id": 1, "name": 1}).to_list(500)
    
    # Get today's attendance
    attendance_records = await db.attendance.find({
        "date": {"$gte": today, "$lt": today + timedelta(days=1)}
    }, {"_id": 0}).to_list(500)
    
    attendance_map = {a["user_id"]: a for a in attendance_records}
    
    overview = []
    for u in users:
        att = attendance_map.get(u["user_id"])
        overview.append({
            "user_id": u["user_id"],
            "name": u["name"],
            "status": att.get("status", "absent") if att else "absent",
            "clock_in": att.get("clock_in") if att else None,
            "clock_out": att.get("clock_out") if att else None,
            "work_location": att.get("work_location") if att else None
        })
    
    return overview


# ============== ADMIN HR ROUTES ==============

@hr_router.get("/admin/all-requests")
async def get_all_leave_requests(request: Request, status: Optional[str] = None):
    """Get all leave requests (Admin only)"""
    from server import get_current_user
    user = await get_current_user(request)
    
    if user.role not in ["admin", "super_admin", "project_manager"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    query = {}
    if status:
        query["status"] = status
    
    requests = await db.leave_requests.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).to_list(500)
    
    return requests

@hr_router.get("/admin/employees")
async def get_all_employee_details(request: Request):
    """Get all employees with full details (Admin only)"""
    from server import get_current_user
    user = await get_current_user(request)
    
    if user.role not in ["admin", "super_admin", "project_manager"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    employees = await db.users.find(
        {},
        {"_id": 0, "password_hash": 0}
    ).to_list(500)
    
    # Enrich with profiles and attendance
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    
    for emp in employees:
        # Get profile
        profile = await db.employee_profiles.find_one(
            {"user_id": emp["user_id"]},
            {"_id": 0}
        )
        emp["profile"] = profile or {}
        
        # Get today's attendance
        attendance = await db.attendance.find_one({
            "user_id": emp["user_id"],
            "date": {"$gte": today, "$lt": today + timedelta(days=1)}
        }, {"_id": 0})
        emp["today_attendance"] = attendance
        
        # Get pending leaves count
        pending_leaves = await db.leave_requests.count_documents({
            "user_id": emp["user_id"],
            "status": "pending"
        })
        emp["pending_leaves"] = pending_leaves
    
    return employees

@hr_router.put("/admin/employee/{user_id}/profile")
async def admin_update_employee_profile(user_id: str, profile_data: Dict[str, Any], request: Request):
    """Admin update employee profile with all fields"""
    from server import get_current_user
    current_user = await get_current_user(request)
    
    if current_user.role not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Get user info
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Update or create profile
    profile_data["user_id"] = user_id
    profile_data["updated_at"] = datetime.now(timezone.utc)
    
    # Set defaults from user if not in profile
    if "full_name" not in profile_data:
        profile_data["full_name"] = user.get("name", "")
    if "email" not in profile_data:
        profile_data["email"] = user.get("email", "")
    
    existing = await db.employee_profiles.find_one({"user_id": user_id})
    
    if existing:
        await db.employee_profiles.update_one(
            {"user_id": user_id},
            {"$set": profile_data}
        )
    else:
        profile_data["created_at"] = datetime.now(timezone.utc)
        await db.employee_profiles.insert_one(profile_data)
    
    return await db.employee_profiles.find_one({"user_id": user_id}, {"_id": 0})

@hr_router.get("/admin/dashboard-stats")
async def get_hr_dashboard_stats(request: Request):
    """Get HR dashboard statistics (Admin only)"""
    from server import get_current_user
    user = await get_current_user(request)
    
    if user.role not in ["admin", "super_admin", "project_manager"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    
    # Total employees
    total_employees = await db.users.count_documents({"is_active": True})
    
    # Today's attendance
    present_today = await db.attendance.count_documents({
        "date": {"$gte": today, "$lt": today + timedelta(days=1)},
        "clock_in": {"$ne": None}
    })
    
    # WFH today
    wfh_today = await db.attendance.count_documents({
        "date": {"$gte": today, "$lt": today + timedelta(days=1)},
        "work_location": "home"
    })
    
    # Pending leave requests
    pending_leaves = await db.leave_requests.count_documents({"status": "pending"})
    
    return {
        "total_employees": total_employees,
        "present_today": present_today,
        "absent_today": total_employees - present_today,
        "wfh_today": wfh_today,
        "wfo_today": present_today - wfh_today,
        "pending_leaves": pending_leaves
    }

# ============== CREATE EMPLOYEE ==============

class CreateEmployeeRequest(BaseModel):
    # Basic Details
    full_name: str
    email: str
    phone: Optional[str] = ""
    date_of_birth: Optional[str] = None
    gender: Optional[str] = ""
    blood_group: Optional[str] = ""
    # Account Details
    bank_name: Optional[str] = ""
    account_number: Optional[str] = ""
    ifsc_code: Optional[str] = ""
    pan_number: Optional[str] = ""
    aadhar_number: Optional[str] = ""
    # Employment Details
    employee_id: Optional[str] = ""
    designation: Optional[str] = ""
    department: Optional[str] = ""
    employment_type: Optional[str] = "full-time"
    joining_date: Optional[str] = None
    reporting_manager: Optional[str] = ""
    work_location: Optional[str] = "office"
    # Documents
    resume_link: Optional[str] = ""
    id_proof_link: Optional[str] = ""
    address_proof_link: Optional[str] = ""
    education_docs_link: Optional[str] = ""
    offer_letter_link: Optional[str] = ""
    # Role & Access
    role: Optional[str] = "employee"
    module_access: Optional[List[str]] = []
    password: str
    # Emergency Contact
    emergency_contact_name: Optional[str] = ""
    emergency_contact_phone: Optional[str] = ""
    emergency_contact_relation: Optional[str] = ""
    # Address
    address: Optional[str] = ""
    city: Optional[str] = ""
    state: Optional[str] = ""
    pincode: Optional[str] = ""

@hr_router.post("/admin/create-employee")
async def create_employee(data: CreateEmployeeRequest, request: Request):
    """Create a new employee with full details (Admin only)"""
    from server import get_current_user, hash_password
    current_user = await get_current_user(request)
    
    if current_user.role not in ["admin", "super_admin", "hr_manager"]:
        raise HTTPException(status_code=403, detail="Admin/HR access required")
    
    # Check if email already exists
    existing = await db.users.find_one({"email": data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    emp_id = data.employee_id or f"EMP{user_id[-6:].upper()}"
    
    user_doc = {
        "user_id": user_id,
        "email": data.email,
        "name": data.full_name,
        "role": data.role,
        "password_hash": hash_password(data.password),
        "is_active": True,
        "designation": data.designation or "",
        "department": data.department or "",
        "module_access": data.module_access or [],
        "project_access": [],
        "can_create_projects": data.role in ["admin", "super_admin", "project_manager"],
        "can_delete_tasks": data.role in ["admin", "super_admin"],
        "can_manage_users": data.role in ["admin", "super_admin", "hr_manager"],
        "created_at": datetime.now(timezone.utc),
        "created_by": current_user.user_id
    }
    
    await db.users.insert_one(user_doc)
    
    # Create employee profile
    profile_doc = {
        "user_id": user_id,
        "employee_id": emp_id,
        "full_name": data.full_name,
        "email": data.email,
        "phone": data.phone,
        "date_of_birth": data.date_of_birth,
        "gender": data.gender,
        "blood_group": data.blood_group,
        # Employment
        "designation": data.designation,
        "department": data.department,
        "employment_type": data.employment_type,
        "joining_date": data.joining_date,
        "reporting_manager": data.reporting_manager,
        "work_location": data.work_location,
        # Bank Details
        "bank_name": data.bank_name,
        "account_number": data.account_number,
        "ifsc_code": data.ifsc_code,
        "pan_number": data.pan_number,
        "aadhar_number": data.aadhar_number,
        # Documents
        "resume_link": data.resume_link,
        "id_proof_link": data.id_proof_link,
        "address_proof_link": data.address_proof_link,
        "education_docs_link": data.education_docs_link,
        "offer_letter_link": data.offer_letter_link,
        # Emergency Contact
        "emergency_contact_name": data.emergency_contact_name,
        "emergency_contact_phone": data.emergency_contact_phone,
        "emergency_contact_relation": data.emergency_contact_relation,
        # Address
        "address": data.address,
        "city": data.city,
        "state": data.state,
        "pincode": data.pincode,
        # Metadata
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "created_by": current_user.user_id
    }
    
    await db.employee_profiles.insert_one(profile_doc)
    
    # Initialize leave balance for current year
    current_year = datetime.now().year
    leave_balance = {
        "user_id": user_id,
        "year": current_year,
        "casual_leave": 12,
        "sick_leave": 6,
        "earned_leave": 15,
        "unpaid_leave": 0,
        "casual_used": 0,
        "sick_used": 0,
        "earned_used": 0,
        "unpaid_used": 0
    }
    await db.leave_balances.insert_one(leave_balance)
    
    # Send welcome email with credentials
    email_html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #6366f1;">Welcome to Drawlead OS!</h2>
        <p>Hello {data.full_name},</p>
        <p>Your employee account has been created. Here are your login credentials:</p>
        <div style="background: #f4f4f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Email:</strong> {data.email}</p>
            <p><strong>Password:</strong> {data.password}</p>
            <p><strong>Employee ID:</strong> {emp_id}</p>
            <p><strong>Role:</strong> {data.role.replace('_', ' ').title()}</p>
        </div>
        <p>Please login and change your password immediately.</p>
        <p style="color: #71717a; font-size: 12px;">- Drawlead OS HR Team</p>
    </div>
    """
    
    await send_email_notification(
        data.email,
        "Welcome to Drawlead OS - Your Login Credentials",
        email_html
    )
    
    return {
        "message": "Employee created successfully",
        "user_id": user_id,
        "employee_id": emp_id,
        "email": data.email,
        "credentials_sent": True
    }


