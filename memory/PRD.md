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

### Robust fallback for Operations sub-tab visibility (DONE — Feb 2026)
**Bug:** Production users with `'operations'` in `module_access` were stuck on the empty-state ("No Operations sub-tabs have been granted to your designation") when:
- The designation document pre-dated the new per-sub-tab fields (legacy data)
- OR the user's stored `designation` title didn't match a designation doc (case / whitespace mismatch)
- OR the admin saved a partial config and all sub-tab flags were false

**Fix layers (defense-in-depth):**
1. **Backend `/api/auth/me`**: Designation lookup now retries with a case-insensitive regex match if the exact-title lookup fails. After the lookup, if `designation_config` is None or has zero sub-tabs enabled AND user has `'operations'` in `module_access`, `operations_my_tasks` is auto-set to `true`.
2. **Frontend `OurTasksPage`**: If `designation_config` is null but `module_access` contains `'operations'`, treat `operations_my_tasks` as granted. Same guard in the per-tab visibility check.
3. **Frontend `Sidebar`**: Same fallback applied to the Approvals link visibility computation.

Net result: A user with `'operations'` module access is guaranteed to see at least the **My Tasks** tab, even if their designation doc has no per-sub-tab config. Admins retain full control — they can explicitly set other sub-tabs via the Operations Module Configuration modal.



### Self-Service Google Sheets OAuth Credentials (DONE — Feb 2026)
**Purpose:** Super admins can manage Google Sheets OAuth credentials directly from the UI — no more support tickets to update production env vars.

- **Backend** (`sheets_routes.py`):
  - New `_load_oauth_cfg()` reads from MongoDB **`system_settings`** doc (`key: "sheets_oauth"`) first, with **env-var fallback** for back-compat. 30s in-memory cache to avoid hot-path DB reads.
  - 3 new endpoints (super_admin only):
    - `GET /api/sheets/oauth-config` → returns client_id, MASKED client_secret, redirect_uri, and per-field `source` (`db | env | none`)
    - `PUT /api/sheets/oauth-config` → persists overrides; secret field accepts the masked placeholder as "no change"
    - `DELETE /api/sheets/oauth-config` → clears overrides, reverts to env
  - All existing OAuth callsites (`_flow`, `_compute_redirect_uri`, `_get_creds`, login/callback handlers) refactored to use the new async loader.
- **Frontend** (`components/settings/IntegrationsTab.js` — new):
  - Lives under **Settings → Integrations** tab (super_admin only).
  - Shows the **exact redirect URI** the admin must add to Google Cloud Console, with one-click Copy + "Open Google Console" deeplink.
  - Inputs: Client ID, Client Secret (eye-toggle, masked when saved), Redirect URI.
  - Each field carries a badge showing its current source: `Saved in app` / `Env var` / `Not set`.
  - **Revert to env vars** button restores fallback. Last-updated timestamp is displayed.
- **Net effect:** Admin rotates Sheets keys in 10 seconds from inside the app. Updates take effect within 30 seconds (cache TTL) — no redeploy, no Emergent Support ticket.



### Per-Designation Operations Sub-Tab Access Control (DONE — Feb 2026)
**Purpose:** Admins now control, per designation, **which** Operations sub-tabs a user sees and **whether they can edit Projects**.

- **Backend** (`backend/designation_routes.py`): Added 4 new fields on `Designation`:
  - `operations_projects`: `'none' | 'view' | 'edit'` (default `'none'`)
  - `operations_departments_tab`: bool (default `False`)
  - `operations_approvals_tab`: bool (default `False`)
  - `operations_meetings_tab`: bool (default `False`)
  Existing rows stay locked-out — admin must explicitly grant.
- **`/api/auth/me`** (`backend/server.py`) is now enriched with **`designation_config`** — the full sub-tab access config for the logged-in user, so the frontend can drive UI without extra round-trips.
- **HR Admin → Designations → Operations Module Configuration** modal (`HRAdminPage.js`) now shows **6 toggles** (My Tasks, Assign to Team, Projects, Departments, Approvals, Meetings). When *Projects* is checked, an additional *View only / Edit* picker appears (defaults to **Edit** — full access).
- **OurTasksPage** (`pages/OurTasksPage.js`) filters the 6 main tabs against `user.designation_config`. Super Admin / Admin **always** see everything. If a non-privileged user opens an unavailable tab, it auto-switches to the first available tab. If no tabs are granted, a clear empty-state is shown.
- **ProjectsPanel viewOnly resolution**: Privileged users use the in-app View/Edit toggle; non-privileged users follow `operations_projects` (`view` → viewOnly=true; `edit` → viewOnly=false).
- **Sidebar** (`components/Sidebar.js`): The *Approvals* link is **hidden entirely** when the user has zero Operations sub-tab access (per `designation_config`). Privileged users are unaffected.
- **Bonus fix**: `LoginPage.js` was throwing `toast is not defined` (regression caught during test run). Added the missing `sonner` import — login flow now redirects cleanly with no React error overlay.



### Live Data — Background Polling + Focus Refresh (DONE — Feb 2026)
**Purpose:** Eliminate “need to manually refresh to see latest data” across the app.

- New shared hook **`useAutoRefresh`** at `frontend/src/hooks/useAutoRefresh.js`:
  - Polls passed refetcher(s) every **15 seconds** while the tab is **visible**
  - **Pauses automatically** when the tab is hidden (saves bandwidth & battery)
  - **Forces an immediate refetch** on `visibilitychange` (tab returns) and `window.focus` (window re-activated)
  - Accepts an `enabled` flag so polling can be paused while a modal/form is open (prevents wiping user input)
- Wired into every major data surface:
  - Pages: `OurTasksPage`, `HRPage`, `HRAdminPage`, `ApprovalsPage`, `DLOperationsPage`, `CalendarPage`, `LeadsPage`, `LeadsPageV2`, `FinancePage`, `Dashboard`, `ProjectDetailPage`
  - Panels: `ProjectsPanel`, `MeetingsPanel`, `DepartmentsPanel`, `components/finance/ExpenseTab`
- Verified live in preview — network trace shows polling ticks at 15s and immediate refetch on focus.
- **Note:** Action-triggered refetch (`load*()` after create/edit/delete) was already in place across the codebase; the new hook complements it for cross-tab and idle freshness.
- **WebSocket realtime push** is intentionally deferred — polling at 15s + focus refresh delivers the same perceived liveness with no backend rework.



### Operations Modal & Approvals Restructure (DONE — Feb 2026)
**Purpose:** Convert the centralised Approvals workflow into a unified modal-driven Operations Panel.

- Clicking **Approvals** in the sidebar (`/approvals`) now opens a large centered modal (~92% w/h, backdrop, Escape/click-outside/X-button to close) at `OperationsModalPage` (`/components/operations/OperationsModalPage.js`).
- The modal hosts the full `OurTasksPage` content with all 6 sub-tabs: **My Tasks, Assign to Team, Projects, Departments, Approvals (default), Meetings**. The “Hi, <Name>” header is suppressed inside the modal.
- **3-way Approvals split**: Inside the Approvals sub-tab, three bucket sub-tabs filter task approvals by `approver_role`:
  - **PM Approvals** → `approver_role == 'pm'`
  - **Operations Approvals** → `approver_role in {operations, ceo, marketing_head}` (default active)
  - **HR Approvals** → `approver_role == 'hr'`
  - Super admin / admin can see all buckets; other users see only buckets routed to their `myApproverRoles`.
