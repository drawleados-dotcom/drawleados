import React, { useState, useEffect, useCallback } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import axios from 'axios';
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
  Calendar,
  ArrowRight,
  ChevronRight,
  Package,
  Target,
  Search,
  Share2,
  Megaphone,
  Wallet,
  ArrowUpCircle,
  ArrowDownCircle,
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

// Date filter options
const DATE_FILTERS = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'quarter', label: 'This Quarter' },
  { value: 'year', label: 'This Year' },
];

const Dashboard = () => {
  const { user, isAdmin } = useAuth();
  const { isDark } = useTheme();
  const token = localStorage.getItem('session_token');
  const headers = { Authorization: `Bearer ${token}` };
  
  // Date filters for each section
  const [salesFilter, setSalesFilter] = useState('today');
  const [hrFilter, setHrFilter] = useState('today');
  const [websiteFilter, setWebsiteFilter] = useState('today');
  const [financeFilter, setFinanceFilter] = useState('today');
  
  // Data states
  const [salesData, setSalesData] = useState({ leads: 0, proposals: 0, deals: 0 });
  const [hrData, setHrData] = useState({ present: 0, absent: 0, wfh: 0, total: 0 });
  const [websiteData, setWebsiteData] = useState({ ongoing: 0, delivery: 0, newProjects: 0 });
  const [operationsData, setOperationsData] = useState({ seo: [], smm: [], meta: [] });
  const [financeData, setFinanceData] = useState({ cashIn: 0, cashOut: 0, monthRevenue: 0 });
  const [loading, setLoading] = useState(true);

  // Fetch Sales Data
  const fetchSalesData = useCallback(async () => {
    try {
      const [leadsRes, statsRes] = await Promise.all([
        axios.get(`${API}/api/leads`, { headers }),
        axios.get(`${API}/api/reports/stats`, { headers })
      ]);
      
      const leads = leadsRes.data || [];
      const stats = statsRes.data || {};
      
      // Filter by date
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      let filteredLeads = leads;
      if (salesFilter === 'today') {
        filteredLeads = leads.filter(l => {
          const created = new Date(l.created_at);
          return created >= today;
        });
      } else if (salesFilter === 'week') {
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        filteredLeads = leads.filter(l => new Date(l.created_at) >= weekAgo);
      } else if (salesFilter === 'month') {
        const monthAgo = new Date(today);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        filteredLeads = leads.filter(l => new Date(l.created_at) >= monthAgo);
      }
      
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
  }, [salesFilter, token]);

  // Fetch HR Data
  const fetchHRData = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/hr/admin/dashboard-stats`, { headers });
      setHrData({
        present: res.data.present_today || 0,
        absent: res.data.absent_today || 0,
        wfh: res.data.wfh_today || 0,
        total: res.data.total_employees || 0
      });
    } catch (error) {
      console.error('Error fetching HR:', error);
    }
  }, [token]);

  // Fetch Website Projects Data
  const fetchWebsiteData = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/website-projects/dashboard`, { headers });
      const projects = await axios.get(`${API}/api/website-projects/projects`, { headers });
      
      const projectList = projects.data || [];
      const ongoing = projectList.filter(p => p.status === 'active').length;
      const delivery = projectList.filter(p => p.progress >= 90).length;
      
      // Count new projects (created this week)
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const newProjects = projectList.filter(p => new Date(p.created_at) >= weekAgo).length;
      
      setWebsiteData({
        ongoing,
        delivery,
        newProjects
      });
    } catch (error) {
      console.error('Error fetching website:', error);
    }
  }, [token]);

  // Fetch Operations Data (SEO, SMM, Meta clients)
  const fetchOperationsData = useCallback(async () => {
    try {
      // Get leads/clients by service type
      const res = await axios.get(`${API}/api/leads`, { headers });
      const leads = res.data || [];
      
      const seoClients = leads.filter(l => 
        l.service_name?.toLowerCase().includes('seo') && 
        (l.status_name === 'Closed Won' || l.status_name === 'Active')
      );
      const smmClients = leads.filter(l => 
        (l.service_name?.toLowerCase().includes('smm') || l.service_name?.toLowerCase().includes('social')) && 
        (l.status_name === 'Closed Won' || l.status_name === 'Active')
      );
      const metaClients = leads.filter(l => 
        (l.service_name?.toLowerCase().includes('meta') || l.service_name?.toLowerCase().includes('ads')) && 
        (l.status_name === 'Closed Won' || l.status_name === 'Active')
      );
      
      setOperationsData({
        seo: seoClients,
        smm: smmClients,
        meta: metaClients
      });
    } catch (error) {
      console.error('Error fetching operations:', error);
    }
  }, [token]);

  // Fetch Finance Data
  const fetchFinanceData = useCallback(async () => {
    try {
      const now = new Date();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();
      
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
  }, [token]);

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      await Promise.all([
        fetchSalesData(),
        fetchHRData(),
        fetchWebsiteData(),
        fetchOperationsData(),
        fetchFinanceData()
      ]);
      setLoading(false);
    };
    loadAll();
  }, []);

  useEffect(() => { fetchSalesData(); }, [salesFilter]);
  useEffect(() => { fetchHRData(); }, [hrFilter]);
  useEffect(() => { fetchWebsiteData(); }, [websiteFilter]);
  useEffect(() => { fetchFinanceData(); }, [financeFilter]);

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
          <p className={mutedClass}>Here's your business overview for today</p>
        </div>

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
                <Select value={salesFilter} onValueChange={setSalesFilter}>
                  <SelectTrigger className={`w-[120px] h-8 text-xs ${isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DATE_FILTERS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                  </SelectContent>
                </Select>
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
                <Select value={hrFilter} onValueChange={setHrFilter}>
                  <SelectTrigger className={`w-[120px] h-8 text-xs ${isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DATE_FILTERS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className={`p-4 rounded-xl text-center ${sectionClass}`}>
                  <UserCheck className="h-6 w-6 mx-auto mb-2 text-[#22c55e]" />
                  <p className={`text-2xl font-bold ${textClass}`}>{hrData.present}</p>
                  <p className={`text-xs ${mutedClass}`}>People Present</p>
                </div>
                <div className={`p-4 rounded-xl text-center ${sectionClass}`}>
                  <UserX className="h-6 w-6 mx-auto mb-2 text-[#ef4444]" />
                  <p className={`text-2xl font-bold ${textClass}`}>{hrData.absent}</p>
                  <p className={`text-xs ${mutedClass}`}>Absent</p>
                </div>
                <div className={`p-4 rounded-xl text-center ${sectionClass}`}>
                  <Home className="h-6 w-6 mx-auto mb-2 text-[#8b5cf6]" />
                  <p className={`text-2xl font-bold ${textClass}`}>{hrData.wfh}</p>
                  <p className={`text-xs ${mutedClass}`}>Work From Home</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Row 2: Operations */}
        <Card className={cardClass}>
          <CardHeader className="pb-3">
            <CardTitle className={`flex items-center gap-2 ${textClass}`}>
              <div className="p-2 rounded-lg bg-[#f59e0b]/20">
                <Package className="h-5 w-5 text-[#f59e0b]" />
              </div>
              Operations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Website */}
              <div className={`p-4 rounded-xl border ${sectionClass}`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Globe className="h-5 w-5 text-[#3b82f6]" />
                    <span className={`font-semibold ${textClass}`}>Website</span>
                  </div>
                  <Select value={websiteFilter} onValueChange={setWebsiteFilter}>
                    <SelectTrigger className={`w-[90px] h-7 text-[10px] ${isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DATE_FILTERS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className={`text-sm ${mutedClass}`}>Ongoing Projects</span>
                    <Badge className="bg-[#3b82f6]/20 text-[#3b82f6]">{websiteData.ongoing}</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className={`text-sm ${mutedClass}`}>Delivery</span>
                    <Badge className="bg-[#22c55e]/20 text-[#22c55e]">{websiteData.delivery}</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className={`text-sm ${mutedClass}`}>New Project</span>
                    <Badge className="bg-[#f59e0b]/20 text-[#f59e0b]">{websiteData.newProjects}</Badge>
                  </div>
                </div>
              </div>

              {/* SEO */}
              <div className={`p-4 rounded-xl border ${sectionClass}`}>
                <div className="flex items-center gap-2 mb-4">
                  <Search className="h-5 w-5 text-[#22c55e]" />
                  <span className={`font-semibold ${textClass}`}>SEO</span>
                </div>
                <div className="text-center py-2">
                  <p className={`text-3xl font-bold ${textClass}`}>{operationsData.seo.length}</p>
                  <p className={`text-sm ${mutedClass}`}>Clients</p>
                </div>
                <Button 
                  variant="ghost" 
                  className={`w-full mt-2 text-[#6366f1] hover:bg-[#6366f1]/10`}
                  onClick={() => window.location.href = '/sop-works?service=seo'}
                >
                  Know More <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>

              {/* SMM */}
              <div className={`p-4 rounded-xl border ${sectionClass}`}>
                <div className="flex items-center gap-2 mb-4">
                  <Share2 className="h-5 w-5 text-[#ec4899]" />
                  <span className={`font-semibold ${textClass}`}>SMM</span>
                </div>
                <div className="text-center py-2">
                  <p className={`text-3xl font-bold ${textClass}`}>{operationsData.smm.length}</p>
                  <p className={`text-sm ${mutedClass}`}>Clients</p>
                </div>
                <Button 
                  variant="ghost" 
                  className={`w-full mt-2 text-[#6366f1] hover:bg-[#6366f1]/10`}
                  onClick={() => window.location.href = '/social-media'}
                >
                  Know More <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>

              {/* Meta */}
              <div className={`p-4 rounded-xl border ${sectionClass}`}>
                <div className="flex items-center gap-2 mb-4">
                  <Megaphone className="h-5 w-5 text-[#3b82f6]" />
                  <span className={`font-semibold ${textClass}`}>Meta</span>
                </div>
                <div className="text-center py-2">
                  <p className={`text-3xl font-bold ${textClass}`}>{operationsData.meta.length}</p>
                  <p className={`text-sm ${mutedClass}`}>Clients</p>
                </div>
                <Button 
                  variant="ghost" 
                  className={`w-full mt-2 text-[#6366f1] hover:bg-[#6366f1]/10`}
                  onClick={() => window.location.href = '/sop-works?service=meta_ads'}
                >
                  Know More <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
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
              <Select value={financeFilter} onValueChange={setFinanceFilter}>
                <SelectTrigger className={`w-[120px] h-8 text-xs ${isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DATE_FILTERS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                </SelectContent>
              </Select>
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
      </div>
    </Layout>
  );
};

export default Dashboard;
