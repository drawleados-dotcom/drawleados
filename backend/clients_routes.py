"""
Finance Clients/Customers Routes
Manages the master list of clients used across invoices.
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import uuid

clients_router = APIRouter(prefix="/finance/clients")
db = None


def init_clients_db(database):
    global db
    db = database


# ============== MODELS ==============

class ClientCreate(BaseModel):
    customer_type: str = "Business"  # Business | Individual
    salutation: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    company_name: Optional[str] = None
    display_name: str
    currency: str = "INR"
    email: Optional[str] = None
    work_phone: Optional[str] = None
    mobile: Optional[str] = None
    customer_language: str = "English"
    # GST
    gst_treatment: Optional[str] = None  # Registered Business - Regular, Unregistered, Composition, Consumer, etc.
    place_of_supply: Optional[str] = None
    gstin: Optional[str] = None
    pan: Optional[str] = None
    tax_preference: str = "Taxable"  # Taxable | Tax Exempt
    payment_terms: str = "Due on Receipt"
    enable_portal: bool = False
    # Addresses
    billing_address: Optional[str] = None
    billing_city: Optional[str] = None
    billing_state: Optional[str] = None
    billing_pincode: Optional[str] = None
    billing_country: str = "India"
    shipping_address: Optional[str] = None
    shipping_city: Optional[str] = None
    shipping_state: Optional[str] = None
    shipping_pincode: Optional[str] = None
    shipping_country: str = "India"
    remarks: Optional[str] = None


class ClientUpdate(BaseModel):
    customer_type: Optional[str] = None
    salutation: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    company_name: Optional[str] = None
    display_name: Optional[str] = None
    currency: Optional[str] = None
    email: Optional[str] = None
    work_phone: Optional[str] = None
    mobile: Optional[str] = None
    customer_language: Optional[str] = None
    gst_treatment: Optional[str] = None
    place_of_supply: Optional[str] = None
    gstin: Optional[str] = None
    pan: Optional[str] = None
    tax_preference: Optional[str] = None
    payment_terms: Optional[str] = None
    enable_portal: Optional[bool] = None
    billing_address: Optional[str] = None
    billing_city: Optional[str] = None
    billing_state: Optional[str] = None
    billing_pincode: Optional[str] = None
    billing_country: Optional[str] = None
    shipping_address: Optional[str] = None
    shipping_city: Optional[str] = None
    shipping_state: Optional[str] = None
    shipping_pincode: Optional[str] = None
    shipping_country: Optional[str] = None
    remarks: Optional[str] = None


# ============== AUTH HELPER ==============

async def get_current_user_from_request(request: Request) -> dict:
    session_token = request.cookies.get("session_token")
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
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


# ============== HELPERS ==============

async def _compute_client_summary(client_id: str) -> dict:
    """Aggregate invoice stats for a single client."""
    invoices = await db.invoices.find(
        {"client_id": client_id, "is_deleted": False},
        {"_id": 0, "invoice_id": 1, "invoice_number": 1, "invoice_date": 1,
         "due_date": 1, "status": 1, "total_amount": 1, "paid_amount": 1,
         "balance_due": 1, "payment_status": 1, "payment_date": 1}
    ).sort("invoice_date", -1).to_list(1000)

    total_invoiced = sum(float(i.get("total_amount") or 0) for i in invoices)
    total_paid = sum(float(i.get("paid_amount") or 0) for i in invoices)
    outstanding = total_invoiced - total_paid

    last_invoice_date = invoices[0]["invoice_date"].isoformat() if invoices else None
    last_payment_date = None
    for inv in invoices:
        pdate = inv.get("payment_date")
        if pdate:
            iso = pdate.isoformat() if isinstance(pdate, datetime) else str(pdate)
            if not last_payment_date or iso > last_payment_date:
                last_payment_date = iso

    return {
        "total_invoiced": round(total_invoiced, 2),
        "total_paid": round(total_paid, 2),
        "outstanding": round(outstanding, 2),
        "invoice_count": len(invoices),
        "last_invoice_date": last_invoice_date,
        "last_payment_date": last_payment_date,
    }


def _normalize_doc(doc):
    """Convert datetime fields to ISO strings for JSON output."""
    if not doc:
        return doc
    for key in ("created_at", "updated_at"):
        if key in doc and isinstance(doc[key], datetime):
            doc[key] = doc[key].isoformat()
    return doc


# ============== ROUTES ==============

@clients_router.post("")
async def create_client(payload: ClientCreate, request: Request):
    current_user = await get_current_user_from_request(request)

    # Enforce unique display_name (case-insensitive, trimmed)
    display_name = (payload.display_name or "").strip()
    if not display_name:
        raise HTTPException(status_code=400, detail="Display name is required")

    existing = await db.finance_clients.find_one({
        "display_name_lower": display_name.lower(),
        "is_deleted": False,
    })
    if existing:
        raise HTTPException(status_code=400, detail="A client with this display name already exists")

    client_id = f"cli_{uuid.uuid4().hex[:12]}"
    doc = {
        "client_id": client_id,
        **payload.model_dump(),
        "display_name": display_name,
        "display_name_lower": display_name.lower(),
        "created_by": current_user["user_id"],
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "is_deleted": False,
    }
    await db.finance_clients.insert_one(doc)

    result = await db.finance_clients.find_one({"client_id": client_id}, {"_id": 0})
    return _normalize_doc(result)


@clients_router.get("")
async def list_clients(request: Request, include_summary: bool = True):
    await get_current_user_from_request(request)
    clients = await db.finance_clients.find(
        {"is_deleted": False}, {"_id": 0}
    ).sort("display_name", 1).to_list(2000)

    for c in clients:
        _normalize_doc(c)
        if include_summary:
            c["summary"] = await _compute_client_summary(c["client_id"])
    return clients


@clients_router.get("/{client_id}")
async def get_client(client_id: str, request: Request):
    await get_current_user_from_request(request)
    client = await db.finance_clients.find_one(
        {"client_id": client_id, "is_deleted": False}, {"_id": 0}
    )
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    _normalize_doc(client)
    client["summary"] = await _compute_client_summary(client_id)
    # Attach invoice list
    invoices = await db.invoices.find(
        {"client_id": client_id, "is_deleted": False}, {"_id": 0}
    ).sort("invoice_date", -1).to_list(500)
    for inv in invoices:
        for k in ("invoice_date", "due_date", "payment_date", "created_at", "updated_at"):
            if k in inv and isinstance(inv[k], datetime):
                inv[k] = inv[k].isoformat()
    client["invoices"] = invoices
    return client


@clients_router.put("/{client_id}")
async def update_client(client_id: str, payload: ClientUpdate, request: Request):
    await get_current_user_from_request(request)
    existing = await db.finance_clients.find_one({"client_id": client_id, "is_deleted": False})
    if not existing:
        raise HTTPException(status_code=404, detail="Client not found")

    update_data = payload.model_dump(exclude_unset=True)

    if "display_name" in update_data:
        new_name = (update_data["display_name"] or "").strip()
        if not new_name:
            raise HTTPException(status_code=400, detail="Display name cannot be empty")
        # Uniqueness check
        dup = await db.finance_clients.find_one({
            "display_name_lower": new_name.lower(),
            "client_id": {"$ne": client_id},
            "is_deleted": False,
        })
        if dup:
            raise HTTPException(status_code=400, detail="Another client already uses this display name")
        update_data["display_name"] = new_name
        update_data["display_name_lower"] = new_name.lower()

    update_data["updated_at"] = datetime.now(timezone.utc)
    await db.finance_clients.update_one({"client_id": client_id}, {"$set": update_data})

    result = await db.finance_clients.find_one({"client_id": client_id}, {"_id": 0})
    return _normalize_doc(result)


@clients_router.delete("/{client_id}")
async def delete_client(client_id: str, request: Request):
    await get_current_user_from_request(request)
    # Block deletion if invoices exist
    invoice_count = await db.invoices.count_documents({"client_id": client_id, "is_deleted": False})
    if invoice_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete client — {invoice_count} invoice(s) are linked. Delete those invoices first."
        )
    res = await db.finance_clients.update_one(
        {"client_id": client_id},
        {"$set": {"is_deleted": True, "updated_at": datetime.now(timezone.utc)}}
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Client not found")
    return {"message": "Client deleted"}


@clients_router.get("/{client_id}/summary")
async def client_summary(client_id: str, request: Request):
    await get_current_user_from_request(request)
    client = await db.finance_clients.find_one(
        {"client_id": client_id, "is_deleted": False}, {"_id": 0}
    )
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    summary = await _compute_client_summary(client_id)
    invoices = await db.invoices.find(
        {"client_id": client_id, "is_deleted": False}, {"_id": 0}
    ).sort("invoice_date", -1).to_list(500)
    for inv in invoices:
        for k in ("invoice_date", "due_date", "payment_date", "created_at", "updated_at"):
            if k in inv and isinstance(inv[k], datetime):
                inv[k] = inv[k].isoformat()
    return {"client": _normalize_doc(client), "summary": summary, "invoices": invoices}


@clients_router.post("/migrate-from-invoices")
async def migrate_clients_from_invoices(request: Request):
    """
    One-time migration: auto-create Client records from existing invoices'
    free-text client_name and link them back.
    Idempotent: safe to re-run.
    """
    current_user = await get_current_user_from_request(request)

    invoices = await db.invoices.find(
        {"is_deleted": False, "$or": [{"client_id": {"$exists": False}}, {"client_id": None}, {"client_id": ""}]},
        {"_id": 0}
    ).to_list(5000)

    created = 0
    linked = 0
    skipped = 0

    for inv in invoices:
        name = (inv.get("client_name") or "").strip()
        if not name:
            skipped += 1
            continue

        existing = await db.finance_clients.find_one({
            "display_name_lower": name.lower(),
            "is_deleted": False,
        })
        if existing:
            client_id = existing["client_id"]
        else:
            client_id = f"cli_{uuid.uuid4().hex[:12]}"
            await db.finance_clients.insert_one({
                "client_id": client_id,
                "customer_type": "Business",
                "display_name": name,
                "display_name_lower": name.lower(),
                "company_name": inv.get("client_company") or name,
                "currency": inv.get("currency", "INR"),
                "email": inv.get("client_email"),
                "work_phone": inv.get("client_phone"),
                "mobile": None,
                "customer_language": "English",
                "gst_treatment": None,
                "place_of_supply": inv.get("client_state"),
                "gstin": inv.get("client_gst_number"),
                "pan": inv.get("client_pan"),
                "tax_preference": "Taxable",
                "payment_terms": inv.get("payment_terms") or "Due on Receipt",
                "enable_portal": False,
                "billing_address": inv.get("client_address") or inv.get("billing_address"),
                "billing_city": inv.get("client_city"),
                "billing_state": inv.get("client_state"),
                "billing_pincode": inv.get("client_pincode"),
                "billing_country": inv.get("client_country") or "India",
                "shipping_address": inv.get("shipping_address"),
                "remarks": "Auto-created from invoice migration",
                "created_by": current_user["user_id"],
                "created_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc),
                "is_deleted": False,
            })
            created += 1

        await db.invoices.update_one(
            {"invoice_id": inv["invoice_id"]},
            {"$set": {"client_id": client_id}}
        )
        linked += 1

    return {
        "created_clients": created,
        "linked_invoices": linked,
        "skipped": skipped,
        "message": f"Migration complete: {created} new client(s), {linked} invoice(s) linked.",
    }