- **Assign-to-Team Department mandatory**: Creating a task while on the Assign-to-Team tab now requires a Department; otherwise a clear toast fires *before* other field validations.
- **Projects View/Edit toggle**: Visible only to `super_admin`. Defaults to “View only” — hides Create/Edit/Delete actions inside `ProjectsPanel` (via `viewOnly` prop overriding `canManageProjects`). Toggling to “Edit” restores full management.
- **HR added** as a valid approver role in the “Send for Approval” popup (alongside PM, Operations, Marketing Head).
- Files: `frontend/src/components/operations/OperationsModalPage.js` (new), `frontend/src/pages/OurTasksPage.js`, `frontend/src/pages/ApprovalsPage.js`, `frontend/src/components/ProjectsPanel.js`, `frontend/src/App.js`.
- Status: Tested via `testing_agent_v3_fork` (iteration_66) — 4/5 features verified pass; F3 was a coverage gap that was subsequently improved by re-ordering validations.



### Website Development Dashboard Redesign (DONE - December 2025)
**Purpose:** Completely redesigned the Web Dev main dashboard with a two-part layout for comprehensive project and task tracking.

**Part 1: Project Overview Section**
- Date Filters: All Time, Single Date, Date Range, Month, Year
- 4 Summary Cards (clickable to filter projects):
  - **Total Projects**: All projects count
  - **New Projects**: Projects in "Project Creation" stage (yellow, "Not started")
  - **Current Projects**: Projects in Discovery → Testing stages (blue, "In progress")
  - **Delivered**: Completed projects (green, "Completed")

**Part 2: Stage Task Board**
- Date Filters: Same options as Part 1
- **Task Wise / Project Wise Toggle**: Switch between task list and project-grouped view
- **7 Horizontal Stage Tabs** (clickable with task counts):
  - Content, Wireframe, UI Design, Development, Responsive, Testing, Delivery
- **Task List View**:
  - Shows: Project Name, Page Name, Assignee (avatar + name), Due Date
  - Action buttons: View (navigates to project), Complete (marks stage done)
- **Project Wise View**:
  - Groups tasks by project
  - Each project header shows project name + page count
  - Individual page tasks with Done button

**Role-Based Access Control**:
- **Admin/PM/Operations Head**: See ALL projects (Master Board)
- **Team Members**: See only projects they're assigned to (any role)
- All users can view all stages, but can only ACT on tasks they're assigned to

**Stage Filtering Logic**:
- Content: All tasks where content_status is not completed/approved
- Wireframe: Tasks where content is completed/approved AND wireframe is not
- UI Design: Tasks where content+wireframe are done AND UI is not
- And so on for subsequent stages...

**Backend Changes**:
- Added `/api/website-projects/all-tasks` endpoint to fetch all page tasks with project names
- Added `/api/website-projects/pages/{task_id}/stage-status` endpoint for marking stages complete

**Files Modified**:
- `/app/frontend/src/pages/DLOperationsPage.js` - Two-part dashboard layout
- `/app/backend/website_projects_routes.py` - all-tasks and stage-status endpoints

**Testing Status:** ✅ All features verified (iteration_62.json)

---



### Comprehensive 4-Step Project Creation Wizard (DONE - December 2025)
**Purpose:** Implemented a comprehensive multi-tab project creation wizard in the Web Dev module (DLOperationsPage.js) to handle robust project creation with detailed requirements and branding.

**4-Step Wizard Flow:**

**Step 1: Type & Platform Selection**
- 4 Website Types: Landing Page, Business Website, Ecommerce, Web App
- Conditional Platform Options based on type:
  - Landing Page: WordPress, Wix, Webflow, Framer, AI Builder, Custom Code
  - Business Website: WordPress, Wix, Webflow, Framer, AI Builder, Custom Code
  - Ecommerce: Shopify, Wix, WooCommerce
  - Web App: AI Builder, Custom Code
- Selection preview shows "Creating: [Platform] [Type]"

**Step 2: Dynamic Requirements**
- Form fields change based on website type selected
- Landing Page: Content (Business Name, Tagline, About Text), Contact (Contact Info, Social Links)
- Business Website: Business Info, Content (Services, Team, Testimonials), Contact
- Ecommerce: Store Info, Products & Collections, Shipping & Payments
- Web App: App Info, Technical (User Roles, Integrations, Tech Stack), Auth & API
- Skip option available to go directly to Details

**Step 3: Branding Information**
- Logo & Assets: Logo URL, Favicon URL
- Color Palette: Primary, Secondary, Accent colors with color pickers and hex inputs
- Typography & Guidelines: Primary Font, Secondary Font, Brand Guidelines URL
- Skip option available

**Step 4: Project Details (5 Sub-tabs)**
- **Basic**: Project Name, Domain URL, Onboarding Date, Deadline, Notes
- **Client**: Client Name, Location, Email, Phone
- **Credentials**: Domain Username/Password, WP Username/Password
- **Team**: Developer, Designer, Content Writer, Project Manager dropdowns (from team members API)
- **Links**: Google Drive URL, Documents URL, Communication Channel

**Navigation Features:**
- Step indicator showing progress (1-4) with checkmarks for completed steps
- "Back" button on all steps
- "Skip to Details" button on steps 2 and 3
- "Change Type" link on step 4 to go back to step 1

**Backend Changes:**
- ProjectCreate model updated with `requirements: Optional[Dict[str, Any]]` and `branding: Optional[Dict[str, Any]]`
- ProjectUpdate model updated with same fields
- create_project endpoint stores requirements and branding in database

**Files Modified:**
- `/app/frontend/src/pages/DLOperationsPage.js` - 4-step wizard UI
- `/app/backend/website_projects_routes.py` - ProjectCreate/Update models, create_project endpoint

**Testing Status:** ✅ All 18 backend tests passed, all frontend features verified (iteration_61.json)

---



### Pages Tab Multi-Stage Horizontal Layout (ENHANCED - April 5, 2026)
**Purpose:** Redesigned the "Pages" tab in Project Detail page to show all workflow stages horizontally, providing a bird's-eye view of project health.

**Features Implemented:**
1. **Multi-Stage Table Layout (ENHANCED):**
   - Columns: #, Page Name, Content, Wireframe, UI Design, Responsive, Development, Testing, Delivery, **Due Date**, **Time Left**, **Time Spent**, Progress, Actions
   - Each stage column shows:
     - Assignee avatar (initials with stage color) or gray user icon if unassigned
     - Status badge below avatar
   - Table is responsive with horizontal scroll for smaller screens

2. **Add Page Functionality (ENHANCED):**
   - "+ Add Page" button in header
   - Opens modal with:
     - Page Name input field
     - **Due Date picker** (new!)
     - Stage Assignees section with 7 dropdown selectors
   - Creates page with all fields via POST `/api/website-projects/projects/{project_id}/pages`

3. **Edit Page Functionality (ENHANCED):**
   - Edit (pencil) button on each row
   - Opens modal with pre-filled:
     - Page name
     - **Due Date** (if previously set)
     - All 7 stage assignees (if previously set)
   - Updates page via PUT `/api/website-projects/pages/{task_id}`

