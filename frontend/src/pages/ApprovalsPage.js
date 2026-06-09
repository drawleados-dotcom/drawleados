import React, { useState, useEffect, useCallback } from 'react';
import Layout from '../components/Layout';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
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

// Website stage tabs
const WEBSITE_STAGES = [
  { id: 'all', label: 'All' },
  { id: 'content', label: 'Content' },
  { id: 'wireframe', label: 'Wireframe' },
  { id: 'ui', label: 'UI Design' },
  { id: 'dev', label: 'Development' },
  { id: 'responsive', label: 'Responsive' },
  { id: 'test', label: 'Testing' },
  { id: 'delivery', label: 'Delivery' }
];

export default function ApprovalsPage({ embedded = false }) {
  const { isDark } = useTheme();
  const { user } = useAuth();
  
  const [activeStage, setActiveStage] = useState('all');
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState(''); // Empty = all dates
  const [searchTerm, setSearchTerm] = useState('');
  const [approvalType, setApprovalType] = useState('ops'); // unified to Operations queue (PM/Ops toggle removed)
  const [taskApprovals, setTaskApprovals] = useState([]);
  
  // Department checkboxes - selected departments
  const [selectedDepartments, setSelectedDepartments] = useState(['all']);
  
  const token = localStorage.getItem('session_token');
  
  // Toggle department selection
  const toggleDepartment = (deptId) => {
    if (deptId === 'all') {
      // If selecting 'all', clear other selections
      setSelectedDepartments(['all']);
    } else {
      // Remove 'all' if selecting specific departments
      let newSelection = selectedDepartments.filter(d => d !== 'all');
      if (newSelection.includes(deptId)) {
        // Remove if already selected
        newSelection = newSelection.filter(d => d !== deptId);
      } else {
        // Add to selection
        newSelection = [...newSelection, deptId];
      }
      // If nothing selected, default to 'all'
      if (newSelection.length === 0) {
        setSelectedDepartments(['all']);
      } else {
        setSelectedDepartments(newSelection);
      }
    }
  };
  
  // Check if user can approve as PM or Ops
  const canApprovePM = user?.role === 'super_admin' || user?.role === 'admin' || user?.role === 'project_manager';
  const canApproveOps = user?.role === 'super_admin' || user?.role === 'admin' || 
                        (user?.designation || '').toLowerCase().includes('operation');
  
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
      // Build department filter - empty for 'all', comma-separated for specific departments
      const deptFilter = selectedDepartments.includes('all') 
        ? '' 
        : selectedDepartments.join(',');
      
      const res = await axios.get(`${API}/api/approvals/pending`, {
        params: { 
          department: deptFilter,
          date: dateFilter,
          approval_level: approvalType
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
  }, [selectedDepartments, dateFilter, token, approvalType]);

  useEffect(() => {
    loadApprovals();
  }, [loadApprovals]);

  // Load task approval requests (requests sent from Operations > My Tasks)
  const loadTaskApprovals = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/our-tasks/approvals/pending`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTaskApprovals(res.data || []);
    } catch (error) {
      console.error('Error loading task approvals:', error);
      setTaskApprovals([]);
    }
  }, [token]);

  useEffect(() => {
    loadTaskApprovals();
  }, [loadTaskApprovals]);

  // Open the View Decision modal for a task approval
  const [decisionTask, setDecisionTask] = useState(null);
  const [decisionRemarks, setDecisionRemarks] = useState('');
  const [decisionSubmitting, setDecisionSubmitting] = useState(false);

  const submitTaskDecision = async (taskId, body) => {
    setDecisionSubmitting(true);
    try {
      await axios.post(
        `${API}/api/our-tasks/tasks/${taskId}/approval-decision`,
        body,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(
        body.decision === 'approve' ? 'Task approved' :
        body.decision === 'forward_ceo' ? 'Forwarded to CEO' :
        'Task rejected and new task created'
      );
      setDecisionTask(null);
      setDecisionRemarks('');
      loadTaskApprovals();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update approval');
    } finally {
      setDecisionSubmitting(false);
    }
  };

  // Filter approvals by stage and search
  const filteredApprovals = approvals.filter(a => {
    // Department filter (if specific departments selected)
    if (!selectedDepartments.includes('all')) {
      if (!selectedDepartments.includes(a.department)) return false;
    }
    
    // Stage filter (for website department)
    if (selectedDepartments.includes('website') && activeStage !== 'all') {
      // Normalize stage name for comparison
      let stage = (a.stage || '').toLowerCase().trim();
      if (stage === 'development') stage = 'dev';
      if (stage === 'testing') stage = 'test';
      if (stage === 'ui design') stage = 'ui';
      if (stage !== activeStage) return false;
    }
    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return a.title?.toLowerCase().includes(search) || 
             a.project_name?.toLowerCase().includes(search) ||
             a.submitted_by_name?.toLowerCase().includes(search);
    }
    return true;
  });
  
  // Get stage counts for website approvals
  const getStageCounts = () => {
    const counts = { all: 0 };
    WEBSITE_STAGES.forEach(s => { counts[s.id] = 0; });
    
    approvals.forEach(a => {
      if (a.department === 'website') {
        counts.all++;
        // Normalize stage name to match our IDs
        let stage = (a.stage || '').toLowerCase().trim();
        // Handle variations
        if (stage === 'development') stage = 'dev';
        if (stage === 'testing') stage = 'test';
        if (stage === 'ui design') stage = 'ui';
        
        if (counts[stage] !== undefined) {
          counts[stage]++;
        }
      }
    });
    return counts;
  };
  
  const stageCounts = getStageCounts();

  // Approve item - route to correct endpoint based on approval level
  const handleApprove = async (approval) => {
    try {
      // For website stage tasks, use the specific PM/Ops approve endpoints
      if (approval.type === 'website_stage') {
        const endpoint = approvalType === 'pm' 
          ? `${API}/api/website-projects/stage-tasks/${approval.approval_id}/pm-approve`
          : `${API}/api/website-projects/stage-tasks/${approval.approval_id}/ops-approve`;
        
        await axios.put(
          endpoint,
          { stage: approval.stage?.toLowerCase() },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        
        const msg = approvalType === 'pm' 
          ? 'PM Approved! Waiting for Ops approval.' 
          : 'Operations Approved! Task fully approved.';
        toast.success(msg);
      } else {
        // Generic approval endpoint
        await axios.put(
          `${API}/api/approvals/${approval.approval_id}/approve`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );
        toast.success('Approved successfully!');
      }
      loadApprovals();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to approve');
    }
  };

  // Reject/Request corrections
  const handleReject = async (approval, remarks) => {
    try {
      // For website stage tasks, use stage-tasks endpoint
      if (approval.type === 'website_stage') {
        await axios.put(
          `${API}/api/website-projects/stage-tasks/${approval.approval_id}/corrections`,
          { stage: approval.stage?.toLowerCase(), remarks },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      } else {
        await axios.put(
          `${API}/api/approvals/${approval.approval_id}/reject`,
          { remarks },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }
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

  const content = (
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
          
          {/* Approval Queue toggle removed — all approvals route to Operations */}
          
          {/* Filters */}
          <div className="flex items-center gap-4 flex-wrap">
            {/* Date Filter */}
            <div className="flex items-center gap-2">
              <Calendar className={`h-4 w-4 ${textSecondary}`} />
              <Input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className={`w-40 h-9 ${bgSecondary} border-none`}
              />
              {dateFilter && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setDateFilter('')}
                  className="h-9 px-2 text-xs text-red-400"
                >
                  Clear
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

        {/* Department Checkboxes Selection */}
        <div className={`px-6 py-4 border-b ${borderColor} ${bgCard}`}>
          <div className="flex items-center gap-2 mb-3">
            <Filter className={`h-4 w-4 ${textSecondary}`} />
            <span className={`text-sm font-medium ${textPrimary}`}>Select Departments:</span>
          </div>
          <div className="flex flex-wrap gap-3">
            {DEPARTMENTS.map(dept => {
              const Icon = dept.icon;
              const count = dept.id === 'all' ? stats.total : (stats.byDept[dept.id] || 0);
              const isSelected = selectedDepartments.includes(dept.id);
              
              return (
                <label
                  key={dept.id}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl cursor-pointer transition-all border-2 ${
                    isSelected 
                      ? 'bg-[#6366f1]/20 border-[#6366f1] text-[#6366f1]' 
                      : `${bgSecondary} border-transparent ${textSecondary} hover:border-[#6366f1]/50`
                  }`}
                  data-testid={`dept-checkbox-${dept.id}`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleDepartment(dept.id)}
                    className="hidden"
                  />
                  <div className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-all ${
                    isSelected 
                      ? 'bg-[#6366f1] border-[#6366f1]' 
                      : `${isDark ? 'border-gray-600' : 'border-gray-300'}`
                  }`}>
                    {isSelected && <Check className="h-3 w-3 text-white" />}
                  </div>
                  <Icon className="h-4 w-4" />
                  <span className="text-sm font-medium">{dept.label}</span>
                  {count > 0 && (
                    <Badge className={`text-xs ${isSelected ? 'bg-[#6366f1] text-white' : 'bg-orange-500/20 text-orange-400'}`}>
                      {count}
                    </Badge>
                  )}
                </label>
              );
            })}
          </div>
        </div>
        
        {/* Stage Sub-Tabs (for Website department - shown when Website is selected) */}
        {selectedDepartments.includes('website') && (
          <div className={`px-6 py-3 border-b ${borderColor} ${bgCard}`}>
            <div className="flex items-center gap-2 mb-2">
              <Globe className={`h-4 w-4 ${textSecondary}`} />
              <span className={`text-sm ${textSecondary}`}>Website Stages:</span>
            </div>
            <div className="flex items-center gap-1 overflow-x-auto">
              {WEBSITE_STAGES.map(stage => {
                const count = stageCounts[stage.id] || 0;
                const isActive = activeStage === stage.id;
                return (
                  <button
                    key={stage.id}
                    onClick={() => setActiveStage(stage.id)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap flex items-center gap-2 ${
                      isActive 
                        ? 'bg-[#6366f1] text-white shadow-md' 
                        : `${bgSecondary} ${textSecondary} hover:bg-[#6366f1]/20 hover:text-[#6366f1]`
                    }`}
                    data-testid={`stage-tab-${stage.id}`}
                  >
                    {stage.label}
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                      isActive 
                        ? 'bg-white/20 text-white' 
                        : count > 0 
                          ? 'bg-orange-500 text-white' 
                          : `${bgCard} ${textSecondary}`
                    }`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Approvals List */}
        <div className="flex-1 overflow-auto p-6 space-y-6">
          {/* Task Approval Requests (from Operations > My Tasks) */}
          {taskApprovals.length > 0 && (
            <div>
              <h3 className={`text-base font-semibold ${textPrimary} mb-3 flex items-center gap-2`}>
                <CheckCircle2 className="h-4 w-4 text-[#6366f1]" />
                Task Approval Requests
                <Badge className="bg-[#6366f1]/20 text-[#6366f1] ml-2">{taskApprovals.length}</Badge>
              </h3>
              <div className="space-y-3">
                {taskApprovals.map(task => {
                  const req = task.approval_request || {};
                  return (
                    <div
                      key={task.task_id}
                      className={`${bgCard} border ${borderColor} rounded-lg p-4`}
                      data-testid={`task-approval-${task.task_id}`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className={`font-semibold ${textPrimary}`}>{task.task_name}</h4>
                            <Badge className="bg-[#f59e0b]/20 text-[#f59e0b]">{req.approver_role}</Badge>
                            {req.department && (
                              <Badge className="bg-[#6366f1]/20 text-[#6366f1]">{req.department}</Badge>
                            )}
                          </div>
                          <p className={`text-sm ${textSecondary} mt-1`}>
                            Requested by <span className={textPrimary}>{req.requested_by_name || '—'}</span>
                            {req.requested_at && (
                              <> · {new Date(req.requested_at).toLocaleString()}</>
                            )}
                          </p>
                          {req.note && (
                            <p className={`text-sm ${textPrimary} mt-2 italic`}>&ldquo;{req.note}&rdquo;</p>
                          )}
                          {req.work_link && (
                            <a
                              href={req.work_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-[#6366f1] hover:underline mt-2 inline-flex items-center gap-1"
                              data-testid={`task-work-link-${task.task_id}`}
                            >
                              <ExternalLink className="h-3 w-3" />
                              View Work Link
                            </a>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => { setDecisionTask(task); setDecisionRemarks(''); }}
                            className="bg-[#6366f1] hover:bg-[#4f46e5] text-white"
                            data-testid={`task-view-${task.task_id}`}
                          >
                            <Eye className="h-3 w-3 mr-1" /> View
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

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
                  approvalType={approvalType}
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
        </div>

        {/* Task Approval Decision Popup */}
        {decisionTask && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[70]" onClick={() => !decisionSubmitting && setDecisionTask(null)}>
            <div className={`${bgCard} border ${borderColor} rounded-xl w-full max-w-xl mx-4`} onClick={(e) => e.stopPropagation()}>
              <div className="p-6 border-b ${borderColor}">
                <div className="flex items-center justify-between">
                  <h3 className={`text-lg font-semibold ${textPrimary} flex items-center gap-2`}>
                    <CheckCircle2 className="h-5 w-5 text-[#6366f1]" />
                    Task Approval Decision
                  </h3>
                  <button onClick={() => !decisionSubmitting && setDecisionTask(null)} className={textSecondary}>
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>
              <div className="p-6 space-y-5">
                <div>
                  <p className={`text-sm ${textSecondary}`}>Task</p>
                  <p className={`text-base font-semibold ${textPrimary}`}>{decisionTask.task_name}</p>
                  <p className={`text-xs ${textSecondary} mt-1`}>
                    Requested by <span className={textPrimary}>{decisionTask.approval_request?.requested_by_name}</span>
                    {decisionTask.approval_request?.department && ` · ${decisionTask.approval_request.department}`}
                  </p>
                  {decisionTask.approval_request?.note && (
                    <p className={`text-sm ${textPrimary} mt-2 italic`}>&ldquo;{decisionTask.approval_request.note}&rdquo;</p>
                  )}
                  {decisionTask.approval_request?.work_link && (
                    <a
                      href={decisionTask.approval_request.work_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-[#6366f1] hover:underline mt-2 inline-flex items-center gap-1"
                      data-testid="decision-work-link"
                    >
                      <ExternalLink className="h-3 w-3" />
                      View Work Link
                    </a>
                  )}
                </div>

                {/* Approve By */}
                <div>
                  <p className={`text-sm font-medium ${textPrimary} mb-2`}>Approved By</p>
                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      onClick={() => submitTaskDecision(decisionTask.task_id, { decision: 'approve', approved_by: 'operations' })}
                      disabled={decisionSubmitting}
                      className="bg-[#3b82f6] hover:bg-[#2563eb] text-white"
                      data-testid="decision-approve-operations"
                    >
                      <Check className="h-3 w-3 mr-1" /> Operations
                    </Button>
                    <Button
                      onClick={() => submitTaskDecision(decisionTask.task_id, { decision: 'approve', approved_by: 'client' })}
                      disabled={decisionSubmitting}
                      className="bg-[#10b981] hover:bg-[#059669] text-white"
                      data-testid="decision-approve-client"
                    >
                      <Check className="h-3 w-3 mr-1" /> Client
                    </Button>
                    <Button
                      onClick={() => submitTaskDecision(decisionTask.task_id, { decision: 'forward_ceo' })}
                      disabled={decisionSubmitting}
                      className="bg-[#f59e0b] hover:bg-[#d97706] text-white"
                      data-testid="decision-forward-ceo"
                    >
                      Send to CEO
                    </Button>
                  </div>
                </div>

                {/* Reject */}
                <div className={`border-t ${borderColor} pt-5`}>
                  <p className={`text-sm font-medium ${textPrimary} mb-2`}>Or Reject (creates a new rework task)</p>
                  <textarea
                    value={decisionRemarks}
                    onChange={(e) => setDecisionRemarks(e.target.value)}
                    rows={3}
                    placeholder="Rejection remarks (required)…"
                    className={`w-full px-3 py-2 rounded-lg border ${borderColor} ${bgSecondary} ${textPrimary} text-sm`}
                    data-testid="decision-reject-remarks"
                  />
                  <Button
                    onClick={() => {
                      if (!decisionRemarks.trim()) { toast.error('Please add rejection remarks'); return; }
                      submitTaskDecision(decisionTask.task_id, {
                        decision: 'reject',
                        remarks: decisionRemarks.trim(),
                        rejected_by_role: decisionTask.approval_request?.approver_role,
                      });
                    }}
                    disabled={decisionSubmitting}
                    className="mt-3 w-full bg-[#ef4444] hover:bg-[#dc2626] text-white"
                    data-testid="decision-reject-btn"
                  >
                    <X className="h-3 w-3 mr-1" /> Reject & Create Rework Task
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
  );

  if (embedded) return content;
  return <Layout>{content}</Layout>;
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
              {approval.assignee_type && (
                <Badge className={`text-xs ${
                  approval.assignee_type === 'ceo' ? 'bg-red-500/20 text-red-400' :
                  approval.assignee_type === 'project_manager' ? 'bg-purple-500/20 text-purple-400' :
                  'bg-blue-500/20 text-blue-400'
                }`}>
                  {approval.assignee_type === 'ceo' ? 'CEO' : 
                   approval.assignee_type === 'project_manager' ? 'PM' : 'Operations'}
                </Badge>
              )}
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
