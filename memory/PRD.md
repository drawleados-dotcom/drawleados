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
        │   ├── OperationsPage.js   # Operations with Projects, Tasks, Clients tabs
        │   ├── SettingsPage.js     # Settings page with user/service/roles
        │   ├── FinanceModule.js    # Finance with invoicing, reports
        │   ├── LeadsPage.js        # Sales/Leads page
        │   └── Dashboard.js        # Dashboard
        └── components/
            ├── operations/
            │   ├── ProjectsKanbanView.js
            │   ├── TasksKanbanView.js
            │   ├── ProductivityDashboard.js
            │   ├── ClientFormModal.js    # NEW - Client creation
            │   └── NotionFilters.js      # NEW - Advanced filters
            └── finance/
                ├── InvoicesTab.js        # Enhanced with month-wise reports
                └── InvoicePreviewModal.js # Enhanced with PDF download
```

## Modules Status

### 1. Sales Module ✅ COMPLETE
- Full-featured CRM with List, Kanban, and Chart views
- Dynamic master fields for Service, Lead Source, and Status
- Advanced filtering, search
- Role-based access for Admin and BDE

### 2. Finance Module ✅ COMPLETE (Jan 9, 2026)
- Invoice management with GST/Non-GST support
- Per-item GST and discount calculations
- **Invoice Preview & PDF Download** ✅
- **Month-wise Report with Charts** ✅
- **Month/Year Filters** ✅
- Summary cards (Total, Paid, Overdue)
- Payroll, GST, and Budget tabs (UI placeholders)

### 3. Operations Module ✅ COMPLETE (Jan 9, 2026)
- Project management with Kanban and List views
- Task management with Kanban and List views
- **New Client Module** ✅ - Add/edit clients directly from Operations
- **Clients Tab** ✅ - View all clients with quick project creation
- **Notion-style Filters** ✅ - Advanced filtering by status, priority, date, assignee
- Productivity dashboard with stats and charts
- Status: Not Started, In Progress, Waiting Client, Review, Completed, On Hold

### 4. Settings Module ✅ COMPLETE (Jan 9, 2026)
- User management (add, edit, deactivate)
- Role-based access control (RBAC)
- Service management (add, edit, delete)
- Roles & Permissions visualization
- Roles: Super Admin, Admin, Project Manager, BDE, Employee

## Recent Features Added (Jan 9, 2026)
1. **New Client Module** - Add clients directly from Operations page
2. **Clients Tab** - Dedicated tab showing all clients with quick actions
3. **Notion-style Filters** - Advanced filtering with operators (is, before, after, this week, etc.)
4. **Month-wise Invoice Report** - Bar charts and summary table for monthly revenue
5. **Invoice PDF Download** - Professional PDF generation with company details, GST breakdown
6. **Month/Year Filters** - Filter invoices by specific month and year

## User Roles & Permissions

| Role | Leads | Operations | Finance | Reports | Settings |
|------|-------|------------|---------|---------|----------|
| Super Admin | ✅ | ✅ | ✅ | ✅ | ✅ |
| Admin | ✅ | ✅ | ✅ | ✅ | ❌ |
| Project Manager | ❌ | ✅ | ❌ | ✅ | ❌ |
| BDE | ✅ | ❌ | ❌ | ❌ | ❌ |
| Employee | ❌ | ✅ | ❌ | ❌ | ❌ |

## Test Credentials
- **Admin**: admin@drawlead.com / admin123
- **Super Admin**: superadmin@drawlead.com / super123

## API Endpoints

### Operations
- `GET/POST /api/operations/projects` - List/Create projects
- `GET/PUT/DELETE /api/operations/projects/{id}` - Project CRUD
- `GET/POST /api/operations/tasks` - List/Create tasks
- `GET/PUT/DELETE /api/operations/tasks/{id}` - Task CRUD
- `GET /api/operations/productivity/overview` - Stats

### Finance
- `GET/POST /api/finance/invoices` - List/Create invoices
- `GET/PUT/DELETE /api/finance/invoices/{id}` - Invoice CRUD
- `GET /api/finance/settings` - Company settings

### Clients (Leads)
- `GET/POST /api/leads` - List/Create clients
- `PUT/DELETE /api/leads/{id}` - Client CRUD

## Known Issues - ALL RESOLVED ✅
1. ~~Hardcoded user_id = "admin"~~ ✅ Fixed with proper JWT auth
2. ~~PDF download not working~~ ✅ Fixed jsPDF import issue

## Future Tasks (P1/P2)
- Finance: Complete Payroll, GST, Budgeting UI
- Sales: CSV Import/Export, saved filters
- Operations: Employee Portal ("My Tasks"), time tracking UI
- Integration: Real email service provider
- Future Modules: Marketing, HR, R&D

## Tech Stack
- **Backend**: FastAPI, MongoDB (motor async), Pydantic, JWT Auth
- **Frontend**: React, Tailwind CSS, shadcn/ui, recharts, react-beautiful-dnd, jsPDF
- **Database**: MongoDB

## Last Updated
January 9, 2026