4. **New Columns (ADDED):**
   - **Due Date:** Displays formatted date (e.g., "10 Apr")
   - **Time Left:** Shows:
     - "Xd left" (green) for future dates
     - "Xh left" (yellow) for same-day due
     - "Xd overdue" (red) with alert icon for past dates
   - **Time Spent:** Total time across all stages with timer icon

5. **Delete Page Functionality:**
   - Delete (trash) button on each row
   - Browser confirmation dialog
   - Deletes page via DELETE `/api/website-projects/pages/{task_id}`

6. **Progress Tracking:**
   - Progress bar per page showing completion percentage
   - X/7 format (approved stages / total stages)

7. **Stage Status Indicators:**
   - ○ Not Started
   - ▶ In Progress
   - ⏳ Waiting PM
   - PM✓ Waiting Ops
   - ✓ Approved
   - ↻ Corrections

8. **Legend Section:**
   - Displays all status types with their icons below the table

**Files Modified:**
- `/app/frontend/src/pages/ProjectDetailPage.js` - PagesTab component with AssigneeSelect helper, time calculations
- `/app/backend/website_projects_routes.py` - PageTaskCreate and PageTaskUpdate models with due_date field

**Testing Status:** ✅ All features verified by testing agent (iteration_60.json)

---

### Task Summary Modal (NEW - April 5, 2026)
**Purpose:** Provides detailed timeline and progress view when clicking Edit on Tracker Board tasks.

**Features Implemented:**
1. **Header Section:**
   - Page name with stage badge
   - Current assignee
   - Close button

2. **Timeline Tab:**
   - Work Started timestamp
   - Paused timestamp (if applicable)
   - Time Spent duration
   - Submitted to PM timestamp
   - PM Approved timestamp with approval duration
   - Operations Approved timestamp with approval duration
   - Delivered timestamp

3. **All Stages Tab:**
   - Shows progress across all 7 workflow stages
   - Each stage shows:
     - Icon and label
     - Assignee name
     - Status badge (Approved, Pending, In Progress, Not Started)
     - Time spent

4. **Details Tab:**
   - Status badge
   - Assignee
   - Due Date
   - Time Spent
   - Work Link (if submitted)
   - Remarks

**Files Modified:**
- `/app/frontend/src/pages/ProjectDetailPage.js` - Added TaskSummaryModal component

**Testing Status:** ✅ All features verified by testing agent (iteration_59.json)

---


### Monthly Leave Quota System (NEW - April 2026)
**Purpose:** Implemented monthly-based leave quota system with cascading logic for all request sub-tabs.

**Changes:**
1. **Monthly Leave Quotas:**
   - Casual Leave: 1 per month (not yearly)
   - Sick Leave: 1 per month (not yearly)
   - LOP (Loss of Pay): Deducted when both Casual and Sick are exhausted

2. **Cascading Leave Logic:**
   - First priority: Use Casual leave (1/month)
   - Second priority: If Casual exhausted, use Sick leave (1/month)
   - Last resort: If both exhausted, LOP is deducted

3. **Month/Year Filters on ALL Request Sub-tabs:**
   - **Attendance**: Filter to show attendance records for selected month/year
   - **Leave**: Filter to show leave requests and quotas for selected month/year
   - **Permission**: Filter to show permission requests for selected month/year
   - **Remote (WFH)**: Filter to show WFH requests for selected month/year

4. **Leave Tab Summary Cards:**
   - Casual Leave: X/1 (for selected month)
   - Sick Leave: X/1 (for selected month)
   - LOP: X (Deducted)
   - Total Leaves: X (This Month)

5. **Leave Request Modal:**
   - Title shows selected month/year
   - Monthly Quota info box displays current usage
   - Leave type buttons show remaining quota (1/1)
   - Disabled/crossed-out when limit reached
   - Helpful messages for cascading logic

**Files Modified:**
- `/app/frontend/src/pages/HRPage.js` - LeaveTab, RequestsAttendanceTab, PermissionTab, RemoteTab

---

### My Profile / HR Portal Redesign (April 2026)
**Purpose:** Redesigned HR Portal page with personalized greeting and improved leave/permission management.

**Changes:**
1. **Title**: Changed from "HR Portal" to "Hi, [Username]" (personalized greeting)

2. **Main Tabs:** Attendance | My Profile | Requests | Payroll | Reviews | Security

3. **Requests Tab - Four Sub-tabs:**
   - **Attendance**: Shows attendance approvals/reasons with early/late login/logout tracking
   - **Leave**: Monthly quota system (Casual 0/1, Sick 0/1, LOP deducted)
   - **Permission**: Permission requests with hour tracking
   - **Remote**: Work from Home requests

4. **Leave Detail Popup**:
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

---

### 8-Stage Project Workflow for Project Manager (DONE - April 2026)
**Purpose:** Implemented a comprehensive 8-stage workflow system for Website Projects, allowing Project Managers to track projects through their lifecycle from creation to delivery.

**Workflow Stages:**
1. **Project Creation** - New projects awaiting initial setup
2. **Discovery Call** - Requirements gathering and planning
3. **Content** - Content writing and collection
4. **Wireframe** - Wireframe design and client approval
5. **UI Design** - UI design and client approval
6. **Development** - Development in progress
7. **Testing** - QA testing and bug fixes
8. **Delivered** - Project completed and delivered

**Features:**
1. **Stage Filter Tabs** - Horizontal tabs to filter projects by workflow stage
2. **Stage Transition Buttons** - Quick "Move to Next Stage" buttons in project list
3. **Stage Transition Validation** - Cannot move from "Project Creation" to "Discovery Call" until mandatory fields are filled:
   - Project Name
   - Client Name
   - Website Type
   - Platform
4. **Content Stage Specific Filters** - When viewing Content stage, additional filters appear:
   - Content Writer filter (project-level)
   - Page Assignee filter (page-level)
   - Content Due Date filter
   - Day filter (Today, This Week, Overdue, No Date Set)
5. **URL Parameter Sync** - Stage selection syncs with URL (?stage=content)
6. **Stage Counts in Tabs** - Each stage tab shows the count of projects in that stage

**Backend Changes:**
- Added `workflow_stage` field to project schema (default: "creation")
- Added validation in `/api/website-projects/projects/{project_id}/transition` endpoint
- Updated `/api/website-projects/all-projects-summary` to include workflow_stage, content_writer, and page-level content data

**Frontend Changes:**
- Added workflow stage states and Content stage filter states
- Updated `handleStageTransition` with frontend validation
- Added Content stage-specific filters (conditionally rendered)
- Extended `filteredProjectsSummary` to support Content stage filters

**Files Modified:**
- `/app/backend/website_projects_routes.py`: Stage transition validation, all-projects-summary enhancement
- `/app/frontend/src/pages/WebsiteProjectsPage.js`: Workflow stage UI, Content stage filters, transition validation

---

### Our Tasks Module (DONE - April 2026)
**Purpose:** Created a team-wide task management module called "Our Tasks" that allows all users to create, assign, and track tasks across the organization.

