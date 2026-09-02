import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Plug, Plus, Pencil, Trash2 } from 'lucide-react';
import IntegrationTaskModal from './IntegrationTaskModal';

const API = process.env.REACT_APP_BACKEND_URL;

const TASK_STATUS_STYLE = {
  completed: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
  pending: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
  in_progress: 'bg-red-500/20 text-red-400 border-red-500/40',
};
const taskStatusStyle = (status) => TASK_STATUS_STYLE[status || 'pending'] || 'bg-slate-500/20 text-slate-300 border-slate-500/40';

/**
 * Flat task list for a project's third-party integration work (Stripe,
 * webhooks, API keys, etc.) — no Page/Section nesting like the website
 * Pages tab, just tasks tagged department: 'integration' with a To Do /
 * In Progress / Done summary, matching the status vocabulary used
 * everywhere else (see OurTasksPage.js).
 */
export default function ProjectIntegrationsTab({
  project,
  onTasksChanged,
  currentUser,
  users,
  projectMembers = [],
  bgCard,
  bgSecondary,
  textPrimary,
  textSecondary,
  borderColor,
}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('session_token') : null;
  const headers = { Authorization: `Bearer ${token}` };

  const userName = (userId) => (users || []).find(u => u.user_id === userId)?.name || userId || '—';
  const tasks = (project?.tasks || []).filter(t => t.department === 'integration');

  const [statusFilter, setStatusFilter] = useState(null); // null | 'pending' | 'in_progress' | 'completed'
  const summary = {
    todo: tasks.filter(t => (t.status || 'pending') === 'pending').length,
    inProgress: tasks.filter(t => t.status === 'in_progress').length,
    done: tasks.filter(t => t.status === 'completed').length,
  };
  const filteredTasks = statusFilter ? tasks.filter(t => (t.status || 'pending') === statusFilter) : tasks;

  const [taskModal, setTaskModal] = useState(null);
  const openAddTask = () => setTaskModal({});
  const openEditTask = (task) => {
    setTaskModal({
      taskId: task.task_id,
      initialDraft: {
        task_name: task.task_name || '',
        description: task.description || '',
        due_date: task.due_date || '',
        priority: task.priority || 'medium',
        assigned_to: task.assigned_to || '',
      },
    });
  };
  const closeTaskModal = () => setTaskModal(null);

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

  return (
    <div className="space-y-3" data-testid="project-integrations-tab">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className={`text-lg font-semibold ${textPrimary} flex items-center gap-2`}>
            <Plug className="h-5 w-5 text-[#6366f1]" /> Integrations
          </h3>
          <p className={`text-xs ${textSecondary}`}>
            Track third-party integration work for this project.
          </p>
        </div>
        <Button
          type="button"
          onClick={openAddTask}
          size="sm"
          className="bg-[#6366f1] hover:bg-[#4f46e5] text-white"
          data-testid="integration-add-btn"
        >
          <Plus className="h-3.5 w-3.5 mr-1" /> Add Task
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { key: 'pending', label: 'To Do', value: summary.todo, color: 'text-amber-500' },
          { key: 'in_progress', label: 'In Progress', value: summary.inProgress, color: 'text-red-500' },
          { key: 'completed', label: 'Done', value: summary.done, color: 'text-emerald-500' },
        ].map((c) => {
          const active = statusFilter === c.key;
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => setStatusFilter(active ? null : c.key)}
              className={`${bgCard} border rounded-xl p-3 text-left transition-colors ${active ? 'border-[#6366f1] ring-1 ring-[#6366f1]' : `${borderColor} hover:border-[#6366f1]/40`}`}
              data-testid={`integration-summary-${c.key}`}
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
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase`}>Task</th>
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase`}>Priority</th>
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase`}>Deadline</th>
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase`}>Assign To</th>
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase`}>Status</th>
                  <th className={`text-right p-3 text-[11px] font-medium ${textSecondary} uppercase w-24`}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTasks.map((t) => (
                  <tr key={t.task_id} className={`border-b ${borderColor} last:border-b-0`} data-testid={`integration-task-row-${t.task_id}`}>
                    <td className="p-3">
                      <p className={`text-sm font-medium ${textPrimary}`}>{t.task_name}</p>
                      {t.description && <p className={`text-xs ${textSecondary} mt-0.5`}>{t.description}</p>}
                    </td>
                    <td className={`p-3 text-xs ${textSecondary} capitalize`}>{t.priority || 'medium'}</td>
                    <td className={`p-3 text-xs ${textSecondary}`}>
                      {t.due_date ? new Date(t.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                    </td>
                    <td className={`p-3 text-xs ${textSecondary}`}>{userName(t.assigned_to)}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-medium uppercase border ${taskStatusStyle(t.status)}`}>
                        {(t.status || 'pending').replace('_', ' ')}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <div className="inline-flex gap-1">
                        <button type="button" onClick={() => openEditTask(t)} className={`p-1 ${textSecondary} hover:opacity-80`} title="Edit" data-testid={`integration-task-edit-${t.task_id}`}>
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button type="button" onClick={() => deleteTask(t)} className="p-1 text-red-500 hover:text-red-400" title="Delete" data-testid={`integration-task-delete-${t.task_id}`}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredTasks.length === 0 && (
                  <tr>
                    <td colSpan={6} className={`p-8 text-center text-xs ${textSecondary}`}>
                      {tasks.length === 0
                        ? <>No integration tasks yet. Click <span className="font-medium">Add Task</span> to add one.</>
                        : 'No tasks match this filter.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {taskModal && (
        <IntegrationTaskModal
          project={project}
          projectMembers={projectMembers}
          currentUser={currentUser}
          headers={headers}
          taskId={taskModal.taskId}
          initialDraft={taskModal.initialDraft}
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
