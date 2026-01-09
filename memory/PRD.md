# Drawlead OS - Product Requirements Document

## Last Updated: January 9, 2026

---

## Recent Changes (January 9, 2026)
- **Bug Fix:** Resolved "Access denied" error when admin users tried to create new users
  - Root cause: `can_manage_users` permission was `false` for admin role
  - Fixed in database and seed data
- **CORS Fix:** Updated backend CORS config to support localhost testing

## Overview
Drawlead OS is a **private internal ERP** for Drawlead digital agency. NOT a SaaS - fully owned by one company with no public signup, no subscriptions, no credits.

## Architecture
```
/app/
├── backend/
│   ├── server.py             # Main FastAPI app with all core routes
│   ├── finance_routes.py     # Finance module API
│   ├── operations_routes.py  # Operations module API
└── frontend/
    └── src/
        ├── pages/
        │   ├── SettingsPage.js     # Company, Workspaces, Users, Services, Statuses
        │   ├── OperationsPage.js   # Projects, Tasks, Clients with Notion filters
        │   ├── FinanceModule.js    # Invoicing with month-wise reports
        │   └── ...
        └── components/
            ├── settings/
            │   ├── CompanyProfileTab.js   # Company info, bank, UPI, terms
            │   ├── WorkspacesTab.js       # Department workspaces
            │   └── StatusManagementTab.js # Status CRUD with reorder
            └── ...
```

## Modules Status

### 1. Company Profile ✅ COMPLETE (Jan 9, 2026)
- Company Name, Logo URL, Address (full)
- Phone, Email, Website
- GST Number, PAN Number
- Invoice Prefix
- Bank Details (Account, IFSC, Bank Name, Branch)
- Multiple UPI IDs
- Terms & Conditions
- **Auto-fills**: Invoices, PDFs, Payslips

### 2. Workspaces ✅ COMPLETE (Jan 9, 2026)
- 5 default workspaces: Sales, Operations, Finance, Marketing, HR
- Create custom workspaces
- Assign members to workspaces
- Each workspace has own dashboard

### 3. Status Management ✅ COMPLETE (Jan 9, 2026)
- Full CRUD on statuses
- Drag & drop reordering
- Custom colors
- No locked statuses

### 4. Services Management ✅ COMPLETE
- Full CRUD on services
- Enable/disable services
- Billing type (one-time/recurring)
- Base pricing

### 5. User & Role Management ✅ COMPLETE
- Add/edit/deactivate users
- Customizable roles
- Module access control
- Granular permissions

### 6. Operations Module ✅ COMPLETE
- Projects with Kanban/List views
- Tasks with Kanban/List views
- **Clients tab** with quick project creation
- **Notion-style filters** (status, priority, date, assignee)
- Productivity dashboard

### 7. Finance Module ✅ COMPLETE
- Invoice creation with GST
- Company profile auto-fill
- Bank details & UPI on invoices
- Terms & conditions on invoices
- **Month-wise reports** with charts
- PDF download with full company details

## User Roles

| Role | Access |
|------|--------|
| Super Admin | Full access to everything |
| Admin | All except Settings |
| Project Manager | Operations, Reports |
| BDE | Leads only |
| Employee | Operations only |

## Test Credentials
- **Admin**: admin@drawlead.com / admin123

## API Endpoints

### Company Profile
- `GET /api/company-profile` - Get profile
- `PUT /api/company-profile` - Update profile

### Workspaces
- `GET/POST /api/workspaces` - List/Create
- `PUT/DELETE /api/workspaces/{id}` - Update/Delete
- `POST/DELETE /api/workspaces/{id}/members` - Manage members

### Statuses
- `GET /api/statuses` - List statuses
- `PUT /api/statuses/{id}` - Update status
- `DELETE /api/statuses/{id}` - Delete status
- `PUT /api/statuses/reorder` - Reorder statuses

## Future Tasks (P1/P2)
- Calendar view in Operations
- Timeline view in Operations
- Partial payments support in Finance
- Invoice email sending (currently mocked)
- Audit logs for changes
- Service workflows

## Tech Stack
- **Backend**: FastAPI, MongoDB, Pydantic, JWT Auth
- **Frontend**: React, Tailwind CSS, shadcn/ui, recharts, react-beautiful-dnd, jsPDF
- **Database**: MongoDB

## Last Updated
January 9, 2026
