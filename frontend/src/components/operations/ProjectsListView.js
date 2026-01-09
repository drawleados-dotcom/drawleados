import React from 'react';
import { Edit, Trash2, Plus, Calendar, User, Clock } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';

const projectStatuses = [
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

const ProjectsListView = ({ projects, onEditProject, onDeleteProject, onCreateTask }) => {
  const getStatusInfo = (status) => {
    return projectStatuses.find((s) => s.value === status) || { label: status, color: '#71717a' };
  };

  return (
    <div className="bg-[#18181b] border border-[#27272a] rounded-xl overflow-hidden" data-testid="projects-list">
      <table className="w-full">
        <thead className="bg-[#09090b]">
          <tr>
            <th className="text-left p-4 text-xs font-medium text-[#a1a1aa] uppercase">Project</th>
            <th className="text-left p-4 text-xs font-medium text-[#a1a1aa] uppercase">Client</th>
            <th className="text-left p-4 text-xs font-medium text-[#a1a1aa] uppercase">Service</th>
            <th className="text-left p-4 text-xs font-medium text-[#a1a1aa] uppercase">Status</th>
            <th className="text-left p-4 text-xs font-medium text-[#a1a1aa] uppercase">Priority</th>
            <th className="text-left p-4 text-xs font-medium text-[#a1a1aa] uppercase">PM</th>
            <th className="text-left p-4 text-xs font-medium text-[#a1a1aa] uppercase">Progress</th>
            <th className="text-left p-4 text-xs font-medium text-[#a1a1aa] uppercase">Due Date</th>
            <th className="text-right p-4 text-xs font-medium text-[#a1a1aa] uppercase">Actions</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((project) => {
            const statusInfo = getStatusInfo(project.status);
            return (
              <tr
                key={project.project_id}
                className="border-t border-[#27272a] hover:bg-[#27272a]/30 transition-colors"
                data-testid={`project-row-${project.project_id}`}
              >
                <td className="p-4">
                  <p className="text-sm font-medium text-[#fafafa]">{project.project_name}</p>
                  {project.description && (
                    <p className="text-xs text-[#a1a1aa] truncate max-w-[200px]">{project.description}</p>
                  )}
                </td>
                <td className="p-4">
                  <p className="text-sm text-[#fafafa]">{project.client_name || '-'}</p>
                </td>
                <td className="p-4">
                  <Badge variant="outline" className="text-xs border-[#27272a] text-[#a1a1aa]">
                    {project.service_name || '-'}
                  </Badge>
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
                    style={{ backgroundColor: `${priorityColors[project.priority]}20`, color: priorityColors[project.priority] }}
                  >
                    {project.priority}
                  </Badge>
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-full bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center text-white text-xs font-semibold">
                      {project.assigned_pm_name?.charAt(0).toUpperCase() || '?'}
                    </div>
                    <span className="text-sm text-[#a1a1aa]">{project.assigned_pm_name || '-'}</span>
                  </div>
                </td>
                <td className="p-4">
                  <div className="w-24">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-[#a1a1aa]">{project.progress_percent || 0}%</span>
                    </div>
                    <Progress value={project.progress_percent || 0} className="h-1.5" />
                  </div>
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-1 text-xs text-[#a1a1aa]">
                    <Calendar className="h-3 w-3" />
                    {project.due_date ? new Date(project.due_date).toLocaleDateString() : '-'}
                  </div>
                </td>
                <td className="p-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      size="sm"
                      onClick={() => onCreateTask(project)}
                      title="Add Task"
                      className="bg-[#27272a] hover:bg-[#3f3f46] text-[#fafafa] h-8"
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => onEditProject(project)}
                      data-testid={`edit-project-${project.project_id}`}
                      className="bg-[#27272a] hover:bg-[#3f3f46] text-[#fafafa] h-8"
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => onDeleteProject(project.project_id)}
                      data-testid={`delete-project-${project.project_id}`}
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
      {projects.length === 0 && (
        <div className="p-8 text-center text-[#a1a1aa]">No projects found</div>
      )}
    </div>
  );
};

export default ProjectsListView;