**Features:**
1. **Stats Dashboard** - Cards showing Total Tasks, Pending, In Progress, Completed
2. **Filter Tabs** - All, My Tasks, Pending, In Progress, Completed
3. **Advanced Filters** - Date, Assigned To, Assigned By, Type, Status
4. **Task CRUD** - Create, Read, Update, Delete tasks
5. **Timer Functionality** - Start, Pause, Resume, Finish with time tracking
6. **Task Assignment** - Assign tasks to any user in the system
7. **Recurring Tasks** - Support for daily, weekly, monthly, yearly, weekdays, and custom recurrence
8. **Work Link** - Attach links to external resources

**API Endpoints:**
- `GET /api/our-tasks/tasks` - List all tasks
- `POST /api/our-tasks/tasks` - Create a task
- `GET /api/our-tasks/tasks/{task_id}` - Get single task
- `PUT /api/our-tasks/tasks/{task_id}` - Update task
- `DELETE /api/our-tasks/tasks/{task_id}` - Delete task
- `PATCH /api/our-tasks/tasks/{task_id}/status` - Update status
- `POST /api/our-tasks/tasks/{task_id}/time` - Timer actions (start/pause/resume/finish)

**Sidebar Navigation:**
- Added as a separate top-level menu item "Our Tasks" with clipboard icon
- Accessible to all authenticated users

**Files Created:**
- `/app/backend/our_tasks_routes.py`: Backend API routes
- `/app/frontend/src/pages/OurTasksPage.js`: Frontend page component
- `/app/backend/tests/test_our_tasks.py`: Backend test suite (22 tests)

**Files Modified:**
- `/app/backend/server.py`: Added our_tasks_router import and registration
- `/app/frontend/src/App.js`: Added /our-tasks route
- `/app/frontend/src/components/Sidebar.js`: Added Our Tasks nav link

---

### HR Admin - Remote/WFH Approvals Tab (DONE - April 2026)
**Purpose:** Added a new "Remote" tab to HR Admin > Approvals section for managing Work From Home requests.

**Tab Structure:**
- Attendance | Leave | Permission | **Remote** (New)

**Features:**
1. **Comprehensive Filters:**
   - Status dropdown (Pending, Approved, Rejected, All)
   - Employee dropdown filter
   - Date Range filter (Start to End)
   - Clear Filters button

2. **WFH Request Cards display:**
   - Employee name
   - Status badge (Pending/Approved/Rejected with colors)
   - Days badge (e.g., "3 Days WFH")
   - Start date and End date
   - Work Location (Home/Other)
   - Contact Number
   - Reason
   - Work Plan
   - Requested date
   - Approved/Rejected by (if applicable)
   - Action buttons (View, Approve, Reject)

3. **View Details Modal:**
   - Employee info with avatar
   - Email
   - Department and Designation
   - Full request details
   - Action buttons for pending requests

4. **Approve with Remarks:**
   - Optional remarks textarea
   - LOP deduction checkbox
   - Approve button

5. **Reject with Reason:**
   - Required rejection reason
   - Reject button

**API Endpoints:**
- `POST /api/hr/wfh/request` - Create WFH request
- `GET /api/hr/wfh/my-requests` - Get user's requests
- `GET /api/hr/wfh/pending` - Get pending requests (admin)
- `GET /api/hr/wfh/all` - Get all requests with filters
- `GET /api/hr/wfh/{wfh_id}` - Get single request
- `POST /api/hr/wfh/{wfh_id}/approve` - Approve with remarks
- `POST /api/hr/wfh/{wfh_id}/reject` - Reject with reason
- `DELETE /api/hr/wfh/{wfh_id}` - Cancel request

**Files Modified:**
- `/app/backend/hr_routes.py`: Added WFH request routes and models
- `/app/frontend/src/pages/HRAdminPage.js`: Added Remote tab to EnhancedApprovalsTab component

---

### Our Tasks - Assigned to Me / Assign to Team Tabs (DONE - April 2026)
**Purpose:** Enhanced the Our Tasks page with two main tabs to better organize task visibility based on assignment direction.

**Tab Structure:**
1. **Assigned to Me** - Tasks where the current user is the assignee
   - Shows tasks assigned by others to you
   - Shows tasks you created for yourself
   - Has full Start/Pause/Resume/Finish timer buttons
   - Count badge shows total tasks assigned to you

2. **Assign to Team** - Tasks the user created and assigned to others
   - Shows tasks you assigned to team members (not yourself)
   - **Status-only view** (no Start button) - shows Not Started/Running/Paused/Done badges
   - Can view if task is started or not
   - Has Edit and Delete buttons

**Features:**
- Full filter support on both tabs (Date, Assigned To, Assigned By, Type, Status)
- Stats cards update based on selected tab
- Task counts displayed in tab badges

**Files Modified:**
- `/app/frontend/src/pages/OurTasksPage.js`: Added mainTab state, updated filteredTasks logic, modified getTimeTrackingButton with isTeamView parameter

---

### HR Admin UI Enhancements (DONE - April 2026)

**1. Employees Tab - Summary Stats & List View:**
- Added summary cards: Total Employees | Office | Remote (active employees only)
- Replaced card grid with table list view
- Added Work Mode column showing Office/Remote badges
- Added Status column showing Active/Inactive badges

**2. Approvals Tab - Detailed Views:**
- **Attendance approvals** now show:
  - Employee avatar
  - Work Mode badge (Office/Remote)
  - Date, Time, Check In, Check Out fields
  - Reason with full text
- **Leave approvals** now show:
  - Employee avatar with email
  - Leave type and status badges
  - From/To dates, Days count, Half Day badge if applicable
  - Approved by name and date for approved leaves
  - Rejection reason for rejected leaves

**3. Calendar Tab - Holidays Renamed:**
- Renamed "Indian Holidays" to "Holidays"
- Added month/year filter to Holidays sub-tab
- Holiday list now filters by selected month and year

**Files Modified:**
- `/app/frontend/src/pages/HRAdminPage.js`:
  - EmployeesTab: Added summary stats, list view with Work Mode column
  - EnhancedApprovalsTab: Enhanced attendance and leave cards
  - EnhancedCalendarTab: Renamed holidays, added month/year filter

---

### HR Manager View-Only Permissions (DONE - April 2026)
**Purpose:** Implement role-based access control within HR Admin module - HR Admin has full access, HR Manager has view-only access (but can write reviews).

**User Roles:**
1. **HR Admin / Super Admin / Admin:**
   - Full access to all HR Admin features
   - Add/Edit/Delete employees
   - Add/Edit/Delete designations and departments
   - Approve/Reject all requests (attendance, leave, permission, WFH)
   - Edit calendar settings and manage holidays
   - Add/delete salary records, create payslips

2. **HR Manager:**
   - View-only access to all HR Admin data
   - CAN access Reviews tab and write reviews/feedback
   - CANNOT add/edit/delete employees
   - CANNOT add/edit/delete designations or departments
   - CANNOT approve/reject requests (sees "View Only" badges)
   - CANNOT edit calendar settings or add holidays

**Implementation Details:**
- `canEdit` boolean: `true` for super_admin/admin, `false` for hr_manager
- `isViewOnly` flag used in sub-components to conditionally render action buttons
- Calendar shows "View Only: You have read-only access to this calendar" message for HR Manager
- Approvals tab shows "View Only" badges instead of Approve/Reject buttons

