import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Plus, Trash2, X, ChevronLeft, ChevronRight, Receipt } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

const API = process.env.REACT_APP_BACKEND_URL;

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
// Same period modes as the Performance View.
const MODES = [
  { id: 'all', label: 'All' },
  { id: 'month', label: 'Month' },
  { id: 'year', label: 'Year' },
  { id: 'custom', label: 'Custom Range' },
];
const SOURCES = [
  { id: 'client', label: 'Direct Payment from Client' },
  { id: 'agency', label: 'Agency' },
];
const SOURCE_LABEL = Object.fromEntries(SOURCES.map(s => [s.id, s.label]));

const pad = (n) => String(n).padStart(2, '0');
// Repo convention: "today" is the IST calendar date, never raw UTC.
const todayIST = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
const currentMonth = () => { const t = todayIST(); return { y: Number(t.slice(0, 4)), m: Number(t.slice(5, 7)) - 1 }; };
const monthRange = ({ y, m }) => ({ from: `${y}-${pad(m + 1)}-01`, to: `${y}-${pad(m + 1)}-${pad(new Date(y, m + 1, 0).getDate())}` });
const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const fmtDate = (iso) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

const emptyForm = () => ({ date: todayIST(), amount: '', payment_source: 'client', paid_by: '', reference_number: '' });

/**
 * Meta Ads "Payment History" tab — the money put into this project's ad
 * wallet: who paid (direct from the client, or the agency), how much, when and
 * under which reference. Payments share one log with the Performance View's
 * wallet recharges, so both screens always agree. Balance = everything paid in
 * minus everything spent per the daily reports.
 */
