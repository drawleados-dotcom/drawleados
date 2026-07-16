import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { LogOut, Calendar, ListChecks, Users as UsersIcon, User as UserIcon, ChevronDown, ChevronRight, Building2 } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const STATUS_STYLE = {
  pending: 'bg-gray-100 text-gray-600 border border-gray-200',
  in_progress: 'bg-blue-50 text-blue-600 border border-blue-200',
  completed: 'bg-emerald-50 text-emerald-600 border border-emerald-200',
  on_hold: 'bg-amber-50 text-amber-600 border border-amber-200',
};
const STATUS_OPTIONS = [
  { value: 'all', label: 'All Status' },
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'on_hold', label: 'On Hold' },
];

const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

/**
 * Client Portal's read-only project view. Strictly display-only — no edit
 * controls anywhere on this page, matching the server's read-only
 * /api/client-portal/me/project response (no financial/internal fields).
 * White/light theme only (not theme-aware) and mobile-first, with a fixed
 * bottom nav (Task / Users / Profile) as the primary navigation.
 */
export default function ClientPortalViewPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState('tasks'); // 'tasks' | 'users' | 'profile'

  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');
  const [userFilter, setUserFilter] = useState('all');
  const [collapsedUsers, setCollapsedUsers] = useState([]);

  const sessionToken = localStorage.getItem('client_portal_session_token');
  const headers = { Authorization: `Bearer ${sessionToken}` };

  const load = useCallback(async () => {
    if (!sessionToken) {
      navigate(`/client-portal/${projectId}`);
      return;
    }
    try {
      const res = await axios.get(`${API}/api/client-portal/me/project`, { headers });
      setProject(res.data);
    } catch (error) {
      toast.error('Session expired — please log in again');
      localStorage.removeItem('client_portal_session_token');
      localStorage.removeItem('client_portal_project_id');
      navigate(`/client-portal/${projectId}`);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const handleLogout = async () => {
    try { await axios.post(`${API}/api/client-portal/logout`, {}, { headers }); } catch { /* best-effort */ }
    localStorage.removeItem('client_portal_session_token');
    localStorage.removeItem('client_portal_project_id');
    navigate(`/client-portal/${projectId}`);
  };

  const toggleUserCollapse = (id) => setCollapsedUsers((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Loading…</p>
      </div>
    );
  }
  if (!project) return null;

  const erpUsers = project.erp_users || [];
  const allTasks = project.tasks || [];

  const matchesFilters = (task) => {
    if (statusFilter !== 'all' && (task.status || 'pending') !== statusFilter) return false;
    if (dateFilter && (task.due_date || '').slice(0, 10) !== dateFilter) return false;
    return true;
  };
  const filteredTasks = allTasks.filter(matchesFilters);
  const tasksForPage = (pageId) => allTasks.filter((t) => t.erp_page_id === pageId && matchesFilters(t));
  const visibleUsers = userFilter === 'all' ? erpUsers : erpUsers.filter((u) => u.id === userFilter);

  const taskCard = (task) => (
    <div key={task.task_id} className="bg-white border border-gray-200 rounded-lg p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2" data-testid={`client-portal-task-${task.task_id}`}>
      <div>
        <p className="text-sm font-medium text-gray-900">{task.task_name}</p>
        <p className="text-xs text-gray-500 mt-1">
          {task.category && <>{task.category} · </>}
          Due {fmtDate(task.due_date)}
        </p>
      </div>
      <Badge className={`${STATUS_STYLE[task.status] || STATUS_STYLE.pending} w-fit`}>
        {(task.status || 'pending').replace('_', ' ')}
      </Badge>
    </div>
  );

  const FilterBar = ({ showUserFilter }) => (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      {showUserFilter && (
        <select
          value={userFilter}
          onChange={(e) => setUserFilter(e.target.value)}
          className="text-sm rounded-lg border border-gray-200 bg-white text-gray-900 px-3 py-2"
          data-testid="client-portal-user-filter"
        >
          <option value="all">All Users</option>
          {erpUsers.map((u) => <option key={u.id} value={u.id}>{u.user_name}</option>)}
        </select>
      )}
      <input
        type="date"
        value={dateFilter}
        onChange={(e) => setDateFilter(e.target.value)}
        className="text-sm rounded-lg border border-gray-200 bg-white text-gray-900 px-3 py-2"
        data-testid="client-portal-date-filter"
      />
      {dateFilter && (
        <button type="button" onClick={() => setDateFilter('')} className="text-xs text-gray-500 hover:text-gray-900">
          Clear date
        </button>
      )}
      <select
        value={statusFilter}
        onChange={(e) => setStatusFilter(e.target.value)}
        className="text-sm rounded-lg border border-gray-200 bg-white text-gray-900 px-3 py-2"
        data-testid="client-portal-status-filter"
      >
        {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
      </select>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 pb-20">
      <div className="border-b border-gray-200 bg-white px-4 sm:px-6 py-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide">Client Portal</p>
          <h1 className="text-lg sm:text-xl font-bold truncate max-w-[60vw]">{project.name}</h1>
        </div>
        <Button variant="outline" onClick={handleLogout} className="gap-2" data-testid="client-portal-logout">
          <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">Logout</span>
        </Button>
      </div>

      <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-4">
        {section === 'tasks' && (
          <div>
            <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-[#6366f1]" /> Tasks ({filteredTasks.length})
            </h2>
            <FilterBar showUserFilter={false} />
            <div className="space-y-2">
              {filteredTasks.length === 0 && <p className="text-sm text-gray-500">No tasks match these filters.</p>}
              {filteredTasks.map(taskCard)}
            </div>
          </div>
        )}

        {section === 'users' && (
          <div>
            <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
              <UsersIcon className="h-4 w-4 text-[#6366f1]" /> Users ({erpUsers.length})
            </h2>
            <FilterBar showUserFilter />
            <div className="space-y-3">
              {visibleUsers.length === 0 && <p className="text-sm text-gray-500">No users found.</p>}
              {visibleUsers.map((u) => {
                const isCollapsed = collapsedUsers.includes(u.id);
                return (
                  <div key={u.id} className="bg-white border border-gray-200 rounded-2xl p-4" data-testid={`client-portal-user-${u.id}`}>
                    <button
                      type="button"
                      onClick={() => toggleUserCollapse(u.id)}
                      className="flex items-center gap-2 font-semibold w-full text-left"
                      data-testid={`client-portal-user-toggle-${u.id}`}
                    >
                      {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      {u.user_name}
                    </button>
                    {!isCollapsed && (
                      <div className="space-y-3 pl-3 border-l border-gray-200 mt-3">
                        {(u.pages || []).length === 0 && <p className="text-xs text-gray-500">No pages yet.</p>}
                        {(u.pages || []).map((pg) => {
                          const pageTasks = tasksForPage(pg.id);
                          return (
                            <div key={pg.id} data-testid={`client-portal-page-${pg.id}`}>
                              <div className="flex items-center justify-between mb-2">
                                <p className="text-sm font-medium text-gray-600">{pg.page_name}</p>
                                <Badge className="bg-[#6366f1]/10 text-[#6366f1] text-[10px] border border-[#6366f1]/20">{pg.status || 'To-Do'}</Badge>
                              </div>
                              <div className="space-y-2">
                                {pageTasks.length === 0 && <p className="text-xs text-gray-400">No matching tasks.</p>}
                                {pageTasks.map(taskCard)}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {section === 'profile' && (
          <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-[#6366f1]" />
              <h2 className="text-base font-semibold">Project Details</h2>
            </div>
            {project.description && <p className="text-sm text-gray-600">{project.description}</p>}
            <div className="flex items-center gap-6 flex-wrap text-sm">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-400" />
                <span className="text-gray-500">Start:</span>
                <span>{fmtDate(project.start_date)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-400" />
                <span className="text-gray-500">Due:</span>
                <span>{fmtDate(project.due_date)}</span>
              </div>
              <Badge className="bg-emerald-50 text-emerald-600 border border-emerald-200 capitalize">{project.status || 'active'}</Badge>
            </div>
            <div className="pt-3 border-t border-gray-100">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Client</p>
              <p className="text-sm font-medium text-gray-900">{project.client_name || '—'}</p>
            </div>
          </div>
        )}
      </div>

      {/* Bottom nav — mobile-first primary navigation */}
      <div
        className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex items-stretch z-40"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {[
          { id: 'tasks', label: 'Task', icon: ListChecks },
          { id: 'users', label: 'Users', icon: UsersIcon },
          { id: 'profile', label: 'Profile', icon: UserIcon },
        ].map((item) => {
          const Icon = item.icon;
          const active = section === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setSection(item.id)}
              className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 text-xs font-medium ${active ? 'text-[#6366f1]' : 'text-gray-400'}`}
              data-testid={`client-portal-nav-${item.id}`}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
