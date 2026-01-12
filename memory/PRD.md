# Drawlead OS - Product Requirements Document

## Last Updated: January 12, 2026

---

## Recent Changes (January 12, 2026)

### Google Sheets & Docs Integration - NEW
Fully integrated Google Docs/Sheets into the Operations module:

**Features:**
- **Paste Link Approach:** Users paste Google Doc/Sheet URLs (no OAuth required)
- **URL Detection:** Automatically detects Sheet vs Doc from URL
- **Document Attachment:** Multiple docs per project
- **Split View:** Resizable panel with embedded document preview
- **Live Editing:** Users can edit if they have permissions
- **Document Management:** Add, view, remove documents from projects

**UI Components:**
- FileSpreadsheet icon on each project header
- "Add Google Document" modal with URL validation
- "Linked Documents" section with document chips
- Split view panel with Refresh/Fullscreen/Open in Google/Close buttons
- Resizable panel (drag to resize left/right)

**Backend APIs:**
- `GET /api/notion/projects/{id}/documents` - List documents
- `POST /api/notion/projects/{id}/documents` - Add document
- `PUT /api/notion/projects/{id}/documents/{doc_id}` - Update name
- `DELETE /api/notion/projects/{id}/documents/{doc_id}` - Remove document
- `GET /api/notion/projects/{id}/activity` - Activity log
- `POST /api/notion/rows/{row_id}/link-document` - Link task to document

**Testing:** 15/15 backend tests passed, 13/13 frontend features working

## Previous Changes (January 11, 2026)
- Right-click context menu on database tabs
- Three view modes: Table, Kanban, By Project
- Hierarchical project structure
- Safe delete confirmation (type name to confirm)
- Login fix for vinoth@drawlead.com

## Architecture
```
/app/
├── backend/
│   ├── server.py
│   ├── notion_routes.py      # Database, Project, Row, Document APIs
│   ├── hr_routes.py
│   └── finance_routes.py
└── frontend/
    └── src/
        ├── pages/
        │   └── OperationsPage.js   # Split view, Google Docs integration
        └── components/
```

## Key Features

### Operations Module ✅ COMPLETE
- **Databases:** CRUD, templates, favorites, duplicate
- **Context Menu:** Right-click with 6 options
- **Views:** Table, Kanban, By Project
- **Projects:** Create groups within databases
- **Google Docs Integration:** Paste links, split view preview
- **Safe Delete:** Type-to-confirm for all deletions

### HR Module ✅ COMPLETE
- Employee Portal: Attendance, leave, profile
- Admin Portal: Team management
- Email notifications (MOCKED - needs Resend API key)

### Finance Module ✅ COMPLETE
- Invoices with GST
- Month-wise reports
- PDF export

## Database Schema

### project_documents (NEW)
```json
{
  "doc_id": "gdoc_xxxx",
  "project_id": "proj_xxxx",
  "file_id": "1BxiMVs...",
  "file_type": "sheet|doc",
  "name": "Content Calendar",
  "url": "https://docs.google.com/...",
  "embed_url": "https://docs.google.com/.../edit?embedded=true",
  "created_by": "user_xxxx",
  "created_by_name": "Vinoth",
  "created_at": "datetime"
}
```

### project_activity (NEW)
```json
{
  "activity_id": "act_xxxx",
  "project_id": "proj_xxxx",
  "type": "document_added|document_removed|document_opened",
  "description": "Added sheet document: Content Calendar",
  "user_id": "user_xxxx",
  "user_name": "Vinoth",
  "metadata": {...},
  "created_at": "datetime"
}
```

## Test Credentials
- **Admin:** vinoth@drawlead.com / admin123

## Pending Tasks

### P1 (High Priority)
- Resend Email Config (user must provide API key)
- Code Refactoring (split OperationsPage.js - now 2164 lines)

### P2 (Medium Priority)
- Finance: Payroll, GST, Budgeting tabs
- Drag-and-drop in Kanban view

### P3 (Backlog)
- Calendar/Timeline views
- Task-to-document linking UI
- Activity timeline view

## Tech Stack
- **Backend:** FastAPI, MongoDB, Pydantic, JWT
- **Frontend:** React, Tailwind CSS, shadcn/ui, lucide-react
- **Integrations:** Google Docs/Sheets embed (iframe), Resend (MOCKED)

## Known Mocked Integrations
- **Resend Email:** Requires user's RESEND_API_KEY in backend/.env
