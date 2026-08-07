"""
BNI Outreach — Drawlead OS

Tracks prospective companies/individuals being reached out to for BNI chapter
membership: name, brand, chapter of interest, contact details, and an
outreach status pipeline (To do / Contacted / Interested / Not Interested /
Converted).

Storage: collection `bni_outreach`.
"""
import csv
import io
import re
import uuid
import httpx
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone

bni_outreach_router = APIRouter(prefix="/bni/outreach", tags=["bni"])
bni_outreach_sources_router = APIRouter(prefix="/bni/outreach-sources", tags=["bni"])

OUTREACH_STATUSES = ["To do", "Contacted", "Interested", "Not Interested", "Converted"]

# Column synonyms used when importing outreach rows from a Google Sheet source
# (same columns as the CSV import on the Outreach tab).
SOURCE_FIELD_SYNONYMS = {
    "name": ["name"],
    "brand_name": ["brand name", "brand"],
    "chapter_name": ["chapter name", "chapter"],
    "email": ["email", "email address"],
    "profile_link": ["profile link", "profile"],
    "phone": ["phone", "phone number", "mobile", "contact number"],
    "website": ["website", "site"],
    "status": ["status"],
    "location": ["location"],
    "category": ["category", "category name", "business category"],
}


def _norm(s):
    return " ".join(str(s or "").lower().split())


def _sheet_csv_url(url: str):
    """Turn a shared Google Sheets URL into its CSV export URL (works when the
    sheet is shared 'anyone with the link can view')."""
    m = re.search(r"/spreadsheets/d/([a-zA-Z0-9-_]+)", url or "")
    if not m:
        return None
    sheet_id = m.group(1)
    export = f"https://docs.google.com/spreadsheets/d/{sheet_id}/export?format=csv"
    gm = re.search(r"[#&?]gid=(\d+)", url or "")
    if gm:
        export += f"&gid={gm.group(1)}"
    return export


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


# ---------- Sources (Google Sheets that sync into the outreach list) ----------

class OutreachSourceCreate(BaseModel):
    name: str
    sheet_url: str


@bni_outreach_sources_router.get("")
async def list_outreach_sources(request: Request):
    from server import get_current_user, db
    await get_current_user(request)
    return await db.bni_outreach_sources.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)


@bni_outreach_sources_router.post("")
async def create_outreach_source(payload: OutreachSourceCreate, request: Request):
    from server import get_current_user, db
    user = await get_current_user(request)
    name = (payload.name or "").strip()
    sheet_url = (payload.sheet_url or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Source name is required")
    if not _sheet_csv_url(sheet_url):
        raise HTTPException(status_code=400, detail="Enter a valid Google Sheets link")
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "source_id": f"bnisrc_{uuid.uuid4().hex[:10]}",
        "name": name,
        "sheet_url": sheet_url,
        "last_synced_at": None,
        "last_row_count": 0,
        "created_by": user.user_id,
        "created_at": now,
    }
    await db.bni_outreach_sources.insert_one(doc)
    doc.pop("_id", None)
    return doc


@bni_outreach_sources_router.delete("/{source_id}")
async def delete_outreach_source(source_id: str, request: Request):
    from server import get_current_user, db
    await get_current_user(request)
    result = await db.bni_outreach_sources.delete_one({"source_id": source_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Source not found")
    # The outreach rows this source imported are left in place (they may have
    # been edited) — clear their source tag so they read as standalone entries.
    await db.bni_outreach.update_many({"source_id": source_id}, {"$set": {"source_id": "", "source_name": ""}})
    return {"success": True}


@bni_outreach_sources_router.post("/{source_id}/sync")
async def sync_outreach_source(source_id: str, request: Request):
    """Fetch the source's Google Sheet as CSV and upsert its rows into the
    outreach list (deduped by name within the source, so re-syncing updates
    rather than duplicates)."""
    from server import get_current_user, db
    user = await get_current_user(request)
    source = await db.bni_outreach_sources.find_one({"source_id": source_id}, {"_id": 0})
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")
    csv_url = _sheet_csv_url(source.get("sheet_url", ""))
    if not csv_url:
        raise HTTPException(status_code=400, detail="This source is not a valid Google Sheets link")

    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=30.0) as client:
            resp = await client.get(csv_url)
    except Exception:
        raise HTTPException(status_code=400, detail="Could not reach the sheet. Check the link and try again.")
    if resp.status_code != 200 or "text/csv" not in (resp.headers.get("content-type") or ""):
        raise HTTPException(status_code=400, detail="Could not read the sheet as CSV — share it as 'Anyone with the link can view'.")

    rows = list(csv.reader(io.StringIO(resp.text)))
    if not rows:
        raise HTTPException(status_code=400, detail="The sheet is empty")

    header = rows[0]
    header_map = {}
    for i, h in enumerate(header):
        nh = _norm(h)
        for field, syns in SOURCE_FIELD_SYNONYMS.items():
            if nh in [_norm(x) for x in syns]:
                header_map[i] = field
                break
    if "name" not in header_map.values():
        raise HTTPException(status_code=400, detail="The sheet needs a 'Name' column")

    cats = await db.bni_categories.find({}, {"_id": 0, "category_id": 1, "name": 1}).to_list(2000)
    cat_by_name = {_norm(c["name"]): c for c in cats}

    now = datetime.now(timezone.utc).isoformat()
    imported = 0
    updated = 0
    total = 0
    for row in rows[1:]:
        rec = {}
        for i, field in header_map.items():
            rec[field] = row[i].strip() if i < len(row) else ""
        name = (rec.get("name") or "").strip()
        if not name:
            continue
        total += 1
        cat = cat_by_name.get(_norm(rec.get("category", "")))
        status = rec.get("status") if rec.get("status") in OUTREACH_STATUSES else "To do"
        fields = {
            "name": name,
            "brand_name": rec.get("brand_name", ""),
            "chapter_name": rec.get("chapter_name", ""),
            "email": rec.get("email", ""),
            "profile_link": rec.get("profile_link", ""),
            "phone": rec.get("phone", ""),
            "website": rec.get("website", ""),
            "status": status,
            "location": rec.get("location", ""),
            "category_id": cat["category_id"] if cat else "",
            "category_name": cat["name"] if cat else "",
            "source_id": source_id,
            "source_name": source.get("name", ""),
            "updated_at": now,
        }
        existing = await db.bni_outreach.find_one(
            {"source_id": source_id, "name": {"$regex": f"^{re.escape(name)}$", "$options": "i"}},
            {"_id": 0, "outreach_id": 1},
        )
        if existing:
            await db.bni_outreach.update_one({"outreach_id": existing["outreach_id"]}, {"$set": fields})
            updated += 1
        else:
            fields.update({"outreach_id": f"bniout_{uuid.uuid4().hex[:10]}", "created_by": user.user_id, "created_at": now})
            await db.bni_outreach.insert_one(fields)
            imported += 1

    await db.bni_outreach_sources.update_one(
        {"source_id": source_id},
        {"$set": {"last_synced_at": now, "last_row_count": total}},
    )
    return {"imported": imported, "updated": updated, "total_rows": total}
