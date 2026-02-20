# Drawlead OS - Product Requirements Document

## Last Updated: December 2025

---

## Recent Changes (December 2025 - Latest)

### Website Projects - Complete Overhaul ✅ NEW

**3 Navigation Views:**

1. **All Projects View** (Default at `/website-projects`)
   - Table with: Project name, Dev %, Overall %, Developer, Onboarding, Deadline, Pages count
   - Filters: Search, Due Date picker, Developer dropdown
   - Cross-project Tasks Panel (shows when due date filter applied)
   - Shows all tasks due on that date across ALL projects

2. **Project Detail View** (`/website-projects?id=xxx`)
   - Back to All Projects button
   - Collapsible header with metadata (Domain, Developer, Dates, etc.)
   - Phase progress stats (Wireframe, UI, Content, Dev)
   - Pages/Tasks tabs
   - Edit/Delete buttons for admins only

3. **Page Detail View (Google Docs-like)** (`/website-projects?id=xxx&page=yyy`)
   - Back to project button
   - 4 Phase Cards (Wireframe, UI Design, Content, Development) with:
     - Status dropdown
     - Assignee dropdown
     - Due Date picker
   - **Screenshots Section**: Paste URL to add screenshots
   - **Tasks/Notes Section**: Add subtasks (auto-generated date, editable by everyone)
   - **Sections Section**: Add page sections (e.g., Hero, About)
   - Click section opens Phase Sidebar with 4 tabs

**New API Endpoints:**
- `GET /api/website-projects/all-projects-summary` - List with Dev%, Overall%
- `GET /api/website-projects/all-tasks?due_date=&developer=` - Cross-project tasks
- `GET /api/website-projects/team-members` - For assignee dropdowns
- `GET/POST /api/website-projects/pages/:id/subtasks` - Page subtasks
- `PUT/DELETE /api/website-projects/subtasks/:id`
- `GET/POST /api/website-projects/pages/:id/screenshots` - Page screenshots
- `DELETE /api/website-projects/screenshots/:id`

**Database Schema Updates:**
- `website_page_tasks`: Added `wireframe_assignee`, `ui_assignee`, `content_assignee`, `dev_assignee` fields
- `website_page_sections`: Added `*_assignee`, `*_due` fields for each phase
- `website_page_subtasks`: New collection for page tasks/notes
- `website_page_screenshots`: New collection for pasted screenshots

### Previous Updates
- SOP Works Board ✅
- Drawlead AI Assistant ✅
- Marketing Module ✅
- Theme Toggle (Dark/Light/System) ✅

## Architecture
```
/app/
├── backend/
│   ├── server.py
│   ├── website_projects_routes.py  # 800+ lines - fully featured
│   └── ...
└── frontend/
    └── src/
        └── pages/
            └── WebsiteProjectsPage.js  # 1200+ lines - 3 views
```

## Testing Status
- **Backend:** 22/22 tests passed (100%)
- **Frontend:** 13/13 features working (100%)
- **Test Report:** `/app/test_reports/iteration_10.json`

## Test Credentials
- **Admin:** vinoth@drawlead.com / admin123

## Pending Tasks

### P1 (High Priority)
- Configure Resend API key for email notifications

### P2 (Medium Priority)
- Finance Module: Payroll, GST tabs UI
- Refactor OperationsPage.js (86KB+ monolith)

### P3 (Backlog)
- WebSocket for real-time chat
- Kanban drag-and-drop

## Key Features Summary

| Feature | Status |
|---------|--------|
| Website Projects - All Views | ✅ Complete |
| Cross-Project Task Filtering | ✅ Complete |
| Page Detail (Google Docs-like) | ✅ Complete |
| Phase Assignee/Due Date | ✅ Complete |
| Screenshots (Paste URL) | ✅ Complete |
| Subtasks with Auto-Date | ✅ Complete |
| Section Phase Sidebar | ✅ Complete |
| Client Feedback | ✅ Complete |
| SOP Works Board | ✅ Complete |
| Drawlead AI | ✅ Complete |
| Marketing Module | ✅ Complete |
| Theme Toggle | ✅ Complete |
