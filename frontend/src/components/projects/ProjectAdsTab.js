import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Plus, Pencil, X, MapPin, Image as ImageIcon, Upload } from 'lucide-react';
import { todayIST, currentEntryOf, fmtDate, money, upsertBudget } from './campaignBudget';
import MetaCsvImportModal from './MetaCsvImportModal';

const API = process.env.REACT_APP_BACKEND_URL;

const parseAmount = (v) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : null; };

const AD_TYPES = [
  { id: 'static', label: 'Static' },
  { id: 'reel', label: 'Reel' },
  { id: 'carousel', label: 'Carousel' },
];

// Each piece of work on an ad can be given to a person with a due date; that
// creates a real Operations task (Department = Meta Ads) in their My Tasks,
// the same way Content Calendar cells do. Content / Creative / Editing also
// carry a link; Ad Setup is just who + by when.
const WORK = {
  content: { label: 'Content', category: 'Ad Content', hasLink: true },
  creative: { label: 'Creative', category: 'Ad Creative', hasLink: true },
  editing: { label: 'Editing', category: 'Ad Editing', hasLink: true },
  setup: { label: 'Ad Setup', category: 'Ad Setup', hasLink: false },
};

const SETUP_FLOW = ['pending', 'in_review', 'published'];
const SETUP_LABEL = { pending: 'Pending', in_review: 'In Review', published: 'Published' };
const SETUP_STYLE = {
  pending: 'bg-slate-500/20 text-slate-300 border-slate-500/40',
  in_review: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
  published: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
};
const nextSetup = (s) => SETUP_FLOW[(SETUP_FLOW.indexOf(s || 'pending') + 1) % SETUP_FLOW.length];

const TASK_LABEL = { pending: 'To do', in_progress: 'In progress', completed: 'Done' };
const TASK_STYLE = {
  pending: 'bg-slate-500/15 text-slate-400',
  in_progress: 'bg-amber-500/15 text-amber-500',
  completed: 'bg-emerald-500/15 text-emerald-500',
};
const taskLabel = (s) => TASK_LABEL[s] || String(s || '').replace(/_/g, ' ');

const typeOf = (ad) => ad.ad_type || 'static';

// CBO = the campaign holds the budget; ABO = each ad set holds its own.
// The type is a campaign-level setting (`budget_type`); until someone sets
// it, it's inferred from where a budget exists (campaign first).
const allocationOf = (campaign, adSet) => {
  const campaignEntry = currentEntryOf(campaign.budget_history);
  const adSetEntry = currentEntryOf(adSet.budget_history);
  const type = campaign.budget_type || (campaignEntry ? 'cbo' : adSetEntry ? 'abo' : null);
  const entry = type === 'cbo' ? campaignEntry : type === 'abo' ? adSetEntry : null;
  return { type, entry };
};

