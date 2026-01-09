from fastapi import APIRouter, HTTPException, Depends, Request
from motor.motor_asyncio import AsyncIOMotorClient
from finance_models import *
from datetime import datetime, timezone
import os
from typing import List, Optional

# This will be initialized from server.py
finance_router = APIRouter(prefix="/finance")
db = None  # Will be set from server.py

def init_finance_db(database):
    global db
    db = database

async def get_current_user_from_request(request: Request) -> dict:
    """Get current user from session token in request"""
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
    
    # Verify session
    session_doc = await db.user_sessions.find_one(
        {"session_token": session_token},
        {"_id": 0}
    )
    
    if not session_doc:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    # Check expiry
    expires_at = session_doc["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")
    
    # Get user
    user_doc = await db.users.find_one(
        {"user_id": session_doc["user_id"]},
        {"_id": 0}
    )
    
    if not user_doc:
        raise HTTPException(status_code=401, detail="User not found")
    
    return user_doc

# ============== HELPER FUNCTIONS ==============

def calculate_salary_components(ctc: float):
    """Calculate salary components from CTC"""
    monthly_ctc = ctc / 12
    basic = monthly_ctc * 0.50
    hra = monthly_ctc * 0.20
    special = monthly_ctc * 0.30
    return {
        "basic_salary": round(basic, 2),
        "hra": round(hra, 2),
        "special_allowance": round(special, 2)
    }

async def generate_invoice_number(year: int):
    """Generate next invoice number for the year"""
    # Find the latest invoice for this year
    latest = await db.invoices.find_one(
        {"invoice_number": {"$regex": f"^INV-{year}-"}},
        {"_id": 0, "invoice_number": 1},
        sort=[("invoice_number", -1)]
    )
    
    if latest:
        # Extract number and increment
        parts = latest["invoice_number"].split("-")
        next_num = int(parts[2]) + 1
    else:
        next_num = 1
    
    return f"INV-{year}-{str(next_num).zfill(4)}"

async def generate_employee_code():
    """Generate next employee code"""
    latest = await db.employees.find_one(
        {},
        {"_id": 0, "employee_code": 1},
        sort=[("employee_code", -1)]
    )
    
    if latest and latest.get("employee_code"):
        # Extract number and increment
        num = int(latest["employee_code"].replace("EMP", ""))
        next_num = num + 1
    else:
        next_num = 1
    
    return f"EMP{str(next_num).zfill(4)}"

def calculate_gst(subtotal: float, gst_rate: float, is_inter_state: bool = False):
    """Calculate GST components"""
    gst_amount = (subtotal * gst_rate) / 100
    
    if is_inter_state:
        return {
            "cgst": 0.0,
            "sgst": 0.0,
            "igst": round(gst_amount, 2)
        }
    else:
        half_gst = gst_amount / 2
        return {
            "cgst": round(half_gst, 2),
            "sgst": round(half_gst, 2),
            "igst": 0.0
        }

def calculate_payslip(employee: Dict, attendance: Dict, other_deductions: float = 0.0):
    """Calculate payslip components"""
    present_days = attendance.get("present_days", 0)
    total_working_days = attendance.get("total_working_days", 26)
    
    # Calculate paid days based salary
    paid_ratio = present_days / total_working_days if total_working_days > 0 else 1
    
    basic = employee["basic_salary"] * paid_ratio
    hra = employee["hra"] * paid_ratio
    special = employee["special_allowance"] * paid_ratio
    
    gross = basic + hra + special
    
    # PF: 12% of basic
    pf = (basic * 0.12) if employee.get("pf_applicable") else 0.0
    
    # ESI: 0.75% of gross (if applicable and gross < 21000)
    esi = (gross * 0.0075) if employee.get("esi_applicable") and gross < 21000 else 0.0
    
    # TDS: Simplified (can be enhanced)
    tds = 0.0
    
    total_deductions = pf + esi + tds + other_deductions
    net = gross - total_deductions
    
    return {
        "basic_salary": round(basic, 2),
        "hra": round(hra, 2),
        "special_allowance": round(special, 2),
        "gross_salary": round(gross, 2),
        "pf_deduction": round(pf, 2),
        "esi_deduction": round(esi, 2),
        "tds_deduction": round(tds, 2),
        "other_deductions": round(other_deductions, 2),
        "total_deductions": round(total_deductions, 2),
        "net_salary": round(net, 2),
        "present_days": present_days,
        "absent_days": attendance.get("absent_days", 0),
        "paid_days": present_days
    }

