# Drawlead OS - Product Requirements Document

## Last Updated: January 12, 2026

---

## Recent Changes (January 12, 2026 - Latest)

### Theme Toggle (Dark/Light/System) ✅ NEW
Added global theme switching capability:
- **Dark Mode** (default): Original dark theme
- **Light Mode**: Clean light theme for daytime use
- **System Mode**: Follows OS preference automatically
- Toggle button in header (top-right corner)
- Theme preference persisted in localStorage

### SOP Works Board ✅ NEW
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
│   ├── sop_routes.py         # NEW - SOP Works Board
│   ├── ai_routes.py
│   ├── marketing_routes.py
│   └── ...
└── frontend/
    └── src/
        ├── components/
        │   ├── ThemeToggle.jsx   # NEW - Dark/Light toggle
        │   ├── Layout.js         # Updated with header + theme
        │   ├── DrawleadAI.jsx
        │   └── Sidebar.js        # Updated with theme support
        ├── contexts/
        │   ├── ThemeContext.js   # NEW - Theme provider
        │   └── AuthContext.js
        └── pages/
            ├── SOPWorksBoard.js  # NEW - SOP Works page
            └── ...
```

## Key Features

### Theme System ✅ NEW
- Dark/Light/System mode toggle
- Persisted in localStorage
- CSS variables for consistent theming

### SOP Works Board ✅ NEW
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

### sop_projects (NEW)
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

### sop_tasks (NEW)
```json
{
  "task_id": "sop_task_xxxx",
  "project_id": "sop_proj_xxxx",
  "title": "Wireframe creation",
  "stage": "design",
  "priority": "high|medium|low",
  "estimated_hours": 8,
  "is_completed": false
}
```

## Test Credentials
- **Admin:** vinoth@drawlead.com / admin123

## Pending Tasks

### P1 (High Priority)
- Test SOP Works Board (testing in progress)
- Resend Email Config

### P2 (Medium Priority)
- Finance: Payroll, GST tabs UI
- Real GA4/WordPress/Gmail integrations

### P3 (Backlog)
- WebSocket for real-time
- AI conversation export

## Tech Stack
- **Backend:** FastAPI, MongoDB
- **Frontend:** React, Tailwind CSS, shadcn/ui
- **AI:** Claude Sonnet 4.5
- **Theming:** CSS variables, localStorage

## Testing Status
- **AI Module:** 22/22 tests passed
- **Marketing Module:** 23/23 tests passed
- **SOP Works Board:** Testing in progress
