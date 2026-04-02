# Drawlead OS - Product Requirements Document

## Original Problem Statement
Build a comprehensive internal operating system called "Drawlead OS" for managing leads, HR, operations, and documentation. The system should support role-based access control (RBAC) with different user types having different module access.

## Core Requirements
1. **Leads Module** - Lead management with stages, Kanban view, custom fields, CSV import/export
2. **HR Module** - Attendance tracking, leave management, payroll management, performance reviews
3. **Operations Module** - Project and task management with Kanban view
4. **Documentation Module** - Google Sheets and Docs link management for Business Dev users
5. **Settings** - User management, role management, services, company profile
6. **Role-Based Access Control** - Different roles (Admin, BDE, Employee, etc.) with granular permissions
7. **Calendar Module** - Full calendar view with holidays, leaves, tasks, and Google Calendar integration

## User Personas
- **Super Admin**: Full access to all modules, user management, system configuration
- **Admin**: Most module access, limited settings
- **Business Development**: Leads, HR, Documentations
- **Project Manager/Operations Admin**: Operations, Leave Verification, Reports
- **Employee**: HR (self-service), Operations (assigned tasks), Calendar

## Technical Architecture
- **Backend**: FastAPI with MongoDB (motor async driver)
- **Frontend**: React with Tailwind CSS, Shadcn UI components
- **Authentication**: JWT-based with Emergent-managed Google Auth option
- **Database**: MongoDB with collections for users, leads, attendance, leave, documentation, calendar_connections, salary_history, etc.

---

## Implemented Features

### Payroll Management Module (DONE - April 2026)
**Salary History & Hikes Tracking:**
- Complete salary history with effective dates
- Support for multiple hike types: Initial, Performance, Confirmation, Annual Increase, 6 Month Review, 3 Month Review, Promotion, Market Adjustment
- Duration calculation for each salary level
- Growth percentage tracking

**Month-Tied Payroll Display:**
- Payroll details dynamically change based on Month/Year filter
- Selecting a past month shows the effective salary at that time
- Example: Aug 2024 shows ₹15K joining salary, Apr 2026 shows current ₹25K

**HR Admin Payroll Management (DONE - April 2026):**
- Employee grid cards with: Name, Designation, Current Salary, Payslip Status Badge
- Click employee opens detail view with tabs: Salary/Payslip | Salary History
- Search employees by name, email, or designation
- Month/Year filter for payslip periods

**Payslip Workflow (DONE - April 2026, Enhanced December 2025):**
1. **HR Creates Payslip:** Opens Create Payslip Modal with optional HR Remarks field, auto-calculates from attendance + salary records
2. **Operations Review:** Manager reviews without seeing salary details, adds performance notes **(OPTIONAL - can skip and forward to CEO)**
3. **CEO Review:** Final approval with visibility into all details **(OPTIONAL - can approve without comment)**
4. **Generate Payslip:** HR marks as ready for employee
5. **Download PDF:** Employee can download from their Payroll tab

**Payslip Status Flow:** Draft → Operations Review → CEO Review → Approved → Generated

**HR Remarks & Optional Reviews Enhancement (DONE - December 2025):**
- **Create Payslip Modal:** Opens when clicking "Create Payslip" button, shows employee info, base salary, and HR Remarks textarea (optional)
- **HR Remarks:** Saved with payslip, displayed in payslip details, and included in generated PDF
- **Optional Reviews:** Both Operations and CEO review text fields are optional - users can skip and proceed without entering text
- **Review UI Changes:** 
  - Label shows "Your Review (Optional)"
  - Placeholder: "Enter your review or leave empty to skip..."
  - Helper text: "You can skip the review and just forward to CEO"
  - Button changes to "Skip & Forward to CEO" or "Approve" when review is empty
- **Previous Payslips Section:** Shows below current payslip in employee detail view, collapsible list with badge showing record count, sorted by date descending, includes download PDF button for generated payslips
- **PDF Excludes Reviews:** Operations and CEO review comments are NOT included in the generated PDF (only HR Remarks appear)

