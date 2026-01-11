# Drawlead OS - Product Requirements Document

## Last Updated: January 11, 2026

---

## Recent Changes (January 11, 2026 - Latest)

### Safe Delete Confirmation Modal
Implemented GitHub-style delete confirmation that requires typing the item name:
- **Database Delete:** Right-click → Move to Trash → Type database name
- **Task Delete:** Hover row → Click trash → Type task name  
- **Project Delete:** In "By Project" view → Hover project → Click trash → Type project name
- Features:
  - Red warning icon and clear messaging
  - Shows item name to be deleted
  - Input field with exact match requirement
  - Green "Name matches" indicator when confirmed
  - Delete button disabled until name matches

### Previous (Same Session)
- Right-click context menu on database tabs
- Three view modes: Table, Kanban, By Project
- Hierarchical project structure within databases

## Architecture
```
/app/
├── backend/
│   ├── server.py
│   ├── notion_routes.py      # Database, Project, Row APIs
│   ├── hr_routes.py
│   └── finance_routes.py
└── frontend/
    └── src/
        ├── pages/
        │   └── OperationsPage.js   # Includes DeleteConfirmationModal
        └── components/
```

## Key Features

### Operations Module ✅ COMPLETE
- **Databases:** CRUD, templates, favorites, duplicate
- **Context Menu:** Right-click with 6 options
- **Views:** Table, Kanban, By Project
- **Projects:** Create groups within databases
- **Safe Delete:** Type-to-confirm for all deletions

### HR Module ✅ COMPLETE
- Employee Portal: Attendance, leave, profile
- Admin Portal: Team management
- Email notifications (MOCKED)

### Finance Module ✅ COMPLETE
- Invoices with GST
- Month-wise reports
- PDF export

## Test Credentials
- **Admin:** admin@drawlead.com / admin123
- **Employee:** employee@drawlead.com / emp123

## Pending Tasks

### P1 (High Priority)
- Resend Email Config (user must provide API key)
- Code Refactoring (split OperationsPage.js)

### P2 (Medium Priority)  
- Finance: Payroll, GST, Budgeting tabs
- Sales: CSV Import/Export

### P3 (Backlog)
- Calendar/Timeline views
- Drag-and-drop in Kanban
- Audit logs

## Known Mocked Integrations
- **Resend Email:** Requires user's RESEND_API_KEY in backend/.env
