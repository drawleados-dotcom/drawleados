import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Plus, Trash2, X, ChevronLeft, ChevronRight, Wallet, Eye } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import MetaPerformanceSummary from './MetaPerformanceSummary';

const API = process.env.REACT_APP_BACKEND_URL;

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MODES = [
  { id: 'all', label: 'All' },
  { id: 'month', label: 'Month' },
  { id: 'year', label: 'Year' },
  { id: 'custom', label: 'Custom Range' },
];

const pad = (n) => String(n).padStart(2, '0');
// Repo convention: "today" is the IST calendar date, never raw UTC.
const todayIST = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
const currentMonth = () => { const t = todayIST(); return { y: Number(t.slice(0, 4)), m: Number(t.slice(5, 7)) - 1 }; };
const monthRange = ({ y, m }) => ({ from: `${y}-${pad(m + 1)}-01`, to: `${y}-${pad(m + 1)}-${pad(new Date(y, m + 1, 0).getDate())}` });

const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const count = (n) => Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 1 });
const fmtDate = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

/**
 * Operations > Projects > Meta Ads > "Performance View": one row per Meta Ads
 * project for the chosen period (All / Month / Year / custom range) — how big
 * the account is, what it spent and generated, and its ad-wallet position.
 */
export default function MetaPerformanceView({
  statusFilter, canEditRecharges, onOpenProject, headers,
  bgCard, bgSecondary, textPrimary, textSecondary, borderColor,
}) {
  const [mode, setMode] = useState('month');
  const [month, setMonth] = useState(currentMonth);
  const [year, setYear] = useState(() => currentMonth().y);
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rechargeFor, setRechargeFor] = useState(null); // project row
  const [summaryFor, setSummaryFor] = useState(null); // project row
  // The parent may hand over a fresh headers object every render — keep it out
  // of the effect deps so it can't retrigger the fetch.
  const headersRef = useRef(headers);
  headersRef.current = headers;
  const loadSeq = useRef(0);

  const range = useMemo(() => {
    if (mode === 'month') return monthRange(month);
    if (mode === 'year') return { from: `${year}-01-01`, to: `${year}-12-31` };
    if (mode === 'custom') return { from: customFrom, to: customTo };
    return { from: '', to: '' };
  }, [mode, month, year, customFrom, customTo]);
  const rangeInvalid = mode === 'custom' && range.from && range.to && range.from > range.to;

  const load = useCallback(async () => {
    if (rangeInvalid) return;
    const seq = ++loadSeq.current;
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (range.from) params.from = range.from;
      if (range.to) params.to = range.to;
      const res = await axios.get(`${API}/api/meta-reports/performance`, { headers: headersRef.current, params });
      if (seq === loadSeq.current) setRows(res.data?.rows || []);
    } catch (e) {
      if (seq === loadSeq.current) setError(e.response?.data?.detail || 'Failed to load performance');
    } finally {
      if (seq === loadSeq.current) setLoading(false);
    }
  }, [range.from, range.to, rangeInvalid]);

  useEffect(() => { load(); }, [load]);

  const visible = useMemo(
    () => rows.filter(r => statusFilter === 'all' || (r.status || 'active') === statusFilter),
    [rows, statusFilter],
  );
  const sum = (key) => visible.reduce((s, r) => s + (Number(r[key]) || 0), 0);

  const periodLabel = mode === 'all' ? 'All time'
    : mode === 'month' ? `${MONTHS[month.m]} ${month.y}`
    : mode === 'year' ? String(year)
    : range.from && range.to ? `${fmtDate(range.from)} – ${fmtDate(range.to)}`
    : range.from ? `From ${fmtDate(range.from)}`
    : range.to ? `Up to ${fmtDate(range.to)}`
    : 'All time';

  const stepMonth = (d) => setMonth(({ y, m }) => {
    const t = y * 12 + m + d;
    return { y: Math.floor(t / 12), m: ((t % 12) + 12) % 12 };
  });

  const pill = (active) => `px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${active ? 'bg-[#6366f1] text-white' : `${textSecondary} hover:bg-[#6366f1]/10`}`;
  const navBtn = `p-1.5 rounded-md border ${borderColor} ${textPrimary} hover:bg-[#6366f1]/10`;
  const th = `px-4 py-3 text-[11px] font-medium uppercase ${textSecondary}`;
  const numTh = `${th} text-right`;
  const numTd = `px-4 py-3 text-sm text-right tabular-nums ${textPrimary}`;

  return (
    <div className="space-y-3" data-testid="meta-performance-view">
      <div className="flex flex-wrap items-center gap-3">
        <div className={`inline-flex items-center gap-1 p-1 rounded-lg border ${borderColor} ${bgCard}`}>
          {MODES.map(m => (
            <button key={m.id} type="button" onClick={() => setMode(m.id)} className={pill(mode === m.id)} data-testid={`meta-perf-mode-${m.id}`}>
              {m.label}
            </button>
          ))}
        </div>

        {mode === 'month' && (
          <div className="flex items-center gap-2" data-testid="meta-perf-month-nav">
            <button type="button" onClick={() => stepMonth(-1)} className={navBtn} title="Previous month" data-testid="meta-perf-prev"><ChevronLeft className="h-4 w-4" /></button>
            <span className={`text-sm font-semibold ${textPrimary} min-w-[130px] text-center`}>{MONTHS[month.m]} {month.y}</span>
            <button type="button" onClick={() => stepMonth(1)} className={navBtn} title="Next month" data-testid="meta-perf-next"><ChevronRight className="h-4 w-4" /></button>
            <button type="button" onClick={() => setMonth(currentMonth())} className={`px-3 py-1.5 rounded-md border ${borderColor} text-xs font-medium ${textPrimary} hover:bg-[#6366f1]/10`} data-testid="meta-perf-current">Current</button>
          </div>
        )}
        {mode === 'year' && (
          <div className="flex items-center gap-2" data-testid="meta-perf-year-nav">
            <button type="button" onClick={() => setYear(y => y - 1)} className={navBtn} title="Previous year" data-testid="meta-perf-prev"><ChevronLeft className="h-4 w-4" /></button>
            <span className={`text-sm font-semibold ${textPrimary} min-w-[70px] text-center`}>{year}</span>
            <button type="button" onClick={() => setYear(y => y + 1)} className={navBtn} title="Next year" data-testid="meta-perf-next"><ChevronRight className="h-4 w-4" /></button>
            <button type="button" onClick={() => setYear(currentMonth().y)} className={`px-3 py-1.5 rounded-md border ${borderColor} text-xs font-medium ${textPrimary} hover:bg-[#6366f1]/10`} data-testid="meta-perf-current">Current</button>
          </div>
        )}
        {mode === 'custom' && (
          <div className="flex flex-wrap items-center gap-2" data-testid="meta-perf-custom">
            <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className={`h-9 w-40 text-sm ${bgSecondary} border ${borderColor} ${textPrimary}`} data-testid="meta-perf-from" />
            <span className={`text-xs ${textSecondary}`}>to</span>
            <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className={`h-9 w-40 text-sm ${bgSecondary} border ${borderColor} ${textPrimary}`} data-testid="meta-perf-to" />
          </div>
        )}
        <span className={`text-xs ${textSecondary}`} data-testid="meta-perf-period-label">{periodLabel}</span>
      </div>
      {rangeInvalid && <p className="text-xs text-red-500">The start date is after the end date.</p>}

      <div className={`${bgCard} border ${borderColor} rounded-xl overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className={bgSecondary}>
              <tr>
                <th className={`${th} text-left`}>Project Name</th>
                <th className={numTh}>Campaigns</th>
                <th className={numTh}>Ad Sets</th>
                <th className={numTh}>Active Ads</th>
                <th className={numTh}>New Ads</th>
                <th className={numTh}>Total Spend</th>
                <th className={numTh}>Total Leads</th>
                <th className={numTh}>Amount Recharged</th>
                <th className={numTh}>Wallet Balance</th>
                <th className={`${th} text-center w-16`}>Summary</th>
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 ? (
                <tr><td colSpan={10} className={`p-8 text-center text-xs ${textSecondary}`}>Loading…</td></tr>
              ) : error ? (
                <tr><td colSpan={10} className="p-8 text-center text-xs text-red-500">{error}</td></tr>
              ) : visible.length === 0 ? (
                <tr><td colSpan={10} className={`p-8 text-center text-xs ${textSecondary}`}>No Meta Ads projects{statusFilter !== 'all' ? ` with status “${statusFilter}”` : ''}.</td></tr>
              ) : visible.map(r => (
                <tr key={r.project_id} className={`border-t ${borderColor} ${loading ? 'opacity-60' : ''}`} data-testid={`meta-perf-row-${r.project_id}`}>
                  <td className="px-4 py-3">
                    <button type="button" onClick={() => onOpenProject(r.project_id)} className={`text-left text-sm font-medium ${textPrimary} hover:text-[#6366f1] hover:underline`} data-testid={`meta-perf-open-${r.project_id}`}>
                      {r.name}
                    </button>
                    {r.client_name && <p className={`text-[11px] ${textSecondary}`}>{r.client_name}</p>}
                  </td>
                  <td className={numTd}>{count(r.total_campaigns)}</td>
                  <td className={numTd}>{count(r.total_ad_sets)}</td>
                  <td className={numTd} title="Ads marked Published in their Ad Setup">{count(r.active_ads)}</td>
                  <td className={numTd} title={mode === 'all' ? 'All ads' : 'Ads added in this period'}>{count(r.new_ads)}</td>
                  <td className={numTd}>{money(r.total_spend)}</td>
                  <td className={numTd}>{count(r.total_leads)}</td>
                  <td className={numTd}>
                    <span className="inline-flex items-center justify-end gap-1.5">
                      {money(r.recharged)}
                      <button
                        type="button"
                        onClick={() => setRechargeFor(r)}
                        className="p-0.5 rounded text-[#6366f1] hover:bg-[#6366f1]/10"
                        title={canEditRecharges ? 'Add / view recharges' : 'View recharges'}
                        data-testid={`meta-perf-recharge-btn-${r.project_id}`}
                      >
                        {canEditRecharges ? <Plus className="h-3.5 w-3.5" /> : <Wallet className="h-3.5 w-3.5" />}
                      </button>
                    </span>
                  </td>
                  <td className={`${numTd} font-semibold ${r.wallet_balance < 0 ? '!text-red-500' : ''}`} data-testid={`meta-perf-balance-${r.project_id}`}>{money(r.wallet_balance)}</td>
                  <td className="px-4 py-3 text-center">
                    <button
                      type="button"
                      onClick={() => setSummaryFor(r)}
                      className="p-1.5 rounded-md text-[#6366f1] hover:bg-[#6366f1]/10"
                      title="View summary"
                      data-testid={`meta-perf-view-${r.project_id}`}
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            {visible.length > 0 && (
              <tfoot>
                <tr className={`border-t-2 ${borderColor} ${bgSecondary}`} data-testid="meta-perf-total-row">
                  <td className={`px-4 py-3 text-xs font-semibold uppercase ${textSecondary}`}>Total ({visible.length})</td>
                  <td className={`${numTd} font-semibold`}>{count(sum('total_campaigns'))}</td>
                  <td className={`${numTd} font-semibold`}>{count(sum('total_ad_sets'))}</td>
                  <td className={`${numTd} font-semibold`}>{count(sum('active_ads'))}</td>
                  <td className={`${numTd} font-semibold`}>{count(sum('new_ads'))}</td>
                  <td className={`${numTd} font-semibold`}>{money(sum('total_spend'))}</td>
                  <td className={`${numTd} font-semibold`}>{count(sum('total_leads'))}</td>
                  <td className={`${numTd} font-semibold`}>{money(sum('recharged'))}</td>
                  <td className={`${numTd} font-semibold ${sum('wallet_balance') < 0 ? '!text-red-500' : ''}`}>{money(sum('wallet_balance'))}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
      <p className={`text-[11px] ${textSecondary}`}>
        Campaigns, ad sets and active ads are current totals. New ads, spend, leads and recharges follow the period above.
        Wallet balance = all recharges − all spend from the daily reports.
      </p>

      {summaryFor && (
        <MetaPerformanceSummary
          project={summaryFor}
          range={range}
          periodLabel={periodLabel}
          headers={headers}
          onClose={() => setSummaryFor(null)}
          {...{ bgCard, bgSecondary, textPrimary, textSecondary, borderColor }}
        />
      )}

      {rechargeFor && (
        <RechargeModal
          project={rechargeFor}
          canEdit={canEditRecharges}
          headers={headers}
          onClose={() => setRechargeFor(null)}
          onChanged={load}
          {...{ bgCard, bgSecondary, textPrimary, textSecondary, borderColor }}
        />
      )}
    </div>
  );
}

function RechargeModal({ project, canEdit, headers, onClose, onChanged, bgCard, bgSecondary, textPrimary, textSecondary, borderColor }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(todayIST());
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const headersRef = useRef(headers);
  headersRef.current = headers;

  const loadItems = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/meta-reports/recharges/${project.project_id}`, { headers: headersRef.current });
      setItems(res.data || []);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to load recharges');
    } finally {
      setLoading(false);
    }
  }, [project.project_id]);

  useEffect(() => { loadItems(); }, [loadItems]);

  const add = async () => {
    const value = Number(amount);
    if (!date) { toast.error('Pick the recharge date'); return; }
    if (!Number.isFinite(value) || value <= 0) { toast.error('Enter an amount greater than 0'); return; }
    setSaving(true);
    try {
      await axios.post(`${API}/api/meta-reports/recharges`, { project_id: project.project_id, date, amount: value, note }, { headers: headersRef.current });
      setAmount('');
      setNote('');
      await loadItems();
      onChanged();
      toast.success('Recharge added');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to add recharge');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (item) => {
    if (!window.confirm(`Remove the ${money(item.amount)} recharge on ${fmtDate(item.date)}?`)) return;
    try {
      await axios.delete(`${API}/api/meta-reports/recharges/${item.recharge_id}`, { headers: headersRef.current });
      await loadItems();
      onChanged();
      toast.success('Recharge removed');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to remove recharge');
    }
  };

  const total = items.reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const inputCls = `h-9 text-sm ${bgSecondary} border ${borderColor} ${textPrimary}`;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4" onClick={onClose} data-testid="meta-perf-recharge-modal">
      <div className={`${bgCard} border ${borderColor} rounded-xl w-full max-w-lg max-h-[85vh] flex flex-col`} onClick={(e) => e.stopPropagation()}>
        <div className={`p-4 border-b ${borderColor} flex items-start justify-between gap-3`}>
          <div>
            <h3 className={`text-base font-semibold ${textPrimary} flex items-center gap-2`}><Wallet className="h-4 w-4 text-[#6366f1]" /> Wallet recharges</h3>
            <p className={`text-xs ${textSecondary}`}>{project.name} · {items.length} recharge{items.length === 1 ? '' : 's'} · {money(total)} all time</p>
          </div>
          <button type="button" onClick={onClose} className={textSecondary}><X className="h-5 w-5" /></button>
        </div>

        {canEdit && (
          <div className={`p-4 border-b ${borderColor} grid grid-cols-[130px_1fr] gap-3`}>
            <div>
              <label className={`text-[11px] uppercase ${textSecondary}`}>Date</label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} data-testid="meta-perf-recharge-date" />
            </div>
            <div>
              <label className={`text-[11px] uppercase ${textSecondary}`}>Amount (₹)</label>
              <Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add(); }} placeholder="e.g. 10000" className={inputCls} data-testid="meta-perf-recharge-amount" />
            </div>
            <div className="col-span-2">
              <label className={`text-[11px] uppercase ${textSecondary}`}>Note (optional)</label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add(); }} maxLength={200} placeholder="e.g. UPI top-up" className={inputCls} data-testid="meta-perf-recharge-note" />
            </div>
            <div className="col-span-2 flex justify-end">
              <Button type="button" onClick={add} disabled={saving} size="sm" className="bg-[#6366f1] hover:bg-[#4f46e5] text-white" data-testid="meta-perf-recharge-add">
                <Plus className="h-3.5 w-3.5 mr-1" /> {saving ? 'Adding…' : 'Add recharge'}
              </Button>
            </div>
          </div>
        )}

        <div className="overflow-auto flex-1">
          {loading ? (
            <p className={`p-6 text-center text-xs ${textSecondary}`}>Loading…</p>
          ) : items.length === 0 ? (
            <p className={`p-6 text-center text-xs ${textSecondary}`}>No recharges logged yet.</p>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {items.map(i => (
                  <tr key={i.recharge_id} className={`border-b last:border-b-0 ${borderColor}`} data-testid={`meta-perf-recharge-row-${i.recharge_id}`}>
                    <td className={`px-4 py-2.5 ${textPrimary} whitespace-nowrap`}>{fmtDate(i.date)}</td>
                    <td className={`px-2 py-2.5 font-medium tabular-nums ${textPrimary}`}>{money(i.amount)}</td>
                    <td className={`px-2 py-2.5 text-xs ${textSecondary}`}>
                      {i.note || '—'}
                      {i.created_by_name && <span className="block text-[10px]">by {i.created_by_name}</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {canEdit && (
                        <button type="button" onClick={() => remove(i)} className="p-1 text-red-500 hover:text-red-400" title="Remove" data-testid={`meta-perf-recharge-delete-${i.recharge_id}`}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