# ============== INVOICE ROUTES ==============

@finance_router.post("/invoices")
async def create_invoice(invoice_data: InvoiceCreate):
    """Create a new invoice"""
    try:
        user_id = "admin"  # TODO: Get from auth context
        
        # Generate invoice number
        year = invoice_data.invoice_date.year
        invoice_number = await generate_invoice_number(year)
        
        # Calculate totals with per-item GST and discounts
        subtotal = 0.0
        total_gst = 0.0
        total_discount = 0.0
        
        processed_items = []
        for item in invoice_data.items:
            # Calculate item amount
            item_subtotal = item["quantity"] * item["rate"]
            
            # Apply discount
            discount_percent = item.get("discount_percent", 0.0)
            discount_amount = (item_subtotal * discount_percent) / 100
            amount_after_discount = item_subtotal - discount_amount
            
            # Apply GST
            gst_rate = item.get("gst_rate", 0.0)
            gst_amount = (amount_after_discount * gst_rate) / 100
            final_amount = amount_after_discount + gst_amount
            
            processed_items.append({
                **item,
                "discount_percent": discount_percent,
                "discount_amount": round(discount_amount, 2),
                "amount_before_tax": round(amount_after_discount, 2),
                "gst_rate": gst_rate,
                "gst_amount": round(gst_amount, 2),
                "amount": round(final_amount, 2)
            })
            
            subtotal += item_subtotal
            total_discount += discount_amount
            total_gst += gst_amount
        
        # Calculate invoice-level GST if gst_type is 'gst'
        if invoice_data.gst_type == "gst":
            # Use invoice-level GST if items don't have individual GST
            invoice_gst_amount = (subtotal * invoice_data.gst_rate) / 100
            is_inter_state = False  # Can be determined by GST state codes
            gst_calc = calculate_gst(subtotal, invoice_data.gst_rate, is_inter_state)
            cgst = gst_calc["cgst"]
            sgst = gst_calc["sgst"]
            igst = gst_calc["igst"]
            total = subtotal + cgst + sgst + igst
        else:
            cgst = sgst = igst = 0.0
            # Use item-level GST totals
            total = subtotal - total_discount + total_gst
        
        # Create invoice
        invoice_id = f"inv_{uuid.uuid4().hex[:12]}"
        invoice_doc = {
            "invoice_id": invoice_id,
            "invoice_number": invoice_number,
            **invoice_data.model_dump(exclude={"items"}),
            "status": "draft",
            "subtotal": round(subtotal, 2),
            "total_discount": round(total_discount, 2),
            "cgst": cgst,
            "sgst": sgst,
            "igst": igst,
            "total_amount": round(total, 2),
            "created_by": user_id,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
            "is_deleted": False
        }
        
        await db.invoices.insert_one(invoice_doc)
        
        # Create invoice items
        for item in processed_items:
            item_id = f"item_{uuid.uuid4().hex[:12]}"
            item_doc = {
                "item_id": item_id,
                "invoice_id": invoice_id,
                "service_name": item["service_name"],
                "description": item.get("description", ""),
                "quantity": item["quantity"],
                "rate": item["rate"],
                "discount_percent": item["discount_percent"],
                "discount_amount": item["discount_amount"],
                "amount_before_tax": item["amount_before_tax"],
                "gst_rate": item["gst_rate"],
                "gst_amount": item["gst_amount"],
                "amount": item["amount"]
            }
            await db.invoice_items.insert_one(item_doc)
        
        # Return invoice with items
        result = await db.invoices.find_one({"invoice_id": invoice_id}, {"_id": 0})
        items = await db.invoice_items.find({"invoice_id": invoice_id}, {"_id": 0}).to_list(100)
        result["items"] = items
        
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@finance_router.get("/invoices")
async def get_invoices(
    status: Optional[str] = None,
    gst_type: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None
):
    """Get all invoices with filters"""
    query = {"is_deleted": False}
    
    if status:
        query["status"] = status
    if gst_type:
        query["gst_type"] = gst_type
    if from_date:
        query["invoice_date"] = {"$gte": datetime.fromisoformat(from_date)}
    if to_date:
        if "invoice_date" in query:
            query["invoice_date"]["$lte"] = datetime.fromisoformat(to_date)
        else:
            query["invoice_date"] = {"$lte": datetime.fromisoformat(to_date)}
    
    invoices = await db.invoices.find(query, {"_id": 0}).sort("invoice_date", -1).to_list(1000)
    
    # Enrich with items
    for invoice in invoices:
        items = await db.invoice_items.find({"invoice_id": invoice["invoice_id"]}, {"_id": 0}).to_list(100)
        invoice["items"] = items
    
    return invoices

