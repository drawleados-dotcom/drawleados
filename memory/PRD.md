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

## Email Notification System (DONE - Dec 2025)

The system sends email notifications with "View" buttons for:

| Action | Recipients |
|--------|-----------|
| Leave Request | All HR Admins/Managers |
| Leave Approved/Rejected | Employee |
| Permission Request | All HR Admins |
| Permission Approved/Rejected | Employee |
| Early Login/Logout (needs approval) | All HR Admins |
| Lead Assigned | New Lead Owner |
| Deal Closed | Lead Owner + Admins |
| Lead Remark Added | Lead Owner |
| Payslip Ready | Employee |
| Payslip Acknowledged | HR/Finance |
| Payment Released | Employee |

**Email Features:**
- Beautiful HTML template with Drawlead branding
- "View" button linking to specific item
- Sent to individual registered emails based on responsibilities
- Currently MOCKED (configure `RESEND_API_KEY` in .env to enable)

---

## API Endpoints
### Authentication
- POST `/api/auth/login` - Login with email/password
- POST `/api/auth/register` - Register new user
- GET `/api/auth/me` - Get current user
- POST `/api/auth/request-otp` - Request OTP for password change (sends to registered email)
- POST `/api/auth/verify-otp-change-password` - Verify OTP and change password

### Leads (V2)
- GET/POST `/api/leads` - List/create leads
- PUT/DELETE `/api/leads/{lead_id}` - Update/delete lead
- GET `/api/leads/export` - Export leads to CSV
- POST `/api/leads/import` - Import leads from CSV
- GET/POST/PUT/DELETE `/api/leads/stages` - Manage lead stages

### HR
- POST `/api/hr/attendance/clock-in` - Clock in with login time entry
- POST `/api/hr/attendance/clock-out` - Clock out with logout time entry
- POST `/api/hr/attendance/lunch-start` - Start lunch break
- POST `/api/hr/attendance/lunch-end` - End lunch break
- GET `/api/hr/attendance/today` - Today's attendance + HR settings
- GET `/api/hr/attendance/history` - Monthly attendance history with summary
- GET `/api/hr/attendance/report` - 6-month attendance report
- POST `/api/hr/permission/request` - Request permission (hours off)
- GET `/api/hr/permission/requests` - My permission requests
- POST `/api/hr/leave/request` - Request leave
- GET `/api/hr/leave/my-requests` - My leave requests
- GET `/api/hr/leave/balance` - Leave balance
- PUT `/api/hr/leave/{leave_id}/approve` - Approve leave
- GET `/api/hr/admin/attendance/pending-approvals` - Pending approvals (HR Admin)
- POST `/api/hr/admin/attendance/approve/{attendance_id}` - Approve attendance
- GET `/api/hr/admin/attendance/all` - All employees' attendance
- GET/PUT `/api/hr/admin/settings` - HR Settings (work hours, login/logout times)
- GET/PUT `/api/hr/admin/calendar/{year}/{month}` - Monthly calendar with holidays
- GET/POST `/api/hr/admin/salary/{user_id}` - Employee salary details
- POST `/api/hr/admin/payslip/generate` - Generate payslip
- GET `/api/hr/admin/payslips` - All payslips
- PUT `/api/hr/admin/payslip/{id}/submit` - Submit for approval
- PUT `/api/hr/admin/payslip/{id}/approve` - Super Admin approves
- PUT `/api/hr/payslip/{id}/acknowledge` - Employee acknowledges
- PUT `/api/hr/admin/payslip/{id}/send-to-finance` - Send to finance
- PUT `/api/hr/finance/payslip/{id}/release` - Finance releases payment
- GET `/api/hr/payslips/my` - My payslips
- GET `/api/hr/payslip/{id}` - Single payslip details

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

