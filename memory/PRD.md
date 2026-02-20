# Drawlead OS - Product Requirements Document

## Last Updated: December 2025

---

## Recent Changes (December 2025 - Latest)

### Website Projects View - Enhanced ✅ NEW
Major overhaul of the website project management interface:

**UI Restructuring:**
- Removed right sidebar with project tabs
- Added Website Development dropdown in main sidebar with:
  - All Projects link
  - Individual project links with progress %
  - New Project link
- Added Pages/Tasks tabs at top with Add buttons

**Page Detail Sidebar (Click any page row):**
- Opens slide-out panel (width: 320px)
- Add sections with name and screenshot URL (paste)
- View sections with screenshot preview
- Phase badges (WF, UI, CT, DV) for quick status

**Section Detail Sidebar (Click any section):**
- Opens slide-out panel (width: 384px, z-50)
- 4 Phase Tabs: Wireframe | UI | Dev | Content
- Each tab has:
  - Status dropdown
  - URL input (Figma/Link)
- Client Feedback section (Google Docs style):
  - Shows existing feedback with user name
  - Add feedback button
  - Resolve button per feedback

**Role-Based Access:**
- Edit/Delete buttons visible only for:
  - super_admin
  - admin
  - project_manager

**New API Endpoints:**
- `GET/POST /api/website-projects/projects/:id/tasks` - Project tasks
- `PUT/DELETE /api/website-projects/tasks/:id` - Task management
- `GET/POST /api/website-projects/pages/:id/sections` - Page sections
- `PUT/DELETE /api/website-projects/sections/:id` - Section management
- `GET/POST /api/website-projects/sections/:id/feedback` - Section feedback
- `PUT/DELETE /api/website-projects/feedback/:id` - Feedback management
- `GET /api/website-projects/check-permission` - Check edit permission

### Previous: Website Projects View (Initial) ✅
Built spreadsheet-like interface with phase tracking.

### Theme Toggle (Dark/Light/System) ✅ FIXED
Global theme switching working on all pages.

### SOP Works Board ✅ COMPLETE
4 service templates with Kanban workflow.

### Drawlead AI Assistant ✅ COMPLETE
Claude Sonnet 4.5 powered context-aware assistant.

### Marketing Module ✅ COMPLETE
Analytics, Blog, Social Media, Email tabs.

## Architecture
```
/app/
├── backend/
│   ├── server.py
│   ├── website_projects_routes.py  # Enhanced with sections/feedback
│   ├── sop_routes.py
│   ├── ai_routes.py
│   └── ...
└── frontend/
    └── src/
        ├── components/
        │   ├── Sidebar.js          # Website Development dropdown
        │   ├── ThemeToggle.jsx
        │   └── ...
        └── pages/
            ├── WebsiteProjectsPage.js  # Enhanced with sidebars
            ├── SOPWorksBoard.js
            └── ...
```

## Database Schema

### website_projects
```json
{
  "project_id": "wp_xxxx",
  "name": "Client Company",
  "domain_url": "example.com",
  "platform": "Website|Shopify|WordPress|Custom",
  "website_type": "Business Website|E-commerce|Portfolio",
  "developer": "John Doe",
  "onboarding_date": "2025-01-15",
  "deadline": "2025-03-01",
  "server_details": "AWS/GCP",
  "client_drive_url": "https://drive.google.com/...",
  "status": "active|completed|on_hold"
}
```

### website_page_tasks
```json
{
  "task_id": "wpt_xxxx",
  "project_id": "wp_xxxx",
  "sno": 1,
  "page_name": "Home Page",
  "wireframe_status": "To-Do|In Progress|Completed|...",
  "wireframe_url": "figma.com/...",
  "ui_status": "To-Do",
  "content_status": "To-Do",
  "dev_status": "To-Do",
  "overall_status": "To-Do"
}
```

### website_project_tasks (NEW)
```json
{
  "task_id": "wptask_xxxx",
  "project_id": "wp_xxxx",
  "title": "Setup hosting",
  "description": "Configure AWS hosting",
  "assigned_to": "user_xxxx",
  "due_date": "2025-01-20",
  "priority": "low|medium|high",
  "status": "To-Do|In Progress|Completed",
  "created_by": "user_xxxx"
}
```

### website_page_sections (NEW)
```json
{
  "section_id": "wpsec_xxxx",
  "page_id": "wpt_xxxx",
  "order": 1,
  "name": "Hero Section",
  "description": "Main hero area",
  "screenshot_url": "https://...",
  "wireframe_status": "To-Do",
  "wireframe_url": "figma.com/...",
  "ui_status": "To-Do",
  "ui_url": null,
  "dev_status": "To-Do",
  "dev_url": null,
  "content_status": "To-Do",
  "content_url": null
}
```

### website_section_feedback (NEW)
```json
{
  "feedback_id": "wpfb_xxxx",
  "section_id": "wpsec_xxxx",
  "content": "Please make the hero image larger",
  "feedback_type": "comment|revision|approval",
  "status": "open|resolved",
  "created_by": "user_xxxx",
  "created_by_name": "Vinoth"
}
```

## Test Credentials
- **Admin:** vinoth@drawlead.com / admin123

## Testing Status
- **Website Projects Enhanced:** 23/23 backend tests passed ✅
- **Frontend:** 100% features working ✅
- **Test Report:** `/app/test_reports/iteration_9.json`

## Pending Tasks

### P1 (High Priority)
- Configure Resend API key for email notifications

### P2 (Medium Priority)
- Finance Module: Payroll, GST tabs UI
- Real GA4/WordPress/Gmail integrations
- Refactor OperationsPage.js (86KB+ monolith)

### P3 (Backlog)
- WebSocket for real-time chat
- Kanban drag-and-drop for Operations
- CSV Import/Export for leads

## Tech Stack
- **Backend:** FastAPI, MongoDB
- **Frontend:** React, Tailwind CSS, shadcn/ui
- **AI:** Claude Sonnet 4.5 (via emergentintegrations)
