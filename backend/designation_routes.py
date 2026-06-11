"""
Designation Management Routes
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone
from bson import ObjectId
import uuid

designation_router = APIRouter(prefix="/designations", tags=["Designations"])

# Models
class DesignationCreate(BaseModel):
    title: str
    description: Optional[str] = ""
    roles_responsibilities: Optional[str] = ""
    reporting_to: Optional[List[str]] = []
    module_access: Optional[List[str]] = []
    approval_departments: Optional[List[str]] = []
    approval_stages: Optional[List[str]] = []
    # Operations module sub-options
    operations_my_tasks: Optional[bool] = True
    operations_assign_to_team: Optional[bool] = False
    operations_departments: Optional[List[str]] = []
    operations_approval_queue: Optional[str] = None  # 'pm' | 'operations' | 'ceo'
    # NEW: Per-sub-tab access (Feb 2026)
    operations_projects: Optional[str] = "none"   # 'none' | 'view' | 'edit'
    operations_departments_tab: Optional[bool] = False
    operations_approvals_tab: Optional[bool] = False
    operations_meetings_tab: Optional[bool] = False

class DesignationUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    roles_responsibilities: Optional[str] = None
    reporting_to: Optional[List[str]] = None
    module_access: Optional[List[str]] = None
    approval_departments: Optional[List[str]] = None
    approval_stages: Optional[List[str]] = None
    operations_my_tasks: Optional[bool] = None
    operations_assign_to_team: Optional[bool] = None
    operations_departments: Optional[List[str]] = None
    operations_approval_queue: Optional[str] = None
    # NEW: Per-sub-tab access (Feb 2026)
    operations_projects: Optional[str] = None
    operations_departments_tab: Optional[bool] = None
    operations_approvals_tab: Optional[bool] = None
    operations_meetings_tab: Optional[bool] = None

# Dependency to get DB
async def get_db():
    from server import db
    return db

# Get all designations with employee count
@designation_router.get("/")
async def get_designations(db=Depends(get_db)):
    try:
        designations = await db.designations.find({}, {"_id": 0}).to_list(1000)
        
        # Add employee count for each designation
        for designation in designations:
            count = await db.users.count_documents({"designation": designation["title"]})
            designation["employee_count"] = count
        
        return designations
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Get single designation
@designation_router.get("/{designation_id}")
async def get_designation(designation_id: str, db=Depends(get_db)):
    try:
        designation = await db.designations.find_one(
            {"designation_id": designation_id}, 
            {"_id": 0}
        )
        if not designation:
            raise HTTPException(status_code=404, detail="Designation not found")
        return designation
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Create designation
@designation_router.post("/")
async def create_designation(data: DesignationCreate, db=Depends(get_db)):
    try:
        # Check if title already exists
        existing = await db.designations.find_one({"title": data.title})
        if existing:
            raise HTTPException(status_code=400, detail="Designation with this title already exists")
        
        designation = {
            "designation_id": f"desg_{uuid.uuid4().hex[:12]}",
            "title": data.title,
            "description": data.description or "",
            "roles_responsibilities": data.roles_responsibilities or "",
            "reporting_to": data.reporting_to or [],
            "module_access": data.module_access or [],
            "approval_departments": data.approval_departments or [],
            "approval_stages": data.approval_stages or [],
            "operations_my_tasks": data.operations_my_tasks if data.operations_my_tasks is not None else True,
            "operations_assign_to_team": bool(data.operations_assign_to_team),
            "operations_departments": data.operations_departments or [],
            "operations_approval_queue": data.operations_approval_queue,
            # NEW per-sub-tab access (defaults — locked out unless admin explicitly grants)
            "operations_projects": (data.operations_projects or "none"),
            "operations_departments_tab": bool(data.operations_departments_tab),
            "operations_approvals_tab": bool(data.operations_approvals_tab),
            "operations_meetings_tab": bool(data.operations_meetings_tab),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.designations.insert_one(designation)
        del designation["_id"]
        
        return {"message": "Designation created successfully", "designation": designation}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Update designation
@designation_router.put("/{designation_id}")
async def update_designation(designation_id: str, data: DesignationUpdate, db=Depends(get_db)):
    try:
        existing = await db.designations.find_one({"designation_id": designation_id})
        if not existing:
            raise HTTPException(status_code=404, detail="Designation not found")
        
        update_data = {}
        if data.title is not None:
            update_data["title"] = data.title
        if data.description is not None:
            update_data["description"] = data.description
        if data.roles_responsibilities is not None:
            update_data["roles_responsibilities"] = data.roles_responsibilities
        if data.reporting_to is not None:
            update_data["reporting_to"] = data.reporting_to
        if data.module_access is not None:
            update_data["module_access"] = data.module_access
        if data.approval_departments is not None:
            update_data["approval_departments"] = data.approval_departments
        if data.approval_stages is not None:
            update_data["approval_stages"] = data.approval_stages
        if data.operations_my_tasks is not None:
            update_data["operations_my_tasks"] = data.operations_my_tasks
        if data.operations_assign_to_team is not None:
            update_data["operations_assign_to_team"] = data.operations_assign_to_team
        if data.operations_departments is not None:
            update_data["operations_departments"] = data.operations_departments
        if data.operations_approval_queue is not None:
            update_data["operations_approval_queue"] = data.operations_approval_queue
        # NEW per-sub-tab access updates
        if data.operations_projects is not None:
            update_data["operations_projects"] = data.operations_projects
        if data.operations_departments_tab is not None:
            update_data["operations_departments_tab"] = data.operations_departments_tab
        if data.operations_approvals_tab is not None:
            update_data["operations_approvals_tab"] = data.operations_approvals_tab
        if data.operations_meetings_tab is not None:
            update_data["operations_meetings_tab"] = data.operations_meetings_tab
        
        update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
        
        await db.designations.update_one(
            {"designation_id": designation_id},
            {"$set": update_data}
        )
        
        # If module_access was updated, update all employees with this designation
        if data.module_access is not None:
            # Use existing designation to find employees with this title
            designation_title = existing.get("title")
            # Update users who have this designation
            await db.users.update_many(
                {"designation": designation_title},
                {"$set": {"module_access": data.module_access}}
            )
            # Also update employee profiles
            await db.employee_profiles.update_many(
                {"designation": designation_title},
                {"$set": {"module_access": data.module_access}}
            )
        
        updated = await db.designations.find_one(
            {"designation_id": designation_id}, 
            {"_id": 0}
        )
        
        return {"message": "Designation updated successfully", "designation": updated, "employees_updated": True if data.module_access else False}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Delete designation
@designation_router.delete("/{designation_id}")
async def delete_designation(designation_id: str, db=Depends(get_db)):
    try:
        result = await db.designations.delete_one({"designation_id": designation_id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Designation not found")
        return {"message": "Designation deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============== DEPARTMENTS ==============
class DepartmentCreate(BaseModel):
    name: str
    description: Optional[str] = ""

class DepartmentUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None

# Get all departments
@designation_router.get("/departments/list")
async def get_departments(db=Depends(get_db)):
    try:
        departments = await db.departments.find({}, {"_id": 0}).to_list(1000)
        return departments
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Create department
@designation_router.post("/departments")
async def create_department(data: DepartmentCreate, db=Depends(get_db)):
    try:
        existing = await db.departments.find_one({"name": data.name})
        if existing:
            raise HTTPException(status_code=400, detail="Department already exists")
        
        department = {
            "department_id": f"dept_{uuid.uuid4().hex[:12]}",
            "name": data.name,
            "description": data.description or "",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.departments.insert_one(department)
        del department["_id"]
        
        return {"message": "Department created successfully", "department": department}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Delete department
@designation_router.delete("/departments/{department_id}")
async def delete_department(department_id: str, db=Depends(get_db)):
    try:
        result = await db.departments.delete_one({"department_id": department_id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Department not found")
        return {"message": "Department deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
