# Drawlead OS - Product Requirements Document

## Last Updated: February 2026

---

## Recent Changes (February 2026 - Latest)

### Expense Module - Two Boards System ✅ (February 2026)
Complete cashflow management system matching user's Excel workflow:

**1. Expense Budget Board (Master View):**
- Master Expense table with 12 categories (Salary, Office Exp, CEO, Vendor Payments, Loans & Debts, Tools & Subscriptions, BNI, Tax & Auditing, Mentorship, Events & Networking, Courses & Books, Marketing & Branding)
- Grand Expenses columns: Total, Paid, Balance
- Fiscal Year dropdown (2024-25, 2025-26, 2026-27)
- Quarter dropdown (Q1-Q4) with monthly breakdown
- Click category → Drill-down to see items inside (e.g., Salary → Anbarasan, Harini, Swathi)
- Add Category / Add Item buttons

**2. Cashbook Board (Credit/Debit):**
- Amount in Account balance header
- 4 Bank Account tabs: Current, GST, Savings, Cash in Hand
- Month/Year selector
- **Credit/Inward (Green):** Sno, Date, Income From, Payment Type (Prepaid/Partial/One-Time), Payment Cycle (Monthly/Yearly/One-Time), Invoice Type (GST/NO GST), Invoice Number, Amount, Tax, Total
- **Debit/Outward (Red):** Sno, Date, Expense To, Category (color-coded badge), Amount, Tax, Total, Remarks

**Key Flow:**
When recording debit expense:
1. Select Category → Shows existing items in that category
2. Select existing item OR click "Add New Item"
3. If existing: Payment reduces balance in Expense Budget
4. If new: Creates entry in Expense Budget and records payment

**API Endpoints:**
- `/api/expense/bank-accounts` - CRUD for bank accounts
- `/api/expense/categories` - Expense categories (12 default)
- `/api/expense/entries` - Items within categories
- `/api/expense/income` - Credit/Income entries
- `/api/expense/payments` - Debit/Expense payments
- `/api/expense/cashflow` - Monthly cashflow view
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
