import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Plus, Trash2, Pencil, Eye, X, ExternalLink, Globe, ChevronDown, ChevronRight, ListChecks } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const STATUS_OPTIONS = ['To-Do', 'In Progress', 'Client Review', 'Completed'];
const STATUS_STYLE = {
  'To-Do': 'bg-slate-500/20 text-slate-300 border-slate-500/40',
  'In Progress': 'bg-blue-500/20 text-blue-400 border-blue-500/40',
  'Client Review': 'bg-amber-500/20 text-amber-400 border-amber-500/40',
  'Completed': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
};

const newPageId = () => `pg_${Math.random().toString(36).slice(2, 10)}`;
const emptyPage = () => ({
  id: newPageId(),
  page_name: '',
  ui_link: '',
  content_link: '',
  page_link: '',
  status: 'To-Do',
});

const LinkField = ({ label, value, textSecondary, textPrimary }) => (
  <div>
    <p className={`text-[11px] uppercase tracking-wide ${textSecondary}`}>{label}</p>
    {value ? (
      <a
        href={value}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm text-[#6366f1] hover:underline inline-flex items-center gap-1 mt-0.5"
      >
        <ExternalLink className="h-3.5 w-3.5" /> Open link
      </a>
    ) : (
      <p className={`text-sm ${textPrimary} mt-0.5`}>Not added</p>
    )}
  </div>
);

export default function ProjectPagesTab({
  project,
  onProjectUpdated,
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

  const userName = (userId) => (users || []).find(u => u.user_id === userId)?.name || userId || '—';

  const pages = project?.pages || [];
  const tasks = project?.tasks || [];
  const tasksForPage = (pageId) => tasks.filter(t => t.website_page_id === pageId);

  // modal state: { mode: 'add' | 'view', page, editing } or null
  const [modal, setModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [expandedPageId, setExpandedPageId] = useState(null);

  const persist = async (nextPages) => {
    try {
      const res = await axios.patch(
        `${API}/api/projects/${project.project_id}`,
        { pages: nextPages },
        { headers },
      );
      onProjectUpdated?.(res.data);
      return true;
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to save');
      return false;
    }
  };

  const openAdd = () => {
    if (!canEdit) return;
    setModal({ mode: 'add', page: emptyPage(), editing: true });
  };

  const openView = (page) => setModal({ mode: 'view', page: { ...page }, editing: false });

  const closeModal = () => setModal(null);

  const saveModal = async () => {
    const draft = modal.page;
    if (!(draft.page_name || '').trim()) { toast.error('Page name is required'); return; }
    setSaving(true);
    const next = modal.mode === 'add'
      ? [...pages, { ...draft, page_name: draft.page_name.trim() }]
      : pages.map(p => (p.id === draft.id ? { ...draft, page_name: draft.page_name.trim() } : p));
    const ok = await persist(next);
    setSaving(false);
    if (ok) {
      toast.success(modal.mode === 'add' ? 'Page added' : 'Page updated');
      closeModal();
    }
  };

  const deletePage = async (id) => {
    if (!canEdit) return;
    const next = pages.filter(p => p.id !== id);
    const ok = await persist(next);
    if (ok) { toast.success('Page removed'); closeModal(); }
  };

  return (
    <div className="space-y-3" data-testid="project-pages-tab">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className={`text-lg font-semibold ${textPrimary} flex items-center gap-2`}>
            <Globe className="h-5 w-5 text-[#6366f1]" /> Pages
          </h3>
          <p className={`text-xs ${textSecondary}`}>
            Track each website page with its UI, content, and live link.
          </p>
        </div>
        {canEdit && (
          <Button
            type="button"
            onClick={openAdd}
            size="sm"
            className="bg-[#6366f1] hover:bg-[#4f46e5] text-white"
            data-testid="page-add-btn"
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> Add Page
          </Button>
        )}
      </div>

      <Card className={`${bgCard} border ${borderColor}`}>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className={`border-b ${borderColor}`}>
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase w-12`}>S.No</th>
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase`}>Page Name</th>
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase`}>UI Link</th>
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase`}>Content Link</th>
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase`}>Page Link</th>
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase`}>Status</th>
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase`}>Tasks</th>
                  <th className={`text-right p-3 text-[11px] font-medium ${textSecondary} uppercase w-24`}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pages.map((row, idx) => {
                  const pageTasks = tasksForPage(row.id);
                  const isExpanded = expandedPageId === row.id;
                  return (
                  <React.Fragment key={row.id}>
                  <tr className={`border-b ${borderColor}`} data-testid={`page-row-${row.id}`}>
                    <td className={`p-3 text-xs ${textSecondary}`}>{idx + 1}</td>
                    <td className={`p-3 text-sm font-medium ${textPrimary}`}>{row.page_name || '—'}</td>
                    {['ui_link', 'content_link', 'page_link'].map((key) => (
                      <td key={key} className="p-3">
                        {row[key] ? (
                          <a
                            href={row[key]}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-[#6366f1] hover:underline inline-flex items-center gap-1"
                          >
                            <ExternalLink className="h-3 w-3" /> Open
                          </a>
                        ) : (
                          <span className={`text-xs ${textSecondary}`}>—</span>
                        )}
                      </td>
                    ))}
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded-md text-xs font-medium border ${STATUS_STYLE[row.status] || STATUS_STYLE['To-Do']}`}>
                        {row.status || 'To-Do'}
                      </span>
                    </td>
                    <td className="p-3">
                      <button
                        type="button"
                        onClick={() => setExpandedPageId(isExpanded ? null : row.id)}
                        className={`inline-flex items-center gap-1 text-xs ${textSecondary} hover:opacity-80`}
                        data-testid={`page-tasks-toggle-${row.id}`}
                      >
                        {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                        <ListChecks className="h-3.5 w-3.5" />
                        {pageTasks.length}
                      </button>
                    </td>
                    <td className="p-3 text-right">
                      <div className="inline-flex gap-1">
                        <button type="button" onClick={() => openView(row)} className={`p-1 ${textSecondary} hover:opacity-80`} title="View" data-testid={`page-view-${row.id}`}>
                          <Eye className="h-4 w-4" />
                        </button>
                        {canEdit && (
                          <button type="button" onClick={() => deletePage(row.id)} className="p-1 text-red-500 hover:text-red-400" title="Delete" data-testid={`page-delete-${row.id}`}>
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className={`border-b ${borderColor} ${bgSecondary}`} data-testid={`page-tasks-row-${row.id}`}>
                      <td colSpan={8} className="p-3">
                        {pageTasks.length === 0 ? (
                          <p className={`text-xs ${textSecondary}`}>No tasks tagged to this page yet.</p>
                        ) : (
                          <div className={`overflow-x-auto rounded-md border ${borderColor} ${bgCard}`}>
                            <table className="w-full">
                              <thead>
                                <tr className={`border-b ${borderColor}`}>
                                  <th className={`text-left px-3 py-2 text-[10px] font-medium ${textSecondary} uppercase`}>Name of the Task</th>
                                  <th className={`text-left px-3 py-2 text-[10px] font-medium ${textSecondary} uppercase`}>Category</th>
                                  <th className={`text-left px-3 py-2 text-[10px] font-medium ${textSecondary} uppercase`}>Date</th>
                                  <th className={`text-left px-3 py-2 text-[10px] font-medium ${textSecondary} uppercase`}>Assign To</th>
                                  <th className={`text-left px-3 py-2 text-[10px] font-medium ${textSecondary} uppercase`}>Delivery Time</th>
                                  <th className={`text-left px-3 py-2 text-[10px] font-medium ${textSecondary} uppercase`}>Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {pageTasks.map(t => (
                                  <tr key={t.task_id} className={`border-b ${borderColor} last:border-b-0`} data-testid={`page-task-row-${t.task_id}`}>
                                    <td className={`px-3 py-2 text-sm ${textPrimary}`}>{t.task_name}</td>
                                    <td className={`px-3 py-2 text-xs ${textSecondary}`}>{t.category || '—'}</td>
                                    <td className={`px-3 py-2 text-xs ${textSecondary}`}>
                                      {t.due_date ? new Date(t.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                                    </td>
                                    <td className={`px-3 py-2 text-xs ${textSecondary}`}>{userName(t.assigned_to)}</td>
                                    <td className={`px-3 py-2 text-xs ${textSecondary}`}>{t.all_day ? 'All day' : (t.due_time || '—')}</td>
                                    <td className="px-3 py-2">
                                      <span className={`px-2 py-0.5 rounded text-[10px] font-medium uppercase ${textSecondary} border ${borderColor}`}>
                                        {(t.status || 'pending').replace('_', ' ')}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                  </React.Fragment>
                  );
                })}
                {pages.length === 0 && (
                  <tr>
                    <td colSpan={8} className={`p-8 text-center text-xs ${textSecondary}`}>
                      No pages yet. {canEdit && <span>Click <span className="font-medium">Add Page</span> to add one.</span>}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Add / View / Edit popup */}
      {/* z-40, not z-[70]: the Status <Select> below portals to document.body
          at z-50 (ui/select.jsx) — z-[70] would render this modal on top of it. */}
      {modal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-40 p-4" onClick={closeModal}>
          <div className={`${bgCard} border ${borderColor} rounded-xl w-full max-w-lg`} onClick={(e) => e.stopPropagation()}>
            <div className={`p-5 border-b ${borderColor} flex items-center justify-between`}>
              <h3 className={`text-base font-semibold ${textPrimary} flex items-center gap-2`}>
                <Globe className="h-4 w-4 text-[#6366f1]" />
                {modal.mode === 'add' ? 'Add Page' : (modal.editing ? 'Edit Page' : modal.page.page_name || 'Page Details')}
              </h3>
              <button onClick={closeModal} className={textSecondary}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {modal.editing ? (
                <>
                  <div>
                    <p className={`text-xs font-medium ${textSecondary} mb-1`}>Page Name</p>
                    <Input
                      value={modal.page.page_name}
                      onChange={(e) => setModal(m => ({ ...m, page: { ...m.page, page_name: e.target.value } }))}
                      placeholder="e.g. Home Page"
                      className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                      data-testid="page-form-name"
                    />
                  </div>
                  <div>
                    <p className={`text-xs font-medium ${textSecondary} mb-1`}>UI Link</p>
                    <Input
                      value={modal.page.ui_link}
                      onChange={(e) => setModal(m => ({ ...m, page: { ...m.page, ui_link: e.target.value } }))}
                      placeholder="https://…"
                      className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                      data-testid="page-form-ui-link"
                    />
                  </div>
                  <div>
                    <p className={`text-xs font-medium ${textSecondary} mb-1`}>Content Link</p>
                    <Input
                      value={modal.page.content_link}
                      onChange={(e) => setModal(m => ({ ...m, page: { ...m.page, content_link: e.target.value } }))}
                      placeholder="https://…"
                      className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                      data-testid="page-form-content-link"
                    />
                  </div>
                  <div>
                    <p className={`text-xs font-medium ${textSecondary} mb-1`}>Page Link</p>
                    <Input
                      value={modal.page.page_link}
                      onChange={(e) => setModal(m => ({ ...m, page: { ...m.page, page_link: e.target.value } }))}
                      placeholder="https://…"
                      className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                      data-testid="page-form-page-link"
                    />
                  </div>
                  <div>
                    <p className={`text-xs font-medium ${textSecondary} mb-1`}>Status</p>
                    <Select
                      value={modal.page.status}
                      onValueChange={(v) => setModal(m => ({ ...m, page: { ...m.page, status: v } }))}
                    >
                      <SelectTrigger className={`${bgSecondary} border ${borderColor} ${textPrimary}`} data-testid="page-form-status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-4">
                    <LinkField label="UI Link" value={modal.page.ui_link} textSecondary={textSecondary} textPrimary={textPrimary} />
                    <LinkField label="Content Link" value={modal.page.content_link} textSecondary={textSecondary} textPrimary={textPrimary} />
                    <LinkField label="Page Link" value={modal.page.page_link} textSecondary={textSecondary} textPrimary={textPrimary} />
                    <div>
                      <p className={`text-[11px] uppercase tracking-wide ${textSecondary}`}>Status</p>
                      <span className={`inline-block mt-1 px-2 py-1 rounded-md text-xs font-medium border ${STATUS_STYLE[modal.page.status] || STATUS_STYLE['To-Do']}`}>
                        {modal.page.status || 'To-Do'}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>
            <div className={`p-5 border-t ${borderColor} flex items-center justify-between gap-2`}>
              {modal.mode === 'view' && canEdit ? (
                <button
                  type="button"
                  onClick={() => deletePage(modal.page.id)}
                  className="text-sm text-red-500 hover:text-red-400 inline-flex items-center gap-1"
                  data-testid="page-modal-delete"
                >
                  <Trash2 className="h-4 w-4" /> Delete
                </button>
              ) : <span />}
              <div className="flex items-center gap-2">
                {canEdit && modal.mode === 'view' && !modal.editing && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setModal(m => ({ ...m, editing: true }))}
                    data-testid="page-modal-edit"
                  >
                    <Pencil className="h-4 w-4 mr-1" /> Edit
                  </Button>
                )}
                {modal.editing ? (
                  <Button
                    type="button"
                    onClick={saveModal}
                    disabled={saving}
                    className="bg-[#6366f1] hover:bg-[#4f46e5] text-white"
                    data-testid="page-modal-save"
                  >
                    Save
                  </Button>
                ) : (
                  <Button type="button" variant="outline" onClick={closeModal}>Close</Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
