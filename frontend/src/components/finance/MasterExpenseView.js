/**
 * Master Expense view.
 *
 *  - Dynamic sub-tabs sourced from Expense Split top categories
 *    (e.g. Overhead | Marketing | Investment | Profit | ...).
 *  - Each tab lists the sub-categories of that top + their spent ₹ for the month.
 *  - The "Overhead" tab has two special, auto-fetched pseudo-rows: "Payroll"
 *    (CEO-approved payslip total) and "Tools & Subscription" (this month's
 *    subscription dues, see finance_subscriptions_routes.py's /summary) —
 *    each with a "Pay" action to settle an unpaid item without leaving this view.
 */
import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Layers, IndianRupee, Loader2, Users, Blocks } from 'lucide-react';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '../ui/select';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '../ui/dialog';

const API = process.env.REACT_APP_BACKEND_URL;
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

// Match the "Payroll" sub-category regardless of how someone typed it when
// creating it in Expense Split (e.g. "Pay roll", "Pay-Roll", "PAYROLL") —
// must stay identical to the check in CashbookSplit.js.
const isPayrollCategoryName = (name) => (name || '').toLowerCase().replace(/[^a-z]/g, '') === 'payroll';

// Same idea for "Tools & Subscription" / "Tools and Subscription" / etc. —
// hides a manually-created duplicate sub-category since the pinned row
// already represents it.
const isToolsSubCategoryName = (name) => {
  const n = (name || '').toLowerCase().replace(/[^a-z]/g, '');
  return n === 'toolssubscription' || n === 'toolsandsubscription' || n === 'toolsandsubscriptions';
};

// Pin Overhead/Marketing/Profit/Investment in that exact order; hide "Loss"
// entirely. Anything else falls to the end.
const TAB_ORDER = ['overhead', 'marketing', 'profit', 'investment'];
const HIDE_NAMES = new Set(['loss']);
const orderTops = (tops) => {
  const visible = (tops || []).filter((t) => !HIDE_NAMES.has((t.name || '').trim().toLowerCase()));
  const idx = (t) => {
    const i = TAB_ORDER.indexOf((t.name || '').trim().toLowerCase());
    return i === -1 ? 999 : i;
  };
  return [...visible].sort((a, b) => idx(a) - idx(b));
};

