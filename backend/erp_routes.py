"""
ERP Project Taxonomy + Board
============================
Layered taxonomy for ERP-department projects:
    User Designation → Pages → Sub-pages → Functions → Modules
…plus a `stage` axis on every task: developing | testing | bug.

Endpoints are scoped per project: `/api/projects/{project_id}/erp/...`
"""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import uuid

erp_router = APIRouter(prefix="/projects/{project_id}/erp")
db = None


def init_erp_db(database):
    global db
    db = database


# ---------- Models ----------
class _Named(BaseModel):
    name: str
    order: Optional[int] = 0


class ErpPageCreate(_Named):
    designation: Optional[str] = ""


class ErpPageUpdate(BaseModel):
    name: Optional[str] = None
    designation: Optional[str] = None
    order: Optional[int] = None


class ErpSubpageCreate(_Named):
    page_id: str


class ErpSubpageUpdate(BaseModel):
    name: Optional[str] = None
    order: Optional[int] = None


class ErpFunctionCreate(_Named):
    subpage_id: str


class ErpFunctionUpdate(BaseModel):
    name: Optional[str] = None
    order: Optional[int] = None


class ErpModuleCreate(_Named):
    function_id: str


class ErpModuleUpdate(BaseModel):
    name: Optional[str] = None
    order: Optional[int] = None


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _auth(request: Request):
    from server import get_current_user
    return await get_current_user(request)


# ---------- PAGES ----------
@erp_router.get("/pages")
async def list_pages(project_id: str, request: Request):
    await _auth(request)
    rows = await db.erp_pages.find({"project_id": project_id}, {"_id": 0}).sort([("order", 1), ("name", 1)]).to_list(2000)
    return rows


@erp_router.post("/pages")
async def create_page(project_id: str, payload: ErpPageCreate, request: Request):
    await _auth(request)
    doc = {
        "page_id": f"erpp_{uuid.uuid4().hex[:10]}",
        "project_id": project_id,
        "name": payload.name.strip(),
        "designation": (payload.designation or "").strip(),
        "order": payload.order or 0,
        "created_at": _now(),
    }
    if not doc["name"]:
        raise HTTPException(status_code=400, detail="name is required")
    await db.erp_pages.insert_one(doc)
    doc.pop("_id", None)
    return doc


@erp_router.patch("/pages/{page_id}")
async def update_page(project_id: str, page_id: str, payload: ErpPageUpdate, request: Request):
    await _auth(request)
    upd = {k: v for k, v in payload.model_dump(exclude_none=True).items()}
    if not upd:
        return {"message": "No changes"}
    upd["updated_at"] = _now()
    res = await db.erp_pages.update_one({"page_id": page_id, "project_id": project_id}, {"$set": upd})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Page not found")
    return {"message": "Updated"}


