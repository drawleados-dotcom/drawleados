"""
Quotation routes — lead-scoped quotation documents.

Opened from the Leads page when a lead's stage flips to a stage named
"Quotation" (or similar), same trigger pattern as the existing Invoice
Raise modal. Creates a line-itemed quotation (with GST per line) against
the lead and generates a clean, printable PDF.
"""
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone
import uuid
import io
import os

quotation_router = APIRouter(prefix="/quotations", tags=["quotations"])
db = None


def init_quotation_db(database):
    global db
    db = database


class QuotationItemIn(BaseModel):
    service: str
    amount: float = 0
    gst_percent: float = 0  # 0 or 18


class QuotationCreate(BaseModel):
    lead_id: str
    name: str
    address: Optional[str] = ""
    business_name: Optional[str] = ""
    quotation_date: Optional[str] = None  # ISO date, defaults to today
    due_date: Optional[str] = None
    items: List[QuotationItemIn]


def _compute_items(items: List[QuotationItemIn]):
    out = []
    grand_total = 0.0
    for idx, it in enumerate(items, 1):
        amount = float(it.amount or 0)
        gst_percent = float(it.gst_percent or 0)
        gst_amount = round(amount * gst_percent / 100, 2)
        total = round(amount + gst_amount, 2)
        grand_total += total
        out.append({
            "sno": idx,
            "service": it.service,
            "amount": amount,
            "gst_percent": gst_percent,
            "gst_amount": gst_amount,
            "total": total,
        })
    return out, round(grand_total, 2)


@quotation_router.post("")
async def create_quotation(payload: QuotationCreate, request: Request):
    from server import get_current_user
    user = await get_current_user(request)

    if not payload.items:
        raise HTTPException(status_code=400, detail="At least one line item is required")

    lead = await db.leads_v2.find_one({"lead_id": payload.lead_id, "is_deleted": {"$ne": True}})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    items, grand_total = _compute_items(payload.items)

    now = datetime.now(timezone.utc)
    year = now.year
    # Sequential-looking number: count this year's quotations + 1. Not
    # globally atomic, but collisions are effectively impossible for this
    # volume and the quotation_id (uuid) is the real unique key.
    count_this_year = await db.lead_quotations.count_documents({
        "quotation_number": {"$regex": f"^QUO-{year}-"}
    })
    quotation_number = f"QUO-{year}-{count_this_year + 1:04d}"

    quotation_id = f"quo_{uuid.uuid4().hex[:12]}"
    doc = {
        "quotation_id": quotation_id,
        "quotation_number": quotation_number,
        "lead_id": payload.lead_id,
        "name": payload.name.strip(),
        "address": (payload.address or "").strip(),
        "business_name": (payload.business_name or "").strip(),
        "quotation_date": payload.quotation_date or now.date().isoformat(),
        "due_date": payload.due_date or "",
        "items": items,
        "grand_total": grand_total,
        "created_by": user.user_id,
        "created_by_name": user.name,
        "created_at": now,
        "updated_at": now,
    }
    await db.lead_quotations.insert_one(doc)

    # Stamp the lead so the Leads table can show a "View Quotation" link
    # without an extra lookup per row.
    await db.leads_v2.update_one(
        {"lead_id": payload.lead_id},
        {"$set": {
            "quotation_id": quotation_id,
            "quotation_link": f"/api/quotations/{quotation_id}/pdf",
        }},
    )

    doc.pop("_id", None)
    return doc


