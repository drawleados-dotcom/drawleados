import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import api from '../../utils/api';
import { toast } from 'sonner';

const projectStatuses = [
  { value: 'not_started', label: 'Not Started' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'waiting_client', label: 'Waiting on Client' },
  { value: 'review', label: 'Review' },
  { value: 'completed', label: 'Completed' },
  { value: 'on_hold', label: 'On Hold' },
];

const ProjectFormModal = ({ project, services, users, clients, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    project_name: project?.project_name || '',
    client_id: project?.client_id || '',
    service_id: project?.service_id || '',
    description: project?.description || '',
    assigned_pm: project?.assigned_pm || '',
    status: project?.status || 'not_started',
    priority: project?.priority || 'medium',
    start_date: project?.start_date ? project.start_date.split('T')[0] : '',
    due_date: project?.due_date ? project.due_date.split('T')[0] : '',
    estimated_hours: project?.estimated_hours || 0,
  });
  const [saving, setSaving] = useState(false);

  // Filter users who can be project managers (project_manager, admin, super_admin)
  const projectManagers = users.filter(
    (u) => ['project_manager', 'admin', 'super_admin'].includes(u.role)
  );

  const handleSubmit = async () => {
    if (!formData.project_name || !formData.client_id || !formData.service_id || !formData.assigned_pm) {
      toast.error('Please fill in all required fields');
      return;
    }

    setSaving(true);
    try {
      const submitData = {
        ...formData,
        start_date: formData.start_date ? new Date(formData.start_date).toISOString() : null,
        due_date: formData.due_date ? new Date(formData.due_date).toISOString() : null,
        estimated_hours: parseFloat(formData.estimated_hours) || 0,
      };

      if (project) {
        await api.put(`/operations/projects/${project.project_id}`, submitData);
        toast.success('Project updated successfully');
      } else {
        await api.post('/operations/projects', submitData);
        toast.success('Project created successfully');
      }
      onSave();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save project');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="bg-[#18181b] border-[#27272a] text-[#fafafa] max-w-2xl">
        <DialogHeader>
          <DialogTitle>{project ? 'Edit Project' : 'Create New Project'}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 py-4">
          <div className="col-span-2 space-y-2">
            <Label>Project Name *</Label>
            <Input
              value={formData.project_name}
              onChange={(e) => setFormData({ ...formData, project_name: e.target.value })}
              placeholder="Enter project name"
              data-testid="project-name-input"
              className="bg-[#09090b] border-[#27272a]"
            />
          </div>
          
          <div className="space-y-2">
            <Label>Client *</Label>
            <Select value={formData.client_id} onValueChange={(v) => setFormData({ ...formData, client_id: v })}>
              <SelectTrigger className="bg-[#09090b] border-[#27272a]" data-testid="project-client-select">
                <SelectValue placeholder="Select client" />
              </SelectTrigger>
              <SelectContent className="bg-[#18181b] border-[#27272a] max-h-60">
                {clients.map((client) => (
                  <SelectItem key={client.lead_id} value={client.lead_id} className="text-[#fafafa] focus:bg-[#27272a]">
                    {client.name} {client.business_name ? `(${client.business_name})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Service *</Label>
            <Select value={formData.service_id} onValueChange={(v) => setFormData({ ...formData, service_id: v })}>
              <SelectTrigger className="bg-[#09090b] border-[#27272a]" data-testid="project-service-select">
                <SelectValue placeholder="Select service" />
              </SelectTrigger>
              <SelectContent className="bg-[#18181b] border-[#27272a]">
                {services.map((service) => (
                  <SelectItem key={service.service_id} value={service.service_id} className="text-[#fafafa] focus:bg-[#27272a]">
                    {service.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Project Manager *</Label>
            <Select value={formData.assigned_pm} onValueChange={(v) => setFormData({ ...formData, assigned_pm: v })}>
              <SelectTrigger className="bg-[#09090b] border-[#27272a]" data-testid="project-pm-select">
                <SelectValue placeholder="Select PM" />
              </SelectTrigger>
              <SelectContent className="bg-[#18181b] border-[#27272a]">
                {projectManagers.map((user) => (
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
              <SelectTrigger className="bg-[#09090b] border-[#27272a]" data-testid="project-status-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#18181b] border-[#27272a]">
                {projectStatuses.map((status) => (
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
              <SelectTrigger className="bg-[#09090b] border-[#27272a]" data-testid="project-priority-select">
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
            <Label>Estimated Hours</Label>
            <Input
              type="number"
              value={formData.estimated_hours}
              onChange={(e) => setFormData({ ...formData, estimated_hours: e.target.value })}
              placeholder="Enter estimated hours"
              data-testid="project-hours-input"
              className="bg-[#09090b] border-[#27272a]"
            />
          </div>

          <div className="space-y-2">
            <Label>Start Date</Label>
            <Input
              type="date"
              value={formData.start_date}
              onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
              data-testid="project-start-date-input"
              className="bg-[#09090b] border-[#27272a]"
            />
          </div>

          <div className="space-y-2">
            <Label>Due Date</Label>
            <Input
              type="date"
              value={formData.due_date}
              onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
              data-testid="project-due-date-input"
              className="bg-[#09090b] border-[#27272a]"
            />
          </div>

          <div className="col-span-2 space-y-2">
            <Label>Description</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Enter project description"
              data-testid="project-description-input"
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
            data-testid="save-project-button"
            className="bg-[#6366f1] hover:bg-[#4f46e5]"
          >
            {saving ? 'Saving...' : project ? 'Update Project' : 'Create Project'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ProjectFormModal;