**Files Modified:**
- `/app/frontend/src/pages/HRAdminPage.js`:
  - Added `canEdit` and `isHRManager` variables based on user role
  - Passed `canEdit` prop to all sub-tabs (EmployeesTab, DesignationsDeptsTab, EnhancedApprovalsTab, EnhancedCalendarTab, etc.)
  - Wrapped Add/Edit/Delete buttons with `{canEdit && ...}` or `{!isViewOnly && ...}` checks
  - Added "View Only" badges for HR Manager in Approvals and Calendar tabs
- `/app/frontend/src/components/hr/PayrollManagementTab.js`:
  - Added `canEdit` and `isViewOnly` props
  - Hid Add Salary buttons and Delete buttons for view-only users
  - Updated SalaryHistoryView component with isViewOnly prop

**Test Credentials:**
- HR Manager: hr@drawlead.com / admin123
- Super Admin: vinoth@drawlead.com / admin123

---

## Latest Updates (December 2025 - Session 48)

### Settings Page Theme Bug Fix (DONE)
**Issue:** Input fields on the Settings > Company Profile page displayed black/dark backgrounds in light mode, creating poor UX.

**Root Cause:** The `CompanyProfileTab.js` file had broken template literals (e.g., `'${bgCard}'` as literal strings instead of computed values) and hardcoded dark theme colors (`bg-[#09090b]`) on all input elements.

**Fix Applied:**
- Replaced all hardcoded dark colors with properly computed theme-aware variables
- Fixed template literal syntax to properly use `isDark` context values
- All inputs now use `bgInput` variable which resolves to `bg-[#09090b]` in dark mode and `bg-white` in light mode

**Files Modified:**
- `/app/frontend/src/components/settings/CompanyProfileTab.js`: Complete rewrite of theme classes

---

### HR Admin Calendar Simplified (DONE - December 2025)
**Purpose:** Removed the "Configure Sunday" popup functionality from the HR Admin Calendar. The calendar now serves as a view-only display for finalized holidays and leaves.

**Changes:**
- Removed the Sunday configuration popup/modal completely
- Removed click handler from Sunday cells (no more hover effects or interactions)
- Calendar now displays holidays and leaves approved by HR Admin without edit functionality
- Updated tip text to: "This calendar displays all finalized holidays and leaves approved by HR Admin. Go to the Holidays tab to manage holidays."
- Holidays can still be managed via the "Holidays" sub-tab

**Files Modified:**
- `/app/frontend/src/pages/HRAdminPage.js`: Removed `showSundayModal`, `selectedSunday`, `sundayRemarks` states, removed `handleSundayClick` function, removed Sunday Configuration Modal JSX

---

## Backlog / Future Tasks

### High Priority (P0)
- **SOP/Template Creation UI**: Build the UI for managing "Website SOP Creation / Templates" within the Website Development flow

### Medium Priority (P1)
- **Google Sheets Integration**: Implement "Connect Sheets" functionality in the Leads module
- **Leads Custom Fields**: Implement "Notion-style" custom fields functionality in the Leads module
- **Finance/Operations Approvals**: Expand the Review/Approval tab in "My Tasks" to support budget and expense approvals

### Low Priority (P2)
- **Refactor Large Components**: `WebsiteProjectsPage.js` (~3600 lines), `HRAdminPage.js` (~7000+ lines), `TasksModulePage.js` (~3600 lines) need component breakdown
- **Chat Backend Refactor**: Migrate the in-memory chat backend to use MongoDB for persistence

---

## Latest Updates (April 2026 - Session 57)

### Tracker Board 2-Level Approval Workflow (DONE)
**Purpose:** Implemented a comprehensive workflow with Start/Pause/Finish timer, 2-level approval chain (PM → Operations), and stage progression.

**Workflow Implemented:**

1. **Timer-Based Task Work:**
   - **Start Button**: Changes task status to `in_progress`, records start time
   - **Pause Button**: Changes status to `paused`, calculates time spent
   - **Finish Button**: Opens Finish Modal popup

2. **Finish Modal:**
   - Link input field (required) for work URL (Figma, Google Docs, etc.)
   - Shows "This will be submitted for Project Manager approval"
   - Displays Approval Flow: PM Approval → Ops Approval
   - Submit button sends task for PM approval

3. **2-Level Approval Chain:**
   - **Step 1 - PM Approval**: Task status becomes `waiting_pm`
   - **Step 2 - Operations Approval**: After PM approves, status becomes `waiting_ops`
   - **Step 3 - Fully Approved**: After Ops approves, status becomes `approved`

4. **Corrections/Rejection Flow:**
   - Corrections request resets approval flags (`pm_approved=false`, `ops_approved=false`)
   - Sets status to `corrections` with remarks
   - User sees remarks on task card and can Start/Pause/Finish again

5. **Move to Next Stage:**
   - After full approval (both PM and Ops), PM sees "Move to Next Stage" button
   - Clicking it creates a new task in the next workflow stage
   - Stages: content → wireframe → ui → responsive → dev → test → delivery

6. **Approvals Page Enhancements:**
   - **PM/Ops Toggle**: Switch between PM Approvals and Ops Approvals queues
   - **Stage Tabs**: When Website department is active, shows stage tabs (Content, Wireframe, UI, etc.) with counts
   - **Date Filter**: Clear button instead of "Today" quick-set

**Backend Endpoints Added:**
- `POST /api/website-projects/stage-tasks/{task_id}/timer` - Start/Pause timer
- `PUT /api/website-projects/stage-tasks/{task_id}/submit` - Submit for PM approval
- `PUT /api/website-projects/stage-tasks/{task_id}/pm-approve` - PM approves
- `PUT /api/website-projects/stage-tasks/{task_id}/ops-approve` - Operations approves
- `POST /api/website-projects/stage-tasks/{task_id}/move-next` - Move to next stage

**Backwards Compatibility:**
- Legacy tasks (without `pm_approved`/`ops_approved` flags) are treated as fully approved
- Existing `status=approved` tasks without new flags don't block workflow

**Files Modified:**
- `/app/frontend/src/pages/ProjectDetailPage.js`: TrackerBoard with Start/Pause/Finish, Finish Modal
- `/app/frontend/src/pages/ApprovalsPage.js`: PM/Ops toggle, stage tabs
- `/app/backend/website_projects_routes.py`: Timer, approval, move-next endpoints
- `/app/backend/approvals_routes.py`: approval_level filter for PM/Ops

**Test Report:** `/app/test_reports/iteration_57.json`
- Backend: 100% (11/11 tests passed)
- Frontend: 100% (all UI flows working)

---

## Latest Updates (April 2026 - Session 56)

### Centralized Approvals System (DONE)
**Purpose:** Implemented a comprehensive centralized approval workflow for the Website Development module, allowing users to submit work for approval and managers to review/approve from a single dashboard.

**Features Implemented:**

1. **Link Approval Modal with Approver Selection:**
   - Opens when clicking "Add [Stage] Link" button in Tracker Board
   - Link input field for pasting work URL (Figma, Google Docs, etc.)
   - **3 Approver Options:**
     - Operations Team (default) - "For routine task approvals"
     - Project Manager - "For project-specific decisions"
     - CEO - "For critical business decisions"
   - Submit for Approval button (disabled until link entered)
   - Radio button selection with visual feedback