export default function ProjectPaymentHistoryTab({
  project, canEdit, bgCard, bgSecondary, textPrimary, textSecondary, borderColor,
}) {
  const projectId = project?.project_id;

  const [mode, setMode] = useState('all');
  const [month, setMonth] = useState(currentMonth);
  const [year, setYear] = useState(() => currentMonth().y);
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const loadSeq = useRef(0);

  const range = useMemo(() => {
    if (mode === 'month') return monthRange(month);
    if (mode === 'year') return { from: `${year}-01-01`, to: `${year}-12-31` };
    if (mode === 'custom') return { from: customFrom, to: customTo };
    return { from: '', to: '' };
  }, [mode, month, year, customFrom, customTo]);
  const rangeInvalid = mode === 'custom' && range.from && range.to && range.from > range.to;

  const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('session_token')}` });

  const load = useCallback(async () => {
    const seq = ++loadSeq.current;
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (range.from) params.from = range.from;
      if (range.to) params.to = range.to;
      const res = await axios.get(`${API}/api/meta-payments/${projectId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('session_token')}` },
        params,
      });
      if (seq === loadSeq.current) setData(res.data);
    } catch (e) {
      if (seq === loadSeq.current) setError(e.response?.data?.detail || 'Failed to load payments');
    } finally {
      if (seq === loadSeq.current) setLoading(false);
    }
  }, [projectId, range.from, range.to]);

  useEffect(() => { if (!rangeInvalid) load(); }, [load, rangeInvalid]);

  const stepMonth = (d) => setMonth(({ y, m }) => {
    const t = y * 12 + m + d;
    return { y: Math.floor(t / 12), m: ((t % 12) + 12) % 12 };
  });

  const periodLabel = mode === 'all' ? 'All time'
    : mode === 'month' ? `${MONTHS[month.m]} ${month.y}`
    : mode === 'year' ? String(year)
    : (range.from || range.to) ? `${range.from ? fmtDate(range.from) : 'Start'} – ${range.to ? fmtDate(range.to) : 'Today'}` : 'All time';

  const openAdd = () => { setForm(emptyForm()); setShowAdd(true); };

  const save = async () => {
    const amount = Number(form.amount);
    if (!form.date) { toast.error('Pick the date of payment'); return; }
    if (!Number.isFinite(amount) || amount <= 0) { toast.error('Enter an amount greater than 0'); return; }
    if (!form.payment_source) { toast.error('Choose Direct Payment from Client or Agency'); return; }
    setSaving(true);
    try {
      await axios.post(`${API}/api/meta-payments`, {
        project_id: projectId,
        date: form.date,
        amount,
        payment_source: form.payment_source,
        paid_by: form.paid_by,
        reference_number: form.reference_number,
      }, { headers: authHeaders() });
      toast.success('Payment added');
      setShowAdd(false);
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to add payment');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (p) => {
    if (!window.confirm(`Remove the ${money(p.amount)} payment on ${fmtDate(p.date)}?`)) return;
    try {
      await axios.delete(`${API}/api/meta-reports/recharges/${p.recharge_id}`, { headers: authHeaders() });
      toast.success('Payment removed');
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to remove payment');
    }
  };

  const pill = (active) => `px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${active ? 'bg-[#6366f1] text-white' : `${textSecondary} hover:bg-[#6366f1]/10`}`;
  const navBtn = `p-1.5 rounded-md border ${borderColor} ${textPrimary} hover:bg-[#6366f1]/10`;
  const inputCls = `${bgSecondary} border ${borderColor} ${textPrimary}`;
  const th = `text-left px-4 py-3 text-[11px] font-medium uppercase ${textSecondary} whitespace-nowrap`;

  const totals = data?.totals;
  const wallet = data?.wallet;
  const payments = data?.payments || [];
  const stat = (label, value, sub, testId, danger) => (
    <div className={`rounded-xl border ${borderColor} ${bgCard} p-4`} data-testid={testId}>
      <p className={`text-xs ${textSecondary}`}>{label}</p>
      <p className={`text-2xl font-bold mt-1 ${danger ? 'text-red-500' : textPrimary}`}>{value}</p>
      {sub && <p className={`text-[11px] ${textSecondary} mt-1`}>{sub}</p>}
    </div>
  );

  return (
    <div className="space-y-3" data-testid="project-payment-history-tab">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className={`text-lg font-semibold ${textPrimary} flex items-center gap-2`}>
            <Receipt className="h-5 w-5 text-[#6366f1]" /> Payment History
          </h3>
          <p className={`text-xs ${textSecondary}`}>Payments into this project's ad wallet — shared with the Performance View's recharges.</p>
        </div>
        {canEdit && (
          <Button type="button" onClick={openAdd} size="sm" className="bg-[#6366f1] hover:bg-[#4f46e5] text-white" data-testid="payment-add-btn">
            <Plus className="h-3.5 w-3.5 mr-1" /> Add Payment
          </Button>
        )}
      </div>

      {/* Period filter — same modes as the Performance View */}
      <div className="flex flex-wrap items-center gap-3">
        <div className={`inline-flex items-center gap-1 p-1 rounded-lg border ${borderColor} ${bgCard}`}>
          {MODES.map(m => (
            <button key={m.id} type="button" onClick={() => setMode(m.id)} className={pill(mode === m.id)} data-testid={`payment-mode-${m.id}`}>
              {m.label}
            </button>
          ))}
        </div>
        {mode === 'month' && (
          <div className="flex items-center gap-2" data-testid="payment-month-nav">
            <button type="button" onClick={() => stepMonth(-1)} className={navBtn} title="Previous month" data-testid="payment-prev"><ChevronLeft className="h-4 w-4" /></button>
            <span className={`text-sm font-semibold ${textPrimary} min-w-[130px] text-center`}>{MONTHS[month.m]} {month.y}</span>
            <button type="button" onClick={() => stepMonth(1)} className={navBtn} title="Next month" data-testid="payment-next"><ChevronRight className="h-4 w-4" /></button>
            <button type="button" onClick={() => setMonth(currentMonth())} className={`px-3 py-1.5 rounded-md border ${borderColor} text-xs font-medium ${textPrimary} hover:bg-[#6366f1]/10`} data-testid="payment-current">Current</button>
          </div>
        )}
        {mode === 'year' && (
          <div className="flex items-center gap-2" data-testid="payment-year-nav">
            <button type="button" onClick={() => setYear(y => y - 1)} className={navBtn} title="Previous year" data-testid="payment-prev"><ChevronLeft className="h-4 w-4" /></button>
            <span className={`text-sm font-semibold ${textPrimary} min-w-[70px] text-center`}>{year}</span>
            <button type="button" onClick={() => setYear(y => y + 1)} className={navBtn} title="Next year" data-testid="payment-next"><ChevronRight className="h-4 w-4" /></button>
            <button type="button" onClick={() => setYear(currentMonth().y)} className={`px-3 py-1.5 rounded-md border ${borderColor} text-xs font-medium ${textPrimary} hover:bg-[#6366f1]/10`} data-testid="payment-current">Current</button>
          </div>
        )}
        {mode === 'custom' && (
          <div className="flex flex-wrap items-center gap-2" data-testid="payment-custom">
            <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className={`h-9 w-40 text-sm ${inputCls}`} data-testid="payment-from" />
            <span className={`text-xs ${textSecondary}`}>to</span>
            <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className={`h-9 w-40 text-sm ${inputCls}`} data-testid="payment-to" />
          </div>
        )}
        <span className={`text-xs ${textSecondary}`} data-testid="payment-period-label">{periodLabel}</span>
      </div>
      {rangeInvalid && <p className="text-xs text-red-500">The start date is after the end date.</p>}
      {error && <p className="text-sm text-red-500" data-testid="payment-error">{error}</p>}

      {/* Totals: paid in the period, spent in the period, and the all-time wallet balance */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {stat(
          'Total Amount Paid',
          totals ? money(totals.paid) : '—',
          totals ? `${totals.count} payment${totals.count === 1 ? '' : 's'} · Client ${money(totals.client)} · Agency ${money(totals.agency)}${totals.other ? ` · Not specified ${money(totals.other)}` : ''}` : periodLabel,
          'payment-stat-total',
        )}
        {stat('Spent', totals ? money(totals.spent) : '—', `From the daily reports · ${periodLabel}`, 'payment-stat-spent')}
        {stat(
          'Balance Amount',
          wallet ? money(wallet.balance) : '—',
          wallet ? `All payments ${money(wallet.paid_all)} − all spend ${money(wallet.spend_all)}` : '',
          'payment-stat-balance',
          wallet && wallet.balance < 0,
        )}
      </div>

      <div className={`${bgCard} border ${borderColor} rounded-xl overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className={`border-b ${borderColor}`}>
                <th className={th}>Date of Payment</th>
                <th className={`${th} text-right`}>Amount</th>
                <th className={th}>Payment From</th>
                <th className={th}>Paid By</th>
                <th className={th}>Reference No.</th>
                <th className={th}>Added By</th>
                {canEdit && <th className="w-10" />}
              </tr>
            </thead>
            <tbody>
              {payments.map(p => (
                <tr key={p.recharge_id} className={`border-b last:border-b-0 ${borderColor}`} data-testid={`payment-row-${p.recharge_id}`}>
                  <td className={`px-4 py-3 text-sm ${textPrimary} whitespace-nowrap`}>{fmtDate(p.date)}</td>
                  <td className={`px-4 py-3 text-sm text-right tabular-nums font-medium ${textPrimary}`}>{money(p.amount)}</td>
                  <td className={`px-4 py-3 text-sm ${textPrimary}`}>{SOURCE_LABEL[p.payment_source] || <span className={textSecondary}>—</span>}</td>
                  <td className={`px-4 py-3 text-sm ${textPrimary}`}>{p.paid_by || <span className={textSecondary}>—</span>}</td>
                  <td className={`px-4 py-3 text-sm ${textPrimary}`}>
                    {p.reference_number || (p.note ? <span className={textSecondary} title="Note from the Performance View">{p.note}</span> : <span className={textSecondary}>—</span>)}
                  </td>
                  <td className={`px-4 py-3 text-xs ${textSecondary}`}>{p.created_by_name || '—'}</td>
                  {canEdit && (
                    <td className="px-2 py-3 text-right">
                      <button type="button" onClick={() => remove(p)} className="p-1 text-red-500 hover:text-red-400" title="Remove payment" data-testid={`payment-delete-${p.recharge_id}`}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {!loading && payments.length === 0 && (
                <tr>
                  <td colSpan={canEdit ? 7 : 6} className={`p-8 text-center text-xs ${textSecondary}`}>
                    {mode === 'all' ? 'No payments yet.' : 'No payments in this period.'} {canEdit && <span>Click <span className="font-medium">Add Payment</span> to log one.</span>}
                  </td>
                </tr>
              )}
              {loading && payments.length === 0 && (
                <tr><td colSpan={canEdit ? 7 : 6} className={`p-8 text-center text-xs ${textSecondary}`}>Loading…</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* z-40, not higher: the Payment From <Select> list portals to the body at
          z-50 (ui/select.jsx) and would open behind a higher backdrop. */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-40 p-4" onClick={() => setShowAdd(false)}>
          <div className={`${bgCard} border ${borderColor} rounded-xl w-full max-w-md`} onClick={(e) => e.stopPropagation()} data-testid="payment-add-modal">
            <div className={`p-5 border-b ${borderColor} flex items-center justify-between`}>
              <h3 className={`text-base font-semibold ${textPrimary}`}>Add Payment</h3>
              <button onClick={() => setShowAdd(false)} className={textSecondary}><X className="h-5 w-5" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <p className={`text-xs font-medium ${textSecondary} mb-1`}>Date of Payment</p>
                <Input type="date" value={form.date} onChange={(e) => setForm(f => ({ ...f, date: e.target.value }))} className={inputCls} data-testid="payment-form-date" />
              </div>
              <div>
                <p className={`text-xs font-medium ${textSecondary} mb-1`}>Amount (₹)</p>
                <Input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="e.g. 10000" className={inputCls} data-testid="payment-form-amount" autoFocus />
              </div>
              <div>
                <p className={`text-xs font-medium ${textSecondary} mb-1`}>Payment From</p>
                <Select value={form.payment_source} onValueChange={(v) => setForm(f => ({ ...f, payment_source: v }))}>
                  <SelectTrigger className={inputCls} data-testid="payment-form-source"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SOURCES.map(s => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <p className={`text-xs font-medium ${textSecondary} mb-1`}>Paid By</p>
                <Input value={form.paid_by} onChange={(e) => setForm(f => ({ ...f, paid_by: e.target.value }))} maxLength={120} placeholder="Name of the person / company who paid" className={inputCls} data-testid="payment-form-paid-by" />
              </div>
              <div>
                <p className={`text-xs font-medium ${textSecondary} mb-1`}>Reference Number</p>
                <Input value={form.reference_number} onChange={(e) => setForm(f => ({ ...f, reference_number: e.target.value }))} onKeyDown={(e) => { if (e.key === 'Enter') save(); }} maxLength={120} placeholder="UTR / transaction / invoice number" className={inputCls} data-testid="payment-form-reference" />
              </div>
            </div>
            <div className={`p-5 border-t ${borderColor} flex items-center justify-end gap-2`}>
              <Button type="button" variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button type="button" onClick={save} disabled={saving} className="bg-[#6366f1] hover:bg-[#4f46e5] text-white" data-testid="payment-form-save">
                {saving ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
