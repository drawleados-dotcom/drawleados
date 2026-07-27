"""
BNI (Business Network International) chapter management routes.

Super-Admin-only module for tracking chapter members and their business
category. Two resources today:
  - Categories: name + description, one member per category in a real BNI
    chapter (hence Members highlights this column).
  - Members: contact + business details, tagged to a Category.

Storage: collections `bni_categories`, `bni_members`.
"""
import uuid
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone

bni_categories_router = APIRouter(prefix="/bni/categories", tags=["bni"])
bni_members_router = APIRouter(prefix="/bni/members", tags=["bni"])


# ---------- Categories ----------

class BNICategoryCreate(BaseModel):
    name: str
    description: Optional[str] = ""


class BNICategoryUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


@bni_categories_router.get("")
async def list_bni_categories(request: Request):
    from server import get_current_user, db
    await get_current_user(request)
    return await db.bni_categories.find({}, {"_id": 0}).sort("name", 1).to_list(1000)


@bni_categories_router.post("")
async def create_bni_category(payload: BNICategoryCreate, request: Request):
    from server import get_current_user, db
    user = await get_current_user(request)
    name = (payload.name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Category name is required")

    now = datetime.now(timezone.utc).isoformat()
    category = {
        "category_id": f"bnicat_{uuid.uuid4().hex[:10]}",
        "name": name,
        "description": (payload.description or "").strip(),
        "created_by": user.user_id,
        "created_at": now,
        "updated_at": now,
    }
    await db.bni_categories.insert_one(category)
    del category["_id"]
    return category


@bni_categories_router.put("/{category_id}")
async def update_bni_category(category_id: str, payload: BNICategoryUpdate, request: Request):
    from server import get_current_user, db
    await get_current_user(request)
    existing = await db.bni_categories.find_one({"category_id": category_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Category not found")

    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if payload.name is not None:
        name = payload.name.strip()
        if not name:
            raise HTTPException(status_code=400, detail="Category name is required")
        update_data["name"] = name
    if payload.description is not None:
        update_data["description"] = payload.description.strip()

    await db.bni_categories.update_one({"category_id": category_id}, {"$set": update_data})
    return await db.bni_categories.find_one({"category_id": category_id}, {"_id": 0})


# ---------- Members ----------

class BNIMemberCreate(BaseModel):
    title: Optional[str] = ""  # Mr / Miss / Mrs
    name: str
    business_name: Optional[str] = ""
    email: Optional[str] = ""
    phone: Optional[str] = ""
    category_id: Optional[str] = ""
    category_name: Optional[str] = ""
    address: Optional[str] = ""
    location_link: Optional[str] = ""
    city: Optional[str] = ""


class BNIMemberUpdate(BaseModel):
    title: Optional[str] = None
    name: Optional[str] = None
    business_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    category_id: Optional[str] = None
    category_name: Optional[str] = None
    address: Optional[str] = None
    location_link: Optional[str] = None
    city: Optional[str] = None


@bni_members_router.get("")
async def list_bni_members(request: Request):
    from server import get_current_user, db
    await get_current_user(request)
    return await db.bni_members.find({}, {"_id": 0}).sort("name", 1).to_list(2000)


@bni_members_router.post("")
async def create_bni_member(payload: BNIMemberCreate, request: Request):
    from server import get_current_user, db
    user = await get_current_user(request)
    name = (payload.name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name is required")

    now = datetime.now(timezone.utc).isoformat()
    member = {
        "member_id": f"bnimem_{uuid.uuid4().hex[:10]}",
        "title": payload.title or "",
        "name": name,
        "business_name": payload.business_name or "",
        "email": payload.email or "",
        "phone": payload.phone or "",
        "category_id": payload.category_id or "",
        "category_name": payload.category_name or "",
        "address": payload.address or "",
        "location_link": payload.location_link or "",
        "city": payload.city or "",
        "created_by": user.user_id,
        "created_at": now,
        "updated_at": now,
    }
    await db.bni_members.insert_one(member)
    del member["_id"]
    return member


@bni_members_router.put("/{member_id}")
async def update_bni_member(member_id: str, payload: BNIMemberUpdate, request: Request):
    from server import get_current_user, db
    await get_current_user(request)
    existing = await db.bni_members.find_one({"member_id": member_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Member not found")

    update_data = {k: v for k, v in payload.dict(exclude_unset=True).items()}
    if "name" in update_data and not (update_data["name"] or "").strip():
        raise HTTPException(status_code=400, detail="Name is required")
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()

    await db.bni_members.update_one({"member_id": member_id}, {"$set": update_data})
    return await db.bni_members.find_one({"member_id": member_id}, {"_id": 0})


@bni_members_router.delete("/{member_id}")
async def delete_bni_member(member_id: str, request: Request):
    from server import get_current_user, db
    await get_current_user(request)
    result = await db.bni_members.delete_one({"member_id": member_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Member not found")
    return {"message": "Member deleted"}
