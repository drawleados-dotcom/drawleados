/**
 * Master Expense view.
 *
 *  - Dynamic sub-tabs sourced from Expense Split top categories
 *    (e.g. Overhead | Marketing | Investment | Profit | ...).
 *  - Each tab lists the sub-categories of that top + their spent ₹ for the month.
 *  - The "Overhead" tab has a special, auto-fetched "Payroll" pseudo-row
 *    that shows the total of CEO-approved payslips for the selected month.
 */
import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Layers, IndianRupee, Loader2, Users } from 'lucide-react';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '../ui/select';

const API = process.env.REACT_APP_BACKEND_URL;
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

const MasterExpenseView = () => {
  const token = localStorage.getItem('session_token');
  const headers = { Authorization: `Bearer ${token}` };

  const today = new Date();
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear] = useState(today.getFullYear());

  const [loading, setLoading] = useState(true);
  const [topCategories, setTopCategories] = useState([]);
  const [activeTopId, setActiveTopId] = useState(null);
  const [payrollApprovedTotal, setPayrollApprovedTotal] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(
        `${API}/api/finance/expense-split/categories?month=${month}&year=${year}`,
        { headers },
      );
      const cats = res.data?.categories || [];
      setTopCategories(cats);
      if (!activeTopId && cats.length > 0) setActiveTopId(cats[0].category_id);
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
      const approved = rows.filter((p) => ['generated', 'paid'].includes(p.status));
      const total = approved.reduce((s, p) => s + Number(p.net_salary || 0), 0);
      setPayrollApprovedTotal(total);
    } catch {
      setPayrollApprovedTotal(0);
    }
  }, [month, year, token]);  // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const activeTop = topCategories.find((c) => c.category_id === activeTopId);
  const isOverhead = (activeTop?.name || '').trim().toLowerCase() === 'overhead';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Layers className="h-5 w-5 text-[#a78bfa]" />
          <div>
            <h3 className="text-lg font-bold text-[#fafafa]">Master Expense</h3>
            <p className="text-xs text-[#a1a1aa]">Sub-categories of each top group + actual spend for the selected month</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(month)} onValueChange={(v) => setMonth(parseInt(v))}>
            <SelectTrigger className="w-[130px] bg-[#27272a] border-[#3f3f46] text-[#fafafa]" data-testid="master-month-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>{MONTHS.map((m, i) => <SelectItem key={i} value={String(i+1)}>{m}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={String(year)} onValueChange={(v) => setYear(parseInt(v))}>
            <SelectTrigger className="w-[100px] bg-[#27272a] border-[#3f3f46] text-[#fafafa]" data-testid="master-year-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>{[2024, 2025, 2026, 2027].map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      {/* Empty state */}
      {!loading && topCategories.length === 0 && (
        <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-12 text-center" data-testid="master-empty">
          <Layers className="h-10 w-10 mx-auto text-[#52525b] mb-3" />
          <p className="text-[#fafafa] font-medium mb-1">No expense categories yet</p>
          <p className="text-xs text-[#a1a1aa]">Add top categories in the <b>Expense Split</b> tab. They appear here automatically.</p>
        </div>
      )}

      {loading && (
        <div className="text-center py-12 text-[#a1a1aa]">
          <Loader2 className="h-6 w-6 mx-auto animate-spin mb-2" /> Loading…
        </div>
      )}

      {!loading && topCategories.length > 0 && (
        <>
          {/* Dynamic top-category sub-tabs */}
          <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-[#18181b] border border-[#27272a] flex-wrap" data-testid="master-tabs">
            {topCategories.map((c) => {
              const active = c.category_id === activeTopId;
              return (
                <button
                  key={c.category_id}
                  onClick={() => setActiveTopId(c.category_id)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${active ? 'bg-[#27272a] text-white' : 'text-[#a1a1aa] hover:text-white'}`}
                  data-testid={`master-tab-${c.category_id}`}
                >
                  <span className="inline-block w-2 h-2 rounded-full mr-2 align-middle" style={{ backgroundColor: c.color }} />
                  {c.name}
                </button>
              );
            })}
          </div>

          {/* Active top — header card */}
          {activeTop && (
            <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-4 flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-[#a1a1aa]">Top Category</p>
                <p className="text-lg font-bold text-[#fafafa]">{activeTop.name} <span className="text-xs font-mono text-[#a1a1aa]">({activeTop.percent}% of Income)</span></p>
              </div>
              <div className="flex items-center gap-4">
                <Stat l="Allocated" v={fmt(activeTop.allocated)} />
                <Stat l="Spent" v={fmt(activeTop.spent)} red={activeTop.over_budget} />
                <Stat l="Balance" v={fmt(activeTop.balance)} red={activeTop.balance < 0} green={activeTop.balance >= 0} />
              </div>
            </div>
          )}

          {/* Sub-categories list */}
          <div className="bg-[#18181b] border border-[#27272a] rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-[#27272a] flex items-center justify-between">
              <p className="text-sm font-medium text-[#fafafa]">Sub-Expenses</p>
              <span className="text-xs text-[#a1a1aa]">{MONTHS[month-1]} {year}</span>
            </div>
            <div className="divide-y divide-[#27272a]">
              {/* Special Payroll row for Overhead */}
              {isOverhead && (
                <div className="flex items-center gap-3 px-4 py-3" data-testid="master-overhead-payroll-row">
                  <Users className="h-4 w-4 text-[#a78bfa]" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-[#fafafa]">Payroll</p>
                    <p className="text-[10px] text-[#a1a1aa]">CEO-approved payslip total for {MONTHS[month-1]} {year}</p>
                  </div>
                  <Stat l="Approved Total" v={fmt(payrollApprovedTotal)} green={payrollApprovedTotal > 0} />
                </div>
              )}
              {(activeTop?.sub_categories || []).length === 0 && !isOverhead && (
                <div className="px-4 py-8 text-center text-xs text-[#71717a]">
                  No sub-categories for <b>{activeTop?.name}</b>. Add one from the Expense Split tab.
                </div>
              )}
              {(activeTop?.sub_categories || []).map((s) => (
                <div key={s.category_id} className="flex items-center gap-3 px-4 py-3" data-testid={`master-sub-${s.category_id}`}>
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                  <p className="flex-1 text-sm text-[#fafafa]">{s.name}</p>
                  <Stat l="Spent" v={fmt(s.spent)} red={s.over_budget} />
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const Stat = ({ l, v, red, green }) => (
  <div className="text-right min-w-[90px]">
    <p className="text-[10px] uppercase tracking-wide text-[#71717a]">{l}</p>
    <p className={`text-sm font-semibold ${red ? 'text-red-400' : green ? 'text-emerald-400' : 'text-[#fafafa]'}`}>
      <IndianRupee className="inline h-3 w-3 -mt-0.5" />{String(v).replace(/^₹/, '')}
    </p>
  </div>
);

export default MasterExpenseView;
