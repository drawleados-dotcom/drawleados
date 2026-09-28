import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import Layout from '../components/Layout';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import WeeklyChallengeTracker from '../components/dashboard/WeeklyChallengeTracker';
import LapsOverviewCard from '../components/dashboard/LapsOverviewCard';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Calendar } from '../components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { format } from 'date-fns';
import axios from 'axios';
import useAutoRefresh from '../hooks/useAutoRefresh';
import {
  Users,
  TrendingUp,
  DollarSign,
  FileText,
  Briefcase,
  UserCheck,
  UserX,
  Home,
  Globe,
  Calendar as CalendarIcon,
  Package,
  Search,
  Share2,
  Megaphone,
  Code,
  BarChart3,
  Clock,
  Wallet,
  ArrowUpCircle,
  ArrowDownCircle,
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const ymd = (d) => (d ? format(d, 'yyyy-MM-dd') : undefined);
const fmtTime = (iso) => (iso ? format(new Date(iso), 'hh:mm a') : '—');
const fmtHours = (secs) => {
  const s = Math.max(0, Math.round(secs || 0));
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
};

// Icon + accent per department key (matches the departments used on tasks).
const DEPT_STYLE = {
  website: { icon: Globe, color: '#3b82f6' },
  social_media: { icon: Share2, color: '#ec4899' },
  meta: { icon: Megaphone, color: '#6366f1' },
  seo: { icon: Search, color: '#22c55e' },
  erp: { icon: Code, color: '#0ea5e9' },
  finance: { icon: DollarSign, color: '#8b5cf6' },
  hr: { icon: Users, color: '#10b981' },
  business_dev: { icon: BarChart3, color: '#f59e0b' },
};

// Written out in full so Tailwind keeps these classes in the build.
const OPS_GRID_COLS = {
  1: 'xl:grid-cols-1', 2: 'xl:grid-cols-2', 3: 'xl:grid-cols-3',
  4: 'xl:grid-cols-4', 5: 'xl:grid-cols-5', 6: 'xl:grid-cols-6',
};

const HR_LISTS = {
  present: { label: 'People Present', icon: UserCheck, color: '#22c55e' },
  absent: { label: 'Absent', icon: UserX, color: '#ef4444' },
  wfh: { label: 'Work From Home', icon: Home, color: '#8b5cf6' },
};

// Date Range Picker Component
const DateRangePicker = ({ dateRange, onDateChange, isDark }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  const formatDateRange = () => {
    if (!dateRange.from) return 'Select Date';
    if (!dateRange.to) return format(dateRange.from, 'dd MMM yyyy');
    return `${format(dateRange.from, 'dd MMM')} - ${format(dateRange.to, 'dd MMM yyyy')}`;
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={`h-8 text-xs px-3 gap-2 ${isDark ? 'bg-[#27272a] border-[#3f3f46] hover:bg-[#3f3f46]' : 'bg-white border-gray-200'}`}
        >
          <CalendarIcon className="h-3.5 w-3.5" />
          <span>{formatDateRange()}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className={`w-auto p-0 ${isDark ? 'bg-[#18181b] border-[#27272a]' : 'bg-white'}`} align="end">
        <Calendar
          mode="range"
          selected={dateRange}
          onSelect={(range) => {
            onDateChange(range || { from: undefined, to: undefined });
            if (range?.to) setIsOpen(false);
          }}
          numberOfMonths={2}
          className={isDark ? 'text-white' : ''}
        />
        <div className={`p-3 border-t flex gap-2 ${isDark ? 'border-[#27272a]' : 'border-gray-200'}`}>
          <Button
            size="sm"
            variant="outline"
            className="text-xs"
            onClick={() => {
              const today = new Date();
              onDateChange({ from: today, to: today });
              setIsOpen(false);
            }}
          >
            Today
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-xs"
            onClick={() => {
              const today = new Date();
              const weekAgo = new Date(today);
              weekAgo.setDate(weekAgo.getDate() - 7);
              onDateChange({ from: weekAgo, to: today });
              setIsOpen(false);
            }}
          >
            Last 7 Days
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-xs"
            onClick={() => {
              const today = new Date();
              const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
              onDateChange({ from: monthStart, to: today });
              setIsOpen(false);
            }}
          >
            This Month
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

const Dashboard = () => {
  const { user, isAdmin } = useAuth();
  const { isDark } = useTheme();
  const token = localStorage.getItem('session_token');
  const headers = { Authorization: `Bearer ${token}` };

  // LinkedIn OAuth connect redirects back here with ?linkedin_connected=true
  // or ?linkedin_error=... (see backend/linkedin_routes.py's callback).
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    if (searchParams.get('linkedin_connected') === 'true') {
      toast.success('LinkedIn connected');
      setSearchParams({}, { replace: true });
    } else if (searchParams.get('linkedin_error')) {
      toast.error(`LinkedIn connect failed: ${searchParams.get('linkedin_error')}`);
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Date range states for each section
  const today = new Date();
  const [salesDateRange, setSalesDateRange] = useState({ from: today, to: today });
  const [hrDateRange, setHrDateRange] = useState({ from: today, to: today });
  const [opsDateRange, setOpsDateRange] = useState({ from: today, to: today });
  const [financeDateRange, setFinanceDateRange] = useState({ from: today, to: today });
  
  // Data states
  const [salesData, setSalesData] = useState({ leads: 0, proposals: 0, deals: 0 });
  const [hrData, setHrData] = useState({ present: [], absent: [], wfh: [], total: 0 });
  const [hrPopup, setHrPopup] = useState(null); // 'present' | 'absent' | 'wfh'
  const [opsDepartments, setOpsDepartments] = useState([]);
  const [hoursPopup, setHoursPopup] = useState(null); // { dept, project }
  const [financeData, setFinanceData] = useState({ cashIn: 0, cashOut: 0, monthRevenue: 0 });
  const [loading, setLoading] = useState(true);

  // Filter by date range helper
  const isInDateRange = (dateStr, range) => {
    if (!dateStr || !range.from) return true;
    const date = new Date(dateStr);
    date.setHours(0, 0, 0, 0);
    const from = new Date(range.from);
    from.setHours(0, 0, 0, 0);
    const to = range.to ? new Date(range.to) : from;
    to.setHours(23, 59, 59, 999);
    return date >= from && date <= to;
  };

  // Fetch Sales Data
  const fetchSalesData = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/leads`, { headers });
      const leads = res.data || [];
      
      const filteredLeads = leads.filter(l => isInDateRange(l.created_at, salesDateRange));
      const proposals = filteredLeads.filter(l => l.status_name === 'Proposal Sent').length;
      const deals = filteredLeads.filter(l => l.status_name === 'Closed Won').length;
      
      setSalesData({
        leads: filteredLeads.length,
        proposals,
        deals
      });
    } catch (error) {
      console.error('Error fetching sales:', error);
    }
  }, [salesDateRange, token]);

  // Fetch HR Data — who was present/absent/WFH in the range, with login times
  const fetchHRData = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/hr/admin/dashboard-attendance`, {
        headers,
        params: { from_date: ymd(hrDateRange.from), to_date: ymd(hrDateRange.to || hrDateRange.from) },
      });
      setHrData({
        present: res.data.present || [],
        absent: res.data.absent || [],
        wfh: res.data.wfh || [],
        total: res.data.total_employees || 0,
      });
    } catch (error) {
      console.error('Error fetching HR:', error);
    }
  }, [hrDateRange, token]);

  // Fetch Operations Data — Projects page projects grouped by service: the
  // range's To Do / Pending / Completed task counts and hours tracked in it
  const fetchOperationsData = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/our-tasks/department-summary`, {
        headers,
        params: { from_date: ymd(opsDateRange.from), to_date: ymd(opsDateRange.to || opsDateRange.from) },
      });
      setOpsDepartments(res.data.departments || []);
    } catch (error) {
      console.error('Error fetching operations:', error);
    }
  }, [opsDateRange, token]);

  // Fetch Finance Data
  const fetchFinanceData = useCallback(async () => {
    try {
      const month = financeDateRange.from ? financeDateRange.from.getMonth() + 1 : new Date().getMonth() + 1;
      const year = financeDateRange.from ? financeDateRange.from.getFullYear() : new Date().getFullYear();
      
      const res = await axios.get(`${API}/api/expense/dashboard-summary`, {
        headers,
        params: { month, year }
      });
      
      setFinanceData({
        cashIn: res.data.total_revenue || 0,
        cashOut: res.data.total_expense || 0,
        monthRevenue: res.data.total_revenue || 0
      });
    } catch (error) {
      console.error('Error fetching finance:', error);
    }
  }, [financeDateRange, token]);

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      await Promise.all([
        fetchSalesData(),
        fetchHRData(),
        fetchOperationsData(),
        fetchFinanceData()
      ]);
      setLoading(false);
    };
    loadAll();
  }, []);

  useEffect(() => { fetchSalesData(); }, [salesDateRange]);
  useEffect(() => { fetchHRData(); }, [hrDateRange]);
  useEffect(() => { fetchOperationsData(); }, [opsDateRange]);
  useEffect(() => { fetchFinanceData(); }, [financeDateRange]);

  // Background polling + focus refresh — keeps dashboard cards live
  useAutoRefresh([fetchSalesData, fetchHRData, fetchOperationsData, fetchFinanceData]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  // Theme classes
  const cardClass = isDark ? 'bg-[#18181b] border-[#27272a]' : 'bg-white border-gray-200';
  const textClass = isDark ? 'text-[#fafafa]' : 'text-gray-900';
  const mutedClass = isDark ? 'text-[#a1a1aa]' : 'text-gray-500';
  const sectionClass = isDark ? 'bg-[#0f0f11] border-[#27272a]' : 'bg-gray-50 border-gray-200';

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <p className={mutedClass}>Loading dashboard...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6" data-testid="dashboard">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-1">
            <span className="bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] bg-clip-text text-transparent">
              Welcome back, {user?.name}
            </span>
          </h1>
          <p className={mutedClass}>Here's your business overview</p>
        </div>

        {/* LAPS Overview — Leads/Appointment/Proposal Shared/Sales, its own
            full date filter (Today/Yesterday/This Week/Month/Year/Custom) */}
        <LapsOverviewCard isDark={isDark} />

        {/* Row 1: Sales & HR */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Sales Section */}
          <Card className={cardClass}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className={`flex items-center gap-2 ${textClass}`}>
                  <div className="p-2 rounded-lg bg-[#6366f1]/20">
                    <TrendingUp className="h-5 w-5 text-[#6366f1]" />
                  </div>
                  Sales
                </CardTitle>
                <DateRangePicker 
                  dateRange={salesDateRange} 
                  onDateChange={setSalesDateRange}
                  isDark={isDark}
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className={`p-4 rounded-xl text-center ${sectionClass}`}>
                  <Users className="h-6 w-6 mx-auto mb-2 text-[#6366f1]" />
                  <p className={`text-2xl font-bold ${textClass}`}>{salesData.leads}</p>
                  <p className={`text-xs ${mutedClass}`}>No. of Leads</p>
                </div>
                <div className={`p-4 rounded-xl text-center ${sectionClass}`}>
                  <FileText className="h-6 w-6 mx-auto mb-2 text-[#f59e0b]" />
                  <p className={`text-2xl font-bold ${textClass}`}>{salesData.proposals}</p>
                  <p className={`text-xs ${mutedClass}`}>Proposals</p>
                </div>
                <div className={`p-4 rounded-xl text-center ${sectionClass}`}>
                  <Briefcase className="h-6 w-6 mx-auto mb-2 text-[#22c55e]" />
                  <p className={`text-2xl font-bold ${textClass}`}>{salesData.deals}</p>
                  <p className={`text-xs ${mutedClass}`}>Deals Closed</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* HR Section */}
          <Card className={cardClass}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className={`flex items-center gap-2 ${textClass}`}>
                  <div className="p-2 rounded-lg bg-[#10b981]/20">
                    <Users className="h-5 w-5 text-[#10b981]" />
                  </div>
                  HR
                </CardTitle>
                <DateRangePicker 
                  dateRange={hrDateRange} 
                  onDateChange={setHrDateRange}
                  isDark={isDark}
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                {Object.entries(HR_LISTS).map(([key, cfg]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setHrPopup(key)}
                    className={`p-4 rounded-xl text-center border border-transparent transition-colors hover:border-[#6366f1]/40 ${sectionClass}`}
                    data-testid={`dashboard-hr-${key}`}
                  >
                    <cfg.icon className="h-6 w-6 mx-auto mb-2" style={{ color: cfg.color }} />
                    <p className={`text-2xl font-bold ${textClass}`}>{hrData[key].length}</p>
                    <p className={`text-xs ${mutedClass}`}>{cfg.label}</p>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Row 2: Operations — one card per department, side by side */}
        <Card className={cardClass}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className={`flex items-center gap-2 ${textClass}`}>
                <div className="p-2 rounded-lg bg-[#f59e0b]/20">
                  <Package className="h-5 w-5 text-[#f59e0b]" />
                </div>
                Operations
              </CardTitle>
              <DateRangePicker
                dateRange={opsDateRange}
                onDateChange={setOpsDateRange}
                isDark={isDark}
              />
            </div>
          </CardHeader>
          <CardContent>
            <div className={`grid gap-3 grid-cols-1 md:grid-cols-2 ${OPS_GRID_COLS[Math.min(opsDepartments.length, 6)] || ''}`} data-testid="dashboard-ops-departments">
              {opsDepartments.length === 0 && (
                <p className={`text-sm py-6 text-center col-span-full ${mutedClass}`}>No projects yet</p>
              )}
              {opsDepartments.map((dept) => {
                const style = DEPT_STYLE[dept.key] || { icon: Briefcase, color: '#6366f1' };
                const DeptIcon = style.icon;
                return (
                  <div key={dept.key} className={`min-w-0 p-3 rounded-xl border ${sectionClass}`} data-testid={`dashboard-ops-dept-${dept.key}`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <DeptIcon className="h-5 w-5" style={{ color: style.color }} />
                        <span className={`font-semibold ${textClass}`}>{dept.label}</span>
                      </div>
                      <span className={`text-xs ${mutedClass}`}>{dept.projects.length} project{dept.projects.length === 1 ? '' : 's'}</span>
                    </div>
                    <div className="grid grid-cols-4 gap-1 mb-3 text-center">
                      {[
                        ['To Do', dept.to_do, '#3b82f6'],
                        ['Pending', dept.pending, '#f59e0b'],
                        ['Completed', dept.completed, '#22c55e'],
                        ['Worked', fmtHours(dept.worked_seconds), '#8b5cf6'],
                      ].map(([label, value, color]) => (
                        <div key={label}>
                          <p className="text-sm font-bold" style={{ color }}>{value}</p>
                          <p className={`text-[9px] uppercase tracking-wide truncate ${mutedClass}`}>{label}</p>
                        </div>
                      ))}
                    </div>
                    <div className="max-h-64 overflow-y-auto -mx-1">
                        <table className="w-full table-fixed text-xs">
                          <thead className={`${mutedClass} sticky top-0 ${isDark ? 'bg-[#0f0f11]' : 'bg-gray-50'}`}>
                            <tr>
                              <th className="text-left font-medium px-1 py-1">Project</th>
                              <th className="w-9 text-center font-medium px-0.5 py-1" title="Tasks for the selected dates">To Do</th>
                              <th className="w-9 text-center font-medium px-0.5 py-1" title="Not completed">Pend.</th>
                              <th className="w-9 text-center font-medium px-0.5 py-1">Done</th>
                              <th className="w-14 text-right font-medium px-1 py-1">Hours</th>
                            </tr>
                          </thead>
                          <tbody>
                            {dept.projects.map((p) => (
                              <tr key={p.project_id || 'none'} className={`border-t ${isDark ? 'border-[#27272a]' : 'border-gray-200'}`}>
                                <td className={`px-1 py-1.5 truncate ${textClass}`} title={p.project_name}>{p.project_name}</td>
                                <td className="px-0.5 py-1.5 text-center text-[#3b82f6]">{p.to_do}</td>
                                <td className="px-0.5 py-1.5 text-center text-[#f59e0b]">{p.pending}</td>
                                <td className="px-0.5 py-1.5 text-center text-[#22c55e]">{p.completed}</td>
                                <td className="px-1 py-1.5 text-right">
                                  <button
                                    type="button"
                                    onClick={() => setHoursPopup({ dept, project: p })}
                                    className="text-[#6366f1] hover:underline font-medium whitespace-nowrap"
                                    data-testid={`dashboard-ops-hours-${dept.key}-${p.project_id || 'none'}`}
                                  >
                                    {fmtHours(p.worked_seconds)}
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Row 3: Finance */}
        <Card className={cardClass}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className={`flex items-center gap-2 ${textClass}`}>
                <div className="p-2 rounded-lg bg-[#8b5cf6]/20">
                  <DollarSign className="h-5 w-5 text-[#8b5cf6]" />
                </div>
                Finance
              </CardTitle>
              <DateRangePicker 
                dateRange={financeDateRange} 
                onDateChange={setFinanceDateRange}
                isDark={isDark}
              />
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Cash In */}
              <div className={`p-5 rounded-xl border ${sectionClass}`}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 rounded-xl bg-[#22c55e]/20">
                    <ArrowUpCircle className="h-6 w-6 text-[#22c55e]" />
                  </div>
                  <div>
                    <p className={`text-sm font-medium ${mutedClass}`}>Cash In</p>
                    <p className={`text-2xl font-bold text-[#22c55e]`}>{formatCurrency(financeData.cashIn)}</p>
                  </div>
                </div>
              </div>

              {/* Cash Out */}
              <div className={`p-5 rounded-xl border ${sectionClass}`}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 rounded-xl bg-[#ef4444]/20">
                    <ArrowDownCircle className="h-6 w-6 text-[#ef4444]" />
                  </div>
                  <div>
                    <p className={`text-sm font-medium ${mutedClass}`}>Cash Out</p>
                    <p className={`text-2xl font-bold text-[#ef4444]`}>{formatCurrency(financeData.cashOut)}</p>
                  </div>
                </div>
              </div>

              {/* Till Month Revenue */}
              <div className={`p-5 rounded-xl border ${sectionClass}`}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 rounded-xl bg-[#6366f1]/20">
                    <Wallet className="h-6 w-6 text-[#6366f1]" />
                  </div>
                  <div>
                    <p className={`text-sm font-medium ${mutedClass}`}>Till Month Revenue</p>
                    <p className={`text-2xl font-bold ${textClass}`}>{formatCurrency(financeData.monthRevenue)}</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 24 Weeks Challenge — Finance / Sales / Marketing weekly tracker, kept last */}
        <WeeklyChallengeTracker isDark={isDark} isAdmin={isAdmin} />
      </div>

      {/* HR card popup — people behind the clicked number */}
      <Dialog open={!!hrPopup} onOpenChange={(o) => !o && setHrPopup(null)}>
        <DialogContent className={`max-w-2xl ${isDark ? 'bg-[#18181b] border-[#27272a]' : 'bg-white'}`}>
          <DialogHeader>
            <DialogTitle className={textClass}>
              {hrPopup && HR_LISTS[hrPopup].label} ({hrPopup ? hrData[hrPopup].length : 0})
            </DialogTitle>
          </DialogHeader>
          {hrPopup && (() => {
            const rows = hrData[hrPopup];
            const multiDay = new Set(rows.map((r) => r.date)).size > 1;
            const showTimes = hrPopup !== 'absent';
            return rows.length === 0 ? (
              <p className={`text-sm py-6 text-center ${mutedClass}`}>No one in this list for the selected dates.</p>
            ) : (
              <div className="max-h-[60vh] overflow-y-auto">
                <table className="w-full text-sm" data-testid="dashboard-hr-popup-table">
                  <thead className={`${mutedClass} text-xs uppercase tracking-wide`}>
                    <tr>
                      <th className="text-left px-2 py-2">Name</th>
                      <th className="text-left px-2 py-2">Department</th>
                      {multiDay && <th className="text-left px-2 py-2">Date</th>}
                      {showTimes && <th className="text-left px-2 py-2">Login</th>}
                      {showTimes && <th className="text-left px-2 py-2">Logout</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={`${r.user_id}-${r.date}`} className={`border-t ${isDark ? 'border-[#27272a]' : 'border-gray-100'}`}>
                        <td className={`px-2 py-2 font-medium ${textClass}`}>
                          {r.name}
                          {r.designation && <span className={`block text-xs font-normal ${mutedClass}`}>{r.designation}</span>}
                        </td>
                        <td className={`px-2 py-2 capitalize ${mutedClass}`}>{(r.department || '—').replace(/_/g, ' ')}</td>
                        {multiDay && <td className={`px-2 py-2 ${mutedClass}`}>{format(new Date(`${r.date}T00:00:00`), 'dd MMM')}</td>}
                        {showTimes && (
                          <td className={`px-2 py-2 ${textClass}`}>
                            <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5 text-[#22c55e]" />{fmtTime(r.login_time)}</span>
                          </td>
                        )}
                        {showTimes && (
                          <td className={`px-2 py-2 ${mutedClass}`}>
                            {r.is_clocked_in ? <Badge className="bg-[#22c55e]/15 text-[#22c55e]">Working</Badge> : fmtTime(r.logout_time)}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Operations worked-hours popup — who worked on the project, and how long */}
      <Dialog open={!!hoursPopup} onOpenChange={(o) => !o && setHoursPopup(null)}>
        <DialogContent className={`max-w-md ${isDark ? 'bg-[#18181b] border-[#27272a]' : 'bg-white'}`}>
          <DialogHeader>
            <DialogTitle className={textClass}>
              {hoursPopup?.project.project_name}
              <span className={`block text-xs font-normal mt-1 ${mutedClass}`}>
                {hoursPopup?.dept.label} · Worked hours
                {opsDateRange.from && ` · ${format(opsDateRange.from, 'dd MMM')}${opsDateRange.to && ymd(opsDateRange.to) !== ymd(opsDateRange.from) ? ` – ${format(opsDateRange.to, 'dd MMM yyyy')}` : ` ${format(opsDateRange.from, 'yyyy')}`}`}
              </span>
            </DialogTitle>
          </DialogHeader>
          {hoursPopup && (hoursPopup.project.people.length === 0 ? (
            <p className={`text-sm py-6 text-center ${mutedClass}`}>No time tracked on this project for the selected dates.</p>
          ) : (
            <table className="w-full text-sm" data-testid="dashboard-ops-hours-popup">
              <thead className={`${mutedClass} text-xs uppercase tracking-wide`}>
                <tr>
                  <th className="text-left px-2 py-2">Person</th>
                  <th className="text-right px-2 py-2">Hours</th>
                </tr>
              </thead>
              <tbody>
                {hoursPopup.project.people.map((person) => (
                  <tr key={person.user_id} className={`border-t ${isDark ? 'border-[#27272a]' : 'border-gray-100'}`}>
                    <td className={`px-2 py-2 ${textClass}`}>{person.name}</td>
                    <td className={`px-2 py-2 text-right ${textClass}`}>{fmtHours(person.seconds)}</td>
                  </tr>
                ))}
                <tr className={`border-t-2 font-bold ${isDark ? 'border-[#3f3f46]' : 'border-gray-200'}`}>
                  <td className={`px-2 py-2 ${textClass}`}>Total</td>
                  <td className="px-2 py-2 text-right text-[#6366f1]">{fmtHours(hoursPopup.project.worked_seconds)}</td>
                </tr>
              </tbody>
            </table>
          ))}
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default Dashboard;
