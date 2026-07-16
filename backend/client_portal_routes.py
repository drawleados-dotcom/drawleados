"""
Client Portal — the client-facing half of the ERP "Client Portal" feature.

A staff member creates a username/password for a specific project (see
projects_routes.py's /projects/{project_id}/client-portal endpoints) and
shares a login link. The client logs in here — completely separately from
staff accounts, no shared session/auth mechanism — and only ever sees a
strictly read-only snapshot of that one project.
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
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
         "created_at": 1, "erp_page_id": 1},
    ).sort("created_at", -1).to_list(500)

    # Trimmed User -> Pages structure (same shape as the internal ERP Users
    # tab) so the client sees work organized by who/what it's for, not just
    # a flat task list.
    erp_users = [
        {
            "id": u.get("id"),
            "user_name": u.get("user_name"),
            "pages": [
                {"id": p.get("id"), "page_name": p.get("page_name"), "status": p.get("status")}
                for p in (u.get("pages") or [])
            ],
        }
        for u in (project.get("erp_users") or [])
    ]

    return {
        "project_id": project["project_id"],
        "name": project.get("name"),
        "description": project.get("description"),
        "start_date": project.get("start_date"),
        "due_date": project.get("due_date"),
        "status": project.get("status"),
        "project_type": project.get("project_type"),
        "tasks": tasks,
        "erp_users": erp_users,
    }


@client_portal_router.post("/logout")
async def client_logout(request: Request):
    auth_header = request.headers.get("Authorization") or ""
    token = auth_header.replace("Bearer ", "").strip()
    if token:
        await db.client_portal_sessions.delete_one({"session_token": token})
    return {"message": "Logged out"}
