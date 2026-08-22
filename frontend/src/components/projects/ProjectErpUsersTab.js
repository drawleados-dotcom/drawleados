import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Plus, Trash2, Pencil, Eye, X, ExternalLink, Users as UsersIcon, ChevronDown, ChevronRight, ListChecks, GripVertical, ListTodo, Clock, CheckCircle2, Search } from 'lucide-react';
import { buildErpPrompt } from '../../utils/erpPrompt';

const API = process.env.REACT_APP_BACKEND_URL;

const STATUS_OPTIONS = ['To-Do', 'In Progress', 'Client Review', 'Completed'];
const STATUS_STYLE = {
  'To-Do': 'bg-slate-500/20 text-slate-300 border-slate-500/40',
  'In Progress': 'bg-blue-500/20 text-blue-400 border-blue-500/40',
  'Client Review': 'bg-amber-500/20 text-amber-400 border-amber-500/40',
  'Completed': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
};

const PAGE_TYPE_OPTIONS = ['New Module', 'New Feature', 'Correction'];
const PAGE_TYPE_STYLE = {
  'New Module': 'bg-violet-500/20 text-violet-400 border-violet-500/40',
  'New Feature': 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40',
  'Correction': 'bg-orange-500/20 text-orange-400 border-orange-500/40',
};

