# Drawlead OS - Product Requirements Document

## Last Updated: February 2026

---

## Recent Changes (February 2026 - Latest)

### Expense Module - Dashboard-First UX ✅
Complete cashflow management system with modern dashboard experience:

**Dashboard View (Default):**
- Summary Cards: Total Cash In, Total Cash Out, Current Balance, Pending Payments
- Bank Accounts: 4 clickable account cards (Current, GST, Savings, Cash in Hand)
- Expense by Category: Progress bars with percentages and amounts
- Recent Transactions: List with IN/OUT icons, colored amounts

**Table View Toggle:**
- Excel-like detailed view when needed
- Columns: Type, Date, Description, Category, Amount, Actions
- IN/OUT badges with green/red coloring

**Features:**
- Add Income / Add Expense buttons with modal forms
- Category dropdown for expenses (Salary, Office Exp, CEO, Vendor Payments, etc.)
- Filter bar: Date range, Category filter, Search, Refresh
- Real-time balance calculation per account

**API Endpoints:**
- `/api/expense/bank-accounts` - CRUD for bank accounts
- `/api/expense/categories` - Expense categories
- `/api/expense/income` - Income entries
- `/api/expense/payments` - Expense payments
- `/api/expense/cashflow` - Monthly cashflow view
- `/api/expense/summary` - Cash In/Out/Balance summary
- `/api/expense/master-view` - Fiscal year category breakdown

---

## Previous Updates (December 2025)

### Website Projects - Table Layout Updated ✅
Updated pages table to match screenshot design:
- Each phase cell shows: **Status dropdown** + **"+ Add URL"** link
- Click "+ Add URL" to add URL and Due Date
- Shows "View" link when URL is added
- Cleaner, more compact layout

### Website Projects - Complete Overhaul ✅
**3 Navigation Views:**

1. **All Projects View** (Default at `/website-projects`)
   - Table: Project name, Dev %, Overall %, Developer, Onboarding, Deadline, Pages
   - Filters: Search, Due Date picker, Developer dropdown
   - Cross-project Tasks Panel

2. **Project Detail View** (`/website-projects?id=xxx`)
   - Collapsible header with metadata
   - Phase progress stats (Wireframe, UI, Content, Dev)
   - Pages/Tasks tabs

3. **Page Detail View** (`/website-projects?id=xxx&page=yyy`)
   - 4 Phase Cards with Status/Assignee/Due Date
   - Screenshots, Tasks/Notes, Sections

### Previous Updates
- SOP Works Board ✅
- Drawlead AI Assistant ✅
- Marketing Module ✅
- Theme Toggle ✅

## Pending/Future Tasks

### PENDING: Google Calendar Integration 📅
When user reminds, implement:
- New sidebar item "My Calendar / CEO" (super admin only)
- Emergent-managed Google Auth (requires GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET)
- Show real Google Calendar events
- Tasks view with department tabs: All | Sales | Marketing | Operations | HR | Finance | Execution | RD
- Check user availability when assigning tasks

### Other Pending
- Configure Resend API key for email notifications
- Refactor OperationsPage.js (86KB+ monolith)
- Finance Module: Payroll, GST tabs

## Test Credentials
- **Admin:** vinoth@drawlead.com / admin123

## Key Features Summary

| Feature | Status |
|---------|--------|
| Website Projects - All Views | ✅ Complete |
| Pages Table (Status + Add URL) | ✅ Complete |
| Google Calendar | 🟡 Pending (user to remind) |
| SOP Works Board | ✅ Complete |
| Drawlead AI | ✅ Complete |
| Marketing Module | ✅ Complete |
| Theme Toggle | ✅ Complete |
