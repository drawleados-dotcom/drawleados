import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { NotebookPen, Plus, Eye, Pencil, Trash2, X, CalendarDays } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const fmtDay = (ymd) => {
  if (!ymd) return '—';
  try {
    // Parse as a plain calendar date — `new Date('2026-08-03')` is UTC midnight
    // and shifts a day backwards for anyone west of GMT.
    const [y, m, d] = ymd.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', weekday: 'short' });
  } catch { return ymd; }
};

const fmtDateTime = (iso) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return '—'; }
};

/**
 * Daily Notes — every project's running log of "what happened here today",
 * one entry per person per day. Universal: renders for Website, Social Media,
 * Meta Ads, SEO and ERP projects alike, next to Tasks.
 *
 * The composer at the top files today's update (the date is editable so a
 * missed day can be back-filled); the table below is the "all days" view of
 * every note ever filed on the project, newest day first.
 *
 * Notes live in their own collection behind /api/projects/{id}/daily-notes —
 * see projects_routes.py for why they aren't an array on the project doc.
 */
export default function ProjectDailyNotesTab({
  project,
  users,
  currentUser,
  canEdit,
  departmentOptions = [],
  isDark,
  bgCard,
  bgSecondary,
  textPrimary,
  textSecondary,
  borderColor,
}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('session_token') : null;
  const headers = { Authorization: `Bearer ${token}` };
  const projectId = project?.project_id;

  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Today's update composer
  const [draft, setDraft] = useState({ note: '', note_date: todayStr(), department: '' });

  // "All days" filters
  const [memberFilter, setMemberFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all'); // all | today | single | range
  const [singleDate, setSingleDate] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // { mode: 'view' | 'edit', note }
  const [modal, setModal] = useState(null);

  const loadNotes = useCallback(async () => {
    if (!projectId) return;
    try {
      const res = await axios.get(`${API}/api/projects/${projectId}/daily-notes`, { headers });
      setNotes(res.data || []);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to load daily notes');
    } finally {
      setLoading(false);
    }
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadNotes(); }, [loadNotes]);

  const authorName = (userId, fallback) => (users || []).find(u => u.user_id === userId)?.name || fallback || userId || '—';
  const deptLabel = (value) => departmentOptions.find(d => d.value === value)?.label || value;

  // A note is editable by its author; project editors (admins / Operation Head)
  // can correct anyone's — the backend enforces the same rule.
  const canModify = (note) => canEdit || note.created_by === currentUser?.user_id;

  const myNotesToday = notes.filter(n => n.note_date === todayStr() && n.created_by === currentUser?.user_id);

  const saveDraft = async () => {
    if (!draft.note.trim()) { toast.error('Write today\'s update first'); return; }
    setSaving(true);
    try {
      await axios.post(
        `${API}/api/projects/${projectId}/daily-notes`,
        { note: draft.note.trim(), note_date: draft.note_date || todayStr(), department: draft.department || null },
        { headers },
      );
      toast.success('Daily note saved');
      setDraft({ note: '', note_date: todayStr(), department: '' });
      loadNotes();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to save daily note');
    } finally {
      setSaving(false);
    }
  };

  const saveEdit = async () => {
    if (!modal?.note?.note?.trim()) { toast.error('Note cannot be empty'); return; }
    setSaving(true);
    try {
      await axios.patch(
        `${API}/api/projects/${projectId}/daily-notes/${modal.note.note_id}`,
        {
          note: modal.note.note.trim(),
          // A cleared date input must not blank out the day the note belongs to.
          ...(modal.note.note_date ? { note_date: modal.note.note_date } : {}),
          department: modal.note.department || '',
        },
        { headers },
      );
      toast.success('Daily note updated');
      setModal(null);
      loadNotes();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to update daily note');
    } finally {
      setSaving(false);
    }
  };

  const deleteNote = async (note) => {
    if (!window.confirm('Delete this daily note?')) return;
    try {
      await axios.delete(`${API}/api/projects/${projectId}/daily-notes/${note.note_id}`, { headers });
      toast.success('Daily note deleted');
      setModal(null);
      loadNotes();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to delete daily note');
    }
  };

  // ---- All days view ----
  const filtered = notes.filter(n => {
    if (memberFilter !== 'all' && n.created_by !== memberFilter) return false;
    if (dateFilter === 'today' && n.note_date !== todayStr()) return false;
    if (dateFilter === 'single' && singleDate && n.note_date !== singleDate) return false;
    if (dateFilter === 'range') {
      if (dateFrom && (n.note_date || '') < dateFrom) return false;
      if (dateTo && (n.note_date || '') > dateTo) return false;
    }
    return true;
  });
  const dayCount = new Set(filtered.map(n => n.note_date)).size;
  // Authors who have actually filed a note, so the filter never lists someone
  // with nothing to show.
  const authors = Array.from(new Map(
    notes.map(n => [n.created_by, { user_id: n.created_by, name: authorName(n.created_by, n.created_by_name) }])
  ).values());

  return (
    <div className="space-y-3" data-testid="project-daily-notes-tab">
      <div>
        <h3 className={`text-lg font-semibold ${textPrimary} flex items-center gap-2`}>
          <NotebookPen className="h-5 w-5 text-[#6366f1]" /> Daily Notes
        </h3>
        <p className={`text-xs ${textSecondary}`}>
          One update per day on what moved in this project — every day's entry is kept below.
        </p>
      </div>

      {/* Today's update composer */}
      <Card className={`${bgCard} border ${borderColor}`}>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className={`text-sm font-semibold ${textPrimary} flex items-center gap-2`}>
              <CalendarDays className="h-4 w-4 text-[#6366f1]" /> Today's Update
            </p>
            {myNotesToday.length > 0 && (
              <span className="text-xs px-2 py-1 rounded-md bg-[#10b981]/20 text-[#10b981]" data-testid="daily-note-today-filed">
                {myNotesToday.length} update{myNotesToday.length > 1 ? 's' : ''} filed by you today
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div>
              <p className={`text-[11px] uppercase tracking-wide ${textSecondary} mb-1`}>Date</p>
              <Input
                type="date"
                value={draft.note_date}
                max={todayStr()}
                onChange={(e) => setDraft(d => ({ ...d, note_date: e.target.value }))}
                className={`h-9 w-[160px] ${bgSecondary} border ${borderColor} ${textPrimary}`}
                data-testid="daily-note-form-date"
              />
            </div>
            {departmentOptions.length > 1 && (
              <div>
                <p className={`text-[11px] uppercase tracking-wide ${textSecondary} mb-1`}>Department</p>
                <select
                  value={draft.department}
                  onChange={(e) => setDraft(d => ({ ...d, department: e.target.value }))}
                  className={`h-9 px-3 rounded-lg border ${borderColor} ${bgSecondary} ${textPrimary} text-sm`}
                  data-testid="daily-note-form-department"
                >
                  <option value="">All departments</option>
                  {departmentOptions.map(d => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <Textarea
            value={draft.note}
            onChange={(e) => setDraft(d => ({ ...d, note: e.target.value }))}
            placeholder="What happened on this project today? Progress, blockers, client feedback…"
            rows={3}
            className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
            data-testid="daily-note-form-note"
          />

          <div className="flex justify-end">
            <Button
              type="button"
              onClick={saveDraft}
              disabled={saving}
              size="sm"
              className="bg-[#6366f1] hover:bg-[#4f46e5] text-white"
              data-testid="daily-note-save-btn"
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> Save Update
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* All days */}
      <div className="flex flex-wrap items-center gap-2" data-testid="daily-note-filters">
        <select
          value={memberFilter}
          onChange={(e) => setMemberFilter(e.target.value)}
          className={`h-9 px-3 rounded-lg border ${borderColor} ${bgSecondary} ${textPrimary} text-sm`}
          data-testid="daily-note-filter-member"
        >
          <option value="all">All Team Members</option>
          {authors.map(a => (
            <option key={a.user_id} value={a.user_id}>{a.name}</option>
          ))}
        </select>

        <select
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className={`h-9 px-3 rounded-lg border ${borderColor} ${bgSecondary} ${textPrimary} text-sm`}
          data-testid="daily-note-filter-date"
        >
          <option value="all">All Days</option>
          <option value="today">Today</option>
          <option value="single">Single Date</option>
          <option value="range">Date Range</option>
        </select>

        {dateFilter === 'single' && (
          <Input
            type="date"
            value={singleDate}
            onChange={(e) => setSingleDate(e.target.value)}
            className={`h-9 w-[150px] ${bgSecondary} border ${borderColor} ${textPrimary}`}
            data-testid="daily-note-filter-single-date"
          />
        )}
        {dateFilter === 'range' && (
          <>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className={`h-9 w-[150px] ${bgSecondary} border ${borderColor} ${textPrimary}`}
              data-testid="daily-note-filter-date-from"
            />
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className={`h-9 w-[150px] ${bgSecondary} border ${borderColor} ${textPrimary}`}
              data-testid="daily-note-filter-date-to"
            />
          </>
        )}

        {(memberFilter !== 'all' || dateFilter !== 'all') && (
          <button
            onClick={() => { setMemberFilter('all'); setDateFilter('all'); setSingleDate(''); setDateFrom(''); setDateTo(''); }}
            className={`text-xs ${textSecondary} hover:underline`}
            data-testid="daily-note-filter-reset"
          >
            Reset
          </button>
        )}

        <span className={`text-xs ${textSecondary} ml-auto`} data-testid="daily-note-counts">
          {filtered.length} note{filtered.length === 1 ? '' : 's'} across {dayCount} day{dayCount === 1 ? '' : 's'}
        </span>
      </div>

      <Card className={`${bgCard} border ${borderColor}`}>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className={`border-b ${borderColor}`}>
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase w-44`}>Date</th>
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase w-40`}>Added By</th>
                  {departmentOptions.length > 1 && (
                    <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase w-32`}>Department</th>
                  )}
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase`}>Update</th>
                  <th className={`text-right p-3 text-[11px] font-medium ${textSecondary} uppercase w-24`}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((n, idx) => {
                  // One date heading per day, so the log reads day by day.
                  const isNewDay = idx === 0 || filtered[idx - 1].note_date !== n.note_date;
                  return (
                    <tr key={n.note_id} className={`border-b ${borderColor}`} data-testid={`daily-note-row-${n.note_id}`}>
                      <td className={`p-3 text-xs ${isNewDay ? `${textPrimary} font-medium` : textSecondary}`}>
                        {isNewDay ? fmtDay(n.note_date) : ''}
                      </td>
                      <td className={`p-3 text-sm ${textPrimary}`}>{authorName(n.created_by, n.created_by_name)}</td>
                      {departmentOptions.length > 1 && (
                        <td className={`p-3 text-xs ${textSecondary}`}>{n.department ? deptLabel(n.department) : '—'}</td>
                      )}
                      <td className={`p-3 text-sm ${textPrimary} max-w-[420px] truncate`} title={n.note}>{n.note}</td>
                      <td className="p-3 text-right">
                        <div className="inline-flex gap-1">
                          <button
                            type="button"
                            onClick={() => setModal({ mode: 'view', note: { ...n } })}
                            className={`p-1 ${textSecondary} hover:opacity-80`}
                            title="View"
                            data-testid={`daily-note-view-${n.note_id}`}
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          {canModify(n) && (
                            <button
                              type="button"
                              onClick={() => setModal({ mode: 'edit', note: { ...n } })}
                              className={`p-1 ${textSecondary} hover:opacity-80`}
                              title="Edit"
                              data-testid={`daily-note-edit-${n.note_id}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                          )}
                          {canModify(n) && (
                            <button
                              type="button"
                              onClick={() => deleteNote(n)}
                              className="p-1 text-red-500 hover:text-red-400"
                              title="Delete"
                              data-testid={`daily-note-delete-${n.note_id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={departmentOptions.length > 1 ? 5 : 4} className={`p-8 text-center text-xs ${textSecondary}`}>
                      {loading
                        ? 'Loading daily notes…'
                        : (notes.length === 0
                          ? 'No daily notes yet. Write today\'s update above to start the log.'
                          : 'No notes match these filters.')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* View / Edit popup */}
      {modal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-40 p-4" onClick={() => setModal(null)}>
          <div className={`${bgCard} border ${borderColor} rounded-xl w-full max-w-lg`} onClick={(e) => e.stopPropagation()}>
            <div className={`p-5 border-b ${borderColor} flex items-center justify-between`}>
              <h3 className={`text-base font-semibold ${textPrimary} flex items-center gap-2`}>
                <NotebookPen className="h-4 w-4 text-[#6366f1]" />
                {modal.mode === 'edit' ? 'Edit Daily Note' : fmtDay(modal.note.note_date)}
              </h3>
              <button onClick={() => setModal(null)} className={textSecondary}><X className="h-5 w-5" /></button>
            </div>

            <div className="p-5 space-y-3">
              {modal.mode === 'edit' ? (
                <>
                  <div>
                    <p className={`text-xs font-medium ${textSecondary} mb-1`}>Date</p>
                    <Input
                      type="date"
                      value={modal.note.note_date || ''}
                      onChange={(e) => setModal(m => ({ ...m, note: { ...m.note, note_date: e.target.value } }))}
                      className={`h-9 w-[160px] ${bgSecondary} border ${borderColor} ${textPrimary}`}
                      data-testid="daily-note-modal-date"
                    />
                  </div>
                  {departmentOptions.length > 1 && (
                    <div>
                      <p className={`text-xs font-medium ${textSecondary} mb-1`}>Department</p>
                      <select
                        value={modal.note.department || ''}
                        onChange={(e) => setModal(m => ({ ...m, note: { ...m.note, department: e.target.value } }))}
                        className={`h-9 px-3 rounded-lg border ${borderColor} ${bgSecondary} ${textPrimary} text-sm`}
                        data-testid="daily-note-modal-department"
                      >
                        <option value="">All departments</option>
                        {departmentOptions.map(d => (
                          <option key={d.value} value={d.value}>{d.label}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div>
                    <p className={`text-xs font-medium ${textSecondary} mb-1`}>Update</p>
                    <Textarea
                      value={modal.note.note || ''}
                      onChange={(e) => setModal(m => ({ ...m, note: { ...m.note, note: e.target.value } }))}
                      rows={5}
                      className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                      data-testid="daily-note-modal-note"
                      autoFocus
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <p className={`text-[11px] uppercase tracking-wide ${textSecondary}`}>Added By</p>
                    <p className={`text-sm ${textPrimary}`}>{authorName(modal.note.created_by, modal.note.created_by_name)}</p>
                  </div>
                  {modal.note.department && (
                    <div>
                      <p className={`text-[11px] uppercase tracking-wide ${textSecondary}`}>Department</p>
                      <p className={`text-sm ${textPrimary}`}>{deptLabel(modal.note.department)}</p>
                    </div>
                  )}
                  <div>
                    <p className={`text-[11px] uppercase tracking-wide ${textSecondary}`}>Update</p>
                    <p className={`text-sm ${textPrimary} whitespace-pre-wrap`}>{modal.note.note}</p>
                  </div>
                  <div>
                    <p className={`text-[11px] uppercase tracking-wide ${textSecondary}`}>Filed</p>
                    <p className={`text-xs ${textSecondary}`}>
                      {fmtDateTime(modal.note.created_at)}
                      {modal.note.updated_at && modal.note.updated_at !== modal.note.created_at && (
                        <> · edited {fmtDateTime(modal.note.updated_at)}</>
                      )}
                    </p>
                  </div>
                </>
              )}
            </div>

            <div className={`p-5 border-t ${borderColor} flex items-center justify-between gap-2`}>
              {modal.mode === 'view' && canModify(modal.note) ? (
                <button
                  type="button"
                  onClick={() => deleteNote(modal.note)}
                  className="text-sm text-red-500 hover:text-red-400 inline-flex items-center gap-1"
                  data-testid="daily-note-modal-delete"
                >
                  <Trash2 className="h-4 w-4" /> Delete
                </button>
              ) : <span />}
              <div className="flex items-center gap-2">
                {modal.mode === 'view' && canModify(modal.note) && (
                  <Button type="button" variant="outline" onClick={() => setModal(m => ({ ...m, mode: 'edit' }))} data-testid="daily-note-modal-edit">
                    <Pencil className="h-4 w-4 mr-1" /> Edit
                  </Button>
                )}
                {modal.mode === 'edit' ? (
                  <Button
                    type="button"
                    onClick={saveEdit}
                    disabled={saving}
                    className="bg-[#6366f1] hover:bg-[#4f46e5] text-white"
                    data-testid="daily-note-modal-save"
                  >
                    Save
                  </Button>
                ) : (
                  <Button type="button" variant="outline" onClick={() => setModal(null)}>Close</Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