@quotation_router.get("/by-lead/{lead_id}")
async def list_quotations_for_lead(lead_id: str, request: Request):
    from server import get_current_user
    await get_current_user(request)
    rows = await db.lead_quotations.find(
        {"lead_id": lead_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    return rows


@quotation_router.get("/{quotation_id}")
async def get_quotation(quotation_id: str, request: Request):
    from server import get_current_user
    await get_current_user(request)
    doc = await db.lead_quotations.find_one({"quotation_id": quotation_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Quotation not found")
    return doc


_FONT_DIR = os.path.join(os.path.dirname(__file__), "assets", "fonts")
_MONTSERRAT_REGULAR = os.path.join(_FONT_DIR, "Montserrat-Regular.ttf")
_MONTSERRAT_BOLD = os.path.join(_FONT_DIR, "Montserrat-Bold.ttf")
_MONTSERRAT_URLS = {
    _MONTSERRAT_REGULAR: "https://github.com/google/fonts/raw/main/ofl/montserrat/static/Montserrat-Regular.ttf",
    _MONTSERRAT_BOLD: "https://github.com/google/fonts/raw/main/ofl/montserrat/static/Montserrat-Bold.ttf",
}


def _ensure_montserrat() -> bool:
    """Downloads Montserrat's open-source TTFs from Google Fonts on first use
    and caches them on disk. Returns True if both files are available
    (whether just downloaded or already cached), False if the download
    failed for any reason — callers should fall back to Helvetica."""
    try:
        import requests
        os.makedirs(_FONT_DIR, exist_ok=True)
        for path, url in _MONTSERRAT_URLS.items():
            if os.path.exists(path) and os.path.getsize(path) > 0:
                continue
            resp = requests.get(url, timeout=15)
            resp.raise_for_status()
            with open(path, "wb") as f:
                f.write(resp.content)
        return os.path.exists(_MONTSERRAT_REGULAR) and os.path.exists(_MONTSERRAT_BOLD)
    except Exception:
        return False


@quotation_router.get("/{quotation_id}/pdf")
async def download_quotation_pdf(quotation_id: str, request: Request):
    from server import get_current_user
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
    from reportlab.lib.enums import TA_CENTER, TA_RIGHT
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont

    await get_current_user(request)

    quotation = await db.lead_quotations.find_one({"quotation_id": quotation_id}, {"_id": 0})
    if not quotation:
        raise HTTPException(status_code=404, detail="Quotation not found")

    company = await db.company_settings.find_one({"type": "payroll"}) or {}
    company_name = company.get("company_name") or "Drawlead"
    company_address = company.get("company_address") or ""

    # Register Montserrat if we can get it; otherwise fall back to Helvetica.
    # asyncio.to_thread keeps the (possibly blocking, first-time-only)
    # download off the event loop.
    import asyncio
    font_ok = await asyncio.to_thread(_ensure_montserrat)
    if font_ok and "Montserrat" not in pdfmetrics.getRegisteredFontNames():
        try:
            pdfmetrics.registerFont(TTFont("Montserrat", _MONTSERRAT_REGULAR))
            pdfmetrics.registerFont(TTFont("Montserrat-Bold", _MONTSERRAT_BOLD))
        except Exception:
            font_ok = False
    font_regular = "Montserrat" if font_ok else "Helvetica"
    font_bold = "Montserrat-Bold" if font_ok else "Helvetica-Bold"

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4,
        topMargin=18 * mm, bottomMargin=18 * mm, leftMargin=16 * mm, rightMargin=16 * mm,
    )

    black = colors.HexColor("#111111")
    gray = colors.HexColor("#6b7280")
    line_gray = colors.HexColor("#e5e7eb")
    header_bg = colors.HexColor("#f3f4f6")

    title_style = ParagraphStyle("Title", fontName=font_bold, fontSize=20, textColor=black, alignment=TA_CENTER)
    subtitle_style = ParagraphStyle("Subtitle", fontName=font_regular, fontSize=9, textColor=gray, alignment=TA_CENTER)
    doc_title_style = ParagraphStyle("DocTitle", fontName=font_bold, fontSize=13, textColor=black, alignment=TA_CENTER)
    label_style = ParagraphStyle("Label", fontName=font_regular, fontSize=9, textColor=gray)
    value_style = ParagraphStyle("Value", fontName=font_bold, fontSize=9, textColor=black)
    footer_style = ParagraphStyle("Footer", fontName=font_regular, fontSize=8, textColor=gray, alignment=TA_CENTER)

    elements = []
    elements.append(Paragraph(company_name, title_style))
    if company_address:
        elements.append(Paragraph(company_address, subtitle_style))
    elements.append(Spacer(1, 8 * mm))
    elements.append(Paragraph(f"QUOTATION — {quotation['quotation_number']}", doc_title_style))
    elements.append(Spacer(1, 6 * mm))

    # Bill-to + dates block
    info_data = [
        [Paragraph("Name", label_style), Paragraph(quotation.get("name") or "—", value_style),
         Paragraph("Quotation Date", label_style), Paragraph(quotation.get("quotation_date") or "—", value_style)],
        [Paragraph("Business Name", label_style), Paragraph(quotation.get("business_name") or "—", value_style),
         Paragraph("Due Date", label_style), Paragraph(quotation.get("due_date") or "—", value_style)],
        [Paragraph("Address", label_style), Paragraph(quotation.get("address") or "—", value_style), "", ""],
    ]
    info_table = Table(info_data, colWidths=[75, 165, 75, 165])
    info_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("SPAN", (1, 2), (3, 2)),
    ]))
    elements.append(info_table)
    elements.append(Spacer(1, 8 * mm))

    # Line items
    rows = [["S.No", "Service", "Amount", "GST %", "GST Amount", "Total"]]
    for it in quotation.get("items", []):
        rows.append([
            str(it.get("sno", "")),
            it.get("service", ""),
            f"Rs.{it.get('amount', 0):,.2f}",
            f"{it.get('gst_percent', 0):.0f}%",
            f"Rs.{it.get('gst_amount', 0):,.2f}",
            f"Rs.{it.get('total', 0):,.2f}",
        ])
    items_table = Table(rows, colWidths=[35, 165, 75, 45, 75, 75], repeatRows=1)
    items_table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, 0), font_bold),
        ("FONTNAME", (0, 1), (-1, -1), font_regular),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("BACKGROUND", (0, 0), (-1, 0), header_bg),
        ("TEXTCOLOR", (0, 0), (-1, -1), black),
        ("ALIGN", (2, 0), (-1, -1), "RIGHT"),
        ("ALIGN", (0, 0), (0, -1), "CENTER"),
        ("GRID", (0, 0), (-1, -1), 0.5, line_gray),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    elements.append(items_table)
    elements.append(Spacer(1, 4 * mm))

    grand_data = [["", "Grand Total", f"Rs.{quotation.get('grand_total', 0):,.2f}"]]
    grand_table = Table(grand_data, colWidths=[275, 120, 75])
    grand_table.setStyle(TableStyle([
        ("FONTNAME", (1, 0), (-1, -1), font_bold),
        ("FONTSIZE", (1, 0), (-1, -1), 11),
        ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
        ("TEXTCOLOR", (1, 0), (-1, -1), black),
        ("LINEABOVE", (1, 0), (-1, 0), 1, black),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
    ]))
    elements.append(grand_table)
    elements.append(Spacer(1, 14 * mm))

    elements.append(Paragraph("This is a computer-generated quotation. No signature required.", footer_style))
    elements.append(Paragraph("Generated by Drawlead OS", footer_style))

    doc.build(elements)
    buffer.seek(0)

    filename = f"quotation_{quotation['quotation_number']}.pdf"
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
