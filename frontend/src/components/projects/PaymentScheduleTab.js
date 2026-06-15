import React, { useState, useMemo } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Plus, Trash2, Wallet, X, Lock } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;
const MODES = ['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Card', 'Other'];

// Status workflow for each split/cycle row.
// Click the badge to cycle: Created → Raised → Paid → Declined → Created
const STATUS_FLOW = ['created', 'raised', 'paid', 'declined'];
const STATUS_LABEL = {
  created: 'Created',
  raised: 'Raised',
  paid: 'Paid',
  declined: 'Declined',
};
const STATUS_STYLE = {
  created: 'bg-slate-500/20 text-slate-300 border-slate-500/40',
  raised: 'bg-blue-500/20 text-blue-400 border-blue-500/40',
  paid: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
  declined: 'bg-red-500/20 text-red-400 border-red-500/40',
};
const nextStatus = (s) => {
  const i = STATUS_FLOW.indexOf(s || 'created');
  return STATUS_FLOW[(i + 1) % STATUS_FLOW.length];
};
const isPaid = (sp) => (sp.status === 'paid') || (!sp.status && !!sp.collected);

const emptySplit = () => ({
  id: `s_${Math.random().toString(36).slice(2, 10)}`,
  label: 'Advance',
  amount_type: 'amount', // 'amount' | 'percentage'
  amount: 0,
  percentage: 0,
  mode: 'UPI',
  expected_date: '',
  collected: false,            // legacy field — kept for back-compat
  collected_date: '',
  notes: '',
  // New monthly-cycle fields (optional for one-time rows)
  status: 'created',           // 'created' | 'raised' | 'paid' | 'declined'
  billing_type: '',            // 'pre_paid' | 'post_paid' (only for Monthly cycles)
  period_start: '',
  period_end: '',
  invoice_date: '',
  due_date: '',
  discount: 0,
});

const emptySchedule = () => ({
  type: 'one_time',         // 'one_time' | 'recurring'
  recurrence: '',           // 'monthly' | 'quarterly' | 'yearly' (only when recurring)
  total_amount: 0,
  currency: 'INR',
  splits: [emptySplit()],
});

// Build a fresh "Monthly cycle" form state for the popup.
const todayIso = () => new Date().toISOString().slice(0, 10);
const lastDayOfMonth = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return end.toISOString().slice(0, 10);
};
const addDays = (iso, days) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};
const monthLabel = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
};
const emptyMonthlyCycle = (amountDefault = 0) => {
  const start = todayIso();
  const end = lastDayOfMonth(start);
  return {
    billing_type: 'pre_paid',  // 'pre_paid' | 'post_paid'
    period_start: start,
    period_end: end,
    invoice_date: start,
    due_date: addDays(start, 7),
    amount: amountDefault || 0,
    discount: 0,
  };
};

