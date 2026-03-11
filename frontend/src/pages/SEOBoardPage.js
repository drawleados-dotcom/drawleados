import React, { useState, useEffect, useCallback } from 'react';
import Layout from '../components/Layout';
import { useTheme } from '../contexts/ThemeContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { 
  Plus, Search, Globe, Users, FileText, ExternalLink, Link, MapPin, 
  MoreHorizontal, ChevronLeft, Edit2, Trash2, Calendar, User, 
  CheckCircle, Clock, Eye, AlertCircle, GripVertical, X
} from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

// Category configuration
const CATEGORIES = {
  onpage: { name: 'On-Page SEO', color: '#22c55e', icon: FileText },
  offpage: { name: 'Off-Page SEO', color: '#3b82f6', icon: ExternalLink },
  backlinks: { name: 'Backlinks', color: '#8b5cf6', icon: Link },
  gmb: { name: 'GMB', color: '#f59e0b', icon: MapPin },
  other: { name: 'Other Work', color: '#6366f1', icon: MoreHorizontal }
};

const STATUS_CONFIG = {
  todo: { name: 'To Do', color: '#71717a' },
  in_progress: { name: 'In Progress', color: '#3b82f6' },
  review: { name: 'Review', color: '#f59e0b' },
  done: { name: 'Done', color: '#22c55e' }
};

const PRIORITIES = {
  low: { name: 'Low', color: '#71717a' },
  medium: { name: 'Medium', color: '#3b82f6' },
  high: { name: 'High', color: '#f59e0b' },
  urgent: { name: 'Urgent', color: '#ef4444' }
};

