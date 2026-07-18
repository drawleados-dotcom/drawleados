import React, { useState, useMemo } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Plus, ChevronLeft, ChevronRight, Calendar, ExternalLink, Pencil, Trash2, X } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

const API = process.env.REACT_APP_BACKEND_URL;

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// Pill bar + Task Type options — "Report" is a selectable Task Type but not
// its own pill (Report tasks already surface via the Campaigns/Reports tabs).
const CATEGORY_TABS = ['Creatives', 'Strategy', 'Optmization', 'Campaign Creation', 'Payment Billing'];
const TASK_TYPES = [...CATEGORY_TABS, 'Report'];

const todayIso = () => new Date().toISOString().slice(0, 10);

const emptyTaskForm = (defaultType) => ({
  task_name: '',
  task_type: defaultType,
  creative_format: 'static',
  content_assignee: '',
  designer_assignee: '',
  video_editor_assignee: '',
  assignee: '',
  report_frequency: 'daily',
  report_date: todayIso(),
  due_date: '',
});

export default function ProjectScopesTab({
  project, tasks, users, canManageProjects, onEditTask, onDeleteTask, onTasksChanged,
  isDark, bgCard, bgSecondary, textPrimary, textSecondary, borderColor,
}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('session_token') : null;
  const headers = { Authorization: `Bearer ${token}` };

  const now = new Date();
  const [activeMonth, setActiveMonth] = useState(now.getMonth());
  const [activeYear, setActiveYear] = useState(now.getFullYear());
  const [activeCatTab, setActiveCatTab] = useState('all');

  const isCurrentMonth = activeMonth === now.getMonth() && activeYear === now.getFullYear();

  const yearOptions = useMemo(() => {
    const years = [];
    for (let y = now.getFullYear() - 2; y <= now.getFullYear() + 2; y++) years.push(y);
    return years;
  }, [now]);

  const monthTasks = useMemo(() => {
    return (tasks || []).filter((t) => {
      if (!t.due_date) return false;
      const d = new Date(t.due_date);
      return d.getMonth() === activeMonth && d.getFullYear() === activeYear;
    });
  }, [tasks, activeMonth, activeYear]);

  const visibleTasks = useMemo(() => {
    if (activeCatTab === 'all') return monthTasks;
    return monthTasks.filter((t) => t.category === activeCatTab);
  }, [monthTasks, activeCatTab]);

  const countFor = (cat) => monthTasks.filter((t) => t.category === cat).length;

  const goPrev = () => {
    if (activeMonth === 0) { setActiveMonth(11); setActiveYear((y) => y - 1); }
    else setActiveMonth((m) => m - 1);
  };
  const goNext = () => {
    if (activeMonth === 11) { setActiveMonth(0); setActiveYear((y) => y + 1); }
    else setActiveMonth((m) => m + 1);
  };
  const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString() : '—');

  // ---- Add Task modal (bespoke to Meta Ads Scopes) ----
  const [showAddTask, setShowAddTask] = useState(false);
  const [taskForm, setTaskForm] = useState(emptyTaskForm('Creatives'));
  const [saving, setSaving] = useState(false);

  const openAddTask = () => {
    const defaultType = CATEGORY_TABS.includes(activeCatTab) ? activeCatTab : 'Creatives';
    setTaskForm(emptyTaskForm(defaultType));
    setShowAddTask(true);
  };
  const closeAddTask = () => { setShowAddTask(false); setSaving(false); };

  const createOneTask = async (payload) => {
    await axios.post(`${API}/api/projects/${project.project_id}/tasks`, payload, { headers });
  };

  const saveAddTask = async () => {
    if (!taskForm.task_name.trim()) { toast.error('Task name is required'); return; }
    const baseName = taskForm.task_name.trim();

    try {
      setSaving(true);

      if (taskForm.task_type === 'Creatives') {
        if (taskForm.creative_format === 'static') {
          if (!taskForm.content_assignee) { toast.error('Please choose a Content assignee'); return; }
          if (!taskForm.designer_assignee) { toast.error('Please choose a Designer assignee'); return; }
          if (!taskForm.due_date) { toast.error('Please choose a deadline'); return; }
          await createOneTask({
            task_name: `${baseName} (Content)`, description: 'Creative type: Static',
            assigned_to: taskForm.content_assignee, due_date: taskForm.due_date,
            department: 'meta', category: 'Creatives',
          });
          await createOneTask({
            task_name: `${baseName} (Design)`, description: 'Creative type: Static',
            assigned_to: taskForm.designer_assignee, due_date: taskForm.due_date,
            department: 'meta', category: 'Creatives',
          });
          toast.success('2 tasks created — appear in each assignee\'s My Tasks');
        } else {
          if (!taskForm.video_editor_assignee) { toast.error('Please choose a Video Editor assignee'); return; }
          if (!taskForm.due_date) { toast.error('Please choose a deadline'); return; }
          await createOneTask({
            task_name: `${baseName} (Reel)`, description: 'Creative type: Reel',
            assigned_to: taskForm.video_editor_assignee, due_date: taskForm.due_date,
            department: 'meta', category: 'Creatives',
          });
          toast.success('Task created — appears in assignee\'s My Tasks');
        }
      } else if (taskForm.task_type === 'Report') {
        if (!taskForm.assignee) { toast.error('Please choose an assignee'); return; }
        const dueDate = taskForm.report_frequency === 'daily' ? todayIso() : taskForm.report_date;
        if (!dueDate) { toast.error('Please choose a report date'); return; }
        await createOneTask({
          task_name: baseName, description: taskForm.report_frequency === 'daily' ? 'Report frequency: Daily' : 'Report frequency: Date',
          assigned_to: taskForm.assignee, due_date: dueDate,
          department: 'meta', category: 'Report',
        });
        toast.success('Task created — appears in assignee\'s My Tasks');
      } else {
        // Strategy | Optmization | Campaign Creation | Payment Billing
        if (!taskForm.assignee) { toast.error('Please choose an assignee'); return; }
        if (!taskForm.due_date) { toast.error('Please choose a deadline'); return; }
        await createOneTask({
          task_name: baseName, assigned_to: taskForm.assignee, due_date: taskForm.due_date,
          department: 'meta', category: taskForm.task_type,
        });
        toast.success('Task created — appears in assignee\'s My Tasks');
      }

      closeAddTask();
      onTasksChanged?.();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to create task');
    } finally {
      setSaving(false);
    }
  };

  const selectCls = `w-full px-3 py-2 rounded-lg border ${borderColor} ${bgSecondary} ${textPrimary}`;
  const pillBox = isDark ? 'bg-[#18181b] border-[#27272a]' : 'bg-white border-gray-200';
  const activeCls = isDark ? 'bg-[#27272a] text-white' : 'bg-gray-100 text-gray-900';
  const idleCls = isDark ? 'text-[#a1a1aa] hover:text-white' : 'text-gray-500 hover:text-gray-900';

  return (
    <div className="space-y-4" data-testid="scopes-tab">
      <div className={`${bgCard} border ${borderColor} rounded-2xl p-4`}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={goPrev} data-testid="scopes-prev">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-center min-w-[160px]">
              <p className={`text-2xl font-bold ${textPrimary}`}>{MONTH_NAMES[activeMonth]} {activeYear}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={goNext} data-testid="scopes-next">
              <ChevronRight className="h-4 w-4" />
            </Button>
            {isCurrentMonth && (
              <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30 ml-2">
                <Calendar className="h-3 w-3 mr-1" /> This Month
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <select
              className={`text-sm rounded-lg border ${borderColor} ${bgSecondary} ${textPrimary} px-3 py-2`}
              value={activeYear}
              onChange={(e) => setActiveYear(Number(e.target.value))}
              data-testid="scopes-year-select"
            >
              {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            {canManageProjects && (
              <Button onClick={openAddTask} className="bg-[#6366f1] hover:bg-[#4f46e5] text-white" data-testid="scopes-add-task">
                <Plus className="h-4 w-4 mr-1" /> Add Task
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Category pill bar: All | Creatives | Strategy | Optmization | Campaign Creation | Payment Billing */}
      <div className={`inline-flex flex-wrap items-center gap-1 p-1 rounded-lg border ${pillBox}`} data-testid="scopes-category-tabs">
        <button
          type="button"
          onClick={() => setActiveCatTab('all')}
          data-testid="scopes-cat-tab-all"
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${activeCatTab === 'all' ? activeCls : idleCls}`}
        >
          All ({monthTasks.length})
        </button>
        {CATEGORY_TABS.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setActiveCatTab(cat)}
            data-testid={`scopes-cat-tab-${cat.toLowerCase().replace(/\s+/g, '-')}`}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${activeCatTab === cat ? activeCls : idleCls}`}
          >
            {cat} ({countFor(cat)})
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {visibleTasks.length === 0 ? (
          <p className={`text-sm ${textSecondary}`}>
            No tasks scoped for {MONTH_NAMES[activeMonth]} {activeYear}
            {activeCatTab !== 'all' ? ` in ${activeCatTab}` : ''}. Click "Add Task" to create one.
          </p>
        ) : (
          visibleTasks.map((task) => {
            const user = (users || []).find((u) => u.user_id === task.assigned_to);
            return (
              <Card key={task.task_id} className={`${bgCard} border ${borderColor}`} data-testid={`scopes-task-${task.task_id}`}>
                <CardContent className="p-4 flex items-center justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`font-medium ${textPrimary}`}>{task.task_name}</span>
                      <Badge className={
                        task.status === 'completed' ? 'bg-[#10b981]/20 text-[#10b981]' :
                        task.status === 'in_progress' ? 'bg-[#3b82f6]/20 text-[#3b82f6]' :
                        'bg-[#71717a]/20 text-[#71717a]'
                      }>{task.status?.replace('_', ' ') || 'pending'}</Badge>
                      {task.category && (
                        <Badge className="bg-[#6366f1]/20 text-[#6366f1] text-xs">{task.category}</Badge>
                      )}
                    </div>
                    <p className={`text-xs ${textSecondary} mt-1`}>
                      Assigned to <span className={textPrimary}>{user?.name || task.assigned_to}</span>
                      {task.due_date && <> · Due {fmtDate(task.due_date)}</>}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {task.work_link && (
                      <a href={task.work_link} target="_blank" rel="noopener noreferrer" className="text-[#6366f1] text-sm hover:underline flex items-center gap-1 px-2" data-testid={`scopes-task-link-${task.task_id}`}>
                        <ExternalLink className="h-3 w-3" /> Link
                      </a>
                    )}
                    {canManageProjects && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onEditTask(task)}
                          className="h-8 w-8 p-0 text-[#3b82f6] hover:bg-[#3b82f6]/10"
                          data-testid={`scopes-task-edit-${task.task_id}`}
                          title="Edit task"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onDeleteTask(task.task_id)}
                          className="h-8 w-8 p-0 text-[#ef4444] hover:bg-[#ef4444]/10"
                          data-testid={`scopes-task-delete-${task.task_id}`}
                          title="Delete task"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Add Task modal — Task Type drives which assignee fields appear */}
      {showAddTask && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[70] p-4" onClick={closeAddTask}>
          <Card className={`${bgCard} border ${borderColor} w-full max-w-lg mx-4`} onClick={(e) => e.stopPropagation()}>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className={`text-lg font-semibold ${textPrimary}`}>Add Task — Meta Ads</h3>
                <button onClick={closeAddTask} className={textSecondary}><X className="h-5 w-5" /></button>
              </div>

              <div>
                <Label className={textPrimary}>Task Name *</Label>
                <Input
                  value={taskForm.task_name}
                  onChange={(e) => setTaskForm(f => ({ ...f, task_name: e.target.value }))}
                  placeholder="Task name"
                  data-testid="scopes-task-form-name"
                />
              </div>

              <div>
                <Label className={textPrimary}>Task Type *</Label>
                <select
                  value={taskForm.task_type}
                  onChange={(e) => setTaskForm(f => ({ ...f, task_type: e.target.value }))}
                  className={selectCls}
                  data-testid="scopes-task-form-type"
                >
                  {TASK_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              {taskForm.task_type === 'Creatives' && (
                <div className={`border ${borderColor} rounded-lg p-3 space-y-3`}>
                  <div>
                    <Label className={textPrimary}>Content Format *</Label>
                    <select
                      value={taskForm.creative_format}
                      onChange={(e) => setTaskForm(f => ({ ...f, creative_format: e.target.value }))}
                      className={selectCls}
                      data-testid="scopes-task-form-creative-format"
                    >
                      <option value="static">Static</option>
                      <option value="reel">Reel</option>
                    </select>
                  </div>
                  {taskForm.creative_format === 'static' ? (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className={textPrimary}>Content Assignee *</Label>
                        <select
                          value={taskForm.content_assignee}
                          onChange={(e) => setTaskForm(f => ({ ...f, content_assignee: e.target.value }))}
                          className={selectCls}
                          data-testid="scopes-task-form-content-assignee"
                        >
                          <option value="">— Select user —</option>
                          {(users || []).map(u => <option key={u.user_id} value={u.user_id}>{u.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <Label className={textPrimary}>Designer Assignee *</Label>
                        <select
                          value={taskForm.designer_assignee}
                          onChange={(e) => setTaskForm(f => ({ ...f, designer_assignee: e.target.value }))}
                          className={selectCls}
                          data-testid="scopes-task-form-designer-assignee"
                        >
                          <option value="">— Select user —</option>
                          {(users || []).map(u => <option key={u.user_id} value={u.user_id}>{u.name}</option>)}
                        </select>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <Label className={textPrimary}>Video Editor Assignee *</Label>
                      <select
                        value={taskForm.video_editor_assignee}
                        onChange={(e) => setTaskForm(f => ({ ...f, video_editor_assignee: e.target.value }))}
                        className={selectCls}
                        data-testid="scopes-task-form-video-editor-assignee"
                      >
                        <option value="">— Select user —</option>
                        {(users || []).map(u => <option key={u.user_id} value={u.user_id}>{u.name}</option>)}
                      </select>
                    </div>
                  )}
                </div>
              )}

              {['Strategy', 'Optmization', 'Campaign Creation', 'Payment Billing'].includes(taskForm.task_type) && (
                <div>
                  <Label className={textPrimary}>Assignee *</Label>
                  <select
                    value={taskForm.assignee}
                    onChange={(e) => setTaskForm(f => ({ ...f, assignee: e.target.value }))}
                    className={selectCls}
                    data-testid="scopes-task-form-assignee"
                  >
                    <option value="">— Select user —</option>
                    {(users || []).map(u => <option key={u.user_id} value={u.user_id}>{u.name}</option>)}
                  </select>
                </div>
              )}

              {taskForm.task_type === 'Report' && (
                <div className={`border ${borderColor} rounded-lg p-3 space-y-3`}>
                  <div>
                    <Label className={textPrimary}>Report Frequency *</Label>
                    <select
                      value={taskForm.report_frequency}
                      onChange={(e) => setTaskForm(f => ({ ...f, report_frequency: e.target.value }))}
                      className={selectCls}
                      data-testid="scopes-task-form-report-frequency"
                    >
                      <option value="daily">Daily (due today)</option>
                      <option value="date">Specific Date</option>
                    </select>
                  </div>
                  {taskForm.report_frequency === 'date' && (
                    <div>
                      <Label className={textPrimary}>Report Date *</Label>
                      <Input
                        type="date"
                        value={taskForm.report_date}
                        onChange={(e) => setTaskForm(f => ({ ...f, report_date: e.target.value }))}
                        data-testid="scopes-task-form-report-date"
                      />
                    </div>
                  )}
                  <div>
                    <Label className={textPrimary}>Assignee *</Label>
                    <select
                      value={taskForm.assignee}
                      onChange={(e) => setTaskForm(f => ({ ...f, assignee: e.target.value }))}
                      className={selectCls}
                      data-testid="scopes-task-form-report-assignee"
                    >
                      <option value="">— Select user —</option>
                      {(users || []).map(u => <option key={u.user_id} value={u.user_id}>{u.name}</option>)}
                    </select>
                  </div>
                </div>
              )}

              {taskForm.task_type !== 'Report' && (
                <div>
                  <Label className={textPrimary}>Deadline *</Label>
                  <Input
                    type="date"
                    value={taskForm.due_date}
                    onChange={(e) => setTaskForm(f => ({ ...f, due_date: e.target.value }))}
                    data-testid="scopes-task-form-due-date"
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={closeAddTask}>Cancel</Button>
                <Button
                  type="button"
                  onClick={saveAddTask}
                  disabled={saving}
                  className="bg-[#10b981] hover:bg-[#059669] text-white"
                  data-testid="scopes-task-form-save"
                >
                  {saving ? 'Saving…' : 'Save'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