**Payslip Details:**
- Attendance Summary: Working Days, Present, Casual/Sick Leave, Absent (LOP), Holidays, **Extra Hours**, **Less Hours**
- Earnings: Base Salary, Per Day, Days Paid, Earned Salary
- Deductions: PF (configurable %), Professional Tax (configurable), LOP Deduction
- Net Salary with HR Remarks
- Reviews section shows Operations and CEO comments

**Payroll Settings (HR Admin Configurable):**
- **PF Configuration:** Enable/disable toggle, configurable percentage (default 12%)
- **Professional Tax:** Enable/disable toggle, amount (default ₹200), threshold (default ₹15,000)
- **Working Hours:** Standard hours per day (default 8.0) - used for Extra/Less hours calculation
- Settings affect all new payslips created after change

**Attendance-Based Payroll Calculation:**
- **Attendance Summary:**
  - Total Working Days (from company calendar, default 22)
  - Holidays count
  - Days Present (from attendance records)
  - Casual Leave (approved)
  - Sick Leave (approved)
  - Absent/LOP days (unpaid absences)
  - **Extra Hours** (total hours worked - expected hours, if positive)
  - **Less Hours** (expected hours - total hours worked, if positive)
- **Salary Breakdown:**
  - Base Salary
  - Per Day Salary (Base / Working Days)
  - Days Paid (Present + Paid Leaves)
  - Earned Salary (Per Day × Days Paid)
- **Deductions (Configurable):**
  - PF (configurable % of base, can be disabled)
  - Professional Tax (configurable amount if salary > threshold, can be disabled)
  - LOP Deduction (Per Day × Absent Days)
  - Total Deductions
- **Net Salary:** Earned Salary - Deductions

**PDF Generation:**
- Colorful single-page PDF with company branding
- Includes: Company name/address, Employee details, Pay period
- Attendance summary table with all columns
- Earnings and Deductions side-by-side
- Net Salary highlighted with border
- HR Remarks (if provided)
- Computer-generated footer
- **Note:** Operations and CEO reviews are NOT included in PDF (professional salary document only)

**API Endpoints:**
- GET `/api/payroll/hike-reasons` - List of hike reason types
- GET `/api/payroll/salary-history/{user_id}` - Complete salary history
- GET `/api/payroll/details/{user_id}?month=X&year=Y` - Payroll with attendance-based calc
- GET `/api/payroll/salary-at-date/{user_id}?month=X&year=Y` - Effective salary at date
- POST `/api/payroll/salary/add` - Add new salary record
- DELETE `/api/payroll/salary/{record_id}` - Delete salary record
- GET `/api/payroll/employees` - All employees salary overview (admin)
- POST `/api/payroll/payslip/create` - Create payslip for employee
- GET `/api/payroll/payslips?month=X&year=Y` - Get payslips for month
- PUT `/api/payroll/payslip/{id}/submit-for-operations` - HR submits to Operations
- PUT `/api/payroll/payslip/{id}/operations-review` - Operations adds review
- PUT `/api/payroll/payslip/{id}/ceo-review` - CEO approves
- PUT `/api/payroll/payslip/{id}/generate` - HR generates final payslip
- GET `/api/payroll/my-payslips` - Employee gets own payslips
- **GET `/api/payroll/employee-payslips/{user_id}`** - Get all payslips for a specific employee (for Previous Payslips display)
- GET `/api/payroll/company-settings` - Get company details for PDF
- PUT `/api/payroll/company-settings` - Update company details (super admin)
- **GET `/api/payroll/settings`** - Get payroll calculation settings
- **PUT `/api/payroll/settings`** - Update payroll settings (HR Admin)
- **GET `/api/payroll/payslip/{id}/pdf`** - Download payslip PDF

