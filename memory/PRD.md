# Drawlead OS - Product Requirements Document

## Last Updated: February 2026

---

## Recent Changes (February 2026 - Latest)

### Finance Module - Complete 7-Tab System ✅ (February 2026)
Comprehensive financial management system with Notion-like customization:

**7 Main Tabs:**

1. **Dashboard Tab:**
   - 5 KPI Cards: Total Revenue, Payment Due, Outstanding, Total Expense, Profit
   - Bank Accounts section (Current, GST, Savings, Cash in Hand)
   - Quick Action buttons: Add Cash In, Add Cash Out, Add Outstanding, View Budget
   - Export Dashboard to Excel

2. **Cashbook Tab:**
   - Side-by-side Cash In (Green) / Cash Out (Red) tables
   - Bank Account tabs: Current Account, GST Account, Savings Account, Cash in Hand
   - Month/Year filter dropdowns
   - Add buttons for both Cash In and Cash Out
   - Export Cashbook to Excel

3. **Expense Tab (Category Accordion View):**
   - 12+ colored category badges (Salary, Office Expense, CEO, Vendor Payments, etc.)
   - Click category to expand and see expenses inside
   - Add Category button
   - Add expense inside category (+ button on each category)
   - Total/Paid/Balance columns per category
   - Export Expenses to Excel

4. **Budget Tab:**
   - Monthly filter tabs (Jan-Jun)
   - Year selector dropdown
   - Category cards showing Total/Paid/Balance
   - Click category card to see detailed view
   - Export Budget to Excel

5. **Invoice Tab:**
   - Summary cards: Total Invoices, Paid, Pending, Overdue
   - Invoice table: Invoice #, Client, Date, Due Date, Amount, Status, Actions
   - Create Invoice button
   - Export to Excel

6. **Outstanding Tab:**
   - Summary cards: Total Expected, Received, Balance
   - Outstanding table: Expected Date, Project Name, Type, Amount, Revenue Type, Received, Balance, Remarks
   - Record Payment button for each entry
   - Add Outstanding button
   - Export Outstanding to Excel

7. **Custom Tab (Notion-like Customization):**
   - "+" button to add custom tabs
   - Create tab with custom name
   - Delete custom tab (X button)
   - Add Row/Add Data functionality
   - Tabs stored in localStorage

**Key Features:**
- Excel export on EVERY tab using xlsx library
- Category-based expense tracking with accordion view
- Color-coded badges for categories and project types
- Dark mode support throughout
- data-testid attributes for testing

**API Endpoints:**
- `/api/expense/dashboard-summary` - Dashboard KPIs
- `/api/expense/bank-accounts` - CRUD for bank accounts
- `/api/expense/categories` - Expense categories (12 default)
- `/api/expense/entries` - Items within categories
- `/api/expense/income` - Credit/Income entries
- `/api/expense/payments` - Debit/Expense payments
- `/api/expense/cashflow` - Monthly cashflow view
- `/api/expense/outstanding` - Outstanding revenue CRUD
- `/api/expense/budget-monthly` - Monthly budget data

---

## Previous Updates (December 2025 - February 2026)

### Expense Module - Two Boards System ✅
- Expense Budget Board (Master View)
- Cashbook Board (Credit/Debit)
- Bank Account management
- Category-based expense tracking

### Website Projects - Complete Overhaul ✅
**3 Navigation Views:**
1. All Projects View (table with filters)
2. Project Detail View (phases, pages, tasks)
3. Page Detail View (phase cards, screenshots, sections)

### Other Completed Features
- SOP Works Board ✅
- Drawlead AI Assistant ✅
- Marketing Module ✅
- Theme Toggle ✅

---

## Pending/Future Tasks

### PENDING: Google Calendar Integration 📅
When user reminds, implement:
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
| Dashboard with KPIs | ✅ Complete |
| Cashbook (Cash In/Out) | ✅ Complete |
| Expense (Category Accordion) | ✅ Complete |
| Budget (Monthly Tabs) | ✅ Complete |
| Invoice Management | ✅ Complete |
| Outstanding Revenue | ✅ Complete |
| Custom Tabs (Notion-like) | ✅ Complete |
| Excel Export on All Tabs | ✅ Complete |
| Website Projects - All Views | ✅ Complete |
| SOP Works Board | ✅ Complete |
| Drawlead AI | ✅ Complete |
| Marketing Module | ✅ Complete |
| Theme Toggle | ✅ Complete |
| Google Calendar | 🟡 Pending |

## 3rd Party Integrations
- Emergent-managed Google Auth
- Claude Sonnet 4.5
- jsPDF & jspdf-autotable
- Resend (placeholder keys)
- react-split-pane
- xlsx (Excel export)
