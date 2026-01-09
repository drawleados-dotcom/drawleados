import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { DollarSign, FileText, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line } from 'recharts';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const RevenueTab = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('all');

  useEffect(() => {
    fetchStats();
  }, [selectedPeriod]);

  const fetchStats = async () => {
    try {
      const response = await api.get('/finance/revenue-stats');
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching revenue stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-[#a1a1aa]">Loading revenue data...</div>;
  }

  const totalRevenue = stats?.total_revenue || 0;
  const paidAmount = stats?.by_status?.paid?.total || 0;
  const pendingAmount = stats?.by_status?.draft?.total || 0;
  const overdueAmount = stats?.by_status?.overdue?.total || 0;

  const gstData = stats?.by_gst_type?.gst || {};
  const nonGstData = stats?.by_gst_type?.['non-gst'] || {};

  const statusData = Object.entries(stats?.by_status || {}).map(([status, data]) => ({
    name: status.charAt(0).toUpperCase() + status.slice(1),
    value: data.count,
    amount: data.total
  }));

  return (
    <div className="space-y-6" data-testid="revenue-tab">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-6 hover:border-[#6366f1]/20 transition-all">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-12 w-12 rounded-lg bg-[#6366f1]/20 flex items-center justify-center">
              <DollarSign className="h-6 w-6 text-[#6366f1]" strokeWidth={1.5} />
            </div>
          </div>
          <h3 className="text-3xl font-bold text-[#fafafa] mb-1">₹{totalRevenue.toLocaleString()}</h3>
          <p className="text-sm text-[#a1a1aa]">Total Revenue</p>
        </div>

        <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-6 hover:border-[#10b981]/20 transition-all">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-12 w-12 rounded-lg bg-[#10b981]/20 flex items-center justify-center">
              <CheckCircle className="h-6 w-6 text-[#10b981]" strokeWidth={1.5} />
            </div>
          </div>
          <h3 className="text-3xl font-bold text-[#fafafa] mb-1">₹{paidAmount.toLocaleString()}</h3>
          <p className="text-sm text-[#a1a1aa]">Paid</p>
        </div>

        <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-6 hover:border-[#f59e0b]/20 transition-all">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-12 w-12 rounded-lg bg-[#f59e0b]/20 flex items-center justify-center">
              <Clock className="h-6 w-6 text-[#f59e0b]" strokeWidth={1.5} />
            </div>
          </div>
          <h3 className="text-3xl font-bold text-[#fafafa] mb-1">₹{pendingAmount.toLocaleString()}</h3>
          <p className="text-sm text-[#a1a1aa]">Pending</p>
        </div>

        <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-6 hover:border-[#ef4444]/20 transition-all">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-12 w-12 rounded-lg bg-[#ef4444]/20 flex items-center justify-center">
              <AlertCircle className="h-6 w-6 text-[#ef4444]" strokeWidth={1.5} />
            </div>
          </div>
          <h3 className="text-3xl font-bold text-[#fafafa] mb-1">₹{overdueAmount.toLocaleString()}</h3>
          <p className="text-sm text-[#a1a1aa]">Overdue</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Invoice Status Distribution */}
        <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-6">
          <h2 className="text-xl font-semibold text-[#fafafa] mb-4" style={{ fontFamily: 'Plus Jakarta Sans' }}>
            Invoice Status Distribution
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={statusData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(entry) => `${entry.name} (${entry.value})`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {statusData.map((entry, index) => (
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
                formatter={(value, name, props) => [`₹${props.payload.amount.toLocaleString()}`, name]}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* GST vs Non-GST */}
        <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-6">
          <h2 className="text-xl font-semibold text-[#fafafa] mb-4" style={{ fontFamily: 'Plus Jakarta Sans' }}>
            GST vs Non-GST Revenue
          </h2>
          <div className="space-y-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[#fafafa] font-medium">GST Invoices</span>
                <span className="text-[#6366f1] font-bold">₹{gstData.total?.toLocaleString() || 0}</span>
              </div>
              <div className="h-3 bg-[#27272a] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#6366f1] rounded-full"
                  style={{
                    width: `${totalRevenue > 0 ? (gstData.total / totalRevenue) * 100 : 0}%`
                  }}
                />
              </div>
              <div className="flex items-center justify-between text-xs text-[#a1a1aa]">
                <span>{gstData.count || 0} invoices</span>
                <span>GST Collected: ₹{gstData.gst_collected?.toLocaleString() || 0}</span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[#fafafa] font-medium">Non-GST Invoices</span>
                <span className="text-[#8b5cf6] font-bold">₹{nonGstData.total?.toLocaleString() || 0}</span>
              </div>
              <div className="h-3 bg-[#27272a] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#8b5cf6] rounded-full"
                  style={{
                    width: `${totalRevenue > 0 ? (nonGstData.total / totalRevenue) * 100 : 0}%`
                  }}
                />
              </div>
              <div className="flex items-center justify-between text-xs text-[#a1a1aa]">
                <span>{nonGstData.count || 0} invoices</span>
              </div>
            </div>

            <div className="pt-4 border-t border-[#27272a]">
              <div className="flex items-center justify-between">
                <span className="text-[#fafafa] font-semibold">Total Invoices</span>
                <span className="text-[#fafafa] font-bold">{stats?.total_invoices || 0}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RevenueTab;
