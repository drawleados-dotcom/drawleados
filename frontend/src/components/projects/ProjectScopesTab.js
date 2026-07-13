import React, { useState, useMemo } from 'react';
import { Plus, ChevronLeft, ChevronRight, Calendar, ExternalLink, Pencil, Trash2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function ProjectScopesTab({
  tasks, users, canManageProjects, onAddTask, onEditTask, onDeleteTask,
  isDark, bgCard, bgSecondary, textPrimary, textSecondary, borderColor,
}) {
  const now = new Date();
  const [activeMonth, setActiveMonth] = useState(now.getMonth());
  const [activeYear, setActiveYear] = useState(now.getFullYear());

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

  const goPrev = () => {
    if (activeMonth === 0) { setActiveMonth(11); setActiveYear((y) => y - 1); }
    else setActiveMonth((m) => m - 1);
  };
  const goNext = () => {
    if (activeMonth === 11) { setActiveMonth(0); setActiveYear((y) => y + 1); }
    else setActiveMonth((m) => m + 1);
  };
  const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString() : '—');

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
              <Button onClick={onAddTask} className="bg-[#6366f1] hover:bg-[#4f46e5] text-white" data-testid="scopes-add-task">
                <Plus className="h-4 w-4 mr-1" /> Add Task
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {monthTasks.length === 0 ? (
          <p className={`text-sm ${textSecondary}`}>
            No tasks scoped for {MONTH_NAMES[activeMonth]} {activeYear}. Click "Add Task" to create one.
          </p>
        ) : (
          monthTasks.map((task) => {
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
    </div>
  );
}
