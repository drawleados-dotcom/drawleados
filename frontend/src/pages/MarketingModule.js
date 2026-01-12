import React, { useState, useEffect, useCallback } from 'react';
import Layout from '../components/Layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { 
  BarChart3, 
  FileText, 
  Share2, 
  Mail, 
  RefreshCw,
  AlertCircle,
  Database
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

// Tab Components
import AnalyticsTab from '../components/marketing/AnalyticsTab';
import BlogTab from '../components/marketing/BlogTab';
import SocialMediaTab from '../components/marketing/SocialMediaTab';
import EmailTab from '../components/marketing/EmailTab';

const API = process.env.REACT_APP_BACKEND_URL;

const MarketingModule = () => {
  const [activeTab, setActiveTab] = useState('analytics');
  const [dashboard, setDashboard] = useState(null);
  const [integrations, setIntegrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);

  const token = localStorage.getItem('session_token');

  const loadDashboard = useCallback(async () => {
    try {
      const [dashRes, intRes] = await Promise.all([
        axios.get(`${API}/api/marketing/dashboard`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API}/api/marketing/integrations`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);
      setDashboard(dashRes.data);
      setIntegrations(intRes.data);
    } catch (error) {
      console.error('Error loading dashboard:', error);
      toast.error('Failed to load marketing data');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const seedDemoData = async () => {
    setSeeding(true);
    try {
      await axios.post(`${API}/api/marketing/seed-demo`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Demo data seeded successfully!');
      loadDashboard();
    } catch (error) {
      console.error('Error seeding demo data:', error);
      toast.error('Failed to seed demo data');
    } finally {
      setSeeding(false);
    }
  };

  const isConnected = (type) => {
    const integration = integrations.find(i => i.type === type);
    return integration?.connected || false;
  };

  return (
    <Layout>
      <div className="space-y-6" data-testid="marketing-module">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1
              className="text-4xl font-bold tracking-tight mb-2"
              style={{ fontFamily: 'Plus Jakarta Sans' }}
            >
              <span className="bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] bg-clip-text text-transparent">
                Marketing Hub
              </span>
            </h1>
            <p className="text-[#a1a1aa] text-base">
              Analytics, content calendar, and campaign management
            </p>
          </div>
          <div className="flex items-center gap-3">
            {dashboard?.total_content === 0 && (
              <Button
                onClick={seedDemoData}
                disabled={seeding}
                data-testid="seed-demo-btn"
                className="bg-[#27272a] hover:bg-[#3f3f46] text-white"
              >
                {seeding ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Database className="h-4 w-4 mr-2" />
                )}
                Load Demo Data
              </Button>
            )}
            <Button
              onClick={loadDashboard}
              variant="outline"
              data-testid="refresh-btn"
              className="border-[#27272a]"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Integration Status Banner */}
        {!isConnected('google_analytics') && !isConnected('wordpress') && !isConnected('gmail') && (
          <div className="bg-[#1c1917] border border-[#422006] rounded-lg p-4 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-[#f59e0b]" />
            <div className="flex-1">
              <p className="text-sm text-[#fafafa]">
                <strong>Demo Mode:</strong> Connect your integrations for live data. 
                Currently showing sample data.
              </p>
            </div>
            <Badge className="bg-[#422006] text-[#f59e0b] hover:bg-[#422006]">
              Demo Data
            </Badge>
          </div>
        )}

        {/* Quick Stats */}
        {dashboard && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-[#18181b] border border-[#27272a] rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-[#6366f1]/20 flex items-center justify-center">
                  <Share2 className="h-5 w-5 text-[#6366f1]" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[#fafafa]">{dashboard.total_content}</p>
                  <p className="text-sm text-[#71717a]">Total Content</p>
                </div>
              </div>
            </div>
            <div className="bg-[#18181b] border border-[#27272a] rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-[#10b981]/20 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-[#10b981]" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[#fafafa]">{dashboard.blog_stats?.published || 0}</p>
                  <p className="text-sm text-[#71717a]">Blogs Published</p>
                </div>
              </div>
            </div>
            <div className="bg-[#18181b] border border-[#27272a] rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-[#f59e0b]/20 flex items-center justify-center">
                  <BarChart3 className="h-5 w-5 text-[#f59e0b]" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[#fafafa]">
                    {dashboard.platform_stats?.reduce((acc, p) => acc + p.scheduled, 0) || 0}
                  </p>
                  <p className="text-sm text-[#71717a]">Scheduled Posts</p>
                </div>
              </div>
            </div>
            <div className="bg-[#18181b] border border-[#27272a] rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-[#ef4444]/20 flex items-center justify-center">
                  <Mail className="h-5 w-5 text-[#ef4444]" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[#fafafa]">
                    {dashboard.upcoming_content?.length || 0}
                  </p>
                  <p className="text-sm text-[#71717a]">This Week</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="bg-[#18181b] border border-[#27272a] p-1">
            <TabsTrigger
              value="analytics"
              data-testid="analytics-tab"
              className="data-[state=active]:bg-[#6366f1] data-[state=active]:text-white flex items-center gap-2"
            >
              <BarChart3 className="h-4 w-4" />
              Analytics
              {!isConnected('google_analytics') && (
                <Badge className="bg-[#422006] text-[#f59e0b] text-xs px-1">Demo</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="blog"
              data-testid="blog-tab"
              className="data-[state=active]:bg-[#6366f1] data-[state=active]:text-white flex items-center gap-2"
            >
              <FileText className="h-4 w-4" />
              Blog
              {!isConnected('wordpress') && (
                <Badge className="bg-[#422006] text-[#f59e0b] text-xs px-1">Demo</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="social"
              data-testid="social-tab"
              className="data-[state=active]:bg-[#6366f1] data-[state=active]:text-white flex items-center gap-2"
            >
              <Share2 className="h-4 w-4" />
              Social Media
            </TabsTrigger>
            <TabsTrigger
              value="email"
              data-testid="email-tab"
              className="data-[state=active]:bg-[#6366f1] data-[state=active]:text-white flex items-center gap-2"
            >
              <Mail className="h-4 w-4" />
              Email
              {!isConnected('gmail') && (
                <Badge className="bg-[#422006] text-[#f59e0b] text-xs px-1">Demo</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="analytics" className="mt-6">
            <AnalyticsTab />
          </TabsContent>

          <TabsContent value="blog" className="mt-6">
            <BlogTab />
          </TabsContent>

          <TabsContent value="social" className="mt-6">
            <SocialMediaTab dashboard={dashboard} onRefresh={loadDashboard} />
          </TabsContent>

          <TabsContent value="email" className="mt-6">
            <EmailTab />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default MarketingModule;
