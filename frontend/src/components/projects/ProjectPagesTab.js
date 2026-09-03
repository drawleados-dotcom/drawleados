import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import { Plus, Trash2, Pencil, Eye, X, ExternalLink, Globe, ChevronDown, ChevronRight, ListChecks, Layers, Upload, FileText, GripVertical } from 'lucide-react';
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
const newSubPageId = () => `subpg_${Math.random().toString(36).slice(2, 10)}`;
const newSectionId = () => `sec_${Math.random().toString(36).slice(2, 10)}`;

// A section's build-out is tracked as one task per workflow stage — each
// tab in the section modal below edits one of these, and saving creates or
// updates the matching task (tagged to the section via page_section_id,
// category = the stage name) rather than storing this on the section itself.
const STAGE_DEFS = [
  { key: 'content', category: 'Content' },
  { key: 'design', category: 'Design' },
  { key: 'development', category: 'Development' },
  { key: 'testing', category: 'Testing' },
];
const emptyStageTask = () => ({ task_id: null, text: '', link: '', assigned_to: '', due_date: '' });
const emptyStages = () => ({
  content: emptyStageTask(),
  design: { ...emptyStageTask(), reference_image: '', design_file: '', design_file_name: '' },
  development: emptyStageTask(),
  testing: emptyStageTask(),
});
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

  // Sub Pages nested under each page, and Sections nested under either a
  // page directly OR one of its sub pages — three independent expand
  // toggles (only one thing open per level at a time, same as the ERP
  // Workflow tab's single-expanded-id pattern).
  const [expandedSectionsPageId, setExpandedSectionsPageId] = useState(null);
  const [expandedSectionTasksId, setExpandedSectionTasksId] = useState(null);
  // Sub pages nest recursively (a sub page can have its own sub pages, to
  // any depth), so "expanded" is a Set of node ids rather than one value —
  // ids are unique regardless of depth, so a flat Set works for the whole
  // tree. { mode: 'add' | 'edit', pageId, parentPath, id, name } — parentPath
  // is the chain of ancestor sub-page ids from the page down to (but not
  // including) the node being added under / renamed.
  const [expandedSubPageIds, setExpandedSubPageIds] = useState(() => new Set());
  const toggleSubPageExpanded = (id) => setExpandedSubPageIds((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const [subPageModal, setSubPageModal] = useState(null);
  // { mode: 'add' | 'edit', pageId, path (chain of ancestor sub-page ids
  //   from the page down to the node this section lives directly on; []
  //   = section lives directly on the page, not under any sub page), id,
  //   name, description, reference_image, priority, due_date, assigned_to }
  // — a section carries the same kind of detail as a task (creating one IS
  // the work of building it out), just with no Task Type picker: unlike a
  // page/section's tagged tasks, section creation is inherently one kind of
  // work, so there's nothing to pick.
  const [sectionModal, setSectionModal] = useState(null);

  // Content tab's textarea auto-grows with its content instead of scrolling
  // sideways — same pattern as the Task Name field elsewhere in this app.
  const contentStageTextRef = useRef(null);
  useEffect(() => {
    const el = contentStageTextRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [sectionModal?.stages?.content?.text]);

  // Recursive-tree helpers — a page's sub_pages array holds nodes shaped
  // like { id, name, sections, sub_pages }, and any node's own sub_pages
  // array is shaped the same way, to unbounded depth. `path` throughout
  // this file means "chain of node ids from the page down to a target",
  // walked one id at a time until it bottoms out.
  const findSubPageAtPath = (subPages, path) => {
    if (path.length === 0) return null;
    const [head, ...rest] = path;
    const node = (subPages || []).find((sp) => sp.id === head);
    if (!node) return null;
    if (rest.length === 0) return node;
    return findSubPageAtPath(node.sub_pages || [], rest);
  };
  // Replaces the sub_pages array living at parentPath (empty = the
  // top-level array itself) with fn(that array) — used to add/rename/
  // remove a sub page at any depth by targeting its parent.
  const mapSubPagesAtParentPath = (subPages, parentPath, fn) => {
    if (parentPath.length === 0) return fn(subPages || []);
    const [head, ...rest] = parentPath;
    return (subPages || []).map((sp) => (
      sp.id === head ? { ...sp, sub_pages: mapSubPagesAtParentPath(sp.sub_pages || [], rest, fn) } : sp
    ));
  };
  // Replaces the sections array living at path (non-empty: chain down to
  // the sub-page node those sections belong to) with fn(that array).
  const mapSectionsAtSubPagePath = (subPages, path, fn) => {
    const [head, ...rest] = path;
    return (subPages || []).map((sp) => {
      if (sp.id !== head) return sp;
      if (rest.length === 0) return { ...sp, sections: fn(sp.sections || []) };
      return { ...sp, sub_pages: mapSectionsAtSubPagePath(sp.sub_pages || [], rest, fn) };
    });
  };

  const openAddSubPage = (pageId, parentPath = []) => {
    if (!canEdit) return;
    setSubPageModal({ mode: 'add', pageId, parentPath, name: '' });
  };
  const openEditSubPage = (pageId, parentPath, subPage) => {
    if (!canEdit) return;
    setSubPageModal({ mode: 'edit', pageId, parentPath, id: subPage.id, name: subPage.name });
  };
  const closeSubPageModal = () => setSubPageModal(null);

  const saveSubPageModal = async () => {
    if (!subPageModal.name.trim()) { toast.error('Sub page name is required'); return; }
    setSaving(true);
    const trimmed = subPageModal.name.trim();
    const next = pages.map((p) => {
      if (p.id !== subPageModal.pageId) return p;
      const nextSubPages = mapSubPagesAtParentPath(p.sub_pages || [], subPageModal.parentPath, (subPages) => (
        subPageModal.mode === 'add'
          ? [...subPages, { id: newSubPageId(), name: trimmed, sections: [], sub_pages: [] }]
          : subPages.map((sp) => (sp.id === subPageModal.id ? { ...sp, name: trimmed } : sp))
      ));
      return { ...p, sub_pages: nextSubPages };
    });
    const ok = await persist(next);
    setSaving(false);
    if (ok) {
      toast.success(subPageModal.mode === 'add' ? 'Sub page added' : 'Sub page updated');
      closeSubPageModal();
    }
  };

  const deleteSubPage = async (pageId, parentPath, subPageId) => {
    if (!canEdit) return;
    const page = pages.find((p) => p.id === pageId);
    const node = findSubPageAtPath(page?.sub_pages || [], [...parentPath, subPageId]);
    if ((node?.sections || []).length > 0 || (node?.sub_pages || []).length > 0) {
      toast.error('Cannot delete: this sub page still has sections or sub pages. Remove them first.');
      return;
    }
    if (!window.confirm('Remove this sub page?')) return;
    const next = pages.map((p) => {
      if (p.id !== pageId) return p;
      const nextSubPages = mapSubPagesAtParentPath(p.sub_pages || [], parentPath, (subPages) => subPages.filter((sp) => sp.id !== subPageId));
      return { ...p, sub_pages: nextSubPages };
    });
    const ok = await persist(next);
    if (ok) toast.success('Sub page removed');
  };

  const openAddSection = (pageId, path = []) => {
    if (!canEdit) return;
    setSectionModal({
      mode: 'add', pageId, path, name: '', description: '', reference_image: '',
      priority: 'medium', due_date: '', assigned_to: currentUser?.user_id || '',
      stages: emptyStages(),
    });
  };
  const openEditSection = (pageId, path, section) => {
    if (!canEdit) return;
    // Pre-fill each stage tab from whichever task (if any) is already
    // tagged to this section under that stage's category, so re-opening
    // Edit shows what was saved instead of starting blank every time.
    const secTasks = tasksForSection(section.id);
    const stageFrom = (cat) => {
      const t = secTasks.find((x) => (x.category || '').toLowerCase() === cat);
      if (!t) return emptyStageTask();
      return {
        task_id: t.task_id, text: t.task_name || '', link: t.work_link || '',
        assigned_to: t.assigned_to || '', due_date: (t.due_date || '').slice(0, 10),
      };
    };
    const designTask = secTasks.find((x) => (x.category || '').toLowerCase() === 'design');
    setSectionModal({
      mode: 'edit', pageId, path, id: section.id, name: section.name,
      description: section.description || '', reference_image: section.reference_image || '',
      priority: section.priority || 'medium', due_date: section.due_date || '',
      assigned_to: section.assigned_to || '',
      stages: {
        content: stageFrom('content'),
        design: {
          ...stageFrom('design'),
          reference_image: designTask?.reference_image || '',
          design_file: designTask?.design_file || '',
          design_file_name: designTask?.design_file_name || '',
        },
        development: stageFrom('development'),
        testing: stageFrom('testing'),
      },
    });
  };
  const closeSectionModal = () => setSectionModal(null);

  const handleSectionImagePaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) continue;
        if (file.size > 5 * 1024 * 1024) {
          toast.error('Image is too large (max 5MB)');
          return;
        }
        const reader = new FileReader();
        reader.onload = () => setSectionModal(m => ({ ...m, reference_image: reader.result }));
        reader.readAsDataURL(file);
        return;
      }
    }
  };

  const updateStage = (key, patch) => setSectionModal((m) => ({
    ...m, stages: { ...m.stages, [key]: { ...m.stages[key], ...patch } },
  }));

  const handleDesignImagePaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) continue;
        if (file.size > 5 * 1024 * 1024) {
          toast.error('Image is too large (max 5MB)');
          return;
        }
        const reader = new FileReader();
        reader.onload = () => updateStage('design', { reference_image: reader.result });
        reader.readAsDataURL(file);
        return;
      }
    }
  };

  const handleDesignFileUpload = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File is too large (max 5MB)');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => updateStage('design', { design_file: reader.result, design_file_name: file.name });
    reader.readAsDataURL(file);
  };

  const saveSectionModal = async () => {
    if (!sectionModal.name.trim()) { toast.error('Section name is required'); return; }
    setSaving(true);
    const trimmed = sectionModal.name.trim();
    // Generated up front (not left to applyToSections) so the same id is
    // available below for tagging this section's stage tasks even in Add mode.
    const sectionId = sectionModal.mode === 'add' ? newSectionId() : sectionModal.id;
    const fields = {
      name: trimmed,
      description: sectionModal.description || '',
      reference_image: sectionModal.reference_image || '',
      priority: sectionModal.priority || 'medium',
      due_date: sectionModal.due_date || '',
      assigned_to: sectionModal.assigned_to || '',
    };
    const applyToSections = (sections) => (
      sectionModal.mode === 'add'
        ? [...sections, { id: sectionId, ...fields }]
        : sections.map((s) => (s.id === sectionModal.id ? { ...s, ...fields } : s))
    );
    const next = pages.map((p) => {
      if (p.id !== sectionModal.pageId) return p;
      if (sectionModal.path.length === 0) {
        return { ...p, sections: applyToSections(p.sections || []) };
      }
      return {
        ...p,
        sub_pages: mapSectionsAtSubPagePath(p.sub_pages || [], sectionModal.path, applyToSections),
      };
    });
    const ok = await persist(next);
    if (!ok) { setSaving(false); return; }

    // One task per workflow-stage tab that has anything filled in —
    // created (or updated, if that stage already had a task from a
    // previous save) tagged to this exact section via page_section_id.
    const pageForModal = pages.find((p) => p.id === sectionModal.pageId);
    const pageName = pageForModal?.page_name || '';
    for (const { key, category } of STAGE_DEFS) {
      const s = sectionModal.stages?.[key];
      if (!s) continue;
      const hasAnything = !!(s.link || s.assigned_to || s.due_date || s.text?.trim() || s.reference_image || s.design_file);
      if (!hasAnything) continue;
      const taskName = key === 'content'
        ? (s.text.trim() || `Content: ${trimmed}`)
        : `${category}: ${trimmed}`;
      const payload = {
        task_name: taskName,
        due_date: s.due_date || null,
        work_link: s.link || '',
        assigned_to: s.assigned_to || null,
        department: 'website',
        project_id: project.project_id,
        project_name: project.name,
        website_page_id: sectionModal.pageId,
        website_page_name: pageName,
        page_section_id: sectionId,
        page_section_name: trimmed,
        category,
        priority: 'medium',
      };
      if (key === 'design') {
        payload.reference_image = s.reference_image || '';
        payload.design_file = s.design_file || '';
        payload.design_file_name = s.design_file_name || '';
      }
      try {
        if (s.task_id) {
          await axios.put(`${API}/api/our-tasks/tasks/${s.task_id}`, payload, { headers });
        } else {
          await axios.post(`${API}/api/our-tasks/tasks`, { ...payload, type: 'general', status: 'pending' }, { headers });
        }
      } catch (e) {
        toast.error(`Failed to save the ${category} task`);
      }
    }
    onTasksChanged?.();

    setSaving(false);
    toast.success(sectionModal.mode === 'add' ? 'Section added' : 'Section updated');
    closeSectionModal();
  };

  const deleteSection = async (pageId, path, sectionId) => {
    if (!canEdit) return;
    if (tasksForSection(sectionId).length > 0) {
      toast.error('Cannot delete: tasks are tagged with this section. Untag them first.');
      return;
    }
    if (!window.confirm('Remove this section?')) return;
    const next = pages.map((p) => {
      if (p.id !== pageId) return p;
      if (path.length === 0) {
        return { ...p, sections: (p.sections || []).filter((s) => s.id !== sectionId) };
      }
      return {
        ...p,
        sub_pages: mapSectionsAtSubPagePath(p.sub_pages || [], path, (sections) => sections.filter((s) => s.id !== sectionId)),
      };
    });
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

  const openEditTask = (task) => {
    setTaskModal({
      taskId: task.task_id,
      pageId: task.website_page_id,
      pageName: task.website_page_name,
      sectionId: task.page_section_id || null,
      sectionName: task.page_section_name || null,
      initialDraft: {
        task_name: task.task_name || '',
        description: task.description || '',
        due_date: task.due_date || '',
        category: task.category || '',
        priority: task.priority || 'medium',
        assigned_to: task.assigned_to || '',
      },
    });
  };

  const deleteTask = async (task) => {
    if (!window.confirm(`Delete "${task.task_name}"? This cannot be undone.`)) return;
    try {
      await axios.delete(`${API}/api/our-tasks/tasks/${task.task_id}`, { headers });
      toast.success('Task deleted');
      onTasksChanged?.();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to delete task');
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

  // Shared between a page's own direct Sections and any sub page's (at any
  // depth) Sections — same list UI, addressed by (pageId, path) so Add/
  // Edit/Delete land in the right array (path [] = section lives directly
  // on the page, not under any sub page).
  const SectionsPanel = ({ pageId, pageName, path, sections }) => (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className={`text-xs font-semibold uppercase tracking-wide ${textSecondary}`}>Sections</p>
        {canEdit && (
          <Button
            type="button"
            size="sm"
            onClick={() => openAddSection(pageId, path)}
            className="bg-[#6366f1] hover:bg-[#4f46e5] text-white h-7 text-xs"
            data-testid={`page-section-add-btn-${path.length ? path[path.length - 1] : pageId}`}
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
                      onClick={() => openAddTask({ pageId, pageName, sectionId: sec.id, sectionName: sec.name })}
                      testId={`page-section-addtask-${sec.id}`}
                    />
                    {canEdit && (
                      <button type="button" onClick={() => openEditSection(pageId, path, sec)} className={`p-1 ${textSecondary} hover:opacity-80`} title="Rename" data-testid={`page-section-edit-${sec.id}`}>
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => deleteSection(pageId, path, sec.id)}
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
                              <th className={`text-right px-3 py-2 text-[10px] font-medium ${textSecondary} uppercase`}>Actions</th>
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
                                <td className="px-3 py-2 text-right">
                                  <div className="inline-flex gap-1">
                                    <button type="button" onClick={() => openEditTask(t)} className={`p-1 ${textSecondary} hover:opacity-80`} title="Edit" data-testid={`page-section-task-edit-${t.task_id}`}>
                                      <Pencil className="h-3.5 w-3.5" />
                                    </button>
                                    <button type="button" onClick={() => deleteTask(t)} className="p-1 text-red-500 hover:text-red-400" title="Delete" data-testid={`page-section-task-delete-${t.task_id}`}>
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
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
    </div>
  );

  // Sub pages nest recursively — a sub page can hold its own sub pages, to
  // unbounded depth — so this component renders itself for each node's
  // sub_pages array. `path` is the chain of ancestor sub-page ids from the
  // page down to (not including) the nodes being rendered here.
  const SubPagesTree = ({ pageId, pageName, path, subPages }) => (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className={`text-xs font-semibold uppercase tracking-wide ${textSecondary}`}>Sub Pages</p>
        {canEdit && (
          <Button
            type="button"
            size="sm"
            onClick={() => openAddSubPage(pageId, path)}
            className="bg-[#6366f1] hover:bg-[#4f46e5] text-white h-7 text-xs"
            data-testid={`page-subpage-add-btn-${path.length ? path[path.length - 1] : pageId}`}
          >
            <Plus className="h-3 w-3 mr-1" /> Add Sub Page
          </Button>
        )}
      </div>
      {subPages.length === 0 ? (
        <p className={`text-xs ${textSecondary}`}>No sub pages yet.</p>
      ) : (
        <div className={`rounded-md border ${borderColor} ${bgCard}`}>
          {subPages.map((sp) => {
            const nodePath = [...path, sp.id];
            const isSpExpanded = expandedSubPageIds.has(sp.id);
            const spSections = sp.sections || [];
            const spSubPages = sp.sub_pages || [];
            const blocked = spSections.length > 0 || spSubPages.length > 0;
            return (
              <div key={sp.id} className={`border-b ${borderColor} last:border-b-0`} data-testid={`page-subpage-row-${sp.id}`}>
                <div className="flex items-center justify-between px-3 py-2">
                  <button
                    type="button"
                    onClick={() => toggleSubPageExpanded(sp.id)}
                    className={`inline-flex items-center gap-1.5 text-sm ${textPrimary} hover:opacity-80`}
                    data-testid={`page-subpage-toggle-${sp.id}`}
                  >
                    {isSpExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                    {sp.name}
                  </button>
                  <div className="flex items-center gap-1">
                    {canEdit && (
                      <button type="button" onClick={() => openEditSubPage(pageId, path, sp)} className={`p-1 ${textSecondary} hover:opacity-80`} title="Rename" data-testid={`page-subpage-edit-${sp.id}`}>
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => deleteSubPage(pageId, path, sp.id)}
                        disabled={blocked}
                        className={`p-1 ${blocked ? 'text-red-500/30 cursor-not-allowed' : 'text-red-500 hover:text-red-400'}`}
                        title={blocked ? 'Cannot delete: this sub page still has sections or sub pages' : 'Delete'}
                        data-testid={`page-subpage-delete-${sp.id}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                {isSpExpanded && (
                  <div className={`pl-6 pr-3 pb-3 space-y-3 ${bgSecondary}`}>
                    <SectionsPanel pageId={pageId} pageName={pageName} path={nodePath} sections={spSections} />
                    <div className={`pt-3 border-t ${borderColor}`}>
                      <SubPagesTree pageId={pageId} pageName={pageName} path={nodePath} subPages={spSubPages} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
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

  // Drag-and-drop row reorder — same pattern as the Projects list's own
  // drag handle: grab the S.No cell's grip, drop on another row, splice the
  // dragged page to that row's position, and persist the whole (now
  // reordered) pages array the same way any other edit here does.
  const [dragPageId, setDragPageId] = useState(null);
  const movePage = (fromId, toId) => {
    if (!canEdit || fromId === toId) return;
    const fromIndex = pages.findIndex((p) => p.id === fromId);
    const toIndex = pages.findIndex((p) => p.id === toId);
    if (fromIndex === -1 || toIndex === -1) return;
    const next = [...pages];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    persist(next);
  };
  const pageDragProps = (pageId) => (!canEdit ? {} : {
    draggable: true,
    onDragStart: (e) => { setDragPageId(pageId); e.dataTransfer.effectAllowed = 'move'; },
    onDragOver: (e) => { if (dragPageId && dragPageId !== pageId) e.preventDefault(); },
    onDrop: (e) => {
      e.preventDefault();
      if (dragPageId && dragPageId !== pageId) movePage(dragPageId, pageId);
      setDragPageId(null);
    },
    onDragEnd: () => setDragPageId(null),
  });

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
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase`}>Sections</th>
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase`}>Tasks</th>
                  <th className={`text-right p-3 text-[11px] font-medium ${textSecondary} uppercase w-24`}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pages.map((row, idx) => {
                  const pageTasks = tasksForPage(row.id);
                  const isExpanded = expandedPageIds.has(row.id);
                  const sections = row.sections || [];
                  const subPages = row.sub_pages || [];
                  const isSectionsExpanded = expandedSectionsPageId === row.id;
                  return (
                  <React.Fragment key={row.id}>
                  <tr className={`border-b ${borderColor}`} data-testid={`page-row-${row.id}`}>
                    <td className={`p-3 text-xs ${textSecondary}`} {...pageDragProps(row.id)}>
                      <div className="flex items-center gap-1.5">
                        {canEdit && <GripVertical className="h-3.5 w-3.5 cursor-grab shrink-0 opacity-50" />}
                        {idx + 1}
                      </div>
                    </td>
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
                      <button
                        type="button"
                        onClick={() => setExpandedSectionsPageId(isSectionsExpanded ? null : row.id)}
                        className={`inline-flex items-center gap-1 text-xs ${textSecondary} hover:opacity-80`}
                        data-testid={`page-sections-count-${row.id}`}
                      >
                        {isSectionsExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                        <Layers className="h-3.5 w-3.5" />
                        {sections.length}
                      </button>
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
                      <td colSpan={9} className="p-3">
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
                                  <th className={`text-right px-3 py-2 text-[10px] font-medium ${textSecondary} uppercase`}>Actions</th>
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
                                    <td className="px-3 py-2 text-right">
                                      <div className="inline-flex gap-1">
                                        <button type="button" onClick={() => openEditTask(t)} className={`p-1 ${textSecondary} hover:opacity-80`} title="Edit" data-testid={`page-task-edit-${t.task_id}`}>
                                          <Pencil className="h-3.5 w-3.5" />
                                        </button>
                                        <button type="button" onClick={() => deleteTask(t)} className="p-1 text-red-500 hover:text-red-400" title="Delete" data-testid={`page-task-delete-${t.task_id}`}>
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                      </div>
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
                      <td colSpan={9} className="p-3 space-y-4">
                        <SectionsPanel pageId={row.id} pageName={row.page_name} path={[]} sections={sections} />
                        <div className={`pt-3 border-t ${borderColor}`}>
                          <SubPagesTree pageId={row.id} pageName={row.page_name} path={[]} subPages={subPages} />
                        </div>
                      </td>
                    </tr>
                  )}
                  </React.Fragment>
                  );
                })}
                {pages.length === 0 && (
                  <tr>
                    <td colSpan={9} className={`p-8 text-center text-xs ${textSecondary}`}>
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
          <div className={`${bgCard} border ${borderColor} rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto`} onClick={(e) => e.stopPropagation()}>
            <div className={`p-5 border-b ${borderColor} flex items-center justify-between`}>
              <h3 className={`text-base font-semibold ${textPrimary} flex items-center gap-2`}>
                <Globe className="h-4 w-4 text-[#6366f1]" />
                {sectionModal.mode === 'add' ? 'Add Section' : 'Edit Section'}
              </h3>
              <button onClick={closeSectionModal} className={textSecondary}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
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
              <div>
                <p className={`text-xs font-medium ${textSecondary} mb-1`}>Description</p>
                <Textarea
                  value={sectionModal.description}
                  onChange={(e) => setSectionModal(m => ({ ...m, description: e.target.value }))}
                  placeholder="Details about this section…"
                  rows={3}
                  className={`${bgSecondary} border ${borderColor} ${textPrimary} resize-none`}
                  data-testid="page-section-form-description"
                />
              </div>
              <div>
                <p className={`text-xs font-medium ${textSecondary} mb-1`}>Reference Image</p>
                {sectionModal.reference_image ? (
                  <div className="relative inline-block">
                    <img
                      src={sectionModal.reference_image}
                      alt="Reference"
                      className={`max-h-40 rounded-md border ${borderColor}`}
                      data-testid="page-section-form-refimage-preview"
                    />
                    <button
                      type="button"
                      onClick={() => setSectionModal(m => ({ ...m, reference_image: '' }))}
                      className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1"
                      data-testid="page-section-form-refimage-remove"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <div
                    onPaste={handleSectionImagePaste}
                    tabIndex={0}
                    className={`flex items-center justify-center h-20 rounded-md border border-dashed ${borderColor} ${bgSecondary} ${textSecondary} text-xs text-center px-3 cursor-text focus:outline-none focus:ring-1 focus:ring-[#6366f1]`}
                    data-testid="page-section-form-refimage-dropzone"
                  >
                    Click here, then paste a screenshot (Ctrl+V / Cmd+V)
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className={`text-xs font-medium ${textSecondary} mb-1`}>Priority</p>
                  <Select
                    value={sectionModal.priority}
                    onValueChange={(v) => setSectionModal(m => ({ ...m, priority: v }))}
                  >
                    <SelectTrigger className={`${bgSecondary} border ${borderColor} ${textPrimary}`} data-testid="page-section-form-priority">
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
                  <p className={`text-xs font-medium ${textSecondary} mb-1`}>Deadline</p>
                  <Input
                    type="date"
                    value={sectionModal.due_date}
                    onChange={(e) => setSectionModal(m => ({ ...m, due_date: e.target.value }))}
                    className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                    data-testid="page-section-form-deadline"
                  />
                </div>
              </div>
              <div>
                <p className={`text-xs font-medium ${textSecondary} mb-1`}>Assign To</p>
                <Select
                  value={sectionModal.assigned_to || '_none'}
                  onValueChange={(v) => setSectionModal(m => ({ ...m, assigned_to: v === '_none' ? '' : v }))}
                >
                  <SelectTrigger className={`${bgSecondary} border ${borderColor} ${textPrimary}`} data-testid="page-section-form-assignee">
                    <SelectValue placeholder="— Select —" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">— Select —</SelectItem>
                    {(projectMembers || []).map(usr => <SelectItem key={usr.user_id} value={usr.user_id}>{usr.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Build-out tracking — one task per workflow stage, tagged
                  to this exact section; filling in a tab and saving creates
                  (or updates) that stage's task. */}
              <div className={`pt-2 border-t ${borderColor}`}>
                <p className={`text-[11px] uppercase tracking-wide ${textSecondary} mb-2`}>
                  {project?.name} › {pages.find(p => p.id === sectionModal.pageId)?.page_name || '—'} › {sectionModal.name || 'New Section'}
                </p>
                <Tabs defaultValue="content">
                  <TabsList className="grid grid-cols-4 w-full">
                    <TabsTrigger value="content" data-testid="page-section-tab-content">Content</TabsTrigger>
                    <TabsTrigger value="design" data-testid="page-section-tab-design">Design</TabsTrigger>
                    <TabsTrigger value="development" data-testid="page-section-tab-development">Development</TabsTrigger>
                    <TabsTrigger value="testing" data-testid="page-section-tab-testing">Testing</TabsTrigger>
                  </TabsList>

                  <TabsContent value="content" className="space-y-3 pt-2">
                    <div>
                      <p className={`text-xs font-medium ${textSecondary} mb-1`}>Content</p>
                      <Textarea
                        ref={contentStageTextRef}
                        value={sectionModal.stages.content.text}
                        onChange={(e) => updateStage('content', { text: e.target.value })}
                        placeholder="Write the copy for this section…"
                        rows={1}
                        className={`${bgSecondary} border ${borderColor} ${textPrimary} min-h-[70px] resize-none overflow-hidden leading-normal`}
                        data-testid="page-section-content-text"
                      />
                    </div>
                    <div>
                      <p className={`text-xs font-medium ${textSecondary} mb-1`}>Content Link</p>
                      <Input
                        value={sectionModal.stages.content.link}
                        onChange={(e) => updateStage('content', { link: e.target.value })}
                        placeholder="https://…"
                        className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                        data-testid="page-section-content-link"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className={`text-xs font-medium ${textSecondary} mb-1`}>Assign To</p>
                        <Select value={sectionModal.stages.content.assigned_to || '_none'} onValueChange={(v) => updateStage('content', { assigned_to: v === '_none' ? '' : v })}>
                          <SelectTrigger className={`${bgSecondary} border ${borderColor} ${textPrimary}`} data-testid="page-section-content-assignee">
                            <SelectValue placeholder="— Select —" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_none">— Select —</SelectItem>
                            {(projectMembers || []).map(usr => <SelectItem key={usr.user_id} value={usr.user_id}>{usr.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <p className={`text-xs font-medium ${textSecondary} mb-1`}>Deadline</p>
                        <Input
                          type="date"
                          value={sectionModal.stages.content.due_date}
                          onChange={(e) => updateStage('content', { due_date: e.target.value })}
                          className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                          data-testid="page-section-content-deadline"
                        />
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="design" className="space-y-3 pt-2">
                    <div>
                      <p className={`text-xs font-medium ${textSecondary} mb-1`}>Design Link</p>
                      <Input
                        value={sectionModal.stages.design.link}
                        onChange={(e) => updateStage('design', { link: e.target.value })}
                        placeholder="https://…"
                        className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                        data-testid="page-section-design-link"
                      />
                    </div>
                    <div>
                      <p className={`text-xs font-medium ${textSecondary} mb-1`}>Screenshot</p>
                      {sectionModal.stages.design.reference_image ? (
                        <div className="relative inline-block">
                          <img
                            src={sectionModal.stages.design.reference_image}
                            alt="Design screenshot"
                            className={`max-h-40 rounded-md border ${borderColor}`}
                            data-testid="page-section-design-screenshot-preview"
                          />
                          <button
                            type="button"
                            onClick={() => updateStage('design', { reference_image: '' })}
                            className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1"
                            data-testid="page-section-design-screenshot-remove"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ) : (
                        <div
                          onPaste={handleDesignImagePaste}
                          tabIndex={0}
                          className={`flex items-center justify-center h-20 rounded-md border border-dashed ${borderColor} ${bgSecondary} ${textSecondary} text-xs text-center px-3 cursor-text focus:outline-none focus:ring-1 focus:ring-[#6366f1]`}
                          data-testid="page-section-design-screenshot-dropzone"
                        >
                          Click here, then paste a screenshot (Ctrl+V / Cmd+V)
                        </div>
                      )}
                    </div>
                    <div>
                      <p className={`text-xs font-medium ${textSecondary} mb-1`}>Design File</p>
                      {sectionModal.stages.design.design_file ? (
                        <div className={`flex items-center justify-between gap-2 p-2 rounded-md border ${borderColor} ${bgSecondary}`}>
                          <span className={`inline-flex items-center gap-1.5 text-xs ${textPrimary} truncate`}>
                            <FileText className="h-3.5 w-3.5 shrink-0" /> {sectionModal.stages.design.design_file_name || 'Uploaded file'}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateStage('design', { design_file: '', design_file_name: '' })}
                            className="text-red-500 hover:text-red-400 shrink-0"
                            data-testid="page-section-design-file-remove"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <label
                          className={`flex items-center justify-center gap-1.5 h-11 rounded-md border border-dashed ${borderColor} ${bgSecondary} ${textSecondary} text-xs cursor-pointer hover:opacity-80`}
                          data-testid="page-section-design-file-dropzone"
                        >
                          <Upload className="h-3.5 w-3.5" /> Upload a design file
                          <input type="file" className="hidden" onChange={handleDesignFileUpload} />
                        </label>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className={`text-xs font-medium ${textSecondary} mb-1`}>Assign To</p>
                        <Select value={sectionModal.stages.design.assigned_to || '_none'} onValueChange={(v) => updateStage('design', { assigned_to: v === '_none' ? '' : v })}>
                          <SelectTrigger className={`${bgSecondary} border ${borderColor} ${textPrimary}`} data-testid="page-section-design-assignee">
                            <SelectValue placeholder="— Select —" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_none">— Select —</SelectItem>
                            {(projectMembers || []).map(usr => <SelectItem key={usr.user_id} value={usr.user_id}>{usr.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <p className={`text-xs font-medium ${textSecondary} mb-1`}>Deadline</p>
                        <Input
                          type="date"
                          value={sectionModal.stages.design.due_date}
                          onChange={(e) => updateStage('design', { due_date: e.target.value })}
                          className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                          data-testid="page-section-design-deadline"
                        />
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="development" className="space-y-3 pt-2">
                    <div>
                      <p className={`text-xs font-medium ${textSecondary} mb-1`}>Page Link</p>
                      <Input
                        value={sectionModal.stages.development.link}
                        onChange={(e) => updateStage('development', { link: e.target.value })}
                        placeholder="https://…"
                        className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                        data-testid="page-section-development-link"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className={`text-xs font-medium ${textSecondary} mb-1`}>Assign To</p>
                        <Select value={sectionModal.stages.development.assigned_to || '_none'} onValueChange={(v) => updateStage('development', { assigned_to: v === '_none' ? '' : v })}>
                          <SelectTrigger className={`${bgSecondary} border ${borderColor} ${textPrimary}`} data-testid="page-section-development-assignee">
                            <SelectValue placeholder="— Select —" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_none">— Select —</SelectItem>
                            {(projectMembers || []).map(usr => <SelectItem key={usr.user_id} value={usr.user_id}>{usr.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <p className={`text-xs font-medium ${textSecondary} mb-1`}>Deadline</p>
                        <Input
                          type="date"
                          value={sectionModal.stages.development.due_date}
                          onChange={(e) => updateStage('development', { due_date: e.target.value })}
                          className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                          data-testid="page-section-development-deadline"
                        />
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="testing" className="space-y-3 pt-2">
                    <div>
                      <p className={`text-xs font-medium ${textSecondary} mb-1`}>Link</p>
                      <Input
                        value={sectionModal.stages.testing.link}
                        onChange={(e) => updateStage('testing', { link: e.target.value })}
                        placeholder="https://…"
                        className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                        data-testid="page-section-testing-link"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className={`text-xs font-medium ${textSecondary} mb-1`}>Assign To</p>
                        <Select value={sectionModal.stages.testing.assigned_to || '_none'} onValueChange={(v) => updateStage('testing', { assigned_to: v === '_none' ? '' : v })}>
                          <SelectTrigger className={`${bgSecondary} border ${borderColor} ${textPrimary}`} data-testid="page-section-testing-assignee">
                            <SelectValue placeholder="— Select —" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_none">— Select —</SelectItem>
                            {(projectMembers || []).map(usr => <SelectItem key={usr.user_id} value={usr.user_id}>{usr.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <p className={`text-xs font-medium ${textSecondary} mb-1`}>Deadline</p>
                        <Input
                          type="date"
                          value={sectionModal.stages.testing.due_date}
                          onChange={(e) => updateStage('testing', { due_date: e.target.value })}
                          className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                          data-testid="page-section-testing-deadline"
                        />
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
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

      {/* Add / Rename Sub Page popup — z-40 like the sibling popups above. */}
      {subPageModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-40 p-4" onClick={closeSubPageModal}>
          <div className={`${bgCard} border ${borderColor} rounded-xl w-full max-w-sm`} onClick={(e) => e.stopPropagation()}>
            <div className={`p-5 border-b ${borderColor} flex items-center justify-between`}>
              <h3 className={`text-base font-semibold ${textPrimary} flex items-center gap-2`}>
                <Globe className="h-4 w-4 text-[#6366f1]" />
                {subPageModal.mode === 'add' ? 'Add Sub Page' : 'Rename Sub Page'}
              </h3>
              <button onClick={closeSubPageModal} className={textSecondary}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5">
              <p className={`text-xs font-medium ${textSecondary} mb-1`}>Sub Page Name</p>
              <Input
                value={subPageModal.name}
                onChange={(e) => setSubPageModal(m => ({ ...m, name: e.target.value }))}
                placeholder="e.g. Pricing"
                className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                data-testid="page-subpage-form-name"
                autoFocus
              />
            </div>
            <div className={`p-5 border-t ${borderColor} flex items-center justify-end gap-2`}>
              <Button type="button" variant="outline" onClick={closeSubPageModal}>Cancel</Button>
              <Button
                type="button"
                onClick={saveSubPageModal}
                disabled={saving}
                className="bg-[#6366f1] hover:bg-[#4f46e5] text-white"
                data-testid="page-subpage-form-save"
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
          taskId={taskModal.taskId}
          initialDraft={taskModal.initialDraft}
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
