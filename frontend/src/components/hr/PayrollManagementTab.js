import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../ui/dialog';
import { Switch } from '../ui/switch';
import { 
  Users, Search, Plus, Eye, Trash2, CreditCard, 
  Send, CheckCircle, Clock, FileText, Download,
  ChevronRight, User, Calendar, Settings, Timer
} from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;
const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const years = [2023, 2024, 2025, 2026, 2027];

export default function PayrollManagementTab({
  employees,
  selectedEmployee,
  setSelectedEmployee,
  salaryHistory,
  loadSalaryHistory,
  hikeReasons,
  showAddModal,
  setShowAddModal,
  newSalaryRecord,
  setNewSalaryRecord,
  onAddSalary,
  onDeleteSalary,
  searchQuery,
  setSearchQuery,
  payslips,
  payslipMonth,
  payslipYear,
  setPayslipMonth,
  setPayslipYear,
  onCreatePayslip,
  onSubmitForOperations,
  onOperationsReview,
  onCEOReview,
  onGeneratePayslip,
  onBulkSubmitOperations,
  onRefreshPayslips,
  companySettings,
  bgCard,
  bgSecondary,
  bgInput,
  textPrimary,
  textSecondary,
  borderColor
}) {
  const [activeSubTab, setActiveSubTab] = useState('employees');
  const [employeeSubTab, setEmployeeSubTab] = useState('salary'); // salary | history
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewPayslip, setReviewPayslip] = useState(null);
  const [reviewText, setReviewText] = useState('');
  const [reviewType, setReviewType] = useState(''); // operations | ceo
  
  // Create Payslip Modal state
  const [showCreatePayslipModal, setShowCreatePayslipModal] = useState(false);
  const [createPayslipUserId, setCreatePayslipUserId] = useState('');
  const [hrRemarks, setHrRemarks] = useState('');
  
  // Payroll Settings state
  const [payrollSettings, setPayrollSettings] = useState({
    pf_enabled: true,
    pf_percentage: 12.0,
    professional_tax_enabled: true,
    professional_tax_amount: 200.0,
    professional_tax_threshold: 15000.0,
    standard_hours_per_day: 8.0
  });
  const [settingsLoading, setSettingsLoading] = useState(false);

  const token = localStorage.getItem('session_token');
  const headers = { Authorization: `Bearer ${token}` };

  // Load payroll settings
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await axios.get(`${API}/api/payroll/settings`, { headers });
        setPayrollSettings(res.data);
      } catch (error) {
        console.error('Error loading payroll settings:', error);
      }
    };
    loadSettings();
  }, []);

  // Save payroll settings
  const handleSaveSettings = async () => {
    setSettingsLoading(true);
    try {
      await axios.put(`${API}/api/payroll/settings`, payrollSettings, { headers });
      toast.success('Payroll settings saved!');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save settings');
    }
    setSettingsLoading(false);
  };

  // Download PDF
  const handleDownloadPDF = async (payslip) => {
    try {
      const response = await axios.get(
        `${API}/api/payroll/payslip/${payslip.payslip_id}/pdf`,
        { headers, responseType: 'blob' }
      );
      
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `payslip_${payslip.employee_name.replace(' ', '_')}_${months[payslip.month - 1]}_${payslip.year}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('PDF downloaded!');
    } catch (error) {
      toast.error('Failed to download PDF');
      console.error(error);
    }
  };
  
  // Filter employees by search
  const filteredEmployees = employees.filter(emp => 
    emp.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    emp.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    emp.designation?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Handle employee selection
  const handleSelectEmployee = (emp) => {
    setSelectedEmployee(emp);
    loadSalaryHistory(emp.user_id);
    setActiveSubTab('employee-detail');
    setEmployeeSubTab('salary');
  };

  // Get status badge color
  const getStatusColor = (status) => {
    const colors = {
      'draft': 'bg-gray-500/20 text-gray-400',
      'operations_review': 'bg-[#f59e0b]/20 text-[#f59e0b]',
      'ceo_review': 'bg-[#6366f1]/20 text-[#6366f1]',
      'approved': 'bg-[#10b981]/20 text-[#10b981]',
      'generated': 'bg-[#14b8a6]/20 text-[#14b8a6]'
    };
    return colors[status] || 'bg-gray-500/20 text-gray-400';
  };

  const getStatusLabel = (status) => {
    const labels = {
      'draft': 'Draft',
      'operations_review': 'Operations Review',
      'ceo_review': 'CEO Review',
      'approved': 'Approved',
      'generated': 'Generated'
    };
    return labels[status] || status;
  };

  // Get employee payslip for current month
  const getEmployeePayslip = (userId) => {
    return payslips.find(p => p.user_id === userId);
  };

  // Get reason label
  const getReasonLabel = (reasonId) => {
    const reason = hikeReasons.find(r => r.id === reasonId);
    return reason ? reason.label : reasonId;
  };

  // Get reason color
  const getReasonColor = (reasonId) => {
    const colors = {
      'initial': 'bg-gray-500/20 text-gray-400',
      'performance': 'bg-[#10b981]/20 text-[#10b981]',
      'confirmation': 'bg-[#6366f1]/20 text-[#6366f1]',
      'annual_increase': 'bg-[#f59e0b]/20 text-[#f59e0b]',
      '6_month_review': 'bg-[#8b5cf6]/20 text-[#8b5cf6]',
      '3_month_review': 'bg-[#ec4899]/20 text-[#ec4899]',
      'promotion': 'bg-[#14b8a6]/20 text-[#14b8a6]',
      'market_adjustment': 'bg-[#3b82f6]/20 text-[#3b82f6]'
    };
    return colors[reasonId] || 'bg-gray-500/20 text-gray-400';
  };

  // Calculate duration
  const calculateDuration = (history, index) => {
    if (index === 0) {
      const effectiveDate = new Date(history[0]?.effective_from);
      const now = new Date();
      const diffMonths = (now.getFullYear() - effectiveDate.getFullYear()) * 12 + (now.getMonth() - effectiveDate.getMonth());
      return `${diffMonths} months (current)`;
    } else {
      const startDate = new Date(history[index]?.effective_from);
      const endDate = new Date(history[index - 1]?.effective_from);
      const diffMonths = (endDate.getFullYear() - startDate.getFullYear()) * 12 + (endDate.getMonth() - startDate.getMonth());
      return `${diffMonths} months`;
    }
  };

  // Handle review submit - review text is optional
  const handleSubmitReview = () => {
    // Review text is optional - can be empty
    if (reviewType === 'operations') {
      onOperationsReview(reviewPayslip.payslip_id, reviewText.trim());
    } else if (reviewType === 'ceo') {
      onCEOReview(reviewPayslip.payslip_id, reviewText.trim());
    }
    setShowReviewModal(false);
    setReviewText('');
    setReviewPayslip(null);
  };

  const subTabs = [
    { id: 'employees', label: 'All Employees' },
    { id: 'employee-detail', label: selectedEmployee ? `${selectedEmployee.name}` : 'Employee Detail', disabled: !selectedEmployee },
    { id: 'settings', label: 'Payroll Settings' },
  ];

  return (
    <div className="space-y-6" data-testid="payroll-management-tab">
      {/* Header with Month/Year Filter */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className={`text-xl font-semibold ${textPrimary}`}>Payroll Management</h2>
          <p className={`text-sm ${textSecondary}`}>Create and manage employee payslips</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-[#71717a]" />
            <select
              value={payslipMonth}
              onChange={(e) => {
                setPayslipMonth(parseInt(e.target.value));
                onRefreshPayslips();
              }}
              className={`p-2 rounded-lg ${bgInput} border ${borderColor} ${textPrimary}`}
            >
              {months.map((m, i) => (
                <option key={i} value={i + 1}>{m}</option>
              ))}
            </select>
            <select
              value={payslipYear}
              onChange={(e) => {
                setPayslipYear(parseInt(e.target.value));
                onRefreshPayslips();
              }}
              className={`p-2 rounded-lg ${bgInput} border ${borderColor} ${textPrimary}`}
            >
              {years.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <Button
            onClick={() => {
              setNewSalaryRecord({ user_id: selectedEmployee?.user_id || '', amount: '', effective_from: '', reason: 'initial', notes: '' });
              setShowAddModal(true);
            }}
            className="bg-[#10b981] hover:bg-[#059669] text-white"
            data-testid="add-salary-btn"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Salary Record
          </Button>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-2 border-b border-[#3f3f46] pb-2">
        {subTabs.map((tab) => (
          <Button
            key={tab.id}
            onClick={() => !tab.disabled && setActiveSubTab(tab.id)}
            disabled={tab.disabled}
            variant={activeSubTab === tab.id ? 'default' : 'ghost'}
            className={`${activeSubTab === tab.id 
              ? 'bg-[#6366f1] text-white' 
              : `${textSecondary} hover:bg-[#27272a]`
            } ${tab.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            size="sm"
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {/* All Employees List */}
      {activeSubTab === 'employees' && (
        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#71717a]" />
            <Input
              placeholder="Search by name, email, or designation..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`pl-10 ${bgInput} border ${borderColor} ${textPrimary}`}
              data-testid="payroll-search"
            />
          </div>

          {/* Employees Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredEmployees.map((emp) => {
              const payslip = getEmployeePayslip(emp.user_id);
              return (
                <Card 
                  key={emp.user_id} 
                  className={`${bgCard} border ${borderColor} cursor-pointer hover:border-[#6366f1] transition-colors`}
                  onClick={() => handleSelectEmployee(emp)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-full bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center text-white font-bold text-lg">
                          {emp.name?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className={`font-semibold ${textPrimary}`}>{emp.name}</p>
                          <p className={`text-sm ${textSecondary}`}>{emp.designation || 'No designation'}</p>
                        </div>
                      </div>
                      <ChevronRight className={`h-5 w-5 ${textSecondary}`} />
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className={textSecondary}>Current Salary</span>
                        <span className={`font-semibold ${emp.current_salary > 0 ? 'text-[#10b981]' : textSecondary}`}>
                          {emp.current_salary > 0 ? `₹${emp.current_salary.toLocaleString()}` : 'Not Set'}
                        </span>
                      </div>
                      
                      {payslip ? (
                        <div className="flex items-center justify-between">
                          <span className={`text-xs ${textSecondary}`}>{months[payslipMonth - 1]} Payslip</span>
                          <Badge className={getStatusColor(payslip.status)}>{getStatusLabel(payslip.status)}</Badge>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <span className={`text-xs ${textSecondary}`}>No payslip</span>
                          <Badge className="bg-gray-500/20 text-gray-400">Not Created</Badge>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Employee Detail View */}
      {activeSubTab === 'employee-detail' && selectedEmployee && (
        <div className="space-y-6">
          {/* Employee Header */}
          <Card className={`${bgCard} border ${borderColor}`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 rounded-full bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center text-white text-2xl font-bold">
                    {selectedEmployee.name?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className={`text-xl font-semibold ${textPrimary}`}>{selectedEmployee.name}</h3>
                    <p className={textSecondary}>{selectedEmployee.designation || 'No designation'}</p>
                    <p className={`text-sm ${textSecondary}`}>{selectedEmployee.email}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-sm ${textSecondary}`}>Current Salary</p>
                  <p className="text-2xl font-bold text-[#10b981]">
                    {selectedEmployee.current_salary > 0 ? `₹${selectedEmployee.current_salary.toLocaleString()}` : 'Not Set'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Employee Sub-tabs: Salary | Salary History */}
          <div className="flex gap-2 border-b border-[#3f3f46] pb-2">
            <Button
              onClick={() => setEmployeeSubTab('salary')}
              variant={employeeSubTab === 'salary' ? 'default' : 'ghost'}
              className={employeeSubTab === 'salary' ? 'bg-[#6366f1] text-white' : `${textSecondary} hover:bg-[#27272a]`}
              size="sm"
            >
              <CreditCard className="h-4 w-4 mr-2" />
              Salary / Payslip
            </Button>
            <Button
              onClick={() => setEmployeeSubTab('history')}
              variant={employeeSubTab === 'history' ? 'default' : 'ghost'}
              className={employeeSubTab === 'history' ? 'bg-[#6366f1] text-white' : `${textSecondary} hover:bg-[#27272a]`}
              size="sm"
            >
              <Clock className="h-4 w-4 mr-2" />
              Salary History
            </Button>
          </div>

          {/* Salary / Payslip Tab */}
          {employeeSubTab === 'salary' && (
            <SalaryPayslipView
              employee={selectedEmployee}
              payslips={payslips}
              payslipMonth={payslipMonth}
              payslipYear={payslipYear}
              onCreatePayslip={onCreatePayslip}
              onSubmitForOperations={onSubmitForOperations}
              onGeneratePayslip={onGeneratePayslip}
              onDownloadPDF={handleDownloadPDF}
              setShowReviewModal={setShowReviewModal}
              setReviewPayslip={setReviewPayslip}
              setReviewType={setReviewType}
              setShowCreateModal={setShowCreatePayslipModal}
              setCreateUserId={setCreatePayslipUserId}
              getStatusColor={getStatusColor}
              getStatusLabel={getStatusLabel}
              bgCard={bgCard}
              bgSecondary={bgSecondary}
              textPrimary={textPrimary}
              textSecondary={textSecondary}
              borderColor={borderColor}
            />
          )}

          {/* Salary History Tab */}
          {employeeSubTab === 'history' && (
            <SalaryHistoryView
              employee={selectedEmployee}
              salaryHistory={salaryHistory}
              hikeReasons={hikeReasons}
              onDeleteSalary={onDeleteSalary}
              setShowAddModal={setShowAddModal}
              setNewSalaryRecord={setNewSalaryRecord}
              getReasonLabel={getReasonLabel}
              getReasonColor={getReasonColor}
              calculateDuration={calculateDuration}
              bgCard={bgCard}
              bgSecondary={bgSecondary}
              textPrimary={textPrimary}
              textSecondary={textSecondary}
              borderColor={borderColor}
            />
          )}
        </div>
      )}

      {/* Payroll Settings Tab */}
      {activeSubTab === 'settings' && (
        <div className="space-y-6">
          <Card className={`${bgCard} border ${borderColor}`}>
            <CardHeader>
              <CardTitle className={`${textPrimary} flex items-center gap-2`}>
                <Settings className="h-5 w-5" />
                Payroll Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* PF Settings */}
              <div className={`p-4 rounded-lg border ${borderColor}`}>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h4 className={`font-medium ${textPrimary}`}>Provident Fund (PF)</h4>
                    <p className={`text-sm ${textSecondary}`}>Employee contribution deducted from salary</p>
                  </div>
                  <Switch
                    checked={payrollSettings.pf_enabled}
                    onCheckedChange={(checked) => setPayrollSettings({...payrollSettings, pf_enabled: checked})}
                  />
                </div>
                {payrollSettings.pf_enabled && (
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <Label className={textPrimary}>PF Percentage (%)</Label>
                      <Input
                        type="number"
                        step="0.5"
                        min="0"
                        max="50"
                        value={payrollSettings.pf_percentage}
                        onChange={(e) => setPayrollSettings({...payrollSettings, pf_percentage: parseFloat(e.target.value) || 0})}
                        className={`${bgInput} border ${borderColor} ${textPrimary} mt-1`}
                      />
                    </div>
                    <div className={`p-3 rounded-lg ${bgSecondary}`}>
                      <p className={`text-xs ${textSecondary}`}>Example (₹25,000 base)</p>
                      <p className="text-lg font-bold text-red-400">-₹{((25000 * payrollSettings.pf_percentage) / 100).toLocaleString()}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Professional Tax Settings */}
              <div className={`p-4 rounded-lg border ${borderColor}`}>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h4 className={`font-medium ${textPrimary}`}>Professional Tax</h4>
                    <p className={`text-sm ${textSecondary}`}>Fixed amount deducted if salary exceeds threshold</p>
                  </div>
                  <Switch
                    checked={payrollSettings.professional_tax_enabled}
                    onCheckedChange={(checked) => setPayrollSettings({...payrollSettings, professional_tax_enabled: checked})}
                  />
                </div>
                {payrollSettings.professional_tax_enabled && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className={textPrimary}>Tax Amount (₹)</Label>
                      <Input
                        type="number"
                        min="0"
                        value={payrollSettings.professional_tax_amount}
                        onChange={(e) => setPayrollSettings({...payrollSettings, professional_tax_amount: parseFloat(e.target.value) || 0})}
                        className={`${bgInput} border ${borderColor} ${textPrimary} mt-1`}
                      />
                    </div>
                    <div>
                      <Label className={textPrimary}>Salary Threshold (₹)</Label>
                      <Input
                        type="number"
                        min="0"
                        value={payrollSettings.professional_tax_threshold}
                        onChange={(e) => setPayrollSettings({...payrollSettings, professional_tax_threshold: parseFloat(e.target.value) || 0})}
                        className={`${bgInput} border ${borderColor} ${textPrimary} mt-1`}
                      />
                      <p className={`text-xs ${textSecondary} mt-1`}>Tax applies only if base salary exceeds this amount</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Working Hours Settings */}
              <div className={`p-4 rounded-lg border ${borderColor}`}>
                <div className="flex items-center gap-2 mb-4">
                  <Timer className="h-5 w-5 text-[#6366f1]" />
                  <div>
                    <h4 className={`font-medium ${textPrimary}`}>Working Hours</h4>
                    <p className={`text-sm ${textSecondary}`}>Used to calculate extra/less hours</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <Label className={textPrimary}>Standard Hours per Day</Label>
                    <Input
                      type="number"
                      step="0.5"
                      min="1"
                      max="24"
                      value={payrollSettings.standard_hours_per_day}
                      onChange={(e) => setPayrollSettings({...payrollSettings, standard_hours_per_day: parseFloat(e.target.value) || 8})}
                      className={`${bgInput} border ${borderColor} ${textPrimary} mt-1`}
                    />
                  </div>
                  <div className={`p-3 rounded-lg ${bgSecondary}`}>
                    <p className={`text-xs ${textSecondary}`}>22 working days</p>
                    <p className={`font-medium ${textPrimary}`}>{payrollSettings.standard_hours_per_day * 22} hrs/month</p>
                  </div>
                </div>
              </div>

              <Button
                onClick={handleSaveSettings}
                disabled={settingsLoading}
                className="bg-[#10b981] hover:bg-[#059669] text-white w-full"
              >
                {settingsLoading ? 'Saving...' : 'Save Settings'}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Review Modal */}
      <Dialog open={showReviewModal} onOpenChange={setShowReviewModal}>
        <DialogContent className={`${bgCard} border ${borderColor} max-w-md`}>
          <DialogHeader>
            <DialogTitle className={textPrimary}>
              {reviewType === 'operations' ? 'Operations Review' : 'CEO Review'}
            </DialogTitle>
            <DialogDescription className={textSecondary}>
              {reviewType === 'operations' 
                ? 'Add your monthly review for this employee (salary details are hidden). Review is optional.'
                : 'Review and approve this payslip. Review comment is optional.'
              }
            </DialogDescription>
          </DialogHeader>
          {reviewPayslip && (
            <div className="py-4 space-y-4">
              <div className={`p-3 rounded-lg ${bgSecondary}`}>
                <p className={textSecondary}>Employee: <span className={textPrimary}>{reviewPayslip.employee_name}</span></p>
                <p className={textSecondary}>Month: <span className={textPrimary}>{months[reviewPayslip.month - 1]} {reviewPayslip.year}</span></p>
                {reviewType === 'ceo' && (
                  <p className={textSecondary}>Net Salary: <span className="text-[#10b981] font-semibold">₹{reviewPayslip.net_salary?.toLocaleString()}</span></p>
                )}
              </div>
              
              {reviewPayslip.operations_review?.review_text && reviewType === 'ceo' && (
                <div className={`p-3 rounded-lg border ${borderColor}`}>
                  <p className={`text-xs ${textSecondary} mb-1`}>Operations Review by {reviewPayslip.operations_review.reviewer_name}</p>
                  <p className={textPrimary}>{reviewPayslip.operations_review.review_text}</p>
                </div>
              )}
              
              <div>
                <Label className={textPrimary}>Your Review (Optional)</Label>
                <textarea
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                  placeholder="Enter your review or leave empty to skip..."
                  rows={4}
                  className={`w-full p-3 rounded-lg mt-1 ${bgInput} border ${borderColor} ${textPrimary} resize-none`}
                />
                <p className={`text-xs ${textSecondary} mt-1`}>You can skip the review and just {reviewType === 'ceo' ? 'approve' : 'forward to CEO'}</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReviewModal(false)} className={`border ${borderColor}`}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmitReview}
              className={reviewType === 'ceo' ? "bg-[#10b981] hover:bg-[#059669] text-white" : "bg-[#6366f1] hover:bg-[#4f46e5] text-white"}
            >
              {reviewType === 'ceo' ? 'Approve' : (reviewText.trim() ? 'Submit Review' : 'Skip & Forward to CEO')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Salary Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className={`${bgCard} border ${borderColor} max-w-md`}>
          <DialogHeader>
            <DialogTitle className={textPrimary}>Add Salary Record</DialogTitle>
            <DialogDescription className={textSecondary}>
              Add a new salary record for an employee
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className={textPrimary}>Employee *</Label>
              <select
                value={newSalaryRecord.user_id}
                onChange={(e) => setNewSalaryRecord({...newSalaryRecord, user_id: e.target.value})}
                className={`w-full p-2 rounded-lg mt-1 ${bgInput} border ${borderColor} ${textPrimary}`}
              >
                <option value="">Select Employee</option>
                {employees.map((emp) => (
                  <option key={emp.user_id} value={emp.user_id}>{emp.name} ({emp.email})</option>
                ))}
              </select>
            </div>
            <div>
              <Label className={textPrimary}>Salary Amount (₹) *</Label>
              <Input
                type="number"
                placeholder="25000"
                value={newSalaryRecord.amount}
                onChange={(e) => setNewSalaryRecord({...newSalaryRecord, amount: parseFloat(e.target.value) || ''})}
                className={`${bgInput} border ${borderColor} ${textPrimary} mt-1`}
              />
            </div>
            <div>
              <Label className={textPrimary}>Effective From *</Label>
              <Input
                type="date"
                value={newSalaryRecord.effective_from}
                onChange={(e) => setNewSalaryRecord({...newSalaryRecord, effective_from: e.target.value})}
                className={`${bgInput} border ${borderColor} ${textPrimary} mt-1`}
              />
            </div>
            <div>
              <Label className={textPrimary}>Reason *</Label>
              <select
                value={newSalaryRecord.reason}
                onChange={(e) => setNewSalaryRecord({...newSalaryRecord, reason: e.target.value})}
                className={`w-full p-2 rounded-lg mt-1 ${bgInput} border ${borderColor} ${textPrimary}`}
              >
                {hikeReasons.map((reason) => (
                  <option key={reason.id} value={reason.id}>{reason.label}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className={textPrimary}>Notes (Optional)</Label>
              <Input
                placeholder="Any additional notes..."
                value={newSalaryRecord.notes}
                onChange={(e) => setNewSalaryRecord({...newSalaryRecord, notes: e.target.value})}
                className={`${bgInput} border ${borderColor} ${textPrimary} mt-1`}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddModal(false)} className={`border ${borderColor}`}>
              Cancel
            </Button>
            <Button 
              onClick={onAddSalary}
              disabled={!newSalaryRecord.user_id || !newSalaryRecord.amount || !newSalaryRecord.effective_from}
              className="bg-[#10b981] hover:bg-[#059669] text-white"
            >
              Add Salary Record
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Payslip Modal with HR Remarks */}
      <Dialog open={showCreatePayslipModal} onOpenChange={setShowCreatePayslipModal}>
        <DialogContent className={`${bgCard} border ${borderColor} max-w-md`}>
          <DialogHeader>
            <DialogTitle className={textPrimary}>Create Payslip</DialogTitle>
            <DialogDescription className={textSecondary}>
              Create payslip for {months[payslipMonth - 1]} {payslipYear}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className={`p-3 rounded-lg ${bgSecondary}`}>
              <p className={textSecondary}>Employee: <span className={`font-medium ${textPrimary}`}>
                {employees.find(e => e.user_id === createPayslipUserId)?.name || 'Unknown'}
              </span></p>
              <p className={textSecondary}>Base Salary: <span className="text-[#10b981] font-medium">
                ₹{employees.find(e => e.user_id === createPayslipUserId)?.current_salary?.toLocaleString() || 'Not Set'}
              </span></p>
            </div>
            
            <div>
              <Label className={textPrimary}>HR Remarks (Optional)</Label>
              <textarea
                value={hrRemarks}
                onChange={(e) => setHrRemarks(e.target.value)}
                placeholder="Add any remarks for this payslip..."
                rows={3}
                className={`w-full p-3 rounded-lg mt-1 ${bgInput} border ${borderColor} ${textPrimary} resize-none`}
              />
              <p className={`text-xs ${textSecondary} mt-1`}>These remarks will appear on the payslip</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowCreatePayslipModal(false);
              setHrRemarks('');
            }} className={`border ${borderColor}`}>
              Cancel
            </Button>
            <Button 
              onClick={() => {
                onCreatePayslip(createPayslipUserId, hrRemarks);
                setShowCreatePayslipModal(false);
                setHrRemarks('');
              }}
              className="bg-[#10b981] hover:bg-[#059669] text-white"
            >
              Create Payslip
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Salary/Payslip View Component
function SalaryPayslipView({
  employee,
  payslips,
  payslipMonth,
  payslipYear,
  onCreatePayslip,
  onSubmitForOperations,
  onGeneratePayslip,
  onDownloadPDF,
  setShowReviewModal,
  setReviewPayslip,
  setReviewType,
  setShowCreateModal,
  setCreateUserId,
  getStatusColor,
  getStatusLabel,
  bgCard,
  bgSecondary,
  textPrimary,
  textSecondary,
  borderColor
}) {
  const [previousPayslips, setPreviousPayslips] = useState([]);
  const [showPreviousPayslips, setShowPreviousPayslips] = useState(false);
  
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const token = localStorage.getItem('session_token');
  
  // Helper function to open create modal
  const openCreateModal = () => {
    setCreateUserId(employee.user_id);
    setShowCreateModal(true);
  };
  
  // Load previous payslips
  useEffect(() => {
    const loadPreviousPayslips = async () => {
      try {
        const res = await axios.get(
          `${API}/api/payroll/employee-payslips/${employee.user_id}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        // Filter out current month's payslip
        const prev = res.data.filter(p => !(p.month === payslipMonth && p.year === payslipYear));
        setPreviousPayslips(prev);
      } catch (error) {
        console.error('Error loading previous payslips:', error);
      }
    };
    if (employee?.user_id) {
      loadPreviousPayslips();
    }
  }, [employee?.user_id, payslipMonth, payslipYear, token]);
  
  const payslip = payslips.find(p => p.user_id === employee.user_id);
  
  if (!payslip) {
    return (
      <div className="space-y-6">
        <Card className={`${bgCard} border ${borderColor}`}>
          <CardContent className="py-12 text-center">
            <CreditCard className="h-12 w-12 text-[#3f3f46] mx-auto mb-4" />
            <p className={textPrimary}>No payslip for {months[payslipMonth - 1]} {payslipYear}</p>
            <p className={`text-sm ${textSecondary} mb-4`}>Create a payslip based on attendance and salary records</p>
            <Button 
              onClick={openCreateModal}
              className="bg-[#10b981] hover:bg-[#059669] text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Payslip
            </Button>
          </CardContent>
        </Card>
        
        {/* Previous Payslips for when no current payslip exists */}
        {previousPayslips.length > 0 && (
          <Card className={`${bgCard} border ${borderColor}`}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className={`${textPrimary} text-lg`}>Previous Payslips</CardTitle>
              <Badge className="bg-[#6366f1]/20 text-[#6366f1]">{previousPayslips.length} records</Badge>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {previousPayslips.slice(0, 6).map((p) => (
                  <div key={p.payslip_id} className={`p-3 rounded-lg border ${borderColor} flex items-center justify-between`}>
                    <div>
                      <p className={`font-medium ${textPrimary}`}>{months[p.month - 1]} {p.year}</p>
                      <p className={`text-sm ${p.net_salary >= 0 ? 'text-[#10b981]' : 'text-red-400'}`}>
                        ₹{p.net_salary?.toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={getStatusColor(p.status)}>{getStatusLabel(p.status)}</Badge>
                      {p.status === 'generated' && (
                        <Button
                          onClick={() => onDownloadPDF(p)}
                          variant="ghost"
                          size="sm"
                          className="text-[#6366f1]"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Payslip Status Card */}
      <Card className={`${bgCard} border ${borderColor}`}>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className={textPrimary}>{months[payslipMonth - 1]} {payslipYear} Payslip</CardTitle>
            <p className={`text-sm ${textSecondary}`}>Employee ID: {payslip.employee_id || 'N/A'}</p>
          </div>
          <Badge className={getStatusColor(payslip.status)}>{getStatusLabel(payslip.status)}</Badge>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Attendance Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
            <div className={`p-3 rounded-lg ${bgSecondary} text-center`}>
              <p className={`text-xs ${textSecondary}`}>Working Days</p>
              <p className={`text-lg font-bold ${textPrimary}`}>{payslip.attendance?.total_working_days || 0}</p>
            </div>
            <div className={`p-3 rounded-lg ${bgSecondary} text-center`}>
              <p className={`text-xs ${textSecondary}`}>Present</p>
              <p className="text-lg font-bold text-[#10b981]">{payslip.attendance?.days_present || 0}</p>
            </div>
            <div className={`p-3 rounded-lg ${bgSecondary} text-center`}>
              <p className={`text-xs ${textSecondary}`}>Casual Leave</p>
              <p className="text-lg font-bold text-[#6366f1]">{payslip.attendance?.casual_leaves || 0}</p>
            </div>
            <div className={`p-3 rounded-lg ${bgSecondary} text-center`}>
              <p className={`text-xs ${textSecondary}`}>Sick Leave</p>
              <p className="text-lg font-bold text-[#f59e0b]">{payslip.attendance?.sick_leaves || 0}</p>
            </div>
            <div className={`p-3 rounded-lg ${bgSecondary} text-center`}>
              <p className={`text-xs ${textSecondary}`}>Absent (LOP)</p>
              <p className="text-lg font-bold text-red-400">{payslip.attendance?.absent_days || 0}</p>
            </div>
            <div className={`p-3 rounded-lg ${bgSecondary} text-center`}>
              <p className={`text-xs ${textSecondary}`}>Holidays</p>
              <p className={`text-lg font-bold ${textPrimary}`}>{payslip.attendance?.holidays || 0}</p>
            </div>
            <div className={`p-3 rounded-lg ${bgSecondary} text-center`}>
              <p className={`text-xs ${textSecondary}`}>Extra Hours</p>
              <p className="text-lg font-bold text-[#10b981]">{payslip.attendance?.extra_hours?.toFixed(1) || 0}</p>
            </div>
            <div className={`p-3 rounded-lg ${bgSecondary} text-center`}>
              <p className={`text-xs ${textSecondary}`}>Less Hours</p>
              <p className="text-lg font-bold text-[#f59e0b]">{payslip.attendance?.less_hours?.toFixed(1) || 0}</p>
            </div>
          </div>

          {/* Salary Calculation */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className={`p-4 rounded-lg border ${borderColor}`}>
              <h4 className={`font-medium ${textPrimary} mb-3`}>Earnings</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className={textSecondary}>Base Salary</span>
                  <span className={textPrimary}>₹{payslip.base_salary?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className={textSecondary}>Per Day</span>
                  <span className={textPrimary}>₹{payslip.calculation?.per_day_salary?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className={textSecondary}>Days Paid</span>
                  <span className={textPrimary}>{payslip.calculation?.days_paid}</span>
                </div>
                <div className={`flex justify-between pt-2 border-t ${borderColor}`}>
                  <span className={`font-medium ${textPrimary}`}>Earned</span>
                  <span className="font-bold text-[#10b981]">₹{payslip.calculation?.earned_salary?.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className={`p-4 rounded-lg border ${borderColor}`}>
              <h4 className={`font-medium ${textPrimary} mb-3`}>Deductions</h4>
              <div className="space-y-2">
                {payslip.deductions?.pf_enabled !== false && payslip.deductions?.pf > 0 && (
                  <div className="flex justify-between">
                    <span className={textSecondary}>PF ({payslip.deductions?.pf_percentage || 12}%)</span>
                    <span className="text-red-400">-₹{payslip.deductions?.pf?.toLocaleString()}</span>
                  </div>
                )}
                {payslip.deductions?.professional_tax_enabled !== false && payslip.deductions?.professional_tax > 0 && (
                  <div className="flex justify-between">
                    <span className={textSecondary}>Professional Tax</span>
                    <span className="text-red-400">-₹{payslip.deductions?.professional_tax?.toLocaleString()}</span>
                  </div>
                )}
                {payslip.deductions?.lop_deduction > 0 && (
                  <div className="flex justify-between">
                    <span className={textSecondary}>LOP Deduction</span>
                    <span className="text-red-400">-₹{payslip.deductions?.lop_deduction?.toLocaleString()}</span>
                  </div>
                )}
                <div className={`flex justify-between pt-2 border-t ${borderColor}`}>
                  <span className={`font-medium ${textPrimary}`}>Total Deductions</span>
                  <span className="font-bold text-red-400">-₹{payslip.deductions?.total_deductions?.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Net Salary */}
          <div className={`p-4 rounded-lg border-2 ${payslip.net_salary >= 0 ? 'border-[#10b981]' : 'border-red-400'} ${bgSecondary}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm ${textSecondary}`}>Net Salary</p>
                <p className={`text-3xl font-bold ${payslip.net_salary >= 0 ? 'text-[#10b981]' : 'text-red-400'}`}>
                  ₹{payslip.net_salary?.toLocaleString()}
                </p>
              </div>
              <div className="text-right">
                <p className={`text-xs ${textSecondary}`}>HR Remarks</p>
                <p className={`text-sm ${textPrimary}`}>{payslip.hr_remarks || 'No remarks'}</p>
              </div>
            </div>
          </div>

          {/* Reviews Section - Only show if reviews have text */}
          {((payslip.operations_review?.review_text) || (payslip.ceo_review?.review_text)) && (
            <div className="space-y-3">
              <h4 className={`font-medium ${textPrimary}`}>Reviews</h4>
              {payslip.operations_review?.review_text && (
                <div className={`p-3 rounded-lg border ${borderColor}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className="bg-[#f59e0b]/20 text-[#f59e0b]">Operations</Badge>
                    <span className={`text-xs ${textSecondary}`}>by {payslip.operations_review.reviewer_name}</span>
                  </div>
                  <p className={textPrimary}>{payslip.operations_review.review_text}</p>
                </div>
              )}
              {payslip.ceo_review?.review_text && (
                <div className={`p-3 rounded-lg border ${borderColor}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className="bg-[#10b981]/20 text-[#10b981]">CEO</Badge>
                    <span className={`text-xs ${textSecondary}`}>by {payslip.ceo_review.reviewer_name}</span>
                  </div>
                  <p className={textPrimary}>{payslip.ceo_review.review_text}</p>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3 pt-4 border-t border-[#3f3f46]">
            {payslip.status === 'draft' && (
              <Button 
                onClick={() => onSubmitForOperations(payslip.payslip_id)}
                className="bg-[#f59e0b] hover:bg-[#d97706] text-white"
              >
                <Send className="h-4 w-4 mr-2" />
                Submit for Operations Review
              </Button>
            )}
            {payslip.status === 'operations_review' && (
              <Button 
                onClick={() => {
                  setReviewPayslip(payslip);
                  setReviewType('operations');
                  setShowReviewModal(true);
                }}
                className="bg-[#6366f1] hover:bg-[#4f46e5] text-white"
              >
                <FileText className="h-4 w-4 mr-2" />
                Add Operations Review
              </Button>
            )}
            {payslip.status === 'ceo_review' && (
              <Button 
                onClick={() => {
                  setReviewPayslip(payslip);
                  setReviewType('ceo');
                  setShowReviewModal(true);
                }}
                className="bg-[#10b981] hover:bg-[#059669] text-white"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                CEO Approve
              </Button>
            )}
            {payslip.status === 'approved' && (
              <Button 
                onClick={() => onGeneratePayslip(payslip.payslip_id)}
                className="bg-[#14b8a6] hover:bg-[#0d9488] text-white"
              >
                <FileText className="h-4 w-4 mr-2" />
                Generate Payslip
              </Button>
            )}
            {payslip.status === 'generated' && (
              <Button 
                onClick={() => onDownloadPDF(payslip)}
                className="bg-[#6366f1] hover:bg-[#4f46e5] text-white"
              >
                <Download className="h-4 w-4 mr-2" />
                Download PDF
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
      
      {/* Previous Payslips Section */}
      {previousPayslips.length > 0 && (
        <Card className={`${bgCard} border ${borderColor}`}>
          <CardHeader 
            className="flex flex-row items-center justify-between cursor-pointer"
            onClick={() => setShowPreviousPayslips(!showPreviousPayslips)}
          >
            <CardTitle className={`${textPrimary} text-lg flex items-center gap-2`}>
              <Clock className="h-5 w-5" />
              Previous Payslips
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge className="bg-[#6366f1]/20 text-[#6366f1]">{previousPayslips.length} records</Badge>
              <ChevronRight className={`h-5 w-5 ${textSecondary} transition-transform ${showPreviousPayslips ? 'rotate-90' : ''}`} />
            </div>
          </CardHeader>
          {showPreviousPayslips && (
            <CardContent>
              <div className="space-y-3">
                {previousPayslips.map((p) => (
                  <div key={p.payslip_id} className={`p-4 rounded-lg border ${borderColor} flex flex-col md:flex-row md:items-center justify-between gap-3`}>
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-lg ${bgSecondary}`}>
                        <Calendar className="h-5 w-5 text-[#6366f1]" />
                      </div>
                      <div>
                        <p className={`font-medium ${textPrimary}`}>{months[p.month - 1]} {p.year}</p>
                        <p className={`text-sm ${textSecondary}`}>Base: ₹{p.base_salary?.toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="flex flex-col md:flex-row md:items-center gap-3">
                      <div className="text-right">
                        <p className={`text-xs ${textSecondary}`}>Net Salary</p>
                        <p className={`text-lg font-bold ${p.net_salary >= 0 ? 'text-[#10b981]' : 'text-red-400'}`}>
                          ₹{p.net_salary?.toLocaleString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={getStatusColor(p.status)}>{getStatusLabel(p.status)}</Badge>
                        {p.status === 'generated' && (
                          <Button
                            onClick={() => onDownloadPDF(p)}
                            variant="ghost"
                            size="sm"
                            className="text-[#6366f1] hover:bg-[#6366f1]/10"
                          >
                            <Download className="h-4 w-4 mr-1" />
                            PDF
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
}

// Salary History View Component
function SalaryHistoryView({
  employee,
  salaryHistory,
  hikeReasons,
  onDeleteSalary,
  setShowAddModal,
  setNewSalaryRecord,
  getReasonLabel,
  getReasonColor,
  calculateDuration,
  bgCard,
  bgSecondary,
  textPrimary,
  textSecondary,
  borderColor
}) {
  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className={`${bgCard} border ${borderColor} p-4`}>
          <p className={`text-xs ${textSecondary}`}>Current Salary</p>
          <p className="text-xl font-bold text-[#10b981]">₹{employee.current_salary?.toLocaleString() || 0}</p>
        </Card>
        <Card className={`${bgCard} border ${borderColor} p-4`}>
          <p className={`text-xs ${textSecondary}`}>Total Hikes</p>
          <p className="text-xl font-bold text-[#6366f1]">{Math.max(0, salaryHistory.length - 1)}</p>
        </Card>
        <Card className={`${bgCard} border ${borderColor} p-4`}>
          <p className={`text-xs ${textSecondary}`}>Initial Salary</p>
          <p className="text-xl font-bold text-[#f59e0b]">
            ₹{salaryHistory.length > 0 ? salaryHistory[salaryHistory.length - 1]?.amount?.toLocaleString() : 0}
          </p>
        </Card>
        <Card className={`${bgCard} border ${borderColor} p-4`}>
          <p className={`text-xs ${textSecondary}`}>Total Growth</p>
          <p className="text-xl font-bold text-[#8b5cf6]">
            {salaryHistory.length > 1 
              ? `+${Math.round(((employee.current_salary - salaryHistory[salaryHistory.length - 1]?.amount) / salaryHistory[salaryHistory.length - 1]?.amount) * 100)}%`
              : '0%'}
          </p>
        </Card>
      </div>

      {/* Salary History Table */}
      <Card className={`${bgCard} border ${borderColor}`}>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className={textPrimary}>Salary History</CardTitle>
          <Button
            onClick={() => {
              setNewSalaryRecord({ user_id: employee.user_id, amount: '', effective_from: '', reason: salaryHistory.length === 0 ? 'initial' : 'performance', notes: '' });
              setShowAddModal(true);
            }}
            size="sm"
            className="bg-[#10b981] hover:bg-[#059669] text-white"
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Record
          </Button>
        </CardHeader>
        <CardContent>
          {salaryHistory.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className={`border-b ${borderColor}`}>
                    <th className={`text-left p-3 ${textSecondary} text-sm`}>#</th>
                    <th className={`text-left p-3 ${textSecondary} text-sm`}>Effective From</th>
                    <th className={`text-left p-3 ${textSecondary} text-sm`}>Amount</th>
                    <th className={`text-left p-3 ${textSecondary} text-sm`}>Duration</th>
                    <th className={`text-left p-3 ${textSecondary} text-sm`}>Reason</th>
                    <th className={`text-left p-3 ${textSecondary} text-sm`}>Hike</th>
                    <th className={`text-left p-3 ${textSecondary} text-sm`}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {salaryHistory.map((record, index) => {
                    const prevSalary = index < salaryHistory.length - 1 ? salaryHistory[index + 1]?.amount : 0;
                    const hikeAmount = prevSalary > 0 ? record.amount - prevSalary : 0;
                    const hikePercent = prevSalary > 0 ? ((hikeAmount / prevSalary) * 100).toFixed(1) : 0;
                    
                    return (
                      <tr key={record.record_id} className={`border-b ${borderColor}`}>
                        <td className={`p-3 ${textSecondary}`}>{salaryHistory.length - index}</td>
                        <td className={`p-3 ${textPrimary}`}>
                          {new Date(record.effective_from).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                        </td>
                        <td className={`p-3 font-semibold text-[#10b981]`}>₹{record.amount?.toLocaleString()}</td>
                        <td className={`p-3 ${textSecondary}`}>{calculateDuration(salaryHistory, index)}</td>
                        <td className="p-3">
                          <Badge className={getReasonColor(record.reason)}>{getReasonLabel(record.reason)}</Badge>
                        </td>
                        <td className="p-3">
                          {hikeAmount > 0 ? (
                            <span className="text-[#10b981]">+₹{hikeAmount.toLocaleString()} ({hikePercent}%)</span>
                          ) : (
                            <span className={textSecondary}>-</span>
                          )}
                        </td>
                        <td className="p-3">
                          <Button
                            onClick={() => onDeleteSalary(record.record_id)}
                            variant="ghost"
                            size="sm"
                            className="text-red-400 hover:bg-red-400/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <CreditCard className="h-12 w-12 text-[#3f3f46] mx-auto mb-4" />
              <p className={textSecondary}>No salary history available</p>
              <Button
                onClick={() => {
                  setNewSalaryRecord({ user_id: employee.user_id, amount: '', effective_from: '', reason: 'initial', notes: '' });
                  setShowAddModal(true);
                }}
                className="mt-4 bg-[#10b981] hover:bg-[#059669] text-white"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add First Salary
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Hike Conditions Legend */}
      <Card className={`${bgCard} border ${borderColor}`}>
        <CardHeader>
          <CardTitle className={`${textPrimary} text-lg`}>Hike Conditions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {hikeReasons.map((reason) => (
              <div key={reason.id} className="flex flex-col gap-1">
                <Badge className={getReasonColor(reason.id)}>{reason.label}</Badge>
                <span className={`text-xs ${textSecondary}`}>{reason.description}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
