# Drawlead OS - Product Requirements Document

## Overview
Drawlead OS is a comprehensive internal operating system for a digital marketing and tech agency. The system includes modular functionality for Sales, Finance, Operations, and Settings.

## Architecture
```
/app/
├── backend/
│   ├── server.py             # Main FastAPI app, Auth, Sales, Settings routes
│   ├── finance_routes.py     # Finance module API
│   ├── finance_models.py     # Finance Pydantic models
│   ├── operations_routes.py  # Operations module API
│   └── operations_models.py  # Operations Pydantic models
└── frontend/
    └── src/
        ├── pages/
        │   ├── OperationsPage.js   # Operations main page
        │   ├── SettingsPage.js     # Settings main page
        │   ├── FinanceModule.js    # Finance main page
        │   ├── LeadsPage.js        # Sales/Leads page
        │   └── Dashboard.js        # Dashboard
        └── components/
            ├── operations/         # Operations UI components
            │   ├── ProjectsKanbanView.js
            │   ├── ProjectsListView.js
            │   ├── TasksKanbanView.js
            │   ├── TasksListView.js
            │   ├── ProductivityDashboard.js
            │   ├── ProjectFormModal.js
            │   └── TaskFormModal.js
            ├── finance/            # Finance UI components
            └── leads/              # Leads UI components
```

## Modules Status

### 1. Sales Module ✅ COMPLETE
- Full-featured CRM with List, Kanban, and Chart views
- Dynamic master fields for Service, Lead Source, and Status
- Advanced filtering, search
- Role-based access for Admin and BDE

### 2. Finance Module ✅ COMPLETE
- Invoice management with GST/Non-GST support
- Per-item GST and discount calculations
- Invoice preview and PDF download
- Status tracking (Draft, Paid, Overdue)
- Payroll, GST, and Budget tabs (UI placeholders)

### 3. Operations Module ✅ COMPLETE (Jan 9, 2026)
- Project management with Kanban and List views
- Task management with Kanban and List views
- Dynamic service types filtering
- Productivity dashboard with stats and charts
- Project → Task hierarchy
- Time tracking API endpoints
- Status: Not Started, In Progress, Waiting Client, Review, Completed, On Hold

### 4. Settings Module ✅ COMPLETE (Jan 9, 2026)
- User management (add, edit, deactivate)
- Role-based access control (RBAC)
- Service management (add, edit, delete)
- Roles & Permissions visualization
- Roles: Super Admin, Admin, Project Manager, BDE, Employee

## User Roles & Permissions

| Role | Leads | Operations | Finance | Reports | Settings |
|------|-------|------------|---------|---------|----------|
| Super Admin | ✅ | ✅ | ✅ | ✅ | ✅ |
| Admin | ✅ | ✅ | ✅ | ✅ | ❌ |
| Project Manager | ❌ | ✅ | ❌ | ✅ | ❌ |
| BDE | ✅ | ❌ | ❌ | ❌ | ❌ |
| Employee | ❌ | ✅ | ❌ | ❌ | ❌ |

## Test Credentials
- **Super Admin**: superadmin@drawlead.com / super123
- **Admin**: admin@drawlead.com / admin123
- **BDE**: bde@drawlead.com / bde123
- **Project Manager**: pm@drawlead.com / pm123
- **Employee**: employee@drawlead.com / emp123

## API Endpoints

### Operations
- `GET/POST /api/operations/projects` - List/Create projects
- `GET/PUT/DELETE /api/operations/projects/{id}` - Project CRUD
- `GET/POST /api/operations/tasks` - List/Create tasks
- `GET/PUT/DELETE /api/operations/tasks/{id}` - Task CRUD
- `GET /api/operations/productivity/overview` - Stats
- `GET /api/operations/productivity/stats` - User productivity

### Settings
- `GET/POST /api/users` - List/Create users
- `PUT/DELETE /api/users/{id}` - User CRUD
- `GET /api/users/{id}/permissions` - User permissions
- `GET/POST /api/services` - List/Create services
- `PUT/DELETE /api/services/{id}` - Service CRUD

## Known Issues - RESOLVED
1. ~~Hardcoded user_id = "admin" in operations_routes.py~~ ✅ Fixed
2. ~~Hardcoded user_id = "admin" in finance_routes.py~~ ✅ Fixed

## Future Tasks (P1/P2)
- Finance: Complete Payroll, GST, Budgeting UI
- Sales: CSV Import/Export, saved filters
- Operations: Employee Portal ("My Tasks"), time tracking UI
- Integration: Real email service provider
- Future Modules: Marketing, HR, R&D

## Tech Stack
- **Backend**: FastAPI, MongoDB (motor async), Pydantic, JWT Auth
- **Frontend**: React, Tailwind CSS, shadcn/ui, recharts, react-beautiful-dnd
- **Database**: MongoDB

## Last Updated
January 9, 2026
