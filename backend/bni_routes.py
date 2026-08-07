"""
BNI (Business Network International) chapter management routes.

Super-Admin-only module for tracking chapter members and their business
category. Resources:
  - Settings: chapter name + region — a single document for this org's chapter.
  - Categories: name + description, one member per category in a real BNI
    chapter (hence Members highlights this column).
  - Role Players: name + description (e.g. President, Visitor Host) — tagged
    to a member and highlighted the same way as Category.
  - Members: contact + business details, tagged to a Category and Role Player.

  - Payment History: read-only view of Finance → Expense → Expense Split
    spend recorded against a sub-category named "BNI" (e.g. Marketing >
    BNI) — surfaces cashbook debit entries tagged with that sub-category's
    id, so BNI dues paid via Finance show up here automatically.

Storage: collections `bni_settings`, `bni_categories`, `bni_role_players`, `bni_members`.
"""
import uuid
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone

bni_settings_router = APIRouter(prefix="/bni/settings", tags=["bni"])
bni_categories_router = APIRouter(prefix="/bni/categories", tags=["bni"])
bni_role_players_router = APIRouter(prefix="/bni/role-players", tags=["bni"])
bni_members_router = APIRouter(prefix="/bni/members", tags=["bni"])
bni_payment_history_router = APIRouter(prefix="/bni/payment-history", tags=["bni"])

SETTINGS_DOC_ID = "default"


# ---------- Settings (Chapter Name / Region) ----------

class BNISettingsUpdate(BaseModel):
    chapter_name: Optional[str] = None
    region: Optional[str] = None


@bni_settings_router.get("")
async def get_bni_settings(request: Request):
    from server import get_current_user, db
    await get_current_user(request)
    doc = await db.bni_settings.find_one({"settings_id": SETTINGS_DOC_ID}, {"_id": 0})
    return doc or {"settings_id": SETTINGS_DOC_ID, "chapter_name": "", "region": ""}


@bni_settings_router.put("")
async def update_bni_settings(payload: BNISettingsUpdate, request: Request):
    from server import get_current_user, db
    await get_current_user(request)
    update_data = {"settings_id": SETTINGS_DOC_ID, "updated_at": datetime.now(timezone.utc).isoformat()}
    if payload.chapter_name is not None:
        update_data["chapter_name"] = payload.chapter_name.strip()
    if payload.region is not None:
        update_data["region"] = payload.region.strip()

    await db.bni_settings.update_one(
        {"settings_id": SETTINGS_DOC_ID}, {"$set": update_data}, upsert=True
    )
    return await db.bni_settings.find_one({"settings_id": SETTINGS_DOC_ID}, {"_id": 0})


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


# ---------- Role Players ----------

class BNIRolePlayerCreate(BaseModel):
    name: str
    description: Optional[str] = ""


class BNIRolePlayerUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


@bni_role_players_router.get("")
async def list_bni_role_players(request: Request):
    from server import get_current_user, db
    await get_current_user(request)
    return await db.bni_role_players.find({}, {"_id": 0}).sort("name", 1).to_list(1000)


