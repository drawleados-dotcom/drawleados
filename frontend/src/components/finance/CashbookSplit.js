import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Plus, TrendingUp, TrendingDown, Loader2, Trash2, X, Eye, AlertCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Button } from '../ui/button';
import { useTheme } from '../../contexts/ThemeContext';

const API = process.env.REACT_APP_BACKEND_URL;

const fmt = (n) => {
  const v = Number(n) || 0;
  return `₹${v.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
};

const fmtDate = (iso) => {
  if (!iso) return '—';
  try { return new Date(iso).toISOString().slice(0, 10); } catch { return iso; }
};

const PAYMENT_MODES = ['cash', 'cheque', 'bank', 'upi'];

/**
 * Single Cashbook with internal GST | Non-GST sub-tabs.
 * Pass `gstType` to lock it to one type (used internally when toggled).
 */
const CashbookSplit = ({ gstType: lockedGstType }) => {
  const { isDark } = useTheme();
  const token = localStorage.getItem('session_token');
  const headers = { Authorization: `Bearer ${token}` };
  const [activeGstType, setActiveGstType] = useState(lockedGstType || 'gst');
  const gstType = lockedGstType || activeGstType;

  const bgCard = isDark ? 'bg-[#18181b]' : 'bg-white';
  const bgSecondary = isDark ? 'bg-[#0c0a09]' : 'bg-gray-50';
  const borderColor = isDark ? 'border-[#27272a]' : 'border-gray-200';
  const textPrimary = isDark ? 'text-[#fafafa]' : 'text-gray-900';
  const textSecondary = isDark ? 'text-[#a1a1aa]' : 'text-gray-500';

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(null); // 'credit' | 'debit' | null
  const [groupView, setGroupView] = useState(null); // { group_id, total, entries }
  const today = new Date().toISOString().slice(0, 10);
  const empty = { amount: '', date: today, payment_mode: 'bank', bank_id: '', party: '', category: '', notes: '' };
  const [form, setForm] = useState(empty);
  // Multi-source expense / income state
  const [balances, setBalances] = useState(null);
  const [allocs, setAllocs] = useState([{ source: 'cash', bank_id: '', amount: '' }]);
  const [expenseTotal, setExpenseTotal] = useState('');
  // Income-only state
  const [invoices, setInvoices] = useState([]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  // Expense Split categories (for budget tagging on Add Expense)
  const [splitCategories, setSplitCategories] = useState([]); // top categories with .sub_categories
  const [splitTopId, setSplitTopId] = useState('');
  const [splitSubId, setSplitSubId] = useState('');
  // Payroll linkage — when sub-category resolves to "Payroll" we let the user
  // pick a generated (CEO-approved) payslip, auto-fill the amount, and on save
  // mark that payslip as `paid`.
  const [payablePayslips, setPayablePayslips] = useState([]);
  const [selectedPayslipId, setSelectedPayslipId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await axios.get(`${API}/api/finance/banks/cashbook/entries?gst_type=${gstType}`, { headers });
      setData(r.data);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to load cashbook');
    } finally {
      setLoading(false);
    }
  }, [gstType]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  // When user picks a sub-category whose name is "Payroll", fetch the list of
  // generated/unpaid payslips so they can pick exactly one to expense.
  useEffect(() => {
    if (!splitTopId || !splitSubId) {
      setPayablePayslips([]);
      setSelectedPayslipId('');
      return;
    }
    const top = splitCategories.find((c) => c.category_id === splitTopId);
    const sub = top?.sub_categories?.find((s) => s.category_id === splitSubId);
    const isPayroll = (sub?.name || '').toLowerCase().trim() === 'payroll';
    if (!isPayroll) {
      setPayablePayslips([]);
      setSelectedPayslipId('');
      return;
    }
    (async () => {
      try {
        const r = await axios.get(`${API}/api/payroll/payslips/payable`, { headers });
        setPayablePayslips(r.data || []);
      } catch (e) {
        setPayablePayslips([]);
      }
    })();
    setSelectedPayslipId('');
  }, [splitSubId, splitTopId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Active payslip-payroll flow flag
  const selectedPayslip = payablePayslips.find((p) => p.payslip_id === selectedPayslipId) || null;
  const isPayrollMode = payablePayslips.length > 0 || !!selectedPayslip;

  const openAdd = async (kind) => {
    setModal(kind);
    setForm({ ...empty });
    try {
      const r = await axios.get(`${API}/api/finance/banks/cashbook/balances?gst_type=${gstType}`, { headers });
      setBalances(r.data);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to load balances');
    }
    if (kind === 'credit') {
      // Load every invoice for this gst_type that is NOT fully paid.
      try {
        const r2 = await axios.get(`${API}/api/finance/invoices?gst_type=${gstType}`, { headers });
        setInvoices((r2.data || []).filter((i) => (Number(i.paid_amount) || 0) < (Number(i.total_amount) || 0)));
      } catch (e) {
        setInvoices([]);
      }
      setSelectedInvoiceId('');
      setAllocs([{ source: 'cash', bank_id: '', amount: '' }]);
      setExpenseTotal('');
    }
    if (kind === 'debit') {
      setAllocs([{ source: 'cash', bank_id: '', amount: '' }]);
      setExpenseTotal('');
      // Load Expense Split categories to tag this expense against a budget bucket.
      try {
        const now = new Date();
        const r3 = await axios.get(
          `${API}/api/finance/expense-split/categories?month=${now.getMonth() + 1}&year=${now.getFullYear()}`,
          { headers },
        );
        setSplitCategories(r3.data?.categories || []);
      } catch (e) {
        setSplitCategories([]);
      }
      setSplitTopId('');
      setSplitSubId('');
      setSelectedPayslipId('');
      setPayablePayslips([]);
    }
  };

  const sourceOptions = () => {
    if (!balances) return [];
    const opts = [
      { value: 'cash', label: `Cash — Bal ₹${Number(balances.cash.balance).toLocaleString('en-IN')}`, available: balances.cash.balance },
      { value: 'cheque', label: `Cheque — Bal ₹${Number(balances.cheque.balance).toLocaleString('en-IN')}`, available: balances.cheque.balance },
      { value: 'upi', label: `UPI — Bal ₹${Number(balances.upi.balance).toLocaleString('en-IN')}`, available: balances.upi.balance },
      ...balances.banks.map((b) => ({
        value: `bank:${b.bank_id}`,
        label: `${b.label} — Bal ₹${Number(b.balance).toLocaleString('en-IN')}`,
        available: b.balance,
        bank_id: b.bank_id,
      })),
    ];
    return opts;
  };

  const allocSum = allocs.reduce((s, a) => s + (parseFloat(a.amount) || 0), 0);
  const expenseTotalNum = parseFloat(expenseTotal) || 0;
  const allocsBalanced = Math.abs(allocSum - expenseTotalNum) < 0.01 && expenseTotalNum > 0;

  const updateAlloc = (idx, patch) => {
    const next = allocs.map((a, i) => (i === idx ? { ...a, ...patch } : a));
    setAllocs(next);
  };

  const addAllocRow = () => setAllocs((a) => [...a, { source: 'cash', bank_id: '', amount: '' }]);
  const removeAllocRow = (idx) => setAllocs((a) => a.filter((_, i) => i !== idx));

  const submitIncome = async () => {
    if (!selectedInvoiceId) { toast.error('Select an invoice'); return; }
    if (!expenseTotalNum || expenseTotalNum <= 0) { toast.error('Enter amount to collect'); return; }
    if (!allocsBalanced) { toast.error(`Allocations must sum to ₹${expenseTotalNum.toLocaleString('en-IN')}`); return; }
    try {
      await axios.post(`${API}/api/finance/banks/collect/${selectedInvoiceId}`, {
        date: form.date,
        notes: form.notes,
        allocations: allocs.map((a) => ({
          source: a.source,
          bank_id: a.source === 'bank' ? a.bank_id : null,
          amount: parseFloat(a.amount) || 0,
        })),
      }, { headers });
      toast.success('Income recorded against invoice');
      setModal(null);
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to save');
    }
  };

  const submitExpense = async () => {
    if (!expenseTotalNum || expenseTotalNum <= 0) { toast.error('Enter total expense amount'); return; }
    if (!allocsBalanced) { toast.error(`Allocations must sum to ₹${expenseTotalNum.toLocaleString('en-IN')}`); return; }
    // Validate each row vs available
    for (const a of allocs) {
      const opt = sourceOptions().find((o) => (a.source === 'bank' ? o.value === `bank:${a.bank_id}` : o.value === a.source));
      if (!opt) { toast.error('Pick a source for every row'); return; }
      const amt = parseFloat(a.amount) || 0;
      if (amt > Number(opt.available) + 0.001) {
        toast.error(`${opt.label} cannot release ₹${amt.toLocaleString('en-IN')}`);
        return;
      }
    }
    try {
      // Derive a friendly category label from the selected split categories if user didn't type one.
      const topCat = splitCategories.find((c) => c.category_id === splitTopId);
      const subCat = topCat?.sub_categories?.find((s) => s.category_id === splitSubId);
      const derivedCategory = (form.category || '').trim()
        || (subCat ? `${topCat.name} › ${subCat.name}` : (topCat?.name || ''));
      const splitCategoryId = splitSubId || splitTopId || null;
      // If this expense is tied to a payroll payslip, require an explicit selection.
      if (isPayrollMode && !selectedPayslipId) {
        toast.error('Pick the employee/payslip being paid');
        return;
      }
      await axios.post(`${API}/api/finance/banks/cashbook/expense`, {
        gst_type: gstType,
        date: form.date,
        party: form.party || (selectedPayslip ? selectedPayslip.employee_name : ''),
        category: derivedCategory,
        notes: form.notes,
        split_category_id: splitCategoryId,
        split_top_category_id: splitTopId || null,
        payslip_id: selectedPayslipId || null,
        allocations: allocs.map((a) => ({
          source: a.source,
          bank_id: a.source === 'bank' ? a.bank_id : null,
          amount: parseFloat(a.amount) || 0,
        })),
      }, { headers });
      toast.success(selectedPayslipId ? 'Salary expense recorded · Payslip marked PAID' : 'Expense recorded');
      setModal(null);
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to save');
    }
  };

  const submit = async () => {
    const amt = parseFloat(form.amount);
    if (!amt || amt <= 0) { toast.error('Enter a valid amount'); return; }
    if (form.payment_mode === 'bank' && !form.bank_id) {
      toast.error(`Select a ${gstType.toUpperCase()} bank account`);
      return;
    }
    try {
      await axios.post(`${API}/api/finance/banks/cashbook/entries`, {
        kind: modal,
        gst_type: gstType,
        amount: amt,
        date: form.date,
        payment_mode: form.payment_mode,
        bank_id: form.payment_mode === 'bank' ? form.bank_id : null,
        party: form.party,
        category: form.category,
        notes: form.notes,
      }, { headers });
      toast.success(`${modal === 'credit' ? 'Income' : 'Expense'} added`);
      setModal(null);
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to save');
    }
  };

  const viewGroup = async (group_id) => {
    try {
      const r = await axios.get(`${API}/api/finance/banks/cashbook/expense/${group_id}`, { headers });
      setGroupView(r.data);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to load group');
    }
  };

  const deleteEntry = async (entry) => {
    if (!window.confirm('Remove this entry?')) return;
    try {
      await axios.delete(`${API}/api/finance/banks/cashbook/entries/${entry.entry_id}`, { headers });
      toast.success('Removed');
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Delete failed');
    }
  };

  if (loading && !data) {
    return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-[#6366f1]" /></div>;
  }
  if (!data) return null;

  const { summary, entries } = data;

  const PerBankList = ({ rows, color }) => (
    <div className="space-y-1.5">
      {(rows || []).length === 0 ? (
        <p className={`text-xs italic ${textSecondary}`}>No entries yet.</p>
      ) : (
        rows.map((r) => (
          <div key={r.bank_id} className="flex items-center justify-between text-sm">
            <span className={textPrimary}>{r.label}</span>
            <span className="font-semibold" style={{ color }}>{fmt(r.amount)}</span>
          </div>
        ))
      )}
    </div>
  );

  const credits = entries.filter((e) => e.kind === 'credit');
  const debits = entries.filter((e) => e.kind === 'debit');

  return (
    <div className="space-y-5" data-testid={`cashbook-${gstType}`}>
      {/* GST / Non-GST sub-tabs (hidden when locked to one) */}
      {!lockedGstType && (
        <div className={`flex items-center gap-1 border-b ${borderColor}`}>
          {[
            { key: 'gst', label: 'GST' },
            { key: 'non_gst', label: 'Non-GST' },
          ].map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setActiveGstType(t.key)}
              data-testid={`cashbook-subtab-${t.key}`}
              className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                activeGstType === t.key
                  ? 'border-[#6366f1] text-[#6366f1]'
                  : `border-transparent ${textSecondary} hover:${textPrimary}`
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* Global action buttons */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className={`text-2xl font-bold ${textPrimary}`} style={{ fontFamily: 'Plus Jakarta Sans' }}>
            {gstType === 'gst' ? 'GST Cashbook' : 'Non-GST Cashbook'}
          </h2>
          <p className={`text-sm ${textSecondary}`}>Balance: <b style={{ color: summary.balance >= 0 ? '#22c55e' : '#ef4444' }}>{fmt(summary.balance)}</b></p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => openAdd('credit')} className="bg-[#10b981] hover:bg-[#059669] text-white gap-2" data-testid={`add-income-${gstType}`}>
            <Plus className="h-4 w-4" /> Add Income
          </Button>
          <Button onClick={() => openAdd('debit')} className="bg-[#ef4444] hover:bg-[#dc2626] text-white gap-2" data-testid={`add-expense-${gstType}`}>
            <Plus className="h-4 w-4" /> Add Expense
          </Button>
        </div>
      </div>

      {/* Two summary columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className={`${bgCard} border ${borderColor} rounded-xl p-5`} data-testid={`cashbook-income-summary-${gstType}`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className={`text-base font-semibold flex items-center gap-2 ${textPrimary}`}>
              <TrendingUp className="h-4 w-4 text-[#10b981]" /> Income
            </h3>
            <span className="text-2xl font-bold text-[#10b981]">{fmt(summary.income.total)}</span>
          </div>
          <PerBankList rows={summary.income.rows} color="#10b981" />
        </div>

        <div className={`${bgCard} border ${borderColor} rounded-xl p-5`} data-testid={`cashbook-expense-summary-${gstType}`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className={`text-base font-semibold flex items-center gap-2 ${textPrimary}`}>
              <TrendingDown className="h-4 w-4 text-[#ef4444]" /> Expense
            </h3>
            <span className="text-2xl font-bold text-[#ef4444]">{fmt(summary.expense.total)}</span>
          </div>
          <PerBankList rows={summary.expense.rows} color="#ef4444" />
        </div>
      </div>

      {/* Cash In / Cash Out tables — like the old cashbook layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className={`${bgCard} border ${borderColor} rounded-xl overflow-hidden`}>
          <div className="bg-[#10b981] text-white px-5 py-3 flex items-center justify-between">
            <span className="font-semibold">Cash In</span>
            <span className="font-bold">{fmt(summary.income.total)}</span>
          </div>
          {credits.length === 0 ? (
            <div className={`p-8 text-center ${textSecondary}`}>No entries</div>
          ) : (
            <table className="w-full text-sm">
              <thead className={`${bgSecondary} ${textSecondary} text-xs uppercase`}>
                <tr>
                  <th className="px-4 py-2 text-left">Date</th>
                  <th className="px-4 py-2 text-left">From</th>
                  <th className="px-4 py-2 text-left">Mode</th>
                  <th className="px-4 py-2 text-right">Amount</th>
                  <th className="px-4 py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {credits.map((e) => (
                  <tr key={e.entry_id} className={`border-t ${borderColor}`} data-testid={`cb-row-${e.entry_id}`}>
                    <td className={`px-4 py-2 ${textSecondary}`}>{fmtDate(e.date)}</td>
                    <td className={`px-4 py-2 ${textPrimary}`}>{e.from || e.invoice_number || '—'}</td>
                    <td className={`px-4 py-2 ${textSecondary} capitalize`}>{e.payment_mode}{e.bank_label ? ` · ${e.bank_label}` : ''}</td>
                    <td className="px-4 py-2 text-right font-semibold text-[#10b981]">{fmt(e.amount)}</td>
                    <td className="px-4 py-2 text-right">
                      <button onClick={() => deleteEntry(e)} className="text-[#f87171] hover:text-[#fca5a5]">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className={`${bgCard} border ${borderColor} rounded-xl overflow-hidden`}>
          <div className="bg-[#ef4444] text-white px-5 py-3 flex items-center justify-between">
            <span className="font-semibold">Cash Out</span>
            <span className="font-bold">{fmt(summary.expense.total)}</span>
          </div>
          {debits.length === 0 ? (
            <div className={`p-8 text-center ${textSecondary}`}>No entries</div>
          ) : (
            <table className="w-full text-sm">
              <thead className={`${bgSecondary} ${textSecondary} text-xs uppercase`}>
                <tr>
                  <th className="px-4 py-2 text-left">Date</th>
                  <th className="px-4 py-2 text-left">To</th>
                  <th className="px-4 py-2 text-left">Mode</th>
                  <th className="px-4 py-2 text-right">Amount</th>
                  <th className="px-4 py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {debits.map((e) => (
                  <tr key={e.entry_id} className={`border-t ${borderColor}`} data-testid={`cb-row-${e.entry_id}`}>
                    <td className={`px-4 py-2 ${textSecondary}`}>{fmtDate(e.date)}</td>
                    <td className={`px-4 py-2 ${textPrimary}`}>{e.to || '—'}</td>
                    <td className={`px-4 py-2 ${textSecondary} capitalize`}>{e.payment_mode}{e.bank_label ? ` · ${e.bank_label}` : ''}</td>
                    <td className="px-4 py-2 text-right font-semibold text-[#ef4444]">{fmt(e.amount)}</td>
                    <td className="px-4 py-2 text-right">
                      <div className="inline-flex items-center gap-1">
                        {e.expense_group_id && (
                          <button
                            onClick={() => viewGroup(e.expense_group_id)}
                            className="text-[#6366f1] hover:text-[#818cf8]"
                            title="View payment summary"
                            data-testid={`cb-view-${e.expense_group_id}`}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button onClick={() => deleteEntry(e)} className="text-[#f87171] hover:text-[#fca5a5]">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Add Income modal — invoice-tied, multi-source allocator */}
      {modal === 'credit' && (
        <Dialog open={true} onOpenChange={() => setModal(null)}>
          <DialogContent className={`${bgCard} border ${borderColor} ${textPrimary} max-w-2xl`} data-testid="cashbook-add-modal-credit">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-[#10b981]" />
                Add Income — {gstType === 'gst' ? 'GST' : 'Non-GST'}
              </DialogTitle>
              <p className={`text-xs ${textSecondary}`}>Pick an invoice and record how much was collected, split across one or more payment sources.</p>
            </DialogHeader>
            <div className="space-y-3 mt-1">
              <div>
                <Label className={textPrimary}>Invoice * (only {gstType === 'gst' ? 'GST' : 'Non-GST'} invoices not fully paid)</Label>
                <select
                  value={selectedInvoiceId}
                  onChange={(e) => {
                    setSelectedInvoiceId(e.target.value);
                    // Autofill balance-due into total
                    const inv = invoices.find((i) => i.invoice_id === e.target.value);
                    if (inv) {
                      const due = (Number(inv.total_amount) || 0) - (Number(inv.paid_amount) || 0);
                      setExpenseTotal(due > 0 ? String(due) : '');
                    }
                  }}
                  className={`w-full h-10 px-3 rounded-md border ${borderColor} ${bgSecondary} ${textPrimary} text-sm`}
                  data-testid="income-invoice-select"
                >
                  <option value="">Select invoice...</option>
                  {invoices.map((inv) => {
                    const total = Number(inv.total_amount) || 0;
                    const paid = Number(inv.paid_amount) || 0;
                    const due = total - paid;
                    const pct = total > 0 ? Math.round((paid / total) * 100) : 0;
                    return (
                      <option key={inv.invoice_id} value={inv.invoice_id}>
                        {inv.invoice_number || inv.invoice_id} • {inv.client_name || '—'} • Total ₹{total.toLocaleString('en-IN')} • Paid {pct}% • Due ₹{due.toLocaleString('en-IN')}
                      </option>
                    );
                  })}
                </select>
                {invoices.length === 0 && (
                  <p className={`text-xs ${textSecondary} mt-1`}>
                    No outstanding {gstType === 'gst' ? 'GST' : 'Non-GST'} invoices. Create one under the Invoice tab first.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className={textPrimary}>Amount to Collect *</Label>
                  <Input type="number" value={expenseTotal} onChange={(e) => setExpenseTotal(e.target.value)} className={bgSecondary} data-testid="income-total-input" />
                </div>
                <div>
                  <Label className={textPrimary}>Date *</Label>
                  <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={bgSecondary} />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <Label className={textPrimary}>Payment Sources *</Label>
                  <span className={`text-xs ${textSecondary}`}>Allocated: <b style={{ color: allocsBalanced ? '#10b981' : '#f59e0b' }}>{fmt(allocSum)}</b> / {fmt(expenseTotalNum)}</span>
                </div>
                <div className="space-y-2">
                  {allocs.map((a, idx) => {
                    const opts = sourceOptions();
                    const currentVal = a.source === 'bank' ? `bank:${a.bank_id}` : a.source;
                    return (
                      <div key={idx} className={`grid grid-cols-12 gap-2 items-center p-2 rounded-lg border ${borderColor} ${bgSecondary}`}>
                        <select
                          value={currentVal}
                          onChange={(e) => {
                            const v = e.target.value;
                            if (v.startsWith('bank:')) updateAlloc(idx, { source: 'bank', bank_id: v.slice(5) });
                            else updateAlloc(idx, { source: v, bank_id: '' });
                          }}
                          className={`col-span-7 h-9 px-2 rounded border ${borderColor} ${bgCard} ${textPrimary} text-sm`}
                          data-testid={`income-alloc-source-${idx}`}
                        >
                          {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                        <Input
                          type="number"
                          value={a.amount}
                          onChange={(e) => updateAlloc(idx, { amount: e.target.value })}
                          placeholder="Amount"
                          className={`col-span-4 ${bgCard}`}
                          data-testid={`income-alloc-amount-${idx}`}
                        />
                        <button
                          type="button"
                          onClick={() => removeAllocRow(idx)}
                          disabled={allocs.length === 1}
                          className={`col-span-1 ${textSecondary} hover:text-[#ef4444] disabled:opacity-30`}
                        >
                          <X className="h-4 w-4 mx-auto" />
                        </button>
                      </div>
                    );
                  })}
                </div>
                <Button variant="outline" size="sm" onClick={addAllocRow} className={`${borderColor} mt-2`}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add another source
                </Button>
              </div>

              <div>
                <Label className={textPrimary}>Notes</Label>
                <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="UTR / cheque # / remarks" className={bgSecondary} />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t mt-3" style={{ borderColor: isDark ? '#27272a' : '#e5e7eb' }}>
              <Button variant="ghost" onClick={() => setModal(null)} className={textSecondary}><X className="h-4 w-4 mr-1" /> Cancel</Button>
              <Button
                onClick={submitIncome}
                disabled={!allocsBalanced || !selectedInvoiceId}
                className="bg-[#10b981] hover:bg-[#059669] text-white disabled:opacity-40"
                data-testid="income-save-btn"
              >Record Income</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Multi-source Expense modal */}
      {modal === 'debit' && (
        <Dialog open={true} onOpenChange={() => setModal(null)}>
          <DialogContent className={`${bgCard} border ${borderColor} ${textPrimary} max-w-2xl`} data-testid="cashbook-add-modal-debit">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-[#ef4444]" />
                Add Expense — {gstType === 'gst' ? 'GST' : 'Non-GST'}
              </DialogTitle>
              <p className={`text-xs ${textSecondary}`}>Split the amount across one or more payment sources. Each source must have enough balance.</p>
            </DialogHeader>
            <div className="space-y-3 mt-1">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className={textPrimary}>Total Amount *</Label>
                  <Input
                    type="number"
                    value={expenseTotal}
                    onChange={(e) => setExpenseTotal(e.target.value)}
                    placeholder="10000"
                    className={bgSecondary}
                    autoFocus
                    readOnly={!!selectedPayslipId}
                    data-testid="expense-total-input"
                  />
                  {selectedPayslipId && (
                    <p className={`text-[10px] ${textSecondary} mt-1`}>Auto-filled from payslip — locked</p>
                  )}
                </div>
                <div>
                  <Label className={textPrimary}>Date *</Label>
                  <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={bgSecondary} />
                </div>
                <div>
                  <Label className={textPrimary}>To (party)</Label>
                  <Input value={form.party} onChange={(e) => setForm({ ...form, party: e.target.value })} placeholder="Vendor" className={bgSecondary} />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <Label className={textPrimary}>Payment Sources *</Label>
                  <span className={`text-xs ${textSecondary}`}>Allocated: <b style={{ color: allocsBalanced ? '#10b981' : '#f59e0b' }}>{fmt(allocSum)}</b> / {fmt(expenseTotalNum)}</span>
                </div>
                <div className="space-y-2">
                  {allocs.map((a, idx) => {
                    const opts = sourceOptions();
                    const currentVal = a.source === 'bank' ? `bank:${a.bank_id}` : a.source;
                    const sel = opts.find((o) => o.value === currentVal);
                    const amt = parseFloat(a.amount) || 0;
                    const over = sel && amt > Number(sel.available) + 0.001;
                    return (
                      <div key={idx} className={`grid grid-cols-12 gap-2 items-center p-2 rounded-lg border ${over ? 'border-[#ef4444]' : borderColor} ${bgSecondary}`}>
                        <select
                          value={currentVal}
                          onChange={(e) => {
                            const v = e.target.value;
                            if (v.startsWith('bank:')) updateAlloc(idx, { source: 'bank', bank_id: v.slice(5) });
                            else updateAlloc(idx, { source: v, bank_id: '' });
                          }}
                          className={`col-span-7 h-9 px-2 rounded border ${borderColor} ${bgCard} ${textPrimary} text-sm`}
                          data-testid={`alloc-source-${idx}`}
                        >
                          {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                        <Input
                          type="number"
                          value={a.amount}
                          onChange={(e) => updateAlloc(idx, { amount: e.target.value })}
                          placeholder="Amount"
                          className={`col-span-4 ${bgCard} ${over ? 'border-[#ef4444]' : ''}`}
                          data-testid={`alloc-amount-${idx}`}
                        />
                        <button
                          type="button"
                          onClick={() => removeAllocRow(idx)}
                          disabled={allocs.length === 1}
                          className={`col-span-1 ${textSecondary} hover:text-[#ef4444] disabled:opacity-30`}
                        >
                          <X className="h-4 w-4 mx-auto" />
                        </button>
                        {over && (
                          <p className="col-span-12 text-[10px] text-[#ef4444] flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" /> Available balance is only ₹{Number(sel.available).toLocaleString('en-IN')}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
                <Button variant="outline" size="sm" onClick={addAllocRow} className={`${borderColor} mt-2`} data-testid="alloc-add-row">
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add another source
                </Button>
              </div>

              {/* Expense Split — Top Category + optional Sub Category */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <Label className={textPrimary}>Expense Category (Budget)</Label>
                  {splitCategories.length === 0 && (
                    <span className={`text-[10px] ${textSecondary}`}>No categories yet — add some in Expense → Expense Split</span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={splitTopId}
                    onChange={(e) => { setSplitTopId(e.target.value); setSplitSubId(''); }}
                    className={`h-9 px-2 rounded border ${borderColor} ${bgSecondary} ${textPrimary} text-sm`}
                    data-testid="expense-split-top-select"
                  >
                    <option value="">— Top Category —</option>
                    {splitCategories.map((c) => (
                      <option key={c.category_id} value={c.category_id}>
                        {c.name} ({c.percent}%)
                      </option>
                    ))}
                  </select>
                  <select
                    value={splitSubId}
                    onChange={(e) => setSplitSubId(e.target.value)}
                    disabled={!splitTopId}
                    className={`h-9 px-2 rounded border ${borderColor} ${bgSecondary} ${textPrimary} text-sm disabled:opacity-50`}
                    data-testid="expense-split-sub-select"
                  >
                    <option value="">
                      {splitTopId ? '— Sub Category (optional) —' : 'Pick top first'}
                    </option>
                    {(splitCategories.find((c) => c.category_id === splitTopId)?.sub_categories || []).map((s) => (
                      <option key={s.category_id} value={s.category_id}>
                        {s.name} ({s.percent}%)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Payroll Payslip picker — only when Sub Category resolves to "Payroll" */}
              {isPayrollMode && (
                <div className={`p-3 rounded-lg border ${borderColor} ${bgSecondary}`} data-testid="payroll-payslip-picker">
                  <div className="flex items-center justify-between mb-2">
                    <Label className={textPrimary}>Payslip to pay *</Label>
                    <span className={`text-[10px] ${textSecondary}`}>
                      {payablePayslips.length === 0 ? 'No CEO-approved payslips waiting' : `${payablePayslips.length} approved · unpaid`}
                    </span>
                  </div>
                  <select
                    value={selectedPayslipId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setSelectedPayslipId(id);
                      const p = payablePayslips.find((x) => x.payslip_id === id);
                      if (p) {
                        const net = String(Number(p.net_salary) || 0);
                        setExpenseTotal(net);
                        // Reset allocs to a single row covering full net so the user
                        // just needs to confirm the source.
                        setAllocs([{ source: 'cash', bank_id: '', amount: net }]);
                        setForm((f) => ({ ...f, party: p.employee_name || '' }));
                      }
                    }}
                    className={`w-full h-9 px-2 rounded border ${borderColor} ${bgCard} ${textPrimary} text-sm`}
                    data-testid="payroll-payslip-select"
                  >
                    <option value="">— Pick employee / month —</option>
                    {payablePayslips.map((p) => {
                      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                      const period = `${months[(p.month || 1) - 1]} ${p.year}`;
                      const net = Number(p.net_salary || 0).toLocaleString('en-IN');
                      return (
                        <option key={p.payslip_id} value={p.payslip_id}>
                          {p.employee_name} · {period} · Net ₹{net}
                        </option>
                      );
                    })}
                  </select>
                  {selectedPayslip && (
                    <p className={`text-[11px] mt-2 ${textSecondary}`}>
                      Net salary locked at <b className="text-[#10b981]">₹{Number(selectedPayslip.net_salary || 0).toLocaleString('en-IN')}</b>. Saving this expense will mark the payslip as <b>PAID</b>.
                    </p>
                  )}
                  {payablePayslips.length === 0 && (
                    <p className={`text-[11px] mt-2 ${textSecondary}`}>
                      No payslips are currently CEO-approved & unpaid. Once HR sends a payslip for CEO review and the CEO approves it in Operations → Approval → HR, it will appear here.
                    </p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className={textPrimary}>Label / Description</Label>
                  <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Auto from selection if empty" className={bgSecondary} />
                </div>
                <div>
                  <Label className={textPrimary}>Notes</Label>
                  <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="UTR / cheque # / remarks" className={bgSecondary} />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t mt-3" style={{ borderColor: isDark ? '#27272a' : '#e5e7eb' }}>
              <Button variant="ghost" onClick={() => setModal(null)} className={textSecondary}><X className="h-4 w-4 mr-1" /> Cancel</Button>
              <Button
                onClick={submitExpense}
                disabled={!allocsBalanced}
                className="bg-[#ef4444] hover:bg-[#dc2626] text-white disabled:opacity-40"
                data-testid="expense-save-btn"
              >Record Expense</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Expense group summary modal */}
      {groupView && (
        <Dialog open={true} onOpenChange={() => setGroupView(null)}>
          <DialogContent className={`${bgCard} border ${borderColor} ${textPrimary} max-w-md`} data-testid="expense-group-modal">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5 text-[#6366f1]" /> Payment Summary
              </DialogTitle>
              <p className={`text-xs ${textSecondary}`}>Total <b className={textPrimary}>{fmt(groupView.total)}</b> split across {groupView.entries.length} source{groupView.entries.length === 1 ? '' : 's'}.</p>
            </DialogHeader>
            <div className="space-y-2 mt-2">
              {groupView.entries.map((e) => (
                <div key={e.entry_id} className={`flex items-center justify-between p-2.5 rounded ${bgSecondary} border ${borderColor}`}>
                  <div>
                    <p className={`text-sm font-medium ${textPrimary} capitalize`}>{e.payment_mode}{e.bank_label ? ` · ${e.bank_label}` : ''}</p>
                    <p className={`text-[10px] ${textSecondary}`}>{fmtDate(e.date)}{e.to ? ` • To: ${e.to}` : ''}{e.category ? ` • ${e.category}` : ''}</p>
                  </div>
                  <span className="font-semibold text-[#ef4444]">{fmt(e.amount)}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-end pt-3 border-t mt-3" style={{ borderColor: isDark ? '#27272a' : '#e5e7eb' }}>
              <Button onClick={() => setGroupView(null)} variant="outline" className={borderColor}>Close</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default CashbookSplit;
