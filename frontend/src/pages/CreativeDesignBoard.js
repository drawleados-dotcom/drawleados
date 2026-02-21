import React, { useState, useEffect, useCallback } from 'react';
import Layout from '../components/Layout';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Progress } from '../components/ui/progress';
import { useTheme } from '../contexts/ThemeContext';
import {
  Plus, Search, ExternalLink, Palette, FileSearch, PenTool, FileText,
  FolderOpen, LayoutGrid, List, Tag
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

const DESIGN_STAGES = [
  { id: 'research', name: 'Research', icon: FileSearch, color: '#f59e0b' },
  { id: 'wireframe', name: 'Wireframe', icon: PenTool, color: '#8b5cf6' },
  { id: 'design', name: 'Design', icon: Palette, color: '#ec4899' },
  { id: 'design_file', name: 'Design File', icon: FileText, color: '#22c55e' },
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

  const [viewMode, setViewMode] = useState('board');
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTag, setFilterTag] = useState('all');
  const [showAddProject, setShowAddProject] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);

  const [projectForm, setProjectForm] = useState({ name: '', description: '', client_name: '', deadline: '', assigned_to: '' });
  const [taskForm, setTaskForm] = useState({ title: '', description: '', project_id: '', stage: 'research', assigned_to: '', due_date: '', status: 'To-Do', link: '' });

  const loadData = useCallback(async () => {
    try {
      const [projRes, taskRes, userRes] = await Promise.all([
        axios.get(`${API}/api/creative/projects`, { headers }).catch(() => ({ data: [] })),
        axios.get(`${API}/api/creative/tasks`, { headers }).catch(() => ({ data: [] })),
        axios.get(`${API}/api/users`, { headers }).catch(() => ({ data: [] })),
      ]);
      setProjects(projRes.data || []);
      setTasks(taskRes.data || []);
      setTeamMembers(userRes.data || []);
    } catch (error) { console.error('Error:', error); }
  }, [token]);

  useEffect(() => { loadData(); }, [loadData]);

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
      await axios.post(`${API}/api/creative/tasks`, taskForm, { headers });
      toast.success('Task created');
      setShowAddTask(false);
      setTaskForm({ title: '', description: '', project_id: '', stage: 'research', assigned_to: '', due_date: '', status: 'To-Do', link: '' });
      loadData();
    } catch (error) { toast.error('Failed'); }
  };

  const handleUpdateTaskStatus = async (taskId, newStatus) => {
    try { await axios.put(`${API}/api/creative/tasks/${taskId}`, { status: newStatus }, { headers }); loadData(); } catch (error) { toast.error('Failed'); }
  };

  const getProjectProgress = (projectId) => {
    const pt = tasks.filter(t => t.project_id === projectId);
    if (pt.length === 0) return 0;
    return Math.round((pt.filter(t => t.status === 'Completed').length / pt.length) * 100);
  };

  const filteredTasks = tasks.filter(task => {
    if (searchTerm && !task.title?.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    if (filterTag === 'assigned' && task.tag !== 'assigned') return false;
    if (filterTag === 'created' && task.tag !== 'created') return false;
    return true;
  });

  const getTasksByStage = (stage) => filteredTasks.filter(t => t.stage === stage);
  const cardClass = isDark ? 'bg-[#18181b] border-[#27272a]' : 'bg-white border-gray-200';
  const textClass = isDark ? 'text-[#fafafa]' : 'text-gray-900';
  const mutedClass = isDark ? 'text-[#a1a1aa]' : 'text-gray-500';

  return (
    <Layout>
      <div className="space-y-6" data-testid="creative-board">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-[#ec4899] to-[#6366f1] bg-clip-text text-transparent">Creative Design Board</h1>
            <p className={mutedClass}>4 Stages: Research → Wireframe → Design → Design File</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex rounded-lg overflow-hidden border border-[#27272a]">
              <button onClick={() => setViewMode('board')} className={`px-3 py-2 ${viewMode === 'board' ? 'bg-[#6366f1] text-white' : 'bg-[#27272a] text-[#a1a1aa]'}`}><LayoutGrid className="h-4 w-4" /></button>
              <button onClick={() => setViewMode('list')} className={`px-3 py-2 ${viewMode === 'list' ? 'bg-[#6366f1] text-white' : 'bg-[#27272a] text-[#a1a1aa]'}`}><List className="h-4 w-4" /></button>
            </div>
            <Button variant="outline" onClick={() => setShowAddTask(true)} className="border-[#3f3f46]"><Plus className="h-4 w-4 mr-2" /> Add Task</Button>
            <Button onClick={() => setShowAddProject(true)} className="bg-[#6366f1] hover:bg-[#5855eb]"><Plus className="h-4 w-4 mr-2" /> New Project</Button>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4">
          {projects.slice(0, 4).map(p => (
            <div key={p.project_id} className={`p-4 rounded-xl border cursor-pointer hover:border-[#6366f1] ${cardClass}`}>
              <div className="flex items-start justify-between mb-3">
                <div><h3 className={`font-semibold ${textClass}`}>{p.name}</h3><p className={`text-xs ${mutedClass}`}>{p.client_name}</p></div>
                <Badge className={p.tag === 'assigned' ? 'bg-blue-500/20 text-blue-400' : 'bg-green-500/20 text-green-400'}>{p.tag || 'Created'}</Badge>
              </div>
              <Progress value={getProjectProgress(p.project_id)} className="h-2 mb-2" />
              <div className="flex justify-between text-xs"><span className={mutedClass}>{getProjectProgress(p.project_id)}%</span><span className={mutedClass}>{p.deadline}</span></div>
            </div>
          ))}
          {projects.length === 0 && <div className={`col-span-4 p-8 text-center rounded-xl border ${cardClass}`}><FolderOpen className={`h-12 w-12 mx-auto mb-3 ${mutedClass}`} /><p className={mutedClass}>No projects yet. Create your first project!</p></div>}
        </div>

        <div className={`p-4 rounded-xl border ${cardClass}`}>
          <div className="flex items-center gap-4">
            <div className="flex-1 relative"><Search className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ${mutedClass}`} /><Input placeholder="Search tasks..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className={`pl-10 ${isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''}`} /></div>
            <div className="flex gap-1">{['all', 'assigned', 'created'].map(tag => (<button key={tag} onClick={() => setFilterTag(tag)} className={`px-3 py-1.5 text-sm rounded-lg transition-all ${filterTag === tag ? 'bg-[#6366f1] text-white' : isDark ? 'bg-[#27272a] text-[#a1a1aa] hover:bg-[#3f3f46]' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{tag.charAt(0).toUpperCase() + tag.slice(1)}</button>))}</div>
          </div>
        </div>

        {viewMode === 'board' && (
          <div className="grid grid-cols-4 gap-4">
            {DESIGN_STAGES.map(stage => {
              const Icon = stage.icon;
              const stageTasks = getTasksByStage(stage.id);
              return (
                <div key={stage.id} className={`rounded-xl border ${cardClass}`}>
                  <div className={`p-4 border-b ${isDark ? 'border-[#27272a]' : 'border-gray-200'}`}>
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-lg" style={{ backgroundColor: stage.color + '20' }}><Icon className="h-4 w-4" style={{ color: stage.color }} /></div>
                      <h3 className={`font-semibold ${textClass}`}>{stage.name}</h3>
                      <Badge className={isDark ? 'bg-[#27272a] text-[#a1a1aa]' : 'bg-gray-100 text-gray-600'}>{stageTasks.length}</Badge>
                    </div>
                  </div>
                  <div className="p-3 space-y-2 min-h-[300px]">
                    {stageTasks.map(task => (
                      <div key={task.task_id} className={`p-3 rounded-lg border transition-all hover:border-[#6366f1] ${isDark ? 'bg-[#0f0f11] border-[#27272a]' : 'bg-gray-50 border-gray-200'}`}>
                        <div className="flex items-start justify-between mb-2">
                          <h4 className={`text-sm font-medium ${textClass}`}>{task.title}</h4>
                          <Select value={task.status} onValueChange={v => handleUpdateTaskStatus(task.task_id, v)}>
                            <SelectTrigger className={`w-24 h-6 text-[10px] ${STATUS_COLORS[task.status]}`}><SelectValue /></SelectTrigger>
                            <SelectContent>{STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <p className={`text-xs mb-2 line-clamp-2 ${mutedClass}`}>{task.description}</p>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-5 h-5 rounded-full bg-[#6366f1] flex items-center justify-center text-[10px] text-white">{task.assigned_to?.[0]?.toUpperCase() || 'U'}</div>
                            {task.link && <a href={task.link} target="_blank" rel="noopener noreferrer" className="text-[#6366f1]"><ExternalLink className="h-3 w-3" /></a>}
                          </div>
                          <span className={`text-[10px] ${mutedClass}`}>{task.due_date}</span>
                        </div>
                        {task.tag && <Badge className={`mt-2 text-[10px] ${task.tag === 'assigned' ? 'bg-blue-500/20 text-blue-400' : 'bg-green-500/20 text-green-400'}`}><Tag className="h-2 w-2 mr-1" />{task.tag}</Badge>}
                      </div>
                    ))}
                    {stageTasks.length === 0 && <div className={`p-4 text-center text-xs ${mutedClass}`}>No tasks</div>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {viewMode === 'list' && (
          <div className={`rounded-xl border overflow-hidden ${cardClass}`}>
            <table className="w-full">
              <thead className={isDark ? 'bg-[#27272a]' : 'bg-gray-50'}>
                <tr>
                  <th className={`p-3 text-left text-sm font-medium ${mutedClass}`}>Task</th>
                  <th className={`p-3 text-left text-sm font-medium ${mutedClass}`}>Project</th>
                  <th className={`p-3 text-left text-sm font-medium ${mutedClass}`}>Stage</th>
                  <th className={`p-3 text-left text-sm font-medium ${mutedClass}`}>Assignee</th>
                  <th className={`p-3 text-left text-sm font-medium ${mutedClass}`}>Due Date</th>
                  <th className={`p-3 text-left text-sm font-medium ${mutedClass}`}>Link</th>
                  <th className={`p-3 text-left text-sm font-medium ${mutedClass}`}>Status</th>
                  <th className={`p-3 text-left text-sm font-medium ${mutedClass}`}>Tag</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDark ? 'divide-[#27272a]' : 'divide-gray-100'}`}>
                {filteredTasks.map(task => {
                  const stage = DESIGN_STAGES.find(s => s.id === task.stage);
                  const StageIcon = stage?.icon || FileText;
                  const project = projects.find(p => p.project_id === task.project_id);
                  return (
                    <tr key={task.task_id} className={isDark ? 'hover:bg-[#1f1f23]' : 'hover:bg-gray-50'}>
                      <td className="p-3"><div className={`font-medium ${textClass}`}>{task.title}</div><div className={`text-xs ${mutedClass}`}>{task.description?.slice(0, 40)}</div></td>
                      <td className={`p-3 ${textClass}`}>{project?.name || '-'}</td>
                      <td className="p-3"><Badge style={{ backgroundColor: stage?.color + '20', color: stage?.color }}><StageIcon className="h-3 w-3 mr-1" />{stage?.name}</Badge></td>
                      <td className="p-3"><div className="flex items-center gap-2"><div className="w-6 h-6 rounded-full bg-[#6366f1] flex items-center justify-center text-xs text-white">{task.assigned_to?.[0]?.toUpperCase() || 'U'}</div><span className={`text-sm ${textClass}`}>{task.assigned_to || 'Unassigned'}</span></div></td>
                      <td className={`p-3 ${textClass}`}>{task.due_date}</td>
                      <td className="p-3">{task.link ? <a href={task.link} target="_blank" rel="noopener noreferrer" className="text-[#6366f1] hover:underline flex items-center gap-1"><ExternalLink className="h-3 w-3" /> View</a> : <span className={mutedClass}>-</span>}</td>
                      <td className="p-3"><Select value={task.status} onValueChange={v => handleUpdateTaskStatus(task.task_id, v)}><SelectTrigger className={`w-28 h-8 text-xs ${STATUS_COLORS[task.status]}`}><SelectValue /></SelectTrigger><SelectContent>{STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></td>
                      <td className="p-3"><Badge className={task.tag === 'assigned' ? 'bg-blue-500/20 text-blue-400' : 'bg-green-500/20 text-green-400'}>{task.tag || 'Created'}</Badge></td>
                    </tr>
                  );
                })}
                {filteredTasks.length === 0 && <tr><td colSpan={8} className={`p-8 text-center ${mutedClass}`}>No tasks found</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        <Dialog open={showAddProject} onOpenChange={setShowAddProject}>
          <DialogContent className={`max-w-md ${isDark ? 'bg-[#18181b] border-[#27272a]' : 'bg-white'}`}>
            <DialogHeader><DialogTitle className={textClass}>Create New Project</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <div><label className={`text-sm font-medium ${mutedClass}`}>Project Name</label><Input placeholder="e.g., Brand Redesign" value={projectForm.name} onChange={e => setProjectForm({ ...projectForm, name: e.target.value })} className={isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''} /></div>
              <div><label className={`text-sm font-medium ${mutedClass}`}>Client Name</label><Input placeholder="Client or company" value={projectForm.client_name} onChange={e => setProjectForm({ ...projectForm, client_name: e.target.value })} className={isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''} /></div>
              <div><label className={`text-sm font-medium ${mutedClass}`}>Deadline</label><Input type="date" value={projectForm.deadline} onChange={e => setProjectForm({ ...projectForm, deadline: e.target.value })} className={isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''} /></div>
              <div><label className={`text-sm font-medium ${mutedClass}`}>Assign To</label><Select value={projectForm.assigned_to} onValueChange={v => setProjectForm({ ...projectForm, assigned_to: v })}><SelectTrigger className={isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''}><SelectValue placeholder="Select..." /></SelectTrigger><SelectContent>{teamMembers.map(m => <SelectItem key={m.user_id} value={m.name}>{m.name}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setShowAddProject(false)}>Cancel</Button><Button onClick={handleAddProject} className="bg-[#6366f1] hover:bg-[#5855eb]">Create Project</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showAddTask} onOpenChange={setShowAddTask}>
          <DialogContent className={`max-w-md ${isDark ? 'bg-[#18181b] border-[#27272a]' : 'bg-white'}`}>
            <DialogHeader><DialogTitle className={textClass}>Add New Task</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <div><label className={`text-sm font-medium ${mutedClass}`}>Task Title</label><Input placeholder="e.g., Create Logo Variations" value={taskForm.title} onChange={e => setTaskForm({ ...taskForm, title: e.target.value })} className={isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''} /></div>
              <div><label className={`text-sm font-medium ${mutedClass}`}>Project</label><Select value={taskForm.project_id} onValueChange={v => setTaskForm({ ...taskForm, project_id: v })}><SelectTrigger className={isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''}><SelectValue placeholder="Select project..." /></SelectTrigger><SelectContent>{projects.map(p => <SelectItem key={p.project_id} value={p.project_id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
              <div><label className={`text-sm font-medium ${mutedClass}`}>Stage</label><Select value={taskForm.stage} onValueChange={v => setTaskForm({ ...taskForm, stage: v })}><SelectTrigger className={isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''}><SelectValue /></SelectTrigger><SelectContent>{DESIGN_STAGES.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className={`text-sm font-medium ${mutedClass}`}>Assignee</label><Select value={taskForm.assigned_to} onValueChange={v => setTaskForm({ ...taskForm, assigned_to: v })}><SelectTrigger className={isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''}><SelectValue placeholder="Select..." /></SelectTrigger><SelectContent>{teamMembers.map(m => <SelectItem key={m.user_id} value={m.name}>{m.name}</SelectItem>)}</SelectContent></Select></div>
                <div><label className={`text-sm font-medium ${mutedClass}`}>Due Date</label><Input type="date" value={taskForm.due_date} onChange={e => setTaskForm({ ...taskForm, due_date: e.target.value })} className={isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''} /></div>
              </div>
              <div><label className={`text-sm font-medium ${mutedClass}`}>Link (Optional)</label><Input placeholder="https://..." value={taskForm.link} onChange={e => setTaskForm({ ...taskForm, link: e.target.value })} className={isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''} /></div>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setShowAddTask(false)}>Cancel</Button><Button onClick={handleAddTask} className="bg-[#6366f1] hover:bg-[#5855eb]">Add Task</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default CreativeDesignBoard;
