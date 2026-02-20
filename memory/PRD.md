# Drawlead OS - Product Requirements Document

## Last Updated: December 2025

---

## Recent Changes (December 2025 - Latest)

### Website Projects View ✅ NEW
Built an enhanced spreadsheet-like project management interface for website development:

**Features:**
- **Project Management**: Create/delete projects with automatic 8 default pages (Home, About, Services, Portfolio, Contact, Blog, Privacy, Terms)
- **Collapsible Header**: Domain URL, Developer, Onboarding/Deadline dates, Client Drive, Server details
- **Phase Tracking**: 4 development phases per page:
  - Wireframe (Status + URL + Due Date)
  - UI Design (Status + URL + Due Date)
  - Content (Status + URL + Due Date)
  - Development (Status + URL + Due Date)
- **Phase Progress Stats**: Real-time completion counts per phase
- **Status Options**: To-Do, In Progress, Client Review, Client Approved, Completed, On Hold
- **Auto-Calculation**: Overall status auto-updates based on phase statuses
- **Project Tabs**: Right sidebar with all projects and progress bars
- **Search & Filter**: Search pages, filter by status

### Theme Toggle (Dark/Light/System) ✅ FIXED
Fixed global theme switching capability:
- **Dark Mode** (default): Original dark theme
- **Light Mode**: Clean light theme for daytime use
- **System Mode**: Follows OS preference automatically
- Toggle button in header (top-right corner)
- Theme preference persisted in localStorage
- All pages now properly themed (Dashboard, Website Projects, Sidebar, etc.)

### SOP Works Board ✅ COMPLETE
Built a comprehensive SOP-based project management system:

**Service Templates:**
- **Website Development**: 27 tasks, 5 stages (Discovery → Design → Development → Testing → Launch), 102h
- **SEO**: 30 tasks, 5 stages (Audit → Keyword Research → On-Page → Off-Page → Reporting), 75h
- **SEM/Google Ads**: 31 tasks, 5 stages (Strategy → Campaign Setup → Optimization → Scaling → Reporting), 71h
- **Meta Ads**: 36 tasks, 5 stages (Strategy → Creative → Campaign Setup → Optimization → Reporting), 73.5h

**Features:**
- Kanban board per project with drag-to-stage
- Auto-create tasks from SOP template
- Client/Lead linking
- Progress tracking
- Task completion toggle
- Project filtering by service type

### Drawlead AI Assistant ✅ COMPLETE
- Context-aware AI powered by Claude Sonnet 4.5
- Floating button + chat panel
- Sales & Operations intelligence

### Marketing Module ✅ COMPLETE
- Analytics, Blog, Social Media, Email tabs
- Demo data fallback

## Architecture
```
/app/
├── backend/
│   ├── server.py
│   ├── website_projects_routes.py  # NEW - Website Projects
│   ├── sop_routes.py               # SOP Works Board
│   ├── ai_routes.py
│   ├── marketing_routes.py
│   └── ...
└── frontend/
    └── src/
        ├── components/
        │   ├── ThemeToggle.jsx     # Dark/Light toggle
        │   ├── Layout.js           # Header + theme
        │   ├── DrawleadAI.jsx
        │   └── Sidebar.js          # Theme-aware navigation
        ├── contexts/
        │   ├── ThemeContext.js     # Theme provider
        │   └── AuthContext.js
        └── pages/
            ├── WebsiteProjectsPage.js  # NEW - Website Projects
            ├── SOPWorksBoard.js        # SOP Works page
            └── ...
```

## Key Features

### Website Projects ✅ NEW
- Spreadsheet-like interface for website development
- 4 development phases per page (Wireframe, UI, Content, Dev)
- Auto-status calculation
- Phase progress tracking
- Project tabs sidebar

### Theme System ✅ FIXED
- Dark/Light/System mode toggle
- Persisted in localStorage
- Consistent theming across all pages

### SOP Works Board ✅ COMPLETE
- 4 service templates with 124 total tasks
- Kanban workflow visualization
- Client linking
- Progress tracking

### Drawlead AI ✅ COMPLETE
- Context-aware assistant
- Sales & Operations modes

### Marketing Module ✅ COMPLETE
- Analytics, Blog, Social, Email

### Operations Module ✅ COMPLETE
- Notion-like databases

### HR Module ✅ COMPLETE
- Employee & Admin portals

### Finance Module ✅ COMPLETE
- Invoices, reports

## Database Schema

### website_projects (NEW)
```json
{
  "project_id": "wp_xxxx",
  "name": "Client Company",
  "domain_url": "example.com",
  "platform": "Website|Shopify|WordPress|Custom",
  "website_type": "Business Website|E-commerce|Portfolio|Landing Page|Blog|Web App",
  "developer": "John Doe",
  "onboarding_date": "2025-01-15",
  "deadline": "2025-03-01",
  "server_details": "AWS/GCP/etc",
  "client_drive_url": "https://drive.google.com/...",
  "status": "active|completed|on_hold"
}
```

### website_page_tasks (NEW)
```json
{
  "task_id": "wpt_xxxx",
  "project_id": "wp_xxxx",
  "sno": 1,
  "page_name": "Home Page",
  "wireframe_status": "To-Do|In Progress|Completed|...",
  "wireframe_url": "figma.com/...",
  "wireframe_due": "2025-01-20",
  "ui_status": "To-Do",
  "ui_url": null,
  "ui_due": null,
  "content_status": "To-Do",
  "dev_status": "To-Do",
  "overall_status": "To-Do"
}
```

### sop_projects
```json
{
  "project_id": "sop_proj_xxxx",
  "name": "Client Website Redesign",
  "service_type": "website|seo|sem|meta_ads",
  "stages": [...],
  "client_id": "lead_xxxx",
  "client_name": "Client Name",
  "status": "active|on_hold|completed"
}
```

## Test Credentials
- **Admin:** vinoth@drawlead.com / admin123

## Pending Tasks

### P1 (High Priority)
- Resend Email Config (user needs to provide API key)

### P2 (Medium Priority)
- Finance: Payroll, GST tabs UI
- Real GA4/WordPress/Gmail integrations
- Refactor OperationsPage.js (86KB+ monolith)

### P3 (Backlog)
- WebSocket for real-time chat
- AI conversation export
- Kanban drag-and-drop for Operations
- CSV Import/Export for leads

## Tech Stack
- **Backend:** FastAPI, MongoDB
- **Frontend:** React, Tailwind CSS, shadcn/ui
- **AI:** Claude Sonnet 4.5 (via emergentintegrations)
- **Theming:** CSS variables, localStorage

## Testing Status
- **Website Projects:** 17/17 backend tests passed ✅
- **Theme Toggle:** Working on all pages ✅
- **AI Module:** 22/22 tests passed ✅
- **Marketing Module:** 23/23 tests passed ✅
- **SOP Works Board:** Fully tested ✅

## API Endpoints

### Website Projects
- `GET /api/website-projects/options` - Get dropdown options
- `GET /api/website-projects/projects` - List all projects
- `POST /api/website-projects/projects` - Create project (auto-creates 8 pages)
- `GET /api/website-projects/projects/{id}` - Get project with tasks
- `PUT /api/website-projects/projects/{id}` - Update project
- `DELETE /api/website-projects/projects/{id}` - Delete project
- `POST /api/website-projects/projects/{id}/pages` - Add custom page
- `PUT /api/website-projects/pages/{task_id}` - Update page task
- `DELETE /api/website-projects/pages/{task_id}` - Delete page
- `GET /api/website-projects/dashboard` - Dashboard stats
