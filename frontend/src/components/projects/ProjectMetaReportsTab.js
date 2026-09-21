import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { BarChart3, ChevronLeft, ChevronRight, User, UserPlus, Eye, X } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import MetaDayReportPopup from './MetaDayReportPopup';

const API = process.env.REACT_APP_BACKEND_URL;

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MODES = [{ id: 'month', label: 'Monthly' }, { id: 'all', label: 'All time' }, { id: 'custom', label: 'Custom' }];

const pad = (n) => String(n).padStart(2, '0');
// Repo convention: "today" is the IST calendar date, never raw UTC.
const todayIST = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
const currentMonth = () => { const t = todayIST(); return { y: Number(t.slice(0, 4)), m: Number(t.slice(5, 7)) - 1 }; };
const isoOf = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;
const nextDay = (iso) => { const d = new Date(`${iso}T00:00:00`); d.setDate(d.getDate() + 1); return isoOf(d.getFullYear(), d.getMonth(), d.getDate()); };
const fmtShort = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const num = (n) => Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

const STATUS = {
  submitted: { label: 'Submitted', cls: 'bg-[#10b981]/15 text-[#10b981] border-[#10b981]/30' },
  legacy: { label: 'Reported', cls: 'bg-[#10b981]/15 text-[#10b981] border-[#10b981]/30' },
  partial: { label: 'In progress', cls: 'bg-[#f59e0b]/15 text-[#f59e0b] border-[#f59e0b]/30' },
  assigned: { label: 'Assigned', cls: 'bg-[#0ea5e9]/15 text-[#0ea5e9] border-[#0ea5e9]/30' },
  pending: { label: 'Not reported', cls: 'bg-slate-500/15 text-slate-400 border-slate-500/30' },
  upcoming: { label: 'Upcoming', cls: 'bg-slate-500/10 text-slate-500 border-slate-500/20' },
};

/**
 * Meta Ads "Reports" tab — a calendar of days. Each day shows what was
 * reported (leads / spend / CPL, campaign by campaign), can be handed to
 * someone (a My Tasks task due the next day) or reported right here.
 */
