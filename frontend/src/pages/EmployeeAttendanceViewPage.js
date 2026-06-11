import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import Layout from '../components/Layout';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { ArrowLeft, ChevronLeft, ChevronRight, Clock, Home, Building, CheckCircle, XCircle, Calendar } from 'lucide-react';

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

export default function EmployeeAttendanceViewPage() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [employee, setEmployee] = useState(null);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const bgPage = isDark ? 'bg-[#0a0a0a]' : 'bg-gray-50';
  const bgCard = isDark ? 'bg-[#18181b]' : 'bg-white';
  const bgSecondary = isDark ? 'bg-[#27272a]' : 'bg-gray-100';
  const textPrimary = isDark ? 'text-[#fafafa]' : 'text-gray-900';
  const textSecondary = isDark ? 'text-[#a1a1aa]' : 'text-gray-600';
  const borderColor = isDark ? 'border-[#27272a]' : 'border-gray-200';

  useEffect(() => {
    (async () => {
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
    })();
  }, [userId, headers, month, year]);

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

  return (
    <Layout>
      <div className={`p-6 ${bgPage} min-h-screen`} data-testid="employee-attendance-page">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className={`mb-4 ${textSecondary}`} data-testid="back-btn">
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
                      <th className="text-left px-3 py-2">Hours</th>
                      <th className="text-left px-3 py-2">Mode</th>
                      <th className="text-left px-3 py-2">Status</th>
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
                      return (
                        <tr key={i} className={`border-b ${borderColor}`}>
                          <td className={`px-3 py-2 ${textPrimary}`}>{fmtDate(r.date)}</td>
                          <td className={`px-3 py-2 ${textSecondary}`}>{fmtTime(ci)}</td>
                          <td className={`px-3 py-2 ${textSecondary}`}>{fmtTime(co)}</td>
                          <td className={`px-3 py-2 ${textPrimary} font-medium`}>{hours}</td>
                          <td className={`px-3 py-2 ${textSecondary}`}>
                            {isWfh ? (
                              <span className="inline-flex items-center gap-1"><Home className="h-3.5 w-3.5 text-[#10b981]" /> WFH</span>
                            ) : (
                              <span className="inline-flex items-center gap-1"><Building className="h-3.5 w-3.5 text-[#6366f1]" /> Office</span>
                            )}
                          </td>
                          <td className="px-3 py-2"><Badge className={cls}>{status}</Badge></td>
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
    </Layout>
  );
}