### Calendar Module (DONE - April 2026)
**Full Calendar Page** accessible to ALL users from sidebar:
- Monthly calendar view showing all days
- Working days (Mon-Fri) vs weekends (Sat/Sun) with visual distinction
- Public Holidays displayed with red highlighting
- Approved leaves shown with color coding (Casual=orange, Sick=pink)
- Attendance status indicators (Office=indigo, WFH=green)
- Google Calendar events count badge per day

**Monthly Leave Balance:**
- 2 Casual + 2 Sick leaves per MONTH (not yearly)
- Balance display showing remaining leaves
- Resets every month automatically

**Click on Day:**
- Shows day detail panel on right sidebar
- Displays attendance info (clock in/out times)
- Shows tasks assigned for that day
- Shows Google Calendar meetings (if connected)
- "View Full" button to navigate to full day detail page

**HR Calendar Management:**
- Admin can add/remove public holidays
- Holiday types: Public, Optional, Company
- Holidays visible to all users on calendar

**Google Calendar Integration:**
- OAuth2 flow for connecting user's Google Calendar
- Each user connects their own account
- Meetings fetched and displayed on calendar
- Status endpoint to check connection

### Leave Approval Workflow (DONE - April 2026)
**Enhanced Leave Flow:**
1. Employee requests leave
2. HR sees request with "View Tasks" button to see tasks during leave period
3. HR can:
   - "Quick Approve" for leaves without conflicts
   - "Send for Verification" to Operations Admin
   - "Reject" immediately
4. Operations Admin reviews on dedicated "Leave Verification" page:
   - Sees pending verification requests
   - Views tasks that need reassignment
   - Reassigns tasks to other users
   - Verifies or rejects with remarks
5. After verification, HR gives "Final Approve"

**Leave Verification Page:**
- Accessible to admin/operations_admin/project_manager
- Shows pending verification count
- Expandable cards for each leave request
- Task reassignment dropdowns
- Verification remarks field

### Leave Status States:
- `pending` - Initial state
- `pending_verification` - Sent to Operations Admin
- `verified_pending_approval` - Verified, awaiting final approval
- `verification_rejected` - Operations rejected
- `approved` - Final approval
- `rejected` - Rejected by HR

### HR Attendance Monthly Statistics & Filters (DONE - April 2026)
**Enhanced Attendance Tab in HR Portal:**
- Month/Year dropdown filters to view historical attendance
- Monthly statistics cards showing:
  - Total Working Days (of the month)
  - Presentable Days (days actually worked)
  - Total Absent (excluding pending/future days)
  - Casual Leave (used/2 per month)
  - Sick Leave (used/2 per month)
  - Extra Hours (for the month)
- Dynamic Monthly Summary section with updated title
- Attendance History table filtered by selected month/year
- Backend API already supports `?month=X&year=Y` query parameters

---

## API Endpoints

### Calendar & Google OAuth
- GET `/api/oauth/calendar/connect` - Start Google OAuth flow
- GET `/api/oauth/calendar/callback` - OAuth callback
- GET `/api/oauth/calendar/status` - Check connection status
- POST `/api/oauth/calendar/disconnect` - Disconnect Google Calendar
- GET `/api/oauth/calendar/events` - Get events for date range
- GET `/api/oauth/calendar/events/date/{date}` - Get events for specific date

### Leave Workflow (Enhanced)
- GET `/api/hr/leave/monthly-balance` - Get monthly leave balance (2 casual + 2 sick)
- GET `/api/hr/leave/{leave_id}/tasks` - Get tasks during leave period
- POST `/api/hr/leave/{leave_id}/send-for-verification` - HR sends to Ops Admin
- GET `/api/hr/leave/pending-verification` - Leaves awaiting verification
- POST `/api/hr/leave/{leave_id}/verify` - Ops Admin verifies with task reassignments
- PUT `/api/hr/leave/{leave_id}/final-approve` - Final approval after verification