@finance_router.get("/invoices/{invoice_id}")
async def get_invoice(invoice_id: str):
    """Get single invoice with items"""
    invoice = await db.invoices.find_one({"invoice_id": invoice_id, "is_deleted": False}, {"_id": 0})
    
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    items = await db.invoice_items.find({"invoice_id": invoice_id}, {"_id": 0}).to_list(100)
    invoice["items"] = items
    
    return invoice

@finance_router.put("/invoices/{invoice_id}")
async def update_invoice(invoice_id: str, invoice_data: InvoiceUpdate):
    """Update invoice"""
    user_id = "admin"  # TODO: Get from auth context
    
    invoice = await db.invoices.find_one({"invoice_id": invoice_id, "is_deleted": False})
    
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    update_data = invoice_data.model_dump(exclude_unset=True, exclude={"items"})
    
    # Recalculate if items changed
    if invoice_data.items:
        subtotal = sum(item["quantity"] * item["rate"] for item in invoice_data.items)
        
        gst_type = invoice_data.gst_type or invoice["gst_type"]
        gst_rate = invoice_data.gst_rate if invoice_data.gst_rate is not None else invoice["gst_rate"]
        
        if gst_type == "gst":
            gst_calc = calculate_gst(subtotal, gst_rate, False)
            update_data.update({
                "subtotal": round(subtotal, 2),
                "cgst": gst_calc["cgst"],
                "sgst": gst_calc["sgst"],
                "igst": gst_calc["igst"],
                "total_amount": round(subtotal + gst_calc["cgst"] + gst_calc["sgst"] + gst_calc["igst"], 2)
            })
        else:
            update_data.update({
                "subtotal": round(subtotal, 2),
                "cgst": 0.0,
                "sgst": 0.0,
                "igst": 0.0,
                "total_amount": round(subtotal, 2)
            })
        
        # Update items
        await db.invoice_items.delete_many({"invoice_id": invoice_id})
        for item in invoice_data.items:
            item_id = f"item_{uuid.uuid4().hex[:12]}"
            item_doc = {
                "item_id": item_id,
                "invoice_id": invoice_id,
                "service_name": item["service_name"],
                "description": item.get("description"),
                "quantity": item["quantity"],
                "rate": item["rate"],
                "amount": round(item["quantity"] * item["rate"], 2)
            }
            await db.invoice_items.insert_one(item_doc)
    
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    await db.invoices.update_one(
        {"invoice_id": invoice_id},
        {"$set": update_data}
    )
    
    # Return updated invoice
    result = await db.invoices.find_one({"invoice_id": invoice_id}, {"_id": 0})
    items = await db.invoice_items.find({"invoice_id": invoice_id}, {"_id": 0}).to_list(100)
    result["items"] = items
    
    return result

