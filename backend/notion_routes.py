"""
Notion-like Database System for Operations
Supports custom columns, inline editing, and multiple views
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import uuid

notion_router = APIRouter(prefix="/notion", tags=["Notion Database"])
db = None

def init_notion_db(database):
    global db
    db = database

# ============== MODELS ==============

class ColumnType:
    TEXT = "text"
    NUMBER = "number"
    SELECT = "select"
    MULTI_SELECT = "multi_select"
    DATE = "date"
    URL = "url"
    EMAIL = "email"
    PHONE = "phone"
    CHECKBOX = "checkbox"
    PERSON = "person"

class Column(BaseModel):
    column_id: str
    name: str
    type: str  # text, number, select, multi_select, date, url, email, phone, checkbox, person
    options: List[Dict[str, str]] = []  # For select/multi_select: [{id, name, color}]
    width: int = 200
    order: int = 0
    is_visible: bool = True

class ColumnCreate(BaseModel):
    name: str
    type: str
    options: List[Dict[str, str]] = []

class DatabaseCreate(BaseModel):
    name: str
    icon: str = "📋"
    description: str = ""
    category: str = ""  # Service-based category (Website, SEO, etc.) or custom

class ProjectCreate(BaseModel):
    name: str
    icon: str = "📁"

class RowCreate(BaseModel):
    values: Dict[str, Any] = {}
    project_id: Optional[str] = None  # Link to parent project

class GoogleDocCreate(BaseModel):
    url: str
    name: Optional[str] = None

class GoogleDocUpdate(BaseModel):
    name: Optional[str] = None

# ============== AUTH HELPER ==============

async def get_current_user(request: Request) -> dict:
    """Get current user from session token"""
    session_token = None
    
    if "session_token" in request.cookies:
        session_token = request.cookies.get("session_token")
    
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header.split(" ")[1]
    
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    session_doc = await db.user_sessions.find_one(
        {"session_token": session_token},
        {"_id": 0}
    )
    
    if not session_doc:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    expires_at = session_doc["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")
    
    user_doc = await db.users.find_one(
        {"user_id": session_doc["user_id"]},
        {"_id": 0, "password_hash": 0}
    )
    
    if not user_doc:
        raise HTTPException(status_code=401, detail="User not found")
    
    return user_doc

# ============== DATABASE ROUTES ==============

@notion_router.get("/databases")
async def get_all_databases(request: Request):
    """Get all databases"""
    await get_current_user(request)
    
    databases = await db.notion_databases.find(
        {},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return databases

@notion_router.post("/databases")
async def create_database(data: DatabaseCreate, request: Request):
    """Create a new database"""
    user = await get_current_user(request)
    
    database_id = f"db_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc)
    
    # Default columns
    default_columns = [
        {
            "column_id": f"col_{uuid.uuid4().hex[:8]}",
            "name": "Name",
            "type": "text",
            "options": [],
            "width": 250,
            "order": 0,
            "is_visible": True,
            "is_primary": True
        },
        {
            "column_id": f"col_{uuid.uuid4().hex[:8]}",
            "name": "Status",
            "type": "select",
            "options": [
                {"id": "opt_1", "name": "To Do", "color": "#71717a"},
                {"id": "opt_2", "name": "In Progress", "color": "#3b82f6"},
                {"id": "opt_3", "name": "Operations Approval", "color": "#f59e0b"},
                {"id": "opt_4", "name": "Vinoth Approval", "color": "#8b5cf6"},
                {"id": "opt_5", "name": "Client Approval", "color": "#ec4899"},
                {"id": "opt_6", "name": "Revision", "color": "#ef4444"},
                {"id": "opt_7", "name": "Done", "color": "#10b981"}
            ],
            "width": 180,
            "order": 1,
            "is_visible": True
        },
        {
            "column_id": f"col_{uuid.uuid4().hex[:8]}",
            "name": "Department",
            "type": "select",
            "options": [
                {"id": "dept_1", "name": "Website", "color": "#3b82f6"},
                {"id": "dept_2", "name": "SEO", "color": "#10b981"},
                {"id": "dept_3", "name": "Meta Ads", "color": "#8b5cf6"},
                {"id": "dept_4", "name": "Content", "color": "#f59e0b"},
                {"id": "dept_5", "name": "Design", "color": "#ec4899"},
                {"id": "dept_6", "name": "Social Media", "color": "#06b6d4"}
            ],
            "width": 140,
            "order": 2,
            "is_visible": True
        },
        {
            "column_id": f"col_{uuid.uuid4().hex[:8]}",
            "name": "Priority",
            "type": "select",
            "options": [
                {"id": "pri_1", "name": "Low", "color": "#71717a"},
                {"id": "pri_2", "name": "Medium", "color": "#f59e0b"},
                {"id": "pri_3", "name": "High", "color": "#ef4444"},
                {"id": "pri_4", "name": "Urgent", "color": "#dc2626"}
            ],
            "width": 120,
            "order": 3,
            "is_visible": True
        },
        {
            "column_id": f"col_{uuid.uuid4().hex[:8]}",
            "name": "Due Date",
            "type": "date",
            "options": [],
            "width": 150,
            "order": 4,
            "is_visible": True
        },
        {
            "column_id": f"col_{uuid.uuid4().hex[:8]}",
            "name": "Assigned To",
            "type": "person",
            "options": [],
            "width": 150,
            "order": 5,
            "is_visible": True
        }
    ]
    
    database_doc = {
        "database_id": database_id,
        "name": data.name,
        "icon": data.icon,
        "description": data.description,
        "category": data.category,
        "columns": default_columns,
        "created_by": user["user_id"],
        "created_at": now,
        "updated_at": now
    }
    
    await db.notion_databases.insert_one(database_doc)
    return await db.notion_databases.find_one({"database_id": database_id}, {"_id": 0})

@notion_router.get("/databases/{database_id}")
async def get_database(database_id: str, request: Request):
    """Get a database with its columns"""
    await get_current_user(request)
    
    database = await db.notion_databases.find_one(
        {"database_id": database_id},
        {"_id": 0}
    )
    
    if not database:
        raise HTTPException(status_code=404, detail="Database not found")
    
    return database

@notion_router.put("/databases/{database_id}")
async def update_database(database_id: str, data: Dict[str, Any], request: Request):
    """Update database properties"""
    await get_current_user(request)
    
    allowed_fields = ["name", "icon", "description", "is_pinned", "pin_order", "category", "is_favorite"]
    update_data = {k: v for k, v in data.items() if k in allowed_fields}
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    await db.notion_databases.update_one(
        {"database_id": database_id},
        {"$set": update_data}
    )
    
    return await db.notion_databases.find_one({"database_id": database_id}, {"_id": 0})

@notion_router.post("/databases/{database_id}/duplicate")
async def duplicate_database(database_id: str, request: Request):
    """Duplicate a database with all its projects and rows"""
    user = await get_current_user(request)
    
    # Get original database
    original = await db.notion_databases.find_one({"database_id": database_id})
    if not original:
        raise HTTPException(status_code=404, detail="Database not found")
    
    # Create new database
    new_database_id = f"db_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc)
    
    new_database = {
        "database_id": new_database_id,
        "name": f"{original['name']} (Copy)",
        "icon": original.get("icon", "📋"),
        "description": original.get("description", ""),
        "category": original.get("category", ""),
        "columns": original.get("columns", []),
        "created_by": user["user_id"],
        "created_at": now,
        "updated_at": now
    }
    
    await db.notion_databases.insert_one(new_database)
    
    # Duplicate projects
    projects = await db.notion_projects.find({"database_id": database_id}).to_list(100)
    project_id_map = {}
    
    for project in projects:
        new_project_id = f"proj_{uuid.uuid4().hex[:12]}"
        project_id_map[project["project_id"]] = new_project_id
        
        new_project = {
            "project_id": new_project_id,
            "database_id": new_database_id,
            "name": project["name"],
            "icon": project.get("icon", "📁"),
            "order": project.get("order", 0),
            "created_at": now,
            "updated_at": now
        }
        await db.notion_projects.insert_one(new_project)
    
    # Duplicate rows
    rows = await db.notion_rows.find({"database_id": database_id}).to_list(1000)
    for row in rows:
        new_row_id = f"row_{uuid.uuid4().hex[:12]}"
        old_project_id = row.get("project_id")
        new_project_id = project_id_map.get(old_project_id) if old_project_id else None
        
        new_row = {
            "row_id": new_row_id,
            "database_id": new_database_id,
            "project_id": new_project_id,
            "values": row.get("values", {}),
            "created_by": user["user_id"],
            "created_at": now,
            "updated_at": now
        }
        await db.notion_rows.insert_one(new_row)
    
    return await db.notion_databases.find_one({"database_id": new_database_id}, {"_id": 0})

@notion_router.put("/databases/{database_id}/pin")
async def toggle_pin_database(database_id: str, request: Request):
    """Toggle pin status of a database"""
    await get_current_user(request)
    
    database = await db.notion_databases.find_one({"database_id": database_id})
    if not database:
        raise HTTPException(status_code=404, detail="Database not found")
    
    is_currently_pinned = database.get("is_pinned", False)
    
    if not is_currently_pinned:
        # Check if already have 5 pinned
        pinned_count = await db.notion_databases.count_documents({"is_pinned": True})
        if pinned_count >= 5:
            raise HTTPException(status_code=400, detail="Maximum 5 databases can be pinned")
        
        # Get next pin order
        max_order = 0
        pinned_dbs = await db.notion_databases.find({"is_pinned": True}).to_list(5)
        if pinned_dbs:
            max_order = max([d.get("pin_order", 0) for d in pinned_dbs])
        
        await db.notion_databases.update_one(
            {"database_id": database_id},
            {"$set": {"is_pinned": True, "pin_order": max_order + 1}}
        )
    else:
        await db.notion_databases.update_one(
            {"database_id": database_id},
            {"$set": {"is_pinned": False, "pin_order": 0}}
        )
    
    return await db.notion_databases.find_one({"database_id": database_id}, {"_id": 0})

@notion_router.delete("/databases/{database_id}")
async def delete_database(database_id: str, request: Request):
    """Delete a database and all its rows and projects"""
    await get_current_user(request)
    
    await db.notion_databases.delete_one({"database_id": database_id})
    await db.notion_rows.delete_many({"database_id": database_id})
    await db.notion_projects.delete_many({"database_id": database_id})
    
    return {"message": "Database deleted"}

# ============== PROJECT ROUTES (Groups within databases) ==============

@notion_router.get("/databases/{database_id}/projects")
async def get_projects(database_id: str, request: Request):
    """Get all projects in a database"""
    await get_current_user(request)
    
    projects = await db.notion_projects.find(
        {"database_id": database_id},
        {"_id": 0}
    ).sort("order", 1).to_list(100)
    
    return projects

@notion_router.post("/databases/{database_id}/projects")
async def create_project(database_id: str, data: ProjectCreate, request: Request):
    """Create a new project/group within a database"""
    user = await get_current_user(request)
    
    # Verify database exists
    database = await db.notion_databases.find_one({"database_id": database_id})
    if not database:
        raise HTTPException(status_code=404, detail="Database not found")
    
    project_id = f"proj_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc)
    
    # Get max order
    max_order = 0
    existing = await db.notion_projects.find({"database_id": database_id}).sort("order", -1).limit(1).to_list(1)
    if existing:
        max_order = existing[0].get("order", 0)
    
    project_doc = {
        "project_id": project_id,
        "database_id": database_id,
        "name": data.name,
        "icon": data.icon,
        "order": max_order + 1,
        "created_by": user["user_id"],
        "created_at": now,
        "updated_at": now
    }
    
    await db.notion_projects.insert_one(project_doc)
    return await db.notion_projects.find_one({"project_id": project_id}, {"_id": 0})

@notion_router.put("/databases/{database_id}/projects/{project_id}")
async def update_project(database_id: str, project_id: str, data: Dict[str, Any], request: Request):
    """Update a project"""
    await get_current_user(request)
    
    allowed_fields = ["name", "icon", "order"]
    update_data = {k: v for k, v in data.items() if k in allowed_fields}
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    await db.notion_projects.update_one(
        {"project_id": project_id, "database_id": database_id},
        {"$set": update_data}
    )
    
    return await db.notion_projects.find_one({"project_id": project_id}, {"_id": 0})

@notion_router.delete("/databases/{database_id}/projects/{project_id}")
async def delete_project(database_id: str, project_id: str, request: Request):
    """Delete a project and optionally its tasks"""
    await get_current_user(request)
    
    # Delete the project
    await db.notion_projects.delete_one({"project_id": project_id, "database_id": database_id})
    
    # Update tasks to have no project (move to ungrouped)
    await db.notion_rows.update_many(
        {"database_id": database_id, "project_id": project_id},
        {"$set": {"project_id": None}}
    )
    
    return {"message": "Project deleted"}

# ============== COLUMN ROUTES ==============

@notion_router.post("/databases/{database_id}/columns")
async def add_column(database_id: str, data: ColumnCreate, request: Request):
    """Add a new column to database"""
    await get_current_user(request)
    
    database = await db.notion_databases.find_one({"database_id": database_id})
    if not database:
        raise HTTPException(status_code=404, detail="Database not found")
    
    columns = database.get("columns", [])
    max_order = max([c.get("order", 0) for c in columns], default=-1)
    
    new_column = {
        "column_id": f"col_{uuid.uuid4().hex[:8]}",
        "name": data.name,
        "type": data.type,
        "options": data.options,
        "width": 200,
        "order": max_order + 1,
        "is_visible": True
    }
    
    await db.notion_databases.update_one(
        {"database_id": database_id},
        {
            "$push": {"columns": new_column},
            "$set": {"updated_at": datetime.now(timezone.utc)}
        }
    )
    
    return new_column

@notion_router.put("/databases/{database_id}/columns/{column_id}")
async def update_column(database_id: str, column_id: str, data: Dict[str, Any], request: Request):
    """Update a column"""
    await get_current_user(request)
    
    database = await db.notion_databases.find_one({"database_id": database_id})
    if not database:
        raise HTTPException(status_code=404, detail="Database not found")
    
    columns = database.get("columns", [])
    for i, col in enumerate(columns):
        if col["column_id"] == column_id:
            for key, value in data.items():
                if key in ["name", "type", "options", "width", "order", "is_visible"]:
                    columns[i][key] = value
            break
    
    await db.notion_databases.update_one(
        {"database_id": database_id},
        {
            "$set": {
                "columns": columns,
                "updated_at": datetime.now(timezone.utc)
            }
        }
    )
    
    return {"message": "Column updated"}

@notion_router.delete("/databases/{database_id}/columns/{column_id}")
async def delete_column(database_id: str, column_id: str, request: Request):
    """Delete a column"""
    await get_current_user(request)
    
    await db.notion_databases.update_one(
        {"database_id": database_id},
        {
            "$pull": {"columns": {"column_id": column_id}},
            "$set": {"updated_at": datetime.now(timezone.utc)}
        }
    )
    
    # Remove column data from all rows
    await db.notion_rows.update_many(
        {"database_id": database_id},
        {"$unset": {f"values.{column_id}": ""}}
    )
    
    return {"message": "Column deleted"}

@notion_router.put("/databases/{database_id}/columns/reorder")
async def reorder_columns(database_id: str, column_orders: List[Dict[str, Any]], request: Request):
    """Reorder columns"""
    await get_current_user(request)
    
    database = await db.notion_databases.find_one({"database_id": database_id})
    if not database:
        raise HTTPException(status_code=404, detail="Database not found")
    
    columns = database.get("columns", [])
    order_map = {item["column_id"]: item["order"] for item in column_orders}
    
    for col in columns:
        if col["column_id"] in order_map:
            col["order"] = order_map[col["column_id"]]
    
    columns.sort(key=lambda x: x.get("order", 0))
    
    await db.notion_databases.update_one(
        {"database_id": database_id},
        {"$set": {"columns": columns, "updated_at": datetime.now(timezone.utc)}}
    )
    
    return {"message": "Columns reordered"}

# ============== ROW ROUTES ==============

@notion_router.get("/databases/{database_id}/rows")
async def get_rows(
    database_id: str, 
    request: Request,
    group_by: Optional[str] = None,
    sort_by: Optional[str] = None,
    sort_order: str = "asc",
    filter_column: Optional[str] = None,
    filter_value: Optional[str] = None
):
    """Get all rows from a database"""
    await get_current_user(request)
    
    query = {"database_id": database_id}
    
    # Apply filter
    if filter_column and filter_value:
        query[f"values.{filter_column}"] = {"$regex": filter_value, "$options": "i"}
    
    # Determine sort
    sort_field = "created_at"
    sort_direction = 1 if sort_order == "asc" else -1
    if sort_by:
        sort_field = f"values.{sort_by}"
    
    rows = await db.notion_rows.find(
        query,
        {"_id": 0}
    ).sort(sort_field, sort_direction).to_list(1000)
    
    # Group if requested
    if group_by:
        grouped = {}
        for row in rows:
            group_value = row.get("values", {}).get(group_by, "Ungrouped")
            if isinstance(group_value, dict):
                group_value = group_value.get("name", "Ungrouped")
            if group_value not in grouped:
                grouped[group_value] = []
            grouped[group_value].append(row)
        return {"grouped": True, "groups": grouped}
    
    return {"grouped": False, "rows": rows}

@notion_router.post("/databases/{database_id}/rows")
async def create_row(database_id: str, data: RowCreate, request: Request):
    """Create a new row"""
    user = await get_current_user(request)
    
    database = await db.notion_databases.find_one({"database_id": database_id})
    if not database:
        raise HTTPException(status_code=404, detail="Database not found")
    
    row_id = f"row_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc)
    
    row_doc = {
        "row_id": row_id,
        "database_id": database_id,
        "project_id": data.project_id,  # Link to project/group
        "values": data.values,
        "created_by": user["user_id"],
        "created_at": now,
        "updated_at": now
    }
    
    await db.notion_rows.insert_one(row_doc)
    return await db.notion_rows.find_one({"row_id": row_id}, {"_id": 0})

@notion_router.put("/databases/{database_id}/rows/{row_id}/project")
async def update_row_project(database_id: str, row_id: str, data: Dict[str, Any], request: Request):
    """Move a row to a different project"""
    await get_current_user(request)
    
    project_id = data.get("project_id")  # Can be null to move to ungrouped
    
    await db.notion_rows.update_one(
        {"row_id": row_id, "database_id": database_id},
        {"$set": {"project_id": project_id, "updated_at": datetime.now(timezone.utc)}}
    )
    
    return await db.notion_rows.find_one({"row_id": row_id}, {"_id": 0})

@notion_router.put("/databases/{database_id}/rows/{row_id}")
async def update_row(database_id: str, row_id: str, data: Dict[str, Any], request: Request):
    """Update a row's values"""
    await get_current_user(request)
    
    # Build update for specific values
    update_set = {"updated_at": datetime.now(timezone.utc)}
    for key, value in data.get("values", {}).items():
        update_set[f"values.{key}"] = value
    
    await db.notion_rows.update_one(
        {"row_id": row_id, "database_id": database_id},
        {"$set": update_set}
    )
    
    return await db.notion_rows.find_one({"row_id": row_id}, {"_id": 0})

