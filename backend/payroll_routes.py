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
    except:
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
    """Get detailed payroll for a specific month/year"""
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
    
    # Get attendance for the month to calculate working days
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
    
    # Get leave records for the month
    leave_records = await db.leave_requests.find({
        "user_id": user_id,
        "status": "approved",
        "start_date": {"$lte": month_end.strftime("%Y-%m-%d")},
        "end_date": {"$gte": month_start.strftime("%Y-%m-%d")}
    }).to_list(10)
    
    leave_days = sum(r.get("days", 1) for r in leave_records)
    
    # Calculate payroll components (simplified)
    # Standard deductions
    pf_deduction = base_salary * 0.12  # 12% PF
    professional_tax = 200 if base_salary > 15000 else 0
    
    # Allowances
    hra = base_salary * 0.40  # 40% HRA
    special_allowance = base_salary * 0.10
    
    gross_salary = base_salary + hra + special_allowance
    total_deductions = pf_deduction + professional_tax
    net_salary = gross_salary - total_deductions
    
    # Get employee info
    employee = await db.users.find_one({"user_id": user_id}, {"_id": 0, "name": 1, "email": 1, "designation": 1, "join_date": 1})
    
    return {
        "employee": employee,
        "month": month,
        "year": year,
        "base_salary": base_salary,
        "earnings": {
            "basic": base_salary,
            "hra": round(hra, 2),
            "special_allowance": round(special_allowance, 2)
        },
        "deductions": {
            "pf": round(pf_deduction, 2),
            "professional_tax": professional_tax
        },
        "gross_salary": round(gross_salary, 2),
        "total_deductions": round(total_deductions, 2),
        "net_salary": round(net_salary, 2),
        "attendance": {
            "days_present": days_present,
            "leave_days": leave_days
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
