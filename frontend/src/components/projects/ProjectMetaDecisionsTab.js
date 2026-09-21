import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import {
  Gauge, ChevronLeft, ChevronRight, ChevronDown, Settings, TrendingUp,
  Ban, Wrench, Clock, HelpCircle, PauseCircle, Repeat,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

const API = process.env.REACT_APP_BACKEND_URL;

// Repo convention: "today" is the IST calendar date, never raw UTC.
const todayIST = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
const shiftDay = (iso, n) => { const d = new Date(`${iso}T00:00:00`); d.setDate(d.getDate() + n); return d.toLocaleDateString('en-CA'); };
const longDate = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' });
const shortDate = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
const money = (n) => (n == null ? '—' : `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`);
const num = (n) => (n == null ? '—' : Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 }));
const pct = (n) => (n == null ? '—' : `${Number(n).toFixed(2).replace(/\.?0+$/, '')}%`);
const WINDOWS = [3, 7, 14];

// SCALE → KEEP → WATCH → OPTIMIZE → KILL (+ REPLACE once a creative is killed).
// Reach/impressions never drive a call on their own — CPL, quality and the
// funnel do. These badges mirror meta_decision_engine.py's statuses exactly.
const STATUS_META = {
  scale: { label: 'Scale', strong: 'Strong Scale', dot: '🟢', Icon: TrendingUp, cls: 'bg-[#10b981]/15 text-[#10b981] border-[#10b981]/30' },
  keep: { label: 'Keep', dot: '🟢', Icon: TrendingUp, cls: 'bg-[#10b981]/15 text-[#10b981] border-[#10b981]/30' },
  watch: { label: 'Watch', dot: '🟡', Icon: Clock, cls: 'bg-[#f59e0b]/15 text-[#f59e0b] border-[#f59e0b]/30' },
  optimize: { label: 'Optimize', dot: '🟠', Icon: Wrench, cls: 'bg-[#f97316]/15 text-[#f97316] border-[#f97316]/30' },
  kill: { label: 'Kill', dot: '🔴', Icon: Ban, cls: 'bg-red-500/15 text-red-500 border-red-500/30' },
  no_data: { label: 'No data', dot: '⚪', Icon: HelpCircle, cls: 'bg-slate-500/10 text-slate-400 border-slate-500/20' },
  inactive: { label: 'Paused?', dot: '⚫', Icon: PauseCircle, cls: 'bg-slate-500/15 text-slate-500 border-slate-500/30' },
  no_target: { label: 'No target', dot: '⚪', Icon: HelpCircle, cls: 'bg-slate-500/10 text-slate-400 border-slate-500/20' },
};
const REPLACE_CLS = 'bg-[#3b82f6]/15 text-[#3b82f6] border-[#3b82f6]/30';

function StatusBadge({ decision }) {
  const meta = STATUS_META[decision.status] || STATUS_META.no_data;
  const label = decision.level === 'strong_scale' ? meta.strong : meta.label;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${meta.cls}`}>
      {meta.dot} {label.toUpperCase()}
    </span>
  );
}

function ReplaceChip() {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${REPLACE_CLS}`}>
      <Repeat className="h-3 w-3" /> REPLACE
    </span>
  );
}

const COUNT_ORDER = ['kill', 'scale', 'optimize', 'watch', 'keep', 'no_data', 'inactive'];

/**
 * Meta Ads "Decisions" tab — the daily SCALE / KEEP / WATCH / OPTIMIZE / KILL
 * call for every ad, worked out from the daily reports against the project's
 * target CPL (backend: meta_decision_engine.py). Reach and low spend never
 * drive a call by themselves; CPL, lead quality and the funnel do.
 */