@bni_role_players_router.post("")
async def create_bni_role_player(payload: BNIRolePlayerCreate, request: Request):
    from server import get_current_user, db
    user = await get_current_user(request)
    name = (payload.name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Role player name is required")

    now = datetime.now(timezone.utc).isoformat()
    role_player = {
        "role_player_id": f"bnirole_{uuid.uuid4().hex[:10]}",
        "name": name,
        "description": (payload.description or "").strip(),
        "created_by": user.user_id,
        "created_at": now,
        "updated_at": now,
    }
    await db.bni_role_players.insert_one(role_player)
    del role_player["_id"]
    return role_player


@bni_role_players_router.put("/{role_player_id}")
async def update_bni_role_player(role_player_id: str, payload: BNIRolePlayerUpdate, request: Request):
    from server import get_current_user, db
    await get_current_user(request)
    existing = await db.bni_role_players.find_one({"role_player_id": role_player_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Role player not found")

    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if payload.name is not None:
        name = payload.name.strip()
        if not name:
            raise HTTPException(status_code=400, detail="Role player name is required")
        update_data["name"] = name
    if payload.description is not None:
        update_data["description"] = payload.description.strip()

    await db.bni_role_players.update_one({"role_player_id": role_player_id}, {"$set": update_data})
    return await db.bni_role_players.find_one({"role_player_id": role_player_id}, {"_id": 0})


# ---------- Members ----------

class BNIMemberCreate(BaseModel):
    title: Optional[str] = ""  # Mr / Miss / Mrs
    name: str
    business_name: Optional[str] = ""
    email: Optional[str] = ""
    phone: Optional[str] = ""
    website: Optional[str] = ""
    category_id: Optional[str] = ""
    category_name: Optional[str] = ""
    role_player_id: Optional[str] = ""
    role_player_name: Optional[str] = ""
    address: Optional[str] = ""
    location_link: Optional[str] = ""
    city: Optional[str] = ""


class BNIMemberUpdate(BaseModel):
    title: Optional[str] = None
    name: Optional[str] = None
    business_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    website: Optional[str] = None
    category_id: Optional[str] = None
    category_name: Optional[str] = None
    role_player_id: Optional[str] = None
    role_player_name: Optional[str] = None
    address: Optional[str] = None
    location_link: Optional[str] = None
    city: Optional[str] = None
    pinned: Optional[bool] = None


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
        "website": payload.website or "",
        "category_id": payload.category_id or "",
        "category_name": payload.category_name or "",
        "role_player_id": payload.role_player_id or "",
        "role_player_name": payload.role_player_name or "",
        "address": payload.address or "",
        "location_link": payload.location_link or "",
        "city": payload.city or "",
        "pinned": False,
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


# ---------- Payment History (reads Finance → Expense Split spend) ----------

@bni_payment_history_router.get("")
async def get_bni_payment_history(request: Request, month: Optional[int] = None, year: Optional[int] = None):
    """Cashbook debit entries tagged with a "BNI" Expense Split sub-category
    (e.g. Marketing > BNI). No month/year → all-time."""
    from server import get_current_user, db
    await get_current_user(request)

    bni_cats = await db.expense_split_categories.find(
        {
            "name": {"$regex": "^bni$", "$options": "i"},
            "parent_id": {"$ne": None},
            "is_deleted": {"$ne": True},
        },
        {"_id": 0, "category_id": 1},
    ).to_list(50)
    cat_ids = [c["category_id"] for c in bni_cats]

    # Expenses are tagged to the most specific (leaf) category the user
    # picked — e.g. "Marketing > BNI > Membership Fee" — not necessarily the
    # "BNI" node itself. Walk every descendant (nesting is unlimited) so
    # those still count as BNI spend.
    if cat_ids:
        all_docs = await db.expense_split_categories.find(
            {"is_deleted": {"$ne": True}}, {"_id": 0, "category_id": 1, "parent_id": 1},
        ).to_list(1000)
        by_parent: dict = {}
        for d in all_docs:
            by_parent.setdefault(d.get("parent_id"), []).append(d["category_id"])
        frontier = list(cat_ids)
        while frontier:
            next_frontier = []
            for pid in frontier:
                for child_id in by_parent.get(pid, []):
                    if child_id not in cat_ids:
                        cat_ids.append(child_id)
                        next_frontier.append(child_id)
            frontier = next_frontier

    query = {"kind": "debit", "split_category_id": {"$in": cat_ids}}
    if month and year:
        start = f"{year:04d}-{month:02d}-01"
        end = f"{year + 1:04d}-01-01" if month == 12 else f"{year:04d}-{month + 1:02d}-01"
        query["date"] = {"$gte": start, "$lt": end}
    elif year:
        query["date"] = {"$gte": f"{year:04d}-01-01", "$lt": f"{year + 1:04d}-01-01"}

    entries = await db.cashbook_entries.find(query, {"_id": 0}).sort("date", -1).to_list(2000)
    for e in entries:
        if isinstance(e.get("created_at"), datetime):
            e["created_at"] = e["created_at"].isoformat()

    total = sum(float(e.get("amount") or 0) for e in entries)

    # All-time total across every BNI-tagged debit, ignoring the period filter
    # — powers the "Total (All Expenses)" box that stays constant as you page
    # through months.
    all_time_docs = await db.cashbook_entries.find(
        {"kind": "debit", "split_category_id": {"$in": cat_ids}}, {"_id": 0, "amount": 1},
    ).to_list(5000)
    all_time_total = sum(float(d.get("amount") or 0) for d in all_time_docs)

    return {
        "entries": entries,
        "summary": {
            "total_amount": round(total, 2),
            "count": len(entries),
            "all_time_total": round(all_time_total, 2),
            "all_time_count": len(all_time_docs),
        },
        "has_bni_category": len(cat_ids) > 0,
    }
