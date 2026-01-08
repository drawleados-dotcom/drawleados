import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import api from '../utils/api';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const ReportsPage = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const COLORS = ['#6366f1', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#3b82f6', '#ec4899'];

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await api.get('/reports/stats');
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <p className="text-[#a1a1aa]">Loading reports...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-8" data-testid="reports-page">
        <div>
          <h1
            className="text-4xl font-bold tracking-tight mb-2"
            style={{ fontFamily: 'Plus Jakarta Sans' }}
          >
            <span className="bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] bg-clip-text text-transparent">
              Reports & Analytics
            </span>
          </h1>
          <p className="text-[#a1a1aa] text-base">Comprehensive insights into your sales pipeline</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-6">
            <h2 className="text-xl font-semibold text-[#fafafa] mb-4" style={{ fontFamily: 'Plus Jakarta Sans' }}>
              Status-wise Performance
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stats?.by_status || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="status_name" stroke="#a1a1aa" tick={{ fill: '#a1a1aa', fontSize: 12 }} />
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

          <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-6">
            <h2 className="text-xl font-semibold text-[#fafafa] mb-4" style={{ fontFamily: 'Plus Jakarta Sans' }}>
              Lead Source Distribution
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={stats?.by_source || []}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.source_name} (${entry.count})`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="count"
                >
                  {(stats?.by_source || []).map((entry, index) => (
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

          <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-6 lg:col-span-2">
            <h2 className="text-xl font-semibold text-[#fafafa] mb-4" style={{ fontFamily: 'Plus Jakarta Sans' }}>
              Service-wise Performance
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stats?.by_service || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="service_name" stroke="#a1a1aa" tick={{ fill: '#a1a1aa', fontSize: 12 }} />
                <YAxis stroke="#a1a1aa" tick={{ fill: '#a1a1aa' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#18181b',
                    border: '1px solid #27272a',
                    borderRadius: '8px',
                    color: '#fafafa',
                  }}
                />
                <Bar dataKey="count" fill="#8b5cf6" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default ReportsPage;