export default function ProjectMetaDecisionsTab({
  project, isDark, bgCard, bgSecondary, textPrimary, textSecondary, borderColor,
}) {
  const projectId = project.project_id;
  const token = typeof window !== 'undefined' ? localStorage.getItem('session_token') : null;
  const headersRef = useRef({ Authorization: `Bearer ${token}` });

  const today = todayIST();
  const [day, setDay] = useState(today);
  const [windowDays, setWindowDays] = useState(null); // null until the settings tell us the default
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState({}); // { [campaignId or adSetId]: false } — collapsed only when explicitly toggled
  const [settingsOpen, setSettingsOpen] = useState(false);
  const loadSeq = useRef(0);

  const load = useCallback(async (win) => {
    const seq = ++loadSeq.current;
    setLoading(true);
    setError('');
    try {
      const params = { day };
      if (win) params.window = win;
      const res = await axios.get(`${API}/api/meta-reports/decisions/${projectId}`, { headers: headersRef.current, params });
      if (seq !== loadSeq.current) return;
      setData(res.data);
      if (!win) setWindowDays(res.data.window_days);
    } catch (e) {
      if (seq === loadSeq.current) setError(e.response?.data?.detail || 'Failed to load decisions');
    } finally {
      if (seq === loadSeq.current) setLoading(false);
    }
  }, [projectId, day]);

  useEffect(() => { load(windowDays); }, [day]); // eslint-disable-line react-hooks/exhaustive-deps
  const changeWindow = (w) => { setWindowDays(w); load(w); };

  const toggle = (id) => setExpanded((e) => ({ ...e, [id]: e[id] === false ? true : false }));
  const isOpen = (id) => expanded[id] !== false;

  const counts = data?.counts || {};
  const totals = data?.totals;
  const configured = !!data?.configured;

  const tiles = useMemo(() => {
    if (!totals) return [];
    return [
      { l: 'Total Spend', v: money(totals.spend) },
      { l: 'Total Leads', v: num(totals.leads) },
      { l: 'CPL', v: money(totals.cpl) },
      { l: 'Qualified %', v: pct(totals.qualified_pct) },
      { l: 'Cost / Appt', v: money(totals.cost_per_appointment) },
    ];
  }, [totals]);

  return (
    <div className="space-y-4" data-testid="meta-decisions-tab">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className={`text-lg font-semibold ${textPrimary} flex items-center gap-2`}><Gauge className="h-5 w-5 text-[#6366f1]" /> Decisions</h3>
          <p className={`text-xs ${textSecondary} max-w-2xl`}>
            Every ad gets a daily call — 🟢 Scale · 🟢 Keep · 🟡 Watch · 🟠 Optimize · 🔴 Kill (→ 🔵 Replace) — from its
            recent spend and CPL against your target. Reach and impressions are diagnostics, never the reason to kill an ad.
          </p>
        </div>
        {data?.can_edit_settings && (
          <Button type="button" variant="outline" size="sm" onClick={() => setSettingsOpen(true)} data-testid="meta-decisions-open-settings">
            <Settings className="h-3.5 w-3.5 mr-1" /> {configured ? 'Edit targets' : 'Set target CPL'}
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className={`inline-flex items-center gap-2 p-1 rounded-lg border ${borderColor} ${bgCard}`}>
          <button type="button" onClick={() => setDay((d) => shiftDay(d, -1))} className={`p-1.5 rounded-md ${textPrimary} hover:bg-[#6366f1]/10`} title="Previous day" data-testid="meta-decisions-prev-day"><ChevronLeft className="h-4 w-4" /></button>
          <span className={`text-sm font-semibold ${textPrimary} min-w-[150px] text-center`} data-testid="meta-decisions-day-label">{longDate(day)}</span>
          <button type="button" onClick={() => setDay((d) => (d < today ? shiftDay(d, 1) : d))} disabled={day >= today} className={`p-1.5 rounded-md ${textPrimary} hover:bg-[#6366f1]/10 disabled:opacity-30 disabled:cursor-not-allowed`} title="Next day" data-testid="meta-decisions-next-day"><ChevronRight className="h-4 w-4" /></button>
          {day !== today && (
            <button type="button" onClick={() => setDay(today)} className={`px-2 py-1 rounded-md border ${borderColor} text-xs font-medium ${textPrimary} hover:bg-[#6366f1]/10`} data-testid="meta-decisions-today">Today</button>
          )}
        </div>
        <div className={`inline-flex items-center gap-1 p-1 rounded-lg border ${borderColor} ${bgCard}`}>
          {WINDOWS.map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => changeWindow(w)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${windowDays === w ? 'bg-[#6366f1] text-white' : `${textSecondary} hover:bg-[#6366f1]/10`}`}
              data-testid={`meta-decisions-window-${w}`}
            >
              {w}-day
            </button>
          ))}
        </div>
        {data?.window && <span className={`text-xs ${textSecondary}`}>{shortDate(data.window.from)} – {shortDate(data.window.to)}</span>}
        {data && !data.day_reported && (
          <span className="text-xs text-amber-500" data-testid="meta-decisions-stale-note">
            {data.data_through ? `No report filed for ${shortDate(day)} yet — showing data through ${shortDate(data.data_through)}.` : 'No reports filed yet.'}
          </span>
        )}
      </div>

      {error ? (
        <p className="p-8 text-center text-xs text-red-500">{error}</p>
      ) : loading && !data ? (
        <p className={`p-8 text-center text-xs ${textSecondary}`}>Loading decisions…</p>
      ) : !configured ? (
        <div className={`${bgCard} border ${borderColor} rounded-xl p-8 text-center space-y-2`} data-testid="meta-decisions-no-target">
          <Gauge className={`h-8 w-8 mx-auto ${textSecondary}`} />
          <p className={`text-sm font-medium ${textPrimary}`}>No target CPL set for this project yet.</p>
          <p className={`text-xs ${textSecondary} max-w-md mx-auto`}>
            Every call here — Scale, Keep, Watch, Optimize, Kill — is measured against a target cost per lead.
            {data?.can_edit_settings ? ' Set one to turn this tab on.' : ' Ask a Super Admin, Admin or Operation Head to set one.'}
          </p>
          {data?.can_edit_settings && (
            <Button type="button" onClick={() => setSettingsOpen(true)} className="bg-[#6366f1] hover:bg-[#4f46e5] text-white" data-testid="meta-decisions-set-target-cta">Set target CPL</Button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {tiles.map((t) => (
              <div key={t.l} className={`rounded-lg border ${borderColor} ${bgSecondary} p-3`} data-testid={`meta-decisions-tile-${t.l.toLowerCase().replace(/[^a-z]+/g, '-')}`}>
                <p className={`text-xs ${textSecondary}`}>{t.l}</p>
                <p className={`text-xl font-bold ${textPrimary}`}>{t.v}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            {COUNT_ORDER.filter((k) => counts[k]).map((k) => {
              const meta = STATUS_META[k];
              return (
                <span key={k} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${meta.cls}`} data-testid={`meta-decisions-count-${k}`}>
                  {meta.dot} {counts[k]} {meta.label}
                </span>
              );
            })}
            {counts.replace > 0 && (
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${REPLACE_CLS}`} data-testid="meta-decisions-count-replace">
                <Repeat className="h-3 w-3" /> {counts.replace} need a Replacement
              </span>
            )}
          </div>

          {data.actions.length > 0 && (
            <div className={`${bgCard} border ${borderColor} rounded-xl overflow-hidden`} data-testid="meta-decisions-actions">
              <p className={`${bgSecondary} px-4 py-2 text-xs font-semibold uppercase ${textSecondary}`}>Today's actions ({data.actions.length})</p>
              {data.actions.map((a, i) => (
                <div key={i} className={`px-4 py-3 border-t ${borderColor} flex flex-wrap items-start gap-3`} data-testid={`meta-decisions-action-${a.ad_id}`}>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <StatusBadge decision={a} />
                    {a.replace && <ReplaceChip />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-medium ${textPrimary}`}>{a.ad_name || 'Untitled ad'} <span className={`font-normal ${textSecondary}`}>· {a.campaign_name} › {a.ad_set_name}</span></p>
                    <p className={`text-xs ${textSecondary}`}>{a.reason}</p>
                    <p className={`text-xs font-medium ${textPrimary}`}>→ {a.action}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-3">
            {data.campaigns.length === 0 ? (
              <p className={`${bgCard} border ${borderColor} rounded-xl p-8 text-center text-xs ${textSecondary}`}>No ads due to be reported for this day.</p>
            ) : data.campaigns.map((c) => (
              <CampaignBlock
                key={c.id} campaign={c} open={isOpen(c.id)} onToggle={() => toggle(c.id)}
                isOpenSet={isOpen} onToggleSet={toggle}
                theme={{ bgCard, bgSecondary, textPrimary, textSecondary, borderColor }}
              />
            ))}
          </div>
        </>
      )}

      {settingsOpen && (
        <SettingsPopup
          projectId={projectId}
          settings={data?.settings}
          headersRef={headersRef}
          onClose={() => setSettingsOpen(false)}
          onSaved={() => load(windowDays)}
          theme={{ bgCard, bgSecondary, textPrimary, textSecondary, borderColor }}
        />
      )}
    </div>
  );
}