const newId = (prefix) => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
const emptyPage = () => ({
  id: newId('pg'),
  page_name: '',
  ui_link: '',
  content_link: '',
  page_link: '',
  status: 'To-Do',
  type: '',
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
  onTasksChanged,
  canEdit,
  currentUser,
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
  const erpDepartments = project?.erp_departments || [];
  const departmentName = (deptId) => erpDepartments.find(d => d.id === deptId)?.name || '';
  const subDepartmentsOf = (deptId) => erpDepartments.find(d => d.id === deptId)?.sub_departments || [];
  const subDepartmentName = (deptId, subDeptId) => subDepartmentsOf(deptId).find(sd => sd.id === subDeptId)?.name || '';
  const tasks = project?.tasks || [];

  // Summary-card date filter + click-to-filter status, both applied to every
  // task list this tab renders (per-page Tasks badge + the expandable table).
  const [taskDateFilter, setTaskDateFilter] = useState('all'); // all | today | week | month | custom
  const [taskDateFrom, setTaskDateFrom] = useState('');
  const [taskDateTo, setTaskDateTo] = useState('');
  const [taskStatusFilter, setTaskStatusFilter] = useState('all'); // all | pending | completed | todo_created | todo_assigned

  const inTaskDateRange = (dueDateStr) => {
    if (taskDateFilter === 'all') return true;
    if (!dueDateStr) return false;
    const d = new Date(dueDateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (taskDateFilter === 'today') {
      return d.toDateString() === today.toDateString();
    }
    if (taskDateFilter === 'week') {
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);
      return d >= weekStart && d <= weekEnd;
    }
    if (taskDateFilter === 'month') {
      return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth();
    }
    if (taskDateFilter === 'custom') {
      if (taskDateFrom && d < new Date(taskDateFrom)) return false;
      if (taskDateTo) {
        const to = new Date(taskDateTo);
        to.setHours(23, 59, 59, 999);
        if (d > to) return false;
      }
      return true;
    }
    return true;
  };
  const isTodo = (t) => (t.status || 'pending') === 'pending' || t.status === 'in_progress';
  const matchesStatusFilter = (t) => {
    if (taskStatusFilter === 'all') return true;
    if (taskStatusFilter === 'pending') return t.status === 'pending';
    if (taskStatusFilter === 'completed') return t.status === 'completed';
    if (taskStatusFilter === 'todo_created') return isTodo(t) && t.created_by === currentUser?.user_id;
    if (taskStatusFilter === 'todo_assigned') return isTodo(t) && t.assigned_to === currentUser?.user_id;
    return true;
  };
  const matchesTaskFilters = (t) => inTaskDateRange(t.due_date) && matchesStatusFilter(t);

  const tasksForPage = (pageId) => tasks.filter(t => t.erp_page_id === pageId && matchesTaskFilters(t));

  const [departmentFilter, setDepartmentFilter] = useState('all');
  // Only meaningful once a single department is selected above — that
  // department's own sub_departments list drives its options.
  const [subDepartmentFilter, setSubDepartmentFilter] = useState('all');
  const subDepartmentFilterOptions = subDepartmentsOf(departmentFilter);
  const departmentFilteredUsers = departmentFilter === 'all'
    ? erpUsers
    : (departmentFilter === '_none'
      ? erpUsers.filter(u => !u.department_id)
      : erpUsers.filter(u => u.department_id === departmentFilter));
  const visibleErpUsers = subDepartmentFilter === 'all'
    ? departmentFilteredUsers
    : (subDepartmentFilter === '_none'
      ? departmentFilteredUsers.filter(u => !u.sub_department_id)
      : departmentFilteredUsers.filter(u => u.sub_department_id === subDepartmentFilter));

  // Cascading jump-to filters: Departments -> Users -> Pages -> Sub Tabs -> Ultra Sub Tab -> Ultra Tab.
  // Each level's options are scoped by whatever's selected above it; picking a value at any
  // level also expands the tree down to reveal that item, without needing to click every chevron.
  const [userFilter, setUserFilter] = useState('all');
  const [pageFilter, setPageFilter] = useState('all');
  const [subTabFilter, setSubTabFilter] = useState('all');
  const [ultraSubTabFilter, setUltraSubTabFilter] = useState('all');
  const [ultraTabFilter, setUltraTabFilter] = useState('all');
  // Free-text search by user name, on top of the exact-match "All Users" dropdown.
  const [userSearchQuery, setUserSearchQuery] = useState('');

  const filteredErpUsers = (userFilter === 'all' ? visibleErpUsers : visibleErpUsers.filter(u => u.id === userFilter))
    .filter(u => !userSearchQuery.trim() || (u.user_name || '').toLowerCase().includes(userSearchQuery.trim().toLowerCase()));

  const pageOptions = filteredErpUsers.flatMap(u => (u.pages || []).map(pg => ({
    key: pg.id,
    label: userFilter === 'all' ? `${u.user_name || '—'} → ${pg.page_name}` : pg.page_name,
    userId: u.id, pageId: pg.id,
  })));

  const filteredPages = filteredErpUsers
    .flatMap(u => (u.pages || []).map(pg => ({ ...pg, _userId: u.id })))
    .filter(pg => pageFilter === 'all' || pg.id === pageFilter);

  // Summary-card counts — scoped to whatever Department/User/Page filters are
  // active above, with just the date filter applied (the status cards below
  // are themselves the click-to-narrow-by-status control, via taskStatusFilter).
  const scopedPageIds = new Set(filteredPages.map(pg => pg.id));
  const scopedDateFilteredTasks = tasks.filter(t => scopedPageIds.has(t.erp_page_id) && inTaskDateRange(t.due_date));
  const totalTasksCount = scopedDateFilteredTasks.length;
  const pendingTasksCount = scopedDateFilteredTasks.filter(t => t.status === 'pending').length;
  const completedTasksCount = scopedDateFilteredTasks.filter(t => t.status === 'completed').length;
  const todoCreatedCount = scopedDateFilteredTasks.filter(t => isTodo(t) && t.created_by === currentUser?.user_id).length;
  const todoAssignedCount = scopedDateFilteredTasks.filter(t => isTodo(t) && t.assigned_to === currentUser?.user_id).length;

  const subTabOptions = filteredPages.flatMap(pg => (pg.sub_tabs || []).map(st => ({
    key: `${pg.id}::${st.id}`,
    label: `${pg.page_name} → ${st.name}`,
    userId: pg._userId, pageId: pg.id, subTabId: st.id,
  })));

  const scopedSubTabs = filteredPages.flatMap(pg => (pg.sub_tabs || []).map(st => ({ pg, st })))
    .filter(({ pg, st }) => subTabFilter === 'all' || `${pg.id}::${st.id}` === subTabFilter);
  const ultraSubTabOptions = scopedSubTabs.flatMap(({ pg, st }) => (st.ultra_sub_tabs || []).map(ut => ({
    key: `${pg.id}::${st.id}::${ut.id}`,
    label: `${st.name} → ${ut.name}`,
    userId: pg._userId, pageId: pg.id, subTabId: st.id, ultraSubTabId: ut.id,
  })));

  const scopedUltraSubTabs = scopedSubTabs.flatMap(({ pg, st }) => (st.ultra_sub_tabs || []).map(ut => ({ pg, st, ut })))
    .filter(({ pg, st, ut }) => ultraSubTabFilter === 'all' || `${pg.id}::${st.id}::${ut.id}` === ultraSubTabFilter);
  const ultraTabOptions = scopedUltraSubTabs.flatMap(({ pg, st, ut }) => (ut.ultra_tabs || []).map(item => ({
    key: `${pg.id}::${st.id}::${ut.id}::${item.id}`,
    label: `${ut.name} → ${item.name}`,
    userId: pg._userId, pageId: pg.id, subTabId: st.id, ultraSubTabId: ut.id, itemId: item.id,
  })));

  const handleDepartmentFilterChange = (v) => {
    setDepartmentFilter(v);
    setSubDepartmentFilter('all');
    setUserFilter('all'); setPageFilter('all'); setSubTabFilter('all'); setUltraSubTabFilter('all'); setUltraTabFilter('all');
    setExpandedUserId(null); setExpandedSubTabsPageId(null); setExpandedUltraTabsSubTabId(null); setExpandedUltraTabItemsId(null);
  };
  const handleSubDepartmentFilterChange = (v) => {
    setSubDepartmentFilter(v);
    setUserFilter('all'); setPageFilter('all'); setSubTabFilter('all'); setUltraSubTabFilter('all'); setUltraTabFilter('all');
    setExpandedUserId(null); setExpandedSubTabsPageId(null); setExpandedUltraTabsSubTabId(null); setExpandedUltraTabItemsId(null);
  };
  const handleUserFilterChange = (v) => {
    setUserFilter(v);
    setPageFilter('all'); setSubTabFilter('all'); setUltraSubTabFilter('all'); setUltraTabFilter('all');
    setExpandedUserId(v === 'all' ? null : v);
    setExpandedSubTabsPageId(null); setExpandedUltraTabsSubTabId(null); setExpandedUltraTabItemsId(null);
  };
  const handlePageFilterChange = (v) => {
    setPageFilter(v);
    setSubTabFilter('all'); setUltraSubTabFilter('all'); setUltraTabFilter('all');
    setExpandedSubTabsPageId(null); setExpandedUltraTabsSubTabId(null); setExpandedUltraTabItemsId(null);
    if (v === 'all') return;
    const opt = pageOptions.find(o => o.key === v);
    if (opt) setExpandedUserId(opt.userId);
  };
  const handleSubTabFilterChange = (v) => {
    setSubTabFilter(v);
    setUltraSubTabFilter('all'); setUltraTabFilter('all');
    setExpandedUltraTabsSubTabId(null); setExpandedUltraTabItemsId(null);
    if (v === 'all') { setExpandedSubTabsPageId(null); return; }
    const opt = subTabOptions.find(o => o.key === v);
    if (opt) { setExpandedUserId(opt.userId); setExpandedSubTabsPageId(opt.pageId); }
  };
  const handleUltraSubTabFilterChange = (v) => {
    setUltraSubTabFilter(v);
    setUltraTabFilter('all');
    setExpandedUltraTabItemsId(null);
    if (v === 'all') { setExpandedUltraTabsSubTabId(null); return; }
    const opt = ultraSubTabOptions.find(o => o.key === v);
    if (opt) { setExpandedUserId(opt.userId); setExpandedSubTabsPageId(opt.pageId); setExpandedUltraTabsSubTabId(opt.subTabId); }
  };
  const handleUltraTabFilterChange = (v) => {
    setUltraTabFilter(v);
    if (v === 'all') { setExpandedUltraTabItemsId(null); return; }
    const opt = ultraTabOptions.find(o => o.key === v);
    if (opt) {
      setExpandedUserId(opt.userId);
      setExpandedSubTabsPageId(opt.pageId);
      setExpandedUltraTabsSubTabId(opt.subTabId);
      setExpandedUltraTabItemsId(opt.ultraSubTabId);
    }
  };

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
  const openAddUser = () => { if (canEdit) setUserModal({ mode: 'add', name: '', department_id: '', sub_department_id: '', linked_user_id: '' }); };
  const openRenameUser = (u) => { if (canEdit) setUserModal({ mode: 'edit', id: u.id, name: u.user_name, department_id: u.department_id || '', sub_department_id: u.sub_department_id || '', linked_user_id: u.linked_user_id || '' }); };
  const closeUserModal = () => setUserModal(null);

  const saveUserModal = async () => {
    if (!userModal.name.trim()) { toast.error('User name is required'); return; }
    setSaving(true);
    const deptName = departmentName(userModal.department_id);
    const subDeptName = subDepartmentName(userModal.department_id, userModal.sub_department_id);
    const linkedUser = (users || []).find(u => u.user_id === userModal.linked_user_id);
    const next = userModal.mode === 'add'
      ? [...erpUsers, { id: newId('eu'), user_name: userModal.name.trim(), department_id: userModal.department_id || '', department_name: deptName, sub_department_id: userModal.sub_department_id || '', sub_department_name: subDeptName, linked_user_id: userModal.linked_user_id || '', linked_user_name: linkedUser?.name || '', pages: [] }]
      : erpUsers.map(u => (u.id === userModal.id ? { ...u, user_name: userModal.name.trim(), department_id: userModal.department_id || '', department_name: deptName, sub_department_id: userModal.sub_department_id || '', sub_department_name: subDeptName, linked_user_id: userModal.linked_user_id || '', linked_user_name: linkedUser?.name || '' } : u));
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

  // Reassign a task to a different page within the same user, without leaving this table.
  const moveTaskPage = async (task, userId, newPageId) => {
    if (!canEdit || newPageId === (task.erp_page_id || 'others')) return;
    const eu = erpUsers.find(x => x.id === userId);
    const newPageName = newPageId === 'others' ? 'Others' : ((eu?.pages || []).find(p => p.id === newPageId)?.page_name || '');
    try {
      await axios.put(`${API}/api/our-tasks/tasks/${task.task_id}`, {
        erp_page_id: newPageId,
        erp_page_name: newPageName,
      }, { headers });
      toast.success('Task moved to another page');
      onTasksChanged?.();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to move task');
    }
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
  const openEditSubTab = (userId, pageId, tab) => {
    if (!canEdit) return;
    setSubTabModal({ mode: 'view', userId, pageId, tab: { ...tab }, editing: true });
  };
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
  const openEditUltraTab = (userId, pageId, subTabId, tab) => {
    if (!canEdit) return;
    setUltraTabModal({ mode: 'view', userId, pageId, subTabId, tab: { ...tab }, editing: true });
  };
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
  const openEditUltraTabItem = (userId, pageId, subTabId, ultraTabId, tab) => {
    if (!canEdit) return;
    setUltraTabItemModal({ mode: 'view', userId, pageId, subTabId, ultraTabId, tab: { ...tab }, editing: true });
  };
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

  // ---- Drag-and-drop reordering (Pages / Sub Tabs / Ultra Sub Tab / Ultra Tab) ----
  // Plain HTML5 drag events rather than a DnD library — no new dependency needed,
  // and it drops straight onto the existing rows without restructuring the table.
  const reorderArray = (arr, fromIndex, toIndex) => {
    const next = [...arr];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    return next;
  };

  // Users are reordered by id (not list position) because the visible rows can be a
  // filtered/searched subset of erpUsers — an index-based reorder would scramble the
  // underlying array whenever a Department or search filter is active.
  const moveUser = (fromId, toId) => {
    if (!canEdit || fromId === toId) return;
    const fromIndex = erpUsers.findIndex(u => u.id === fromId);
    const toIndex = erpUsers.findIndex(u => u.id === toId);
    if (fromIndex === -1 || toIndex === -1) return;
    persistUsers(reorderArray(erpUsers, fromIndex, toIndex));
  };

  const movePage = (userId, fromIndex, toIndex) => {
    if (!canEdit || fromIndex === toIndex) return;
    persistUsers(erpUsers.map(u => (
      u.id === userId ? { ...u, pages: reorderArray(u.pages || [], fromIndex, toIndex) } : u
    )));
  };
  const moveSubTab = (userId, pageId, fromIndex, toIndex) => {
    if (!canEdit || fromIndex === toIndex) return;
    persistPages(userId, pages => pages.map(p => (
      p.id === pageId ? { ...p, sub_tabs: reorderArray(p.sub_tabs || [], fromIndex, toIndex) } : p
    )));
  };
  const moveUltraSubTab = (userId, pageId, subTabId, fromIndex, toIndex) => {
    if (!canEdit || fromIndex === toIndex) return;
    persistPages(userId, pages => pages.map(p => (
      p.id !== pageId ? p : {
        ...p,
        sub_tabs: (p.sub_tabs || []).map(st => (
          st.id === subTabId ? { ...st, ultra_sub_tabs: reorderArray(st.ultra_sub_tabs || [], fromIndex, toIndex) } : st
        )),
      }
    )));
  };
  const moveUltraTabItem = (userId, pageId, subTabId, ultraTabId, fromIndex, toIndex) => {
    if (!canEdit || fromIndex === toIndex) return;
    persistPages(userId, pages => mapUltraSubTab(pages, pageId, subTabId, ut => (
      ut.id === ultraTabId ? { ...ut, ultra_tabs: reorderArray(ut.ultra_tabs || [], fromIndex, toIndex) } : ut
    )));
  };

  // { level, key, index } — key scopes a drag to its own list (e.g. a page's
  // own sub_tabs) so dropping never reorders across two different parents.
  const [dragItem, setDragItem] = useState(null);
  const dragRowProps = (level, key, index, moveFn) => (!canEdit ? {} : {
    draggable: true,
    onDragStart: (e) => {
      setDragItem({ level, key, index });
      e.dataTransfer.effectAllowed = 'move';
    },
    onDragOver: (e) => {
      if (dragItem && dragItem.level === level && dragItem.key === key) e.preventDefault();
    },
    onDrop: (e) => {
      e.preventDefault();
      if (dragItem && dragItem.level === level && dragItem.key === key && dragItem.index !== index) {
        moveFn(dragItem.index, index);
      }
      setDragItem(null);
    },
    onDragEnd: () => setDragItem(null),
  });
  const DragHandle = () => (
    <GripVertical className={`h-3.5 w-3.5 ${textSecondary} cursor-grab shrink-0 inline-block align-middle mr-1`} />
  );

  // Separate id-based drag handlers for the top-level Users table (see moveUser above).
  const [dragUserId, setDragUserId] = useState(null);
  const userDragRowProps = (userId) => (!canEdit ? {} : {
    draggable: true,
    onDragStart: (e) => {
      setDragUserId(userId);
      e.dataTransfer.effectAllowed = 'move';
    },
    onDragOver: (e) => {
      if (dragUserId && dragUserId !== userId) e.preventDefault();
    },
    onDrop: (e) => {
      e.preventDefault();
      if (dragUserId && dragUserId !== userId) moveUser(dragUserId, userId);
      setDragUserId(null);
    },
    onDragEnd: () => setDragUserId(null),
  });

  // ---- Quick "Add Task" popup — reachable from every level of the hierarchy
  // (User, Page, Sub Tab, Ultra Sub Tab, Ultra Tab) via the AddTaskButton
  // below. Whichever level it's opened from pre-fills that level's id/name
  // (and every ancestor's), so the created task carries the full ERP
  // breadcrumb without the user having to re-pick anything already implied
  // by where they clicked. Not gated by canEdit — logging a task is a much
  // lower-risk action than editing the ERP structure itself, and any team
  // member should be able to do it from here.
  const [taskModal, setTaskModal] = useState(null);
  const [savingTask, setSavingTask] = useState(false);

  const openAddTask = (ctx) => {
    setTaskModal({
      userId: ctx.userId || '',
      userName: ctx.userName || '',
      pageId: ctx.pageId || '',
      pageName: ctx.pageName || '',
      subTabId: ctx.subTabId || '',
      subTabName: ctx.subTabName || '',
      ultraSubTabId: ctx.ultraSubTabId || '',
      ultraSubTabName: ctx.ultraSubTabName || '',
      ultraTabId: ctx.ultraTabId || '',
      ultraTabName: ctx.ultraTabName || '',
      draft: {
        task_name: '',
        priority: 'medium',
        erp_task_type: '',
        assigned_to: currentUser?.user_id || '',
        due_date: new Date().toISOString().slice(0, 10),
        work_link: '',
      },
    });
  };
  const closeTaskModal = () => setTaskModal(null);

  const submitTaskModal = async () => {
    if (!taskModal.draft.task_name.trim()) { toast.error('Task name is required'); return; }
    setSavingTask(true);
    try {
      await axios.post(`${API}/api/our-tasks/tasks`, {
        task_name: taskModal.draft.task_name.trim(),
        priority: taskModal.draft.priority,
        type: 'general',
        assigned_to: taskModal.draft.assigned_to || currentUser?.user_id,
        due_date: taskModal.draft.due_date || null,
        work_link: taskModal.draft.work_link || '',
        status: 'pending',
        department: 'erp',
        project_id: project.project_id,
        project_name: project.name,
        erp_user_id: taskModal.userId,
        erp_user_name: taskModal.userName,
        erp_page_id: taskModal.pageId,
        erp_page_name: taskModal.pageName,
        erp_sub_tab_id: taskModal.subTabId,
        erp_sub_tab_name: taskModal.subTabName,
        erp_ultra_sub_tab_id: taskModal.ultraSubTabId,
        erp_ultra_sub_tab_name: taskModal.ultraSubTabName,
        erp_ultra_tab_id: taskModal.ultraTabId,
        erp_ultra_tab_name: taskModal.ultraTabName,
        erp_task_type: taskModal.draft.erp_task_type || '',
      }, { headers });
      toast.success('Task added');
      closeTaskModal();
      onTasksChanged?.();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to add task');
    } finally {
      setSavingTask(false);
    }
  };

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

  const summaryCard = (label, value, Icon, colorClass, active, onClick) => (
    <button
      type="button"
      onClick={onClick}
      className={`${bgCard} border ${active ? 'border-[#6366f1] ring-1 ring-[#6366f1]' : borderColor} rounded-lg p-3 text-left transition-colors hover:border-[#6366f1]/60`}
      data-testid={`erp-task-summary-${label.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <div className="flex items-center justify-between">
        <p className={`text-xs ${textSecondary}`}>{label}</p>
        <Icon className={`h-4 w-4 ${colorClass}`} />
      </div>
      <p className={`text-2xl font-bold mt-1 ${textPrimary}`}>{value}</p>
    </button>
  );

  return (
    <div className="space-y-3" data-testid="project-erp-users-tab">
      <div>
        <h3 className={`text-lg font-semibold ${textPrimary} flex items-center gap-2`}>
          <UsersIcon className="h-5 w-5 text-[#6366f1]" /> Users
        </h3>
        <p className={`text-xs ${textSecondary}`}>
          Each user's pages track ERP work the same way the Website department tracks pages.
        </p>
      </div>

      {/* Task summary cards — scoped to the Department/User/Page filters below, date-filterable */}
      <div className="space-y-2">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {summaryCard('Total Tasks', totalTasksCount, ListChecks, 'text-[#6366f1]', taskStatusFilter === 'all', () => setTaskStatusFilter('all'))}
          <div className={`${bgCard} border ${(taskStatusFilter === 'todo_created' || taskStatusFilter === 'todo_assigned') ? 'border-[#6366f1] ring-1 ring-[#6366f1]' : borderColor} rounded-lg p-3`} data-testid="erp-task-summary-to-do">
            <div className="flex items-center justify-between">
              <p className={`text-xs ${textSecondary}`}>To-do</p>
              <ListTodo className="h-4 w-4 text-amber-400" />
            </div>
            <div className="flex items-center gap-3 mt-1">
              <button
                type="button"
                onClick={() => setTaskStatusFilter(taskStatusFilter === 'todo_created' ? 'all' : 'todo_created')}
                className={`text-left ${taskStatusFilter === 'todo_created' ? 'text-[#6366f1]' : textPrimary}`}
                data-testid="erp-task-summary-todo-created"
              >
                <span className="text-xl font-bold">{todoCreatedCount}</span>
                <span className={`text-[10px] block uppercase ${textSecondary}`}>Created</span>
              </button>
              <button
                type="button"
                onClick={() => setTaskStatusFilter(taskStatusFilter === 'todo_assigned' ? 'all' : 'todo_assigned')}
                className={`text-left ${taskStatusFilter === 'todo_assigned' ? 'text-[#6366f1]' : textPrimary}`}
                data-testid="erp-task-summary-todo-assigned"
              >
                <span className="text-xl font-bold">{todoAssignedCount}</span>
                <span className={`text-[10px] block uppercase ${textSecondary}`}>Assigned</span>
              </button>
            </div>
          </div>
          {summaryCard('Pending', pendingTasksCount, Clock, 'text-yellow-400', taskStatusFilter === 'pending', () => setTaskStatusFilter(taskStatusFilter === 'pending' ? 'all' : 'pending'))}
          {summaryCard('Completed', completedTasksCount, CheckCircle2, 'text-emerald-400', taskStatusFilter === 'completed', () => setTaskStatusFilter(taskStatusFilter === 'completed' ? 'all' : 'completed'))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={taskDateFilter} onValueChange={setTaskDateFilter}>
            <SelectTrigger className={`${bgSecondary} border ${borderColor} ${textPrimary} h-9 w-[150px]`} data-testid="erp-task-date-filter">
              <SelectValue placeholder="All Time" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="custom">Custom Range</SelectItem>
            </SelectContent>
          </Select>
          {taskDateFilter === 'custom' && (
            <>
              <Input
                type="date"
                value={taskDateFrom}
                onChange={(e) => setTaskDateFrom(e.target.value)}
                className={`${bgSecondary} border ${borderColor} ${textPrimary} h-9 w-[150px]`}
                data-testid="erp-task-date-from"
              />
              <span className={`text-xs ${textSecondary}`}>to</span>
              <Input
                type="date"
                value={taskDateTo}
                onChange={(e) => setTaskDateTo(e.target.value)}
                className={`${bgSecondary} border ${borderColor} ${textPrimary} h-9 w-[150px]`}
                data-testid="erp-task-date-to"
              />
            </>
          )}
          {(taskDateFilter !== 'all' || taskStatusFilter !== 'all') && (
            <button
              type="button"
              onClick={() => { setTaskDateFilter('all'); setTaskDateFrom(''); setTaskDateTo(''); setTaskStatusFilter('all'); }}
              className={`text-xs ${textSecondary} hover:${textPrimary} inline-flex items-center gap-1`}
              data-testid="erp-task-filter-clear"
            >
              <X className="h-3 w-3" /> Clear
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className={`h-3.5 w-3.5 ${textSecondary} absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none`} />
            <Input
              value={userSearchQuery}
              onChange={(e) => setUserSearchQuery(e.target.value)}
              placeholder="Search users..."
              className={`${bgSecondary} border ${borderColor} ${textPrimary} h-9 w-[180px] pl-8`}
              data-testid="erp-user-search"
            />
          </div>
          <Select value={departmentFilter} onValueChange={handleDepartmentFilterChange}>
            <SelectTrigger className={`${bgSecondary} border ${borderColor} ${textPrimary} h-9 w-[160px]`} data-testid="erp-user-department-filter">
              <SelectValue placeholder="All Departments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {erpDepartments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
              <SelectItem value="_none">No Department</SelectItem>
            </SelectContent>
          </Select>
          {subDepartmentFilterOptions.length > 0 && (
            <Select value={subDepartmentFilter} onValueChange={handleSubDepartmentFilterChange}>
              <SelectTrigger className={`${bgSecondary} border ${borderColor} ${textPrimary} h-9 w-[170px]`} data-testid="erp-user-subdepartment-filter">
                <SelectValue placeholder="All Sub Departments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sub Departments</SelectItem>
                {subDepartmentFilterOptions.map(sd => <SelectItem key={sd.id} value={sd.id}>{sd.name}</SelectItem>)}
                <SelectItem value="_none">No Sub Department</SelectItem>
              </SelectContent>
            </Select>
          )}
          <Select value={userFilter} onValueChange={handleUserFilterChange}>
            <SelectTrigger className={`${bgSecondary} border ${borderColor} ${textPrimary} h-9 w-[150px]`} data-testid="erp-user-filter">
              <SelectValue placeholder="All Users" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Users</SelectItem>
              {visibleErpUsers.map(u => <SelectItem key={u.id} value={u.id}>{u.user_name || '—'}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={pageFilter} onValueChange={handlePageFilterChange} disabled={pageOptions.length === 0}>
            <SelectTrigger className={`${bgSecondary} border ${borderColor} ${textPrimary} h-9 w-[160px]`} data-testid="erp-page-filter">
              <SelectValue placeholder="All Pages" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Pages</SelectItem>
              {pageOptions.map(o => <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={subTabFilter} onValueChange={handleSubTabFilterChange} disabled={subTabOptions.length === 0}>
            <SelectTrigger className={`${bgSecondary} border ${borderColor} ${textPrimary} h-9 w-[160px]`} data-testid="erp-subtab-filter">
              <SelectValue placeholder="All Sub Tabs" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sub Tabs</SelectItem>
              {subTabOptions.map(o => <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={ultraSubTabFilter} onValueChange={handleUltraSubTabFilterChange} disabled={ultraSubTabOptions.length === 0}>
            <SelectTrigger className={`${bgSecondary} border ${borderColor} ${textPrimary} h-9 w-[170px]`} data-testid="erp-ultra-subtab-filter">
              <SelectValue placeholder="All Ultra Sub Tab" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Ultra Sub Tab</SelectItem>
              {ultraSubTabOptions.map(o => <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={ultraTabFilter} onValueChange={handleUltraTabFilterChange} disabled={ultraTabOptions.length === 0}>
            <SelectTrigger className={`${bgSecondary} border ${borderColor} ${textPrimary} h-9 w-[160px]`} data-testid="erp-ultra-tab-filter">
              <SelectValue placeholder="All Ultra Tab" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Ultra Tab</SelectItem>
              {ultraTabOptions.map(o => <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
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
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase`}>Department</th>
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase`}>Pages</th>
                  <th className={`text-right p-3 text-[11px] font-medium ${textSecondary} uppercase w-24`}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredErpUsers.map((u, idx) => {
                  const isExpanded = expandedUserId === u.id;
                  const pages = (u.pages || []).filter(pg => pageFilter === 'all' || pg.id === pageFilter);
                  return (
                    <React.Fragment key={u.id}>
                      <tr
                        className={`border-b ${borderColor} ${dragUserId === u.id ? 'opacity-40' : ''}`}
                        data-testid={`erp-user-row-${u.id}`}
                        {...userDragRowProps(u.id)}
                      >
                        <td className={`p-3 text-xs ${textSecondary}`}>{canEdit && <DragHandle />}{idx + 1}</td>
                        <td className="p-3">
                          <button
                            type="button"
                            onClick={() => setExpandedUserId(isExpanded ? null : u.id)}
                            className={`inline-flex items-center gap-1.5 text-sm font-medium ${textPrimary} hover:opacity-80`}
                            data-testid={`erp-user-toggle-${u.id}`}
                          >
                            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            {u.user_name || '—'}
                            {u.linked_user_name && (
                              <span className={`text-[10px] font-normal ${textSecondary}`}>({u.linked_user_name})</span>
                            )}
                          </button>
                        </td>
                        <td className={`p-3 text-xs ${textSecondary}`}>
                          {u.department_name || departmentName(u.department_id) || '—'}
                          {u.sub_department_id && (
                            <span className="opacity-70"> / {u.sub_department_name || subDepartmentName(u.department_id, u.sub_department_id)}</span>
                          )}
                        </td>
                        <td className={`p-3 text-xs ${textSecondary}`}>{pages.length}</td>
                        <td className="p-3 text-right">
                          <div className="inline-flex gap-1">
                            <AddTaskButton onClick={() => openAddTask({ userId: u.id, userName: u.user_name })} testId={`erp-user-addtask-${u.id}`} />
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
                          <td colSpan={5} className="p-3">
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
                                    <th className={`text-left px-3 py-2 text-[10px] font-medium ${textSecondary} uppercase`}>Type</th>
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
                                        <tr
                                          className={`border-b ${borderColor} ${dragItem?.level === 'page' && dragItem.index === pIdx && dragItem.key === u.id ? 'opacity-40' : ''}`}
                                          data-testid={`erp-page-row-${row.id}`}
                                          {...dragRowProps('page', u.id, pIdx, (from, to) => movePage(u.id, from, to))}
                                        >
                                          <td className={`px-3 py-2 text-xs ${textSecondary}`}>{canEdit && <DragHandle />}{pIdx + 1}</td>
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
                                            {row.type ? (
                                              <span className={`px-2 py-1 rounded-md text-xs font-medium border ${PAGE_TYPE_STYLE[row.type] || ''}`}>
                                                {row.type}
                                              </span>
                                            ) : (
                                              <span className={`text-xs ${textSecondary}`}>—</span>
                                            )}
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
                                              <AddTaskButton onClick={() => openAddTask({ userId: u.id, userName: u.user_name, pageId: row.id, pageName: row.page_name })} testId={`erp-page-addtask-${row.id}`} />
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
                                            <td colSpan={9} className="p-3">
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
                                                        <th className={`text-left px-3 py-2 text-[10px] font-medium ${textSecondary} uppercase w-40`}>Move To Page</th>
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
                                                          <td className="px-3 py-2">
                                                            {canEdit ? (
                                                              <Select value={t.erp_page_id || 'others'} onValueChange={(v) => moveTaskPage(t, u.id, v)}>
                                                                <SelectTrigger className={`h-7 text-xs ${bgSecondary} border ${borderColor} ${textPrimary}`} data-testid={`erp-task-move-${t.task_id}`}>
                                                                  <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                  {pages.map(pg => (
                                                                    <SelectItem key={pg.id} value={pg.id}>{pg.page_name}</SelectItem>
                                                                  ))}
                                                                  <SelectItem value="others">Others</SelectItem>
                                                                </SelectContent>
                                                              </Select>
                                                            ) : (
                                                              <span className={`text-xs ${textSecondary}`}>{row.page_name}</span>
                                                            )}
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
                                            <td colSpan={9} className="p-3">
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
                                                          <tr
                                                            className={`border-b ${borderColor} ${dragItem?.level === 'subtab' && dragItem.index === stIdx && dragItem.key === `${u.id}::${row.id}` ? 'opacity-40' : ''}`}
                                                            data-testid={`erp-subtab-row-${st.id}`}
                                                            {...dragRowProps('subtab', `${u.id}::${row.id}`, stIdx, (from, to) => moveSubTab(u.id, row.id, from, to))}
                                                          >
                                                            <td className={`px-3 py-2 text-xs ${textSecondary}`}>{canEdit && <DragHandle />}{stIdx + 1}</td>
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
                                                                <AddTaskButton onClick={() => openAddTask({ userId: u.id, userName: u.user_name, pageId: row.id, pageName: row.page_name, subTabId: st.id, subTabName: st.name })} testId={`erp-subtab-addtask-${st.id}`} />
                                                                <button type="button" onClick={() => openViewSubTab(u.id, row.id, st)} className={`p-1 ${textSecondary} hover:opacity-80`} title="View" data-testid={`erp-subtab-view-${st.id}`}>
                                                                  <Eye className="h-4 w-4" />
                                                                </button>
                                                                {canEdit && (
                                                                  <button type="button" onClick={() => openEditSubTab(u.id, row.id, st)} className={`p-1 ${textSecondary} hover:opacity-80`} title="Edit" data-testid={`erp-subtab-edit-${st.id}`}>
                                                                    <Pencil className="h-4 w-4" />
                                                                  </button>
                                                                )}
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
                                                                            <tr
                                                                              className={`border-b ${borderColor} ${dragItem?.level === 'ultrasubtab' && dragItem.index === utIdx && dragItem.key === `${u.id}::${row.id}::${st.id}` ? 'opacity-40' : ''}`}
                                                                              data-testid={`erp-ultratab-row-${ut.id}`}
                                                                              {...dragRowProps('ultrasubtab', `${u.id}::${row.id}::${st.id}`, utIdx, (from, to) => moveUltraSubTab(u.id, row.id, st.id, from, to))}
                                                                            >
                                                                              <td className={`px-3 py-2 text-xs ${textSecondary}`}>{canEdit && <DragHandle />}{utIdx + 1}</td>
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
                                                                                  <AddTaskButton onClick={() => openAddTask({ userId: u.id, userName: u.user_name, pageId: row.id, pageName: row.page_name, subTabId: st.id, subTabName: st.name, ultraSubTabId: ut.id, ultraSubTabName: ut.name })} testId={`erp-ultratab-addtask-${ut.id}`} />
                                                                                  <button type="button" onClick={() => openViewUltraTab(u.id, row.id, st.id, ut)} className={`p-1 ${textSecondary} hover:opacity-80`} title="View" data-testid={`erp-ultratab-view-${ut.id}`}>
                                                                                    <Eye className="h-4 w-4" />
                                                                                  </button>
                                                                                  {canEdit && (
                                                                                    <button type="button" onClick={() => openEditUltraTab(u.id, row.id, st.id, ut)} className={`p-1 ${textSecondary} hover:opacity-80`} title="Edit" data-testid={`erp-ultratab-edit-${ut.id}`}>
                                                                                      <Pencil className="h-4 w-4" />
                                                                                    </button>
                                                                                  )}
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
                                                                                          <tr
                                                                                            key={it.id}
                                                                                            className={`border-b ${borderColor} last:border-b-0 ${dragItem?.level === 'ultratabitem' && dragItem.index === itIdx && dragItem.key === `${u.id}::${row.id}::${st.id}::${ut.id}` ? 'opacity-40' : ''}`}
                                                                                            data-testid={`erp-ultratab-item-row-${it.id}`}
                                                                                            {...dragRowProps('ultratabitem', `${u.id}::${row.id}::${st.id}::${ut.id}`, itIdx, (from, to) => moveUltraTabItem(u.id, row.id, st.id, ut.id, from, to))}
                                                                                          >
                                                                                            <td className={`px-3 py-2 text-xs ${textSecondary}`}>{canEdit && <DragHandle />}{itIdx + 1}</td>
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
                                                                                                <AddTaskButton onClick={() => openAddTask({ userId: u.id, userName: u.user_name, pageId: row.id, pageName: row.page_name, subTabId: st.id, subTabName: st.name, ultraSubTabId: ut.id, ultraSubTabName: ut.name, ultraTabId: it.id, ultraTabName: it.name })} testId={`erp-ultratab-item-addtask-${it.id}`} />
                                                                                                <button type="button" onClick={() => openViewUltraTabItem(u.id, row.id, st.id, ut.id, it)} className={`p-1 ${textSecondary} hover:opacity-80`} title="View" data-testid={`erp-ultratab-item-view-${it.id}`}>
                                                                                                  <Eye className="h-4 w-4" />
                                                                                                </button>
                                                                                                {canEdit && (
                                                                                                  <button type="button" onClick={() => openEditUltraTabItem(u.id, row.id, st.id, ut.id, it)} className={`p-1 ${textSecondary} hover:opacity-80`} title="Edit" data-testid={`erp-ultratab-item-edit-${it.id}`}>
                                                                                                    <Pencil className="h-4 w-4" />
                                                                                                  </button>
                                                                                                )}
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
                                      <td colSpan={9} className={`p-6 text-center text-xs ${textSecondary}`}>
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
                {filteredErpUsers.length === 0 && (
                  <tr>
                    <td colSpan={5} className={`p-8 text-center text-xs ${textSecondary}`}>
                      {erpUsers.length === 0
                        ? <>No users yet. {canEdit && <span>Click <span className="font-medium">Add User</span> to add one.</span>}</>
                        : 'No users match the current filters.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Add / Rename User popup */}
      {/* z-40, not z-[70]: the Department <Select> below portals to
          document.body at z-50 (ui/select.jsx) — z-[70] would render this
          modal on top of it. */}
      {userModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-40 p-4" onClick={closeUserModal}>
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
            <div className="p-5 space-y-4">
              <div>
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
              <div>
                <p className={`text-xs font-medium ${textSecondary} mb-1`}>Department</p>
                <Select
                  value={userModal.department_id || '_none'}
                  onValueChange={(v) => setUserModal(m => ({ ...m, department_id: v === '_none' ? '' : v, sub_department_id: '' }))}
                >
                  <SelectTrigger className={`${bgSecondary} border ${borderColor} ${textPrimary}`} data-testid="erp-user-form-department">
                    <SelectValue placeholder="— No department —" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">— No department —</SelectItem>
                    {erpDepartments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                {erpDepartments.length === 0 && (
                  <p className={`text-[11px] ${textSecondary} mt-1`}>No departments yet — add one from the Departments tab.</p>
                )}
              </div>
              {subDepartmentsOf(userModal.department_id).length > 0 && (
                <div>
                  <p className={`text-xs font-medium ${textSecondary} mb-1`}>Sub Department</p>
                  <Select
                    value={userModal.sub_department_id || '_none'}
                    onValueChange={(v) => setUserModal(m => ({ ...m, sub_department_id: v === '_none' ? '' : v }))}
                  >
                    <SelectTrigger className={`${bgSecondary} border ${borderColor} ${textPrimary}`} data-testid="erp-user-form-subdepartment">
                      <SelectValue placeholder="— No sub department —" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">— No sub department —</SelectItem>
                      {subDepartmentsOf(userModal.department_id).map(sd => <SelectItem key={sd.id} value={sd.id}>{sd.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <p className={`text-xs font-medium ${textSecondary} mb-1`}>Login Account</p>
                <Select
                  value={userModal.linked_user_id || '_none'}
                  onValueChange={(v) => setUserModal(m => ({ ...m, linked_user_id: v === '_none' ? '' : v }))}
                >
                  <SelectTrigger className={`${bgSecondary} border ${borderColor} ${textPrimary}`} data-testid="erp-user-form-linked-account">
                    <SelectValue placeholder="— Not linked —" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">— Not linked —</SelectItem>
                    {(users || []).map(u => <SelectItem key={u.user_id} value={u.user_id}>{u.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className={`text-[11px] ${textSecondary} mt-1`}>
                  Links this role to a real Drawlead OS login, so department/sub-department access restrictions apply to whoever's actually signed in as them.
                </p>
              </div>
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
                  <div>
                    <p className={`text-xs font-medium ${textSecondary} mb-1`}>Type</p>
                    <Select
                      value={pageModal.page.type || '_none'}
                      onValueChange={(v) => setPageModal(m => ({ ...m, page: { ...m.page, type: v === '_none' ? '' : v } }))}
                    >
                      <SelectTrigger className={`${bgSecondary} border ${borderColor} ${textPrimary}`} data-testid="erp-page-form-type">
                        <SelectValue placeholder="— Select type —" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">— Select type —</SelectItem>
                        {PAGE_TYPE_OPTIONS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
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
                  {pageModal.page.type && (
                    <div>
                      <p className={`text-[11px] uppercase tracking-wide ${textSecondary}`}>Type</p>
                      <span className={`inline-block mt-1 px-2 py-1 rounded-md text-xs font-medium border ${PAGE_TYPE_STYLE[pageModal.page.type] || ''}`}>
                        {pageModal.page.type}
                      </span>
                    </div>
                  )}
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

      {/* Quick "Add Task" popup — opened from a User/Page/Sub Tab/Ultra Sub Tab/Ultra
          Tab row's Add Task button (see AddTaskButton above). z-40, not z-[70]: the
          selects below portal to document.body at z-50 (ui/select.jsx). */}
      {taskModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-40 p-4" onClick={closeTaskModal}>
          <div className={`${bgCard} border ${borderColor} rounded-xl w-full max-w-lg`} onClick={(e) => e.stopPropagation()}>
            <div className={`p-5 border-b ${borderColor} flex items-center justify-between`}>
              <h3 className={`text-base font-semibold ${textPrimary} flex items-center gap-2`}>
                <ListChecks className="h-4 w-4 text-[#6366f1]" /> Add Task
              </h3>
              <button onClick={closeTaskModal} className={textSecondary}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <p className={`text-xs font-medium ${textSecondary} mb-1`}>Task Name</p>
                <Input
                  value={taskModal.draft.task_name}
                  onChange={(e) => setTaskModal(m => ({ ...m, draft: { ...m.draft, task_name: e.target.value } }))}
                  placeholder="e.g. Fix validation on Save button"
                  className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                  data-testid="erp-quicktask-form-name"
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className={`text-xs font-medium ${textSecondary} mb-1`}>Priority</p>
                  <Select
                    value={taskModal.draft.priority}
                    onValueChange={(v) => setTaskModal(m => ({ ...m, draft: { ...m.draft, priority: v } }))}
                  >
                    <SelectTrigger className={`${bgSecondary} border ${borderColor} ${textPrimary}`} data-testid="erp-quicktask-form-priority">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <p className={`text-xs font-medium ${textSecondary} mb-1`}>Type</p>
                  <Select
                    value={taskModal.draft.erp_task_type || '_none'}
                    onValueChange={(v) => setTaskModal(m => ({ ...m, draft: { ...m.draft, erp_task_type: v === '_none' ? '' : v } }))}
                  >
                    <SelectTrigger className={`${bgSecondary} border ${borderColor} ${textPrimary}`} data-testid="erp-quicktask-form-type">
                      <SelectValue placeholder="— Select type —" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">— Select type —</SelectItem>
                      {PAGE_TYPE_OPTIONS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className={`text-xs font-medium ${textSecondary} mb-1`}>Assign To</p>
                  <Select
                    value={taskModal.draft.assigned_to || '_none'}
                    onValueChange={(v) => setTaskModal(m => ({ ...m, draft: { ...m.draft, assigned_to: v === '_none' ? '' : v } }))}
                  >
                    <SelectTrigger className={`${bgSecondary} border ${borderColor} ${textPrimary}`} data-testid="erp-quicktask-form-assignee">
                      <SelectValue placeholder="— Select —" />
                    </SelectTrigger>
                    <SelectContent>
                      {(users || []).map(usr => <SelectItem key={usr.user_id} value={usr.user_id}>{usr.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <p className={`text-xs font-medium ${textSecondary} mb-1`}>Due Date</p>
                  <Input
                    type="date"
                    value={taskModal.draft.due_date}
                    onChange={(e) => setTaskModal(m => ({ ...m, draft: { ...m.draft, due_date: e.target.value } }))}
                    className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                    data-testid="erp-quicktask-form-due-date"
                  />
                </div>
              </div>
              <div>
                <p className={`text-xs font-medium ${textSecondary} mb-1`}>Work Link</p>
                <Input
                  value={taskModal.draft.work_link}
                  onChange={(e) => setTaskModal(m => ({ ...m, draft: { ...m.draft, work_link: e.target.value } }))}
                  placeholder="https://…"
                  className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                  data-testid="erp-quicktask-form-worklink"
                />
              </div>
              {/* Live breadcrumb — shows exactly where in the hierarchy this task will be tagged */}
              <div className={`p-4 rounded-lg border ${borderColor} ${bgSecondary}`} data-testid="erp-quicktask-prompt">
                <p className={`text-xs font-medium ${textSecondary} mb-2`}>Prompt</p>
                <p className={`text-sm ${textPrimary} break-words`}>
                  {buildErpPrompt({
                    projectName: project?.name,
                    userName: taskModal.userName,
                    pageName: taskModal.pageName,
                    subTabName: taskModal.subTabName,
                    ultraSubTabName: taskModal.ultraSubTabName,
                    ultraTabName: taskModal.ultraTabName,
                    taskName: taskModal.draft.task_name,
                  })}
                </p>
              </div>
            </div>
            <div className={`p-5 border-t ${borderColor} flex items-center justify-end gap-2`}>
              <Button type="button" variant="outline" onClick={closeTaskModal}>Cancel</Button>
              <Button
                type="button"
                onClick={submitTaskModal}
                disabled={savingTask}
                className="bg-[#6366f1] hover:bg-[#4f46e5] text-white"
                data-testid="erp-quicktask-form-save"
              >
                {savingTask ? 'Adding…' : 'Add Task'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
