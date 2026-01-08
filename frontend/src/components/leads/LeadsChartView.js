import React from 'react';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const COLORS = ['#6366f1', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#3b82f6', '#ec4899'];

const LeadsChartView = ({ leads, statuses }) => {
  // Status distribution
  const statusData = statuses.map((status) => ({
    name: status.name,
    value: leads.filter((lead) => lead.status_id === status.status_id).length,
    color: status.color,
  }));

  // Source distribution
  const sourceMap = {};
  leads.forEach((lead) => {
    const source = lead.source_name || 'Unknown';
    sourceMap[source] = (sourceMap[source] || 0) + 1;
  });
  const sourceData = Object.entries(sourceMap).map(([name, value]) => ({ name, value }));

  // Service distribution
  const serviceMap = {};
  leads.forEach((lead) => {
    const service = lead.service_name || 'Unknown';
    serviceMap[service] = (serviceMap[service] || 0) + 1;
  });
  const serviceData = Object.entries(serviceMap).map(([name, value]) => ({ name, value }));

  return (
    <div className="space-y-6" data-testid="chart-view">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Distribution */}
        <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-6">
          <h3 className="text-lg font-semibold text-[#fafafa] mb-4" style={{ fontFamily: 'Plus Jakarta Sans' }}>
            Status Distribution
          </h3>
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
                  <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
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

        {/* Source Distribution */}
        <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-6">
          <h3 className="text-lg font-semibold text-[#fafafa] mb-4" style={{ fontFamily: 'Plus Jakarta Sans' }}>
            Lead Sources
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={sourceData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="name" stroke="#a1a1aa" tick={{ fill: '#a1a1aa', fontSize: 12 }} />
              <YAxis stroke="#a1a1aa" tick={{ fill: '#a1a1aa' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#18181b',
                  border: '1px solid #27272a',
                  borderRadius: '8px',
                  color: '#fafafa',
                }}
              />
              <Bar dataKey="value" fill="#6366f1" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Service Distribution */}
      <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-6">
        <h3 className="text-lg font-semibold text-[#fafafa] mb-4" style={{ fontFamily: 'Plus Jakarta Sans' }}>
          Service Performance
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={serviceData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
            <XAxis dataKey="name" stroke="#a1a1aa" tick={{ fill: '#a1a1aa', fontSize: 12 }} />
            <YAxis stroke="#a1a1aa" tick={{ fill: '#a1a1aa' }} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#18181b',
                border: '1px solid #27272a',
                borderRadius: '8px',
                color: '#fafafa',
              }}
            />
            <Bar dataKey="value" fill="#8b5cf6" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default LeadsChartView;
