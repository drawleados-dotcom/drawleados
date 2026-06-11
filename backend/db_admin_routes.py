"""
Database Admin Tools — Export / Import collections for backup, migration to VPS.

Restricted to super_admin and admin only.
"""
import io
import json
import zipfile
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from bson import ObjectId
from fastapi import APIRouter, HTTPException, Request, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

db_admin_router = APIRouter(prefix="/admin/db", tags=["Database Admin"])
_db = None  # set by init_db_admin


def init_db_admin(database):
    global _db
    _db = database


def _bson_to_json_safe(obj: Any) -> Any:
    """Recursively convert BSON types (ObjectId, datetime) to JSON-safe primitives."""
    if isinstance(obj, ObjectId):
        return str(obj)
    if isinstance(obj, datetime):
        return obj.isoformat()
    if isinstance(obj, dict):
        return {k: _bson_to_json_safe(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_bson_to_json_safe(v) for v in obj]
    return obj


async def _require_admin(request: Request):
    from server import get_current_user
    user = await get_current_user(request)
    role = (user.role or "").lower()
    if role not in ("super_admin", "admin"):
        raise HTTPException(status_code=403, detail="Admin access required for database tools")
    return user


# System collections we never expose to import/export tooling
SYSTEM_BLOCKLIST = {"user_sessions", "google_oauth_states", "password_otps"}


@db_admin_router.get("/collections")
async def list_collections(request: Request):
    """List every collection in the database with its document count + size estimate."""
    await _require_admin(request)
    names = sorted(await _db.list_collection_names())
    result: List[Dict[str, Any]] = []
    for name in names:
        try:
            count = await _db[name].count_documents({})
        except Exception:
            count = 0
        result.append({
            "name": name,
            "count": count,
            "is_system": name in SYSTEM_BLOCKLIST,
        })
    return {"db_name": _db.name, "collections": result}


@db_admin_router.get("/export/{collection}")
async def export_collection(collection: str, request: Request):
    """Stream the entire collection as a single JSON file."""
    await _require_admin(request)
    if collection in SYSTEM_BLOCKLIST:
        raise HTTPException(status_code=400, detail="System collection cannot be exported")
    if collection not in (await _db.list_collection_names()):
        raise HTTPException(status_code=404, detail="Collection not found")

    docs = await _db[collection].find({}).to_list(length=None)
    payload = {
        "db_name": _db.name,
        "collection": collection,
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "count": len(docs),
        "documents": [_bson_to_json_safe(d) for d in docs],
    }
    body = json.dumps(payload, indent=2, default=str).encode("utf-8")
    filename = f"{collection}-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}.json"
    return StreamingResponse(
        io.BytesIO(body),
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@db_admin_router.get("/export-all")
async def export_all(request: Request):
    """Zip every (non-system) collection into a single download."""
    await _require_admin(request)
    names = sorted(await _db.list_collection_names())

    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        manifest = {
            "db_name": _db.name,
            "exported_at": datetime.now(timezone.utc).isoformat(),
            "collections": [],
        }
        for name in names:
            if name in SYSTEM_BLOCKLIST:
                continue
            docs = await _db[name].find({}).to_list(length=None)
            payload = {
                "db_name": _db.name,
                "collection": name,
                "count": len(docs),
                "documents": [_bson_to_json_safe(d) for d in docs],
            }
            zf.writestr(f"{name}.json", json.dumps(payload, indent=2, default=str))
            manifest["collections"].append({"name": name, "count": len(docs)})
        zf.writestr("_manifest.json", json.dumps(manifest, indent=2))

    buffer.seek(0)
    filename = f"drawlead-db-backup-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}.zip"
    return StreamingResponse(
        buffer,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@db_admin_router.post("/import/{collection}")
async def import_collection(
    collection: str,
    request: Request,
    file: UploadFile = File(...),
    mode: str = Form("append"),  # "append" | "replace"
):
    """Restore a previously-exported JSON file into a collection.

    - **append**: insert documents into the existing collection.
    - **replace**: wipe the collection first, then insert (DESTRUCTIVE).
    """
    await _require_admin(request)
    if collection in SYSTEM_BLOCKLIST:
        raise HTTPException(status_code=400, detail="System collection cannot be imported")
    mode = (mode or "append").lower()
    if mode not in ("append", "replace"):
        raise HTTPException(status_code=400, detail="mode must be 'append' or 'replace'")

    try:
        raw = await file.read()
        data = json.loads(raw.decode("utf-8"))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid JSON file: {e}") from e

    documents = data.get("documents") if isinstance(data, dict) else data
    if not isinstance(documents, list):
        raise HTTPException(status_code=400, detail="Expected an array of documents (or { documents: [...] })")

    # Strip _id fields that came back as strings to avoid ObjectId conflicts
    for doc in documents:
        if isinstance(doc, dict) and "_id" in doc and not isinstance(doc["_id"], ObjectId):
            # Keep original id in a side field if it's not already represented elsewhere
            doc.pop("_id", None)

    deleted = 0
    if mode == "replace":
        res = await _db[collection].delete_many({})
        deleted = res.deleted_count

    inserted = 0
    if documents:
        insert_res = await _db[collection].insert_many(documents)
        inserted = len(insert_res.inserted_ids)

    return {
        "collection": collection,
        "mode": mode,
        "deleted": deleted,
        "inserted": inserted,
    }


class WipeRequest(BaseModel):
    confirm_text: str
    collection: Optional[str] = None  # if None → wipe all non-system


@db_admin_router.post("/wipe")
async def wipe_collection(payload: WipeRequest, request: Request):
    """Dangerous: clear a single collection (or all non-system) — requires confirm_text=WIPE."""
    await _require_admin(request)
    if payload.confirm_text != "WIPE":
        raise HTTPException(status_code=400, detail="confirm_text must equal 'WIPE'")
    if payload.collection:
        if payload.collection in SYSTEM_BLOCKLIST:
            raise HTTPException(status_code=400, detail="System collection cannot be wiped")
        res = await _db[payload.collection].delete_many({})
        return {"collection": payload.collection, "deleted": res.deleted_count}
    total = 0
    for name in await _db.list_collection_names():
        if name in SYSTEM_BLOCKLIST:
            continue
        res = await _db[name].delete_many({})
        total += res.deleted_count
    return {"collection": "ALL", "deleted": total}
