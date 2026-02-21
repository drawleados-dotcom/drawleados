import React, { useState, useEffect, useCallback } from 'react';
import Layout from '../components/Layout';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Progress } from '../components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { useTheme } from '../contexts/ThemeContext';
import {
  Plus, Search, ExternalLink, Palette, Globe, Image, FileText, Video,
  FolderOpen, LayoutGrid, List, Tag, User, Calendar, CheckCircle, Circle,
  Edit2, Trash2, Settings, Eye
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

// Design Types with sizes
const DESIGN_TYPES = [
  { id: 'poster', name: 'Poster', sizes: ['A4', 'A3', 'A2', '18x24', '24x36', 'Custom'] },
  { id: 'story', name: 'Story', sizes: ['1080x1920', '9:16', 'Custom'] },
  { id: 'brochure', name: 'Brochure', sizes: ['A4 Bi-fold', 'A4 Tri-fold', 'A5', 'DL', 'Custom'] },
  { id: 'social_post', name: 'Social Post', sizes: ['1080x1080', '1200x628', '1080x1350', 'Custom'] },
  { id: 'banner', name: 'Banner', sizes: ['728x90', '300x250', '160x600', '970x250', 'Custom'] },
  { id: 'logo', name: 'Logo', sizes: ['Square', 'Horizontal', 'Vertical', 'Icon'] },
  { id: 'video_thumbnail', name: 'Video Thumbnail', sizes: ['1280x720', '1920x1080', 'Custom'] },
  { id: 'presentation', name: 'Presentation', sizes: ['16:9', '4:3', 'A4'] },
];

// Task stages
const TASK_STAGES = [
  { id: 'design_content', name: 'Design Content', color: '#f59e0b' },
  { id: 'design_file', name: 'Design File', color: '#8b5cf6' },
  { id: 'review', name: 'Review', color: '#ec4899' },
  { id: 'final', name: 'Final', color: '#22c55e' },
];

const STATUS_OPTIONS = ['To-Do', 'In Progress', 'Review', 'Completed', 'On Hold'];
const STATUS_COLORS = {
  'To-Do': 'bg-gray-500/20 text-gray-400',
  'In Progress': 'bg-blue-500/20 text-blue-400',
  'Review': 'bg-purple-500/20 text-purple-400',
  'Completed': 'bg-green-500/20 text-green-400',
  'On Hold': 'bg-orange-500/20 text-orange-400',
};

const CreativeDesignBoard = () => {
  const { isDark } = useTheme();
  const token = localStorage.getItem('session_token');
  const headers = { Authorization: `Bearer ${token}` };

  // Main tab state
  const [activeMainTab, setActiveMainTab] = useState('design'); // 'website_ui' or 'design'
  const [viewMode, setViewMode] = useState('list');
  
  // Data
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [websiteProjects, setWebsiteProjects] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [designTypes, setDesignTypes] = useState(DESIGN_TYPES);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTag, setFilterTag] = useState('all');
  
  // Modals
  const [showAddProject, setShowAddProject] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [showAddDesignType, setShowAddDesignType] = useState(false);
  const [showTaskDetail, setShowTaskDetail] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);

  // Forms
  const [projectForm, setProjectForm] = useState({ 
    name: '', description: '', client_name: '', deadline: '', assigned_to: '' 
  });
  
  const [taskForm, setTaskForm] = useState({
    title: '',
    project_id: '',
    design_type: 'poster',
    design_size: '',
    description: '',
    // Stage details
    design_content: { due_date: '', assignee: '', link: '', status: 'To-Do' },
    design_file: { due_date: '', assignee: '', link: '', status: 'To-Do' },
    review: { due_date: '', assignee: '', link: '', status: 'To-Do' },
    final: { due_date: '', assignee: '', link: '', status: 'To-Do' },
    overall_status: 'To-Do',
    tag: 'created',
  });
  
  const [newDesignType, setNewDesignType] = useState({ name: '', sizes: '' });

  // Load data
  const loadData = useCallback(async () => {
    try {
      const [projRes, taskRes, userRes, webProjRes] = await Promise.all([
        axios.get(`${API}/api/creative/projects`, { headers }).catch(() => ({ data: [] })),
        axios.get(`${API}/api/creative/tasks`, { headers }).catch(() => ({ data: [] })),
        axios.get(`${API}/api/users`, { headers }).catch(() => ({ data: [] })),
        axios.get(`${API}/api/website-projects/projects`, { headers }).catch(() => ({ data: [] })),
      ]);
      setProjects(projRes.data || []);
      setTasks(taskRes.data || []);
      setTeamMembers(userRes.data || []);
      setWebsiteProjects(webProjRes.data || []);
      
      // Load custom design types from localStorage
      const savedTypes = localStorage.getItem('custom_design_types');
      if (savedTypes) {
        setDesignTypes([...DESIGN_TYPES, ...JSON.parse(savedTypes)]);
      }
    } catch (error) { console.error('Error:', error); }
  }, [token]);

  useEffect(() => { loadData(); }, [loadData]);

  // Handlers
  const handleAddProject = async () => {
    try {
      await axios.post(`${API}/api/creative/projects`, projectForm, { headers });
      toast.success('Project created');
      setShowAddProject(false);
      setProjectForm({ name: '', description: '', client_name: '', deadline: '', assigned_to: '' });
      loadData();
    } catch (error) { toast.error('Failed'); }
  };

  const handleAddTask = async () => {
    try {
      const taskData = {
        ...taskForm,
        stages: {
          design_content: taskForm.design_content,
          design_file: taskForm.design_file,
          review: taskForm.review,
          final: taskForm.final,
        }
      };
      await axios.post(`${API}/api/creative/tasks`, taskData, { headers });
      toast.success('Task created');
      setShowAddTask(false);
      resetTaskForm();
      loadData();
    } catch (error) { toast.error('Failed'); }
  };

  const resetTaskForm = () => {
    setTaskForm({
      title: '', project_id: '', design_type: 'poster', design_size: '', description: '',
      design_content: { due_date: '', assignee: '', link: '', status: 'To-Do' },
      design_file: { due_date: '', assignee: '', link: '', status: 'To-Do' },
      review: { due_date: '', assignee: '', link: '', status: 'To-Do' },
      final: { due_date: '', assignee: '', link: '', status: 'To-Do' },
      overall_status: 'To-Do', tag: 'created',
    });
  };

  const handleUpdateTaskStatus = async (taskId, newStatus) => {
    try {
      await axios.put(`${API}/api/creative/tasks/${taskId}`, { overall_status: newStatus }, { headers });
      loadData();
    } catch (error) { toast.error('Failed'); }
  };

  const handleUpdateStageStatus = async (taskId, stage, newStatus) => {
    try {
      const task = tasks.find(t => t.task_id === taskId);
      if (!task) return;
      const stages = task.stages || {};
      stages[stage] = { ...stages[stage], status: newStatus };
      await axios.put(`${API}/api/creative/tasks/${taskId}`, { stages }, { headers });
      loadData();
    } catch (error) { toast.error('Failed'); }
  };

  const handleDeleteTask = async (taskId) => {
    if (!window.confirm('Delete this task?')) return;
    try {
      await axios.delete(`${API}/api/creative/tasks/${taskId}`, { headers });
      toast.success('Deleted');
      loadData();
    } catch (error) { toast.error('Failed'); }
  };

  const handleAddDesignType = () => {
    if (!newDesignType.name) return;
    const newType = {
      id: newDesignType.name.toLowerCase().replace(/\s+/g, '_'),
      name: newDesignType.name,
      sizes: newDesignType.sizes.split(',').map(s => s.trim()).filter(Boolean),
    };
    const customTypes = JSON.parse(localStorage.getItem('custom_design_types') || '[]');
    customTypes.push(newType);
    localStorage.setItem('custom_design_types', JSON.stringify(customTypes));
    setDesignTypes([...designTypes, newType]);
    setNewDesignType({ name: '', sizes: '' });
    setShowAddDesignType(false);
    toast.success('Design type added');
  };

  // Filter tasks
  const filteredTasks = tasks.filter(task => {
    if (searchTerm && !task.title?.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    if (filterTag === 'assigned' && task.tag !== 'assigned') return false;
    if (filterTag === 'created' && task.tag !== 'created') return false;
    return true;
  });

  // Theme classes
  const cardClass = isDark ? 'bg-[#18181b] border-[#27272a]' : 'bg-white border-gray-200';
  const textClass = isDark ? 'text-[#fafafa]' : 'text-gray-900';
  const mutedClass = isDark ? 'text-[#a1a1aa]' : 'text-gray-500';

  // Get design type info
  const getDesignType = (typeId) => designTypes.find(t => t.id === typeId) || { name: typeId, sizes: [] };

  return (
    <Layout>
      <div className="space-y-6" data-testid="creative-board">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-[#ec4899] to-[#6366f1] bg-clip-text text-transparent">
              Creative Design Board
            </h1>
            <p className={mutedClass}>Manage UI designs and creative assets</p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => setShowAddDesignType(true)} className={isDark ? 'border-[#3f3f46]' : ''}>
              <Settings className="h-4 w-4 mr-2" /> Design Types
            </Button>
            <Button variant="outline" onClick={() => setShowAddTask(true)} className={isDark ? 'border-[#3f3f46]' : ''}>
              <Plus className="h-4 w-4 mr-2" /> Add Task
            </Button>
            <Button onClick={() => setShowAddProject(true)} className="bg-[#6366f1] hover:bg-[#5855eb]">
              <Plus className="h-4 w-4 mr-2" /> New Project
            </Button>
          </div>
        </div>

        {/* Main Tabs: Website UI vs Design */}
        <Tabs value={activeMainTab} onValueChange={setActiveMainTab} className="w-full">
          <TabsList className={`grid w-full max-w-md grid-cols-2 ${isDark ? 'bg-[#27272a]' : 'bg-gray-100'}`}>
            <TabsTrigger value="website_ui" className="flex items-center gap-2">
              <Globe className="h-4 w-4" /> Website UI
            </TabsTrigger>
            <TabsTrigger value="design" className="flex items-center gap-2">
              <Palette className="h-4 w-4" /> Design
            </TabsTrigger>
          </TabsList>

          {/* Website UI Tab */}
          <TabsContent value="website_ui" className="mt-6">
            <div className={`p-4 rounded-xl border mb-4 ${cardClass}`}>
              <h3 className={`font-semibold mb-2 ${textClass}`}>Website UI Tasks</h3>
              <p className={`text-sm ${mutedClass}`}>Tasks assigned from Website Development department</p>
            </div>
            
            <div className={`rounded-xl border overflow-hidden ${cardClass}`}>
              <table className="w-full">
                <thead className={isDark ? 'bg-[#27272a]' : 'bg-gray-50'}>
                  <tr>
                    <th className={`p-3 text-left text-sm font-medium ${mutedClass}`}>Project</th>
                    <th className={`p-3 text-left text-sm font-medium ${mutedClass}`}>Page/Task</th>
                    <th className={`p-3 text-left text-sm font-medium ${mutedClass}`}>Assignee</th>
                    <th className={`p-3 text-left text-sm font-medium ${mutedClass}`}>Due Date</th>
                    <th className={`p-3 text-left text-sm font-medium ${mutedClass}`}>Status</th>
                    <th className={`p-3 text-center text-sm font-medium ${mutedClass}`}>Actions</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDark ? 'divide-[#27272a]' : 'divide-gray-100'}`}>
                  {websiteProjects.slice(0, 10).map(proj => (
                    <tr key={proj.project_id} className={isDark ? 'hover:bg-[#1f1f23]' : 'hover:bg-gray-50'}>
                      <td className={`p-3 font-medium ${textClass}`}>{proj.name}</td>
                      <td className={`p-3 ${mutedClass}`}>{proj.description?.slice(0, 40) || 'UI Design'}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-[#6366f1] flex items-center justify-center text-xs text-white">
                            {proj.assigned_to?.[0]?.toUpperCase() || 'U'}
                          </div>
                          <span className={`text-sm ${textClass}`}>{proj.assigned_to || 'Unassigned'}</span>
                        </div>
                      </td>
                      <td className={`p-3 ${textClass}`}>{proj.deadline || '-'}</td>
                      <td className="p-3">
                        <Badge className={STATUS_COLORS[proj.status] || STATUS_COLORS['To-Do']}>
                          {proj.status || 'To-Do'}
                        </Badge>
                      </td>
                      <td className="p-3 text-center">
                        <Button size="sm" variant="ghost"><Eye className="h-4 w-4" /></Button>
                      </td>
                    </tr>
                  ))}
                  {websiteProjects.length === 0 && (
                    <tr><td colSpan={6} className={`p-8 text-center ${mutedClass}`}>No website UI tasks</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* Design Tab */}
          <TabsContent value="design" className="mt-6 space-y-4">
            {/* Filters */}
            <div className={`p-4 rounded-xl border ${cardClass}`}>
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex-1 min-w-[200px] relative">
                  <Search className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ${mutedClass}`} />
                  <Input placeholder="Search tasks..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className={`pl-10 ${isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''}`} />
                </div>
                <div className="flex gap-1">
                  {['all', 'assigned', 'created'].map(tag => (
                    <button key={tag} onClick={() => setFilterTag(tag)} className={`px-3 py-1.5 text-sm rounded-lg transition-all ${filterTag === tag ? 'bg-[#6366f1] text-white' : isDark ? 'bg-[#27272a] text-[#a1a1aa] hover:bg-[#3f3f46]' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                      {tag.charAt(0).toUpperCase() + tag.slice(1)}
                    </button>
                  ))}
                </div>
                <div className="flex rounded-lg overflow-hidden border border-[#27272a]">
                  <button onClick={() => setViewMode('list')} className={`px-3 py-2 ${viewMode === 'list' ? 'bg-[#6366f1] text-white' : 'bg-[#27272a] text-[#a1a1aa]'}`}><List className="h-4 w-4" /></button>
                  <button onClick={() => setViewMode('board')} className={`px-3 py-2 ${viewMode === 'board' ? 'bg-[#6366f1] text-white' : 'bg-[#27272a] text-[#a1a1aa]'}`}><LayoutGrid className="h-4 w-4" /></button>
                </div>
              </div>
            </div>

            {/* Projects Overview */}
            {projects.length > 0 && (
              <div className="grid grid-cols-4 gap-4">
                {projects.slice(0, 4).map(p => (
                  <div key={p.project_id} className={`p-4 rounded-xl border cursor-pointer hover:border-[#6366f1] ${cardClass}`}>
                    <div className="flex items-start justify-between mb-2">
                      <h3 className={`font-semibold ${textClass}`}>{p.name}</h3>
                      <Badge className={p.tag === 'assigned' ? 'bg-blue-500/20 text-blue-400' : 'bg-green-500/20 text-green-400'}>{p.tag || 'Created'}</Badge>
                    </div>
                    <p className={`text-xs ${mutedClass}`}>{p.client_name}</p>
                    <p className={`text-xs mt-1 ${mutedClass}`}>Due: {p.deadline || '-'}</p>
                  </div>
                ))}
              </div>
            )}

            {/* List View */}
            {viewMode === 'list' && (
              <div className={`rounded-xl border overflow-hidden ${cardClass}`}>
                <table className="w-full">
                  <thead className={isDark ? 'bg-[#27272a]' : 'bg-gray-50'}>
                    <tr>
                      <th className={`p-3 text-left text-sm font-medium ${mutedClass}`}>Task Name</th>
                      <th className={`p-3 text-left text-sm font-medium ${mutedClass}`}>Project</th>
                      <th className={`p-3 text-left text-sm font-medium ${mutedClass}`}>Design Type</th>
                      <th className={`p-3 text-left text-sm font-medium ${mutedClass}`}>Design Content</th>
                      <th className={`p-3 text-left text-sm font-medium ${mutedClass}`}>Design File</th>
                      <th className={`p-3 text-left text-sm font-medium ${mutedClass}`}>Status</th>
                      <th className={`p-3 text-left text-sm font-medium ${mutedClass}`}>Final</th>
                      <th className={`p-3 text-center text-sm font-medium ${mutedClass}`}>Actions</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${isDark ? 'divide-[#27272a]' : 'divide-gray-100'}`}>
                    {filteredTasks.map(task => {
                      const project = projects.find(p => p.project_id === task.project_id);
                      const typeInfo = getDesignType(task.design_type);
                      const stages = task.stages || {};
                      return (
                        <tr key={task.task_id} className={isDark ? 'hover:bg-[#1f1f23]' : 'hover:bg-gray-50'}>
                          <td className="p-3">
                            <div className={`font-medium ${textClass}`}>{task.title}</div>
                            <div className={`text-xs ${mutedClass}`}>{task.design_size}</div>
                          </td>
                          <td className={`p-3 ${textClass}`}>{project?.name || '-'}</td>
                          <td className="p-3">
                            <Badge className="bg-purple-500/20 text-purple-400">
                              <Image className="h-3 w-3 mr-1" />
                              {typeInfo.name}
                            </Badge>
                          </td>
                          <td className="p-3">
                            <div className="space-y-1">
                              <Badge className={`text-[10px] ${STATUS_COLORS[stages.design_content?.status] || STATUS_COLORS['To-Do']}`}>
                                {stages.design_content?.status || 'To-Do'}
                              </Badge>
                              {stages.design_content?.link && (
                                <a href={stages.design_content.link} target="_blank" rel="noopener noreferrer" className="block text-[10px] text-[#6366f1]"><ExternalLink className="h-3 w-3 inline" /></a>
                              )}
                            </div>
                          </td>
                          <td className="p-3">
                            <div className="space-y-1">
                              <Badge className={`text-[10px] ${STATUS_COLORS[stages.design_file?.status] || STATUS_COLORS['To-Do']}`}>
                                {stages.design_file?.status || 'To-Do'}
                              </Badge>
                              {stages.design_file?.link && (
                                <a href={stages.design_file.link} target="_blank" rel="noopener noreferrer" className="block text-[10px] text-[#6366f1]"><ExternalLink className="h-3 w-3 inline" /></a>
                              )}
                            </div>
                          </td>
                          <td className="p-3">
                            <Select value={task.overall_status || 'To-Do'} onValueChange={v => handleUpdateTaskStatus(task.task_id, v)}>
                              <SelectTrigger className={`w-28 h-8 text-xs ${STATUS_COLORS[task.overall_status] || STATUS_COLORS['To-Do']}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="p-3">
                            <Badge className={`text-[10px] ${STATUS_COLORS[stages.final?.status] || STATUS_COLORS['To-Do']}`}>
                              {stages.final?.status === 'Completed' ? <CheckCircle className="h-3 w-3 mr-1" /> : <Circle className="h-3 w-3 mr-1" />}
                              {stages.final?.status || 'Pending'}
                            </Badge>
                          </td>
                          <td className="p-3">
                            <div className="flex justify-center gap-1">
                              <Button size="sm" variant="ghost" onClick={() => { setSelectedTask(task); setShowTaskDetail(true); }}>
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => handleDeleteTask(task.task_id)}>
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredTasks.length === 0 && (
                      <tr><td colSpan={8} className={`p-8 text-center ${mutedClass}`}>No tasks found. Add your first design task!</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Board View */}
            {viewMode === 'board' && (
              <div className="grid grid-cols-4 gap-4">
                {TASK_STAGES.map(stage => {
                  const stageTasks = filteredTasks.filter(t => {
                    const stages = t.stages || {};
                    return stages[stage.id]?.status === 'In Progress' || 
                           (stage.id === 'design_content' && (!stages.design_content?.status || stages.design_content?.status === 'To-Do'));
                  });
                  return (
                    <div key={stage.id} className={`rounded-xl border ${cardClass}`}>
                      <div className={`p-4 border-b ${isDark ? 'border-[#27272a]' : 'border-gray-200'}`}>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stage.color }} />
                          <h3 className={`font-semibold ${textClass}`}>{stage.name}</h3>
                          <Badge className={isDark ? 'bg-[#27272a] text-[#a1a1aa]' : 'bg-gray-100 text-gray-600'}>{stageTasks.length}</Badge>
                        </div>
                      </div>
                      <div className="p-3 space-y-2 min-h-[200px]">
                        {stageTasks.map(task => (
                          <div key={task.task_id} className={`p-3 rounded-lg border ${isDark ? 'bg-[#0f0f11] border-[#27272a]' : 'bg-gray-50 border-gray-200'}`}>
                            <div className="flex items-start justify-between mb-2">
                              <h4 className={`text-sm font-medium ${textClass}`}>{task.title}</h4>
                              <Badge className="text-[10px] bg-purple-500/20 text-purple-400">{getDesignType(task.design_type).name}</Badge>
                            </div>
                            <p className={`text-xs ${mutedClass}`}>{task.design_size}</p>
                            <div className="flex items-center justify-between mt-2">
                              <div className="w-5 h-5 rounded-full bg-[#6366f1] flex items-center justify-center text-[10px] text-white">
                                {task.stages?.[stage.id]?.assignee?.[0]?.toUpperCase() || 'U'}
                              </div>
                              <span className={`text-[10px] ${mutedClass}`}>{task.stages?.[stage.id]?.due_date}</span>
                            </div>
                          </div>
                        ))}
                        {stageTasks.length === 0 && <div className={`p-4 text-center text-xs ${mutedClass}`}>No tasks</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Add Project Modal */}
        <Dialog open={showAddProject} onOpenChange={setShowAddProject}>
          <DialogContent className={`max-w-md ${isDark ? 'bg-[#18181b] border-[#27272a]' : 'bg-white'}`}>
            <DialogHeader><DialogTitle className={textClass}>Create New Project</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <div><label className={`text-sm font-medium ${mutedClass}`}>Project Name</label><Input placeholder="e.g., Brand Campaign" value={projectForm.name} onChange={e => setProjectForm({ ...projectForm, name: e.target.value })} className={isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''} /></div>
              <div><label className={`text-sm font-medium ${mutedClass}`}>Client Name</label><Input value={projectForm.client_name} onChange={e => setProjectForm({ ...projectForm, client_name: e.target.value })} className={isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''} /></div>
              <div><label className={`text-sm font-medium ${mutedClass}`}>Deadline</label><Input type="date" value={projectForm.deadline} onChange={e => setProjectForm({ ...projectForm, deadline: e.target.value })} className={isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''} /></div>
              <div><label className={`text-sm font-medium ${mutedClass}`}>Assign To</label><Select value={projectForm.assigned_to} onValueChange={v => setProjectForm({ ...projectForm, assigned_to: v })}><SelectTrigger className={isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''}><SelectValue placeholder="Select..." /></SelectTrigger><SelectContent>{teamMembers.map(m => <SelectItem key={m.user_id} value={m.name}>{m.name}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setShowAddProject(false)}>Cancel</Button><Button onClick={handleAddProject} className="bg-[#6366f1] hover:bg-[#5855eb]">Create</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Task Modal */}
        <Dialog open={showAddTask} onOpenChange={setShowAddTask}>
          <DialogContent className={`max-w-2xl max-h-[90vh] overflow-y-auto ${isDark ? 'bg-[#18181b] border-[#27272a]' : 'bg-white'}`}>
            <DialogHeader>
              <DialogTitle className={textClass}>Add Design Task</DialogTitle>
              <DialogDescription className={mutedClass}>Create a new design task with stage-wise tracking</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div><label className={`text-sm font-medium ${mutedClass}`}>Task Name *</label><Input placeholder="e.g., Homepage Banner" value={taskForm.title} onChange={e => setTaskForm({ ...taskForm, title: e.target.value })} className={isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''} /></div>
                <div><label className={`text-sm font-medium ${mutedClass}`}>Project</label><Select value={taskForm.project_id} onValueChange={v => setTaskForm({ ...taskForm, project_id: v })}><SelectTrigger className={isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''}><SelectValue placeholder="Select..." /></SelectTrigger><SelectContent>{projects.map(p => <SelectItem key={p.project_id} value={p.project_id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div><label className={`text-sm font-medium ${mutedClass}`}>Design Type *</label><Select value={taskForm.design_type} onValueChange={v => setTaskForm({ ...taskForm, design_type: v, design_size: '' })}><SelectTrigger className={isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''}><SelectValue /></SelectTrigger><SelectContent>{designTypes.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent></Select></div>
                <div><label className={`text-sm font-medium ${mutedClass}`}>Size</label><Select value={taskForm.design_size} onValueChange={v => setTaskForm({ ...taskForm, design_size: v })}><SelectTrigger className={isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''}><SelectValue placeholder="Select size..." /></SelectTrigger><SelectContent>{getDesignType(taskForm.design_type).sizes.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
              </div>

              <div><label className={`text-sm font-medium ${mutedClass}`}>Description</label><Textarea placeholder="Design requirements..." value={taskForm.description} onChange={e => setTaskForm({ ...taskForm, description: e.target.value })} className={isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''} /></div>

              {/* Stage Details */}
              <div className={`p-4 rounded-lg ${isDark ? 'bg-[#0f0f11]' : 'bg-gray-50'}`}>
                <h4 className={`font-semibold mb-4 ${textClass}`}>Stage Details</h4>
                {TASK_STAGES.map(stage => (
                  <div key={stage.id} className={`p-3 rounded-lg mb-3 border ${isDark ? 'bg-[#18181b] border-[#27272a]' : 'bg-white border-gray-200'}`}>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stage.color }} />
                      <span className={`font-medium ${textClass}`}>{stage.name}</span>
                    </div>
                    <div className="grid grid-cols-4 gap-3">
                      <div><label className={`text-xs ${mutedClass}`}>Due Date</label><Input type="date" value={taskForm[stage.id]?.due_date || ''} onChange={e => setTaskForm({ ...taskForm, [stage.id]: { ...taskForm[stage.id], due_date: e.target.value }})} className={`h-8 text-sm ${isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''}`} /></div>
                      <div><label className={`text-xs ${mutedClass}`}>Assignee</label><Select value={taskForm[stage.id]?.assignee || ''} onValueChange={v => setTaskForm({ ...taskForm, [stage.id]: { ...taskForm[stage.id], assignee: v }})}><SelectTrigger className={`h-8 text-sm ${isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''}`}><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{teamMembers.map(m => <SelectItem key={m.user_id} value={m.name}>{m.name}</SelectItem>)}</SelectContent></Select></div>
                      <div><label className={`text-xs ${mutedClass}`}>Link</label><Input placeholder="https://..." value={taskForm[stage.id]?.link || ''} onChange={e => setTaskForm({ ...taskForm, [stage.id]: { ...taskForm[stage.id], link: e.target.value }})} className={`h-8 text-sm ${isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''}`} /></div>
                      <div><label className={`text-xs ${mutedClass}`}>Status</label><Select value={taskForm[stage.id]?.status || 'To-Do'} onValueChange={v => setTaskForm({ ...taskForm, [stage.id]: { ...taskForm[stage.id], status: v }})}><SelectTrigger className={`h-8 text-sm ${isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''}`}><SelectValue /></SelectTrigger><SelectContent>{STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setShowAddTask(false)}>Cancel</Button><Button onClick={handleAddTask} className="bg-[#6366f1] hover:bg-[#5855eb]">Add Task</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Design Type Modal */}
        <Dialog open={showAddDesignType} onOpenChange={setShowAddDesignType}>
          <DialogContent className={`max-w-md ${isDark ? 'bg-[#18181b] border-[#27272a]' : 'bg-white'}`}>
            <DialogHeader>
              <DialogTitle className={textClass}>Manage Design Types</DialogTitle>
              <DialogDescription className={mutedClass}>Add custom design types with sizes</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {designTypes.map(t => (
                  <div key={t.id} className={`p-2 rounded-lg flex items-center justify-between ${isDark ? 'bg-[#27272a]' : 'bg-gray-50'}`}>
                    <div>
                      <span className={textClass}>{t.name}</span>
                      <span className={`text-xs ml-2 ${mutedClass}`}>({t.sizes.join(', ')})</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className={`p-4 rounded-lg border-2 border-dashed ${isDark ? 'border-[#3f3f46]' : 'border-gray-200'}`}>
                <h5 className={`text-sm font-medium mb-3 ${textClass}`}>Add New Type</h5>
                <div className="space-y-3">
                  <Input placeholder="Type name (e.g., Flyer)" value={newDesignType.name} onChange={e => setNewDesignType({ ...newDesignType, name: e.target.value })} className={isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''} />
                  <Input placeholder="Sizes (comma separated, e.g., A4, A5, DL)" value={newDesignType.sizes} onChange={e => setNewDesignType({ ...newDesignType, sizes: e.target.value })} className={isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''} />
                  <Button onClick={handleAddDesignType} className="w-full bg-[#6366f1] hover:bg-[#5855eb]"><Plus className="h-4 w-4 mr-2" /> Add Type</Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Task Detail Modal */}
        <Dialog open={showTaskDetail} onOpenChange={setShowTaskDetail}>
          <DialogContent className={`max-w-2xl ${isDark ? 'bg-[#18181b] border-[#27272a]' : 'bg-white'}`}>
            <DialogHeader>
              <DialogTitle className={textClass}>{selectedTask?.title}</DialogTitle>
              <DialogDescription className={mutedClass}>
                {getDesignType(selectedTask?.design_type).name} - {selectedTask?.design_size}
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              {selectedTask && (
                <div className="space-y-4">
                  {TASK_STAGES.map(stage => {
                    const stageData = selectedTask.stages?.[stage.id] || {};
                    return (
                      <div key={stage.id} className={`p-4 rounded-lg border ${isDark ? 'border-[#27272a]' : 'border-gray-200'}`}>
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stage.color }} />
                            <span className={`font-medium ${textClass}`}>{stage.name}</span>
                          </div>
                          <Select value={stageData.status || 'To-Do'} onValueChange={v => handleUpdateStageStatus(selectedTask.task_id, stage.id, v)}>
                            <SelectTrigger className={`w-32 h-8 text-xs ${STATUS_COLORS[stageData.status] || STATUS_COLORS['To-Do']}`}><SelectValue /></SelectTrigger>
                            <SelectContent>{STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div><span className={mutedClass}>Due:</span> <span className={textClass}>{stageData.due_date || '-'}</span></div>
                          <div><span className={mutedClass}>Assignee:</span> <span className={textClass}>{stageData.assignee || '-'}</span></div>
                          <div><span className={mutedClass}>Link:</span> {stageData.link ? <a href={stageData.link} target="_blank" rel="noopener noreferrer" className="text-[#6366f1]">View</a> : <span className={textClass}>-</span>}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default CreativeDesignBoard;