#### P0 - SEO Board (DONE - Dec 2025)
- ✅ **Multiple Clients** - Add/manage SEO clients with website, contact info
- ✅ **Separate Board per Client** - Each client has their own Kanban board
- ✅ **Task Categories:**
  - On-Page SEO (title, meta, content, keywords)
  - Off-Page SEO (link building, social signals)
  - Backlinks (tracking, outreach, guest posts)
  - GMB (Google My Business optimization)
  - Other/Extra Work
- ✅ **Predefined Task Templates** - 50+ templates across all categories
- ✅ **Bulk Task Creation** - Add all tasks from a category template at once
- ✅ **Kanban Board** - Drag tasks through To Do → In Progress → Review → Done
- ✅ **Quick Status Change** - One-click status buttons on each task card
- ✅ **Task Assignment** - Assign tasks to team members with Operations access
- ✅ **Priority & Due Dates** - Low/Medium/High/Urgent priorities
- ✅ **Category Filtering** - Filter board by category
- ✅ **Progress Tracking** - Visual progress bars on client cards

#### P0 - Documentations Module (DONE - Dec 2025)
- ✅ Full CRUD for Google Sheets and Docs links
- ✅ Sheets and Docs tabs with counts
- ✅ Add/Edit/Delete documents
- ✅ In-app viewer modal with iframe embedding
- ✅ Stats badges showing document counts
- ✅ Backend API at `/api/docs/*`
- ✅ **Role-Based Document Privacy:**
  - Regular users only see their department's documents
  - Super Admin & Operations see ALL documents with department tabs:
    - CEO | BD | Operations | Website | SEO | Meta
  - Documents auto-assigned to user's department on creation
  - Admins can create documents for any department

#### P0 - HR/Attendance Management System (DONE - Dec 2025)
- ✅ **Enhanced Attendance Tracking**:
  - Employee enters login/logout time manually
  - Lunch break tracking (start/end with duration calculation)
  - Auto-calculation: Work hours = Total time - Lunch - Permission hours
  - Extra hours calculation when > 9 hours
- ✅ **Dashboard Cards**: Working Days, Present, Absent, Casual Leave (0/12), Sick Leave (0/6), Extra Hours
- ✅ **Request Leave/Permission Buttons** with modals
- ✅ **Approval Workflow**:
  - Early login (>1 hour before 09:00) → pending HR approval
  - Early logout (<9 hours) → pending HR approval
- ✅ **Attendance History Table**: Date, Day, Login, Logout, Lunch, Permission, Work Hrs, Extra Hrs, Status
- ✅ **HR Settings**: Standard work hours (9), login time (09:00), logout time (18:00)
- ✅ **Monthly Calendar**: HR Admin can set holidays and working days
- ✅ **Payslip System** (Backend ready, needs frontend UI):
  - Generate payslip based on attendance
  - Approval flow: HR → Super Admin → Employee Acknowledge → Finance Release
  - PDF download capability

#### P0 - Operations Approval Workflow (DONE - Dec 2025)
- ✅ **Digital Marketing Board Template** with approval workflow for DM teams
- ✅ **Approval Status Flow**: To Do → In Progress → Operations Approval → Vinoth Approval (optional) → Client Approval → Revision → Done
- ✅ **Departments**: Website, SEO, Meta Ads, Content, Design, Social Media
- ✅ **Priority Levels**: Low, Medium, High, Urgent
- ✅ **Enhanced Kanban View**:
  - Approval columns highlighted with different backgrounds
  - Approval steps marked with ⏳ icons
  - Quick status change dropdown on task cards
  - "Move to next status" button for workflow progression
- ✅ **Task Fields**: Task Name, Department, Status, Priority, Due Date, Assigned To, Client, Attachments, Revision Notes

#### P0 - Add Employee Feature (DONE - Dec 2025)
- ✅ **Add Employee Modal** in HR Admin with 5 tabs:
  - Basic Details (name, email, phone, DOB, gender, blood group, address, emergency contact)
  - Account Details (bank info, PAN, Aadhar)
  - Employment (employee ID, designation, department, employment type, joining date, manager, location)
  - Documents (Google Drive links for resume, ID proof, address proof, education docs, offer letter)
  - Role & Access (13 role options, module access checkboxes, password with generate button)
