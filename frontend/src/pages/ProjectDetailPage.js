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
  ArrowLeft, ArrowRight, Globe, Calendar, User, Users, FileText, Settings, Palette, 
  ChevronDown, ChevronRight, Check, Clock, Play, Pause, Send, Lock, Search,
  MessageSquare, CheckCircle, CheckCircle2, AlertCircle, RefreshCw, X,
  Eye, Edit2, Trash2, Plus, Link2, ExternalLink, Timer, Layers,
  Code, PenTool, TestTube, Truck, ClipboardCheck, UserPlus
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import AssignmentPopup from '../components/website/AssignmentPopup';

const API = process.env.REACT_APP_BACKEND_URL;

// Stage definitions with colors - Sequential workflow
const WORKFLOW_STAGES = [
  { id: 'content', label: 'Content', icon: FileText, color: 'bg-blue-500', textColor: 'text-blue-400', order: 1 },
  { id: 'wireframe', label: 'Wireframe', icon: PenTool, color: 'bg-purple-500', textColor: 'text-purple-400', order: 2 },
  { id: 'ui', label: 'UI Design', icon: Palette, color: 'bg-pink-500', textColor: 'text-pink-400', order: 3 },
  { id: 'dev', label: 'Development', icon: Code, color: 'bg-green-500', textColor: 'text-green-400', order: 4 },
  { id: 'responsive', label: 'Responsive', icon: Layers, color: 'bg-indigo-500', textColor: 'text-indigo-400', order: 5 },
  { id: 'test', label: 'Testing', icon: TestTube, color: 'bg-cyan-500', textColor: 'text-cyan-400', order: 6 },
  { id: 'delivery', label: 'Delivery', icon: Truck, color: 'bg-emerald-500', textColor: 'text-emerald-400', order: 7 }
];

