"""
LinkedIn Connections — Drawlead OS

Standalone module (separate from Automation's LinkedIn Partnership CRM) for
maintaining a database of LinkedIn connections: add one manually via a
popup (Name, Company, Profile URL), or bulk-import an exported LinkedIn
"Connections.csv" — First Name, Last Name, URL, Email Address, Company,
Position, Connected On is LinkedIn's own export schema, so those are the
import field keys the frontend maps CSV columns onto.

Storage: collection `linkedin_connections`.
"""
import uuid
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone

linkedin_connections_router = APIRouter(prefix="/linkedin-connections", tags=["linkedin-connections"])


class ConnectionCreate(BaseModel):
    name: str
    company: str = ""
    position: str = ""
    url: str = ""
    email: str = ""
    connected_on: str = ""
    notes: str = ""


class ConnectionUpdate(BaseModel):
    name: Optional[str] = None
    company: Optional[str] = None
    position: Optional[str] = None
    url: Optional[str] = None
    email: Optional[str] = None
    connected_on: Optional[str] = None
    notes: Optional[str] = None


class ImportRow(BaseModel):
    first_name: str = ""
    last_name: str = ""
    url: str = ""
    email: str = ""
    company: str = ""
    position: str = ""
    connected_on: str = ""


class BulkImportRequest(BaseModel):
    rows: List[ImportRow]


@linkedin_connections_router.get("")
async def list_connections(request: Request, search: str = ""):
    from server import get_current_user, db
    await get_current_user(request)
    query = {}
    if search:
        regex = {"$regex": search, "$options": "i"}
        query["$or"] = [
            {"name": regex}, {"company": regex}, {"position": regex}, {"email": regex},
        ]
    return await db.linkedin_connections.find(query, {"_id": 0}).sort("created_at", -1).to_list(20000)


@linkedin_connections_router.post("")
async def create_connection(payload: ConnectionCreate, request: Request):
    from server import get_current_user, db
    user = await get_current_user(request)
    name = (payload.name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name is required")

    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "connection_id": f"lnkconn_{uuid.uuid4().hex[:10]}",
        "name": name,
        "company": (payload.company or "").strip(),
        "position": (payload.position or "").strip(),
        "url": (payload.url or "").strip(),
        "email": (payload.email or "").strip(),
        "connected_on": (payload.connected_on or "").strip(),
        "notes": (payload.notes or "").strip(),
        "created_by": user.user_id,
        "created_at": now,
        "updated_at": now,
    }
    await db.linkedin_connections.insert_one(doc)
    doc.pop("_id", None)
    return doc


@linkedin_connections_router.put("/{connection_id}")
async def update_connection(connection_id: str, payload: ConnectionUpdate, request: Request):
    from server import get_current_user, db
    await get_current_user(request)
    existing = await db.linkedin_connections.find_one({"connection_id": connection_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Connection not found")

    update_data = {k: v for k, v in payload.dict().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.linkedin_connections.update_one({"connection_id": connection_id}, {"$set": update_data})
    return await db.linkedin_connections.find_one({"connection_id": connection_id}, {"_id": 0})


@linkedin_connections_router.delete("/{connection_id}")
async def delete_connection(connection_id: str, request: Request):
    from server import get_current_user, db
    await get_current_user(request)
    result = await db.linkedin_connections.delete_one({"connection_id": connection_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Connection not found")
    return {"message": "Connection deleted"}


@linkedin_connections_router.post("/bulk-import")
async def bulk_import_connections(payload: BulkImportRequest, request: Request):
    """Bulk-insert rows from an imported CSV in one call, skipping rows whose
    profile URL already exists so re-importing the same export is a no-op."""
    from server import get_current_user, db
    user = await get_current_user(request)

    existing_urls = set()
    async for doc in db.linkedin_connections.find({"url": {"$ne": ""}}, {"_id": 0, "url": 1}):
        existing_urls.add(doc["url"])

    now = datetime.now(timezone.utc).isoformat()
    docs = []
    skipped = 0
    for row in payload.rows:
        name = " ".join(p for p in [row.first_name.strip(), row.last_name.strip()] if p).strip()
        url = row.url.strip()
        if not name and not url:
            continue
        if url and url in existing_urls:
            skipped += 1
            continue
        if url:
            existing_urls.add(url)
        docs.append({
            "connection_id": f"lnkconn_{uuid.uuid4().hex[:10]}",
            "name": name or url,
            "company": row.company.strip(),
            "position": row.position.strip(),
            "url": url,
            "email": row.email.strip(),
            "connected_on": row.connected_on.strip(),
            "notes": "",
            "created_by": user.user_id,
            "created_at": now,
            "updated_at": now,
        })

    if docs:
        await db.linkedin_connections.insert_many(docs)

    return {"imported": len(docs), "skipped_duplicates": skipped}
