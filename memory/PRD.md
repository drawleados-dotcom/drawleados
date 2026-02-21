# Drawlead OS - Product Requirements Document

## Last Updated: February 2026

---

## Recent Changes (February 2026 - Latest)

### Creative Design Board ✅ (February 2026)
Complete design task management system with stage-wise tracking:

**Structure:**
- Two main tabs: **Website UI** and **Design**
- List view with columns: Task Name, Project, Design Type, Design Content, Design File, Status, Final, Actions
- Board view option (Kanban-style by stage)

**Design Types:**
- Poster, Story, Brochure, Social Post, Banner, Logo, Video Thumbnail, Presentation
- Custom design types with sizes can be added
- Each type has predefined size options

**Stage-wise Tracking (4 Stages):**
1. Design Content - Due Date, Assignee, Link, Status
2. Design File - Due Date, Assignee, Link, Status
3. Review - Due Date, Assignee, Link, Status
4. Final - Due Date, Assignee, Link, Status

**API Endpoints:**
- `/api/creative/projects` - Creative projects CRUD
- `/api/creative/tasks` - Tasks with stage data CRUD
- `/api/creative/design-types` - Built-in + custom design types

### HR Attendance Enhancement ✅ (February 2026)
Enhanced sign-in/logout flow with manual time entry:

**Features:**
- **Auto-capture Clock In Time:** Time automatically recorded when user clicks "Clock In - Office" or "Clock In - WFH"
- **Manual Logout Time Entry:** When clicking "Clock Out", a modal appears with:
  - Display of clock-in time
  - Time picker for manual logout time entry
  - "Enter your actual logout time" helper text
  - Cancel and Confirm Logout buttons
- Backend accepts `manual_logout_time` parameter in HH:MM format

### Expense View Date Filter ✅ (February 2026)
Added month/year filter to Expense tab in Finance module:

**Features:**
- Month dropdown (January - December)
- Year dropdown (2024, 2025, 2026, 2027)
- Filters apply to category expense items
- Items reload when filter changes
- Backend `/api/expense/entries` accepts `month` and `year` params

### Enhanced Add Cash In Flow with Invoice Integration ✅ (February 2026)
Multi-step wizard for recording income with invoice integration:

**3-Step Flow:**
1. **Step 1 - Select Invoice Type:**
   - GST Invoice (With 18% GST) card
   - NO GST Invoice (Without GST) card
   - Visual icons for each option

2. **Step 2 - Select/Create Invoice:**
   - Shows list of unpaid invoices filtered by type
   - "Create New Invoice" button
   - Back navigation to Step 1
   - Empty state: "No unpaid GST invoices" message

3. **Step 3 - Enter Payment Details:**
   - Date picker
   - Payment Type: Advance, Partial, Full
   - Payment Cycle: One-Time, Monthly, Quarterly, Half-Yearly, Yearly
   - Bank Account dropdown
   - Amount Received field
   - Tax % selection
   - Add Income button

**Create Invoice Modal (On-the-fly):**
- Client Name*, Client Email, Due Date
- Invoice Items with Add Item button
- Description, Quantity, Rate per item
- Subtotal, Tax % dropdown, Total calculation
- Create Invoice button → Auto-selects and proceeds to Step 3

### Finance Module - Complete 7-Tab System ✅ (February 2026)
Comprehensive financial management system with Notion-like customization:

**7 Main Tabs:**
1. **Dashboard Tab** - 5 KPI Cards, Bank Accounts, Quick Actions, Export
2. **Cashbook Tab** - Cash In/Out tables, Account tabs, Month/Year filter, Export
3. **Expense Tab** - Category accordion view, Add Category, Add expense inside category, Export
4. **Budget Tab** - Monthly tabs, Category cards, Detail view, Export
5. **Invoice Tab** - Invoice list, Summary cards, Create Invoice, Export
6. **Outstanding Tab** - Track expected payments, Record Payment, Export
7. **Custom Tab** - Notion-like: add/delete custom tabs

**Key Features:**
- Excel export on EVERY tab using xlsx library
- Category-based expense tracking with accordion view
- Multi-step Add Cash In with invoice integration
- Color-coded badges for categories and project types
- Dark mode support throughout

---

## Previous Updates

### Expense Module - Two Boards System ✅
- Expense Budget Board (Master View)
- Cashbook Board (Credit/Debit)
- Bank Account management

### Website Projects - Complete Overhaul ✅
- All Projects View, Project Detail View, Page Detail View

### Other Completed Features
- SOP Works Board ✅
- Drawlead AI Assistant ✅
- Marketing Module ✅
- Theme Toggle ✅

---

## API Endpoints

### Finance Module
- `/api/expense/dashboard-summary` - Dashboard KPIs
- `/api/expense/bank-accounts` - Bank accounts CRUD
- `/api/expense/categories` - Expense categories
- `/api/expense/entries` - Items within categories
- `/api/expense/income` - Credit/Income entries
- `/api/expense/payments` - Debit/Expense payments
- `/api/expense/cashflow` - Monthly cashflow view
- `/api/expense/outstanding` - Outstanding revenue CRUD
- `/api/expense/budget-monthly` - Monthly budget data
- `/api/finance/invoices` - Invoice CRUD

---

## Pending/Future Tasks

### PENDING: Google Calendar Integration 📅
- New sidebar item "My Calendar / CEO" (super admin only)
- Emergent-managed Google Auth
- Show real Google Calendar events
- Tasks view with department tabs

### Other Pending
- Configure Resend API key for email notifications
- Refactor OperationsPage.js (86KB+ monolith)
- Refactor WebsiteProjectsPage.js

---

## Test Credentials
- **Admin:** vinoth@drawlead.com / admin123

## Key Features Summary

| Feature | Status |
|---------|--------|
| Finance Module - 7 Tabs | ✅ Complete |
| Enhanced Add Cash In (3-step wizard) | ✅ Complete |
| Create Invoice On-the-fly | ✅ Complete |
| Payment Cycle Options | ✅ Complete |
| Excel Export on All Tabs | ✅ Complete |
| Dashboard with KPIs | ✅ Complete |
| Cashbook (Cash In/Out) | ✅ Complete |
| Expense (Category Accordion) | ✅ Complete |
| Budget (Monthly Tabs) | ✅ Complete |
| Invoice Management | ✅ Complete |
| Outstanding Revenue | ✅ Complete |
| Custom Tabs (Notion-like) | ✅ Complete |
| Website Projects - All Views | ✅ Complete |
| SOP Works Board | ✅ Complete |
| Google Calendar | 🟡 Pending |

## 3rd Party Integrations
- Emergent-managed Google Auth
- Claude Sonnet 4.5
- jsPDF & jspdf-autotable
- Resend (placeholder keys)
- react-split-pane
- xlsx (Excel export)
