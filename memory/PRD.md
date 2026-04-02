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
- **Database**: MongoDB with collections for users, leads, attendance, leave, documentation, calendar_connections, etc.

---

## Implemented Features

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
