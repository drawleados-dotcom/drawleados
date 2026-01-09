import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import api from '../utils/api';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Plus, Search, FolderKanban, List, Clock, BarChart3, Filter } from 'lucide-react';
import ProjectsListView from '../components/operations/ProjectsListView';
import ProjectsKanbanView from '../components/operations/ProjectsKanbanView';
import TasksListView from '../components/operations/TasksListView';
import TasksKanbanView from '../components/operations/TasksKanbanView';
import ProductivityDashboard from '../components/operations/ProductivityDashboard';
import ProjectFormModal from '../components/operations/ProjectFormModal';
import TaskFormModal from '../components/operations/TaskFormModal';
import { toast } from 'sonner';

const OperationsPage = () => {
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [services, setServices] = useState([]);
  const [users, setUsers] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('projects');
  const [activeView, setActiveView] = useState('kanban');
  const [selectedServiceType, setSelectedServiceType] = useState('all');
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [productivityStats, setProductivityStats] = useState(null);

  // Service types for filtering
  const serviceTypes = [
    { value: 'all', label: 'All Services' },
    { value: 'website', label: 'Website Development' },
    { value: 'shopify', label: 'Shopify Stores' },
    { value: 'performance_marketing', label: 'Performance Marketing' },
    { value: 'social_media', label: 'Social Media Marketing' },
    { value: 'whatsapp', label: 'WhatsApp Marketing' },
    { value: 'other', label: 'Other Services' },
  ];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [projectsRes, tasksRes, servicesRes, usersRes, clientsRes, statsRes] = await Promise.all([
        api.get('/operations/projects'),
        api.get('/operations/tasks'),
        api.get('/services'),
        api.get('/users').catch(() => ({ data: [] })),
        api.get('/leads').catch(() => ({ data: [] })),
        api.get('/operations/productivity/overview').catch(() => ({ data: null })),
      ]);
      setProjects(projectsRes.data);
      setTasks(tasksRes.data);
      setServices(servicesRes.data);
      setUsers(usersRes.data || []);
      setClients(clientsRes.data || []);
      setProductivityStats(statsRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load operations data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = () => {
    setSelectedProject(null);
    setShowProjectModal(true);
  };

  const handleEditProject = (project) => {
    setSelectedProject(project);
    setShowProjectModal(true);
  };

  const handleSaveProject = async () => {
    await fetchData();
    setShowProjectModal(false);
    setSelectedProject(null);
  };

  const handleDeleteProject = async (projectId) => {
    if (!window.confirm('Are you sure you want to delete this project?')) return;
    try {
      await api.delete(`/operations/projects/${projectId}`);
      toast.success('Project deleted');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete project');
    }
  };

  const handleCreateTask = (project = null) => {
    setSelectedTask(null);
    setSelectedProject(project);
    setShowTaskModal(true);
  };

  const handleEditTask = (task) => {
    setSelectedTask(task);
    setShowTaskModal(true);
  };

  const handleSaveTask = async () => {
    await fetchData();
    setShowTaskModal(false);
    setSelectedTask(null);
    setSelectedProject(null);
  };

  const handleDeleteTask = async (taskId) => {
    if (!window.confirm('Are you sure you want to delete this task?')) return;
    try {
      await api.delete(`/operations/tasks/${taskId}`);
      toast.success('Task deleted');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete task');
    }
  };

  // Filter data based on search and service type
  const filteredProjects = projects.filter((project) => {
    const matchesSearch = searchTerm === '' || 
      project.project_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.client_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesService = selectedServiceType === 'all' || project.service_type === selectedServiceType;
    return matchesSearch && matchesService;
  });

  const filteredTasks = tasks.filter((task) => {
    const matchesSearch = searchTerm === '' ||
      task.task_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.project_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesService = selectedServiceType === 'all' || task.service_type === selectedServiceType;
    return matchesSearch && matchesService;
  });

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <p className="text-[#a1a1aa]">Loading operations...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6" data-testid="operations-page">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1
              className="text-4xl font-bold tracking-tight mb-2"
              style={{ fontFamily: 'Plus Jakarta Sans' }}
            >
              <span className="bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] bg-clip-text text-transparent">
                Operations
              </span>
            </h1>
            <p className="text-[#a1a1aa] text-base">
              Manage projects, tasks, and team productivity
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              onClick={() => handleCreateTask()}
              data-testid="create-task-button"
              className="bg-[#27272a] hover:bg-[#3f3f46] text-[#fafafa] border border-[#3f3f46]"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Task
            </Button>
            <Button
              onClick={handleCreateProject}
              data-testid="create-project-button"
              className="bg-[#6366f1] hover:bg-[#4f46e5] text-white glow-primary"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Project
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        {productivityStats && (
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-4">
              <p className="text-xs text-[#a1a1aa] mb-1">Active Projects</p>
              <p className="text-2xl font-bold text-[#fafafa]">{productivityStats.active_projects}</p>
            </div>
            <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-4">
              <p className="text-xs text-[#a1a1aa] mb-1">Total Tasks</p>
              <p className="text-2xl font-bold text-[#fafafa]">{productivityStats.total_tasks}</p>
            </div>
            <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-4">
              <p className="text-xs text-[#a1a1aa] mb-1">In Progress</p>
              <p className="text-2xl font-bold text-[#10b981]">{productivityStats.in_progress_tasks}</p>
            </div>
            <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-4">
              <p className="text-xs text-[#a1a1aa] mb-1">Overdue</p>
              <p className="text-2xl font-bold text-[#ef4444]">{productivityStats.overdue_tasks}</p>
            </div>
          </div>
        )}

        {/* Search and Filters */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#a1a1aa]" />
            <Input
              placeholder="Search projects or tasks..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              data-testid="search-operations-input"
              className="pl-10 bg-[#18181b] border-[#27272a] text-[#fafafa] focus:border-[#6366f1]"
            />
          </div>
          <Select value={selectedServiceType} onValueChange={setSelectedServiceType}>
            <SelectTrigger className="w-[200px] bg-[#18181b] border-[#27272a] text-[#fafafa]" data-testid="service-filter">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filter by service" />
            </SelectTrigger>
            <SelectContent className="bg-[#18181b] border-[#27272a]">
              {serviceTypes.map((type) => (
                <SelectItem key={type.value} value={type.value} className="text-[#fafafa] focus:bg-[#27272a]">
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="bg-[#18181b] border border-[#27272a] p-1">
            <TabsTrigger
              value="projects"
              data-testid="projects-tab"
              className="data-[state=active]:bg-[#6366f1] data-[state=active]:text-white"
            >
              <FolderKanban className="h-4 w-4 mr-2" />
              Projects
            </TabsTrigger>
            <TabsTrigger
              value="tasks"
              data-testid="tasks-tab"
              className="data-[state=active]:bg-[#6366f1] data-[state=active]:text-white"
            >
              <List className="h-4 w-4 mr-2" />
              Tasks
            </TabsTrigger>
            <TabsTrigger
              value="productivity"
              data-testid="productivity-tab"
              className="data-[state=active]:bg-[#6366f1] data-[state=active]:text-white"
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              Productivity
            </TabsTrigger>
          </TabsList>

          {/* Projects Tab */}
          <TabsContent value="projects" className="mt-6">
            <Tabs value={activeView} onValueChange={setActiveView} className="w-full">
              <TabsList className="bg-[#09090b] border border-[#27272a] p-1 mb-4">
                <TabsTrigger
                  value="kanban"
                  data-testid="projects-kanban-view"
                  className="data-[state=active]:bg-[#27272a] data-[state=active]:text-white text-xs"
                >
                  Kanban
                </TabsTrigger>
                <TabsTrigger
                  value="list"
                  data-testid="projects-list-view"
                  className="data-[state=active]:bg-[#27272a] data-[state=active]:text-white text-xs"
                >
                  List
                </TabsTrigger>
              </TabsList>

              <TabsContent value="kanban">
                <ProjectsKanbanView
                  projects={filteredProjects}
                  onEditProject={handleEditProject}
                  onCreateTask={handleCreateTask}
                  onRefresh={fetchData}
                />
              </TabsContent>

              <TabsContent value="list">
                <ProjectsListView
                  projects={filteredProjects}
                  onEditProject={handleEditProject}
                  onDeleteProject={handleDeleteProject}
                  onCreateTask={handleCreateTask}
                />
              </TabsContent>
            </Tabs>
          </TabsContent>

          {/* Tasks Tab */}
          <TabsContent value="tasks" className="mt-6">
            <Tabs value={activeView} onValueChange={setActiveView} className="w-full">
              <TabsList className="bg-[#09090b] border border-[#27272a] p-1 mb-4">
                <TabsTrigger
                  value="kanban"
                  data-testid="tasks-kanban-view"
                  className="data-[state=active]:bg-[#27272a] data-[state=active]:text-white text-xs"
                >
                  Kanban
                </TabsTrigger>
                <TabsTrigger
                  value="list"
                  data-testid="tasks-list-view"
                  className="data-[state=active]:bg-[#27272a] data-[state=active]:text-white text-xs"
                >
                  List
                </TabsTrigger>
              </TabsList>

              <TabsContent value="kanban">
                <TasksKanbanView
                  tasks={filteredTasks}
                  onEditTask={handleEditTask}
                  onRefresh={fetchData}
                />
              </TabsContent>

              <TabsContent value="list">
                <TasksListView
                  tasks={filteredTasks}
                  onEditTask={handleEditTask}
                  onDeleteTask={handleDeleteTask}
                />
              </TabsContent>
            </Tabs>
          </TabsContent>

          {/* Productivity Tab */}
          <TabsContent value="productivity" className="mt-6">
            <ProductivityDashboard stats={productivityStats} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Project Modal */}
      {showProjectModal && (
        <ProjectFormModal
          project={selectedProject}
          services={services}
          users={users}
          clients={clients}
          onClose={() => setShowProjectModal(false)}
          onSave={handleSaveProject}
        />
      )}

      {/* Task Modal */}
      {showTaskModal && (
        <TaskFormModal
          task={selectedTask}
          projects={projects}
          users={users}
          defaultProject={selectedProject}
          onClose={() => setShowTaskModal(false)}
          onSave={handleSaveTask}
        />
      )}
    </Layout>
  );
};

export default OperationsPage;
