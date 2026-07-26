"""
Client Portal — the client-facing half of the Client Portal feature.

A staff member creates a username/password for a specific project (see
projects_routes.py's /projects/{project_id}/client-portal endpoints) and
shares a login link. The client logs in here — completely separately from
staff accounts, no shared session/auth mechanism — and only ever sees a
strictly read-only snapshot of that one project.

Available to both ERP-department projects (User -> Page -> Sub Tab -> Ultra
Sub Tab tagging, via project.erp_users) and Website-department projects
(a flat Page list, via project.pages) — reporting a task/bug tags it against
whichever structure the project actually has.
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
import uuid

client_portal_router = APIRouter(prefix="/client-portal", tags=["client-portal"])
db = None


def init_client_portal_db(database):
    global db
    db = database


class ClientLoginRequest(BaseModel):
    username: str
    password: str


class ClientPortalTaskCreate(BaseModel):
    task_name: str
    priority: str = "medium"  # low, medium, high
    department: str = "erp"  # "erp" | "website" — which tagging structure this report uses
    erp_user_id: Optional[str] = None
    erp_user_name: Optional[str] = None
    erp_page_id: Optional[str] = None
    erp_page_name: Optional[str] = None
    erp_subtab_id: Optional[str] = None
    erp_subtab_name: Optional[str] = None
    erp_ultra_subtab_id: Optional[str] = None
    erp_ultra_subtab_name: Optional[str] = None
    website_page_id: Optional[str] = None
    website_page_name: Optional[str] = None


async def _get_client_session(request: Request) -> dict:
    auth_header = request.headers.get("Authorization") or ""
    token = auth_header.replace("Bearer ", "").strip()
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    session = await db.client_portal_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid or expired session — please log in again")
    return session


@client_portal_router.post("/{project_id}/login")
async def client_login(project_id: str, payload: ClientLoginRequest):
    from server import verify_password
    project = await db.projects.find_one({"project_id": project_id}, {"_id": 0, "client_portal": 1, "name": 1})
    portal = (project or {}).get("client_portal") or {}
    if not project or not portal.get("enabled") or not portal.get("username"):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    if payload.username.strip().lower() != (portal.get("username") or "").strip().lower():
        raise HTTPException(status_code=401, detail="Invalid username or password")
    if not verify_password(payload.password, portal.get("password_hash") or ""):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    session_token = f"cportal_{uuid.uuid4().hex}"
    await db.client_portal_sessions.insert_one({
        "session_token": session_token,
        "project_id": project_id,
        "created_at": datetime.now(timezone.utc),
    })
    return {"session_token": session_token, "project_name": project.get("name")}


@client_portal_router.get("/me/project")
async def get_client_project_view(request: Request):
    """Strictly read-only project snapshot for the logged-in client — name,
    dates, status, and a trimmed task list. No financial data, no internal
    fields (assignee-only tasks, member lists, payment schedule, etc.)."""
    session = await _get_client_session(request)
    project = await db.projects.find_one({"project_id": session["project_id"]}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    tasks = await db.our_tasks.find(
        {"project_id": session["project_id"]},
        {"_id": 0, "task_id": 1, "task_name": 1, "status": 1, "priority": 1, "due_date": 1, "category": 1,
         "created_at": 1, "erp_page_id": 1, "website_page_id": 1},
    ).sort("created_at", -1).to_list(500)

    # Trimmed User -> Pages -> Sub Tabs -> Ultra Sub Tabs structure (same
    # shape as the internal ERP Users tab) so the client sees work organized
    # by who/what it's for, not just a flat task list, and can tag a new
    # task down to Page / Sub Page / Super Sub Page when reporting one.
    erp_users = [
        {
            "id": u.get("id"),
            "user_name": u.get("user_name"),
            "pages": [
                {
                    "id": p.get("id"),
                    "page_name": p.get("page_name"),
                    "status": p.get("status"),
                    "sub_tabs": [
                        {
                            "id": st.get("id"),
                            "name": st.get("name"),
                            "ultra_sub_tabs": [
                                {"id": ut.get("id"), "name": ut.get("name")}
                                for ut in (st.get("ultra_sub_tabs") or [])
                            ],
                        }
                        for st in (p.get("sub_tabs") or [])
                    ],
                }
                for p in (u.get("pages") or [])
            ],
        }
        for u in (project.get("erp_users") or [])
    ]

    # Website department's flat Page list (no User grouping) — same trimmed
    # shape as ProjectPagesTab, for tagging a new task to a specific page.
    pages = [
        {"id": p.get("id"), "page_name": p.get("page_name"), "status": p.get("status")}
        for p in (project.get("pages") or [])
    ]

    return {
        "project_id": project["project_id"],
        "name": project.get("name"),
        "description": project.get("description"),
        "start_date": project.get("start_date"),
        "due_date": project.get("due_date"),
        "status": project.get("status"),
        "project_type": project.get("project_type"),
        "client_name": project.get("client_name"),
        "departments": project.get("departments") or [],
        "tasks": tasks,
        "erp_users": erp_users,
        "pages": pages,
    }


@client_portal_router.post("/tasks")
async def create_client_portal_task(payload: ClientPortalTaskCreate, request: Request):
    """Client-reported task/bug — always scoped to the logged-in client's own
    project, so the client never picks a project. `department` selects which
    tagging structure applies (ERP's User/Page/Sub Tab, or Website's flat
    Page list) and must be one the project actually has."""
    session = await _get_client_session(request)

    task_name = (payload.task_name or "").strip()
    if not task_name:
        raise HTTPException(status_code=400, detail="Please describe the task or bug")
    if payload.priority not in ("low", "medium", "high"):
        raise HTTPException(status_code=400, detail="Priority must be low, medium, or high")
    if payload.department not in ("erp", "website"):
        raise HTTPException(status_code=400, detail="department must be erp or website")

    project = await db.projects.find_one({"project_id": session["project_id"]}, {"_id": 0, "name": 1, "departments": 1})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if payload.department not in (project.get("departments") or []):
        raise HTTPException(status_code=400, detail=f"This project has no {payload.department} department")

    now = datetime.now(timezone.utc).isoformat()
    task = {
        "task_id": f"ot_{uuid.uuid4().hex[:12]}",
        "task_name": task_name,
        "description": "",
        "status": "pending",
        "priority": payload.priority,
        "type": "general",
        "assigned_to": None,
        "created_by": None,
        "created_via": "client_portal",
        "department": payload.department,
        "category": None,
        "project_id": session["project_id"],
        "project_name": project.get("name"),
        "erp_user_id": payload.erp_user_id if payload.department == "erp" else None,
        "erp_user_name": payload.erp_user_name if payload.department == "erp" else None,
        "erp_page_id": payload.erp_page_id if payload.department == "erp" else None,
        "erp_page_name": payload.erp_page_name if payload.department == "erp" else None,
        "erp_subtab_id": payload.erp_subtab_id if payload.department == "erp" else None,
        "erp_subtab_name": payload.erp_subtab_name if payload.department == "erp" else None,
        "erp_ultra_subtab_id": payload.erp_ultra_subtab_id if payload.department == "erp" else None,
        "erp_ultra_subtab_name": payload.erp_ultra_subtab_name if payload.department == "erp" else None,
        "website_page_id": payload.website_page_id if payload.department == "website" else None,
        "website_page_name": payload.website_page_name if payload.department == "website" else None,
        "work_link": None,
        "due_date": None,
        "due_time": None,
        "all_day": False,
        "recurrence": "none",
        "time_tracking": {"total_seconds": 0, "status": "not_started", "sessions": []},
        "created_at": now,
        "updated_at": now,
    }
    await db.our_tasks.insert_one(task)
    task.pop("_id", None)
    return task


@client_portal_router.post("/logout")
async def client_logout(request: Request):
    auth_header = request.headers.get("Authorization") or ""
    token = auth_header.replace("Bearer ", "").strip()
    if token:
        await db.client_portal_sessions.delete_one({"session_token": token})
    return {"message": "Logged out"}