2. **Approvals Page (`/approvals`):**
   - Header with total pending count badge
   - Date filter (defaults to today, with "Today" quick button)
   - Search bar for finding approvals
   - **Department Tabs (8 tabs):** All, Website, Social Media, Meta Ads, SEO, Finance, HR, Business Dev, ERP
   - Each tab shows count of pending approvals

3. **Approval Cards:**
   - Department icon and color-coded badge
   - Title: "[Page Name] - [Stage]"
   - Project name and stage
   - Submitted by (user name)
   - Timestamp
   - **Assignee Type Badge:** CEO (red), PM (purple), Operations (blue)
   - View Link button (opens submitted URL)
   - **Action Buttons:** Approve (green), Corrections (orange)

4. **Corrections Modal:**
   - Shows "Send back to: [submitter name]"
   - Textarea for correction remarks
   - Cancel and Send Corrections buttons

5. **Backend Updates:**
   - `PUT /api/website-projects/stage-tasks/{task_id}/submit` now accepts `assignee_type` parameter
   - `GET /api/approvals/pending` aggregates both centralized approvals and website_stage_tasks
   - Fixed authentication in `approvals_routes.py` to properly read session tokens

**Sequential Workflow Preserved:**
- Stages remain locked until previous stage is approved
- Content → Wireframe → UI Design → Responsive → Development → Testing → Delivery

**Files Modified:**
- `/app/frontend/src/pages/ProjectDetailPage.js`: Added `LinkApprovalModal` component with approver selection
- `/app/frontend/src/pages/ApprovalsPage.js`: Updated to display assignee_type badges
- `/app/backend/approvals_routes.py`: Fixed auth, added assignee_type to response
- `/app/backend/website_projects_routes.py`: Added assignee_type to submit endpoint

**Test Report:**
- All 13 backend tests passed (iteration_56.json)
- All frontend flows verified
- 100% success rate

---

## Latest Updates (April 2026 - Session 63)

### Master Board Enhanced Tabs (DONE)
**Purpose:** Added new tabs to the Web Dev Master Board for comprehensive task, meeting, and team management.

**New Tabs Added:**
1. **Tasks** (default): Shows task-wise and project-wise views with stage filtering
2. **Trackboard**: Time tracking overview with stats (Total Time Today, Active Timers, Tasks Completed)
3. **Pages**: List of all page tasks from all projects with quick view
4. **Team**: Team members overview showing task counts and active assignments
5. **Ad.Tasks**: Additional tasks not tied to specific project pages with full CRUD
6. **Meeting**: Meeting scheduler with Google Meet-style UI

**Ad.Tasks Features:**
- Create tasks with title, description, due date, priority (Low/Medium/High/Urgent)
- Assign to team members and optionally link to projects
- Start/Stop timer with time tracking
- Mark complete, delete task
- Sorting by due date (Oldest/Newest First)

**Meetings Features:**
- Schedule meetings with title, agenda, date, start/end time
- Meeting types: Video Call, Audio Call, In-Person
- Add meeting link (Google Meet, Zoom, etc.)
- Link to projects (optional)
- Mark complete, delete meeting
- Join button for meetings with links
- Sorting by date

**Backend APIs Added:**
- `GET/POST /api/additional-tasks/` - List and create additional tasks
- `PUT /api/additional-tasks/{id}/status` - Update task status
- `PUT /api/additional-tasks/{id}/add-time` - Add time spent
- `DELETE /api/additional-tasks/{id}` - Delete task
- `GET/POST /api/meetings/` - List and create meetings
- `GET /api/meetings/upcoming` - Get upcoming meetings
- `PUT /api/meetings/{id}/status` - Update meeting status
- `DELETE /api/meetings/{id}` - Delete meeting
- `GET /api/meetings/calendar/status` - Check Google Calendar connection

**Files Modified/Created:**
- `/app/backend/additional_tasks_routes.py` (NEW)
- `/app/backend/meetings_routes.py` (NEW)
- `/app/backend/server.py` - Added new route registrations
- `/app/frontend/src/pages/DLOperationsPage.js` - Master Board tabs UI

**Test Report:** `/app/test_reports/iteration_63.json`
- Backend: 100% (14/14 tests passed)
- Frontend: 100% (all tabs and features working)
- Bug fixed: SelectItem empty value in modals

---

## Latest Updates (April 2026 - Session 64)

### Mobile Responsive PWA-Like Layout (DONE)
**Purpose:** Made the Web Dev dashboard fully mobile responsive with a bottom navigation bar for a PWA-like experience.

**Mobile Optimizations:**
1. **Bottom Navigation Bar**: Fixed at bottom with 5 tabs (Tasks, Track, Ad.Tasks, Meeting, Team)
2. **Collapsible Overview Section**: Summary cards collapse on mobile, tap to expand
3. **Card-Based Task View**: Table layout replaced with mobile-friendly cards showing:
   - Task name, project, status badge
   - Timer, assignee, due date
   - Action buttons (Start/Stop, View, Complete)
4. **Compact Headers**: Smaller fonts, icons, and padding on mobile
5. **No Horizontal Scroll**: All content fits within mobile viewport
6. **Task/Project Toggle**: Full-width toggle in mobile header

**Responsive Breakpoints:**
- Mobile: < 768px (bottom nav, card views, compact layout)
- Desktop: >= 768px (sidebar tabs, table views, full layout)

**Technical Changes:**
- Added `isMobile` state with resize listener
- Added `mobileOverviewCollapsed` state for collapsible overview
- Hidden desktop tabs on mobile, show bottom nav instead
- Mobile-specific card layouts for tasks, meetings, ad.tasks
- Added `pb-20` padding to account for bottom nav

**Files Modified:**
- `/app/frontend/src/pages/DLOperationsPage.js` - Mobile responsive layout
- `/app/backend/meetings_routes.py` - Made `end_time` optional

---

## Latest Updates (April 2026 - Session 65)

### Developer Assignment Popup with Calendar (DONE)
**Purpose:** Enhanced the assignment workflow in Project Pages to show developer workload before assigning tasks.

**User Flow:**
1. Click on any **assignee icon** in a stage column (Content, Wireframe, etc.)
2. **Step 1 - Select Developer:** Popup shows grid of all team members with avatars and roles
3. **Step 2 - Select Date:** Full calendar view for the selected month
   - Navigate between months with arrows
   - See task count per day (highlighted dates)
   - Select a date to view detailed workload
4. **Workload Panel:** Shows all tasks the developer has on that day with project/page names
5. **Assignment:** Click "Assign to [Name]" to set both assignee and due date

**Backend APIs Added:**
- `GET /api/website-projects/developer-workload/{developer_name}` - Get all tasks for a developer, optionally filtered by date
- `GET /api/website-projects/developer-workload-calendar/{developer_name}` - Get task count per day for calendar view
- `PUT /api/website-projects/pages/{task_id}/assign-with-date` - Assign developer and due date in one call

**Files Created/Modified:**
- `/app/frontend/src/components/website/AssignmentPopup.js` (NEW)
- `/app/frontend/src/pages/ProjectDetailPage.js` - Integrated AssignmentPopup
- `/app/backend/website_projects_routes.py` - Added 3 new endpoints

---



### Ad.Tasks Tab UI Redesign (DONE - April 2026)
**Purpose:** Redesigned the Additional Tasks tab within the Project Detail page to match the "Our Tasks" page design with summary cards, filters, and a table view.

