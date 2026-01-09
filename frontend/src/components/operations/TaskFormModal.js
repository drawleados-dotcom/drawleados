import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import api from '../../utils/api';
import { toast } from 'sonner';

const taskStatuses = [
  { value: 'not_started', label: 'Not Started' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'waiting_client', label: 'Waiting on Client' },
  { value: 'review', label: 'Review' },
  { value: 'completed', label: 'Completed' },
  { value: 'on_hold', label: 'On Hold' },
];

const TaskFormModal = ({ task, projects, users, defaultProject, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    task_name: task?.task_name || '',
    project_id: task?.project_id || defaultProject?.project_id || '',
    assigned_to: task?.assigned_to || '',
    description: task?.description || '',
    status: task?.status || 'not_started',
    priority: task?.priority || 'medium',
    start_date: task?.start_date ? task.start_date.split('T')[0] : '',
    due_date: task?.due_date ? task.due_date.split('T')[0] : '',
    estimated_time: task?.estimated_time || 0,
    service_fields: task?.service_fields || {},
  });
  const [saving, setSaving] = useState(false);

  // Get team members (employees, project managers)
  const teamMembers = users.filter(
    (u) => ['employee', 'project_manager', 'admin', 'super_admin'].includes(u.role)
  );

  const handleSubmit = async () => {
    if (!formData.task_name || !formData.project_id || !formData.assigned_to) {
      toast.error('Please fill in all required fields');
      return;
    }

    setSaving(true);
    try {
      const submitData = {
        ...formData,
        start_date: formData.start_date ? new Date(formData.start_date).toISOString() : null,
        due_date: formData.due_date ? new Date(formData.due_date).toISOString() : null,
        estimated_time: parseFloat(formData.estimated_time) || 0,
      };

      if (task) {
        await api.put(`/operations/tasks/${task.task_id}`, submitData);
        toast.success('Task updated successfully');
      } else {
        await api.post('/operations/tasks', submitData);
        toast.success('Task created successfully');
      }
      onSave();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save task');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="bg-[#18181b] border-[#27272a] text-[#fafafa] max-w-2xl">
        <DialogHeader>
          <DialogTitle>{task ? 'Edit Task' : 'Create New Task'}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 py-4">
          <div className="col-span-2 space-y-2">
            <Label>Task Name *</Label>
            <Input
              value={formData.task_name}
              onChange={(e) => setFormData({ ...formData, task_name: e.target.value })}
              placeholder="Enter task name"
              data-testid="task-name-input"
              className="bg-[#09090b] border-[#27272a]"
            />
          </div>
          
          <div className="space-y-2">
            <Label>Project *</Label>
            <Select value={formData.project_id} onValueChange={(v) => setFormData({ ...formData, project_id: v })}>
              <SelectTrigger className="bg-[#09090b] border-[#27272a]" data-testid="task-project-select">
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent className="bg-[#18181b] border-[#27272a] max-h-60">
                {projects.map((project) => (
                  <SelectItem key={project.project_id} value={project.project_id} className="text-[#fafafa] focus:bg-[#27272a]">
                    {project.project_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Assign To *</Label>
            <Select value={formData.assigned_to} onValueChange={(v) => setFormData({ ...formData, assigned_to: v })}>
              <SelectTrigger className="bg-[#09090b] border-[#27272a]" data-testid="task-assignee-select">
                <SelectValue placeholder="Select team member" />
              </SelectTrigger>
              <SelectContent className="bg-[#18181b] border-[#27272a]">
                {teamMembers.map((user) => (
                  <SelectItem key={user.user_id} value={user.user_id} className="text-[#fafafa] focus:bg-[#27272a]">
                    {user.name} ({user.role})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
              <SelectTrigger className="bg-[#09090b] border-[#27272a]" data-testid="task-status-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#18181b] border-[#27272a]">
                {taskStatuses.map((status) => (
                  <SelectItem key={status.value} value={status.value} className="text-[#fafafa] focus:bg-[#27272a]">
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Priority</Label>
            <Select value={formData.priority} onValueChange={(v) => setFormData({ ...formData, priority: v })}>
              <SelectTrigger className="bg-[#09090b] border-[#27272a]" data-testid="task-priority-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#18181b] border-[#27272a]">
                <SelectItem value="low" className="text-[#fafafa] focus:bg-[#27272a]">Low</SelectItem>
                <SelectItem value="medium" className="text-[#fafafa] focus:bg-[#27272a]">Medium</SelectItem>
                <SelectItem value="high" className="text-[#fafafa] focus:bg-[#27272a]">High</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Estimated Time (hours)</Label>
            <Input
              type="number"
              step="0.5"
              value={formData.estimated_time}
              onChange={(e) => setFormData({ ...formData, estimated_time: e.target.value })}
              placeholder="Enter estimated hours"
              data-testid="task-hours-input"
              className="bg-[#09090b] border-[#27272a]"
            />
          </div>

          <div className="space-y-2">
            <Label>Start Date</Label>
            <Input
              type="date"
              value={formData.start_date}
              onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
              data-testid="task-start-date-input"
              className="bg-[#09090b] border-[#27272a]"
            />
          </div>

          <div className="space-y-2">
            <Label>Due Date</Label>
            <Input
              type="date"
              value={formData.due_date}
              onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
              data-testid="task-due-date-input"
              className="bg-[#09090b] border-[#27272a]"
            />
          </div>

          <div className="col-span-2 space-y-2">
            <Label>Description</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Enter task description"
              data-testid="task-description-input"
              className="bg-[#09090b] border-[#27272a] min-h-[100px]"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-[#27272a] text-[#a1a1aa]">
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={saving}
            data-testid="save-task-button"
            className="bg-[#6366f1] hover:bg-[#4f46e5]"
          >
            {saving ? 'Saving...' : task ? 'Update Task' : 'Create Task'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TaskFormModal;
