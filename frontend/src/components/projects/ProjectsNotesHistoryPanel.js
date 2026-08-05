import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Card, CardContent } from '../ui/card';
import { Input } from '../ui/input';
import { History, NotebookPen, Briefcase } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const fmtDay = (ymd) => {
  if (!ymd) return '—';
  try {
    // Parse as a plain calendar date — `new Date('2026-08-05')` is UTC midnight
    // and shifts a day backwards for anyone west of GMT.
    const [y, m, d] = ymd.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', weekday: 'long' });
  } catch { return ymd; }
};

const fmtTime = (iso) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
};

/**
 * Notes History — every project's Daily Notes for one department, in a single
 * date-wise feed: newest day first, and within each day grouped project by
 * project. Opened by the "Notes History" button that sits at the end of the
 * department tab row, and scoped to whichever department tab is active.
 */
export default function ProjectsNotesHistoryPanel({
  department,          // '' for All, else a department key like 'erp'
  departmentLabel,
  onClose,
  headers,
  bgCard,
  bgSecondary,
  textPrimary,
  textSecondary,
  borderColor,
}) {
  const [notes, setNotes] = useState([]);
  const [projectOptions, setProjectOptions] = useState([]);
  const [loading, setLoading] = useState(true);

  const [projectFilter, setProjectFilter] = useState('all');
  const [memberFilter, setMemberFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (department) params.department = department;
      if (fromDate) params.from_date = fromDate;
      if (toDate) params.to_date = toDate;
      const res = await axios.get(`${API}/api/projects/daily-notes/history`, { headers, params });
      setNotes(res.data?.notes || []);
      setProjectOptions(res.data?.projects || []);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to load notes history');
    } finally {
      setLoading(false);
    }
  }, [department, fromDate, toDate]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  // Project + member filtering stays client-side so switching them doesn't
  // re-hit the API on every keystroke of the dropdown.
  const filtered = notes.filter(n => {
    if (projectFilter !== 'all' && n.project_id !== projectFilter) return false;
    if (memberFilter !== 'all' && n.created_by !== memberFilter) return false;
    return true;
  });

  const authors = Array.from(new Map(
    notes.map(n => [n.created_by, { user_id: n.created_by, name: n.created_by_name || n.created_by }])
  ).values()).sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  // Date → project → notes. The backend already sorts newest day first, so
  // insertion order into these Maps is the display order.
  const byDate = [];
  filtered.forEach(n => {
    let day = byDate.find(d => d.date === n.note_date);
    if (!day) { day = { date: n.note_date, projects: [] }; byDate.push(day); }
    let proj = day.projects.find(p => p.project_id === n.project_id);
    if (!proj) { proj = { project_id: n.project_id, project_name: n.project_name, notes: [] }; day.projects.push(proj); }
    proj.notes.push(n);
  });

  const projectsTouched = new Set(filtered.map(n => n.project_id)).size;

  return (
    <div className="space-y-3" data-testid="projects-notes-history-panel">
      <div>
        <button
          onClick={onClose}
          className={`text-sm ${textSecondary} hover:underline mb-1`}
          data-testid="notes-history-back"
        >
          ← Back to Projects
        </button>
        <h3 className={`text-lg font-semibold ${textPrimary} flex items-center gap-2`}>
          <History className="h-5 w-5 text-[#6366f1]" /> Notes History
        </h3>
        <p className={`text-xs ${textSecondary}`}>
          Daily notes across {departmentLabel || 'all'} projects, day by day — newest first.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2" data-testid="notes-history-filters">
        <select
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
          className={`h-9 px-3 rounded-lg border ${borderColor} ${bgSecondary} ${textPrimary} text-sm`}
          data-testid="notes-history-filter-project"
        >
          <option value="all">All Projects</option>
          {projectOptions.map(p => (
            <option key={p.project_id} value={p.project_id}>{p.name}</option>
          ))}
        </select>

        <select
          value={memberFilter}
          onChange={(e) => setMemberFilter(e.target.value)}
          className={`h-9 px-3 rounded-lg border ${borderColor} ${bgSecondary} ${textPrimary} text-sm`}
          data-testid="notes-history-filter-member"
        >
          <option value="all">All Team Members</option>
          {authors.map(a => (
            <option key={a.user_id} value={a.user_id}>{a.name}</option>
          ))}
        </select>

        <div className="flex items-center gap-1">
          <span className={`text-xs ${textSecondary}`}>From</span>
          <Input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className={`h-9 w-[150px] ${bgSecondary} border ${borderColor} ${textPrimary}`}
            data-testid="notes-history-filter-from"
          />
          <span className={`text-xs ${textSecondary}`}>To</span>
          <Input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className={`h-9 w-[150px] ${bgSecondary} border ${borderColor} ${textPrimary}`}
            data-testid="notes-history-filter-to"
          />
        </div>

        {(projectFilter !== 'all' || memberFilter !== 'all' || fromDate || toDate) && (
          <button
            onClick={() => { setProjectFilter('all'); setMemberFilter('all'); setFromDate(''); setToDate(''); }}
            className={`text-xs ${textSecondary} hover:underline`}
            data-testid="notes-history-filter-reset"
          >
            Reset
          </button>
        )}

        <span className={`text-xs ${textSecondary} ml-auto`} data-testid="notes-history-counts">
          {filtered.length} note{filtered.length === 1 ? '' : 's'} · {byDate.length} day{byDate.length === 1 ? '' : 's'} · {projectsTouched} project{projectsTouched === 1 ? '' : 's'}
        </span>
      </div>

      {loading ? (
        <Card className={`${bgCard} border ${borderColor}`}>
          <CardContent className="p-8 text-center">
            <p className={`text-sm ${textSecondary}`}>Loading notes history…</p>
          </CardContent>
        </Card>
      ) : byDate.length === 0 ? (
        <Card className={`${bgCard} border ${borderColor}`}>
          <CardContent className="p-12 text-center">
            <NotebookPen className={`h-10 w-10 mx-auto mb-3 ${textSecondary}`} />
            <p className={textPrimary}>No daily notes yet</p>
            <p className={`text-sm ${textSecondary}`}>
              Open a project → Daily Notes and file today's update; it will show up here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {byDate.map(day => (
            <div key={day.date} data-testid={`notes-history-day-${day.date}`}>
              {/* Date header — the spine of the feed */}
              <div className="flex items-center gap-3 mb-2">
                <h4 className={`text-sm font-semibold ${textPrimary}`}>{fmtDay(day.date)}</h4>
                <div className={`flex-1 border-t ${borderColor}`} />
                <span className={`text-xs ${textSecondary}`}>
                  {day.projects.length} project{day.projects.length === 1 ? '' : 's'}
                </span>
              </div>

              <div className="space-y-2">
                {day.projects.map(proj => (
                  <Card key={proj.project_id} className={`${bgCard} border ${borderColor}`} data-testid={`notes-history-project-${proj.project_id}`}>
                    <CardContent className="p-4">
                      <p className={`text-sm font-medium ${textPrimary} flex items-center gap-2 mb-2`}>
                        <Briefcase className="h-4 w-4 text-[#6366f1]" /> {proj.project_name || '—'}
                      </p>
                      <div className="space-y-2">
                        {proj.notes.map(n => (
                          <div key={n.note_id} className={`rounded-lg border ${borderColor} ${bgSecondary} p-3`} data-testid={`notes-history-note-${n.note_id}`}>
                            <p className={`text-[11px] ${textSecondary} mb-1`}>
                              {n.created_by_name || n.created_by}
                              {fmtTime(n.created_at) && <> · {fmtTime(n.created_at)}</>}
                            </p>
                            <p className={`text-sm ${textPrimary} whitespace-pre-wrap`}>{n.note}</p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
