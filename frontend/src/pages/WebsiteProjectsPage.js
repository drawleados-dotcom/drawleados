import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Progress } from '../components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import {
  Plus,
  Globe,
  Calendar,
  Clock,
  User,
  ExternalLink,
  Link2,
  Folder,
  MessageSquare,
  Server,
  ChevronDown,
  ChevronUp,
  Search,
  Filter,
  Edit2,
  Trash2,
  CheckCircle,
  Circle,
  X,
  Image,
  FileText,
  ListTodo,
  LayoutGrid,
  Send,
  Check,
  AlertCircle
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

const STATUS_COLORS = {
  'To-Do': 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  'In Progress': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  'Client Review': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  'Client Approved': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  'Completed': 'bg-green-500/20 text-green-400 border-green-500/30',
  'On Hold': 'bg-orange-500/20 text-orange-400 border-orange-500/30'
};

const PRIORITY_COLORS = {
  low: 'bg-gray-500/20 text-gray-400',
  medium: 'bg-yellow-500/20 text-yellow-400',
  high: 'bg-red-500/20 text-red-400'
};

const STATUS_OPTIONS = ['To-Do', 'In Progress', 'Client Review', 'Client Approved', 'Completed', 'On Hold'];

const WebsiteProjectsPage = () => {
  const { isDark } = useTheme();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [projectDetail, setProjectDetail] = useState(null);
  const [projectTasks, setProjectTasks] = useState([]);
  const [options, setOptions] = useState(null);
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  
  // UI States
  const [activeTab, setActiveTab] = useState('pages');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isAddPageModalOpen, setIsAddPageModalOpen] = useState(false);
  const [isAddTaskModalOpen, setIsAddTaskModalOpen] = useState(false);
  const [isEditProjectModalOpen, setIsEditProjectModalOpen] = useState(false);
  const [expandedHeader, setExpandedHeader] = useState(true);
  
  // Page Detail Sidebar
  const [selectedPage, setSelectedPage] = useState(null);
  const [pageSections, setPageSections] = useState([]);
  const [isPageSidebarOpen, setIsPageSidebarOpen] = useState(false);
  
  // Section Detail Sidebar  
  const [selectedSection, setSelectedSection] = useState(null);
  const [sectionFeedback, setSectionFeedback] = useState([]);
  const [isSectionSidebarOpen, setIsSectionSidebarOpen] = useState(false);
  const [sectionActiveTab, setSectionActiveTab] = useState('wireframe');
  
  // Form states
  const [newProject, setNewProject] = useState({
    name: '', domain_url: '', platform: 'Website', website_type: 'Business Website',
    developer: '', onboarding_date: new Date().toISOString().split('T')[0], deadline: '',
    server_details: '', client_drive_url: '', documents_url: '', communication_url: ''
  });
  const [newPage, setNewPage] = useState({ page_name: '' });
  const [newTask, setNewTask] = useState({ title: '', description: '', assigned_to: '', due_date: '', priority: 'medium' });
  const [newSection, setNewSection] = useState({ name: '', description: '', screenshot_url: '' });
  const [newFeedback, setNewFeedback] = useState({ content: '', feedback_type: 'comment' });

  const token = localStorage.getItem('session_token');

  // Check URL params for project selection or new project
  useEffect(() => {
    const projectId = searchParams.get('id');
    const action = searchParams.get('action');
    
    if (projectId) {
      setSelectedProject(projectId);
    }
    if (action === 'new') {
      setIsCreateModalOpen(true);
    }
  }, [searchParams]);

  // Load projects
  const loadProjects = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/website-projects/projects`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProjects(res.data);
      if (res.data.length > 0 && !selectedProject) {
        setSelectedProject(res.data[0].project_id);
      }
    } catch (error) {
      console.error('Error loading projects:', error);
      toast.error('Failed to load projects');
    } finally {
      setLoading(false);
    }
  }, [token, selectedProject]);

  // Check edit permission
  const checkPermission = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/website-projects/check-permission`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCanEdit(res.data.can_edit);
    } catch (error) {
      console.error('Error checking permission:', error);
    }
  }, [token]);

  // Load options
  const loadOptions = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/website-projects/options`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setOptions(res.data);
    } catch (error) {
      console.error('Error loading options:', error);
    }
  }, [token]);

  // Load project detail
  const loadProjectDetail = useCallback(async (projectId) => {
    if (!projectId) return;
    try {
      const res = await axios.get(`${API}/api/website-projects/projects/${projectId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProjectDetail(res.data);
    } catch (error) {
      console.error('Error loading project detail:', error);
    }
  }, [token]);

  // Load project tasks
  const loadProjectTasks = useCallback(async (projectId) => {
    if (!projectId) return;
    try {
      const res = await axios.get(`${API}/api/website-projects/projects/${projectId}/tasks`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProjectTasks(res.data);
    } catch (error) {
      console.error('Error loading tasks:', error);
    }
  }, [token]);

  // Load page sections
  const loadPageSections = useCallback(async (pageId) => {
    if (!pageId) return;
    try {
      const res = await axios.get(`${API}/api/website-projects/pages/${pageId}/sections`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPageSections(res.data);
    } catch (error) {
      console.error('Error loading sections:', error);
    }
  }, [token]);

  // Load section feedback
  const loadSectionFeedback = useCallback(async (sectionId) => {
    if (!sectionId) return;
    try {
      const res = await axios.get(`${API}/api/website-projects/sections/${sectionId}/feedback`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSectionFeedback(res.data);
    } catch (error) {
      console.error('Error loading feedback:', error);
    }
  }, [token]);

  useEffect(() => {
    loadProjects();
    loadOptions();
    checkPermission();
  }, [loadProjects, loadOptions, checkPermission]);

  useEffect(() => {
    if (selectedProject) {
      loadProjectDetail(selectedProject);
      loadProjectTasks(selectedProject);
    }
  }, [selectedProject, loadProjectDetail, loadProjectTasks]);

  useEffect(() => {
    if (selectedPage) {
      loadPageSections(selectedPage.task_id);
    }
  }, [selectedPage, loadPageSections]);

  useEffect(() => {
    if (selectedSection) {
      loadSectionFeedback(selectedSection.section_id);
    }
  }, [selectedSection, loadSectionFeedback]);

  // CRUD handlers
  const handleCreateProject = async () => {
    if (!newProject.name) { toast.error('Project name is required'); return; }
    try {
      const res = await axios.post(`${API}/api/website-projects/projects`, newProject, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(`Project created with ${res.data.pages_created} default pages`);
      setIsCreateModalOpen(false);
      setNewProject({ name: '', domain_url: '', platform: 'Website', website_type: 'Business Website',
        developer: '', onboarding_date: new Date().toISOString().split('T')[0], deadline: '',
        server_details: '', client_drive_url: '', documents_url: '', communication_url: '' });
      loadProjects();
      setSelectedProject(res.data.project_id);
      setSearchParams({ id: res.data.project_id });
    } catch (error) { toast.error('Failed to create project'); }
  };

  const handleUpdateProject = async () => {
    try {
      await axios.put(`${API}/api/website-projects/projects/${selectedProject}`, newProject, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Project updated');
      setIsEditProjectModalOpen(false);
      loadProjectDetail(selectedProject);
      loadProjects();
    } catch (error) { toast.error('Failed to update project'); }
  };

  const handleDeleteProject = async () => {
    if (!window.confirm('Delete this project and all its pages?')) return;
    try {
      await axios.delete(`${API}/api/website-projects/projects/${selectedProject}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Project deleted');
      setSelectedProject(null);
      setProjectDetail(null);
      setSearchParams({});
      loadProjects();
    } catch (error) { toast.error('Failed to delete project'); }
  };

  const handleAddPage = async () => {
    if (!newPage.page_name) { toast.error('Page name is required'); return; }
    try {
      await axios.post(`${API}/api/website-projects/projects/${selectedProject}/pages`, newPage, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Page added');
      setIsAddPageModalOpen(false);
      setNewPage({ page_name: '' });
      loadProjectDetail(selectedProject);
    } catch (error) { toast.error('Failed to add page'); }
  };

  const handleAddTask = async () => {
    if (!newTask.title) { toast.error('Task title is required'); return; }
    try {
      await axios.post(`${API}/api/website-projects/projects/${selectedProject}/tasks`, newTask, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Task added');
      setIsAddTaskModalOpen(false);
      setNewTask({ title: '', description: '', assigned_to: '', due_date: '', priority: 'medium' });
      loadProjectTasks(selectedProject);
    } catch (error) { toast.error('Failed to add task'); }
  };

  const handleStatusChange = async (taskId, field, value) => {
    try {
      await axios.put(`${API}/api/website-projects/pages/${taskId}`, { [field]: value }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      loadProjectDetail(selectedProject);
    } catch (error) { toast.error('Failed to update status'); }
  };

  const handleTaskStatusChange = async (taskId, status) => {
    try {
      await axios.put(`${API}/api/website-projects/tasks/${taskId}`, { status }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      loadProjectTasks(selectedProject);
    } catch (error) { toast.error('Failed to update task'); }
  };

  const handleDeletePage = async (taskId) => {
    if (!window.confirm('Delete this page?')) return;
    try {
      await axios.delete(`${API}/api/website-projects/pages/${taskId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Page deleted');
      loadProjectDetail(selectedProject);
    } catch (error) { toast.error('Failed to delete page'); }
  };

  const handleDeleteTask = async (taskId) => {
    if (!window.confirm('Delete this task?')) return;
    try {
      await axios.delete(`${API}/api/website-projects/tasks/${taskId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Task deleted');
      loadProjectTasks(selectedProject);
    } catch (error) { toast.error('Failed to delete task'); }
  };

  // Section handlers
  const handleAddSection = async () => {
    if (!newSection.name) { toast.error('Section name is required'); return; }
    try {
      await axios.post(`${API}/api/website-projects/pages/${selectedPage.task_id}/sections`, newSection, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Section added');
      setNewSection({ name: '', description: '', screenshot_url: '' });
      loadPageSections(selectedPage.task_id);
    } catch (error) { toast.error('Failed to add section'); }
  };

  const handleUpdateSection = async (sectionId, updates) => {
    try {
      await axios.put(`${API}/api/website-projects/sections/${sectionId}`, updates, {
        headers: { Authorization: `Bearer ${token}` }
      });
      loadPageSections(selectedPage.task_id);
    } catch (error) { toast.error('Failed to update section'); }
  };

  const handleDeleteSection = async (sectionId) => {
    if (!window.confirm('Delete this section?')) return;
    try {
      await axios.delete(`${API}/api/website-projects/sections/${sectionId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Section deleted');
      loadPageSections(selectedPage.task_id);
    } catch (error) { toast.error('Failed to delete section'); }
  };

  // Feedback handlers
  const handleAddFeedback = async () => {
    if (!newFeedback.content) { toast.error('Feedback content is required'); return; }
    try {
      await axios.post(`${API}/api/website-projects/sections/${selectedSection.section_id}/feedback`, newFeedback, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Feedback added');
      setNewFeedback({ content: '', feedback_type: 'comment' });
      loadSectionFeedback(selectedSection.section_id);
    } catch (error) { toast.error('Failed to add feedback'); }
  };

  const handleResolveFeedback = async (feedbackId) => {
    try {
      await axios.put(`${API}/api/website-projects/feedback/${feedbackId}?status=resolved`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      loadSectionFeedback(selectedSection.section_id);
    } catch (error) { toast.error('Failed to resolve feedback'); }
  };

  // Open page sidebar
  const openPageSidebar = (page) => {
    setSelectedPage(page);
    setIsPageSidebarOpen(true);
    setIsSectionSidebarOpen(false);
  };

  // Open section sidebar
  const openSectionSidebar = (section) => {
    setSelectedSection(section);
    setIsSectionSidebarOpen(true);
    setSectionActiveTab('wireframe');
  };

  // Filter tasks/pages
  const filteredPages = projectDetail?.tasks?.filter(task => {
    const matchesSearch = task.page_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || task.overall_status === statusFilter;
    return matchesSearch && matchesStatus;
  }) || [];

  const filteredTasks = projectTasks.filter(task => {
    const matchesSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Theme classes
  const bgCard = isDark ? 'bg-[#18181b]' : 'bg-white';
  const bgSecondary = isDark ? 'bg-[#27272a]' : 'bg-gray-100';
  const borderColor = isDark ? 'border-[#27272a]' : 'border-gray-200';
  const textPrimary = isDark ? 'text-[#fafafa]' : 'text-gray-900';
  const textSecondary = isDark ? 'text-[#a1a1aa]' : 'text-gray-600';

  if (loading) {
    return (
      <Layout>
        <div className={`flex items-center justify-center h-full ${textPrimary}`}>Loading...</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex flex-col h-full" data-testid="website-projects-page">
        {/* Header */}
        <div className={`p-4 border-b ${borderColor}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Globe className="h-6 w-6 text-[#6366f1]" />
              <h1 className={`text-xl font-bold ${textPrimary}`}>Website Projects</h1>
              <Badge className="bg-[#6366f1]/20 text-[#6366f1]">{projects.length} Projects</Badge>
            </div>
            <Button onClick={() => setIsCreateModalOpen(true)} className="bg-[#6366f1] hover:bg-[#4f46e5] text-white" data-testid="create-project-btn">
              <Plus className="h-4 w-4 mr-2" />
              New Project
            </Button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Main Content */}
          <div className={`flex-1 flex flex-col overflow-hidden ${isPageSidebarOpen ? 'mr-80' : ''} ${isSectionSidebarOpen ? 'mr-96' : ''}`}>
            {/* Project Header - Collapsible */}
            {projectDetail && (
              <div className={`border-b ${borderColor} ${bgCard}`}>
                <div className={`flex items-center justify-between p-4 cursor-pointer`} onClick={() => setExpandedHeader(!expandedHeader)}>
                  <div className="flex items-center gap-4">
                    <div>
                      <h2 className={`text-lg font-bold ${textPrimary}`}>{projectDetail.name}</h2>
                      <p className={`text-sm ${textSecondary}`}>{projectDetail.platform} - {projectDetail.website_type}</p>
                    </div>
                    <Progress value={projectDetail.stats?.overall_completed / projectDetail.stats?.total_pages * 100 || 0} className="w-32 h-2" />
                    <span className={`text-sm ${textSecondary}`}>{projectDetail.stats?.overall_completed || 0}/{projectDetail.stats?.total_pages || 0} Pages</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {canEdit && (
                      <>
                        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setNewProject(projectDetail); setIsEditProjectModalOpen(true); }} className="text-blue-400 hover:text-blue-300">
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleDeleteProject(); }} className="text-red-400 hover:text-red-300">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                    {expandedHeader ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                  </div>
                </div>

                {/* Expanded Header Details */}
                {expandedHeader && (
                  <>
                    <div className={`px-4 pb-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3`}>
                      <MetadataCard icon={Globe} label="Domain" value={projectDetail.domain_url} link isDark={isDark} />
                      <MetadataCard icon={User} label="Developer" value={projectDetail.developer} isDark={isDark} />
                      <MetadataCard icon={Calendar} label="Onboarding" value={projectDetail.onboarding_date} isDark={isDark} />
                      <MetadataCard icon={Clock} label="Deadline" value={projectDetail.deadline} isDark={isDark} />
                      <MetadataCard icon={Folder} label="Client Drive" value={projectDetail.client_drive_url} link isDark={isDark} />
                      <MetadataCard icon={Server} label="Server" value={projectDetail.server_details} isDark={isDark} />
                    </div>

                    {/* Phase Progress Stats */}
                    <div className={`px-4 pb-4 grid grid-cols-4 gap-2`}>
                      <PhaseStatCard label="Wireframe" completed={projectDetail.stats?.wireframe?.completed || 0} total={projectDetail.stats?.total_pages} color="#6366f1" isDark={isDark} />
                      <PhaseStatCard label="UI Design" completed={projectDetail.stats?.ui?.completed || 0} total={projectDetail.stats?.total_pages} color="#8b5cf6" isDark={isDark} />
                      <PhaseStatCard label="Content" completed={projectDetail.stats?.content?.completed || 0} total={projectDetail.stats?.total_pages} color="#10b981" isDark={isDark} />
                      <PhaseStatCard label="Development" completed={projectDetail.stats?.dev?.completed || 0} total={projectDetail.stats?.total_pages} color="#f59e0b" isDark={isDark} />
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Tabs: Tasks | Pages */}
            <div className={`border-b ${borderColor}`}>
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <div className="flex items-center justify-between px-4 pt-2">
                  <TabsList className={`${bgSecondary}`}>
                    <TabsTrigger value="pages" className="flex items-center gap-2">
                      <LayoutGrid className="h-4 w-4" />
                      Pages
                    </TabsTrigger>
                    <TabsTrigger value="tasks" className="flex items-center gap-2">
                      <ListTodo className="h-4 w-4" />
                      Tasks
                      {projectTasks.length > 0 && <Badge className="ml-1 bg-[#6366f1]/20 text-[#6366f1]">{projectTasks.length}</Badge>}
                    </TabsTrigger>
                  </TabsList>
                  
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className={`pl-10 w-48 ${bgSecondary} border-none`} />
                    </div>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className={`w-32 ${bgSecondary} border-none`}>
                        <Filter className="h-4 w-4 mr-2" />
                        <SelectValue placeholder="Filter" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {activeTab === 'pages' && (
                      <Button onClick={() => setIsAddPageModalOpen(true)} variant="outline" size="sm" disabled={!selectedProject}>
                        <Plus className="h-4 w-4 mr-1" /> Add Page
                      </Button>
                    )}
                    {activeTab === 'tasks' && (
                      <Button onClick={() => setIsAddTaskModalOpen(true)} variant="outline" size="sm" disabled={!selectedProject}>
                        <Plus className="h-4 w-4 mr-1" /> Add Task
                      </Button>
                    )}
                  </div>
                </div>

                {/* Pages Tab Content */}
                <TabsContent value="pages" className="flex-1 overflow-auto m-0">
                  {!selectedProject ? (
                    <div className={`flex flex-col items-center justify-center h-64 ${textSecondary}`}>
                      <Globe className="h-12 w-12 mb-4 opacity-50" />
                      <p>Select a project or create a new one</p>
                    </div>
                  ) : (
                    <table className="w-full">
                      <thead className={`${bgSecondary} sticky top-0 z-10`}>
                        <tr className={`text-xs ${textSecondary} uppercase`}>
                          <th className="px-4 py-3 text-left font-semibold w-8">#</th>
                          <th className="px-4 py-3 text-left font-semibold min-w-[180px]">Page Name</th>
                          <th className="px-4 py-3 text-center font-semibold">Wireframe</th>
                          <th className="px-4 py-3 text-center font-semibold">UI Design</th>
                          <th className="px-4 py-3 text-center font-semibold">Content</th>
                          <th className="px-4 py-3 text-center font-semibold">Development</th>
                          <th className="px-4 py-3 text-center font-semibold">Overall</th>
                          <th className="px-4 py-3 text-center font-semibold w-20">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredPages.map((task, idx) => (
                          <tr key={task.task_id} className={`border-b ${borderColor} hover:${bgSecondary} transition-colors cursor-pointer`} onClick={() => openPageSidebar(task)}>
                            <td className={`px-4 py-3 text-sm ${textSecondary}`}>{task.sno}</td>
                            <td className={`px-4 py-3`}>
                              <span className={`text-sm font-medium ${textPrimary} hover:text-[#6366f1]`}>{task.page_name}</span>
                            </td>
                            <td className="px-2 py-2"><StatusBadge status={task.wireframe_status} onChange={(v) => { handleStatusChange(task.task_id, 'wireframe_status', v); }} /></td>
                            <td className="px-2 py-2"><StatusBadge status={task.ui_status} onChange={(v) => { handleStatusChange(task.task_id, 'ui_status', v); }} /></td>
                            <td className="px-2 py-2"><StatusBadge status={task.content_status} onChange={(v) => { handleStatusChange(task.task_id, 'content_status', v); }} /></td>
                            <td className="px-2 py-2"><StatusBadge status={task.dev_status} onChange={(v) => { handleStatusChange(task.task_id, 'dev_status', v); }} /></td>
                            <td className="px-2 py-2"><StatusBadge status={task.overall_status} onChange={(v) => { handleStatusChange(task.task_id, 'overall_status', v); }} /></td>
                            <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="sm" onClick={() => handleDeletePage(task.task_id)} className="text-red-400 hover:text-red-300 h-7 w-7 p-0">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                        {filteredPages.length === 0 && (
                          <tr><td colSpan={8} className={`px-4 py-8 text-center ${textSecondary}`}>No pages found</td></tr>
                        )}
                      </tbody>
                    </table>
                  )}
                </TabsContent>

                {/* Tasks Tab Content */}
                <TabsContent value="tasks" className="flex-1 overflow-auto m-0 p-4">
                  {filteredTasks.length === 0 ? (
                    <div className={`flex flex-col items-center justify-center h-64 ${textSecondary}`}>
                      <ListTodo className="h-12 w-12 mb-4 opacity-50" />
                      <p>No tasks yet. Click "Add Task" to create one.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {filteredTasks.map(task => (
                        <div key={task.task_id} className={`p-4 rounded-lg border ${borderColor} ${bgCard} flex items-center justify-between`}>
                          <div className="flex items-center gap-4">
                            <button onClick={() => handleTaskStatusChange(task.task_id, task.status === 'Completed' ? 'To-Do' : 'Completed')}>
                              {task.status === 'Completed' ? <CheckCircle className="h-5 w-5 text-green-500" /> : <Circle className="h-5 w-5 text-gray-400" />}
                            </button>
                            <div>
                              <p className={`font-medium ${task.status === 'Completed' ? 'line-through text-gray-500' : textPrimary}`}>{task.title}</p>
                              {task.description && <p className={`text-sm ${textSecondary}`}>{task.description}</p>}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <Badge className={PRIORITY_COLORS[task.priority]}>{task.priority}</Badge>
                            {task.due_date && <span className={`text-sm ${textSecondary}`}>{task.due_date}</span>}
                            {task.assigned_to && <Badge variant="outline">{options?.team_members?.find(t => t.user_id === task.assigned_to)?.name || 'Unassigned'}</Badge>}
                            <Button variant="ghost" size="sm" onClick={() => handleDeleteTask(task.task_id)} className="text-red-400 h-7 w-7 p-0">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          </div>

          {/* Page Detail Sidebar */}
          {isPageSidebarOpen && selectedPage && (
            <div className={`fixed right-0 top-0 h-full w-80 ${bgCard} border-l ${borderColor} shadow-xl z-40 flex flex-col`}>
              <div className={`p-4 border-b ${borderColor} flex items-center justify-between`}>
                <h3 className={`font-bold ${textPrimary}`}>{selectedPage.page_name}</h3>
                <Button variant="ghost" size="sm" onClick={() => setIsPageSidebarOpen(false)}><X className="h-4 w-4" /></Button>
              </div>
              
              <div className="flex-1 overflow-auto p-4 space-y-4">
                <div>
                  <h4 className={`text-sm font-semibold ${textSecondary} mb-2`}>Add Section</h4>
                  <Input placeholder="Section name (e.g., Hero)" value={newSection.name} onChange={(e) => setNewSection({...newSection, name: e.target.value})} className={`mb-2 ${bgSecondary}`} />
                  <Input placeholder="Paste screenshot URL" value={newSection.screenshot_url} onChange={(e) => setNewSection({...newSection, screenshot_url: e.target.value})} className={`mb-2 ${bgSecondary}`} />
                  <Button onClick={handleAddSection} size="sm" className="w-full bg-[#6366f1]">
                    <Plus className="h-4 w-4 mr-1" /> Add Section
                  </Button>
                </div>

                <div>
                  <h4 className={`text-sm font-semibold ${textSecondary} mb-2`}>Sections ({pageSections.length})</h4>
                  <div className="space-y-2">
                    {pageSections.map(section => (
                      <div key={section.section_id} className={`p-3 rounded-lg ${bgSecondary} cursor-pointer hover:ring-1 hover:ring-[#6366f1]`} onClick={() => openSectionSidebar(section)}>
                        <div className="flex items-center justify-between mb-2">
                          <span className={`font-medium ${textPrimary}`}>{section.name}</span>
                          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleDeleteSection(section.section_id); }} className="h-6 w-6 p-0 text-red-400">
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                        {section.screenshot_url && (
                          <img src={section.screenshot_url} alt={section.name} className="w-full h-20 object-cover rounded mb-2" />
                        )}
                        <div className="flex gap-1">
                          <Badge className={`text-[10px] ${STATUS_COLORS[section.wireframe_status]}`}>WF</Badge>
                          <Badge className={`text-[10px] ${STATUS_COLORS[section.ui_status]}`}>UI</Badge>
                          <Badge className={`text-[10px] ${STATUS_COLORS[section.content_status]}`}>CT</Badge>
                          <Badge className={`text-[10px] ${STATUS_COLORS[section.dev_status]}`}>DV</Badge>
                        </div>
                      </div>
                    ))}
                    {pageSections.length === 0 && <p className={`text-sm ${textSecondary}`}>No sections yet</p>}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Section Detail Sidebar (4 Tabs: Wireframe, UI, Dev, Content) */}
          {isSectionSidebarOpen && selectedSection && (
            <div className={`fixed right-0 top-0 h-full w-96 ${bgCard} border-l ${borderColor} shadow-xl z-50 flex flex-col`}>
              <div className={`p-4 border-b ${borderColor} flex items-center justify-between`}>
                <h3 className={`font-bold ${textPrimary}`}>{selectedSection.name}</h3>
                <Button variant="ghost" size="sm" onClick={() => setIsSectionSidebarOpen(false)}><X className="h-4 w-4" /></Button>
              </div>

              {/* Screenshot */}
              {selectedSection.screenshot_url && (
                <img src={selectedSection.screenshot_url} alt={selectedSection.name} className="w-full h-32 object-cover" />
              )}

              {/* Phase Tabs */}
              <Tabs value={sectionActiveTab} onValueChange={setSectionActiveTab} className="flex-1 flex flex-col">
                <TabsList className={`${bgSecondary} m-2`}>
                  <TabsTrigger value="wireframe">Wireframe</TabsTrigger>
                  <TabsTrigger value="ui">UI</TabsTrigger>
                  <TabsTrigger value="dev">Dev</TabsTrigger>
                  <TabsTrigger value="content">Content</TabsTrigger>
                </TabsList>

                {['wireframe', 'ui', 'dev', 'content'].map(phase => (
                  <TabsContent key={phase} value={phase} className="flex-1 overflow-auto p-4 space-y-4">
                    <div className="space-y-3">
                      <div>
                        <label className={`text-sm ${textSecondary}`}>Status</label>
                        <Select value={selectedSection[`${phase}_status`] || 'To-Do'} onValueChange={(v) => handleUpdateSection(selectedSection.section_id, { [`${phase}_status`]: v })}>
                          <SelectTrigger className={bgSecondary}><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className={`text-sm ${textSecondary}`}>URL (Figma/Link)</label>
                        <Input placeholder="Paste URL" defaultValue={selectedSection[`${phase}_url`] || ''} onBlur={(e) => handleUpdateSection(selectedSection.section_id, { [`${phase}_url`]: e.target.value })} className={bgSecondary} />
                      </div>
                    </div>
                  </TabsContent>
                ))}
              </Tabs>

              {/* Client Feedback */}
              <div className={`border-t ${borderColor} p-4`}>
                <h4 className={`text-sm font-semibold ${textSecondary} mb-2`}>Client Feedback</h4>
                <div className="space-y-2 max-h-32 overflow-auto mb-2">
                  {sectionFeedback.map(fb => (
                    <div key={fb.feedback_id} className={`p-2 rounded ${bgSecondary} text-sm`}>
                      <div className="flex items-center justify-between">
                        <span className={`font-medium ${textPrimary}`}>{fb.created_by_name}</span>
                        {fb.status === 'open' ? (
                          <Button variant="ghost" size="sm" onClick={() => handleResolveFeedback(fb.feedback_id)} className="h-6 text-xs text-green-400">
                            <Check className="h-3 w-3 mr-1" /> Resolve
                          </Button>
                        ) : (
                          <Badge className="bg-green-500/20 text-green-400 text-xs">Resolved</Badge>
                        )}
                      </div>
                      <p className={textSecondary}>{fb.content}</p>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input placeholder="Add feedback..." value={newFeedback.content} onChange={(e) => setNewFeedback({...newFeedback, content: e.target.value})} className={`flex-1 ${bgSecondary}`} />
                  <Button onClick={handleAddFeedback} size="sm" className="bg-[#6366f1]"><Send className="h-4 w-4" /></Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modals */}
        <ProjectModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="Create Website Project" project={newProject} setProject={setNewProject} onSubmit={handleCreateProject} options={options} isDark={isDark} />
        <ProjectModal isOpen={isEditProjectModalOpen} onClose={() => setIsEditProjectModalOpen(false)} title="Edit Project" project={newProject} setProject={setNewProject} onSubmit={handleUpdateProject} options={options} isDark={isDark} isEdit />
        
        <Dialog open={isAddPageModalOpen} onOpenChange={setIsAddPageModalOpen}>
          <DialogContent className={`${bgCard} ${textPrimary}`}>
            <DialogHeader><DialogTitle>Add New Page</DialogTitle></DialogHeader>
            <Input value={newPage.page_name} onChange={(e) => setNewPage({ page_name: e.target.value })} placeholder="e.g., Gallery Page" className={bgSecondary} />
            <DialogFooter>
              <Button variant="ghost" onClick={() => setIsAddPageModalOpen(false)}>Cancel</Button>
              <Button onClick={handleAddPage} className="bg-[#6366f1]">Add Page</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isAddTaskModalOpen} onOpenChange={setIsAddTaskModalOpen}>
          <DialogContent className={`${bgCard} ${textPrimary}`}>
            <DialogHeader><DialogTitle>Add New Task</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input value={newTask.title} onChange={(e) => setNewTask({...newTask, title: e.target.value})} placeholder="Task title" className={bgSecondary} />
              <Textarea value={newTask.description} onChange={(e) => setNewTask({...newTask, description: e.target.value})} placeholder="Description (optional)" className={bgSecondary} />
              <div className="grid grid-cols-2 gap-3">
                <Select value={newTask.assigned_to} onValueChange={(v) => setNewTask({...newTask, assigned_to: v})}>
                  <SelectTrigger className={bgSecondary}><SelectValue placeholder="Assign to" /></SelectTrigger>
                  <SelectContent>
                    {options?.team_members?.map(t => <SelectItem key={t.user_id} value={t.user_id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={newTask.priority} onValueChange={(v) => setNewTask({...newTask, priority: v})}>
                  <SelectTrigger className={bgSecondary}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Input type="date" value={newTask.due_date} onChange={(e) => setNewTask({...newTask, due_date: e.target.value})} className={bgSecondary} />
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setIsAddTaskModalOpen(false)}>Cancel</Button>
              <Button onClick={handleAddTask} className="bg-[#6366f1]">Add Task</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

// Helper Components
const MetadataCard = ({ icon: Icon, label, value, link, isDark }) => {
  const bgSecondary = isDark ? 'bg-[#27272a]' : 'bg-gray-100';
  const textSecondary = isDark ? 'text-[#a1a1aa]' : 'text-gray-600';
  const textPrimary = isDark ? 'text-[#fafafa]' : 'text-gray-900';
  
  return (
    <div className={`p-3 rounded-lg ${bgSecondary}`}>
      <div className={`text-xs ${textSecondary} mb-1 flex items-center gap-1`}>
        <Icon className="h-3 w-3" /> {label}
      </div>
      {link && value ? (
        <a href={value.startsWith('http') ? value : `https://${value}`} target="_blank" rel="noopener noreferrer" className="text-sm text-[#6366f1] hover:underline truncate block">
          {value} <ExternalLink className="inline h-3 w-3" />
        </a>
      ) : (
        <p className={`text-sm ${textPrimary} truncate`}>{value || 'Not set'}</p>
      )}
    </div>
  );
};

const PhaseStatCard = ({ label, completed, total, color, isDark }) => {
  const bgSecondary = isDark ? 'bg-[#27272a]' : 'bg-gray-100';
  const textSecondary = isDark ? 'text-[#a1a1aa]' : 'text-gray-600';
  
  return (
    <div className={`p-2 rounded-lg ${bgSecondary} text-center`}>
      <p className={`text-xs ${textSecondary}`}>{label}</p>
      <p className="text-sm font-bold" style={{ color }}>{completed}/{total}</p>
    </div>
  );
};

const StatusBadge = ({ status, onChange }) => (
  <Select value={status} onValueChange={onChange}>
    <SelectTrigger className={`h-7 text-xs ${STATUS_COLORS[status]} border w-full`} onClick={(e) => e.stopPropagation()}>
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
    </SelectContent>
  </Select>
);

const ProjectModal = ({ isOpen, onClose, title, project, setProject, onSubmit, options, isDark, isEdit }) => {
  const bgCard = isDark ? 'bg-[#18181b]' : 'bg-white';
  const bgSecondary = isDark ? 'bg-[#27272a]' : 'bg-gray-100';
  const textPrimary = isDark ? 'text-[#fafafa]' : 'text-gray-900';
  const textSecondary = isDark ? 'text-[#a1a1aa]' : 'text-gray-600';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={`${bgCard} ${textPrimary} max-w-2xl`}>
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={`text-sm ${textSecondary} block mb-1`}>Project/Client Name *</label>
            <Input value={project.name} onChange={(e) => setProject({...project, name: e.target.value})} placeholder="Client Company Name" className={bgSecondary} />
          </div>
          <div>
            <label className={`text-sm ${textSecondary} block mb-1`}>Domain URL</label>
            <Input value={project.domain_url} onChange={(e) => setProject({...project, domain_url: e.target.value})} placeholder="www.example.com" className={bgSecondary} />
          </div>
          <div>
            <label className={`text-sm ${textSecondary} block mb-1`}>Platform</label>
            <Select value={project.platform} onValueChange={(v) => setProject({...project, platform: v})}>
              <SelectTrigger className={bgSecondary}><SelectValue /></SelectTrigger>
              <SelectContent>
                {(options?.platforms || ['Website', 'Shopify', 'WordPress', 'Custom']).map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className={`text-sm ${textSecondary} block mb-1`}>Website Type</label>
            <Select value={project.website_type} onValueChange={(v) => setProject({...project, website_type: v})}>
              <SelectTrigger className={bgSecondary}><SelectValue /></SelectTrigger>
              <SelectContent>
                {(options?.website_types || ['Business Website', 'E-commerce', 'Portfolio']).map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className={`text-sm ${textSecondary} block mb-1`}>Developer</label>
            <Input value={project.developer} onChange={(e) => setProject({...project, developer: e.target.value})} placeholder="Assign developer" className={bgSecondary} />
          </div>
          <div>
            <label className={`text-sm ${textSecondary} block mb-1`}>Server Details</label>
            <Input value={project.server_details} onChange={(e) => setProject({...project, server_details: e.target.value})} placeholder="Hosting provider" className={bgSecondary} />
          </div>
          <div>
            <label className={`text-sm ${textSecondary} block mb-1`}>Onboarding Date</label>
            <Input type="date" value={project.onboarding_date} onChange={(e) => setProject({...project, onboarding_date: e.target.value})} className={bgSecondary} />
          </div>
          <div>
            <label className={`text-sm ${textSecondary} block mb-1`}>Deadline</label>
            <Input type="date" value={project.deadline} onChange={(e) => setProject({...project, deadline: e.target.value})} className={bgSecondary} />
          </div>
          <div className="col-span-2">
            <label className={`text-sm ${textSecondary} block mb-1`}>Client Drive URL</label>
            <Input value={project.client_drive_url} onChange={(e) => setProject({...project, client_drive_url: e.target.value})} placeholder="Google Drive / Dropbox link" className={bgSecondary} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={onSubmit} className="bg-[#6366f1]">{isEdit ? 'Update' : 'Create'} Project</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default WebsiteProjectsPage;
