import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Plus, Trash2, Pencil, X, Megaphone, ChevronRight, ChevronDown, MapPin, Upload } from 'lucide-react';
import { newId, todayIST, sortHistory, currentEntryOf, prevDay, fmtDate, money, upsertBudget, mergeFreshAdWork } from './campaignBudget';
import MetaCsvImportModal from './MetaCsvImportModal';

const API = process.env.REACT_APP_BACKEND_URL;

const fmtLeads = (n) => (Number.isInteger(n) ? n : Number(n.toFixed(1))).toLocaleString('en-IN');
const parseAmount = (v) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : null; };
const parseLocations = (s) => {
  const seen = new Set();
  return String(s || '').split(',').map(x => x.trim()).filter(x => {
    const key = x.toLowerCase();
    if (!x || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const MODAL_LABEL = { campaign: 'Campaign', adset: 'Ad set', ad: 'Ad', budget: 'Budget' };

// Daily budget as a history: each entry is "₹X/day from <date>", and it runs
// until the day before the next entry starts. The entry in effect today is
// highlighted; earlier ones stay visible in the row.
function BudgetCell({ history, canEdit, onSet, onRemove, textPrimary, textSecondary, testId }) {
  const sorted = sortHistory(history);
  const today = todayIST();
  const currentId = currentEntryOf(history)?.id ?? null;
  return (
    <div className="space-y-1" data-testid={testId}>
      {sorted.length === 0 && <span className={`text-xs ${textSecondary}`}>No budget set</span>}
      {sorted.map((e, i) => {
        const next = sorted[i + 1];
        const isCurrent = e.id === currentId;
        const isUpcoming = e.from_date > today;
        const period = next ? `${fmtDate(e.from_date)} – ${fmtDate(prevDay(next.from_date))}` : `from ${fmtDate(e.from_date)}`;
        return (
          <div key={e.id} className="flex flex-wrap items-center gap-1.5">
            <span className={`text-sm ${isCurrent ? `font-semibold ${textPrimary}` : textSecondary}`}>{money(e.amount)}/day</span>
            <span className={`text-[11px] ${textSecondary}`}>{period}</span>
            {isCurrent && <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-500">Current</span>}
            {isUpcoming && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-500">Upcoming</span>}
            {canEdit && (
              <button type="button" onClick={() => onRemove(e.id)} className={`${textSecondary} hover:text-red-500`} title="Remove this budget entry">
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        );
      })}
      {canEdit && (
        <button type="button" onClick={onSet} className="text-xs text-[#6366f1] hover:underline inline-flex items-center gap-1">
          <Plus className="h-3 w-3" /> Set budget
        </button>
      )}
    </div>
  );
}

// Active/Paused pill + the Start/End Date range, if any is set. The pill
// toggles immediately (no popup); the dates themselves are edited from the
// same modal as the name (the pencil / "Edit" action).
function DatesCell({ active, startDate, endDate, canEdit, onToggle, textPrimary, textSecondary, testId }) {
  const isActive = active !== false;
  return (
    <div className="space-y-1" data-testid={testId}>
      <button
        type="button"
        onClick={onToggle}
        disabled={!canEdit}
        className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${
          isActive ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30' : 'bg-slate-500/15 text-slate-400 border-slate-500/30'
        } ${canEdit ? 'hover:opacity-80' : 'cursor-default'}`}
        title={canEdit ? (isActive ? 'Click to pause' : 'Click to activate') : ''}
        data-testid={`${testId}-toggle`}
      >
        {isActive ? 'Active' : 'Paused'}
      </button>
      {(startDate || endDate) ? (
        <p className={`text-[11px] ${textSecondary}`}>
          {startDate ? fmtDate(startDate) : 'No start'} → {endDate ? fmtDate(endDate) : 'ongoing'}
        </p>
      ) : (
        <p className={`text-[11px] ${textSecondary}`}>No dates set</p>
      )}
    </div>
  );
}

// The "Budget History" tab of the budget popup: one row per budget period
// (From, To, Budget) newest first. `leadsFor(from, to)` is only passed for
// campaigns — leads come from the daily Meta reports, which are per campaign.
function BudgetHistoryTable({ history, leadsFor, textPrimary, textSecondary, borderColor, bgSecondary }) {
  const sorted = sortHistory(history);
  if (sorted.length === 0) {
    return <p className={`text-xs ${textSecondary} py-6 text-center`}>No budget history yet.</p>;
  }
  const today = todayIST();
  const currentId = currentEntryOf(history)?.id ?? null;
  const rows = sorted
    .map((e, i) => ({ e, to: sorted[i + 1] ? prevDay(sorted[i + 1].from_date) : null }))
    .reverse();
  const th = `text-left px-3 py-2 text-[11px] font-medium ${textSecondary} uppercase`;
  return (
    <div className={`rounded-lg border ${borderColor} overflow-hidden`} data-testid="budget-history-table">
      <table className="w-full">
        <thead>
          <tr className={`border-b ${borderColor} ${bgSecondary}`}>
            <th className={th}>From</th>
            <th className={th}>To</th>
            <th className={th}>Budget</th>
            {leadsFor && <th className={th}>Leads</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ e, to }) => {
            const isCurrent = e.id === currentId;
            const isUpcoming = e.from_date > today;
            return (
              <tr key={e.id} className={`border-b last:border-b-0 ${borderColor}`} data-testid={`budget-history-row-${e.id}`}>
                <td className={`px-3 py-2 text-sm ${textPrimary}`}>{fmtDate(e.from_date)}</td>
                <td className={`px-3 py-2 text-sm ${textPrimary}`}>{to ? fmtDate(to) : (isUpcoming ? '—' : 'Present')}</td>
                <td className={`px-3 py-2 text-sm ${textPrimary}`}>
                  {money(e.amount)}/day
                  {isCurrent && <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-500">Current</span>}
                  {isUpcoming && <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-500">Upcoming</span>}
                </td>
                {leadsFor && <td className={`px-3 py-2 text-sm ${textPrimary}`}>{isUpcoming ? '—' : leadsFor(e.from_date, to)}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Campaigns tab. Every campaign is a named entry (selected from the daily
 * "Submit Report" popup on tasks, which reads only `id` + `name`). On Meta
 * Ads projects each campaign additionally carries a daily budget history and
 * ad sets — each with locations, its own budget history, and multiple ads.
 */
export default function ProjectCampaignsTab({
  project,
  onProjectUpdated,
  canEdit,
  isDark,
  bgCard,
  bgSecondary,
  textPrimary,
  textSecondary,
  borderColor,
}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('session_token') : null;
  const headers = { Authorization: `Bearer ${token}` };

  const campaigns = project?.campaigns || [];
  // Ad sets / ads / budgets are Meta Ads concepts; the same tab also serves
  // SEO projects, which keep the plain named list.
  const isMeta = (project?.departments || []).includes('meta');
  const colSpan = isMeta ? 8 : 3;

  const [modal, setModal] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [saving, setSaving] = useState(false);

  // Daily Meta reports — only used to count leads per budget period in the
  // Budget History tab, so they're fetched when that tab is opened.
  const [reports, setReports] = useState(null); // null = not loaded / failed
  const [reportsLoading, setReportsLoading] = useState(false);
  const projectId = project?.project_id;
  const loadReports = useCallback(async () => {
    setReportsLoading(true);
    try {
      const t = localStorage.getItem('session_token');
      const res = await axios.get(`${API}/api/meta-reports/project/${projectId}`, { headers: { Authorization: `Bearer ${t}` } });
      setReports(res.data || []);
    } catch (e) {
      setReports(null);
    } finally {
      setReportsLoading(false);
    }
  }, [projectId]);
  const campaignHistoryOpen = modal?.type === 'budget' && modal.tab === 'history' && modal.target === 'campaign';
  useEffect(() => {
    if (campaignHistoryOpen) loadReports();
  }, [campaignHistoryOpen, loadReports]);

  // Leads reported for one campaign between two dates (inclusive; `to` null =
  // open-ended). Sums the daily reports' entries the same way the Reports tab does.
  const leadsFor = (campaignId) => (from, to) => {
    if (reportsLoading) return '…';
    if (reports === null) return '—';
    let total = 0;
    reports.forEach((r) => {
      const d = String(r.date || '').slice(0, 10);
      if (d < from || (to && d > to)) return;
      (r.entries || []).forEach((en) => {
        if (en.campaign_id === campaignId) total += Number(en.total_leads) || 0;
      });
    });
    return fmtLeads(total);
  };
  const [expanded, setExpanded] = useState({});
  const toggle = (key) => setExpanded(prev => ({ ...prev, [key]: !prev[key] }));

  const persist = async (next) => {
    try {
      // Ads carry work done elsewhere (the Ads tab, and assignees submitting
      // from My Tasks). Take that from the server's current copy so this tab's
      // older copy of the campaigns can't wipe it out on save.
      let merged = next;
      try {
        // include_tasks=false — this only needs `.campaigns`, and the default
        // fetch drags along the project's entire (unbounded) task history.
        const fresh = await axios.get(`${API}/api/projects/${project.project_id}?include_tasks=false`, { headers });
        merged = mergeFreshAdWork(next, fresh.data?.campaigns || []);
      } catch (e) { /* couldn't re-read — save what we have */ }
      const res = await axios.patch(
        `${API}/api/projects/${project.project_id}`,
        { campaigns: merged },
        { headers },
      );
      onProjectUpdated?.(res.data);
      return true;
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to save');
      return false;
    }
  };

  const mapCampaign = (cid, fn) => campaigns.map(c => (c.id === cid ? fn(c) : c));
  const mapAdSet = (cid, aid, fn) => mapCampaign(cid, c => ({
    ...c,
    ad_sets: (c.ad_sets || []).map(a => (a.id === aid ? fn(a) : a)),
  }));

  const open = (m) => { if (canEdit) setModal(m); };
  const closeModal = () => setModal(null);

  const saveModal = async () => {
    const m = modal;
    const name = (m.name || '').trim();
    if (m.type !== 'budget' && !name) { toast.error(`${MODAL_LABEL[m.type]} name is required`); return; }
    if ((m.type === 'campaign' || m.type === 'adset' || m.type === 'ad') && m.start_date && m.end_date && m.end_date < m.start_date) {
      toast.error('End date must be on or after the start date');
      return;
    }

    let amount = null;
    if (m.type === 'budget' || String(m.amount ?? '').trim() !== '') {
      amount = parseAmount(m.amount);
      if (amount === null) { toast.error('Enter a daily budget greater than 0'); return; }
      if (!m.from_date) { toast.error('Pick the date this budget starts from'); return; }
    }
    const firstBudget = amount !== null ? [{ id: newId('bud'), amount, from_date: m.from_date }] : [];

    let next;
    let msg;
    if (m.type === 'campaign') {
      if (m.mode === 'add') {
        next = [...campaigns, { id: newId('camp'), name, budget_history: firstBudget, ad_sets: [], start_date: m.start_date || null, end_date: m.end_date || null }];
        msg = 'Campaign added';
      } else {
        next = mapCampaign(m.id, c => ({ ...c, name, start_date: m.start_date || null, end_date: m.end_date || null }));
        msg = 'Campaign updated';
      }
    } else if (m.type === 'adset') {
      const locations = parseLocations(m.locations);
      if (m.mode === 'add') {
        next = mapCampaign(m.campaignId, c => ({
          ...c,
          ad_sets: [...(c.ad_sets || []), { id: newId('adset'), name, locations, budget_history: firstBudget, ads: [], start_date: m.start_date || null, end_date: m.end_date || null }],
        }));
        msg = 'Ad set added';
      } else {
        next = mapAdSet(m.campaignId, m.id, a => ({ ...a, name, locations, start_date: m.start_date || null, end_date: m.end_date || null }));
        msg = 'Ad set updated';
      }
    } else if (m.type === 'ad') {
      if (m.mode === 'add') {
        // created_at is stamped once, here, purely for the "New Ads" count —
        // it never gates reporting; only an explicit Start/End Date does.
        next = mapAdSet(m.campaignId, m.adSetId, a => ({
          ...a,
          ads: [...(a.ads || []), {
            id: newId('ad'), name, created_at: todayIST(),
            start_date: m.start_date || null, end_date: m.end_date || null,
          }],
        }));
        msg = 'Ad added';
      } else {
        // created_at isn't edited here — it stays whatever it already was.
        next = mapAdSet(m.campaignId, m.adSetId, a => ({
          ...a,
          ads: (a.ads || []).map(x => (x.id === m.id ? {
            ...x, name, start_date: m.start_date || null, end_date: m.end_date || null,
          } : x)),
        }));
        msg = 'Ad updated';
      }
    } else if (m.target === 'campaign') {
      next = mapCampaign(m.campaignId, c => ({ ...c, budget_history: upsertBudget(c.budget_history, amount, m.from_date) }));
      msg = 'Budget saved';
    } else {
      next = mapAdSet(m.campaignId, m.adSetId, a => ({ ...a, budget_history: upsertBudget(a.budget_history, amount, m.from_date) }));
      msg = 'Budget saved';
    }

    setSaving(true);
    const ok = await persist(next);
    setSaving(false);
    if (ok) { toast.success(msg); closeModal(); }
  };

  const remove = async (confirmText, next, msg) => {
    if (!canEdit) return;
    if (!window.confirm(confirmText)) return;
    const ok = await persist(next);
    if (ok) toast.success(msg);
  };

  const deleteCampaign = (c) => {
    const n = (c.ad_sets || []).length;
    remove(
      n ? `Remove "${c.name}" and its ${n} ad set${n === 1 ? '' : 's'}?` : 'Remove this campaign?',
      campaigns.filter(x => x.id !== c.id),
      'Campaign removed',
    );
  };
  const deleteAdSet = (c, a) => {
    const n = (a.ads || []).length;
    remove(
      n ? `Remove ad set "${a.name}" and its ${n} ad${n === 1 ? '' : 's'}?` : `Remove ad set "${a.name}"?`,
      mapCampaign(c.id, cc => ({ ...cc, ad_sets: (cc.ad_sets || []).filter(x => x.id !== a.id) })),
      'Ad set removed',
    );
  };
  const deleteAd = (c, a, ad) => remove(
    `Remove ad "${ad.name}"?`,
    mapAdSet(c.id, a.id, aa => ({ ...aa, ads: (aa.ads || []).filter(x => x.id !== ad.id) })),
    'Ad removed',
  );
  const removeCampaignBudget = (c, entryId) => remove(
    'Remove this budget entry?',
    mapCampaign(c.id, cc => ({ ...cc, budget_history: (cc.budget_history || []).filter(e => e.id !== entryId) })),
    'Budget entry removed',
  );
  const removeAdSetBudget = (c, a, entryId) => remove(
    'Remove this budget entry?',
    mapAdSet(c.id, a.id, aa => ({ ...aa, budget_history: (aa.budget_history || []).filter(e => e.id !== entryId) })),
    'Budget entry removed',
  );

  // Active/Paused — a manual on/off separate from the schedule (Start/End
  // Date). Missing `active` means active, so nothing already saved changes
  // behavior. Pausing a campaign or ad set also takes every ad under it out
  // of "due for a report" (see meta_reports_routes._ad_due_on) without
  // having to touch each ad.
  const toggleCampaignActive = async (c) => {
    const wasActive = c.active !== false;
    const ok = await persist(mapCampaign(c.id, cc => ({ ...cc, active: !wasActive })));
    if (ok) toast.success(wasActive ? 'Campaign paused' : 'Campaign activated');
  };
  const toggleAdSetActive = async (c, a) => {
    const wasActive = a.active !== false;
    const ok = await persist(mapAdSet(c.id, a.id, aa => ({ ...aa, active: !wasActive })));
    if (ok) toast.success(wasActive ? 'Ad set paused' : 'Ad set activated');
  };
  const toggleAdActive = async (c, a, ad) => {
    const wasActive = ad.active !== false;
    const ok = await persist(mapAdSet(c.id, a.id, aa => ({ ...aa, ads: (aa.ads || []).map(x => (x.id === ad.id ? { ...x, active: !wasActive } : x)) })));
    if (ok) toast.success(wasActive ? 'Ad paused' : 'Ad activated');
  };

  // Total of every campaign's daily budget in effect today.
  const currentAmountOf = (history) => Number(currentEntryOf(history)?.amount) || 0;
  const totalCurrentBudget = campaigns.reduce((sum, c) => sum + currentAmountOf(c.budget_history), 0);
  const budgetedCampaigns = campaigns.filter(c => currentAmountOf(c.budget_history) > 0).length;
  const adsIn = (c) => (c.ad_sets || []).reduce((sum, a) => sum + (a.ads || []).length, 0);
  const totalAdSets = campaigns.reduce((sum, c) => sum + (c.ad_sets || []).length, 0);
  const totalAds = campaigns.reduce((sum, c) => sum + adsIn(c), 0);

  // What the budget popup is currently about (re-read from live data so the
  // history tab reflects a save/removal immediately).
  let budgetTarget = null;
  if (modal?.type === 'budget') {
    const bc = campaigns.find(x => x.id === modal.campaignId);
    if (bc && modal.target === 'adset') {
      const ba = (bc.ad_sets || []).find(x => x.id === modal.adSetId);
      if (ba) budgetTarget = { name: ba.name, history: ba.budget_history };
    } else if (bc) {
      budgetTarget = { name: bc.name, history: bc.budget_history };
    }
  }

  const inputCls = `${bgSecondary} border ${borderColor} ${textPrimary}`;
  const iconBtn = `p-1 ${textSecondary} hover:opacity-80`;
  const th = `text-left p-3 text-[11px] font-medium ${textSecondary} uppercase`;

  const renderAds = (c, a) => (
    <div className="pl-10 pr-3 py-2 space-y-1" data-testid={`adset-ads-${a.id}`}>
      <div className="flex items-center justify-between">
        <p className={`text-[11px] font-medium uppercase ${textSecondary}`}>Ads ({(a.ads || []).length})</p>
        {canEdit && (
          <button
            type="button"
            onClick={() => open({ type: 'ad', mode: 'add', campaignId: c.id, adSetId: a.id, name: '', start_date: '', end_date: '' })}
            className="text-xs text-[#6366f1] hover:underline inline-flex items-center gap-1"
            data-testid={`ad-add-${a.id}`}
          >
            <Plus className="h-3 w-3" /> Add Ad
          </button>
        )}
      </div>
      {(a.ads || []).length === 0 && <p className={`text-xs ${textSecondary}`}>No ads yet.</p>}
      {(a.ads || []).map((ad, i) => (
        <div key={ad.id} className={`flex items-center justify-between gap-2 rounded-md px-2 py-1 border ${borderColor}`} data-testid={`ad-row-${ad.id}`}>
          <span className={`text-sm ${textPrimary} min-w-0 truncate`}><span className={`text-xs ${textSecondary} mr-2`}>{i + 1}</span>{ad.name}</span>
          <span className="flex items-center gap-1.5 shrink-0" data-testid={`ad-inline-dates-${ad.id}`}>
            <button
              type="button"
              onClick={() => toggleAdActive(c, a, ad)}
              disabled={!canEdit}
              className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${
                ad.active !== false ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30' : 'bg-slate-500/15 text-slate-400 border-slate-500/30'
              } ${canEdit ? 'hover:opacity-80' : 'cursor-default'}`}
              title={canEdit ? (ad.active !== false ? 'Click to pause' : 'Click to activate') : ''}
            >
              {ad.active !== false ? 'Active' : 'Paused'}
            </button>
            {(ad.start_date || ad.end_date) && (
              <span className={`text-[10px] ${textSecondary} whitespace-nowrap`}>
                {ad.start_date ? fmtDate(ad.start_date) : 'No start'} → {ad.end_date ? fmtDate(ad.end_date) : 'ongoing'}
              </span>
            )}
          </span>
          {canEdit && (
            <span className="inline-flex gap-1 shrink-0">
              <button type="button" onClick={() => open({ type: 'ad', mode: 'edit', campaignId: c.id, adSetId: a.id, id: ad.id, name: ad.name, start_date: ad.start_date || '', end_date: ad.end_date || '' })} className={iconBtn} title="Edit ad">
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button type="button" onClick={() => deleteAd(c, a, ad)} className="p-1 text-red-500 hover:text-red-400" title="Delete">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </span>
          )}
        </div>
      ))}
    </div>
  );

  const renderAdSets = (c) => (
    <div className={`${bgSecondary} px-4 py-3 space-y-2`} data-testid={`campaign-adsets-${c.id}`}>
      <div className="flex items-center justify-between">
        <p className={`text-xs font-semibold uppercase ${textSecondary}`}>Ad Sets ({(c.ad_sets || []).length})</p>
        {canEdit && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => open({ type: 'adset', mode: 'add', campaignId: c.id, name: '', locations: '', amount: '', from_date: todayIST(), start_date: '', end_date: '' })}
            data-testid={`adset-add-${c.id}`}
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> Add Ad Set
          </Button>
        )}
      </div>
      {(c.ad_sets || []).length === 0 ? (
        <p className={`text-xs ${textSecondary}`}>No ad sets yet.</p>
      ) : (
        <div className={`rounded-lg border ${borderColor} ${bgCard} overflow-x-auto`}>
          <table className="w-full">
            <thead>
              <tr className={`border-b ${borderColor}`}>
                <th className="w-8" />
                <th className={th}>Ad Set</th>
                <th className={th}>Locations</th>
                <th className={th}>Daily Budget</th>
                <th className={th}>Ads</th>
                <th className={th}>Dates</th>
                <th className={`${th} text-right w-24`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(c.ad_sets || []).map(a => (
                <React.Fragment key={a.id}>
                  <tr className={`border-b ${borderColor} align-top`} data-testid={`adset-row-${a.id}`}>
                    <td className="p-3">
                      <button type="button" onClick={() => toggle(`a:${a.id}`)} className={textSecondary} title="Show ads">
                        {expanded[`a:${a.id}`] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </button>
                    </td>
                    <td className={`p-3 text-sm font-medium ${textPrimary}`}>{a.name || '—'}</td>
                    <td className="p-3">
                      {(a.locations || []).length === 0 ? (
                        <span className={`text-xs ${textSecondary}`}>No location</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {a.locations.map(loc => (
                            <span key={loc} className={`inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded ${bgSecondary} ${textPrimary}`}>
                              <MapPin className="h-3 w-3" />{loc}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="p-3">
                      <BudgetCell
                        history={a.budget_history}
                        canEdit={canEdit}
                        onSet={() => open({ type: 'budget', tab: 'setting', target: 'adset', campaignId: c.id, adSetId: a.id, amount: '', from_date: todayIST() })}
                        onRemove={(entryId) => removeAdSetBudget(c, a, entryId)}
                        textPrimary={textPrimary}
                        textSecondary={textSecondary}
                        testId={`adset-budget-${a.id}`}
                      />
                    </td>
                    <td className={`p-3 text-sm ${textSecondary}`}>{(a.ads || []).length}</td>
                    <td className="p-3">
                      <DatesCell
                        active={a.active}
                        startDate={a.start_date}
                        endDate={a.end_date}
                        canEdit={canEdit}
                        onToggle={() => toggleAdSetActive(c, a)}
                        textPrimary={textPrimary}
                        textSecondary={textSecondary}
                        testId={`adset-dates-${a.id}`}
                      />
                    </td>
                    <td className="p-3 text-right">
                      {canEdit && (
                        <div className="inline-flex gap-1">
                          <button
                            type="button"
                            onClick={() => open({ type: 'adset', mode: 'edit', campaignId: c.id, id: a.id, name: a.name, locations: (a.locations || []).join(', '), start_date: a.start_date || '', end_date: a.end_date || '' })}
                            className={iconBtn}
                            title="Edit ad set"
                            data-testid={`adset-edit-${a.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button type="button" onClick={() => deleteAdSet(c, a)} className="p-1 text-red-500 hover:text-red-400" title="Delete ad set" data-testid={`adset-delete-${a.id}`}>
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                  {expanded[`a:${a.id}`] && (
                    <tr className={`border-b ${borderColor}`}>
                      <td colSpan={7} className="p-0">{renderAds(c, a)}</td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-3" data-testid="project-campaigns-tab">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className={`text-lg font-semibold ${textPrimary} flex items-center gap-2`}>
            <Megaphone className="h-5 w-5 text-[#6366f1]" /> Campaigns
          </h3>
          <p className={`text-xs ${textSecondary}`}>
            Campaigns picked from the daily Submit Report popup on tasks.
          </p>
        </div>
        {canEdit && (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowImport(true)}
              size="sm"
              data-testid="campaign-import-csv-btn"
            >
              <Upload className="h-3.5 w-3.5 mr-1" /> Import CSV
            </Button>
            <Button
              type="button"
              onClick={() => open({ type: 'campaign', mode: 'add', name: '', amount: '', from_date: todayIST(), start_date: '', end_date: '' })}
              size="sm"
              className="bg-[#6366f1] hover:bg-[#4f46e5] text-white"
              data-testid="campaign-add-btn"
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Campaign
            </Button>
          </div>
        )}
      </div>

      {showImport && (
        <MetaCsvImportModal
          project={project}
          allowedLevels={['campaign', 'adset']}
          headers={headers}
          onClose={() => setShowImport(false)}
          onImported={async () => {
            const fresh = await axios.get(`${API}/api/projects/${project.project_id}`, { headers });
            onProjectUpdated(fresh.data);
          }}
          bgCard={bgCard}
          bgSecondary={bgSecondary}
          textPrimary={textPrimary}
          textSecondary={textSecondary}
          borderColor={borderColor}
        />
      )}

      <Card className={`${bgCard} border ${borderColor}`}>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className={`border-b ${borderColor}`}>
                  {isMeta && <th className="w-8" />}
                  <th className={`${th} w-12`}>S.No</th>
                  <th className={th}>Campaign Name</th>
                  {isMeta && <th className={th}>Daily Budget</th>}
                  {isMeta && <th className={th}>Ad Sets</th>}
                  {isMeta && <th className={th}>Ads</th>}
                  {isMeta && <th className={th}>Dates</th>}
                  <th className={`${th} text-right w-24`}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c, idx) => (
                  <React.Fragment key={c.id}>
                    <tr className={`border-b ${borderColor} align-top`} data-testid={`campaign-row-${c.id}`}>
                      {isMeta && (
                        <td className="p-3">
                          <button type="button" onClick={() => toggle(`c:${c.id}`)} className={textSecondary} title="Show ad sets" data-testid={`campaign-expand-${c.id}`}>
                            {expanded[`c:${c.id}`] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </button>
                        </td>
                      )}
                      <td className={`p-3 text-xs ${textSecondary}`}>{idx + 1}</td>
                      <td className={`p-3 text-sm font-medium ${textPrimary}`}>{c.name || '—'}</td>
                      {isMeta && (
                        <td className="p-3">
                          <BudgetCell
                            history={c.budget_history}
                            canEdit={canEdit}
                            onSet={() => open({ type: 'budget', tab: 'setting', target: 'campaign', campaignId: c.id, amount: '', from_date: todayIST() })}
                            onRemove={(entryId) => removeCampaignBudget(c, entryId)}
                            textPrimary={textPrimary}
                            textSecondary={textSecondary}
                            testId={`campaign-budget-${c.id}`}
                          />
                        </td>
                      )}
                      {isMeta && <td className={`p-3 text-sm ${textSecondary}`} data-testid={`campaign-adsets-count-${c.id}`}>{(c.ad_sets || []).length}</td>}
                      {isMeta && <td className={`p-3 text-sm ${textSecondary}`} data-testid={`campaign-ads-count-${c.id}`}>{adsIn(c)}</td>}
                      {isMeta && (
                        <td className="p-3">
                          <DatesCell
                            active={c.active}
                            startDate={c.start_date}
                            endDate={c.end_date}
                            canEdit={canEdit}
                            onToggle={() => toggleCampaignActive(c)}
                            textPrimary={textPrimary}
                            textSecondary={textSecondary}
                            testId={`campaign-dates-${c.id}`}
                          />
                        </td>
                      )}
                      <td className="p-3 text-right">
                        <div className="inline-flex gap-1">
                          {canEdit && (
                            <button type="button" onClick={() => open({ type: 'campaign', mode: 'edit', id: c.id, name: c.name, start_date: c.start_date || '', end_date: c.end_date || '' })} className={iconBtn} title="Rename" data-testid={`campaign-edit-${c.id}`}>
                              <Pencil className="h-4 w-4" />
                            </button>
                          )}
                          {canEdit && (
                            <button type="button" onClick={() => deleteCampaign(c)} className="p-1 text-red-500 hover:text-red-400" title="Delete" data-testid={`campaign-delete-${c.id}`}>
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {isMeta && expanded[`c:${c.id}`] && (
                      <tr className={`border-b ${borderColor}`}>
                        <td colSpan={colSpan} className="p-0">{renderAdSets(c)}</td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
                {campaigns.length === 0 && (
                  <tr>
                    <td colSpan={colSpan} className={`p-8 text-center text-xs ${textSecondary}`}>
                      No campaigns yet. {canEdit && <span>Click <span className="font-medium">Add Campaign</span> to add one.</span>}
                    </td>
                  </tr>
                )}
              </tbody>
              {isMeta && campaigns.length > 0 && (
                <tfoot>
                  <tr className={`border-t-2 ${borderColor} ${bgSecondary}`} data-testid="campaign-budget-total-row">
                    <td colSpan={3} className={`p-3 text-right text-xs font-semibold uppercase ${textSecondary}`}>
                      Total
                    </td>
                    <td className="p-3">
                      <span className={`text-sm font-semibold ${textPrimary}`} data-testid="campaign-budget-total">{money(totalCurrentBudget)}/day</span>
                      <span className={`text-[11px] ${textSecondary} ml-2`}>{budgetedCampaigns} of {campaigns.length} campaign{campaigns.length === 1 ? '' : 's'} with a budget</span>
                    </td>
                    <td className={`p-3 text-sm font-semibold ${textPrimary}`} data-testid="campaign-adsets-total">{totalAdSets}</td>
                    <td className={`p-3 text-sm font-semibold ${textPrimary}`} data-testid="campaign-ads-total">{totalAds}</td>
                    <td />
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </CardContent>
      </Card>

      {modal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[70] p-4" onClick={closeModal}>
          <div className={`${bgCard} border ${borderColor} rounded-xl w-full ${modal.type === 'budget' ? 'max-w-lg' : 'max-w-sm'}`} onClick={(e) => e.stopPropagation()}>
            <div className={`p-5 border-b ${borderColor} flex items-center justify-between`}>
              <div>
                <h3 className={`text-base font-semibold ${textPrimary} flex items-center gap-2`}>
                  <Megaphone className="h-4 w-4 text-[#6366f1]" />
                  {modal.type === 'budget'
                    ? `${modal.target === 'adset' ? 'Ad Set' : 'Campaign'} Daily Budget`
                    : `${modal.mode === 'add' ? 'Add' : 'Edit'} ${MODAL_LABEL[modal.type]}`}
                </h3>
                {modal.type === 'budget' && budgetTarget?.name && (
                  <p className={`text-xs ${textSecondary} mt-0.5`}>{budgetTarget.name}</p>
                )}
              </div>
              <button onClick={closeModal} className={textSecondary}>
                <X className="h-5 w-5" />
              </button>
            </div>
            {modal.type === 'budget' && (
              <div className={`px-5 pt-4`}>
                <div className={`inline-flex items-center gap-1 p-1 rounded-lg border ${borderColor}`}>
                  {[{ id: 'setting', label: 'Budget Setting' }, { id: 'history', label: 'Budget History' }].map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setModal(m => ({ ...m, tab: t.id }))}
                      data-testid={`budget-tab-${t.id}`}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                        modal.tab === t.id ? `${bgSecondary} ${textPrimary}` : `${textSecondary} hover:opacity-80`
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="p-5 space-y-3">
              {modal.type === 'budget' && modal.tab === 'history' && (
                <>
                  <BudgetHistoryTable
                    history={budgetTarget?.history}
                    leadsFor={modal.target === 'campaign' ? leadsFor(modal.campaignId) : null}
                    textPrimary={textPrimary}
                    textSecondary={textSecondary}
                    borderColor={borderColor}
                    bgSecondary={bgSecondary}
                  />
                  {modal.target === 'adset' && (
                    <p className={`text-[11px] ${textSecondary}`}>Leads are reported per campaign in the daily reports, so they aren't split by ad set.</p>
                  )}
                </>
              )}
              {modal.type === 'budget' && modal.tab !== 'history' && (
                <p className={`text-xs ${textSecondary}`} data-testid="budget-current-line">
                  {currentEntryOf(budgetTarget?.history)
                    ? `Current: ${money(currentEntryOf(budgetTarget?.history).amount)}/day since ${fmtDate(currentEntryOf(budgetTarget?.history).from_date)}`
                    : 'No budget in effect yet.'}
                </p>
              )}
              {modal.type !== 'budget' && (
                <div>
                  <p className={`text-xs font-medium ${textSecondary} mb-1`}>{MODAL_LABEL[modal.type]} Name</p>
                  <Input
                    value={modal.name}
                    onChange={(e) => setModal(m => ({ ...m, name: e.target.value }))}
                    placeholder={modal.type === 'campaign' ? 'e.g. Summer Sale Leads' : modal.type === 'adset' ? 'e.g. Chennai Homeowners' : 'e.g. Video Ad 1'}
                    className={inputCls}
                    data-testid="campaign-form-name"
                    autoFocus
                  />
                </div>
              )}
              {modal.type === 'adset' && (
                <div>
                  <p className={`text-xs font-medium ${textSecondary} mb-1`}>Locations</p>
                  <Input
                    value={modal.locations}
                    onChange={(e) => setModal(m => ({ ...m, locations: e.target.value }))}
                    placeholder="e.g. Chennai, Coimbatore, Madurai"
                    className={inputCls}
                    data-testid="adset-form-locations"
                  />
                  <p className={`text-[11px] ${textSecondary} mt-1`}>Separate multiple locations with commas.</p>
                </div>
              )}
              {isMeta && (modal.type === 'campaign' || modal.type === 'adset' || modal.type === 'ad') && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className={`text-xs font-medium ${textSecondary} mb-1`}>Start Date</p>
                    <Input
                      type="date"
                      value={modal.start_date || ''}
                      onChange={(e) => setModal(m => ({ ...m, start_date: e.target.value }))}
                      className={inputCls}
                      data-testid="campaign-form-start-date"
                    />
                  </div>
                  <div>
                    <p className={`text-xs font-medium ${textSecondary} mb-1`}>End Date</p>
                    <Input
                      type="date"
                      value={modal.end_date || ''}
                      onChange={(e) => setModal(m => ({ ...m, end_date: e.target.value }))}
                      className={inputCls}
                      data-testid="campaign-form-end-date"
                    />
                  </div>
                  <p className={`text-[11px] ${textSecondary} col-span-2`}>
                    Reports for this {modal.type === 'campaign' ? 'campaign' : modal.type === 'adset' ? 'ad set' : 'ad'}
                    {modal.type !== 'ad' && ' (and everything under it)'} are only expected on or after the start date, and stop being expected after the end date. Leave both blank for no restriction.
                  </p>
                </div>
              )}
              {((modal.type === 'budget' && modal.tab !== 'history') || (isMeta && modal.mode === 'add' && (modal.type === 'campaign' || modal.type === 'adset'))) && (
                <>
                  <div>
                    <p className={`text-xs font-medium ${textSecondary} mb-1`}>
                      Daily Budget (₹ per day){modal.type !== 'budget' && ' — optional'}
                    </p>
                    <Input
                      type="number"
                      min="0"
                      value={modal.amount}
                      onChange={(e) => setModal(m => ({ ...m, amount: e.target.value }))}
                      placeholder="e.g. 100"
                      className={inputCls}
                      data-testid="budget-form-amount"
                    />
                  </div>
                  <div>
                    <p className={`text-xs font-medium ${textSecondary} mb-1`}>From Date</p>
                    <Input
                      type="date"
                      value={modal.from_date}
                      onChange={(e) => setModal(m => ({ ...m, from_date: e.target.value }))}
                      className={inputCls}
                      data-testid="budget-form-from-date"
                    />
                    {modal.type === 'budget' && (
                      <p className={`text-[11px] ${textSecondary} mt-1`}>
                        Applies from this date. The earlier budget stays in the history.
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
            <div className={`p-5 border-t ${borderColor} flex items-center justify-end gap-2`}>
              {modal.type === 'budget' && modal.tab === 'history' ? (
                <Button type="button" variant="outline" onClick={closeModal}>Close</Button>
              ) : (
                <>
                  <Button type="button" variant="outline" onClick={closeModal}>Cancel</Button>
                  <Button
                    type="button"
                    onClick={saveModal}
                    disabled={saving}
                    className="bg-[#6366f1] hover:bg-[#4f46e5] text-white"
                    data-testid="campaign-form-save"
                  >
                    {saving ? 'Saving…' : 'Save'}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