@notion_router.put("/databases/{database_id}/rows/{row_id}/cell")
async def update_cell(database_id: str, row_id: str, data: Dict[str, Any], request: Request):
    """Update a single cell value"""
    await get_current_user(request)
    
    column_id = data.get("column_id")
    value = data.get("value")
    
    if not column_id:
        raise HTTPException(status_code=400, detail="column_id required")
    
    await db.notion_rows.update_one(
        {"row_id": row_id, "database_id": database_id},
        {"$set": {
            f"values.{column_id}": value,
            "updated_at": datetime.now(timezone.utc)
        }}
    )
    
    return await db.notion_rows.find_one({"row_id": row_id}, {"_id": 0})

@notion_router.delete("/databases/{database_id}/rows/{row_id}")
async def delete_row(database_id: str, row_id: str, request: Request):
    """Delete a row"""
    await get_current_user(request)
    
    await db.notion_rows.delete_one({"row_id": row_id, "database_id": database_id})
    return {"message": "Row deleted"}

@notion_router.post("/databases/{database_id}/rows/bulk-delete")
async def bulk_delete_rows(database_id: str, data: Dict[str, Any], request: Request):
    """Delete multiple rows"""
    await get_current_user(request)
    
    row_ids = data.get("row_ids", [])
    if not row_ids:
        raise HTTPException(status_code=400, detail="row_ids required")
    
    await db.notion_rows.delete_many({
        "database_id": database_id,
        "row_id": {"$in": row_ids}
    })
    
    return {"message": f"Deleted {len(row_ids)} rows"}

