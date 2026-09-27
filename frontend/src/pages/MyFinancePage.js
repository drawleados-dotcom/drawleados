import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Layout from '../components/Layout';
import { useTheme } from '../contexts/ThemeContext';
import api from '../utils/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import {
  Wallet, Plus, Pencil, Trash2, TrendingUp, TrendingDown, AlertTriangle,
  Landmark, ChevronDown, ChevronRight, CheckCircle2, X,
} from 'lucide-react';
import { toast } from 'sonner';

const TABS = [
  { key: 'dashboard', label: 'Dashboard', icon: Wallet },
  { key: 'income', label: 'Income', icon: TrendingUp },
  { key: 'expense', label: 'Expense', icon: TrendingDown },
  { key: 'debts', label: 'Debt Management', icon: Landmark },
];

const INCOME_SOURCES = [
  { value: 'salary', label: 'Salary' },
  { value: 'debt', label: 'Debt' },
  { value: 'other', label: 'Other' },
];

const todayISO = () => new Date().toISOString().slice(0, 10);
const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const fmtDate = (iso) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
const monthLabel = (period) => {
  if (!period) return '—';
  const [y, m] = period.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
};

const STATUS_META = {
  paid: { label: 'Paid', cls: 'bg-[#10b981]/15 text-[#10b981] border-[#10b981]/30' },
  partial: { label: 'Partial', cls: 'bg-[#f59e0b]/15 text-[#f59e0b] border-[#f59e0b]/30' },
  pending: { label: 'Pending', cls: 'bg-slate-500/15 text-slate-400 border-slate-500/30' },
  overdue: { label: 'Overdue', cls: 'bg-red-500/15 text-red-500 border-red-500/30' },
};

const emptyIncomeForm = () => ({ source_type: 'salary', amount: '', date: todayISO(), notes: '' });
const emptyExpenseForm = () => ({ category: 'General', amount: '', date: todayISO(), notes: '' });
const emptyDebtForm = () => ({
  name: '', debt_type: 'loan', lender_name: '', principal_amount: '', disbursed_amount: '',
  monthly_amount: '', start_date: todayISO(), end_date: '', due_day: '', notes: '', log_as_income: true,
});

