import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Plus, Trash2, Pencil, Eye, X, ExternalLink, Users as UsersIcon, ChevronDown, ChevronRight, ListChecks } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const STATUS_OPTIONS = ['To-Do', 'In Progress', 'Client Review', 'Completed'];
const STATUS_STYLE = {
  'To-Do': 'bg-slate-500/20 text-slate-300 border-slate-500/40',
  'In Progress': 'bg-blue-500/20 text-blue-400 border-blue-500/40',
  'Client Review': 'bg-amber-500/20 text-amber-400 border-amber-500/40',
  'Completed': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
};

const newId = (prefix) => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
const emptyPage = () => ({
  id: newId('pg'),
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

/**
 * ERP department's "Users" tab — replaces the old ERP Board / taxonomy.
 * Structure: User (e.g. "Super Admin", "HR Admin") → that user's Pages
 * (same fields as the Website department's Pages tab) → tasks tagged to
 * that page. Tasks are created from Operations > Add Task by picking
 * Department = ERP, then User, then Page.
 */
export default function ProjectErpUsersTab({
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

  const assigneeName = (userId) => (users || []).find(u => u.user_id === userId)?.name || userId || '—';

  const erpUsers = project?.erp_users || [];
  const tasks = project?.tasks || [];
  const tasksForPage = (pageId) => tasks.filter(t => t.erp_page_id === pageId);

  const [expandedUserId, setExpandedUserId] = useState(null);
  const [expandedPageId, setExpandedPageId] = useState(null);
  // { mode: 'add' | 'edit', name } — add/rename a User
  const [userModal, setUserModal] = useState(null);
  // { mode: 'add' | 'view', userId, page, editing } — add/view/edit a Page under a User
  const [pageModal, setPageModal] = useState(null);
  const [saving, setSaving] = useState(false);

  const persistUsers = async (nextUsers) => {
    try {
      const res = await axios.patch(
        `${API}/api/projects/${project.project_id}`,
        { erp_users: nextUsers },
        { headers },
      );
      onProjectUpdated?.(res.data);
      return true;
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to save');
      return false;
    }
  };

  // ---- User CRUD ----
  const openAddUser = () => { if (canEdit) setUserModal({ mode: 'add', name: '' }); };
  const openRenameUser = (u) => { if (canEdit) setUserModal({ mode: 'edit', id: u.id, name: u.user_name }); };
  const closeUserModal = () => setUserModal(null);

  const saveUserModal = async () => {
    if (!userModal.name.trim()) { toast.error('User name is required'); return; }
    setSaving(true);
    const next = userModal.mode === 'add'
      ? [...erpUsers, { id: newId('eu'), user_name: userModal.name.trim(), pages: [] }]
      : erpUsers.map(u => (u.id === userModal.id ? { ...u, user_name: userModal.name.trim() } : u));
    const ok = await persistUsers(next);
    setSaving(false);
    if (ok) {
      toast.success(userModal.mode === 'add' ? 'User added' : 'User updated');
      closeUserModal();
    }
  };

  const deleteUser = async (userId) => {
    if (!canEdit) return;
    if (!window.confirm('Remove this user and all its pages?')) return;
    const next = erpUsers.filter(u => u.id !== userId);
    const ok = await persistUsers(next);
    if (ok) toast.success('User removed');
  };

  // ---- Page CRUD (nested under a User) ----
  const openAddPage = (userId) => {
    if (!canEdit) return;
    setPageModal({ mode: 'add', userId, page: emptyPage(), editing: true });
  };
  const openViewPage = (userId, page) => setPageModal({ mode: 'view', userId, page: { ...page }, editing: false });
  const closePageModal = () => setPageModal(null);

  const savePageModal = async () => {
    const draft = pageModal.page;
    if (!(draft.page_name || '').trim()) { toast.error('Page name is required'); return; }
    setSaving(true);
    const next = erpUsers.map(u => {
      if (u.id !== pageModal.userId) return u;
      const pages = u.pages || [];
      const nextPages = pageModal.mode === 'add'
        ? [...pages, { ...draft, page_name: draft.page_name.trim() }]
        : pages.map(p => (p.id === draft.id ? { ...draft, page_name: draft.page_name.trim() } : p));
      return { ...u, pages: nextPages };
    });
    const ok = await persistUsers(next);
    setSaving(false);
    if (ok) {
      toast.success(pageModal.mode === 'add' ? 'Page added' : 'Page updated');
      closePageModal();
    }
  };

  const deletePage = async (userId, pageId) => {
    if (!canEdit) return;
    const next = erpUsers.map(u => (
      u.id === userId ? { ...u, pages: (u.pages || []).filter(p => p.id !== pageId) } : u
    ));
    const ok = await persistUsers(next);
    if (ok) { toast.success('Page removed'); closePageModal(); }
  };

  return (
    <div className="space-y-3" data-testid="project-erp-users-tab">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className={`text-lg font-semibold ${textPrimary} flex items-center gap-2`}>
            <UsersIcon className="h-5 w-5 text-[#6366f1]" /> Users
          </h3>
          <p className={`text-xs ${textSecondary}`}>
            Each user's pages track ERP work the same way the Website department tracks pages.
          </p>
        </div>
        {canEdit && (
          <Button
            type="button"
            onClick={openAddUser}
            size="sm"
            className="bg-[#6366f1] hover:bg-[#4f46e5] text-white"
            data-testid="erp-user-add-btn"
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> Add User
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
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase`}>User Name</th>
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase`}>Pages</th>
                  <th className={`text-right p-3 text-[11px] font-medium ${textSecondary} uppercase w-24`}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {erpUsers.map((u, idx) => {
                  const isExpanded = expandedUserId === u.id;
                  const pages = u.pages || [];
                  return (
                    <React.Fragment key={u.id}>
                      <tr className={`border-b ${borderColor}`} data-testid={`erp-user-row-${u.id}`}>
                        <td className={`p-3 text-xs ${textSecondary}`}>{idx + 1}</td>
                        <td className="p-3">
                          <button
                            type="button"
                            onClick={() => setExpandedUserId(isExpanded ? null : u.id)}
                            className={`inline-flex items-center gap-1.5 text-sm font-medium ${textPrimary} hover:opacity-80`}
                            data-testid={`erp-user-toggle-${u.id}`}
                          >
                            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            {u.user_name || '—'}
                          </button>
                        </td>
                        <td className={`p-3 text-xs ${textSecondary}`}>{pages.length}</td>
                        <td className="p-3 text-right">
                          <div className="inline-flex gap-1">
                            {canEdit && (
                              <button type="button" onClick={() => openRenameUser(u)} className={`p-1 ${textSecondary} hover:opacity-80`} title="Rename" data-testid={`erp-user-edit-${u.id}`}>
                                <Pencil className="h-4 w-4" />
                              </button>
                            )}
                            {canEdit && (
                              <button type="button" onClick={() => deleteUser(u.id)} className="p-1 text-red-500 hover:text-red-400" title="Delete" data-testid={`erp-user-delete-${u.id}`}>
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className={`border-b ${borderColor} ${bgSecondary}`} data-testid={`erp-user-pages-row-${u.id}`}>
                          <td colSpan={4} className="p-3">
                            <div className="flex items-center justify-between mb-2">
                              <p className={`text-xs font-semibold uppercase tracking-wide ${textSecondary}`}>Pages</p>
                              {canEdit && (
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={() => openAddPage(u.id)}
                                  className="bg-[#6366f1] hover:bg-[#4f46e5] text-white h-7 text-xs"
                                  data-testid={`erp-page-add-btn-${u.id}`}
                                >
                                  <Plus className="h-3 w-3 mr-1" /> Add Page
                                </Button>
                              )}
                            </div>
                            <div className={`overflow-x-auto rounded-md border ${borderColor} ${bgCard}`}>
                              <table className="w-full">
                                <thead>
                                  <tr className={`border-b ${borderColor}`}>
                                    <th className={`text-left px-3 py-2 text-[10px] font-medium ${textSecondary} uppercase w-10`}>S.No</th>
                                    <th className={`text-left px-3 py-2 text-[10px] font-medium ${textSecondary} uppercase`}>Page Name</th>
                                    <th className={`text-left px-3 py-2 text-[10px] font-medium ${textSecondary} uppercase`}>UI Link</th>
                                    <th className={`text-left px-3 py-2 text-[10px] font-medium ${textSecondary} uppercase`}>Content Link</th>
                                    <th className={`text-left px-3 py-2 text-[10px] font-medium ${textSecondary} uppercase`}>Page Link</th>
                                    <th className={`text-left px-3 py-2 text-[10px] font-medium ${textSecondary} uppercase`}>Status</th>
                                    <th className={`text-left px-3 py-2 text-[10px] font-medium ${textSecondary} uppercase`}>Tasks</th>
                                    <th className={`text-right px-3 py-2 text-[10px] font-medium ${textSecondary} uppercase w-20`}>Actions</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {pages.map((row, pIdx) => {
                                    const pageTasks = tasksForPage(row.id);
                                    const isPageExpanded = expandedPageId === row.id;
                                    return (
                                      <React.Fragment key={row.id}>
                                        <tr className={`border-b ${borderColor}`} data-testid={`erp-page-row-${row.id}`}>
                                          <td className={`px-3 py-2 text-xs ${textSecondary}`}>{pIdx + 1}</td>
                                          <td className={`px-3 py-2 text-sm font-medium ${textPrimary}`}>{row.page_name || '—'}</td>
                                          {['ui_link', 'content_link', 'page_link'].map((key) => (
                                            <td key={key} className="px-3 py-2">
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
                                          <td className="px-3 py-2">
                                            <span className={`px-2 py-1 rounded-md text-xs font-medium border ${STATUS_STYLE[row.status] || STATUS_STYLE['To-Do']}`}>
                                              {row.status || 'To-Do'}
                                            </span>
                                          </td>
                                          <td className="px-3 py-2">
                                            <button
                                              type="button"
                                              onClick={() => setExpandedPageId(isPageExpanded ? null : row.id)}
                                              className={`inline-flex items-center gap-1 text-xs ${textSecondary} hover:opacity-80`}
                                              data-testid={`erp-page-tasks-toggle-${row.id}`}
                                            >
                                              {isPageExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                                              <ListChecks className="h-3.5 w-3.5" />
                                              {pageTasks.length}
                                            </button>
                                          </td>
                                          <td className="px-3 py-2 text-right">
                                            <div className="inline-flex gap-1">
                                              <button type="button" onClick={() => openViewPage(u.id, row)} className={`p-1 ${textSecondary} hover:opacity-80`} title="View" data-testid={`erp-page-view-${row.id}`}>
                                                <Eye className="h-4 w-4" />
                                              </button>
                                              {canEdit && (
                                                <button type="button" onClick={() => deletePage(u.id, row.id)} className="p-1 text-red-500 hover:text-red-400" title="Delete" data-testid={`erp-page-delete-${row.id}`}>
                                                  <Trash2 className="h-4 w-4" />
                                                </button>
                                              )}
                                            </div>
                                          </td>
                                        </tr>
                                        {isPageExpanded && (
                                          <tr className={`border-b ${borderColor}`} data-testid={`erp-page-tasks-row-${row.id}`}>
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
                                                        <tr key={t.task_id} className={`border-b ${borderColor} last:border-b-0`} data-testid={`erp-task-row-${t.task_id}`}>
                                                          <td className={`px-3 py-2 text-sm ${textPrimary}`}>{t.task_name}</td>
                                                          <td className={`px-3 py-2 text-xs ${textSecondary}`}>{t.category || '—'}</td>
                                                          <td className={`px-3 py-2 text-xs ${textSecondary}`}>
                                                            {t.due_date ? new Date(t.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                                                          </td>
                                                          <td className={`px-3 py-2 text-xs ${textSecondary}`}>{assigneeName(t.assigned_to)}</td>
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
                                      <td colSpan={8} className={`p-6 text-center text-xs ${textSecondary}`}>
                                        No pages yet. {canEdit && <span>Click <span className="font-medium">Add Page</span> to add one.</span>}
                                      </td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
                {erpUsers.length === 0 && (
                  <tr>
                    <td colSpan={4} className={`p-8 text-center text-xs ${textSecondary}`}>
                      No users yet. {canEdit && <span>Click <span className="font-medium">Add User</span> to add one.</span>}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Add / Rename User popup */}
      {userModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[70] p-4" onClick={closeUserModal}>
          <div className={`${bgCard} border ${borderColor} rounded-xl w-full max-w-sm`} onClick={(e) => e.stopPropagation()}>
            <div className={`p-5 border-b ${borderColor} flex items-center justify-between`}>
              <h3 className={`text-base font-semibold ${textPrimary} flex items-center gap-2`}>
                <UsersIcon className="h-4 w-4 text-[#6366f1]" />
                {userModal.mode === 'add' ? 'Add User' : 'Rename User'}
              </h3>
              <button onClick={closeUserModal} className={textSecondary}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5">
              <p className={`text-xs font-medium ${textSecondary} mb-1`}>User Name</p>
              <Input
                value={userModal.name}
                onChange={(e) => setUserModal(m => ({ ...m, name: e.target.value }))}
                placeholder="e.g. Super Admin"
                className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                data-testid="erp-user-form-name"
                autoFocus
              />
            </div>
            <div className={`p-5 border-t ${borderColor} flex items-center justify-end gap-2`}>
              <Button type="button" variant="outline" onClick={closeUserModal}>Cancel</Button>
              <Button
                type="button"
                onClick={saveUserModal}
                disabled={saving}
                className="bg-[#6366f1] hover:bg-[#4f46e5] text-white"
                data-testid="erp-user-form-save"
              >
                Save
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add / View / Edit Page popup */}
      {pageModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[70] p-4" onClick={closePageModal}>
          <div className={`${bgCard} border ${borderColor} rounded-xl w-full max-w-lg`} onClick={(e) => e.stopPropagation()}>
            <div className={`p-5 border-b ${borderColor} flex items-center justify-between`}>
              <h3 className={`text-base font-semibold ${textPrimary} flex items-center gap-2`}>
                <UsersIcon className="h-4 w-4 text-[#6366f1]" />
                {pageModal.mode === 'add' ? 'Add Page' : (pageModal.editing ? 'Edit Page' : pageModal.page.page_name || 'Page Details')}
              </h3>
              <button onClick={closePageModal} className={textSecondary}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {pageModal.editing ? (
                <>
                  <div>
                    <p className={`text-xs font-medium ${textSecondary} mb-1`}>Page Name</p>
                    <Input
                      value={pageModal.page.page_name}
                      onChange={(e) => setPageModal(m => ({ ...m, page: { ...m.page, page_name: e.target.value } }))}
                      placeholder="e.g. Setting Page"
                      className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                      data-testid="erp-page-form-name"
                    />
                  </div>
                  <div>
                    <p className={`text-xs font-medium ${textSecondary} mb-1`}>UI Link</p>
                    <Input
                      value={pageModal.page.ui_link}
                      onChange={(e) => setPageModal(m => ({ ...m, page: { ...m.page, ui_link: e.target.value } }))}
                      placeholder="https://…"
                      className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                      data-testid="erp-page-form-ui-link"
                    />
                  </div>
                  <div>
                    <p className={`text-xs font-medium ${textSecondary} mb-1`}>Content Link</p>
                    <Input
                      value={pageModal.page.content_link}
                      onChange={(e) => setPageModal(m => ({ ...m, page: { ...m.page, content_link: e.target.value } }))}
                      placeholder="https://…"
                      className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                      data-testid="erp-page-form-content-link"
                    />
                  </div>
                  <div>
                    <p className={`text-xs font-medium ${textSecondary} mb-1`}>Page Link</p>
                    <Input
                      value={pageModal.page.page_link}
                      onChange={(e) => setPageModal(m => ({ ...m, page: { ...m.page, page_link: e.target.value } }))}
                      placeholder="https://…"
                      className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                      data-testid="erp-page-form-page-link"
                    />
                  </div>
                  <div>
                    <p className={`text-xs font-medium ${textSecondary} mb-1`}>Status</p>
                    <Select
                      value={pageModal.page.status}
                      onValueChange={(v) => setPageModal(m => ({ ...m, page: { ...m.page, status: v } }))}
                    >
                      <SelectTrigger className={`${bgSecondary} border ${borderColor} ${textPrimary}`} data-testid="erp-page-form-status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  <LinkField label="UI Link" value={pageModal.page.ui_link} textSecondary={textSecondary} textPrimary={textPrimary} />
                  <LinkField label="Content Link" value={pageModal.page.content_link} textSecondary={textSecondary} textPrimary={textPrimary} />
                  <LinkField label="Page Link" value={pageModal.page.page_link} textSecondary={textSecondary} textPrimary={textPrimary} />
                  <div>
                    <p className={`text-[11px] uppercase tracking-wide ${textSecondary}`}>Status</p>
                    <span className={`inline-block mt-1 px-2 py-1 rounded-md text-xs font-medium border ${STATUS_STYLE[pageModal.page.status] || STATUS_STYLE['To-Do']}`}>
                      {pageModal.page.status || 'To-Do'}
                    </span>
                  </div>
                </div>
              )}
            </div>
            <div className={`p-5 border-t ${borderColor} flex items-center justify-between gap-2`}>
              {pageModal.mode === 'view' && canEdit ? (
                <button
                  type="button"
                  onClick={() => deletePage(pageModal.userId, pageModal.page.id)}
                  className="text-sm text-red-500 hover:text-red-400 inline-flex items-center gap-1"
                  data-testid="erp-page-modal-delete"
                >
                  <Trash2 className="h-4 w-4" /> Delete
                </button>
              ) : <span />}
              <div className="flex items-center gap-2">
                {canEdit && pageModal.mode === 'view' && !pageModal.editing && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setPageModal(m => ({ ...m, editing: true }))}
                    data-testid="erp-page-modal-edit"
                  >
                    <Pencil className="h-4 w-4 mr-1" /> Edit
                  </Button>
                )}
                {pageModal.editing ? (
                  <Button
                    type="button"
                    onClick={savePageModal}
                    disabled={saving}
                    className="bg-[#6366f1] hover:bg-[#4f46e5] text-white"
                    data-testid="erp-page-modal-save"
                  >
                    Save
                  </Button>
                ) : (
                  <Button type="button" variant="outline" onClick={closePageModal}>Close</Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
