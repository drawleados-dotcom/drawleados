/**
 * Budget view — Expense sub-tab.
 *
 * Lives next to Master Expense & Expense Split.
 *
 * Same shape as Master Expense (horizontal Top-Category pills + per-sub rows)
 * BUT every sub-category has an editable "Budget" amount for the selected
 * month/year. Spent is computed from cashbook debits tagged with
 * split_category_id; Balance = Budget − Spent.
 */
import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Wallet, IndianRupee, Loader2, Save, Pencil, X, Receipt, ExternalLink } from 'lucide-react';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '../ui/select';
import { Input } from '../ui/input';
import { Button } from '../ui/button';

const API = process.env.REACT_APP_BACKEND_URL;
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

// Match Master Expense — pin All/Overhead/Marketing/Profit/Investment/Tax.
const TAB_ORDER = ['overhead', 'marketing', 'profit', 'investment', 'tax'];
const HIDE_NAMES = new Set(['loss']);
const orderTops = (tops) => {
  const visible = (tops || []).filter((t) => !HIDE_NAMES.has((t.name || '').trim().toLowerCase()));
  const idx = (t) => {
    const i = TAB_ORDER.indexOf((t.name || '').trim().toLowerCase());
    return i === -1 ? 999 : i;
  };
  return [...visible].sort((a, b) => idx(a) - idx(b));
};

