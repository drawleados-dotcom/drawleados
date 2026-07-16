import React, { useState, useMemo } from 'react';
import { Plus, ChevronLeft, ChevronRight, ExternalLink, Pencil, Trash2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// Sub-tabs shown inside Scope — deliberately just these 4, distinct from
// the project's full Category list (which stays available everywhere else).
const CATEGORY_TABS = ['All', 'Research', 'On Page SEO', 'Off Page SEO'];

export default function ProjectSeoScopeTab({
  tasks, users, canManageProjects, onAddTask, onEditTask, onDeleteTask,
  isDark, bgCard, bgSecondary, textPrimary, textSecondary, borderColor,
}) {
  const now = new Date();
  const [activeMonth, setActiveMonth] = useState(now.getMonth());
  const [activeYear, setActiveYear] = useState(now.getFullYear());
  const [activeCategory, setActiveCategory] = useState('All');

  const pillBox = isDark ? 'bg-[#18181b] border-[#27272a]' : 'bg-white border-gray-200';
  const activeCls = 'bg-[#6366f1] text-white';
  const idleCls = isDark ? 'text-[#a1a1aa] hover:text-white' : 'text-gray-500 hover:text-gray-900';

  const monthTasks = useMemo(() => {
    return (tasks || []).filter((t) => {
      if (!t.due_date) return false;
      const d = new Date(t.due_date);
      return d.getMonth() === activeMonth && d.getFullYear() === activeYear;
    });
  }, [tasks, activeMonth, activeYear]);

  const visibleTasks = activeCategory === 'All'
    ? monthTasks
    : monthTasks.filter((t) => (t.category || '') === activeCategory);

  const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString() : '—');

  return (
    <div className="flex flex-col md:flex-row gap-4" data-testid="seo-scope-tab">
      {/* Monthly filter — sidebar */}
      <div className="w-full md:w-52 flex-shrink-0">
        <div className={`${bgCard} border ${borderColor} rounded-2xl p-3`}>
          <div className="flex items-center justify-between mb-3">
            <button type="button" onClick={() => setActiveYear((y) => y - 1)} data-testid="seo-scope-year-prev" className={textSecondary}>
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className={`font-semibold ${textPrimary}`}>{activeYear}</span>
            <button type="button" onClick={() => setActiveYear((y) => y + 1)} data-testid="seo-scope-year-next" className={textSecondary}>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible">
            {MONTH_NAMES.map((m, idx) => (
              <button
                key={m}
                type="button"
                onClick={() => setActiveMonth(idx)}
                className={`text-left px-3 py-2 rounded-lg text-sm whitespace-nowrap transition-colors ${activeMonth === idx ? activeCls : idleCls}`}
                data-testid={`seo-scope-month-${idx}`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 space-y-3 min-w-0">
        <div className={`inline-flex flex-wrap items-center gap-1 p-1 rounded-lg border ${pillBox}`}>
          {CATEGORY_TABS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setActiveCategory(c)}
              data-testid={`seo-scope-category-${c.toLowerCase().replace(/\s+/g, '-')}`}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${activeCategory === c ? activeCls : idleCls}`}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <p className={`text-sm ${textSecondary}`}>
            {MONTH_NAMES[activeMonth]} {activeYear} · {visibleTasks.length} task{visibleTasks.length === 1 ? '' : 's'}
          </p>
          {canManageProjects && (
            <Button
              onClick={() => onAddTask(activeCategory === 'All' ? '' : activeCategory)}
              className="bg-[#6366f1] hover:bg-[#4f46e5] text-white"
              data-testid="seo-scope-add-task"
            >
              <Plus className="h-4 w-4 mr-1" /> Add Task
            </Button>
          )}
        </div>

        <div className="space-y-2">
          {visibleTasks.length === 0 ? (
            <p className={`text-sm ${textSecondary}`}>
              No tasks for {MONTH_NAMES[activeMonth]} {activeYear}{activeCategory !== 'All' ? ` in ${activeCategory}` : ''}. Click "Add Task" to create one.
            </p>
          ) : (
            visibleTasks.map((task) => {
              const user = (users || []).find((u) => u.user_id === task.assigned_to);
              return (
                <Card key={task.task_id} className={`${bgCard} border ${borderColor}`} data-testid={`seo-scope-task-${task.task_id}`}>
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
                        <a href={task.work_link} target="_blank" rel="noopener noreferrer" className="text-[#6366f1] text-sm hover:underline flex items-center gap-1 px-2" data-testid={`seo-scope-task-link-${task.task_id}`}>
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
                            data-testid={`seo-scope-task-edit-${task.task_id}`}
                            title="Edit task"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onDeleteTask(task.task_id)}
                            className="h-8 w-8 p-0 text-[#ef4444] hover:bg-[#ef4444]/10"
                            data-testid={`seo-scope-task-delete-${task.task_id}`}
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
      </div>
    </div>
  );
}
