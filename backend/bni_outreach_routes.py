"""
BNI Outreach — Drawlead OS

Tracks prospective companies/individuals being reached out to for BNI chapter
membership: name, brand, chapter of interest, contact details, and an
outreach status pipeline (To do / Contacted / Interested / Not Interested /
Converted).

Storage: collection `bni_outreach`.
"""
import uuid
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone

bni_outreach_router = APIRouter(prefix="/bni/outreach", tags=["bni"])

OUTREACH_STATUSES = ["To do", "Contacted", "Interested", "Not Interested", "Converted"]


class OutreachCreate(BaseModel):
    name: str
    brand_name: str = ""
    chapter_name: str = ""
    email: str = ""
    profile_link: str = ""
    phone: str = ""
    website: str = ""
    status: str = "To do"
    location: str = ""
    category_id: str = ""


class OutreachUpdate(BaseModel):
    name: Optional[str] = None
    brand_name: Optional[str] = None
    chapter_name: Optional[str] = None
    email: Optional[str] = None
    profile_link: Optional[str] = None
    phone: Optional[str] = None
    website: Optional[str] = None
    status: Optional[str] = None
    location: Optional[str] = None
    category_id: Optional[str] = None


@bni_outreach_router.get("")
async def list_outreach(request: Request):
    from server import get_current_user, db
    await get_current_user(request)
    return await db.bni_outreach.find({}, {"_id": 0}).sort("created_at", -1).to_list(5000)


@bni_outreach_router.post("")
async def create_outreach(payload: OutreachCreate, request: Request):
    from server import get_current_user, db
    user = await get_current_user(request)
    if not payload.name.strip():
        raise HTTPException(status_code=400, detail="Name is required")

    category_name = ""
    if payload.category_id:
        category = await db.bni_categories.find_one({"category_id": payload.category_id}, {"_id": 0, "name": 1})
        category_name = category.get("name", "") if category else ""

    status = payload.status if payload.status in OUTREACH_STATUSES else "To do"
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "outreach_id": f"bniout_{uuid.uuid4().hex[:10]}",
        "name": payload.name.strip(),
        "brand_name": payload.brand_name.strip(),
        "chapter_name": payload.chapter_name.strip(),
        "email": payload.email.strip(),
        "profile_link": payload.profile_link.strip(),
        "phone": payload.phone.strip(),
        "website": payload.website.strip(),
        "status": status,
        "location": payload.location.strip(),
        "category_id": payload.category_id,
        "category_name": category_name,
        "created_by": user.user_id,
        "created_at": now,
        "updated_at": now,
    }
    await db.bni_outreach.insert_one(doc)
    doc.pop("_id", None)
    return doc


@bni_outreach_router.put("/{outreach_id}")
async def update_outreach(outreach_id: str, payload: OutreachUpdate, request: Request):
    from server import get_current_user, db
    await get_current_user(request)
    entry = await db.bni_outreach.find_one({"outreach_id": outreach_id}, {"_id": 0})
    if not entry:
        raise HTTPException(status_code=404, detail="Outreach entry not found")

    update_data = {k: v for k, v in payload.dict().items() if v is not None}
    if "status" in update_data and update_data["status"] not in OUTREACH_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid status: {update_data['status']}")
    if "category_id" in update_data:
        category_name = ""
        if update_data["category_id"]:
            category = await db.bni_categories.find_one({"category_id": update_data["category_id"]}, {"_id": 0, "name": 1})
            category_name = category.get("name", "") if category else ""
        update_data["category_name"] = category_name
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()

    await db.bni_outreach.update_one({"outreach_id": outreach_id}, {"$set": update_data})
    return await db.bni_outreach.find_one({"outreach_id": outreach_id}, {"_id": 0})


@bni_outreach_router.delete("/{outreach_id}")
async def delete_outreach(outreach_id: str, request: Request):
    from server import get_current_user, db
    await get_current_user(request)
    result = await db.bni_outreach.delete_one({"outreach_id": outreach_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Outreach entry not found")
    return {"success": True}
