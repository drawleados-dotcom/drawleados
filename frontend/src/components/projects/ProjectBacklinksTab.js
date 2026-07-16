import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Plus, Trash2, X, Link2, Target } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const LINK_TYPES = ['Dofollow', 'Nofollow'];
const SUBMISSION_TYPES = [
  'Local Citation Submission',
  'Social Bookmarking Submission',
  'Profile Creation Submission',
  'Directory Submission',
  'Article Submission',
  'Guest Post Submission',
  'Q&A Submission',
];
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const newId = (prefix) => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
const todayIso = () => new Date().toISOString().slice(0, 10);
const emptyDraftRow = () => ({
  id: newId('bl'),
  date: todayIso(),
  domain: '',
  url: '',
  domain_authority: '',
  link_type: 'Dofollow',
  submission_type: SUBMISSION_TYPES[0],
});

// Monday of the week containing `d` — the Backlinks week runs Mon-Sat.
const mondayOf = (d) => {
  const date = new Date(d);
  const day = date.getDay(); // 0=Sun..6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
};
const isoDate = (d) => d.toISOString().slice(0, 10);
const addDays = (d, n) => { const nd = new Date(d); nd.setDate(nd.getDate() + n); return nd; };
const fmtShort = (d) => d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });

/**
 * SEO "Backlinks" tab: a submission log (Domain / Url / Domain Authority /
 * Dofollow-Nofollow / Type) plus a Weekly Backlink Target — set a number +
 * assignee, and it creates 6 real Operations tasks (Monday-Saturday, each
 * with its own share of the target) so the work is trackable like any
 * other SEO task. The daily "balance" is a running countdown: target minus
 * everything logged in the Backlinks table so far that week.
 */