export default function ProjectMetaReportsTab({
  project, canEdit, users, headers,
  bgCard, bgSecondary, textPrimary, textSecondary, borderColor,
}) {
  const projectId = project.project_id;
  const headersRef = useRef(headers);
  headersRef.current = headers;

  const [mode, setMode] = useState('month');
  const [month, setMonth] = useState(currentMonth);
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [days, setDays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reportDay, setReportDay] = useState(null);
  const [assignDay, setAssignDay] = useState(null);
  const loadSeq = useRef(0);

  const range = useMemo(() => {
    if (mode === 'month') return { from: isoOf(month.y, month.m, 1), to: isoOf(month.y, month.m, new Date(month.y, month.m + 1, 0).getDate()) };
    if (mode === 'custom') return { from: customFrom, to: customTo };
    return { from: '', to: '' };
  }, [mode, month, customFrom, customTo]);
  const rangeInvalid = mode === 'custom' && !!range.from && !!range.to && range.from > range.to;
  const customIncomplete = mode === 'custom' && (!range.from || !range.to);

  const load = useCallback(async () => {
    if (rangeInvalid) return;
    const seq = ++loadSeq.current;
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (range.from) params.from = range.from;
      if (range.to) params.to = range.to;
      const res = await axios.get(`${API}/api/meta-reports/daily/${projectId}`, { headers: headersRef.current, params });
      if (seq === loadSeq.current) setDays(res.data?.days || []);
    } catch (e) {
      if (seq === loadSeq.current) setError(e.response?.data?.detail || 'Failed to load reports');
    } finally {
      if (seq === loadSeq.current) setLoading(false);
    }
  }, [projectId, range.from, range.to, rangeInvalid]);

  useEffect(() => { load(); }, [load]);

  const today = todayIST();
  const byDate = useMemo(() => Object.fromEntries(days.map(d => [d.date, d])), [days]);

  // The rows shown: every day of the month / custom range, or (All time) the
  // days that have a report or assignment, newest first.
  const rows = useMemo(() => {
    if (mode === 'all') return days.map(d => d.date);
    if (customIncomplete || rangeInvalid) return [];
    const out = [];
    let d = range.from;
    for (let n = 0; d <= range.to && n < 400; n += 1) { out.push(d); d = nextDay(d); }
    return out;
  }, [mode, days, range.from, range.to, customIncomplete, rangeInvalid]);

  const statusOf = useCallback((date) => {
    const day = byDate[date];
    if (day && day.status !== 'pending') return day.status;
    return date > today ? 'upcoming' : 'pending';
  }, [byDate, today]);

  const stats = useMemo(() => {
    let submitted = 0; let progress = 0; let pending = 0; let leads = 0; let spend = 0;
    rows.forEach(date => {
      const st = statusOf(date);
      const day = byDate[date];
      if (st === 'submitted' || st === 'legacy') submitted += 1;
      else if (st === 'partial' || st === 'assigned') progress += 1;
      else if (st === 'pending') pending += 1;
      if (day) { leads += day.leads; spend += day.spend; }
    });
    return { total: rows.length, submitted, progress, pending, leads, spend };
  }, [rows, byDate, statusOf]);

  const stepMonth = (d) => setMonth(({ y, m }) => { const t = y * 12 + m + d; return { y: Math.floor(t / 12), m: ((t % 12) + 12) % 12 }; });
  const pill = (active) => `px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${active ? 'bg-[#6366f1] text-white' : `${textSecondary} hover:bg-[#6366f1]/10`}`;
  const navBtn = `p-1.5 rounded-md border ${borderColor} ${textPrimary} hover:bg-[#6366f1]/10`;
  const theme = { bgCard, bgSecondary, textPrimary, textSecondary, borderColor };

  const dateCard = (date) => {
    const d = new Date(`${date}T00:00:00`);
    const isToday = date === today;
    return (
      <div
        className={`rounded-lg border ${isToday ? 'border-[#6366f1]' : borderColor} ${bgSecondary} px-1.5 py-2 text-center flex flex-col items-center justify-center self-stretch`}
        title={date}
        data-testid={`meta-report-date-card-${date}`}
      >
        <span className={`text-2xl font-bold leading-tight ${textPrimary}`}>{pad(d.getDate())}</span>
        <span className="text-[11px] font-medium text-[#6366f1]">{d.toLocaleDateString('en-US', { weekday: 'short' })}</span>
        <span className={`text-[10px] ${textSecondary}`}>{d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
      </div>
    );
  };

  const periodText = mode === 'month' ? `${MONTHS[month.m]} ${month.y}` : mode === 'all' ? 'All time' : range.from && range.to ? `${fmtShort(range.from)} – ${fmtShort(range.to)}` : 'Pick a date range';

  const tiles = [
    { l: 'Total Days', v: stats.total, c: 'text-[#71717a]' },
    { l: 'Submitted', v: stats.submitted, c: 'text-emerald-500' },
    { l: 'In Progress', v: stats.progress, c: 'text-amber-500' },
    { l: 'Not Reported', v: stats.pending, c: 'text-slate-400' },
    { l: 'Leads', v: num(stats.leads), c: 'text-blue-500' },
    { l: 'Spend', v: money(stats.spend), c: 'text-orange-500' },
    { l: 'Cost / Lead', v: stats.leads > 0 ? money(stats.spend / stats.leads) : '—', c: 'text-violet-500' },
  ];

  return (
    <div className="space-y-3" data-testid="meta-reports-tab">
      <div>
        <h3 className={`text-lg font-semibold ${textPrimary} flex items-center gap-2`}><BarChart3 className="h-5 w-5 text-[#6366f1]" /> Reports</h3>
        <p className={`text-xs ${textSecondary}`}>One row per day. Report a day yourself, or assign it — the assignee gets a My Tasks task due the next day.</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className={`inline-flex items-center gap-1 p-1 rounded-lg border ${borderColor} ${bgCard}`}>
          {MODES.map(m => <button key={m.id} type="button" onClick={() => setMode(m.id)} className={pill(mode === m.id)} data-testid={`meta-reports-mode-${m.id}`}>{m.label}</button>)}
        </div>
        {mode === 'month' && (
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => stepMonth(-1)} className={navBtn} title="Previous month" data-testid="meta-reports-prev"><ChevronLeft className="h-4 w-4" /></button>
            <span className={`text-sm font-semibold ${textPrimary} min-w-[140px] text-center`} data-testid="meta-reports-month-label">{MONTHS[month.m]} {month.y}</span>
            <button type="button" onClick={() => stepMonth(1)} className={navBtn} title="Next month" data-testid="meta-reports-next"><ChevronRight className="h-4 w-4" /></button>
            <button type="button" onClick={() => setMonth(currentMonth())} className={`px-3 py-1.5 rounded-md border ${borderColor} text-xs font-medium ${textPrimary} hover:bg-[#6366f1]/10`} data-testid="meta-reports-current">Current</button>
          </div>
        )}
        {mode === 'custom' && (
          <div className="flex flex-wrap items-center gap-2">
            <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className={`h-9 w-40 text-sm ${bgSecondary} border ${borderColor} ${textPrimary}`} data-testid="meta-reports-from" />
            <span className={`text-xs ${textSecondary}`}>to</span>
            <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className={`h-9 w-40 text-sm ${bgSecondary} border ${borderColor} ${textPrimary}`} data-testid="meta-reports-to" />
          </div>
        )}
        <span className={`text-xs ${textSecondary}`}>{periodText}</span>
      </div>
      {rangeInvalid && <p className="text-xs text-red-500">The start date is after the end date.</p>}

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {tiles.map(t => (
          <div key={t.l} className={`rounded-lg border ${borderColor} ${bgSecondary} p-3`} data-testid={`meta-reports-tile-${t.l.toLowerCase().replace(/[^a-z]+/g, '-')}`}>
            <p className={`text-xs ${textSecondary}`}>{t.l}</p>
            <p className={`text-xl font-bold ${t.c}`}>{t.v}</p>
          </div>
        ))}
      </div>

      <div className={`${bgCard} border ${borderColor} rounded-xl overflow-hidden`} data-testid="meta-reports-list">
        {error ? (
          <p className="p-8 text-center text-xs text-red-500">{error}</p>
        ) : loading && days.length === 0 ? (
          <p className={`p-8 text-center text-xs ${textSecondary}`}>Loading reports…</p>
        ) : rows.length === 0 ? (
          <p className={`p-8 text-center text-xs ${textSecondary}`}>
            {mode === 'custom' ? 'Pick a start and end date to list the days.' : 'No reports or assignments yet. Switch to Monthly to report or assign a day.'}
          </p>
        ) : rows.map(date => {
          const day = byDate[date];
          const st = statusOf(date);
          const meta = STATUS[st];
          const asg = day?.assignment;
          const done = st === 'submitted' || st === 'legacy';
          const future = date > today;
          const cov = day?.coverage;
          const campChips = cov ? cov.campaigns.filter(c => c.ads_total > 0) : [];
          return (
            <div key={date} className={`border-b last:border-b-0 ${borderColor} p-3 grid grid-cols-[64px_minmax(0,1fr)] sm:grid-cols-[84px_minmax(0,1fr)] gap-3 ${loading ? 'opacity-70' : ''}`} data-testid={`meta-report-day-${date}`}>
              {dateCard(date)}
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <span className={`px-2 py-1 rounded-md text-xs font-medium border ${meta.cls}`} data-testid={`meta-report-status-${date}`}>
                    {meta.label}{st === 'partial' && cov ? ` · ${cov.ads_reported}/${cov.ads_total} ads` : ''}
                  </span>
                  {day && (day.leads > 0 || day.spend > 0) && (
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                      <span className="px-2 py-0.5 rounded-full bg-[#3b82f6]/15 text-[#3b82f6] border border-[#3b82f6]/30">{num(day.leads)} Leads</span>
                      <span className="px-2 py-0.5 rounded-full bg-[#f97316]/15 text-[#f97316] border border-[#f97316]/30">{money(day.spend)}</span>
                      {day.cpl != null && <span className="px-2 py-0.5 rounded-full bg-[#8b5cf6]/15 text-[#8b5cf6] border border-[#8b5cf6]/30">CPL {money(day.cpl)}</span>}
                    </div>
                  )}
                  <div className="ml-auto flex items-center gap-2">
                    {asg && (
                      <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${asg.task_status === 'completed' ? 'text-emerald-500' : 'text-amber-500'}`} data-testid={`meta-report-assignee-${date}`}>
                        <User className="h-3.5 w-3.5" /> {asg.assigned_to_name || 'Assigned'} · {asg.task_status === 'completed' ? 'done' : `due ${fmtShort(asg.due_date)}`}
                      </span>
                    )}
                    {canEdit && !done && (
                      <Button type="button" size="sm" variant="outline" onClick={() => setAssignDay(date)} data-testid={`meta-report-assign-${date}`} title={asg ? 'Change the assignee or deadline' : "Assign this day's report"}>
                        {asg ? <User className="h-3.5 w-3.5 mr-1" /> : <UserPlus className="h-3.5 w-3.5 mr-1" />} {asg ? 'Reassign' : 'Assign'}
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => setReportDay(date)}
                      disabled={future && !done}
                      className={done ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-[#6366f1] hover:bg-[#4f46e5] text-white'}
                      title={future && !done ? "A future day can't be reported yet" : done ? 'View the submitted report' : "Fill in this day's report"}
                      data-testid={`meta-report-open-${date}`}
                    >
                      {done ? <><Eye className="h-3.5 w-3.5 mr-1" /> View Report</> : <><BarChart3 className="h-3.5 w-3.5 mr-1" /> Report</>}
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {campChips.length > 0 ? campChips.map(c => (
                    <span key={c.id} className={`text-[11px] px-2 py-0.5 rounded-full border ${c.complete ? 'border-[#10b981]/40 bg-[#10b981]/10 text-[#10b981]' : c.ads_reported ? 'border-[#f59e0b]/40 bg-[#f59e0b]/10 text-[#f59e0b]' : `${borderColor} ${textSecondary}`}`}>
                      {c.complete ? '✓ ' : ''}{c.name} · {c.ads_reported}/{c.ads_total}
                    </span>
                  )) : (
                    <span className={`text-[11px] ${textSecondary}`}>{st === 'legacy' ? 'Filed in the earlier report format.' : future ? 'Not due yet.' : 'Nothing reported yet.'}</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {reportDay && (
        <MetaDayReportPopup
          projectId={projectId}
          date={reportDay}
          headers={headers}
          canEdit={!!canEdit}
          onClose={() => setReportDay(null)}
          onChanged={load}
          {...theme}
        />
      )}
      {assignDay && (
        <AssignPopup
          projectId={projectId}
          date={assignDay}
          day={byDate[assignDay]}
          users={users || []}
          headersRef={headersRef}
          onClose={() => setAssignDay(null)}
          onChanged={load}
          {...theme}
        />
      )}
    </div>
  );
}

function AssignPopup({ projectId, date, day, users, headersRef, onClose, onChanged, bgCard, bgSecondary, textPrimary, textSecondary, borderColor }) {
  const asg = day?.assignment;
  const [person, setPerson] = useState(asg?.assigned_to || '');
  const [due, setDue] = useState(asg?.due_date || nextDay(date));
  const [busy, setBusy] = useState(false);
  const inputCls = `h-9 w-full rounded-md border ${borderColor} ${bgSecondary} ${textPrimary} px-2 text-sm`;

  const save = async () => {
    if (!person) { toast.error('Choose who should file this report'); return; }
    if (!due) { toast.error('Pick a deadline'); return; }
    setBusy(true);
    try {
      await axios.post(`${API}/api/meta-reports/daily/${projectId}/${date}/assign`, { assigned_to: person, due_date: due }, { headers: headersRef.current });
      toast.success(asg ? 'Report reassigned' : 'Report assigned — it is in their My Tasks');
      onChanged();
      onClose();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Could not assign the report');
    } finally {
      setBusy(false);
    }
  };
  const unassign = async () => {
    setBusy(true);
    try {
      await axios.delete(`${API}/api/meta-reports/daily/${projectId}/${date}/assign`, { headers: headersRef.current });
      toast.success('Assignment removed');
      onChanged();
      onClose();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Could not remove the assignment');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4" onClick={onClose} data-testid="meta-report-assign-popup">
      <div className={`${bgCard} border ${borderColor} rounded-xl w-full max-w-md`} onClick={(e) => e.stopPropagation()}>
        <div className={`p-4 border-b ${borderColor} flex items-start justify-between`}>
          <div>
            <h3 className={`text-base font-semibold ${textPrimary}`}>Assign report</h3>
            <p className={`text-xs ${textSecondary}`}>Report day {fmtShort(date)}</p>
          </div>
          <button type="button" onClick={onClose} className={textSecondary}><X className="h-5 w-5" /></button>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className={`text-[11px] uppercase ${textSecondary}`}>Assign to</label>
            <select value={person} onChange={(e) => setPerson(e.target.value)} className={inputCls} data-testid="meta-report-assign-person">
              <option value="">Select a person</option>
              {users.map(u => <option key={u.user_id} value={u.user_id}>{u.name}</option>)}
            </select>
          </div>
          <div>
            <label className={`text-[11px] uppercase ${textSecondary}`}>Deadline</label>
            <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} className={`h-9 text-sm ${bgSecondary} border ${borderColor} ${textPrimary}`} data-testid="meta-report-assign-due" />
            <p className={`text-[11px] mt-1 ${textSecondary}`}>Defaults to the day after the report day ({fmtShort(nextDay(date))}).</p>
          </div>
        </div>
        <div className={`p-4 border-t ${borderColor} flex items-center justify-between gap-2`}>
          {asg ? <Button type="button" variant="ghost" onClick={unassign} disabled={busy} className="text-red-500" data-testid="meta-report-unassign">Remove assignment</Button> : <span />}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
            <Button type="button" onClick={save} disabled={busy} className="bg-[#6366f1] hover:bg-[#4f46e5] text-white" data-testid="meta-report-assign-save">{busy ? 'Saving…' : 'Assign'}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
