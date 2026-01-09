import React from 'react';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { Edit, Plus, Calendar, User, Clock } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import api from '../../utils/api';
import { toast } from 'sonner';

const projectStatuses = [
  { value: 'not_started', label: 'Not Started', color: '#71717a' },
  { value: 'in_progress', label: 'In Progress', color: '#3b82f6' },
  { value: 'waiting_client', label: 'Waiting on Client', color: '#f59e0b' },
  { value: 'review', label: 'Review', color: '#8b5cf6' },
  { value: 'completed', label: 'Completed', color: '#10b981' },
  { value: 'on_hold', label: 'On Hold', color: '#ef4444' },
];

const ProjectCard = ({ project, onEditProject, onCreateTask }) => {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'PROJECT',
    item: { project },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }));

  const priorityColors = {
    low: '#10b981',
    medium: '#f59e0b',
    high: '#ef4444',
  };

  return (
    <div
      ref={drag}
      className={`bg-[#09090b] border border-[#27272a] rounded-lg p-4 hover:border-[#6366f1]/20 transition-all cursor-move ${
        isDragging ? 'opacity-50' : 'opacity-100'
      }`}
      data-testid={`project-card-${project.project_id}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h4 className="text-sm font-medium text-[#fafafa] mb-1">{project.project_name}</h4>
          <p className="text-xs text-[#a1a1aa]">{project.client_name}</p>
        </div>
        <div className="flex gap-1">
          <Button
            size="sm"
            onClick={() => onCreateTask(project)}
            className="bg-[#27272a] hover:bg-[#3f3f46] text-[#fafafa] h-7 w-7 p-0"
            title="Add Task"
          >
            <Plus className="h-3 w-3" />
          </Button>
          <Button
            size="sm"
            onClick={() => onEditProject(project)}
            className="bg-[#27272a] hover:bg-[#3f3f46] text-[#fafafa] h-7 w-7 p-0"
          >
            <Edit className="h-3 w-3" />
          </Button>
        </div>
      </div>
      
      <div className="space-y-2 mb-3">
        <Badge
          variant="outline"
          className="text-xs"
          style={{ borderColor: priorityColors[project.priority], color: priorityColors[project.priority] }}
        >
          {project.priority} priority
        </Badge>
        {project.service_name && (
          <Badge variant="outline" className="text-xs border-[#27272a] text-[#a1a1aa] ml-1">
            {project.service_name}
          </Badge>
        )}
      </div>

      <div className="space-y-2 text-xs text-[#a1a1aa]">
        {project.assigned_pm_name && (
          <div className="flex items-center gap-1">
            <User className="h-3 w-3" />
            <span>{project.assigned_pm_name}</span>
          </div>
        )}
        {project.due_date && (
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            <span>{new Date(project.due_date).toLocaleDateString()}</span>
          </div>
        )}
        {project.estimated_hours > 0 && (
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>{project.actual_hours || 0}h / {project.estimated_hours}h</span>
          </div>
        )}
      </div>

      {/* Progress Bar */}
      <div className="mt-3">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-[#a1a1aa]">Progress</span>
          <span className="text-[#fafafa]">{project.progress_percent || 0}%</span>
        </div>
        <Progress value={project.progress_percent || 0} className="h-1.5" />
      </div>
    </div>
  );
};

const StatusColumn = ({ status, projects, onEditProject, onCreateTask, onDrop }) => {
  const [{ isOver }, drop] = useDrop(() => ({
    accept: 'PROJECT',
    drop: (item) => onDrop(item.project, status.value),
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
      data-testid={`projects-column-${status.value}`}
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
          {projects.length}
        </span>
      </div>
      <div className="space-y-3">
        {projects.map((project) => (
          <ProjectCard
            key={project.project_id}
            project={project}
            onEditProject={onEditProject}
            onCreateTask={onCreateTask}
          />
        ))}
      </div>
    </div>
  );
};

const ProjectsKanbanView = ({ projects, onEditProject, onCreateTask, onRefresh }) => {
  const handleDrop = async (project, newStatus) => {
    if (project.status === newStatus) return;

    try {
      await api.put(`/operations/projects/${project.project_id}`, { status: newStatus });
      toast.success('Project status updated');
      onRefresh();
    } catch (error) {
      toast.error('Failed to update project status');
    }
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <div
        className="grid gap-4 overflow-x-auto pb-4"
        style={{ gridTemplateColumns: `repeat(${projectStatuses.length}, minmax(280px, 1fr))` }}
        data-testid="projects-kanban-board"
      >
        {projectStatuses.map((status) => {
          const statusProjects = projects.filter((p) => p.status === status.value);
          return (
            <StatusColumn
              key={status.value}
              status={status}
              projects={statusProjects}
              onEditProject={onEditProject}
              onCreateTask={onCreateTask}
              onDrop={handleDrop}
            />
          );
        })}
      </div>
    </DndProvider>
  );
};

export default ProjectsKanbanView;