# ============== TEMPLATE ROUTES ==============

@notion_router.get("/templates")
async def get_templates(request: Request):
    """Get available database templates"""
    await get_current_user(request)
    
    templates = [
        {
            "id": "project_tracker",
            "name": "Project Tracker",
            "icon": "📊",
            "description": "Track projects with status, priority, and deadlines",
            "columns": [
                {"name": "Project Name", "type": "text"},
                {"name": "Client", "type": "text"},
                {"name": "Status", "type": "select", "options": [
                    {"name": "Planning", "color": "#71717a"},
                    {"name": "In Progress", "color": "#3b82f6"},
                    {"name": "Review", "color": "#f59e0b"},
                    {"name": "Completed", "color": "#10b981"}
                ]},
                {"name": "Priority", "type": "select", "options": [
                    {"name": "Low", "color": "#71717a"},
                    {"name": "Medium", "color": "#f59e0b"},
                    {"name": "High", "color": "#ef4444"}
                ]},
                {"name": "Due Date", "type": "date"},
                {"name": "Assignee", "type": "person"},
                {"name": "Budget", "type": "number"}
            ]
        },
        {
            "id": "task_list",
            "name": "Task List",
            "icon": "✅",
            "description": "Simple task management with checkboxes",
            "columns": [
                {"name": "Task", "type": "text"},
                {"name": "Done", "type": "checkbox"},
                {"name": "Due Date", "type": "date"},
                {"name": "Priority", "type": "select", "options": [
                    {"name": "Low", "color": "#71717a"},
                    {"name": "Medium", "color": "#f59e0b"},
                    {"name": "High", "color": "#ef4444"}
                ]}
            ]
        },
        {
            "id": "client_directory",
            "name": "Client Directory",
            "icon": "👥",
            "description": "Manage client contacts and information",
            "columns": [
                {"name": "Name", "type": "text"},
                {"name": "Company", "type": "text"},
                {"name": "Email", "type": "email"},
                {"name": "Phone", "type": "phone"},
                {"name": "Website", "type": "url"},
                {"name": "Status", "type": "select", "options": [
                    {"name": "Lead", "color": "#71717a"},
                    {"name": "Active", "color": "#10b981"},
                    {"name": "Inactive", "color": "#ef4444"}
                ]}
            ]
        },
        {
            "id": "content_calendar",
            "name": "Content Calendar",
            "icon": "📅",
            "description": "Plan and track content across platforms",
            "columns": [
                {"name": "Title", "type": "text"},
                {"name": "Platform", "type": "multi_select", "options": [
                    {"name": "Instagram", "color": "#e11d48"},
                    {"name": "Facebook", "color": "#3b82f6"},
                    {"name": "LinkedIn", "color": "#0077b5"},
                    {"name": "Twitter", "color": "#1da1f2"},
                    {"name": "YouTube", "color": "#ff0000"}
                ]},
                {"name": "Type", "type": "select", "options": [
                    {"name": "Post", "color": "#10b981"},
                    {"name": "Story", "color": "#8b5cf6"},
                    {"name": "Reel", "color": "#f59e0b"},
                    {"name": "Video", "color": "#ef4444"}
                ]},
                {"name": "Publish Date", "type": "date"},
                {"name": "Status", "type": "select", "options": [
                    {"name": "Idea", "color": "#71717a"},
                    {"name": "Writing", "color": "#3b82f6"},
                    {"name": "Review", "color": "#f59e0b"},
                    {"name": "Scheduled", "color": "#8b5cf6"},
                    {"name": "Published", "color": "#10b981"}
                ]}
            ]
        },
        {
            "id": "service_catalog",
            "name": "Service Catalog",
            "icon": "🛠️",
            "description": "Track services with pricing and URLs",
            "columns": [
                {"name": "Service Name", "type": "text"},
                {"name": "Category", "type": "select", "options": [
                    {"name": "Web Development", "color": "#3b82f6"},
                    {"name": "Design", "color": "#8b5cf6"},
                    {"name": "Marketing", "color": "#10b981"},
                    {"name": "SEO", "color": "#f59e0b"}
                ]},
                {"name": "Price", "type": "number"},
                {"name": "URL", "type": "url"},
                {"name": "Active", "type": "checkbox"}
            ]
        },
        {
            "id": "dm_task_board",
            "name": "Digital Marketing Board",
            "icon": "🎯",
            "description": "Task management with approval workflow for digital marketing teams",
            "columns": [
                {"name": "Task Name", "type": "text"},
                {"name": "Department", "type": "select", "options": [
                    {"name": "Website", "color": "#3b82f6"},
                    {"name": "SEO", "color": "#10b981"},
                    {"name": "Meta Ads", "color": "#8b5cf6"},
                    {"name": "Content", "color": "#f59e0b"},
                    {"name": "Design", "color": "#ec4899"},
                    {"name": "Social Media", "color": "#06b6d4"}
                ]},
                {"name": "Status", "type": "select", "options": [
                    {"name": "To Do", "color": "#71717a"},
                    {"name": "In Progress", "color": "#3b82f6"},
                    {"name": "Operations Approval", "color": "#f59e0b"},
                    {"name": "Vinoth Approval", "color": "#8b5cf6"},
                    {"name": "Client Approval", "color": "#ec4899"},
                    {"name": "Revision", "color": "#ef4444"},
                    {"name": "Done", "color": "#10b981"}
                ]},
                {"name": "Priority", "type": "select", "options": [
                    {"name": "Low", "color": "#71717a"},
                    {"name": "Medium", "color": "#f59e0b"},
                    {"name": "High", "color": "#ef4444"},
                    {"name": "Urgent", "color": "#dc2626"}
                ]},
                {"name": "Due Date", "type": "date"},
                {"name": "Assigned To", "type": "person"},
                {"name": "Assigned By", "type": "person"},
                {"name": "Client", "type": "text"},
                {"name": "Attachments", "type": "url"},
                {"name": "Revision Notes", "type": "text"}
            ]
        }
    ]
    
    return templates