const GROUP_HEALTH_META = {
  keep: { dot: '🟢', cls: 'text-[#10b981]' },
  watch: { dot: '🟡', cls: 'text-[#f59e0b]' },
  optimize: { dot: '🟠', cls: 'text-[#f97316]' },
  no_data: { dot: '⚪', cls: 'text-slate-400' },
  no_target: { dot: '⚪', cls: 'text-slate-400' },
};

function CampaignBlock({ campaign: c, open, onToggle, isOpenSet, onToggleSet, theme }) {
  const { bgCard, bgSecondary, textPrimary, textSecondary, borderColor } = theme;
  const gh = GROUP_HEALTH_META[c.health] || GROUP_HEALTH_META.no_data;
  return (
    <div className={`${bgCard} border ${borderColor} rounded-xl overflow-hidden`} data-testid={`meta-decisions-campaign-${c.id}`}>
      <button type="button" onClick={onToggle} className={`w-full ${bgSecondary} px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-left`}>
        <span className="flex items-center gap-2 min-w-0">
          {open ? <ChevronDown className={`h-4 w-4 shrink-0 ${textSecondary}`} /> : <ChevronRight className={`h-4 w-4 shrink-0 ${textSecondary}`} />}
          <span className={`text-sm font-semibold ${textPrimary} truncate`}>{c.name}</span>
          <span className={`text-xs ${gh.cls}`}>{gh.dot} {c.health === 'no_target' ? 'no target' : c.health.replace('_', ' ')}</span>
        </span>
        <span className={`text-xs ${textSecondary}`}>{num(c.metrics.leads)} leads · {money(c.metrics.spend)} · CPL {money(c.metrics.cpl)}</span>
      </button>
      {c.health === 'optimize' && c.note && (
        <p className={`px-4 py-2 text-xs ${textSecondary} border-t ${borderColor}`}>⚠️ {c.note}</p>
      )}
      {open && (
        <div className="p-3 space-y-3">
          {c.ad_sets.map((s) => (
            <AdSetBlock key={s.id} adSet={s} open={isOpenSet(s.id)} onToggle={() => onToggleSet(s.id)} theme={theme} />
          ))}
        </div>
      )}
    </div>
  );
}