const SEOBoardPage = () => {
  const { isDark } = useTheme();
  const token = localStorage.getItem('session_token');
  const headers = { Authorization: `Bearer ${token}` };

  // Theme classes
  const bgCard = isDark ? 'bg-[#18181b]' : 'bg-white';
  const bgSecondary = isDark ? 'bg-[#27272a]' : 'bg-gray-100';
  const textPrimary = isDark ? 'text-[#fafafa]' : 'text-gray-900';
  const textSecondary = isDark ? 'text-[#a1a1aa]' : 'text-gray-600';
  const borderColor = isDark ? 'border-[#3f3f46]' : 'border-gray-200';

  // State
  const [view, setView] = useState('clients'); // 'clients' or 'board'
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [tasks, setTasks] = useState({});
  const [templates, setTemplates] = useState({});
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');

  // Modal states
  const [showClientModal, setShowClientModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [editingTask, setEditingTask] = useState(null);

  // Form states
  const [clientForm, setClientForm] = useState({
    name: '', website: '', contact_email: '', contact_phone: '', notes: '', assigned_members: []
  });
  const [taskForm, setTaskForm] = useState({
    name: '', description: '', category: 'onpage', assigned_to: '', due_date: '', priority: 'medium'
  });

  // Load clients
  const loadClients = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/seo-board/clients`, { headers });
      setClients(res.data || []);
    } catch (error) {
      console.error('Error loading clients:', error);
    }
  }, []);

  // Load templates
  const loadTemplates = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/seo-board/templates`, { headers });
      setTemplates(res.data || {});
    } catch (error) {
      console.error('Error loading templates:', error);
    }
  }, []);

  // Load team members
  const loadTeamMembers = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/seo-board/team-members`, { headers });
      setTeamMembers(res.data || []);
    } catch (error) {
      console.error('Error loading team members:', error);
    }
  }, []);

  // Load tasks for selected client
  const loadTasks = useCallback(async (clientId) => {
    try {
      const res = await axios.get(`${API}/api/seo-board/tasks/${clientId}/grouped`, { headers });
      setTasks(res.data || {});
    } catch (error) {
      console.error('Error loading tasks:', error);
    }
  }, []);

  // Initial load
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([loadClients(), loadTemplates(), loadTeamMembers()]);
      setLoading(false);
    };
    init();
  }, [loadClients, loadTemplates, loadTeamMembers]);

  // Load tasks when client selected
  useEffect(() => {
    if (selectedClient) {
      loadTasks(selectedClient.client_id);
    }
  }, [selectedClient, loadTasks]);

  // Open client board
  const openClientBoard = (client) => {
    setSelectedClient(client);
    setView('board');
  };

  // Back to clients list
  const backToClients = () => {
    setSelectedClient(null);
    setView('clients');
    setTasks({});
  };

  // Client form handlers
  const openAddClientModal = () => {
    setEditingClient(null);
    setClientForm({ name: '', website: '', contact_email: '', contact_phone: '', notes: '', assigned_members: [] });
    setShowClientModal(true);
  };

  const openEditClientModal = (client) => {
    setEditingClient(client);
    setClientForm({
      name: client.name,
      website: client.website,
      contact_email: client.contact_email || '',
      contact_phone: client.contact_phone || '',
      notes: client.notes || '',
      assigned_members: client.assigned_members || []
    });
    setShowClientModal(true);
  };

  const saveClient = async () => {
    if (!clientForm.name.trim() || !clientForm.website.trim()) {
      toast.error('Name and Website are required');
      return;
    }

    try {
      if (editingClient) {
        await axios.put(`${API}/api/seo-board/clients/${editingClient.client_id}`, clientForm, { headers });
        toast.success('Client updated');
      } else {
        await axios.post(`${API}/api/seo-board/clients`, clientForm, { headers });
        toast.success('Client created');
      }
      setShowClientModal(false);
      loadClients();
    } catch (error) {
      toast.error('Failed to save client');
    }
  };

  const deleteClient = async (clientId) => {
    if (!window.confirm('Delete this client and all their tasks?')) return;
    try {
      await axios.delete(`${API}/api/seo-board/clients/${clientId}`, { headers });
      toast.success('Client deleted');
      loadClients();
    } catch (error) {
      toast.error('Failed to delete client');
    }
  };

  // Task form handlers
  const openAddTaskModal = (category = 'onpage') => {
    setEditingTask(null);
    setTaskForm({ name: '', description: '', category, assigned_to: '', due_date: '', priority: 'medium' });
    setShowTaskModal(true);
  };

  const openEditTaskModal = (task) => {
    setEditingTask(task);
    setTaskForm({
      name: task.name,
      description: task.description || '',
      category: task.category,
      assigned_to: task.assigned_to || '',
      due_date: task.due_date || '',
      priority: task.priority || 'medium'
    });
    setShowTaskModal(true);
  };

  const saveTask = async () => {
    if (!taskForm.name.trim()) {
      toast.error('Task name is required');
      return;
    }

    try {
      if (editingTask) {
        await axios.put(`${API}/api/seo-board/tasks/${editingTask.task_id}`, taskForm, { headers });
        toast.success('Task updated');
      } else {
        await axios.post(`${API}/api/seo-board/tasks`, {
          ...taskForm,
          client_id: selectedClient.client_id,
          status: 'todo'
        }, { headers });
        toast.success('Task created');
      }
      setShowTaskModal(false);
      loadTasks(selectedClient.client_id);
    } catch (error) {
      toast.error('Failed to save task');
    }
  };

  const deleteTask = async (taskId) => {
    try {
      await axios.delete(`${API}/api/seo-board/tasks/${taskId}`, { headers });
      toast.success('Task deleted');
      loadTasks(selectedClient.client_id);
    } catch (error) {
      toast.error('Failed to delete task');
    }
  };

  const updateTaskStatus = async (taskId, newStatus) => {
    try {
      await axios.put(`${API}/api/seo-board/tasks/${taskId}/status`, { status: newStatus }, { headers });
      loadTasks(selectedClient.client_id);
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  // Add tasks from template
  const openTemplateModal = () => {
    setShowTemplateModal(true);
  };

  const addFromTemplate = async (category) => {
    try {
      await axios.post(`${API}/api/seo-board/tasks/bulk`, {
        client_id: selectedClient.client_id,
        category: category
      }, { headers });
      toast.success(`Added ${CATEGORIES[category].name} tasks`);
      setShowTemplateModal(false);
      loadTasks(selectedClient.client_id);
    } catch (error) {
      toast.error('Failed to add tasks');
    }
  };

  // Filter tasks by category
  const getFilteredTasks = (statusTasks) => {
    if (activeCategory === 'all') return statusTasks;
    return statusTasks.filter(t => t.category === activeCategory);
  };

  // Filtered clients
  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.website.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <Layout>
        <div className={`min-h-screen ${isDark ? 'bg-[#09090b]' : 'bg-gray-50'} flex items-center justify-center`}>
          <p className={textSecondary}>Loading SEO Board...</p>
        </div>
      </Layout>
    );
  }

  // ============== CLIENTS VIEW ==============
  if (view === 'clients') {
    return (
      <Layout>
        <div className={`min-h-screen ${isDark ? 'bg-[#09090b]' : 'bg-gray-50'}`} data-testid="seo-board-page">
          {/* Header */}
          <div className={`p-6 border-b ${borderColor}`}>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold">
                  <span className="bg-gradient-to-r from-[#f59e0b] to-[#ef4444] bg-clip-text text-transparent">
                    SEO Board
                  </span>
                </h1>
                <p className={`${textSecondary} mt-1`}>Manage SEO tasks for all clients</p>
              </div>
              <Button onClick={openAddClientModal} className="bg-[#f59e0b] hover:bg-[#d97706]">
                <Plus className="h-4 w-4 mr-2" />
                Add Client
              </Button>
            </div>
          </div>

          {/* Search */}
          <div className="p-6">
            <div className="relative max-w-md mb-6">
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ${textSecondary}`} />
              <Input
                placeholder="Search clients..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`pl-10 ${bgSecondary} border ${borderColor}`}
              />
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <Card className={`${bgCard} border ${borderColor}`}>
                <CardContent className="p-4 text-center">
                  <Users className="h-8 w-8 text-[#f59e0b] mx-auto mb-2" />
                  <p className={`text-2xl font-bold ${textPrimary}`}>{clients.length}</p>
                  <p className={`text-xs ${textSecondary}`}>Total Clients</p>
                </CardContent>
              </Card>
              <Card className={`${bgCard} border ${borderColor}`}>
                <CardContent className="p-4 text-center">
                  <Clock className="h-8 w-8 text-[#3b82f6] mx-auto mb-2" />
                  <p className={`text-2xl font-bold ${textPrimary}`}>
                    {clients.reduce((sum, c) => sum + (c.task_counts?.in_progress || 0), 0)}
                  </p>
                  <p className={`text-xs ${textSecondary}`}>In Progress</p>
                </CardContent>
              </Card>
              <Card className={`${bgCard} border ${borderColor}`}>
                <CardContent className="p-4 text-center">
                  <Eye className="h-8 w-8 text-[#f59e0b] mx-auto mb-2" />
                  <p className={`text-2xl font-bold ${textPrimary}`}>
                    {clients.reduce((sum, c) => sum + (c.task_counts?.review || 0), 0)}
                  </p>
                  <p className={`text-xs ${textSecondary}`}>In Review</p>
                </CardContent>
              </Card>
              <Card className={`${bgCard} border ${borderColor}`}>
                <CardContent className="p-4 text-center">
                  <CheckCircle className="h-8 w-8 text-[#22c55e] mx-auto mb-2" />
                  <p className={`text-2xl font-bold ${textPrimary}`}>
                    {clients.reduce((sum, c) => sum + (c.task_counts?.done || 0), 0)}
                  </p>
                  <p className={`text-xs ${textSecondary}`}>Completed</p>
                </CardContent>
              </Card>
            </div>

            {/* Clients Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredClients.map((client) => (
                <Card 
                  key={client.client_id} 
                  className={`${bgCard} border ${borderColor} hover:border-[#f59e0b]/50 transition-all cursor-pointer`}
                  onClick={() => openClientBoard(client)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-[#f59e0b] to-[#ef4444] flex items-center justify-center text-white font-bold text-lg">
                          {client.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h3 className={`font-semibold ${textPrimary}`}>{client.name}</h3>
                          <a 
                            href={client.website} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-xs text-[#3b82f6] hover:underline flex items-center gap-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Globe className="h-3 w-3" />
                            {client.website.replace(/^https?:\/\//, '')}
                          </a>
                        </div>
                      </div>
                      <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button size="sm" variant="ghost" onClick={() => openEditClientModal(client)} className="h-8 w-8 p-0">
                          <Edit2 className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => deleteClient(client.client_id)} className="h-8 w-8 p-0 text-red-400">
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    {/* Task Progress */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className={textSecondary}>Tasks Progress</span>
                        <span className={textPrimary}>{client.total_tasks || 0} total</span>
                      </div>
                      <div className="flex gap-1 h-2 rounded-full overflow-hidden bg-[#27272a]">
                        {client.task_counts?.done > 0 && (
                          <div 
                            className="h-full bg-[#22c55e]" 
                            style={{ width: `${(client.task_counts.done / client.total_tasks) * 100}%` }}
                          />
                        )}
                        {client.task_counts?.review > 0 && (
                          <div 
                            className="h-full bg-[#f59e0b]" 
                            style={{ width: `${(client.task_counts.review / client.total_tasks) * 100}%` }}
                          />
                        )}
                        {client.task_counts?.in_progress > 0 && (
                          <div 
                            className="h-full bg-[#3b82f6]" 
                            style={{ width: `${(client.task_counts.in_progress / client.total_tasks) * 100}%` }}
                          />
                        )}
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <Badge className="bg-[#71717a]/20 text-[#71717a] text-xs">
                          {client.task_counts?.todo || 0} To Do
                        </Badge>
                        <Badge className="bg-[#3b82f6]/20 text-[#3b82f6] text-xs">
                          {client.task_counts?.in_progress || 0} In Progress
                        </Badge>
                        <Badge className="bg-[#22c55e]/20 text-[#22c55e] text-xs">
                          {client.task_counts?.done || 0} Done
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {filteredClients.length === 0 && (
                <div className={`col-span-full text-center py-12 ${textSecondary}`}>
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No clients found. Add your first SEO client!</p>
                </div>
              )}
            </div>
          </div>

          {/* Client Modal */}
          <ClientModal
            show={showClientModal}
            onClose={() => setShowClientModal(false)}
            onSave={saveClient}
            form={clientForm}
            setForm={setClientForm}
            editing={editingClient}
            teamMembers={teamMembers}
            isDark={isDark}
            bgCard={bgCard}
            bgSecondary={bgSecondary}
            textPrimary={textPrimary}
            textSecondary={textSecondary}
            borderColor={borderColor}
          />
        </div>
      </Layout>
    );
  }

  // ============== BOARD VIEW ==============
  return (
    <Layout>
      <div className={`min-h-screen ${isDark ? 'bg-[#09090b]' : 'bg-gray-50'}`}>
        {/* Header */}
        <div className={`p-6 border-b ${borderColor}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={backToClients} className={textSecondary}>
                <ChevronLeft className="h-5 w-5 mr-1" />
                Back
              </Button>
              <div>
                <h1 className={`text-2xl font-bold ${textPrimary}`}>{selectedClient?.name}</h1>
                <a 
                  href={selectedClient?.website} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm text-[#3b82f6] hover:underline flex items-center gap-1"
                >
                  <Globe className="h-3 w-3" />
                  {selectedClient?.website}
                </a>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={openTemplateModal} variant="outline" className={`border ${borderColor}`}>
                <Plus className="h-4 w-4 mr-2" />
                Add from Template
              </Button>
              <Button onClick={() => openAddTaskModal()} className="bg-[#f59e0b] hover:bg-[#d97706]">
                <Plus className="h-4 w-4 mr-2" />
                Add Task
              </Button>
            </div>
          </div>
        </div>

        {/* Category Filter */}
        <div className="px-6 pt-4">
          <div className="flex gap-2 flex-wrap">
            <Button
              size="sm"
              onClick={() => setActiveCategory('all')}
              className={activeCategory === 'all' ? 'bg-[#6366f1]' : `${bgSecondary} ${textSecondary}`}
            >
              All
            </Button>
            {Object.entries(CATEGORIES).map(([key, config]) => {
              const Icon = config.icon;
              return (
                <Button
                  key={key}
                  size="sm"
                  onClick={() => setActiveCategory(key)}
                  style={activeCategory === key ? { backgroundColor: config.color } : {}}
                  className={activeCategory !== key ? `${bgSecondary} ${textSecondary}` : ''}
                >
                  <Icon className="h-3 w-3 mr-1" />
                  {config.name}
                </Button>
              );
            })}
          </div>
        </div>

        {/* Kanban Board */}
        <div className="p-6 overflow-x-auto">
          <div className="flex gap-4 min-w-max">
            {Object.entries(STATUS_CONFIG).map(([status, config]) => (
              <div key={status} className={`w-80 flex-shrink-0`}>
                <div className={`${bgCard} rounded-t-lg p-3 border ${borderColor} border-b-0`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: config.color }} />
                      <h3 className={`font-semibold ${textPrimary}`}>{config.name}</h3>
                    </div>
                    <Badge className={`${bgSecondary}`}>
                      {getFilteredTasks(tasks[status] || []).length}
                    </Badge>
                  </div>
                </div>
                
                <div className={`${bgSecondary} rounded-b-lg border ${borderColor} border-t-0 p-2 min-h-[500px] space-y-2`}>
                  {getFilteredTasks(tasks[status] || []).map((task) => (
                    <TaskCard
                      key={task.task_id}
                      task={task}
                      onEdit={() => openEditTaskModal(task)}
                      onDelete={() => deleteTask(task.task_id)}
                      onStatusChange={(newStatus) => updateTaskStatus(task.task_id, newStatus)}
                      teamMembers={teamMembers}
                      isDark={isDark}
                      bgCard={bgCard}
                      textPrimary={textPrimary}
                      textSecondary={textSecondary}
                      borderColor={borderColor}
                    />
                  ))}
                  
                  {getFilteredTasks(tasks[status] || []).length === 0 && (
                    <div className={`text-center py-8 ${textSecondary} text-sm`}>
                      No tasks
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Task Modal */}
        <TaskModal
          show={showTaskModal}
          onClose={() => setShowTaskModal(false)}
          onSave={saveTask}
          form={taskForm}
          setForm={setTaskForm}
          editing={editingTask}
          teamMembers={teamMembers}
          isDark={isDark}
          bgCard={bgCard}
          bgSecondary={bgSecondary}
          textPrimary={textPrimary}
          textSecondary={textSecondary}
          borderColor={borderColor}
        />

        {/* Template Modal */}
        <TemplateModal
          show={showTemplateModal}
          onClose={() => setShowTemplateModal(false)}
          onAdd={addFromTemplate}
          templates={templates}
          isDark={isDark}
          bgCard={bgCard}
          bgSecondary={bgSecondary}
          textPrimary={textPrimary}
          textSecondary={textSecondary}
          borderColor={borderColor}
        />
      </div>
    </Layout>
  );
};

// ============== SUB COMPONENTS ==============

const TaskCard = ({ task, onEdit, onDelete, onStatusChange, teamMembers, isDark, bgCard, textPrimary, textSecondary, borderColor }) => {
  const category = CATEGORIES[task.category] || CATEGORIES.other;
  const priority = PRIORITIES[task.priority] || PRIORITIES.medium;
  const assignee = teamMembers.find(m => m.user_id === task.assigned_to);
  const Icon = category.icon;

  return (
    <div className={`${bgCard} rounded-lg p-3 border ${borderColor} hover:border-[#f59e0b]/30 transition-all group`}>
      <div className="flex items-start justify-between mb-2">
        <Badge style={{ backgroundColor: `${category.color}20`, color: category.color }} className="text-xs">
          <Icon className="h-3 w-3 mr-1" />
          {category.name}
        </Badge>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button size="sm" variant="ghost" onClick={onEdit} className="h-6 w-6 p-0">
            <Edit2 className="h-3 w-3" />
          </Button>
          <Button size="sm" variant="ghost" onClick={onDelete} className="h-6 w-6 p-0 text-red-400">
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
      
      <h4 className={`font-medium ${textPrimary} text-sm mb-1`}>{task.name}</h4>
      {task.description && (
        <p className={`text-xs ${textSecondary} mb-2 line-clamp-2`}>{task.description}</p>
      )}
      
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-2">
          <Badge style={{ backgroundColor: `${priority.color}20`, color: priority.color }} className="text-xs">
            {priority.name}
          </Badge>
          {task.due_date && (
            <span className={`text-xs ${textSecondary} flex items-center gap-1`}>
              <Calendar className="h-3 w-3" />
              {new Date(task.due_date).toLocaleDateString()}
            </span>
          )}
        </div>
        {assignee && (
          <div className="h-6 w-6 rounded-full bg-[#6366f1] flex items-center justify-center text-white text-xs" title={assignee.name}>
            {assignee.name.charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      {/* Quick status change */}
      <div className="flex gap-1 mt-2 pt-2 border-t border-dashed" style={{ borderColor: isDark ? '#3f3f46' : '#e5e7eb' }}>
        {Object.entries(STATUS_CONFIG).map(([status, config]) => (
          <button
            key={status}
            onClick={() => onStatusChange(status)}
            className={`flex-1 py-1 text-xs rounded transition-all ${
              task.status === status 
                ? 'text-white' 
                : `${textSecondary} hover:bg-[#27272a]`
            }`}
            style={task.status === status ? { backgroundColor: config.color } : {}}
          >
            {config.name}
          </button>
        ))}
      </div>
    </div>
  );
};

const ClientModal = ({ show, onClose, onSave, form, setForm, editing, teamMembers, isDark, bgCard, bgSecondary, textPrimary, textSecondary, borderColor }) => {
  if (!show) return null;

  return (
    <Dialog open={show} onOpenChange={onClose}>
      <DialogContent className={`${bgCard} ${textPrimary} max-w-md`}>
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Client' : 'Add SEO Client'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className={`text-sm ${textSecondary} block mb-1`}>Client Name *</label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g., ABC Company"
              className={bgSecondary}
            />
          </div>
          <div>
            <label className={`text-sm ${textSecondary} block mb-1`}>Website *</label>
            <Input
              value={form.website}
              onChange={(e) => setForm({ ...form, website: e.target.value })}
              placeholder="https://example.com"
              className={bgSecondary}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={`text-sm ${textSecondary} block mb-1`}>Contact Email</label>
              <Input
                value={form.contact_email}
                onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
                placeholder="email@example.com"
                className={bgSecondary}
              />
            </div>
            <div>
              <label className={`text-sm ${textSecondary} block mb-1`}>Contact Phone</label>
              <Input
                value={form.contact_phone}
                onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
                placeholder="+91 9999999999"
                className={bgSecondary}
              />
            </div>
          </div>
          <div>
            <label className={`text-sm ${textSecondary} block mb-1`}>Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Additional notes..."
              rows={3}
              className={`w-full p-2 rounded-lg ${bgSecondary} border ${borderColor} ${textPrimary}`}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={onSave} className="bg-[#f59e0b] hover:bg-[#d97706]">
            {editing ? 'Update' : 'Add Client'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const TaskModal = ({ show, onClose, onSave, form, setForm, editing, teamMembers, isDark, bgCard, bgSecondary, textPrimary, textSecondary, borderColor }) => {
  if (!show) return null;

  return (
    <Dialog open={show} onOpenChange={onClose}>
      <DialogContent className={`${bgCard} ${textPrimary} max-w-md`}>
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Task' : 'Add Task'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className={`text-sm ${textSecondary} block mb-1`}>Task Name *</label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g., Optimize meta tags"
              className={bgSecondary}
            />
          </div>
          <div>
            <label className={`text-sm ${textSecondary} block mb-1`}>Category</label>
            <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
              <SelectTrigger className={bgSecondary}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className={`${bgCard} border ${borderColor}`}>
                {Object.entries(CATEGORIES).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: config.color }} />
                      {config.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className={`text-sm ${textSecondary} block mb-1`}>Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Task details..."
              rows={3}
              className={`w-full p-2 rounded-lg ${bgSecondary} border ${borderColor} ${textPrimary}`}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={`text-sm ${textSecondary} block mb-1`}>Assigned To</label>
              <Select value={form.assigned_to} onValueChange={(v) => setForm({ ...form, assigned_to: v })}>
                <SelectTrigger className={bgSecondary}>
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent className={`${bgCard} border ${borderColor}`}>
                  <SelectItem value="">Unassigned</SelectItem>
                  {teamMembers.map((member) => (
                    <SelectItem key={member.user_id} value={member.user_id}>
                      {member.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className={`text-sm ${textSecondary} block mb-1`}>Priority</label>
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                <SelectTrigger className={bgSecondary}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className={`${bgCard} border ${borderColor}`}>
                  {Object.entries(PRIORITIES).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: config.color }} />
                        {config.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label className={`text-sm ${textSecondary} block mb-1`}>Due Date</label>
            <Input
              type="date"
              value={form.due_date}
              onChange={(e) => setForm({ ...form, due_date: e.target.value })}
              className={bgSecondary}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={onSave} className="bg-[#f59e0b] hover:bg-[#d97706]">
            {editing ? 'Update' : 'Add Task'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const TemplateModal = ({ show, onClose, onAdd, templates, isDark, bgCard, bgSecondary, textPrimary, textSecondary, borderColor }) => {
  if (!show) return null;

  return (
    <Dialog open={show} onOpenChange={onClose}>
      <DialogContent className={`${bgCard} ${textPrimary} max-w-2xl max-h-[80vh] overflow-y-auto`}>
        <DialogHeader>
          <DialogTitle>Add Tasks from Template</DialogTitle>
        </DialogHeader>
        <p className={`text-sm ${textSecondary} mb-4`}>
          Click a category to add all predefined tasks for that SEO activity.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(CATEGORIES).map(([key, config]) => {
            const Icon = config.icon;
            const categoryTemplates = templates[key] || [];
            return (
              <Card 
                key={key} 
                className={`${bgSecondary} border ${borderColor} hover:border-[#f59e0b]/50 cursor-pointer transition-all`}
                onClick={() => onAdd(key)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div 
                      className="h-10 w-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: `${config.color}20` }}
                    >
                      <Icon className="h-5 w-5" style={{ color: config.color }} />
                    </div>
                    <div>
                      <h4 className={`font-semibold ${textPrimary}`}>{config.name}</h4>
                      <p className={`text-xs ${textSecondary}`}>{categoryTemplates.length} tasks</p>
                    </div>
                  </div>
                  <div className="space-y-1">
                    {categoryTemplates.slice(0, 3).map((t, i) => (
                      <p key={i} className={`text-xs ${textSecondary} truncate`}>• {t.name}</p>
                    ))}
                    {categoryTemplates.length > 3 && (
                      <p className={`text-xs ${textSecondary}`}>+ {categoryTemplates.length - 3} more...</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SEOBoardPage;
