import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Plus, Briefcase, X, Calendar, Users, ListChecks, Check, ExternalLink } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';

const API = process.env.REACT_APP_BACKEND_URL;

export default function ProjectsPanel({
  isDark, textPrimary, textSecondary, bgCard, bgSecondary, borderColor, headers, onTaskCreated,
}) {
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null); // project being viewed
  const [showAddTask, setShowAddTask] = useState(false);

  const [projectDraft, setProjectDraft] = useState({ name: '', description: '', due_date: '' });
  const [taskDraft, setTaskDraft] = useState({ task_name: '', description: '', assigned_to: '', due_date: '', priority: 'medium', work_link: '' });

  const loadProjects = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API}/api/projects`, { headers });
      setProjects(res.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [headers]);

  const loadUsers = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/users/basic`, { headers });
      setUsers(res.data || []);
    } catch (e) {
      console.error(e);
    }
  }, [headers]);

  useEffect(() => { loadProjects(); loadUsers(); }, [loadProjects, loadUsers]);

  const handleCreateProject = async () => {
    if (!projectDraft.name.trim()) { toast.error('Project name is required'); return; }
    try {
      await axios.post(`${API}/api/projects`, projectDraft, { headers });
      toast.success('Project created');
      setProjectDraft({ name: '', description: '', due_date: '' });
      setShowCreateProject(false);
      loadProjects();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to create project');
    }
  };

  const refreshSelectedProject = async () => {
    if (!selectedProject) return;
    try {
      const res = await axios.get(`${API}/api/projects/${selectedProject.project_id}`, { headers });
      setSelectedProject(res.data);
    } catch { /* ignore */ }
  };

  const handleAddTask = async () => {
    if (!selectedProject) return;
    if (!taskDraft.task_name.trim()) { toast.error('Task name is required'); return; }
    if (!taskDraft.assigned_to) { toast.error('Please assign to a user'); return; }
    try {
      await axios.post(`${API}/api/projects/${selectedProject.project_id}/tasks`, taskDraft, { headers });
      toast.success('Task added — appears in assignee\'s My Tasks');
      setTaskDraft({ task_name: '', description: '', assigned_to: '', due_date: '', priority: 'medium', work_link: '' });
      setShowAddTask(false);
      refreshSelectedProject();
      loadProjects();
      if (onTaskCreated) onTaskCreated();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to add task');
    }
  };

  const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString() : '—');

  // ---------- Project Detail View ----------
  if (selectedProject) {
    return (
      <div className="space-y-4" data-testid="project-detail-view">
        <div className="flex items-center justify-between">
          <div>
            <button onClick={() => setSelectedProject(null)} className={`text-sm ${textSecondary} hover:underline mb-1`}>
              ← Back to Projects
            </button>
            <h2 className={`text-2xl font-bold ${textPrimary}`}>{selectedProject.name}</h2>
            <p className={textSecondary}>{selectedProject.description}</p>
          </div>
          <Button onClick={() => setShowAddTask(true)} className="bg-[#6366f1] hover:bg-[#4f46e5] text-white">
            <Plus className="h-4 w-4 mr-1" /> Add Task
          </Button>
        </div>

        <Card className={`${bgCard} border ${borderColor}`}>
          <CardContent className="p-4">
            <div className="flex items-center gap-6 text-sm">
              <div className="flex items-center gap-2"><Calendar className={`h-4 w-4 ${textSecondary}`} /><span className={textPrimary}>Due: {fmtDate(selectedProject.due_date)}</span></div>
              <div className="flex items-center gap-2"><ListChecks className={`h-4 w-4 ${textSecondary}`} /><span className={textPrimary}>{selectedProject.tasks?.length || 0} tasks</span></div>
              <Badge className="bg-[#10b981]/20 text-[#10b981]">{selectedProject.status || 'active'}</Badge>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-2">
          <h3 className={`text-base font-semibold ${textPrimary}`}>Tasks</h3>
          {(selectedProject.tasks || []).length === 0 ? (
            <p className={`text-sm ${textSecondary}`}>No tasks yet. Click &quot;Add Task&quot; to create one.</p>
          ) : (
            (selectedProject.tasks || []).map(task => {
              const user = users.find(u => u.user_id === task.assigned_to);
              return (
                <Card key={task.task_id} className={`${bgCard} border ${borderColor}`} data-testid={`project-task-${task.task_id}`}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`font-medium ${textPrimary}`}>{task.task_name}</span>
                        <Badge className={
                          task.status === 'completed' ? 'bg-[#10b981]/20 text-[#10b981]' :
                          task.status === 'in_progress' ? 'bg-[#3b82f6]/20 text-[#3b82f6]' :
                          'bg-[#71717a]/20 text-[#71717a]'
                        }>{task.status?.replace('_', ' ') || 'pending'}</Badge>
                      </div>
                      <p className={`text-xs ${textSecondary} mt-1`}>
                        Assigned to <span className={textPrimary}>{user?.name || task.assigned_to}</span>
                        {task.due_date && <> · Due {fmtDate(task.due_date)}</>}
                      </p>
                    </div>
                    {task.work_link && (
                      <a href={task.work_link} target="_blank" rel="noopener noreferrer" className="text-[#6366f1] text-sm hover:underline flex items-center gap-1">
                        <ExternalLink className="h-3 w-3" /> Link
                      </a>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* Add Task Modal */}
        {showAddTask && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[70]" onClick={() => setShowAddTask(false)}>
            <Card className={`${bgCard} border ${borderColor} w-full max-w-lg mx-4`} onClick={(e) => e.stopPropagation()}>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className={`text-lg font-semibold ${textPrimary}`}>Add Task to {selectedProject.name}</h3>
                  <button onClick={() => setShowAddTask(false)} className={textSecondary}><X className="h-5 w-5" /></button>
                </div>
                <div><Label className={textPrimary}>Task Name *</Label><Input value={taskDraft.task_name} onChange={(e) => setTaskDraft({ ...taskDraft, task_name: e.target.value })} placeholder="Task name" data-testid="project-task-name" /></div>
                <div><Label className={textPrimary}>Description</Label><Input value={taskDraft.description} onChange={(e) => setTaskDraft({ ...taskDraft, description: e.target.value })} placeholder="Optional description" /></div>
                <div>
                  <Label className={textPrimary}>Assign To *</Label>
                  <select
                    value={taskDraft.assigned_to}
                    onChange={(e) => setTaskDraft({ ...taskDraft, assigned_to: e.target.value })}
                    className={`w-full px-3 py-2 rounded-lg border ${borderColor} ${bgSecondary} ${textPrimary}`}
                    data-testid="project-task-assignee"
                  >
                    <option value="">— Select user —</option>
                    {users.map(u => <option key={u.user_id} value={u.user_id}>{u.name} ({u.email})</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className={textPrimary}>Due Date</Label><Input type="date" value={taskDraft.due_date} onChange={(e) => setTaskDraft({ ...taskDraft, due_date: e.target.value })} /></div>
                  <div>
                    <Label className={textPrimary}>Priority</Label>
                    <select value={taskDraft.priority} onChange={(e) => setTaskDraft({ ...taskDraft, priority: e.target.value })} className={`w-full px-3 py-2 rounded-lg border ${borderColor} ${bgSecondary} ${textPrimary}`}>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                </div>
                <div><Label className={textPrimary}>Work Link</Label><Input value={taskDraft.work_link} onChange={(e) => setTaskDraft({ ...taskDraft, work_link: e.target.value })} placeholder="https://..." /></div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="ghost" onClick={() => setShowAddTask(false)}>Cancel</Button>
                  <Button onClick={handleAddTask} className="bg-[#10b981] hover:bg-[#059669] text-white" data-testid="project-task-save">
                    <Check className="h-3 w-3 mr-1" /> Add Task
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    );
  }

  // ---------- Project List View ----------
  return (
    <div className="space-y-4" data-testid="projects-panel">
      <div className="flex items-center justify-between">
        <h2 className={`text-xl font-semibold ${textPrimary}`}>Projects</h2>
        <Button onClick={() => setShowCreateProject(true)} className="bg-[#6366f1] hover:bg-[#4f46e5] text-white" data-testid="create-project-btn">
          <Plus className="h-4 w-4 mr-1" /> Create Project
        </Button>
      </div>

      {loading ? (
        <p className={textSecondary}>Loading...</p>
      ) : projects.length === 0 ? (
        <Card className={`${bgCard} border ${borderColor}`}>
          <CardContent className="p-12 text-center">
            <Briefcase className={`h-12 w-12 mx-auto mb-3 ${textSecondary}`} />
            <p className={textPrimary}>No projects yet</p>
            <p className={`text-sm ${textSecondary}`}>Create your first project to organise tasks</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map(p => (
            <Card
              key={p.project_id}
              className={`${bgCard} border ${borderColor} cursor-pointer hover:border-[#6366f1] transition-colors`}
              onClick={() => setSelectedProject(p)}
              data-testid={`project-card-${p.project_id}`}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-2">
                  <h3 className={`font-semibold ${textPrimary}`}>{p.name}</h3>
                  <Badge className="bg-[#10b981]/20 text-[#10b981]">{p.status || 'active'}</Badge>
                </div>
                <p className={`text-sm ${textSecondary} line-clamp-2 mb-3`}>{p.description || 'No description'}</p>
                <div className={`flex items-center gap-4 text-xs ${textSecondary}`}>
                  <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{fmtDate(p.due_date)}</span>
                  <span className="flex items-center gap-1"><ListChecks className="h-3 w-3" />{p.task_count || 0} tasks</span>
                  <span className="flex items-center gap-1"><Users className="h-3 w-3" />{p.members?.length || 0}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Project Modal */}
      {showCreateProject && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[70]" onClick={() => setShowCreateProject(false)}>
          <Card className={`${bgCard} border ${borderColor} w-full max-w-lg mx-4`} onClick={(e) => e.stopPropagation()}>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className={`text-lg font-semibold ${textPrimary}`}>Create Project</h3>
                <button onClick={() => setShowCreateProject(false)} className={textSecondary}><X className="h-5 w-5" /></button>
              </div>
              <div><Label className={textPrimary}>Project Name *</Label><Input value={projectDraft.name} onChange={(e) => setProjectDraft({ ...projectDraft, name: e.target.value })} placeholder="e.g. Website Revamp" data-testid="project-name-input" /></div>
              <div><Label className={textPrimary}>Description</Label><Input value={projectDraft.description} onChange={(e) => setProjectDraft({ ...projectDraft, description: e.target.value })} placeholder="What is this project about?" /></div>
              <div><Label className={textPrimary}>Due Date</Label><Input type="date" value={projectDraft.due_date} onChange={(e) => setProjectDraft({ ...projectDraft, due_date: e.target.value })} /></div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={() => setShowCreateProject(false)}>Cancel</Button>
                <Button onClick={handleCreateProject} className="bg-[#6366f1] hover:bg-[#4f46e5] text-white" data-testid="project-save-btn">
                  <Check className="h-3 w-3 mr-1" /> Create
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
