"""
Client Master routes — a standalone onboarding/CRM registry (deliberately
separate from finance_clients, which backs invoicing and Project creation).
Tracks how a client was sourced, which catalog service/package they signed
up for, and delivery status, for the Super Admin "Clients Master View".
"""
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
import uuid

client_master_router = APIRouter(prefix="/client-master", tags=["client-master"])

STATUS_VALUES = {"active", "delivered", "dropped", "not_satisfied", "unfinished"}


class ClientMasterCreate(BaseModel):
    name: str
    source: Optional[str] = None
    onboarding_date: Optional[str] = None  # ISO date; defaults to today
    onboarding_month: Optional[int] = None  # 1-12; defaults from onboarding_date
    onboarding_year: Optional[int] = None  # defaults from onboarding_date
    service_type: str  # "one-time" | "recurring"
    service_id: Optional[str] = None
    service_name: Optional[str] = None
    package_id: Optional[str] = None
    package_name: Optional[str] = None
    package_amount: Optional[float] = 0
    case_study: Optional[str] = None
    recurring_months: Optional[int] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None  # blank/omitted = ongoing ("till now")
    is_ongoing: Optional[bool] = False
    remarks: Optional[str] = None
    status: Optional[str] = "active"


class ClientMasterUpdate(BaseModel):
    name: Optional[str] = None
    source: Optional[str] = None
    onboarding_date: Optional[str] = None
    onboarding_month: Optional[int] = None
    onboarding_year: Optional[int] = None
    service_type: Optional[str] = None
    service_id: Optional[str] = None
    service_name: Optional[str] = None
    package_id: Optional[str] = None
    package_name: Optional[str] = None
    package_amount: Optional[float] = None
    case_study: Optional[str] = None
    recurring_months: Optional[int] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    is_ongoing: Optional[bool] = None
    remarks: Optional[str] = None
    status: Optional[str] = None


async def _require_super_admin(request: Request):
    from server import get_current_user
    user = await get_current_user(request)
    if (user.role or "") != "super_admin":
        raise HTTPException(status_code=403, detail="Only Super Admin can manage Client Master")
    return user