**Features Implemented:**
1. **Summary Cards Row:**
   - Total Tasks (purple icon)
   - Pending (gray icon)
   - In Progress (blue icon)
   - Completed (green icon)
   - Counts update dynamically

2. **Filter Tabs:**
   - All / Pending / In Progress / Completed
   - Single-click filtering of task list

3. **Advanced Filters Panel:**
   - Toggle with "Filters" button
   - Date filter (All Time, Today, Single Date)
   - Assigned To dropdown (team members)
   - Type filter (General, Bug Fix, Feature, Content, Design)
   - Status filter (All, To-Do, In Progress, Completed)
   - Reset Filters button

4. **Table View with Columns:**
   - TASK: Title, description, type badge, priority indicator (colored bar)
   - STATUS: Badge (To-Do, In Progress, Completed)
   - ASSIGNED: Assignee name
   - DUE DATE: Formatted date (red if overdue)
   - LINK: Link icon (if work_link exists)
   - TIME: HH:MM:SS format time spent
   - TIMER: Start/Pause/Done buttons
   - ACTIONS: Edit/Delete buttons

5. **Enhanced Add/Edit Modal:**
   - Type dropdown (General, Bug Fix, Feature, Content, Design)
   - Work Link input field (optional)

**Backend Changes:**
- Added `type` and `work_link` fields to AdditionalTaskCreate and AdditionalTaskUpdate models
- Tasks now store and return type and work_link fields

**Files Modified:**
- `/app/frontend/src/pages/ProjectDetailPage.js` - AdTasksTab component redesigned
- `/app/backend/additional_tasks_routes.py` - Added type and work_link fields

**Testing Status:** ✅ All features verified (iteration_64.json)

---



### Approvals Module with Department Selection (DONE - April 2026)
**Purpose:** Added "Approvals" as a selectable module in HR Admin → Designation Creation with department-level and stage-level granularity.

**Features Implemented:**

1. **Approvals Module in Module Access:**
   - Added "Approvals" to the module list in the Designation creation modal
   - Shows a dropdown chevron indicator when has sub-options

2. **Department Selection Checkboxes:**
   When "Approvals" module is selected, shows checkboxes for:
   - Website
   - Social Media
   - Meta Ads
   - SEO
   - Finance
   - HR
   - Business Dev
   - ERP

3. **Website Approval Stages:**
   When "Website" department is selected, additional checkboxes appear for:
   - Content
   - Wireframe
   - UI Design
   - Development
   - Responsive
   - Testing
   - Delivery

**Use Cases:**
- **Project Manager:** Select Approvals → Website → specific stages only (e.g., Testing)
- **Operations Head:** Select Approvals → Website, Social Media, Meta Ads (all stages)
- **Finance Manager:** Select Approvals → Finance only

**Files Modified:**
- `/app/frontend/src/pages/HRAdminPage.js` - Added Approvals module with department/stage checkboxes
- `/app/frontend/src/pages/ApprovalsPage.js` - Updated filter UI with department checkboxes

**Testing Status:** ✅ UI verified working

---


### Role-Based Team Assignment (IN PROGRESS - April 2026)
**Purpose:** Implement comprehensive role-based project team assignment where team members can only work on their assigned stages.

**Features Implemented:**

1. **Backend Changes:**
   - Added `team_assignments` field to ProjectCreate and ProjectUpdate models
   - Format: `[{user_id, user_name, roles: ['content', 'wireframe', 'ui', ...]}]`
   - Added `/api/website-projects/projects/{project_id}/my-access` endpoint
   - Returns: `{is_master, allowed_stages, can_view_all, can_act_on_all, team_assignments}`

2. **Project Creation Team Tab (DLOperationsPage.js):**
   - Matrix-style team assignment table
   - Columns: Member Name, Content, Wireframe, UI Design, Development, Responsive, Testing, Delivery
   - Add team member from employee dropdown
   - Checkmark toggle for each stage
   - Quick role presets: Content Writer, UI/UX Designer, Website Developer, Tester, Project Manager (All)

3. **Tracker Board Role-Based Access (ProjectDetailPage.js):**
   - Stage tabs show lock icon for inaccessible stages
   - Disabled stages have 50% opacity and cursor-not-allowed
   - "View Only" banner shows when user can't act on current stage
   - All team members can VIEW all stages but only ACT on assigned stages
   - PM/Ops/Admin users have full access to all stages

**Role-Stage Mapping:**
| Role | Active Stages |
|------|--------------|
| Content Writer | content |
| Wireframe Designer | wireframe |
| UI/UX Designer | wireframe, ui |
| Website Developer | development, responsive |
| Tester | testing |
| PM/Operations | ALL stages |

**Files Modified:**
- `/app/backend/website_projects_routes.py` - Added team_assignments field and my-access endpoint
- `/app/frontend/src/pages/DLOperationsPage.js` - New Team Assignment UI in project creation
- `/app/frontend/src/pages/ProjectDetailPage.js` - Role-based stage access in TrackerBoard

**Testing Status:** Backend API verified, Frontend UI needs testing

**Next Steps:**
- Test with non-admin users to verify restricted access
- Update Master Board filtering by user's stages
- Add "My Tasks" view for individual team members

---

## 2026-02-10 — Leads UI Refactor (List-Only + Clickable Rows + Stage Tabs in Popup)

**Files Modified:**
- `/app/frontend/src/pages/LeadsPageV2.js`

**Changes:**
1. Removed Kanban + Preview view modes — Leads page now shows only the List view.
2. Removed the 3-icon view toggle from the toolbar (Table2/Columns3/LayoutGrid buttons).
3. Default `viewMode` state changed from `'kanban'` to `'list'`.
4. Stat cards' onClick handlers still set `viewMode('list')` (no-op safe).
5. Lead rows in `ListView` are now fully clickable (`onClick={() => onEdit(lead)}`, `cursor-pointer`, `data-testid="lead-row-{id}"`). Actions cell uses `e.stopPropagation()` so settings button doesn't trigger the row click.
6. Edit Lead popup now renders a "Move to Stage" pill bar above the footer with every pipeline stage as a clickable pill (`data-testid="stage-tab-{id}"`). Clicking calls `PUT /api/leads-v2/leads/{id}/stage`, refreshes stats/leads, and re-syncs the local form state. Current stage is highlighted in solid color.

**Testing Status:** Smoke tested via Playwright. Login + Leads page + row click + popup with 8 stage tabs all verified. No lint errors.

**Outstanding:**
- Light/Dark theme inconsistencies on HR Admin / HR / Settings pages (P1, recurring).
- Component refactoring for monolithic pages (P0 technical debt).


---

## 2026-02-11 — HR Attendance UI Single-Row Refactor + Route-Level RBAC + Catch-All

**Files Modified:**
- `/app/frontend/src/pages/HRPage.js` (AttendanceTab card grid + header tags)
- `/app/frontend/src/components/ProtectedRoute.js` (module-prop RBAC)
- `/app/frontend/src/App.js` (module keys on every protected route, legacy redirects for /sales /seo, catch-all `*` route)

