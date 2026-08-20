import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { ChevronLeft, ChevronRight, Pencil, Save, X } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const PLATFORMS = [
  { id: 'instagram', label: 'Insta' },
  { id: 'facebook', label: 'FB' },
  { id: 'x', label: 'X' },
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'youtube', label: 'YouTube' },
];

const WEEKDAYS = [
  { value: 0, label: 'Monday' },
  { value: 1, label: 'Tuesday' },
  { value: 2, label: 'Wednesday' },
  { value: 3, label: 'Thursday' },
  { value: 4, label: 'Friday' },
  { value: 5, label: 'Saturday' },
  { value: 6, label: 'Sunday' },
];

const todayIso = () => new Date().toISOString().slice(0, 10);
const fmtMoney = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const fmtShortDate = (iso) => {
  try {
    return new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  } catch { return iso; }
};

export default function WeeklyChallengeTracker({ isDark, isAdmin }) {
  const token = localStorage.getItem('session_token');
  const headers = { Authorization: `Bearer ${token}` };

  const [refDate, setRefDate] = useState(todayIso());
  const [weekStartDay, setWeekStartDay] = useState(() => {
    const saved = localStorage.getItem('dashboard_week_start_day');
    return saved !== null ? Number(saved) : 1; // Tuesday default
  });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const [targets, setTargets] = useState(null);
  const [editingTargets, setEditingTargets] = useState(false);
  const [targetDraft, setTargetDraft] = useState(null);
  const [savingTargets, setSavingTargets] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/dashboard/weekly`, {
        headers,
        params: { date_str: refDate, week_start_day: weekStartDay },
      });
      setData(res.data);
    } catch (e) {
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refDate, weekStartDay]);

  const loadTargets = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/dashboard/targets`, { headers });
      setTargets(res.data);
    } catch (e) { /* silent — targets are optional */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadTargets(); }, [loadTargets]);

  useEffect(() => {
    localStorage.setItem('dashboard_week_start_day', String(weekStartDay));
  }, [weekStartDay]);

  const shiftWeek = (deltaDays) => {
    const d = new Date(`${refDate}T00:00:00`);
    d.setDate(d.getDate() + deltaDays);
    setRefDate(d.toISOString().slice(0, 10));
  };

  const startEditTargets = () => {
    setTargetDraft(targets ? JSON.parse(JSON.stringify(targets)) : null);
    setEditingTargets(true);
  };
  const saveTargets = async () => {
    setSavingTargets(true);
    try {
      const res = await axios.put(`${API}/api/dashboard/targets`, targetDraft, { headers });
      setTargets(res.data);
      setEditingTargets(false);
      toast.success('Targets saved');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to save targets');
    } finally {
      setSavingTargets(false);
    }
  };

  const bgCard = isDark ? 'bg-[#18181b] border-[#27272a]' : 'bg-white border-gray-200';
  const bgSecondary = isDark ? 'bg-[#27272a]' : 'bg-gray-100';
  const textPrimary = isDark ? 'text-[#fafafa]' : 'text-gray-900';
  const textSecondary = isDark ? 'text-[#a1a1aa]' : 'text-gray-500';
  const borderColor = isDark ? 'border-[#27272a]' : 'border-gray-200';
  const incomeText = isDark ? 'text-emerald-400' : 'text-emerald-600';
  const expenseText = isDark ? 'text-red-400' : 'text-red-600';

  // One accent per table section — carried through its group header, sub-header,
  // metric pills, and the summary/target rows so a color always maps to the
  // same section at a glance.
  const SECTION = {
    finance: { solid: 'bg-emerald-500', tint: isDark ? 'bg-emerald-500/10' : 'bg-emerald-50', border: 'border-b-emerald-500', pill: isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-700' },
    sales: { solid: 'bg-orange-500', tint: isDark ? 'bg-orange-500/10' : 'bg-orange-50', border: 'border-b-orange-500', pill: isDark ? 'bg-orange-500/20 text-orange-400' : 'bg-orange-100 text-orange-700' },
    vinoth: { solid: 'bg-sky-500', tint: isDark ? 'bg-sky-500/10' : 'bg-sky-50', border: 'border-b-sky-500', pill: isDark ? 'bg-sky-500/20 text-sky-400' : 'bg-sky-100 text-sky-700' },
    drawlead: { solid: 'bg-violet-500', tint: isDark ? 'bg-violet-500/10' : 'bg-violet-50', border: 'border-b-violet-500', pill: isDark ? 'bg-violet-500/20 text-violet-400' : 'bg-violet-100 text-violet-700' },
  };

  const thCls = `text-center p-2 text-[10px] font-semibold uppercase tracking-wide ${textSecondary} border ${borderColor} whitespace-nowrap`;
  const thGroupCls = (section) => `text-center p-2 text-[11px] font-bold uppercase tracking-wider text-white border ${borderColor} ${SECTION[section].solid} whitespace-nowrap`;
  const thSubCls = (section) => `text-center p-2 text-[10px] font-semibold uppercase tracking-wide ${textSecondary} border ${borderColor} border-b-2 ${SECTION[section].border} ${SECTION[section].tint} whitespace-nowrap`;
  const tdCls = `text-center p-2 text-sm ${textPrimary} border ${borderColor} whitespace-nowrap`;

  // Count columns (Sales, Marketing) render as a colored pill when there's
  // activity that day, and a muted "0" otherwise — so the eye lands on days
  // with something to see instead of a grid full of zeroes.
  const pill = (value, section) => {
    const v = value ?? 0;
    if (!v) return <span className={`text-sm ${textSecondary}`}>0</span>;
    return (
      <span className={`inline-flex min-w-[26px] justify-center px-2 py-0.5 rounded-full text-xs font-bold ${SECTION[section].pill}`}>
        {v}
      </span>
    );
  };
  const strongPill = (value, section) => (
    <span className={`inline-flex min-w-[30px] justify-center px-2.5 py-0.5 rounded-full text-xs font-bold text-white ${SECTION[section].solid}`}>
      {value ?? 0}
    </span>
  );

  if (loading && !data) {
    return (
      <div className={`${bgCard} border rounded-2xl p-12 text-center`} data-testid="weekly-challenge-tracker">
        <p className={textSecondary}>Loading weekly dashboard…</p>
      </div>
    );
  }
  if (!data) return null;

  const days = data.days || [];
  const summary = data.week_summary || {};
  const t = targets || {};

  return (
    <div className={`${bgCard} border rounded-2xl p-4 space-y-4`} data-testid="weekly-challenge-tracker">
      {/* Header controls */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => shiftWeek(-7)} data-testid="weekly-tracker-prev">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-center min-w-[200px]">
            <p className={`text-lg font-bold ${textPrimary}`}>
              {fmtShortDate(data.start_date)} – {fmtShortDate(data.end_date)}
            </p>
            {days.some((d) => d.is_today) && (
              <span className="text-[11px] font-medium text-emerald-500">This Week</span>
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={() => shiftWeek(7)} data-testid="weekly-tracker-next">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Input
            type="date"
            value={refDate}
            onChange={(e) => setRefDate(e.target.value)}
            className={`h-8 text-xs w-[150px] ${bgSecondary} border ${borderColor} ${textPrimary}`}
            data-testid="weekly-tracker-date-picker"
          />
          <select
            value={weekStartDay}
            onChange={(e) => setWeekStartDay(Number(e.target.value))}
            className={`h-8 text-xs rounded-md border ${borderColor} ${bgSecondary} ${textPrimary} px-2`}
            data-testid="weekly-tracker-week-start"
          >
            {WEEKDAYS.map((w) => (
              <option key={w.value} value={w.value}>Week starts {w.label}</option>
            ))}
          </select>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={() => setRefDate(todayIso())}
            data-testid="weekly-tracker-today"
          >
            Today
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-inherit">
        <table className="border-collapse w-full">
          <thead>
            <tr>
              <th className={thCls} rowSpan={2}>Day</th>
              <th className={thCls} rowSpan={2}>Date</th>
              <th className={thGroupCls('finance')} colSpan={3}>Finance</th>
              <th className={thGroupCls('sales')} colSpan={5}>Sales</th>
              <th className={thGroupCls('vinoth')} colSpan={6}>Marketing – Vinoth</th>
              <th className={thGroupCls('drawlead')} colSpan={6}>Marketing – Drawlead</th>
            </tr>
            <tr>
              <th className={thSubCls('finance')}>Income</th>
              <th className={thSubCls('finance')}>Expense</th>
              <th className={thSubCls('finance')}>Cash in Bank</th>
              <th className={thSubCls('sales')}>Inbound Lead</th>
              <th className={thSubCls('sales')}>Outbound Prospect</th>
              <th className={thSubCls('sales')}>One to One</th>
              <th className={thSubCls('sales')}>Appointment</th>
              <th className={thSubCls('sales')}>Sales</th>
              {PLATFORMS.map((p) => <th key={`v-${p.id}`} className={thSubCls('vinoth')}>{p.label}</th>)}
              <th className={thSubCls('vinoth')}>Total Posted</th>
              {PLATFORMS.map((p) => <th key={`d-${p.id}`} className={thSubCls('drawlead')}>{p.label}</th>)}
              <th className={thSubCls('drawlead')}>Total Posted</th>
            </tr>
          </thead>
          <tbody>
            {days.map((day, idx) => {
              const zebra = idx % 2 === 1 ? (isDark ? 'bg-white/[0.03]' : 'bg-gray-50') : '';
              const rowCls = day.is_today
                ? `${isDark ? 'bg-indigo-500/10' : 'bg-indigo-50'}`
                : `${zebra} ${isDark ? 'hover:bg-white/5' : 'hover:bg-gray-100/70'} transition-colors`;
              const dayCellCls = `${tdCls} font-semibold ${day.is_today ? 'border-l-4 border-l-indigo-500' : ''}`;
              return (
                <tr key={day.date} className={rowCls} data-testid={`weekly-tracker-row-${day.date}`}>
                  <td className={dayCellCls}>
                    {day.day_name}
                    {day.is_today && <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-indigo-500 align-middle" />}
                  </td>
                  <td className={tdCls}>{fmtShortDate(day.date)}</td>
                  <td className={`${tdCls} font-semibold ${incomeText}`}>{fmtMoney(day.finance.income)}</td>
                  <td className={`${tdCls} font-semibold ${expenseText}`}>{fmtMoney(day.finance.expense)}</td>
                  <td className={`${tdCls} font-semibold`}>{fmtMoney(day.finance.cash_in_bank)}</td>
                  <td className={tdCls}>{pill(day.sales.inbound_lead, 'sales')}</td>
                  <td className={tdCls}>{pill(day.sales.outbound_prospect, 'sales')}</td>
                  <td className={tdCls}>{pill(day.sales.one_to_one, 'sales')}</td>
                  <td className={tdCls}>{pill(day.sales.appointment, 'sales')}</td>
                  <td className={tdCls}>{pill(day.sales.sales, 'sales')}</td>
                  {PLATFORMS.map((p) => <td key={`v-${p.id}`} className={tdCls}>{pill(day.marketing_vinoth?.[p.id], 'vinoth')}</td>)}
                  <td className={tdCls} data-testid={`weekly-tracker-vinoth-posted-${day.date}`}>{strongPill(day.marketing_vinoth_posted_total, 'vinoth')}</td>
                  {PLATFORMS.map((p) => <td key={`d-${p.id}`} className={tdCls}>{pill(day.marketing_drawlead?.[p.id], 'drawlead')}</td>)}
                  <td className={tdCls} data-testid={`weekly-tracker-drawlead-posted-${day.date}`}>{strongPill(day.marketing_drawlead_posted_total, 'drawlead')}</td>
                </tr>
              );
            })}

            {/* Week summary */}
            <tr className={`${isDark ? 'bg-amber-500/15' : 'bg-amber-100'} font-semibold border-t-2 border-t-amber-500`}>
              <td className={tdCls} colSpan={2}>
                <span className={isDark ? 'text-amber-400' : 'text-amber-700'}>WEEK SUMMARY</span>
              </td>
              <td className={`${tdCls} ${incomeText}`}>{fmtMoney(summary.finance?.income)}</td>
              <td className={`${tdCls} ${expenseText}`}>{fmtMoney(summary.finance?.expense)}</td>
              <td className={tdCls}>—</td>
              <td className={tdCls}>{strongPill(summary.sales?.inbound_lead, 'sales')}</td>
              <td className={tdCls}>{strongPill(summary.sales?.outbound_prospect, 'sales')}</td>
              <td className={tdCls}>{strongPill(summary.sales?.one_to_one, 'sales')}</td>
              <td className={tdCls}>{strongPill(summary.sales?.appointment, 'sales')}</td>
              <td className={tdCls}>{strongPill(summary.sales?.sales, 'sales')}</td>
              {PLATFORMS.map((p) => <td key={`v-sum-${p.id}`} className={tdCls}>{summary.marketing_vinoth?.[p.id] ?? 0}</td>)}
              <td className={tdCls}>{strongPill(summary.marketing_vinoth_posted_total, 'vinoth')}</td>
              {PLATFORMS.map((p) => <td key={`d-sum-${p.id}`} className={tdCls}>{summary.marketing_drawlead?.[p.id] ?? 0}</td>)}
              <td className={tdCls}>{strongPill(summary.marketing_drawlead_posted_total, 'drawlead')}</td>
            </tr>

            {/* Target row (editable) */}
            <tr className={`${textSecondary} border-t border-dashed ${borderColor}`}>
              <td className={tdCls} colSpan={2}>
                <div className="flex items-center justify-center gap-1">
                  TARGET
                  {isAdmin && !editingTargets && (
                    <button type="button" onClick={startEditTargets} className="p-0.5 hover:opacity-70" title="Edit targets" data-testid="weekly-tracker-edit-targets">
                      <Pencil className="h-3 w-3" />
                    </button>
                  )}
                  {editingTargets && (
                    <>
                      <button type="button" onClick={saveTargets} disabled={savingTargets} className="p-0.5 text-emerald-500 hover:opacity-70" title="Save" data-testid="weekly-tracker-save-targets">
                        <Save className="h-3 w-3" />
                      </button>
                      <button type="button" onClick={() => setEditingTargets(false)} className="p-0.5 hover:opacity-70" title="Cancel">
                        <X className="h-3 w-3" />
                      </button>
                    </>
                  )}
                </div>
              </td>
              {editingTargets ? (
                <>
                  <td className={`${tdCls} ${SECTION.finance.tint}`}><Input type="number" value={targetDraft.income ?? 0} onChange={(e) => setTargetDraft((p) => ({ ...p, income: Number(e.target.value) }))} className="h-7 text-xs text-center" /></td>
                  <td className={`${tdCls} ${SECTION.finance.tint}`}><Input type="number" value={targetDraft.expense ?? 0} onChange={(e) => setTargetDraft((p) => ({ ...p, expense: Number(e.target.value) }))} className="h-7 text-xs text-center" /></td>
                  <td className={`${tdCls} ${SECTION.finance.tint}`}>—</td>
                  <td className={`${tdCls} ${SECTION.sales.tint}`}><Input type="number" value={targetDraft.inbound_lead ?? 0} onChange={(e) => setTargetDraft((p) => ({ ...p, inbound_lead: Number(e.target.value) }))} className="h-7 text-xs text-center" /></td>
                  <td className={`${tdCls} ${SECTION.sales.tint}`}><Input type="number" value={targetDraft.outbound_prospect ?? 0} onChange={(e) => setTargetDraft((p) => ({ ...p, outbound_prospect: Number(e.target.value) }))} className="h-7 text-xs text-center" /></td>
                  <td className={`${tdCls} ${SECTION.sales.tint}`}><Input type="number" value={targetDraft.one_to_one ?? 0} onChange={(e) => setTargetDraft((p) => ({ ...p, one_to_one: Number(e.target.value) }))} className="h-7 text-xs text-center" /></td>
                  <td className={`${tdCls} ${SECTION.sales.tint}`}><Input type="number" value={targetDraft.appointment ?? 0} onChange={(e) => setTargetDraft((p) => ({ ...p, appointment: Number(e.target.value) }))} className="h-7 text-xs text-center" /></td>
                  <td className={`${tdCls} ${SECTION.sales.tint}`}><Input type="number" value={targetDraft.sales ?? 0} onChange={(e) => setTargetDraft((p) => ({ ...p, sales: Number(e.target.value) }))} className="h-7 text-xs text-center" /></td>
                  {PLATFORMS.map((p) => (
                    <td key={`v-t-${p.id}`} className={`${tdCls} ${SECTION.vinoth.tint}`}>
                      <Input type="number" value={targetDraft.marketing_vinoth?.[p.id] ?? 0} onChange={(e) => setTargetDraft((prev) => ({ ...prev, marketing_vinoth: { ...prev.marketing_vinoth, [p.id]: Number(e.target.value) } }))} className="h-7 text-xs text-center" />
                    </td>
                  ))}
                  <td className={`${tdCls} ${SECTION.vinoth.tint}`}>—</td>
                  {PLATFORMS.map((p) => (
                    <td key={`d-t-${p.id}`} className={`${tdCls} ${SECTION.drawlead.tint}`}>
                      <Input type="number" value={targetDraft.marketing_drawlead?.[p.id] ?? 0} onChange={(e) => setTargetDraft((prev) => ({ ...prev, marketing_drawlead: { ...prev.marketing_drawlead, [p.id]: Number(e.target.value) } }))} className="h-7 text-xs text-center" />
                    </td>
                  ))}
                  <td className={`${tdCls} ${SECTION.drawlead.tint}`}>—</td>
                </>
              ) : (
                <>
                  <td className={`${tdCls} ${SECTION.finance.tint}`}>{fmtMoney(t.income)}</td>
                  <td className={`${tdCls} ${SECTION.finance.tint}`}>{fmtMoney(t.expense)}</td>
                  <td className={`${tdCls} ${SECTION.finance.tint}`}>—</td>
                  <td className={`${tdCls} ${SECTION.sales.tint}`}>{t.inbound_lead ?? 0}</td>
                  <td className={`${tdCls} ${SECTION.sales.tint}`}>{t.outbound_prospect ?? 0}</td>
                  <td className={`${tdCls} ${SECTION.sales.tint}`}>{t.one_to_one ?? 0}</td>
                  <td className={`${tdCls} ${SECTION.sales.tint}`}>{t.appointment ?? 0}</td>
                  <td className={`${tdCls} ${SECTION.sales.tint}`}>{t.sales ?? 0}</td>
                  {PLATFORMS.map((p) => <td key={`v-t-${p.id}`} className={`${tdCls} ${SECTION.vinoth.tint}`}>{t.marketing_vinoth?.[p.id] ?? 0}</td>)}
                  <td className={`${tdCls} ${SECTION.vinoth.tint}`}>—</td>
                  {PLATFORMS.map((p) => <td key={`d-t-${p.id}`} className={`${tdCls} ${SECTION.drawlead.tint}`}>{t.marketing_drawlead?.[p.id] ?? 0}</td>)}
                  <td className={`${tdCls} ${SECTION.drawlead.tint}`}>—</td>
                </>
              )}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
