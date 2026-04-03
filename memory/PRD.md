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

---

## Latest Updates (April 2026 - Session 46)

### My Tasks Page Redesign (DONE)
- **Greeting Header**: "Good Morning/Afternoon/Evening, {{ Name }}!"
- **Daily Quote**: Rotating motivational quote (31 quotes, changes daily)
- **No breadcrumb header** - clean full-width design
- **4 Main Tabs**: All | Tasks | Meetings | Review/Approval

### Tasks Tab Enhanced Filters (DONE)
- **Assignment Toggle**: "Assigned to me" | "Assigned by me"
- **Department Filter Pills**: All Departments | SEO | Social Media | Business Dev | Operations | Meta | Website | ERP
- **Date Filter**: All Time | Today | This Week | This Month | Date Range

### HR Admin Quotes Management Tab (DONE)
- **New "Quotes" tab** added to HR Admin (7th tab)
- **31 default motivational quotes** auto-seeded
- **Full CRUD operations**: Add, Edit, Delete quotes
- **Active/Inactive status** for each quote
- **Statistics**: Total, Active, Inactive counts

### API Endpoints Added
- `GET /api/hr/admin/quotes` - Get all quotes
- `POST /api/hr/admin/quotes` - Add new quote
- `PUT /api/hr/admin/quotes/{id}` - Update quote
- `DELETE /api/hr/admin/quotes/{id}` - Delete quote

---

## Latest Updates (April 2026 - Session 47)

### My Tasks Page Redesigned (BDE-Style) (DONE)
- **Stats Cards**: Total Tasks, Pending, In Progress, Completed (with colored icons)
- **4 Tabs**: All | Tasks | Meetings | Review/Approval
- **Task List**: Card view with priority badges, status badges, dates, and action buttons

### Department Filter in Task Creation (DONE)
- Added **Department** dropdown in Create Task modal
- Options: Finance, HR, SEO, Social Media, Business Dev, Operations, Meta, Website, ERP, Design

### Review/Approval Tab (DONE)
- **Salary Approvals**: Shows payslips pending CEO review from HR department
- **Preview Summary**: Employee name, period, net salary, days present
- **Action Buttons**: "Review & Approve" (green), "Reject" (red)
- **Approval Modal**: Full details preview, remarks input, Approve/Reject/Resend options

### Approval Flow
- Approvals from departments (HR salary, Finance, etc.) appear in Review/Approval tab
- CEO can view summary, add remarks, approve, reject, or resend for review



---

### Website Project Detail View Redesign (DONE - April 2026)
**Purpose:** Redesigned the Tasks > Website > Projects board to match the "Operations Website Project" style based on reference images.

**Project Header Card:**
- Project name with Globe icon
- ACTIVE/On Hold/Completed status badge
- Docs button (links to Google Docs if configured)
- Drive button (links to Google Drive if configured)
- Edit button (opens edit modal)
- Progress bar with gradient (purple to violet)
- Completed/Total pages count (e.g., "0/8")
- Onboarding date and Deadline (red "Not Set" if missing)

**Project Details Info Row (6 cards):**
- Domain: Clickable link to website
- Developer: Avatar with initials + name
- Platform: Website/Web App/etc.
- Type: Business Website/E-commerce/Portfolio/etc.
- Client: Client/Company name
- Location: City, Country

**Pages/Tasks Tabs:**
- Pages tab (default): Shows pages table
- Tasks tab: Placeholder for future project-level tasks

**Enhanced Pages Table:**
- Columns: #, PAGE NAME, WIREFRAME, UI DESIGN, CONTENT, DEVELOPMENT, OVERALL, ACTIONS
- Column headers show "STATUS / ASSIGNEE / DUE" subtitle
- Search pages input with placeholder
- Add Page button