@finance_router.delete("/invoices/{invoice_id}")
async def delete_invoice(invoice_id: str):
    """Soft delete invoice"""
    await db.invoices.update_one(
        {"invoice_id": invoice_id},
        {"$set": {"is_deleted": True}}
    )
    return {"message": "Invoice deleted"}

@finance_router.post("/invoices/{invoice_id}/duplicate")
async def duplicate_invoice(invoice_id: str):
    """Duplicate an existing invoice"""
    user_id = "admin"  # TODO: Get from auth context
    
    original = await db.invoices.find_one({"invoice_id": invoice_id}, {"_id": 0})
    
    if not original:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    # Generate new invoice number
    year = datetime.now(timezone.utc).year
    new_invoice_number = await generate_invoice_number(year)
    
    new_invoice_id = f"inv_{uuid.uuid4().hex[:12]}"
    new_invoice = {
        **original,
        "invoice_id": new_invoice_id,
        "invoice_number": new_invoice_number,
        "invoice_date": datetime.now(timezone.utc),
        "status": "draft",
        "created_by": user_id,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    
    await db.invoices.insert_one(new_invoice)
    
    # Duplicate items
    items = await db.invoice_items.find({"invoice_id": invoice_id}, {"_id": 0}).to_list(100)
    for item in items:
        new_item = {
            **item,
            "item_id": f"item_{uuid.uuid4().hex[:12]}",
            "invoice_id": new_invoice_id
        }
        await db.invoice_items.insert_one(new_item)
    
    # Return new invoice
    result = await db.invoices.find_one({"invoice_id": new_invoice_id}, {"_id": 0})
    result["items"] = await db.invoice_items.find({"invoice_id": new_invoice_id}, {"_id": 0}).to_list(100)
    
    return result

# ============== REVENUE & STATS ==============

@finance_router.get("/revenue-stats")
async def get_revenue_stats(
    month: Optional[int] = None,
    year: Optional[int] = None
):
    """Get revenue statistics"""
    query = {"is_deleted": False}
    
    if month and year:
        start_date = datetime(year, month, 1)
        if month == 12:
            end_date = datetime(year + 1, 1, 1)
        else:
            end_date = datetime(year, month + 1, 1)
        query["invoice_date"] = {"$gte": start_date, "$lt": end_date}
    elif year:
        query["invoice_date"] = {
            "$gte": datetime(year, 1, 1),
            "$lt": datetime(year + 1, 1, 1)
        }
    
    # Aggregate stats
    pipeline = [
        {"$match": query},
        {"$group": {
            "_id": "$status",
            "count": {"$sum": 1},
            "total": {"$sum": "$total_amount"}
        }}
    ]
    
    status_stats = {doc["_id"]: {"count": doc["count"], "total": doc["total"]} 
                    for doc in await db.invoices.aggregate(pipeline).to_list(100)}
    
    # GST vs Non-GST
    gst_pipeline = [
        {"$match": query},
        {"$group": {
            "_id": "$gst_type",
            "count": {"$sum": 1},
            "total": {"$sum": "$total_amount"},
            "gst_collected": {"$sum": {"$add": ["$cgst", "$sgst", "$igst"]}}
        }}
    ]
    
    gst_stats = {doc["_id"]: {
        "count": doc["count"],
        "total": doc["total"],
        "gst_collected": doc.get("gst_collected", 0)
    } for doc in await db.invoices.aggregate(gst_pipeline).to_list(100)}
    
    return {
        "by_status": status_stats,
        "by_gst_type": gst_stats,
        "total_invoices": sum(s["count"] for s in status_stats.values()),
        "total_revenue": sum(s["total"] for s in status_stats.values())
    }

@finance_router.get("/gst-report")
async def get_gst_report(month: int, year: int):
    """Get GST report for a specific month"""
    start_date = datetime(year, month, 1)
    if month == 12:
        end_date = datetime(year + 1, 1, 1)
    else:
        end_date = datetime(year, month + 1, 1)
    
    query = {
        "is_deleted": False,
        "gst_type": "gst",
        "invoice_date": {"$gte": start_date, "$lt": end_date}
    }
    
    invoices = await db.invoices.find(query, {"_id": 0}).to_list(1000)
    
    total_cgst = sum(inv.get("cgst", 0) for inv in invoices)
    total_sgst = sum(inv.get("sgst", 0) for inv in invoices)
    total_igst = sum(inv.get("igst", 0) for inv in invoices)
    total_gst = total_cgst + total_sgst + total_igst
    
    return {
        "month": month,
        "year": year,
        "total_cgst": round(total_cgst, 2),
        "total_sgst": round(total_sgst, 2),
        "total_igst": round(total_igst, 2),
        "total_gst_collected": round(total_gst, 2),
        "invoice_count": len(invoices),
        "invoices": invoices
    }

# ============== EMPLOYEE ROUTES ==============
    user_id = "admin"  # TODO: Get from auth context

@finance_router.post("/employees")
async def create_employee(employee_data: EmployeeCreate):
    """Create new employee"""
    employee_code = await generate_employee_code()
    employee_id = f"emp_{uuid.uuid4().hex[:12]}"
    
    # Calculate salary components
    salary_comp = calculate_salary_components(employee_data.ctc)
    
    employee_doc = {
        "employee_id": employee_id,
        "employee_code": employee_code,
        **employee_data.model_dump(),
        **salary_comp,
        "is_active": True,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    
    await db.employees.insert_one(employee_doc)
    
    return await db.employees.find_one({"employee_id": employee_id}, {"_id": 0})

@finance_router.get("/employees")
async def get_employees(is_active: Optional[bool] = True):
    """Get all employees"""
    query = {}
    if is_active is not None:
        query["is_active"] = is_active
    
    employees = await db.employees.find(query, {"_id": 0}).sort("employee_code", 1).to_list(1000)
    return employees

@finance_router.get("/employees/{employee_id}")
async def get_employee(employee_id: str):
    """Get single employee"""
    employee = await db.employees.find_one({"employee_id": employee_id}, {"_id": 0})
    
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    return employee

    user_id = "admin"  # TODO: Get from auth context
# ============== ATTENDANCE ROUTES ==============

@finance_router.post("/attendance")
async def create_attendance(attendance_data: AttendanceCreate):
    """Create/Update attendance record"""
    # Check if attendance already exists
    existing = await db.attendance.find_one({
        "employee_id": attendance_data.employee_id,
        "month": attendance_data.month,
        "year": attendance_data.year
    })
    
    if existing:
        # Update
        await db.attendance.update_one(
            {"attendance_id": existing["attendance_id"]},
            {"$set": {
                **attendance_data.model_dump(),
                "updated_at": datetime.now(timezone.utc)
            }}
        )
        return await db.attendance.find_one({"attendance_id": existing["attendance_id"]}, {"_id": 0})
    else:
        # Create
        attendance_id = f"att_{uuid.uuid4().hex[:12]}"
        attendance_doc = {
            "attendance_id": attendance_id,
            **attendance_data.model_dump(),
            "created_by": user_id,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        }
        
        await db.attendance.insert_one(attendance_doc)
        return await db.attendance.find_one({"attendance_id": attendance_id}, {"_id": 0})

@finance_router.get("/attendance")
async def get_attendance(employee_id: Optional[str] = None, month: Optional[int] = None, year: Optional[int] = None):
    """Get attendance records"""
    query = {}
    if employee_id:
        query["employee_id"] = employee_id
    if month:
        query["month"] = month
    if year:
        query["year"] = year
    
    records = await db.attendance.find(query, {"_id": 0}).to_list(1000)
    return records

    user_id = "admin"  # TODO: Get from auth context
# ============== PAYSLIP ROUTES ==============

@finance_router.post("/payslips/generate")
async def generate_payslip(payslip_data: PayslipGenerate):
    """Generate payslip for an employee"""
    # Get employee
    employee = await db.employees.find_one({"employee_id": payslip_data.employee_id}, {"_id": 0})
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    # Get attendance
    attendance = await db.attendance.find_one({
        "employee_id": payslip_data.employee_id,
        "month": payslip_data.month,
        "year": payslip_data.year
    }, {"_id": 0})
    
    if not attendance:
        raise HTTPException(status_code=404, detail="Attendance record not found for this month")
    
    # Check if payslip already exists
    existing = await db.payslips.find_one({
        "employee_id": payslip_data.employee_id,
        "month": payslip_data.month,
        "year": payslip_data.year,
        "is_deleted": False
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="Payslip already exists for this month")
    
    # Calculate payslip
    calc = calculate_payslip(employee, attendance, payslip_data.other_deductions)
    
    payslip_id = f"pay_{uuid.uuid4().hex[:12]}"
    payslip_doc = {
        "payslip_id": payslip_id,
        "employee_id": employee["employee_id"],
        "employee_name": employee["name"],
        "employee_code": employee["employee_code"],
        "month": payslip_data.month,
        "year": payslip_data.year,
        **calc,
        "status": "draft",
        "generated_by": user_id,
        "generated_at": datetime.now(timezone.utc),
        "is_deleted": False
    }
    
    await db.payslips.insert_one(payslip_doc)
    
    return await db.payslips.find_one({"payslip_id": payslip_id}, {"_id": 0})

@finance_router.get("/payslips")
async def get_payslips(
    employee_id: Optional[str] = None,
    month: Optional[int] = None,
    year: Optional[int] = None,
    status: Optional[str] = None
):
    """Get payslips"""
    query = {"is_deleted": False}
    if employee_id:
        query["employee_id"] = employee_id
    if month:
        query["month"] = month
    if year:
        query["year"] = year
    if status:
        query["status"] = status
    
    payslips = await db.payslips.find(query, {"_id": 0}).sort("generated_at", -1).to_list(1000)
    return payslips

@finance_router.get("/payslips/{payslip_id}")
async def get_payslip(payslip_id: str):
    """Get single payslip"""
    payslip = await db.payslips.find_one({"payslip_id": payslip_id, "is_deleted": False}, {"_id": 0})
    
    if not payslip:
        raise HTTPException(status_code=404, detail="Payslip not found")
    
    return payslip

@finance_router.put("/payslips/{payslip_id}/status")
async def update_payslip_status(payslip_id: str, status: str):
    """Update payslip status"""
    await db.payslips.update_one(
        {"payslip_id": payslip_id},
        {"$set": {"status": status}}
    )
    
    return await db.payslips.find_one({"payslip_id": payslip_id}, {"_id": 0})
    user_id = "admin"  # TODO: Get from auth context

# ============== BUDGET ROUTES ==============

@finance_router.post("/budgets")
async def create_budget(budget_data: BudgetCreate):
    """Create budget"""
    budget_id = f"bud_{uuid.uuid4().hex[:12]}"
    budget_doc = {
        "budget_id": budget_id,
        **budget_data.model_dump(),
        "spent_amount": 0.0,
        "remaining_amount": budget_data.allocated_amount,
        "created_by": user_id,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    
    await db.budgets.insert_one(budget_doc)
    
    return await db.budgets.find_one({"budget_id": budget_id}, {"_id": 0})

@finance_router.get("/budgets")
async def get_budgets(month: Optional[int] = None, year: Optional[int] = None):
    """Get budgets"""
    query = {}
    if month:
        query["month"] = month
    if year:
        query["year"] = year
    
    budgets = await db.budgets.find(query, {"_id": 0}).to_list(1000)
    return budgets

@finance_router.put("/budgets/{budget_id}")
async def update_budget(budget_id: str, budget_data: BudgetUpdate):
    """Update budget"""
    update_data = budget_data.model_dump(exclude_unset=True)
    
    # Recalculate remaining if allocated or spent changed
    budget = await db.budgets.find_one({"budget_id": budget_id}, {"_id": 0})
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")
    
    allocated = update_data.get("allocated_amount", budget["allocated_amount"])
    spent = update_data.get("spent_amount", budget["spent_amount"])
    update_data["remaining_amount"] = allocated - spent
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    await db.budgets.update_one(
        {"budget_id": budget_id},
        {"$set": update_data}
    )
    
    return await db.budgets.find_one({"budget_id": budget_id}, {"_id": 0})

# ============== COMPANY SETTINGS ==============

@finance_router.get("/settings")
async def get_company_settings():
    """Get company settings"""
    settings = await db.company_settings.find_one({}, {"_id": 0})
    
    if not settings:
        # Return default
        return {
            "settings_id": "default",
            "company_name": "Your Company Name",
            "company_address": "",
            "company_email": "",
            "company_phone": "",
            "invoice_terms": "Payment due within 30 days"
        }
    
    return settings

@finance_router.put("/settings")
async def update_company_settings(settings_data: CompanySettingsUpdate):
    """Update company settings"""
    user_id = "admin"  # TODO: Get from auth context
    
    existing = await db.company_settings.find_one({})
    
    if existing:
        update_data = settings_data.model_dump(exclude_unset=True)
        update_data["updated_by"] = user_id
        update_data["updated_at"] = datetime.now(timezone.utc)
        
        await db.company_settings.update_one(
            {"settings_id": existing["settings_id"]},
            {"$set": update_data}
        )
        
        return await db.company_settings.find_one({"settings_id": existing["settings_id"]}, {"_id": 0})
    else:
        settings_id = "settings_001"
        settings_doc = {
            "settings_id": settings_id,
            **settings_data.model_dump(exclude_unset=True),
            "updated_by": user_id,
            "updated_at": datetime.now(timezone.utc)
        }
        
        await db.company_settings.insert_one(settings_doc)
        
        return await db.company_settings.find_one({"settings_id": settings_id}, {"_id": 0})

# ============== EXPORTS ==============

@finance_router.get("/exports/invoices")
async def export_invoices(gst_type: Optional[str] = None, from_date: Optional[str] = None, to_date: Optional[str] = None):
    """Export invoices"""
    query = {"is_deleted": False}
    if gst_type:
        query["gst_type"] = gst_type
    if from_date:
        query["invoice_date"] = {"$gte": datetime.fromisoformat(from_date)}
    if to_date:
        if "invoice_date" in query:
            query["invoice_date"]["$lte"] = datetime.fromisoformat(to_date)
        else:
            query["invoice_date"] = {"$lte": datetime.fromisoformat(to_date)}
    
    invoices = await db.invoices.find(query, {"_id": 0}).sort("invoice_date", -1).to_list(10000)
    
    # Enrich with items
    for invoice in invoices:
        items = await db.invoice_items.find({"invoice_id": invoice["invoice_id"]}, {"_id": 0}).to_list(100)
        invoice["items"] = items
    
    return invoices

@finance_router.get("/exports/payslips")
async def export_payslips(month: Optional[int] = None, year: Optional[int] = None):
    """Export payslips"""
    query = {"is_deleted": False}
    if month:
        query["month"] = month
    if year:
        query["year"] = year
    
    payslips = await db.payslips.find(query, {"_id": 0}).to_list(10000)
    return payslips