@notion_router.post("/databases/from-template/{template_id}")
async def create_from_template(template_id: str, data: Dict[str, Any], request: Request):
    """Create a database from template"""
    user = await get_current_user(request)
    
    templates = {
        "project_tracker": {
            "name": data.get("name", "Project Tracker"),
            "icon": "📊",
            "columns": [
                {"name": "Project Name", "type": "text", "is_primary": True},
                {"name": "Client", "type": "text"},
                {"name": "Status", "type": "select", "options": [
                    {"id": f"opt_{uuid.uuid4().hex[:6]}", "name": "Planning", "color": "#71717a"},
                    {"id": f"opt_{uuid.uuid4().hex[:6]}", "name": "In Progress", "color": "#3b82f6"},
                    {"id": f"opt_{uuid.uuid4().hex[:6]}", "name": "Review", "color": "#f59e0b"},
                    {"id": f"opt_{uuid.uuid4().hex[:6]}", "name": "Completed", "color": "#10b981"}
                ]},
                {"name": "Priority", "type": "select", "options": [
                    {"id": f"opt_{uuid.uuid4().hex[:6]}", "name": "Low", "color": "#71717a"},
                    {"id": f"opt_{uuid.uuid4().hex[:6]}", "name": "Medium", "color": "#f59e0b"},
                    {"id": f"opt_{uuid.uuid4().hex[:6]}", "name": "High", "color": "#ef4444"}
                ]},
                {"name": "Due Date", "type": "date"},
                {"name": "Assignee", "type": "person"},
                {"name": "Budget", "type": "number"}
            ]
        },
        "task_list": {
            "name": data.get("name", "Task List"),
            "icon": "✅",
            "columns": [
                {"name": "Task", "type": "text", "is_primary": True},
                {"name": "Done", "type": "checkbox"},
                {"name": "Due Date", "type": "date"},
                {"name": "Priority", "type": "select", "options": [
                    {"id": f"opt_{uuid.uuid4().hex[:6]}", "name": "Low", "color": "#71717a"},
                    {"id": f"opt_{uuid.uuid4().hex[:6]}", "name": "Medium", "color": "#f59e0b"},
                    {"id": f"opt_{uuid.uuid4().hex[:6]}", "name": "High", "color": "#ef4444"}
                ]}
            ]
        },
        "client_directory": {
            "name": data.get("name", "Client Directory"),
            "icon": "👥",
            "columns": [
                {"name": "Name", "type": "text", "is_primary": True},
                {"name": "Company", "type": "text"},
                {"name": "Email", "type": "email"},
                {"name": "Phone", "type": "phone"},
                {"name": "Website", "type": "url"},
                {"name": "Status", "type": "select", "options": [
                    {"id": f"opt_{uuid.uuid4().hex[:6]}", "name": "Lead", "color": "#71717a"},
                    {"id": f"opt_{uuid.uuid4().hex[:6]}", "name": "Active", "color": "#10b981"},
                    {"id": f"opt_{uuid.uuid4().hex[:6]}", "name": "Inactive", "color": "#ef4444"}
                ]}
            ]
        },
        "content_calendar": {
            "name": data.get("name", "Content Calendar"),
            "icon": "📅",
            "columns": [
                {"name": "Title", "type": "text", "is_primary": True},
                {"name": "Platform", "type": "multi_select", "options": [
                    {"id": f"opt_{uuid.uuid4().hex[:6]}", "name": "Instagram", "color": "#e11d48"},
                    {"id": f"opt_{uuid.uuid4().hex[:6]}", "name": "Facebook", "color": "#3b82f6"},
                    {"id": f"opt_{uuid.uuid4().hex[:6]}", "name": "LinkedIn", "color": "#0077b5"},
                    {"id": f"opt_{uuid.uuid4().hex[:6]}", "name": "Twitter", "color": "#1da1f2"},
                    {"id": f"opt_{uuid.uuid4().hex[:6]}", "name": "YouTube", "color": "#ff0000"}
                ]},
                {"name": "Type", "type": "select", "options": [
                    {"id": f"opt_{uuid.uuid4().hex[:6]}", "name": "Post", "color": "#10b981"},
                    {"id": f"opt_{uuid.uuid4().hex[:6]}", "name": "Story", "color": "#8b5cf6"},
                    {"id": f"opt_{uuid.uuid4().hex[:6]}", "name": "Reel", "color": "#f59e0b"},
                    {"id": f"opt_{uuid.uuid4().hex[:6]}", "name": "Video", "color": "#ef4444"}
                ]},
                {"name": "Publish Date", "type": "date"},
                {"name": "Status", "type": "select", "options": [
                    {"id": f"opt_{uuid.uuid4().hex[:6]}", "name": "Idea", "color": "#71717a"},
                    {"id": f"opt_{uuid.uuid4().hex[:6]}", "name": "Writing", "color": "#3b82f6"},
                    {"id": f"opt_{uuid.uuid4().hex[:6]}", "name": "Review", "color": "#f59e0b"},
                    {"id": f"opt_{uuid.uuid4().hex[:6]}", "name": "Scheduled", "color": "#8b5cf6"},
                    {"id": f"opt_{uuid.uuid4().hex[:6]}", "name": "Published", "color": "#10b981"}
                ]}
            ]
        },
        "service_catalog": {
            "name": data.get("name", "Service Catalog"),
            "icon": "🛠️",
            "columns": [
                {"name": "Service Name", "type": "text", "is_primary": True},
                {"name": "Category", "type": "select", "options": [
                    {"id": f"opt_{uuid.uuid4().hex[:6]}", "name": "Web Development", "color": "#3b82f6"},
                    {"id": f"opt_{uuid.uuid4().hex[:6]}", "name": "Design", "color": "#8b5cf6"},
                    {"id": f"opt_{uuid.uuid4().hex[:6]}", "name": "Marketing", "color": "#10b981"},
                    {"id": f"opt_{uuid.uuid4().hex[:6]}", "name": "SEO", "color": "#f59e0b"}
                ]},
                {"name": "Price", "type": "number"},
                {"name": "URL", "type": "url"},
                {"name": "Active", "type": "checkbox"}
            ]
        },
        "dm_task_board": {
            "name": data.get("name", "Digital Marketing Board"),
            "icon": "🎯",
            "columns": [
                {"name": "Task Name", "type": "text", "is_primary": True},
                {"name": "Department", "type": "select", "options": [
                    {"id": f"opt_{uuid.uuid4().hex[:6]}", "name": "Website", "color": "#3b82f6"},
                    {"id": f"opt_{uuid.uuid4().hex[:6]}", "name": "SEO", "color": "#10b981"},
                    {"id": f"opt_{uuid.uuid4().hex[:6]}", "name": "Meta Ads", "color": "#8b5cf6"},
                    {"id": f"opt_{uuid.uuid4().hex[:6]}", "name": "Content", "color": "#f59e0b"},
                    {"id": f"opt_{uuid.uuid4().hex[:6]}", "name": "Design", "color": "#ec4899"},
                    {"id": f"opt_{uuid.uuid4().hex[:6]}", "name": "Social Media", "color": "#06b6d4"}
                ]},
                {"name": "Status", "type": "select", "options": [
                    {"id": f"opt_{uuid.uuid4().hex[:6]}", "name": "To Do", "color": "#71717a"},
                    {"id": f"opt_{uuid.uuid4().hex[:6]}", "name": "In Progress", "color": "#3b82f6"},
                    {"id": f"opt_{uuid.uuid4().hex[:6]}", "name": "Operations Approval", "color": "#f59e0b"},
                    {"id": f"opt_{uuid.uuid4().hex[:6]}", "name": "Vinoth Approval", "color": "#8b5cf6"},
                    {"id": f"opt_{uuid.uuid4().hex[:6]}", "name": "Client Approval", "color": "#ec4899"},
                    {"id": f"opt_{uuid.uuid4().hex[:6]}", "name": "Revision", "color": "#ef4444"},
                    {"id": f"opt_{uuid.uuid4().hex[:6]}", "name": "Done", "color": "#10b981"}
                ]},
                {"name": "Priority", "type": "select", "options": [
                    {"id": f"opt_{uuid.uuid4().hex[:6]}", "name": "Low", "color": "#71717a"},
                    {"id": f"opt_{uuid.uuid4().hex[:6]}", "name": "Medium", "color": "#f59e0b"},
                    {"id": f"opt_{uuid.uuid4().hex[:6]}", "name": "High", "color": "#ef4444"},
                    {"id": f"opt_{uuid.uuid4().hex[:6]}", "name": "Urgent", "color": "#dc2626"}
                ]},
                {"name": "Due Date", "type": "date"},
                {"name": "Assigned To", "type": "person"},
                {"name": "Client", "type": "text"},
                {"name": "Attachments", "type": "url"},
                {"name": "Revision Notes", "type": "text"}
            ]
        }
    }
    
    template = templates.get(template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    database_id = f"db_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc)
    
    # Build columns with IDs
    columns = []
    for i, col in enumerate(template["columns"]):
        columns.append({
            "column_id": f"col_{uuid.uuid4().hex[:8]}",
            "name": col["name"],
            "type": col["type"],
            "options": col.get("options", []),
            "width": 200 if col["type"] != "text" else 250,
            "order": i,
            "is_visible": True,
            "is_primary": col.get("is_primary", False)
        })
    
    database_doc = {
        "database_id": database_id,
        "name": template["name"],
        "icon": template["icon"],
        "description": "",
        "columns": columns,
        "created_by": user["user_id"],
        "created_at": now,
        "updated_at": now
    }
    
    await db.notion_databases.insert_one(database_doc)
    return await db.notion_databases.find_one({"database_id": database_id}, {"_id": 0})

# ============== USERS FOR PERSON FIELD ==============

@notion_router.get("/users")
async def get_users_for_assignment(request: Request):
    """Get list of users for person field"""
    await get_current_user(request)
    
    users = await db.users.find(
        {"is_active": True},
        {"_id": 0, "user_id": 1, "name": 1, "email": 1, "role": 1}
    ).to_list(100)
    
    return users

# ============== GOOGLE DOCS/SHEETS INTEGRATION ==============

def parse_google_url(url: str) -> dict:
    """Parse Google Docs/Sheets URL to extract file ID and type"""
    import re
    
    # Google Sheets patterns
    sheets_patterns = [
        r'docs\.google\.com/spreadsheets/d/([a-zA-Z0-9_-]+)',
        r'sheets\.google\.com/.*?/d/([a-zA-Z0-9_-]+)',
    ]
    
    # Google Docs patterns
    docs_patterns = [
        r'docs\.google\.com/document/d/([a-zA-Z0-9_-]+)',
    ]
    
    for pattern in sheets_patterns:
        match = re.search(pattern, url)
        if match:
            return {"file_id": match.group(1), "type": "sheet"}
    
    for pattern in docs_patterns:
        match = re.search(pattern, url)
        if match:
            return {"file_id": match.group(1), "type": "doc"}
    
    return None

@notion_router.get("/projects/{project_id}/documents")
async def get_project_documents(project_id: str, request: Request):
    """Get all Google Docs/Sheets attached to a project"""
    await get_current_user(request)
    
    documents = await db.project_documents.find(
        {"project_id": project_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return documents

@notion_router.post("/projects/{project_id}/documents")
async def add_project_document(project_id: str, data: GoogleDocCreate, request: Request):
    """Add a Google Doc/Sheet to a project"""
    user = await get_current_user(request)
    
    # Verify project exists
    project = await db.notion_projects.find_one({"project_id": project_id})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Parse URL
    parsed = parse_google_url(data.url)
    if not parsed:
        raise HTTPException(status_code=400, detail="Invalid Google Docs/Sheets URL")
    
    # Check if already added
    existing = await db.project_documents.find_one({
        "project_id": project_id,
        "file_id": parsed["file_id"]
    })
    if existing:
        raise HTTPException(status_code=400, detail="Document already added to this project")
    
    doc_id = f"gdoc_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc)
    
    # Generate embed URL
    if parsed["type"] == "sheet":
        embed_url = f"https://docs.google.com/spreadsheets/d/{parsed['file_id']}/edit?usp=sharing&rm=minimal"
    else:
        embed_url = f"https://docs.google.com/document/d/{parsed['file_id']}/edit?usp=sharing&rm=minimal"
    
    doc_record = {
        "doc_id": doc_id,
        "project_id": project_id,
        "file_id": parsed["file_id"],
        "file_type": parsed["type"],
        "name": data.name or f"{'Sheet' if parsed['type'] == 'sheet' else 'Doc'} - {parsed['file_id'][:8]}",
        "url": data.url,
        "embed_url": embed_url,
        "created_by": user["user_id"],
        "created_by_name": user.get("name", "Unknown"),
        "created_at": now
    }
    
    await db.project_documents.insert_one(doc_record)
    
    # Log activity
    activity_doc = {
        "activity_id": f"act_{uuid.uuid4().hex[:12]}",
        "project_id": project_id,
        "type": "document_added",
        "description": f"Added {parsed['type']} document: {doc_record['name']}",
        "user_id": user["user_id"],
        "user_name": user.get("name", "Unknown"),
        "metadata": {"doc_id": doc_id, "file_type": parsed["type"]},
        "created_at": now
    }
    await db.project_activity.insert_one(activity_doc)
    
    return await db.project_documents.find_one({"doc_id": doc_id}, {"_id": 0})

@notion_router.put("/projects/{project_id}/documents/{doc_id}")
async def update_project_document(project_id: str, doc_id: str, data: GoogleDocUpdate, request: Request):
    """Update a document's name"""
    await get_current_user(request)
    
    update_data = {}
    if data.name:
        update_data["name"] = data.name
    
    if update_data:
        await db.project_documents.update_one(
            {"doc_id": doc_id, "project_id": project_id},
            {"$set": update_data}
        )
    
    return await db.project_documents.find_one({"doc_id": doc_id}, {"_id": 0})

@notion_router.delete("/projects/{project_id}/documents/{doc_id}")
async def remove_project_document(project_id: str, doc_id: str, request: Request):
    """Remove a Google Doc/Sheet from a project"""
    user = await get_current_user(request)
    
    doc = await db.project_documents.find_one({"doc_id": doc_id, "project_id": project_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    await db.project_documents.delete_one({"doc_id": doc_id})
    
    # Log activity
    now = datetime.now(timezone.utc)
    activity_doc = {
        "activity_id": f"act_{uuid.uuid4().hex[:12]}",
        "project_id": project_id,
        "type": "document_removed",
        "description": f"Removed document: {doc.get('name', 'Unknown')}",
        "user_id": user["user_id"],
        "user_name": user.get("name", "Unknown"),
        "metadata": {"doc_id": doc_id},
        "created_at": now
    }
    await db.project_activity.insert_one(activity_doc)
    
    return {"message": "Document removed"}

@notion_router.get("/projects/{project_id}/activity")
async def get_project_activity(project_id: str, request: Request, limit: int = 50):
    """Get activity log for a project"""
    await get_current_user(request)
    
    activities = await db.project_activity.find(
        {"project_id": project_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    return activities

# Link task to document
@notion_router.post("/rows/{row_id}/link-document")
async def link_task_to_document(row_id: str, data: Dict[str, str], request: Request):
    """Link a task to a Google Doc/Sheet"""
    user = await get_current_user(request)
    
    doc_id = data.get("doc_id")
    if not doc_id:
        raise HTTPException(status_code=400, detail="doc_id required")
    
    # Verify document exists
    doc = await db.project_documents.find_one({"doc_id": doc_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Add to task's linked_documents
    await db.notion_rows.update_one(
        {"row_id": row_id},
        {"$addToSet": {"linked_documents": doc_id}}
    )
    
    return {"message": "Document linked to task"}

@notion_router.delete("/rows/{row_id}/link-document/{doc_id}")
async def unlink_task_from_document(row_id: str, doc_id: str, request: Request):
    """Unlink a document from a task"""
    await get_current_user(request)
    
    await db.notion_rows.update_one(
        {"row_id": row_id},
        {"$pull": {"linked_documents": doc_id}}
    )
    
    return {"message": "Document unlinked from task"}
