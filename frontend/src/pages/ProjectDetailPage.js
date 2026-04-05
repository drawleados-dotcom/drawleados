import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import {
  ArrowLeft, Globe, Calendar, User, Users, FileText, Settings, Palette, 
  ChevronDown, ChevronRight, Check, Clock, Play, Pause, Send,
  MessageSquare, CheckCircle2, AlertCircle, RefreshCw, X,
  Eye, Edit2, Trash2, Plus, Link2, ExternalLink, Timer, Layers,
  Code, PenTool, TestTube, Truck, ClipboardCheck
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

// Stage definitions with colors
const WORKFLOW_STAGES = [
  { id: 'content', label: 'Content', icon: FileText, color: 'bg-blue-500', textColor: 'text-blue-400' },
  { id: 'wireframe', label: 'Wireframe', icon: PenTool, color: 'bg-purple-500', textColor: 'text-purple-400' },
  { id: 'ui', label: 'UI Design', icon: Palette, color: 'bg-pink-500', textColor: 'text-pink-400' },
  { id: 'dev', label: 'Development', icon: Code, color: 'bg-green-500', textColor: 'text-green-400' },
  { id: 'test', label: 'Testing', icon: TestTube, color: 'bg-cyan-500', textColor: 'text-cyan-400' },
  { id: 'delivery', label: 'Delivery', icon: Truck, color: 'bg-emerald-500', textColor: 'text-emerald-400' },
  { id: 'approval', label: 'Approvals', icon: ClipboardCheck, color: 'bg-orange-500', textColor: 'text-orange-400' }
];

export default function ProjectDetailPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const { user } = useAuth();
  
  const [activeTab, setActiveTab] = useState('pages');
  const [project, setProject] = useState(null);
  const [pages, setPages] = useState([]);
  const [stageTasks, setStageTasks] = useState({});
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [stageFilter, setStageFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('all');
  
  // Comments
  const [selectedTask, setSelectedTask] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  
  const token = localStorage.getItem('session_token');
  
  // Theme classes
  const bgCard = isDark ? 'bg-[#18181b]' : 'bg-white';
  const bgSecondary = isDark ? 'bg-[#27272a]' : 'bg-gray-100';
  const bgTertiary = isDark ? 'bg-[#0c0a09]' : 'bg-gray-50';
  const borderColor = isDark ? 'border-[#3f3f46]' : 'border-gray-200';
  const textPrimary = isDark ? 'text-[#fafafa]' : 'text-gray-900';
  const textSecondary = isDark ? 'text-[#a1a1aa]' : 'text-gray-600';
  
  // Check if user can approve
  const canApprove = user?.role === 'super_admin' || 
                     user?.role === 'admin' || 
                     user?.role === 'project_manager' ||
                     user?.designation?.toLowerCase()?.includes('operation');

  // Load project details
  const loadProject = useCallback(async () => {
    if (!projectId) return;
    try {
      const res = await axios.get(`${API}/api/website-projects/projects/${projectId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProject(res.data);
      setPages(res.data.tasks || []);
    } catch (error) {
      console.error('Error loading project:', error);
      toast.error('Failed to load project');
    } finally {
      setLoading(false);
    }
  }, [projectId, token]);

  // Load team members
  const loadTeamMembers = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/website-projects/team-members`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTeamMembers(res.data || []);
    } catch (error) {
      console.error('Error loading team members:', error);
    }
  }, [token]);

  // Load stage tasks
  const loadStageTasks = useCallback(async () => {
    if (!projectId) return;
    try {
      const res = await axios.get(`${API}/api/website-projects/projects/${projectId}/stage-tasks`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStageTasks(res.data || {});
    } catch (error) {
      setStageTasks({});
    }
  }, [projectId, token]);

  // Load task comments
  const loadComments = useCallback(async (taskId) => {
    try {
      const res = await axios.get(`${API}/api/website-projects/tasks/${taskId}/comments`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setComments(res.data || []);
    } catch (error) {
      setComments([]);
    }
  }, [token]);

  useEffect(() => {
    loadProject();
    loadTeamMembers();
    loadStageTasks();
  }, [loadProject, loadTeamMembers, loadStageTasks]);

  // Convert pages to tasks
  const handleConvertToTasks = async () => {
    try {
      const res = await axios.post(
        `${API}/api/website-projects/projects/${projectId}/convert-pages-to-tasks`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`Created ${res.data.tasks_created} tasks!`);
      loadStageTasks();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to convert pages to tasks');
    }
  };

  // Update page assignment
  const handleUpdatePage = async (pageId, field, value) => {
    try {
      await axios.put(
        `${API}/api/website-projects/pages/${pageId}`,
        { [field]: value },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      loadProject();
    } catch (error) {
      toast.error('Failed to update');
    }
  };

  // Submit task for approval
  const handleSubmitForApproval = async (taskId, stage) => {
    try {
      await axios.put(
        `${API}/api/website-projects/stage-tasks/${taskId}/submit`,
        { stage },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Submitted for approval');
      loadStageTasks();
    } catch (error) {
      toast.error('Failed to submit');
    }
  };

  // Approve task
  const handleApproveTask = async (taskId, stage) => {
    try {
      await axios.put(
        `${API}/api/website-projects/stage-tasks/${taskId}/approve`,
        { stage },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Task approved! Moving to next stage.');
      loadStageTasks();
      loadProject();
    } catch (error) {
      toast.error('Failed to approve');
    }
  };

  // Request corrections
  const handleRequestCorrections = async (taskId, stage, remarks) => {
    try {
      await axios.put(
        `${API}/api/website-projects/stage-tasks/${taskId}/corrections`,
        { stage, remarks },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Corrections requested');
      loadStageTasks();
    } catch (error) {
      toast.error('Failed to request corrections');
    }
  };

  // Add comment
  const handleAddComment = async () => {
    if (!newComment.trim() || !selectedTask) return;
    try {
      await axios.post(
        `${API}/api/website-projects/tasks/${selectedTask.task_id}/comments`,
        { content: newComment, type: 'comment' },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setNewComment('');
      loadComments(selectedTask.task_id);
    } catch (error) {
      toast.error('Failed to add comment');
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className={`flex items-center justify-center h-full ${textPrimary}`}>Loading...</div>
      </Layout>
    );
  }

  if (!project) {
    return (
      <Layout>
        <div className={`flex flex-col items-center justify-center h-full ${textPrimary}`}>
          <p className="text-lg mb-4">Project not found</p>
          <Button onClick={() => navigate('/dl-operations')}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to DL Operations
          </Button>
        </div>
      </Layout>
    );
  }

  // Calculate stage progress
  const getStageProgress = (stageId) => {
    const tasks = stageTasks[stageId] || [];
    const completed = tasks.filter(t => t.status === 'approved' || t.status === 'completed').length;
    return { completed, total: pages.length };
  };

  return (
    <Layout>
      <div className={`flex flex-col h-full overflow-auto ${bgTertiary}`} data-testid="project-detail-page">
        {/* Top Header */}
        <div className={`px-6 py-4 border-b ${borderColor} ${bgCard}`}>
          {/* Row 1: Back + Project Name + Status + Edit */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => navigate('/dl-operations')}
                className={textSecondary}
              >
                <ArrowLeft className="h-4 w-4 mr-1" /> Back
              </Button>
              <h1 className={`text-2xl font-bold ${textPrimary}`}>{project.name}</h1>
              <Badge className={`px-3 py-1 text-sm ${
                project.status === 'active' ? 'bg-green-500 text-white' :
                project.status === 'completed' ? 'bg-blue-500 text-white' :
                'bg-gray-500 text-white'
              }`}>
                {project.status?.toUpperCase() || 'ACTIVE'}
              </Badge>
            </div>
            <Button variant="outline" size="sm" className="gap-2">
              <Edit2 className="h-4 w-4" /> Edit
            </Button>
          </div>
          
          {/* Row 2: Quick Links + Deadline + Progress */}
          <div className="flex items-center gap-4 flex-wrap">
            <Button variant="outline" size="sm" className={`gap-2 ${bgSecondary} border-none`}>
              <FileText className="h-4 w-4" /> Docs
            </Button>
            <Button variant="outline" size="sm" className={`gap-2 ${bgSecondary} border-none`}>
              <ExternalLink className="h-4 w-4" /> Drive
            </Button>
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${bgSecondary}`}>
              <Clock className={`h-4 w-4 ${project.deadline ? 'text-orange-400' : 'text-red-400'}`} />
              <span className={`text-sm ${project.deadline ? 'text-orange-400' : 'text-red-400'}`}>
                {project.deadline || 'No Deadline'}
              </span>
            </div>
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${bgSecondary}`}>
              <div className="w-20 h-2 bg-gray-600 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-[#6366f1] rounded-full" 
                  style={{ width: `${(project.overall_percent || 0)}%` }}
                />
              </div>
              <span className={`text-sm ${textPrimary}`}>{project.overall_percent || 0}/100</span>
            </div>
          </div>
        </div>

        {/* Collapsible Project Details */}
        <ProjectDetailsBar 
          project={project}
          pages={pages}
          stageTasks={stageTasks}
          isDark={isDark}
          bgCard={bgCard}
          bgSecondary={bgSecondary}
          borderColor={borderColor}
          textPrimary={textPrimary}
          textSecondary={textSecondary}
        />

        {/* Tabs - Only Pages, Tracker Board, Team (no Overview) */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <div className={`px-6 pt-4 ${bgCard} border-b ${borderColor}`}>
            <TabsList className={`${bgSecondary} p-1 rounded-lg`}>
              <TabsTrigger value="pages" className="gap-2">
                <Layers className="h-4 w-4" /> Pages
              </TabsTrigger>
              <TabsTrigger value="tracker" className="gap-2">
                <ClipboardCheck className="h-4 w-4" /> Tracker Board
              </TabsTrigger>
              <TabsTrigger value="team" className="gap-2">
                <Users className="h-4 w-4" /> Team
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Pages Tab */}
          <TabsContent value="pages" className="flex-1 overflow-auto p-6">
            <PagesTab
              pages={pages}
              teamMembers={teamMembers}
              onUpdatePage={handleUpdatePage}
              onConvertToTasks={handleConvertToTasks}
              isDark={isDark}
              bgCard={bgCard}
              bgSecondary={bgSecondary}
              borderColor={borderColor}
              textPrimary={textPrimary}
              textSecondary={textSecondary}
            />
          </TabsContent>

          {/* Tracker Board Tab */}
          <TabsContent value="tracker" className="flex-1 overflow-hidden p-6">
            <TrackerBoard
              stages={WORKFLOW_STAGES}
              stageTasks={stageTasks}
              pages={pages}
              teamMembers={teamMembers}
              stageFilter={stageFilter}
              setStageFilter={setStageFilter}
              dateFilter={dateFilter}
              setDateFilter={setDateFilter}
              assigneeFilter={assigneeFilter}
              setAssigneeFilter={setAssigneeFilter}
              canApprove={canApprove}
              onSubmit={handleSubmitForApproval}
              onApprove={handleApproveTask}
              onCorrections={handleRequestCorrections}
              onViewComments={(task) => {
                setSelectedTask(task);
                loadComments(task.task_id);
                setIsCommentsOpen(true);
              }}
              isDark={isDark}
              bgCard={bgCard}
              bgSecondary={bgSecondary}
              borderColor={borderColor}
              textPrimary={textPrimary}
              textSecondary={textSecondary}
            />
          </TabsContent>

          {/* Team Tab */}
          <TabsContent value="team" className="flex-1 overflow-auto p-6">
            <TeamTab
              project={project}
              teamMembers={teamMembers}
              isDark={isDark}
              bgCard={bgCard}
              bgSecondary={bgSecondary}
              borderColor={borderColor}
              textPrimary={textPrimary}
              textSecondary={textSecondary}
            />
          </TabsContent>
        </Tabs>

        {/* Comments Sidebar */}
        {isCommentsOpen && selectedTask && (
          <div className={`fixed right-0 top-0 h-full w-96 ${bgCard} border-l ${borderColor} flex flex-col z-50 shadow-xl`}>
            {/* Header */}
            <div className={`p-4 border-b ${borderColor} flex items-center justify-between`}>
              <div>
                <h3 className={`font-semibold ${textPrimary}`}>Comments</h3>
                <p className={`text-sm ${textSecondary}`}>{selectedTask.page_name}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setIsCommentsOpen(false)} className="h-8 w-8 p-0">
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            {/* Comments List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {comments.length === 0 ? (
                <div className={`text-center py-8 ${textSecondary}`}>
                  <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No comments yet</p>
                </div>
              ) : (
                comments.map((comment, idx) => (
                  <div key={idx} className={`p-3 rounded-lg ${bgSecondary}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-6 h-6 rounded-full bg-[#6366f1] flex items-center justify-center text-white text-xs">
                        {comment.author?.charAt(0) || 'U'}
                      </div>
                      <span className={`text-sm font-medium ${textPrimary}`}>{comment.author || 'Unknown'}</span>
                      <span className={`text-xs ${textSecondary} ml-auto`}>
                        {new Date(comment.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className={`text-sm ${textPrimary}`}>{comment.content}</p>
                    {comment.type === 'correction' && (
                      <Badge className="mt-2 bg-orange-500/20 text-orange-400 text-xs">Correction</Badge>
                    )}
                  </div>
                ))
              )}
            </div>
            
            {/* Add Comment */}
            <div className={`p-4 border-t ${borderColor}`}>
              <div className="flex gap-2">
                <Input
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Add a comment..."
                  className={`${bgSecondary} border-none`}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
                />
                <Button onClick={handleAddComment} className="bg-[#6366f1] hover:bg-[#4f46e5]">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

// ==================== PROJECT DETAILS BAR (Collapsible) ====================
function ProjectDetailsBar({ project, pages, stageTasks, isDark, bgCard, bgSecondary, borderColor, textPrimary, textSecondary }) {
  const [isExpanded, setIsExpanded] = useState(true);
  
  // Calculate stage progress
  const getStageProgress = (stageId) => {
    const tasks = stageTasks[stageId] || [];
    const completed = tasks.filter(t => t.status === 'approved' || t.status === 'completed').length;
    return { completed, total: pages.length };
  };
  
  const detailCards = [
    { icon: Globe, label: 'Domain', value: project?.domain_url ? 'Set' : 'Not set' },
    { icon: User, label: 'Developer', value: project?.developer || 'Not set' },
    { icon: Settings, label: 'Platform', value: project?.platform || 'Website' },
    { icon: Code, label: 'Type', value: project?.website_type || 'Business Website' },
    { icon: Users, label: 'Client', value: project?.client_name || 'Not set' },
    { icon: Globe, label: 'Location', value: project?.client_location || 'Not set' }
  ];
  
  const stageCards = [
    { id: 'wireframe', label: 'Wireframe', color: 'text-purple-400' },
    { id: 'ui', label: 'UI Design', color: 'text-blue-400' },
    { id: 'content', label: 'Content', color: 'text-orange-400' },
    { id: 'dev', label: 'Development', color: 'text-green-400' }
  ];

  return (
    <div className={`border-b ${borderColor}`}>
      {/* Toggle Button */}
      <button 
        onClick={() => setIsExpanded(!isExpanded)}
        className={`w-full px-6 py-3 flex items-center justify-between ${bgCard} hover:bg-opacity-80 transition-colors`}
      >
        <span className={`text-sm font-medium ${textPrimary}`}>
          {isExpanded ? 'Hide Project Details' : 'Show Project Details'}
        </span>
        {isExpanded ? (
          <ChevronDown className={`h-4 w-4 ${textSecondary}`} />
        ) : (
          <ChevronRight className={`h-4 w-4 ${textSecondary}`} />
        )}
      </button>
      
      {/* Expanded Content */}
      {isExpanded && (
        <div className={`px-6 pb-4 ${bgCard}`}>
          {/* Detail Cards Row */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
            {detailCards.map((card, idx) => {
              const Icon = card.icon;
              return (
                <div key={idx} className={`p-3 rounded-xl ${bgSecondary}`}>
                  <div className={`flex items-center gap-2 mb-1 ${textSecondary}`}>
                    <Icon className="h-4 w-4" />
                    <span className="text-xs">{card.label}</span>
                  </div>
                  <p className={`text-sm font-medium ${textPrimary}`}>{card.value}</p>
                </div>
              );
            })}
          </div>
          
          {/* Stage Progress Cards Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {stageCards.map(stage => {
              const progress = getStageProgress(stage.id);
              return (
                <div key={stage.id} className={`p-4 rounded-xl ${bgSecondary} text-center`}>
                  <p className={`text-sm ${textSecondary} mb-1`}>{stage.label}</p>
                  <p className={`text-xl font-bold ${stage.color}`}>
                    {progress.completed}/{progress.total}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== PAGES TAB ====================
function PagesTab({ pages, teamMembers, onUpdatePage, onConvertToTasks, isDark, bgCard, bgSecondary, borderColor, textPrimary, textSecondary }) {
  const stages = ['content', 'wireframe', 'ui', 'dev', 'test'];
  
  return (
    <div className="space-y-4">
      {/* Header with Convert Button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className={`text-lg font-semibold ${textPrimary}`}>Project Pages</h3>
          <p className={`text-sm ${textSecondary}`}>Assign team members and dates for each stage</p>
        </div>
        <Button onClick={onConvertToTasks} className="bg-[#6366f1] hover:bg-[#4f46e5] gap-2">
          <RefreshCw className="h-4 w-4" />
          Convert to Tasks
        </Button>
      </div>
      
      {/* Pages Table */}
      <div className={`rounded-xl border ${borderColor} ${bgCard} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className={bgSecondary}>
              <tr className={`text-xs ${textSecondary} uppercase`}>
                <th className="px-4 py-3 text-left font-semibold sticky left-0 z-10" style={{ backgroundColor: isDark ? '#27272a' : '#f3f4f6' }}>
                  Page Name
                </th>
                {stages.map(stage => (
                  <th key={stage} className="px-3 py-3 text-center font-semibold" colSpan={2}>
                    {stage.charAt(0).toUpperCase() + stage.slice(1)}
                  </th>
                ))}
                <th className="px-4 py-3 text-center font-semibold">Status</th>
              </tr>
              <tr className={`text-xs ${textSecondary}`}>
                <th className="sticky left-0 z-10" style={{ backgroundColor: isDark ? '#27272a' : '#f3f4f6' }}></th>
                {stages.map(stage => (
                  <React.Fragment key={`sub-${stage}`}>
                    <th className="px-2 py-2 text-center">Assignee</th>
                    <th className="px-2 py-2 text-center">Date</th>
                  </React.Fragment>
                ))}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {pages.map((page) => (
                <tr key={page.task_id} className={`border-t ${borderColor} hover:${bgSecondary}`}>
                  <td className={`px-4 py-3 sticky left-0 z-10 ${bgCard}`}>
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-[#6366f1]" />
                      <span className={`font-medium ${textPrimary}`}>{page.page_name}</span>
                    </div>
                  </td>
                  {stages.map(stage => (
                    <React.Fragment key={`${page.task_id}-${stage}`}>
                      <td className="px-2 py-2">
                        <Select
                          value={page[`${stage}_assignee`] || 'unassigned'}
                          onValueChange={(val) => onUpdatePage(page.task_id, `${stage}_assignee`, val === 'unassigned' ? '' : val)}
                        >
                          <SelectTrigger className={`h-8 text-xs ${bgSecondary} border-none w-28`}>
                            <SelectValue placeholder="Assign" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unassigned">Unassigned</SelectItem>
                            {teamMembers.map(m => (
                              <SelectItem key={m.user_id} value={m.name}>{m.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-2 py-2">
                        <Input
                          type="date"
                          value={page[`${stage}_due`] || ''}
                          onChange={(e) => onUpdatePage(page.task_id, `${stage}_due`, e.target.value)}
                          className={`h-8 text-xs ${bgSecondary} border-none w-32`}
                        />
                      </td>
                    </React.Fragment>
                  ))}
                  <td className="px-4 py-3 text-center">
                    <Badge className={`text-xs ${
                      page.overall_status === 'Completed' ? 'bg-green-500/20 text-green-400' :
                      page.overall_status === 'In Progress' ? 'bg-blue-500/20 text-blue-400' :
                      'bg-gray-500/20 text-gray-400'
                    }`}>
                      {page.overall_status || 'To-Do'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ==================== TRACKER BOARD ====================
function TrackerBoard({ 
  stages, stageTasks, pages, teamMembers, 
  stageFilter, setStageFilter, dateFilter, setDateFilter, assigneeFilter, setAssigneeFilter,
  canApprove, onSubmit, onApprove, onCorrections, onViewComments,
  isDark, bgCard, bgSecondary, borderColor, textPrimary, textSecondary 
}) {
  const [correctionsModal, setCorrectionsModal] = useState({ open: false, task: null, stage: null });
  const [remarks, setRemarks] = useState('');
  const [viewMode, setViewMode] = useState('kanban');
  const [activeStage, setActiveStage] = useState('all');
  const [runningTimers, setRunningTimers] = useState({});
  
  const getTasksForStage = (stageId) => {
    if (stageTasks[stageId]) return stageTasks[stageId];
    
    return pages.map(page => ({
      task_id: `${page.task_id}_${stageId}`,
      page_id: page.task_id,
      page_name: page.page_name,
      stage: stageId,
      assignee: page[`${stageId}_assignee`],
      due_date: page[`${stageId}_due`],
      status: page[`${stageId}_status`] || 'pending',
      url: page[`${stageId}_url`],
      time_spent: 0
    })).filter(t => {
      if (assigneeFilter !== 'all' && t.assignee !== assigneeFilter) return false;
      if (dateFilter && t.due_date !== dateFilter) return false;
      return true;
    });
  };
  
  const getAllTasks = () => {
    let allTasks = [];
    stages.forEach(stage => {
      const tasks = getTasksForStage(stage.id);
      tasks.forEach(t => allTasks.push({ ...t, stageInfo: stage }));
    });
    if (activeStage !== 'all') {
      allTasks = allTasks.filter(t => t.stage === activeStage);
    }
    return allTasks;
  };
  
  const formatDuration = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) return `${hrs}h ${mins}m`;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  };
  
  const handleCorrectionsSubmit = () => {
    if (remarks.trim() && correctionsModal.task) {
      onCorrections(correctionsModal.task.task_id, correctionsModal.stage, remarks);
      setCorrectionsModal({ open: false, task: null, stage: null });
      setRemarks('');
    }
  };

  const statusColors = {
    pending: 'bg-gray-500/20 text-gray-400',
    in_progress: 'bg-blue-500/20 text-blue-400',
    submitted: 'bg-purple-500/20 text-purple-400',
    approved: 'bg-green-500/20 text-green-400',
    corrections: 'bg-orange-500/20 text-orange-400',
    completed: 'bg-emerald-500/20 text-emerald-400'
  };

  return (
    <div className="flex flex-col h-full">
      {/* View Toggle & Filters */}
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className={`inline-flex rounded-lg p-1 ${bgSecondary}`}>
            <Button 
              size="sm" 
              variant={viewMode === 'kanban' ? 'default' : 'ghost'}
              onClick={() => setViewMode('kanban')}
              className={`h-8 ${viewMode === 'kanban' ? 'bg-[#6366f1]' : ''}`}
            >
              <Layers className="h-4 w-4 mr-1" /> Kanban
            </Button>
            <Button 
              size="sm" 
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              onClick={() => setViewMode('list')}
              className={`h-8 ${viewMode === 'list' ? 'bg-[#6366f1]' : ''}`}
            >
              <FileText className="h-4 w-4 mr-1" /> List
            </Button>
          </div>
          
          <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
            <SelectTrigger className={`w-40 h-8 ${bgSecondary} border-none`}>
              <User className="h-4 w-4 mr-2" />
              <SelectValue placeholder="All Assignees" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Assignees</SelectItem>
              {teamMembers.map(m => <SelectItem key={m.user_id} value={m.name}>{m.name}</SelectItem>)}
            </SelectContent>
          </Select>
          
          <Input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className={`w-40 h-8 ${bgSecondary} border-none`}
          />
          
          {(dateFilter || assigneeFilter !== 'all') && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => { setDateFilter(''); setAssigneeFilter('all'); }}
              className="text-red-400 h-8"
            >
              <X className="h-4 w-4 mr-1" /> Clear
            </Button>
          )}
        </div>
      </div>
      
      {/* List View - Stage Tabs */}
      {viewMode === 'list' && (
        <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-2">
          <Button
            size="sm"
            variant={activeStage === 'all' ? 'default' : 'outline'}
            onClick={() => setActiveStage('all')}
            className={`h-8 shrink-0 ${activeStage === 'all' ? 'bg-[#6366f1]' : ''}`}
          >
            All ({getAllTasks().length})
          </Button>
          {stages.map(stage => {
            const count = getTasksForStage(stage.id).length;
            return (
              <Button
                key={stage.id}
                size="sm"
                variant={activeStage === stage.id ? 'default' : 'outline'}
                onClick={() => setActiveStage(stage.id)}
                className={`h-8 gap-2 shrink-0 ${activeStage === stage.id ? 'bg-[#6366f1]' : ''}`}
              >
                <div className={`w-2 h-2 rounded-full ${stage.color}`} />
                {stage.label}
                <span className="text-xs opacity-70">({count})</span>
              </Button>
            );
          })}
        </div>
      )}
      
      {/* Kanban View */}
      {viewMode === 'kanban' && (
        <div className="flex-1 overflow-x-auto">
          <div className="flex gap-4 min-w-max pb-4">
            {stages.map(stage => {
              const tasks = getTasksForStage(stage.id);
              const Icon = stage.icon;
              
              return (
                <div key={stage.id} className={`w-72 flex-shrink-0 rounded-xl border ${borderColor} ${bgCard} flex flex-col`}>
                  <div className={`p-3 border-b ${borderColor} flex items-center gap-2`}>
                    <div className={`w-8 h-8 rounded-lg ${stage.color} flex items-center justify-center`}>
                      <Icon className="h-4 w-4 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className={`font-semibold ${textPrimary}`}>{stage.label}</p>
                      <p className={`text-xs ${textSecondary}`}>{tasks.length} tasks</p>
                    </div>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-2 space-y-2 max-h-[calc(100vh-350px)]">
                    {tasks.length === 0 ? (
                      <div className={`text-center py-8 ${textSecondary} text-sm`}>No tasks</div>
                    ) : (
                      tasks.map(task => (
                        <div 
                          key={task.task_id} 
                          className={`p-3 rounded-lg ${bgSecondary} border ${borderColor} hover:border-[#6366f1]/50 cursor-pointer`}
                          onClick={() => onViewComments(task)}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <p className={`font-medium ${textPrimary} truncate`}>{task.page_name}</p>
                            <Badge className={`text-xs ${statusColors[task.status] || statusColors.pending}`}>
                              {task.status?.replace('_', ' ') || 'Pending'}
                            </Badge>
                          </div>
                          {task.assignee && (
                            <div className="flex items-center gap-1 mb-2">
                              <User className="h-3 w-3 text-[#6366f1]" />
                              <span className={`text-xs ${textSecondary}`}>{task.assignee}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-1 pt-2 border-t border-dashed" style={{ borderColor: isDark ? '#3f3f46' : '#e5e7eb' }}>
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
                              <MessageSquare className="h-3 w-3 mr-1" /> Comments
                            </Button>
                            {(task.status === 'pending' || task.status === 'in_progress') && (
                              <Button 
                                size="sm" 
                                className="h-7 px-2 text-xs bg-purple-500 hover:bg-purple-600 ml-auto"
                                onClick={(e) => { e.stopPropagation(); onSubmit(task.task_id, stage.id); }}
                              >
                                <Send className="h-3 w-3 mr-1" /> Submit
                              </Button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      
      {/* List View - Task Table */}
      {viewMode === 'list' && (
        <div className={`flex-1 rounded-xl border ${borderColor} ${bgCard} overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className={bgSecondary}>
                <tr>
                  <th className={`px-4 py-3 text-left text-xs font-medium ${textSecondary} uppercase`}>Task / Page</th>
                  <th className={`px-4 py-3 text-left text-xs font-medium ${textSecondary} uppercase`}>Stage</th>
                  <th className={`px-4 py-3 text-left text-xs font-medium ${textSecondary} uppercase`}>Status</th>
                  <th className={`px-4 py-3 text-left text-xs font-medium ${textSecondary} uppercase`}>Assigned To</th>
                  <th className={`px-4 py-3 text-left text-xs font-medium ${textSecondary} uppercase`}>Due Date</th>
                  <th className={`px-4 py-3 text-left text-xs font-medium ${textSecondary} uppercase`}>Time</th>
                  <th className={`px-4 py-3 text-left text-xs font-medium ${textSecondary} uppercase`}>Timer</th>
                  <th className={`px-4 py-3 text-left text-xs font-medium ${textSecondary} uppercase`}>Actions</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDark ? 'divide-[#27272a]' : 'divide-gray-200'}`}>
                {getAllTasks().length === 0 ? (
                  <tr>
                    <td colSpan={8} className={`px-4 py-8 text-center ${textSecondary}`}>
                      <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
                      <p>No tasks found</p>
                    </td>
                  </tr>
                ) : (
                  getAllTasks().map(task => {
                    const isRunning = runningTimers[task.task_id];
                    return (
                      <tr key={task.task_id} className={`${bgCard} hover:${bgSecondary} cursor-pointer`} onClick={() => onViewComments(task)}>
                        <td className="px-4 py-3">
                          <div className={`font-medium ${textPrimary}`}>{task.page_name}</div>
                          <div className={`text-xs ${textSecondary}`}>Page Task</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${task.stageInfo?.color}`} />
                            <span className={`text-sm ${textPrimary}`}>{task.stageInfo?.label}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge className={statusColors[task.status] || statusColors.pending}>
                            {task.status?.replace('_', ' ') || 'Pending'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-[#6366f1]" />
                            <span className={`text-sm ${textPrimary}`}>{task.assignee || 'Unassigned'}</span>
                          </div>
                        </td>
                        <td className={`px-4 py-3 text-sm ${task.due_date && new Date(task.due_date) < new Date() ? 'text-red-400' : textPrimary}`}>
                          {task.due_date || '-'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Timer className={`h-4 w-4 ${isRunning ? 'text-[#10b981] animate-pulse' : textSecondary}`} />
                            <span className={`text-sm font-medium ${textPrimary}`}>{formatDuration(task.time_spent || 0)}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <Button
                            size="sm"
                            variant={isRunning ? 'destructive' : 'outline'}
                            className={`h-8 ${isRunning ? 'bg-red-500' : 'border-[#6366f1] text-[#6366f1]'}`}
                            onClick={() => setRunningTimers(prev => ({ ...prev, [task.task_id]: !prev[task.task_id] }))}
                          >
                            {isRunning ? <><Pause className="h-3 w-3 mr-1" /> Stop</> : <><Play className="h-3 w-3 mr-1" /> Start</>}
                          </Button>
                        </td>
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <div className="flex gap-1">
                            {(task.status === 'pending' || task.status === 'in_progress') && (
                              <Button size="sm" className="h-8 bg-purple-500 hover:bg-purple-600" onClick={() => onSubmit(task.task_id, task.stage)}>
                                <Send className="h-3 w-3 mr-1" /> Submit
                              </Button>
                            )}
                            {task.status === 'submitted' && canApprove && (
                              <>
                                <Button size="sm" className="h-8 bg-green-500 hover:bg-green-600" onClick={() => onApprove(task.task_id, task.stage)}>
                                  <Check className="h-3 w-3" />
                                </Button>
                                <Button size="sm" className="h-8 bg-orange-500 hover:bg-orange-600" onClick={() => setCorrectionsModal({ open: true, task, stage: task.stage })}>
                                  <AlertCircle className="h-3 w-3" />
                                </Button>
                              </>
                            )}
                            {task.status === 'approved' && (
                              <Badge className="bg-green-500/20 text-green-400"><CheckCircle2 className="h-3 w-3 mr-1" /> Approved</Badge>
                            )}
                            <Button variant="ghost" size="sm" className="h-8" onClick={() => onViewComments(task)}>
                              <MessageSquare className="h-4 w-4" />
                            </Button>
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
      )}
      
      {/* Corrections Modal */}
      {correctionsModal.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className={`${bgCard} rounded-xl p-6 w-full max-w-md border ${borderColor}`}>
            <h3 className={`text-lg font-semibold ${textPrimary} mb-4`}>Request Corrections</h3>
            <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Enter correction remarks..." className={`${bgSecondary} border-none mb-4`} rows={4} />
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setCorrectionsModal({ open: false, task: null, stage: null })}>Cancel</Button>
              <Button className="flex-1 bg-orange-500 hover:bg-orange-600" onClick={handleCorrectionsSubmit}>Send Corrections</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== TEAM TAB ====================
function TeamTab({ project, teamMembers, isDark, bgCard, bgSecondary, borderColor, textPrimary, textSecondary }) {
  const roles = [
    { key: 'project_manager', label: 'Project Manager', icon: Users },
    { key: 'developer', label: 'Developer', icon: Code },
    { key: 'designer', label: 'Designer', icon: Palette },
    { key: 'content_writer', label: 'Content Writer', icon: FileText }
  ];
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {roles.map(role => {
        const assignedName = project?.[role.key];
        const member = teamMembers.find(m => m.name === assignedName);
        const Icon = role.icon;
        
        return (
          <div key={role.key} className={`rounded-xl border ${borderColor} ${bgCard} p-4`}>
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-10 h-10 rounded-lg ${bgSecondary} flex items-center justify-center`}>
                <Icon className="h-5 w-5 text-[#6366f1]" />
              </div>
              <div>
                <p className={`text-sm ${textSecondary}`}>{role.label}</p>
                <p className={`font-semibold ${textPrimary}`}>{assignedName || 'Not assigned'}</p>
              </div>
            </div>
            {member && (
              <div className={`text-xs ${textSecondary} space-y-1`}>
                {member.email && <p>{member.email}</p>}
                {member.department && <p>Dept: {member.department}</p>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