export default function ProjectBacklinksTab({
  project, onProjectUpdated, onTaskCreated, canEdit, users,
  isDark, bgCard, bgSecondary, textPrimary, textSecondary, borderColor,
}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('session_token') : null;
  const headers = { Authorization: `Bearer ${token}` };

  const backlinks = project?.backlinks || [];
  const weeklyTargets = project?.backlink_weekly_targets || [];

  const [showAddModal, setShowAddModal] = useState(false);
  const [draftRows, setDraftRows] = useState([]);
  const [saving, setSaving] = useState(false);

  const [showTargetModal, setShowTargetModal] = useState(false);
  const [targetDraft, setTargetDraft] = useState({ target: '', assignee: '' });
  const [savingTarget, setSavingTarget] = useState(false);

  const persist = async (patch) => {
    try {
      const res = await axios.patch(`${API}/api/projects/${project.project_id}`, patch, { headers });
      onProjectUpdated?.(res.data);
      return true;
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to save');
      return false;
    }
  };

  // ---- Backlinks list ----
  const sortedBacklinks = [...backlinks].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  const openAddModal = () => { setDraftRows([emptyDraftRow()]); setShowAddModal(true); };
  const closeAddModal = () => { setShowAddModal(false); setDraftRows([]); };
  const addDraftRow = () => setDraftRows((rows) => [...rows, emptyDraftRow()]);
  const removeDraftRow = (id) => setDraftRows((rows) => rows.filter((r) => r.id !== id));
  const updateDraftRow = (id, patch) => setDraftRows((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const saveDraftRows = async () => {
    for (const row of draftRows) {
      if (!row.domain.trim()) { toast.error('Domain is required for every row'); return; }
    }
    setSaving(true);
    const next = [...backlinks, ...draftRows.map((r) => ({ ...r, domain_authority: Number(r.domain_authority) || 0 }))];
    const ok = await persist({ backlinks: next });
    setSaving(false);
    if (ok) { toast.success(`${draftRows.length} backlink${draftRows.length === 1 ? '' : 's'} added`); closeAddModal(); }
  };

  const deleteBacklink = async (id) => {
    if (!canEdit) return;
    const next = backlinks.filter((b) => b.id !== id);
    const ok = await persist({ backlinks: next });
    if (ok) toast.success('Removed');
  };

  // ---- Weekly target ----
  const now = new Date();
  const weekStart = mondayOf(now);
  const weekStartIso = isoDate(weekStart);
  const weekEndIso = isoDate(addDays(weekStart, 5));
  const currentWeekTarget = weeklyTargets.find((t) => t.week_start === weekStartIso);

  const backlinksLoggedInRange = (fromIso, toIso) =>
    backlinks.filter((b) => b.date && b.date >= fromIso && b.date <= toIso).length;

  const openTargetModal = () => {
    setTargetDraft({
      target: currentWeekTarget?.target || '',
      assignee: currentWeekTarget?.assignee || '',
    });
    setShowTargetModal(true);
  };

  const saveWeeklyTarget = async () => {
    const targetNum = Number(targetDraft.target);
    if (!targetNum || targetNum <= 0) { toast.error('Enter a valid target'); return; }
    if (!targetDraft.assignee) { toast.error('Please assign someone'); return; }
    setSavingTarget(true);
    try {
      const perDay = Math.floor(targetNum / 6);
      const remainder = targetNum - perDay * 5; // Saturday takes the remainder
      const dailyTaskIds = [];
      for (let i = 0; i < 6; i++) {
        const dayDate = addDays(weekStart, i);
        const share = i === 5 ? remainder : perDay;
        const res = await axios.post(`${API}/api/projects/${project.project_id}/tasks`, {
          task_name: `Backlink Target: ${share} (${DAY_NAMES[i]} ${fmtShort(dayDate)})`,
          assigned_to: targetDraft.assignee,
          due_date: isoDate(dayDate),
          department: 'seo',
          category: 'Backlinks',
        }, { headers });
        dailyTaskIds.push(res.data?.task_id || null);
      }
      const assigneeName = (users || []).find((u) => u.user_id === targetDraft.assignee)?.name || '';
      const record = {
        id: currentWeekTarget?.id || newId('bwt'),
        week_start: weekStartIso,
        week_end: weekEndIso,
        target: targetNum,
        assignee: targetDraft.assignee,
        assignee_name: assigneeName,
        daily_task_ids: dailyTaskIds,
        created_at: new Date().toISOString(),
      };
      const next = [...weeklyTargets.filter((t) => t.week_start !== weekStartIso), record];
      const ok = await persist({ backlink_weekly_targets: next });
      if (ok) {
        toast.success('Weekly target set — 6 tasks created (Mon–Sat)');
        onTaskCreated?.();
        setShowTargetModal(false);
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to set weekly target');
    } finally {
      setSavingTarget(false);
    }
  };

  const totalLoggedThisWeek = backlinksLoggedInRange(weekStartIso, weekEndIso);
  const balance = currentWeekTarget ? currentWeekTarget.target - totalLoggedThisWeek : null;

  return (
    <div className="space-y-4" data-testid="project-backlinks-tab">
      {/* Weekly Backlink Target */}
      <Card className={`${bgCard} border ${borderColor}`}>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className={`text-base font-semibold ${textPrimary} flex items-center gap-2`}>
                <Target className="h-4 w-4 text-[#6366f1]" /> Weekly Backlink Target
              </h3>
              <p className={`text-xs ${textSecondary}`}>Week of {fmtShort(weekStart)} – {fmtShort(addDays(weekStart, 5))}</p>
            </div>
            {canEdit && (
              <Button size="sm" onClick={openTargetModal} className="bg-[#6366f1] hover:bg-[#4f46e5] text-white" data-testid="backlinks-set-target">
                {currentWeekTarget ? 'Update Target' : 'Set Weekly Target'}
              </Button>
            )}
          </div>

          {currentWeekTarget ? (
            <>
              <div className="flex items-center gap-6 flex-wrap text-sm">
                <div><span className={textSecondary}>Target: </span><span className={`font-semibold ${textPrimary}`}>{currentWeekTarget.target}</span></div>
                <div><span className={textSecondary}>Assigned to: </span><span className={`font-semibold ${textPrimary}`}>{currentWeekTarget.assignee_name}</span></div>
                <div><span className={textSecondary}>Logged this week: </span><span className="font-semibold text-emerald-500">{totalLoggedThisWeek}</span></div>
                <div><span className={textSecondary}>Balance: </span><span className={`font-semibold ${balance > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>{balance}</span></div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                {DAY_NAMES.map((d, i) => {
                  const dayDate = addDays(weekStart, i);
                  const dayIso = isoDate(dayDate);
                  const loggedUpToDay = backlinksLoggedInRange(weekStartIso, dayIso);
                  const dayBalance = currentWeekTarget.target - loggedUpToDay;
                  return (
                    <div key={d} className={`rounded-lg border ${borderColor} ${bgSecondary} p-2 text-center`} data-testid={`backlinks-day-${d.toLowerCase()}`}>
                      <p className={`text-[11px] ${textSecondary}`}>{d} {fmtShort(dayDate)}</p>
                      <p className={`text-lg font-bold ${dayBalance > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>{dayBalance}</p>
                      <p className={`text-[10px] ${textSecondary}`}>balance</p>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <p className={`text-sm ${textSecondary}`}>No target set for this week yet.</p>
          )}
        </CardContent>
      </Card>

      {/* Backlinks table */}
      <div className="flex items-center justify-between">
        <h3 className={`text-base font-semibold ${textPrimary} flex items-center gap-2`}>
          <Link2 className="h-4 w-4 text-[#6366f1]" /> Backlinks ({backlinks.length})
        </h3>
        {canEdit && (
          <Button onClick={openAddModal} size="sm" className="bg-[#6366f1] hover:bg-[#4f46e5] text-white" data-testid="backlinks-add-btn">
            <Plus className="h-3.5 w-3.5 mr-1" /> Add Backlink
          </Button>
        )}
      </div>

      <Card className={`${bgCard} border ${borderColor}`}>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className={`border-b ${borderColor}`}>
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase w-10`}>#</th>
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase`}>Date</th>
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase`}>Domain</th>
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase`}>Url</th>
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase`}>Domain Authority</th>
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase`}>Dofollow / Nofollow</th>
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase`}>Type</th>
                  {canEdit && <th className={`text-right p-3 text-[11px] font-medium ${textSecondary} uppercase w-14`}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {sortedBacklinks.map((b, idx) => (
                  <tr key={b.id} className={`border-b ${borderColor}`} data-testid={`backlink-row-${b.id}`}>
                    <td className={`p-3 text-xs ${textSecondary}`}>{idx + 1}</td>
                    <td className={`p-3 text-xs ${textSecondary}`}>{b.date}</td>
                    <td className="p-3">
                      <a href={b.domain} target="_blank" rel="noopener noreferrer" className="text-sm text-[#6366f1] hover:underline break-all">{b.domain}</a>
                    </td>
                    <td className="p-3">
                      {b.url ? <a href={b.url} target="_blank" rel="noopener noreferrer" className="text-xs text-[#6366f1] hover:underline">Open</a> : <span className={`text-xs ${textSecondary}`}>—</span>}
                    </td>
                    <td className={`p-3 text-sm ${textPrimary}`}>{b.domain_authority || '—'}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${b.link_type === 'Dofollow' ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30' : 'bg-slate-500/15 text-slate-400 border-slate-500/30'}`}>
                        {b.link_type}
                      </span>
                    </td>
                    <td className={`p-3 text-xs ${textSecondary}`}>{b.submission_type}</td>
                    {canEdit && (
                      <td className="p-3 text-right">
                        <button type="button" onClick={() => deleteBacklink(b.id)} className="p-1 text-red-500 hover:text-red-400" data-testid={`backlink-delete-${b.id}`}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
                {sortedBacklinks.length === 0 && (
                  <tr>
                    <td colSpan={canEdit ? 8 : 7} className={`p-8 text-center text-xs ${textSecondary}`}>
                      No backlinks yet. {canEdit && <span>Click "Add Backlink" to add one.</span>}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Add Backlink modal — multi-row */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-40 p-4" onClick={closeAddModal}>
          <div className={`${bgCard} border ${borderColor} rounded-xl w-full max-w-5xl max-h-[85vh] flex flex-col`} onClick={(e) => e.stopPropagation()}>
            <div className={`flex items-center justify-between p-4 border-b ${borderColor}`}>
              <h3 className={`text-lg font-semibold ${textPrimary}`}>Add Backlink{draftRows.length > 1 ? 's' : ''}</h3>
              <button onClick={closeAddModal} className={textSecondary}><X className="h-5 w-5" /></button>
            </div>
            <div className="overflow-auto p-4 flex-1">
              <table className="w-full">
                <thead>
                  <tr className={`border-b ${borderColor}`}>
                    <th className={`text-left p-2 text-[11px] font-medium ${textSecondary} uppercase w-8`}>#</th>
                    <th className={`text-left p-2 text-[11px] font-medium ${textSecondary} uppercase`}>Date</th>
                    <th className={`text-left p-2 text-[11px] font-medium ${textSecondary} uppercase min-w-[160px]`}>Domain</th>
                    <th className={`text-left p-2 text-[11px] font-medium ${textSecondary} uppercase min-w-[160px]`}>Url</th>
                    <th className={`text-left p-2 text-[11px] font-medium ${textSecondary} uppercase`}>Domain Authority</th>
                    <th className={`text-left p-2 text-[11px] font-medium ${textSecondary} uppercase`}>Dofollow / Nofollow</th>
                    <th className={`text-left p-2 text-[11px] font-medium ${textSecondary} uppercase min-w-[180px]`}>Type</th>
                    <th className="p-2 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {draftRows.map((row, idx) => (
                    <tr key={row.id} className={`border-b ${borderColor}`} data-testid={`backlink-draft-row-${idx}`}>
                      <td className={`p-2 text-xs ${textSecondary}`}>{idx + 1}</td>
                      <td className="p-2">
                        <Input type="date" value={row.date} onChange={(e) => updateDraftRow(row.id, { date: e.target.value })} className={`h-8 text-xs ${bgSecondary} border ${borderColor} ${textPrimary} w-[140px]`} />
                      </td>
                      <td className="p-2">
                        <Input value={row.domain} onChange={(e) => updateDraftRow(row.id, { domain: e.target.value })} placeholder="https://domain.com/" className={`h-8 text-xs ${bgSecondary} border ${borderColor} ${textPrimary} min-w-[160px]`} data-testid={`backlink-draft-domain-${idx}`} />
                      </td>
                      <td className="p-2">
                        <Input value={row.url} onChange={(e) => updateDraftRow(row.id, { url: e.target.value })} placeholder="https://..." className={`h-8 text-xs ${bgSecondary} border ${borderColor} ${textPrimary} min-w-[160px]`} />
                      </td>
                      <td className="p-2">
                        <Input type="number" value={row.domain_authority} onChange={(e) => updateDraftRow(row.id, { domain_authority: e.target.value })} className={`h-8 text-xs ${bgSecondary} border ${borderColor} ${textPrimary} w-[80px]`} />
                      </td>
                      <td className="p-2">
                        <Select value={row.link_type} onValueChange={(v) => updateDraftRow(row.id, { link_type: v })}>
                          <SelectTrigger className={`h-8 text-xs ${bgSecondary} border ${borderColor} ${textPrimary} w-[110px]`}><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {LINK_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-2">
                        <Select value={row.submission_type} onValueChange={(v) => updateDraftRow(row.id, { submission_type: v })}>
                          <SelectTrigger className={`h-8 text-xs ${bgSecondary} border ${borderColor} ${textPrimary} min-w-[180px]`}><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {SUBMISSION_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-2 text-right">
                        {draftRows.length > 1 && (
                          <button type="button" onClick={() => removeDraftRow(row.id)} className="p-1 text-red-500 hover:text-red-400">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Button type="button" variant="outline" size="sm" onClick={addDraftRow} className="mt-3" data-testid="backlink-add-draft-row">
                <Plus className="h-3.5 w-3.5 mr-1" /> Add Row
              </Button>
            </div>
            <div className={`flex items-center justify-end gap-2 p-4 border-t ${borderColor}`}>
              <Button type="button" variant="outline" onClick={closeAddModal} disabled={saving}>Cancel</Button>
              <Button type="button" onClick={saveDraftRows} disabled={saving} className="bg-[#6366f1] hover:bg-[#4f46e5] text-white" data-testid="backlink-save">
                {saving ? 'Saving…' : `Save ${draftRows.length > 1 ? `${draftRows.length} Backlinks` : 'Backlink'}`}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Weekly Target modal */}
      {showTargetModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-40 p-4" onClick={() => !savingTarget && setShowTargetModal(false)}>
          <div className={`${bgCard} border ${borderColor} rounded-xl w-full max-w-sm`} onClick={(e) => e.stopPropagation()}>
            <div className={`p-5 border-b ${borderColor} flex items-center justify-between`}>
              <h3 className={`text-base font-semibold ${textPrimary} flex items-center gap-2`}>
                <Target className="h-4 w-4 text-[#6366f1]" /> Weekly Backlink Target
              </h3>
              <button onClick={() => !savingTarget && setShowTargetModal(false)} className={textSecondary}><X className="h-5 w-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <p className={`text-xs ${textSecondary}`}>
                Week of {fmtShort(weekStart)} – {fmtShort(addDays(weekStart, 5))}. Creates 6 tasks (Monday–Saturday) for the assignee.
              </p>
              <div>
                <Label className={textPrimary}>Target (backlinks this week)</Label>
                <Input
                  type="number"
                  value={targetDraft.target}
                  onChange={(e) => setTargetDraft((d) => ({ ...d, target: e.target.value }))}
                  className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                  data-testid="backlinks-target-number"
                />
              </div>
              <div>
                <Label className={textPrimary}>Assignee</Label>
                <Select value={targetDraft.assignee || 'none'} onValueChange={(v) => setTargetDraft((d) => ({ ...d, assignee: v === 'none' ? '' : v }))}>
                  <SelectTrigger className={`${bgSecondary} border ${borderColor} ${textPrimary}`} data-testid="backlinks-target-assignee">
                    <SelectValue placeholder="Select assignee" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Select —</SelectItem>
                    {(users || []).map((u) => <SelectItem key={u.user_id} value={u.user_id}>{u.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className={`p-5 border-t ${borderColor} flex items-center justify-end gap-2`}>
              <Button type="button" variant="outline" onClick={() => setShowTargetModal(false)} disabled={savingTarget}>Cancel</Button>
              <Button type="button" onClick={saveWeeklyTarget} disabled={savingTarget} className="bg-[#6366f1] hover:bg-[#4f46e5] text-white" data-testid="backlinks-target-save">
                {savingTarget ? 'Creating tasks…' : 'Set Target & Create Tasks'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
