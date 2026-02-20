import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import api from '../utils/api';
import {
  Users,
  TrendingUp,
  DollarSign,
  Package,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const Dashboard = () => {
  const { user, isAdmin } = useAuth();
  const { isDark } = useTheme();
  const [stats, setStats] = useState(null);
  const [recentLeads, setRecentLeads] = useState([]);
  const [loading, setLoading] = useState(true);

  const COLORS = ['#6366f1', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#3b82f6'];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [statsRes, leadsRes] = await Promise.all([
        api.get('/reports/stats'),
        api.get('/leads'),
      ]);
      setStats(statsRes.data);
      setRecentLeads(leadsRes.data.slice(0, 5));
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <p className={isDark ? 'text-[#a1a1aa]' : 'text-gray-500'}>Loading dashboard...</p>
        </div>
      </Layout>
    );
  }

  const statCards = [
    {
      title: 'Total Leads',
      value: stats?.total_leads || 0,
      icon: Users,
      color: '#6366f1',
      change: '+12%',
      trend: 'up',
    },
    {
      title: 'Active Status',
      value: stats?.by_status?.filter(s => !s.status_name.includes('Closed')).reduce((sum, s) => sum + s.count, 0) || 0,
      icon: TrendingUp,
      color: '#8b5cf6',
      change: '+8%',
      trend: 'up',
    },
    {
      title: 'Closed Won',
      value: stats?.by_status?.find(s => s.status_name === 'Closed Won')?.count || 0,
      icon: DollarSign,
      color: '#10b981',
      change: '+23%',
      trend: 'up',
    },
    {
      title: 'Services',
      value: stats?.by_service?.length || 0,
      icon: Package,
      color: '#f59e0b',
      change: '+5%',
      trend: 'up',
    },
  ];

  return (
    <Layout>
      <div className="space-y-8" data-testid="dashboard">
        {/* Header */}
        <div>
          <h1
            className="text-4xl font-bold tracking-tight mb-2"
            style={{ fontFamily: 'Plus Jakarta Sans' }}
          >
            Welcome back, <span className="bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] bg-clip-text text-transparent">{user?.name}</span>
          </h1>
          <p className="text-[#a1a1aa] text-base">Here's what's happening with your leads today.</p>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {statCards.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <div
                key={index}
                className="bg-[#18181b] border border-[#27272a] rounded-xl p-6 hover:border-[#6366f1]/20 transition-all duration-300 glow-hover"
                data-testid={`stat-card-${stat.title.toLowerCase().replace(' ', '-')}`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div
                    className="h-12 w-12 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${stat.color}20` }}
                  >
                    <Icon className="h-6 w-6" style={{ color: stat.color }} strokeWidth={1.5} />
                  </div>
                  <div className="flex items-center gap-1 text-xs">
                    {stat.trend === 'up' ? (
                      <ArrowUp className="h-3 w-3 text-[#10b981]" />
                    ) : (
                      <ArrowDown className="h-3 w-3 text-[#ef4444]" />
                    )}
                    <span className={stat.trend === 'up' ? 'text-[#10b981]' : 'text-[#ef4444]'}>
                      {stat.change}
                    </span>
                  </div>
                </div>
                <h3 className="text-3xl font-bold text-[#fafafa] mb-1">{stat.value}</h3>
                <p className="text-sm text-[#a1a1aa]">{stat.title}</p>
              </div>
            );
          })}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Status Distribution */}
          <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-6">
            <h2 className="text-xl font-semibold text-[#fafafa] mb-4" style={{ fontFamily: 'Plus Jakarta Sans' }}>
              Status Distribution
            </h2>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={stats?.by_status || []}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => entry.status_name}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="count"
                >
                  {(stats?.by_status || []).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#18181b',
                    border: '1px solid #27272a',
                    borderRadius: '8px',
                    color: '#fafafa',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Service Performance */}
          <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-6">
            <h2 className="text-xl font-semibold text-[#fafafa] mb-4" style={{ fontFamily: 'Plus Jakarta Sans' }}>
              Service Performance
            </h2>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={stats?.by_service || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis
                  dataKey="service_name"
                  stroke="#a1a1aa"
                  tick={{ fill: '#a1a1aa', fontSize: 12 }}
                />
                <YAxis stroke="#a1a1aa" tick={{ fill: '#a1a1aa' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#18181b',
                    border: '1px solid #27272a',
                    borderRadius: '8px',
                    color: '#fafafa',
                  }}
                />
                <Bar dataKey="count" fill="#6366f1" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Leads */}
        <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-6">
          <h2 className="text-xl font-semibold text-[#fafafa] mb-4" style={{ fontFamily: 'Plus Jakarta Sans' }}>
            Recent Leads
          </h2>
          <div className="space-y-3">
            {recentLeads.length > 0 ? (
              recentLeads.map((lead) => (
                <div
                  key={lead.lead_id}
                  className="flex items-center justify-between p-4 bg-[#09090b] border border-[#27272a] rounded-lg hover:border-[#6366f1]/20 transition-all duration-300"
                >
                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-[#fafafa]">{lead.name}</h3>
                    <p className="text-xs text-[#a1a1aa] mt-1">
                      {lead.business_name} • {lead.service_name || 'No service'}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span
                      className="px-3 py-1 rounded-full text-xs font-medium"
                      style={{
                        backgroundColor: `${lead.status_color}20`,
                        color: lead.status_color,
                      }}
                    >
                      {lead.status_name}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center text-[#a1a1aa] py-8">No recent leads</p>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Dashboard;
