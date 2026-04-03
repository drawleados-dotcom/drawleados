# Drawlead OS - Product Requirements Document

## Original Problem Statement
Build a comprehensive internal operating system called "Drawlead OS" for managing leads, HR, operations, and documentation. The system should support role-based access control (RBAC) with different user types having different module access.

## Core Requirements
1. **Leads Module** - Lead management with stages, Kanban view, custom fields, CSV import/export
2. **HR Module** - Attendance tracking, leave management, payroll management, performance reviews
3. **Operations Module** - Project and task management with Kanban view
4. **Tasks Module** - Hierarchical task management: Departments → Projects → Tasks (NEW - April 2026)
5. **Documentation Module** - Google Sheets and Docs link management for Business Dev users
6. **Settings** - User management, role management, services, company profile
7. **Role-Based Access Control** - Different roles (Admin, BDE, Employee, etc.) with granular permissions
8. **Calendar Module** - Full calendar view with holidays, leaves, tasks, and Google Calendar integration

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
- **Database**: MongoDB with collections for users, leads, attendance, leave, documentation, calendar_connections, salary_history, departments, department_projects, project_tasks, project_documents, task_timers, etc.

---

## Implemented Features
### My Profile / HR Portal Redesign (NEW - April 2026)
**Purpose:** Redesigned HR Portal page with personalized greeting and improved leave/permission management.

**Changes:**
1. **Title**: Changed from "HR Portal" to "Hi, [Username]" (personalized greeting)

2. **Leave Tab - Two Sub-tabs:**
   - **Request Leave**: 
     - Leave Balance card (Casual, Sick, Earned, WFH)
     - Request Leave button and modal
     - Status summary cards (Pending, Approved, Rejected)
     - Leave requests list (clickable for detail popup with timeline)
   
   - **Request Permission**:
     - Permission request header with description
     - Request Permission button and modal (Date, From/To Time, Hours, Reason)
     - Status summary cards (Pending, Approved, Rejected)
     - Permission requests list

3. **Leave Detail Popup**:
   - Request summary (type, dates, days, reason)
   - Timeline showing: Request Submitted → HR Review → Approved/Rejected
   - HR Remarks section (if any)

**New Backend Endpoints:**
- `POST /api/hr/permissions/request` - Create permission request
- `GET /api/hr/permissions/my-requests` - Get user's permission requests
- `GET /api/hr/permissions/pending` - Get pending requests (HR admin)
- `POST /api/hr/permissions/{id}/approve` - Approve permission
- `POST /api/hr/permissions/{id}/reject` - Reject permission

---

### HR Admin Page Redesign (NEW - April 2026)
**Purpose:** Reorganized HR Admin page with improved tab structure for better UX.

**New Tab Structure (6 tabs):**
1. **Attendance** - Date filters (Day/Range/Month/Year), ALL employees list with status (Present/Absent/Yet to Login), click for check-in/check-out popup
2. **Employees** - Employee management with search and Add Employee
3. **Designation & Depts** - Combined tab with two sub-tabs:
   - Designations (role definitions with module access)
   - Departments (organizational units)
4. **Approvals** - Combined tab with two sub-tabs:
   - Pending Approvals (attendance corrections, permissions, leaves)
   - Leave Requests (all leave requests with filter)
5. **Payroll Mgmt** - Complete payroll management with salary history and payslip generation
6. **Calendar** - Combined tab with three sub-tabs:
   - Calendar View (visual monthly grid with holiday management, Sundays as holidays, click to toggle working day)
   - Work Settings (office hours, lunch break, work hours breakdown, working days, grace period)
   - Indian Holidays (pre-filled national holidays with Edit/Approve workflow, custom holiday addition)

**Calendar Features (Enhanced April 2026):**
- Sundays highlighted as holidays (purple) by default
- Click any Sunday to toggle as working day (green)
- Only approved holidays from "Indian Holidays" tab appear on calendar
- Legend showing: Holiday (red), Sunday Holiday (purple), Working Sunday (green)

**Work Settings Features (Enhanced April 2026):**
- Work Hours Summary card showing Total Office Hours, Work Hours, Lunch Break
- Fields: Office Start/End Time, Total Office Hours, Lunch Break (minutes), Effective Work Hours (auto-calculated), Grace Period, Working Days
- Formula: Effective Work Hours = Total Office Hours - Lunch Break

