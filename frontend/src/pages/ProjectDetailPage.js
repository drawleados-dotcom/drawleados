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
  Code, PenTool, TestTube, Truck, ClipboardCheck
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

// Stage definitions with colors - Sequential workflow
const WORKFLOW_STAGES = [
  { id: 'content', label: 'Content', icon: FileText, color: 'bg-blue-500', textColor: 'text-blue-400', order: 1 },
  { id: 'wireframe', label: 'Wireframe', icon: PenTool, color: 'bg-purple-500', textColor: 'text-purple-400', order: 2 },
  { id: 'ui', label: 'UI Design', icon: Palette, color: 'bg-pink-500', textColor: 'text-pink-400', order: 3 },
  { id: 'responsive', label: 'Responsive', icon: Layers, color: 'bg-indigo-500', textColor: 'text-indigo-400', order: 4 },
  { id: 'dev', label: 'Development', icon: Code, color: 'bg-green-500', textColor: 'text-green-400', order: 5 },
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
  canApprove, onSubmit, onApprove, onCorrections, onTimerAction, onMoveNext, onViewComments,
  isDark, bgCard, bgSecondary, borderColor, textPrimary, textSecondary 
}) {
  const [correctionsModal, setCorrectionsModal] = useState({ open: false, task: null, stage: null });
  const [remarks, setRemarks] = useState('');
  const [finishModal, setFinishModal] = useState({ open: false, task: null, stage: null });
  const [linkUrl, setLinkUrl] = useState('');
  const [selectedStage, setSelectedStage] = useState(null);
  const [selectedApprover, setSelectedApprover] = useState('project_manager');
  
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
  
  // Get all unique pages across all stages
  const getAllPages = () => {
    const pagesMap = new Map();
    
    // First collect from stageTasks
    Object.values(stageTasks).forEach(tasks => {
      tasks.forEach(task => {
        if (task.page_id && !pagesMap.has(task.page_id)) {
          pagesMap.set(task.page_id, {
            page_id: task.page_id,
            page_name: task.page_name
          });
        }
      });
    });
    
    // Also collect from pages prop
    pages.forEach(page => {
      if (!pagesMap.has(page.task_id)) {
        pagesMap.set(page.task_id, {
          page_id: page.task_id,
          page_name: page.page_name
        });
      }
    });
    
    return Array.from(pagesMap.values());
  };
  
  // Get task for a specific page and stage
  const getTaskForPageStage = (pageId, stageId) => {
    const tasks = stageTasks[stageId] || [];
    return tasks.find(t => t.page_id === pageId) || null;
  };
  
  // Get overall status for a page
  const getPageOverallStatus = (pageId) => {
    let completedStages = 0;
    let totalStages = stages.length;
    
    stages.forEach(stage => {
      const task = getTaskForPageStage(pageId, stage.id);
      if (task?.status === 'approved' && (task?.ops_approved === true || !task?.pm_approved)) {
        completedStages++;
      }
    });
    
    if (completedStages === totalStages) return 'completed';
    if (completedStages > 0) return 'in_progress';
    return 'to_do';
  };
  
  const allPages = getAllPages();
  const displayStages = stages.filter(s => s.id !== 'delivery'); // Show main workflow stages

  return (
    <div className="flex flex-col h-full">
      {/* Filters Row */}
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search pages..."
              className={`pl-10 w-60 h-9 ${bgSecondary} border-none`}
            />
          </div>
        </div>
        <Button className="bg-[#6366f1] hover:bg-[#5558e3] gap-2">
          <Plus className="h-4 w-4" /> Add Page
        </Button>
      </div>
      
      {/* Multi-Stage Table */}
      <div className={`flex-1 overflow-auto rounded-xl border ${borderColor} ${bgCard}`}>
        {allPages.length === 0 ? (
          <div className={`text-center py-16 ${textSecondary}`}>
            <FileText className="h-16 w-16 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium">No pages yet</p>
            <p className="text-sm">Add pages to start tracking stages</p>
          </div>
        ) : (
          <table className="w-full">
            {/* Table Header */}
            <thead className={`${bgSecondary} sticky top-0 z-10`}>
              <tr className={`text-left text-xs font-semibold uppercase tracking-wider ${textSecondary}`}>
                <th className="px-3 py-3 w-10">#</th>
                <th className="px-3 py-3 min-w-[150px]">Page Name</th>
                {displayStages.map(stage => (
                  <th key={stage.id} className="px-3 py-3 min-w-[180px]">
                    <div className="flex items-center gap-2">
                      <div className={`w-5 h-5 rounded ${stage.color} flex items-center justify-center`}>
                        <stage.icon className="h-3 w-3 text-white" />
                      </div>
                      <div>
                        <div>{stage.label}</div>
                        <div className="text-[10px] font-normal opacity-70">Status / Assignee / Due</div>
                      </div>
                    </div>
                  </th>
                ))}
                <th className="px-3 py-3 min-w-[120px]">
                  <div>Overall</div>
                  <div className="text-[10px] font-normal opacity-70">Status / URL</div>
                </th>
                <th className="px-3 py-3 w-20 text-center">Actions</th>
              </tr>
            </thead>
            
            {/* Table Body */}
            <tbody className="divide-y" style={{ borderColor: isDark ? '#27272a' : '#e5e7eb' }}>
              {allPages.map((page, idx) => {
                const overallStatus = getPageOverallStatus(page.page_id);
                
                return (
                  <tr 
                    key={page.page_id}
                    className={`hover:${bgSecondary} transition-colors`}
                    data-testid={`page-row-${page.page_id}`}
                  >
                    {/* Row Number */}
                    <td className={`px-3 py-4 ${textSecondary} text-sm`}>{idx + 1}</td>
                    
                    {/* Page Name */}
                    <td className="px-3 py-4">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-[#6366f1]" />
                        <span className={`font-semibold ${textPrimary}`}>{page.page_name}</span>
                      </div>
                    </td>
                    
                    {/* Stage Columns */}
                    {displayStages.map(stage => {
                      const task = getTaskForPageStage(page.page_id, stage.id);
                      const isLocked = !isPreviousStageFullyApproved(page.page_id, stage.id);
                      const status = task?.status || 'pending';
                      const displayStatus = isLocked ? 'locked' : status;
                      
                      return (
                        <td key={stage.id} className="px-3 py-4">
                          <div className="space-y-2">
                            {/* Status Dropdown */}
                            <Select 
                              value={displayStatus} 
                              disabled={isLocked}
                              onValueChange={(val) => {
                                if (val === 'start' && task) {
                                  onTimerAction(task.task_id, 'start');
                                }
                              }}
                            >
                              <SelectTrigger className={`h-7 text-xs ${
                                displayStatus === 'approved' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                                displayStatus === 'in_progress' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
                                displayStatus === 'waiting_pm' || displayStatus === 'waiting_ops' ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' :
                                displayStatus === 'locked' ? 'bg-gray-500/20 text-gray-500 border-gray-500/30' :
                                `${bgSecondary} ${textSecondary}`
                              }`}>
                                <SelectValue>
                                  {displayStatus === 'approved' ? 'Done' :
                                   displayStatus === 'in_progress' ? 'Working' :
                                   displayStatus === 'paused' ? 'Paused' :
                                   displayStatus === 'waiting_pm' ? 'PM Review' :
                                   displayStatus === 'waiting_ops' ? 'Ops Review' :
                                   displayStatus === 'corrections' ? 'Corrections' :
                                   displayStatus === 'locked' ? 'Locked' :
                                   'To-Do'}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pending">To-Do</SelectItem>
                                <SelectItem value="start">Start</SelectItem>
                                <SelectItem value="in_progress">Working</SelectItem>
                                <SelectItem value="paused">Paused</SelectItem>
                              </SelectContent>
                            </Select>
                            
                            {/* Assignee & Date Row */}
                            <div className="flex items-center gap-1">
                              <div className={`flex items-center gap-1 text-xs ${textSecondary}`}>
                                <User className="h-3 w-3" />
                                <span className="truncate max-w-[60px]">{task?.assignee || '-'}</span>
                              </div>
                              <Input
                                type="date"
                                defaultValue={task?.due_date || ''}
                                className={`h-6 text-xs px-1 w-24 ${bgSecondary} border-none`}
                                disabled={isLocked}
                              />
                            </div>
                            
                            {/* Add URL Link */}
                            {task?.link ? (
                              <a 
                                href={task.link} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-xs text-[#6366f1] hover:underline flex items-center gap-1"
                              >
                                <ExternalLink className="h-3 w-3" /> View
                              </a>
                            ) : !isLocked && (task?.status === 'in_progress' || task?.status === 'paused') ? (
                              <button 
                                onClick={() => setFinishModal({ open: true, task, stage: stage.id })}
                                className="text-xs text-[#6366f1] hover:underline"
                              >
                                + Add URL
                              </button>
                            ) : (
                              <span className={`text-xs ${textSecondary}`}>+ Add URL</span>
                            )}
                          </div>
                        </td>
                      );
                    })}
                    
                    {/* Overall Status */}
                    <td className="px-3 py-4">
                      <div className="space-y-2">
                        <Select value={overallStatus}>
                          <SelectTrigger className={`h-7 text-xs ${
                            overallStatus === 'completed' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                            overallStatus === 'in_progress' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
                            `${bgSecondary} ${textSecondary}`
                          }`}>
                            <SelectValue>
                              {overallStatus === 'completed' ? 'Completed' :
                               overallStatus === 'in_progress' ? 'In Progress' :
                               'To-Do'}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="to_do">To-Do</SelectItem>
                            <SelectItem value="in_progress">In Progress</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                          </SelectContent>
                        </Select>
                        <span className={`text-xs ${textSecondary}`}>+ Add URL</span>
                      </div>
                    </td>
                    
                    {/* Actions */}
                    <td className="px-3 py-4">
                      <div className="flex items-center justify-center">
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
