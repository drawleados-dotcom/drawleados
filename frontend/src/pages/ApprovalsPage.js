import React, { useState, useEffect, useCallback } from 'react';
import Layout from '../components/Layout';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import {
  Check, X, Clock, Calendar, User, Users, FileText, Globe, 
  CheckCircle2, AlertCircle, ExternalLink, MessageSquare,
  Filter, RefreshCw, Eye, BarChart3, Megaphone, Search,
  TrendingUp, DollarSign, Briefcase, Code
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

// Department tabs
const DEPARTMENTS = [
  { id: 'all', label: 'All', icon: Filter },
  { id: 'website', label: 'Website', icon: Globe },
  { id: 'social_media', label: 'Social Media', icon: Users },
  { id: 'meta', label: 'Meta Ads', icon: Megaphone },
  { id: 'seo', label: 'SEO', icon: TrendingUp },
  { id: 'finance', label: 'Finance', icon: DollarSign },
  { id: 'hr', label: 'HR', icon: Briefcase },
  { id: 'business_dev', label: 'Business Dev', icon: BarChart3 },
  { id: 'erp', label: 'ERP', icon: Code }
];

export default function ApprovalsPage() {
  const { isDark } = useTheme();
  const { user } = useAuth();
  
  const [activeTab, setActiveTab] = useState('all');
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0]); // Today's date default
  const [searchTerm, setSearchTerm] = useState('');
  
  const token = localStorage.getItem('session_token');
  
  // Theme classes
  const bgCard = isDark ? 'bg-[#18181b]' : 'bg-white';
  const bgSecondary = isDark ? 'bg-[#27272a]' : 'bg-gray-100';
  const bgTertiary = isDark ? 'bg-[#0c0a09]' : 'bg-gray-50';
  const borderColor = isDark ? 'border-[#3f3f46]' : 'border-gray-200';
  const textPrimary = isDark ? 'text-[#fafafa]' : 'text-gray-900';
  const textSecondary = isDark ? 'text-[#a1a1aa]' : 'text-gray-600';

  // Load approvals
  const loadApprovals = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API}/api/approvals/pending`, {
        params: { 
          department: activeTab === 'all' ? '' : activeTab,
          date: dateFilter
        },
        headers: { Authorization: `Bearer ${token}` }
      });
      setApprovals(res.data || []);
    } catch (error) {
      console.error('Error loading approvals:', error);
      setApprovals([]);
    } finally {
      setLoading(false);
    }
  }, [activeTab, dateFilter, token]);

  useEffect(() => {
    loadApprovals();
  }, [loadApprovals]);

  // Filter approvals
  const filteredApprovals = approvals.filter(a => {
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return a.title?.toLowerCase().includes(search) || 
             a.project_name?.toLowerCase().includes(search) ||
             a.submitted_by_name?.toLowerCase().includes(search);
    }
    return true;
  });

  // Approve item
  const handleApprove = async (approval) => {
    try {
      await axios.put(
        `${API}/api/approvals/${approval.approval_id}/approve`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Approved successfully!');
      loadApprovals();
    } catch (error) {
      toast.error('Failed to approve');
    }
  };

  // Reject/Request corrections
  const handleReject = async (approval, remarks) => {
    try {
      await axios.put(
        `${API}/api/approvals/${approval.approval_id}/reject`,
        { remarks },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Sent back for corrections');
      loadApprovals();
    } catch (error) {
      toast.error('Failed to reject');
    }
  };

  // Get department stats
  const getStats = () => {
    const total = approvals.length;
    const byDept = {};
    DEPARTMENTS.forEach(d => {
      if (d.id !== 'all') {
        byDept[d.id] = approvals.filter(a => a.department === d.id).length;
      }
    });
    return { total, byDept };
  };

  const stats = getStats();

  return (
    <Layout>
      <div className={`flex flex-col h-full ${bgTertiary}`} data-testid="approvals-page">
        {/* Header */}
        <div className={`px-6 py-4 border-b ${borderColor} ${bgCard}`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className={`text-2xl font-bold ${textPrimary}`}>Approvals</h1>
                <p className={`text-sm ${textSecondary}`}>
                  Review and approve pending requests from all departments
                </p>
              </div>
              <Badge className="bg-orange-500/20 text-orange-400 text-lg px-3 py-1">
                {stats.total} Pending
              </Badge>
            </div>
            <Button onClick={loadApprovals} variant="outline" className="gap-2">
              <RefreshCw className="h-4 w-4" /> Refresh
            </Button>
          </div>
          
          {/* Filters */}
          <div className="flex items-center gap-4 flex-wrap">
            {/* Date Filter - Default Today */}
            <div className="flex items-center gap-2">
              <Calendar className={`h-4 w-4 ${textSecondary}`} />
              <Input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className={`w-40 h-9 ${bgSecondary} border-none`}
              />
              {dateFilter !== new Date().toISOString().split('T')[0] && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setDateFilter(new Date().toISOString().split('T')[0])}
                  className="h-9 px-2 text-xs"
                >
                  Today
                </Button>
              )}
            </div>
            
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input 
                placeholder="Search approvals..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`pl-10 h-9 ${bgSecondary} border-none`}
              />
            </div>
          </div>
        </div>

        {/* Department Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <div className={`px-6 py-3 border-b ${borderColor} ${bgCard} overflow-x-auto`}>
            <TabsList className={`${bgSecondary} p-1 rounded-lg inline-flex`}>
              {DEPARTMENTS.map(dept => {
                const Icon = dept.icon;
                const count = dept.id === 'all' ? stats.total : (stats.byDept[dept.id] || 0);
                return (
                  <TabsTrigger 
                    key={dept.id} 
                    value={dept.id} 
                    className="gap-2 whitespace-nowrap"
                  >
                    <Icon className="h-4 w-4" />
                    {dept.label}
                    {count > 0 && (
                      <Badge className="bg-orange-500/20 text-orange-400 text-xs ml-1">
                        {count}
                      </Badge>
                    )}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </div>

          {/* Approvals List */}
          <TabsContent value={activeTab} className="flex-1 overflow-auto p-6">
            {loading ? (
              <div className={`text-center py-16 ${textSecondary}`}>
                <RefreshCw className="h-8 w-8 mx-auto mb-4 animate-spin" />
                <p>Loading approvals...</p>
              </div>
            ) : filteredApprovals.length === 0 ? (
              <div className={`text-center py-16 ${textSecondary}`}>
                <CheckCircle2 className="h-16 w-16 mx-auto mb-4 opacity-30" />
                <h3 className={`text-lg font-medium ${textPrimary} mb-2`}>No pending approvals</h3>
                <p>All caught up! Check back later for new requests.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredApprovals.map(approval => (
                  <ApprovalCard
                    key={approval.approval_id}
                    approval={approval}
                    onApprove={() => handleApprove(approval)}
                    onReject={(remarks) => handleReject(approval, remarks)}
                    isDark={isDark}
                    bgCard={bgCard}
                    bgSecondary={bgSecondary}
                    borderColor={borderColor}
                    textPrimary={textPrimary}
                    textSecondary={textSecondary}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}

// Approval Card Component
function ApprovalCard({ approval, onApprove, onReject, isDark, bgCard, bgSecondary, borderColor, textPrimary, textSecondary }) {
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [remarks, setRemarks] = useState('');
  
  const getDeptIcon = (dept) => {
    const found = DEPARTMENTS.find(d => d.id === dept);
    return found ? found.icon : FileText;
  };
  
  const getDeptColor = (dept) => {
    const colors = {
      website: 'bg-blue-500',
      social_media: 'bg-pink-500',
      meta: 'bg-purple-500',
      seo: 'bg-green-500',
      finance: 'bg-emerald-500',
      hr: 'bg-orange-500',
      business_dev: 'bg-cyan-500',
      erp: 'bg-indigo-500'
    };
    return colors[dept] || 'bg-gray-500';
  };
  
  const DeptIcon = getDeptIcon(approval.department);
  
  const handleRejectSubmit = () => {
    onReject(remarks);
    setShowRejectModal(false);
    setRemarks('');
  };

  return (
    <div className={`rounded-xl border ${borderColor} ${bgCard} overflow-hidden`}>
      <div className="p-4">
        <div className="flex items-start gap-4">
          {/* Department Icon */}
          <div className={`w-12 h-12 rounded-xl ${getDeptColor(approval.department)} flex items-center justify-center shrink-0`}>
            <DeptIcon className="h-6 w-6 text-white" />
          </div>
          
          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className={`font-semibold ${textPrimary}`}>{approval.title}</h3>
                <p className={`text-sm ${textSecondary}`}>
                  {approval.project_name} • {approval.stage}
                </p>
              </div>
              <Badge className={`shrink-0 ${
                approval.priority === 'high' ? 'bg-red-500/20 text-red-400' :
                approval.priority === 'medium' ? 'bg-orange-500/20 text-orange-400' :
                'bg-gray-500/20 text-gray-400'
              }`}>
                {approval.priority || 'Normal'}
              </Badge>
            </div>
            
            {/* Meta Info */}
            <div className="flex items-center gap-4 mt-2 flex-wrap">
              <div className="flex items-center gap-1">
                <User className="h-3 w-3 text-[#6366f1]" />
                <span className={`text-xs ${textSecondary}`}>By: {approval.submitted_by_name}</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3 text-orange-400" />
                <span className={`text-xs ${textSecondary}`}>
                  {new Date(approval.submitted_at).toLocaleString()}
                </span>
              </div>
              {approval.link && (
                <a 
                  href={approval.link} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-[#6366f1] hover:underline"
                >
                  <ExternalLink className="h-3 w-3" /> View Link
                </a>
              )}
            </div>
            
            {/* Description */}
            {approval.description && (
              <p className={`text-sm ${textSecondary} mt-2 line-clamp-2`}>{approval.description}</p>
            )}
          </div>
          
          {/* Actions */}
          <div className="flex gap-2 shrink-0">
            <Button 
              size="sm" 
              className="h-9 px-4 bg-green-500 hover:bg-green-600"
              onClick={onApprove}
            >
              <Check className="h-4 w-4 mr-1" /> Approve
            </Button>
            <Button 
              size="sm" 
              variant="outline"
              className="h-9 px-4 border-orange-500 text-orange-500 hover:bg-orange-500/10"
              onClick={() => setShowRejectModal(true)}
            >
              <AlertCircle className="h-4 w-4 mr-1" /> Corrections
            </Button>
          </div>
        </div>
      </div>
      
      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className={`${bgCard} rounded-xl p-6 w-full max-w-md border ${borderColor}`}>
            <h3 className={`text-lg font-semibold ${textPrimary} mb-4`}>Request Corrections</h3>
            <p className={`text-sm ${textSecondary} mb-4`}>
              Send back to: {approval.submitted_by_name}
            </p>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Enter correction remarks..."
              className={`w-full p-3 rounded-lg ${bgSecondary} ${textPrimary} border-none resize-none`}
              rows={4}
            />
            <div className="flex gap-3 mt-4">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => setShowRejectModal(false)}
              >
                Cancel
              </Button>
              <Button 
                className="flex-1 bg-orange-500 hover:bg-orange-600"
                onClick={handleRejectSubmit}
              >
                Send Corrections
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
