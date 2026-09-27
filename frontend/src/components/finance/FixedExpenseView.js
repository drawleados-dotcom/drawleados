/**
 * Finance -> Expense -> Fixed Expense.
 *
 * A month-scoped rollup of the recurring/fixed costs that don't belong to
 * one-off Cashbook entries alone — Payroll (split out from Vinoth's own),
 * Rent, EB, Vendors, Tools & Subscription, Marketing and Investment — each
 * its own sub-tab, plus an "All" sub-tab that lists every row's total
 * together. Every number here is READ from data that already exists
 * elsewhere (Budget's category tree, Payroll's payslips, Tools &
 * Subscription's summary) — the one new piece is Vendors' monthly
 * paid/unpaid tracking, added alongside the existing vendor directory.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import {
  Calendar, ChevronLeft, ChevronRight, Loader2, Pencil, Save, X, Plus,
  Wallet, Users, Home, Zap, Building2, Boxes, Megaphone, TrendingUp, ListChecks,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import PayrollTab from './PayrollTab';

const API = process.env.REACT_APP_BACKEND_URL;
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const VINOTH_EMAIL = 'vinoth@drawlead.com';
const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

const SUB_TABS = [
  { key: 'all', label: 'All', icon: ListChecks },
  { key: 'payroll', label: 'Payroll', icon: Users },
  { key: 'vinoth_payroll', label: 'Vinoth Payroll', icon: Users },
  { key: 'rent', label: 'Rent', icon: Home },
  { key: 'eb', label: 'EB', icon: Zap },
  { key: 'vendors', label: 'Vendors', icon: Building2 },
  { key: 'tools_subscription', label: 'Tools and Subscription', icon: Boxes },
  { key: 'marketing', label: 'Marketing', icon: Megaphone },
  { key: 'investment', label: 'Investment', icon: TrendingUp },
];

const findTop = (tops, name) => (tops || []).find((t) => (t.name || '').trim().toLowerCase() === name.toLowerCase()) || null;
const findAny = (tops, name) => {
  const stack = [...(tops || [])];
  while (stack.length) {
    const n = stack.shift();
    if ((n.name || '').trim().toLowerCase() === name.toLowerCase()) return n;
    if (n.sub_categories?.length) stack.push(...n.sub_categories);
  }
  return null;
};

const FixedExpenseView = () => {
  const token = localStorage.getItem('session_token');
  const headers = { Authorization: `Bearer ${token}` };

  const today = new Date();
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear] = useState(today.getFullYear());
  const [subTab, setSubTab] = useState('all');
  const [loading, setLoading] = useState(true);

  const [categories, setCategories] = useState([]);
  const [payslips, setPayslips] = useState([]);
  const [toolsSummary, setToolsSummary] = useState({ grand: 0, paid: 0, balance: 0 });
  const [vendorData, setVendorData] = useState({ vendors: [], total: 0, paid: 0, balance: 0 });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [budgetsRes, payslipsRes, toolsRes, vendorsRes] = await Promise.all([
        axios.get(`${API}/api/finance/expense-split/budgets?month=${month}&year=${year}`, { headers }),
        axios.get(`${API}/api/payroll/payslips?month=${month}&year=${year}`, { headers }).catch(() => ({ data: [] })),
        axios.get(`${API}/api/finance/subscriptions/summary?month=${month}&year=${year}`, { headers }).catch(() => ({ data: { grand: 0, paid: 0, balance: 0 } })),
        axios.get(`${API}/api/finance/vendors/payments?month=${month}&year=${year}`, { headers }).catch(() => ({ data: { vendors: [], total: 0, paid: 0, balance: 0 } })),
      ]);
      setCategories(budgetsRes.data?.categories || []);
      setPayslips(payslipsRes.data || []);
      setToolsSummary(toolsRes.data || { grand: 0, paid: 0, balance: 0 });
      setVendorData(vendorsRes.data || { vendors: [], total: 0, paid: 0, balance: 0 });
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to load Fixed Expense');
    } finally {
      setLoading(false);
    }
  }, [month, year]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const stepMonth = (delta) => {
    let m = month + delta, y = year;
    if (m < 1) { m = 12; y -= 1; }
    if (m > 12) { m = 1; y += 1; }
    setMonth(m); setYear(y);
  };

  const rentNode = useMemo(() => findAny(categories, 'Rent'), [categories]);
  const ebNode = useMemo(() => findAny(categories, 'EB'), [categories]);
  const marketingNode = useMemo(() => findTop(categories, 'Marketing'), [categories]);
  const investmentNode = useMemo(() => findTop(categories, 'Investment'), [categories]);

  const vinothSlips = useMemo(() => payslips.filter((p) => (p.employee_email || '').toLowerCase() === VINOTH_EMAIL), [payslips]);
  const otherSlips = useMemo(() => payslips.filter((p) => (p.employee_email || '').toLowerCase() !== VINOTH_EMAIL), [payslips]);
  const vinothPayroll = useMemo(() => vinothSlips.reduce((s, p) => s + Number(p.net_salary || 0), 0), [vinothSlips]);
  const payrollExclVinoth = useMemo(() => otherSlips.reduce((s, p) => s + Number(p.net_salary || 0), 0), [otherSlips]);

  const rows = useMemo(() => ([
    { key: 'payroll', label: 'Payroll (excl. Vinoth)', total: payrollExclVinoth },
    { key: 'vinoth_payroll', label: 'Vinoth Payroll', total: vinothPayroll },
    { key: 'rent', label: 'Rent', total: rentNode?.spent || 0 },
    { key: 'eb', label: 'EB', total: ebNode?.spent || 0 },
    { key: 'vendors', label: 'Vendors', total: vendorData.total || 0 },
    { key: 'tools_subscription', label: 'Tools & Subscription', total: toolsSummary.grand || 0 },
    { key: 'marketing', label: 'Marketing', total: marketingNode?.spent || 0 },
    { key: 'investment', label: 'Investment', total: investmentNode?.spent || 0 },
  ]), [payrollExclVinoth, vinothPayroll, rentNode, ebNode, vendorData, toolsSummary, marketingNode, investmentNode]);
  const grandTotal = useMemo(() => rows.reduce((s, r) => s + r.total, 0), [rows]);

  // ---- Rent fixed-amount inline edit (reuses the existing Budget endpoint) ----
  const [editingRent, setEditingRent] = useState(false);
  const [rentValue, setRentValue] = useState('');
  const [savingRent, setSavingRent] = useState(false);
  const startEditRent = () => { setRentValue(String(rentNode?.budget ?? '')); setEditingRent(true); };
  const saveRent = async () => {
    const amount = parseFloat(rentValue);
    if (isNaN(amount) || amount < 0) { toast.error('Enter a valid amount'); return; }
    if (!rentNode) { toast.error('No "Rent" category found — add one in Expense Split first'); return; }
    setSavingRent(true);
    try {
      await axios.put(`${API}/api/finance/expense-split/budgets/${rentNode.category_id}`, { amount, month, year }, { headers });
      toast.success('Rent amount updated');
      setEditingRent(false);
      await load();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to update Rent amount');
    } finally {
      setSavingRent(false);
    }
  };

  // ---- Vendors: add + pay/unpay ----
  const [vendorModal, setVendorModal] = useState(false);
  const [vendorDraft, setVendorDraft] = useState({ name: '', monthly_amount: '' });
  const [savingVendor, setSavingVendor] = useState(false);
  const [payingVendorId, setPayingVendorId] = useState(null);
  const addVendor = async () => {
    if (!vendorDraft.name.trim()) { toast.error('Vendor name is required'); return; }
    setSavingVendor(true);
    try {
      await axios.post(`${API}/api/finance/vendors`, {
        name: vendorDraft.name.trim(), monthly_amount: vendorDraft.monthly_amount ? Number(vendorDraft.monthly_amount) : 0,
      }, { headers });
      toast.success('Vendor added');
      setVendorModal(false);
      setVendorDraft({ name: '', monthly_amount: '' });
      await load();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to add vendor');
    } finally {
      setSavingVendor(false);
    }
  };
  const toggleVendorPaid = async (v) => {
    setPayingVendorId(v.vendor_id);
    try {
      if (v.payment.paid) {
        await axios.post(`${API}/api/finance/vendors/${v.vendor_id}/payments/unpay?month=${month}&year=${year}`, {}, { headers });
        toast.success('Marked unpaid');
      } else {
        await axios.post(`${API}/api/finance/vendors/${v.vendor_id}/payments/pay?month=${month}&year=${year}`, {}, { headers });
        toast.success('Marked paid');
      }
      await load();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to update payment');
    } finally {
      setPayingVendorId(null);
    }
  };

  const card = (label, value, accent = '#6366f1', testId) => (
    <div className="bg-white dark:bg-[#18181b] border border-gray-200 dark:border-[#27272a] rounded-xl p-4" data-testid={testId}>
      <p className="text-xs uppercase tracking-wide text-gray-600 dark:text-[#a1a1aa]">{label}</p>
      <p className="text-2xl font-bold mt-2" style={{ color: accent, fontFamily: 'Plus Jakarta Sans' }}>{fmt(value)}</p>
    </div>
  );

  const missingCategoryNote = (name) => (
    <p className="text-xs text-gray-500 dark:text-[#71717a] mt-2">
      No "{name}" category found yet — add one under Expense &gt; Expense Split, then tag its Cashbook entries to it.
    </p>
  );

  return (
    <div className="space-y-4" data-testid="finance-fixed-expense-tab">
      {/* Header + Month scheduler — shared across every sub-tab */}
      <div className="bg-white dark:bg-[#18181b] border border-gray-200 dark:border-[#27272a] rounded-xl p-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Wallet className="h-5 w-5 text-violet-600 dark:text-[#a78bfa]" />
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-[#fafafa]">Fixed Expense</h3>
            <p className="text-xs text-gray-600 dark:text-[#a1a1aa]">Recurring monthly costs — Payroll, Rent, EB, Vendors, Tools, Marketing & Investment</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-gray-500 dark:text-[#71717a]" />
          <Button size="sm" variant="ghost" onClick={() => stepMonth(-1)} className="h-9 w-9 p-0 text-gray-600 dark:text-[#a1a1aa] hover:text-[#6366f1]" data-testid="fixed-expense-prev-month">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="px-3 py-1.5 rounded-lg bg-[#6366f1]/10 text-[#6366f1] text-sm font-semibold min-w-[140px] text-center" data-testid="fixed-expense-period-label">
            {MONTHS[month - 1]} {year}
          </div>
          <Button size="sm" variant="ghost" onClick={() => stepMonth(1)} className="h-9 w-9 p-0 text-gray-600 dark:text-[#a1a1aa] hover:text-[#6366f1]" data-testid="fixed-expense-next-month">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Sub-tab pills */}
      <div className="flex flex-wrap items-center gap-1 p-1 rounded-lg border bg-white dark:bg-[#18181b] border-gray-200 dark:border-[#27272a]">
        {SUB_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setSubTab(t.key)}
            data-testid={`fixed-expense-subtab-${t.key}`}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              subTab === t.key
                ? 'bg-gray-100 dark:bg-[#27272a] text-gray-900 dark:text-white'
                : 'text-gray-500 dark:text-[#a1a1aa] hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <t.icon className="h-3.5 w-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-12 text-center text-gray-600 dark:text-[#a1a1aa] bg-white dark:bg-[#18181b] border border-gray-200 dark:border-[#27272a] rounded-xl">
          <Loader2 className="h-6 w-6 mx-auto animate-spin mb-2" /> Loading…
        </div>
      ) : (
        <>
          {subTab === 'all' && (
            <div className="bg-white dark:bg-[#18181b] border border-gray-200 dark:border-[#27272a] rounded-xl overflow-hidden" data-testid="fixed-expense-all-table">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-[#0c0a09] text-gray-600 dark:text-[#a1a1aa] uppercase text-[11px] tracking-wider">
                  <tr>
                    <th className="text-left px-4 py-3">Category</th>
                    <th className="text-right px-4 py-3">Total Expense</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-[#27272a]">
                  {rows.map((r) => (
                    <tr key={r.key} className="hover:bg-gray-50 dark:hover:bg-[#0c0a09] cursor-pointer" onClick={() => setSubTab(r.key)} data-testid={`fixed-expense-row-${r.key}`}>
                      <td className="px-4 py-3 text-gray-900 dark:text-[#fafafa] font-medium">{r.label}</td>
                      <td className="px-4 py-3 text-right text-gray-900 dark:text-[#fafafa]">{fmt(r.total)}</td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50 dark:bg-[#0c0a09] font-bold">
                    <td className="px-4 py-3 text-gray-900 dark:text-[#fafafa]">Total</td>
                    <td className="px-4 py-3 text-right text-[#6366f1]" data-testid="fixed-expense-grand-total">{fmt(grandTotal)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* Exactly the main Payroll tab's own view (KPI cards + full employee
              table + payslip modal) — just scoped to a subset of employees and
              driven by this page's own shared month stepper instead of its own. */}
          {subTab === 'payroll' && (
            <PayrollTab month={month} year={year} showHeader={false} emailFilter={{ mode: 'exclude', email: VINOTH_EMAIL }} />
          )}

          {subTab === 'vinoth_payroll' && (
            <PayrollTab month={month} year={year} showHeader={false} emailFilter={{ mode: 'only', email: VINOTH_EMAIL }} />
          )}

          {subTab === 'rent' && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {card('Fixed Amount', rentNode?.budget || 0, '#6366f1', 'fixed-expense-rent-budget')}
                {card('Actually Spent', rentNode?.spent || 0, '#10b981', 'fixed-expense-rent-spent')}
                {card('Balance', rentNode?.balance || 0, (rentNode?.balance || 0) < 0 ? '#ef4444' : '#10b981', 'fixed-expense-rent-balance')}
              </div>
              <div className="bg-white dark:bg-[#18181b] border border-gray-200 dark:border-[#27272a] rounded-xl p-4">
                {!rentNode ? missingCategoryNote('Rent') : editingRent ? (
                  <div className="flex items-center gap-2">
                    <Input type="number" min="0" value={rentValue} onChange={(e) => setRentValue(e.target.value)} className="w-40" autoFocus data-testid="fixed-expense-rent-input" />
                    <Button size="sm" onClick={saveRent} disabled={savingRent} className="bg-[#6366f1] hover:bg-[#4f46e5] text-white" data-testid="fixed-expense-rent-save"><Save className="h-3.5 w-3.5" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingRent(false)}><X className="h-3.5 w-3.5" /></Button>
                  </div>
                ) : (
                  <Button size="sm" variant="outline" onClick={startEditRent} data-testid="fixed-expense-rent-edit"><Pencil className="h-3.5 w-3.5 mr-1.5" /> Fix Rent Amount</Button>
                )}
              </div>
            </div>
          )}

          {subTab === 'eb' && (
            <div className="space-y-3">
              {card('EB (Electricity) — recorded this month', ebNode?.spent || 0, '#f59e0b', 'fixed-expense-eb-card')}
              {!ebNode ? missingCategoryNote('EB') : (
                <p className="text-xs text-gray-500 dark:text-[#71717a]">Record an EB bill via Cashbook &gt; Add Expense, tagged to the "EB" category — it shows up here automatically.</p>
              )}
            </div>
          )}

          {subTab === 'marketing' && card('Marketing — total this month', marketingNode?.spent || 0, '#ec4899', 'fixed-expense-marketing-card')}
          {subTab === 'marketing' && !marketingNode && missingCategoryNote('Marketing')}

          {subTab === 'investment' && card('Investment — total this month', investmentNode?.spent || 0, '#10b981', 'fixed-expense-investment-card')}
          {subTab === 'investment' && !investmentNode && missingCategoryNote('Investment')}

          {subTab === 'tools_subscription' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {card('Total Due', toolsSummary.grand || 0, '#6366f1', 'fixed-expense-tools-grand')}
              {card('Paid', toolsSummary.paid || 0, '#10b981', 'fixed-expense-tools-paid')}
              {card('Balance', toolsSummary.balance || 0, (toolsSummary.balance || 0) > 0 ? '#ef4444' : '#10b981', 'fixed-expense-tools-balance')}
            </div>
          )}

          {subTab === 'vendors' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="grid grid-cols-3 gap-3 flex-1 min-w-[280px]">
                  {card('Total', vendorData.total || 0, '#6366f1', 'fixed-expense-vendors-total')}
                  {card('Paid', vendorData.paid || 0, '#10b981', 'fixed-expense-vendors-paid')}
                  {card('Balance', vendorData.balance || 0, (vendorData.balance || 0) > 0 ? '#ef4444' : '#10b981', 'fixed-expense-vendors-balance')}
                </div>
                <Button onClick={() => setVendorModal(true)} className="bg-[#6366f1] hover:bg-[#4f46e5] text-white" data-testid="fixed-expense-add-vendor-btn">
                  <Plus className="h-4 w-4 mr-1.5" /> Add Vendor
                </Button>
              </div>
              <div className="bg-white dark:bg-[#18181b] border border-gray-200 dark:border-[#27272a] rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-[#0c0a09] text-gray-600 dark:text-[#a1a1aa] uppercase text-[11px] tracking-wider">
                    <tr>
                      <th className="text-left px-4 py-3">Vendor</th>
                      <th className="text-right px-4 py-3">Monthly Amount</th>
                      <th className="text-center px-4 py-3">Status</th>
                      <th className="text-center px-4 py-3">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-[#27272a]">
                    {vendorData.vendors.length === 0 ? (
                      <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500 dark:text-[#71717a]" data-testid="fixed-expense-vendors-empty">No vendors with a monthly amount set yet — click "Add Vendor".</td></tr>
                    ) : vendorData.vendors.map((v) => (
                      <tr key={v.vendor_id} data-testid={`fixed-expense-vendor-row-${v.vendor_id}`}>
                        <td className="px-4 py-3 text-gray-900 dark:text-[#fafafa]">{v.name}</td>
                        <td className="px-4 py-3 text-right text-gray-900 dark:text-[#fafafa]">{fmt(v.monthly_amount)}</td>
                        <td className="px-4 py-3 text-center">
                          <Badge className={v.payment.paid ? 'bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/30' : 'bg-slate-500/15 text-slate-400 border border-slate-500/30'}>
                            {v.payment.paid ? 'Paid' : 'Not Paid'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Button
                            size="sm" variant="outline" disabled={payingVendorId === v.vendor_id}
                            onClick={() => toggleVendorPaid(v)}
                            data-testid={`fixed-expense-vendor-toggle-${v.vendor_id}`}
                          >
                            {payingVendorId === v.vendor_id ? '…' : v.payment.paid ? 'Mark Unpaid' : 'Mark Paid'}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      <Dialog open={vendorModal} onOpenChange={(o) => !o && setVendorModal(false)}>
        <DialogContent className="bg-white dark:bg-[#18181b] border border-gray-200 dark:border-[#27272a] max-w-sm">
          <DialogHeader><DialogTitle className="text-gray-900 dark:text-[#fafafa]">Add Vendor</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-gray-600 dark:text-[#a1a1aa]">Vendor Name</Label>
              <Input value={vendorDraft.name} onChange={(e) => setVendorDraft((d) => ({ ...d, name: e.target.value }))} autoFocus data-testid="fixed-expense-vendor-name-input" />
            </div>
            <div>
              <Label className="text-xs text-gray-600 dark:text-[#a1a1aa]">Monthly Amount</Label>
              <Input type="number" min="0" value={vendorDraft.monthly_amount} onChange={(e) => setVendorDraft((d) => ({ ...d, monthly_amount: e.target.value }))} data-testid="fixed-expense-vendor-amount-input" />
            </div>
            <p className="text-[11px] text-gray-500 dark:text-[#71717a]">More vendor details (contact, phone, address) can be added later from the main Vendors tab.</p>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setVendorModal(false)}>Cancel</Button>
              <Button onClick={addVendor} disabled={savingVendor} className="bg-[#6366f1] hover:bg-[#4f46e5] text-white" data-testid="fixed-expense-vendor-save">
                {savingVendor ? 'Saving…' : 'Add Vendor'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FixedExpenseView;
