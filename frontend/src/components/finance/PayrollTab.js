/**
 * Finance → Payroll tab.
 *
 * Mirrors the HR Admin → Payroll Mgmt → "Monthly Payroll" view so the finance
 * team gets a read-only window into the same data: month scheduler, 4 KPI
 * cards (Total Employees / Payable / Paid / Balance) and one row per employee
 * with payslip status. No payslip CRUD here — that lives in HR Admin.
 */
import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import {
  Calendar, ChevronLeft, ChevronRight, Users, Wallet, Banknote, Scale,
  Eye, FileText, Download, Loader2,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '../ui/dialog';

const API = process.env.REACT_APP_BACKEND_URL;
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const fmtINR = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

const STATUS_COLORS = {
  draft: 'bg-gray-500/20 text-gray-400',
  operations_review: 'bg-[#f59e0b]/20 text-[#f59e0b]',
  ceo_review: 'bg-[#6366f1]/20 text-[#6366f1]',
  approved: 'bg-[#10b981]/20 text-[#10b981]',
  generated: 'bg-[#14b8a6]/20 text-[#14b8a6]',
  partially_paid: 'bg-[#f59e0b]/20 text-[#f59e0b]',
  paid: 'bg-[#a78bfa]/20 text-violet-600 dark:text-[#a78bfa]',
  not_created: 'bg-gray-500/15 text-gray-500',
};
const STATUS_LABELS = {
  draft: 'Draft',
  operations_review: 'CEO Review',
  ceo_review: 'CEO Review',
  approved: 'Approved',
  generated: 'Generated',
  partially_paid: 'Partially Paid',
  paid: 'Paid',
  not_created: 'Not Created',
};

const PayrollTab = () => {
  const token = localStorage.getItem('session_token');
  const headers = { Authorization: `Bearer ${token}` };

  const today = new Date();
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear] = useState(today.getFullYear());

  const [employees, setEmployees] = useState([]);
  const [payslips, setPayslips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewing, setViewing] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [empRes, pslipRes] = await Promise.all([
        axios.get(`${API}/api/payroll/employees`, { headers }),
        axios.get(`${API}/api/payroll/payslips?month=${month}&year=${year}`, { headers }),
      ]);
      setEmployees(empRes.data || []);
      setPayslips(pslipRes.data || []);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to load payroll');
    } finally {
      setLoading(false);
    }
  }, [month, year]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const stepMonth = (delta) => {
    let m = month + delta;
    let y = year;
    if (m < 1) { m = 12; y -= 1; }
    if (m > 12) { m = 1; y += 1; }
    setMonth(m);
    setYear(y);
  };

  const payslipFor = (userId) => payslips.find((p) => p.user_id === userId);

  const rows = employees.map((emp) => ({ emp, p: payslipFor(emp.user_id) }));
  const totalEmployees = rows.length;
  const totalPayable = rows.reduce((s, r) => s + Number(r.p?.net_salary || 0), 0);
  const totalPaid = rows.reduce((s, r) => {
    if (r.p && (r.p.status === 'paid' || r.p.status === 'generated' || r.p.status === 'partially_paid')) {
      return s + Number(r.p.net_salary || 0);
    }
    return s;
  }, 0);
  const balance = totalPayable - totalPaid;
  const periodLabel = `${MONTHS[month - 1]} ${year}`;

  const summaryCards = [
    { label: 'Total Employees', value: totalEmployees, accent: '#6366f1', Icon: Users, testId: 'fin-payroll-card-total-employees' },
    { label: 'Total Amount Payable', value: fmtINR(totalPayable), accent: '#f59e0b', Icon: Wallet, testId: 'fin-payroll-card-payable' },
    { label: 'Amounts Paid', value: fmtINR(totalPaid), accent: '#10b981', Icon: Banknote, testId: 'fin-payroll-card-paid' },
    { label: 'Balance', value: fmtINR(balance), accent: balance > 0 ? '#ef4444' : '#10b981', Icon: Scale, testId: 'fin-payroll-card-balance' },
  ];

  const downloadPDF = async () => {
    if (!viewing) return;
    try {
      const res = await axios.get(`${API}/api/payroll/payslip/${viewing.payslip_id}/pdf`, {
        headers, responseType: 'blob',
      });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `payslip_${viewing.employee_name || 'employee'}_${SHORT[viewing.month - 1]}_${viewing.year}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error('Failed to download PDF');
    }
  };

  return (
    <div className="space-y-4" data-testid="finance-payroll-tab">
      {/* Header + Month Scheduler */}
      <div className="bg-white dark:bg-[#18181b] border border-gray-200 dark:border-[#27272a] rounded-xl p-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Users className="h-5 w-5 text-violet-600 dark:text-[#a78bfa]" />
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-[#fafafa]">Payroll</h3>
            <p className="text-xs text-gray-600 dark:text-[#a1a1aa]">Monthly payroll snapshot — sourced from HR Admin → Payroll Management</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-gray-500 dark:text-[#71717a]" />
          <span className="text-sm text-gray-900 dark:text-[#fafafa] font-medium">Month:</span>
          <Button size="sm" variant="ghost" onClick={() => stepMonth(-1)} className="h-9 w-9 p-0 text-gray-600 dark:text-[#a1a1aa] hover:text-[#6366f1]" data-testid="fin-payroll-prev">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <select
            value={month}
            onChange={(e) => setMonth(parseInt(e.target.value))}
            className="p-2 rounded-lg bg-gray-100 dark:bg-[#27272a] border border-gray-300 dark:border-[#3f3f46] text-gray-900 dark:text-[#fafafa] text-sm min-w-[130px]"
            data-testid="fin-payroll-month"
          >
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <Button size="sm" variant="ghost" onClick={() => stepMonth(1)} className="h-9 w-9 p-0 text-gray-600 dark:text-[#a1a1aa] hover:text-[#6366f1]" data-testid="fin-payroll-next">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <select
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value))}
            className="p-2 rounded-lg bg-gray-100 dark:bg-[#27272a] border border-gray-300 dark:border-[#3f3f46] text-gray-900 dark:text-[#fafafa] text-sm min-w-[100px]"
            data-testid="fin-payroll-year"
          >
            {[2024, 2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <div className="px-3 py-1.5 rounded-lg bg-[#6366f1]/10 text-[#6366f1] text-sm font-semibold">{periodLabel}</div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {summaryCards.map((c) => (
          <div
            key={c.label}
            className="bg-white dark:bg-[#18181b] border border-gray-200 dark:border-[#27272a] rounded-xl p-4"
            data-testid={c.testId}
          >
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wide text-gray-600 dark:text-[#a1a1aa]">{c.label}</p>
              <c.Icon className="h-4 w-4" style={{ color: c.accent }} />
            </div>
            <p className="text-2xl font-bold mt-2" style={{ color: c.accent, fontFamily: 'Plus Jakarta Sans' }}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Employee rows */}
      <div className="bg-white dark:bg-[#18181b] border border-gray-200 dark:border-[#27272a] rounded-xl overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-gray-600 dark:text-[#a1a1aa]">
            <Loader2 className="h-6 w-6 mx-auto animate-spin mb-2" /> Loading payroll…
          </div>
        ) : rows.length === 0 ? (
          <div className="py-12 text-center text-gray-600 dark:text-[#a1a1aa]">No employees</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-[#0c0a09] text-gray-600 dark:text-[#a1a1aa] uppercase text-[11px] tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3">Employee</th>
                  <th className="text-left px-4 py-3">Month / Year</th>
                  <th className="text-left px-4 py-3">Salary Date</th>
                  <th className="text-right px-4 py-3">Working Days</th>
                  <th className="text-right px-4 py-3">Present</th>
                  <th className="text-right px-4 py-3">Net Days</th>
                  <th className="text-right px-4 py-3">Per Day</th>
                  <th className="text-right px-4 py-3">Net Salary</th>
                  <th className="text-center px-4 py-3">Status</th>
                  <th className="text-center px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ emp, p }) => {
                  const status = p?.status || 'not_created';
                  const salaryDate = p?.created_at ? new Date(p.created_at).toLocaleDateString('en-GB') : '—';
                  const workingDays = p?.attendance?.total_working_days ?? '—';
                  const present = p?.attendance?.days_present ?? '—';
                  const netDays = p?.calculation?.days_paid ?? '—';
                  const perDay = p?.calculation?.per_day_salary;
                  const netSalary = p?.net_salary;
                  return (
                    <tr key={emp.user_id} className="border-t border-gray-200 dark:border-[#27272a] hover:bg-[#6366f1]/5 transition-colors" data-testid={`fin-payroll-row-${emp.user_id}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-full bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center text-white text-[11px] font-semibold">
                            {emp.name?.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-[#fafafa]">{emp.name}</p>
                            <p className="text-[10px] text-gray-600 dark:text-[#a1a1aa]">{emp.designation || '—'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-900 dark:text-[#fafafa]">{periodLabel}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-[#a1a1aa]">{salaryDate}</td>
                      <td className="px-4 py-3 text-right text-gray-900 dark:text-[#fafafa]">{workingDays}</td>
                      <td className="px-4 py-3 text-right text-[#10b981] font-medium">{present}</td>
                      <td className="px-4 py-3 text-right text-gray-900 dark:text-[#fafafa]">{netDays}</td>
                      <td className="px-4 py-3 text-right text-gray-600 dark:text-[#a1a1aa]">{perDay != null ? `₹${Number(perDay).toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : '—'}</td>
                      <td className="px-4 py-3 text-right font-semibold text-[#10b981]">{netSalary != null ? fmtINR(netSalary) : '—'}</td>
                      <td className="px-4 py-3 text-center">
                        <Badge className={STATUS_COLORS[status] || STATUS_COLORS.not_created}>{STATUS_LABELS[status] || status}</Badge>
                        {status === 'partially_paid' && (
                          <p className="text-[10px] text-gray-600 dark:text-[#a1a1aa] mt-1">
                            ₹{Number(p.amount_paid || 0).toLocaleString('en-IN')} / {fmtINR(netSalary)}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {p ? (
                          <Button size="sm" variant="ghost" onClick={() => setViewing(p)} className="text-violet-600 dark:text-[#a78bfa] hover:bg-[#a78bfa]/10 h-7 px-2" data-testid={`fin-payroll-view-${emp.user_id}`}>
                            <Eye className="h-3.5 w-3.5 mr-1" /> View
                          </Button>
                        ) : <span className="text-xs text-gray-600 dark:text-[#a1a1aa]">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payslip View Modal */}
      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="bg-white dark:bg-[#18181b] border border-gray-200 dark:border-[#27272a] max-w-2xl">
          {viewing && (
            <>
              <DialogHeader>
                <DialogTitle className="text-gray-900 dark:text-[#fafafa] flex items-center gap-2">
                  <FileText className="h-5 w-5 text-[#6366f1]" />
                  Payslip — {MONTHS[viewing.month - 1]} {viewing.year}
                </DialogTitle>
                <DialogDescription className="text-gray-600 dark:text-[#a1a1aa]">
                  Salary details for the selected month.
                </DialogDescription>
              </DialogHeader>
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-[#a1a1aa] -mt-2">
                <Badge className={STATUS_COLORS[viewing.status] || STATUS_COLORS.not_created}>
                  {STATUS_LABELS[viewing.status] || viewing.status}
                </Badge>
                <span>·</span>
                <span>{viewing.employee_name || '—'}</span>
                {viewing.employee_id && <><span>·</span><span>{viewing.employee_id}</span></>}
              </div>
              <div className="space-y-4 py-2">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-gray-50 dark:bg-[#0c0a09] border border-gray-200 dark:border-[#27272a]">
                    <p className="text-[10px] uppercase tracking-wide text-gray-600 dark:text-[#a1a1aa]">Designation</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-[#fafafa]">{viewing.employee_designation || '—'}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-gray-50 dark:bg-[#0c0a09] border border-gray-200 dark:border-[#27272a]">
                    <p className="text-[10px] uppercase tracking-wide text-gray-600 dark:text-[#a1a1aa]">Salary Date</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-[#fafafa]">{viewing.created_at ? new Date(viewing.created_at).toLocaleDateString('en-GB') : '—'}</p>
                  </div>
                </div>
                {viewing.attendance && (
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-600 dark:text-[#a1a1aa] mb-2">Attendance</p>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { l: 'Working Days', v: viewing.attendance?.total_working_days ?? '—' },
                        { l: 'Present', v: viewing.attendance?.days_present ?? '—', accent: '#10b981' },
                        { l: 'Absent', v: viewing.attendance?.absent_days ?? 0, accent: '#ef4444' },
                        { l: 'Paid Leave', v: (viewing.attendance?.casual_leaves ?? 0) + (viewing.attendance?.sick_leaves ?? 0) },
                      ].map((s) => (
                        <div key={s.l} className="p-2.5 rounded-lg bg-gray-50 dark:bg-[#0c0a09] border border-gray-200 dark:border-[#27272a] text-center">
                          <p className="text-[10px] uppercase text-gray-600 dark:text-[#a1a1aa]">{s.l}</p>
                          <p className="text-base font-bold mt-1" style={{ color: s.accent || undefined }}>{s.v}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-600 dark:text-[#a1a1aa] mb-2">Salary Breakdown</p>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="p-3 rounded-lg bg-gray-50 dark:bg-[#0c0a09] border border-gray-200 dark:border-[#27272a] text-center">
                      <p className="text-[10px] uppercase text-gray-600 dark:text-[#a1a1aa]">Gross</p>
                      <p className="text-base font-bold text-gray-900 dark:text-[#fafafa] mt-1">₹{Number(viewing.base_salary || 0).toLocaleString('en-IN')}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-gray-50 dark:bg-[#0c0a09] border border-gray-200 dark:border-[#27272a] text-center">
                      <p className="text-[10px] uppercase text-gray-600 dark:text-[#a1a1aa]">Per Day</p>
                      <p className="text-base font-bold text-gray-900 dark:text-[#fafafa] mt-1">₹{Number(viewing.calculation?.per_day_salary || 0).toLocaleString('en-IN')}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-gray-50 dark:bg-[#0c0a09] border border-gray-200 dark:border-[#27272a] text-center">
                      <p className="text-[10px] uppercase text-gray-600 dark:text-[#a1a1aa]">Net Pay</p>
                      <p className="text-base font-bold mt-1 text-[#10b981]">₹{Number(viewing.net_salary || 0).toLocaleString('en-IN')}</p>
                    </div>
                  </div>
                  {viewing.status === 'partially_paid' && (
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <div className="p-3 rounded-lg bg-gray-50 dark:bg-[#0c0a09] border border-gray-200 dark:border-[#27272a] text-center">
                        <p className="text-[10px] uppercase text-gray-600 dark:text-[#a1a1aa]">Paid So Far</p>
                        <p className="text-base font-bold mt-1 text-[#10b981]">₹{Number(viewing.amount_paid || 0).toLocaleString('en-IN')}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-gray-50 dark:bg-[#0c0a09] border border-gray-200 dark:border-[#27272a] text-center">
                        <p className="text-[10px] uppercase text-gray-600 dark:text-[#a1a1aa]">Remaining</p>
                        <p className="text-base font-bold mt-1 text-[#f59e0b]">₹{(Number(viewing.net_salary || 0) - Number(viewing.amount_paid || 0)).toLocaleString('en-IN')}</p>
                      </div>
                    </div>
                  )}
                </div>
                {viewing.hr_remarks && (
                  <div className="p-3 rounded-lg bg-gray-50 dark:bg-[#0c0a09] border border-gray-200 dark:border-[#27272a]">
                    <p className="text-[10px] uppercase tracking-wide text-gray-600 dark:text-[#a1a1aa]">HR Remarks</p>
                    <p className="text-sm text-gray-900 dark:text-[#fafafa] italic mt-1">&ldquo;{viewing.hr_remarks}&rdquo;</p>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setViewing(null)} className="border-gray-200 dark:border-[#27272a]">Close</Button>
                {(viewing.status === 'generated' || viewing.status === 'partially_paid' || viewing.status === 'paid') && (
                  <Button onClick={downloadPDF} className="bg-[#6366f1] hover:bg-[#4f46e5] text-white" data-testid="fin-payroll-view-download">
                    <Download className="h-4 w-4 mr-1" /> Download PDF
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PayrollTab;
