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
import re
import uuid
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone, timedelta

IST = timezone(timedelta(hours=5, minutes=30))

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

# Outreach classification of a category (used by the BNI Outreach page's
# Category / Target Category / Partnership tabs).
CATEGORY_TARGET_TYPES = ["none", "target", "partnership"]


class BNICategoryCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    group: Optional[str] = ""
    target_type: Optional[str] = "none"


class BNICategoryUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    group: Optional[str] = None
    target_type: Optional[str] = None


class BNICategoryGroupCreate(BaseModel):
    name: str


@bni_categories_router.get("")
async def list_bni_categories(request: Request):
    from server import get_current_user, db
    await get_current_user(request)
    return await db.bni_categories.find({}, {"_id": 0}).sort("name", 1).to_list(1000)


# ---------- Category Groups (e.g. "Construction") — used to group/filter
# categories on the BNI Category tab. Stored in `bni_category_groups`; a
# category references its group by name (denormalized). ----------

@bni_categories_router.get("/groups")
async def list_bni_category_groups(request: Request):
    from server import get_current_user, db
    await get_current_user(request)
    return await db.bni_category_groups.find({}, {"_id": 0}).sort("name", 1).to_list(500)


@bni_categories_router.post("/groups")
async def create_bni_category_group(payload: BNICategoryGroupCreate, request: Request):
    from server import get_current_user, db
    user = await get_current_user(request)
    name = (payload.name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Group name is required")
    existing = await db.bni_category_groups.find_one(
        {"name": {"$regex": f"^{re.escape(name)}$", "$options": "i"}}, {"_id": 0}
    )
    if existing:
        raise HTTPException(status_code=400, detail="A group with this name already exists")
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "group_id": f"bnicg_{uuid.uuid4().hex[:10]}",
        "name": name,
        "created_by": user.user_id,
        "created_at": now,
    }
    await db.bni_category_groups.insert_one(doc)
    doc.pop("_id", None)
    return doc


@bni_categories_router.post("/auto-group")
async def auto_group_bni_categories(request: Request):
    """Bulk-assign every category to a group derived from the text before its
    first "(" — e.g. "Advertising & Marketing (Branding)" → group
    "Advertising & Marketing". Creates any missing groups. Categories with no
    "(" in the name are left untouched."""
    from server import get_current_user, db
    user = await get_current_user(request)
    cats = await db.bni_categories.find({}, {"_id": 0, "category_id": 1, "name": 1}).to_list(2000)
    existing_groups = await db.bni_category_groups.find({}, {"_id": 0, "name": 1}).to_list(500)
    known = {g["name"].lower() for g in existing_groups}
    now = datetime.now(timezone.utc).isoformat()
    updated = 0
    created = 0
    for c in cats:
        name = c.get("name", "")
        if "(" not in name:
            continue
        group = name.split("(", 1)[0].strip()
        if not group:
            continue
        if group.lower() not in known:
            await db.bni_category_groups.insert_one({
                "group_id": f"bnicg_{uuid.uuid4().hex[:10]}",
                "name": group,
                "created_by": user.user_id,
                "created_at": now,
            })
            known.add(group.lower())
            created += 1
        await db.bni_categories.update_one(
            {"category_id": c["category_id"]},
            {"$set": {"group": group, "updated_at": now}},
        )
        updated += 1
    return {"updated": updated, "groups_created": created}


@bni_categories_router.delete("/groups/{group_id}")
async def delete_bni_category_group(group_id: str, request: Request):
    from server import get_current_user, db
    await get_current_user(request)
    grp = await db.bni_category_groups.find_one({"group_id": group_id}, {"_id": 0})
    if not grp:
        raise HTTPException(status_code=404, detail="Group not found")
    await db.bni_category_groups.delete_one({"group_id": group_id})
    # Detach the group from any categories that referenced it by name.
    await db.bni_categories.update_many({"group": grp["name"]}, {"$set": {"group": ""}})
    return {"message": "Group deleted"}