- ✅ Backend API: `POST /api/hr/admin/create-employee`
- ✅ Password hashing with bcrypt
- ✅ Leave balance auto-initialization for new employees
- ✅ Welcome email with credentials (MOCKED - Resend API)
- ✅ Duplicate email validation
- ✅ New employees can log in immediately after creation

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

#### April 2026
- ✅ **Employee Profile Page** - `/profile` route with three tabs:
  - My Details: Personal info (name, email, phone) + Employment details (department, designation, joining date)
  - Attendance Summary: Days present/absent, total/extra hours, average hours/day
  - Security: OTP-based password change
- ✅ **OTP Password Change Flow**: 
  - Backend routes: `POST /api/auth/request-otp`, `POST /api/auth/verify-otp-change-password`
  - 6-digit OTP sent to registered email (mocked in logs)
  - OTP valid for 10 minutes
- ✅ **Employee Sidebar Access**: All employees can now see HR, Operations, and Profile links regardless of explicit `module_access` array
- ✅ Fixed datetime timezone comparison bug in OTP verification

---

## Prioritized Backlog

### P0 - Critical
- [x] **SEO Board** - DONE (Dec 2025)
- [x] **Employee Profile Page & OTP Password Change** - DONE (Apr 2026)
- [x] **Business Development Sidebar Updates** - DONE (Apr 2026)
- [x] **HR Admin Enhancements** - DONE (Apr 2026)
  - Designations module with CRUD operations
  - Departments module with CRUD operations
  - Enhanced Add Employee modal:
    - Account Details: A/C Holder Name, Branch, UPI ID
    - Employment: Designation dropdown from Designations module
    - Employment Type: Added Freelancer option
    - Documents: Dynamic document management (Add/View/Delete)
    - Role & Access: Simplified, designation-based access
- [x] **Demo Users & Quick Login** - DONE (Apr 2026)
  - 5 Demo users (Super Admin, HR Manager, BDE, Web Dev, SEO)
  - Auto-login dropdown on login page
  - Quick login button for one-click test access
- [x] **Work Time Settings in HR Admin** - DONE (Apr 2026)
  - Configurable standard work hours (default: 9)
  - Standard login/logout times (09:00 AM - 06:00 PM)
  - Default lunch duration (60 minutes)
  - Early login threshold (60 minutes before login triggers approval)
  - Grace period (15 minutes for late login)
  - Overtime rate multiplier (1.5x)
  - Info box explaining how approvals work
- [x] **Dynamic Duration Display in Attendance Modals** - DONE (Apr 2026)
  - Clock Out modal shows "Total Work Hours" dynamically
  - Warning displayed if <9 hours worked (requires approval)
  - Lunch In modal shows "Lunch Duration" dynamically
  - Duration updates in real-time as user changes time
- [x] **New Time Picker UI for Attendance** - DONE (Apr 2026)
  - Separate Hour input (1-12) with up/down arrow buttons
  - Separate Minute input (0-59) with up/down arrow buttons
  - AM/PM toggle button (Blue for AM, Orange for PM)
  - Manual number entry supported
  - Real-time duration recalculation as values change
- [ ] Google Sheets Integration - Auto-sync leads from a connected Google Sheet
- [ ] Leads Custom Fields - Notion-style custom fields for leads

### P1 - High Priority
- [ ] Multiple Login/Logout Sessions Per Day - Allow multiple clock-in/out cycles
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
- **Super Admin**: Vinoth@drawlead.com / 6383145061
- **HR Manager**: hr@drawlead.com / hr123456
- **Business Dev**: bde@drawlead.com / bde123456
- **Web Developer**: dev@drawlead.com / dev123456
- **SEO Specialist**: seo@drawlead.com / seo123456

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
