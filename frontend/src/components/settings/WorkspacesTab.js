import React, { useState, useEffect } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import api from '../../utils/api';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Plus, Edit, Trash2, Users, TrendingUp, Settings, DollarSign, Megaphone, UserCheck } from 'lucide-react';
import { toast } from 'sonner';

const iconMap = {
  TrendingUp: TrendingUp,
  Settings: Settings,
  DollarSign: DollarSign,
  Megaphone: Megaphone,
  Users: Users,
};

const colorOptions = [
  { value: '#3b82f6', label: 'Blue' },
  { value: '#10b981', label: 'Green' },
  { value: '#f59e0b', label: 'Amber' },
  { value: '#8b5cf6', label: 'Purple' },
  { value: '#ef4444', label: 'Red' },
  { value: '#ec4899', label: 'Pink' },
  { value: '#06b6d4', label: 'Cyan' },
];

const WorkspacesTab = ({ users = [] }) => {
  const { isDark } = useTheme();
  const bgCard = isDark ? 'bg-[#18181b]' : 'bg-white';
  const bgSecondary = isDark ? 'bg-[#27272a]' : 'bg-gray-100';
  const textPrimary = isDark ? 'text-[#fafafa]' : 'text-gray-900';
  const textSecondary = isDark ? 'text-[#a1a1aa]' : 'text-gray-600';
  const borderColor = isDark ? 'border-[#3f3f46]' : 'border-gray-200';
  
  const [workspaces, setWorkspaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [selectedWorkspace, setSelectedWorkspace] = useState(null);

  useEffect(() => {
    fetchWorkspaces();
  }, []);

  const fetchWorkspaces = async () => {
    try {
      const response = await api.get('/workspaces');
      setWorkspaces(response.data);
    } catch (error) {
      console.error('Error fetching workspaces:', error);
      toast.error('Failed to load workspaces');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setSelectedWorkspace(null);
    setShowModal(true);
  };

  const handleEdit = (workspace) => {
    setSelectedWorkspace(workspace);
    setShowModal(true);
  };

  const handleManageMembers = (workspace) => {
    setSelectedWorkspace(workspace);
    setShowMembersModal(true);
  };

  const handleSave = async (workspaceData) => {
    try {
      if (selectedWorkspace) {
        await api.put(`/workspaces/${selectedWorkspace.workspace_id}`, workspaceData);
        toast.success('Workspace updated successfully');
      } else {
        await api.post('/workspaces', workspaceData);
        toast.success('Workspace created successfully');
      }
      fetchWorkspaces();
      setShowModal(false);
      setSelectedWorkspace(null);
    } catch (error) {
      toast.error('Failed to save workspace');
    }
  };

  const handleDelete = async (workspaceId) => {
    if (!window.confirm('Are you sure you want to delete this workspace?')) return;
    try {
      await api.delete(`/workspaces/${workspaceId}`);
      toast.success('Workspace deleted');
      fetchWorkspaces();
    } catch (error) {
      toast.error('Failed to delete workspace');
    }
  };

  const handleToggleMember = async (workspaceId, userId, isCurrentMember) => {
    try {
      if (isCurrentMember) {
        await api.delete(`/workspaces/${workspaceId}/members/${userId}`);
      } else {
        await api.post(`/workspaces/${workspaceId}/members?user_id=${userId}`);
      }
      fetchWorkspaces();
    } catch (error) {
      toast.error('Failed to update members');
    }
  };

  if (loading) {
    return <div className="${textSecondary}">Loading workspaces...</div>;
  }

  return (
    <div className="space-y-6" data-testid="workspaces-tab">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold ${textPrimary}">Workspaces</h2>
          <p className="text-sm ${textSecondary}">
            Manage internal workspaces for different departments
          </p>
        </div>
        <Button
          onClick={handleCreate}
          className="bg-[#6366f1] hover:bg-[#4f46e5] text-white"
          data-testid="create-workspace-button"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Workspace
        </Button>
      </div>

      {/* Workspaces Grid */}
      <div className="grid grid-cols-3 gap-4">
        {workspaces.map((workspace) => {
          const IconComponent = iconMap[workspace.icon] || Settings;
          return (
            <Card
              key={workspace.workspace_id}
              className="${bgCard} ${borderColor} hover:${borderColor} transition-all"
              data-testid={`workspace-card-${workspace.workspace_id}`}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="h-10 w-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: `${workspace.color}20` }}
                    >
                      <IconComponent className="h-5 w-5" style={{ color: workspace.color }} />
                    </div>
                    <div>
                      <CardTitle className="${textPrimary} text-lg">{workspace.name}</CardTitle>
                      <p className="text-xs ${textSecondary}">{workspace.members?.length || 0} members</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      onClick={() => handleEdit(workspace)}
                      className="${bgSecondary} hover:bg-[#3f3f46] ${textPrimary} h-8 w-8 p-0"
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleDelete(workspace.workspace_id)}
                      className="${bgSecondary} hover:bg-[#ef4444] ${textPrimary} h-8 w-8 p-0"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm ${textSecondary} mb-4">{workspace.description}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleManageMembers(workspace)}
                  className="w-full ${borderColor} ${textPrimary} hover:${bgSecondary}"
                >
                  <UserCheck className="h-4 w-4 mr-2" />
                  Manage Members
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Workspace Form Modal */}
      {showModal && (
        <WorkspaceFormModal
          workspace={selectedWorkspace}
          onClose={() => setShowModal(false)}
          onSave={handleSave}
        />
      )}

      {/* Members Modal */}
      {showMembersModal && selectedWorkspace && (
        <MembersModal
          workspace={selectedWorkspace}
          users={users}
          onClose={() => setShowMembersModal(false)}
          onToggleMember={handleToggleMember}
        />
      )}
    </div>
  );
};

// Workspace Form Modal
const WorkspaceFormModal = ({ workspace, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    name: workspace?.name || '',
    description: workspace?.description || '',
    icon: workspace?.icon || 'Settings',
    color: workspace?.color || '#6366f1',
  });

  const handleSubmit = () => {
    if (!formData.name) {
      toast.error('Please enter a workspace name');
      return;
    }
    onSave(formData);
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="${bgCard} ${borderColor} ${textPrimary}">
        <DialogHeader>
          <DialogTitle>{workspace ? 'Edit Workspace' : 'Create Workspace'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Name *</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Marketing"
              className="bg-[#09090b] ${borderColor}"
              data-testid="workspace-name-input"
            />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="What is this workspace for?"
              className="bg-[#09090b] ${borderColor}"
            />
          </div>
          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex gap-2">
              {colorOptions.map((color) => (
                <button
                  key={color.value}
                  onClick={() => setFormData({ ...formData, color: color.value })}
                  className={`h-8 w-8 rounded-lg transition-all ${
                    formData.color === color.value ? 'ring-2 ring-white ring-offset-2 ring-offset-[#18181b]' : ''
                  }`}
                  style={{ backgroundColor: color.value }}
                  title={color.label}
                />
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="${borderColor} ${textSecondary}">
            Cancel
          </Button>
          <Button onClick={handleSubmit} className="bg-[#6366f1] hover:bg-[#4f46e5]">
            {workspace ? 'Update' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// Members Modal
const MembersModal = ({ workspace, users, onClose, onToggleMember }) => {
  const members = workspace.members || [];

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="${bgCard} ${borderColor} ${textPrimary} max-w-lg">
        <DialogHeader>
          <DialogTitle>
            <span style={{ color: workspace.color }}>{workspace.name}</span> - Members
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-2 py-4 max-h-[400px] overflow-y-auto">
          {users.map((user) => {
            const isMember = members.includes(user.user_id);
            return (
              <div
                key={user.user_id}
                className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                  isMember ? 'border-[#6366f1] bg-[#6366f1]/10' : '${borderColor} bg-[#09090b]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center text-white text-sm font-semibold">
                    {user.name?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium ${textPrimary}">{user.name}</p>
                    <p className="text-xs ${textSecondary}">{user.role}</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => onToggleMember(workspace.workspace_id, user.user_id, isMember)}
                  className={
                    isMember
                      ? 'bg-[#ef4444] hover:bg-[#dc2626] text-white'
                      : 'bg-[#6366f1] hover:bg-[#4f46e5] text-white'
                  }
                >
                  {isMember ? 'Remove' : 'Add'}
                </Button>
              </div>
            );
          })}
        </div>
        <DialogFooter>
          <Button onClick={onClose} className="${bgSecondary} hover:bg-[#3f3f46]">
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default WorkspacesTab;