export default function PaymentScheduleTab({
  project,
  onProjectUpdated,
  isSuperAdmin,
  isDark,
  bgCard,
  bgSecondary,
  textPrimary,
  textSecondary,
  borderColor,
}) {
  const existing = project?.payment_schedule || null;
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState(emptySchedule());
  // Monthly cycle popup state — auto-opens when Duration changes to "Monthly".
  const [showMonthly, setShowMonthly] = useState(false);
  const [monthly, setMonthly] = useState(emptyMonthlyCycle());
  const token = typeof window !== 'undefined' ? localStorage.getItem('session_token') : null;
  const headers = { Authorization: `Bearer ${token}` };
  const canEdit = !!isSuperAdmin;

  const schedule = existing || null;

  const totals = useMemo(() => {
    const s = schedule;
    if (!s) return { total: 0, collected: 0, balance: 0 };
    const total = Number(s.total_amount) || (s.splits || []).reduce((acc, sp) => acc + (Number(sp.amount) || 0), 0);
    const collected = (s.splits || []).filter(isPaid).reduce((acc, sp) => acc + (Number(sp.amount) || 0), 0);
    return { total, collected, balance: total - collected };
  }, [schedule]);

  const openCreate = () => {
    if (!canEdit) return;
    setDraft(existing ? JSON.parse(JSON.stringify(existing)) : emptySchedule());
    setShowModal(true);
  };

  const computeAmountsFromPercent = (next) => {
    // For one-time schedules, when a split uses percentage, derive its amount from total_amount.
    const t = Number(next.total_amount) || 0;
    next.splits = (next.splits || []).map(sp => {
      if (sp.amount_type === 'percentage') {
        const p = Number(sp.percentage) || 0;
        return { ...sp, amount: Math.round((t * p) / 100) };
      }
      return { ...sp, amount: Number(sp.amount) || 0 };
    });
    return next;
  };

  const handleSave = async () => {
    if (!canEdit) return;
    const next = computeAmountsFromPercent({ ...draft });
    setSaving(true);
    try {
      const res = await axios.patch(
        `${API}/api/projects/${project.project_id}`,
        { payment_schedule: next },
        { headers },
      );
      toast.success('Payment schedule saved');
      setShowModal(false);
      onProjectUpdated?.(res.data);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to save payment schedule');
    } finally {
      setSaving(false);
    }
  };

  // Click the status badge to cycle: Created → Raised → Paid → Declined → Created.
  const cycleStatus = async (splitId) => {
    if (!canEdit || !schedule) return;
    const next = JSON.parse(JSON.stringify(schedule));
    next.splits = (next.splits || []).map((sp) => {
      if (sp.id !== splitId) return sp;
      const ns = nextStatus(sp.status || 'created');
      return {
        ...sp,
        status: ns,
        // Keep the legacy `collected` flag in sync so older reports/dashboards keep working.
        collected: ns === 'paid',
        collected_date: ns === 'paid' ? new Date().toISOString().slice(0, 10) : '',
      };
    });
    try {
      const res = await axios.patch(
        `${API}/api/projects/${project.project_id}`,
        { payment_schedule: next },
        { headers },
      );
      onProjectUpdated?.(res.data);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to update');
    }
  };

  // Generate a single split row from the Monthly cycle popup.
  const generateMonthlyRow = () => {
    const m = monthly;
    const baseAmt = Number(m.amount) || 0;
    const disc = Number(m.discount) || 0;
    const net = Math.max(0, baseAmt - disc);
    const tag = m.billing_type === 'post_paid' ? 'Post-paid' : 'Pre-paid';
    const label = `${tag} · ${monthLabel(m.period_start) || 'Cycle'}`;
    const row = {
      ...emptySplit(),
      label,
      amount_type: 'amount',
      amount: net,
      mode: 'UPI',
      expected_date: m.invoice_date || '',
      status: 'created',
      billing_type: m.billing_type,
      period_start: m.period_start,
      period_end: m.period_end,
      invoice_date: m.invoice_date,
      due_date: m.due_date,
      discount: disc,
    };
    setDraft(d => ({ ...d, splits: [...(d.splits || []), row] }));
    setShowMonthly(false);
    toast.success(`Added ${label} (${net.toLocaleString()})`);
  };

  return (
    <div className="space-y-4" data-testid="payment-schedule-tab">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className={`text-lg font-semibold ${textPrimary} flex items-center gap-2`}>
            <Wallet className="h-5 w-5 text-[#10b981]" /> Payment Schedule
          </h3>
          <p className={`text-xs ${textSecondary}`}>
            {canEdit ? 'Define the project payment plan — splits, collection status, totals.' : 'View-only — only Super Admin can edit.'}
          </p>
        </div>
        {canEdit ? (
          <Button onClick={openCreate} className="bg-[#10b981] hover:bg-[#059669] text-white" data-testid="payment-schedule-add-btn">
            <Plus className="h-4 w-4 mr-1" /> {schedule ? 'Edit Payment Schedule' : 'Add Payment Schedule'}
          </Button>
        ) : (
          <Badge className="bg-amber-500/20 text-amber-400 pointer-events-none flex items-center gap-1">
            <Lock className="h-3 w-3" /> Read only
          </Badge>
        )}
      </div>

      {!schedule ? (
        <Card className={`${bgCard} border ${borderColor}`}>
          <CardContent className="p-8 text-center">
            <Wallet className={`h-10 w-10 mx-auto mb-2 ${textSecondary} opacity-50`} />
            <p className={textSecondary}>No payment schedule yet.</p>
            {canEdit && (
              <Button onClick={openCreate} className="mt-3 bg-[#10b981] hover:bg-[#059669] text-white">
                <Plus className="h-4 w-4 mr-1" /> Add Payment Schedule
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Card className={`${bgCard} border ${borderColor}`}>
              <CardContent className="p-4">
                <p className={`text-xs ${textSecondary}`}>Total</p>
                <p className={`text-2xl font-bold ${textPrimary}`} data-testid="payment-total">
                  {schedule.currency || 'INR'} {totals.total.toLocaleString()}
                </p>
                <p className={`text-[10px] ${textSecondary} mt-0.5`}>
                  {schedule.type === 'recurring'
                    ? `Recurring — ${schedule.recurrence}`
                    : 'One-time'}
                </p>
              </CardContent>
            </Card>
            <Card className={`${bgCard} border ${borderColor}`}>
              <CardContent className="p-4">
                <p className={`text-xs ${textSecondary}`}>Collected</p>
                <p className="text-2xl font-bold text-[#10b981]" data-testid="payment-collected">
                  {schedule.currency || 'INR'} {totals.collected.toLocaleString()}
                </p>
                <p className={`text-[10px] ${textSecondary} mt-0.5`}>
                  {totals.total > 0 ? `${Math.round((totals.collected / totals.total) * 100)}% received` : '—'}
                </p>
              </CardContent>
            </Card>
            <Card className={`${bgCard} border ${borderColor}`}>
              <CardContent className="p-4">
                <p className={`text-xs ${textSecondary}`}>Balance</p>
                <p className="text-2xl font-bold text-[#f59e0b]" data-testid="payment-balance">
                  {schedule.currency || 'INR'} {totals.balance.toLocaleString()}
                </p>
                <p className={`text-[10px] ${textSecondary} mt-0.5`}>
                  {(schedule.splits || []).filter(s => !s.collected).length} pending
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Splits table */}
          <Card className={`${bgCard} border ${borderColor}`}>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className={`border-b ${borderColor}`}>
                      <th className={`text-left p-3 text-xs font-medium ${textSecondary} uppercase`}>Label</th>
                      <th className={`text-right p-3 text-xs font-medium ${textSecondary} uppercase`}>Amount / %</th>
                      <th className={`text-left p-3 text-xs font-medium ${textSecondary} uppercase`}>Mode</th>
                      <th className={`text-left p-3 text-xs font-medium ${textSecondary} uppercase`}>Expected Date</th>
                      <th className={`text-left p-3 text-xs font-medium ${textSecondary} uppercase`}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(schedule.splits || []).map((sp) => (
                      <tr key={sp.id} className={`border-b ${borderColor}`} data-testid={`payment-split-${sp.id}`}>
                        <td className={`p-3 ${textPrimary}`}>{sp.label || '—'}</td>
                        <td className={`p-3 text-right ${textPrimary} font-medium`}>
                          {schedule.currency || 'INR'} {Number(sp.amount || 0).toLocaleString()}
                          {sp.amount_type === 'percentage' && (
                            <span className={`ml-1 text-xs ${textSecondary}`}>({sp.percentage}%)</span>
                          )}
                        </td>
                        <td className={`p-3 ${textPrimary}`}>{sp.mode || '—'}</td>
                        <td className={`p-3 ${textPrimary}`}>{sp.expected_date || '—'}</td>
                        <td className="p-3">
                          {(() => {
                            const st = sp.status || (sp.collected ? 'paid' : 'created');
                            return (
                              <button
                                type="button"
                                onClick={() => cycleStatus(sp.id)}
                                disabled={!canEdit}
                                data-testid={`payment-status-cycle-${sp.id}`}
                                title={canEdit ? 'Click to advance status' : 'Read only'}
                                className={`px-2 py-1 rounded-md text-xs font-medium border ${STATUS_STYLE[st]} ${canEdit ? 'cursor-pointer hover:opacity-80' : 'cursor-not-allowed opacity-80'}`}
                              >
                                {STATUS_LABEL[st]}
                              </button>
                            );
                          })()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Edit / Create Modal */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-[70] p-4"
          onClick={() => setShowModal(false)}
          data-testid="payment-schedule-modal"
        >
          <Card
            className={`${bgCard} border ${borderColor} w-full max-w-3xl max-h-[90vh] overflow-y-auto`}
            onClick={(e) => e.stopPropagation()}
          >
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className={`text-lg font-semibold ${textPrimary}`}>
                  {existing ? 'Edit Payment Schedule' : 'Add Payment Schedule'}
                </h3>
                <button onClick={() => setShowModal(false)} className={textSecondary} data-testid="payment-modal-close">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Type + recurrence + total */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <Label className={textPrimary}>Payment Type</Label>
                  <div className="flex gap-2 mt-1">
                    {[
                      { id: 'one_time', label: 'One-time' },
                      { id: 'recurring', label: 'Recurring' },
                    ].map(t => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setDraft(d => ({ ...d, type: t.id }))}
                        className={`flex-1 px-3 py-2 rounded-lg text-sm border ${
                          draft.type === t.id
                            ? 'bg-[#10b981] border-[#10b981] text-white'
                            : isDark
                              ? 'bg-[#27272a] border-[#3f3f46] text-[#fafafa]'
                              : 'bg-gray-100 border-gray-200 text-gray-700'
                        }`}
                        data-testid={`payment-type-${t.id}`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {draft.type === 'recurring' && (
                  <div>
                    <Label className={textPrimary}>Duration</Label>
                    <select
                      value={draft.recurrence}
                      onChange={(e) => {
                        const v = e.target.value;
                        setDraft(d => ({ ...d, recurrence: v }));
                        if (v === 'monthly' && canEdit) {
                          setMonthly(emptyMonthlyCycle(Number(draft.total_amount) || 0));
                          setShowMonthly(true);
                        }
                      }}
                      className={`w-full mt-1 px-3 py-2 rounded-lg border ${borderColor} ${bgSecondary} ${textPrimary}`}
                      data-testid="payment-recurrence"
                    >
                      <option value="">Select…</option>
                      <option value="monthly">Monthly</option>
                      <option value="quarterly">Quarterly</option>
                      <option value="yearly">Yearly</option>
                    </select>
                    {draft.recurrence === 'monthly' && (
                      <button
                        type="button"
                        onClick={() => { setMonthly(emptyMonthlyCycle(Number(draft.total_amount) || 0)); setShowMonthly(true); }}
                        className="mt-1 text-[11px] text-[#10b981] hover:underline"
                        data-testid="open-monthly-cycle-popup"
                      >
                        + Add monthly cycle
                      </button>
                    )}
                  </div>
                )}

                <div>
                  <Label className={textPrimary}>
                    {draft.type === 'recurring' ? 'Amount per cycle' : 'Total Amount'}
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    value={draft.total_amount}
                    onChange={(e) => setDraft(d => ({ ...d, total_amount: e.target.value }))}
                    className={`${bgSecondary} border ${borderColor} ${textPrimary} mt-1`}
                    placeholder="0"
                    data-testid="payment-total-amount"
                  />
                </div>
              </div>

              {/* Splits */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className={textPrimary}>Splits / Milestones</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setDraft(d => ({ ...d, splits: [...(d.splits || []), emptySplit()] }))}
                    className={`${borderColor}`}
                    data-testid="payment-add-split"
                  >
                    <Plus className="h-3 w-3 mr-1" /> Add Row
                  </Button>
                </div>
                <div className="space-y-2">
                  {(draft.splits || []).map((sp, idx) => (
                    <div
                      key={sp.id}
                      className={`p-3 rounded-lg border ${borderColor} ${bgSecondary} grid grid-cols-2 md:grid-cols-12 gap-2 items-center`}
                      data-testid={`payment-row-${idx}`}
                    >
                      <Input
                        value={sp.label}
                        onChange={(e) => {
                          const v = e.target.value;
                          setDraft(d => ({ ...d, splits: d.splits.map(s => s.id === sp.id ? { ...s, label: v } : s) }));
                        }}
                        placeholder="Advance / Milestone 1 …"
                        className={`md:col-span-3 ${isDark ? 'bg-[#18181b]' : 'bg-white'} border ${borderColor} ${textPrimary}`}
                      />
                      <select
                        value={sp.amount_type}
                        onChange={(e) => {
                          const v = e.target.value;
                          setDraft(d => ({ ...d, splits: d.splits.map(s => s.id === sp.id ? { ...s, amount_type: v } : s) }));
                        }}
                        className={`md:col-span-2 px-2 py-2 rounded-lg border ${borderColor} ${isDark ? 'bg-[#18181b]' : 'bg-white'} ${textPrimary} text-sm`}
                      >
                        <option value="amount">Amount</option>
                        <option value="percentage">Percent %</option>
                      </select>
                      {sp.amount_type === 'percentage' ? (
                        <Input
                          type="number" min="0" max="100"
                          value={sp.percentage}
                          onChange={(e) => {
                            const v = e.target.value;
                            setDraft(d => ({ ...d, splits: d.splits.map(s => s.id === sp.id ? { ...s, percentage: v } : s) }));
                          }}
                          placeholder="50"
                          className={`md:col-span-2 ${isDark ? 'bg-[#18181b]' : 'bg-white'} border ${borderColor} ${textPrimary}`}
                        />
                      ) : (
                        <Input
                          type="number" min="0"
                          value={sp.amount}
                          onChange={(e) => {
                            const v = e.target.value;
                            setDraft(d => ({ ...d, splits: d.splits.map(s => s.id === sp.id ? { ...s, amount: v } : s) }));
                          }}
                          placeholder="0"
                          className={`md:col-span-2 ${isDark ? 'bg-[#18181b]' : 'bg-white'} border ${borderColor} ${textPrimary}`}
                        />
                      )}
                      <select
                        value={sp.mode}
                        onChange={(e) => {
                          const v = e.target.value;
                          setDraft(d => ({ ...d, splits: d.splits.map(s => s.id === sp.id ? { ...s, mode: v } : s) }));
                        }}
                        className={`md:col-span-2 px-2 py-2 rounded-lg border ${borderColor} ${isDark ? 'bg-[#18181b]' : 'bg-white'} ${textPrimary} text-sm`}
                      >
                        {MODES.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                      <Input
                        type="date"
                        value={sp.expected_date || ''}
                        onChange={(e) => {
                          const v = e.target.value;
                          setDraft(d => ({ ...d, splits: d.splits.map(s => s.id === sp.id ? { ...s, expected_date: v } : s) }));
                        }}
                        className={`md:col-span-3 ${isDark ? 'bg-[#18181b]' : 'bg-white'} border ${borderColor} ${textPrimary}`}
                      />
                      <button
                        type="button"
                        onClick={() => setDraft(d => ({ ...d, splits: d.splits.filter(s => s.id !== sp.id) }))}
                        className="md:col-span-12 md:col-span-auto text-red-500 hover:text-red-400 justify-self-end p-1"
                        title="Remove row"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-2 border-t border-[#27272a]">
                <Button variant="outline" onClick={() => setShowModal(false)} className={`flex-1 ${borderColor}`} disabled={saving}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 bg-[#10b981] hover:bg-[#059669] text-white disabled:opacity-50"
                  data-testid="payment-schedule-save"
                >
                  {saving ? 'Saving…' : 'Save'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Monthly Cycle popup — opened when Duration is set to "Monthly".
          Adds ONE row at a time on Generate (no auto-fill of multiple months). */}
      {showMonthly && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-[80] p-4"
          onClick={() => setShowMonthly(false)}
          data-testid="monthly-cycle-modal"
        >
          <Card
            className={`${bgCard} border ${borderColor} w-full max-w-lg`}
            onClick={(e) => e.stopPropagation()}
          >
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className={`text-base font-semibold ${textPrimary}`}>Add Monthly Cycle</h3>
                <button onClick={() => setShowMonthly(false)} className={textSecondary} data-testid="monthly-cycle-close">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Pre-paid vs Post-paid */}
              <div>
                <Label className={textPrimary}>Payment Type</Label>
                <div className="flex gap-2 mt-1">
                  {[
                    { id: 'pre_paid', label: 'Pre-paid', hint: 'Invoice at start of month' },
                    { id: 'post_paid', label: 'Post-paid', hint: 'Invoice at end / next month' },
                  ].map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setMonthly(m => ({ ...m, billing_type: t.id }))}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm border text-left ${
                        monthly.billing_type === t.id
                          ? 'bg-[#10b981] border-[#10b981] text-white'
                          : isDark
                            ? 'bg-[#27272a] border-[#3f3f46] text-[#fafafa]'
                            : 'bg-gray-100 border-gray-200 text-gray-700'
                      }`}
                      data-testid={`monthly-billing-${t.id}`}
                    >
                      <div className="font-medium">{t.label}</div>
                      <div className="text-[10px] opacity-80">{t.hint}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className={textPrimary}>Period Start</Label>
                  <Input
                    type="date"
                    value={monthly.period_start}
                    onChange={(e) => {
                      const v = e.target.value;
                      setMonthly(m => ({ ...m, period_start: v, period_end: lastDayOfMonth(v), invoice_date: m.billing_type === 'pre_paid' ? v : lastDayOfMonth(v), due_date: addDays(m.billing_type === 'pre_paid' ? v : lastDayOfMonth(v), 7) }));
                    }}
                    className={`${bgSecondary} border ${borderColor} ${textPrimary} mt-1`}
                    data-testid="monthly-period-start"
                  />
                </div>
                <div>
                  <Label className={textPrimary}>Period End</Label>
                  <Input
                    type="date"
                    value={monthly.period_end}
                    onChange={(e) => setMonthly(m => ({ ...m, period_end: e.target.value }))}
                    className={`${bgSecondary} border ${borderColor} ${textPrimary} mt-1`}
                    data-testid="monthly-period-end"
                  />
                </div>
                <div>
                  <Label className={textPrimary}>Invoice Date</Label>
                  <Input
                    type="date"
                    value={monthly.invoice_date}
                    onChange={(e) => setMonthly(m => ({ ...m, invoice_date: e.target.value, due_date: addDays(e.target.value, 7) }))}
                    className={`${bgSecondary} border ${borderColor} ${textPrimary} mt-1`}
                    data-testid="monthly-invoice-date"
                  />
                </div>
                <div>
                  <Label className={textPrimary}>Due Date</Label>
                  <Input
                    type="date"
                    value={monthly.due_date}
                    onChange={(e) => setMonthly(m => ({ ...m, due_date: e.target.value }))}
                    className={`${bgSecondary} border ${borderColor} ${textPrimary} mt-1`}
                    data-testid="monthly-due-date"
                  />
                </div>
                <div>
                  <Label className={textPrimary}>Amount</Label>
                  <Input
                    type="number" min="0"
                    value={monthly.amount}
                    onChange={(e) => setMonthly(m => ({ ...m, amount: e.target.value }))}
                    className={`${bgSecondary} border ${borderColor} ${textPrimary} mt-1`}
                    placeholder="0"
                    data-testid="monthly-amount"
                  />
                </div>
                <div>
                  <Label className={textPrimary}>Discount</Label>
                  <Input
                    type="number" min="0"
                    value={monthly.discount}
                    onChange={(e) => setMonthly(m => ({ ...m, discount: e.target.value }))}
                    className={`${bgSecondary} border ${borderColor} ${textPrimary} mt-1`}
                    placeholder="0 (flat)"
                    data-testid="monthly-discount"
                  />
                </div>
              </div>

              {/* Live preview of net amount */}
              <div className={`p-2.5 rounded-lg border ${borderColor} ${bgSecondary} flex items-center justify-between`}>
                <p className={`text-xs ${textSecondary}`}>Net for this cycle</p>
                <p className={`text-sm font-semibold ${textPrimary}`}>
                  {(schedule?.currency || 'INR')} {Math.max(0, (Number(monthly.amount) || 0) - (Number(monthly.discount) || 0)).toLocaleString()}
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => setShowMonthly(false)} className={`flex-1 ${borderColor}`}>
                  Cancel
                </Button>
                <Button
                  onClick={generateMonthlyRow}
                  className="flex-1 bg-[#10b981] hover:bg-[#059669] text-white"
                  data-testid="monthly-generate-btn"
                >
                  <Plus className="h-4 w-4 mr-1" /> Generate
                </Button>
              </div>
              <p className={`text-[10px] ${textSecondary} text-center`}>
                Generates a single row. Click &quot;+ Add monthly cycle&quot; again for additional months.
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
