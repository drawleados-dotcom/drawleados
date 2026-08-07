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
import html as htmllib
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


def _sheet_id(url: str):
    m = re.search(r"/spreadsheets/d/([a-zA-Z0-9-_]+)", url or "")
    return m.group(1) if m else None


def _sheet_csv_url(url: str):
    """Turn a shared Google Sheets URL into its CSV export URL (works when the
    sheet is shared 'anyone with the link can view')."""
    sheet_id = _sheet_id(url)
    if not sheet_id:
        return None
    export = f"https://docs.google.com/spreadsheets/d/{sheet_id}/export?format=csv"
    gm = re.search(r"[#&?]gid=(\d+)", url or "")
    if gm:
        export += f"&gid={gm.group(1)}"
    return export


async def _fetch_worksheets(client, sheet_id):
    """List every worksheet (tab) of a public sheet as [{name, gid}] by parsing
    the htmlview page's sheet menu. Empty when it can't be read (private sheet
    or unexpected markup) — caller then falls back to the single-CSV path."""
    try:
        r = await client.get(f"https://docs.google.com/spreadsheets/d/{sheet_id}/htmlview")
    except Exception:
        return []
    if r.status_code != 200:
        return []
    page = r.text
    pairs = re.findall(r'id="sheet-button-(\d+)"[^>]*>\s*<a[^>]*>([^<]*)</a>', page)
    if not pairs:
        pairs = re.findall(r'href="#gid=(\d+)"[^>]*>([^<]*)</a>', page)
    out = []
    seen = set()
    for gid, name in pairs:
        nm = htmllib.unescape(name).strip()
        if gid in seen or not nm:
            continue
        seen.add(gid)
        out.append({"gid": gid, "name": nm})
    return out


def _map_headers(header_row):
    m = {}
    for i, h in enumerate(header_row):
        nh = _norm(h)
        for field, syns in SOURCE_FIELD_SYNONYMS.items():
            if nh in [_norm(x) for x in syns]:
                m[i] = field
                break
    return m


async def _upsert_outreach_row(db, source_id, source_name, name, rec, cat_id, cat_name, group, user_id, now):
    """Insert-or-update one outreach row from a synced source. Deduped by
    (source, category, name). Returns (imported, updated) as 0/1."""
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
        "category_id": cat_id,
        "category_name": cat_name,
        "group": group,
        "source_id": source_id,
        "source_name": source_name,
        "updated_at": now,
    }
    existing = await db.bni_outreach.find_one(
        {
            "source_id": source_id,
            "category_name": cat_name,
            "name": {"$regex": f"^{re.escape(name)}$", "$options": "i"},
        },
        {"_id": 0, "outreach_id": 1},
    )
    if existing:
        await db.bni_outreach.update_one({"outreach_id": existing["outreach_id"]}, {"$set": fields})
        return 0, 1
    fields.update({"outreach_id": f"bniout_{uuid.uuid4().hex[:10]}", "created_by": user_id, "created_at": now})
    await db.bni_outreach.insert_one(fields)
    return 1, 0


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
    group = ""
    if payload.category_id:
        category = await db.bni_categories.find_one({"category_id": payload.category_id}, {"_id": 0, "name": 1, "group": 1})
        if category:
            category_name = category.get("name", "")
            group = category.get("group") or _group_from(category_name)

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
        "group": group,
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
        group = ""
        if update_data["category_id"]:
            category = await db.bni_categories.find_one({"category_id": update_data["category_id"]}, {"_id": 0, "name": 1, "group": 1})
            if category:
                category_name = category.get("name", "")
                group = category.get("group") or _group_from(category_name)
        update_data["category_name"] = category_name
        update_data["group"] = group
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


def _extract_row(row, header_map):
    rec = {}
    for i, field in header_map.items():
        rec[field] = row[i].strip() if i < len(row) else ""
    return rec


def _group_from(name):
    return name.split("(", 1)[0].strip() if "(" in (name or "") else (name or "")


