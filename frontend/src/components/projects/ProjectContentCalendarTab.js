import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
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
  platform: platform === 'all' ? 'instagram' : platform,
  post_date: todayIso(),
  post_title: '',
  content_link: '',
  creative_link: '',
  description: '',
  post_type: 'static',
  status: 'created',
});

export default function ProjectContentCalendarTab({
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

  const [subTab, setSubTab] = useState('all');
  const posts = project?.content_calendar || [];
  const list = subTab === 'all' ? posts : posts.filter(p => p.platform === subTab);

  const [showAddModal, setShowAddModal] = useState(false);
  const [draftRows, setDraftRows] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editBuffer, setEditBuffer] = useState(null);

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

  const openAddModal = () => {
    setDraftRows([emptyDraftRow(subTab)]);
    setShowAddModal(true);
  };
  const closeAddModal = () => { setShowAddModal(false); setDraftRows([]); };
  const addDraftRow = () => setDraftRows(rows => [...rows, emptyDraftRow(subTab)]);
  const removeDraftRow = (id) => setDraftRows(rows => rows.filter(r => r.id !== id));
  const updateDraftRow = (id, patch) => setDraftRows(rows => rows.map(r => (r.id === id ? { ...r, ...patch } : r)));

  const saveDraftRows = async () => {
    for (const row of draftRows) {
      if (!row.post_date) { toast.error('Post Date is required for every row'); return; }
      if (!row.post_title.trim()) { toast.error('Post Title is required for every row'); return; }
    }
    const next = [...posts, ...draftRows];
    const ok = await persist(next);
    if (ok) {
      toast.success(`${draftRows.length} post${draftRows.length === 1 ? '' : 's'} added`);
      closeAddModal();
    }
  };

  const startEdit = (row) => { setEditingId(row.id); setEditBuffer({ ...row }); };
  const cancelEdit = () => { setEditingId(null); setEditBuffer(null); };
  const saveEdit = async () => {
    if (!editBuffer.post_title.trim()) { toast.error('Post Title is required'); return; }
    const next = posts.map(p => (p.id === editBuffer.id ? { ...editBuffer } : p));
    const ok = await persist(next);
    if (ok) { cancelEdit(); toast.success('Saved'); }
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
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase`}>Post Title</th>
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase`}>Content Link</th>
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase`}>Creative Link</th>
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase min-w-[220px]`}>Description &amp; Hashtags</th>
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase`}>Post Type</th>
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase`}>Status</th>
                  <th className={`text-right p-3 text-[11px] font-medium ${textSecondary} uppercase w-20`}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.map((row, idx) => {
                  const isEditing = editingId === row.id;
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
                            <button type="button" onClick={saveEdit} className="p-1 text-emerald-500 hover:text-emerald-400" title="Save" data-testid={`content-calendar-save-edit-${row.id}`}>
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

      {/* Add Post modal — multi-row, added together in a single popup */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[70] p-4" onClick={closeAddModal}>
          <div
            className={`${bgCard} border ${borderColor} rounded-xl w-full max-w-6xl max-h-[85vh] flex flex-col`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`flex items-center justify-between p-4 border-b ${borderColor}`}>
              <h3 className={`text-lg font-semibold ${textPrimary}`}>Add Post{draftRows.length > 1 ? 's' : ''}</h3>
              <button onClick={closeAddModal} className={textSecondary}><X className="h-5 w-5" /></button>
            </div>
            <div className="overflow-auto p-4 flex-1">
              <table className="w-full">
                <thead>
                  <tr className={`border-b ${borderColor}`}>
                    <th className={`text-left p-2 text-[11px] font-medium ${textSecondary} uppercase w-8`}>#</th>
                    <th className={`text-left p-2 text-[11px] font-medium ${textSecondary} uppercase`}>Platform</th>
                    <th className={`text-left p-2 text-[11px] font-medium ${textSecondary} uppercase`}>Post Date</th>
                    <th className={`text-left p-2 text-[11px] font-medium ${textSecondary} uppercase`}>Day</th>
                    <th className={`text-left p-2 text-[11px] font-medium ${textSecondary} uppercase min-w-[140px]`}>Post Title</th>
                    <th className={`text-left p-2 text-[11px] font-medium ${textSecondary} uppercase min-w-[140px]`}>Content Link</th>
                    <th className={`text-left p-2 text-[11px] font-medium ${textSecondary} uppercase min-w-[140px]`}>Creative Link</th>
                    <th className={`text-left p-2 text-[11px] font-medium ${textSecondary} uppercase min-w-[220px]`}>Description &amp; Hashtags</th>
                    <th className={`text-left p-2 text-[11px] font-medium ${textSecondary} uppercase`}>Post Type</th>
                    <th className={`text-left p-2 text-[11px] font-medium ${textSecondary} uppercase`}>Status</th>
                    <th className="p-2 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {draftRows.map((row, idx) => (
                    <tr key={row.id} className={`border-b ${borderColor}`} data-testid={`content-calendar-draft-row-${idx}`}>
                      <td className={`p-2 text-xs ${textSecondary}`}>{idx + 1}</td>
                      <td className="p-2">
                        <Select value={row.platform} onValueChange={(v) => updateDraftRow(row.id, { platform: v })}>
                          <SelectTrigger className={`h-8 text-xs ${bgSecondary} border ${borderColor} ${textPrimary} w-[110px]`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PLATFORMS.filter(p => p.id !== 'all').map(p => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-2">
                        <Input
                          type="date"
                          value={row.post_date}
                          onChange={(e) => updateDraftRow(row.id, { post_date: e.target.value })}
                          className={`${inputCls} w-[140px]`}
                        />
                      </td>
                      <td className={`p-2 text-xs ${textSecondary} whitespace-nowrap`}>{dayOfWeek(row.post_date)}</td>
                      <td className="p-2">
                        <Input
                          value={row.post_title}
                          onChange={(e) => updateDraftRow(row.id, { post_title: e.target.value })}
                          placeholder="Post title"
                          className={`${inputCls} min-w-[140px]`}
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          value={row.content_link}
                          onChange={(e) => updateDraftRow(row.id, { content_link: e.target.value })}
                          placeholder="https://..."
                          className={`${inputCls} min-w-[140px]`}
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          value={row.creative_link}
                          onChange={(e) => updateDraftRow(row.id, { creative_link: e.target.value })}
                          placeholder="https://..."
                          className={`${inputCls} min-w-[140px]`}
                        />
                      </td>
                      <td className="p-2">
                        <Textarea
                          value={row.description}
                          onChange={(e) => updateDraftRow(row.id, { description: e.target.value })}
                          placeholder="Description and hashtags"
                          className={`text-xs ${bgSecondary} border ${borderColor} ${textPrimary} min-h-[36px] min-w-[220px]`}
                        />
                      </td>
                      <td className="p-2">
                        <Select value={row.post_type} onValueChange={(v) => updateDraftRow(row.id, { post_type: v })}>
                          <SelectTrigger className={`h-8 text-xs ${bgSecondary} border ${borderColor} ${textPrimary} w-[110px]`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {POST_TYPES.map(t => <SelectItem key={t} value={t}>{POST_TYPE_LABEL[t]}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-2">
                        <Select value={row.status} onValueChange={(v) => updateDraftRow(row.id, { status: v })}>
                          <SelectTrigger className={`h-8 text-xs ${bgSecondary} border ${borderColor} ${textPrimary} w-[110px]`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_FLOW.map(s => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-2 text-right">
                        {draftRows.length > 1 && (
                          <button type="button" onClick={() => removeDraftRow(row.id)} className="p-1 text-red-500 hover:text-red-400" title="Remove row">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Button type="button" variant="outline" size="sm" onClick={addDraftRow} className="mt-3" data-testid="content-calendar-add-draft-row">
                <Plus className="h-3.5 w-3.5 mr-1" /> Add Row
              </Button>
            </div>
            <div className={`flex items-center justify-end gap-2 p-4 border-t ${borderColor}`}>
              <Button type="button" variant="outline" onClick={closeAddModal}>Cancel</Button>
              <Button type="button" onClick={saveDraftRows} className="bg-[#6366f1] hover:bg-[#5558dd] text-white" data-testid="content-calendar-save-posts">
                Save {draftRows.length > 1 ? `${draftRows.length} Posts` : 'Post'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
