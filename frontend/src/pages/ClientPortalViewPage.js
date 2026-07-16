import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { LogOut, Calendar, ListChecks, Users } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const STATUS_STYLE = {
  pending: 'bg-[#71717a]/20 text-[#71717a]',
  in_progress: 'bg-[#3b82f6]/20 text-[#3b82f6]',
  completed: 'bg-[#10b981]/20 text-[#10b981]',
  on_hold: 'bg-[#f59e0b]/20 text-[#f59e0b]',
};

const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

/**
 * Client Portal's read-only project view. Strictly display-only — no edit
 * controls anywhere on this page, matching the server's read-only
 * /api/client-portal/me/project response (no financial/internal fields).
 */
export default function ClientPortalViewPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#09090b]">
        <p className="text-[#a1a1aa]">Loading…</p>
      </div>
    );
  }
  if (!project) return null;

  return (
    <div className="min-h-screen bg-[#09090b] text-[#fafafa]">
      <div className="border-b border-[#27272a] px-6 py-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-[#a1a1aa] uppercase tracking-wide">Client Portal</p>
          <h1 className="text-xl font-bold">{project.name}</h1>
        </div>
        <Button variant="outline" onClick={handleLogout} className="gap-2" data-testid="client-portal-logout">
          <LogOut className="h-4 w-4" /> Logout
        </Button>
      </div>

      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <div className="bg-[#18181b] border border-[#27272a] rounded-2xl p-5 space-y-3">
          {project.description && <p className="text-sm text-[#a1a1aa]">{project.description}</p>}
          <div className="flex items-center gap-6 flex-wrap text-sm">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-[#a1a1aa]" />
              <span className="text-[#a1a1aa]">Start:</span>
              <span>{fmtDate(project.start_date)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-[#a1a1aa]" />
              <span className="text-[#a1a1aa]">Due:</span>
              <span>{fmtDate(project.due_date)}</span>
            </div>
            <Badge className="bg-[#10b981]/20 text-[#10b981] capitalize">{project.status || 'active'}</Badge>
          </div>
        </div>

        {(() => {
          const erpUsers = project.erp_users || [];
          const allTasks = project.tasks || [];
          const taggedPageIds = new Set(erpUsers.flatMap((u) => (u.pages || []).map((p) => p.id)));
          const otherTasks = allTasks.filter((t) => !t.erp_page_id || !taggedPageIds.has(t.erp_page_id));
          const tasksForPage = (pageId) => allTasks.filter((t) => t.erp_page_id === pageId);

          const taskCard = (task) => (
            <div key={task.task_id} className="bg-[#0f0f11] border border-[#27272a] rounded-lg p-3 flex items-center justify-between gap-3" data-testid={`client-portal-task-${task.task_id}`}>
              <div>
                <p className="text-sm font-medium">{task.task_name}</p>
                <p className="text-xs text-[#a1a1aa] mt-1">
                  {task.category && <>{task.category} · </>}
                  Due {fmtDate(task.due_date)}
                </p>
              </div>
              <Badge className={STATUS_STYLE[task.status] || STATUS_STYLE.pending}>
                {(task.status || 'pending').replace('_', ' ')}
              </Badge>
            </div>
          );

          return (
            <>
              {erpUsers.length > 0 && (
                <div>
                  <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
                    <Users className="h-4 w-4 text-[#6366f1]" /> Users ({erpUsers.length})
                  </h2>
                  <div className="space-y-4">
                    {erpUsers.map((u) => (
                      <div key={u.id} className="bg-[#18181b] border border-[#27272a] rounded-2xl p-4" data-testid={`client-portal-user-${u.id}`}>
                        <p className="font-semibold mb-3">{u.user_name}</p>
                        <div className="space-y-3 pl-3 border-l border-[#27272a]">
                          {(u.pages || []).length === 0 && <p className="text-xs text-[#a1a1aa]">No pages yet.</p>}
                          {(u.pages || []).map((pg) => (
                            <div key={pg.id} data-testid={`client-portal-page-${pg.id}`}>
                              <div className="flex items-center justify-between mb-2">
                                <p className="text-sm font-medium text-[#a1a1aa]">{pg.page_name}</p>
                                <Badge className="bg-[#6366f1]/15 text-[#6366f1] text-[10px]">{pg.status || 'To-Do'}</Badge>
                              </div>
                              <div className="space-y-2">
                                {tasksForPage(pg.id).length === 0 && <p className="text-xs text-[#71717a]">No tasks yet.</p>}
                                {tasksForPage(pg.id).map(taskCard)}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
                  <ListChecks className="h-4 w-4 text-[#6366f1]" /> {erpUsers.length > 0 ? 'Other Tasks' : 'Tasks'} ({otherTasks.length})
                </h2>
                <div className="space-y-2">
                  {otherTasks.length === 0 && (
                    <p className="text-sm text-[#a1a1aa]">No tasks yet.</p>
                  )}
                  {otherTasks.map(taskCard)}
                </div>
              </div>
            </>
          );
        })()}
      </div>
    </div>
  );
}