@bni_categories_router.post("")
async def create_bni_category(payload: BNICategoryCreate, request: Request):
    from server import get_current_user, db
    user = await get_current_user(request)
    name = (payload.name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Category name is required")

    now = datetime.now(timezone.utc).isoformat()
    target_type = payload.target_type if payload.target_type in CATEGORY_TARGET_TYPES else "none"
    category = {
        "category_id": f"bnicat_{uuid.uuid4().hex[:10]}",
        "name": name,
        "description": (payload.description or "").strip(),
        "group": (payload.group or "").strip(),
        "target_type": target_type,
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
    if payload.group is not None:
        update_data["group"] = payload.group.strip()
    if payload.target_type is not None:
        if payload.target_type not in CATEGORY_TARGET_TYPES:
            raise HTTPException(status_code=400, detail=f"Invalid target type: {payload.target_type}")
        update_data["target_type"] = payload.target_type

    await db.bni_categories.update_one({"category_id": category_id}, {"$set": update_data})
    return await db.bni_categories.find_one({"category_id": category_id}, {"_id": 0})


# ---------- WhatsApp reach-out templates (per category, mainly used on Target
# Category) ----------
# Each category can hold several message templates; at most one is "live" at
# a time (with the date it went live) — the Outreach page's Reach Out action
# always sends whichever one is live for that entry's category. Switching
# which template is live is how you A/B two templates against each other:
# reach out to a batch with Template A live, flip to Template B, reach out to
# the next batch, then compare how each group's status moved.

class BNITemplateCreate(BaseModel):
    name: str
    message: str


class BNITemplateUpdate(BaseModel):
    name: Optional[str] = None
    message: Optional[str] = None


class BNITemplateMakeLive(BaseModel):
    live_from: Optional[str] = None  # YYYY-MM-DD, defaults to today (IST)


@bni_categories_router.post("/{category_id}/templates")
async def create_bni_template(category_id: str, payload: BNITemplateCreate, request: Request):
    from server import get_current_user, db
    user = await get_current_user(request)
    category = await db.bni_categories.find_one({"category_id": category_id})
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    name = (payload.name or "").strip()
    message = (payload.message or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Template name is required")
    if not message:
        raise HTTPException(status_code=400, detail="Template message is required")
    now = datetime.now(timezone.utc).isoformat()
    template = {
        "template_id": f"bnitpl_{uuid.uuid4().hex[:10]}",
        "name": name,
        "message": message,
        "is_live": False,
        "live_from": None,
        "created_by": user.user_id,
        "created_at": now,
    }
    await db.bni_categories.update_one({"category_id": category_id}, {"$push": {"templates": template}})
    return template


@bni_categories_router.put("/{category_id}/templates/{template_id}")
async def update_bni_template(category_id: str, template_id: str, payload: BNITemplateUpdate, request: Request):
    from server import get_current_user, db
    await get_current_user(request)
    category = await db.bni_categories.find_one({"category_id": category_id}, {"_id": 0, "templates": 1})
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    template = next((t for t in (category.get("templates") or []) if t.get("template_id") == template_id), None)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    if payload.name is not None:
        name = payload.name.strip()
        if not name:
            raise HTTPException(status_code=400, detail="Template name is required")
        template["name"] = name
    if payload.message is not None:
        message = payload.message.strip()
        if not message:
            raise HTTPException(status_code=400, detail="Template message is required")
        template["message"] = message
    await db.bni_categories.update_one(
        {"category_id": category_id, "templates.template_id": template_id},
        {"$set": {"templates.$.name": template["name"], "templates.$.message": template["message"]}},
    )
    return template


@bni_categories_router.delete("/{category_id}/templates/{template_id}")
async def delete_bni_template(category_id: str, template_id: str, request: Request):
    from server import get_current_user, db
    await get_current_user(request)
    result = await db.bni_categories.update_one(
        {"category_id": category_id}, {"$pull": {"templates": {"template_id": template_id}}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Category not found")
    return {"message": "Template deleted"}


@bni_categories_router.post("/{category_id}/templates/{template_id}/make-live")
async def make_bni_template_live(category_id: str, template_id: str, payload: BNITemplateMakeLive, request: Request):
    """Make this the one live template for the category — every other
    template on it goes back to not-live in the same update."""
    from server import get_current_user, db
    await get_current_user(request)
    category = await db.bni_categories.find_one({"category_id": category_id}, {"_id": 0, "templates": 1})
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    templates = category.get("templates") or []
    if not any(t.get("template_id") == template_id for t in templates):
        raise HTTPException(status_code=404, detail="Template not found")
    live_from = payload.live_from or datetime.now(IST).date().isoformat()
    try:
        datetime.strptime(live_from, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="live_from must be YYYY-MM-DD")
    for t in templates:
        t["is_live"] = t["template_id"] == template_id
        t["live_from"] = live_from if t["template_id"] == template_id else t.get("live_from")
    await db.bni_categories.update_one({"category_id": category_id}, {"$set": {"templates": templates}})
    return {"templates": templates}


@bni_categories_router.post("/{category_id}/templates/{template_id}/unlive")
async def unlive_bni_template(category_id: str, template_id: str, request: Request):
    """Take this template off live without picking a replacement — the
    category is left with no live template until one is made live again."""
    from server import get_current_user, db
    await get_current_user(request)
    result = await db.bni_categories.update_one(
        {"category_id": category_id, "templates.template_id": template_id},
        {"$set": {"templates.$.is_live": False}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Template not found")
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