const MasterExpenseView = ({ onAddPayrollExpense }) => {
  const token = localStorage.getItem('session_token');
  const headers = { Authorization: `Bearer ${token}` };

  const today = new Date();
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear] = useState(today.getFullYear());

  const [loading, setLoading] = useState(true);
  const [topCategories, setTopCategories] = useState([]);
  const [activeTopId, setActiveTopId] = useState(null);
  const [payrollApprovedTotal, setPayrollApprovedTotal] = useState(0);
  const [payrollPaidTotal, setPayrollPaidTotal] = useState(0);
  const [subsSummary, setSubsSummary] = useState({ grand: 0, paid: 0, balance: 0, payable: [] });
  const [payPicker, setPayPicker] = useState(false);
  const [payingItem, setPayingItem] = useState(null); // { subscription_id, name, period_date, amount }
  const [payAmount, setPayAmount] = useState('');
  const [payingBusy, setPayingBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(
        `${API}/api/finance/expense-split/categories?month=${month}&year=${year}`,
        { headers },
      );
      const cats = orderTops(res.data?.categories || []);
      setTopCategories(cats);
      if (!activeTopId) setActiveTopId('all');
    } catch (e) {
      toast.error('Failed to load Master Expense');
    } finally {
      setLoading(false);
    }
    // Pull the CEO-approved payslip total for the selected month for the Payroll
    // pseudo-row inside Overhead.
    try {
      // The payslips list endpoint returns all payslips; we filter by month/year +
      // status. Two statuses count toward "approved & ready to pay": "generated"
      // and "paid" (paid = already disbursed via cashbook).
      const ps = await axios.get(`${API}/api/payroll/payslips?month=${month}&year=${year}`, { headers });
      const rows = ps.data || [];
      // Grand = CEO-approved (status ∈ {generated, partially_paid, paid}) net salary sum.
      const approved = rows.filter((p) => ['generated', 'partially_paid', 'paid'].includes(p.status));
      const total = approved.reduce((s, p) => s + Number(p.net_salary || 0), 0);
      setPayrollApprovedTotal(total);
      // Paid = actually disbursed via Cashbook so far — full amount for `paid`,
      // running `amount_paid` for `partially_paid` (partial installments).
      const paid = rows.reduce((s, p) => {
        if (p.status === 'paid') return s + Number(p.amount_paid ?? p.net_salary ?? 0);
        if (p.status === 'partially_paid') return s + Number(p.amount_paid || 0);
        return s;
      }, 0);
      setPayrollPaidTotal(paid);
    } catch {
      setPayrollApprovedTotal(0);
      setPayrollPaidTotal(0);
    }
    // Pull this month's Tools & Subscription dues for the Overhead pseudo-row.
    try {
      const res = await axios.get(`${API}/api/finance/subscriptions/summary?month=${month}&year=${year}`, { headers });
      setSubsSummary(res.data || { grand: 0, paid: 0, balance: 0, payable: [] });
    } catch {
      setSubsSummary({ grand: 0, paid: 0, balance: 0, payable: [] });
    }
  }, [month, year, token]);  // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const openPayPicker = () => { setPayingItem(null); setPayAmount(''); setPayPicker(true); };
  const closePayPicker = () => setPayPicker(false);
  const pickPayItem = (item) => { setPayingItem(item); setPayAmount(String(item.amount)); };
  const confirmSubscriptionPay = async () => {
    if (!payingItem) return;
    if (!payAmount || Number(payAmount) < 0) { toast.error('Enter a valid amount'); return; }
    setPayingBusy(true);
    try {
      await axios.post(
        `${API}/api/finance/subscriptions/${payingItem.subscription_id}/payments/${payingItem.period_date}/pay`,
        { amount_paid: Number(payAmount) },
        { headers },
      );
      toast.success(`Marked ${payingItem.name} as paid`);
      setPayPicker(false);
      await load();
    } catch (e) {
      toast.error('Failed to record payment');
    } finally {
      setPayingBusy(false);
    }
  };

  const activeTop = topCategories.find((c) => c.category_id === activeTopId);
  const isOverhead = (activeTop?.name || '').trim().toLowerCase() === 'overhead';
  const isAllTab = activeTopId === 'all';
  // Grand totals across every visible top category (used by the "All" tab)
  const grandAllocated = topCategories.reduce((s, c) => s + Number(c.allocated || 0), 0);
  const grandSpent = topCategories.reduce((s, c) => s + Number(c.spent || 0), 0);
  const grandBalance = grandAllocated - grandSpent;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white dark:bg-[#18181b] border border-gray-200 dark:border-[#27272a] rounded-xl p-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Layers className="h-5 w-5 text-violet-600 dark:text-[#a78bfa]" />
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-[#fafafa]">Master Expense</h3>
            <p className="text-xs text-gray-600 dark:text-[#a1a1aa]">Sub-categories of each top group + actual spend for the selected month</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(month)} onValueChange={(v) => setMonth(parseInt(v))}>
            <SelectTrigger className="w-[130px] bg-gray-100 dark:bg-[#27272a] border-gray-300 dark:border-[#3f3f46] text-gray-900 dark:text-[#fafafa]" data-testid="master-month-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>{MONTHS.map((m, i) => <SelectItem key={i} value={String(i+1)}>{m}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={String(year)} onValueChange={(v) => setYear(parseInt(v))}>
            <SelectTrigger className="w-[100px] bg-gray-100 dark:bg-[#27272a] border-gray-300 dark:border-[#3f3f46] text-gray-900 dark:text-[#fafafa]" data-testid="master-year-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>{[2024, 2025, 2026, 2027].map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      {/* Empty state */}
      {!loading && topCategories.length === 0 && (
        <div className="bg-white dark:bg-[#18181b] border border-gray-200 dark:border-[#27272a] rounded-xl p-12 text-center" data-testid="master-empty">
          <Layers className="h-10 w-10 mx-auto text-gray-500 dark:text-[#52525b] mb-3" />
          <p className="text-gray-900 dark:text-[#fafafa] font-medium mb-1">No expense categories yet</p>
          <p className="text-xs text-gray-600 dark:text-[#a1a1aa]">Add top categories in the <b>Expense Split</b> tab. They appear here automatically.</p>
        </div>
      )}

      {loading && (
        <div className="text-center py-12 text-gray-600 dark:text-[#a1a1aa]">
          <Loader2 className="h-6 w-6 mx-auto animate-spin mb-2" /> Loading…
        </div>
      )}

      {!loading && topCategories.length > 0 && (
        <>
          {/* Dynamic top-category sub-tabs (All pinned first) */}
          <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-white dark:bg-[#18181b] border border-gray-200 dark:border-[#27272a] flex-wrap" data-testid="master-tabs">
            <button
              key="all"
              onClick={() => setActiveTopId('all')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${isAllTab ? 'bg-gray-100 dark:bg-[#27272a] text-white' : 'text-gray-600 dark:text-[#a1a1aa] hover:text-white'}`}
              data-testid="master-tab-all"
            >
              <span className="inline-block w-2 h-2 rounded-full mr-2 align-middle bg-[#6366f1]" />
              All
            </button>
            {topCategories.map((c) => {
              const active = c.category_id === activeTopId;
              return (
                <button
                  key={c.category_id}
                  onClick={() => setActiveTopId(c.category_id)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${active ? 'bg-gray-100 dark:bg-[#27272a] text-white' : 'text-gray-600 dark:text-[#a1a1aa] hover:text-white'}`}
                  data-testid={`master-tab-${c.category_id}`}
                >
                  <span className="inline-block w-2 h-2 rounded-full mr-2 align-middle" style={{ backgroundColor: c.color }} />
                  {c.name}
                </button>
              );
            })}
          </div>

          {/* ALL view — grand totals + per-top summary row */}
          {isAllTab && (
            <>
              <div className="bg-white dark:bg-[#18181b] border border-gray-200 dark:border-[#27272a] rounded-xl p-4 flex items-center justify-between flex-wrap gap-3" data-testid="master-all-summary">
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-600 dark:text-[#a1a1aa]">All Categories</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-[#fafafa]">Grand Totals <span className="text-xs font-mono text-gray-600 dark:text-[#a1a1aa]">({MONTHS[month-1]} {year})</span></p>
                </div>
                <div className="flex items-center gap-4">
                  <Stat l="Allocated" v={fmt(grandAllocated)} />
                  <Stat l="Spent" v={fmt(grandSpent)} red={grandSpent > grandAllocated && grandAllocated > 0} />
                  <Stat l="Balance" v={fmt(grandBalance)} red={grandBalance < 0} green={grandBalance >= 0} />
                </div>
              </div>
              <div className="bg-white dark:bg-[#18181b] border border-gray-200 dark:border-[#27272a] rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-200 dark:border-[#27272a] flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-900 dark:text-[#fafafa]">Top Categories</p>
                  <span className="text-xs text-gray-600 dark:text-[#a1a1aa]">{topCategories.length} groups</span>
                </div>
                <div className="divide-y divide-gray-200 dark:divide-[#27272a]">
                  {topCategories.map((c) => (
                    <div key={c.category_id} className="flex items-center gap-3 px-4 py-3" data-testid={`master-all-row-${c.category_id}`}>
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900 dark:text-[#fafafa]">{c.name}</p>
                        <p className="text-[10px] text-gray-600 dark:text-[#a1a1aa]">{c.percent}% of Income · {(c.sub_categories || []).length} sub-categories</p>
                      </div>
                      <Stat l="Allocated" v={fmt(c.allocated)} />
                      <Stat l="Spent" v={fmt(c.spent)} red={c.over_budget} />
                      <Stat l="Balance" v={fmt(c.balance)} red={c.balance < 0} green={c.balance >= 0} />
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Active top — header card */}
          {!isAllTab && activeTop && (
            <div className="bg-white dark:bg-[#18181b] border border-gray-200 dark:border-[#27272a] rounded-xl p-4 flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-600 dark:text-[#a1a1aa]">Top Category</p>
                <p className="text-lg font-bold text-gray-900 dark:text-[#fafafa]">{activeTop.name} <span className="text-xs font-mono text-gray-600 dark:text-[#a1a1aa]">({activeTop.percent}% of Income)</span></p>
              </div>
              <div className="flex items-center gap-4">
                <Stat l="Allocated" v={fmt(activeTop.allocated)} />
                <Stat l="Spent" v={fmt(activeTop.spent)} red={activeTop.over_budget} />
                <Stat l="Balance" v={fmt(activeTop.balance)} red={activeTop.balance < 0} green={activeTop.balance >= 0} />
              </div>
            </div>
          )}

          {/* Sub-categories list (hidden in All view) */}
          {!isAllTab && (
          <div className="bg-white dark:bg-[#18181b] border border-gray-200 dark:border-[#27272a] rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-[#27272a] flex items-center justify-between">
              <p className="text-sm font-medium text-gray-900 dark:text-[#fafafa]">Sub-Expenses</p>
              <span className="text-xs text-gray-600 dark:text-[#a1a1aa]">{MONTHS[month-1]} {year}</span>
            </div>
            <div className="divide-y divide-gray-200 dark:divide-[#27272a]">
              {/* Special Payroll row for Overhead — always pinned first */}
              {isOverhead && (() => {
                const grand = payrollApprovedTotal;
                const paid = payrollPaidTotal;
                const balance = grand - paid;
                return (
                  <div className="flex items-center gap-3 px-4 py-3" data-testid="master-overhead-payroll-row">
                    <Users className="h-4 w-4 text-violet-600 dark:text-[#a78bfa]" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-[#fafafa]">Payroll</p>
                      <p className="text-[10px] text-gray-600 dark:text-[#a1a1aa]">Pre-fixed · CEO-approved payslip total for {MONTHS[month-1]} {year}</p>
                    </div>
                    <Stat l="Grand" v={fmt(grand)} green={grand > 0} />
                    <Stat l="Paid" v={fmt(paid)} />
                    <Stat l="Balance" v={fmt(balance)} red={balance > 0} green={balance <= 0 && grand > 0} />
                    {onAddPayrollExpense && (
                      <button
                        onClick={onAddPayrollExpense}
                        data-testid="master-overhead-payroll-pay-btn"
                        title="Pick an employee's approved payslip and record the payment in Cashbook"
                        className="ml-1 shrink-0 text-xs font-medium px-3 py-1.5 rounded-lg bg-[#a78bfa]/15 text-violet-600 dark:text-[#a78bfa] hover:bg-[#a78bfa]/25 transition-colors"
                      >
                        Pay Employee
                      </button>
                    )}
                  </div>
                );
              })()}
              {/* Special Tools & Subscription row for Overhead — mapped straight
                  to the Tools & Subscription tab's data (see ToolsSubscriptionTab.js
                  and finance_subscriptions_routes.py's /summary). */}
              {isOverhead && (() => {
                const { grand, paid, balance, payable } = subsSummary;
                return (
                  <div className="flex items-center gap-3 px-4 py-3" data-testid="master-overhead-tools-subscription-row">
                    <Blocks className="h-4 w-4 text-violet-600 dark:text-[#a78bfa]" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-[#fafafa]">Tools & Subscription</p>
                      <p className="text-[10px] text-gray-600 dark:text-[#a1a1aa]">Subscription dues for {MONTHS[month-1]} {year}</p>
                    </div>
                    <Stat l="Grand" v={fmt(grand)} green={grand > 0} />
                    <Stat l="Paid" v={fmt(paid)} />
                    <Stat l="Balance" v={fmt(balance)} red={balance > 0} green={balance <= 0 && grand > 0} />
                    {payable.length > 0 && (
                      <button
                        onClick={openPayPicker}
                        data-testid="master-overhead-tools-subscription-pay-btn"
                        title="Pick a tool/subscription with an unpaid amount this month and mark it paid"
                        className="ml-1 shrink-0 text-xs font-medium px-3 py-1.5 rounded-lg bg-[#a78bfa]/15 text-violet-600 dark:text-[#a78bfa] hover:bg-[#a78bfa]/25 transition-colors"
                      >
                        Pay
                      </button>
                    )}
                  </div>
                );
              })()}
              {(activeTop?.sub_categories || []).length === 0 && !isOverhead && (
                <div className="px-4 py-8 text-center text-xs text-gray-500 dark:text-[#71717a]">
                  No sub-categories for <b>{activeTop?.name}</b>. Add one from the Expense Split tab.
                </div>
              )}
              {(activeTop?.sub_categories || [])
                // Hide any manually-created "Payroll" / "Tools & Subscription" sub
                // when on Overhead since the pinned special rows above already
                // represent them.
                .filter((s) => !(isOverhead && (isPayrollCategoryName(s.name) || isToolsSubCategoryName(s.name))))
                .map((s) => (
                <div key={s.category_id} className="flex items-center gap-3 px-4 py-3" data-testid={`master-sub-${s.category_id}`}>
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                  <p className="flex-1 text-sm text-gray-900 dark:text-[#fafafa]">{s.name}</p>
                  <Stat l="Spent" v={fmt(s.spent)} red={s.over_budget} />
                </div>
              ))}
            </div>
          </div>
          )}
        </>
      )}

      {/* Tools & Subscription "Pay" picker — pick a tool with an unpaid
          amount this month, confirm the amount, mark it paid. */}
      <Dialog open={payPicker} onOpenChange={(o) => !o && closePayPicker()}>
        <DialogContent className="bg-white dark:bg-[#18181b] border border-gray-200 dark:border-[#27272a] max-w-md" data-testid="master-tools-subscription-pay-modal">
          <DialogHeader>
            <DialogTitle className="text-gray-900 dark:text-[#fafafa]">Pay a Tool / Subscription</DialogTitle>
            <DialogDescription className="text-gray-600 dark:text-[#a1a1aa]">
              Tools with an unpaid amount for {MONTHS[month-1]} {year}.
            </DialogDescription>
          </DialogHeader>
          {!payingItem ? (
            <div className="max-h-72 overflow-y-auto divide-y divide-gray-200 dark:divide-[#27272a] border border-gray-200 dark:border-[#27272a] rounded-lg">
              {subsSummary.payable.map((item) => (
                <button
                  key={item.subscription_id}
                  onClick={() => pickPayItem(item)}
                  className="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-[#6366f1]/5 transition-colors"
                  data-testid={`master-tools-subscription-pick-${item.subscription_id}`}
                >
                  <span className="text-sm text-gray-900 dark:text-[#fafafa]">{item.name}</span>
                  <span className="text-sm font-semibold text-[#ef4444]">{fmt(item.amount)}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-gray-50 dark:bg-[#0c0a09] border border-gray-200 dark:border-[#27272a]">
                <p className="text-sm font-medium text-gray-900 dark:text-[#fafafa]">{payingItem.name}</p>
                <p className="text-[10px] text-gray-600 dark:text-[#a1a1aa]">Unpaid amount: {fmt(payingItem.amount)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600 dark:text-[#a1a1aa] mb-1">Amount</p>
                <Input
                  type="number" min="0" value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  data-testid="master-tools-subscription-pay-amount"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setPayingItem(null)} className="border-gray-200 dark:border-[#27272a]">Back</Button>
                <Button onClick={confirmSubscriptionPay} disabled={payingBusy} className="bg-[#6366f1] hover:bg-[#4f46e5] text-white" data-testid="master-tools-subscription-pay-confirm">
                  {payingBusy ? 'Saving…' : 'Mark Paid'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

const Stat = ({ l, v, red, green }) => (
  <div className="text-right min-w-[90px]">
    <p className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-[#71717a]">{l}</p>
    <p className={`text-sm font-semibold ${red ? 'text-red-400' : green ? 'text-emerald-400' : 'text-gray-900 dark:text-[#fafafa]'}`}>
      <IndianRupee className="inline h-3 w-3 -mt-0.5" />{String(v).replace(/^₹/, '')}
    </p>
  </div>
);

export default MasterExpenseView;