### Existing HR Endpoints
- POST `/api/hr/attendance/clock-in` - Clock in
- POST `/api/hr/attendance/clock-out` - Clock out
- GET `/api/hr/attendance/calendar/{year}/{month}` - Attendance calendar data
- GET `/api/hr/attendance/date-detail/{date}` - Specific date attendance
- GET `/api/hr/attendance/history?month=X&year=Y` - **NEW** Get attendance history with monthly stats (supports month/year filters)
- GET/PUT `/api/hr/admin/calendar/{year}/{month}` - Company calendar with holidays
- POST `/api/hr/leave/request` - Request leave
- GET `/api/hr/leave/my-requests` - My leave requests
- PUT `/api/hr/leave/{leave_id}/approve` - Quick approve leave
- PUT `/api/hr/leave/{leave_id}/reject` - Reject leave

### BDE Tasks
- GET `/api/bde/tasks/by-date/{date}` - Get tasks for specific date

---

## Database Collections

### calendar_connections
```json
{
  "user_id": "string",
  "google_email": "string",
  "access_token": "string",
  "refresh_token": "string",
  "token_expiry": "datetime",
  "connected_at": "datetime",
  "is_active": "boolean"
}
```

### leave_requests (Enhanced)
```json
{
  "leave_id": "string",
  "user_id": "string",
  "user_name": "string",
  "user_email": "string",
  "leave_type": "casual|sick|wfh|earned",
  "start_date": "datetime",
  "end_date": "datetime",
  "reason": "string",
  "status": "pending|pending_verification|verified_pending_approval|approved|rejected",
  "sent_for_verification_by": "string",
  "sent_for_verification_at": "datetime",
  "verified_by": "string",
  "verified_by_name": "string",
  "verified_at": "datetime",
  "verification_remarks": "string",
  "task_reassignments": [{"task_id": "string", "new_assignee_id": "string"}],
  "approved_by": "string",
  "approved_at": "datetime"
}
```

### company_calendars
```json
{
  "calendar_id": "string",
  "month": "number",
  "year": "number",
  "holidays": [{"date": "string", "name": "string", "type": "public|optional|company"}],
  "working_days": "number",
  "special_working_days": ["string"]
}
```

### salary_history
```json
{
  "record_id": "string",
  "user_id": "string",
  "amount": "number",
  "effective_from": "datetime",
  "reason": "initial|performance|confirmation|annual_increase|6_month_review|3_month_review|promotion|market_adjustment",
  "notes": "string",
  "created_by": "string",
  "created_at": "datetime"
}
```

---

## Frontend Pages

### New Pages
- `/calendar` - CalendarPage.js - Full calendar with all features
- `/calendar/:date` - CalendarDayDetailPage.js - Full day detail view
- `/leave-verification` - LeaveVerificationPage.js - Operations Admin verification

### Modified Pages
- HRAdminPage.js - Enhanced LeaveRequestsTab with workflow buttons
- Sidebar.js - Added Calendar and Leave Verification links

---

## Credentials
- Super Admin: vinoth@drawlead.com / admin123

## Environment Variables
- `GOOGLE_CALENDAR_CLIENT_ID` - Google OAuth Client ID
- `GOOGLE_CALENDAR_CLIENT_SECRET` - Google OAuth Client Secret
- `RESEND_API_KEY` - For email notifications (currently MOCKED)
- `MONGO_URL` - MongoDB connection string (using local: mongodb://localhost:27017)

---

## Upcoming Tasks
1. **Google Sheets Integration** - Auto-sync leads from Google Sheets
2. **Leads Custom Fields** - Notion-style custom fields
3. **Production Deployment** - Configure Resend API key

## Future/Backlog
1. Chat Backend Refactor - In-memory → MongoDB
2. Refactor large components (HRAdminPage, LeadsPageV2, BDETasksPage)
3. Kanban drag-and-drop for Operations module

---

## Known Mocked Features
- **Resend Email**: Prints to console instead of sending real emails
- **Team Chat**: Uses in-memory storage, not persistent

## Known Issues
- MongoDB Atlas connection timeout (bypassed with local MongoDB)
