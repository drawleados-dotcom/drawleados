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
const emptyTab = (prefix) => ({
  id: newId(prefix),
  name: '',
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

/** Shared Add/View/Edit popup for a Sub Tab or Ultra Sub Tab — same field shape as a Page. */
const TabDetailModal = ({
  modal, setModal, onClose, onSave, onDelete, saving, canEdit,
  bgCard, bgSecondary, textPrimary, textSecondary, borderColor,
  testPrefix, titleAdd, titleEdit,
}) => {
  if (!modal) return null;
  return (
    // z-40, not z-[70]: the Status <Select> below portals to document.body
    // at z-50 (ui/select.jsx) — z-[70] would render this modal on top of it.
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-40 p-4" onClick={onClose}>
      <div className={`${bgCard} border ${borderColor} rounded-xl w-full max-w-lg`} onClick={(e) => e.stopPropagation()}>
        <div className={`p-5 border-b ${borderColor} flex items-center justify-between`}>
          <h3 className={`text-base font-semibold ${textPrimary} flex items-center gap-2`}>
            <UsersIcon className="h-4 w-4 text-[#6366f1]" />
            {modal.mode === 'add' ? titleAdd : (modal.editing ? titleEdit : (modal.tab.name || 'Details'))}
          </h3>
          <button onClick={onClose} className={textSecondary}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          {modal.editing ? (
            <>
              <div>
                <p className={`text-xs font-medium ${textSecondary} mb-1`}>Name</p>
                <Input
                  value={modal.tab.name}
                  onChange={(e) => setModal(m => ({ ...m, tab: { ...m.tab, name: e.target.value } }))}
                  placeholder="e.g. Anbu"
                  className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                  data-testid={`${testPrefix}-form-name`}
                  autoFocus
                />
              </div>
              <div>
                <p className={`text-xs font-medium ${textSecondary} mb-1`}>UI Link</p>
                <Input
                  value={modal.tab.ui_link}
                  onChange={(e) => setModal(m => ({ ...m, tab: { ...m.tab, ui_link: e.target.value } }))}
                  placeholder="https://…"
                  className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                  data-testid={`${testPrefix}-form-ui-link`}
                />
              </div>
              <div>
                <p className={`text-xs font-medium ${textSecondary} mb-1`}>Content Link</p>
                <Input
                  value={modal.tab.content_link}
                  onChange={(e) => setModal(m => ({ ...m, tab: { ...m.tab, content_link: e.target.value } }))}
                  placeholder="https://…"
                  className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                  data-testid={`${testPrefix}-form-content-link`}
                />
              </div>
              <div>
                <p className={`text-xs font-medium ${textSecondary} mb-1`}>Page Link</p>
                <Input
                  value={modal.tab.page_link}
                  onChange={(e) => setModal(m => ({ ...m, tab: { ...m.tab, page_link: e.target.value } }))}
                  placeholder="https://…"
                  className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                  data-testid={`${testPrefix}-form-page-link`}
                />
              </div>
              <div>
                <p className={`text-xs font-medium ${textSecondary} mb-1`}>Status</p>
                <Select
                  value={modal.tab.status}
                  onValueChange={(v) => setModal(m => ({ ...m, tab: { ...m.tab, status: v } }))}
                >
                  <SelectTrigger className={`${bgSecondary} border ${borderColor} ${textPrimary}`} data-testid={`${testPrefix}-form-status`}>
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
              <LinkField label="UI Link" value={modal.tab.ui_link} textSecondary={textSecondary} textPrimary={textPrimary} />
              <LinkField label="Content Link" value={modal.tab.content_link} textSecondary={textSecondary} textPrimary={textPrimary} />
              <LinkField label="Page Link" value={modal.tab.page_link} textSecondary={textSecondary} textPrimary={textPrimary} />
              <div>
                <p className={`text-[11px] uppercase tracking-wide ${textSecondary}`}>Status</p>
                <span className={`inline-block mt-1 px-2 py-1 rounded-md text-xs font-medium border ${STATUS_STYLE[modal.tab.status] || STATUS_STYLE['To-Do']}`}>
                  {modal.tab.status || 'To-Do'}
                </span>
              </div>
            </div>
          )}
        </div>
        <div className={`p-5 border-t ${borderColor} flex items-center justify-between gap-2`}>
          {modal.mode === 'view' && canEdit ? (
            <button
              type="button"
              onClick={onDelete}
              className="text-sm text-red-500 hover:text-red-400 inline-flex items-center gap-1"
              data-testid={`${testPrefix}-modal-delete`}
            >
              <Trash2 className="h-4 w-4" /> Delete
            </button>
          ) : <span />}
          <div className="flex items-center gap-2">
            {canEdit && modal.mode === 'view' && !modal.editing && (
              <Button type="button" variant="outline" onClick={() => setModal(m => ({ ...m, editing: true }))} data-testid={`${testPrefix}-modal-edit`}>
                <Pencil className="h-4 w-4 mr-1" /> Edit
              </Button>
            )}
            {modal.editing ? (
              <Button
                type="button"
                onClick={onSave}
                disabled={saving}
                className="bg-[#6366f1] hover:bg-[#4f46e5] text-white"
                data-testid={`${testPrefix}-modal-save`}
              >
                Save
              </Button>
            ) : (
              <Button type="button" variant="outline" onClick={onClose}>Close</Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * ERP department's "Users" tab — replaces the old ERP Board / taxonomy.
 * Structure: User (e.g. "Super Admin", "HR Admin") → that user's Pages
 * (same fields as the Website department's Pages tab) → Sub Tabs → Ultra
 * Sub Tabs (same fields, one/two levels deeper), plus tasks tagged to
 * each page. Tasks are created from Operations > Add Task by picking
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
  const [expandedSubTabsPageId, setExpandedSubTabsPageId] = useState(null);
  const [expandedUltraTabsSubTabId, setExpandedUltraTabsSubTabId] = useState(null);
  const [expandedUltraTabItemsId, setExpandedUltraTabItemsId] = useState(null);
  // { mode: 'add' | 'edit', name } — add/rename a User
  const [userModal, setUserModal] = useState(null);
  // { mode: 'add' | 'view', userId, page, editing } — add/view/edit a Page under a User
  const [pageModal, setPageModal] = useState(null);
  // { mode: 'add' | 'view', userId, pageId, tab, editing } — add/view/edit a Sub Tab under a Page
  const [subTabModal, setSubTabModal] = useState(null);
  // { mode: 'add' | 'view', userId, pageId, subTabId, tab, editing } — add/view/edit an Ultra Sub Tab under a Sub Tab
  const [ultraTabModal, setUltraTabModal] = useState(null);
  // { mode: 'add' | 'view', userId, pageId, subTabId, ultraTabId, tab, editing } — add/view/edit an Ultra Tab under an Ultra Sub Tab
  const [ultraTabItemModal, setUltraTabItemModal] = useState(null);
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
    const target = erpUsers.find(u => u.id === userId);
    if ((target?.pages || []).length > 0) {
      toast.error('Cannot delete a user that has pages or tasks. Remove its pages first.');
      return;
    }
    if (!window.confirm('Remove this user?')) return;
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
  const openEditPage = (userId, page) => {
    if (!canEdit) return;
    setPageModal({ mode: 'view', userId, page: { ...page }, editing: true });
  };
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
    if (tasksForPage(pageId).length > 0) {
      toast.error('Cannot delete a page that has tasks tagged to it');
      return;
    }
    const next = erpUsers.map(u => (
      u.id === userId ? { ...u, pages: (u.pages || []).filter(p => p.id !== pageId) } : u
    ));
    const ok = await persistUsers(next);
    if (ok) { toast.success('Page removed'); closePageModal(); }
  };

  // ---- Sub Tab CRUD (nested under a Page) ----
  const updatePages = (userId, updater) => erpUsers.map(u => (
    u.id === userId ? { ...u, pages: updater(u.pages || []) } : u
  ));
  const persistPages = (userId, updater) => persistUsers(updatePages(userId, updater));

  const openAddSubTab = (userId, pageId) => {
    if (!canEdit) return;
    setSubTabModal({ mode: 'add', userId, pageId, tab: emptyTab('st'), editing: true });
  };
  const openViewSubTab = (userId, pageId, tab) => setSubTabModal({ mode: 'view', userId, pageId, tab: { ...tab }, editing: false });
  const closeSubTabModal = () => setSubTabModal(null);

  const saveSubTabModal = async () => {
    const draft = subTabModal.tab;
    if (!(draft.name || '').trim()) { toast.error('Sub tab name is required'); return; }
    setSaving(true);
    const ok = await persistPages(subTabModal.userId, pages => pages.map(p => {
      if (p.id !== subTabModal.pageId) return p;
      const subTabs = p.sub_tabs || [];
      const nextSubTabs = subTabModal.mode === 'add'
        ? [...subTabs, { ...draft, name: draft.name.trim() }]
        : subTabs.map(st => (st.id === draft.id ? { ...draft, name: draft.name.trim() } : st));
      return { ...p, sub_tabs: nextSubTabs };
    }));
    setSaving(false);
    if (ok) {
      toast.success(subTabModal.mode === 'add' ? 'Sub tab added' : 'Sub tab updated');
      closeSubTabModal();
    }
  };

  const deleteSubTab = async (userId, pageId, subTabId) => {
    if (!canEdit) return;
    const ok = await persistPages(userId, pages => pages.map(p => (
      p.id === pageId ? { ...p, sub_tabs: (p.sub_tabs || []).filter(st => st.id !== subTabId) } : p
    )));
    if (ok) { toast.success('Sub tab removed'); closeSubTabModal(); }
  };

  // ---- Ultra Sub Tab CRUD (nested under a Sub Tab) ----
  const openAddUltraTab = (userId, pageId, subTabId) => {
    if (!canEdit) return;
    setUltraTabModal({ mode: 'add', userId, pageId, subTabId, tab: emptyTab('ut'), editing: true });
  };
  const openViewUltraTab = (userId, pageId, subTabId, tab) => setUltraTabModal({ mode: 'view', userId, pageId, subTabId, tab: { ...tab }, editing: false });
  const closeUltraTabModal = () => setUltraTabModal(null);

  const saveUltraTabModal = async () => {
    const draft = ultraTabModal.tab;
    if (!(draft.name || '').trim()) { toast.error('Ultra sub tab name is required'); return; }
    setSaving(true);
    const ok = await persistPages(ultraTabModal.userId, pages => pages.map(p => {
      if (p.id !== ultraTabModal.pageId) return p;
      const subTabs = (p.sub_tabs || []).map(st => {
        if (st.id !== ultraTabModal.subTabId) return st;
        const ultraTabs = st.ultra_sub_tabs || [];
        const nextUltraTabs = ultraTabModal.mode === 'add'
          ? [...ultraTabs, { ...draft, name: draft.name.trim() }]
          : ultraTabs.map(ut => (ut.id === draft.id ? { ...draft, name: draft.name.trim() } : ut));
        return { ...st, ultra_sub_tabs: nextUltraTabs };
      });
      return { ...p, sub_tabs: subTabs };
    }));
    setSaving(false);
    if (ok) {
      toast.success(ultraTabModal.mode === 'add' ? 'Ultra sub tab added' : 'Ultra sub tab updated');
      closeUltraTabModal();
    }
  };

  const deleteUltraTab = async (userId, pageId, subTabId, ultraTabId) => {
    if (!canEdit) return;
    const ok = await persistPages(userId, pages => pages.map(p => (
      p.id === pageId
        ? { ...p, sub_tabs: (p.sub_tabs || []).map(st => (
            st.id === subTabId ? { ...st, ultra_sub_tabs: (st.ultra_sub_tabs || []).filter(ut => ut.id !== ultraTabId) } : st
          )) }
        : p
    )));
    if (ok) { toast.success('Ultra sub tab removed'); closeUltraTabModal(); }
  };

  // ---- Ultra Tab CRUD (nested under an Ultra Sub Tab) ----
  const mapUltraSubTab = (pages, pageId, subTabId, updater) => pages.map(p => (
    p.id !== pageId ? p : {
      ...p,
      sub_tabs: (p.sub_tabs || []).map(st => (
        st.id !== subTabId ? st : { ...st, ultra_sub_tabs: (st.ultra_sub_tabs || []).map(updater) }
      )),
    }
  ));

  const openAddUltraTabItem = (userId, pageId, subTabId, ultraTabId) => {
    if (!canEdit) return;
    setUltraTabItemModal({ mode: 'add', userId, pageId, subTabId, ultraTabId, tab: emptyTab('utt'), editing: true });
  };
  const openViewUltraTabItem = (userId, pageId, subTabId, ultraTabId, tab) => setUltraTabItemModal({ mode: 'view', userId, pageId, subTabId, ultraTabId, tab: { ...tab }, editing: false });
  const closeUltraTabItemModal = () => setUltraTabItemModal(null);

  const saveUltraTabItemModal = async () => {
    const draft = ultraTabItemModal.tab;
    if (!(draft.name || '').trim()) { toast.error('Ultra tab name is required'); return; }
    setSaving(true);
    const ok = await persistPages(ultraTabItemModal.userId, pages => mapUltraSubTab(pages, ultraTabItemModal.pageId, ultraTabItemModal.subTabId, ut => {
      if (ut.id !== ultraTabItemModal.ultraTabId) return ut;
      const items = ut.ultra_tabs || [];
      const nextItems = ultraTabItemModal.mode === 'add'
        ? [...items, { ...draft, name: draft.name.trim() }]
        : items.map(it => (it.id === draft.id ? { ...draft, name: draft.name.trim() } : it));
      return { ...ut, ultra_tabs: nextItems };
    }));
    setSaving(false);
    if (ok) {
      toast.success(ultraTabItemModal.mode === 'add' ? 'Ultra tab added' : 'Ultra tab updated');
      closeUltraTabItemModal();
    }
  };

  const deleteUltraTabItem = async (userId, pageId, subTabId, ultraTabId, itemId) => {
    if (!canEdit) return;
    const ok = await persistPages(userId, pages => mapUltraSubTab(pages, pageId, subTabId, ut => (
      ut.id === ultraTabId ? { ...ut, ultra_tabs: (ut.ultra_tabs || []).filter(it => it.id !== itemId) } : ut
    )));
    if (ok) { toast.success('Ultra tab removed'); closeUltraTabItemModal(); }
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
                              <button
                                type="button"
                                onClick={() => deleteUser(u.id)}
                                disabled={pages.length > 0}
                                className={`p-1 ${pages.length > 0 ? 'text-red-500/30 cursor-not-allowed' : 'text-red-500 hover:text-red-400'}`}
                                title={pages.length > 0 ? 'Cannot delete: this user has pages/tasks' : 'Delete'}
                                data-testid={`erp-user-delete-${u.id}`}
                              >
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
                                    const subTabs = row.sub_tabs || [];
                                    const isSubTabsExpanded = expandedSubTabsPageId === row.id;
                                    return (
                                      <React.Fragment key={row.id}>
                                        <tr className={`border-b ${borderColor}`} data-testid={`erp-page-row-${row.id}`}>
                                          <td className={`px-3 py-2 text-xs ${textSecondary}`}>{pIdx + 1}</td>
                                          <td className="px-3 py-2">
                                            <button
                                              type="button"
                                              onClick={() => setExpandedSubTabsPageId(isSubTabsExpanded ? null : row.id)}
                                              className={`inline-flex items-center gap-1.5 text-sm font-medium ${textPrimary} hover:opacity-80`}
                                              data-testid={`erp-page-subtabs-toggle-${row.id}`}
                                            >
                                              {isSubTabsExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                                              {row.page_name || '—'}
                                            </button>
                                          </td>
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
                                                <button type="button" onClick={() => openEditPage(u.id, row)} className={`p-1 ${textSecondary} hover:opacity-80`} title="Edit" data-testid={`erp-page-edit-${row.id}`}>
                                                  <Pencil className="h-4 w-4" />
                                                </button>
                                              )}
                                              {canEdit && (
                                                <button
                                                  type="button"
                                                  onClick={() => deletePage(u.id, row.id)}
                                                  disabled={pageTasks.length > 0}
                                                  className={`p-1 ${pageTasks.length > 0 ? 'text-red-500/30 cursor-not-allowed' : 'text-red-500 hover:text-red-400'}`}
                                                  title={pageTasks.length > 0 ? 'Cannot delete: this page has tasks' : 'Delete'}
                                                  data-testid={`erp-page-delete-${row.id}`}
                                                >
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
                                        {isSubTabsExpanded && (
                                          <tr className={`border-b ${borderColor} ${bgSecondary}`} data-testid={`erp-page-subtabs-row-${row.id}`}>
                                            <td colSpan={8} className="p-3">
                                              <div className="flex items-center justify-between mb-2">
                                                <p className={`text-xs font-semibold uppercase tracking-wide ${textSecondary}`}>Sub Tabs</p>
                                                {canEdit && (
                                                  <Button
                                                    type="button"
                                                    size="sm"
                                                    onClick={() => openAddSubTab(u.id, row.id)}
                                                    className="bg-[#6366f1] hover:bg-[#4f46e5] text-white h-7 text-xs"
                                                    data-testid={`erp-subtab-add-btn-${row.id}`}
                                                  >
                                                    <Plus className="h-3 w-3 mr-1" /> Add Sub Tab
                                                  </Button>
                                                )}
                                              </div>
                                              <div className={`overflow-x-auto rounded-md border ${borderColor} ${bgCard}`}>
                                                <table className="w-full">
                                                  <thead>
                                                    <tr className={`border-b ${borderColor}`}>
                                                      <th className={`text-left px-3 py-2 text-[10px] font-medium ${textSecondary} uppercase w-10`}>S.No</th>
                                                      <th className={`text-left px-3 py-2 text-[10px] font-medium ${textSecondary} uppercase`}>Sub Tab Name</th>
                                                      <th className={`text-left px-3 py-2 text-[10px] font-medium ${textSecondary} uppercase`}>UI Link</th>
                                                      <th className={`text-left px-3 py-2 text-[10px] font-medium ${textSecondary} uppercase`}>Content Link</th>
                                                      <th className={`text-left px-3 py-2 text-[10px] font-medium ${textSecondary} uppercase`}>Page Link</th>
                                                      <th className={`text-left px-3 py-2 text-[10px] font-medium ${textSecondary} uppercase`}>Status</th>
                                                      <th className={`text-right px-3 py-2 text-[10px] font-medium ${textSecondary} uppercase w-20`}>Actions</th>
                                                    </tr>
                                                  </thead>
                                                  <tbody>
                                                    {subTabs.map((st, stIdx) => {
                                                      const ultraTabs = st.ultra_sub_tabs || [];
                                                      const isUltraExpanded = expandedUltraTabsSubTabId === st.id;
                                                      return (
                                                        <React.Fragment key={st.id}>
                                                          <tr className={`border-b ${borderColor}`} data-testid={`erp-subtab-row-${st.id}`}>
                                                            <td className={`px-3 py-2 text-xs ${textSecondary}`}>{stIdx + 1}</td>
                                                            <td className="px-3 py-2">
                                                              <button
                                                                type="button"
                                                                onClick={() => setExpandedUltraTabsSubTabId(isUltraExpanded ? null : st.id)}
                                                                className={`inline-flex items-center gap-1.5 text-sm font-medium ${textPrimary} hover:opacity-80`}
                                                                data-testid={`erp-subtab-toggle-${st.id}`}
                                                              >
                                                                {isUltraExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                                                                {st.name || '—'}
                                                              </button>
                                                            </td>
                                                            {['ui_link', 'content_link', 'page_link'].map((key) => (
                                                              <td key={key} className="px-3 py-2">
                                                                {st[key] ? (
                                                                  <a
                                                                    href={st[key]}
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
                                                              <span className={`px-2 py-1 rounded-md text-xs font-medium border ${STATUS_STYLE[st.status] || STATUS_STYLE['To-Do']}`}>
                                                                {st.status || 'To-Do'}
                                                              </span>
                                                            </td>
                                                            <td className="px-3 py-2 text-right">
                                                              <div className="inline-flex gap-1">
                                                                <button type="button" onClick={() => openViewSubTab(u.id, row.id, st)} className={`p-1 ${textSecondary} hover:opacity-80`} title="View" data-testid={`erp-subtab-view-${st.id}`}>
                                                                  <Eye className="h-4 w-4" />
                                                                </button>
                                                                {canEdit && (
                                                                  <button type="button" onClick={() => deleteSubTab(u.id, row.id, st.id)} className="p-1 text-red-500 hover:text-red-400" title="Delete" data-testid={`erp-subtab-delete-${st.id}`}>
                                                                    <Trash2 className="h-4 w-4" />
                                                                  </button>
                                                                )}
                                                              </div>
                                                            </td>
                                                          </tr>
                                                          {isUltraExpanded && (
                                                            <tr className={`border-b ${borderColor}`} data-testid={`erp-subtab-ultratabs-row-${st.id}`}>
                                                              <td colSpan={7} className="p-3">
                                                                <div className="flex items-center justify-between mb-2">
                                                                  <p className={`text-xs font-semibold uppercase tracking-wide ${textSecondary}`}>Ultra Sub Tabs</p>
                                                                  {canEdit && (
                                                                    <Button
                                                                      type="button"
                                                                      size="sm"
                                                                      onClick={() => openAddUltraTab(u.id, row.id, st.id)}
                                                                      className="bg-[#6366f1] hover:bg-[#4f46e5] text-white h-7 text-xs"
                                                                      data-testid={`erp-ultratab-add-btn-${st.id}`}
                                                                    >
                                                                      <Plus className="h-3 w-3 mr-1" /> Add Ultra Sub Tab
                                                                    </Button>
                                                                  )}
                                                                </div>
                                                                <div className={`overflow-x-auto rounded-md border ${borderColor} ${bgCard}`}>
                                                                  <table className="w-full">
                                                                    <thead>
                                                                      <tr className={`border-b ${borderColor}`}>
                                                                        <th className={`text-left px-3 py-2 text-[10px] font-medium ${textSecondary} uppercase w-10`}>S.No</th>
                                                                        <th className={`text-left px-3 py-2 text-[10px] font-medium ${textSecondary} uppercase`}>Ultra Sub Tab Name</th>
                                                                        <th className={`text-left px-3 py-2 text-[10px] font-medium ${textSecondary} uppercase`}>UI Link</th>
                                                                        <th className={`text-left px-3 py-2 text-[10px] font-medium ${textSecondary} uppercase`}>Content Link</th>
                                                                        <th className={`text-left px-3 py-2 text-[10px] font-medium ${textSecondary} uppercase`}>Page Link</th>
                                                                        <th className={`text-left px-3 py-2 text-[10px] font-medium ${textSecondary} uppercase`}>Status</th>
                                                                        <th className={`text-right px-3 py-2 text-[10px] font-medium ${textSecondary} uppercase w-20`}>Actions</th>
                                                                      </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                      {ultraTabs.map((ut, utIdx) => {
                                                                        const ultraTabItems = ut.ultra_tabs || [];
                                                                        const isUltraTabItemsExpanded = expandedUltraTabItemsId === ut.id;
                                                                        return (
                                                                          <React.Fragment key={ut.id}>
                                                                            <tr className={`border-b ${borderColor}`} data-testid={`erp-ultratab-row-${ut.id}`}>
                                                                              <td className={`px-3 py-2 text-xs ${textSecondary}`}>{utIdx + 1}</td>
                                                                              <td className="px-3 py-2">
                                                                                <button
                                                                                  type="button"
                                                                                  onClick={() => setExpandedUltraTabItemsId(isUltraTabItemsExpanded ? null : ut.id)}
                                                                                  className={`inline-flex items-center gap-1.5 text-sm font-medium ${textPrimary} hover:opacity-80`}
                                                                                  data-testid={`erp-ultratab-toggle-${ut.id}`}
                                                                                >
                                                                                  {isUltraTabItemsExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                                                                                  {ut.name || '—'}
                                                                                </button>
                                                                              </td>
                                                                              {['ui_link', 'content_link', 'page_link'].map((key) => (
                                                                                <td key={key} className="px-3 py-2">
                                                                                  {ut[key] ? (
                                                                                    <a
                                                                                      href={ut[key]}
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
                                                                                <span className={`px-2 py-1 rounded-md text-xs font-medium border ${STATUS_STYLE[ut.status] || STATUS_STYLE['To-Do']}`}>
                                                                                  {ut.status || 'To-Do'}
                                                                                </span>
                                                                              </td>
                                                                              <td className="px-3 py-2 text-right">
                                                                                <div className="inline-flex gap-1">
                                                                                  <button type="button" onClick={() => openViewUltraTab(u.id, row.id, st.id, ut)} className={`p-1 ${textSecondary} hover:opacity-80`} title="View" data-testid={`erp-ultratab-view-${ut.id}`}>
                                                                                    <Eye className="h-4 w-4" />
                                                                                  </button>
                                                                                  {canEdit && (
                                                                                    <button type="button" onClick={() => deleteUltraTab(u.id, row.id, st.id, ut.id)} className="p-1 text-red-500 hover:text-red-400" title="Delete" data-testid={`erp-ultratab-delete-${ut.id}`}>
                                                                                      <Trash2 className="h-4 w-4" />
                                                                                    </button>
                                                                                  )}
                                                                                </div>
                                                                              </td>
                                                                            </tr>
                                                                            {isUltraTabItemsExpanded && (
                                                                              <tr className={`border-b ${borderColor}`} data-testid={`erp-ultratab-items-row-${ut.id}`}>
                                                                                <td colSpan={7} className="p-3">
                                                                                  <div className="flex items-center justify-between mb-2">
                                                                                    <p className={`text-xs font-semibold uppercase tracking-wide ${textSecondary}`}>Ultra Tabs</p>
                                                                                    {canEdit && (
                                                                                      <Button
                                                                                        type="button"
                                                                                        size="sm"
                                                                                        onClick={() => openAddUltraTabItem(u.id, row.id, st.id, ut.id)}
                                                                                        className="bg-[#6366f1] hover:bg-[#4f46e5] text-white h-7 text-xs"
                                                                                        data-testid={`erp-ultratab-item-add-btn-${ut.id}`}
                                                                                      >
                                                                                        <Plus className="h-3 w-3 mr-1" /> Add Ultra Tab
                                                                                      </Button>
                                                                                    )}
                                                                                  </div>
                                                                                  <div className={`overflow-x-auto rounded-md border ${borderColor} ${bgCard}`}>
                                                                                    <table className="w-full">
                                                                                      <thead>
                                                                                        <tr className={`border-b ${borderColor}`}>
                                                                                          <th className={`text-left px-3 py-2 text-[10px] font-medium ${textSecondary} uppercase w-10`}>S.No</th>
                                                                                          <th className={`text-left px-3 py-2 text-[10px] font-medium ${textSecondary} uppercase`}>Ultra Tab Name</th>
                                                                                          <th className={`text-left px-3 py-2 text-[10px] font-medium ${textSecondary} uppercase`}>UI Link</th>
                                                                                          <th className={`text-left px-3 py-2 text-[10px] font-medium ${textSecondary} uppercase`}>Content Link</th>
                                                                                          <th className={`text-left px-3 py-2 text-[10px] font-medium ${textSecondary} uppercase`}>Page Link</th>
                                                                                          <th className={`text-left px-3 py-2 text-[10px] font-medium ${textSecondary} uppercase`}>Status</th>
                                                                                          <th className={`text-right px-3 py-2 text-[10px] font-medium ${textSecondary} uppercase w-20`}>Actions</th>
                                                                                        </tr>
                                                                                      </thead>
                                                                                      <tbody>
                                                                                        {ultraTabItems.map((it, itIdx) => (
                                                                                          <tr key={it.id} className={`border-b ${borderColor} last:border-b-0`} data-testid={`erp-ultratab-item-row-${it.id}`}>
                                                                                            <td className={`px-3 py-2 text-xs ${textSecondary}`}>{itIdx + 1}</td>
                                                                                            <td className={`px-3 py-2 text-sm font-medium ${textPrimary}`}>{it.name || '—'}</td>
                                                                                            {['ui_link', 'content_link', 'page_link'].map((key) => (
                                                                                              <td key={key} className="px-3 py-2">
                                                                                                {it[key] ? (
                                                                                                  <a
                                                                                                    href={it[key]}
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
                                                                                              <span className={`px-2 py-1 rounded-md text-xs font-medium border ${STATUS_STYLE[it.status] || STATUS_STYLE['To-Do']}`}>
                                                                                                {it.status || 'To-Do'}
                                                                                              </span>
                                                                                            </td>
                                                                                            <td className="px-3 py-2 text-right">
                                                                                              <div className="inline-flex gap-1">
                                                                                                <button type="button" onClick={() => openViewUltraTabItem(u.id, row.id, st.id, ut.id, it)} className={`p-1 ${textSecondary} hover:opacity-80`} title="View" data-testid={`erp-ultratab-item-view-${it.id}`}>
                                                                                                  <Eye className="h-4 w-4" />
                                                                                                </button>
                                                                                                {canEdit && (
                                                                                                  <button type="button" onClick={() => deleteUltraTabItem(u.id, row.id, st.id, ut.id, it.id)} className="p-1 text-red-500 hover:text-red-400" title="Delete" data-testid={`erp-ultratab-item-delete-${it.id}`}>
                                                                                                    <Trash2 className="h-4 w-4" />
                                                                                                  </button>
                                                                                                )}
                                                                                              </div>
                                                                                            </td>
                                                                                          </tr>
                                                                                        ))}
                                                                                        {ultraTabItems.length === 0 && (
                                                                                          <tr>
                                                                                            <td colSpan={7} className={`p-4 text-center text-xs ${textSecondary}`}>
                                                                                              No ultra tabs yet. {canEdit && <span>Click <span className="font-medium">Add Ultra Tab</span> to add one.</span>}
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
                                                                      {ultraTabs.length === 0 && (
                                                                        <tr>
                                                                          <td colSpan={7} className={`p-4 text-center text-xs ${textSecondary}`}>
                                                                            No ultra sub tabs yet. {canEdit && <span>Click <span className="font-medium">Add Ultra Sub Tab</span> to add one.</span>}
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
                                                    {subTabs.length === 0 && (
                                                      <tr>
                                                        <td colSpan={7} className={`p-4 text-center text-xs ${textSecondary}`}>
                                                          No sub tabs yet. {canEdit && <span>Click <span className="font-medium">Add Sub Tab</span> to add one.</span>}
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
      {/* z-40, not z-[70]: the Status <Select> below portals to document.body
          at z-50 (ui/select.jsx) — z-[70] would render this modal on top of it. */}
      {pageModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-40 p-4" onClick={closePageModal}>
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
                tasksForPage(pageModal.page.id).length > 0 ? (
                  <span className={`text-sm ${textSecondary} inline-flex items-center gap-1`} title="Cannot delete: this page has tasks">
                    <Trash2 className="h-4 w-4" /> Delete
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => deletePage(pageModal.userId, pageModal.page.id)}
                    className="text-sm text-red-500 hover:text-red-400 inline-flex items-center gap-1"
                    data-testid="erp-page-modal-delete"
                  >
                    <Trash2 className="h-4 w-4" /> Delete
                  </button>
                )
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

      {/* Add / View / Edit Sub Tab popup */}
      <TabDetailModal
        modal={subTabModal}
        setModal={setSubTabModal}
        onClose={closeSubTabModal}
        onSave={saveSubTabModal}
        onDelete={() => deleteSubTab(subTabModal.userId, subTabModal.pageId, subTabModal.tab.id)}
        saving={saving}
        canEdit={canEdit}
        bgCard={bgCard}
        bgSecondary={bgSecondary}
        textPrimary={textPrimary}
        textSecondary={textSecondary}
        borderColor={borderColor}
        testPrefix="erp-subtab"
        titleAdd="Add Sub Tab"
        titleEdit="Edit Sub Tab"
      />

      {/* Add / View / Edit Ultra Sub Tab popup */}
      <TabDetailModal
        modal={ultraTabModal}
        setModal={setUltraTabModal}
        onClose={closeUltraTabModal}
        onSave={saveUltraTabModal}
        onDelete={() => deleteUltraTab(ultraTabModal.userId, ultraTabModal.pageId, ultraTabModal.subTabId, ultraTabModal.tab.id)}
        saving={saving}
        canEdit={canEdit}
        bgCard={bgCard}
        bgSecondary={bgSecondary}
        textPrimary={textPrimary}
        textSecondary={textSecondary}
        borderColor={borderColor}
        testPrefix="erp-ultratab"
        titleAdd="Add Ultra Sub Tab"
        titleEdit="Edit Ultra Sub Tab"
      />

      {/* Add / View / Edit Ultra Tab popup */}
      <TabDetailModal
        modal={ultraTabItemModal}
        setModal={setUltraTabItemModal}
        onClose={closeUltraTabItemModal}
        onSave={saveUltraTabItemModal}
        onDelete={() => deleteUltraTabItem(ultraTabItemModal.userId, ultraTabItemModal.pageId, ultraTabItemModal.subTabId, ultraTabItemModal.ultraTabId, ultraTabItemModal.tab.id)}
        saving={saving}
        canEdit={canEdit}
        bgCard={bgCard}
        bgSecondary={bgSecondary}
        textPrimary={textPrimary}
        textSecondary={textSecondary}
        borderColor={borderColor}
        testPrefix="erp-ultratab-item"
        titleAdd="Add Ultra Tab"
        titleEdit="Edit Ultra Tab"
      />
    </div>
  );
}
