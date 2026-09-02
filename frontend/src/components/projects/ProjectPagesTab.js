import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Plus, Trash2, Pencil, Eye, X, ExternalLink, Globe, ChevronDown, ChevronRight, ListChecks } from 'lucide-react';
import PageTaskModal from './PageTaskModal';

const API = process.env.REACT_APP_BACKEND_URL;

const STATUS_OPTIONS = ['To-Do', 'In Progress', 'Client Review', 'Completed'];
const STATUS_STYLE = {
  'To-Do': 'bg-slate-500/20 text-slate-300 border-slate-500/40',
  'In Progress': 'bg-blue-500/20 text-blue-400 border-blue-500/40',
  'Client Review': 'bg-amber-500/20 text-amber-400 border-amber-500/40',
  'Completed': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
};

// Per-task status colors — mirrors the pending/in_progress/completed
// vocabulary used across the app (see OurTasksPage.js's "to do" bucket).
const TASK_STATUS_STYLE = {
  completed: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
  pending: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
  in_progress: 'bg-red-500/20 text-red-400 border-red-500/40',
};
const taskStatusStyle = (status) => TASK_STATUS_STYLE[status || 'pending'] || 'bg-slate-500/20 text-slate-300 border-slate-500/40';
// "To Do" bucket = pending + in_progress, matching OurTasksPage's total_to_do.
const isToDo = (status) => (status || 'pending') === 'pending' || status === 'in_progress';