@bni_outreach_sources_router.post("/{source_id}/sync")
async def sync_outreach_source(source_id: str, request: Request):
    """Sync a source Google Sheet into the outreach list. Each worksheet (tab)
    is treated as a category: the tab name is the category name, and the part
    before its first "(" is the group. Falls back to a single-CSV import (with
    a Category column) if the tabs can't be enumerated. Deduped by (source,
    category, name) so re-syncing updates rather than duplicates."""
    from server import get_current_user, db
    user = await get_current_user(request)
    source = await db.bni_outreach_sources.find_one({"source_id": source_id}, {"_id": 0})
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")
    sheet_id = _sheet_id(source.get("sheet_url", ""))
    if not sheet_id:
        raise HTTPException(status_code=400, detail="This source is not a valid Google Sheets link")

    cats = await db.bni_categories.find({}, {"_id": 0, "category_id": 1, "name": 1}).to_list(2000)
    cat_by_name = {_norm(c["name"]): c for c in cats}
    source_name = source.get("name", "")
    now = datetime.now(timezone.utc).isoformat()
    imported = 0
    updated = 0
    total = 0

    async with httpx.AsyncClient(follow_redirects=True, timeout=30.0) as client:
        worksheets = await _fetch_worksheets(client, sheet_id)

        if worksheets:
            # Per-tab: tab name = category, before "(" = group.
            for ws in worksheets:
                try:
                    resp = await client.get(f"https://docs.google.com/spreadsheets/d/{sheet_id}/export?format=csv&gid={ws['gid']}")
                except Exception:
                    continue
                if resp.status_code != 200 or "text/csv" not in (resp.headers.get("content-type") or ""):
                    continue
                rows = list(csv.reader(io.StringIO(resp.text)))
                if not rows:
                    continue
                header_map = _map_headers(rows[0])
                if "name" not in header_map.values():
                    continue
                cat = cat_by_name.get(_norm(ws["name"]))
                cat_id = cat["category_id"] if cat else ""
                cat_name = ws["name"]
                group = _group_from(ws["name"])
                for row in rows[1:]:
                    rec = _extract_row(row, header_map)
                    name = (rec.get("name") or "").strip()
                    if not name:
                        continue
                    total += 1
                    i_add, u_add = await _upsert_outreach_row(db, source_id, source_name, name, rec, cat_id, cat_name, group, user.user_id, now)
                    imported += i_add
                    updated += u_add
        else:
            # Fallback: single sheet, category comes from a Category column.
            csv_url = _sheet_csv_url(source.get("sheet_url", ""))
            try:
                resp = await client.get(csv_url)
            except Exception:
                raise HTTPException(status_code=400, detail="Could not reach the sheet. Check the link and try again.")
            if resp.status_code != 200 or "text/csv" not in (resp.headers.get("content-type") or ""):
                raise HTTPException(status_code=400, detail="Could not read the sheet — share it as 'Anyone with the link can view'.")
            rows = list(csv.reader(io.StringIO(resp.text)))
            if not rows:
                raise HTTPException(status_code=400, detail="The sheet is empty")
            header_map = _map_headers(rows[0])
            if "name" not in header_map.values():
                raise HTTPException(status_code=400, detail="The sheet needs a 'Name' column")
            for row in rows[1:]:
                rec = _extract_row(row, header_map)
                name = (rec.get("name") or "").strip()
                if not name:
                    continue
                total += 1
                cat = cat_by_name.get(_norm(rec.get("category", "")))
                cat_id = cat["category_id"] if cat else ""
                cat_name = cat["name"] if cat else rec.get("category", "")
                group = _group_from(cat_name)
                i_add, u_add = await _upsert_outreach_row(db, source_id, source_name, name, rec, cat_id, cat_name, group, user.user_id, now)
                imported += i_add
                updated += u_add

    await db.bni_outreach_sources.update_one(
        {"source_id": source_id},
        {"$set": {"last_synced_at": now, "last_row_count": total}},
    )
    return {"imported": imported, "updated": updated, "total_rows": total}