**Per-Column Controls (Wireframe, UI Design, Content, Development):**
- Status dropdown: To-Do, In Progress, Client Review, Client Approved, Completed, On Hold
- Assignee selector: Circular avatar with initials, color-coded per column
  - Wireframe: Purple (#8b5cf6)
  - UI Design: Pink (#ec4899)
  - Content: Amber (#f59e0b)
  - Development: Green (#10b981)
- Date picker for due date
- "+ Add URL" button (opens modal to add link)
- Shows "View URL" link when URL is saved

**Overall Column:**
- Status dropdown (same options)
- "+ Add URL" button for final deliverable

**Actions Column:**
- Delete button (trash icon, red) with confirmation

**Edit Project Modal:**
- Project Name *
- Client Name, Location
- Website Type dropdown
- Status dropdown
- Onboarding Date, Deadline (date pickers)
- Developer dropdown
- Domain URL
- Docs Link, Drive Link
- Cancel and Save Changes buttons

**New Backend Fields:**
- `website_projects`: Added `client_name`, `location` fields
- `website_page_tasks`: Added per-column assignees (`wireframe_assignee`, `ui_assignee`, `content_assignee`, `dev_assignee`), `overall_url`

**API Endpoints:**
- `GET/POST /api/departments/website/projects` - List/Create website projects
- `GET/PUT/DELETE /api/departments/website/projects/{project_id}` - Project CRUD
- `POST /api/departments/website/projects/{project_id}/pages` - Add page
- `PUT /api/departments/website/pages/{task_id}` - Update page (status, assignee, due, URL)
- `DELETE /api/departments/website/pages/{task_id}` - Delete page
- `GET /api/departments/website/developers` - Get available developers

**Files Modified:**
- `/app/frontend/src/pages/TasksModulePage.js`: Lines 2220-2710 - Complete redesign
- `/app/backend/department_routes.py`: Lines 283-510 - Enhanced schema and endpoints


---

### HR Admin Employee Reviews Tab (DONE - April 2026)
**Purpose:** Created a comprehensive employee performance review system with monthly, quarterly, and yearly review capabilities.

**Review Type Tabs:**
- Monthly Review: Date filter shows month picker (YYYY-MM)
- Quarterly Review: Date filter shows quarter dropdown (2026-Q1, etc.)
- Yearly Review: Date filter shows year dropdown

**Employee List:**
- Lists all active employees with avatar, name, designation
- "Click to Review" action to open review popup

**Review Popup Modal:**
- **Employee Header**: Avatar, name, designation, period
- **Attendance Card**: Present days, Absent days, Leave days (color-coded)
- **Working Hours Card**: Total Hours, Extra Hours (+X), Average Daily
- **Delivery Timeline Card**: Total Tasks, On Time (clickable), Overdue (clickable)
  - Clicking On Time/Overdue opens a filtered tasks popup

**Write Review Section:**
- **Reviewer Tabs**: HR (pink), Operations (purple), CEO (amber)
- **5-Star Rating**: Clickable stars with amber fill
- **Review Comments**: Text area for detailed review
- **Submit Review Button**: Creates/updates review with toast notification

**Submitted Reviews:**
- Shows reviewer badge (HR/Operations/CEO)
- Star rating display
- Review text
- Author name and date
- Edit button (pencil icon)
- Delete button (trash icon)

**Visibility Rules:**
- HR users see: Operations + CEO reviews (not their own HR reviews)
- Operations users see: HR + CEO reviews (not their own Operations reviews)
- CEO sees: HR + Operations reviews (not their own CEO reviews)
- Employees can see all their own reviews

**New DB Collection:**
- `employee_reviews`: `review_id`, `employee_id`, `reviewer_id`, `reviewer_name`, `reviewer_role` (hr/operations/ceo), `review_type` (monthly/quarterly/yearly), `period`, `rating` (1-5), `review_text`, `created_at`, `updated_at`

**API Endpoints:**
- `GET /api/hr/employee-reviews/employees` - Get all employees for review
- `GET /api/hr/employee-reviews/employee/{id}/summary` - Get attendance, hours, delivery stats
- `GET /api/hr/employee-reviews/employee/{id}/tasks` - Get tasks with On Time/Overdue status
- `GET /api/hr/performance-reviews` - Get reviews with filters
- `POST /api/hr/performance-reviews` - Create new review
- `PUT /api/hr/performance-reviews/{id}` - Update review
- `DELETE /api/hr/performance-reviews/{id}` - Delete review

**Files Modified:**
- `/app/backend/hr_routes.py`: Lines 3369-3762 - Employee review API endpoints
- `/app/frontend/src/pages/HRAdminPage.js`: Reviews Tab UI component

---

### Website Project Management Enhancements (DONE - April 2026)
**Purpose:** Enhanced the Website Projects page with a comprehensive step-by-step project creation flow, BDE-style task management, and Requirements/Branding management.

**Step-by-Step Create Project Modal (4 Steps):**
1. **Step 1 - Type & Platform Selection:**
   - Visual card selection for 6 Website Types: Landing Page, Business Website, Shopify Store, Web App, E-commerce, Portfolio
   - Visual card selection for 8 Platforms: WordPress, Shopify, Wix, Webflow, Framer, AI Builder, Custom Code, React
   - "Creating:" preview showing selected combination
   - Step indicator (1-2-3-4) at top

2. **Step 2 - Dynamic Requirements:**
   - Form fields change based on website type selected
   - **Landing Page:** Basic Info (Business Name, Tagline, About Text), Content (Services, CTA Text, Contact)
   - **Business Website:** Company Info (Business Name, Tagline, About, Team), Content (Services, Portfolio, Testimonials, Social)
   - **Shopify Store/E-commerce:** Store Info, Products & Collections (Categories, Count, Collections, Variants), Shipping & Payments (Zones, Methods, Return Policy)
   - **Web App:** App Info, Features (Core Features, User Roles, Integrations), Technical (Tech Stack, API Requirements, Auth)
   - **Portfolio:** Personal Info, Work (Skills, Projects, Experience), Contact
   - Skip option to go directly to Details

3. **Step 3 - Branding Information:**
   - Logo & Assets: Logo URL, Favicon URL
   - Color Palette: Primary, Secondary, Accent colors with color pickers
   - Typography & Guidelines: Primary Font, Secondary Font, Brand Guidelines URL
   - Skip option available

4. **Step 4 - Project Details:**
   - 5 tabs: Basic, Client, Credentials, Team, Links
   - Back button to return to previous steps
   - Final "Create Project" submission

**Project Detail View - New Tabs:**
- **Pages** (existing): Page management with stages
- **Tasks** (enhanced): BDE-style task management
- **Requirements** (new): Dynamic form based on project type
- **Branding** (new): Brand guidelines management

**BDE-Style Tasks Tab:**
- **Stats Cards (4 cards):**
  - Total Tasks (purple icon)
  - Pending (amber icon)
  - In Progress (blue icon)
  - Completed (green icon)
- **Filter Pills:** All | Pending | In Progress | Completed
- **Date Filter:** All Time | Today | This Week | This Month
- **Tasks Table:**
  - Columns: TASK, STATUS, PRIORITY, DUE DATE, TIME, TIMER, ACTIONS
  - Timer with Play/Pause controls
  - Eye icon for task details
  - Delete button
- **Empty State:** Icon with "No tasks yet. Click 'Add Task' to create one."

**Enhanced Add Task Modal:**
- Task Name (required)
- Description (textarea)
- Assign To (team member dropdown)
- Priority (Low/Medium/High)
- Due Date (date picker)
- Due Time (time picker)
- Task Type (General/Meeting/Follow Up/Proposal/Call)

**Requirements Tab (Project Detail):**
- Dynamic form sections based on project type
- Business Information: Business/Store Name, Tagline, About Text
- Services/Products section (type-specific fields)
- Contact Information: Email, Phone, Address, Social Media
- Save Requirements button

**Branding Tab (Project Detail):**
- Logo & Assets: Logo URL, Favicon URL, Brand Guidelines Document
- Color Palette: Primary, Secondary, Accent with color pickers and hex inputs
- Typography: Primary Font, Secondary Font
- Save Branding button

**API Endpoints (Enhanced):**
- `GET/POST /api/departments/website/projects/{project_id}/tasks` - BDE tasks CRUD
- `PUT/DELETE /api/departments/website/projects/{project_id}/tasks/{task_id}` - Task management
- Timer actions via `timer_action` parameter (start/stop)

**Files Modified:**
- `/app/frontend/src/pages/WebsiteProjectsPage.js`: Complete ProjectModal rewrite with 4-step wizard, BDE Tasks tab, Requirements tab, Branding tab
- `/app/backend/department_routes.py`: BDE tasks endpoints with timer support

---

## Upcoming Tasks (Prioritized)

### P0 - Critical
1. **SOP/Template Management:** Create template system for Website SOPs based on website type
2. **Google Sheets Integration:** Connect leads module to Google Sheets for automatic sync

### P1 - High Priority
1. **Leads Custom Fields:** Implement Notion-style custom fields in Leads module
2. **Finance/Operations Approvals:** Expand Review/Approval system for budgets and expenses
3. **Component Refactoring:** Break down oversized components:
   - `HRAdminPage.js` (~5800 lines)
   - `TasksModulePage.js` (~3600 lines)
   - `WebsiteProjectsPage.js` (~2900 lines)

### P2 - Medium Priority
1. **Chat Backend Persistence:** Migrate in-memory chat to MongoDB
2. **Kanban Drag-and-Drop:** Add drag-and-drop to Operations module

---

## Known Issues

### Active Issues
- MongoDB Atlas connection timeouts (bypassed via local MongoDB in preview)

### Mocked Integrations
- Resend email integration (uses placeholder API keys)

---

### Website Projects Mobile Responsive (DONE - April 2026)
**Purpose:** Made the Website Projects page fully mobile responsive with a bottom navigation bar for touch-friendly interaction.

**Mobile Projects List View:**
- Card-based layout instead of table (at viewport <768px)
- Project cards showing: Icon, Name, Platform, Status badge, Progress bar, Page count, Chevron
- Compact header with "Projects" title and count badge
- Purple "+" button for quick project creation
- Search bar with filter pills (Projects, Tasks, Filter)
- Expandable filters panel with Status/Developer dropdowns

**Mobile Bottom Navigation (All Projects):**
- 5 tabs: Projects | Tasks | New (+) | Filter | More
- Elevated "New" button with shadow for primary action
- Active state highlighting with purple background

**Mobile Project Detail View:**
- Compact sticky header: Back arrow, Project name (truncated), Status badge, Edit button
- Scrollable quick links row: Docs, Drive, Deadline, Progress
- Collapsible "Hide Project Details" section
- Icon-only tabs on mobile: Pages, Tasks, Requirements, Branding
- Mobile "+" button for adding pages/tasks

**Mobile Bottom Navigation (Project Detail):**
- 5 tabs: Pages | Tasks | Add (+) | Info | Brand
- Tab switching controls the active content tab
- Elevated "Add" button for context-aware action (Page or Task)

**Mobile Page Cards:**
- Card layout showing page name, status dropdown
- 4-phase progress bars (Wireframe, UI, Content, Dev)
- Due date with calendar icon
- Tap to open page detail

**Mobile Task Cards:**
- Task name, description (truncated), status badge
- Priority badge, due date
- Timer display with Play/Pause controls
- Tap to open task detail modal

**Mobile Create Project Modal:**
- Full-screen modal with step indicators (1-2-3-4)
- All steps scrollable on mobile
- Touch-friendly card selection for Type/Platform
- Responsive form layouts

**CSS Additions:**
- `.hide-scrollbar` - Hides scrollbars for horizontal scroll areas
- `.safe-area-inset-bottom` - Respects notched device safe areas

**Files Modified:**
- `/app/frontend/src/pages/WebsiteProjectsPage.js`: Added isMobile state, responsive classes, bottom navigation, card views
- `/app/frontend/src/index.css`: Added hide-scrollbar and safe-area-inset-bottom classes

---

### Project Manager Demo Login (DONE - April 2026)
**Purpose:** Added a dedicated Project Manager demo account for quick testing of the Website Projects module.

**Demo Credentials:**
- **Email:** pm@drawlead.com
- **Password:** pm123
- **Role:** project_manager

**Features:**
- Added to Quick Demo Login dropdown on login page
- Automatically redirects to /website-projects after login
- Has full access to Website Projects, Tasks, and Operations modules
- Shows in sidebar navigation for Website Development link
- Role-based navigation in Quick Demo Login

**Access Permissions:**
- `website_projects`: view, create, edit, delete
- `tasks`: view, create, edit, delete
- `operations`: view, create, edit

**Files Modified:**
- `/app/frontend/src/pages/LoginPage.js`: Added Project Manager to DEMO_USERS array, role-based redirect
- `/app/backend/server.py`: Added Project Manager to seed-demo-users endpoint
- `/app/frontend/src/components/Sidebar.js`: Added isProjectManager check for Website Development link
- `/app/frontend/src/components/ProtectedRoute.js`: Fixed module access check for project_manager role