export default function MyFinancePage() {
  const { isDark } = useTheme();
  const bgCard = isDark ? 'bg-[#18181b]' : 'bg-white';
  const bgSecondary = isDark ? 'bg-[#27272a]' : 'bg-gray-100';
  const textPrimary = isDark ? 'text-[#fafafa]' : 'text-gray-900';
  const textSecondary = isDark ? 'text-[#a1a1aa]' : 'text-gray-600';
  const borderColor = isDark ? 'border-[#27272a]' : 'border-gray-200';
  const theme = { bgCard, bgSecondary, textPrimary, textSecondary, borderColor };

  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [incomes, setIncomes] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [debts, setDebts] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, i, e, d] = await Promise.all([
        api.get('/my-finance/summary'),
        api.get('/my-finance/incomes'),
        api.get('/my-finance/expenses'),
        api.get('/my-finance/debts'),
      ]);
      setSummary(s.data);
      setIncomes(i.data || []);
      setExpenses(e.data || []);
      setDebts(d.data || []);
    } catch (error) {
      toast.error('Failed to load My Finance');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  // ---- Income ----
  const [showIncomeModal, setShowIncomeModal] = useState(false);
  const [editingIncomeId, setEditingIncomeId] = useState(null);
  const [incomeForm, setIncomeForm] = useState(emptyIncomeForm());
  const [incomeSaving, setIncomeSaving] = useState(false);
  const openAddIncome = () => { setEditingIncomeId(null); setIncomeForm(emptyIncomeForm()); setShowIncomeModal(true); };
  const openEditIncome = (inc) => {
    setEditingIncomeId(inc.income_id);
    setIncomeForm({ source_type: inc.source_type, amount: String(inc.amount), date: inc.date, notes: inc.notes || '' });
    setShowIncomeModal(true);
  };
  const saveIncome = async () => {
    const amount = Number(incomeForm.amount);
    if (!(amount > 0)) { toast.error('Enter an amount greater than 0'); return; }
    if (!incomeForm.date) { toast.error('Pick a date'); return; }
    setIncomeSaving(true);
    try {
      const payload = { source_type: incomeForm.source_type, amount, date: incomeForm.date, notes: incomeForm.notes };
      if (editingIncomeId) { await api.put(`/my-finance/incomes/${editingIncomeId}`, payload); toast.success('Income updated'); }
      else { await api.post('/my-finance/incomes', payload); toast.success('Income added'); }
      setShowIncomeModal(false);
      load();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save income');
    } finally {
      setIncomeSaving(false);
    }
  };
  const deleteIncome = async (id) => {
    if (!window.confirm('Delete this income entry?')) return;
    try { await api.delete(`/my-finance/incomes/${id}`); toast.success('Income deleted'); load(); }
    catch (error) { toast.error('Failed to delete income'); }
  };

  // ---- Expense ----
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState(null);
  const [expenseForm, setExpenseForm] = useState(emptyExpenseForm());
  const [expenseSaving, setExpenseSaving] = useState(false);
  const openAddExpense = () => { setEditingExpenseId(null); setExpenseForm(emptyExpenseForm()); setShowExpenseModal(true); };
  const openEditExpense = (exp) => {
    setEditingExpenseId(exp.expense_id);
    setExpenseForm({ category: exp.category, amount: String(exp.amount), date: exp.date, notes: exp.notes || '' });
    setShowExpenseModal(true);
  };
  const saveExpense = async () => {
    const amount = Number(expenseForm.amount);
    if (!(amount > 0)) { toast.error('Enter an amount greater than 0'); return; }
    if (!expenseForm.date) { toast.error('Pick a date'); return; }
    setExpenseSaving(true);
    try {
      const payload = { category: expenseForm.category, amount, date: expenseForm.date, notes: expenseForm.notes };
      if (editingExpenseId) { await api.put(`/my-finance/expenses/${editingExpenseId}`, payload); toast.success('Expense updated'); }
      else { await api.post('/my-finance/expenses', payload); toast.success('Expense added'); }
      setShowExpenseModal(false);
      load();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save expense');
    } finally {
      setExpenseSaving(false);
    }
  };
  const deleteExpense = async (id) => {
    if (!window.confirm('Delete this expense entry?')) return;
    try { await api.delete(`/my-finance/expenses/${id}`); toast.success('Expense deleted'); load(); }
    catch (error) { toast.error('Failed to delete expense'); }
  };

  // ---- Debts ----
  const [showDebtModal, setShowDebtModal] = useState(false);
  const [debtForm, setDebtForm] = useState(emptyDebtForm());
  const [debtSaving, setDebtSaving] = useState(false);
  const [openDebtId, setOpenDebtId] = useState(null); // expanded schedule
  const [debtDetail, setDebtDetail] = useState(null); // debt currently in the payment popup

  const rates = useMemo(() => {
    const p = Number(debtForm.principal_amount), m = Number(debtForm.monthly_amount);
    if (debtForm.debt_type !== 'loan' || !(p > 0) || !(m > 0)) return null;
    const d = Number(debtForm.disbursed_amount) || p;
    const nominal = (m / p) * 100;
    const effective = (m / d) * 100;
    return { nominal, effective, differs: d !== p };
  }, [debtForm.debt_type, debtForm.principal_amount, debtForm.disbursed_amount, debtForm.monthly_amount]);

  const openAddDebt = () => { setDebtForm(emptyDebtForm()); setShowDebtModal(true); };
  const saveDebt = async () => {
    if (!debtForm.name.trim()) { toast.error('Name is required'); return; }
    const principal = Number(debtForm.principal_amount);
    const monthly = Number(debtForm.monthly_amount);
    if (!(principal > 0)) { toast.error('Enter the principal / total amount'); return; }
    if (!(monthly > 0)) { toast.error('Enter the monthly amount'); return; }
    if (!debtForm.start_date) { toast.error('Pick a start date'); return; }
    setDebtSaving(true);
    try {
      await api.post('/my-finance/debts', {
        name: debtForm.name.trim(),
        debt_type: debtForm.debt_type,
        lender_name: debtForm.lender_name,
        principal_amount: principal,
        disbursed_amount: debtForm.disbursed_amount ? Number(debtForm.disbursed_amount) : null,
        monthly_amount: monthly,
        start_date: debtForm.start_date,
        end_date: debtForm.end_date || null,
        due_day: debtForm.due_day ? Number(debtForm.due_day) : null,
        notes: debtForm.notes,
        log_as_income: debtForm.log_as_income,
      });
      toast.success('Debt added');
      setShowDebtModal(false);
      load();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add debt');
    } finally {
      setDebtSaving(false);
    }
  };
  const deleteDebt = async (id) => {
    if (!window.confirm('Delete this debt and its whole payment history? This can\'t be undone.')) return;
    try { await api.delete(`/my-finance/debts/${id}`); toast.success('Debt deleted'); load(); }
    catch (error) { toast.error('Failed to delete debt'); }
  };
  const closeDebt = async (id) => {
    try { await api.put(`/my-finance/debts/${id}`, { status: 'closed' }); toast.success('Debt marked closed'); load(); }
    catch (error) { toast.error('Failed to update debt'); }
  };
  const reopenDebt = async (id) => {
    try { await api.put(`/my-finance/debts/${id}`, { status: 'active' }); toast.success('Debt reopened'); load(); }
    catch (error) { toast.error('Failed to update debt'); }
  };

  const [payDraft, setPayDraft] = useState({}); // period -> amount string, for the detail popup
  const [paySaving, setPaySaving] = useState(null); // period being submitted
  const payPeriod = async (debtId, period, amount) => {
    const amt = Number(amount);
    if (!(amt > 0)) { toast.error('Enter an amount greater than 0'); return; }
    setPaySaving(period);
    try {
      const res = await api.post(`/my-finance/debts/${debtId}/payments`, { period, amount: amt });
      setDebtDetail(res.data);
      setDebts((prev) => prev.map((d) => (d.debt_id === debtId ? res.data : d)));
      setPayDraft((prev) => ({ ...prev, [period]: '' }));
      toast.success('Payment recorded');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to record payment');
    } finally {
      setPaySaving(null);
    }
  };
  const undoPayment = async (debtId, paymentId) => {
    if (!window.confirm('Remove this payment?')) return;
    try {
      const res = await api.delete(`/my-finance/debts/${debtId}/payments/${paymentId}`);
      setDebtDetail(res.data);
      setDebts((prev) => prev.map((d) => (d.debt_id === debtId ? res.data : d)));
      toast.success('Payment removed');
    } catch (error) {
      toast.error('Failed to remove payment');
    }
  };

  const inputCls = `${bgSecondary} border ${borderColor} ${textPrimary}`;

  return (
    <Layout>
      <div className="space-y-6" data-testid="my-finance-page">
        <div>
          <h1 className={`text-3xl font-bold flex items-center gap-2 ${textPrimary}`} style={{ fontFamily: 'Plus Jakarta Sans' }}>
            <Wallet className="h-7 w-7 text-[#6366f1]" /> My Finance
          </h1>
          <p className={`text-sm ${textSecondary} mt-1`}>Your own income, expenses, and debt/EMI tracker — private to you.</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                data-testid={`my-finance-tab-${tab.key}`}
                className={`px-4 py-2 text-sm font-medium rounded-lg flex items-center gap-2 transition-all whitespace-nowrap border ${
                  isActive ? 'bg-[#6366f1] text-white border-transparent shadow-sm' : `${bgCard} ${textSecondary} ${borderColor} hover:border-[#6366f1]/40`
                }`}
              >
                <Icon className="h-4 w-4" /> {tab.label}
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className={`text-center py-12 ${textSecondary}`}>Loading…</div>
        ) : (
          <>
            {activeTab === 'dashboard' && summary && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  {[
                    { l: 'Total Income', v: money(summary.total_income), c: 'text-[#10b981]' },
                    { l: 'Total Expense', v: money(summary.total_expense), c: 'text-red-500' },
                    { l: 'Net', v: money(summary.net), c: summary.net >= 0 ? 'text-[#10b981]' : 'text-red-500' },
                    { l: 'Active Debts', v: summary.active_debts, c: textPrimary },
                    { l: 'Total Outstanding', v: money(summary.total_outstanding), c: 'text-[#f59e0b]' },
                    { l: 'Overdue', v: summary.overdue_debts, c: summary.overdue_debts > 0 ? 'text-red-500' : textPrimary },
                  ].map((t) => (
                    <div key={t.l} className={`rounded-lg border ${borderColor} ${bgCard} p-3`} data-testid={`my-finance-summary-${t.l.toLowerCase().replace(/[^a-z]+/g, '-')}`}>
                      <p className={`text-xs ${textSecondary}`}>{t.l}</p>
                      <p className={`text-xl font-bold ${t.c}`}>{t.v}</p>
                    </div>
                  ))}
                </div>

                <div className={`${bgCard} border ${borderColor} rounded-xl overflow-hidden`}>
                  <p className={`${bgSecondary} px-4 py-2 text-xs font-semibold uppercase ${textSecondary}`}>Due this month</p>
                  {summary.due_this_month.length === 0 ? (
                    <p className={`p-6 text-center text-sm ${textSecondary}`}>Nothing due this month.</p>
                  ) : (
                    <div className={`divide-y ${borderColor}`}>
                      {summary.due_this_month.map((d) => {
                        const meta = STATUS_META[d.status];
                        return (
                          <div key={d.debt_id} className="px-4 py-3 flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <p className={`text-sm font-medium ${textPrimary}`}>{d.name}</p>
                              <p className={`text-xs ${textSecondary}`}>Due {fmtDate(d.due_date)}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`text-sm ${textPrimary}`}>{money(d.amount_due)}{d.amount_paid > 0 && ` (${money(d.amount_paid)} paid)`}</span>
                              <Badge className={`border ${meta.cls}`}>{meta.label}</Badge>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'income' && (
              <div className="space-y-3">
                <div className="flex justify-end">
                  <Button onClick={openAddIncome} className="bg-[#6366f1] hover:bg-[#4f46e5] text-white" data-testid="my-finance-add-income-btn">
                    <Plus className="h-4 w-4 mr-2" /> Add Income
                  </Button>
                </div>
                <div className={`${bgCard} border ${borderColor} rounded-xl overflow-hidden`}>
                  <table className="w-full text-sm">
                    <thead className={bgSecondary}>
                      <tr>
                        <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Date</th>
                        <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Source</th>
                        <th className={`px-4 py-3 text-right font-medium ${textSecondary}`}>Amount</th>
                        <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Notes</th>
                        <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Actions</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${borderColor}`}>
                      {incomes.length === 0 ? (
                        <tr><td colSpan={5} className={`px-4 py-8 text-center ${textSecondary}`}>No income entries yet — click "Add Income".</td></tr>
                      ) : incomes.map((inc) => (
                        <tr key={inc.income_id} className={`${bgCard} hover:${bgSecondary} transition-colors`}>
                          <td className={`px-4 py-3 ${textPrimary}`}>{fmtDate(inc.date)}</td>
                          <td className="px-4 py-3">
                            <Badge className="bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/30 capitalize">{inc.source_type}</Badge>
                          </td>
                          <td className={`px-4 py-3 text-right font-medium ${textPrimary}`}>{money(inc.amount)}</td>
                          <td className={`px-4 py-3 ${textSecondary}`}>{inc.notes || '—'}</td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1">
                              <Button variant="ghost" size="sm" onClick={() => openEditIncome(inc)} data-testid={`my-finance-income-edit-${inc.income_id}`}><Pencil className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="sm" className="text-red-500" onClick={() => deleteIncome(inc.income_id)} data-testid={`my-finance-income-delete-${inc.income_id}`}><Trash2 className="h-4 w-4" /></Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'expense' && (
              <div className="space-y-3">
                <div className="flex justify-end">
                  <Button onClick={openAddExpense} className="bg-[#6366f1] hover:bg-[#4f46e5] text-white" data-testid="my-finance-add-expense-btn">
                    <Plus className="h-4 w-4 mr-2" /> Add Expense
                  </Button>
                </div>
                <div className={`${bgCard} border ${borderColor} rounded-xl overflow-hidden`}>
                  <table className="w-full text-sm">
                    <thead className={bgSecondary}>
                      <tr>
                        <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Date</th>
                        <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Category</th>
                        <th className={`px-4 py-3 text-right font-medium ${textSecondary}`}>Amount</th>
                        <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Notes</th>
                        <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Actions</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${borderColor}`}>
                      {expenses.length === 0 ? (
                        <tr><td colSpan={5} className={`px-4 py-8 text-center ${textSecondary}`}>No expense entries yet — click "Add Expense".</td></tr>
                      ) : expenses.map((exp) => (
                        <tr key={exp.expense_id} className={`${bgCard} hover:${bgSecondary} transition-colors`}>
                          <td className={`px-4 py-3 ${textPrimary}`}>{fmtDate(exp.date)}</td>
                          <td className={`px-4 py-3 ${textSecondary}`}>{exp.category}</td>
                          <td className="px-4 py-3 text-right font-medium text-red-500">{money(exp.amount)}</td>
                          <td className={`px-4 py-3 ${textSecondary}`}>{exp.notes || '—'}</td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1">
                              <Button variant="ghost" size="sm" onClick={() => openEditExpense(exp)} data-testid={`my-finance-expense-edit-${exp.expense_id}`}><Pencil className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="sm" className="text-red-500" onClick={() => deleteExpense(exp.expense_id)} data-testid={`my-finance-expense-delete-${exp.expense_id}`}><Trash2 className="h-4 w-4" /></Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'debts' && (
              <div className="space-y-3">
                <div className="flex justify-end">
                  <Button onClick={openAddDebt} className="bg-[#6366f1] hover:bg-[#4f46e5] text-white" data-testid="my-finance-add-debt-btn">
                    <Plus className="h-4 w-4 mr-2" /> Add Debt / EMI / Chit
                  </Button>
                </div>
                {debts.length === 0 ? (
                  <div className={`${bgCard} border ${borderColor} rounded-xl p-8 text-center text-sm ${textSecondary}`}>
                    No debts yet — click "Add Debt / EMI / Chit" to start tracking one.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {debts.map((d) => {
                      const open = openDebtId === d.debt_id;
                      const closed = d.status === 'closed';
                      return (
                        <div key={d.debt_id} className={`${bgCard} border ${borderColor} rounded-xl overflow-hidden ${closed ? 'opacity-70' : ''}`} data-testid={`my-finance-debt-${d.debt_id}`}>
                          <button type="button" onClick={() => setOpenDebtId(open ? null : d.debt_id)} className="w-full text-left px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-2 min-w-0">
                              {open ? <ChevronDown className={`h-4 w-4 shrink-0 ${textSecondary}`} /> : <ChevronRight className={`h-4 w-4 shrink-0 ${textSecondary}`} />}
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className={`text-sm font-semibold ${textPrimary} truncate`}>{d.name}</p>
                                  <Badge className={d.debt_type === 'chit' ? 'bg-[#8b5cf6]/15 text-[#8b5cf6] border border-[#8b5cf6]/30' : 'bg-[#3b82f6]/15 text-[#3b82f6] border border-[#3b82f6]/30'}>
                                    {d.debt_type === 'chit' ? 'Chit' : 'Loan'}
                                  </Badge>
                                  {closed && <Badge className="bg-slate-500/15 text-slate-400 border border-slate-500/30">Closed</Badge>}
                                  {!closed && d.summary.overdue_count > 0 && (
                                    <Badge className="bg-red-500/15 text-red-500 border border-red-500/30 flex items-center gap-1">
                                      <AlertTriangle className="h-3 w-3" /> {d.summary.overdue_count} overdue
                                    </Badge>
                                  )}
                                </div>
                                <p className={`text-xs ${textSecondary}`}>
                                  {d.lender_name && `${d.lender_name} · `}{money(d.monthly_amount)}/month
                                  {d.nominal_monthly_rate_pct != null && ` · ${d.nominal_monthly_rate_pct}%/mo nominal`}
                                  {d.effective_monthly_rate_pct != null && d.effective_monthly_rate_pct !== d.nominal_monthly_rate_pct && ` (${d.effective_monthly_rate_pct}% effective)`}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className={`text-sm font-semibold ${textPrimary}`}>{money(d.summary.outstanding)} outstanding</p>
                              <p className={`text-xs ${textSecondary}`}>
                                {d.summary.next_due ? `Next: ${monthLabel(d.summary.next_due.period)} · ${money(d.summary.next_due.balance)}` : 'Fully paid up'}
                              </p>
                            </div>
                          </button>
                          {open && (
                            <div className={`border-t ${borderColor} p-4 space-y-3`}>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                                <div><p className={textSecondary}>Principal</p><p className={`font-medium ${textPrimary}`}>{money(d.principal_amount)}</p></div>
                                <div><p className={textSecondary}>Disbursed</p><p className={`font-medium ${textPrimary}`}>{money(d.disbursed_amount)}</p></div>
                                <div><p className={textSecondary}>Start → End</p><p className={`font-medium ${textPrimary}`}>{fmtDate(d.start_date)} → {d.end_date ? fmtDate(d.end_date) : 'Ongoing'}</p></div>
                                <div><p className={textSecondary}>Total paid</p><p className="font-medium text-[#10b981]">{money(d.summary.total_paid)}</p></div>
                              </div>
                              {d.notes && <p className={`text-xs ${textSecondary} italic`}>{d.notes}</p>}
                              <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                  <thead className={bgSecondary}>
                                    <tr>
                                      <th className={`px-3 py-2 text-left font-medium ${textSecondary}`}>Month</th>
                                      <th className={`px-3 py-2 text-left font-medium ${textSecondary}`}>Due Date</th>
                                      <th className={`px-3 py-2 text-right font-medium ${textSecondary}`}>Due</th>
                                      <th className={`px-3 py-2 text-right font-medium ${textSecondary}`}>Paid</th>
                                      <th className={`px-3 py-2 text-left font-medium ${textSecondary}`}>Status</th>
                                      <th className={`px-3 py-2 text-left font-medium ${textSecondary}`}>Pay</th>
                                    </tr>
                                  </thead>
                                  <tbody className={`divide-y ${borderColor}`}>
                                    {d.schedule.map((row) => {
                                      const meta = STATUS_META[row.status];
                                      const settled = row.status === 'paid';
                                      return (
                                        <tr key={row.period}>
                                          <td className={`px-3 py-2 ${textPrimary}`}>{monthLabel(row.period)}</td>
                                          <td className={`px-3 py-2 ${textSecondary}`}>{fmtDate(row.due_date)}</td>
                                          <td className={`px-3 py-2 text-right ${textPrimary}`}>{money(row.amount_due)}</td>
                                          <td className={`px-3 py-2 text-right ${textPrimary}`}>{money(row.amount_paid)}</td>
                                          <td className="px-3 py-2"><Badge className={`border ${meta.cls}`}>{meta.label}</Badge></td>
                                          <td className="px-3 py-2">
                                            {settled ? (
                                              row.payments.length > 0 && <Button variant="ghost" size="sm" onClick={() => setDebtDetail(d)} data-testid={`my-finance-debt-history-${d.debt_id}-${row.period}`}>View</Button>
                                            ) : !closed ? (
                                              <div className="flex items-center gap-1">
                                                <Input
                                                  type="number" min="0" step="any" placeholder={String(row.balance)}
                                                  value={payDraft[`${d.debt_id}:${row.period}`] ?? ''}
                                                  onChange={(e) => setPayDraft((prev) => ({ ...prev, [`${d.debt_id}:${row.period}`]: e.target.value }))}
                                                  className={`h-7 w-24 text-xs ${bgSecondary} border ${borderColor}`}
                                                  data-testid={`my-finance-pay-input-${d.debt_id}-${row.period}`}
                                                />
                                                <Button
                                                  size="sm" className="h-7 bg-[#10b981] hover:bg-[#0d9668] text-white"
                                                  disabled={paySaving === row.period}
                                                  onClick={() => payPeriod(d.debt_id, row.period, payDraft[`${d.debt_id}:${row.period}`] || row.balance)}
                                                  data-testid={`my-finance-pay-btn-${d.debt_id}-${row.period}`}
                                                >
                                                  {paySaving === row.period ? '…' : 'Pay'}
                                                </Button>
                                                <Button
                                                  variant="outline" size="sm" className="h-7"
                                                  disabled={paySaving === row.period}
                                                  onClick={() => payPeriod(d.debt_id, row.period, row.balance)}
                                                  title="Pay the full amount due"
                                                  data-testid={`my-finance-pay-full-${d.debt_id}-${row.period}`}
                                                >
                                                  Full
                                                </Button>
                                              </div>
                                            ) : '—'}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                              <div className="flex justify-end gap-2 pt-1">
                                {closed ? (
                                  <Button variant="outline" size="sm" onClick={() => reopenDebt(d.debt_id)}>Reopen</Button>
                                ) : (
                                  <Button variant="outline" size="sm" onClick={() => closeDebt(d.debt_id)} data-testid={`my-finance-debt-close-${d.debt_id}`}>
                                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Mark Closed
                                  </Button>
                                )}
                                <Button variant="ghost" size="sm" className="text-red-500" onClick={() => deleteDebt(d.debt_id)} data-testid={`my-finance-debt-delete-${d.debt_id}`}>
                                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Add Income */}
        <Dialog open={showIncomeModal} onOpenChange={setShowIncomeModal}>
          <DialogContent className={`${bgCard} max-w-md`}>
            <DialogHeader><DialogTitle className={textPrimary}>{editingIncomeId ? 'Edit Income' : 'Add Income'}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className={textPrimary}>Source</Label>
                <Select value={incomeForm.source_type} onValueChange={(v) => setIncomeForm({ ...incomeForm, source_type: v })}>
                  <SelectTrigger className={inputCls}><SelectValue /></SelectTrigger>
                  <SelectContent>{INCOME_SOURCES.map((s) => (<SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>))}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className={textPrimary}>Amount (₹)</Label>
                <Input type="number" min="0" step="any" value={incomeForm.amount} onChange={(e) => setIncomeForm({ ...incomeForm, amount: e.target.value })} className={inputCls} data-testid="my-finance-income-amount-input" />
              </div>
              <div>
                <Label className={textPrimary}>Date</Label>
                <Input type="date" value={incomeForm.date} onChange={(e) => setIncomeForm({ ...incomeForm, date: e.target.value })} className={inputCls} />
              </div>
              <div>
                <Label className={textPrimary}>Notes</Label>
                <Textarea value={incomeForm.notes} onChange={(e) => setIncomeForm({ ...incomeForm, notes: e.target.value })} rows={2} className={inputCls} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setShowIncomeModal(false)}>Cancel</Button>
              <Button onClick={saveIncome} disabled={incomeSaving} className="bg-[#6366f1] hover:bg-[#4f46e5]" data-testid="my-finance-income-save-btn">
                {incomeSaving ? 'Saving…' : editingIncomeId ? 'Save Changes' : 'Add Income'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Expense */}
        <Dialog open={showExpenseModal} onOpenChange={setShowExpenseModal}>
          <DialogContent className={`${bgCard} max-w-md`}>
            <DialogHeader><DialogTitle className={textPrimary}>{editingExpenseId ? 'Edit Expense' : 'Add Expense'}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className={textPrimary}>Category</Label>
                <Input value={expenseForm.category} onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })} className={inputCls} placeholder="e.g. Food, Rent, Travel" />
              </div>
              <div>
                <Label className={textPrimary}>Amount (₹)</Label>
                <Input type="number" min="0" step="any" value={expenseForm.amount} onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })} className={inputCls} data-testid="my-finance-expense-amount-input" />
              </div>
              <div>
                <Label className={textPrimary}>Date</Label>
                <Input type="date" value={expenseForm.date} onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })} className={inputCls} />
              </div>
              <div>
                <Label className={textPrimary}>Notes</Label>
                <Textarea value={expenseForm.notes} onChange={(e) => setExpenseForm({ ...expenseForm, notes: e.target.value })} rows={2} className={inputCls} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setShowExpenseModal(false)}>Cancel</Button>
              <Button onClick={saveExpense} disabled={expenseSaving} className="bg-[#6366f1] hover:bg-[#4f46e5]" data-testid="my-finance-expense-save-btn">
                {expenseSaving ? 'Saving…' : editingExpenseId ? 'Save Changes' : 'Add Expense'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Debt */}
        <Dialog open={showDebtModal} onOpenChange={setShowDebtModal}>
          <DialogContent className={`${bgCard} max-w-lg max-h-[85vh] overflow-y-auto`}>
            <DialogHeader><DialogTitle className={textPrimary}>Add Debt / EMI / Chit</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label className={textPrimary}>Name *</Label>
                <Input value={debtForm.name} onChange={(e) => setDebtForm({ ...debtForm, name: e.target.value })} className={inputCls} placeholder="e.g. Personal loan from Ramesh" autoFocus data-testid="my-finance-debt-name-input" />
              </div>
              <div>
                <Label className={textPrimary}>Type</Label>
                <Select value={debtForm.debt_type} onValueChange={(v) => setDebtForm({ ...debtForm, debt_type: v })}>
                  <SelectTrigger className={inputCls}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="loan">Loan (interest-based)</SelectItem>
                    <SelectItem value="chit">Chit</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className={textPrimary}>Lender / Chit Name</Label>
                <Input value={debtForm.lender_name} onChange={(e) => setDebtForm({ ...debtForm, lender_name: e.target.value })} className={inputCls} />
              </div>
              <div>
                <Label className={textPrimary}>{debtForm.debt_type === 'chit' ? 'Total Value *' : 'Principal Amount *'}</Label>
                <Input type="number" min="0" step="any" value={debtForm.principal_amount} onChange={(e) => setDebtForm({ ...debtForm, principal_amount: e.target.value })} className={inputCls} placeholder="2,00,000" data-testid="my-finance-debt-principal-input" />
              </div>
              <div>
                <Label className={textPrimary}>Amount Actually Received</Label>
                <Input type="number" min="0" step="any" value={debtForm.disbursed_amount} onChange={(e) => setDebtForm({ ...debtForm, disbursed_amount: e.target.value })} className={inputCls} placeholder="Defaults to the amount above" data-testid="my-finance-debt-disbursed-input" />
              </div>
              <div>
                <Label className={textPrimary}>{debtForm.debt_type === 'chit' ? 'Monthly Contribution *' : 'Monthly Interest *'}</Label>
                <Input type="number" min="0" step="any" value={debtForm.monthly_amount} onChange={(e) => setDebtForm({ ...debtForm, monthly_amount: e.target.value })} className={inputCls} placeholder="6,000" data-testid="my-finance-debt-monthly-input" />
              </div>
              <div>
                <Label className={textPrimary}>Due Day of Month</Label>
                <Input type="number" min="1" max="31" value={debtForm.due_day} onChange={(e) => setDebtForm({ ...debtForm, due_day: e.target.value })} className={inputCls} placeholder="Defaults to start date's day" />
              </div>
              <div>
                <Label className={textPrimary}>Start Date *</Label>
                <Input type="date" value={debtForm.start_date} onChange={(e) => setDebtForm({ ...debtForm, start_date: e.target.value })} className={inputCls} />
              </div>
              <div>
                <Label className={textPrimary}>End Date</Label>
                <Input type="date" value={debtForm.end_date} onChange={(e) => setDebtForm({ ...debtForm, end_date: e.target.value })} className={inputCls} placeholder="Leave blank if ongoing" />
              </div>
              <div className="col-span-2">
                <Label className={textPrimary}>Notes</Label>
                <Textarea value={debtForm.notes} onChange={(e) => setDebtForm({ ...debtForm, notes: e.target.value })} rows={2} className={inputCls} />
              </div>
              {rates && (
                <div className={`col-span-2 rounded-lg border ${borderColor} ${bgSecondary} p-3 text-xs ${textSecondary} space-y-1`} data-testid="my-finance-debt-rate-preview">
                  <p className={`font-medium ${textPrimary}`}>Interest rate (calculated automatically)</p>
                  <p>Nominal (on the stated amount): <span className={textPrimary}>{rates.nominal.toFixed(2)}%/month · {(rates.nominal * 12).toFixed(2)}%/year</span></p>
                  {rates.differs && (
                    <p>Effective (on what you actually received): <span className={textPrimary}>{rates.effective.toFixed(2)}%/month · {(rates.effective * 12).toFixed(2)}%/year</span></p>
                  )}
                </div>
              )}
              <label className="col-span-2 flex items-center gap-2 text-sm">
                <input type="checkbox" checked={debtForm.log_as_income} onChange={(e) => setDebtForm({ ...debtForm, log_as_income: e.target.checked })} />
                <span className={textSecondary}>Also record the received amount as an Income entry</span>
              </label>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setShowDebtModal(false)}>Cancel</Button>
              <Button onClick={saveDebt} disabled={debtSaving} className="bg-[#6366f1] hover:bg-[#4f46e5]" data-testid="my-finance-debt-save-btn">
                {debtSaving ? 'Saving…' : 'Add Debt'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Payment history popup for one month */}
        <Dialog open={!!debtDetail} onOpenChange={(o) => { if (!o) setDebtDetail(null); }}>
          <DialogContent className={`${bgCard} max-w-md`}>
            <DialogHeader>
              <DialogTitle className={`${textPrimary} flex items-center justify-between`}>
                <span>Payment History</span>
                <button onClick={() => setDebtDetail(null)} className={textSecondary}><X className="h-5 w-5" /></button>
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              {debtDetail && (debtDetail.schedule || []).flatMap((row) => row.payments.map((p) => ({ ...p, period: row.period }))).length === 0 ? (
                <p className={`text-sm ${textSecondary} text-center py-4`}>No payments recorded yet.</p>
              ) : (
                debtDetail && (debtDetail.schedule || []).flatMap((row) => row.payments.map((p) => ({ ...p, period: row.period }))).map((p) => (
                  <div key={p.payment_id} className={`flex items-center justify-between p-2 rounded-md border ${borderColor}`}>
                    <div>
                      <p className={`text-sm ${textPrimary}`}>{money(p.amount)} <span className={textSecondary}>· {monthLabel(p.period)}</span></p>
                      <p className={`text-xs ${textSecondary}`}>{fmtDate(p.date)}{p.note ? ` · ${p.note}` : ''}</p>
                    </div>
                    <Button variant="ghost" size="sm" className="text-red-500" onClick={() => undoPayment(debtDetail.debt_id, p.payment_id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                ))
              )}
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setDebtDetail(null)}>Close</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
