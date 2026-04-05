import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import {
  Globe, Plus, Search, Eye, ArrowRight, FolderKanban, 
  Calendar, FileText, LayoutGrid, ListTodo, Filter, X, Check, User, Building2
} from 'lucide-react';
import { Progress } from '../components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import axios from 'axios';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

// Website Types
const WEBSITE_TYPES = ['Landing Page', 'Business Website', 'Ecommerce', 'Web App'];

// Platform options based on website type
const PLATFORM_OPTIONS = {
  'Landing Page': ['WordPress', 'Wix', 'Webflow', 'Framer', 'AI Builder', 'Custom Code'],
  'Business Website': ['WordPress', 'Wix', 'Webflow', 'Framer', 'AI Builder', 'Custom Code'],
  'Ecommerce': ['Shopify', 'Wix', 'WooCommerce'],
  'Web App': ['AI Builder', 'Custom Code']
};

// Workflow Stage Definitions
const WORKFLOW_STAGES = [
  { id: 'creation', label: 'Project Creation', color: 'bg-yellow-500', description: 'New projects awaiting initial setup' },
  { id: 'discovery', label: 'Discovery Call', color: 'bg-orange-500', description: 'Requirements gathering and planning' },
  { id: 'content', label: 'Content', color: 'bg-blue-500', description: 'Content writing and collection' },
  { id: 'wireframe', label: 'Wireframe', color: 'bg-purple-500', description: 'Wireframe design and client approval' },
  { id: 'ui', label: 'UI Design', color: 'bg-pink-500', description: 'UI design and client approval' },
  { id: 'development', label: 'Development', color: 'bg-green-500', description: 'Development in progress' },
  { id: 'testing', label: 'Testing', color: 'bg-cyan-500', description: 'QA testing and bug fixes' },
  { id: 'delivered', label: 'Delivered', color: 'bg-emerald-500', description: 'Project completed and delivered' }
];

