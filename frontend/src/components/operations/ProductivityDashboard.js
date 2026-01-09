import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Users, CheckCircle, Clock, AlertCircle, TrendingUp } from 'lucide-react';
import api from '../../utils/api';

const ProductivityDashboard = ({ stats }) => {
  const [userStats, setUserStats] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUserStats();
  }, []);

  const fetchUserStats = async () => {
    try {
      const response = await api.get('/operations/productivity/stats');
      setUserStats(response.data);
    } catch (error) {
      console.error('Error fetching user stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const COLORS = ['#6366f1', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#3b82f6'];

  const pieData = stats ? [
    { name: 'Completed', value: stats.completed_tasks, color: '#10b981' },
    { name: 'In Progress', value: stats.in_progress_tasks, color: '#3b82f6' },
    { name: 'Overdue', value: stats.overdue_tasks, color: '#ef4444' },
    { name: 'Other', value: Math.max(0, stats.total_tasks - stats.completed_tasks - stats.in_progress_tasks - stats.overdue_tasks), color: '#71717a' },
  ].filter(d => d.value > 0) : [];

  return (
    <div className="space-y-6" data-testid="productivity-dashboard">
      {/* Overview Cards */}
      {stats && (
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 rounded-lg bg-[#6366f1]/20 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-[#6366f1]" />
              </div>
              <div>
                <p className="text-xs text-[#a1a1aa]">Completion Rate</p>
                <p className="text-2xl font-bold text-[#fafafa]">{stats.completion_rate}%</p>
              </div>
            </div>
          </div>
          <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 rounded-lg bg-[#10b981]/20 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-[#10b981]" />
              </div>
              <div>
                <p className="text-xs text-[#a1a1aa]">Completed Tasks</p>
                <p className="text-2xl font-bold text-[#fafafa]">{stats.completed_tasks}</p>
              </div>
            </div>
          </div>
          <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 rounded-lg bg-[#3b82f6]/20 flex items-center justify-center">
                <Clock className="h-5 w-5 text-[#3b82f6]" />
              </div>
              <div>
                <p className="text-xs text-[#a1a1aa]">In Progress</p>
                <p className="text-2xl font-bold text-[#fafafa]">{stats.in_progress_tasks}</p>
              </div>
            </div>
          </div>
          <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 rounded-lg bg-[#ef4444]/20 flex items-center justify-center">
                <AlertCircle className="h-5 w-5 text-[#ef4444]" />
              </div>
              <div>
                <p className="text-xs text-[#a1a1aa]">Overdue Tasks</p>
                <p className="text-2xl font-bold text-[#fafafa]">{stats.overdue_tasks}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-6">
        {/* Task Distribution Pie Chart */}
        <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-6">
          <h3 className="text-lg font-semibold text-[#fafafa] mb-4" style={{ fontFamily: 'Plus Jakarta Sans' }}>
            Task Distribution
          </h3>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
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
          ) : (
            <div className="h-[250px] flex items-center justify-center text-[#a1a1aa]">
              No task data available
            </div>
          )}
          <div className="flex flex-wrap justify-center gap-4 mt-4">
            {pieData.map((entry, index) => (
              <div key={index} className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full" style={{ backgroundColor: entry.color }} />
                <span className="text-xs text-[#a1a1aa]">{entry.name}: {entry.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Team Performance Bar Chart */}
        <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-6">
          <h3 className="text-lg font-semibold text-[#fafafa] mb-4" style={{ fontFamily: 'Plus Jakarta Sans' }}>
            Team Performance
          </h3>
          {userStats.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={userStats}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="user_name" tick={{ fill: '#a1a1aa', fontSize: 12 }} />
                <YAxis tick={{ fill: '#a1a1aa', fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#18181b',
                    border: '1px solid #27272a',
                    borderRadius: '8px',
                    color: '#fafafa',
                  }}
                />
                <Bar dataKey="completed_tasks" fill="#10b981" name="Completed" radius={[4, 4, 0, 0]} />
                <Bar dataKey="in_progress_tasks" fill="#3b82f6" name="In Progress" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-[#a1a1aa]">
              No user statistics available
            </div>
          )}
        </div>
      </div>

      {/* Team Members Table */}
      <div className="bg-[#18181b] border border-[#27272a] rounded-xl overflow-hidden">
        <div className="p-4 border-b border-[#27272a]">
          <h3 className="text-lg font-semibold text-[#fafafa]" style={{ fontFamily: 'Plus Jakarta Sans' }}>
            <Users className="h-5 w-5 inline-block mr-2" />
            Team Productivity
          </h3>
        </div>
        <table className="w-full">
          <thead className="bg-[#09090b]">
            <tr>
              <th className="text-left p-4 text-xs font-medium text-[#a1a1aa] uppercase">Team Member</th>
              <th className="text-left p-4 text-xs font-medium text-[#a1a1aa] uppercase">Total Tasks</th>
              <th className="text-left p-4 text-xs font-medium text-[#a1a1aa] uppercase">Completed</th>
              <th className="text-left p-4 text-xs font-medium text-[#a1a1aa] uppercase">In Progress</th>
              <th className="text-left p-4 text-xs font-medium text-[#a1a1aa] uppercase">Overdue</th>
              <th className="text-left p-4 text-xs font-medium text-[#a1a1aa] uppercase">On-Time Rate</th>
              <th className="text-left p-4 text-xs font-medium text-[#a1a1aa] uppercase">Hours Logged</th>
            </tr>
          </thead>
          <tbody>
            {userStats.map((user, index) => (
              <tr key={user.user_id || index} className="border-t border-[#27272a] hover:bg-[#27272a]/30">
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="h-8 w-8 rounded-full flex items-center justify-center text-white text-sm font-semibold"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    >
                      {user.user_name?.charAt(0).toUpperCase() || '?'}
                    </div>
                    <span className="text-sm font-medium text-[#fafafa]">{user.user_name}</span>
                  </div>
                </td>
                <td className="p-4 text-sm text-[#fafafa]">{user.total_tasks}</td>
                <td className="p-4 text-sm text-[#10b981]">{user.completed_tasks}</td>
                <td className="p-4 text-sm text-[#3b82f6]">{user.in_progress_tasks}</td>
                <td className="p-4 text-sm text-[#ef4444]">{user.overdue_tasks}</td>
                <td className="p-4 text-sm text-[#fafafa]">{user.on_time_completion_rate}%</td>
                <td className="p-4 text-sm text-[#a1a1aa]">{user.total_hours_logged}h</td>
              </tr>
            ))}
          </tbody>
        </table>
        {userStats.length === 0 && !loading && (
          <div className="p-8 text-center text-[#a1a1aa]">No team statistics available</div>
        )}
      </div>
    </div>
  );
};

export default ProductivityDashboard;
