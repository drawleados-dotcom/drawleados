import React, { useState, useEffect, useCallback } from 'react';
import Layout from '../components/Layout';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Calendar, CheckCircle, XCircle, Clock, Briefcase, Users, AlertTriangle,
  RefreshCw, Send, ChevronDown, ChevronUp, X, User
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

export default function LeaveVerificationPage() {
  const { isDark } = useTheme();
  const { user } = useAuth();
  
  const [pendingVerifications, setPendingVerifications] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedLeave, setExpandedLeave] = useState(null);
  const [leaveTasks, setLeaveTasks] = useState({});
  const [reassignments, setReassignments] = useState({});
  const [verificationRemarks, setVerificationRemarks] = useState({});
  
  const token = localStorage.getItem('session_token');
  const headers = { Authorization: `Bearer ${token}` };

  // Theme classes
  const bgCard = isDark ? 'bg-[#18181b]' : 'bg-white';
  const bgSecondary = isDark ? 'bg-[#09090b]' : 'bg-gray-50';
  const textPrimary = isDark ? 'text-[#fafafa]' : 'text-gray-900';
  const textSecondary = isDark ? 'text-[#a1a1aa]' : 'text-gray-500';
  const borderColor = isDark ? 'border-[#27272a]' : 'border-gray-200';

  // Load pending verifications
  const loadPendingVerifications = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/hr/leave/pending-verification`, { headers });
      setPendingVerifications(res.data);
    } catch (error) {
      console.error('Error loading pending verifications:', error);
    }
    setLoading(false);
  }, [token]);

  // Load all users (for reassignment dropdown)
  const loadAllUsers = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/users/basic`, { headers });
      setAllUsers(res.data);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  }, [token]);

  // Load tasks for a specific leave
  const loadTasksForLeave = async (leaveId) => {
    try {
      const res = await axios.get(`${API}/api/hr/leave/${leaveId}/tasks`, { headers });
      setLeaveTasks(prev => ({ ...prev, [leaveId]: res.data }));
    } catch (error) {
      toast.error('Failed to load tasks');
    }
  };

  useEffect(() => {
    loadPendingVerifications();
    loadAllUsers();
  }, [loadPendingVerifications, loadAllUsers]);

  // Toggle expanded state and load tasks
  const handleToggleExpand = (leaveId) => {
    if (expandedLeave === leaveId) {
      setExpandedLeave(null);
    } else {
      setExpandedLeave(leaveId);
      if (!leaveTasks[leaveId]) {
        loadTasksForLeave(leaveId);
      }
    }
  };

  // Handle task reassignment selection
  const handleReassignmentChange = (leaveId, taskId, newAssigneeId) => {
    setReassignments(prev => ({
      ...prev,
      [leaveId]: {
        ...(prev[leaveId] || {}),
        [taskId]: newAssigneeId
      }
    }));
  };

  // Handle verification (approve/reject)
  const handleVerify = async (leaveId, verified) => {
    const leaveReassignments = reassignments[leaveId] || {};
    const taskReassignments = Object.entries(leaveReassignments)
      .filter(([_, assigneeId]) => assigneeId)
      .map(([taskId, newAssigneeId]) => ({
        task_id: taskId,
        new_assignee_id: newAssigneeId,
        remarks: `Task reassigned during leave verification`
      }));

    try {
      await axios.post(`${API}/api/hr/leave/${leaveId}/verify`, {
        verified,
        task_reassignments: taskReassignments,
        verification_remarks: verificationRemarks[leaveId] || ''
      }, { headers });

      toast.success(verified ? 'Leave verified and sent for final approval' : 'Leave verification rejected');
      loadPendingVerifications();
      setExpandedLeave(null);
      setReassignments(prev => ({ ...prev, [leaveId]: {} }));
      setVerificationRemarks(prev => ({ ...prev, [leaveId]: '' }));
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to verify leave');
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  // Check access
  if (!['admin', 'super_admin', 'operations_admin', 'project_manager'].includes(user?.role)) {
    return (
      <Layout>
        <div className={`min-h-screen ${isDark ? 'bg-[#09090b]' : 'bg-gray-50'} p-6 flex items-center justify-center`}>
          <Card className={`${bgCard} border ${borderColor} p-8 text-center`}>
            <AlertTriangle className="h-12 w-12 text-[#f59e0b] mx-auto mb-4" />
            <h2 className={`text-xl font-bold ${textPrimary}`}>Access Denied</h2>
            <p className={textSecondary}>You don't have permission to access this page.</p>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className={`min-h-screen ${isDark ? 'bg-[#09090b]' : 'bg-gray-50'} p-6`} data-testid="leave-verification-page">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              <span className="bg-gradient-to-r from-[#8b5cf6] to-[#6366f1] bg-clip-text text-transparent">
                Leave Verification
              </span>
            </h1>
            <p className={textSecondary}>Review tasks and verify leave requests</p>
          </div>
          <Button onClick={loadPendingVerifications} className={`${bgSecondary} ${textSecondary}`}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card className={`${bgCard} border ${borderColor}`}>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-lg bg-[#8b5cf6]/20">
                <Clock className="h-6 w-6 text-[#8b5cf6]" />
              </div>
              <div>
                <p className={`text-2xl font-bold ${textPrimary}`}>{pendingVerifications.length}</p>
                <p className={`text-sm ${textSecondary}`}>Pending Verification</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Pending Verifications List */}
        <div className="space-y-4">
          {loading ? (
            <Card className={`${bgCard} border ${borderColor}`}>
              <CardContent className="p-8 text-center">
                <RefreshCw className="h-8 w-8 text-[#6366f1] animate-spin mx-auto mb-4" />
                <p className={textSecondary}>Loading...</p>
              </CardContent>
            </Card>
          ) : pendingVerifications.length === 0 ? (
            <Card className={`${bgCard} border ${borderColor}`}>
              <CardContent className="p-8 text-center">
                <CheckCircle className="h-12 w-12 text-[#10b981] mx-auto mb-4" />
                <p className={textPrimary}>No pending leave verifications</p>
                <p className={`text-sm ${textSecondary}`}>All clear!</p>
              </CardContent>
            </Card>
          ) : (
            pendingVerifications.map((leave) => (
              <Card key={leave.leave_id} className={`${bgCard} border ${borderColor}`}>
                <CardContent className="p-0">
                  {/* Leave Header */}
                  <button
                    onClick={() => handleToggleExpand(leave.leave_id)}
                    className={`w-full p-4 flex items-center justify-between hover:bg-[#3f3f46]/10 transition-colors`}
                    data-testid={`leave-item-${leave.leave_id}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-full bg-[#6366f1] flex items-center justify-center text-white font-bold text-lg">
                        {leave.user_name?.charAt(0).toUpperCase()}
                      </div>
                      <div className="text-left">
                        <p className={`font-semibold ${textPrimary}`}>{leave.user_name}</p>
                        <p className={`text-sm ${textSecondary}`}>
                          {formatDate(leave.start_date)} - {formatDate(leave.end_date)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <Badge className={`${
                        leave.leave_type === 'casual' ? 'bg-blue-500/20 text-blue-400' :
                        leave.leave_type === 'sick' ? 'bg-orange-500/20 text-orange-400' :
                        'bg-green-500/20 text-green-400'
                      }`}>
                        {leave.leave_type?.toUpperCase()}
                      </Badge>
                      {leave.pending_tasks_count > 0 && (
                        <Badge className="bg-[#f59e0b]/20 text-[#f59e0b]">
                          <Briefcase className="h-3 w-3 mr-1" />
                          {leave.pending_tasks_count} tasks
                        </Badge>
                      )}
                      {expandedLeave === leave.leave_id ? (
                        <ChevronUp className={`h-5 w-5 ${textSecondary}`} />
                      ) : (
                        <ChevronDown className={`h-5 w-5 ${textSecondary}`} />
                      )}
                    </div>
                  </button>

                  {/* Expanded Content */}
                  {expandedLeave === leave.leave_id && (
                    <div className={`border-t ${borderColor} p-4`}>
                      {/* Leave Details */}
                      <div className={`p-4 rounded-lg ${bgSecondary} mb-4`}>
                        <h4 className={`font-medium ${textPrimary} mb-2`}>Leave Details</h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div>
                            <p className={`text-xs ${textSecondary}`}>Reason</p>
                            <p className={`text-sm ${textPrimary}`}>{leave.reason || 'Not specified'}</p>
                          </div>
                          <div>
                            <p className={`text-xs ${textSecondary}`}>Email</p>
                            <p className={`text-sm ${textPrimary}`}>{leave.user_email}</p>
                          </div>
                          <div>
                            <p className={`text-xs ${textSecondary}`}>Requested</p>
                            <p className={`text-sm ${textPrimary}`}>{formatDate(leave.created_at)}</p>
                          </div>
                          <div>
                            <p className={`text-xs ${textSecondary}`}>Sent by HR</p>
                            <p className={`text-sm ${textPrimary}`}>{formatDate(leave.sent_for_verification_at)}</p>
                          </div>
                        </div>
                      </div>

                      {/* Tasks Section */}
                      <div className="mb-4">
                        <h4 className={`font-medium ${textPrimary} mb-3 flex items-center gap-2`}>
                          <Briefcase className="h-4 w-4" />
                          Tasks During Leave Period
                        </h4>
                        
                        {!leaveTasks[leave.leave_id] ? (
                          <div className="text-center py-4">
                            <RefreshCw className="h-6 w-6 text-[#6366f1] animate-spin mx-auto" />
                          </div>
                        ) : leaveTasks[leave.leave_id]?.tasks_count === 0 ? (
                          <div className={`p-4 rounded-lg ${bgSecondary} text-center`}>
                            <CheckCircle className="h-8 w-8 text-[#10b981] mx-auto mb-2" />
                            <p className={textPrimary}>No pending tasks during this period</p>
                            <p className={`text-sm ${textSecondary}`}>Leave can be verified without task reassignment</p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div className={`p-3 rounded-lg bg-[#f59e0b]/10 border border-[#f59e0b]/30`}>
                              <p className={`text-sm text-[#f59e0b] flex items-center gap-2`}>
                                <AlertTriangle className="h-4 w-4" />
                                {leaveTasks[leave.leave_id]?.tasks_count} task(s) need to be reassigned before approval
                              </p>
                            </div>
                            {leaveTasks[leave.leave_id]?.tasks?.map((task) => (
                              <div key={task.task_id} className={`p-4 rounded-lg border ${borderColor}`}>
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex-1">
                                    <p className={`font-medium ${textPrimary}`}>{task.task_name}</p>
                                    <p className={`text-xs ${textSecondary} mt-1`}>
                                      Due: {task.due_date} | Priority: {task.priority || 'Normal'}
                                    </p>
                                    {task.description && (
                                      <p className={`text-sm ${textSecondary} mt-2`}>{task.description}</p>
                                    )}
                                  </div>
                                  <div className="w-48">
                                    <Label className={`text-xs ${textSecondary}`}>Reassign to</Label>
                                    <select
                                      value={reassignments[leave.leave_id]?.[task.task_id] || ''}
                                      onChange={(e) => handleReassignmentChange(leave.leave_id, task.task_id, e.target.value)}
                                      className={`w-full mt-1 p-2 rounded border ${borderColor} ${bgSecondary} ${textPrimary} text-sm`}
                                    >
                                      <option value="">Select user...</option>
                                      {allUsers
                                        .filter(u => u.user_id !== leave.user_id)
                                        .map(u => (
                                          <option key={u.user_id} value={u.user_id}>
                                            {u.name} ({u.role})
                                          </option>
                                        ))
                                      }
                                    </select>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Verification Remarks */}
                      <div className="mb-4">
                        <Label className={textSecondary}>Verification Remarks (Optional)</Label>
                        <Input
                          value={verificationRemarks[leave.leave_id] || ''}
                          onChange={(e) => setVerificationRemarks(prev => ({ ...prev, [leave.leave_id]: e.target.value }))}
                          placeholder="Add remarks about task reassignment or verification..."
                          className={`${bgSecondary} border ${borderColor} ${textPrimary} mt-1`}
                        />
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-3 justify-end">
                        <Button
                          onClick={() => handleVerify(leave.leave_id, false)}
                          className="bg-[#ef4444] hover:bg-[#dc2626] text-white"
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Reject Verification
                        </Button>
                        <Button
                          onClick={() => handleVerify(leave.leave_id, true)}
                          className="bg-[#10b981] hover:bg-[#059669] text-white"
                          disabled={
                            leaveTasks[leave.leave_id]?.tasks_count > 0 &&
                            Object.keys(reassignments[leave.leave_id] || {}).length < leaveTasks[leave.leave_id]?.tasks_count
                          }
                        >
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Verify & Approve
                        </Button>
                      </div>
                      
                      {leaveTasks[leave.leave_id]?.tasks_count > 0 &&
                       Object.keys(reassignments[leave.leave_id] || {}).length < leaveTasks[leave.leave_id]?.tasks_count && (
                        <p className={`text-xs text-[#f59e0b] text-right mt-2`}>
                          Please reassign all tasks before verifying
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </Layout>
  );
}