function AdSetBlock({ adSet: s, open, onToggle, theme }) {
  const { bgSecondary, textPrimary, textSecondary, borderColor } = theme;
  const gh = GROUP_HEALTH_META[s.health] || GROUP_HEALTH_META.no_data;
  return (
    <div className={`border ${borderColor} rounded-lg overflow-hidden`} data-testid={`meta-decisions-adset-${s.id}`}>
      <button type="button" onClick={onToggle} className={`w-full ${bgSecondary} px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-left`}>
        <span className="flex items-center gap-2 min-w-0">
          {open ? <ChevronDown className={`h-3.5 w-3.5 shrink-0 ${textSecondary}`} /> : <ChevronRight className={`h-3.5 w-3.5 shrink-0 ${textSecondary}`} />}
          <span className={`text-xs font-semibold uppercase ${textSecondary}`}>Ad set</span>
          <span className={`text-sm font-medium ${textPrimary} truncate`}>{s.name}</span>
          <span className={`text-xs ${gh.cls}`}>{gh.dot} {s.health === 'no_target' ? 'no target' : s.health.replace('_', ' ')}</span>
          {s.replace_needed > 0 && <ReplaceChip />}
        </span>
        <span className={`text-xs ${textSecondary}`}>{num(s.metrics.leads)} leads · {money(s.metrics.spend)} · CPL {money(s.metrics.cpl)}</span>
      </button>
      {s.health === 'optimize' && s.note && (
        <p className={`px-3 py-2 text-xs ${textSecondary} border-t ${borderColor}`}>⚠️ {s.note}</p>
      )}
      {open && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className={`border-t ${borderColor}`}>
                {['Ad', 'Call', 'Spend', 'Leads', 'CPL', 'CTR', 'CPC', 'Freq.', 'Qualified %', 'Why / Do'].map((h) => (
                  <th key={h} className={`px-3 py-1.5 text-[10px] font-medium uppercase text-left ${textSecondary}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {s.ads.map((a) => (
                <tr key={a.id} className={`border-t ${borderColor}`} data-testid={`meta-decisions-ad-${a.id}`}>
                  <td className={`px-3 py-2 text-sm font-medium ${textPrimary} whitespace-nowrap`}>{a.name || 'Untitled ad'}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1 flex-wrap">
                      <StatusBadge decision={a.decision} />
                      {a.decision.replace && <ReplaceChip />}
                    </div>
                  </td>
                  <td className={`px-3 py-2 text-sm text-right tabular-nums ${textPrimary}`}>{money(a.metrics.spend)}</td>
                  <td className={`px-3 py-2 text-sm text-right tabular-nums ${textPrimary}`}>{num(a.metrics.leads)}</td>
                  <td className={`px-3 py-2 text-sm text-right tabular-nums ${textPrimary}`}>{money(a.metrics.cpl)}</td>
                  <td className={`px-3 py-2 text-sm text-right tabular-nums ${textSecondary}`}>{pct(a.metrics.ctr)}</td>
                  <td className={`px-3 py-2 text-sm text-right tabular-nums ${textSecondary}`}>{money(a.metrics.cpc)}</td>
                  <td className={`px-3 py-2 text-sm text-right tabular-nums ${textSecondary}`}>{a.metrics.frequency == null ? '—' : a.metrics.frequency.toFixed(2)}</td>
                  <td className={`px-3 py-2 text-sm text-right tabular-nums ${textSecondary}`}>{pct(a.metrics.qualified_pct)}</td>
                  <td className={`px-3 py-2 text-xs ${textSecondary} min-w-[260px]`}>
                    <p>{a.decision.reason}</p>
                    {a.decision.action && <p className={`font-medium ${textPrimary}`}>→ {a.decision.action}</p>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SettingsPopup({ projectId, settings, headersRef, onClose, onSaved, theme }) {
  const { bgCard, bgSecondary, textPrimary, textSecondary, borderColor } = theme;
  const [targetCpl, setTargetCpl] = useState(settings?.target_cpl != null ? String(settings.target_cpl) : '');
  const [minQualified, setMinQualified] = useState(settings?.min_qualified_pct != null ? String(settings.min_qualified_pct) : '30');
  const [windowDays, setWindowDays] = useState(settings?.window_days || 7);
  const [busy, setBusy] = useState(false);
  const inputCls = `h-9 w-full rounded-md border ${borderColor} ${bgSecondary} ${textPrimary} px-2 text-sm`;

  const preview = useMemo(() => {
    const t = Number(targetCpl);
    if (!(t > 0)) return null;
    return { scale: t * 0.8, keep: t * 1.2, warn: t * 1.5, kill: t * 2 };
  }, [targetCpl]);

  const save = async () => {
    const t = Number(targetCpl);
    if (!(t > 0)) { toast.error('Target CPL must be more than 0'); return; }
    const q = Number(minQualified);
    if (minQualified !== '' && (!(q >= 0) || q > 100)) { toast.error('Minimum qualified % must be between 0 and 100'); return; }
    setBusy(true);
    try {
      await axios.put(`${API}/api/meta-reports/decisions/${projectId}/settings`, {
        target_cpl: t, min_qualified_pct: minQualified === '' ? undefined : q, window_days: windowDays,
      }, { headers: headersRef.current });
      toast.success('Decision targets saved');
      onSaved();
      onClose();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Could not save the targets');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4" onClick={onClose} data-testid="meta-decisions-settings-popup">
      <div className={`${bgCard} border ${borderColor} rounded-xl w-full max-w-md`} onClick={(e) => e.stopPropagation()}>
        <div className={`p-4 border-b ${borderColor}`}>
          <h3 className={`text-base font-semibold ${textPrimary}`}>Decision targets</h3>
          <p className={`text-xs ${textSecondary}`}>These drive every Scale / Keep / Watch / Optimize / Kill call on this project.</p>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className={`text-[11px] uppercase ${textSecondary}`}>Target CPL (₹)</label>
            <Input type="number" min="0" step="any" value={targetCpl} onChange={(e) => setTargetCpl(e.target.value)} className={`h-9 text-sm ${bgSecondary} border ${borderColor} ${textPrimary}`} placeholder="e.g. 400" data-testid="meta-decisions-target-cpl-input" />
          </div>
          <div>
            <label className={`text-[11px] uppercase ${textSecondary}`}>Minimum qualified leads %</label>
            <Input type="number" min="0" max="100" step="any" value={minQualified} onChange={(e) => setMinQualified(e.target.value)} className={`h-9 text-sm ${bgSecondary} border ${borderColor} ${textPrimary}`} data-testid="meta-decisions-min-qualified-input" />
            <p className={`text-[11px] mt-1 ${textSecondary}`}>Below this, a cheap lead still gets flagged Optimize instead of Scale.</p>
          </div>
          <div>
            <label className={`text-[11px] uppercase ${textSecondary}`}>Default window</label>
            <select value={windowDays} onChange={(e) => setWindowDays(Number(e.target.value))} className={inputCls} data-testid="meta-decisions-window-select">
              {WINDOWS.map((w) => <option key={w} value={w}>{w} days</option>)}
            </select>
          </div>
          {preview && (
            <div className={`rounded-lg border ${borderColor} ${bgSecondary} p-3 text-xs ${textSecondary} space-y-1`} data-testid="meta-decisions-threshold-preview">
              <p className={`font-medium ${textPrimary}`}>Thresholds this gives you</p>
              <p>🟢 Scale at or under {money(preview.scale)} · Keep up to {money(preview.keep)}</p>
              <p>🟠 Warning at {money(preview.warn)} · 🔴 Kill at {money(preview.kill)}</p>
            </div>
          )}
        </div>
        <div className={`p-4 border-t ${borderColor} flex items-center justify-end gap-2`}>
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="button" onClick={save} disabled={busy} className="bg-[#6366f1] hover:bg-[#4f46e5] text-white" data-testid="meta-decisions-settings-save">{busy ? 'Saving…' : 'Save'}</Button>
        </div>
      </div>
    </div>
  );
}