**Indian Holidays Features (Enhanced April 2026):**
- Pre-filled Indian national holidays for 2025/2026
- Each holiday has Edit and Approve buttons
- Only approved holidays show on Calendar View
- Can add custom holidays
- Shows "X Approved / Y Total" counter

**Removed Tabs:**
- Dashboard (consolidated into other tabs)
- All-Attendance (merged into Attendance)
- Leave Requests (merged into Approvals)
- Payslips (merged into Payroll Mgmt)
- Settings (merged into Calendar as Work Settings)

---



### Operations Head Dashboard (NEW - April 2026)
**Purpose:** Custom restricted view for users with ONLY 'tasks' module access.

**Implementation:**
- Users with `module_access: ['tasks']` and non-admin role get a restricted sidebar
- Sidebar shows ONLY: Calendar, My Tasks, Tasks, My Profile, Documentation
- Hidden items: Leads, BDE Tasks, Operations submenu, HR Admin, Finance, Settings, Documentations (full)
- Auto-redirect to `/my-tasks` after login (instead of default `/leads`)
- Access control: Blocked pages redirect to `/my-tasks`

**New Pages:**
- `/my-tasks` - BDE-style task table filtered to show only tasks assigned to the user
- `/my-documents` - Personal documentation management (Sheets/Docs created by user)

**New API Endpoints:**
- `GET /api/departments/my-tasks` - Returns all tasks where assigned_to matches current user
- `GET/POST /api/docs/my-documents` - Personal documents CRUD

**Files Modified:**
- `Sidebar.js` - `hasTasksModuleOnly` conditional rendering
- `ProtectedRoute.js` - Access control and redirect logic
- `App.js` - New routes for /my-tasks and /my-documents
- `department_routes.py` - /my-tasks endpoint
- `documentation_routes.py` - /my-documents endpoints

**Test User:** opshead@drawlead.com / admin123

---

### Tasks Module (NEW - April 2026, Updated with BDE-style Features)
**Hierarchical Structure:**
- **Departments** (SEO, Meta, Social Media, Design, ERP) - Admins can create more
- **Projects** under each department with filters and grid/list views
- **Tasks** inside projects with FULL BDE-style task board features

**Department Features:**
- Default departments created on first access
- Custom icon and color per department
- Project count displayed on card
- Admin-only creation of new departments

**Project Features:**
- Name, Client/Company, Description
- Start Date, End Date
- Status: Active, Completed, On Hold
- Team Members assignment
- Multiple Documents (Google Sheets/Docs links)
- Task progress bar (completed/total)
- Grid and List view with search and status filters

**Task Features (FULL BDE Task Board Style) - UPDATED:**
- **Summary Stats Cards**: Total Tasks, Pending, In Progress, Completed - with icons
- **Quick Filter Tabs**: All | My Tasks | Pending | In Progress | Completed
- **Advanced Filters Panel** (collapsible):
  - Date: All Time, Today, Single Date, Date Range
  - Assigned To: All, Myself, or specific user
  - Assigned By: All or specific user
  - Type: All Types, General, Meeting, Follow Up, Proposal, Call
  - Status: All Status, Pending, In Progress, Completed, On Hold
  - Reset Filters button
- **Table View** with columns:
  - TASK: Name, description, type badge (general, meeting, etc.)
  - STATUS: Badge with color
  - CREATED/ASSIGNED: Shows "Created by you" or "Assigned to you" badges
  - DUE DATE: Date + time + recurrence indicator
  - LINK: Work link icon
  - TIME: Accumulated time with timer icon
  - TIMER: Start/Resume/Pause/Finish buttons
  - ACTIONS: View, Edit, Delete
- **Timer Functionality**:
  - Start: Begins time tracking, changes status to in_progress
  - Pause: Pauses timer, accumulates time
  - Resume: Continues from paused state
  - Finish: Completes tracking, shows "Done" badge
- **Recurrence Support**:
  - None (One-time), Daily, Weekly, Monthly, Yearly, Weekdays (Mon-Fri), Custom
  - Custom: Repeat every X days/weeks/months/years, specific days (Mon-Sat)
  - Recurrence indicator in Due Date column (e.g., "Every Mon, Tue, Wed, Thu, Fri")
- Task Detail Modal: Shows all task info including time spent and recurrence

**Documents:**
- Add Google Sheets/Docs links with name
- View embedded in modal viewer
- Remove document

