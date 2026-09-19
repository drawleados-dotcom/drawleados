"""
Sales Kit — Form Creation (requirement-gathering form builder).

Lets Sales build any number of independent custom forms — each with
multiple pages and an unlimited number of drag-and-drop-ordered fields —
share a public link for a prospect to fill in (no login required), and
review submissions as rows in a per-form responses table.
"""
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
import uuid
import secrets

sales_kit_router = APIRouter(prefix="/sales-kit", tags=["Sales Kit"])
db = None


def init_sales_kit_db(database):
    global db
    db = database


# ============== MODELS ==============

FIELD_TYPES = {
    "short_text", "long_text", "number", "email", "phone", "date",
    "dropdown", "radio", "checkbox", "section_heading",
}


class FormField(BaseModel):
    field_id: Optional[str] = None
    type: str = "short_text"
    label: str = "Untitled question"
    placeholder: str = ""
    required: bool = False
    options: List[str] = []  # for dropdown / radio / checkbox
    order: int = 0


class FormPage(BaseModel):
    page_id: Optional[str] = None
    title: str = "Page 1"
    order: int = 0
    fields: List[FormField] = []


class FormCreate(BaseModel):
    title: str
    description: str = ""
    pages: List[FormPage] = []


class FormUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    pages: Optional[List[FormPage]] = None
    status: Optional[str] = None  # draft, published


class FormResponseSubmit(BaseModel):
    answers: Dict[str, Any] = {}  # field_id -> value


class PortfolioCreate(BaseModel):
    service_name: str
    service_type: str = ""  # which company service this relates to (from Settings > Services)
    link_type: str = ""     # Portfolio | Case Study | Testimonials | Proposal Template
    portfolio_link: str  # external URL the portfolio actually lives at


class PortfolioLeadSubmit(BaseModel):
    name: str
    email: str


# ============== AUTH HELPER ==============

async def get_current_user_from_request(request: Request) -> dict:
    session_token = request.cookies.get("session_token")
    if not session_token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            session_token = auth_header.split(" ")[1]
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    session_doc = await db.user_sessions.find_one({"session_token": session_token}, {"_id": 0})
    if not session_doc:
        raise HTTPException(status_code=401, detail="Invalid session")

    expires_at = session_doc["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")

    user_doc = await db.users.find_one({"user_id": session_doc["user_id"]}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=401, detail="User not found")
    return user_doc


def _normalize_pages(pages: List[FormPage]) -> List[dict]:
    normalized = []
    for p_idx, page in enumerate(pages):
        page_dict = page.dict()
        page_dict["page_id"] = page_dict.get("page_id") or str(uuid.uuid4())
        page_dict["order"] = p_idx
        fields = []
        for f_idx, field in enumerate(page_dict.get("fields") or []):
            field["field_id"] = field.get("field_id") or str(uuid.uuid4())
            if field.get("type") not in FIELD_TYPES:
                field["type"] = "short_text"
            field["order"] = f_idx
            fields.append(field)
        page_dict["fields"] = fields
        normalized.append(page_dict)
    return normalized


def _form_out(doc: dict) -> dict:
    doc.pop("_id", None)
    return doc


# ============== FORMS ==============

@sales_kit_router.get("/forms")
async def get_forms(request: Request):
    user = await get_current_user_from_request(request)
    forms = await db.sales_kit_forms.find({"is_deleted": {"$ne": True}}, {"_id": 0}).sort("created_at", -1).to_list(10000)

    form_ids = [f["form_id"] for f in forms]
    counts: Dict[str, int] = {}
    if form_ids:
        cursor = db.sales_kit_responses.aggregate([
            {"$match": {"form_id": {"$in": form_ids}}},
            {"$group": {"_id": "$form_id", "count": {"$sum": 1}}},
        ])
        async for row in cursor:
            counts[row["_id"]] = row["count"]

    for f in forms:
        f["response_count"] = counts.get(f["form_id"], 0)
        f["field_count"] = sum(len(p.get("fields") or []) for p in f.get("pages") or [])
    return forms


