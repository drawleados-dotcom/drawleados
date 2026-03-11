# Drawlead OS - Product Requirements Document

## Original Problem Statement
Build a comprehensive internal operating system called "Drawlead OS" for managing leads, HR, operations, and documentation. The system should support role-based access control (RBAC) with different user types having different module access.

## Core Requirements
1. **Leads Module** - Lead management with stages, Kanban view, custom fields, CSV import/export
2. **HR Module** - Attendance tracking, leave management, payslips, performance reviews
3. **Operations Module** - Project and task management with Kanban view
4. **Documentation Module** - Google Sheets and Docs link management for Business Dev users
5. **Settings** - User management, role management, services, company profile
6. **Role-Based Access Control** - Different roles (Admin, BDE, Employee, etc.) with granular permissions

## User Personas
- **Super Admin**: Full access to all modules, user management, system configuration
- **Admin**: Most module access, limited settings
- **Business Development**: Leads, HR, Documentations
- **Project Manager**: Operations, Reports
- **Employee**: HR (self-service), Operations (assigned tasks)

## Technical Architecture
- **Backend**: FastAPI with MongoDB (motor async driver)
- **Frontend**: React with Tailwind CSS, Shadcn UI components
- **Authentication**: JWT-based with Emergent-managed Google Auth option
- **Database**: MongoDB with collections for users, leads, attendance, leave, documentation, etc.

## API Endpoints
### Authentication
- POST `/api/auth/login` - Login with email/password
- POST `/api/auth/register` - Register new user
- GET `/api/auth/me` - Get current user

### Leads (V2)
- GET/POST `/api/leads` - List/create leads
- PUT/DELETE `/api/leads/{lead_id}` - Update/delete lead
- GET `/api/leads/export` - Export leads to CSV
- POST `/api/leads/import` - Import leads from CSV
- GET/POST/PUT/DELETE `/api/leads/stages` - Manage lead stages

### HR
- POST/GET `/api/hr/attendance/clock-in`, `/api/hr/attendance/clock-out`
- GET `/api/hr/attendance/history`, `/api/hr/attendance/today`
- POST/GET `/api/hr/leave/request`, `/api/hr/leave/my-requests`
- PUT `/api/hr/leave/{leave_id}/approve`, `/api/hr/leave/{leave_id}/reject`

### Documentation
- GET/POST `/api/docs/documents` - List/create documents
- PUT/DELETE `/api/docs/documents/{doc_id}` - Update/delete document
- GET `/api/docs/stats` - Get document statistics

### Settings
- GET/POST/PUT/DELETE `/api/users` - User management
- GET/POST/PUT/DELETE `/api/services` - Service management
- GET `/api/roles` - Role definitions

## Database Schema

### users
```json
{
  "user_id": "string",
  "name": "string",
  "email": "string",
  "password_hash": "string",
  "role": "super_admin|admin|business_development|project_manager|employee",
  "module_access": ["leads", "hr", "operations", "settings"],
  "permissions": {
    "can_create_projects": boolean,
    "can_delete_tasks": boolean,
    "can_manage_users": boolean
  }
}
```

### leads
```json
{
  "lead_id": "string",
  "name": "string",
  "email": "string",
  "phone": "string",
  "company_name": "string",
  "website": "string",
  "source": "string",
  "lead_owner_id": "string",
  "service": "string",
  "priority": "hot|warm|cold",
  "lead_type": "new|existing",
  "industry": "string",
  "estimation_amount": number,
  "quotation_link": "string",
  "proposal_link": "string",
  "notes": "string",
  "stage_id": "string",
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

### documentation
```json
{
  "doc_id": "string",
  "name": "string",
  "link": "string",
  "doc_type": "sheet|doc",
  "description": "string",
  "created_by": "string",
  "created_by_name": "string",
  "created_at": "datetime",
  "is_deleted": boolean
}
```

---

## What's Been Implemented (as of December 2025)

### Completed Features

#### P0 - Documentations Module (DONE - Dec 2025)
- ✅ Full CRUD for Google Sheets and Docs links
- ✅ Sheets and Docs tabs with counts
- ✅ Add/Edit/Delete documents
- ✅ In-app viewer modal with iframe embedding
- ✅ Stats badges showing document counts
- ✅ RBAC restriction to Business Development users
- ✅ Backend API at `/api/docs/*`

#### P1 - Theme Fixes (DONE - Dec 2025)
- ✅ Fixed light/dark mode on HR page
- ✅ Fixed light/dark mode on HR Admin page  
- ✅ Fixed light/dark mode on Settings page
- ✅ Proper theme context usage with props passing to sub-components

#### Earlier Completed
- ✅ Comprehensive Leads Module with stages, Kanban view
- ✅ Lead import/export via CSV
- ✅ Lead Owner functionality with auto-assignment
- ✅ Role-Based Access Control (RBAC) system
- ✅ User management with role/permission assignment
- ✅ Sidebar navigation with RBAC-based menu visibility
- ✅ HR attendance tracking (clock in/out, history)
- ✅ HR leave management with approval workflow
- ✅ Operations Kanban board

---

## Prioritized Backlog

### P0 - Critical
- [ ] Google Sheets Integration - Auto-sync leads from a connected Google Sheet
- [ ] Leads Custom Fields - Notion-style custom fields for leads

### P1 - High Priority
- [ ] Refactor LeadsPageV2.js - Break down into smaller components
- [ ] Google Calendar Integration - Sync meetings and events

### P2 - Medium Priority
- [ ] Chat Backend Refactor - Migrate from in-memory to MongoDB
- [ ] Operations Kanban Drag-and-Drop improvements
- [ ] Enhanced reporting and analytics

### P3 - Future/Nice to Have
- [ ] Mobile responsive improvements
- [ ] Email template customization
- [ ] Notification system
- [ ] Activity logging/audit trail

---

## Test Credentials
- **Admin**: vinoth@drawlead.com / admin123

## 3rd Party Integrations
- Emergent-managed Google Auth
- Claude Sonnet 4.5 (for AI features)
- Resend (email - MOCKED with placeholder keys)
- jsPDF & jspdf-autotable (PDF generation)
- xlsx (Excel/CSV handling)
- @dnd-kit/core & @dnd-kit/sortable (drag-and-drop)

## Known Mocked Services
- **Resend Email**: Uses placeholder API keys - emails are logged but not sent
- **Team Chat Backend**: Uses in-memory storage, not persistent