**API Endpoints:**
- GET/POST /api/departments - List/Create departments
- GET/POST /api/departments/{dept_id}/projects - List/Create projects
- GET/PUT/DELETE /api/departments/projects/{project_id} - Project CRUD
- GET/POST/DELETE /api/departments/projects/{project_id}/tasks - Task CRUD
- GET/POST/DELETE /api/departments/projects/{project_id}/documents - Document CRUD
- **POST /api/departments/projects/{project_id}/tasks/{task_id}/time-tracking** - Timer actions (start/pause/resume/finish)
- GET /api/departments/tasks/{task_id}/timer - Get timer status

---

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
- Operations Head (Tasks-only): opshead@drawlead.com / admin123

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

---

## Latest Updates (April 2026 - Session 43)

### Enhanced Employee Edit Modal (DONE)
- **Profile Photo Section**: Avatar with + button for uploading profile picture
- **4 Comprehensive Tabs**:
  1. **Basic Details**: Full Name, Email, Phone, Date of Birth, Gender, Blood Group
  2. **Account Details**: Account Holder Name, Bank Name, Branch, Account Number, IFSC Code, UPI ID, PAN Number, Aadhar Number
  3. **Employment**: Employee ID, Designation, Department, Employment Type, Joining Date, Reporting Manager, Work Location
  4. **Address & Emergency**: Street Address, City, State, Pincode, Emergency Contact (Name, Phone, Relation)
- All fields editable (previously only showed "short details")

### Calendar Sunday Configuration Popup (DONE)
- Clicking on any Sunday opens a configuration popup
- **3 Options**:
  1. **Working Day** (green) - Mark Sunday as a working day
  2. **Holiday** (purple) - Keep as regular Sunday holiday
  3. **Team Holiday** (red) - Mark as special team holiday
- Remarks field (optional) for adding notes
- Visual indicators: Selected option shows checkmark

### HR Admin Tab Active State (DONE)
- Active tab now uses `!text-white` class for guaranteed white text
- Improved contrast on purple background

### Header Task Manager Button Fix (DONE)
- Responsive design for smaller viewports (768px+)
- Text hidden on mobile, only icon visible
- Added `flex-shrink-0` to prevent overflow

### Test Report
- All 5 features passed testing (iteration_43.json)
- 100% frontend success rate

---

## Latest Updates (April 2026 - Session 44)

### Payslip Edit/Delete/Regenerate Functionality (DONE)
- **Edit Payslip** (for non-finalized payslips):
  - Opens modal with HR Remarks textarea
  - Can update HR Remarks field
  - Cannot edit finalized (generated/acknowledged/paid) payslips
  - API: `PUT /api/hr/admin/payslip/{id}/edit`

- **Delete Payslip** (for non-finalized payslips):
  - Shows confirmation dialog before deletion
  - Cannot delete finalized payslips
  - API: `DELETE /api/hr/admin/payslip/{id}`

- **Regenerate Payslip** (for all payslips):
  - Recalculates payslip from latest attendance/salary data
  - Resets status to draft after regeneration
  - Clears previous Operations and CEO reviews
  - API: `POST /api/hr/admin/payslip/{id}/regenerate`

**Button Visibility:**
- Draft/Operations Review/CEO Review status → Edit, Delete, Regenerate + Submit buttons
- Generated status → Download PDF, Regenerate only

**Test Report:**
- All 8 backend tests passed (iteration_44.json)
- 100% frontend/backend success rate

---

## Latest Updates (April 2026 - Session 45)

### Tasks Module Sub-tabs Enhancement (DONE)
- **My Tasks Button**: Added to Tasks Module header, opens personal task view
- **4 Sub-tabs with count badges**:
  1. **All** - Shows all tasks
  2. **Tasks** - Regular tasks (general, follow_up, proposal, call)
  3. **Meetings** - Meeting type tasks only
  4. **Review/Approval** - Approval type tasks
  
- **Date Filters**:
  - All Time
  - Today
  - This Week
  - This Month
  - Date Range (with from/to date pickers)

### Meeting Creation Enhancement (DONE)
- **Create Task Modal** has 3 type selectors: Task | Meeting | Approval
- **Meeting-specific fields**:
  - Meeting Type: Operations Meeting | Client Meeting
  - Mode: Office | Team | Client | Department | Personal
  - Format: Online | Offline (radio buttons)
  - Meeting Link (for Online) or Location (for Offline)

### Sidebar Rename (DONE)
- "BDE Tasks" → "Business Development"

**Test Report:**
- All frontend tests passed (iteration_45.json)
- 100% success rate