@sales_kit_router.post("/forms")
async def create_form(payload: FormCreate, request: Request):
    user = await get_current_user_from_request(request)
    now = datetime.now(timezone.utc)
    pages = _normalize_pages(payload.pages) if payload.pages else [
        {"page_id": str(uuid.uuid4()), "title": "Page 1", "order": 0, "fields": []}
    ]
    doc = {
        "form_id": str(uuid.uuid4()),
        "title": payload.title,
        "description": payload.description,
        "pages": pages,
        "status": "draft",
        "share_token": secrets.token_urlsafe(16),
        "created_by": user.get("user_id"),
        "created_by_name": user.get("name"),
        "created_at": now,
        "updated_at": now,
        "is_deleted": False,
    }
    await db.sales_kit_forms.insert_one(dict(doc))
    return _form_out(doc)


@sales_kit_router.get("/forms/{form_id}")
async def get_form(form_id: str, request: Request):
    await get_current_user_from_request(request)
    doc = await db.sales_kit_forms.find_one({"form_id": form_id, "is_deleted": {"$ne": True}}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Form not found")
    return doc


@sales_kit_router.put("/forms/{form_id}")
async def update_form(form_id: str, payload: FormUpdate, request: Request):
    await get_current_user_from_request(request)
    existing = await db.sales_kit_forms.find_one({"form_id": form_id, "is_deleted": {"$ne": True}})
    if not existing:
        raise HTTPException(status_code=404, detail="Form not found")

    update: Dict[str, Any] = {"updated_at": datetime.now(timezone.utc)}
    if payload.title is not None:
        update["title"] = payload.title
    if payload.description is not None:
        update["description"] = payload.description
    if payload.pages is not None:
        update["pages"] = _normalize_pages(payload.pages)
    if payload.status is not None:
        if payload.status not in ("draft", "published"):
            raise HTTPException(status_code=400, detail="Invalid status")
        update["status"] = payload.status

    await db.sales_kit_forms.update_one({"form_id": form_id}, {"$set": update})
    doc = await db.sales_kit_forms.find_one({"form_id": form_id}, {"_id": 0})
    return doc


@sales_kit_router.delete("/forms/{form_id}")
async def delete_form(form_id: str, request: Request):
    await get_current_user_from_request(request)
    result = await db.sales_kit_forms.update_one(
        {"form_id": form_id},
        {"$set": {"is_deleted": True, "deleted_at": datetime.now(timezone.utc)}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Form not found")
    return {"message": "Form deleted"}


@sales_kit_router.post("/forms/{form_id}/duplicate")
async def duplicate_form(form_id: str, request: Request):
    user = await get_current_user_from_request(request)
    existing = await db.sales_kit_forms.find_one({"form_id": form_id, "is_deleted": {"$ne": True}}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Form not found")

    now = datetime.now(timezone.utc)
    stripped_pages = []
    for p in existing.get("pages") or []:
        p = dict(p)
        p["page_id"] = None
        p["fields"] = [{**f, "field_id": None} for f in p.get("fields") or []]
        stripped_pages.append(p)
    new_pages = _normalize_pages([FormPage(**p) for p in stripped_pages])
    doc = {
        "form_id": str(uuid.uuid4()),
        "title": f"{existing['title']} (Copy)",
        "description": existing.get("description", ""),
        "pages": new_pages,
        "status": "draft",
        "share_token": secrets.token_urlsafe(16),
        "created_by": user.get("user_id"),
        "created_by_name": user.get("name"),
        "created_at": now,
        "updated_at": now,
        "is_deleted": False,
    }
    await db.sales_kit_forms.insert_one(dict(doc))
    return _form_out(doc)


# ============== RESPONSES (authenticated review) ==============

@sales_kit_router.get("/forms/{form_id}/responses")
async def get_form_responses(form_id: str, request: Request):
    await get_current_user_from_request(request)
    form = await db.sales_kit_forms.find_one({"form_id": form_id, "is_deleted": {"$ne": True}}, {"_id": 0})
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    responses = await db.sales_kit_responses.find({"form_id": form_id}, {"_id": 0}).sort("submitted_at", -1).to_list(50000)
    return {"form": form, "responses": responses}


@sales_kit_router.delete("/responses/{response_id}")
async def delete_response(response_id: str, request: Request):
    await get_current_user_from_request(request)
    result = await db.sales_kit_responses.delete_one({"response_id": response_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Response not found")
    return {"message": "Response deleted"}


# ============== PORTFOLIO ==============
# Two links per portfolio item, both pointing at an externally-hosted
# portfolio_link (Drive, Behance, your own site — wherever it actually
# lives) rather than a file this app stores:
#   - public link  -> logs a click, then redirects straight there. No
#     form, no gate — for pasting anywhere (email signature, social post).
#   - private link -> shows a name + email gate first; only after that
#     submission does it redirect. Each submission is a "response" row,
#     same shape as Sales Kit's Form responses.

@sales_kit_router.get("/portfolios")
async def get_portfolios(request: Request):
    await get_current_user_from_request(request)
    portfolios = await db.sales_kit_portfolios.find(
        {"is_deleted": {"$ne": True}}, {"_id": 0}
    ).sort("created_at", -1).to_list(10000)

    portfolio_ids = [p["portfolio_id"] for p in portfolios]
    response_counts: Dict[str, int] = {}
    click_counts: Dict[str, int] = {}
    if portfolio_ids:
        cursor = db.sales_kit_portfolio_responses.aggregate([
            {"$match": {"portfolio_id": {"$in": portfolio_ids}}},
            {"$group": {"_id": "$portfolio_id", "count": {"$sum": 1}}},
        ])
        async for row in cursor:
            response_counts[row["_id"]] = row["count"]
        cursor = db.sales_kit_portfolio_clicks.aggregate([
            {"$match": {"portfolio_id": {"$in": portfolio_ids}}},
            {"$group": {"_id": "$portfolio_id", "count": {"$sum": 1}}},
        ])
        async for row in cursor:
            click_counts[row["_id"]] = row["count"]
    for p in portfolios:
        p["response_count"] = response_counts.get(p["portfolio_id"], 0)
        p["click_count"] = click_counts.get(p["portfolio_id"], 0)
    return portfolios


@sales_kit_router.post("/portfolios")
async def create_portfolio(payload: PortfolioCreate, request: Request):
    user = await get_current_user_from_request(request)
    if not payload.service_name.strip():
        raise HTTPException(status_code=400, detail="Service name is required")
    if not payload.portfolio_link.strip():
        raise HTTPException(status_code=400, detail="Portfolio link is required")
    link = payload.portfolio_link.strip()
    if not (link.startswith("http://") or link.startswith("https://")):
        link = f"https://{link}"

    now = datetime.now(timezone.utc)
    doc = {
        "portfolio_id": str(uuid.uuid4()),
        "service_name": payload.service_name.strip(),
        "service_type": payload.service_type,
        "link_type": payload.link_type,
        "portfolio_link": link,
        "share_token": secrets.token_urlsafe(16),    # public link
        "private_token": secrets.token_urlsafe(16),  # private (lead-gated) link
        "created_by": user.get("user_id"),
        "created_by_name": user.get("name"),
        "created_at": now,
        "is_deleted": False,
    }
    await db.sales_kit_portfolios.insert_one(dict(doc))
    doc.pop("_id", None)
    return doc


@sales_kit_router.delete("/portfolios/{portfolio_id}")
async def delete_portfolio(portfolio_id: str, request: Request):
    await get_current_user_from_request(request)
    result = await db.sales_kit_portfolios.update_one(
        {"portfolio_id": portfolio_id},
        {"$set": {"is_deleted": True, "deleted_at": datetime.now(timezone.utc)}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    return {"message": "Portfolio deleted"}


@sales_kit_router.get("/portfolios/{portfolio_id}/responses")
async def get_portfolio_responses(portfolio_id: str, request: Request):
    await get_current_user_from_request(request)
    portfolio = await db.sales_kit_portfolios.find_one(
        {"portfolio_id": portfolio_id, "is_deleted": {"$ne": True}}, {"_id": 0}
    )
    if not portfolio:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    responses = await db.sales_kit_portfolio_responses.find(
        {"portfolio_id": portfolio_id}, {"_id": 0}
    ).sort("submitted_at", -1).to_list(50000)
    clicks = await db.sales_kit_portfolio_clicks.find(
        {"portfolio_id": portfolio_id}, {"_id": 0}
    ).sort("clicked_at", -1).to_list(50000)
    return {"portfolio": portfolio, "responses": responses, "clicks": clicks}


@sales_kit_router.delete("/portfolio-responses/{response_id}")
async def delete_portfolio_response(response_id: str, request: Request):
    await get_current_user_from_request(request)
    result = await db.sales_kit_portfolio_responses.delete_one({"response_id": response_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Response not found")
    return {"message": "Response deleted"}


# ============== PUBLIC (no auth — respondent-facing) ==============

@sales_kit_router.get("/public/portfolio/{share_token}")
async def visit_public_portfolio(share_token: str):
    """The public link itself — no page, no gate. Logs a click and
    redirects straight to the real portfolio_link. Safe to paste anywhere."""
    doc = await db.sales_kit_portfolios.find_one(
        {"share_token": share_token, "is_deleted": {"$ne": True}}, {"_id": 0}
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Portfolio not available")

    await db.sales_kit_portfolio_clicks.insert_one({
        "click_id": str(uuid.uuid4()),
        "portfolio_id": doc["portfolio_id"],
        "clicked_at": datetime.now(timezone.utc),
    })
    return RedirectResponse(url=doc["portfolio_link"])


@sales_kit_router.get("/public/portfolio-private/{private_token}")
async def get_private_portfolio(private_token: str):
    doc = await db.sales_kit_portfolios.find_one(
        {"private_token": private_token, "is_deleted": {"$ne": True}}, {"_id": 0}
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Portfolio not available")
    # Name + type only — portfolio_link is withheld until they submit
    # their name + email via /unlock below.
    return {
        "portfolio_id": doc["portfolio_id"],
        "service_name": doc["service_name"],
        "service_type": doc.get("service_type", ""),
        "link_type": doc.get("link_type", ""),
    }


@sales_kit_router.post("/public/portfolio-private/{private_token}/unlock")
async def unlock_private_portfolio(private_token: str, payload: PortfolioLeadSubmit):
    doc = await db.sales_kit_portfolios.find_one(
        {"private_token": private_token, "is_deleted": {"$ne": True}}, {"_id": 0}
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Portfolio not available")
    if not payload.name.strip() or not payload.email.strip():
        raise HTTPException(status_code=400, detail="Name and email are required")

    response_doc = {
        "response_id": str(uuid.uuid4()),
        "portfolio_id": doc["portfolio_id"],
        "name": payload.name.strip(),
        "email": payload.email.strip(),
        "submitted_at": datetime.now(timezone.utc),
    }
    await db.sales_kit_portfolio_responses.insert_one(dict(response_doc))

    return {
        "service_name": doc["service_name"],
        "portfolio_link": doc["portfolio_link"],
    }


@sales_kit_router.get("/public/{share_token}")
async def get_public_form(share_token: str):
    doc = await db.sales_kit_forms.find_one(
        {"share_token": share_token, "is_deleted": {"$ne": True}}, {"_id": 0}
    )
    if not doc or doc.get("status") != "published":
        raise HTTPException(status_code=404, detail="Form not available")
    # Respondents only need the structure, not internal ownership metadata.
    return {
        "form_id": doc["form_id"],
        "title": doc["title"],
        "description": doc.get("description", ""),
        "pages": doc.get("pages", []),
    }


@sales_kit_router.post("/public/{share_token}/submit")
async def submit_public_form(share_token: str, payload: FormResponseSubmit):
    form = await db.sales_kit_forms.find_one(
        {"share_token": share_token, "is_deleted": {"$ne": True}}, {"_id": 0}
    )
    if not form or form.get("status") != "published":
        raise HTTPException(status_code=404, detail="Form not available")

    valid_field_ids = {
        f["field_id"] for p in form.get("pages") or [] for f in p.get("fields") or []
        if f.get("type") != "section_heading"
    }
    answers = {k: v for k, v in (payload.answers or {}).items() if k in valid_field_ids}

    doc = {
        "response_id": str(uuid.uuid4()),
        "form_id": form["form_id"],
        "answers": answers,
        "submitted_at": datetime.now(timezone.utc),
    }
    await db.sales_kit_responses.insert_one(dict(doc))
    return {"message": "Response submitted", "response_id": doc["response_id"]}
