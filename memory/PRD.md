# Drawlead OS - Product Requirements Document

## Last Updated: January 11, 2026

---

## Recent Changes (January 11, 2026 - Session 2)
- **Operations Page UI Refactor:** Completely redesigned the Operations page for a cleaner, more intuitive interface
  - Removed redundant inner sidebar (databases now shown in main sidebar only)
  - All databases displayed as tabs at the top for quick switching
  - Quick status filter chips (All, Planning, In Progress, Review, Completed)
  - Prominent "Add Task" button in green
  - Collapsible "More Filters" panel with Priority, Assignee, and Date Range filters
  - Improved empty state design
  - Cleaner table layout

## Previous Changes (January 11, 2026 - Session 1)
- **Notion-like Operations Module:** Replaced old Operations page with full Notion-style database system
  - Custom databases with templates (Project Tracker, Task List, etc.)
  - 10 column types: Text, Number, Select, Multi-select, Date, URL, Email, Phone, Checkbox, Person
  - Inline cell editing with auto-save
  - Add/delete columns and rows
  - Search functionality
  - Color-coded select dropdowns
  - Pinned databases feature

## Previous Changes (January 9, 2026)
- **Bug Fix:** Resolved "Access denied" error when admin users tried to create new users
- **CORS Fix:** Updated backend CORS config to support localhost testing
- **HR Module Implementation:** Built comprehensive HR portal for employees
- **HR Admin Module:** Built admin dashboard for HR management
- **Deployment Fix:** Added `/health` endpoint for Kubernetes health checks
- **Email Integration:** Integrated Resend for HR notifications (requires API key)

## Overview
Drawlead OS is a **private internal ERP** for Drawlead digital agency. NOT a SaaS - fully owned by one company with no public signup, no subscriptions, no credits.

## Architecture
```
/app/
├── backend/
│   ├── server.py             # Main FastAPI app with auth, users, settings routes
│   ├── finance_routes.py     # Finance module API
│   ├── operations_routes.py  # Legacy operations routes
│   ├── hr_routes.py          # HR module API (employee + admin)
│   └── notion_routes.py      # Notion-like database system API
└── frontend/
    └── src/
        ├── pages/
        │   ├── OperationsPage.js   # Notion-like database UI (refactored)
        │   ├── HRPage.js           # Employee HR portal
        │   ├── HRAdminPage.js      # Admin HR management
        │   ├── FinanceModule.js    # Invoicing with month-wise reports
        │   ├── SettingsPage.js     # Company, Workspaces, Users, Services
        │   └── ...
        └── components/
            ├── Sidebar.js          # Navigation with nested database links
            ├── settings/           # Settings tab components
            └── ui/                 # shadcn/ui components
```

## Modules Status

### 1. Company Profile ✅ COMPLETE
- Company Name, Logo URL, Address (full)
- Phone, Email, Website
- GST Number, PAN Number
- Invoice Prefix
- Bank Details (Account, IFSC, Bank Name, Branch)
- Multiple UPI IDs
- Terms & Conditions

### 2. Workspaces ✅ COMPLETE
- 5 default workspaces: Sales, Operations, Finance, Marketing, HR
- Create custom workspaces
- Assign members to workspaces

### 3. Status Management ✅ COMPLETE
- Full CRUD on statuses
- Drag & drop reordering
- Custom colors

### 4. Services Management ✅ COMPLETE
- Full CRUD on services
- Enable/disable services
- Billing type (one-time/recurring)
- Base pricing

### 5. User & Role Management ✅ COMPLETE
- Add/edit/deactivate users
- Customizable roles
- Module access control

### 6. Operations Module ✅ COMPLETE (Refactored Jan 11)
- **Notion-like Database System:**
  - Create databases from templates or blank
  - 10+ column types with inline editing
  - Custom columns and rows
- **Clean UI:**
  - Database tabs at top
  - Quick status filter chips
  - Advanced filters panel
  - Prominent Add Task button
  - Databases nested in sidebar

### 7. HR Module ✅ COMPLETE
- **Employee Portal:** Attendance, profile, leave requests, payslips view
- **Admin Portal:** Team dashboard, leave approvals, employee management
- **Email Notifications:** Via Resend (MOCKED - requires API key)

### 8. Finance Module ✅ COMPLETE
- Invoice creation with GST
- Company profile auto-fill
- Bank details & UPI on invoices
- Month-wise reports with charts
- PDF download

## User Roles

| Role | Access |
|------|--------|
| Super Admin | Full access to everything |
| Admin | All except Settings |
| Project Manager | Operations, Reports, HR Admin |
| BDE | Leads only |
| Employee | HR (self), Operations only |

## Test Credentials
- **Admin**: admin@drawlead.com / admin123
- **Employee**: employee@drawlead.com / emp123

## API Endpoints

### Notion Database System
- `GET /api/notion/databases` - List all databases
- `POST /api/notion/databases` - Create database
- `GET /api/notion/databases/{id}` - Get database with columns
- `PUT /api/notion/databases/{id}/pin` - Toggle pin status
- `POST /api/notion/databases/{id}/columns` - Add column
- `DELETE /api/notion/databases/{id}/columns/{col_id}` - Delete column
- `GET /api/notion/databases/{id}/rows` - Get all rows
- `POST /api/notion/databases/{id}/rows` - Create row
- `PUT /api/notion/databases/{id}/rows/{row_id}/cell` - Update cell
- `DELETE /api/notion/databases/{id}/rows/{row_id}` - Delete row
- `GET /api/notion/templates` - Get templates
- `POST /api/notion/databases/from-template/{template_id}` - Create from template

### HR Module
- `GET/POST /api/hr/attendance` - Employee attendance
- `GET/PUT /api/hr/profile` - Employee profile
- `GET/POST /api/hr/leave` - Leave requests
- `GET /api/hr/admin/employees` - Admin: all employees
- `PUT /api/hr/admin/leave/{id}` - Admin: approve/reject leave

## Pending Tasks

### P1 (High Priority)
- **Resend API Configuration:** User needs to provide RESEND_API_KEY and SENDER_EMAIL in backend/.env for email notifications to work
- **Kanban/Board View:** Add alternative view for Notion databases

### P2 (Medium Priority)
- **Finance Module:** Build Payroll, GST, Budgeting tabs UI
- **Sales Module:** CSV Import/Export for leads
- **Code Refactor:** Split OperationsPage.js components (919 lines)

### P3 (Backlog)
- Calendar view in Operations
- Timeline view in Operations
- Partial payments support in Finance
- Audit logs for changes

## Tech Stack
- **Backend**: FastAPI, MongoDB, Pydantic, JWT Auth
- **Frontend**: React, Tailwind CSS, shadcn/ui, lucide-react
- **Email**: Resend (MOCKED)
- **PDF**: jsPDF, jspdf-autotable
- **Database**: MongoDB

## Known Mocked Integrations
- **Resend Email:** Implemented but requires user's API key (RESEND_API_KEY, SENDER_EMAIL in backend/.env)
