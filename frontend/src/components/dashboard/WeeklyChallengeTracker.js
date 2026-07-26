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

  const thCls = `text-center p-2 text-[10px] font-semibold uppercase tracking-wide ${textSecondary} border ${borderColor} whitespace-nowrap`;
  const tdCls = `text-center p-2 text-sm ${textPrimary} border ${borderColor} whitespace-nowrap`;

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
      <div className="overflow-x-auto">
        <table className="border-collapse">
          <thead>
            <tr>
              <th className={thCls} rowSpan={2}>Day</th>
              <th className={thCls} rowSpan={2}>Date</th>
              <th className={`${thCls} bg-emerald-500/10`} colSpan={3}>Finance</th>
              <th className={`${thCls} bg-rose-500/10`} colSpan={4}>Sales</th>
              <th className={`${thCls} bg-sky-500/10`} colSpan={6}>Marketing – Vinoth</th>
              <th className={`${thCls} bg-violet-500/10`} colSpan={6}>Marketing – Drawlead</th>
            </tr>
            <tr>
              <th className={thCls}>Income</th>
              <th className={thCls}>Expense</th>
              <th className={thCls}>Cash in Bank</th>
              <th className={thCls}>Inbound Lead</th>
              <th className={thCls}>Outbound Prospect</th>
              <th className={thCls}>Appointment</th>
              <th className={thCls}>Sales</th>
              {PLATFORMS.map((p) => <th key={`v-${p.id}`} className={thCls}>{p.label}</th>)}
              <th className={thCls}>Total Posted</th>
              {PLATFORMS.map((p) => <th key={`d-${p.id}`} className={thCls}>{p.label}</th>)}
              <th className={thCls}>Total Posted</th>
            </tr>
          </thead>
          <tbody>
            {days.map((day) => (
              <tr key={day.date} className={day.is_today ? 'bg-[#6366f1]/5' : ''} data-testid={`weekly-tracker-row-${day.date}`}>
                <td className={tdCls}>{day.day_name}</td>
                <td className={tdCls}>{fmtShortDate(day.date)}</td>
                <td className={tdCls}>{fmtMoney(day.finance.income)}</td>
                <td className={tdCls}>{fmtMoney(day.finance.expense)}</td>
                <td className={tdCls}>{fmtMoney(day.finance.cash_in_bank)}</td>
                <td className={tdCls}>{day.sales.inbound_lead}</td>
                <td className={tdCls}>{day.sales.outbound_prospect}</td>
                <td className={tdCls}>{day.sales.appointment}</td>
                <td className={tdCls}>{day.sales.sales}</td>
                {PLATFORMS.map((p) => <td key={`v-${p.id}`} className={tdCls}>{day.marketing_vinoth?.[p.id] ?? 0}</td>)}
                <td className={`${tdCls} font-semibold`} data-testid={`weekly-tracker-vinoth-posted-${day.date}`}>{day.marketing_vinoth_posted_total ?? 0}</td>
                {PLATFORMS.map((p) => <td key={`d-${p.id}`} className={tdCls}>{day.marketing_drawlead?.[p.id] ?? 0}</td>)}
                <td className={`${tdCls} font-semibold`} data-testid={`weekly-tracker-drawlead-posted-${day.date}`}>{day.marketing_drawlead_posted_total ?? 0}</td>
              </tr>
            ))}

            {/* Week summary */}
            <tr className="bg-amber-400/20 font-semibold">
              <td className={tdCls} colSpan={2}>WEEK SUMMARY</td>
              <td className={tdCls}>{fmtMoney(summary.finance?.income)}</td>
              <td className={tdCls}>{fmtMoney(summary.finance?.expense)}</td>
              <td className={tdCls}>—</td>
              <td className={tdCls}>{summary.sales?.inbound_lead}</td>
              <td className={tdCls}>{summary.sales?.outbound_prospect}</td>
              <td className={tdCls}>{summary.sales?.appointment}</td>
              <td className={tdCls}>{summary.sales?.sales}</td>
              {PLATFORMS.map((p) => <td key={`v-sum-${p.id}`} className={tdCls}>{summary.marketing_vinoth?.[p.id] ?? 0}</td>)}
              <td className={tdCls}>{summary.marketing_vinoth_posted_total ?? 0}</td>
              {PLATFORMS.map((p) => <td key={`d-sum-${p.id}`} className={tdCls}>{summary.marketing_drawlead?.[p.id] ?? 0}</td>)}
              <td className={tdCls}>{summary.marketing_drawlead_posted_total ?? 0}</td>
            </tr>

            {/* Target row (editable) */}
            <tr className={`${textSecondary}`}>
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
                  <td className={tdCls}><Input type="number" value={targetDraft.income ?? 0} onChange={(e) => setTargetDraft((p) => ({ ...p, income: Number(e.target.value) }))} className="h-7 text-xs text-center" /></td>
                  <td className={tdCls}><Input type="number" value={targetDraft.expense ?? 0} onChange={(e) => setTargetDraft((p) => ({ ...p, expense: Number(e.target.value) }))} className="h-7 text-xs text-center" /></td>
                  <td className={tdCls}>—</td>
                  <td className={tdCls}><Input type="number" value={targetDraft.inbound_lead ?? 0} onChange={(e) => setTargetDraft((p) => ({ ...p, inbound_lead: Number(e.target.value) }))} className="h-7 text-xs text-center" /></td>
                  <td className={tdCls}><Input type="number" value={targetDraft.outbound_prospect ?? 0} onChange={(e) => setTargetDraft((p) => ({ ...p, outbound_prospect: Number(e.target.value) }))} className="h-7 text-xs text-center" /></td>
                  <td className={tdCls}><Input type="number" value={targetDraft.appointment ?? 0} onChange={(e) => setTargetDraft((p) => ({ ...p, appointment: Number(e.target.value) }))} className="h-7 text-xs text-center" /></td>
                  <td className={tdCls}><Input type="number" value={targetDraft.sales ?? 0} onChange={(e) => setTargetDraft((p) => ({ ...p, sales: Number(e.target.value) }))} className="h-7 text-xs text-center" /></td>
                  {PLATFORMS.map((p) => (
                    <td key={`v-t-${p.id}`} className={tdCls}>
                      <Input type="number" value={targetDraft.marketing_vinoth?.[p.id] ?? 0} onChange={(e) => setTargetDraft((prev) => ({ ...prev, marketing_vinoth: { ...prev.marketing_vinoth, [p.id]: Number(e.target.value) } }))} className="h-7 text-xs text-center" />
                    </td>
                  ))}
                  <td className={tdCls}>—</td>
                  {PLATFORMS.map((p) => (
                    <td key={`d-t-${p.id}`} className={tdCls}>
                      <Input type="number" value={targetDraft.marketing_drawlead?.[p.id] ?? 0} onChange={(e) => setTargetDraft((prev) => ({ ...prev, marketing_drawlead: { ...prev.marketing_drawlead, [p.id]: Number(e.target.value) } }))} className="h-7 text-xs text-center" />
                    </td>
                  ))}
                  <td className={tdCls}>—</td>
                </>
              ) : (
                <>
                  <td className={tdCls}>{fmtMoney(t.income)}</td>
                  <td className={tdCls}>{fmtMoney(t.expense)}</td>
                  <td className={tdCls}>—</td>
                  <td className={tdCls}>{t.inbound_lead ?? 0}</td>
                  <td className={tdCls}>{t.outbound_prospect ?? 0}</td>
                  <td className={tdCls}>{t.appointment ?? 0}</td>
                  <td className={tdCls}>{t.sales ?? 0}</td>
                  {PLATFORMS.map((p) => <td key={`v-t-${p.id}`} className={tdCls}>{t.marketing_vinoth?.[p.id] ?? 0}</td>)}
                  <td className={tdCls}>—</td>
                  {PLATFORMS.map((p) => <td key={`d-t-${p.id}`} className={tdCls}>{t.marketing_drawlead?.[p.id] ?? 0}</td>)}
                  <td className={tdCls}>—</td>
                </>
              )}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
