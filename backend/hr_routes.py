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
    work_location: str = "office"  # office, home
    total_hours: float = 0.0
    status: str = "present"  # present, absent, half-day, on-leave
    notes: str = ""
    created_at: datetime

class ClockInRequest(BaseModel):
    work_location: str = "office"  # office, home

class ClockOutRequest(BaseModel):
    notes: Optional[str] = ""

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
    month: int
    year: int
    basic_salary: float
    hra: float = 0.0
    other_allowances: float = 0.0
    gross_salary: float
    pf_deduction: float = 0.0
    tax_deduction: float = 0.0
    other_deductions: float = 0.0
    net_salary: float
    payment_date: Optional[datetime] = None
    payment_status: str = "pending"  # pending, paid
    created_at: datetime

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

@hr_router.post("/attendance/clock-in")
async def clock_in(clock_data: ClockInRequest, request: Request):
    """Clock in for the day"""
    from server import get_current_user
    user = await get_current_user(request)
    
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    
    # Check if already clocked in today
    existing = await db.attendance.find_one({
        "user_id": user.user_id,
        "date": {"$gte": today, "$lt": today + timedelta(days=1)}
    })
    
    if existing and existing.get("clock_in"):
        raise HTTPException(status_code=400, detail="Already clocked in today")
    
    now = datetime.now(timezone.utc)
    
    if existing:
        # Update existing record
        await db.attendance.update_one(
            {"attendance_id": existing["attendance_id"]},
            {"$set": {
                "clock_in": now,
                "work_location": clock_data.work_location,
                "status": "present"
            }}
        )
        attendance_id = existing["attendance_id"]
    else:
        # Create new record
        attendance_id = f"att_{uuid.uuid4().hex[:12]}"
        attendance_doc = {
            "attendance_id": attendance_id,
            "user_id": user.user_id,
            "date": today,
            "clock_in": now,
            "clock_out": None,
            "work_location": clock_data.work_location,
            "total_hours": 0.0,
            "status": "present",
            "notes": "",
            "created_at": now
        }
        await db.attendance.insert_one(attendance_doc)
    
    return await db.attendance.find_one({"attendance_id": attendance_id}, {"_id": 0})

@hr_router.post("/attendance/clock-out")
async def clock_out(clock_data: ClockOutRequest, request: Request):
    """Clock out for the day"""
    from server import get_current_user
    user = await get_current_user(request)
    
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    
    # Find today's attendance
    existing = await db.attendance.find_one({
        "user_id": user.user_id,
        "date": {"$gte": today, "$lt": today + timedelta(days=1)}
    })
    
    if not existing:
        raise HTTPException(status_code=400, detail="No clock-in record found for today")
    
    if existing.get("clock_out"):
        raise HTTPException(status_code=400, detail="Already clocked out today")
    
    now = datetime.now(timezone.utc)
    clock_in_time = existing.get("clock_in")
    
    # Calculate total hours
    if clock_in_time:
        if isinstance(clock_in_time, str):
            clock_in_time = datetime.fromisoformat(clock_in_time.replace('Z', '+00:00'))
        total_hours = (now - clock_in_time).total_seconds() / 3600
    else:
        total_hours = 0
    
    await db.attendance.update_one(
        {"attendance_id": existing["attendance_id"]},
        {"$set": {
            "clock_out": now,
            "total_hours": round(total_hours, 2),
            "notes": clock_data.notes or ""
        }}
    )
    
    return await db.attendance.find_one({"attendance_id": existing["attendance_id"]}, {"_id": 0})

@hr_router.get("/attendance/today")
async def get_today_attendance(request: Request):
    """Get today's attendance status"""
    from server import get_current_user
    user = await get_current_user(request)
    
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    
    attendance = await db.attendance.find_one({
        "user_id": user.user_id,
        "date": {"$gte": today, "$lt": today + timedelta(days=1)}
    }, {"_id": 0})
    
    return attendance or {"status": "not_clocked_in"}

@hr_router.get("/attendance/history")
async def get_attendance_history(
    request: Request,
    month: Optional[int] = None,
    year: Optional[int] = None
):
    """Get attendance history"""
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
    
    # Calculate summary
    total_days = len(records)
    total_hours = sum(r.get("total_hours", 0) for r in records)
    wfh_days = len([r for r in records if r.get("work_location") == "home"])
    wfo_days = len([r for r in records if r.get("work_location") == "office"])
    
    return {
        "records": records,
        "summary": {
            "total_days": total_days,
            "total_hours": round(total_hours, 2),
            "average_hours": round(total_hours / total_days, 2) if total_days > 0 else 0,
            "wfh_days": wfh_days,
            "wfo_days": wfo_days
        }
    }

