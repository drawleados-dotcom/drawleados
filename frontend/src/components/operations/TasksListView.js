import React from 'react';
import { Edit, Trash2, Calendar, User, Clock, AlertCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';

const taskStatuses = [
  { value: 'not_started', label: 'Not Started', color: '#71717a' },
  { value: 'in_progress', label: 'In Progress', color: '#3b82f6' },
  { value: 'waiting_client', label: 'Waiting on Client', color: '#f59e0b' },
  { value: 'review', label: 'Review', color: '#8b5cf6' },
  { value: 'completed', label: 'Completed', color: '#10b981' },
  { value: 'on_hold', label: 'On Hold', color: '#ef4444' },
];

const priorityColors = {
  low: '#10b981',
  medium: '#f59e0b',
  high: '#ef4444',
};

const TasksListView = ({ tasks, onEditTask, onDeleteTask }) => {
  const getStatusInfo = (status) => {
    return taskStatuses.find((s) => s.value === status) || { label: status, color: '#71717a' };
  };

  return (
    <div className="bg-[#18181b] border border-[#27272a] rounded-xl overflow-hidden" data-testid="tasks-list">
      <table className="w-full">
        <thead className="bg-[#09090b]">
          <tr>
            <th className="text-left p-4 text-xs font-medium text-[#a1a1aa] uppercase">Task</th>
            <th className="text-left p-4 text-xs font-medium text-[#a1a1aa] uppercase">Project</th>
            <th className="text-left p-4 text-xs font-medium text-[#a1a1aa] uppercase">Status</th>
            <th className="text-left p-4 text-xs font-medium text-[#a1a1aa] uppercase">Priority</th>
            <th className="text-left p-4 text-xs font-medium text-[#a1a1aa] uppercase">Assigned To</th>
            <th className="text-left p-4 text-xs font-medium text-[#a1a1aa] uppercase">Time</th>
            <th className="text-left p-4 text-xs font-medium text-[#a1a1aa] uppercase">Due Date</th>
            <th className="text-right p-4 text-xs font-medium text-[#a1a1aa] uppercase">Actions</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => {
            const statusInfo = getStatusInfo(task.status);
            const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'completed';
            
            return (
              <tr
                key={task.task_id}
                className={`border-t border-[#27272a] hover:bg-[#27272a]/30 transition-colors ${
                  isOverdue ? 'bg-[#ef4444]/5' : ''
                }`}
                data-testid={`task-row-${task.task_id}`}
              >
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    {isOverdue && <AlertCircle className="h-4 w-4 text-[#ef4444]" />}
                    <div>
                      <p className="text-sm font-medium text-[#fafafa]">{task.task_name}</p>
                      {task.description && (
                        <p className="text-xs text-[#a1a1aa] truncate max-w-[200px]">{task.description}</p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="p-4">
                  <p className="text-sm text-[#fafafa]">{task.project_name || '-'}</p>
                  <p className="text-xs text-[#a1a1aa]">{task.client_name || ''}</p>
                </td>
                <td className="p-4">
                  <Badge
                    style={{ backgroundColor: `${statusInfo.color}20`, color: statusInfo.color, borderColor: statusInfo.color }}
                    className="border"
                  >
                    {statusInfo.label}
                  </Badge>
                </td>
                <td className="p-4">
                  <Badge
                    style={{ backgroundColor: `${priorityColors[task.priority]}20`, color: priorityColors[task.priority] }}
                  >
                    {task.priority}
                  </Badge>
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-full bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center text-white text-xs font-semibold">
                      {task.assigned_to_name?.charAt(0).toUpperCase() || '?'}
                    </div>
                    <span className="text-sm text-[#a1a1aa]">{task.assigned_to_name || '-'}</span>
                  </div>
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-1 text-xs text-[#a1a1aa]">
                    <Clock className="h-3 w-3" />
                    <span>{task.actual_time || 0}h / {task.estimated_time || 0}h</span>
                  </div>
                </td>
                <td className="p-4">
                  <div className={`flex items-center gap-1 text-xs ${isOverdue ? 'text-[#ef4444]' : 'text-[#a1a1aa]'}`}>
                    <Calendar className="h-3 w-3" />
                    {task.due_date ? new Date(task.due_date).toLocaleDateString() : '-'}
                    {task.delay_hours > 0 && (
                      <span className="ml-1 text-[#ef4444]">({task.delay_hours}h late)</span>
                    )}
                  </div>
                </td>
                <td className="p-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      size="sm"
                      onClick={() => onEditTask(task)}
                      data-testid={`edit-task-${task.task_id}`}
                      className="bg-[#27272a] hover:bg-[#3f3f46] text-[#fafafa] h-8"
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => onDeleteTask(task.task_id)}
                      data-testid={`delete-task-${task.task_id}`}
                      className="bg-[#27272a] hover:bg-[#ef4444] text-[#fafafa] h-8"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {tasks.length === 0 && (
        <div className="p-8 text-center text-[#a1a1aa]">No tasks found</div>
      )}
    </div>
  );
};

export default TasksListView;
