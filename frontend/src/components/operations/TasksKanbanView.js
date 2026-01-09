import React from 'react';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { Edit, Calendar, User, Clock, AlertCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import api from '../../utils/api';
import { toast } from 'sonner';

const taskStatuses = [
  { value: 'not_started', label: 'Not Started', color: '#71717a' },
  { value: 'in_progress', label: 'In Progress', color: '#3b82f6' },
  { value: 'waiting_client', label: 'Waiting on Client', color: '#f59e0b' },
  { value: 'review', label: 'Review', color: '#8b5cf6' },
  { value: 'completed', label: 'Completed', color: '#10b981' },
  { value: 'on_hold', label: 'On Hold', color: '#ef4444' },
];

const TaskCard = ({ task, onEditTask }) => {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'TASK',
    item: { task },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }));

  const priorityColors = {
    low: '#10b981',
    medium: '#f59e0b',
    high: '#ef4444',
  };

  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'completed';

  return (
    <div
      ref={drag}
      className={`bg-[#09090b] border rounded-lg p-4 hover:border-[#6366f1]/20 transition-all cursor-move ${
        isDragging ? 'opacity-50' : 'opacity-100'
      } ${isOverdue ? 'border-[#ef4444]/50' : 'border-[#27272a]'}`}
      data-testid={`task-card-${task.task_id}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            {isOverdue && <AlertCircle className="h-3 w-3 text-[#ef4444]" />}
            <h4 className="text-sm font-medium text-[#fafafa]">{task.task_name}</h4>
          </div>
          <p className="text-xs text-[#a1a1aa]">{task.project_name}</p>
        </div>
        <Button
          size="sm"
          onClick={() => onEditTask(task)}
          className="bg-[#27272a] hover:bg-[#3f3f46] text-[#fafafa] h-7 w-7 p-0"
        >
          <Edit className="h-3 w-3" />
        </Button>
      </div>
      
      <div className="space-y-2 mb-3">
        <Badge
          variant="outline"
          className="text-xs"
          style={{ borderColor: priorityColors[task.priority], color: priorityColors[task.priority] }}
        >
          {task.priority}
        </Badge>
        {task.service_type && (
          <Badge variant="outline" className="text-xs border-[#27272a] text-[#a1a1aa] ml-1">
            {task.service_type}
          </Badge>
        )}
      </div>

      <div className="space-y-2 text-xs text-[#a1a1aa]">
        {task.assigned_to_name && (
          <div className="flex items-center gap-1">
            <User className="h-3 w-3" />
            <span>{task.assigned_to_name}</span>
          </div>
        )}
        {task.due_date && (
          <div className={`flex items-center gap-1 ${isOverdue ? 'text-[#ef4444]' : ''}`}>
            <Calendar className="h-3 w-3" />
            <span>{new Date(task.due_date).toLocaleDateString()}</span>
          </div>
        )}
        {(task.estimated_time > 0 || task.actual_time > 0) && (
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>{task.actual_time || 0}h / {task.estimated_time || 0}h</span>
          </div>
        )}
      </div>

      {task.delay_hours > 0 && (
        <div className="mt-2 text-xs text-[#ef4444]">
          ⚠ {task.delay_hours}h overdue
        </div>
      )}
    </div>
  );
};

const StatusColumn = ({ status, tasks, onEditTask, onDrop }) => {
  const [{ isOver }, drop] = useDrop(() => ({
    accept: 'TASK',
    drop: (item) => onDrop(item.task, status.value),
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  }));

  return (
    <div
      ref={drop}
      className={`bg-[#18181b] border border-[#27272a] rounded-xl p-4 min-h-[500px] transition-all ${
        isOver ? 'border-[#6366f1] bg-[#6366f1]/5' : ''
      }`}
      data-testid={`tasks-column-${status.value}`}
    >
      <div className="flex items-center gap-2 mb-4">
        <div
          className="h-3 w-3 rounded-full"
          style={{ backgroundColor: status.color }}
        />
        <h3 className="text-sm font-semibold text-[#fafafa]" style={{ fontFamily: 'Plus Jakarta Sans' }}>
          {status.label}
        </h3>
        <span className="ml-auto text-xs text-[#a1a1aa] bg-[#27272a] px-2 py-1 rounded-full">
          {tasks.length}
        </span>
      </div>
      <div className="space-y-3">
        {tasks.map((task) => (
          <TaskCard
            key={task.task_id}
            task={task}
            onEditTask={onEditTask}
          />
        ))}
      </div>
    </div>
  );
};

const TasksKanbanView = ({ tasks, onEditTask, onRefresh }) => {
  const handleDrop = async (task, newStatus) => {
    if (task.status === newStatus) return;

    try {
      await api.put(`/operations/tasks/${task.task_id}`, { status: newStatus });
      toast.success('Task status updated');
      onRefresh();
    } catch (error) {
      toast.error('Failed to update task status');
    }
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <div
        className="grid gap-4 overflow-x-auto pb-4"
        style={{ gridTemplateColumns: `repeat(${taskStatuses.length}, minmax(280px, 1fr))` }}
        data-testid="tasks-kanban-board"
      >
        {taskStatuses.map((status) => {
          const statusTasks = tasks.filter((t) => t.status === status.value);
          return (
            <StatusColumn
              key={status.value}
              status={status}
              tasks={statusTasks}
              onEditTask={onEditTask}
              onDrop={handleDrop}
            />
          );
        })}
      </div>
    </DndProvider>
  );
};

export default TasksKanbanView;
