# Drawlead OS - Product Requirements Document

## Last Updated: January 11, 2026

---

## Recent Changes (January 11, 2026 - Session 2)

### New Features Implemented
1. **Right-Click Context Menu on Database Tabs**
   - Add to Favorites (star indicator on tab)
   - Copy link (copies shareable URL)
   - Duplicate (creates full copy with projects and rows)
   - Rename (modal with input field)
   - Open in new tab
   - Move to Trash (with confirmation)

2. **Three View Modes**
   - **Table View:** Default spreadsheet-style view with inline editing
   - **Kanban View:** Tasks grouped by Status columns (Planning, In Progress, Review, Completed)
   - **By Project View:** Tasks organized under collapsible project/group sections

3. **Hierarchical Project Structure**
   - "New Group" button creates projects within databases
   - Tasks can be assigned to specific projects
   - Projects are collapsible/expandable
   - Tasks show under their project or "Ungrouped Tasks"

4. **Operations Page UI Refactor**
   - Clean header with database tabs
   - View mode toggle buttons
   - Quick status filter chips
   - Advanced filters panel

## Previous Changes (January 11, 2026 - Session 1)
- Notion-like database system with 10 column types
- Inline cell editing, templates, pinned tabs
- Sidebar database navigation

## Previous Changes (January 9, 2026)
- Bug fixes for user creation
- HR Module (Employee + Admin portals)
- Email integration via Resend (MOCKED)
- Deployment health endpoints

## Architecture
```
/app/
├── backend/
│   ├── server.py             # Main FastAPI app
│   ├── notion_routes.py      # Notion-like database API (UPDATED)
│   │   ├── /databases CRUD
│   │   ├── /databases/{id}/duplicate (NEW)
│   │   ├── /databases/{id}/projects CRUD (NEW)
│   │   └── /rows with project_id support (UPDATED)
│   ├── hr_routes.py
│   └── finance_routes.py
└── frontend/
    └── src/
        ├── pages/
        │   └── OperationsPage.js   # (REWRITTEN) Context menu + 3 views
        └── components/
            └── Sidebar.js
```

## Key Features Summary

### Operations Module ✅ COMPLETE
- **Databases:** Create from templates or blank, full CRUD
- **Context Menu:** Right-click on tabs for quick actions
- **View Modes:**
  - Table: Spreadsheet with column management
  - Kanban: Status-based board
  - By Project: Hierarchical grouping
- **Projects/Groups:** Organize tasks under projects
- **Filters:** Quick status chips + advanced filters

### HR Module ✅ COMPLETE
- Employee Portal: Attendance, leave, profile
- Admin Portal: Team management, approvals
- Email notifications (MOCKED - needs Resend API key)

### Finance Module ✅ COMPLETE
- Invoice creation with GST
- Month-wise reports
- PDF export

## API Endpoints (Updated)

### Notion Database System
```
GET    /api/notion/databases                    - List all databases
POST   /api/notion/databases                    - Create database
GET    /api/notion/databases/{id}               - Get database
PUT    /api/notion/databases/{id}               - Update (name, icon, favorite)
DELETE /api/notion/databases/{id}               - Delete database
POST   /api/notion/databases/{id}/duplicate     - Duplicate with all data (NEW)

GET    /api/notion/databases/{id}/projects      - List projects (NEW)
POST   /api/notion/databases/{id}/projects      - Create project (NEW)
PUT    /api/notion/databases/{id}/projects/{p}  - Update project (NEW)
DELETE /api/notion/databases/{id}/projects/{p}  - Delete project (NEW)

GET    /api/notion/databases/{id}/rows          - Get rows
POST   /api/notion/databases/{id}/rows          - Create row (with project_id)
PUT    /api/notion/databases/{id}/rows/{r}/project - Move row to project (NEW)
```

## Database Schema (Updated)

### notion_databases
```json
{
  "database_id": "db_xxxx",
  "name": "string",
  "icon": "emoji",
  "category": "string",
  "columns": [...],
  "is_favorite": false,
  "is_pinned": false,
  "created_at": "datetime"
}
```

### notion_projects (NEW)
```json
{
  "project_id": "proj_xxxx",
  "database_id": "db_xxxx",
  "name": "string",
  "icon": "emoji",
  "order": 0,
  "created_at": "datetime"
}
```

### notion_rows (Updated)
```json
{
  "row_id": "row_xxxx",
  "database_id": "db_xxxx",
  "project_id": "proj_xxxx | null",  // NEW
  "values": {...},
  "created_at": "datetime"
}
```

## Test Credentials
- **Admin:** admin@drawlead.com / admin123
- **Employee:** employee@drawlead.com / emp123

## Pending Tasks

### P1 (High Priority)
- **Resend Email Config:** User must provide RESEND_API_KEY for HR notifications
- **Code Refactoring:** Split OperationsPage.js (1539 lines) into components

### P2 (Medium Priority)
- Finance Module: Payroll, GST, Budgeting tabs
- Sales Module: CSV Import/Export
- Replace browser prompt() with modal for New Group

### P3 (Backlog)
- Calendar/Timeline views
- Partial payments
- Audit logs

## Tech Stack
- **Backend:** FastAPI, MongoDB, Pydantic, JWT
- **Frontend:** React, Tailwind CSS, shadcn/ui, lucide-react
- **Testing:** Pytest (backend), Playwright (frontend)

## Known Mocked Integrations
- **Resend Email:** Requires user's API key in backend/.env
