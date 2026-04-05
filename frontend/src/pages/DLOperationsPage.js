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

// Website Types and Platforms
const WEBSITE_TYPES = ['Landing Page', 'Business Website', 'Shopify Store', 'Web App', 'E-commerce', 'Portfolio'];
const PLATFORMS = ['WordPress', 'Shopify', 'Wix', 'Webflow', 'Framer', 'AI Builder', 'Custom Code', 'React'];

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
  const [teamMembers, setTeamMembers] = useState([]);
  const [viewMode, setViewMode] = useState('projects');
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
  
  // Filter projects
  const filteredProjects = projects.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDeveloper = developerFilter === 'all' || p.developer === developerFilter;
    const projectStage = p.workflow_stage || 'creation';
    const matchesStage = workflowStage === 'all' || projectStage === workflowStage;
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchesSearch && matchesDeveloper && matchesStage && matchesStatus;
  });
  
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
  
  return (
    <Layout>
      <div className="flex flex-col h-full pb-16 md:pb-0" data-testid="dl-operations-page">
        {/* Header */}
        <div className={`p-4 md:p-6 border-b ${borderColor} ${isDark ? 'bg-[#0c0a09]' : 'bg-white'}`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center">
                <Globe className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className={`text-xl md:text-2xl font-bold ${textPrimary}`}>Web Dev</h1>
              </div>
              <Badge className="bg-[#6366f1]/20 text-[#6366f1] ml-2">{projects.length} Projects</Badge>
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
          
          {/* Workflow Stages Bar */}
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
        
        {/* Filters */}
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
            
            {/* View Mode Toggle */}
            <div className={`inline-flex rounded-lg p-1 ${bgSecondary}`}>
              <Button 
                size="sm" 
                variant={viewMode === 'projects' ? 'default' : 'ghost'}
                onClick={() => setViewMode('projects')}
                className={viewMode === 'projects' ? 'bg-[#6366f1]' : ''}
              >
                <LayoutGrid className="h-4 w-4 mr-1" /> Projects
              </Button>
              <Button 
                size="sm" 
                variant={viewMode === 'stages' ? 'default' : 'ghost'}
                onClick={() => setViewMode('stages')}
                className={viewMode === 'stages' ? 'bg-[#6366f1]' : ''}
              >
                <ListTodo className="h-4 w-4 mr-1" /> By Stage
              </Button>
            </div>
            
            {/* Developer Filter */}
            <Select value={developerFilter} onValueChange={setDeveloperFilter}>
              <SelectTrigger className={`w-48 ${bgSecondary} border-none`}>
                <SelectValue placeholder="All Developers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Developers</SelectItem>
                {teamMembers.map(m => <SelectItem key={m.user_id} value={m.name}>{m.name}</SelectItem>)}
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
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="on-hold">On Hold</SelectItem>
              </SelectContent>
            </Select>
            
            {/* Clear Filters */}
            {(searchTerm || developerFilter !== 'all' || statusFilter !== 'all' || workflowStage !== 'all') && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => {
                  setSearchTerm('');
                  setDeveloperFilter('all');
                  setStatusFilter('all');
                  setWorkflowStage('all');
                }}
                className="text-red-400"
              >
                <X className="h-4 w-4 mr-1" /> Clear
              </Button>
            )}
          </div>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-auto p-4 md:p-6">
          {filteredProjects.length === 0 ? (
            <div className={`text-center py-16 ${textSecondary}`}>
              <FolderKanban className="h-16 w-16 mx-auto mb-4 opacity-30" />
              <h3 className={`text-lg font-medium ${textPrimary} mb-2`}>No projects found</h3>
              <p className="mb-4">Create your first website project to get started</p>
              <Button onClick={handleNewProject} className="bg-[#6366f1] hover:bg-[#4f46e5]">
                <Plus className="h-4 w-4 mr-2" /> Create Project
              </Button>
            </div>
          ) : viewMode === 'projects' ? (
            /* Projects Grid View */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProjects.map(project => {
                const currentStage = project.workflow_stage || 'creation';
                const stageInfo = WORKFLOW_STAGES.find(s => s.id === currentStage);
                const nextStage = getNextStage(currentStage);
                const nextStageInfo = nextStage ? WORKFLOW_STAGES.find(s => s.id === nextStage) : null;
                
                return (
                  <div 
                    key={project.project_id} 
                    className={`rounded-xl border ${borderColor} ${bgCard} overflow-hidden hover:shadow-lg transition-all group`}
                  >
                    {/* Card Header */}
                    <div 
                      className="p-4 cursor-pointer"
                      onClick={() => openProject(project.project_id)}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="w-10 h-10 rounded-lg bg-[#6366f1]/10 flex items-center justify-center shrink-0">
                            <Globe className="h-5 w-5 text-[#6366f1]" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`font-semibold ${textPrimary} truncate`}>{project.name}</p>
                            <p className={`text-xs ${textSecondary} truncate`}>{project.platform} • {project.website_type}</p>
                          </div>
                        </div>
                      </div>
                      
                      {/* Workflow Stage */}
                      <div className="flex items-center gap-2 mb-3">
                        <div className={`w-2 h-2 rounded-full ${stageInfo?.color || 'bg-gray-500'}`} />
                        <span className={`text-sm font-medium ${textPrimary}`}>{stageInfo?.label || 'Unknown'}</span>
                        <Badge className={`ml-auto text-xs ${
                          project.status === 'active' ? 'bg-green-500/20 text-green-400' :
                          project.status === 'completed' ? 'bg-blue-500/20 text-blue-400' :
                          'bg-gray-500/20 text-gray-400'
                        }`}>
                          {project.status || 'active'}
                        </Badge>
                      </div>
                      
                      {/* Progress */}
                      <div className="mb-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-xs ${textSecondary}`}>Progress</span>
                          <span className={`text-xs font-semibold ${textPrimary}`}>{project.overall_percent || 0}%</span>
                        </div>
                        <Progress value={project.overall_percent || 0} className="h-2" />
                      </div>
                      
                      {/* Stats */}
                      <div className="flex items-center justify-between text-xs">
                        <div className={`flex items-center gap-1 ${textSecondary}`}>
                          <FileText className="h-3 w-3" />
                          <span>{project.total_pages || 0} pages</span>
                        </div>
                        {project.deadline && (
                          <div className={`flex items-center gap-1 ${new Date(project.deadline) < new Date() ? 'text-red-400' : textSecondary}`}>
                            <Calendar className="h-3 w-3" />
                            <span>{project.deadline}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Card Footer */}
                    <div className={`px-4 py-3 border-t ${borderColor} flex items-center gap-2`}>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openProject(project.project_id)}
                        className="flex-1 h-8"
                      >
                        <Eye className="h-3 w-3 mr-1" /> View
                      </Button>
                      {nextStageInfo && (
                        <Button
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); handleStageTransition(project.project_id, nextStage); }}
                          className="flex-1 h-8 bg-[#6366f1] hover:bg-[#5855eb]"
                        >
                          <ArrowRight className="h-3 w-3 mr-1" /> {nextStageInfo.label}
                        </Button>
                      )}
                      {!nextStageInfo && (
                        <Badge className="flex-1 justify-center bg-emerald-500/20 text-emerald-400">Completed</Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* By Stage View */
            <div className="space-y-6">
              {WORKFLOW_STAGES.map(stage => {
                const stageProjects = filteredProjects.filter(p => (p.workflow_stage || 'creation') === stage.id);
                if (stageProjects.length === 0) return null;
                
                return (
                  <div key={stage.id} className={`rounded-xl border ${borderColor} ${bgCard} overflow-hidden`}>
                    <div className={`p-4 ${bgSecondary} flex items-center gap-3`}>
                      <div className={`w-3 h-3 rounded-full ${stage.color}`} />
                      <h3 className={`font-semibold ${textPrimary}`}>{stage.label}</h3>
                      <Badge className="bg-white/10">{stageProjects.length}</Badge>
                    </div>
                    <div className="divide-y divide-gray-800">
                      {stageProjects.map(project => (
                        <div 
                          key={project.project_id}
                          className="p-4 flex items-center justify-between hover:bg-[#27272a]/30 cursor-pointer"
                          onClick={() => openProject(project.project_id)}
                        >
                          <div className="flex items-center gap-3">
                            <Globe className="h-5 w-5 text-[#6366f1]" />
                            <div>
                              <p className={`font-medium ${textPrimary}`}>{project.name}</p>
                              <p className={`text-xs ${textSecondary}`}>{project.platform} • {project.developer || 'Unassigned'}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <Progress value={project.overall_percent || 0} className="w-24 h-2" />
                            <span className={`text-sm ${textPrimary}`}>{project.overall_percent || 0}%</span>
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
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
                    <div className="grid grid-cols-3 gap-3">
                      {WEBSITE_TYPES.map(type => (
                        <button
                          key={type}
                          onClick={() => setNewProject({ ...newProject, website_type: type })}
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
                            {type === 'Shopify Store' && 'E-commerce store'}
                            {type === 'Web App' && 'Custom web application'}
                            {type === 'E-commerce' && 'Online store'}
                            {type === 'Portfolio' && 'Showcase work'}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  {/* Platform */}
                  <div>
                    <label className={`text-base font-semibold ${textPrimary} block mb-3`}>Select Platform</label>
                    <div className="grid grid-cols-4 gap-3">
                      {PLATFORMS.map(platform => (
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