export default function DLOperationsPage() {
  const { isDark } = useTheme();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [workflowStage, setWorkflowStage] = useState('all');
  const [developerFilter, setDeveloperFilter] = useState('all');
  const [clientFilter, setClientFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all'); // all, this_month, this_year
  const [teamMembers, setTeamMembers] = useState([]);
  const [mainTab, setMainTab] = useState('tracker'); // tracker | projects
  const [showFilters, setShowFilters] = useState(false);
  
  // Create Project Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createStep, setCreateStep] = useState(1);
  const [newProject, setNewProject] = useState({
    name: '',
    website_type: '',
    platform: '',
    client_name: '',
    domain_url: '',
    deadline: '',
    notes: ''
  });
  
  const token = localStorage.getItem('session_token');
  
  // Theme classes
  const bgCard = isDark ? 'bg-[#18181b]' : 'bg-white';
  const bgSecondary = isDark ? 'bg-[#27272a]' : 'bg-gray-100';
  const borderColor = isDark ? 'border-[#27272a]' : 'border-gray-200';
  const textPrimary = isDark ? 'text-[#fafafa]' : 'text-gray-900';
  const textSecondary = isDark ? 'text-[#a1a1aa]' : 'text-gray-600';
  
  // Computed stats
  const totalProjects = projects.length;
  const uniqueClients = [...new Set(projects.map(p => p.client_name).filter(Boolean))].length;
  const uniqueDevelopers = [...new Set(projects.map(p => p.developer).filter(Boolean))].length;
  const totalPages = projects.reduce((sum, p) => sum + (p.total_pages || 0), 0);
  
  // Get unique values for filters
  const clientNames = [...new Set(projects.map(p => p.client_name).filter(Boolean))];
  const developerNames = [...new Set(projects.map(p => p.developer).filter(Boolean))];
  
  // Load projects
  const loadProjects = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/website-projects/all-projects-summary`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProjects(res.data);
    } catch (error) {
      console.error('Error loading projects:', error);
    } finally {
      setLoading(false);
    }
  }, [token]);
  
  // Load team members
  const loadTeamMembers = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/website-projects/team-members`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTeamMembers(res.data);
    } catch (error) {
      console.error('Error loading team members:', error);
    }
  }, [token]);
  
  useEffect(() => {
    loadProjects();
    loadTeamMembers();
  }, [loadProjects, loadTeamMembers]);
  
  // Open create project modal
  const handleNewProject = () => {
    setShowCreateModal(true);
    setCreateStep(1);
    setNewProject({
      name: '',
      website_type: '',
      platform: '',
      client_name: '',
      domain_url: '',
      deadline: '',
      notes: ''
    });
  };
  
  // Create project
  const handleCreateProject = async () => {
    if (!newProject.name.trim()) {
      toast.error('Please enter a project name');
      return;
    }
    if (!newProject.website_type || !newProject.platform) {
      toast.error('Please select website type and platform');
      return;
    }
    
    try {
      const projectData = {
        ...newProject,
        workflow_stage: 'creation',
        status: 'active'
      };
      
      await axios.post(
        `${API}/api/website-projects/projects`,
        projectData,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success('Project created successfully!');
      setShowCreateModal(false);
      loadProjects();
    } catch (error) {
      toast.error('Failed to create project');
    }
  };
  
  // Close create modal
  const closeCreateModal = () => {
    setShowCreateModal(false);
    setCreateStep(1);
  };
  
  // Open project detail page (navigate instead of modal)
  const openProject = (projectId) => {
    navigate(`/project/${projectId}`);
  };
  
  // Handle stage transition
  const handleStageTransition = async (projectId, newStage) => {
    try {
      await axios.put(
        `${API}/api/website-projects/projects/${projectId}/transition`,
        { stage: newStage },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`Project moved to ${WORKFLOW_STAGES.find(s => s.id === newStage)?.label || newStage}`);
      loadProjects();
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Failed to move project';
      toast.error(errorMsg);
    }
  };
  
  // Get next stage
  const getNextStage = (currentStage) => {
    const stages = ['creation', 'discovery', 'content', 'wireframe', 'ui', 'development', 'testing', 'delivered'];
    const currentIndex = stages.indexOf(currentStage || 'creation');
    if (currentIndex < stages.length - 1) {
      return stages[currentIndex + 1];
    }
    return null;
  };
  
  if (loading) {
    return (
      <Layout>
        <div className={`flex items-center justify-center h-full ${textPrimary}`}>Loading...</div>
      </Layout>
    );
  }
  
  // Filter projects
  const filteredProjects = projects.filter(project => {
    const matchesSearch = !searchTerm || 
      project.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.client_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStage = workflowStage === 'all' || (project.workflow_stage || 'creation') === workflowStage;
    const matchesDeveloper = developerFilter === 'all' || project.developer === developerFilter;
    const matchesClient = clientFilter === 'all' || project.client_name === clientFilter;
    const matchesStatus = statusFilter === 'all' || project.status === statusFilter;
    return matchesSearch && matchesStage && matchesDeveloper && matchesClient && matchesStatus;
  });
  
  return (
    <Layout>
      <div className="flex flex-col h-full pb-16 md:pb-0" data-testid="dl-operations-page">
        {/* Header with Stats */}
        <div className={`p-4 md:p-6 border-b ${borderColor} ${isDark ? 'bg-[#0c0a09]' : 'bg-white'}`}>
          {/* Title Row */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center">
                <Globe className="h-5 w-5 text-white" />
              </div>
              <h1 className={`text-xl md:text-2xl font-bold ${textPrimary}`}>Website Developments</h1>
            </div>
            <Button 
              onClick={handleNewProject}
              className="bg-[#6366f1] hover:bg-[#4f46e5] text-white"
              data-testid="new-project-btn"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Project
            </Button>
          </div>
          
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
            {/* No of Projects */}
            <div className={`p-4 rounded-xl ${bgSecondary}`}>
              <p className={`text-xs ${textSecondary} mb-1`}>No of Projects</p>
              <p className={`text-2xl font-bold ${textPrimary}`}>{totalProjects}</p>
            </div>
            
            {/* Clients */}
            <div className={`p-4 rounded-xl ${bgSecondary}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-xs ${textSecondary} mb-1`}>Clients</p>
                  <p className={`text-2xl font-bold ${textPrimary}`}>{uniqueClients}</p>
                </div>
                <Building2 className="h-5 w-5 text-[#6366f1]" />
              </div>
            </div>
            
            {/* Developers */}
            <div className={`p-4 rounded-xl ${bgSecondary}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-xs ${textSecondary} mb-1`}>Developers</p>
                  <p className={`text-2xl font-bold ${textPrimary}`}>{uniqueDevelopers}</p>
                </div>
                <User className="h-5 w-5 text-[#6366f1]" />
              </div>
            </div>
            
            {/* Total Pages */}
            <div className={`p-4 rounded-xl ${bgSecondary}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-xs ${textSecondary} mb-1`}>Pages</p>
                  <p className={`text-2xl font-bold ${textPrimary}`}>{totalPages}</p>
                </div>
                <FileText className="h-5 w-5 text-[#6366f1]" />
              </div>
            </div>
            
            {/* Date Filter */}
            <div className={`p-3 rounded-xl ${bgSecondary}`}>
              <p className={`text-xs ${textSecondary} mb-2`}>Filter by Date</p>
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger className={`h-8 ${bgCard} border-none text-xs`}>
                  <SelectValue placeholder="All Time" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="this_month">This Month</SelectItem>
                  <SelectItem value="this_year">This Year</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {/* Main Tabs: Tracker Board | Projects */}
          <div className={`inline-flex rounded-lg p-1 ${bgSecondary}`}>
            <Button 
              size="sm" 
              variant={mainTab === 'tracker' ? 'default' : 'ghost'}
              onClick={() => setMainTab('tracker')}
              className={`gap-2 ${mainTab === 'tracker' ? 'bg-[#6366f1]' : ''}`}
            >
              <FolderKanban className="h-4 w-4" /> Tracker Board
            </Button>
            <Button 
              size="sm" 
              variant={mainTab === 'projects' ? 'default' : 'ghost'}
              onClick={() => setMainTab('projects')}
              className={`gap-2 ${mainTab === 'projects' ? 'bg-[#6366f1]' : ''}`}
            >
              <LayoutGrid className="h-4 w-4" /> Projects
            </Button>
          </div>
        </div>
        
        {/* Tracker Board Tab */}
        {mainTab === 'tracker' && (
          <div className="flex-1 overflow-auto">
            {/* Stage Sub-tabs */}
            <div className={`p-4 border-b ${borderColor} ${isDark ? 'bg-[#09090b]' : 'bg-gray-50'}`}>
              <div className="flex items-center gap-2 overflow-x-auto pb-2 hide-scrollbar">
                <Button
                  size="sm"
                  variant={workflowStage === 'all' ? 'default' : 'outline'}
                  onClick={() => setWorkflowStage('all')}
                  className={`h-8 shrink-0 ${workflowStage === 'all' ? 'bg-[#6366f1]' : ''}`}
                >
                  All ({projects.length})
                </Button>
                {WORKFLOW_STAGES.map(stage => {
                  const stageCount = projects.filter(p => (p.workflow_stage || 'creation') === stage.id).length;
                  return (
                    <Button
                      key={stage.id}
                      size="sm"
                      variant={workflowStage === stage.id ? 'default' : 'outline'}
                      onClick={() => setWorkflowStage(stage.id)}
                      className={`h-8 gap-2 shrink-0 ${workflowStage === stage.id ? 'bg-[#6366f1]' : ''}`}
                    >
                      <div className={`w-2 h-2 rounded-full ${stage.color}`} />
                      {stage.label}
                      {stageCount > 0 && <span className="text-xs opacity-70">({stageCount})</span>}
                    </Button>
                  );
                })}
              </div>
            </div>
            
            {/* Projects Table in Tracker View */}
            <div className="p-4">
              <div className={`rounded-xl border ${borderColor} ${bgCard} overflow-hidden`}>
                <table className="w-full">
                  <thead className={bgSecondary}>
                    <tr className={`text-xs ${textSecondary} uppercase`}>
                      <th className="px-4 py-3 text-left font-semibold">Project</th>
                      <th className="px-4 py-3 text-left font-semibold">Client</th>
                      <th className="px-4 py-3 text-left font-semibold">Developer</th>
                      <th className="px-4 py-3 text-center font-semibold">Pages</th>
                      <th className="px-4 py-3 text-center font-semibold">Progress</th>
                      <th className="px-4 py-3 text-center font-semibold">Stage</th>
                      <th className="px-4 py-3 text-center font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProjects.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center">
                          <div className={textSecondary}>
                            <Globe className="h-10 w-10 mx-auto mb-3 opacity-50" />
                            <p className="text-sm">No projects found</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredProjects.map(project => {
                        const stage = WORKFLOW_STAGES.find(s => s.id === (project.workflow_stage || 'creation'));
                        const nextStage = getNextStage(project.workflow_stage || 'creation');
                        return (
                          <tr key={project.project_id} className={`border-t ${borderColor} hover:${bgSecondary} transition-colors cursor-pointer`} onClick={() => openProject(project.project_id)}>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <Globe className="h-5 w-5 text-[#6366f1]" />
                                <div>
                                  <p className={`font-medium ${textPrimary}`}>{project.name}</p>
                                  <p className={`text-xs ${textSecondary}`}>{project.platform} • {project.website_type}</p>
                                </div>
                              </div>
                            </td>
                            <td className={`px-4 py-3 ${textPrimary}`}>{project.client_name || '-'}</td>
                            <td className={`px-4 py-3 ${textPrimary}`}>{project.developer || 'Unassigned'}</td>
                            <td className={`px-4 py-3 text-center ${textPrimary}`}>{project.total_pages || 0}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-center gap-2">
                                <Progress value={project.overall_percent || 0} className="w-16 h-2" />
                                <span className={`text-xs ${textSecondary}`}>{project.overall_percent || 0}%</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <Badge className={`${stage?.color}/20 ${stage?.color?.replace('bg-', 'text-')}`}>
                                {stage?.label || 'Creation'}
                              </Badge>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-center gap-2">
                                <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={(e) => { e.stopPropagation(); openProject(project.project_id); }}>
                                  <Eye className="h-4 w-4" />
                                </Button>
                                {nextStage && (
                                  <Button 
                                    size="sm" 
                                    variant="ghost" 
                                    className="h-8 w-8 p-0 hover:bg-green-500/20"
                                    onClick={(e) => { e.stopPropagation(); handleMoveToStage(project.project_id, nextStage); }}
                                    title={`Move to ${WORKFLOW_STAGES.find(s => s.id === nextStage)?.label}`}
                                  >
                                    <ArrowRight className="h-4 w-4 text-green-500" />
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
        
        {/* Projects Tab */}
        {mainTab === 'projects' && (
          <div className="flex-1 overflow-auto">
            {/* Filter Bar */}
            <div className={`p-4 border-b ${borderColor} ${isDark ? 'bg-[#09090b]' : 'bg-gray-50'}`}>
              <div className="flex flex-wrap items-center gap-3">
                {/* Search */}
                <div className="relative flex-1 min-w-[200px] max-w-md">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input 
                    placeholder="Search projects..." 
                    value={searchTerm} 
                    onChange={(e) => setSearchTerm(e.target.value)} 
                    className={`pl-10 ${bgSecondary} border-none`} 
                  />
                </div>
                
                {/* Client Filter */}
                <Select value={clientFilter} onValueChange={setClientFilter}>
                  <SelectTrigger className={`w-44 ${bgSecondary} border-none`}>
                    <SelectValue placeholder="All Clients" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Clients</SelectItem>
                    {clientNames.map(name => <SelectItem key={name} value={name}>{name}</SelectItem>)}
                  </SelectContent>
                </Select>
                
                {/* Developer Filter */}
                <Select value={developerFilter} onValueChange={setDeveloperFilter}>
                  <SelectTrigger className={`w-44 ${bgSecondary} border-none`}>
                    <SelectValue placeholder="All Developers" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Developers</SelectItem>
                    {developerNames.map(name => <SelectItem key={name} value={name}>{name}</SelectItem>)}
                  </SelectContent>
                </Select>
                
                {/* Status Filter */}
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className={`w-36 ${bgSecondary} border-none`}>
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="paused">Paused</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {/* Projects Grid/List */}
            <div className="p-4">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredProjects.length === 0 ? (
                  <div className={`col-span-full p-12 text-center ${textSecondary}`}>
                    <Globe className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No projects found</p>
                  </div>
                ) : (
                  filteredProjects.map(project => {
                    const stage = WORKFLOW_STAGES.find(s => s.id === (project.workflow_stage || 'creation'));
                    return (
                      <div 
                        key={project.project_id}
                        className={`${bgCard} rounded-xl border ${borderColor} p-4 hover:border-[#6366f1]/50 transition-all cursor-pointer`}
                        onClick={() => openProject(project.project_id)}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-[#6366f1]/20 flex items-center justify-center">
                              <Globe className="h-5 w-5 text-[#6366f1]" />
                            </div>
                            <div>
                              <p className={`font-semibold ${textPrimary}`}>{project.name}</p>
                              <p className={`text-xs ${textSecondary}`}>{project.client_name || 'No Client'}</p>
                            </div>
                          </div>
                          <Badge className={`${stage?.color}/20 ${stage?.color?.replace('bg-', 'text-')} text-xs`}>
                            {stage?.label || 'Creation'}
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-2 mb-3">
                          <div className={`p-2 rounded-lg ${bgSecondary} text-center`}>
                            <p className={`text-xs ${textSecondary}`}>Platform</p>
                            <p className={`text-sm font-medium ${textPrimary}`}>{project.platform || '-'}</p>
                          </div>
                          <div className={`p-2 rounded-lg ${bgSecondary} text-center`}>
                            <p className={`text-xs ${textSecondary}`}>Pages</p>
                            <p className={`text-sm font-medium ${textPrimary}`}>{project.total_pages || 0}</p>
                          </div>
                          <div className={`p-2 rounded-lg ${bgSecondary} text-center`}>
                            <p className={`text-xs ${textSecondary}`}>Developer</p>
                            <p className={`text-sm font-medium ${textPrimary} truncate`}>{project.developer || '-'}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 flex-1">
                            <Progress value={project.overall_percent || 0} className="flex-1 h-2" />
                            <span className={`text-sm ${textPrimary}`}>{project.overall_percent || 0}%</span>
                          </div>
                          <Button size="sm" variant="ghost" className="ml-2">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Create Project Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" data-testid="create-project-modal">
          <div className={`${bgCard} rounded-xl w-full max-w-2xl border ${borderColor} max-h-[90vh] overflow-hidden`}>
            {/* Header */}
            <div className={`p-6 border-b ${borderColor} flex items-center justify-between`}>
              <h2 className={`text-xl font-bold ${textPrimary}`}>Create New Project</h2>
              <Button variant="ghost" size="sm" onClick={closeCreateModal} className="h-8 w-8 p-0">
                <X className="h-5 w-5" />
              </Button>
            </div>
            
            {/* Step Indicator */}
            <div className="px-6 pt-4">
              <div className="flex items-center justify-center gap-2 mb-4">
                {[1, 2, 3].map(step => (
                  <div key={step} className="flex items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
                      createStep >= step ? 'bg-[#6366f1] text-white' : `${bgSecondary} ${textSecondary}`
                    }`}>
                      {createStep > step ? <Check className="h-4 w-4" /> : step}
                    </div>
                    {step < 3 && <div className={`w-12 h-0.5 mx-2 ${createStep > step ? 'bg-[#6366f1]' : bgSecondary}`} />}
                  </div>
                ))}
              </div>
            </div>
            
            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {/* Step 1: Website Type & Platform */}
              {createStep === 1 && (
                <div className="space-y-6">
                  {/* Website Type */}
                  <div>
                    <label className={`text-base font-semibold ${textPrimary} block mb-3`}>Select Website Type</label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {WEBSITE_TYPES.map(type => (
                        <button
                          key={type}
                          onClick={() => setNewProject({ ...newProject, website_type: type, platform: '' })}
                          className={`p-4 rounded-xl border-2 transition-all text-left ${
                            newProject.website_type === type
                              ? 'border-[#6366f1] bg-[#6366f1]/10'
                              : `border-transparent ${bgSecondary} hover:border-[#6366f1]/50`
                          }`}
                        >
                          <p className={`font-medium ${textPrimary}`}>{type}</p>
                          <p className={`text-xs ${textSecondary} mt-1`}>
                            {type === 'Landing Page' && 'Single page website'}
                            {type === 'Business Website' && 'Multi-page corporate site'}
                            {type === 'Ecommerce' && 'Online store'}
                            {type === 'Web App' && 'Custom web application'}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  {/* Platform - Shows only when website type is selected */}
                  {newProject.website_type && (
                    <div>
                      <label className={`text-base font-semibold ${textPrimary} block mb-3`}>
                        Select Platform
                        <span className={`text-sm font-normal ${textSecondary} ml-2`}>
                          (for {newProject.website_type})
                        </span>
                      </label>
                      <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                        {PLATFORM_OPTIONS[newProject.website_type]?.map(platform => (
                          <button
                            key={platform}
                            onClick={() => setNewProject({ ...newProject, platform: platform })}
                            className={`p-3 rounded-xl border-2 transition-all text-center ${
                              newProject.platform === platform
                                ? 'border-[#6366f1] bg-[#6366f1]/10'
                                : `border-transparent ${bgSecondary} hover:border-[#6366f1]/50`
                            }`}
                          >
                            <p className={`font-medium text-sm ${textPrimary}`}>{platform}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Selection Preview */}
                  {newProject.website_type && newProject.platform && (
                    <div className={`p-4 rounded-lg ${isDark ? 'bg-[#6366f1]/10' : 'bg-[#6366f1]/5'} border border-[#6366f1]/30`}>
                      <p className={`text-sm ${textSecondary}`}>Creating:</p>
                      <p className={`font-semibold ${textPrimary}`}>{newProject.platform} {newProject.website_type}</p>
                    </div>
                  )}
                </div>
              )}
              
              {/* Step 2: Project Details */}
              {createStep === 2 && (
                <div className="space-y-4">
                  <div>
                    <label className={`block text-sm font-medium ${textPrimary} mb-2`}>Project Name *</label>
                    <Input
                      value={newProject.name}
                      onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                      placeholder="e.g., Acme Corp Website"
                      className={`${bgSecondary} border-none`}
                    />
                  </div>
                  
                  <div>
                    <label className={`block text-sm font-medium ${textPrimary} mb-2`}>Client Name</label>
                    <Input
                      value={newProject.client_name}
                      onChange={(e) => setNewProject({ ...newProject, client_name: e.target.value })}
                      placeholder="e.g., Acme Corporation"
                      className={`${bgSecondary} border-none`}
                    />
                  </div>
                  
                  <div>
                    <label className={`block text-sm font-medium ${textPrimary} mb-2`}>Domain URL</label>
                    <Input
                      value={newProject.domain_url}
                      onChange={(e) => setNewProject({ ...newProject, domain_url: e.target.value })}
                      placeholder="e.g., www.acme.com"
                      className={`${bgSecondary} border-none`}
                    />
                  </div>
                  
                  <div>
                    <label className={`block text-sm font-medium ${textPrimary} mb-2`}>Deadline</label>
                    <Input
                      type="date"
                      value={newProject.deadline}
                      onChange={(e) => setNewProject({ ...newProject, deadline: e.target.value })}
                      className={`${bgSecondary} border-none`}
                    />
                  </div>
                </div>
              )}
              
              {/* Step 3: Review & Create */}
              {createStep === 3 && (
                <div className="space-y-4">
                  <div className={`p-6 rounded-xl ${bgSecondary}`}>
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-12 h-12 rounded-xl bg-[#6366f1] flex items-center justify-center">
                        <Globe className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <h3 className={`text-lg font-bold ${textPrimary}`}>{newProject.name || 'Untitled Project'}</h3>
                        <p className={`text-sm ${textSecondary}`}>{newProject.platform} • {newProject.website_type}</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 mt-4">
                      <div className={`p-3 rounded-lg ${bgCard}`}>
                        <p className={`text-xs ${textSecondary}`}>Client</p>
                        <p className={`font-medium ${textPrimary}`}>{newProject.client_name || 'Not specified'}</p>
                      </div>
                      <div className={`p-3 rounded-lg ${bgCard}`}>
                        <p className={`text-xs ${textSecondary}`}>Domain</p>
                        <p className={`font-medium ${textPrimary}`}>{newProject.domain_url || 'Not specified'}</p>
                      </div>
                      <div className={`p-3 rounded-lg ${bgCard}`}>
                        <p className={`text-xs ${textSecondary}`}>Deadline</p>
                        <p className={`font-medium ${textPrimary}`}>{newProject.deadline || 'Not set'}</p>
                      </div>
                      <div className={`p-3 rounded-lg ${bgCard}`}>
                        <p className={`text-xs ${textSecondary}`}>Status</p>
                        <p className={`font-medium ${textPrimary}`}>Project Creation</p>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <label className={`block text-sm font-medium ${textPrimary} mb-2`}>Notes (Optional)</label>
                    <Textarea
                      value={newProject.notes}
                      onChange={(e) => setNewProject({ ...newProject, notes: e.target.value })}
                      placeholder="Any additional notes about this project..."
                      className={`${bgSecondary} border-none min-h-[80px]`}
                    />
                  </div>
                </div>
              )}
            </div>
            
            {/* Footer */}
            <div className={`p-6 border-t ${borderColor} flex justify-between`}>
              <Button 
                variant="outline" 
                onClick={() => createStep > 1 ? setCreateStep(createStep - 1) : closeCreateModal()}
              >
                {createStep > 1 ? 'Back' : 'Cancel'}
              </Button>
              
              {createStep < 3 ? (
                <Button 
                  onClick={() => setCreateStep(createStep + 1)}
                  className="bg-[#6366f1] hover:bg-[#4f46e5]"
                  disabled={createStep === 1 && (!newProject.website_type || !newProject.platform)}
                >
                  Next
                </Button>
              ) : (
                <Button 
                  onClick={handleCreateProject}
                  className="bg-[#6366f1] hover:bg-[#4f46e5]"
                  disabled={!newProject.name.trim()}
                >
                  Create Project
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