// Module-scope (not defined inside the tab's render) so typing in the
// popups never remounts these.
function WorkCell({ work, ad, users, tasks, canEdit, onEdit, onViewFile, textPrimary, textSecondary }) {
  const cfg = WORK[work];
  const userId = ad[`${work}_assignee`];
  const name = (users || []).find(u => u.user_id === userId)?.name || ad[`${work}_assignee_name`] || '';
  const date = ad[`${work}_date`];
  const link = cfg.hasLink ? ad[`${work}_link`] : '';
  const task = (tasks || []).find(t => t.task_id === ad[`${work}_task_id`]);
  // An image the assignee uploaded from My Tasks (Creative / Editing).
  const fileId = ad[`${work}_file_id`];
  const empty = !name && !date && !link && !fileId;
  return (
    <div className="space-y-1" data-testid={`ad-${work}-${ad.id}`}>
      {link && (
        <a href={link} target="_blank" rel="noreferrer" className="text-xs text-[#6366f1] hover:underline block">Open link</a>
      )}
      {fileId && (
        <button type="button" onClick={() => onViewFile?.(fileId)} className="text-xs text-[#6366f1] hover:underline block text-left" data-testid={`ad-${work}-file-${ad.id}`}>
          View uploaded image{ad[`${work}_file_name`] ? ` (${ad[`${work}_file_name`]})` : ''}
        </button>
      )}
      {(name || date) && (
        <p className={`text-xs ${textPrimary}`}>
          {name || 'Unassigned'}{date ? ` · ${fmtDate(date)}` : ''}
        </p>
      )}
      {task && (
        <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded ${TASK_STYLE[task.status] || TASK_STYLE.pending}`}>
          Task: {taskLabel(task.status)}
        </span>
      )}
      {empty && !canEdit && <span className={`text-xs ${textSecondary}`}>—</span>}
      {canEdit && (
        <button
          type="button"
          onClick={onEdit}
          className="text-xs text-[#6366f1] hover:underline inline-flex items-center gap-1"
          data-testid={`ad-${work}-edit-${ad.id}`}
        >
          {empty ? <><Plus className="h-3 w-3" /> Assign</> : <><Pencil className="h-3 w-3" /> Edit</>}
        </button>
      )}
    </div>
  );
}

/**
 * Meta Ads "Ads" tab — every ad from every campaign and ad set as one row.
 * Ads themselves are created inside an ad set on the Campaigns tab; this tab
 * is where each one is planned and tracked: its budget allocation, who writes
 * the content / makes the creative / edits it (video) / sets it up, and where
 * the ad setup stands.
 */
export default function ProjectAdsTab({
  project,
  users,
  onProjectUpdated,
  onTasksChanged,
  onTaskCreated,
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
  const tasks = project?.tasks || [];

  const [campaignFilter, setCampaignFilter] = useState('all');
  const [showImport, setShowImport] = useState(false);
  const [workModal, setWorkModal] = useState(null);
  const [budgetModal, setBudgetModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(null); // an uploaded creative being viewed

  const viewFile = async (fileId) => {
    try {
      const res = await axios.get(`${API}/api/ad-tasks/files/${fileId}`, { headers });
      setPreview({ name: res.data.filename, data_url: res.data.data_url });
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Could not load the image');
    }
  };

  const rows = [];
  campaigns.forEach((c) => {
    if (campaignFilter !== 'all' && c.id !== campaignFilter) return;
    (c.ad_sets || []).forEach((a) => (a.ads || []).forEach((ad) => rows.push({ c, a, ad })));
  });

  // `mutate` is handed the campaigns as they are on the server right now, not
  // this tab's copy: assignees submit from My Tasks straight into the ads
  // (content link, creative, status), so saving a stale copy of the whole
  // array would wipe those submissions out.
  const persist = async (mutate) => {
    try {
      const fresh = await axios.get(`${API}/api/projects/${project.project_id}`, { headers });
      const next = mutate(fresh.data?.campaigns || []);
      const res = await axios.patch(`${API}/api/projects/${project.project_id}`, { campaigns: next }, { headers });
      onProjectUpdated?.(res.data);
      // The PATCH response has no task list; refetch so task statuses stay.
      onTasksChanged?.();
      return true;
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to save');
      return false;
    }
  };

  const mapAd = (list, cid, sid, aid, fn) => list.map(c => (c.id !== cid ? c : {
    ...c,
    ad_sets: (c.ad_sets || []).map(s => (s.id !== sid ? s : {
      ...s,
      ads: (s.ads || []).map(ad => (ad.id === aid ? fn(ad) : ad)),
    })),
  }));

  const changeType = (row, value) => {
    if (!canEdit) return;
    persist(list => mapAd(list, row.c.id, row.a.id, row.ad.id, ad => ({ ...ad, ad_type: value })));
  };
  const cycleSetup = (row) => {
    if (!canEdit) return;
    persist(list => mapAd(list, row.c.id, row.a.id, row.ad.id, ad => ({ ...ad, setup_status: nextSetup(ad.setup_status) })));
  };

  const openWork = (row, work) => {
    if (!canEdit) return;
    const { ad } = row;
    setWorkModal({
      campaignId: row.c.id, adSetId: row.a.id, adId: ad.id, work,
      assignee: ad[`${work}_assignee`] || '',
      date: ad[`${work}_date`] || '',
      link: WORK[work].hasLink ? (ad[`${work}_link`] || '') : '',
      origLink: WORK[work].hasLink ? (ad[`${work}_link`] || '') : '',
      locked: !!ad[`${work}_task_id`],
    });
  };

  const saveWork = async () => {
    const m = workModal;
    const cfg = WORK[m.work];
    const c = campaigns.find(x => x.id === m.campaignId);
    const a = (c?.ad_sets || []).find(x => x.id === m.adSetId);
    const ad = (a?.ads || []).find(x => x.id === m.adId);
    if (!ad) { toast.error('This ad no longer exists'); setWorkModal(null); return; }
    if (m.assignee && !m.date && !m.locked) { toast.error('Pick a due date to assign this'); return; }

    setSaving(true);
    let taskId = ad[`${m.work}_task_id`] || null;
    let createdTask = false;
    if (!taskId && m.assignee && m.date) {
      try {
        const res = await axios.post(`${API}/api/projects/${project.project_id}/tasks`, {
          task_name: `${cfg.label}: ${ad.name}`,
          description: `Ad: ${ad.name} · Ad set: ${a.name} · Campaign: ${c.name}`,
          assigned_to: m.assignee,
          due_date: m.date,
          department: 'meta',
          category: cfg.category,
          // Tags the task with its ad + step so My Tasks shows the ad details
          // and enforces the order (Content, then Creative/Editing, then Ad Setup).
          ad_campaign_id: m.campaignId,
          ad_set_id: m.adSetId,
          ad_id: m.adId,
          ad_field: m.work,
        }, { headers });
        taskId = res.data?.task_id || null;
        createdTask = true;
      } catch (e) {
        toast.error(e.response?.data?.detail || 'Failed to create the task');
        setSaving(false);
        return;
      }
    }

    // Once a task exists, who/when stay as they were — reassigning is done on
    // the task itself, so this can't drift from what the assignee sees.
    const assignee = m.locked ? ad[`${m.work}_assignee`] : m.assignee;
    const date = m.locked ? ad[`${m.work}_date`] : m.date;
    const assigneeName = (users || []).find(u => u.user_id === assignee)?.name || ad[`${m.work}_assignee_name`] || '';
    const patch = {
      [`${m.work}_assignee`]: assignee || '',
      [`${m.work}_assignee_name`]: assignee ? assigneeName : '',
      [`${m.work}_date`]: date || '',
      [`${m.work}_task_id`]: taskId,
      // Only write the link if it was actually changed here — the popup may
      // have opened on a stale copy, and an assignee could have submitted the
      // real link since.
      ...(cfg.hasLink && (m.link || '').trim() !== (m.origLink || '') ? { [`${m.work}_link`]: (m.link || '').trim() } : {}),
    };
    const ok = await persist(list => mapAd(list, m.campaignId, m.adSetId, m.adId, x => ({ ...x, ...patch })));
    setSaving(false);
    if (ok) {
      toast.success(createdTask ? `${cfg.label} assigned — task created` : `${cfg.label} saved`);
      if (createdTask) onTaskCreated?.();
      setWorkModal(null);
    }
  };

  const openBudget = (row) => {
    if (!canEdit) return;
    const { type } = allocationOf(row.c, row.a);
    setBudgetModal({ campaignId: row.c.id, adSetId: row.a.id, type: type || 'cbo', amount: '', from_date: todayIST() });
  };

  const saveBudget = async () => {
    const m = budgetModal;
    const amount = parseAmount(m.amount);
    if (amount === null) { toast.error('Enter a daily budget greater than 0'); return; }
    if (!m.from_date) { toast.error('Pick the date this budget starts from'); return; }
    const apply = (list) => list.map((c) => {
      if (c.id !== m.campaignId) return c;
      if (m.type === 'cbo') {
        return { ...c, budget_type: 'cbo', budget_history: upsertBudget(c.budget_history, amount, m.from_date) };
      }
      return {
        ...c,
        budget_type: 'abo',
        ad_sets: (c.ad_sets || []).map(s => (s.id === m.adSetId ? { ...s, budget_history: upsertBudget(s.budget_history, amount, m.from_date) } : s)),
      };
    });
    setSaving(true);
    const ok = await persist(apply);
    setSaving(false);
    if (ok) { toast.success('Budget saved'); setBudgetModal(null); }
  };

  const inputCls = `${bgSecondary} border ${borderColor} ${textPrimary}`;
  const th = `text-left p-3 text-[11px] font-medium ${textSecondary} uppercase whitespace-nowrap`;

  const workRow = workModal ? (() => {
    const c = campaigns.find(x => x.id === workModal.campaignId);
    const a = (c?.ad_sets || []).find(x => x.id === workModal.adSetId);
    const ad = (a?.ads || []).find(x => x.id === workModal.adId);
    return ad ? { c, a, ad } : null;
  })() : null;
  const budgetRow = budgetModal ? (() => {
    const c = campaigns.find(x => x.id === budgetModal.campaignId);
    const a = (c?.ad_sets || []).find(x => x.id === budgetModal.adSetId);
    return c && a ? { c, a } : null;
  })() : null;

  return (
    <div className="space-y-3" data-testid="project-ads-tab">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className={`text-lg font-semibold ${textPrimary} flex items-center gap-2`}>
            <ImageIcon className="h-5 w-5 text-[#6366f1]" /> Ads
          </h3>
          <p className={`text-xs ${textSecondary}`}>
            Every ad across all campaigns. Add ads inside an ad set on the Campaigns tab.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={campaignFilter}
            onChange={(e) => setCampaignFilter(e.target.value)}
            className={`h-9 px-3 rounded-lg border ${borderColor} ${bgSecondary} ${textPrimary} text-sm`}
            data-testid="ads-campaign-filter"
          >
            <option value="all">All campaigns</option>
            {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {canEdit && (
            <Button type="button" variant="outline" onClick={() => setShowImport(true)} size="sm" data-testid="ads-import-csv-btn">
              <Upload className="h-3.5 w-3.5 mr-1" /> Import CSV
            </Button>
          )}
        </div>
      </div>

      {showImport && (
        <MetaCsvImportModal
          project={project}
          allowedLevels={['ad']}
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
            <table className="w-full min-w-[1150px]">
              <thead>
                <tr className={`border-b ${borderColor}`}>
                  <th className={th}>Ad</th>
                  <th className={th}>Location</th>
                  <th className={th}>Current Budget</th>
                  <th className={th}>Content</th>
                  <th className={th}>Ad Type</th>
                  <th className={th}>Creative</th>
                  <th className={th}>Editing</th>
                  <th className={th}>Ad Setup</th>
                  <th className={th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const { c, a, ad } = row;
                  const { type, entry } = allocationOf(c, a);
                  const isReel = typeOf(ad) === 'reel';
                  return (
                    <tr key={ad.id} className={`border-b ${borderColor} align-top`} data-testid={`ad-row-${ad.id}`}>
                      <td className="p-3 min-w-[200px]">
                        <p className={`text-sm font-medium ${textPrimary}`}>{ad.name || '—'}</p>
                        <p className={`text-xs ${textSecondary}`}>{a.name || '—'} | {c.name || '—'}</p>
                      </td>
                      <td className="p-3 min-w-[140px]">
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
                      <td className="p-3 min-w-[150px]" data-testid={`ad-budget-${ad.id}`}>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {entry ? (
                            <span className={`text-sm font-semibold ${textPrimary}`}>{money(entry.amount)}/day</span>
                          ) : (
                            <span className={`text-xs ${textSecondary}`}>No budget</span>
                          )}
                          {type && (
                            <span
                              className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${type === 'cbo' ? 'bg-indigo-500/15 text-indigo-400' : 'bg-amber-500/15 text-amber-500'}`}
                              title={type === 'cbo' ? 'CBO — budget allocated by the campaign' : 'ABO — budget allocated by the ad set'}
                            >
                              {type.toUpperCase()}
                            </span>
                          )}
                        </div>
                        {canEdit && (
                          <button type="button" onClick={() => openBudget(row)} className="text-xs text-[#6366f1] hover:underline mt-1 inline-flex items-center gap-1" data-testid={`ad-budget-set-${ad.id}`}>
                            <Plus className="h-3 w-3" /> Set budget
                          </button>
                        )}
                      </td>
                      <td className="p-3 min-w-[150px]">
                        <WorkCell work="content" ad={ad} users={users} tasks={tasks} canEdit={canEdit} onEdit={() => openWork(row, 'content')} onViewFile={viewFile} textPrimary={textPrimary} textSecondary={textSecondary} />
                      </td>
                      <td className="p-3 min-w-[130px]">
                        <Select value={typeOf(ad)} onValueChange={(v) => changeType(row, v)} disabled={!canEdit}>
                          <SelectTrigger className={`h-8 text-xs ${inputCls}`} data-testid={`ad-type-${ad.id}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {AD_TYPES.map(t => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-3 min-w-[150px]">
                        <WorkCell work="creative" ad={ad} users={users} tasks={tasks} canEdit={canEdit} onEdit={() => openWork(row, 'creative')} onViewFile={viewFile} textPrimary={textPrimary} textSecondary={textSecondary} />
                      </td>
                      <td className="p-3 min-w-[150px]">
                        {isReel ? (
                          <WorkCell work="editing" ad={ad} users={users} tasks={tasks} canEdit={canEdit} onEdit={() => openWork(row, 'editing')} onViewFile={viewFile} textPrimary={textPrimary} textSecondary={textSecondary} />
                        ) : (
                          <span className={`text-xs ${textSecondary}`} title="Editing applies to video (Reel) ads">—</span>
                        )}
                      </td>
                      <td className="p-3 min-w-[150px]">
                        <WorkCell work="setup" ad={ad} users={users} tasks={tasks} canEdit={canEdit} onEdit={() => openWork(row, 'setup')} onViewFile={viewFile} textPrimary={textPrimary} textSecondary={textSecondary} />
                      </td>
                      <td className="p-3">
                        <button
                          type="button"
                          onClick={() => cycleSetup(row)}
                          disabled={!canEdit}
                          title={canEdit ? 'Click to move to the next status' : 'Read only'}
                          className={`px-2 py-1 rounded-md text-xs font-medium border whitespace-nowrap ${SETUP_STYLE[ad.setup_status || 'pending']} ${canEdit ? 'cursor-pointer hover:opacity-80' : 'cursor-not-allowed opacity-80'}`}
                          data-testid={`ad-setup-status-${ad.id}`}
                        >
                          {SETUP_LABEL[ad.setup_status || 'pending']}
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={9} className={`p-8 text-center text-xs ${textSecondary}`}>
                      No ads yet. Add an ad inside an ad set on the Campaigns tab and it will show up here.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* z-40, not z-[70]: the Assign-to <Select> list portals to document.body
          at z-50 (ui/select.jsx), so a higher z-index here puts this popup's
          backdrop on top of the open list. */}
      {workModal && workRow && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-40 p-4" onClick={() => setWorkModal(null)}>
          <div className={`${bgCard} border ${borderColor} rounded-xl w-full max-w-sm`} onClick={(e) => e.stopPropagation()}>
            <div className={`p-5 border-b ${borderColor} flex items-center justify-between`}>
              <div>
                <h3 className={`text-base font-semibold ${textPrimary}`}>{WORK[workModal.work].label}</h3>
                <p className={`text-xs ${textSecondary} mt-0.5`}>{workRow.ad.name} · {workRow.a.name}</p>
              </div>
              <button onClick={() => setWorkModal(null)} className={textSecondary}><X className="h-5 w-5" /></button>
            </div>
            <div className="p-5 space-y-3">
              {workModal.locked && (
                <p className="text-xs text-amber-500" data-testid="ad-work-locked-note">
                  A task was already created for this, so who and when are fixed here — change the assignee on the task itself.
                </p>
              )}
              <div>
                <p className={`text-xs font-medium ${textSecondary} mb-1`}>Assign to</p>
                <Select
                  value={workModal.assignee || 'none'}
                  onValueChange={(v) => setWorkModal(m => ({ ...m, assignee: v === 'none' ? '' : v }))}
                  disabled={workModal.locked}
                >
                  <SelectTrigger className={inputCls} data-testid="ad-work-assignee"><SelectValue placeholder="Unassigned" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Unassigned —</SelectItem>
                    {(users || []).map(u => <SelectItem key={u.user_id} value={u.user_id}>{u.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <p className={`text-xs font-medium ${textSecondary} mb-1`}>Due date</p>
                <Input
                  type="date"
                  value={workModal.date}
                  onChange={(e) => setWorkModal(m => ({ ...m, date: e.target.value }))}
                  disabled={workModal.locked}
                  className={inputCls}
                  data-testid="ad-work-date"
                />
              </div>
              {WORK[workModal.work].hasLink && (
                <div>
                  <p className={`text-xs font-medium ${textSecondary} mb-1`}>{WORK[workModal.work].label} link</p>
                  <Input
                    value={workModal.link}
                    onChange={(e) => setWorkModal(m => ({ ...m, link: e.target.value }))}
                    placeholder="https://..."
                    className={inputCls}
                    data-testid="ad-work-link"
                  />
                </div>
              )}
              {!workModal.locked && (
                <p className={`text-[11px] ${textSecondary}`}>Assigning with a due date creates a task in their My Tasks.</p>
              )}
            </div>
            <div className={`p-5 border-t ${borderColor} flex items-center justify-end gap-2`}>
              <Button type="button" variant="outline" onClick={() => setWorkModal(null)}>Cancel</Button>
              <Button type="button" onClick={saveWork} disabled={saving} className="bg-[#6366f1] hover:bg-[#4f46e5] text-white" data-testid="ad-work-save">
                {saving ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {budgetModal && budgetRow && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[70] p-4" onClick={() => setBudgetModal(null)}>
          <div className={`${bgCard} border ${borderColor} rounded-xl w-full max-w-sm`} onClick={(e) => e.stopPropagation()}>
            <div className={`p-5 border-b ${borderColor} flex items-center justify-between`}>
              <div>
                <h3 className={`text-base font-semibold ${textPrimary}`}>Budget</h3>
                <p className={`text-xs ${textSecondary} mt-0.5`}>{budgetRow.a.name} | {budgetRow.c.name}</p>
              </div>
              <button onClick={() => setBudgetModal(null)} className={textSecondary}><X className="h-5 w-5" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <p className={`text-xs font-medium ${textSecondary} mb-1`}>Budget allocation</p>
                <div className={`inline-flex items-center gap-1 p-1 rounded-lg border ${borderColor}`}>
                  {[{ id: 'cbo', label: 'CBO · Campaign' }, { id: 'abo', label: 'ABO · Ad set' }].map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setBudgetModal(m => ({ ...m, type: t.id }))}
                      data-testid={`ad-budget-type-${t.id}`}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${budgetModal.type === t.id ? `${bgSecondary} ${textPrimary}` : `${textSecondary} hover:opacity-80`}`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                <p className={`text-[11px] ${textSecondary} mt-1`}>
                  {budgetModal.type === 'cbo'
                    ? `One budget for the whole campaign "${budgetRow.c.name}", shared by its ad sets.`
                    : `A budget for the ad set "${budgetRow.a.name}" only. Every ad set in this campaign then keeps its own.`}
                </p>
              </div>
              <div>
                <p className={`text-xs font-medium ${textSecondary} mb-1`}>Daily Budget (₹ per day)</p>
                <Input
                  type="number"
                  min="0"
                  value={budgetModal.amount}
                  onChange={(e) => setBudgetModal(m => ({ ...m, amount: e.target.value }))}
                  placeholder="e.g. 100"
                  className={inputCls}
                  data-testid="ad-budget-amount"
                />
              </div>
              <div>
                <p className={`text-xs font-medium ${textSecondary} mb-1`}>From Date</p>
                <Input
                  type="date"
                  value={budgetModal.from_date}
                  onChange={(e) => setBudgetModal(m => ({ ...m, from_date: e.target.value }))}
                  className={inputCls}
                  data-testid="ad-budget-from-date"
                />
                <p className={`text-[11px] ${textSecondary} mt-1`}>Applies from this date. Earlier budgets stay in the history on the Campaigns tab.</p>
              </div>
            </div>
            <div className={`p-5 border-t ${borderColor} flex items-center justify-end gap-2`}>
              <Button type="button" variant="outline" onClick={() => setBudgetModal(null)}>Cancel</Button>
              <Button type="button" onClick={saveBudget} disabled={saving} className="bg-[#6366f1] hover:bg-[#4f46e5] text-white" data-testid="ad-budget-save">
                {saving ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {preview && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-40 p-4" onClick={() => setPreview(null)}>
          <div className={`${bgCard} border ${borderColor} rounded-xl max-w-3xl w-full max-h-[90vh] overflow-auto`} onClick={(e) => e.stopPropagation()} data-testid="ad-file-preview">
            <div className={`p-4 border-b ${borderColor} flex items-center justify-between`}>
              <p className={`text-sm font-medium ${textPrimary}`}>{preview.name || 'Creative'}</p>
              <button onClick={() => setPreview(null)} className={textSecondary}><X className="h-5 w-5" /></button>
            </div>
            <div className="p-4">
              <img src={preview.data_url} alt={preview.name || 'creative'} className="max-w-full mx-auto rounded-lg" />
              <a href={preview.data_url} download={preview.name || 'creative'} className="text-xs text-[#6366f1] hover:underline mt-3 inline-block">Download</a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
