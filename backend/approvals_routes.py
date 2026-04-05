from fastapi import APIRouter, Request, HTTPException, Body
from datetime import datetime, timezone, timedelta
import uuid

approvals_router = APIRouter(prefix="/approvals", tags=["approvals"])

# Will be set by server.py
db = None

def set_db(database):
    global db
    db = database

async def get_current_user(request: Request):
    """Get current user from request state"""
    if not hasattr(request.state, 'user') or not request.state.user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return request.state.user

@approvals_router.get("/pending")
async def get_pending_approvals(request: Request, department: str = "", date: str = ""):
    """Get all pending approvals, optionally filtered by department and date"""
    user = await get_current_user(request)
    
    # Build query
    query = {"status": "pending"}
    
    if department:
        query["department"] = department
    
    # Filter by date if provided
    if date:
        try:
            filter_date = datetime.fromisoformat(date)
            start_of_day = filter_date.replace(hour=0, minute=0, second=0)
            end_of_day = filter_date.replace(hour=23, minute=59, second=59)
            query["submitted_at"] = {
                "$gte": start_of_day.isoformat(),
                "$lte": end_of_day.isoformat()
            }
        except:
            pass
    
    # Get approvals from centralized collection
    approvals = await db.approvals.find(
        query,
        {"_id": 0}
    ).sort("submitted_at", -1).to_list(100)
    
    # Also get website stage tasks that are waiting approval
    website_tasks = await db.website_stage_tasks.find(
        {"status": "waiting_approval"},
        {"_id": 0}
    ).to_list(100)
    
    # Convert website tasks to approval format
    for task in website_tasks:
        # Check date filter
        if date:
            task_date = task.get("submitted_at", "")[:10]
            if task_date != date:
                continue
        
        # Get project info
        project = await db.website_projects.find_one(
            {"project_id": task.get("project_id")},
            {"_id": 0, "name": 1}
        )
        
        approvals.append({
            "approval_id": task["task_id"],
            "type": "website_stage",
            "department": "website",
            "title": f"{task.get('page_name', 'Page')} - {task.get('stage', 'Stage').title()}",
            "project_name": project.get("name") if project else "Unknown Project",
            "stage": task.get("stage", "").title(),
            "link": task.get("link", ""),
            "submitted_by": task.get("submitted_by"),
            "submitted_by_name": task.get("assignee", "Unknown"),
            "submitted_at": task.get("submitted_at"),
            "priority": "normal",
            "status": "pending"
        })
    
    return approvals

@approvals_router.put("/{approval_id}/approve")
async def approve_item(approval_id: str, request: Request):
    """Approve an item"""
    user = await get_current_user(request)
    now = datetime.now(timezone.utc)
    
    # Check if it's a website stage task
    task = await db.website_stage_tasks.find_one({"task_id": approval_id})
    if task:
        # Update website stage task
        await db.website_stage_tasks.update_one(
            {"task_id": approval_id},
            {
                "$set": {
                    "status": "approved",
                    "approved_at": now.isoformat(),
                    "approved_by": user["user_id"],
                    "approved_by_name": user["name"]
                },
                "$push": {
                    "history": {
                        "action": "approved",
                        "by": user["name"],
                        "at": now.isoformat()
                    }
                }
            }
        )
        
        # Update page status
        page_id = task.get("page_id")
        stage = task.get("stage")
        if page_id and stage:
            await db.website_page_tasks.update_one(
                {"task_id": page_id},
                {"$set": {f"{stage}_status": "approved"}}
            )
        
        return {"success": True, "message": "Approved!"}
    
    # Check centralized approvals collection
    approval = await db.approvals.find_one({"approval_id": approval_id})
    if approval:
        await db.approvals.update_one(
            {"approval_id": approval_id},
            {
                "$set": {
                    "status": "approved",
                    "approved_at": now.isoformat(),
                    "approved_by": user["user_id"],
                    "approved_by_name": user["name"]
                }
            }
        )
        return {"success": True, "message": "Approved!"}
    
    raise HTTPException(status_code=404, detail="Approval not found")

@approvals_router.put("/{approval_id}/reject")
async def reject_item(approval_id: str, request: Request, data: dict = Body(...)):
    """Reject/request corrections on an item"""
    user = await get_current_user(request)
    remarks = data.get("remarks", "")
    now = datetime.now(timezone.utc)
    
    # Check if it's a website stage task
    task = await db.website_stage_tasks.find_one({"task_id": approval_id})
    if task:
        await db.website_stage_tasks.update_one(
            {"task_id": approval_id},
            {
                "$set": {
                    "status": "corrections",
                    "corrections_requested_at": now.isoformat(),
                    "corrections_by": user["user_id"]
                },
                "$push": {
                    "comments": {
                        "comment_id": f"cmt_{uuid.uuid4().hex[:8]}",
                        "content": remarks,
                        "type": "correction",
                        "author": user["name"],
                        "author_id": user["user_id"],
                        "created_at": now.isoformat()
                    },
                    "history": {
                        "action": "corrections_requested",
                        "remarks": remarks,
                        "by": user["name"],
                        "at": now.isoformat()
                    }
                }
            }
        )
        
        # Update page status
        page_id = task.get("page_id")
        stage = task.get("stage")
        if page_id and stage:
            await db.website_page_tasks.update_one(
                {"task_id": page_id},
                {"$set": {f"{stage}_status": "corrections"}}
            )
        
        return {"success": True, "message": "Sent back for corrections"}
    
    # Check centralized approvals collection
    approval = await db.approvals.find_one({"approval_id": approval_id})
    if approval:
        await db.approvals.update_one(
            {"approval_id": approval_id},
            {
                "$set": {
                    "status": "corrections",
                    "corrections_requested_at": now.isoformat(),
                    "corrections_remarks": remarks,
                    "corrections_by": user["user_id"]
                }
            }
        )
        return {"success": True, "message": "Sent back for corrections"}
    
    raise HTTPException(status_code=404, detail="Approval not found")

@approvals_router.post("/submit")
async def submit_for_approval(request: Request, data: dict = Body(...)):
    """Submit any item for approval (centralized)"""
    user = await get_current_user(request)
    now = datetime.now(timezone.utc)
    
    approval_id = f"apv_{uuid.uuid4().hex[:12]}"
    
    approval = {
        "approval_id": approval_id,
        "type": data.get("type", "general"),
        "department": data.get("department", "general"),
        "title": data.get("title", "Approval Request"),
        "description": data.get("description", ""),
        "project_id": data.get("project_id"),
        "project_name": data.get("project_name"),
        "stage": data.get("stage"),
        "link": data.get("link", ""),
        "assignee_type": data.get("assignee_type", "operations"),  # operations, project_manager, ceo
        "assignee_id": data.get("assignee_id"),
        "submitted_by": user["user_id"],
        "submitted_by_name": user["name"],
        "submitted_at": now.isoformat(),
        "priority": data.get("priority", "normal"),
        "status": "pending"
    }
    
    await db.approvals.insert_one(approval)
    
    return {"success": True, "approval_id": approval_id}
