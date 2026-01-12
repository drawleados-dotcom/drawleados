import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { 
  TrendingUp, 
  TrendingDown, 
  Users, 
  Eye, 
  Clock,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

const AnalyticsTab = () => {
  const [data, setData] = useState(null);
  const [period, setPeriod] = useState('7d');
  const [loading, setLoading] = useState(true);

  const token = localStorage.getItem('session_token');

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/api/marketing/analytics?period=${period}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setData(res.data);
    } catch (error) {
      console.error('Error loading analytics:', error);
      toast.error('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, [token, period]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const formatChange = (value) => {
    if (value > 0) return `+${value}%`;
    return `${value}%`;
  };

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-[#6366f1]" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="analytics-tab">
      {/* Header Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-32 bg-[#18181b] border-[#27272a]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#18181b] border-[#27272a]">
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          {data.is_demo && (
            <Badge className="bg-[#422006] text-[#f59e0b]">Demo Data</Badge>
          )}
        </div>
        <Button
          onClick={loadAnalytics}
          variant="outline"
          size="sm"
          className="border-[#27272a]"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="bg-[#18181b] border-[#27272a]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Users className="h-5 w-5 text-[#6366f1]" />
              <span className={`text-sm flex items-center gap-1 ${data.summary.users_change >= 0 ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>
                {data.summary.users_change >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {formatChange(data.summary.users_change)}
              </span>
            </div>
            <p className="text-2xl font-bold text-[#fafafa]">{data.summary.users.toLocaleString()}</p>
            <p className="text-sm text-[#71717a]">Users</p>
          </CardContent>
        </Card>

        <Card className="bg-[#18181b] border-[#27272a]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Eye className="h-5 w-5 text-[#8b5cf6]" />
              <span className={`text-sm flex items-center gap-1 ${data.summary.sessions_change >= 0 ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>
                {data.summary.sessions_change >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {formatChange(data.summary.sessions_change)}
              </span>
            </div>
            <p className="text-2xl font-bold text-[#fafafa]">{data.summary.sessions.toLocaleString()}</p>
            <p className="text-sm text-[#71717a]">Sessions</p>
          </CardContent>
        </Card>

        <Card className="bg-[#18181b] border-[#27272a]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Eye className="h-5 w-5 text-[#10b981]" />
              <span className={`text-sm flex items-center gap-1 ${data.summary.pageviews_change >= 0 ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>
                {data.summary.pageviews_change >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {formatChange(data.summary.pageviews_change)}
              </span>
            </div>
            <p className="text-2xl font-bold text-[#fafafa]">{data.summary.pageviews.toLocaleString()}</p>
            <p className="text-sm text-[#71717a]">Pageviews</p>
          </CardContent>
        </Card>

        <Card className="bg-[#18181b] border-[#27272a]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <TrendingDown className="h-5 w-5 text-[#f59e0b]" />
              <span className={`text-sm flex items-center gap-1 ${data.summary.bounce_rate_change <= 0 ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>
                {data.summary.bounce_rate_change <= 0 ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
                {formatChange(data.summary.bounce_rate_change)}
              </span>
            </div>
            <p className="text-2xl font-bold text-[#fafafa]">{data.summary.bounce_rate}%</p>
            <p className="text-sm text-[#71717a]">Bounce Rate</p>
          </CardContent>
        </Card>

        <Card className="bg-[#18181b] border-[#27272a]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Clock className="h-5 w-5 text-[#ef4444]" />
            </div>
            <p className="text-2xl font-bold text-[#fafafa]">{data.summary.avg_session_duration}</p>
            <p className="text-sm text-[#71717a]">Avg Duration</p>
          </CardContent>
        </Card>
      </div>

      {/* Traffic Sources & Top Pages */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Traffic Sources */}
        <Card className="bg-[#18181b] border-[#27272a]">
          <CardHeader>
            <CardTitle className="text-[#fafafa] text-lg">Traffic Sources</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.traffic_sources.map((source, index) => (
                <div key={index} className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-[#fafafa]">{source.source}</span>
                      <span className="text-sm text-[#71717a]">{source.percentage}%</span>
                    </div>
                    <div className="h-2 bg-[#27272a] rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-[#6366f1] rounded-full transition-all"
                        style={{ width: `${source.percentage}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-sm text-[#a1a1aa] w-16 text-right">
                    {source.users.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Top Pages */}
        <Card className="bg-[#18181b] border-[#27272a]">
          <CardHeader>
            <CardTitle className="text-[#fafafa] text-lg">Top Pages</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.top_pages.map((page, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-[#0c0a09] rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="text-[#52525b] text-sm w-6">{index + 1}</span>
                    <div>
                      <p className="text-sm text-[#fafafa] flex items-center gap-1">
                        {page.page}
                        <ExternalLink className="h-3 w-3 text-[#52525b]" />
                      </p>
                      <p className="text-xs text-[#71717a]">Avg time: {page.avg_time}</p>
                    </div>
                  </div>
                  <Badge className="bg-[#27272a] text-[#a1a1aa]">
                    {page.views.toLocaleString()} views
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Daily Trend Chart Placeholder */}
      <Card className="bg-[#18181b] border-[#27272a]">
        <CardHeader>
          <CardTitle className="text-[#fafafa] text-lg">Daily Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-end gap-1">
            {data.daily_data.slice(-14).map((day, index) => {
              const maxUsers = Math.max(...data.daily_data.slice(-14).map(d => d.users));
              const height = (day.users / maxUsers) * 100;
              return (
                <div key={index} className="flex-1 flex flex-col items-center gap-2">
                  <div 
                    className="w-full bg-[#6366f1] rounded-t hover:bg-[#8b5cf6] transition-colors cursor-pointer"
                    style={{ height: `${height}%` }}
                    title={`${day.date}: ${day.users} users`}
                  />
                  <span className="text-[10px] text-[#52525b] transform rotate-45 origin-left">
                    {day.date.slice(5)}
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AnalyticsTab;