const newPageId = () => `pg_${Math.random().toString(36).slice(2, 10)}`;
const newSectionId = () => `sec_${Math.random().toString(36).slice(2, 10)}`;
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
  onTasksChanged,
  canEdit,
  currentUser,
  users,
  projectMembers = [],
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
  const tasksForSection = (sectionId) => tasks.filter(t => t.page_section_id === sectionId);

  // modal state: { mode: 'add' | 'view', page, editing } or null
  const [modal, setModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [expandedPageIds, setExpandedPageIds] = useState(() => new Set());
  const togglePage = (id) => setExpandedPageIds((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  // Sections nested under each page — a separate expand toggle from the
  // page-tasks one above (only one page's sections open at a time, same
  // as the ERP Workflow tab's single-expanded-id pattern).
  const [expandedSectionsPageId, setExpandedSectionsPageId] = useState(null);
  const [expandedSectionTasksId, setExpandedSectionTasksId] = useState(null);
  // { mode: 'add' | 'edit', pageId, id, name }
  const [sectionModal, setSectionModal] = useState(null);

  const openAddSection = (pageId) => {
    if (!canEdit) return;
    setSectionModal({ mode: 'add', pageId, name: '' });
  };
  const openEditSection = (pageId, section) => {
    if (!canEdit) return;
    setSectionModal({ mode: 'edit', pageId, id: section.id, name: section.name });
  };
  const closeSectionModal = () => setSectionModal(null);

  const saveSectionModal = async () => {
    if (!sectionModal.name.trim()) { toast.error('Section name is required'); return; }
    setSaving(true);
    const trimmed = sectionModal.name.trim();
    const next = pages.map((p) => {
      if (p.id !== sectionModal.pageId) return p;
      const sections = p.sections || [];
      const nextSections = sectionModal.mode === 'add'
        ? [...sections, { id: newSectionId(), name: trimmed }]
        : sections.map((s) => (s.id === sectionModal.id ? { ...s, name: trimmed } : s));
      return { ...p, sections: nextSections };
    });
    const ok = await persist(next);
    setSaving(false);
    if (ok) {
      toast.success(sectionModal.mode === 'add' ? 'Section added' : 'Section updated');
      closeSectionModal();
    }
  };

  const deleteSection = async (pageId, sectionId) => {
    if (!canEdit) return;
    if (tasksForSection(sectionId).length > 0) {
      toast.error('Cannot delete: tasks are tagged with this section. Untag them first.');
      return;
    }
    if (!window.confirm('Remove this section?')) return;
    const next = pages.map((p) => (
      p.id === pageId ? { ...p, sections: (p.sections || []).filter((s) => s.id !== sectionId) } : p
    ));
    const ok = await persist(next);
    if (ok) toast.success('Section removed');
  };

  // Add Task, opened from the Pages tab's own per-row AddTaskButton (below)
  // — pre-fills that page's (and, if opened from a section row, that
  // section's) id+name into the shared PageTaskModal. Not gated by canEdit
  // — logging a task is a much lower-risk action than editing the page
  // structure itself.
  const [taskModal, setTaskModal] = useState(null);
  const openAddTask = (ctx) => setTaskModal(ctx);
  const closeTaskModal = () => setTaskModal(null);

  const AddTaskButton = ({ onClick, testId }) => (
    <button
      type="button"
      onClick={onClick}
      className="p-1 text-[#6366f1] hover:opacity-80"
      title="Add Task"
      data-testid={testId}
    >
      <Plus className="h-4 w-4" />
    </button>
  );

  // Summary cards + click-to-filter — only tasks actually tagged to a page
  // count here (tasks without website_page_id live elsewhere in the project).
  const [taskFilter, setTaskFilter] = useState(null); // null | 'to_do' | 'pending' | 'completed'
  const pageTasksAll = tasks.filter(t => t.website_page_id);
  const summary = {
    totalPages: pages.length,
    toDo: pageTasksAll.filter(t => isToDo(t.status)).length,
    completed: pageTasksAll.filter(t => (t.status || 'pending') === 'completed').length,
    pending: pageTasksAll.filter(t => (t.status || 'pending') === 'pending').length,
  };
  const matchesTaskFilter = (t) => {
    if (!taskFilter) return true;
    if (taskFilter === 'to_do') return isToDo(t.status);
    return (t.status || 'pending') === taskFilter;
  };
  const applyCardFilter = (key) => {
    if (!key) { setTaskFilter(null); setExpandedPageIds(new Set()); return; }
    setTaskFilter(key);
    const matchPages = pages
      .filter(p => tasksForPage(p.id).some(t => (key === 'to_do' ? isToDo(t.status) : (t.status || 'pending') === key)))
      .map(p => p.id);
    setExpandedPageIds(new Set(matchPages));
  };

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

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { key: null, label: 'Total Pages', value: summary.totalPages, color: textPrimary },
          { key: 'to_do', label: 'Total To-Do', value: summary.toDo, color: 'text-red-500' },
          { key: 'completed', label: 'Completed', value: summary.completed, color: 'text-emerald-500' },
          { key: 'pending', label: 'Pending', value: summary.pending, color: 'text-amber-500' },
        ].map((c) => {
          const active = c.key === null ? !taskFilter : taskFilter === c.key;
          return (
            <button
              key={c.label}
              type="button"
              onClick={() => applyCardFilter(c.key)}
              className={`${bgCard} border rounded-xl p-3 text-left transition-colors ${active ? 'border-[#6366f1] ring-1 ring-[#6366f1]' : `${borderColor} hover:border-[#6366f1]/40`}`}
              data-testid={`pages-summary-${c.label.replace(/\s+/g, '-').toLowerCase()}`}
            >
              <p className={`text-[11px] ${textSecondary} leading-tight`}>{c.label}</p>
              <p className={`text-xl font-bold ${c.color}`}>{c.value}</p>
            </button>
          );
        })}
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
                  const isExpanded = expandedPageIds.has(row.id);
                  const sections = row.sections || [];
                  const isSectionsExpanded = expandedSectionsPageId === row.id;
                  return (
                  <React.Fragment key={row.id}>
                  <tr className={`border-b ${borderColor}`} data-testid={`page-row-${row.id}`}>
                    <td className={`p-3 text-xs ${textSecondary}`}>{idx + 1}</td>
                    <td className={`p-3 text-sm font-medium ${textPrimary}`}>
                      <button
                        type="button"
                        onClick={() => setExpandedSectionsPageId(isSectionsExpanded ? null : row.id)}
                        className="inline-flex items-center gap-1.5 hover:opacity-80"
                        data-testid={`page-sections-toggle-${row.id}`}
                      >
                        {isSectionsExpanded ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
                        {row.page_name || '—'}
                      </button>
                    </td>
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
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => togglePage(row.id)}
                          className={`inline-flex items-center gap-1 text-xs ${textSecondary} hover:opacity-80`}
                          data-testid={`page-tasks-toggle-${row.id}`}
                        >
                          {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                          <ListChecks className="h-3.5 w-3.5" />
                          {pageTasks.length}
                        </button>
                        <AddTaskButton
                          onClick={() => openAddTask({ pageId: row.id, pageName: row.page_name })}
                          testId={`page-addtask-${row.id}`}
                        />
                      </div>
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
                  {isExpanded && (() => {
                    const filteredTasks = pageTasks.filter(matchesTaskFilter);
                    return (
                    <tr className={`border-b ${borderColor} ${bgSecondary}`} data-testid={`page-tasks-row-${row.id}`}>
                      <td colSpan={8} className="p-3">
                        {taskFilter && (
                          <p className={`text-[11px] ${textSecondary} mb-2`}>Showing {filteredTasks.length} of {pageTasks.length} tasks matching the filter.</p>
                        )}
                        {filteredTasks.length === 0 ? (
                          <p className={`text-xs ${textSecondary}`}>{taskFilter ? 'No tasks on this page match the filter.' : 'No tasks tagged to this page yet.'}</p>
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
                                {filteredTasks.map(t => (
                                  <tr key={t.task_id} className={`border-b ${borderColor} last:border-b-0`} data-testid={`page-task-row-${t.task_id}`}>
                                    <td className={`px-3 py-2 text-sm ${textPrimary}`}>{t.task_name}</td>
                                    <td className={`px-3 py-2 text-xs ${textSecondary}`}>{t.category || '—'}</td>
                                    <td className={`px-3 py-2 text-xs ${textSecondary}`}>
                                      {t.due_date ? new Date(t.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                                    </td>
                                    <td className={`px-3 py-2 text-xs ${textSecondary}`}>{userName(t.assigned_to)}</td>
                                    <td className={`px-3 py-2 text-xs ${textSecondary}`}>{t.all_day ? 'All day' : (t.due_time || '—')}</td>
                                    <td className="px-3 py-2">
                                      <span className={`px-2 py-0.5 rounded text-[10px] font-medium uppercase border ${taskStatusStyle(t.status)}`}>
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
                    );
                  })()}
                  {isSectionsExpanded && (
                    <tr className={`border-b ${borderColor} ${bgSecondary}`} data-testid={`page-sections-row-${row.id}`}>
                      <td colSpan={8} className="p-3">
                        <div className="flex items-center justify-between mb-2">
                          <p className={`text-xs font-semibold uppercase tracking-wide ${textSecondary}`}>Sections</p>
                          {canEdit && (
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => openAddSection(row.id)}
                              className="bg-[#6366f1] hover:bg-[#4f46e5] text-white h-7 text-xs"
                              data-testid={`page-section-add-btn-${row.id}`}
                            >
                              <Plus className="h-3 w-3 mr-1" /> Add Section
                            </Button>
                          )}
                        </div>
                        {sections.length === 0 ? (
                          <p className={`text-xs ${textSecondary}`}>No sections yet.</p>
                        ) : (
                          <div className={`rounded-md border ${borderColor} ${bgCard}`}>
                            {sections.map((sec) => {
                              const secTasks = tasksForSection(sec.id);
                              const isSecTasksExpanded = expandedSectionTasksId === sec.id;
                              return (
                                <div key={sec.id} className={`border-b ${borderColor} last:border-b-0`} data-testid={`page-section-row-${sec.id}`}>
                                  <div className="flex items-center justify-between px-3 py-2">
                                    <span className={`text-sm ${textPrimary}`}>{sec.name}</span>
                                    <div className="flex items-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() => setExpandedSectionTasksId(isSecTasksExpanded ? null : sec.id)}
                                        className={`inline-flex items-center gap-1 text-xs ${textSecondary} hover:opacity-80`}
                                        data-testid={`page-section-tasks-toggle-${sec.id}`}
                                      >
                                        <ListChecks className="h-3.5 w-3.5" />
                                        {secTasks.length}
                                      </button>
                                      <AddTaskButton
                                        onClick={() => openAddTask({ pageId: row.id, pageName: row.page_name, sectionId: sec.id, sectionName: sec.name })}
                                        testId={`page-section-addtask-${sec.id}`}
                                      />
                                      {canEdit && (
                                        <button type="button" onClick={() => openEditSection(row.id, sec)} className={`p-1 ${textSecondary} hover:opacity-80`} title="Rename" data-testid={`page-section-edit-${sec.id}`}>
                                          <Pencil className="h-3.5 w-3.5" />
                                        </button>
                                      )}
                                      {canEdit && (
                                        <button
                                          type="button"
                                          onClick={() => deleteSection(row.id, sec.id)}
                                          disabled={secTasks.length > 0}
                                          className={`p-1 ${secTasks.length > 0 ? 'text-red-500/30 cursor-not-allowed' : 'text-red-500 hover:text-red-400'}`}
                                          title={secTasks.length > 0 ? 'Cannot delete: tasks are tagged with this section' : 'Delete'}
                                          data-testid={`page-section-delete-${sec.id}`}
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                  {isSecTasksExpanded && (
                                    <div className="px-3 pb-3">
                                      {secTasks.length === 0 ? (
                                        <p className={`text-xs ${textSecondary}`}>No tasks tagged to this section yet.</p>
                                      ) : (
                                        <div className={`overflow-x-auto rounded-md border ${borderColor} ${bgCard}`}>
                                          <table className="w-full">
                                            <thead>
                                              <tr className={`border-b ${borderColor}`}>
                                                <th className={`text-left px-3 py-2 text-[10px] font-medium ${textSecondary} uppercase`}>Name of the Task</th>
                                                <th className={`text-left px-3 py-2 text-[10px] font-medium ${textSecondary} uppercase`}>Category</th>
                                                <th className={`text-left px-3 py-2 text-[10px] font-medium ${textSecondary} uppercase`}>Date</th>
                                                <th className={`text-left px-3 py-2 text-[10px] font-medium ${textSecondary} uppercase`}>Assign To</th>
                                                <th className={`text-left px-3 py-2 text-[10px] font-medium ${textSecondary} uppercase`}>Status</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {secTasks.map(t => (
                                                <tr key={t.task_id} className={`border-b ${borderColor} last:border-b-0`} data-testid={`page-section-task-row-${t.task_id}`}>
                                                  <td className={`px-3 py-2 text-sm ${textPrimary}`}>{t.task_name}</td>
                                                  <td className={`px-3 py-2 text-xs ${textSecondary}`}>{t.category || '—'}</td>
                                                  <td className={`px-3 py-2 text-xs ${textSecondary}`}>
                                                    {t.due_date ? new Date(t.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                                                  </td>
                                                  <td className={`px-3 py-2 text-xs ${textSecondary}`}>{userName(t.assigned_to)}</td>
                                                  <td className="px-3 py-2">
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-medium uppercase border ${taskStatusStyle(t.status)}`}>
                                                      {(t.status || 'pending').replace('_', ' ')}
                                                    </span>
                                                  </td>
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
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

      {/* Add / Rename Section popup — z-40 like the Add/View/Edit popup
          above, no competing Select portal here to worry about either way. */}
      {sectionModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-40 p-4" onClick={closeSectionModal}>
          <div className={`${bgCard} border ${borderColor} rounded-xl w-full max-w-sm`} onClick={(e) => e.stopPropagation()}>
            <div className={`p-5 border-b ${borderColor} flex items-center justify-between`}>
              <h3 className={`text-base font-semibold ${textPrimary} flex items-center gap-2`}>
                <Globe className="h-4 w-4 text-[#6366f1]" />
                {sectionModal.mode === 'add' ? 'Add Section' : 'Rename Section'}
              </h3>
              <button onClick={closeSectionModal} className={textSecondary}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5">
              <p className={`text-xs font-medium ${textSecondary} mb-1`}>Section Name</p>
              <Input
                value={sectionModal.name}
                onChange={(e) => setSectionModal(m => ({ ...m, name: e.target.value }))}
                placeholder="e.g. Hero"
                className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                data-testid="page-section-form-name"
                autoFocus
              />
            </div>
            <div className={`p-5 border-t ${borderColor} flex items-center justify-end gap-2`}>
              <Button type="button" variant="outline" onClick={closeSectionModal}>Cancel</Button>
              <Button
                type="button"
                onClick={saveSectionModal}
                disabled={saving}
                className="bg-[#6366f1] hover:bg-[#4f46e5] text-white"
                data-testid="page-section-form-save"
              >
                Save
              </Button>
            </div>
          </div>
        </div>
      )}

      {taskModal && (
        <PageTaskModal
          project={project}
          projectMembers={projectMembers}
          currentUser={currentUser}
          headers={headers}
          pageId={taskModal.pageId}
          pageName={taskModal.pageName}
          sectionId={taskModal.sectionId}
          sectionName={taskModal.sectionName}
          onClose={closeTaskModal}
          onSaved={onTasksChanged}
          bgCard={bgCard}
          bgSecondary={bgSecondary}
          textPrimary={textPrimary}
          textSecondary={textSecondary}
          borderColor={borderColor}
        />
      )}
    </div>
  );
}
