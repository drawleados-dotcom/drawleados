import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Progress } from '../components/ui/progress';
import { Checkbox } from '../components/ui/checkbox';
import {
  Plus,
  Globe,
  Search,
  BarChart3,
  Target,
  RefreshCw,
  ChevronRight,
  Calendar,
  Clock,
  User,
  CheckCircle2,
  Circle,
  MoreHorizontal,
  Trash2,
  Edit2,
  Link2,
  ArrowLeft,
  GripVertical,
  AlertCircle,
  Smartphone
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

const serviceIcons = {
  website: Globe,
  seo: Search,
  sem: BarChart3,
  meta_ads: Target,
  social_media: Smartphone
};

const priorityColors = {
  high: 'bg-[#ef4444]/20 text-[#ef4444]',
  medium: 'bg-[#f59e0b]/20 text-[#f59e0b]',
  low: 'bg-[#71717a]/20 text-[#71717a]'
};

const SOPWorksBoard = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [templates, setTemplates] = useState([]);
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isAddServiceModalOpen, setIsAddServiceModalOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [selectedServiceType, setSelectedServiceType] = useState(null);
  
  const [newProject, setNewProject] = useState({
    name: '',
    service_type: '',
    client_id: '',
    client_name: '',
    start_date: '',
    due_date: '',
    description: '',
    auto_create_tasks: true
  });

  const [taskForm, setTaskForm] = useState({
    title: '',
    stage: '',
    priority: 'medium',
    estimated_hours: 1,
    assigned_to: '',
    due_date: '',
    notes: ''
  });

  const token = localStorage.getItem('session_token');

  // Load data
  const loadDashboard = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/sop/dashboard`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDashboard(res.data);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    }
  }, [token]);

  const loadTemplates = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/sop/templates`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTemplates(res.data);
    } catch (error) {
      console.error('Error loading templates:', error);
    }
  }, [token]);

  const loadProjects = useCallback(async (serviceType = null) => {
    try {
      const url = serviceType 
        ? `${API}/api/sop/projects?service_type=${serviceType}`
        : `${API}/api/sop/projects`;
      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProjects(res.data);
    } catch (error) {
      console.error('Error loading projects:', error);
    }
  }, [token]);

  const loadProjectDetails = useCallback(async (projectId) => {
    try {
      const res = await axios.get(`${API}/api/sop/projects/${projectId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSelectedProject(res.data);
    } catch (error) {
      console.error('Error loading project:', error);
      toast.error('Failed to load project');
    }
  }, [token]);

  const loadClients = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/sop/clients`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setClients(res.data);
    } catch (error) {
      console.error('Error loading clients:', error);
    }
  }, [token]);

  // Initial load
  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      await Promise.all([loadDashboard(), loadTemplates(), loadProjects(), loadClients()]);
      setLoading(false);
    };
    loadAll();
  }, [loadDashboard, loadTemplates, loadProjects, loadClients]);

  // Handle URL parameters
  useEffect(() => {
    const serviceParam = searchParams.get('service');
    const actionParam = searchParams.get('action');
    
    if (serviceParam && templates.length > 0) {
      // Navigate to service tab and load projects
      const validServices = ['website', 'seo', 'sem', 'meta_ads', 'social_media'];
      if (validServices.includes(serviceParam)) {
        setActiveTab(serviceParam);
        loadProjects(serviceParam);
      }
    }
    
    if (actionParam === 'add-service') {
      setIsAddServiceModalOpen(true);
      // Clear the URL param
      searchParams.delete('action');
      setSearchParams(searchParams);
    }
  }, [searchParams, templates, loadProjects, setSearchParams]);

  // Actions
  const createProject = async () => {
    if (!newProject.name || !newProject.service_type) {
      toast.error('Project name and service type are required');
      return;
    }

    try {
      const res = await axios.post(`${API}/api/sop/projects`, newProject, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(`Project created with ${res.data.tasks_created} tasks!`);
      setIsCreateModalOpen(false);
      setNewProject({
        name: '',
        service_type: '',
        client_id: '',
        client_name: '',
        start_date: '',
        due_date: '',
        description: '',
        auto_create_tasks: true
      });
      loadProjects();
      loadDashboard();
    } catch (error) {
      console.error('Error creating project:', error);
      toast.error('Failed to create project');
    }
  };

  const updateTask = async (taskId, updates) => {
    try {
      await axios.put(`${API}/api/sop/tasks/${taskId}`, updates, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (selectedProject) {
        loadProjectDetails(selectedProject.project_id);
      }
    } catch (error) {
      console.error('Error updating task:', error);
      toast.error('Failed to update task');
    }
  };

  const toggleTaskComplete = async (taskId, isCompleted) => {
    await updateTask(taskId, { is_completed: !isCompleted });
  };

  const moveTaskToStage = async (taskId, newStage) => {
    try {
      await axios.put(`${API}/api/sop/tasks/${taskId}/move?stage=${newStage}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (selectedProject) {
        loadProjectDetails(selectedProject.project_id);
      }
    } catch (error) {
      console.error('Error moving task:', error);
      toast.error('Failed to move task');
    }
  };

  const deleteProject = async (projectId) => {
    if (!window.confirm('Delete this project and all its tasks?')) return;
    
    try {
      await axios.delete(`${API}/api/sop/projects/${projectId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Project deleted');
      setSelectedProject(null);
      loadProjects();
      loadDashboard();
    } catch (error) {
      console.error('Error deleting project:', error);
      toast.error('Failed to delete project');
    }
  };

  const openProjectBoard = (project) => {
    loadProjectDetails(project.project_id);
    setActiveTab('board');
  };

  const openCreateModal = (serviceType = null) => {
    setNewProject(prev => ({
      ...prev,
      service_type: serviceType || ''
    }));
    setIsCreateModalOpen(true);
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-[#6366f1]" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6" data-testid="sop-works-board">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight mb-2" style={{ fontFamily: 'Plus Jakarta Sans' }}>
              <span className="bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] bg-clip-text text-transparent">
                SOP Works Board
              </span>
            </h1>
            <p className="text-[#a1a1aa] text-base">
              Service-based project management with pre-built task templates
            </p>
          </div>
          <Button
            onClick={() => openCreateModal()}
            data-testid="create-project-btn"
            className="bg-[#6366f1] hover:bg-[#5558dd]"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Project
          </Button>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-[#18181b] border border-[#27272a] p-1 flex-wrap">
            <TabsTrigger
              value="dashboard"
              className="data-[state=active]:bg-[#6366f1] data-[state=active]:text-white"
            >
              Dashboard
            </TabsTrigger>
            <TabsTrigger
              value="website"
              className="data-[state=active]:bg-[#6366f1] data-[state=active]:text-white flex items-center gap-2"
            >
              <Globe className="h-4 w-4" />
              Website
            </TabsTrigger>
            <TabsTrigger
              value="seo"
              className="data-[state=active]:bg-[#10b981] data-[state=active]:text-white flex items-center gap-2"
            >
              <Search className="h-4 w-4" />
              SEO
            </TabsTrigger>
            <TabsTrigger
              value="social_media"
              className="data-[state=active]:bg-[#ec4899] data-[state=active]:text-white flex items-center gap-2"
            >
              <Smartphone className="h-4 w-4" />
              Social Media
            </TabsTrigger>
            <TabsTrigger
              value="meta_ads"
              className="data-[state=active]:bg-[#3b82f6] data-[state=active]:text-white flex items-center gap-2"
            >
              <Target className="h-4 w-4" />
              Meta Ads
            </TabsTrigger>
            {selectedProject && (
              <TabsTrigger
                value="board"
                className="data-[state=active]:bg-[#8b5cf6] data-[state=active]:text-white flex items-center gap-2"
              >
                Project Board
              </TabsTrigger>
            )}
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="mt-6">
            {dashboard && (
              <div className="space-y-6">
                {/* Service Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {dashboard.service_stats.map((service) => {
                    const Icon = serviceIcons[service.service_type];
                    return (
                      <Card 
                        key={service.service_type}
                        className="bg-[#18181b] border-[#27272a] hover:border-[#3f3f46] cursor-pointer transition-all"
                        onClick={() => {
                          setSelectedServiceType(service.service_type);
                          loadProjects(service.service_type);
                          setActiveTab(service.service_type);
                        }}
                      >
                        <CardContent className="p-5">
                          <div className="flex items-center gap-4">
                            <div 
                              className="h-12 w-12 rounded-xl flex items-center justify-center"
                              style={{ background: `${service.color}20` }}
                            >
                              <Icon className="h-6 w-6" style={{ color: service.color }} />
                            </div>
                            <div>
                              <p className="text-lg font-semibold text-[#fafafa]">{service.name}</p>
                              <div className="flex items-center gap-3 mt-1">
                                <span className="text-sm text-[#10b981]">{service.active_projects} Active</span>
                                <span className="text-sm text-[#71717a]">{service.completed_projects} Done</span>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>

                {/* Overall Stats */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Card className="bg-[#18181b] border-[#27272a]">
                    <CardContent className="p-4">
                      <p className="text-sm text-[#71717a]">Total Projects</p>
                      <p className="text-2xl font-bold text-[#fafafa]">{dashboard.overall.total_projects}</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-[#18181b] border-[#27272a]">
                    <CardContent className="p-4">
                      <p className="text-sm text-[#71717a]">Active Projects</p>
                      <p className="text-2xl font-bold text-[#10b981]">{dashboard.overall.active_projects}</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-[#18181b] border-[#27272a]">
                    <CardContent className="p-4">
                      <p className="text-sm text-[#71717a]">Total Tasks</p>
                      <p className="text-2xl font-bold text-[#fafafa]">{dashboard.overall.total_tasks}</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-[#18181b] border-[#27272a]">
                    <CardContent className="p-4">
                      <p className="text-sm text-[#71717a]">Task Completion</p>
                      <p className="text-2xl font-bold text-[#6366f1]">{dashboard.overall.task_completion_rate}%</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Recent Projects */}
                {dashboard.recent_active_projects.length > 0 && (
                  <Card className="bg-[#18181b] border-[#27272a]">
                    <CardHeader>
                      <CardTitle className="text-[#fafafa]">Recent Active Projects</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {dashboard.recent_active_projects.map((project) => (
                          <div 
                            key={project.project_id}
                            className="flex items-center justify-between p-3 bg-[#0c0a09] rounded-lg hover:bg-[#1c1917] cursor-pointer transition-colors"
                            onClick={() => openProjectBoard(project)}
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-xl">{project.service_icon}</span>
                              <div>
                                <p className="text-[#fafafa] font-medium">{project.name}</p>
                                <p className="text-xs text-[#71717a]">
                                  {project.client_name || 'No client linked'} • {project.service_name}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="w-32">
                                <Progress value={project.progress} className="h-2" />
                              </div>
                              <span className="text-sm text-[#a1a1aa] w-12">{project.progress}%</span>
                              <ChevronRight className="h-4 w-4 text-[#52525b]" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Template Overview */}
                <Card className="bg-[#18181b] border-[#27272a]">
                  <CardHeader>
                    <CardTitle className="text-[#fafafa]">Available SOP Templates</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {templates.map((template) => {
                        const Icon = serviceIcons[template.service_type];
                        return (
                          <div 
                            key={template.service_type}
                            className="p-4 bg-[#0c0a09] rounded-lg border border-[#27272a]"
                          >
                            <div className="flex items-center gap-2 mb-3">
                              <Icon className="h-5 w-5" style={{ color: template.color }} />
                              <span className="font-medium text-[#fafafa]">{template.name}</span>
                            </div>
                            <div className="space-y-2 text-sm text-[#71717a]">
                              <p>{template.task_count} pre-built tasks</p>
                              <p>{template.total_hours}h estimated</p>
                              <p>{template.stages.length} workflow stages</p>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              className="w-full mt-3 border-[#27272a]"
                              onClick={() => openCreateModal(template.service_type)}
                            >
                              Use Template
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* Service-specific Tabs */}
          {['website', 'seo', 'social_media', 'meta_ads'].map((serviceType) => (
            <TabsContent key={serviceType} value={serviceType} className="mt-6">
              <ServiceProjectList
                serviceType={serviceType}
                template={templates.find(t => t.service_type === serviceType)}
                projects={projects.filter(p => p.service_type === serviceType)}
                onOpenProject={openProjectBoard}
                onCreateProject={() => openCreateModal(serviceType)}
                onRefresh={() => loadProjects(serviceType)}
              />
            </TabsContent>
          ))}

          {/* Project Board Tab */}
          <TabsContent value="board" className="mt-6">
            {selectedProject && (
              <ProjectKanbanBoard
                project={selectedProject}
                onBack={() => {
                  setSelectedProject(null);
                  setActiveTab(selectedProject.service_type);
                }}
                onToggleTask={toggleTaskComplete}
                onMoveTask={moveTaskToStage}
                onUpdateTask={updateTask}
                onDeleteProject={deleteProject}
                onRefresh={() => loadProjectDetails(selectedProject.project_id)}
              />
            )}
          </TabsContent>
        </Tabs>

        {/* Create Project Modal */}
        <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <DialogContent className="bg-[#18181b] border-[#27272a] max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-[#fafafa]">Create New Project</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm text-[#a1a1aa] mb-1 block">Project Name *</label>
                <Input
                  value={newProject.name}
                  onChange={(e) => setNewProject(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., ABC Corp Website Redesign"
                  className="bg-[#0c0a09] border-[#27272a]"
                />
              </div>
              
              <div>
                <label className="text-sm text-[#a1a1aa] mb-1 block">Service Type *</label>
                <Select 
                  value={newProject.service_type} 
                  onValueChange={(v) => setNewProject(prev => ({ ...prev, service_type: v }))}
                >
                  <SelectTrigger className="bg-[#0c0a09] border-[#27272a]">
                    <SelectValue placeholder="Select service type" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#18181b] border-[#27272a]">
                    {templates.map((t) => (
                      <SelectItem key={t.service_type} value={t.service_type}>
                        <span className="flex items-center gap-2">
                          {t.icon} {t.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm text-[#a1a1aa] mb-1 block">Link to Client</label>
                <Select 
                  value={newProject.client_id} 
                  onValueChange={(v) => {
                    const client = clients.find(c => c.lead_id === v);
                    setNewProject(prev => ({ 
                      ...prev, 
                      client_id: v,
                      client_name: client ? `${client.name} - ${client.business_name}` : ''
                    }));
                  }}
                >
                  <SelectTrigger className="bg-[#0c0a09] border-[#27272a]">
                    <SelectValue placeholder="Select client (optional)" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#18181b] border-[#27272a]">
                    <SelectItem value="none">No client</SelectItem>
                    {clients.map((client) => (
                      <SelectItem key={client.lead_id} value={client.lead_id}>
                        {client.name} - {client.business_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-[#a1a1aa] mb-1 block">Start Date</label>
                  <Input
                    type="date"
                    value={newProject.start_date}
                    onChange={(e) => setNewProject(prev => ({ ...prev, start_date: e.target.value }))}
                    className="bg-[#0c0a09] border-[#27272a]"
                  />
                </div>
                <div>
                  <label className="text-sm text-[#a1a1aa] mb-1 block">Due Date</label>
                  <Input
                    type="date"
                    value={newProject.due_date}
                    onChange={(e) => setNewProject(prev => ({ ...prev, due_date: e.target.value }))}
                    className="bg-[#0c0a09] border-[#27272a]"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm text-[#a1a1aa] mb-1 block">Description</label>
                <Textarea
                  value={newProject.description}
                  onChange={(e) => setNewProject(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Project description..."
                  className="bg-[#0c0a09] border-[#27272a]"
                />
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="auto_tasks"
                  checked={newProject.auto_create_tasks}
                  onCheckedChange={(checked) => setNewProject(prev => ({ ...prev, auto_create_tasks: checked }))}
                />
                <label htmlFor="auto_tasks" className="text-sm text-[#a1a1aa]">
                  Auto-create tasks from SOP template
                </label>
              </div>

              {newProject.service_type && (
                <div className="p-3 bg-[#0c0a09] rounded-lg border border-[#27272a]">
                  <p className="text-xs text-[#71717a] mb-1">Template Preview</p>
                  {(() => {
                    const t = templates.find(t => t.service_type === newProject.service_type);
                    return t ? (
                      <p className="text-sm text-[#a1a1aa]">
                        {t.task_count} tasks • {t.stages.length} stages • {t.total_hours}h estimated
                      </p>
                    ) : null;
                  })()}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateModalOpen(false)} className="border-[#27272a]">
                Cancel
              </Button>
              <Button onClick={createProject} className="bg-[#6366f1] hover:bg-[#5558dd]">
                Create Project
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

// Service Project List Component
const ServiceProjectList = ({ serviceType, template, projects, onOpenProject, onCreateProject, onRefresh }) => {
  const Icon = serviceIcons[serviceType];
  
  return (
    <div className="space-y-6">
      {/* Service Header */}
      {template && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div 
              className="h-14 w-14 rounded-xl flex items-center justify-center"
              style={{ background: `${template.color}20` }}
            >
              <Icon className="h-7 w-7" style={{ color: template.color }} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-[#fafafa]">{template.name}</h2>
              <p className="text-sm text-[#71717a]">
                {template.task_count} tasks • {template.stages.length} stages • {template.total_hours}h template
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onRefresh} className="border-[#27272a]">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button onClick={onCreateProject} className="bg-[#6366f1] hover:bg-[#5558dd]">
              <Plus className="h-4 w-4 mr-2" />
              New {template.name} Project
            </Button>
          </div>
        </div>
      )}

      {/* Projects Grid */}
      {projects.length === 0 ? (
        <Card className="bg-[#18181b] border-[#27272a]">
          <CardContent className="p-12 text-center">
            <Icon className="h-12 w-12 mx-auto mb-4" style={{ color: template?.color || '#71717a' }} />
            <p className="text-[#71717a] mb-4">No {template?.name} projects yet</p>
            <Button onClick={onCreateProject} variant="outline" className="border-[#27272a]">
              Create your first project
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <Card 
              key={project.project_id}
              className="bg-[#18181b] border-[#27272a] hover:border-[#3f3f46] cursor-pointer transition-all"
              onClick={() => onOpenProject(project)}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{project.service_icon}</span>
                    <Badge 
                      className={project.status === 'active' 
                        ? 'bg-[#10b981]/20 text-[#10b981]' 
                        : project.status === 'completed'
                        ? 'bg-[#6366f1]/20 text-[#6366f1]'
                        : 'bg-[#71717a]/20 text-[#71717a]'
                      }
                    >
                      {project.status}
                    </Badge>
                  </div>
                </div>
                <h3 className="text-lg font-medium text-[#fafafa] mb-1">{project.name}</h3>
                {project.client_name && (
                  <p className="text-sm text-[#71717a] flex items-center gap-1 mb-3">
                    <Link2 className="h-3 w-3" />
                    {project.client_name}
                  </p>
                )}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#71717a]">Progress</span>
                    <span className="text-[#fafafa]">{project.progress}%</span>
                  </div>
                  <Progress value={project.progress} className="h-2" />
                  <div className="flex items-center justify-between text-xs text-[#52525b]">
                    <span>{project.completed_count}/{project.task_count} tasks</span>
                    {project.due_date && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {project.due_date}
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

// Project Kanban Board Component
const ProjectKanbanBoard = ({ project, onBack, onToggleTask, onMoveTask, onUpdateTask, onDeleteProject, onRefresh }) => {
  return (
    <div className="space-y-6">
      {/* Project Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={onBack} className="text-[#71717a]">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <span className="text-2xl">{project.service_icon}</span>
              <h2 className="text-2xl font-bold text-[#fafafa]">{project.name}</h2>
              <Badge className={project.status === 'active' ? 'bg-[#10b981]/20 text-[#10b981]' : 'bg-[#71717a]/20 text-[#71717a]'}>
                {project.status}
              </Badge>
            </div>
            {project.client_name && (
              <p className="text-sm text-[#71717a] flex items-center gap-1 mt-1">
                <Link2 className="h-3 w-3" />
                {project.client_name}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onRefresh} className="border-[#27272a]">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button 
            variant="outline" 
            onClick={() => onDeleteProject(project.project_id)}
            className="border-[#ef4444]/50 text-[#ef4444] hover:bg-[#ef4444]/10"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="bg-[#18181b] border-[#27272a]">
          <CardContent className="p-4">
            <p className="text-sm text-[#71717a]">Progress</p>
            <p className="text-2xl font-bold text-[#6366f1]">{project.stats.progress}%</p>
          </CardContent>
        </Card>
        <Card className="bg-[#18181b] border-[#27272a]">
          <CardContent className="p-4">
            <p className="text-sm text-[#71717a]">Tasks Done</p>
            <p className="text-2xl font-bold text-[#10b981]">
              {project.stats.completed_tasks}/{project.stats.total_tasks}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-[#18181b] border-[#27272a]">
          <CardContent className="p-4">
            <p className="text-sm text-[#71717a]">Estimated Hours</p>
            <p className="text-2xl font-bold text-[#fafafa]">{project.stats.total_estimated_hours}h</p>
          </CardContent>
        </Card>
        <Card className="bg-[#18181b] border-[#27272a]">
          <CardContent className="p-4">
            <p className="text-sm text-[#71717a]">Actual Hours</p>
            <p className="text-2xl font-bold text-[#f59e0b]">{project.stats.total_actual_hours}h</p>
          </CardContent>
        </Card>
      </div>

      {/* Kanban Board */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {project.stages.map((stage) => {
          const stageTasks = project.tasks_by_stage[stage.id] || [];
          const completedInStage = stageTasks.filter(t => t.is_completed).length;
          
          return (
            <div 
              key={stage.id}
              className="flex-shrink-0 w-72 bg-[#0c0a09] rounded-lg"
            >
              {/* Stage Header */}
              <div 
                className="p-3 border-b border-[#27272a] flex items-center justify-between"
                style={{ borderTopColor: stage.color, borderTopWidth: '3px', borderTopStyle: 'solid', borderRadius: '8px 8px 0 0' }}
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium text-[#fafafa]">{stage.name}</span>
                  <Badge className="bg-[#27272a] text-[#a1a1aa]">
                    {completedInStage}/{stageTasks.length}
                  </Badge>
                </div>
              </div>
              
              {/* Tasks */}
              <div className="p-2 space-y-2 min-h-[300px] max-h-[500px] overflow-y-auto">
                {stageTasks.map((task) => (
                  <div 
                    key={task.task_id}
                    className={`p-3 bg-[#18181b] border border-[#27272a] rounded-lg hover:border-[#3f3f46] transition-colors ${
                      task.is_completed ? 'opacity-60' : ''
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <button
                        onClick={() => onToggleTask(task.task_id, task.is_completed)}
                        className="mt-0.5 flex-shrink-0"
                      >
                        {task.is_completed ? (
                          <CheckCircle2 className="h-5 w-5 text-[#10b981]" />
                        ) : (
                          <Circle className="h-5 w-5 text-[#52525b] hover:text-[#a1a1aa]" />
                        )}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm text-[#fafafa] ${task.is_completed ? 'line-through' : ''}`}>
                          {task.title}
                        </p>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <Badge className={priorityColors[task.priority]}>
                            {task.priority}
                          </Badge>
                          <span className="text-xs text-[#52525b] flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {task.estimated_hours}h
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Move to Stage Dropdown */}
                    <div className="mt-2 pt-2 border-t border-[#27272a]">
                      <Select
                        value={task.stage}
                        onValueChange={(newStage) => onMoveTask(task.task_id, newStage)}
                      >
                        <SelectTrigger className="h-7 text-xs bg-transparent border-0 text-[#71717a]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[#18181b] border-[#27272a]">
                          {project.stages.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              Move to {s.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
                
                {stageTasks.length === 0 && (
                  <div className="p-4 text-center text-[#52525b] text-sm">
                    No tasks in this stage
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SOPWorksBoard;