@client_master_router.post("")
async def create_client_master(payload: ClientMasterCreate, request: Request):
    from server import db
    user = await _require_super_admin(request)

    name = (payload.name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Client name is required")
    if payload.status and payload.status not in STATUS_VALUES:
        raise HTTPException(status_code=400, detail="Invalid status")

    now = datetime.now(timezone.utc).isoformat()
    onboarding_date = payload.onboarding_date or now[:10]
    doc = {
        **payload.model_dump(),
        "client_id": f"cm_{uuid.uuid4().hex[:12]}",
        "name": name,
        "onboarding_date": onboarding_date,
        "onboarding_month": payload.onboarding_month or int(onboarding_date[5:7]),
        "onboarding_year": payload.onboarding_year or int(onboarding_date[0:4]),
        "total_amount": float(payload.package_amount or 0),
        "created_by": user.user_id,
        "created_at": now,
        "updated_at": now,
        "is_deleted": False,
    }
    await db.client_master.insert_one(doc)
    doc.pop("_id", None)
    return doc


@client_master_router.get("")
async def list_client_master(request: Request):
    from server import db
    await _require_super_admin(request)
    items = await db.client_master.find(
        {"is_deleted": False}, {"_id": 0}
    ).sort("onboarding_date", -1).to_list(2000)
    return items


@client_master_router.put("/{client_id}")
async def update_client_master(client_id: str, payload: ClientMasterUpdate, request: Request):
    from server import db
    await _require_super_admin(request)

    update_data = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    if "name" in update_data and not update_data["name"].strip():
        raise HTTPException(status_code=400, detail="Client name cannot be empty")
    if "status" in update_data and update_data["status"] not in STATUS_VALUES:
        raise HTTPException(status_code=400, detail="Invalid status")
    if "package_amount" in update_data:
        update_data["total_amount"] = float(update_data["package_amount"] or 0)

    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    res = await db.client_master.update_one({"client_id": client_id}, {"$set": update_data})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Client not found")

    result = await db.client_master.find_one({"client_id": client_id}, {"_id": 0})
    return result


@client_master_router.delete("/{client_id}")
async def delete_client_master(client_id: str, request: Request):
    from server import db
    await _require_super_admin(request)
    res = await db.client_master.update_one(
        {"client_id": client_id},
        {"$set": {"is_deleted": True, "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Client not found")
    return {"message": "Client removed"}


_STATUS_LABELS = {
    "active": "Active",
    "delivered": "Delivered",
    "dropped": "Dropped",
    "not_satisfied": "Not Satisfied",
    "unfinished": "Unfinished",
}


def _cm_amount(c):
    val = c.get("total_amount")
    if val is None:
        val = c.get("package_amount")
    try:
        return float(val or 0)
    except (TypeError, ValueError):
        return 0.0


def _cm_month_year(c):
    m, y = c.get("onboarding_month"), c.get("onboarding_year")
    if m and y:
        return int(m), int(y)
    d = c.get("onboarding_date")
    if d:
        try:
            dt = datetime.fromisoformat(d[:10])
            return dt.month, dt.year
        except ValueError:
            return None
    return None


def _cm_duration_label(c):
    if c.get("service_type") != "recurring":
        return "-"
    months = f"{c['recurring_months']} mo" if c.get("recurring_months") else ""
    start = c.get("start_date")
    rng = ""
    if start:
        end = "Till now" if (c.get("is_ongoing") or not c.get("end_date")) else c.get("end_date")
        rng = f"{start} -> {end}"
    parts = [p for p in [months, rng] if p]
    return "  |  ".join(parts) if parts else "-"


@client_master_router.get("/report/pdf")
async def generate_client_master_report_pdf(request: Request):
    """
    Full analytics + client-directory PDF, built fresh from live data on
    every request (no caching layer anywhere in this handler) — so every
    click of the download button, including right after adding a new
    client, reflects whatever is currently in Client Master at that moment.
    """
    from server import db
    import io
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak
    from reportlab.lib.enums import TA_CENTER, TA_LEFT

    await _require_super_admin(request)

    clients = await db.client_master.find(
        {"is_deleted": False}, {"_id": 0}
    ).sort("onboarding_date", -1).to_list(5000)

    total_clients = len(clients)
    total_revenue = sum(_cm_amount(c) for c in clients)
    avg_deal = (total_revenue / total_clients) if total_clients else 0

    status_counts = {}
    for c in clients:
        s = c.get("status") or "active"
        row = status_counts.setdefault(s, {"count": 0, "amount": 0.0})
        row["count"] += 1
        row["amount"] += _cm_amount(c)

    one_time = [c for c in clients if c.get("service_type") != "recurring"]
    recurring = [c for c in clients if c.get("service_type") == "recurring"]

    def group_by(rows, key_fn):
        buckets = {}
        for c in rows:
            k = key_fn(c) or "Unassigned"
            row = buckets.setdefault(k, {"name": k, "count": 0, "amount": 0.0})
            row["count"] += 1
            row["amount"] += _cm_amount(c)
        return sorted(buckets.values(), key=lambda r: r["amount"], reverse=True)

    source_data = group_by(clients, lambda c: c.get("source"))
    service_data = group_by(clients, lambda c: c.get("service_name"))

    now = datetime.now(timezone.utc)
    month_buckets = []
    y, m = now.year, now.month
    for i in range(11, -1, -1):
        by, bm = y, m - i
        while bm <= 0:
            bm += 12
            by -= 1
        month_buckets.append({"year": by, "month": bm, "count": 0, "amount": 0.0})
    month_index = {(b["year"], b["month"]): b for b in month_buckets}
    for c in clients:
        my = _cm_month_year(c)
        if my and (my[1], my[0]) in month_index:
            b = month_index[(my[1], my[0])]
            b["count"] += 1
            b["amount"] += _cm_amount(c)

    MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

    year_buckets = {}
    for c in clients:
        my = _cm_month_year(c)
        if my:
            yr = my[1]
            row = year_buckets.setdefault(yr, {"year": yr, "count": 0, "amount": 0.0})
            row["count"] += 1
            row["amount"] += _cm_amount(c)
    yearly_data = sorted(year_buckets.values(), key=lambda r: r["year"])

    top_clients = sorted(clients, key=_cm_amount, reverse=True)[:20]

    # ---- Build PDF (landscape — the full client directory needs the width) ----
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=landscape(A4),
        topMargin=14 * mm, bottomMargin=14 * mm, leftMargin=12 * mm, rightMargin=12 * mm,
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle('CMTitle', parent=styles['Title'], fontSize=20, textColor=colors.HexColor('#6366f1'), alignment=TA_CENTER)
    subtitle_style = ParagraphStyle('CMSubtitle', parent=styles['Normal'], fontSize=10, textColor=colors.gray, alignment=TA_CENTER)
    section_style = ParagraphStyle('CMSection', parent=styles['Heading2'], fontSize=13, textColor=colors.HexColor('#1f2937'), spaceBefore=2, spaceAfter=6)
    cell_style = ParagraphStyle('CMCell', parent=styles['Normal'], fontSize=8, leading=10)
    cell_bold = ParagraphStyle('CMCellBold', parent=cell_style, fontName='Helvetica-Bold')

    def header_row_style(bg='#eef2ff', fg='#374151'):
        return TableStyle([
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 8.5),
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor(bg)),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.HexColor(fg)),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e5e7eb')),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
            ('LEFTPADDING', (0, 0), (-1, -1), 6),
            ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ])

    elements = []

    # ── Cover / header ──
    elements.append(Paragraph("Drawlead — Client Master Report", title_style))
    elements.append(Paragraph(
        f"Generated on {now.strftime('%d %B %Y')} at {now.strftime('%I:%M %p')} UTC · "
        f"{total_clients} clients on record",
        subtitle_style
    ))
    elements.append(Spacer(1, 8 * mm))

    # ── KPI summary ──
    elements.append(Paragraph("Executive Summary", section_style))
    kpi_data = [
        ['Total Clients', 'Total Revenue', 'Active', 'Delivered', 'Dropped', 'Not Satisfied', 'Unfinished', 'Avg Deal Size'],
        [
            str(total_clients),
            f"Rs. {total_revenue:,.0f}",
            str(status_counts.get('active', {}).get('count', 0)),
            str(status_counts.get('delivered', {}).get('count', 0)),
            str(status_counts.get('dropped', {}).get('count', 0)),
            str(status_counts.get('not_satisfied', {}).get('count', 0)),
            str(status_counts.get('unfinished', {}).get('count', 0)),
            f"Rs. {avg_deal:,.0f}",
        ],
    ]
    kpi_table = Table(kpi_data, colWidths=[None] * 8, hAlign='LEFT')
    kpi_table.setStyle(header_row_style())
    elements.append(kpi_table)
    elements.append(Spacer(1, 8 * mm))

    # ── Status distribution ──
    elements.append(Paragraph("Status Distribution", section_style))
    status_rows = [['Status', 'Clients', 'Revenue']]
    for key, label in _STATUS_LABELS.items():
        row = status_counts.get(key)
        if row:
            status_rows.append([label, str(row['count']), f"Rs. {row['amount']:,.0f}"])
    status_table = Table(status_rows, colWidths=[60 * mm, 40 * mm, 50 * mm], hAlign='LEFT')
    status_table.setStyle(header_row_style())
    elements.append(status_table)
    elements.append(Spacer(1, 8 * mm))

    # ── One-time vs Recurring ──
    elements.append(Paragraph("One-time vs Recurring", section_style))
    type_rows = [
        ['Engagement Type', 'Clients', 'Revenue'],
        ['One-time', str(len(one_time)), f"Rs. {sum(_cm_amount(c) for c in one_time):,.0f}"],
        ['Recurring', str(len(recurring)), f"Rs. {sum(_cm_amount(c) for c in recurring):,.0f}"],
    ]
    type_table = Table(type_rows, colWidths=[60 * mm, 40 * mm, 50 * mm], hAlign='LEFT')
    type_table.setStyle(header_row_style())
    elements.append(type_table)
    elements.append(Spacer(1, 8 * mm))

    # ── Revenue by source / service ──
    def named_breakdown_table(title, rows):
        elements.append(Paragraph(title, section_style))
        if not rows:
            elements.append(Paragraph("No data.", cell_style))
        else:
            data = [['Name', 'Clients', 'Revenue']]
            for r in rows[:15]:
                data.append([r['name'], str(r['count']), f"Rs. {r['amount']:,.0f}"])
            t = Table(data, colWidths=[90 * mm, 40 * mm, 50 * mm], hAlign='LEFT')
            t.setStyle(header_row_style())
            elements.append(t)
        elements.append(Spacer(1, 8 * mm))

    named_breakdown_table("Revenue by Source (Top 15)", source_data)
    named_breakdown_table("Revenue by Service (Top 15)", service_data)

    # ── Monthly trend ──
    elements.append(Paragraph("Monthly Trend — Last 12 Months", section_style))
    monthly_rows = [['Month', 'New Clients', 'Revenue']]
    for b in month_buckets:
        monthly_rows.append([f"{MONTH_NAMES[b['month'] - 1]} {b['year']}", str(b['count']), f"Rs. {b['amount']:,.0f}"])
    monthly_table = Table(monthly_rows, colWidths=[60 * mm, 40 * mm, 50 * mm], hAlign='LEFT')
    monthly_table.setStyle(header_row_style())
    elements.append(monthly_table)
    elements.append(Spacer(1, 8 * mm))

    # ── Yearly trend ──
    if yearly_data:
        elements.append(Paragraph("Yearly Trend", section_style))
        yearly_rows = [['Year', 'New Clients', 'Revenue']]
        for b in yearly_data:
            yearly_rows.append([str(b['year']), str(b['count']), f"Rs. {b['amount']:,.0f}"])
        yearly_table = Table(yearly_rows, colWidths=[60 * mm, 40 * mm, 50 * mm], hAlign='LEFT')
        yearly_table.setStyle(header_row_style())
        elements.append(yearly_table)
        elements.append(Spacer(1, 8 * mm))

    # ── Top clients by revenue ──
    elements.append(Paragraph("Top 20 Clients by Revenue", section_style))
    if not top_clients:
        elements.append(Paragraph("No clients yet.", cell_style))
    else:
        top_rows = [['#', 'Client', 'Source', 'Service', 'Status', 'Revenue']]
        for i, c in enumerate(top_clients, start=1):
            top_rows.append([
                str(i),
                Paragraph(c.get('name') or '-', cell_style),
                c.get('source') or '-',
                Paragraph(c.get('service_name') or '-', cell_style),
                _STATUS_LABELS.get(c.get('status') or 'active', 'Active'),
                f"Rs. {_cm_amount(c):,.0f}",
            ])
        top_table = Table(top_rows, colWidths=[10 * mm, 60 * mm, 40 * mm, 55 * mm, 30 * mm, 40 * mm], hAlign='LEFT', repeatRows=1)
        top_table.setStyle(header_row_style())
        elements.append(top_table)

    # ── Full client directory — every record, own section starting on a new page ──
    elements.append(PageBreak())
    elements.append(Paragraph(f"Full Client Directory ({total_clients} records)", section_style))
    elements.append(Paragraph(
        "Every client currently on record, in the same order shown in Client Master (newest onboarding first).",
        cell_style
    ))
    elements.append(Spacer(1, 4 * mm))

    dir_header = ['Client', 'Source', 'Onboarding', 'Service', 'Package', 'Amount', 'Duration', 'Status', 'Case Study', 'Remarks']
    dir_rows = [dir_header]
    for c in clients:
        service_cell = (c.get('service_name') or '-') + (' (Recurring)' if c.get('service_type') == 'recurring' else ' (One-time)')
        dir_rows.append([
            Paragraph(c.get('name') or '-', cell_style),
            Paragraph(c.get('source') or '-', cell_style),
            c.get('onboarding_date') or '-',
            Paragraph(service_cell, cell_style),
            Paragraph(c.get('package_name') or '-', cell_style),
            f"Rs. {_cm_amount(c):,.0f}",
            Paragraph(_cm_duration_label(c), cell_style),
            _STATUS_LABELS.get(c.get('status') or 'active', 'Active'),
            Paragraph((c.get('case_study') or '-')[:80], cell_style),
            Paragraph((c.get('remarks') or '-')[:120], cell_style),
        ])

    dir_col_widths = [30 * mm, 24 * mm, 20 * mm, 32 * mm, 26 * mm, 20 * mm, 34 * mm, 18 * mm, 26 * mm, 33 * mm]
    dir_table = Table(dir_rows, colWidths=dir_col_widths, hAlign='LEFT', repeatRows=1)
    dir_table.setStyle(header_row_style())
    elements.append(dir_table)

    elements.append(Spacer(1, 8 * mm))
    elements.append(Paragraph(
        "This is a computer-generated report reflecting live Client Master data at the moment it was generated.",
        ParagraphStyle('CMFooter', fontSize=8, textColor=colors.gray, alignment=TA_CENTER)
    ))

    doc.build(elements)
    buffer.seek(0)

    filename = f"client_master_report_{now.strftime('%Y-%m-%d')}.pdf"
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
