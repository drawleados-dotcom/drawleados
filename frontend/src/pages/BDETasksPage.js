import React, { useState, useEffect, useCallback } from 'react';
import Layout from '../components/Layout';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import {
  Plus, Calendar, Clock, User, CheckCircle2, Circle, 
  MoreHorizontal, Trash2, Edit2, X, AlertCircle, Briefcase
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

const priorityColors = {
  high: 'bg-[#ef4444]/20 text-[#ef4444] border-[#ef4444]',
  medium: 'bg-[#f59e0b]/20 text-[#f59e0b] border-[#f59e0b]',
  low: 'bg-[#71717a]/20 text-[#71717a] border-[#71717a]'
};

const statusColors = {
  'pending': 'bg-[#71717a]/20 text-[#71717a]',
  'in_progress': 'bg-[#3b82f6]/20 text-[#3b82f6]',
  'completed': 'bg-[#10b981]/20 text-[#10b981]',
  'on_hold': 'bg-[#f59e0b]/20 text-[#f59e0b]'
};

export default function BDETasksPage() {
  const { isDark } = useTheme();
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [filter, setFilter] = useState('all');
  
  const token = localStorage.getItem('session_token');
  const headers = { Authorization: `Bearer ${token}` };

  // Theme classes
  const bgCard = isDark ? 'bg-[#18181b]' : 'bg-white';
  const bgSecondary = isDark ? 'bg-[#27272a]' : 'bg-gray-100';
  const textPrimary = isDark ? 'text-[#fafafa]' : 'text-gray-900';
  const textSecondary = isDark ? 'text-[#a1a1aa]' : 'text-gray-600';
  const borderColor = isDark ? 'border-[#27272a]' : 'border-gray-200';

  // Form state
  const [formData, setFormData] = useState({
    task_name: '',
    description: '',
    priority: 'medium',
    type: 'general',
    assigned_to: '',
    due_date: '',
    status: 'pending'
  });

  // Load tasks
  const loadTasks = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/bde/tasks`, { headers });
      setTasks(res.data);
    } catch (error) {
      console.error('Error loading tasks:', error);
    }
    setLoading(false);
  }, []);

  // Load users for assignment
  const loadUsers = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/users/list`, { headers });
      setUsers(res.data);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  }, []);

  useEffect(() => {
    loadTasks();
    loadUsers();
  }, [loadTasks, loadUsers]);

  // Create task
  const handleCreateTask = async () => {
    if (!formData.task_name.trim()) {
      toast.error('Task name is required');
      return;
    }
    try {
      await axios.post(`${API}/api/bde/tasks`, formData, { headers });
      toast.success('Task created successfully');
      setShowCreateModal(false);
      resetForm();
      loadTasks();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create task');
    }
  };

  // Update task
  const handleUpdateTask = async () => {
    if (!formData.task_name.trim()) {
      toast.error('Task name is required');
      return;
    }
    try {
      await axios.put(`${API}/api/bde/tasks/${editingTask.task_id}`, formData, { headers });
      toast.success('Task updated successfully');
      setEditingTask(null);
      resetForm();
      loadTasks();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update task');
    }
  };

  // Delete task
  const handleDeleteTask = async (taskId) => {
    if (!window.confirm('Are you sure you want to delete this task?')) return;
    try {
      await axios.delete(`${API}/api/bde/tasks/${taskId}`, { headers });
      toast.success('Task deleted');
      loadTasks();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete task');
    }
  };

  // Update task status
  const handleStatusChange = async (taskId, newStatus) => {
    try {
      await axios.patch(`${API}/api/bde/tasks/${taskId}/status`, { status: newStatus }, { headers });
      toast.success('Status updated');
      loadTasks();
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const resetForm = () => {
    setFormData({
      task_name: '',
      description: '',
      priority: 'medium',
      type: 'general',
      assigned_to: '',
      due_date: '',
      status: 'pending'
    });
  };

  const openEditModal = (task) => {
    setFormData({
      task_name: task.task_name,
      description: task.description || '',
      priority: task.priority,
      type: task.type || 'general',
      assigned_to: task.assigned_to || '',
      due_date: task.due_date || '',
      status: task.status
    });
    setEditingTask(task);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  // Filter tasks
  const filteredTasks = tasks.filter(task => {
    if (filter === 'all') return true;
    if (filter === 'my') return task.created_by === user?.user_id || task.assigned_to === user?.user_id;
    return task.status === filter;
  });

  // Stats
  const stats = {
    total: tasks.length,
    pending: tasks.filter(t => t.status === 'pending').length,
    in_progress: tasks.filter(t => t.status === 'in_progress').length,
    completed: tasks.filter(t => t.status === 'completed').length
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className={`text-2xl font-bold ${textPrimary}`}>BDE Tasks</h1>
            <p className={textSecondary}>Manage your business development tasks</p>
          </div>
          <Button onClick={() => setShowCreateModal(true)} className="bg-[#6366f1] hover:bg-[#4f46e5]">
            <Plus className="h-4 w-4 mr-2" />
            Create Task
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-4">
          <Card className={`${bgCard} border ${borderColor}`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm ${textSecondary}`}>Total Tasks</p>
                  <p className={`text-2xl font-bold ${textPrimary}`}>{stats.total}</p>
                </div>
                <Briefcase className="h-8 w-8 text-[#6366f1]" />
              </div>
            </CardContent>
          </Card>
          <Card className={`${bgCard} border ${borderColor}`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm ${textSecondary}`}>Pending</p>
                  <p className={`text-2xl font-bold text-[#71717a]`}>{stats.pending}</p>
                </div>
                <Circle className="h-8 w-8 text-[#71717a]" />
              </div>
            </CardContent>
          </Card>
          <Card className={`${bgCard} border ${borderColor}`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm ${textSecondary}`}>In Progress</p>
                  <p className={`text-2xl font-bold text-[#3b82f6]`}>{stats.in_progress}</p>
                </div>
                <Clock className="h-8 w-8 text-[#3b82f6]" />
              </div>
            </CardContent>
          </Card>
          <Card className={`${bgCard} border ${borderColor}`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm ${textSecondary}`}>Completed</p>
                  <p className={`text-2xl font-bold text-[#10b981]`}>{stats.completed}</p>
                </div>
                <CheckCircle2 className="h-8 w-8 text-[#10b981]" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2">
          {['all', 'my', 'pending', 'in_progress', 'completed'].map(f => (
            <Button
              key={f}
              variant={filter === f ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter(f)}
              className={filter === f ? 'bg-[#6366f1]' : ''}
            >
              {f === 'all' ? 'All' : f === 'my' ? 'My Tasks' : f.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </Button>
          ))}
        </div>

        {/* Tasks Table */}
        <Card className={`${bgCard} border ${borderColor}`}>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className={bgSecondary}>
                  <tr>
                    <th className={`px-4 py-3 text-left text-xs font-medium ${textSecondary} uppercase`}>Date</th>
                    <th className={`px-4 py-3 text-left text-xs font-medium ${textSecondary} uppercase`}>Task Name</th>
                    <th className={`px-4 py-3 text-left text-xs font-medium ${textSecondary} uppercase`}>Priority</th>
                    <th className={`px-4 py-3 text-left text-xs font-medium ${textSecondary} uppercase`}>Type</th>
                    <th className={`px-4 py-3 text-left text-xs font-medium ${textSecondary} uppercase`}>Assigned To</th>
                    <th className={`px-4 py-3 text-left text-xs font-medium ${textSecondary} uppercase`}>Status</th>
                    <th className={`px-4 py-3 text-left text-xs font-medium ${textSecondary} uppercase`}>Actions</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDark ? 'divide-[#27272a]' : 'divide-gray-200'}`}>
                  {loading ? (
                    <tr>
                      <td colSpan={7} className={`px-4 py-8 text-center ${textSecondary}`}>Loading...</td>
                    </tr>
                  ) : filteredTasks.length === 0 ? (
                    <tr>
                      <td colSpan={7} className={`px-4 py-8 text-center ${textSecondary}`}>
                        <Briefcase className={`h-12 w-12 mx-auto mb-3 ${textSecondary}`} />
                        <p>No tasks found</p>
                        <p className="text-sm">Create a new task to get started</p>
                      </td>
                    </tr>
                  ) : filteredTasks.map(task => (
                    <tr key={task.task_id} className={`${bgCard} hover:${bgSecondary}`}>
                      <td className={`px-4 py-3 text-sm ${textPrimary}`}>
                        {formatDate(task.created_at)}
                      </td>
                      <td className={`px-4 py-3`}>
                        <div className={`font-medium ${textPrimary}`}>{task.task_name}</div>
                        {task.description && (
                          <div className={`text-xs ${textSecondary} truncate max-w-xs`}>{task.description}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={priorityColors[task.priority]}>
                          {task.priority}
                        </Badge>
                      </td>
                      <td className={`px-4 py-3 text-sm ${textPrimary} capitalize`}>
                        {task.type || 'General'}
                      </td>
                      <td className={`px-4 py-3 text-sm ${textPrimary}`}>
                        {task.assigned_to_name || '-'}
                      </td>
                      <td className="px-4 py-3">
                        <Select value={task.status} onValueChange={(v) => handleStatusChange(task.task_id, v)}>
                          <SelectTrigger className={`w-32 h-8 ${statusColors[task.status]}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className={bgCard}>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="in_progress">In Progress</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                            <SelectItem value="on_hold">On Hold</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEditModal(task)}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" className="text-[#ef4444]" onClick={() => handleDeleteTask(task.task_id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Create/Edit Task Modal */}
        {(showCreateModal || editingTask) && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className={`${bgCard} border ${borderColor} w-full max-w-lg mx-4`}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className={`flex items-center gap-2 ${textPrimary}`}>
                    <Briefcase className="h-5 w-5 text-[#6366f1]" />
                    {editingTask ? 'Edit Task' : 'Create New Task'}
                  </CardTitle>
                  <button onClick={() => { setShowCreateModal(false); setEditingTask(null); resetForm(); }} className={textSecondary}>
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className={textPrimary}>Task Name *</Label>
                  <Input
                    value={formData.task_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, task_name: e.target.value }))}
                    placeholder="Enter task name"
                    className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                  />
                </div>
                <div>
                  <Label className={textPrimary}>Description</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Task description"
                    rows={3}
                    className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className={textPrimary}>Priority</Label>
                    <Select value={formData.priority} onValueChange={(v) => setFormData(prev => ({ ...prev, priority: v }))}>
                      <SelectTrigger className={`${bgSecondary} border ${borderColor}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className={bgCard}>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className={textPrimary}>Type</Label>
                    <Select value={formData.type} onValueChange={(v) => setFormData(prev => ({ ...prev, type: v }))}>
                      <SelectTrigger className={`${bgSecondary} border ${borderColor}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className={bgCard}>
                        <SelectItem value="general">General</SelectItem>
                        <SelectItem value="follow_up">Follow Up</SelectItem>
                        <SelectItem value="meeting">Meeting</SelectItem>
                        <SelectItem value="proposal">Proposal</SelectItem>
                        <SelectItem value="call">Call</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className={textPrimary}>Assign To</Label>
                    <Select value={formData.assigned_to} onValueChange={(v) => setFormData(prev => ({ ...prev, assigned_to: v }))}>
                      <SelectTrigger className={`${bgSecondary} border ${borderColor}`}>
                        <SelectValue placeholder="Select user" />
                      </SelectTrigger>
                      <SelectContent className={bgCard}>
                        {users.map(u => (
                          <SelectItem key={u.user_id} value={u.user_id}>{u.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className={textPrimary}>Due Date</Label>
                    <Input
                      type="date"
                      value={formData.due_date}
                      onChange={(e) => setFormData(prev => ({ ...prev, due_date: e.target.value }))}
                      className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                    />
                  </div>
                </div>
                <div className="flex gap-3 pt-4">
                  <Button variant="outline" onClick={() => { setShowCreateModal(false); setEditingTask(null); resetForm(); }} className="flex-1">
                    Cancel
                  </Button>
                  <Button onClick={editingTask ? handleUpdateTask : handleCreateTask} className="flex-1 bg-[#6366f1] hover:bg-[#4f46e5]">
                    {editingTask ? 'Update Task' : 'Create Task'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </Layout>
  );
}
