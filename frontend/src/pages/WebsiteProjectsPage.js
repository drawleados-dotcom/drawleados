import React, { useState, useEffect, useCallback } from 'react';
import Layout from '../components/Layout';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Progress } from '../components/ui/progress';
import { useTheme } from '../contexts/ThemeContext';
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
  MoreHorizontal,
  Edit2,
  Trash2,
  CheckCircle,
  Circle,
  AlertCircle,
  Eye,
  X
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

const STATUS_OPTIONS = ['To-Do', 'In Progress', 'Client Review', 'Client Approved', 'Completed', 'On Hold'];

const WebsiteProjectsPage = () => {
  const { isDark } = useTheme();
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [projectDetail, setProjectDetail] = useState(null);
  const [options, setOptions] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isAddPageModalOpen, setIsAddPageModalOpen] = useState(false);
  const [expandedHeader, setExpandedHeader] = useState(true);
  
  const [newProject, setNewProject] = useState({
    name: '',
    domain_url: '',
    platform: 'Website',
    website_type: 'Business Website',
    developer: '',
    onboarding_date: new Date().toISOString().split('T')[0],
    deadline: '',
    server_details: '',
    client_drive_url: '',
    documents_url: '',
    communication_url: ''
  });

  const [newPage, setNewPage] = useState({
    page_name: ''
  });

  const token = localStorage.getItem('session_token');

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

  useEffect(() => {
    loadProjects();
    loadOptions();
  }, [loadProjects, loadOptions]);

  useEffect(() => {
    if (selectedProject) {
      loadProjectDetail(selectedProject);
    }
  }, [selectedProject, loadProjectDetail]);

  // Create project
  const handleCreateProject = async () => {
    if (!newProject.name) {
      toast.error('Project name is required');
      return;
    }
    try {
      const res = await axios.post(`${API}/api/website-projects/projects`, newProject, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(`Project created with ${res.data.pages_created} default pages`);
      setIsCreateModalOpen(false);
      setNewProject({
        name: '',
        domain_url: '',
        platform: 'Website',
        website_type: 'Business Website',
        developer: '',
        onboarding_date: new Date().toISOString().split('T')[0],
        deadline: '',
        server_details: '',
        client_drive_url: '',
        documents_url: '',
        communication_url: ''
      });
      loadProjects();
      setSelectedProject(res.data.project_id);
    } catch (error) {
      toast.error('Failed to create project');
    }
  };

  // Add page
  const handleAddPage = async () => {
    if (!newPage.page_name || !selectedProject) {
      toast.error('Page name is required');
      return;
    }
    try {
      await axios.post(`${API}/api/website-projects/projects/${selectedProject}/pages`, newPage, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Page added');
      setIsAddPageModalOpen(false);
      setNewPage({ page_name: '' });
      loadProjectDetail(selectedProject);
    } catch (error) {
      toast.error('Failed to add page');
    }
  };

  // Update task/page status
  const handleStatusChange = async (taskId, field, value) => {
    try {
      await axios.put(`${API}/api/website-projects/pages/${taskId}`, { [field]: value }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      loadProjectDetail(selectedProject);
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  // Delete page
  const handleDeletePage = async (taskId) => {
    if (!window.confirm('Delete this page?')) return;
    try {
      await axios.delete(`${API}/api/website-projects/pages/${taskId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Page deleted');
      loadProjectDetail(selectedProject);
    } catch (error) {
      toast.error('Failed to delete page');
    }
  };

  // Delete project
  const handleDeleteProject = async () => {
    if (!window.confirm('Delete this project and all its pages?')) return;
    try {
      await axios.delete(`${API}/api/website-projects/projects/${selectedProject}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Project deleted');
      setSelectedProject(null);
      setProjectDetail(null);
      loadProjects();
    } catch (error) {
      toast.error('Failed to delete project');
    }
  };

  // Filter tasks
  const filteredTasks = projectDetail?.tasks?.filter(task => {
    const matchesSearch = task.page_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || task.overall_status === statusFilter;
    return matchesSearch && matchesStatus;
  }) || [];

  const bgCard = isDark ? 'bg-[#18181b]' : 'bg-white';
  const bgSecondary = isDark ? 'bg-[#27272a]' : 'bg-gray-100';
  const borderColor = isDark ? 'border-[#27272a]' : 'border-gray-200';
  const textPrimary = isDark ? 'text-[#fafafa]' : 'text-gray-900';
  const textSecondary = isDark ? 'text-[#a1a1aa]' : 'text-gray-600';

  if (loading) {
    return (
      <Layout>
        <div className={`flex items-center justify-center h-full ${textPrimary}`}>
          Loading...
        </div>
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
            <Button
              onClick={() => setIsCreateModalOpen(true)}
              className="bg-[#6366f1] hover:bg-[#4f46e5] text-white"
              data-testid="create-project-btn"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Project
            </Button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Main Content */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Project Header - Collapsible */}
            {projectDetail && (
              <div className={`border-b ${borderColor} ${bgCard}`}>
                <div 
                  className={`flex items-center justify-between p-4 cursor-pointer hover:${bgSecondary}`}
                  onClick={() => setExpandedHeader(!expandedHeader)}
                >
                  <div className="flex items-center gap-4">
                    <div>
                      <h2 className={`text-lg font-bold ${textPrimary}`}>{projectDetail.name}</h2>
                      <p className={`text-sm ${textSecondary}`}>
                        {projectDetail.platform} - {projectDetail.website_type}
                      </p>
                    </div>
                    <Progress 
                      value={projectDetail.stats?.overall_completed / projectDetail.stats?.total_pages * 100 || 0} 
                      className="w-32 h-2"
                    />
                    <span className={`text-sm ${textSecondary}`}>
                      {projectDetail.stats?.overall_completed || 0}/{projectDetail.stats?.total_pages || 0} Pages
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); handleDeleteProject(); }}
                      className="text-red-400 hover:text-red-300"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    {expandedHeader ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                  </div>
                </div>

                {/* Expanded Header Details */}
                {expandedHeader && (
                  <div className={`px-4 pb-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4`}>
                    {/* Domain */}
                    <div className={`p-3 rounded-lg ${bgSecondary}`}>
                      <div className={`text-xs ${textSecondary} mb-1 flex items-center gap-1`}>
                        <Globe className="h-3 w-3" /> Domain
                      </div>
                      <a 
                        href={projectDetail.domain_url ? `https://${projectDetail.domain_url.replace(/^https?:\/\//, '')}` : '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-[#6366f1] hover:underline truncate block"
                      >
                        {projectDetail.domain_url || 'Not set'}
                      </a>
                    </div>

                    {/* Developer */}
                    <div className={`p-3 rounded-lg ${bgSecondary}`}>
                      <div className={`text-xs ${textSecondary} mb-1 flex items-center gap-1`}>
                        <User className="h-3 w-3" /> Developer
                      </div>
                      <p className={`text-sm ${textPrimary} truncate`}>{projectDetail.developer || 'Not assigned'}</p>
                    </div>

                    {/* Onboarding Date */}
                    <div className={`p-3 rounded-lg ${bgSecondary}`}>
                      <div className={`text-xs ${textSecondary} mb-1 flex items-center gap-1`}>
                        <Calendar className="h-3 w-3" /> Onboarding
                      </div>
                      <p className={`text-sm ${textPrimary}`}>{projectDetail.onboarding_date || 'Not set'}</p>
                    </div>

                    {/* Deadline */}
                    <div className={`p-3 rounded-lg ${bgSecondary}`}>
                      <div className={`text-xs ${textSecondary} mb-1 flex items-center gap-1`}>
                        <Clock className="h-3 w-3" /> Deadline
                      </div>
                      <p className={`text-sm ${textPrimary}`}>{projectDetail.deadline || 'Not set'}</p>
                    </div>

                    {/* Client Drive */}
                    <div className={`p-3 rounded-lg ${bgSecondary}`}>
                      <div className={`text-xs ${textSecondary} mb-1 flex items-center gap-1`}>
                        <Folder className="h-3 w-3" /> Client Drive
                      </div>
                      {projectDetail.client_drive_url ? (
                        <a href={projectDetail.client_drive_url} target="_blank" rel="noopener noreferrer" className="text-sm text-[#6366f1] hover:underline flex items-center gap-1">
                          Open <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <span className={`text-sm ${textSecondary}`}>Not set</span>
                      )}
                    </div>

                    {/* Server */}
                    <div className={`p-3 rounded-lg ${bgSecondary}`}>
                      <div className={`text-xs ${textSecondary} mb-1 flex items-center gap-1`}>
                        <Server className="h-3 w-3" /> Server
                      </div>
                      <p className={`text-sm ${textPrimary} truncate`}>{projectDetail.server_details || 'Not set'}</p>
                    </div>
                  </div>
                )}

                {/* Phase Progress Stats */}
                {expandedHeader && projectDetail.stats && (
                  <div className={`px-4 pb-4 grid grid-cols-4 gap-2`}>
                    <div className={`p-2 rounded-lg ${bgSecondary} text-center`}>
                      <p className={`text-xs ${textSecondary}`}>Wireframe</p>
                      <p className={`text-sm font-bold text-[#6366f1]`}>
                        {projectDetail.stats.wireframe?.completed || 0}/{projectDetail.stats.total_pages}
                      </p>
                    </div>
                    <div className={`p-2 rounded-lg ${bgSecondary} text-center`}>
                      <p className={`text-xs ${textSecondary}`}>UI Design</p>
                      <p className={`text-sm font-bold text-[#8b5cf6]`}>
                        {projectDetail.stats.ui?.completed || 0}/{projectDetail.stats.total_pages}
                      </p>
                    </div>
                    <div className={`p-2 rounded-lg ${bgSecondary} text-center`}>
                      <p className={`text-xs ${textSecondary}`}>Content</p>
                      <p className={`text-sm font-bold text-[#10b981]`}>
                        {projectDetail.stats.content?.completed || 0}/{projectDetail.stats.total_pages}
                      </p>
                    </div>
                    <div className={`p-2 rounded-lg ${bgSecondary} text-center`}>
                      <p className={`text-xs ${textSecondary}`}>Development</p>
                      <p className={`text-sm font-bold text-[#f59e0b]`}>
                        {projectDetail.stats.dev?.completed || 0}/{projectDetail.stats.total_pages}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Task Table Filter */}
            <div className={`p-4 border-b ${borderColor} flex items-center justify-between gap-4`}>
              <div className="flex items-center gap-3 flex-1">
                <div className="relative flex-1 max-w-xs">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search pages..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className={`pl-10 ${bgSecondary} border-none`}
                    data-testid="search-pages-input"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className={`w-40 ${bgSecondary} border-none`}>
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Filter status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    {STATUS_OPTIONS.map(status => (
                      <SelectItem key={status} value={status}>{status}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={() => setIsAddPageModalOpen(true)}
                variant="outline"
                size="sm"
                disabled={!selectedProject}
                className={`${borderColor}`}
                data-testid="add-page-btn"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Page
              </Button>
            </div>

            {/* Task Table - Spreadsheet Style */}
            <div className="flex-1 overflow-auto">
              {!selectedProject ? (
                <div className={`flex flex-col items-center justify-center h-full ${textSecondary}`}>
                  <Globe className="h-12 w-12 mb-4 opacity-50" />
                  <p>Select a project or create a new one</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead className={`${bgSecondary} sticky top-0 z-10`}>
                    <tr className={`text-xs ${textSecondary} uppercase`}>
                      <th className="px-4 py-3 text-left font-semibold w-8">#</th>
                      <th className="px-4 py-3 text-left font-semibold min-w-[180px]">Page Name</th>
                      <th className="px-4 py-3 text-center font-semibold min-w-[140px]">
                        <div className="flex flex-col">
                          <span>Wireframe</span>
                          <span className="text-[10px] font-normal">Status / URL / Due</span>
                        </div>
                      </th>
                      <th className="px-4 py-3 text-center font-semibold min-w-[140px]">
                        <div className="flex flex-col">
                          <span>UI Design</span>
                          <span className="text-[10px] font-normal">Status / URL / Due</span>
                        </div>
                      </th>
                      <th className="px-4 py-3 text-center font-semibold min-w-[140px]">
                        <div className="flex flex-col">
                          <span>Content</span>
                          <span className="text-[10px] font-normal">Status / URL / Due</span>
                        </div>
                      </th>
                      <th className="px-4 py-3 text-center font-semibold min-w-[140px]">
                        <div className="flex flex-col">
                          <span>Development</span>
                          <span className="text-[10px] font-normal">Status / URL / Due</span>
                        </div>
                      </th>
                      <th className="px-4 py-3 text-center font-semibold min-w-[100px]">Overall</th>
                      <th className="px-4 py-3 text-center font-semibold w-16">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTasks.map((task, idx) => (
                      <tr 
                        key={task.task_id} 
                        className={`border-b ${borderColor} hover:${bgSecondary} transition-colors`}
                        data-testid={`task-row-${idx}`}
                      >
                        <td className={`px-4 py-3 text-sm ${textSecondary}`}>{task.sno}</td>
                        <td className={`px-4 py-3`}>
                          <span className={`text-sm font-medium ${textPrimary}`}>{task.page_name}</span>
                        </td>
                        
                        {/* Wireframe */}
                        <td className="px-2 py-2">
                          <PhaseCell 
                            task={task} 
                            phase="wireframe"
                            onStatusChange={(field, value) => handleStatusChange(task.task_id, field, value)}
                            isDark={isDark}
                          />
                        </td>
                        
                        {/* UI */}
                        <td className="px-2 py-2">
                          <PhaseCell 
                            task={task} 
                            phase="ui"
                            onStatusChange={(field, value) => handleStatusChange(task.task_id, field, value)}
                            isDark={isDark}
                          />
                        </td>
                        
                        {/* Content */}
                        <td className="px-2 py-2">
                          <PhaseCell 
                            task={task} 
                            phase="content"
                            onStatusChange={(field, value) => handleStatusChange(task.task_id, field, value)}
                            isDark={isDark}
                          />
                        </td>
                        
                        {/* Dev */}
                        <td className="px-2 py-2">
                          <PhaseCell 
                            task={task} 
                            phase="dev"
                            onStatusChange={(field, value) => handleStatusChange(task.task_id, field, value)}
                            isDark={isDark}
                          />
                        </td>
                        
                        {/* Overall Status */}
                        <td className="px-4 py-3 text-center">
                          <Select 
                            value={task.overall_status} 
                            onValueChange={(v) => handleStatusChange(task.task_id, 'overall_status', v)}
                          >
                            <SelectTrigger className={`h-7 text-xs ${STATUS_COLORS[task.overall_status]} border`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {STATUS_OPTIONS.map(s => (
                                <SelectItem key={s} value={s}>{s}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        
                        {/* Actions */}
                        <td className="px-4 py-3 text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeletePage(task.task_id)}
                            className="text-red-400 hover:text-red-300 h-7 w-7 p-0"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {filteredTasks.length === 0 && (
                      <tr>
                        <td colSpan={8} className={`px-4 py-8 text-center ${textSecondary}`}>
                          No pages found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Project Tabs - Right Sidebar as Bottom Tabs */}
          <div className={`w-48 border-l ${borderColor} ${bgCard} flex flex-col`}>
            <div className={`p-3 border-b ${borderColor}`}>
              <h3 className={`text-xs font-semibold ${textSecondary} uppercase`}>Projects</h3>
            </div>
            <div className="flex-1 overflow-auto p-2 space-y-1">
              {projects.map(project => (
                <button
                  key={project.project_id}
                  onClick={() => setSelectedProject(project.project_id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${
                    selectedProject === project.project_id
                      ? 'bg-[#6366f1] text-white'
                      : `${textSecondary} hover:${bgSecondary}`
                  }`}
                  data-testid={`project-tab-${project.project_id}`}
                >
                  <div className="font-medium truncate">{project.name}</div>
                  <div className="text-xs opacity-70 flex items-center gap-2 mt-1">
                    <Progress value={project.progress} className="h-1 flex-1" />
                    <span>{project.progress}%</span>
                  </div>
                </button>
              ))}
              {projects.length === 0 && (
                <p className={`text-xs ${textSecondary} text-center py-4`}>No projects yet</p>
              )}
            </div>
          </div>
        </div>

        {/* Create Project Modal */}
        <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <DialogContent className={`${bgCard} ${textPrimary} max-w-2xl`}>
            <DialogHeader>
              <DialogTitle>Create Website Project</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={`text-sm ${textSecondary} block mb-1`}>Project/Client Name *</label>
                <Input
                  value={newProject.name}
                  onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                  placeholder="Client Company Name"
                  className={bgSecondary}
                  data-testid="new-project-name"
                />
              </div>
              <div>
                <label className={`text-sm ${textSecondary} block mb-1`}>Domain URL</label>
                <Input
                  value={newProject.domain_url}
                  onChange={(e) => setNewProject({ ...newProject, domain_url: e.target.value })}
                  placeholder="www.example.com"
                  className={bgSecondary}
                />
              </div>
              <div>
                <label className={`text-sm ${textSecondary} block mb-1`}>Platform</label>
                <Select value={newProject.platform} onValueChange={(v) => setNewProject({ ...newProject, platform: v })}>
                  <SelectTrigger className={bgSecondary}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(options?.platforms || ['Website', 'Shopify', 'WordPress', 'Custom']).map(p => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className={`text-sm ${textSecondary} block mb-1`}>Website Type</label>
                <Select value={newProject.website_type} onValueChange={(v) => setNewProject({ ...newProject, website_type: v })}>
                  <SelectTrigger className={bgSecondary}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(options?.website_types || ['Business Website', 'E-commerce', 'Portfolio', 'Landing Page', 'Blog', 'Web App']).map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className={`text-sm ${textSecondary} block mb-1`}>Developer</label>
                <Input
                  value={newProject.developer}
                  onChange={(e) => setNewProject({ ...newProject, developer: e.target.value })}
                  placeholder="Assign developer"
                  className={bgSecondary}
                />
              </div>
              <div>
                <label className={`text-sm ${textSecondary} block mb-1`}>Server Details</label>
                <Input
                  value={newProject.server_details}
                  onChange={(e) => setNewProject({ ...newProject, server_details: e.target.value })}
                  placeholder="Hosting provider/details"
                  className={bgSecondary}
                />
              </div>
              <div>
                <label className={`text-sm ${textSecondary} block mb-1`}>Onboarding Date</label>
                <Input
                  type="date"
                  value={newProject.onboarding_date}
                  onChange={(e) => setNewProject({ ...newProject, onboarding_date: e.target.value })}
                  className={bgSecondary}
                />
              </div>
              <div>
                <label className={`text-sm ${textSecondary} block mb-1`}>Deadline</label>
                <Input
                  type="date"
                  value={newProject.deadline}
                  onChange={(e) => setNewProject({ ...newProject, deadline: e.target.value })}
                  className={bgSecondary}
                />
              </div>
              <div className="col-span-2">
                <label className={`text-sm ${textSecondary} block mb-1`}>Client Drive URL</label>
                <Input
                  value={newProject.client_drive_url}
                  onChange={(e) => setNewProject({ ...newProject, client_drive_url: e.target.value })}
                  placeholder="Google Drive / Dropbox link"
                  className={bgSecondary}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setIsCreateModalOpen(false)}>Cancel</Button>
              <Button onClick={handleCreateProject} className="bg-[#6366f1] hover:bg-[#4f46e5]" data-testid="submit-create-project">
                Create Project
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Page Modal */}
        <Dialog open={isAddPageModalOpen} onOpenChange={setIsAddPageModalOpen}>
          <DialogContent className={`${bgCard} ${textPrimary}`}>
            <DialogHeader>
              <DialogTitle>Add New Page</DialogTitle>
            </DialogHeader>
            <div>
              <label className={`text-sm ${textSecondary} block mb-1`}>Page Name *</label>
              <Input
                value={newPage.page_name}
                onChange={(e) => setNewPage({ ...newPage, page_name: e.target.value })}
                placeholder="e.g., Gallery Page, FAQ"
                className={bgSecondary}
                data-testid="new-page-name"
              />
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setIsAddPageModalOpen(false)}>Cancel</Button>
              <Button onClick={handleAddPage} className="bg-[#6366f1] hover:bg-[#4f46e5]" data-testid="submit-add-page">
                Add Page
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

// Phase Cell Component for table
const PhaseCell = ({ task, phase, onStatusChange, isDark }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [url, setUrl] = useState(task[`${phase}_url`] || '');
  const [due, setDue] = useState(task[`${phase}_due`] || '');
  
  const status = task[`${phase}_status`] || 'To-Do';
  const bgSecondary = isDark ? 'bg-[#27272a]' : 'bg-gray-100';
  const textSecondary = isDark ? 'text-[#a1a1aa]' : 'text-gray-600';

  const handleSave = () => {
    if (url !== task[`${phase}_url`]) {
      onStatusChange(`${phase}_url`, url);
    }
    if (due !== task[`${phase}_due`]) {
      onStatusChange(`${phase}_due`, due);
    }
    setIsEditing(false);
  };

  return (
    <div className={`p-2 rounded-lg ${bgSecondary} space-y-1`}>
      {/* Status Dropdown */}
      <Select 
        value={status} 
        onValueChange={(v) => onStatusChange(`${phase}_status`, v)}
      >
        <SelectTrigger className={`h-6 text-xs ${STATUS_COLORS[status]} border w-full`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map(s => (
            <SelectItem key={s} value={s}>{s}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* URL & Due Date */}
      {isEditing ? (
        <div className="space-y-1">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="URL"
            className="h-6 text-xs"
          />
          <Input
            type="date"
            value={due}
            onChange={(e) => setDue(e.target.value)}
            className="h-6 text-xs"
          />
          <div className="flex gap-1">
            <Button size="sm" onClick={handleSave} className="h-5 text-xs flex-1">Save</Button>
            <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)} className="h-5 text-xs">
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
      ) : (
        <div 
          className={`text-xs ${textSecondary} cursor-pointer hover:opacity-80`}
          onClick={() => setIsEditing(true)}
        >
          {task[`${phase}_url`] ? (
            <a 
              href={task[`${phase}_url`]} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-[#6366f1] hover:underline flex items-center gap-1"
              onClick={(e) => e.stopPropagation()}
            >
              <Link2 className="h-3 w-3" /> Link
            </a>
          ) : (
            <span className="opacity-50">+ Add URL</span>
          )}
          {task[`${phase}_due`] && (
            <span className="block">{task[`${phase}_due`]}</span>
          )}
        </div>
      )}
    </div>
  );
};

export default WebsiteProjectsPage;