// Task status types
const TASK_STATUS = {
  locked: { label: 'Locked', color: 'bg-gray-600/50 text-gray-500', icon: '🔒' },
  pending: { label: 'Not Started', color: 'bg-gray-500/20 text-gray-400', icon: '⏳' },
  in_progress: { label: 'In Progress', color: 'bg-blue-500/20 text-blue-400', icon: '🔄' },
  paused: { label: 'Paused', color: 'bg-yellow-500/20 text-yellow-400', icon: '⏸️' },
  finished: { label: 'Finished', color: 'bg-purple-500/20 text-purple-400', icon: '✓' },
  waiting_pm: { label: 'Waiting PM', color: 'bg-orange-500/20 text-orange-400', icon: '👤' },
  waiting_ops: { label: 'Waiting Ops', color: 'bg-amber-500/20 text-amber-400', icon: '⚙️' },
  waiting_approval: { label: 'Waiting Approval', color: 'bg-orange-500/20 text-orange-400', icon: '⏰' },
  approved: { label: 'Approved', color: 'bg-green-500/20 text-green-400', icon: '✅' },
  corrections: { label: 'Corrections', color: 'bg-red-500/20 text-red-400', icon: '❌' }
};

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
  
  // Role-based access
  const [userAccess, setUserAccess] = useState({
    is_master: false,
    allowed_stages: [],
    can_view_all: false,
    can_act_on_all: false
  });
  
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
  
  // Helper: Check if user can act on a specific stage
  const canActOnStage = (stageId) => {
    if (userAccess.is_master || userAccess.can_act_on_all) return true;
    return userAccess.allowed_stages.includes(stageId);
  };

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

  // Load user's project access (role-based stages)
  const loadUserAccess = useCallback(async () => {
    if (!projectId) return;
    try {
      const res = await axios.get(`${API}/api/website-projects/projects/${projectId}/my-access`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUserAccess(res.data || { is_master: false, allowed_stages: [], can_view_all: false, can_act_on_all: false });
    } catch (error) {
      // Default to master user view if API fails (backward compatibility)
      setUserAccess({ is_master: true, allowed_stages: [], can_view_all: true, can_act_on_all: true });
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
    loadUserAccess();
  }, [loadProject, loadTeamMembers, loadStageTasks, loadUserAccess]);

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

  // Add new page
  const handleAddPage = async (pageName, assignees = {}, dueDate = null) => {
    try {
      await axios.post(
        `${API}/api/website-projects/projects/${projectId}/pages`,
        { 
          page_name: pageName,
          due_date: dueDate || null,
          content_assignee: assignees.content || null,
          wireframe_assignee: assignees.wireframe || null,
          ui_assignee: assignees.ui || null,
          responsive_assignee: assignees.responsive || null,
          dev_assignee: assignees.dev || null,
          test_assignee: assignees.test || null,
          delivery_assignee: assignees.delivery || null
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Page added successfully');
      loadProject();
      loadStageTasks();
    } catch (error) {
      toast.error('Failed to add page');
    }
  };

  // Delete page
  const handleDeletePage = async (taskId) => {
    if (!window.confirm('Are you sure you want to delete this page?')) return;
    try {
      await axios.delete(
        `${API}/api/website-projects/pages/${taskId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Page deleted');
      loadProject();
      loadStageTasks();
    } catch (error) {
      toast.error('Failed to delete page');
    }
  };

  // Submit task for approval
  // Submit task for approval with link and approver assignment
  const handleSubmitForApproval = async (taskId, stage, link = '', assignee_type = 'operations') => {
    try {
      await axios.put(
        `${API}/api/website-projects/stage-tasks/${taskId}/submit`,
        { stage, link, assignee_type },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Submitted for approval');
      loadStageTasks();
      loadProject();
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

  // Timer action handler (Start/Pause/Finish)
  const handleTimerAction = async (taskId, action) => {
    try {
      await axios.post(
        `${API}/api/website-projects/stage-tasks/${taskId}/timer`,
        { action },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`Task ${action}ed`);
      loadStageTasks();
      loadProject();
    } catch (error) {
      toast.error(`Failed to ${action} task`);
    }
  };

  // Move task to next stage (after full approval)
  const handleMoveToNextStage = async (taskId, currentStage) => {
    try {
      await axios.post(
        `${API}/api/website-projects/stage-tasks/${taskId}/move-next`,
        { current_stage: currentStage },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Moved to next stage!');
      loadStageTasks();
      loadProject();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to move task');
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

        {/* Tabs - Pages, Tracker Board, Team, Ad.Tasks, Meeting */}
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
              <TabsTrigger value="adtasks" className="gap-2">
                <CheckCircle2 className="h-4 w-4" /> Ad.Tasks
              </TabsTrigger>
              <TabsTrigger value="meetings" className="gap-2">
                <Calendar className="h-4 w-4" /> Meeting
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Pages Tab */}
          <TabsContent value="pages" className="flex-1 overflow-auto p-6">
            <PagesTab
              pages={pages}
              stageTasks={stageTasks}
              teamMembers={teamMembers}
              onUpdatePage={handleUpdatePage}
              onConvertToTasks={handleConvertToTasks}
              onAddPage={handleAddPage}
              onDeletePage={handleDeletePage}
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
              userAccess={userAccess}
              canActOnStage={canActOnStage}
              onSubmit={handleSubmitForApproval}
              onApprove={handleApproveTask}
              onCorrections={handleRequestCorrections}
              onTimerAction={handleTimerAction}
              onMoveNext={handleMoveToNextStage}
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
          
          {/* Ad.Tasks Tab */}
          <TabsContent value="adtasks" className="flex-1 overflow-auto p-6">
            <AdTasksTab
              projectId={project?.project_id}
              teamMembers={teamMembers}
              isDark={isDark}
              bgCard={bgCard}
              bgSecondary={bgSecondary}
              borderColor={borderColor}
              textPrimary={textPrimary}
              textSecondary={textSecondary}
            />
          </TabsContent>
          
          {/* Meeting Tab */}
          <TabsContent value="meetings" className="flex-1 overflow-auto p-6">
            <MeetingsTab
              projectId={project?.project_id}
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

// ==================== PAGES TAB - Multi-Stage Horizontal Layout ====================
function PagesTab({ 
  pages, stageTasks, teamMembers, onUpdatePage, onConvertToTasks, onAddPage, onDeletePage,
  isDark, bgCard, bgSecondary, borderColor, textPrimary, textSecondary 
}) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPage, setEditingPage] = useState(null);
  const [newPageName, setNewPageName] = useState('');
  const [dueDate, setDueDate] = useState('');
  // Assignment popup state
  const [assignmentPopup, setAssignmentPopup] = useState({
    isOpen: false,
    taskId: null,
    taskName: '',
    stage: '',
    currentAssignee: '',
    currentDueDate: ''
  });
  // Stage assignee states
  const [stageAssignees, setStageAssignees] = useState({
    content: '', wireframe: '', ui: '', responsive: '', dev: '', test: '', delivery: ''
  });
  
  // Stage definitions for horizontal columns
  const stageColumns = [
    { id: 'content', label: 'Content', color: 'bg-blue-500', textColor: 'text-blue-400' },
    { id: 'wireframe', label: 'Wireframe', color: 'bg-purple-500', textColor: 'text-purple-400' },
    { id: 'ui', label: 'UI Design', color: 'bg-pink-500', textColor: 'text-pink-400' },
    { id: 'dev', label: 'Development', color: 'bg-green-500', textColor: 'text-green-400' },
    { id: 'responsive', label: 'Responsive', color: 'bg-indigo-500', textColor: 'text-indigo-400' },
    { id: 'test', label: 'Testing', color: 'bg-cyan-500', textColor: 'text-cyan-400' },
    { id: 'delivery', label: 'Delivery', color: 'bg-emerald-500', textColor: 'text-emerald-400' }
  ];
  
  // Get status for a specific page at a specific stage
  const getPageStageStatus = (pageId, stageId) => {
    const tasks = stageTasks[stageId] || [];
    const task = tasks.find(t => t.page_id === pageId || t.task_id?.includes(pageId));
    if (!task) return { status: 'pending', pm: false, ops: false, assignee: null, time_spent: 0 };
    return {
      status: task.status || 'pending',
      pm: task.pm_approved || false,
      ops: task.ops_approved || false,
      link: task.link,
      assignee: task.assignee,
      time_spent: task.time_spent || 0
    };
  };
  
  // Get status badge styling
  const getStatusBadge = (statusInfo) => {
    const { status, pm, ops } = statusInfo;
    
    if (status === 'approved' && ops) {
      return { bg: 'bg-green-500', text: 'text-white', label: '✓', title: 'Approved' };
    }
    if (pm && !ops) {
      return { bg: 'bg-amber-500/20', text: 'text-amber-400', label: 'PM✓', title: 'Waiting Ops' };
    }
    if (status === 'waiting_pm' || status === 'waiting_approval') {
      return { bg: 'bg-orange-500/20', text: 'text-orange-400', label: '⏳', title: 'Waiting PM' };
    }
    if (status === 'in_progress') {
      return { bg: 'bg-blue-500/20', text: 'text-blue-400', label: '▶', title: 'In Progress' };
    }
    if (status === 'paused') {
      return { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: '⏸', title: 'Paused' };
    }
    if (status === 'corrections') {
      return { bg: 'bg-red-500/20', text: 'text-red-400', label: '↻', title: 'Corrections' };
    }
    // pending / not started
    return { bg: 'bg-gray-500/20', text: 'text-gray-400', label: '○', title: 'Not Started' };
  };
  
  // Calculate overall progress for a page
  const getOverallProgress = (pageId) => {
    let approved = 0;
    stageColumns.forEach(stage => {
      const statusInfo = getPageStageStatus(pageId, stage.id);
      if (statusInfo.status === 'approved' && statusInfo.ops) approved++;
    });
    return { approved, total: stageColumns.length };
  };
  
  // Calculate total time spent across all stages
  const getTotalTimeSpent = (pageId) => {
    let total = 0;
    stageColumns.forEach(stage => {
      const statusInfo = getPageStageStatus(pageId, stage.id);
      total += statusInfo.time_spent || 0;
    });
    return total;
  };
  
  // Format time spent in hours/minutes
  const formatTimeSpent = (minutes) => {
    if (!minutes || minutes === 0) return '-';
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return `${hours}h ${mins > 0 ? mins + 'm' : ''}`;
    }
    return `${minutes}m`;
  };
  
  // Calculate time left until due date
  const getTimeLeft = (dueDateStr) => {
    if (!dueDateStr) return { text: '-', isOverdue: false, color: 'text-gray-400' };
    
    try {
      const dueDateTime = new Date(dueDateStr);
      const now = new Date();
      const diffMs = dueDateTime - now;
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      
      if (diffMs < 0) {
        // Overdue
        const overdueDays = Math.abs(diffDays);
        const overdueHours = Math.abs(diffHours);
        if (overdueDays > 0) {
          return { text: `${overdueDays}d overdue`, isOverdue: true, color: 'text-red-400' };
        }
        return { text: `${overdueHours}h overdue`, isOverdue: true, color: 'text-red-400' };
      } else if (diffDays === 0) {
        // Due today
        if (diffHours <= 2) {
          return { text: `${diffHours}h left`, isOverdue: false, color: 'text-orange-400' };
        }
        return { text: `${diffHours}h left`, isOverdue: false, color: 'text-yellow-400' };
      } else if (diffDays <= 2) {
        // Due soon
        return { text: `${diffDays}d ${diffHours}h`, isOverdue: false, color: 'text-yellow-400' };
      } else {
        // Plenty of time
        return { text: `${diffDays}d left`, isOverdue: false, color: 'text-green-400' };
      }
    } catch {
      return { text: '-', isOverdue: false, color: 'text-gray-400' };
    }
  };
  
  // Format due date for display
  const formatDueDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
    } catch {
      return '-';
    }
  };
  
  // Get assignee name for a stage (from page data)
  const getStageAssignee = (page, stageId) => {
    return page[`${stageId}_assignee`] || null;
  };
  
  const handleAddPage = () => {
    if (newPageName.trim()) {
      onAddPage(newPageName.trim(), stageAssignees, dueDate);
      setNewPageName('');
      setDueDate('');
      setStageAssignees({ content: '', wireframe: '', ui: '', responsive: '', dev: '', test: '', delivery: '' });
      setShowAddModal(false);
    }
  };
  
  const handleEditPage = () => {
    if (editingPage && newPageName.trim()) {
      // Update page name
      onUpdatePage(editingPage.task_id, 'page_name', newPageName.trim());
      // Update due date
      if (dueDate !== (editingPage.due_date || '')) {
        onUpdatePage(editingPage.task_id, 'due_date', dueDate);
      }
      // Update stage assignees
      Object.entries(stageAssignees).forEach(([stage, assignee]) => {
        if (assignee !== (editingPage[`${stage}_assignee`] || '')) {
          onUpdatePage(editingPage.task_id, `${stage}_assignee`, assignee);
        }
      });
      setEditingPage(null);
      setNewPageName('');
      setDueDate('');
      setStageAssignees({ content: '', wireframe: '', ui: '', responsive: '', dev: '', test: '', delivery: '' });
    }
  };
  
  const openEditModal = (page) => {
    setEditingPage(page);
    setNewPageName(page.page_name);
    setDueDate(page.due_date || '');
    setStageAssignees({
      content: page.content_assignee || '',
      wireframe: page.wireframe_assignee || '',
      ui: page.ui_assignee || '',
      responsive: page.responsive_assignee || '',
      dev: page.dev_assignee || '',
      test: page.test_assignee || '',
      delivery: page.delivery_assignee || ''
    });
  };
  
  const closeModal = () => {
    setShowAddModal(false);
    setEditingPage(null);
    setNewPageName('');
    setDueDate('');
    setStageAssignees({ content: '', wireframe: '', ui: '', responsive: '', dev: '', test: '', delivery: '' });
  };
  
  // Assignee dropdown component for reuse
  const AssigneeSelect = ({ stage, label, color }) => (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${color}`}></div>
        <span className={`text-sm ${textPrimary}`}>{label}</span>
      </div>
      <Select 
        value={stageAssignees[stage] || 'unassigned'} 
        onValueChange={(val) => setStageAssignees(prev => ({...prev, [stage]: val === 'unassigned' ? '' : val}))}
      >
        <SelectTrigger className={`w-40 h-8 text-xs ${bgSecondary} border-none`}>
          <SelectValue placeholder="Select Assignee" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="unassigned">Unassigned</SelectItem>
          {teamMembers.map(m => (
            <SelectItem key={m.user_id || m.name} value={m.name}>{m.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
  
  return (
    <div className="space-y-4">
      {/* Header with Add Page and Convert Buttons */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className={`text-lg font-semibold ${textPrimary}`}>Project Pages</h3>
          <p className={`text-sm ${textSecondary}`}>Track stage progress for each page across the workflow</p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            onClick={() => setShowAddModal(true)} 
            className="bg-[#6366f1] hover:bg-[#4f46e5] gap-2"
            data-testid="add-page-btn"
          >
            <Plus className="h-4 w-4" /> Add Page
          </Button>
          <Button 
            onClick={onConvertToTasks} 
            variant="outline"
            className={`gap-2 ${bgSecondary} border-none`}
          >
            <RefreshCw className="h-4 w-4" /> Convert to Tasks
          </Button>
        </div>
      </div>
      
      {/* Multi-Stage Horizontal Table */}
      <div className={`rounded-xl border ${borderColor} ${bgCard} overflow-hidden overflow-x-auto`}>
        <table className="w-full min-w-[1200px]">
          <thead className={bgSecondary}>
            <tr className={`text-xs ${textSecondary} uppercase`}>
              <th className="w-10 px-2 py-3 text-center font-semibold">#</th>
              <th className="w-32 px-2 py-3 text-left font-semibold">Page Name</th>
              {stageColumns.map(stage => (
                <th key={stage.id} className="w-24 px-1 py-3 text-center font-semibold">
                  <div className="flex flex-col items-center gap-1">
                    <div className={`w-2 h-2 rounded-full ${stage.color}`}></div>
                    <span className="text-[10px] leading-tight">{stage.label}</span>
                  </div>
                </th>
              ))}
              <th className="w-20 px-2 py-3 text-center font-semibold">Due Date</th>
              <th className="w-20 px-2 py-3 text-center font-semibold">Time Left</th>
              <th className="w-20 px-2 py-3 text-center font-semibold">Time Spent</th>
              <th className="w-16 px-2 py-3 text-center font-semibold">Progress</th>
              <th className="w-16 px-2 py-3 text-center font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pages.length === 0 ? (
              <tr>
                <td colSpan={stageColumns.length + 7} className="px-6 py-12 text-center">
                  <div className={`${textSecondary}`}>
                    <Layers className="h-10 w-10 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">No pages added yet</p>
                    <p className="text-xs mt-1">Click "Add Page" to create your first page</p>
                  </div>
                </td>
              </tr>
            ) : (
              pages.map((page, idx) => {
                const progress = getOverallProgress(page.task_id);
                const timeSpent = getTotalTimeSpent(page.task_id);
                const timeLeft = getTimeLeft(page.due_date);
                return (
                  <tr key={page.task_id} className={`border-t ${borderColor} hover:${bgSecondary} transition-colors`}>
                    {/* S.No */}
                    <td className={`px-2 py-2 text-center ${textSecondary} text-sm`}>
                      {idx + 1}
                    </td>
                    
                    {/* Page Name */}
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-[#6366f1] flex-shrink-0" />
                        <span className={`font-medium ${textPrimary} text-sm truncate`} title={page.page_name}>
                          {page.page_name}
                        </span>
                      </div>
                    </td>
                    
                    {/* Stage Cells - Show Assignee + Status - Clickable for Assignment */}
                    {stageColumns.map(stage => {
                      const statusInfo = getPageStageStatus(page.task_id, stage.id);
                      const badge = getStatusBadge(statusInfo);
                      const assignee = getStageAssignee(page, stage.id);
                      const initials = assignee ? assignee.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : null;
                      
                      return (
                        <td key={`${page.task_id}-${stage.id}`} className="px-1 py-2 text-center">
                          <div className="flex flex-col items-center gap-1">
                            {/* Assignee Avatar - Clickable to open Assignment Popup */}
                            <button
                              onClick={() => setAssignmentPopup({
                                isOpen: true,
                                taskId: page.task_id,
                                taskName: page.page_name,
                                stage: stage.id,
                                currentAssignee: assignee || '',
                                currentDueDate: page.due_date || ''
                              })}
                              className="group relative"
                              title={assignee ? `${assignee} - Click to reassign` : 'Click to assign'}
                            >
                              {assignee ? (
                                <div 
                                  className={`w-6 h-6 rounded-full ${stage.color} flex items-center justify-center 
                                    ring-2 ring-transparent group-hover:ring-white/50 transition-all cursor-pointer`}
                                >
                                  <span className="text-[9px] font-bold text-white">{initials}</span>
                                </div>
                              ) : (
                                <div className="w-6 h-6 rounded-full bg-gray-500/30 flex items-center justify-center 
                                  group-hover:bg-[#6366f1]/30 group-hover:ring-2 group-hover:ring-[#6366f1]/50 transition-all cursor-pointer">
                                  <UserPlus className="h-3 w-3 text-gray-400 group-hover:text-[#6366f1]" />
                                </div>
                              )}
                            </button>
                            {/* Status Badge */}
                            <div 
                              className={`inline-flex items-center justify-center w-6 h-5 rounded ${badge.bg} cursor-default`}
                              title={badge.title}
                            >
                              <span className={`text-[10px] font-bold ${badge.text}`}>{badge.label}</span>
                            </div>
                          </div>
                        </td>
                      );
                    })}
                    
                    {/* Due Date */}
                    <td className={`px-2 py-2 text-center text-xs ${textPrimary}`}>
                      {formatDueDate(page.due_date)}
                    </td>
                    
                    {/* Time Left */}
                    <td className={`px-2 py-2 text-center text-xs font-medium ${timeLeft.color}`}>
                      {timeLeft.isOverdue && <AlertCircle className="h-3 w-3 inline mr-1" />}
                      {timeLeft.text}
                    </td>
                    
                    {/* Time Spent */}
                    <td className={`px-2 py-2 text-center text-xs ${textSecondary}`}>
                      <div className="flex items-center justify-center gap-1">
                        <Timer className="h-3 w-3" />
                        {formatTimeSpent(timeSpent)}
                      </div>
                    </td>
                    
                    {/* Progress */}
                    <td className="px-2 py-2 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <div className="w-full max-w-[40px] h-1.5 bg-gray-600/30 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-green-500 rounded-full transition-all"
                            style={{ width: `${(progress.approved / progress.total) * 100}%` }}
                          />
                        </div>
                        <span className={`text-[10px] ${textSecondary}`}>
                          {progress.approved}/{progress.total}
                        </span>
                      </div>
                    </td>
                    
                    {/* Actions */}
                    <td className="px-2 py-2">
                      <div className="flex items-center justify-center gap-1">
                        <Button 
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 hover:bg-blue-500/20"
                          onClick={() => openEditModal(page)}
                          title="Edit"
                          data-testid={`edit-page-${page.task_id}`}
                        >
                          <Edit2 className="h-3 w-3 text-blue-400" />
                        </Button>
                        <Button 
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 hover:bg-red-500/20"
                          onClick={() => onDeletePage(page.task_id)}
                          title="Delete"
                          data-testid={`delete-page-${page.task_id}`}
                        >
                          <Trash2 className="h-3 w-3 text-red-400" />
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
      
      {/* Legend */}
      <div className={`flex flex-wrap items-center gap-4 text-xs ${textSecondary} px-2`}>
        <span className="font-medium">Legend:</span>
        <div className="flex items-center gap-1.5"><span className="w-5 h-5 rounded bg-gray-500/20 flex items-center justify-center text-gray-400">○</span> Not Started</div>
        <div className="flex items-center gap-1.5"><span className="w-5 h-5 rounded bg-blue-500/20 flex items-center justify-center text-blue-400">▶</span> In Progress</div>
        <div className="flex items-center gap-1.5"><span className="w-5 h-5 rounded bg-orange-500/20 flex items-center justify-center text-orange-400">⏳</span> Waiting PM</div>
        <div className="flex items-center gap-1.5"><span className="w-5 h-5 rounded bg-amber-500/20 flex items-center justify-center text-amber-400">PM✓</span> Waiting Ops</div>
        <div className="flex items-center gap-1.5"><span className="w-5 h-5 rounded bg-green-500 flex items-center justify-center text-white">✓</span> Approved</div>
        <div className="flex items-center gap-1.5"><span className="w-5 h-5 rounded bg-red-500/20 flex items-center justify-center text-red-400">↻</span> Corrections</div>
      </div>
      
      {/* Add Page Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" data-testid="add-page-modal">
          <div className={`${bgCard} rounded-xl p-6 w-full max-w-lg border ${borderColor} max-h-[90vh] overflow-y-auto`}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-[#6366f1] flex items-center justify-center">
                <Plus className="h-5 w-5 text-white" />
              </div>
              <h3 className={`text-lg font-semibold ${textPrimary}`}>Add New Page</h3>
            </div>
            
            {/* Page Name */}
            <div className="mb-4">
              <label className={`block text-sm font-medium ${textPrimary} mb-2`}>Page Name</label>
              <Input
                value={newPageName}
                onChange={(e) => setNewPageName(e.target.value)}
                placeholder="Enter page name (e.g., Home, About Us, Contact)"
                className={`${bgSecondary} border-none`}
                autoFocus
                data-testid="new-page-name-input"
              />
            </div>
            
            {/* Due Date */}
            <div className="mb-4">
              <label className={`block text-sm font-medium ${textPrimary} mb-2`}>Due Date</label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className={`${bgSecondary} border-none`}
                data-testid="new-page-due-date"
              />
            </div>
            
            {/* Stage Assignees */}
            <div className="mb-4">
              <label className={`block text-sm font-medium ${textPrimary} mb-3`}>Stage Assignees</label>
              <div className={`space-y-3 p-4 rounded-lg ${bgSecondary}`}>
                <AssigneeSelect stage="content" label="Content" color="bg-blue-500" />
                <AssigneeSelect stage="wireframe" label="Wireframe" color="bg-purple-500" />
                <AssigneeSelect stage="ui" label="UI Design" color="bg-pink-500" />
                <AssigneeSelect stage="dev" label="Development" color="bg-green-500" />
                <AssigneeSelect stage="responsive" label="Responsive" color="bg-indigo-500" />
                <AssigneeSelect stage="test" label="Testing" color="bg-cyan-500" />
                <AssigneeSelect stage="delivery" label="Delivery" color="bg-emerald-500" />
              </div>
            </div>
            
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={closeModal}>
                Cancel
              </Button>
              <Button 
                className="flex-1 bg-[#6366f1] hover:bg-[#4f46e5]" 
                onClick={handleAddPage}
                disabled={!newPageName.trim()}
                data-testid="confirm-add-page-btn"
              >
                Add Page
              </Button>
            </div>
          </div>
        </div>
      )}
      
      {/* Edit Page Modal */}
      {editingPage && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" data-testid="edit-page-modal">
          <div className={`${bgCard} rounded-xl p-6 w-full max-w-lg border ${borderColor} max-h-[90vh] overflow-y-auto`}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center">
                <Edit2 className="h-5 w-5 text-white" />
              </div>
              <h3 className={`text-lg font-semibold ${textPrimary}`}>Edit Page</h3>
            </div>
            
            {/* Page Name */}
            <div className="mb-4">
              <label className={`block text-sm font-medium ${textPrimary} mb-2`}>Page Name</label>
              <Input
                value={newPageName}
                onChange={(e) => setNewPageName(e.target.value)}
                placeholder="Enter page name"
                className={`${bgSecondary} border-none`}
                autoFocus
                data-testid="edit-page-name-input"
              />
            </div>
            
            {/* Due Date */}
            <div className="mb-4">
              <label className={`block text-sm font-medium ${textPrimary} mb-2`}>Due Date</label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className={`${bgSecondary} border-none`}
                data-testid="edit-page-due-date"
              />
            </div>
            
            {/* Stage Assignees */}
            <div className="mb-4">
              <label className={`block text-sm font-medium ${textPrimary} mb-3`}>Stage Assignees</label>
              <div className={`space-y-3 p-4 rounded-lg ${bgSecondary}`}>
                <AssigneeSelect stage="content" label="Content" color="bg-blue-500" />
                <AssigneeSelect stage="wireframe" label="Wireframe" color="bg-purple-500" />
                <AssigneeSelect stage="ui" label="UI Design" color="bg-pink-500" />
                <AssigneeSelect stage="dev" label="Development" color="bg-green-500" />
                <AssigneeSelect stage="responsive" label="Responsive" color="bg-indigo-500" />
                <AssigneeSelect stage="test" label="Testing" color="bg-cyan-500" />
                <AssigneeSelect stage="delivery" label="Delivery" color="bg-emerald-500" />
              </div>
            </div>
            
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={closeModal}>
                Cancel
              </Button>
              <Button 
                className="flex-1 bg-[#6366f1] hover:bg-[#4f46e5]" 
                onClick={handleEditPage}
                disabled={!newPageName.trim()}
                data-testid="confirm-edit-page-btn"
              >
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      )}
      
      {/* Assignment Popup */}
      <AssignmentPopup
        isOpen={assignmentPopup.isOpen}
        onClose={() => setAssignmentPopup({ ...assignmentPopup, isOpen: false })}
        taskId={assignmentPopup.taskId}
        taskName={assignmentPopup.taskName}
        stage={assignmentPopup.stage}
        currentAssignee={assignmentPopup.currentAssignee}
        currentDueDate={assignmentPopup.currentDueDate}
        teamMembers={teamMembers}
        onAssign={(assignee, dueDate) => {
          // Refresh the page data after assignment
          onUpdatePage(assignmentPopup.taskId, `${assignmentPopup.stage}_assignee`, assignee);
          if (dueDate) {
            onUpdatePage(assignmentPopup.taskId, 'due_date', dueDate);
          }
        }}
        isDark={isDark}
        bgCard={bgCard}
        bgSecondary={bgSecondary}
        borderColor={borderColor}
        textPrimary={textPrimary}
        textSecondary={textSecondary}
      />
    </div>
  );
}

// ==================== TRACKER BOARD ====================
function TrackerBoard({ 
  stages, stageTasks, pages, teamMembers, 
  stageFilter, setStageFilter, dateFilter, setDateFilter, assigneeFilter, setAssigneeFilter,
  canApprove, userAccess, canActOnStage, onSubmit, onApprove, onCorrections, onTimerAction, onMoveNext, onViewComments,
  isDark, bgCard, bgSecondary, borderColor, textPrimary, textSecondary 
}) {
  const [correctionsModal, setCorrectionsModal] = useState({ open: false, task: null, stage: null });
  const [remarks, setRemarks] = useState('');
  const [finishModal, setFinishModal] = useState({ open: false, task: null, stage: null });
  const [linkUrl, setLinkUrl] = useState('');
  const [selectedStage, setSelectedStage] = useState(null);
  const [selectedApprover, setSelectedApprover] = useState('project_manager');
  const [summaryModal, setSummaryModal] = useState({ open: false, task: null });
  const [summaryTab, setSummaryTab] = useState('timeline');
  
  // Get stage order
  const getStageOrder = (stageId) => {
    const stage = stages.find(s => s.id === stageId);
    return stage?.order || 0;
  };
  
  // Check if previous stage is fully approved (both PM and Ops)
  const isPreviousStageFullyApproved = (pageId, currentStageId) => {
    const currentOrder = getStageOrder(currentStageId);
    if (currentOrder <= 1) return true; // Content is first stage, always unlocked
    
    const prevStage = stages.find(s => s.order === currentOrder - 1);
    if (!prevStage) return true;
    
    const prevTasks = stageTasks[prevStage.id] || [];
    const prevTask = prevTasks.find(t => t.page_id === pageId);
    
    // For backwards compatibility: if task is approved but doesn't have ops_approved flag,
    // treat it as fully approved (legacy data)
    if (prevTask?.status === 'approved') {
      // New workflow: requires both PM and Ops approval
      if (prevTask?.pm_approved !== undefined || prevTask?.ops_approved !== undefined) {
        return prevTask?.pm_approved === true && prevTask?.ops_approved === true;
      }
      // Legacy workflow: just status=approved is sufficient
      return true;
    }
    return false;
  };
  
  // Get task status with lock check
  const getTaskStatus = (task, stageId) => {
    const isLocked = !isPreviousStageFullyApproved(task.page_id || task.task_id, stageId);
    if (isLocked) return 'locked';
    return task.status || 'pending';
  };
  
  // Get tasks for stage with status
  const getTasksForStage = (stageId) => {
    if (stageTasks[stageId]) {
      return stageTasks[stageId].map(t => ({
        ...t,
        displayStatus: getTaskStatus(t, stageId)
      }));
    }
    
    return pages.map(page => {
      const task = {
        task_id: `${page.task_id}_${stageId}`,
        page_id: page.task_id,
        page_name: page.page_name,
        stage: stageId,
        assignee: page[`${stageId}_assignee`],
        due_date: page[`${stageId}_due`],
        status: page[`${stageId}_status`] || 'pending',
        url: page[`${stageId}_url`],
        link: page[`${stageId}_link`]
      };
      task.displayStatus = getTaskStatus(task, stageId);
      return task;
    }).filter(t => {
      if (assigneeFilter !== 'all' && t.assignee !== assigneeFilter) return false;
      if (dateFilter && t.due_date !== dateFilter) return false;
      return true;
    });
  };
  
  // Count tasks by status
  const getStageStats = (stageId) => {
    const tasks = getTasksForStage(stageId);
    return {
      total: tasks.length,
      approved: tasks.filter(t => t.displayStatus === 'approved' && t.ops_approved).length,
      waiting_pm: tasks.filter(t => t.displayStatus === 'waiting_pm' || (t.displayStatus === 'waiting_approval' && !t.pm_approved)).length,
      waiting_ops: tasks.filter(t => t.displayStatus === 'waiting_ops' || (t.pm_approved && !t.ops_approved)).length,
      in_progress: tasks.filter(t => t.displayStatus === 'in_progress').length,
      corrections: tasks.filter(t => t.displayStatus === 'corrections').length,
      locked: tasks.filter(t => t.displayStatus === 'locked').length
    };
  };
  
  const handleFinishAndSubmit = async () => {
    if (!linkUrl.trim() || !finishModal.task) return;
    try {
      // First set status to finished, then submit for PM approval
      await onSubmit(finishModal.task.task_id, finishModal.stage, linkUrl, 'project_manager');
      setFinishModal({ open: false, task: null, stage: null });
      setLinkUrl('');
    } catch (error) {
      console.error('Failed to submit:', error);
    }
  };
  
  const handleCorrectionsSubmit = () => {
    if (remarks.trim() && correctionsModal.task) {
      onCorrections(correctionsModal.task.task_id, correctionsModal.stage, remarks);
      setCorrectionsModal({ open: false, task: null, stage: null });
      setRemarks('');
    }
  };

  const getStatusStyle = (status) => {
    return TASK_STATUS[status] || TASK_STATUS.pending;
  };
  
  // Get icon based on timer status
  const getTimerIcon = (status) => {
    switch(status) {
      case 'pending': return <Play className="h-3 w-3" />;
      case 'in_progress': return <Pause className="h-3 w-3" />;
      case 'paused': return <Play className="h-3 w-3" />;
      default: return <Play className="h-3 w-3" />;
    }
  };
  
  // Get timer button action
  const getTimerAction = (status) => {
    switch(status) {
      case 'pending': return 'start';
      case 'in_progress': return 'pause';
      case 'paused': return 'start';
      default: return 'start';
    }
  };
  
  // Check if can finish (must be in_progress or paused)
  const canFinish = (status) => {
    return status === 'in_progress' || status === 'paused';
  };
  
  // Initialize selected stage
  const currentStage = selectedStage || stages[0]?.id;
  const currentStageTasks = getTasksForStage(currentStage);
  const currentStageInfo = stages.find(s => s.id === currentStage);
  const CurrentStageIcon = currentStageInfo?.icon || FileText;
  
  // Check if user can act on the current stage
  const canActOnCurrentStage = canActOnStage ? canActOnStage(currentStage) : true;

  return (
    <div className="flex flex-col h-full">
      {/* Clickable Stage Tabs - Role-Based Access */}
      <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-2">
        {stages.map((stage, idx) => {
          const stats = getStageStats(stage.id);
          const Icon = stage.icon;
          const isComplete = stats.approved === stats.total && stats.total > 0;
          const isSelected = currentStage === stage.id;
          const canAct = canActOnStage ? canActOnStage(stage.id) : true;
          
          return (
            <div key={stage.id} className="flex items-center">
              <button
                onClick={() => setSelectedStage(stage.id)}
                disabled={!canAct && !userAccess?.is_master}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all relative ${
                  !canAct && !userAccess?.is_master
                    ? 'opacity-50 cursor-not-allowed'
                    : ''
                } ${
                  isSelected 
                    ? 'bg-[#6366f1] text-white shadow-lg scale-105' 
                    : isComplete 
                      ? 'bg-green-500/20 hover:bg-green-500/30' 
                      : `${bgSecondary} hover:bg-[#6366f1]/20`
                }`}
                data-testid={`stage-btn-${stage.id}`}
              >
                {/* Lock icon for inaccessible stages */}
                {!canAct && !userAccess?.is_master && (
                  <Lock className="h-3 w-3 absolute top-1 right-1 text-gray-400" />
                )}
                <div className={`w-7 h-7 rounded-lg ${
                  isSelected ? 'bg-white/20' : isComplete ? 'bg-green-500' : stage.color
                } flex items-center justify-center`}>
                  {isComplete && !isSelected ? (
                    <Check className="h-4 w-4 text-white" />
                  ) : (
                    <Icon className={`h-4 w-4 text-white`} />
                  )}
                </div>
                <div className="text-left">
                  <span className={`text-sm font-semibold ${isSelected ? 'text-white' : isComplete ? 'text-green-400' : textPrimary}`}>
                    {stage.label}
                  </span>
                  <span className={`text-xs ml-2 ${isSelected ? 'text-white/70' : textSecondary}`}>
                    ({stats.approved}/{stats.total})
                  </span>
                </div>
              </button>
              {idx < stages.length - 1 && (
                <ArrowRight className={`h-4 w-4 mx-1 ${isComplete ? 'text-green-400' : textSecondary}`} />
              )}
            </div>
          );
        })}
      </div>
      
      {/* Role-based access notice */}
      {!canActOnCurrentStage && !userAccess?.is_master && (
        <div className={`flex items-center gap-2 mb-4 px-4 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/30`}>
          <Eye className="h-4 w-4 text-yellow-500" />
          <span className="text-sm text-yellow-500">View Only - You can see this stage but cannot make changes</span>
        </div>
      )}
      
      {/* Filters Row */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
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
      
      {/* Selected Stage Header */}
      <div className={`p-4 rounded-xl mb-4 ${currentStageInfo?.color || 'bg-[#6366f1]'} flex items-center gap-4`}>
        <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
          <CurrentStageIcon className="h-6 w-6 text-white" />
        </div>
        <div className="flex-1">
          <h3 className="text-xl font-bold text-white">{currentStageInfo?.label || 'Stage'}</h3>
          <p className="text-sm text-white/70">
            {getStageStats(currentStage).approved} of {getStageStats(currentStage).total} approved
            {getStageStats(currentStage).waiting_pm > 0 && (
              <span className="ml-2">• {getStageStats(currentStage).waiting_pm} waiting PM</span>
            )}
            {getStageStats(currentStage).waiting_ops > 0 && (
              <span className="ml-2">• {getStageStats(currentStage).waiting_ops} waiting Ops</span>
            )}
          </p>
        </div>
      </div>
      
      {/* Task Table View - Like Our Tasks */}
      <div className={`flex-1 overflow-auto rounded-xl border ${borderColor} ${bgCard}`}>
        {currentStageTasks.length === 0 ? (
          <div className={`text-center py-16 ${textSecondary}`}>
            <FileText className="h-16 w-16 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium">No tasks in this stage</p>
            <p className="text-sm">Tasks will appear here once pages are converted</p>
          </div>
        ) : (
          <table className="w-full">
            {/* Table Header */}
            <thead className={`${bgSecondary} sticky top-0`}>
              <tr className={`text-left text-xs font-semibold uppercase tracking-wider ${textSecondary}`}>
                <th className="px-4 py-3">Task</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Assigned</th>
                <th className="px-4 py-3">Due Date</th>
                <th className="px-4 py-3">Link</th>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Timer</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            
            {/* Table Body */}
            <tbody className="divide-y" style={{ borderColor: isDark ? '#27272a' : '#e5e7eb' }}>
              {currentStageTasks.map(task => {
                const statusInfo = getStatusStyle(task.displayStatus);
                const isLocked = task.displayStatus === 'locked';
                const hasNewWorkflowFlags = task.pm_approved !== undefined || task.ops_approved !== undefined;
                const isFullyApproved = task.displayStatus === 'approved' && 
                  (hasNewWorkflowFlags ? (task.pm_approved && task.ops_approved) : true);
                const isPendingPM = task.displayStatus === 'waiting_pm' || 
                  (task.displayStatus === 'waiting_approval' && hasNewWorkflowFlags && !task.pm_approved);
                const isPendingOps = hasNewWorkflowFlags && task.pm_approved && !task.ops_approved;
                const canShowStart = (task.displayStatus === 'pending' || task.displayStatus === 'corrections') && !isLocked;
                const canShowPause = task.displayStatus === 'in_progress' && !isLocked;
                const canShowFinish = (task.displayStatus === 'in_progress' || task.displayStatus === 'paused') && !isLocked;
                const timeSpent = task.time_spent || 0;
                const timeDisplay = timeSpent >= 60 
                  ? `${Math.floor(timeSpent / 60)}h ${timeSpent % 60}m`
                  : `${timeSpent}m`;
                
                return (
                  <tr 
                    key={task.task_id}
                    className={`${isLocked ? 'opacity-50' : ''} ${isFullyApproved ? 'bg-green-500/5' : ''} hover:${bgSecondary} transition-colors`}
                    data-testid={`task-row-${task.task_id}`}
                  >
                    {/* Task Name + Category */}
                    <td className="px-4 py-4">
                      <div>
                        <p className={`font-semibold ${textPrimary}`}>{task.page_name}</p>
                        <Badge className={`mt-1 text-xs ${currentStageInfo?.color || 'bg-[#6366f1]'} text-white`}>
                          {currentStageInfo?.label || 'stage'}
                        </Badge>
                      </div>
                    </td>
                    
                    {/* Status */}
                    <td className="px-4 py-4">
                      <Badge className={`${statusInfo.color} text-xs`}>
                        {task.pm_approved && !task.ops_approved ? 'PM ✓' : statusInfo.label}
                      </Badge>
                      {isPendingOps && (
                        <Badge className="ml-1 bg-amber-500/20 text-amber-400 text-xs">Ops ⏳</Badge>
                      )}
                    </td>
                    
                    {/* Assigned */}
                    <td className="px-4 py-4">
                      <div>
                        {task.assignee ? (
                          <>
                            <Badge className="bg-purple-500/20 text-purple-400 text-xs">{task.assignee}</Badge>
                            <p className={`text-xs ${textSecondary} mt-1`}>
                              {task.created_at ? new Date(task.created_at).toLocaleDateString() : '-'}
                            </p>
                          </>
                        ) : (
                          <span className={`text-xs ${textSecondary}`}>Unassigned</span>
                        )}
                      </div>
                    </td>
                    
                    {/* Due Date */}
                    <td className="px-4 py-4">
                      <span className={`text-sm ${textPrimary}`}>
                        {task.due_date || '-'}
                      </span>
                    </td>
                    
                    {/* Link */}
                    <td className="px-4 py-4">
                      {task.link ? (
                        <a 
                          href={task.link} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-[#6366f1] hover:underline text-sm flex items-center gap-1"
                        >
                          <ExternalLink className="h-3 w-3" /> View
                        </a>
                      ) : (
                        <span className={textSecondary}>-</span>
                      )}
                    </td>
                    
                    {/* Time */}
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-purple-400" />
                        <span className={`text-sm ${textPrimary}`}>{timeDisplay}</span>
                      </div>
                    </td>
                    
                    {/* Timer Button */}
                    <td className="px-4 py-4">
                      {isLocked ? (
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <Lock className="h-3 w-3" /> Locked
                        </div>
                      ) : isFullyApproved ? (
                        <Badge className="bg-green-500/20 text-green-400">Done</Badge>
                      ) : canShowStart ? (
                        <Button 
                          size="sm"
                          className="h-8 bg-green-500 hover:bg-green-600 gap-1"
                          onClick={() => onTimerAction(task.task_id, 'start')}
                        >
                          <Play className="h-3 w-3" /> Start
                        </Button>
                      ) : canShowPause ? (
                        <div className="flex gap-1">
                          <Button 
                            size="sm"
                            className="h-8 bg-yellow-500 hover:bg-yellow-600 gap-1"
                            onClick={() => onTimerAction(task.task_id, 'pause')}
                          >
                            <Pause className="h-3 w-3" /> Pause
                          </Button>
                        </div>
                      ) : task.displayStatus === 'paused' ? (
                        <Button 
                          size="sm"
                          className="h-8 bg-blue-500 hover:bg-blue-600 gap-1"
                          onClick={() => onTimerAction(task.task_id, 'start')}
                        >
                          <Play className="h-3 w-3" /> Resume
                        </Button>
                      ) : isPendingPM || isPendingOps ? (
                        <Badge className="bg-orange-500/20 text-orange-400">Pending</Badge>
                      ) : (
                        <span className={textSecondary}>-</span>
                      )}
                    </td>
                    
                    {/* Actions */}
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        {/* Finish Button */}
                        {canShowFinish && (
                          <Button 
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 hover:bg-green-500/20"
                            onClick={() => setFinishModal({ open: true, task, stage: currentStage })}
                            title="Finish & Submit"
                          >
                            <CheckCircle className="h-4 w-4 text-green-400" />
                          </Button>
                        )}
                        
                        {/* Move to Next Stage */}
                        {isFullyApproved && canApprove && (
                          <Button 
                            size="sm"
                            className="h-8 bg-[#6366f1] hover:bg-[#5558e3] gap-1"
                            onClick={() => onMoveNext(task.task_id, currentStage)}
                          >
                            <ArrowRight className="h-3 w-3" /> Move
                          </Button>
                        )}
                        
                        {/* View Link Icon */}
                        {task.link && (
                          <a 
                            href={task.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`h-8 w-8 rounded-md flex items-center justify-center hover:bg-[#6366f1]/20`}
                            title="View Work"
                          >
                            <Eye className="h-4 w-4 text-[#6366f1]" />
                          </a>
                        )}
                        
                        {/* Edit - Opens Summary Modal */}
                        <Button 
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 hover:bg-blue-500/20"
                          title="View Summary"
                          onClick={() => setSummaryModal({ open: true, task })}
                          data-testid={`summary-btn-${task.task_id}`}
                        >
                          <Edit2 className="h-4 w-4 text-blue-400" />
                        </Button>
                        
                        {/* Delete */}
                        <Button 
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 hover:bg-red-500/20"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4 text-red-400" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      
      {/* Task Summary Modal */}
      {summaryModal.open && summaryModal.task && (
        <TaskSummaryModal
          task={summaryModal.task}
          stage={currentStage}
          stages={stages}
          stageTasks={stageTasks}
          onClose={() => setSummaryModal({ open: false, task: null })}
          isDark={isDark}
          bgCard={bgCard}
          bgSecondary={bgSecondary}
          borderColor={borderColor}
          textPrimary={textPrimary}
          textSecondary={textSecondary}
        />
      )}
      
      {/* Finish Modal with Link Input */}
      {finishModal.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" data-testid="finish-modal">
          <div className={`${bgCard} rounded-xl p-6 w-full max-w-lg border ${borderColor}`}>
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-green-500 flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className={`text-lg font-semibold ${textPrimary}`}>Finish & Submit</h3>
                <p className={`text-sm ${textSecondary}`}>{finishModal.task?.page_name}</p>
              </div>
            </div>
            
            {/* Link Input */}
            <div className="mb-6">
              <label className={`block text-sm font-medium ${textPrimary} mb-2`}>
                Work Link <span className="text-red-400">*</span>
              </label>
              <Input
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="Paste your work link (Figma, Google Docs, etc.)"
                className={`${bgSecondary} border-none`}
                data-testid="finish-link-input"
              />
              <p className={`text-xs ${textSecondary} mt-1`}>
                This will be submitted for Project Manager approval
              </p>
            </div>
            
            {/* Approval Flow Info */}
            <div className={`mb-6 p-3 rounded-lg ${bgSecondary}`}>
              <p className={`text-xs ${textSecondary} mb-2`}>Approval Flow:</p>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 px-2 py-1 bg-purple-500/20 text-purple-400 rounded text-xs">
                  <User className="h-3 w-3" /> PM Approval
                </div>
                <ArrowRight className={`h-3 w-3 ${textSecondary}`} />
                <div className="flex items-center gap-1 px-2 py-1 bg-amber-500/20 text-amber-400 rounded text-xs">
                  <Settings className="h-3 w-3" /> Ops Approval
                </div>
              </div>
            </div>
            
            {/* Actions */}
            <div className="flex gap-3">
              <Button 
                variant="outline" 
                className="flex-1" 
                onClick={() => { setFinishModal({ open: false, task: null, stage: null }); setLinkUrl(''); }}
                data-testid="cancel-finish-btn"
              >
                Cancel
              </Button>
              <Button 
                className="flex-1 bg-green-500 hover:bg-green-600 gap-2"
                onClick={handleFinishAndSubmit}
                disabled={!linkUrl.trim()}
                data-testid="submit-finish-btn"
              >
                <Send className="h-4 w-4" /> Submit for Approval
              </Button>
            </div>
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

// ==================== LINK APPROVAL MODAL ====================
function LinkApprovalModal({ 
  isOpen, task, stage, stages, linkUrl, setLinkUrl, onClose, onSubmit,
  isDark, bgCard, bgSecondary, borderColor, textPrimary, textSecondary 
}) {
  const [selectedApprover, setSelectedApprover] = useState('operations');
  
  const approverOptions = [
    { value: 'operations', label: 'Operations Team', description: 'For routine task approvals' },
    { value: 'project_manager', label: 'Project Manager', description: 'For project-specific decisions' },
    { value: 'ceo', label: 'CEO', description: 'For critical business decisions' }
  ];
  
  const stageInfo = stages?.find(s => s.id === stage);
  const StageIcon = stageInfo?.icon || FileText;
  
  const handleSubmit = () => {
    if (!linkUrl.trim()) {
      return;
    }
    onSubmit(selectedApprover);
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" data-testid="link-approval-modal">
      <div className={`${bgCard} rounded-xl p-6 w-full max-w-lg border ${borderColor}`}>
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className={`w-12 h-12 rounded-xl ${stageInfo?.color || 'bg-[#6366f1]'} flex items-center justify-center`}>
            <StageIcon className="h-6 w-6 text-white" />
          </div>
          <div>
            <h3 className={`text-lg font-semibold ${textPrimary}`}>Submit {stageInfo?.label || 'Task'}</h3>
            <p className={`text-sm ${textSecondary}`}>{task?.page_name}</p>
          </div>
        </div>
        
        {/* Link Input */}
        <div className="mb-6">
          <label className={`block text-sm font-medium ${textPrimary} mb-2`}>
            {stageInfo?.label || 'Task'} Link
          </label>
          <Input
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder={`Enter ${stageInfo?.label || 'work'} link (e.g., Figma, Google Docs, etc.)`}
            className={`${bgSecondary} border-none`}
            data-testid="link-input"
          />
          <p className={`text-xs ${textSecondary} mt-1`}>
            Paste the link to your completed work for this stage
          </p>
        </div>
        
        {/* Approver Selection */}
        <div className="mb-6">
          <label className={`block text-sm font-medium ${textPrimary} mb-2`}>
            Assign Approver
          </label>
          <div className="space-y-2">
            {approverOptions.map(option => (
              <label 
                key={option.value}
                className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                  selectedApprover === option.value 
                    ? 'bg-[#6366f1]/20 border-2 border-[#6366f1]' 
                    : `${bgSecondary} border-2 border-transparent hover:border-[#6366f1]/30`
                }`}
                data-testid={`approver-option-${option.value}`}
              >
                <input
                  type="radio"
                  name="approver"
                  value={option.value}
                  checked={selectedApprover === option.value}
                  onChange={(e) => setSelectedApprover(e.target.value)}
                  className="sr-only"
                />
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                  selectedApprover === option.value ? 'border-[#6366f1] bg-[#6366f1]' : 'border-gray-500'
                }`}>
                  {selectedApprover === option.value && (
                    <Check className="h-3 w-3 text-white" />
                  )}
                </div>
                <div className="flex-1">
                  <p className={`font-medium ${textPrimary}`}>{option.label}</p>
                  <p className={`text-xs ${textSecondary}`}>{option.description}</p>
                </div>
              </label>
            ))}
          </div>
        </div>
        
        {/* Actions */}
        <div className="flex gap-3">
          <Button 
            variant="outline" 
            className="flex-1" 
            onClick={onClose}
            data-testid="cancel-link-btn"
          >
            Cancel
          </Button>
          <Button 
            className="flex-1 bg-[#6366f1] hover:bg-[#5558e3] gap-2"
            onClick={handleSubmit}
            disabled={!linkUrl.trim()}
            data-testid="submit-link-btn"
          >
            <Send className="h-4 w-4" /> Submit for Approval
          </Button>
        </div>
      </div>
    </div>
  );
}

// ==================== TASK SUMMARY MODAL ====================
function TaskSummaryModal({ 
  task, stage, stages, stageTasks, onClose,
  isDark, bgCard, bgSecondary, borderColor, textPrimary, textSecondary 
}) {
  const [activeTab, setActiveTab] = useState('timeline');
  
  // Format time duration
  const formatDuration = (minutes) => {
    if (!minutes || minutes === 0) return '-';
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return `${hours}h ${mins}m`;
    }
    return `${minutes}m`;
  };
  
  // Format date/time
  const formatDateTime = (isoString) => {
    if (!isoString) return '-';
    try {
      const date = new Date(isoString);
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return '-';
    }
  };
  
  // Calculate duration between two dates in minutes
  const calculateDuration = (startTime, endTime) => {
    if (!startTime || !endTime) return null;
    try {
      const start = new Date(startTime);
      const end = new Date(endTime);
      return Math.round((end - start) / (1000 * 60));
    } catch {
      return null;
    }
  };
  
  // Get task data from all stages for this page
  const getTaskHistory = () => {
    const history = [];
    stages.forEach(stg => {
      const tasks = stageTasks[stg.id] || [];
      const stageTask = tasks.find(t => t.page_id === task.page_id || t.task_id === task.task_id);
      if (stageTask) {
        history.push({
          stage: stg,
          task: stageTask
        });
      }
    });
    return history;
  };
  
  const taskHistory = getTaskHistory();
  const currentStageInfo = stages.find(s => s.id === stage);
  const CurrentIcon = currentStageInfo?.icon || FileText;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" data-testid="summary-modal">
      <div className={`${bgCard} rounded-xl w-full max-w-2xl border ${borderColor} max-h-[90vh] overflow-hidden flex flex-col`}>
        {/* Header */}
        <div className={`p-6 border-b ${borderColor}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl ${currentStageInfo?.color || 'bg-[#6366f1]'} flex items-center justify-center`}>
                <CurrentIcon className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className={`text-xl font-bold ${textPrimary}`}>{task.page_name}</h3>
                <p className={`text-sm ${textSecondary}`}>
                  {currentStageInfo?.label || 'Task'} • {task.assignee || 'Unassigned'}
                </p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>
        
        {/* Tabs */}
        <div className={`px-6 pt-4 border-b ${borderColor}`}>
          <div className="flex gap-2">
            {[
              { id: 'timeline', label: 'Timeline' },
              { id: 'stages', label: 'All Stages' },
              { id: 'details', label: 'Details' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                  activeTab === tab.id
                    ? `bg-[#6366f1] text-white`
                    : `${textSecondary} hover:bg-[#6366f1]/20`
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Timeline Tab */}
          {activeTab === 'timeline' && (
            <div className="space-y-4">
              <h4 className={`text-sm font-semibold ${textPrimary} mb-4`}>Work Timeline</h4>
              
              <div className="relative pl-8 space-y-6">
                {/* Vertical line */}
                <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-gray-600/30" />
                
                {/* Work Started */}
                <div className="relative">
                  <div className={`absolute -left-5 w-4 h-4 rounded-full ${task.timer_started_at || task.started_at ? 'bg-green-500' : 'bg-gray-500/50'} flex items-center justify-center`}>
                    <Play className="h-2 w-2 text-white" />
                  </div>
                  <div className={`${bgSecondary} rounded-lg p-3`}>
                    <div className="flex items-center justify-between">
                      <span className={`font-medium ${textPrimary}`}>Work Started</span>
                      <span className={`text-sm ${task.timer_started_at || task.started_at ? 'text-green-400' : textSecondary}`}>
                        {formatDateTime(task.timer_started_at || task.started_at)}
                      </span>
                    </div>
                  </div>
                </div>
                
                {/* Paused (if applicable) */}
                {(task.paused_at || task.status === 'paused') && (
                  <div className="relative">
                    <div className="absolute -left-5 w-4 h-4 rounded-full bg-yellow-500 flex items-center justify-center">
                      <Pause className="h-2 w-2 text-white" />
                    </div>
                    <div className={`${bgSecondary} rounded-lg p-3`}>
                      <div className="flex items-center justify-between">
                        <span className={`font-medium ${textPrimary}`}>Paused</span>
                        <span className="text-sm text-yellow-400">
                          {formatDateTime(task.paused_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Time Spent */}
                <div className="relative">
                  <div className={`absolute -left-5 w-4 h-4 rounded-full bg-purple-500 flex items-center justify-center`}>
                    <Timer className="h-2 w-2 text-white" />
                  </div>
                  <div className={`${bgSecondary} rounded-lg p-3`}>
                    <div className="flex items-center justify-between">
                      <span className={`font-medium ${textPrimary}`}>Time Spent</span>
                      <span className="text-sm text-purple-400">
                        {formatDuration(task.time_spent)}
                      </span>
                    </div>
                  </div>
                </div>
                
                {/* Submitted for PM */}
                {(task.pm_submitted_at || task.status === 'waiting_pm' || task.pm_approved) && (
                  <div className="relative">
                    <div className={`absolute -left-5 w-4 h-4 rounded-full ${task.pm_approved ? 'bg-green-500' : 'bg-orange-500'} flex items-center justify-center`}>
                      <Send className="h-2 w-2 text-white" />
                    </div>
                    <div className={`${bgSecondary} rounded-lg p-3`}>
                      <div className="flex items-center justify-between">
                        <span className={`font-medium ${textPrimary}`}>Submitted to PM</span>
                        <span className={`text-sm ${task.pm_approved ? 'text-green-400' : 'text-orange-400'}`}>
                          {formatDateTime(task.pm_submitted_at || task.submitted_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* PM Approved */}
                {task.pm_approved && (
                  <div className="relative">
                    <div className="absolute -left-5 w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
                      <Check className="h-2 w-2 text-white" />
                    </div>
                    <div className={`${bgSecondary} rounded-lg p-3`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className={`font-medium ${textPrimary}`}>PM Approved</span>
                        <span className="text-sm text-green-400">
                          {formatDateTime(task.pm_approved_at)}
                        </span>
                      </div>
                      {task.pm_approved_at && task.pm_submitted_at && (
                        <p className={`text-xs ${textSecondary}`}>
                          Approval time: {formatDuration(calculateDuration(task.pm_submitted_at || task.submitted_at, task.pm_approved_at))}
                        </p>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Ops Approved */}
                {task.ops_approved && (
                  <div className="relative">
                    <div className="absolute -left-5 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center">
                      <CheckCircle2 className="h-2 w-2 text-white" />
                    </div>
                    <div className={`${bgSecondary} rounded-lg p-3`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className={`font-medium ${textPrimary}`}>Operations Approved</span>
                        <span className="text-sm text-emerald-400">
                          {formatDateTime(task.ops_approved_at)}
                        </span>
                      </div>
                      {task.ops_approved_at && task.pm_approved_at && (
                        <p className={`text-xs ${textSecondary}`}>
                          Approval time: {formatDuration(calculateDuration(task.pm_approved_at, task.ops_approved_at))}
                        </p>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Delivered */}
                {task.delivered_at && (
                  <div className="relative">
                    <div className="absolute -left-5 w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center">
                      <Truck className="h-2 w-2 text-white" />
                    </div>
                    <div className={`${bgSecondary} rounded-lg p-3`}>
                      <div className="flex items-center justify-between">
                        <span className={`font-medium ${textPrimary}`}>Delivered</span>
                        <span className="text-sm text-blue-400">
                          {formatDateTime(task.delivered_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* All Stages Tab */}
          {activeTab === 'stages' && (
            <div className="space-y-3">
              <h4 className={`text-sm font-semibold ${textPrimary} mb-4`}>Progress Across All Stages</h4>
              
              {stages.map(stg => {
                const stgTasks = stageTasks[stg.id] || [];
                const stgTask = stgTasks.find(t => t.page_id === task.page_id || t.task_id === task.task_id);
                const Icon = stg.icon;
                const isApproved = stgTask?.status === 'approved' && stgTask?.ops_approved;
                const isPending = stgTask?.status === 'waiting_pm' || stgTask?.status === 'waiting_ops';
                const isInProgress = stgTask?.status === 'in_progress';
                
                return (
                  <div key={stg.id} className={`${bgSecondary} rounded-lg p-4`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg ${stg.color} flex items-center justify-center`}>
                          <Icon className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <p className={`font-medium ${textPrimary}`}>{stg.label}</p>
                          <p className={`text-xs ${textSecondary}`}>
                            {stgTask?.assignee || 'Unassigned'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isApproved && (
                          <Badge className="bg-green-500/20 text-green-400">
                            <Check className="h-3 w-3 mr-1" /> Approved
                          </Badge>
                        )}
                        {isPending && (
                          <Badge className="bg-orange-500/20 text-orange-400">
                            <Clock className="h-3 w-3 mr-1" /> Pending
                          </Badge>
                        )}
                        {isInProgress && (
                          <Badge className="bg-blue-500/20 text-blue-400">
                            <Play className="h-3 w-3 mr-1" /> In Progress
                          </Badge>
                        )}
                        {!stgTask && (
                          <Badge className="bg-gray-500/20 text-gray-400">
                            Not Started
                          </Badge>
                        )}
                        {stgTask?.time_spent > 0 && (
                          <span className={`text-xs ${textSecondary}`}>
                            <Timer className="h-3 w-3 inline mr-1" />
                            {formatDuration(stgTask.time_spent)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          
          {/* Details Tab */}
          {activeTab === 'details' && (
            <div className="space-y-4">
              <h4 className={`text-sm font-semibold ${textPrimary} mb-4`}>Task Details</h4>
              
              <div className="grid grid-cols-2 gap-4">
                <div className={`${bgSecondary} rounded-lg p-4`}>
                  <p className={`text-xs ${textSecondary} mb-1`}>Status</p>
                  <Badge className={`${
                    task.status === 'approved' ? 'bg-green-500/20 text-green-400' :
                    task.status === 'in_progress' ? 'bg-blue-500/20 text-blue-400' :
                    task.status === 'waiting_pm' || task.status === 'waiting_ops' ? 'bg-orange-500/20 text-orange-400' :
                    'bg-gray-500/20 text-gray-400'
                  }`}>
                    {task.pm_approved && !task.ops_approved ? 'PM Approved' : 
                     task.ops_approved ? 'Fully Approved' : 
                     task.status?.replace(/_/g, ' ').toUpperCase() || 'Pending'}
                  </Badge>
                </div>
                
                <div className={`${bgSecondary} rounded-lg p-4`}>
                  <p className={`text-xs ${textSecondary} mb-1`}>Assignee</p>
                  <p className={`font-medium ${textPrimary}`}>{task.assignee || 'Unassigned'}</p>
                </div>
                
                <div className={`${bgSecondary} rounded-lg p-4`}>
                  <p className={`text-xs ${textSecondary} mb-1`}>Due Date</p>
                  <p className={`font-medium ${textPrimary}`}>{task.due_date || 'Not set'}</p>
                </div>
                
                <div className={`${bgSecondary} rounded-lg p-4`}>
                  <p className={`text-xs ${textSecondary} mb-1`}>Time Spent</p>
                  <p className={`font-medium ${textPrimary}`}>{formatDuration(task.time_spent)}</p>
                </div>
              </div>
              
              {task.link && (
                <div className={`${bgSecondary} rounded-lg p-4`}>
                  <p className={`text-xs ${textSecondary} mb-2`}>Work Link</p>
                  <a 
                    href={task.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#6366f1] hover:underline flex items-center gap-2"
                  >
                    <ExternalLink className="h-4 w-4" />
                    View Work
                  </a>
                </div>
              )}
              
              {task.remarks && (
                <div className={`${bgSecondary} rounded-lg p-4`}>
                  <p className={`text-xs ${textSecondary} mb-2`}>Remarks</p>
                  <p className={`text-sm ${textPrimary}`}>{task.remarks}</p>
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className={`p-4 border-t ${borderColor} flex justify-end`}>
          <Button onClick={onClose} className="bg-[#6366f1] hover:bg-[#4f46e5]">
            Close
          </Button>
        </div>
      </div>
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

// ==================== AD.TASKS TAB ====================
function AdTasksTab({ projectId, teamMembers, isDark, bgCard, bgSecondary, borderColor, textPrimary, textSecondary }) {
  const [tasks, setTasks] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [newTask, setNewTask] = useState({
    title: '', description: '', priority: 'medium', due_date: '', assignee: '', assignee_id: '', type: 'general', work_link: ''
  });
  const [timers, setTimers] = useState({});
  const [filter, setFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    dateFilter: 'all',
    singleDate: '',
    assignedTo: 'all',
    taskType: 'all',
    status: 'all'
  });
  const token = localStorage.getItem('session_token');
  const API = process.env.REACT_APP_BACKEND_URL;
  const { user } = useAuth();
  
  const loadTasks = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/additional-tasks/?project_id=${projectId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTasks(res.data || []);
    } catch (error) {
      console.error('Error loading tasks:', error);
    }
  }, [projectId, token, API]);
  
  useEffect(() => {
    if (projectId) loadTasks();
  }, [projectId, loadTasks]);
  
  // Stats calculation
  const stats = {
    total: tasks.length,
    pending: tasks.filter(t => t.status === 'To-Do' || t.status === 'pending').length,
    in_progress: tasks.filter(t => t.status === 'In Progress' || t.status === 'in_progress').length,
    completed: tasks.filter(t => t.status === 'Completed' || t.status === 'completed').length
  };
  
  // Filter tasks
  const filteredTasks = tasks.filter(task => {
    // Quick filter tabs
    if (filter === 'pending' && task.status !== 'To-Do' && task.status !== 'pending') return false;
    if (filter === 'in_progress' && task.status !== 'In Progress' && task.status !== 'in_progress') return false;
    if (filter === 'completed' && task.status !== 'Completed' && task.status !== 'completed') return false;
    
    // Advanced filters
    if (filters.dateFilter === 'today') {
      const today = new Date().toISOString().split('T')[0];
      if (task.due_date !== today) return false;
    } else if (filters.dateFilter === 'single' && filters.singleDate) {
      if (task.due_date !== filters.singleDate) return false;
    }
    
    if (filters.assignedTo !== 'all' && task.assignee_id !== filters.assignedTo) return false;
    if (filters.taskType !== 'all' && task.type !== filters.taskType) return false;
    if (filters.status !== 'all') {
      const normalizedStatus = task.status?.toLowerCase().replace(/[- ]/g, '_');
      if (normalizedStatus !== filters.status) return false;
    }
    
    return true;
  });
  
  const resetFilters = () => {
    setFilters({
      dateFilter: 'all',
      singleDate: '',
      assignedTo: 'all',
      taskType: 'all',
      status: 'all'
    });
  };
  
  const handleCreate = async () => {
    if (!newTask.title.trim()) {
      toast.error('Please enter a task title');
      return;
    }
    try {
      await axios.post(`${API}/api/additional-tasks/`, { ...newTask, project_id: projectId }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Task created!');
      setShowModal(false);
      setNewTask({ title: '', description: '', priority: 'medium', due_date: '', assignee: '', assignee_id: '', type: 'general', work_link: '' });
      loadTasks();
    } catch (error) {
      toast.error('Failed to create task');
    }
  };
  
  const handleUpdate = async () => {
    if (!newTask.title.trim()) {
      toast.error('Please enter a task title');
      return;
    }
    try {
      await axios.put(`${API}/api/additional-tasks/${editingTask.task_id}`, { ...newTask }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Task updated!');
      setShowModal(false);
      setEditingTask(null);
      setNewTask({ title: '', description: '', priority: 'medium', due_date: '', assignee: '', assignee_id: '', type: 'general', work_link: '' });
      loadTasks();
    } catch (error) {
      toast.error('Failed to update task');
    }
  };
  
  const openEditModal = (task) => {
    setEditingTask(task);
    setNewTask({
      title: task.title,
      description: task.description || '',
      priority: task.priority || 'medium',
      due_date: task.due_date || '',
      assignee: task.assignee || '',
      assignee_id: task.assignee_id || '',
      type: task.type || 'general',
      work_link: task.work_link || ''
    });
    setShowModal(true);
  };
  
  const handleStart = async (taskId) => {
    setTimers(prev => ({ ...prev, [taskId]: { startTime: Date.now() } }));
    try {
      await axios.put(`${API}/api/additional-tasks/${taskId}/status`, { status: 'In Progress' }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      loadTasks();
    } catch (error) {
      console.error('Error updating status');
    }
  };
  
  const handleStop = async (taskId) => {
    const timerInfo = timers[taskId];
    if (timerInfo) {
      const seconds = Math.floor((Date.now() - timerInfo.startTime) / 1000);
      try {
        await axios.put(`${API}/api/additional-tasks/${taskId}/add-time`, { seconds }, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setTimers(prev => { const n = {...prev}; delete n[taskId]; return n; });
        loadTasks();
      } catch (error) {
        toast.error('Failed to save time');
      }
    }
  };
  
  const handleComplete = async (taskId) => {
    const timerInfo = timers[taskId];
    if (timerInfo) {
      const seconds = Math.floor((Date.now() - timerInfo.startTime) / 1000);
      try {
        await axios.put(`${API}/api/additional-tasks/${taskId}/add-time`, { seconds }, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setTimers(prev => { const n = {...prev}; delete n[taskId]; return n; });
      } catch (error) {
        console.error('Failed to save time');
      }
    }
    try {
      await axios.put(`${API}/api/additional-tasks/${taskId}/status`, { status: 'Completed' }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      loadTasks();
    } catch (error) {
      toast.error('Failed to update');
    }
  };
  
  const handleDelete = async (taskId) => {
    try {
      await axios.delete(`${API}/api/additional-tasks/${taskId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Task deleted');
      loadTasks();
    } catch (error) {
      toast.error('Failed to delete');
    }
  };
  
  const formatTime = (secs) => {
    if (!secs) return '00:00:00';
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
  };
  
  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };
  
  const statusColors = {
    'To-Do': 'bg-[#71717a]/20 text-[#71717a]',
    'pending': 'bg-[#71717a]/20 text-[#71717a]',
    'In Progress': 'bg-[#3b82f6]/20 text-[#3b82f6]',
    'in_progress': 'bg-[#3b82f6]/20 text-[#3b82f6]',
    'Completed': 'bg-[#10b981]/20 text-[#10b981]',
    'completed': 'bg-[#10b981]/20 text-[#10b981]'
  };

  const getTimerButton = (task) => {
    const isRunning = timers[task.task_id];
    const isCompleted = task.status === 'Completed' || task.status === 'completed';
    
    if (isCompleted) {
      return (
        <Badge className="bg-[#10b981]/20 text-[#10b981]">
          <CheckCircle2 className="h-3 w-3 mr-1" /> Done
        </Badge>
      );
    }
    
    if (isRunning) {
      return (
        <div className="flex gap-1">
          <Button size="sm" onClick={() => handleStop(task.task_id)} className="bg-[#f59e0b] hover:bg-[#d97706] text-white h-7 px-2">
            <Pause className="h-3 w-3 mr-1" /> Pause
          </Button>
          <Button size="sm" onClick={() => handleComplete(task.task_id)} className="bg-[#ef4444] hover:bg-[#dc2626] text-white h-7 px-2">
            <Check className="h-3 w-3" />
          </Button>
        </div>
      );
    }
    
    return (
      <Button size="sm" onClick={() => handleStart(task.task_id)} className="bg-[#10b981] hover:bg-[#059669] text-white h-7 px-3">
        <Play className="h-3 w-3 mr-1" /> Start
      </Button>
    );
  };
  
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className={`text-lg font-semibold ${textPrimary}`}>Additional Tasks</h3>
        <Button onClick={() => { setEditingTask(null); setNewTask({ title: '', description: '', priority: 'medium', due_date: '', assignee: '', assignee_id: '', type: 'general', work_link: '' }); setShowModal(true); }} className="bg-[#6366f1] h-9">
          <Plus className="h-4 w-4 mr-2" /> Add Task
        </Button>
      </div>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-3">
        <div className={`${bgCard} border ${borderColor} rounded-lg p-3`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-xs ${textSecondary}`}>Total Tasks</p>
              <p className={`text-xl font-bold ${textPrimary}`}>{stats.total}</p>
            </div>
            <ClipboardCheck className="h-6 w-6 text-[#6366f1]" />
          </div>
        </div>
        <div className={`${bgCard} border ${borderColor} rounded-lg p-3`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-xs ${textSecondary}`}>Pending</p>
              <p className="text-xl font-bold text-[#71717a]">{stats.pending}</p>
            </div>
            <Clock className="h-6 w-6 text-[#71717a]" />
          </div>
        </div>
        <div className={`${bgCard} border ${borderColor} rounded-lg p-3`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-xs ${textSecondary}`}>In Progress</p>
              <p className="text-xl font-bold text-[#3b82f6]">{stats.in_progress}</p>
            </div>
            <RefreshCw className="h-6 w-6 text-[#3b82f6]" />
          </div>
        </div>
        <div className={`${bgCard} border ${borderColor} rounded-lg p-3`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-xs ${textSecondary}`}>Completed</p>
              <p className="text-xl font-bold text-[#10b981]">{stats.completed}</p>
            </div>
            <CheckCircle2 className="h-6 w-6 text-[#10b981]" />
          </div>
        </div>
      </div>
      
      {/* Filter Tabs & Filters Toggle */}
      <div className="flex gap-2 justify-between items-center flex-wrap">
        <div className="flex gap-2 flex-wrap">
          {['all', 'pending', 'in_progress', 'completed'].map(f => (
            <Button
              key={f}
              variant={filter === f ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter(f)}
              className={filter === f ? 'bg-[#6366f1]' : ''}
            >
              {f === 'all' ? 'All' : f.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </Button>
          ))}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
          className={showFilters ? 'bg-[#6366f1] text-white' : ''}
        >
          <Settings className="h-4 w-4 mr-2" />
          Filters
        </Button>
      </div>
      
      {/* Advanced Filters Panel */}
      {showFilters && (
        <div className={`${bgCard} border ${borderColor} rounded-lg p-4`}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Date Filter */}
            <div>
              <label className={`text-xs ${textSecondary} mb-1 block`}>Date</label>
              <Select value={filters.dateFilter} onValueChange={(v) => setFilters({...filters, dateFilter: v})}>
                <SelectTrigger className={`h-9 ${bgSecondary} border ${borderColor}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="single">Single Date</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Single Date Picker */}
            {filters.dateFilter === 'single' && (
              <div>
                <label className={`text-xs ${textSecondary} mb-1 block`}>Select Date</label>
                <Input
                  type="date"
                  value={filters.singleDate}
                  onChange={(e) => setFilters({...filters, singleDate: e.target.value})}
                  className={`h-9 ${bgSecondary} border ${borderColor}`}
                />
              </div>
            )}
            
            {/* Assigned To */}
            <div>
              <label className={`text-xs ${textSecondary} mb-1 block`}>Assigned To</label>
              <Select value={filters.assignedTo} onValueChange={(v) => setFilters({...filters, assignedTo: v})}>
                <SelectTrigger className={`h-9 ${bgSecondary} border ${borderColor}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {teamMembers.map(m => (
                    <SelectItem key={m.user_id} value={m.user_id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Task Type */}
            <div>
              <label className={`text-xs ${textSecondary} mb-1 block`}>Type</label>
              <Select value={filters.taskType} onValueChange={(v) => setFilters({...filters, taskType: v})}>
                <SelectTrigger className={`h-9 ${bgSecondary} border ${borderColor}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="general">General</SelectItem>
                  <SelectItem value="bug">Bug Fix</SelectItem>
                  <SelectItem value="feature">Feature</SelectItem>
                  <SelectItem value="content">Content</SelectItem>
                  <SelectItem value="design">Design</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Status */}
            <div>
              <label className={`text-xs ${textSecondary} mb-1 block`}>Status</label>
              <Select value={filters.status} onValueChange={(v) => setFilters({...filters, status: v})}>
                <SelectTrigger className={`h-9 ${bgSecondary} border ${borderColor}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="to_do">To-Do</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="flex justify-end mt-4">
            <Button variant="ghost" size="sm" onClick={resetFilters}>
              Reset Filters
            </Button>
          </div>
        </div>
      )}
      
      {/* Tasks Table */}
      <div className={`${bgCard} border ${borderColor} rounded-lg overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className={bgSecondary}>
              <tr>
                <th className={`px-4 py-3 text-left text-xs font-medium ${textSecondary} uppercase`}>Task</th>
                <th className={`px-4 py-3 text-left text-xs font-medium ${textSecondary} uppercase`}>Status</th>
                <th className={`px-4 py-3 text-left text-xs font-medium ${textSecondary} uppercase`}>Assigned</th>
                <th className={`px-4 py-3 text-left text-xs font-medium ${textSecondary} uppercase`}>Due Date</th>
                <th className={`px-4 py-3 text-left text-xs font-medium ${textSecondary} uppercase`}>Link</th>
                <th className={`px-4 py-3 text-left text-xs font-medium ${textSecondary} uppercase`}>Time</th>
                <th className={`px-4 py-3 text-left text-xs font-medium ${textSecondary} uppercase`}>Timer</th>
                <th className={`px-4 py-3 text-left text-xs font-medium ${textSecondary} uppercase`}>Actions</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-[#27272a]' : 'divide-gray-200'}`}>
              {filteredTasks.length === 0 ? (
                <tr>
                  <td colSpan={8} className={`px-4 py-12 text-center ${textSecondary}`}>
                    <CheckCircle2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No tasks found</p>
                    <p className="text-sm mt-1">Create a new task to get started</p>
                  </td>
                </tr>
              ) : filteredTasks.map(task => (
                <tr key={task.task_id} className={`${bgCard} hover:${bgSecondary} transition-colors`}>
                  <td className="px-4 py-3">
                    <div className="flex items-start gap-2">
                      <div className={`w-1 h-8 rounded-full flex-shrink-0 ${task.priority === 'urgent' ? 'bg-red-500' : task.priority === 'high' ? 'bg-orange-500' : task.priority === 'medium' ? 'bg-yellow-500' : 'bg-gray-400'}`} />
                      <div>
                        <p className={`font-medium ${textPrimary}`}>{task.title}</p>
                        {task.description && (
                          <p className={`text-xs ${textSecondary} truncate max-w-xs`}>{task.description}</p>
                        )}
                        <Badge className="text-xs mt-1" variant="outline">{task.type || 'General'}</Badge>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={statusColors[task.status] || statusColors['To-Do']}>
                      {task.status || 'To-Do'}
                    </Badge>
                  </td>
                  <td className={`px-4 py-3 text-sm ${textPrimary}`}>
                    {task.assignee || '-'}
                  </td>
                  <td className={`px-4 py-3 text-sm`}>
                    {task.due_date ? (
                      <span className={new Date(task.due_date) < new Date() && task.status !== 'Completed' && task.status !== 'completed' ? 'text-[#ef4444]' : textPrimary}>
                        {formatDate(task.due_date)}
                      </span>
                    ) : (
                      <span className={textSecondary}>-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {task.work_link ? (
                      <a 
                        href={task.work_link} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[#3b82f6] hover:text-[#2563eb]"
                      >
                        <Link2 className="h-4 w-4" />
                      </a>
                    ) : (
                      <span className={textSecondary}>-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Timer className={`h-4 w-4 ${timers[task.task_id] ? 'text-[#10b981] animate-pulse' : textSecondary}`} />
                      <span className={`text-sm font-medium ${textPrimary}`}>
                        {formatTime(task.time_spent || 0)}
                      </span>
                    </div>
                    {timers[task.task_id] && (
                      <div className="text-xs text-[#10b981] mt-1">Running...</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {getTimerButton(task)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEditModal(task)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="text-[#ef4444]" onClick={() => handleDelete(task.task_id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className={`${bgCard} rounded-xl w-full max-w-lg border ${borderColor} p-6`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className={`text-lg font-bold ${textPrimary}`}>{editingTask ? 'Edit Task' : 'Create Additional Task'}</h2>
              <Button variant="ghost" size="sm" onClick={() => { setShowModal(false); setEditingTask(null); }} className="h-8 w-8 p-0">
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="space-y-4">
              <Input 
                placeholder="Task title *" 
                value={newTask.title} 
                onChange={(e) => setNewTask({...newTask, title: e.target.value})} 
                className={`${bgSecondary} border-none`} 
              />
              <Textarea 
                placeholder="Description" 
                value={newTask.description} 
                onChange={(e) => setNewTask({...newTask, description: e.target.value})} 
                className={`${bgSecondary} border-none`} 
                rows={2} 
              />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`text-xs ${textSecondary} mb-1 block`}>Due Date</label>
                  <Input 
                    type="date" 
                    value={newTask.due_date} 
                    onChange={(e) => setNewTask({...newTask, due_date: e.target.value})} 
                    className={`${bgSecondary} border-none`} 
                  />
                </div>
                <div>
                  <label className={`text-xs ${textSecondary} mb-1 block`}>Priority</label>
                  <Select value={newTask.priority} onValueChange={(v) => setNewTask({...newTask, priority: v})}>
                    <SelectTrigger className={`${bgSecondary} border-none`}><SelectValue placeholder="Priority" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`text-xs ${textSecondary} mb-1 block`}>Type</label>
                  <Select value={newTask.type || 'general'} onValueChange={(v) => setNewTask({...newTask, type: v})}>
                    <SelectTrigger className={`${bgSecondary} border-none`}><SelectValue placeholder="Type" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General</SelectItem>
                      <SelectItem value="bug">Bug Fix</SelectItem>
                      <SelectItem value="feature">Feature</SelectItem>
                      <SelectItem value="content">Content</SelectItem>
                      <SelectItem value="design">Design</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className={`text-xs ${textSecondary} mb-1 block`}>Assign To</label>
                  <Select value={newTask.assignee_id || 'none'} onValueChange={(v) => {
                    const m = teamMembers.find(x => x.user_id === v);
                    setNewTask({...newTask, assignee_id: v === 'none' ? '' : v, assignee: m?.name || ''});
                  }}>
                    <SelectTrigger className={`${bgSecondary} border-none`}><SelectValue placeholder="Assign to" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Unassigned</SelectItem>
                      {teamMembers.map(m => <SelectItem key={m.user_id} value={m.user_id}>{m.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <label className={`text-xs ${textSecondary} mb-1 block`}>Work Link (optional)</label>
                <Input 
                  placeholder="https://..." 
                  value={newTask.work_link || ''} 
                  onChange={(e) => setNewTask({...newTask, work_link: e.target.value})} 
                  className={`${bgSecondary} border-none`} 
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => { setShowModal(false); setEditingTask(null); }}>Cancel</Button>
              <Button onClick={editingTask ? handleUpdate : handleCreate} className="bg-[#6366f1]">
                {editingTask ? 'Update Task' : 'Create Task'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== MEETINGS TAB ====================
function MeetingsTab({ projectId, teamMembers, isDark, bgCard, bgSecondary, borderColor, textPrimary, textSecondary }) {
  const [meetings, setMeetings] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [whenFilter, setWhenFilter] = useState('upcoming'); // upcoming | completed | all
  const [newMeeting, setNewMeeting] = useState({
    title: '', date: '', start_time: '', end_time: '', meeting_type: 'video', meeting_link: '', agenda: ''
  });
  const token = localStorage.getItem('session_token');
  const API = process.env.REACT_APP_BACKEND_URL;
  
  const loadMeetings = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/meetings/?project_id=${projectId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMeetings(res.data || []);
    } catch (error) {
      console.error('Error loading meetings:', error);
    }
  }, [projectId, token, API]);
  
  useEffect(() => {
    if (projectId) loadMeetings();
  }, [projectId, loadMeetings]);
  
  const handleCreate = async () => {
    if (!newMeeting.title.trim() || !newMeeting.date || !newMeeting.start_time) {
      toast.error('Please fill in title, date, and start time');
      return;
    }
    try {
      await axios.post(`${API}/api/meetings/`, { ...newMeeting, project_id: projectId }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Meeting scheduled!');
      setShowModal(false);
      setNewMeeting({ title: '', date: '', start_time: '', end_time: '', meeting_type: 'video', meeting_link: '', agenda: '' });
      loadMeetings();
    } catch (error) {
      toast.error('Failed to create meeting');
    }
  };
  
  const handleComplete = async (meetingId) => {
    try {
      await axios.put(`${API}/api/meetings/${meetingId}/status`, { status: 'completed' }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      loadMeetings();
    } catch (error) {
      toast.error('Failed to update');
    }
  };
  
  const handleDelete = async (meetingId) => {
    try {
      await axios.delete(`${API}/api/meetings/${meetingId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Meeting deleted');
      loadMeetings();
    } catch (error) {
      toast.error('Failed to delete');
    }
  };

  // Split by status / when filter. Upcoming = NOT completed (incl. overdue). Completed = explicit status.
  const todayStr = new Date().toISOString().slice(0, 10);
  const isCompleted = (m) => (m.status || '').toLowerCase() === 'completed';
  const filtered = meetings.filter((m) => {
    if (whenFilter === 'upcoming') return !isCompleted(m);
    if (whenFilter === 'completed') return isCompleted(m);
    return true;
  }).sort((a, b) => {
    const ka = `${a.date || ''} ${a.start_time || ''}`;
    const kb = `${b.date || ''} ${b.start_time || ''}`;
    return whenFilter === 'completed' ? kb.localeCompare(ka) : ka.localeCompare(kb);
  });

  const counts = {
    upcoming: meetings.filter((m) => !isCompleted(m)).length,
    completed: meetings.filter(isCompleted).length,
    all: meetings.length,
  };
  
  return (
    <div className="space-y-4" data-testid="project-meetings-tab">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className={`text-lg font-semibold ${textPrimary}`}>Meetings</h3>
        <Button onClick={() => setShowModal(true)} className="bg-[#6366f1] h-9" data-testid="project-create-meeting-btn">
          <Plus className="h-4 w-4 mr-2" /> Schedule Meeting
        </Button>
      </div>

      {/* Sub-tabs: Upcoming / Completed / All */}
      <div className="flex gap-2 flex-wrap">
        {[
          { id: 'upcoming', label: 'Upcoming', count: counts.upcoming },
          { id: 'completed', label: 'Completed', count: counts.completed },
          { id: 'all', label: 'All', count: counts.all },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setWhenFilter(t.id)}
            data-testid={`project-meetings-filter-${t.id}`}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition border ${
              whenFilter === t.id
                ? 'bg-[#6366f1] border-[#6366f1] text-white'
                : isDark
                  ? 'bg-[#27272a] border-[#3f3f46] text-[#fafafa] hover:bg-[#3f3f46]'
                  : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-100'
            }`}
          >
            {t.label} <span className="ml-1 text-xs opacity-80">({t.count})</span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className={`text-center py-12 ${textSecondary}`}>
          <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>
            {whenFilter === 'upcoming' && 'No upcoming meetings for this project'}
            {whenFilter === 'completed' && 'No completed meetings yet'}
            {whenFilter === 'all' && 'No meetings scheduled for this project'}
          </p>
          <p className="text-xs opacity-70 mt-1">
            Tip: tasks with Type = Meeting + this project will also appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(meeting => {
            const completed = isCompleted(meeting);
            return (
              <div key={meeting.meeting_id} className={`p-4 rounded-xl border ${borderColor} ${bgSecondary}`} data-testid={`project-meeting-${meeting.meeting_id}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${meeting.meeting_type === 'video' ? 'bg-blue-500/20' : meeting.meeting_type === 'audio' ? 'bg-green-500/20' : 'bg-purple-500/20'}`}>
                      <Calendar className={`h-5 w-5 ${meeting.meeting_type === 'video' ? 'text-blue-500' : meeting.meeting_type === 'audio' ? 'text-green-500' : 'text-purple-500'}`} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className={`font-medium ${textPrimary} truncate`}>{meeting.title}</p>
                        {meeting.linked_task_id && (
                          <Badge className="bg-indigo-500/20 text-indigo-400 pointer-events-none text-[10px]">via Task</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-sm flex-wrap">
                        <span className={textSecondary}>{meeting.date || '—'}{meeting.start_time ? ` • ${meeting.start_time}` : ''}{meeting.end_time ? ` - ${meeting.end_time}` : ''}</span>
                        <Badge
                          className={`${
                            completed ? 'bg-emerald-500/20 text-emerald-400' :
                            (meeting.date || '') < todayStr ? 'bg-amber-500/20 text-amber-400' :
                            'bg-blue-500/20 text-blue-400'
                          } pointer-events-none`}
                        >
                          {completed ? 'Completed' : (meeting.date || '') < todayStr ? 'Overdue' : 'Upcoming'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {meeting.meeting_link && (
                      <Button size="sm" variant="outline" onClick={() => window.open(meeting.meeting_link, '_blank')}>
                        <ExternalLink className="h-3 w-3 mr-1" /> Join
                      </Button>
                    )}
                    {!completed && (
                      <Button size="sm" variant="ghost" onClick={() => handleComplete(meeting.meeting_id)} title="Mark complete">
                        <Check className="h-4 w-4 text-emerald-500" />
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(meeting.meeting_id)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      
      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className={`${bgCard} rounded-xl w-full max-w-md border ${borderColor} p-6`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className={`text-lg font-bold ${textPrimary}`}>Schedule Meeting</h2>
              <Button variant="ghost" size="sm" onClick={() => setShowModal(false)} className="h-8 w-8 p-0">
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="space-y-4">
              <Input placeholder="Meeting title *" value={newMeeting.title} onChange={(e) => setNewMeeting({...newMeeting, title: e.target.value})} className={`${bgSecondary} border-none`} />
              <Textarea placeholder="Agenda" value={newMeeting.agenda} onChange={(e) => setNewMeeting({...newMeeting, agenda: e.target.value})} className={`${bgSecondary} border-none`} rows={2} />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`text-xs ${textSecondary} mb-1 block`}>Date *</label>
                  <Input type="date" value={newMeeting.date} onChange={(e) => setNewMeeting({...newMeeting, date: e.target.value})} className={`${bgSecondary} border-none`} />
                </div>
                <Select value={newMeeting.meeting_type} onValueChange={(v) => setNewMeeting({...newMeeting, meeting_type: v})}>
                  <SelectTrigger className={`${bgSecondary} border-none mt-5`}><SelectValue placeholder="Type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="video">Video Call</SelectItem>
                    <SelectItem value="audio">Audio Call</SelectItem>
                    <SelectItem value="in-person">In Person</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`text-xs ${textSecondary} mb-1 block`}>Start Time *</label>
                  <Input type="time" value={newMeeting.start_time} onChange={(e) => setNewMeeting({...newMeeting, start_time: e.target.value})} className={`${bgSecondary} border-none`} />
                </div>
                <div>
                  <label className={`text-xs ${textSecondary} mb-1 block`}>End Time</label>
                  <Input type="time" value={newMeeting.end_time} onChange={(e) => setNewMeeting({...newMeeting, end_time: e.target.value})} className={`${bgSecondary} border-none`} />
                </div>
              </div>
              <Input placeholder="Meeting link (Google Meet, Zoom)" value={newMeeting.meeting_link} onChange={(e) => setNewMeeting({...newMeeting, meeting_link: e.target.value})} className={`${bgSecondary} border-none`} />
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button onClick={handleCreate} className="bg-[#6366f1]">Schedule Meeting</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
