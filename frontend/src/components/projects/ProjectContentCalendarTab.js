import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Plus, Trash2, Save, X, Pencil, CalendarDays } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const PLATFORMS = [
  { id: 'all', label: 'All' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'facebook', label: 'Facebook' },
  { id: 'x', label: 'X' },
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'youtube', label: 'YouTube' },
];

const POST_TYPES = ['static', 'carousel', 'reel'];
const POST_TYPE_LABEL = { static: 'Static', carousel: 'Carousel', reel: 'Reel' };

const STATUS_FLOW = ['created', 'scheduled', 'posted'];
const STATUS_LABEL = { created: 'Created', scheduled: 'Scheduled', posted: 'Posted' };
const STATUS_STYLE = {
  created: 'bg-slate-500/20 text-slate-300 border-slate-500/40',
  scheduled: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
  posted: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
};
const nextStatus = (s) => {
  const i = STATUS_FLOW.indexOf(s || 'created');
  return STATUS_FLOW[(i + 1) % STATUS_FLOW.length];
};

// Each of these 3 fields can be independently assigned + dated. Setting both
// on save auto-creates a real Operations task for that person (Department =
// Social Media), so the work shows up in their My Tasks.
const FIELD_TASK_CONFIG = {
  post_title: { label: 'Post Title', category: 'Content Writing' },
  content_link: { label: 'Content Link', category: 'Content Calendar' },
  creative_link: { label: 'Creative Link', category: 'Designing' },
};

const dayOfWeek = (iso) => {
  if (!iso) return '—';
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { weekday: 'long' });
};

const newRowId = () => `cc_${Math.random().toString(36).slice(2, 10)}`;
const todayIso = () => new Date().toISOString().slice(0, 10);
const emptyDraftRow = (platform) => ({
  id: newRowId(),
  platforms: platform && platform !== 'all' ? [platform] : [],
  post_date: todayIso(),
  post_title: '',
  content_link: '',
  creative_link: '',
  description: '',
  post_type: 'static',
  status: 'created',
  post_title_assignee: '',
  post_title_date: '',
  content_link_assignee: '',
  content_link_date: '',
  creative_link_assignee: '',
  creative_link_date: '',
});

