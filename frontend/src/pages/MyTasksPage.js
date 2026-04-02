import React, { useState, useEffect, useCallback } from 'react';
import Layout from '../components/Layout';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import {
  Plus, Calendar, Clock, User, CheckCircle2, Circle, 
  Trash2, Edit2, X, Briefcase,
  Play, Pause, Square, Timer, Eye, Link as LinkIcon, Filter,
  Search, Repeat
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

const priorityColors = {
  high: 'bg-[#ef4444]/20 text-[#ef4444] border-[#ef4444]',
  medium: 'bg-[#f59e0b]/20 text-[#f59e0b] border-[#f59e0b]',
  low: 'bg-[#71717a]/20 text-[#71717a] border-[#71717a]'
};

const statusColors = {
  'pending': { bg: 'bg-[#71717a]/20', text: 'text-[#71717a]', label: 'Pending' },
  'in_progress': { bg: 'bg-[#3b82f6]/20', text: 'text-[#3b82f6]', label: 'In Progress' },
  'completed': { bg: 'bg-[#10b981]/20', text: 'text-[#10b981]', label: 'Completed' },
  'on_hold': { bg: 'bg-[#f59e0b]/20', text: 'text-[#f59e0b]', label: 'On Hold' }
};

export default function MyTasksPage() {
  const { isDark } = useTheme();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  
  // Filters
  const [quickFilter, setQuickFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(true);
  const [filters, setFilters] = useState({
    dateFilter: 'all',
    taskType: 'all',
    status: 'all',
    priority: 'all'
  });
  
  const token = localStorage.getItem('session_token');
  const headers = { Authorization: `Bearer ${token}` };

  // Theme classes
  const bgPage = isDark ? 'bg-[#09090b]' : 'bg-gray-50';
  const bgCard = isDark ? 'bg-[#18181b]' : 'bg-white';
  const bgSecondary = isDark ? 'bg-[#27272a]' : 'bg-gray-100';
  const textPrimary = isDark ? 'text-[#fafafa]' : 'text-gray-900';
  const textSecondary = isDark ? 'text-[#a1a1aa]' : 'text-gray-600';
  const borderColor = isDark ? 'border-[#27272a]' : 'border-gray-200';

  // Load tasks assigned to current user
  const loadMyTasks = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/departments/my-tasks`, { headers });
      setTasks(res.data);
    } catch (error) {
      console.error('Error loading tasks:', error);
    }
    setLoading(false);
  }, []);

  // Load users
  const loadUsers = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/users/basic`, { headers });
      setUsers(res.data);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  }, []);

  useEffect(() => {
    loadMyTasks();
    loadUsers();
  }, [loadMyTasks, loadUsers]);

  // Filter tasks
  const filteredTasks = tasks.filter(task => {
    if (quickFilter === 'pending' && task.status !== 'pending') return false;
    if (quickFilter === 'in_progress' && task.status !== 'in_progress') return false;
    if (quickFilter === 'completed' && task.status !== 'completed') return false;
    
    if (filters.taskType !== 'all' && task.type !== filters.taskType) return false;
    if (filters.status !== 'all' && task.status !== filters.status) return false;
    if (filters.priority !== 'all' && task.priority !== filters.priority) return false;
    
    return true;
  });

  // Stats
  const stats = {
    total: tasks.length,
    pending: tasks.filter(t => t.status === 'pending').length,
    in_progress: tasks.filter(t => t.status === 'in_progress').length,
    completed: tasks.filter(t => t.status === 'completed').length
  };

  // Format duration
  const formatDuration = (seconds) => {
    if (!seconds) return '0s';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hrs > 0) return `${hrs}h ${mins}m`;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  };

  // Format date
  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  // Time tracking
  const handleTimeTracking = async (task, action) => {
    try {
      await axios.post(`${API}/api/departments/projects/${task.project_id}/tasks/${task.task_id}/time-tracking`, { action }, { headers });
      toast.success(`Timer ${action}ed`);
      loadMyTasks();
    } catch (error) {
      toast.error(error.response?.data?.detail || `Failed to ${action} timer`);
    }
  };

  // Get timer button
  const getTimerButton = (task) => {
    const tracking = task.time_tracking || { status: 'not_started' };
    const status = tracking.status;
    
    switch (status) {
      case 'not_started':
        return (
          <Button size="sm" onClick={() => handleTimeTracking(task, 'start')} className="bg-[#10b981] hover:bg-[#059669] text-white h-8 px-3">
            <Play className="h-3 w-3 mr-1" /> Start
          </Button>
        );
      case 'running':
        return (
          <div className="flex gap-1">
            <Button size="sm" onClick={() => handleTimeTracking(task, 'pause')} className="bg-[#3b82f6] hover:bg-[#2563eb] text-white h-8 px-3">
              <Pause className="h-3 w-3 mr-1" /> Pause
            </Button>
            <Button size="sm" onClick={() => handleTimeTracking(task, 'finish')} className="bg-[#ef4444] hover:bg-[#dc2626] text-white h-8 px-3">
              <Square className="h-3 w-3 mr-1" /> Finish
            </Button>
          </div>
        );
      case 'paused':
        return (
          <div className="flex gap-1">
            <Button size="sm" onClick={() => handleTimeTracking(task, 'resume')} className="bg-[#3b82f6] hover:bg-[#2563eb] text-white h-8 px-3">
              <Play className="h-3 w-3 mr-1" /> Resume
            </Button>
            <Button size="sm" onClick={() => handleTimeTracking(task, 'finish')} className="bg-[#ef4444] hover:bg-[#dc2626] text-white h-8 px-3">
              <Square className="h-3 w-3 mr-1" /> Finish
            </Button>
          </div>
        );
      case 'finished':
        return <Badge className="bg-[#10b981]/20 text-[#10b981]"><CheckCircle2 className="h-3 w-3 mr-1" /> Done</Badge>;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className={`h-full flex items-center justify-center ${bgPage}`}>
          <div className="animate-spin h-8 w-8 border-2 border-[#6366f1] border-t-transparent rounded-full" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className={`h-full flex flex-col ${bgPage}`} data-testid="my-tasks-page">
        {/* Header */}
        <div className={`px-6 py-4 border-b ${borderColor} ${bgCard}`}>
          <div className="flex items-center justify-between">
            <div>
              <h1 className={`text-xl font-semibold ${textPrimary}`}>My Tasks</h1>
              <p className={`text-sm ${textSecondary}`}>Tasks assigned to you across all projects</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6 space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-4 gap-4">
            <Card className={`${bgCard} border ${borderColor}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`text-sm ${textSecondary}`}>Total Tasks</p>
                    <p className={`text-2xl font-bold ${textPrimary}`}>{stats.total}</p>
                  </div>
                  <Briefcase className="h-8 w-8 text-[#6366f1]" />
                </div>
              </CardContent>
            </Card>
            <Card className={`${bgCard} border ${borderColor}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`text-sm ${textSecondary}`}>Pending</p>
                    <p className="text-2xl font-bold text-[#71717a]">{stats.pending}</p>
                  </div>
                  <Circle className="h-8 w-8 text-[#71717a]" />
                </div>
              </CardContent>
            </Card>
            <Card className={`${bgCard} border ${borderColor}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`text-sm ${textSecondary}`}>In Progress</p>
                    <p className="text-2xl font-bold text-[#3b82f6]">{stats.in_progress}</p>
                  </div>
                  <Clock className="h-8 w-8 text-[#3b82f6]" />
                </div>
              </CardContent>
            </Card>
            <Card className={`${bgCard} border ${borderColor}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`text-sm ${textSecondary}`}>Completed</p>
                    <p className="text-2xl font-bold text-[#10b981]">{stats.completed}</p>
                  </div>
                  <CheckCircle2 className="h-8 w-8 text-[#10b981]" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <div className="space-y-4">
            <div className="flex gap-2 justify-between items-center flex-wrap">
              <div className="flex gap-2 flex-wrap">
                {['all', 'pending', 'in_progress', 'completed'].map(f => (
                  <Button key={f} variant={quickFilter === f ? 'default' : 'outline'} size="sm" onClick={() => setQuickFilter(f)} className={quickFilter === f ? 'bg-[#6366f1]' : ''}>
                    {f === 'all' ? 'All' : f.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </Button>
                ))}
              </div>
              <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)} className={showFilters ? 'bg-[#6366f1] text-white' : ''}>
                <Filter className="h-4 w-4 mr-2" /> Filters
              </Button>
            </div>

            {showFilters && (
              <Card className={`${bgCard} border ${borderColor}`}>
                <CardContent className="p-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <Label className={`text-xs ${textSecondary}`}>Type</Label>
                      <Select value={filters.taskType} onValueChange={(v) => setFilters({...filters, taskType: v})}>
                        <SelectTrigger className={`h-9 ${bgSecondary} border ${borderColor}`}><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Types</SelectItem>
                          <SelectItem value="general">General</SelectItem>
                          <SelectItem value="meeting">Meeting</SelectItem>
                          <SelectItem value="follow_up">Follow Up</SelectItem>
                          <SelectItem value="proposal">Proposal</SelectItem>
                          <SelectItem value="call">Call</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className={`text-xs ${textSecondary}`}>Status</Label>
                      <Select value={filters.status} onValueChange={(v) => setFilters({...filters, status: v})}>
                        <SelectTrigger className={`h-9 ${bgSecondary} border ${borderColor}`}><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Status</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="on_hold">On Hold</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className={`text-xs ${textSecondary}`}>Priority</Label>
                      <Select value={filters.priority} onValueChange={(v) => setFilters({...filters, priority: v})}>
                        <SelectTrigger className={`h-9 ${bgSecondary} border ${borderColor}`}><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="low">Low</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-end">
                      <Button variant="ghost" size="sm" onClick={() => setFilters({ dateFilter: 'all', taskType: 'all', status: 'all', priority: 'all' })}>
                        Reset Filters
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Tasks Table */}
          <Card className={`${bgCard} border ${borderColor}`}>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className={bgSecondary}>
                    <tr>
                      <th className={`px-4 py-3 text-left text-xs font-medium ${textSecondary} uppercase`}>Task</th>
                      <th className={`px-4 py-3 text-left text-xs font-medium ${textSecondary} uppercase`}>Project</th>
                      <th className={`px-4 py-3 text-left text-xs font-medium ${textSecondary} uppercase`}>Status</th>
                      <th className={`px-4 py-3 text-left text-xs font-medium ${textSecondary} uppercase`}>Due Date</th>
                      <th className={`px-4 py-3 text-left text-xs font-medium ${textSecondary} uppercase`}>Time</th>
                      <th className={`px-4 py-3 text-left text-xs font-medium ${textSecondary} uppercase`}>Timer</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${isDark ? 'divide-[#27272a]' : 'divide-gray-200'}`}>
                    {filteredTasks.length === 0 ? (
                      <tr>
                        <td colSpan={6} className={`px-4 py-8 text-center ${textSecondary}`}>
                          <Briefcase className="h-12 w-12 mx-auto mb-3 opacity-50" />
                          <p>No tasks assigned to you</p>
                        </td>
                      </tr>
                    ) : filteredTasks.map(task => (
                      <tr key={task.task_id} className={`hover:${bgSecondary}`}>
                        <td className="px-4 py-3">
                          <div className={`font-medium ${textPrimary}`}>{task.task_name}</div>
                          {task.description && <div className={`text-xs ${textSecondary} truncate max-w-xs`}>{task.description}</div>}
                          <div className="flex gap-1 mt-1">
                            <Badge className={priorityColors[task.priority]}>{task.priority}</Badge>
                            <Badge variant="outline">{task.type || 'general'}</Badge>
                          </div>
                        </td>
                        <td className={`px-4 py-3 text-sm ${textSecondary}`}>
                          {task.project_name || '-'}
                        </td>
                        <td className="px-4 py-3">
                          <Badge className={`${statusColors[task.status]?.bg} ${statusColors[task.status]?.text}`}>
                            {task.status?.replace('_', ' ') || 'Pending'}
                          </Badge>
                        </td>
                        <td className={`px-4 py-3 text-sm ${textPrimary}`}>
                          {task.due_date ? (
                            <span className={new Date(task.due_date) < new Date() && task.status !== 'completed' ? 'text-[#ef4444]' : ''}>
                              {formatDate(task.due_date)}
                            </span>
                          ) : '-'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Timer className={`h-4 w-4 ${task.time_tracking?.status === 'running' ? 'text-[#10b981] animate-pulse' : textSecondary}`} />
                            <span className={`text-sm font-medium ${textPrimary}`}>{formatDuration(task.time_tracking?.total_seconds || 0)}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {getTimerButton(task)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
