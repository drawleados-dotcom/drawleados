import React, { useState, useMemo } from 'react';
import { Plus, ChevronLeft, ChevronRight, Calendar, ExternalLink, Pencil, Trash2 } from 'lucide-react';
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

  const isCurrentMonth = activeMonth === now.getMonth() && activeYear === now.getFullYear();
  const yearOptions = useMemo(() => {
    const years = [];
    for (let y = now.getFullYear() - 2; y <= now.getFullYear() + 2; y++) years.push(y);
    return years;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pillBox = isDark ? 'bg-[#18181b] border-[#27272a]' : 'bg-white border-gray-200';
  const activeCls = isDark ? 'bg-[#27272a] text-white' : 'bg-gray-100 text-gray-900';
  const idleCls = isDark ? 'text-[#a1a1aa] hover:text-white' : 'text-gray-500 hover:text-gray-900';

  const goPrevMonth = () => {
    if (activeMonth === 0) { setActiveMonth(11); setActiveYear((y) => y - 1); }
    else setActiveMonth((m) => m - 1);
  };
  const goNextMonth = () => {
    if (activeMonth === 11) { setActiveMonth(0); setActiveYear((y) => y + 1); }
    else setActiveMonth((m) => m + 1);
  };

  const monthTasks = useMemo(() => {
    return (tasks || []).filter((t) => {
      if (!t.due_date) return false;
      const d = new Date(t.due_date);
      return d.getMonth() === activeMonth && d.getFullYear() === activeYear;
    });
  }, [tasks, activeMonth, activeYear]);

  // Per-category task counts for the month being viewed (drives the number
  // badge on each category sub-tab, same as Content Calendar's platforms).
  const categoryCounts = useMemo(() => CATEGORY_TABS.reduce((acc, c) => {
    acc[c] = c === 'All' ? monthTasks.length : monthTasks.filter((t) => (t.category || '') === c).length;
    return acc;
  }, {}), [monthTasks]);

  const visibleTasks = activeCategory === 'All'
    ? monthTasks
    : monthTasks.filter((t) => (t.category || '') === activeCategory);

  const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString() : '—');

  return (
    <div className="space-y-4" data-testid="seo-scope-tab">
      {/* Month navigator */}
      <div className={`${bgCard} border ${borderColor} rounded-2xl p-4`}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={goPrevMonth} data-testid="seo-scope-month-prev">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-center min-w-[160px]">
              <p className={`text-2xl font-bold ${textPrimary}`}>{MONTH_NAMES[activeMonth]} {activeYear}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={goNextMonth} data-testid="seo-scope-month-next">
              <ChevronRight className="h-4 w-4" />
            </Button>
            {isCurrentMonth && (
              <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30 ml-2">
                <Calendar className="h-3 w-3 mr-1" /> This Month
              </Badge>
            )}
          </div>
          <select
            className={`text-sm rounded-lg border ${borderColor} ${bgSecondary} ${textPrimary} px-3 py-2`}
            value={activeYear}
            onChange={(e) => setActiveYear(Number(e.target.value))}
            data-testid="seo-scope-year-select"
          >
            {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Category sub-tabs */}
      <div className={`inline-flex flex-wrap items-center gap-1 p-1 rounded-lg border ${pillBox}`}>
        {CATEGORY_TABS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setActiveCategory(c)}
            data-testid={`seo-scope-category-${c.toLowerCase().replace(/\s+/g, '-')}`}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${activeCategory === c ? activeCls : idleCls}`}
          >
            {c} ({categoryCounts[c] || 0})
          </button>
        ))}
      </div>

      {/* Action row */}
      <div className="flex items-center justify-between">
        <p className={`text-sm ${textSecondary}`}>
          {visibleTasks.length === 0 ? 'No tasks yet.' : `${visibleTasks.length} task${visibleTasks.length === 1 ? '' : 's'}`}
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
  );
}