const BudgetView = () => {
  const token = localStorage.getItem('session_token');
  const headers = { Authorization: `Bearer ${token}` };

  const today = new Date();
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear] = useState(today.getFullYear());
  const [loading, setLoading] = useState(true);
  const [tops, setTops] = useState([]);
  const [activeTopId, setActiveTopId] = useState(null);
  // Sum of gross (base_salary) across every payslip for the selected month —
  // used as the auto-budget for any sub-category literally named "Payroll".
  // User can still hit Edit to override.
  const [payrollGrossTotal, setPayrollGrossTotal] = useState(0);
  // Tax invoices for the selected month — drives the Tax top's special view.
  const [taxInvoices, setTaxInvoices] = useState([]);
  const [loadingTax, setLoadingTax] = useState(false);

  // Inline editing state — keyed by category_id
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [savingId, setSavingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [bRes, pRes] = await Promise.all([
        axios.get(`${API}/api/finance/expense-split/budgets?month=${month}&year=${year}`, { headers }),
        axios.get(`${API}/api/payroll/payslips?month=${month}&year=${year}`, { headers }).catch(() => ({ data: [] })),
      ]);
      const cats = orderTops(bRes.data?.categories || []);
      setTops(cats);
      setActiveTopId((prev) => {
        if (prev === 'all') return 'all';
        if (prev && cats.find((c) => c.category_id === prev)) return prev;
        return 'all';
      });
      // Sum gross (base_salary) of every payslip — drafts + reviews + paid all
      // count toward the "grand salary" the user wants to compare against.
      // Fall back to net_salary on payslips that were entered without a stored
      // gross (e.g. manually-created ones) so the auto value stays meaningful.
      const grossTotal = (pRes.data || []).reduce((s, p) => {
        const gross = Number(p.base_salary || 0);
        const net = Number(p.net_salary || 0);
        return s + (gross > 0 ? gross : net);
      }, 0);
      setPayrollGrossTotal(grossTotal);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to load budgets');
    } finally {
      setLoading(false);
    }
  }, [month, year]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  // Pull invoices for the selected month so the Tax top-category can render
  // the invoice-driven view instead of editable sub-budget rows.
  useEffect(() => {
    const ym = `${year}-${String(month).padStart(2, '0')}`;
    const start = `${ym}-01`;
    // Last day of month — simplest: first of next month
    const next = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`;
    setLoadingTax(true);
    axios.get(`${API}/api/finance/invoices?from_date=${start}&to_date=${next}`, { headers })
      .then((r) => setTaxInvoices(Array.isArray(r.data) ? r.data : (r.data?.invoices || [])))
      .catch(() => setTaxInvoices([]))
      .finally(() => setLoadingTax(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, year]);

  const isAllTab = activeTopId === 'all';
  const activeTop = tops.find((t) => t.category_id === activeTopId) || null;
  const isTaxTop = (activeTop?.name || '').trim().toLowerCase() === 'tax';

  // Auto-budget rule: a sub-category literally named "Payroll" ALWAYS uses the
  // gross-salary total for the month — even if a stale manual value lingers
  // in `expense_sub_budgets` from before this iteration shipped (the Edit
  // button is now hidden so users can't create new manual overrides for
  // Payroll). Other sub-categories keep using their stored manual budget.
  const isPayrollSub = (s) => (s?.name || '').trim().toLowerCase() === 'payroll';
  const effectiveBudget = (s) => {
    if (isPayrollSub(s)) return payrollGrossTotal;
    return Number(s.budget || 0);
  };
  // Per-top effective totals (includes auto Payroll injection).
  const effectiveTopBudget = (top) =>
    (top.sub_categories || []).reduce((s, c) => s + effectiveBudget(c), 0);
  // Active top header.
  const activeSubs = activeTop?.sub_categories || [];
  const totalBudgetForTop = activeSubs.reduce((s, c) => s + effectiveBudget(c), 0);
  const totalSpentForTop = activeTop ? Number(activeTop.spent || 0) : 0;
  const totalBalanceForTop = totalBudgetForTop - totalSpentForTop;

  const startEdit = (sub) => {
    setEditingId(sub.category_id);
    setEditValue(String(sub.budget || 0));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValue('');
  };

  const saveBudget = async (sub) => {
    const amount = parseFloat(editValue);
    if (isNaN(amount) || amount < 0) {
      toast.error('Enter a valid budget amount');
      return;
    }
    setSavingId(sub.category_id);
    try {
      await axios.put(
        `${API}/api/finance/expense-split/budgets/${sub.category_id}`,
        { amount, month, year },
        { headers },
      );
      toast.success('Budget updated');
      setEditingId(null);
      setEditValue('');
      await load();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to update budget');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-4" data-testid="budget-view">
      {/* Header */}
      <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Wallet className="h-5 w-5 text-[#10b981]" />
          <div>
            <h3 className="text-lg font-bold text-[#fafafa]">Budget</h3>
            <p className="text-xs text-[#a1a1aa]">Set a fixed budget per sub-category for the month. Cashbook expenses tagged to that sub-category reduce the balance.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(month)} onValueChange={(v) => setMonth(parseInt(v))}>
            <SelectTrigger className="w-[130px] bg-[#27272a] border-[#3f3f46] text-[#fafafa]" data-testid="budget-month-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>{MONTHS.map((m, i) => <SelectItem key={i} value={String(i+1)}>{m}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={String(year)} onValueChange={(v) => setYear(parseInt(v))}>
            <SelectTrigger className="w-[100px] bg-[#27272a] border-[#3f3f46] text-[#fafafa]" data-testid="budget-year-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>{[2024, 2025, 2026, 2027].map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      {loading && (
        <div className="text-center py-12 text-[#a1a1aa]">
          <Loader2 className="h-6 w-6 mx-auto animate-spin mb-2" /> Loading…
        </div>
      )}

      {!loading && tops.length === 0 && (
        <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-12 text-center" data-testid="budget-empty">
          <Wallet className="h-10 w-10 mx-auto text-[#52525b] mb-3" />
          <p className="text-[#fafafa] font-medium mb-1">No expense categories yet</p>
          <p className="text-xs text-[#a1a1aa]">Add categories in the <b>Expense Split</b> tab to start budgeting.</p>
        </div>
      )}

      {!loading && tops.length > 0 && (
        <>
          {/* Dynamic top-category sub-tabs (All pinned first) */}
          <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-[#18181b] border border-[#27272a] flex-wrap" data-testid="budget-tabs">
            <button
              onClick={() => setActiveTopId('all')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${isAllTab ? 'bg-[#27272a] text-white' : 'text-[#a1a1aa] hover:text-white'}`}
              data-testid="budget-tab-all"
            >
              <span className="inline-block w-2 h-2 rounded-full mr-2 align-middle bg-[#10b981]" />
              All
            </button>
            {tops.map((c) => {
              const active = c.category_id === activeTopId;
              return (
                <button
                  key={c.category_id}
                  onClick={() => setActiveTopId(c.category_id)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${active ? 'bg-[#27272a] text-white' : 'text-[#a1a1aa] hover:text-white'}`}
                  data-testid={`budget-tab-${c.category_id}`}
                >
                  <span className="inline-block w-2 h-2 rounded-full mr-2 align-middle" style={{ backgroundColor: c.color }} />
                  {c.name}
                </button>
              );
            })}
          </div>

          {/* ALL view — grand totals + per-top summary rows */}
          {isAllTab && (() => {
            const totals = tops.map((t) => ({
              t,
              budget: effectiveTopBudget(t),
              spent: Number(t.spent || 0),
            })).map((r) => ({ ...r, balance: r.budget - r.spent }));
            const grandBudget = totals.reduce((s, r) => s + r.budget, 0);
            const grandSpent = totals.reduce((s, r) => s + r.spent, 0);
            const grandBalance = grandBudget - grandSpent;
            return (
              <>
                <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-4 flex items-center justify-between flex-wrap gap-3" data-testid="budget-all-summary">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-[#a1a1aa]">All Categories</p>
                    <p className="text-lg font-bold text-[#fafafa]">Grand Totals <span className="text-xs font-mono text-[#a1a1aa]">({MONTHS[month - 1]} {year})</span></p>
                  </div>
                  <div className="flex items-center gap-4">
                    <Stat l="Total Budget" v={fmt(grandBudget)} />
                    <Stat l="Paid / Spent" v={fmt(grandSpent)} red={grandSpent > grandBudget && grandBudget > 0} />
                    <Stat l="Balance" v={fmt(grandBalance)} green={grandBalance >= 0} red={grandBalance < 0} />
                  </div>
                </div>
                <div className="bg-[#18181b] border border-[#27272a] rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-[#27272a] flex items-center justify-between">
                    <p className="text-sm font-medium text-[#fafafa]">Top Categories</p>
                    <span className="text-xs text-[#a1a1aa]">{tops.length} groups</span>
                  </div>
                  <div className="divide-y divide-[#27272a]">
                    {totals.map(({ t, budget, spent, balance }) => (
                      <div key={t.category_id} className="flex items-center gap-3 px-4 py-3" data-testid={`budget-all-row-${t.category_id}`}>
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: t.color }} />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-[#fafafa]">{t.name}</p>
                          <p className="text-[10px] text-[#a1a1aa]">{(t.sub_categories || []).length} sub-categories</p>
                        </div>
                        <Stat l="Budget" v={fmt(budget)} />
                        <Stat l="Paid" v={fmt(spent)} red={spent > budget && budget > 0} />
                        <Stat l="Balance" v={fmt(balance)} green={balance >= 0} red={balance < 0} />
                      </div>
                    ))}
                  </div>
                </div>
              </>
            );
          })()}

          {/* Active top header */}
          {!isAllTab && activeTop && (
            <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-4 flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-[#a1a1aa]">Top Category</p>
                <p className="text-lg font-bold text-[#fafafa]">{activeTop.name}</p>
              </div>
              {isTaxTop ? (() => {
                const totalAmount = taxInvoices.reduce((s, inv) => s + Number(inv.total_amount || 0), 0);
                const taxAmount = taxInvoices.reduce((s, inv) =>
                  s + Number(inv.cgst || 0) + Number(inv.sgst || 0) + Number(inv.igst || 0), 0);
                const netAmount = totalAmount - taxAmount;
                return (
                  <div className="flex items-center gap-4">
                    <Stat l="Grand Income" v={fmt(totalAmount)} />
                    <Stat l="Tax Income" v={fmt(taxAmount)} red={taxAmount > 0} />
                    <Stat l="Net Income" v={fmt(netAmount)} green={netAmount > 0} />
                  </div>
                );
              })() : (
                <div className="flex items-center gap-4">
                  <Stat l="Total Budget" v={fmt(totalBudgetForTop)} />
                  <Stat l="Spent" v={fmt(totalSpentForTop)} red={totalSpentForTop > totalBudgetForTop && totalBudgetForTop > 0} />
                  <Stat l="Balance" v={fmt(totalBalanceForTop)} green={totalBalanceForTop >= 0} red={totalBalanceForTop < 0} />
                </div>
              )}
            </div>
          )}

          {/* Tax view — invoice-driven, replaces editable sub-rows for the Tax top */}
          {!isAllTab && isTaxTop && (
            <div className="bg-[#18181b] border border-[#27272a] rounded-xl overflow-hidden" data-testid="budget-tax-view">
              <div className="px-4 py-3 border-b border-[#27272a] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-[#a78bfa]" />
                  <p className="text-sm font-medium text-[#fafafa]">Tax Invoices · {MONTHS[month - 1]} {year}</p>
                </div>
                <span className="text-xs text-[#a1a1aa]">
                  {loadingTax ? 'Loading…' : `${taxInvoices.length} invoice${taxInvoices.length === 1 ? '' : 's'}`}
                </span>
              </div>
              {loadingTax ? (
                <div className="py-10 text-center text-[#a1a1aa]"><Loader2 className="h-5 w-5 mx-auto animate-spin mb-1" /> Loading…</div>
              ) : taxInvoices.length === 0 ? (
                <div className="py-10 text-center text-xs text-[#a1a1aa]">
                  No invoices found for this month. Create one from the Invoice tab.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" data-testid="budget-tax-table">
                    <thead className="bg-[#0c0a09] text-[#a1a1aa] uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="text-left px-4 py-2">Invoice / Client</th>
                        <th className="text-center px-3 py-2">View</th>
                        <th className="text-right px-3 py-2">Total Amount</th>
                        <th className="text-right px-3 py-2">Tax %</th>
                        <th className="text-right px-3 py-2">Tax Amount</th>
                        <th className="text-right px-4 py-2">Paid Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {taxInvoices.map((inv) => {
                        const tax = Number(inv.cgst || 0) + Number(inv.sgst || 0) + Number(inv.igst || 0);
                        const total = Number(inv.total_amount || 0);
                        const subtotal = Number(inv.subtotal || (total - tax)) || (total - tax);
                        const pct = subtotal > 0 ? (tax / subtotal) * 100 : 0;
                        const paidAmt = Number(inv.paid_amount || 0);
                        // Proportional tax paid so far — what % of the invoice the
                        // client has cleared, applied to the tax portion.
                        const taxPaid = total > 0 ? (paidAmt / total) * tax : 0;
                        const taxBalance = Math.max(0, tax - taxPaid);
                        return (
                          <tr key={inv.invoice_id} className="border-t border-[#27272a] hover:bg-[#a78bfa]/5" data-testid={`budget-tax-row-${inv.invoice_id}`}>
                            <td className="px-4 py-3">
                              <p className={`text-sm font-medium text-[#fafafa]`}>{inv.invoice_number || '—'}</p>
                              <p className="text-[10px] text-[#a1a1aa]">{inv.client_name || '—'}</p>
                            </td>
                            <td className="px-3 py-3 text-center">
                              <a
                                href={`/finance?tab=invoice&invoice_id=${inv.invoice_id}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[#a78bfa] hover:underline text-xs"
                                data-testid={`budget-tax-view-${inv.invoice_id}`}
                              >
                                <ExternalLink className="h-3 w-3" /> View
                              </a>
                            </td>
                            <td className="px-3 py-3 text-right text-[#fafafa] font-medium">{fmt(total)}</td>
                            <td className="px-3 py-3 text-right text-[#a1a1aa]">{pct > 0 ? `${pct.toFixed(0)}%` : '—'}</td>
                            <td className="px-3 py-3 text-right text-[#f59e0b] font-medium">{fmt(tax)}</td>
                            <td className="px-4 py-3 text-right" style={{ color: taxBalance > 0 ? '#ef4444' : '#10b981' }}>
                              {fmt(taxBalance)}
                              <p className="text-[10px] text-[#71717a] mt-0.5">Paid {fmt(taxPaid)}</p>
                            </td>
                          </tr>
                        );
                      })}
                      {/* Totals row */}
                      {taxInvoices.length > 1 && (() => {
                        const totalSum = taxInvoices.reduce((s, i) => s + Number(i.total_amount || 0), 0);
                        const taxSum = taxInvoices.reduce((s, i) => s + Number(i.cgst || 0) + Number(i.sgst || 0) + Number(i.igst || 0), 0);
                        const balSum = taxInvoices.reduce((s, i) => {
                          const tax = Number(i.cgst || 0) + Number(i.sgst || 0) + Number(i.igst || 0);
                          const total = Number(i.total_amount || 0);
                          const paid = Number(i.paid_amount || 0);
                          const taxPaid = total > 0 ? (paid / total) * tax : 0;
                          return s + Math.max(0, tax - taxPaid);
                        }, 0);
                        return (
                          <tr className="border-t-2 border-[#27272a] bg-[#0c0a09]">
                            <td colSpan={2} className="px-4 py-3 text-xs uppercase text-[#a1a1aa] font-semibold">Totals</td>
                            <td className="px-3 py-3 text-right text-[#fafafa] font-bold">{fmt(totalSum)}</td>
                            <td></td>
                            <td className="px-3 py-3 text-right text-[#f59e0b] font-bold">{fmt(taxSum)}</td>
                            <td className="px-4 py-3 text-right font-bold" style={{ color: balSum > 0 ? '#ef4444' : '#10b981' }}>{fmt(balSum)}</td>
                          </tr>
                        );
                      })()}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Sub-categories — Budget editable (hidden in All view AND Tax view) */}
          {!isAllTab && !isTaxTop && (
          <div className="bg-[#18181b] border border-[#27272a] rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-[#27272a] flex items-center justify-between">
              <p className="text-sm font-medium text-[#fafafa]">Sub-Categories — Budget for {MONTHS[month - 1]} {year}</p>
              <span className="text-xs text-[#a1a1aa]">{activeTop?.sub_categories?.length || 0} items</span>
            </div>
            <div className="divide-y divide-[#27272a]">
              {(activeTop?.sub_categories || []).length === 0 && (
                <div className="px-4 py-8 text-center text-xs text-[#71717a]">
                  No sub-categories for <b>{activeTop?.name}</b>. Add one from the Expense Split tab.
                </div>
              )}
              {(activeTop?.sub_categories || [])
                // Pin "Payroll" sub-category to the top inside Overhead so the
                // auto-fetched row is the first thing users see.
                .slice()
                .sort((a, b) => {
                  const ap = isPayrollSub(a) ? 0 : 1;
                  const bp = isPayrollSub(b) ? 0 : 1;
                  return ap - bp;
                })
                .map((s) => {
                const isEditing = editingId === s.category_id;
                const isSaving = savingId === s.category_id;
                const isPayroll = isPayrollSub(s);
                const displayBudget = effectiveBudget(s);
                const displayBalance = displayBudget - Number(s.spent || 0);
                const displayOver = Number(s.spent || 0) > displayBudget && displayBudget > 0;
                return (
                  <div key={s.category_id} className="grid grid-cols-12 items-center gap-3 px-4 py-3" data-testid={`budget-sub-${s.category_id}`}>
                    <div className="col-span-4 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                      <div>
                        <p className="text-sm text-[#fafafa]">{s.name}</p>
                        {isPayroll && (
                          <p className="text-[10px] text-[#a78bfa]" data-testid={`budget-auto-tag-${s.category_id}`}>
                            Auto · Σ gross salary from Monthly Payroll · read-only
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="col-span-3 text-right">
                      <p className="text-[10px] uppercase tracking-wide text-[#71717a]">Budget</p>
                      {isEditing && !isPayroll ? (
                        <Input
                          type="number"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="h-8 text-right bg-[#27272a] border-[#3f3f46] text-[#fafafa] text-sm"
                          data-testid={`budget-input-${s.category_id}`}
                          autoFocus
                        />
                      ) : (
                        <p className="text-sm font-semibold text-[#fafafa]">
                          <IndianRupee className="inline h-3 w-3 -mt-0.5" />{String(fmt(displayBudget)).replace(/^₹/, '')}
                        </p>
                      )}
                    </div>
                    <div className="col-span-2 text-right">
                      <Stat l="Spent" v={fmt(s.spent)} red={displayOver} />
                    </div>
                    <div className="col-span-2 text-right">
                      <Stat l="Balance" v={fmt(displayBalance)} green={displayBalance >= 0} red={displayBalance < 0} />
                    </div>
                    <div className="col-span-1 flex items-center justify-end gap-1">
                      {isPayroll ? (
                        <span className={`text-[10px] text-[#a78bfa]`} data-testid={`budget-locked-${s.category_id}`}>
                          Auto-locked
                        </span>
                      ) : isEditing ? (
                        <>
                          <Button
                            size="sm"
                            onClick={() => saveBudget(s)}
                            disabled={isSaving}
                            className="h-7 w-7 p-0 bg-[#10b981] hover:bg-[#059669] text-white"
                            data-testid={`budget-save-${s.category_id}`}
                          >
                            {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={cancelEdit}
                            disabled={isSaving}
                            className="h-7 w-7 p-0 text-[#a1a1aa] hover:text-white"
                            data-testid={`budget-cancel-${s.category_id}`}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => startEdit({ ...s, budget: displayBudget })}
                          className="h-7 px-2 text-[#a78bfa] hover:bg-[#a78bfa]/10"
                          data-testid={`budget-edit-${s.category_id}`}
                        >
                          <Pencil className="h-3 w-3 mr-1" /> Edit
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          )}
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

export default BudgetView;