export default function ProjectContentCalendarTab({
  project,
  onProjectUpdated,
  onTaskCreated,
  canEdit,
  users,
  isDark,
  bgCard,
  bgSecondary,
  textPrimary,
  textSecondary,
  borderColor,
}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('session_token') : null;
  const headers = { Authorization: `Bearer ${token}` };

  const [subTab, setSubTab] = useState('all');
  const posts = project?.content_calendar || [];
  const list = subTab === 'all' ? posts : posts.filter(p => p.platform === subTab);

  const [showAddModal, setShowAddModal] = useState(false);
  const [draftRows, setDraftRows] = useState([]);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editBuffer, setEditBuffer] = useState(null);

  const assigneeName = (userId) => (users || []).find(u => u.user_id === userId)?.name || '';

  const persist = async (nextPosts) => {
    if (!canEdit) return false;
    try {
      const res = await axios.patch(
        `${API}/api/projects/${project.project_id}`,
        { content_calendar: nextPosts },
        { headers },
      );
      onProjectUpdated?.(res.data);
      return true;
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to save');
      return false;
    }
  };

  // Creates a real Operations task (Department = Social Media) for one of
  // the 3 assignable fields, returning its task_id so it can be linked back
  // onto the calendar post entry.
  const createFieldTask = async ({ field, assignee, date, postTitle }) => {
    const cfg = FIELD_TASK_CONFIG[field];
    const res = await axios.post(`${API}/api/projects/${project.project_id}/tasks`, {
      task_name: `${cfg.label}: ${postTitle || 'Untitled Post'}`,
      assigned_to: assignee,
      due_date: date,
      department: 'social_media',
      category: cfg.category,
    }, { headers });
    return res.data?.task_id || null;
  };

  const openAddModal = () => {
    setDraftRows([emptyDraftRow(subTab)]);
    setShowAddModal(true);
  };
  const closeAddModal = () => { setShowAddModal(false); setDraftRows([]); };
  const addDraftRow = () => setDraftRows(rows => [...rows, emptyDraftRow(subTab)]);
  const removeDraftRow = (id) => setDraftRows(rows => rows.filter(r => r.id !== id));
  const updateDraftRow = (id, patch) => setDraftRows(rows => rows.map(r => (r.id === id ? { ...r, ...patch } : r)));
  const togglePlatform = (id, platformId, checked) => setDraftRows(rows => rows.map(r => {
    if (r.id !== id) return r;
    const next = checked ? [...r.platforms, platformId] : r.platforms.filter(p => p !== platformId);
    return { ...r, platforms: next };
  }));

  const saveDraftRows = async () => {
    for (const row of draftRows) {
      if (!row.post_date) { toast.error('Post Date is required for every row'); return; }
      if (!row.post_title.trim()) { toast.error('Post Title is required for every row'); return; }
      if (!row.platforms || row.platforms.length === 0) { toast.error('Select at least one platform for every row'); return; }
    }
    setSaving(true);
    try {
      const newEntries = [];
      for (const row of draftRows) {
        const taskIds = {};
        for (const field of Object.keys(FIELD_TASK_CONFIG)) {
          const assignee = row[`${field}_assignee`];
          const date = row[`${field}_date`];
          if (assignee && date) {
            taskIds[field] = await createFieldTask({ field, assignee, date, postTitle: row.post_title });
          }
        }
        for (const platform of row.platforms) {
          newEntries.push({
            id: newRowId(),
            platform,
            post_date: row.post_date,
            post_title: row.post_title,
            content_link: row.content_link,
            creative_link: row.creative_link,
            description: row.description,
            post_type: row.post_type,
            status: row.status,
            post_title_assignee: row.post_title_assignee,
            post_title_date: row.post_title_date,
            post_title_task_id: taskIds.post_title || null,
            content_link_assignee: row.content_link_assignee,
            content_link_date: row.content_link_date,
            content_link_task_id: taskIds.content_link || null,
            creative_link_assignee: row.creative_link_assignee,
            creative_link_date: row.creative_link_date,
            creative_link_task_id: taskIds.creative_link || null,
          });
        }
      }
      const next = [...posts, ...newEntries];
      const ok = await persist(next);
      if (ok) {
        toast.success(`${newEntries.length} post${newEntries.length === 1 ? '' : 's'} added`);
        onTaskCreated?.();
        closeAddModal();
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to create linked tasks');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (row) => { setEditingId(row.id); setEditBuffer({ ...row }); };
  const cancelEdit = () => { setEditingId(null); setEditBuffer(null); };
  const saveEdit = async () => {
    if (!editBuffer.post_title.trim()) { toast.error('Post Title is required'); return; }
    setSaving(true);
    try {
      const updated = { ...editBuffer };
      for (const field of Object.keys(FIELD_TASK_CONFIG)) {
        const assignee = updated[`${field}_assignee`];
        const date = updated[`${field}_date`];
        if (assignee && date && !updated[`${field}_task_id`]) {
          updated[`${field}_task_id`] = await createFieldTask({ field, assignee, date, postTitle: updated.post_title });
        }
      }
      const next = posts.map(p => (p.id === updated.id ? updated : p));
      const ok = await persist(next);
      if (ok) { cancelEdit(); toast.success('Saved'); onTaskCreated?.(); }
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };
  const deleteRow = async (id) => {
    const next = posts.filter(p => p.id !== id);
    const ok = await persist(next);
    if (ok) toast.success('Removed');
  };
  const cycleStatus = async (row) => {
    const next = posts.map(p => (p.id === row.id ? { ...p, status: nextStatus(p.status) } : p));
    await persist(next);
  };

  const pillBox = isDark ? 'bg-[#18181b] border-[#27272a]' : 'bg-white border-gray-200';
  const activeCls = isDark ? 'bg-[#27272a] text-white' : 'bg-gray-100 text-gray-900';
  const idleCls = isDark ? 'text-[#a1a1aa] hover:text-white' : 'text-gray-500 hover:text-gray-900';
  const inputCls = `h-8 text-xs ${bgSecondary} border ${borderColor} ${textPrimary}`;
  const colCount = subTab === 'all' ? 11 : 10;

  const AssigneeDateEditor = ({ field, value, onChange }) => (
    <div className="flex flex-col gap-1 mt-1">
      <Select value={value[`${field}_assignee`] || 'none'} onValueChange={(v) => onChange({ [`${field}_assignee`]: v === 'none' ? '' : v })}>
        <SelectTrigger className={`h-7 text-[11px] ${bgSecondary} border ${borderColor} ${textPrimary}`}>
          <SelectValue placeholder="Unassigned" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">— Unassigned —</SelectItem>
          {(users || []).map(u => <SelectItem key={u.user_id} value={u.user_id}>{u.name}</SelectItem>)}
        </SelectContent>
      </Select>
      <Input
        type="date"
        value={value[`${field}_date`] || ''}
        onChange={(e) => onChange({ [`${field}_date`]: e.target.value })}
        className="h-7 text-[11px] px-2"
      />
    </div>
  );

  const AssigneeDateSummary = ({ field, row }) => {
    const name = assigneeName(row[`${field}_assignee`]);
    const date = row[`${field}_date`];
    if (!name && !date) return null;
    return (
      <p className={`text-[11px] ${textSecondary} mt-1`}>
        {name || 'Unassigned'}{date ? ` · ${date}` : ''}
      </p>
    );
  };

  return (
    <div className="space-y-3" data-testid="project-content-calendar-tab">
      <div>
        <h3 className={`text-lg font-semibold ${textPrimary} flex items-center gap-2`}>
          <CalendarDays className="h-5 w-5 text-[#6366f1]" /> Content Calendar
        </h3>
        <p className={`text-xs ${textSecondary}`}>Plan and track social posts for this project.</p>
      </div>

      {/* Platform sub-tabs */}
      <div className={`inline-flex flex-wrap items-center gap-1 p-1 rounded-lg border ${pillBox}`}>
        {PLATFORMS.map(p => (
          <button
            key={p.id}
            type="button"
            onClick={() => { setSubTab(p.id); cancelEdit(); }}
            data-testid={`content-calendar-subtab-${p.id}`}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${subTab === p.id ? activeCls : idleCls}`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Action row */}
      <div className="flex items-center justify-between">
        <p className={`text-xs ${textSecondary}`}>
          {list.length === 0 ? 'No posts yet.' : `${list.length} post${list.length === 1 ? '' : 's'}`}
        </p>
        {canEdit && (
          <Button
            type="button"
            onClick={openAddModal}
            size="sm"
            className="bg-[#6366f1] hover:bg-[#5558dd] text-white"
            data-testid="content-calendar-add-post-btn"
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> Add Post
          </Button>
        )}
      </div>

      {/* Table */}
      <Card className={`${bgCard} border ${borderColor}`}>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className={`border-b ${borderColor}`}>
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase w-10`}>#</th>
                  {subTab === 'all' && <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase`}>Platform</th>}
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase`}>Post Date</th>
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase`}>Day</th>
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase min-w-[160px]`}>Post Title</th>
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase min-w-[160px]`}>Content Link</th>
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase min-w-[160px]`}>Creative Link</th>
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase min-w-[220px]`}>Description &amp; Hashtags</th>
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase`}>Post Type</th>
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase`}>Status</th>
                  <th className={`text-right p-3 text-[11px] font-medium ${textSecondary} uppercase w-20`}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.map((row, idx) => {
                  const isEditing = editingId === row.id;
                  const buf = isEditing ? editBuffer : row;
                  const patchBuf = (p) => setEditBuffer(b => ({ ...b, ...p }));
                  return (
                    <tr key={row.id} className={`border-b ${borderColor}`} data-testid={`content-calendar-row-${row.id}`}>
                      <td className={`p-3 text-xs ${textSecondary}`}>{idx + 1}</td>
                      {subTab === 'all' && (
                        <td className={`p-3 text-sm ${textPrimary} capitalize`}>
                          {PLATFORMS.find(p => p.id === row.platform)?.label || row.platform}
                        </td>
                      )}
                      <td className="p-3">
                        {isEditing ? (
                          <Input
                            type="date"
                            value={editBuffer.post_date}
                            onChange={(e) => setEditBuffer(b => ({ ...b, post_date: e.target.value }))}
                            className={inputCls}
                          />
                        ) : (
                          <span className={`text-sm ${textPrimary}`}>{row.post_date || '—'}</span>
                        )}
                      </td>
                      <td className={`p-3 text-sm ${textSecondary}`}>{dayOfWeek(isEditing ? editBuffer.post_date : row.post_date)}</td>
                      <td className="p-3">
                        {isEditing ? (
                          <Input
                            value={editBuffer.post_title}
                            onChange={(e) => setEditBuffer(b => ({ ...b, post_title: e.target.value }))}
                            className={inputCls}
                          />
                        ) : (
                          <span className={`text-sm ${textPrimary}`}>{row.post_title || '—'}</span>
                        )}
                        {isEditing ? (
                          <AssigneeDateEditor field="post_title" value={buf} onChange={patchBuf} />
                        ) : (
                          <AssigneeDateSummary field="post_title" row={row} />
                        )}
                      </td>
                      <td className="p-3">
                        {isEditing ? (
                          <Input
                            value={editBuffer.content_link}
                            onChange={(e) => setEditBuffer(b => ({ ...b, content_link: e.target.value }))}
                            className={inputCls}
                          />
                        ) : row.content_link ? (
                          <a href={row.content_link} target="_blank" rel="noreferrer" className="text-xs text-[#6366f1] hover:underline">Open</a>
                        ) : (
                          <span className={`text-xs ${textSecondary}`}>—</span>
                        )}
                        {isEditing ? (
                          <AssigneeDateEditor field="content_link" value={buf} onChange={patchBuf} />
                        ) : (
                          <AssigneeDateSummary field="content_link" row={row} />
                        )}
                      </td>
                      <td className="p-3">
                        {isEditing ? (
                          <Input
                            value={editBuffer.creative_link}
                            onChange={(e) => setEditBuffer(b => ({ ...b, creative_link: e.target.value }))}
                            className={inputCls}
                          />
                        ) : row.creative_link ? (
                          <a href={row.creative_link} target="_blank" rel="noreferrer" className="text-xs text-[#6366f1] hover:underline">Open</a>
                        ) : (
                          <span className={`text-xs ${textSecondary}`}>—</span>
                        )}
                        {isEditing ? (
                          <AssigneeDateEditor field="creative_link" value={buf} onChange={patchBuf} />
                        ) : (
                          <AssigneeDateSummary field="creative_link" row={row} />
                        )}
                      </td>
                      <td className="p-3 max-w-[280px]">
                        {isEditing ? (
                          <Textarea
                            value={editBuffer.description}
                            onChange={(e) => setEditBuffer(b => ({ ...b, description: e.target.value }))}
                            className={`text-xs ${bgSecondary} border ${borderColor} ${textPrimary} min-h-[60px]`}
                          />
                        ) : (
                          <p className={`text-xs ${textSecondary} line-clamp-2 whitespace-pre-wrap`}>{row.description || '—'}</p>
                        )}
                      </td>
                      <td className="p-3">
                        {isEditing ? (
                          <Select value={editBuffer.post_type} onValueChange={(v) => setEditBuffer(b => ({ ...b, post_type: v }))}>
                            <SelectTrigger className={`h-8 text-xs ${bgSecondary} border ${borderColor} ${textPrimary}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {POST_TYPES.map(t => <SelectItem key={t} value={t}>{POST_TYPE_LABEL[t]}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className="text-xs">{POST_TYPE_LABEL[row.post_type] || '—'}</span>
                        )}
                      </td>
                      <td className="p-3">
                        <button
                          type="button"
                          onClick={() => canEdit && !isEditing && cycleStatus(row)}
                          disabled={!canEdit || isEditing}
                          title={canEdit && !isEditing ? 'Click to advance status' : 'Read only'}
                          className={`px-2 py-1 rounded-md text-xs font-medium border ${STATUS_STYLE[row.status] || STATUS_STYLE.created} ${canEdit && !isEditing ? 'cursor-pointer hover:opacity-80' : 'cursor-not-allowed opacity-80'}`}
                          data-testid={`content-calendar-status-${row.id}`}
                        >
                          {STATUS_LABEL[row.status] || 'Created'}
                        </button>
                      </td>
                      <td className="p-3 text-right">
                        {isEditing ? (
                          <div className="inline-flex gap-1">
                            <button type="button" onClick={saveEdit} disabled={saving} className="p-1 text-emerald-500 hover:text-emerald-400" title="Save" data-testid={`content-calendar-save-edit-${row.id}`}>
                              <Save className="h-4 w-4" />
                            </button>
                            <button type="button" onClick={cancelEdit} className={`p-1 ${textSecondary} hover:opacity-80`} title="Cancel">
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ) : canEdit && (
                          <div className="inline-flex gap-1">
                            <button type="button" onClick={() => startEdit(row)} className={`p-1 ${textSecondary} hover:opacity-80`} title="Edit" data-testid={`content-calendar-edit-${row.id}`}>
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button type="button" onClick={() => deleteRow(row.id)} className="p-1 text-red-500 hover:text-red-400" title="Delete" data-testid={`content-calendar-delete-${row.id}`}>
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {list.length === 0 && (
                  <tr>
                    <td colSpan={colCount} className={`p-8 text-center text-xs ${textSecondary}`}>
                      No posts yet. {canEdit && <span>Click <span className="font-medium">Add Post</span> to add one.</span>}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Add Post modal — one card per post, each can fan out to multiple
          platforms and independently assign Post Title / Content Link /
          Creative Link to different people with their own due dates. */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[70] p-4" onClick={closeAddModal}>
          <div
            className={`${bgCard} border ${borderColor} rounded-xl w-full max-w-3xl max-h-[85vh] flex flex-col`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`flex items-center justify-between p-4 border-b ${borderColor}`}>
              <h3 className={`text-lg font-semibold ${textPrimary}`}>Add Post{draftRows.length > 1 ? 's' : ''}</h3>
              <button onClick={closeAddModal} className={textSecondary}><X className="h-5 w-5" /></button>
            </div>
            <div className="overflow-auto p-4 flex-1 space-y-4">
              {draftRows.map((row, idx) => (
                <div key={row.id} className={`border ${borderColor} rounded-lg p-4 space-y-3`} data-testid={`content-calendar-draft-row-${idx}`}>
                  <div className="flex items-center justify-between">
                    <p className={`text-xs font-semibold uppercase tracking-wide ${textSecondary}`}>Post {idx + 1}</p>
                    {draftRows.length > 1 && (
                      <button type="button" onClick={() => removeDraftRow(row.id)} className="p-1 text-red-500 hover:text-red-400" title="Remove post">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  <div>
                    <Label className={textPrimary}>Platforms <span className="text-red-500">*</span></Label>
                    <div className="flex flex-wrap gap-3 mt-1">
                      {PLATFORMS.filter(p => p.id !== 'all').map(p => (
                        <label key={p.id} className={`flex items-center gap-1.5 text-sm ${textPrimary} cursor-pointer`}>
                          <input
                            type="checkbox"
                            checked={row.platforms.includes(p.id)}
                            onChange={(e) => togglePlatform(row.id, p.id, e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-[#6366f1] focus:ring-[#6366f1]"
                            data-testid={`content-calendar-draft-platform-${p.id}-${idx}`}
                          />
                          {p.label}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className={textPrimary}>Post Date</Label>
                      <Input
                        type="date"
                        value={row.post_date}
                        onChange={(e) => updateDraftRow(row.id, { post_date: e.target.value })}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <Label className={textPrimary}>Day</Label>
                      <p className={`h-8 flex items-center text-sm ${textSecondary}`}>{dayOfWeek(row.post_date)}</p>
                    </div>
                  </div>

                  {Object.entries(FIELD_TASK_CONFIG).map(([field, cfg]) => (
                    <div key={field} className="grid grid-cols-3 gap-3">
                      <div>
                        <Label className={textPrimary}>{cfg.label}</Label>
                        {field === 'post_title' ? (
                          <Input
                            value={row.post_title}
                            onChange={(e) => updateDraftRow(row.id, { post_title: e.target.value })}
                            placeholder="Post title"
                            className={inputCls}
                            data-testid={`content-calendar-draft-title-${idx}`}
                          />
                        ) : (
                          <Input
                            value={row[field]}
                            onChange={(e) => updateDraftRow(row.id, { [field]: e.target.value })}
                            placeholder="https://..."
                            className={inputCls}
                          />
                        )}
                      </div>
                      <div>
                        <Label className={textSecondary}>Assignee</Label>
                        <Select
                          value={row[`${field}_assignee`] || 'none'}
                          onValueChange={(v) => updateDraftRow(row.id, { [`${field}_assignee`]: v === 'none' ? '' : v })}
                        >
                          <SelectTrigger className={inputCls}>
                            <SelectValue placeholder="Unassigned" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">— Unassigned —</SelectItem>
                            {(users || []).map(u => <SelectItem key={u.user_id} value={u.user_id}>{u.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className={textSecondary}>Date</Label>
                        <Input
                          type="date"
                          value={row[`${field}_date`] || ''}
                          onChange={(e) => updateDraftRow(row.id, { [`${field}_date`]: e.target.value })}
                          className={inputCls}
                        />
                      </div>
                    </div>
                  ))}

                  <div>
                    <Label className={textPrimary}>Description &amp; Hashtags</Label>
                    <Textarea
                      value={row.description}
                      onChange={(e) => updateDraftRow(row.id, { description: e.target.value })}
                      placeholder="Description and hashtags"
                      className={`text-xs ${bgSecondary} border ${borderColor} ${textPrimary} min-h-[60px]`}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className={textPrimary}>Post Type</Label>
                      <Select value={row.post_type} onValueChange={(v) => updateDraftRow(row.id, { post_type: v })}>
                        <SelectTrigger className={inputCls}><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {POST_TYPES.map(t => <SelectItem key={t} value={t}>{POST_TYPE_LABEL[t]}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className={textPrimary}>Status</Label>
                      <Select value={row.status} onValueChange={(v) => updateDraftRow(row.id, { status: v })}>
                        <SelectTrigger className={inputCls}><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {STATUS_FLOW.map(s => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={addDraftRow} data-testid="content-calendar-add-draft-row">
                <Plus className="h-3.5 w-3.5 mr-1" /> Add Row
              </Button>
            </div>
            <div className={`flex items-center justify-end gap-2 p-4 border-t ${borderColor}`}>
              <Button type="button" variant="outline" onClick={closeAddModal} disabled={saving}>Cancel</Button>
              <Button type="button" onClick={saveDraftRows} disabled={saving} className="bg-[#6366f1] hover:bg-[#5558dd] text-white" data-testid="content-calendar-save-posts">
                {saving ? 'Saving…' : `Save ${draftRows.length > 1 ? `${draftRows.length} Posts` : 'Post'}`}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