**Changes:**
1. **HRPage Today's Attendance** — removed Status and Work Mode cards from the grid; moved them as non-clickable Badge tags next to the "Today's Attendance" header (`data-testid="attendance-status-tag"`, `attendance-work-mode-tag`). Remaining 6 cards (Login, Logout, Lunch, Sessions, Login Hour, Work Hours) sit in a single responsive row (`grid-cols-2 md:grid-cols-3 lg:grid-cols-6`) with enlarged `text-2xl` values.
2. **ProtectedRoute now enforces module_access at the route level.** Accepts an optional `module` prop, uses the same alias map as Sidebar (operations↔our_tasks, hr↔my_profile, hr_admin↔hr_manager, etc.). Unauthorized users are redirected to `/our-tasks` BEFORE the page shell renders (previously only backend returned 403 while the UI shell rendered, causing console-error spam).
3. **App.js** — every protected route now declares its module key (`<ProtectedRoute module="hr_admin">`, etc.). Added explicit Navigate redirects for legacy `/sales`, `/sales-tasks`, `/seo` (in addition to existing `/seo-board`, `/meta-ads`, `/bde-tasks`, etc.). Added catch-all `<Route path="*">` that redirects unknown URLs to `/our-tasks` instead of rendering a blank SPA shell.

**Testing Status:**
- Backend regression suite at `/app/backend/tests/test_drawlead_regression_jan2026.py` — 21/21 pass.
- Frontend RBAC verified: `vinoth@drawlead.com` reaches all protected pages; `ops-user@drawlead.com` is redirected from `/hr-admin`, `/finance`, `/settings`, `/sales`, `/seo`, and any unknown path → `/our-tasks`.

**Outstanding / Notes:**
- Operations dept tab filter: only the "Chief Executive Officer" designation exists in the `designations` collection. The "Operation Head" designation referenced by `ops-user@drawlead.com` has no matching DB record, so the filter (correctly) falls through to "show all" because `operations_departments` is empty. **Action for user:** seed an "Operation Head" designation with the desired `operations_departments` array in HR Admin → Designations.
- Recurring Light/Dark theme inconsistencies on HR/HR Admin/Settings still pending (P1).
- Monolithic page refactor (`OurTasksPage.js`, `HRAdminPage.js`, `HRPage.js` >3k lines) still pending (P1, technical debt).
- Google Calendar real event push still MOCKED.


---

## 2026-02-11 — Multi-Break System (Lunch → Break In/Out with categories)

**User Story:** "Lunch In / Out" renamed to "Break In / Out". Breaks can be taken multiple times per day. Break Out popup asks the user to pick a category (Lunch, Breakfast, Tea Break, Other) with optional reason (required for Other). The single "Lunch" summary card on HR Attendance is replaced with a clickable "Break" card showing total time + count. Clicking it opens a popup with totals + a list of every break (category, start/end, duration, reason).

**Backend (`/app/backend/hr_routes.py`):**
- New Pydantic models: `BreakStartRequest`, `BreakEndRequest`, constant `VALID_BREAK_CATEGORIES = {lunch, breakfast, tea, other}`.
- New endpoint `POST /api/hr/attendance/break-out` — adds a new entry to `attendance.breaks[]` with `{break_id, category, reason, start_time, end_time=null, duration_minutes=0}`. Validates "Other" requires reason. Refuses to start a new break if one is already open.
- New endpoint `POST /api/hr/attendance/break-in` — closes the currently open break and recomputes `lunch_duration` as the SUM of all break durations (kept for legacy back-compat with monthly stats / payroll).
- Old `/lunch-start` and `/lunch-end` endpoints remain unchanged for any external callers.

**Frontend (`/app/frontend/src/components/Layout.js`):**
- Header buttons now show **Break Out** (yellow) and, when on a break, **Break In** (purple, pulse).
- Removed: `showLunchOutModal`, `showLunchInModal`, `handleLunchOut`, `handleLunchIn`, `getLunchOutTime`, `getLunchDuration` (replaced).
- Added: `showBreakOutModal`, `showBreakInModal`, `handleBreakOut`, `handleBreakIn`, `getOpenBreakStartTime`, `getCurrentBreakDuration`.
- Break Out modal renders 4 category buttons + reason input (label switches to required `*` when "Other" is picked).
- `isOnBreak` now derived from `attendance.breaks` array (open break = any entry with `end_time == null`), falls back to legacy `lunch_start && !lunch_end` if no breaks array.
- Removed lunchCompleted gate — multiple breaks per day are allowed.

**Frontend (`/app/frontend/src/pages/HRPage.js`):**
- "Lunch" summary card replaced with clickable **Break** card (`data-testid="break-card"`) showing total formatted as `Xh Ym` and a count badge (`3×`).
- Added Break Summary popup (`data-testid="break-summary-modal"`) with Total Time + Total Breaks header tiles and per-break list (category badge, start–end times, reason, duration).
- Status badge now reads "On Break" instead of "On Lunch".
- Imported `Coffee` icon from lucide-react.

**Testing:** End-to-end curl flow validated against preview backend:
- 3 sequential break-in/out cycles (lunch 1:00–1:30 PM, tea 3:00–3:30 PM, other 4:00–4:30 PM with reason "Family call") → `lunch_duration = 90 min`, `breaks` array has 3 entries with `duration_minutes=30` each.
- `POST /break-out` with `category=other` and empty `reason` → 400 "Reason is required for 'Other' break". ✅
- Frontend screenshots verify card displays "1h 30m" + "3×" badge, summary popup lists all 3 breaks with correct categories/times/reasons, Break Out modal shows the 4 category buttons.

**data-testid added:** `break-out-btn`, `break-in-btn`, `break-category-buttons`, `break-category-lunch|breakfast|tea|other`, `break-reason-input`, `break-card`, `break-count-badge`, `break-total-display`, `break-summary-modal`, `break-summary-total`, `break-summary-count`, `break-summary-close`, `break-item-{idx}`, `break-item-{idx}-duration`.


---

## 2026-02-11 — Database Tools Panel (HR Admin → Database Tools)

**Why:** User wants to back up their data and migrate to their own VPS / MongoDB Atlas in the future. Production DB and Preview DB are separate; without an export tool, data would be trapped.

**Backend (`/app/backend/db_admin_routes.py` — NEW):**
- `GET /api/admin/db/collections` — list every collection with document counts (admin-only).
- `GET /api/admin/db/export/{collection}` — stream a single collection as a downloadable JSON file.
- `GET /api/admin/db/export-all` — stream a `.zip` with every non-system collection + a `_manifest.json`.
- `POST /api/admin/db/import/{collection}` — upload JSON (multipart) with `mode=append|replace`.
- `POST /api/admin/db/wipe` — guard-railed wipe (requires `confirm_text="WIPE"`).
- All endpoints require `role in {super_admin, admin}` → 403 otherwise. System collections (`user_sessions`, `google_oauth_states`, `password_otps`) hard-blocked.

**Frontend (`/app/frontend/src/components/hr/DatabaseToolsTab.js` — NEW):**
- New "Database Tools" tab in HR Admin. Migration hint card + collections table with per-row Export + Import buttons + an Export Full Backup (.zip) button.
- Import modal with Append vs Replace mode selector (Replace prompts for confirm).

**Testing:** Verified with curl — 47 collections, ops-user 403, /export/users returns 19 users, /export-all produces 110KB zip. Frontend screenshot confirms tab renders with all 47 collections.
