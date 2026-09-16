import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import Layout from '../components/Layout';
import { useTheme } from '../contexts/ThemeContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import {
  ArrowLeft, ChevronLeft, ChevronRight, Clock, Home, Building, CheckCircle, XCircle, Calendar,
  Pencil, History, Loader2,
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const STATUS_COLORS = {
  present: 'bg-[#22c55e]/20 text-[#22c55e]',
  working: 'bg-[#3b82f6]/20 text-[#3b82f6]',
  absent: 'bg-[#ef4444]/20 text-[#ef4444]',
  wfh: 'bg-[#10b981]/20 text-[#10b981]',
  leave: 'bg-[#f59e0b]/20 text-[#f59e0b]',
};

const fmtDate = (d) => {
  if (!d) return '-';
  const dt = typeof d === 'string' ? new Date(d) : d;
  return dt.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
};

const fmtTime = (s) => {
  if (!s) return '-';
  return new Date(s).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
};

// For pre-filling an <input type="time"> from a stored datetime/ISO string.
const to24h = (s) => {
  if (!s) return '';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const dateKey = (d) => {
  if (!d) return '';
  return typeof d === 'string' ? d.split('T')[0] : new Date(d).toISOString().split('T')[0];
};

export default function EmployeeAttendanceViewPage() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [employee, setEmployee] = useState(null);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const [editRecord, setEditRecord] = useState(null); // record being time-edited
  const [editForm, setEditForm] = useState({ clock_in: '', clock_out: '', lunch_start: '', lunch_end: '' });
  const [saving, setSaving] = useState(false);
  const [historyRecord, setHistoryRecord] = useState(null); // record whose history popup is open

  const headers = useMemo(() => ({ Authorization: `Bearer ${localStorage.getItem('session_token')}` }), []);

  const bgPage = isDark ? 'bg-[#0a0a0a]' : 'bg-gray-50';
  const bgCard = isDark ? 'bg-[#18181b]' : 'bg-white';
  const bgSecondary = isDark ? 'bg-[#27272a]' : 'bg-gray-100';
  const textPrimary = isDark ? 'text-[#fafafa]' : 'text-gray-900';
  const textSecondary = isDark ? 'text-[#a1a1aa]' : 'text-gray-600';
  const borderColor = isDark ? 'border-[#27272a]' : 'border-gray-200';

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [empListRes, recRes] = await Promise.all([
        axios.get(`${API}/api/hr/admin/employees`, { headers }).catch(() => ({ data: [] })),
        axios.get(`${API}/api/hr/attendance/employee/${userId}`, { headers, params: { month, year } }),
      ]);
      const list = Array.isArray(empListRes.data) ? empListRes.data : [];
      const found = list.find(e => e.user_id === userId);
      if (found) setEmployee(found);
      setRecords(Array.isArray(recRes.data) ? recRes.data : []);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to load attendance');
    } finally {
      setLoading(false);
    }
  }, [userId, headers, month, year]);

  useEffect(() => { loadData(); }, [loadData]);

  const stats = useMemo(() => {
    let present = 0, absent = 0, wfh = 0, leave = 0, totalH = 0;
    for (const r of records) {
      const isLeave = !!r.leave_type;
      const isWfh = r.work_location === 'home' || r.work_mode === 'wfh';
      const checkedOut = r.clock_out || r.clock_out_time;
      const checkedIn = r.clock_in || r.clock_in_time;
      if (isLeave) leave++;
      else if (checkedIn) {
        if (isWfh) wfh++;
        else present++;
      } else absent++;

      if (checkedIn && checkedOut) {
        const h = (new Date(checkedOut) - new Date(checkedIn)) / 3600000;
        if (h > 0 && h < 24) totalH += h;
      } else if (r.total_hours) totalH += Number(r.total_hours) || 0;
    }
    return { present, absent, wfh, leave, totalH };
  }, [records]);

  const shiftMonth = (delta) => {
    let m = month + delta, y = year;
    if (m < 1) { m = 12; y--; } else if (m > 12) { m = 1; y++; }
    setMonth(m); setYear(y);
  };

  const openEdit = (r) => {
    setEditRecord(r);
    setEditForm({
      clock_in: to24h(r.clock_in || r.clock_in_time),
      clock_out: to24h(r.clock_out || r.clock_out_time),
      lunch_start: to24h(r.lunch_start),
      lunch_end: to24h(r.lunch_end),
    });
  };

  const saveEdit = async () => {
    if (!editRecord) return;
    setSaving(true);
    try {
      await axios.put(
        `${API}/api/hr/admin/attendance/${userId}/${dateKey(editRecord.date)}/edit-times`,
        editForm,
        { headers },
      );
      toast.success('Attendance times updated');
      setEditRecord(null);
      loadData();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to update attendance');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <div className={`p-6 ${bgPage} min-h-screen`} data-testid="employee-attendance-page">
        <Button variant="ghost" size="sm" onClick={() => navigate('/hr-admin')} className={`mb-4 ${textSecondary}`} data-testid="back-btn">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to HR Admin
        </Button>

        {/* Employee header */}
        <Card className={`${bgCard} border ${borderColor} mb-4`}>
          <CardContent className="p-5 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-[#6366f1]/20 flex items-center justify-center text-[#6366f1] text-xl font-bold">
                {(employee?.name || '?').charAt(0).toUpperCase()}
              </div>
              <div>
                <h2 className={`text-xl font-bold ${textPrimary}`}>{employee?.name || 'Employee'}</h2>
                <p className={`text-sm ${textSecondary}`}>
                  {employee?.designation || '—'} · {employee?.email}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" onClick={() => shiftMonth(-1)}><ChevronLeft className="h-4 w-4" /></Button>
              <span className={`font-medium ${textPrimary} min-w-[140px] text-center`}>
                {new Date(year, month - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
              </span>
              <Button size="sm" variant="ghost" onClick={() => shiftMonth(1)}><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
          {[
            { label: 'Present', value: stats.present, color: '#22c55e', Icon: CheckCircle },
            { label: 'WFH', value: stats.wfh, color: '#10b981', Icon: Home },
            { label: 'On Leave', value: stats.leave, color: '#f59e0b', Icon: Calendar },
            { label: 'Absent', value: stats.absent, color: '#ef4444', Icon: XCircle },
            { label: 'Total Hours', value: stats.totalH.toFixed(1), color: '#6366f1', Icon: Clock },
          ].map(s => (
            <Card key={s.label} className={`${bgCard} border ${borderColor}`}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className={`text-xs ${textSecondary} uppercase tracking-wide`}>{s.label}</p>
                  <p className="text-2xl font-bold mt-1" style={{ color: s.color }}>{s.value}</p>
                </div>
                <s.Icon className="h-7 w-7" style={{ color: s.color }} />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Records table */}
        <Card className={`${bgCard} border ${borderColor}`}>
          <CardHeader>
            <CardTitle className={textPrimary}>Attendance Records — {records.length}</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className={`text-center py-6 ${textSecondary}`}>Loading...</p>
            ) : records.length === 0 ? (
              <p className={`text-center py-10 ${textSecondary}`}>No attendance records for this month.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className={`${bgSecondary} ${textSecondary}`}>
                    <tr>
                      <th className="text-left px-3 py-2">Date</th>
                      <th className="text-left px-3 py-2">Clock In</th>
                      <th className="text-left px-3 py-2">Clock Out</th>
                      <th className="text-left px-3 py-2">Lunch</th>
                      <th className="text-left px-3 py-2">Hours</th>
                      <th className="text-left px-3 py-2">Mode</th>
                      <th className="text-left px-3 py-2">Status</th>
                      <th className="text-left px-3 py-2">Edited</th>
                      <th className="text-right px-3 py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((r, i) => {
                      const ci = r.clock_in || r.clock_in_time;
                      const co = r.clock_out || r.clock_out_time;
                      const isWfh = r.work_location === 'home' || r.work_mode === 'wfh';
                      const isLeave = !!r.leave_type;
                      let hours = '-';
                      if (r.total_hours != null) hours = `${Number(r.total_hours).toFixed(1)}h`;
                      else if (ci && co) hours = `${((new Date(co) - new Date(ci)) / 3600000).toFixed(1)}h`;
                      const status = isLeave ? r.leave_type : isWfh ? 'wfh' : co ? 'present' : ci ? 'working' : 'absent';
                      const cls = STATUS_COLORS[status] || 'bg-[#71717a]/20 text-[#71717a]';
                      const hasHistory = Array.isArray(r.edit_history) && r.edit_history.length > 0;
                      return (
                        <tr key={i} className={`border-b ${borderColor}`} data-testid={`attendance-row-${dateKey(r.date)}`}>
                          <td className={`px-3 py-2 ${textPrimary}`}>{fmtDate(r.date)}</td>
                          <td className={`px-3 py-2 ${textSecondary}`}>{fmtTime(ci)}</td>
                          <td className={`px-3 py-2 ${textSecondary}`}>{fmtTime(co)}</td>
                          <td className={`px-3 py-2 ${textSecondary}`}>
                            {r.lunch_start ? `${fmtTime(r.lunch_start)}–${fmtTime(r.lunch_end)}` : '-'}
                          </td>
                          <td className={`px-3 py-2 ${textPrimary} font-medium`}>{hours}</td>
                          <td className={`px-3 py-2 ${textSecondary}`}>
                            {isWfh ? (
                              <span className="inline-flex items-center gap-1"><Home className="h-3.5 w-3.5 text-[#10b981]" /> WFH</span>
                            ) : (
                              <span className="inline-flex items-center gap-1"><Building className="h-3.5 w-3.5 text-[#6366f1]" /> Office</span>
                            )}
                          </td>
                          <td className="px-3 py-2"><Badge className={cls}>{status}</Badge></td>
                          <td className="px-3 py-2">
                            {r.last_edited_by_name && (
                              <button
                                onClick={() => setHistoryRecord(r)}
                                className={`inline-flex items-center gap-1 text-xs ${textSecondary} hover:text-[#6366f1] hover:underline`}
                                title="View edit history"
                              >
                                <History className="h-3 w-3" /> by {r.last_edited_by_name}
                              </button>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <button onClick={() => openEdit(r)} className="text-[#6366f1] hover:opacity-70" title="Edit times">
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edit times dialog */}
      <Dialog open={!!editRecord} onOpenChange={(o) => !o && setEditRecord(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Attendance — {editRecord && fmtDate(editRecord.date)}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Clock In</Label>
              <Input type="time" value={editForm.clock_in} onChange={(e) => setEditForm(prev => ({ ...prev, clock_in: e.target.value }))} />
            </div>
            <div>
              <Label>Clock Out</Label>
              <Input type="time" value={editForm.clock_out} onChange={(e) => setEditForm(prev => ({ ...prev, clock_out: e.target.value }))} />
            </div>
            <div>
              <Label>Lunch Start</Label>
              <Input type="time" value={editForm.lunch_start} onChange={(e) => setEditForm(prev => ({ ...prev, lunch_start: e.target.value }))} />
            </div>
            <div>
              <Label>Lunch End</Label>
              <Input type="time" value={editForm.lunch_end} onChange={(e) => setEditForm(prev => ({ ...prev, lunch_end: e.target.value }))} />
            </div>
          </div>
          <p className={`text-xs ${textSecondary}`}>Total hours are recalculated automatically from these times. The change is logged with your name and the before/after values.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRecord(null)}>Cancel</Button>
            <Button onClick={saveEdit} disabled={saving} className="bg-[#6366f1] hover:bg-[#4f46e5]">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit history dialog */}
      <Dialog open={!!historyRecord} onOpenChange={(o) => !o && setHistoryRecord(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit History — {historyRecord && fmtDate(historyRecord.date)}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {(historyRecord?.edit_history || []).slice().reverse().map((h, idx) => (
              <div key={idx} className={`p-3 rounded-lg border ${borderColor} ${bgSecondary}`}>
                <p className={`text-sm font-medium ${textPrimary}`}>
                  {h.edited_by_name} <span className={`font-normal ${textSecondary}`}>— {new Date(h.edited_at).toLocaleString('en-IN')}</span>
                </p>
                <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                  <div>
                    <p className={`${textSecondary} uppercase tracking-wide mb-1`}>Before</p>
                    <p className={textPrimary}>In: {h.before?.clock_in || '-'} · Out: {h.before?.clock_out || '-'}</p>
                    <p className={textPrimary}>Lunch: {h.before?.lunch_start || '-'}–{h.before?.lunch_end || '-'}</p>
                    <p className={textPrimary}>Hours: {h.before?.total_hours ?? 0}</p>
                  </div>
                  <div>
                    <p className={`${textSecondary} uppercase tracking-wide mb-1`}>After</p>
                    <p className={textPrimary}>In: {h.after?.clock_in || '-'} · Out: {h.after?.clock_out || '-'}</p>
                    <p className={textPrimary}>Lunch: {h.after?.lunch_start || '-'}–{h.after?.lunch_end || '-'}</p>
                    <p className={textPrimary}>Hours: {h.after?.total_hours ?? 0}</p>
                  </div>
                </div>
              </div>
            ))}
            {(!historyRecord?.edit_history || historyRecord.edit_history.length === 0) && (
              <p className={`text-sm ${textSecondary} text-center py-4`}>No edits recorded.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