@erp_router.delete("/pages/{page_id}")
async def delete_page(project_id: str, page_id: str, request: Request):
    """Cascade delete: removes the page, its sub-pages, their functions and modules."""
    await _auth(request)
    sp_ids = [s["subpage_id"] for s in await db.erp_subpages.find(
        {"project_id": project_id, "page_id": page_id}, {"_id": 0, "subpage_id": 1}
    ).to_list(2000)]
    fn_ids = [f["function_id"] for f in await db.erp_functions.find(
        {"project_id": project_id, "subpage_id": {"$in": sp_ids}}, {"_id": 0, "function_id": 1}
    ).to_list(2000)]
    await db.erp_modules.delete_many({"project_id": project_id, "function_id": {"$in": fn_ids}})
    await db.erp_functions.delete_many({"project_id": project_id, "function_id": {"$in": fn_ids}})
    await db.erp_subpages.delete_many({"project_id": project_id, "subpage_id": {"$in": sp_ids}})
    res = await db.erp_pages.delete_one({"page_id": page_id, "project_id": project_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Page not found")
    return {"message": "Deleted"}


# ---------- SUB-PAGES ----------
@erp_router.get("/subpages")
async def list_subpages(project_id: str, request: Request, page_id: Optional[str] = None):
    await _auth(request)
    q: dict = {"project_id": project_id}
    if page_id:
        q["page_id"] = page_id
    rows = await db.erp_subpages.find(q, {"_id": 0}).sort([("order", 1), ("name", 1)]).to_list(5000)
    return rows


@erp_router.post("/subpages")
async def create_subpage(project_id: str, payload: ErpSubpageCreate, request: Request):
    await _auth(request)
    page = await db.erp_pages.find_one({"page_id": payload.page_id, "project_id": project_id}, {"_id": 0})
    if not page:
        raise HTTPException(status_code=400, detail="Parent page not found")
    doc = {
        "subpage_id": f"erps_{uuid.uuid4().hex[:10]}",
        "project_id": project_id,
        "page_id": payload.page_id,
        "name": payload.name.strip(),
        "order": payload.order or 0,
        "created_at": _now(),
    }
    if not doc["name"]:
        raise HTTPException(status_code=400, detail="name is required")
    await db.erp_subpages.insert_one(doc)
    doc.pop("_id", None)
    return doc


@erp_router.patch("/subpages/{subpage_id}")
async def update_subpage(project_id: str, subpage_id: str, payload: ErpSubpageUpdate, request: Request):
    await _auth(request)
    upd = {k: v for k, v in payload.model_dump(exclude_none=True).items()}
    if not upd:
        return {"message": "No changes"}
    upd["updated_at"] = _now()
    res = await db.erp_subpages.update_one({"subpage_id": subpage_id, "project_id": project_id}, {"$set": upd})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Sub-page not found")
    return {"message": "Updated"}


@erp_router.delete("/subpages/{subpage_id}")
async def delete_subpage(project_id: str, subpage_id: str, request: Request):
    await _auth(request)
    fn_ids = [f["function_id"] for f in await db.erp_functions.find(
        {"project_id": project_id, "subpage_id": subpage_id}, {"_id": 0, "function_id": 1}
    ).to_list(2000)]
    await db.erp_modules.delete_many({"project_id": project_id, "function_id": {"$in": fn_ids}})
    await db.erp_functions.delete_many({"project_id": project_id, "subpage_id": subpage_id})
    res = await db.erp_subpages.delete_one({"subpage_id": subpage_id, "project_id": project_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Sub-page not found")
    return {"message": "Deleted"}


# ---------- FUNCTIONS ----------
@erp_router.get("/functions")
async def list_functions(project_id: str, request: Request, subpage_id: Optional[str] = None):
    await _auth(request)
    q: dict = {"project_id": project_id}
    if subpage_id:
        q["subpage_id"] = subpage_id
    rows = await db.erp_functions.find(q, {"_id": 0}).sort([("order", 1), ("name", 1)]).to_list(5000)
    return rows


@erp_router.post("/functions")
async def create_function(project_id: str, payload: ErpFunctionCreate, request: Request):
    await _auth(request)
    sp = await db.erp_subpages.find_one({"subpage_id": payload.subpage_id, "project_id": project_id}, {"_id": 0})
    if not sp:
        raise HTTPException(status_code=400, detail="Parent sub-page not found")
    doc = {
        "function_id": f"erpf_{uuid.uuid4().hex[:10]}",
        "project_id": project_id,
        "subpage_id": payload.subpage_id,
        "page_id": sp.get("page_id"),  # denormalized for faster summary queries
        "name": payload.name.strip(),
        "order": payload.order or 0,
        "created_at": _now(),
    }
    if not doc["name"]:
        raise HTTPException(status_code=400, detail="name is required")
    await db.erp_functions.insert_one(doc)
    doc.pop("_id", None)
    return doc


@erp_router.patch("/functions/{function_id}")
async def update_function(project_id: str, function_id: str, payload: ErpFunctionUpdate, request: Request):
    await _auth(request)
    upd = {k: v for k, v in payload.model_dump(exclude_none=True).items()}
    if not upd:
        return {"message": "No changes"}
    upd["updated_at"] = _now()
    res = await db.erp_functions.update_one({"function_id": function_id, "project_id": project_id}, {"$set": upd})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Function not found")
    return {"message": "Updated"}


@erp_router.delete("/functions/{function_id}")
async def delete_function(project_id: str, function_id: str, request: Request):
    await _auth(request)
    await db.erp_modules.delete_many({"project_id": project_id, "function_id": function_id})
    res = await db.erp_functions.delete_one({"function_id": function_id, "project_id": project_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Function not found")
    return {"message": "Deleted"}


# ---------- MODULES ----------
@erp_router.get("/modules")
async def list_modules(project_id: str, request: Request, function_id: Optional[str] = None):
    await _auth(request)
    q: dict = {"project_id": project_id}
    if function_id:
        q["function_id"] = function_id
    rows = await db.erp_modules.find(q, {"_id": 0}).sort([("order", 1), ("name", 1)]).to_list(5000)
    return rows


@erp_router.post("/modules")
async def create_module(project_id: str, payload: ErpModuleCreate, request: Request):
    await _auth(request)
    fn = await db.erp_functions.find_one({"function_id": payload.function_id, "project_id": project_id}, {"_id": 0})
    if not fn:
        raise HTTPException(status_code=400, detail="Parent function not found")
    doc = {
        "module_id": f"erpm_{uuid.uuid4().hex[:10]}",
        "project_id": project_id,
        "function_id": payload.function_id,
        "subpage_id": fn.get("subpage_id"),
        "page_id": fn.get("page_id"),
        "name": payload.name.strip(),
        "order": payload.order or 0,
        "created_at": _now(),
    }
    if not doc["name"]:
        raise HTTPException(status_code=400, detail="name is required")
    await db.erp_modules.insert_one(doc)
    doc.pop("_id", None)
    return doc


@erp_router.patch("/modules/{module_id}")
async def update_module(project_id: str, module_id: str, payload: ErpModuleUpdate, request: Request):
    await _auth(request)
    upd = {k: v for k, v in payload.model_dump(exclude_none=True).items()}
    if not upd:
        return {"message": "No changes"}
    upd["updated_at"] = _now()
    res = await db.erp_modules.update_one({"module_id": module_id, "project_id": project_id}, {"$set": upd})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Module not found")
    return {"message": "Updated"}


@erp_router.delete("/modules/{module_id}")
async def delete_module(project_id: str, module_id: str, request: Request):
    await _auth(request)
    res = await db.erp_modules.delete_one({"module_id": module_id, "project_id": project_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Module not found")
    return {"message": "Deleted"}


# ---------- SUMMARY ----------
@erp_router.get("/summary")
async def erp_summary(project_id: str, request: Request):
    """Counts per taxonomy layer + per stage. Drives the filter strip on the
    ERP Board. We pull every layer with one batched call so the strip stays
    snappy even on large projects."""
    await _auth(request)

    pages = await db.erp_pages.find({"project_id": project_id}, {"_id": 0}).to_list(5000)
    subpages = await db.erp_subpages.find({"project_id": project_id}, {"_id": 0}).to_list(5000)
    functions = await db.erp_functions.find({"project_id": project_id}, {"_id": 0}).to_list(5000)
    modules = await db.erp_modules.find({"project_id": project_id}, {"_id": 0}).to_list(5000)

    # Unique designations across pages
    designations = sorted({(p.get("designation") or "").strip() for p in pages if (p.get("designation") or "").strip()})

    # Task counts by stage + per-layer counts
    pipeline = [
        {"$match": {"project_id": project_id}},
        {"$group": {
            "_id": None,
            "total": {"$sum": 1},
            "developing": {"$sum": {"$cond": [{"$eq": ["$erp_stage", "developing"]}, 1, 0]}},
            "testing": {"$sum": {"$cond": [{"$eq": ["$erp_stage", "testing"]}, 1, 0]}},
            "bug": {"$sum": {"$cond": [{"$eq": ["$erp_stage", "bug"]}, 1, 0]}},
        }},
    ]
    task_agg = await db.our_tasks.aggregate(pipeline).to_list(1)
    tk = task_agg[0] if task_agg else {"total": 0, "developing": 0, "testing": 0, "bug": 0}
    tk.pop("_id", None)

    return {
        "designations": designations,
        "counts": {
            "designations": len(designations),
            "pages": len(pages),
            "subpages": len(subpages),
            "functions": len(functions),
            "modules": len(modules),
            "tasks": tk.get("total", 0),
            "developing": tk.get("developing", 0),
            "testing": tk.get("testing", 0),
            "bug": tk.get("bug", 0),
        },
        "pages": pages,
        "subpages": subpages,
        "functions": functions,
        "modules": modules,
    }


# ---------- BOARD TASKS ----------
@erp_router.get("/tasks")
async def list_erp_tasks(
    project_id: str,
    request: Request,
    designation: Optional[str] = None,
    page_id: Optional[str] = None,
    subpage_id: Optional[str] = None,
    function_id: Optional[str] = None,
    module_id: Optional[str] = None,
    stage: Optional[str] = None,
):
    """Return tasks belonging to this project, optionally filtered by any
    layer. Designation filter matches against either the assignee's
    designation OR the parent page's designation."""
    await _auth(request)
    q: dict = {"project_id": project_id}
    if page_id:
        q["erp_page_id"] = page_id
    if subpage_id:
        q["erp_subpage_id"] = subpage_id
    if function_id:
        q["erp_function_id"] = function_id
    if module_id:
        q["erp_module_id"] = module_id
    if stage:
        q["erp_stage"] = stage
    if designation:
        q["erp_designation"] = designation
    rows = await db.our_tasks.find(q, {"_id": 0}).sort("created_at", -1).to_list(5000)
    return rows