@hr_router.get("/attendance/report")
async def get_attendance_report(request: Request, user_id: Optional[str] = None):
    """Get comprehensive attendance report (Admin)"""
    from server import get_current_user
    current_user = await get_current_user(request)
    
    target_user_id = user_id or current_user.user_id
    
    # Non-admins can only see their own report
    if current_user.role not in ["admin", "super_admin", "project_manager"]:
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
                "wfh_days": 0,
                "wfo_days": 0
            }
        
        monthly_summary[month_key]["days_present"] += 1
        monthly_summary[month_key]["total_hours"] += record.get("total_hours", 0)
        if record.get("work_location") == "home":
            monthly_summary[month_key]["wfh_days"] += 1
        else:
            monthly_summary[month_key]["wfo_days"] += 1
    
    return {
        "records": records,
        "monthly_summary": monthly_summary
    }

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
    
    # Send email notification to admin
    start_str = leave_data.start_date.strftime("%d %b %Y") if hasattr(leave_data.start_date, 'strftime') else str(leave_data.start_date)[:10]
    end_str = leave_data.end_date.strftime("%d %b %Y") if hasattr(leave_data.end_date, 'strftime') else str(leave_data.end_date)[:10]
    
    email_html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #10b981;">New Leave Request</h2>
        <p><strong>Employee:</strong> {user.name}</p>
        <p><strong>Leave Type:</strong> {leave_data.leave_type.upper()}</p>
        <p><strong>Duration:</strong> {start_str} to {end_str}</p>
        <p><strong>Reason:</strong> {leave_data.reason}</p>
        <p style="margin-top: 20px;">Please login to Drawlead OS to approve or reject this request.</p>
    </div>
    """
    
    # Send to admin email
    await send_email_notification(
        ADMIN_EMAIL,
        f"Leave Request from {user.name} - {leave_data.leave_type.upper()}",
        email_html
    )
    
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
    
    if user.role not in ["admin", "super_admin", "project_manager"]:
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
    
    # Send approval email to employee
    start_str = start.strftime("%d %b %Y")
    end_str = end.strftime("%d %b %Y")
    
    email_html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #10b981;">Leave Request Approved ✓</h2>
        <p>Hi {leave.get('user_name', 'Employee')},</p>
        <p>Your leave request has been <strong style="color: #10b981;">approved</strong>.</p>
        <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Leave Type:</strong> {leave_type.upper()}</p>
            <p><strong>Duration:</strong> {start_str} to {end_str}</p>
            <p><strong>Approved by:</strong> {user.name}</p>
        </div>
        <p>Enjoy your time off!</p>
    </div>
    """
    
    employee_email = leave.get("user_email", "")
    if employee_email:
        await send_email_notification(
            employee_email,
            f"Leave Request Approved - {leave_type.upper()}",
            email_html
        )
    
    return await db.leave_requests.find_one({"leave_id": leave_id}, {"_id": 0})

@hr_router.put("/leave/{leave_id}/reject")
async def reject_leave_request(leave_id: str, request: Request, reason: str = ""):
    """Reject a leave request"""
    from server import get_current_user
    user = await get_current_user(request)
    
    if user.role not in ["admin", "super_admin", "project_manager"]:
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
    
    # Send rejection email to employee
    start = leave["start_date"]
    end = leave["end_date"]
    if isinstance(start, str):
        start = datetime.fromisoformat(start.replace('Z', '+00:00'))
    if isinstance(end, str):
        end = datetime.fromisoformat(end.replace('Z', '+00:00'))
    
    start_str = start.strftime("%d %b %Y")
    end_str = end.strftime("%d %b %Y")
    leave_type = leave.get("leave_type", "leave")
    
    email_html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #ef4444;">Leave Request Not Approved</h2>
        <p>Hi {leave.get('user_name', 'Employee')},</p>
        <p>Your leave request has been <strong style="color: #ef4444;">not approved</strong>.</p>
        <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Leave Type:</strong> {leave_type.upper()}</p>
            <p><strong>Duration:</strong> {start_str} to {end_str}</p>
            <p><strong>Reviewed by:</strong> {user.name}</p>
            {f'<p><strong>Reason:</strong> {reason}</p>' if reason else ''}
        </div>
        <p>Please contact your manager for more details.</p>
    </div>
    """
    
    employee_email = leave.get("user_email", "")
    if employee_email:
        await send_email_notification(
            employee_email,
            f"Leave Request Update - {leave_type.upper()}",
            email_html
        )
    
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
