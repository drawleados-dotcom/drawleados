import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import api from '../../utils/api';
import { toast } from 'sonner';
import {
  Loader2, FileText, IndianRupee, AlertCircle, CheckCircle2,
  Calendar, Phone, Mail, Building2, MapPin, CreditCard, Receipt,
  Wrench, Wallet, MessageSquare, Star, Briefcase,
} from 'lucide-react';

const fmtCurrency = (n, currency = 'INR') => {
  const v = Number(n || 0);
  if (currency === 'INR') return `₹${v.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  return `${currency} ${v.toLocaleString()}`;
};

const fmtDate = (iso) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-IN', {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  } catch {
    return '—';
  }
};

const StatusBadge = ({ status }) => {
  const map = {
    draft: { label: 'Draft', cls: 'bg-[#3f3f46] text-[#a1a1aa]' },
    sent: { label: 'Sent', cls: 'bg-[#1e3a8a]/30 text-[#60a5fa]' },
    paid: { label: 'Paid', cls: 'bg-[#14532d]/40 text-[#4ade80]' },
    partial: { label: 'Partial', cls: 'bg-[#78350f]/40 text-[#fbbf24]' },
    overdue: { label: 'Overdue', cls: 'bg-[#7f1d1d]/40 text-[#f87171]' },
    cancelled: { label: 'Cancelled', cls: 'bg-[#3f3f46] text-[#a1a1aa]' },
  };
  const s = map[status] || map.draft;
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${s.cls}`}>{s.label}</span>;
};

const SummaryCard = ({ icon: Icon, label, value, accent, testId }) => (
  <div
    className="bg-[#09090b] border border-[#27272a] rounded-lg p-4 hover:border-[#3f3f46] transition-colors"
    data-testid={testId}
  >
    <div className="flex items-center justify-between mb-2">
      <span className="text-xs text-[#a1a1aa] uppercase tracking-wider">{label}</span>
      <Icon className={`h-4 w-4 ${accent || 'text-[#6366f1]'}`} />
    </div>
    <div className={`text-2xl font-bold ${accent || 'text-[#fafafa]'}`} style={{ fontFamily: 'Plus Jakarta Sans' }}>
      {value}
    </div>
  </div>
);

const TABS = [
  { key: 'services', label: 'Services', icon: Wrench },
  { key: 'payment_schedule', label: 'Payment Schedule', icon: Wallet },
  { key: 'feedback', label: 'Review & Feedback', icon: MessageSquare },
];

const ClientSummaryModal = ({ clientId, onClose }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('services');

  // Services tab now displays the projects this client has hired Drawlead for
  // (read-only). Free-form services have been removed — the only place that
  // creates services is Operations → Projects.
  const [projects, setProjects] = useState([]);
  const [projectsLoading, setProjectsLoading] = useState(false);

  const [paymentSchedule, setPaymentSchedule] = useState([]);
  const [psLoading, setPsLoading] = useState(false);

  const [feedback, setFeedback] = useState([]);
  const [fbLoading, setFbLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/finance/clients/${clientId}/summary`);
      setData(res.data);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to load client summary');
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  const loadProjects = useCallback(async () => {
    setProjectsLoading(true);
    try {
      const r = await api.get(`/finance/clients/${clientId}/projects`);
      setProjects(r.data || []);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to load projects');
    } finally {
      setProjectsLoading(false);
    }
  }, [clientId]);

  const loadPaymentSchedule = useCallback(async () => {
    setPsLoading(true);
    try {
      const r = await api.get(`/finance/clients/${clientId}/payment-schedule`);
      setPaymentSchedule(r.data || []);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to load payment schedule');
    } finally {
      setPsLoading(false);
    }
  }, [clientId]);

  const loadFeedback = useCallback(async () => {
    setFbLoading(true);
    try {
      const r = await api.get(`/finance/clients/${clientId}/feedback`);
      setFeedback(r.data || []);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to load feedback');
    } finally {
      setFbLoading(false);
    }
  }, [clientId]);

  useEffect(() => { if (clientId) load(); }, [clientId, load]);

  useEffect(() => {
    if (!clientId) return;
    if (activeTab === 'services') loadProjects();
    if (activeTab === 'payment_schedule') loadPaymentSchedule();
    if (activeTab === 'feedback') loadFeedback();
  }, [activeTab, clientId, loadProjects, loadPaymentSchedule, loadFeedback]);

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent
        className="bg-[#18181b] border border-[#27272a] text-[#fafafa] max-w-5xl max-h-[92vh] overflow-y-auto"
        data-testid="client-summary-modal"
      >
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold" style={{ fontFamily: 'Plus Jakarta Sans' }}>
            {data?.client?.display_name || 'Client Summary'}
          </DialogTitle>
          {data?.client?.company_name && (
            <p className="text-sm text-[#a1a1aa] flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5" /> {data.client.company_name}
            </p>
          )}
        </DialogHeader>

        {loading || !data ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-[#6366f1]" />
          </div>
        ) : (
          <div className="space-y-6 mt-2">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <SummaryCard
                icon={Receipt}
                label="Total Invoiced"
                value={fmtCurrency(data.summary.total_invoiced, data.client.currency)}
                accent="text-[#6366f1]"
                testId="summary-total-invoiced"
              />
              <SummaryCard
                icon={CheckCircle2}
                label="Total Paid"
                value={fmtCurrency(data.summary.total_paid, data.client.currency)}
                accent="text-[#4ade80]"
                testId="summary-total-paid"
              />
              <SummaryCard
                icon={AlertCircle}
                label="Outstanding"
                value={fmtCurrency(data.summary.outstanding, data.client.currency)}
                accent="text-[#f87171]"
                testId="summary-outstanding"
              />
              <SummaryCard
                icon={FileText}
                label="Invoices"
                value={data.summary.invoice_count}
                accent="text-[#fbbf24]"
                testId="summary-invoice-count"
              />
            </div>

            {/* Contact + Tax Info */}
            <div className="bg-[#09090b] border border-[#27272a] rounded-lg p-5">
              <h3 className="text-base font-semibold mb-3">Client Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                {data.client.email && (
                  <div className="flex items-center gap-2 text-[#d4d4d8]">
                    <Mail className="h-3.5 w-3.5 text-[#a1a1aa]" />
                    <span className="text-[#a1a1aa]">Email:</span> {data.client.email}
                  </div>
                )}
                {(data.client.mobile || data.client.work_phone) && (
                  <div className="flex items-center gap-2 text-[#d4d4d8]">
                    <Phone className="h-3.5 w-3.5 text-[#a1a1aa]" />
                    <span className="text-[#a1a1aa]">Phone:</span> {data.client.mobile || data.client.work_phone}
                  </div>
                )}
                {data.client.gstin && (
                  <div className="flex items-center gap-2 text-[#d4d4d8]">
                    <CreditCard className="h-3.5 w-3.5 text-[#a1a1aa]" />
                    <span className="text-[#a1a1aa]">GSTIN:</span> {data.client.gstin}
                  </div>
                )}
                {data.client.place_of_supply && (
                  <div className="flex items-center gap-2 text-[#d4d4d8]">
                    <MapPin className="h-3.5 w-3.5 text-[#a1a1aa]" />
                    <span className="text-[#a1a1aa]">Place of Supply:</span> {data.client.place_of_supply}
                  </div>
                )}
              </div>
            </div>

            {/* === TABS === */}
            <div className="border-b border-[#27272a] flex items-center gap-1 overflow-x-auto">
              {TABS.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveTab(key)}
                  data-testid={`client-tab-${key}`}
                  className={`flex items-center gap-2 px-4 py-2.5 text-sm border-b-2 transition-colors whitespace-nowrap
                    ${activeTab === key
                      ? 'border-[#6366f1] text-[#fafafa]'
                      : 'border-transparent text-[#a1a1aa] hover:text-[#fafafa]'}`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>

            {/* === TAB CONTENT === */}
            {activeTab === 'services' && (
              <div className="space-y-3" data-testid="client-services-pane">
                <p className="text-xs text-[#a1a1aa]">
                  Projects this client has hired Drawlead for. Manage them in
                  <span className="text-[#a78bfa]"> Operations → Projects</span>.
                </p>
                {projectsLoading ? (
                  <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-[#6366f1]" /></div>
                ) : projects.length === 0 ? (
                  <div className="bg-[#09090b] border border-[#27272a] rounded-lg p-8 text-center text-[#a1a1aa]">
                    <Briefcase className="h-10 w-10 mx-auto mb-2 opacity-40" />
                    No projects yet for this client. Create one in Operations → Projects.
                  </div>
                ) : (
                  <div className="bg-[#09090b] border border-[#27272a] rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-[#1c1c1f] text-[#a1a1aa] text-xs uppercase">
                        <tr>
                          <th className="px-4 py-2 text-left">Project</th>
                          <th className="px-4 py-2 text-left">Departments</th>
                          <th className="px-4 py-2 text-left">Start</th>
                          <th className="px-4 py-2 text-left">Due</th>
                          <th className="px-4 py-2 text-right">Contract Total</th>
                          <th className="px-4 py-2 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {projects.map((p) => (
                          <tr
                            key={p.project_id}
                            className="border-t border-[#27272a] hover:bg-[#1c1c1f]/50"
                            data-testid={`client-project-row-${p.project_id}`}
                          >
                            <td className="px-4 py-2 font-medium">
                              <div className="flex flex-col">
                                <span>{p.name || '—'}</span>
                                {p.description && (
                                  <span className="text-xs text-[#a1a1aa] line-clamp-1">{p.description}</span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-2 text-[#a1a1aa]">
                              {(p.departments || []).length > 0
                                ? (p.departments || []).join(', ')
                                : '—'}
                            </td>
                            <td className="px-4 py-2 text-[#a1a1aa]">{fmtDate(p.start_date)}</td>
                            <td className="px-4 py-2 text-[#a1a1aa]">{fmtDate(p.due_date)}</td>
                            <td className="px-4 py-2 text-right font-medium">
                              {fmtCurrency(p.contract_total, data.client.currency)}
                            </td>
                            <td className="px-4 py-2 text-center">
                              <span className="px-2 py-0.5 rounded text-xs font-medium bg-[#14532d]/40 text-[#4ade80]">
                                {p.status || 'active'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'payment_schedule' && (
              <div className="space-y-3" data-testid="client-payment-schedule-pane">
                {psLoading ? (
                  <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-[#6366f1]" /></div>
                ) : paymentSchedule.length === 0 ? (
                  <div className="bg-[#09090b] border border-[#27272a] rounded-lg p-8 text-center text-[#a1a1aa]">
                    <Wallet className="h-10 w-10 mx-auto mb-2 opacity-40" />
                    No payment schedule yet — splits appear here once added on the client&apos;s projects (Operations → Project → Payment).
                  </div>
                ) : (
                  <div className="bg-[#09090b] border border-[#27272a] rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-[#1c1c1f] text-[#a1a1aa] text-xs uppercase">
                        <tr>
                          <th className="px-4 py-2 text-left">Project</th>
                          <th className="px-4 py-2 text-left">Milestone</th>
                          <th className="px-4 py-2 text-left">Due Date</th>
                          <th className="px-4 py-2 text-right">Amount</th>
                          <th className="px-4 py-2 text-left">Invoice</th>
                          <th className="px-4 py-2 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paymentSchedule.map((r, i) => (
                          <tr key={`${r.split_id || i}`} className="border-t border-[#27272a] hover:bg-[#1c1c1f]/50" data-testid={`ps-row-${i}`}>
                            <td className="px-4 py-2 font-medium">{r.project_name || '—'}</td>
                            <td className="px-4 py-2 text-[#d4d4d8]">{r.label || '—'}</td>
                            <td className="px-4 py-2 text-[#a1a1aa]">{fmtDate(r.due_date)}</td>
                            <td className="px-4 py-2 text-right font-medium">{fmtCurrency(r.amount, data.client.currency)}</td>
                            <td className="px-4 py-2 text-[#a1a1aa]">{r.invoice_number || '—'}</td>
                            <td className="px-4 py-2 text-center">
                              {r.collected ? (
                                <span className="px-2 py-0.5 rounded text-xs font-medium bg-[#14532d]/40 text-[#4ade80]">Collected</span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-xs font-medium bg-[#78350f]/40 text-[#fbbf24]">Pending</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'feedback' && (
              <div className="space-y-3" data-testid="client-feedback-pane">
                <p className="text-xs text-[#a1a1aa]">
                  Read-only feedback log. Manage entries from the dedicated CRM workflow.
                </p>
                {/* Feedback List */}
                {fbLoading ? (
                  <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-[#6366f1]" /></div>
                ) : feedback.length === 0 ? (
                  <div className="bg-[#09090b] border border-[#27272a] rounded-lg p-8 text-center text-[#a1a1aa]">
                    <MessageSquare className="h-10 w-10 mx-auto mb-2 opacity-40" />
                    No feedback yet for this client.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {feedback.map((f) => (
                      <div
                        key={f.feedback_id}
                        className="bg-[#09090b] border border-[#27272a] rounded-lg p-4"
                        data-testid={`feedback-row-${f.feedback_id}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-medium">{f.created_by_name || 'User'}</span>
                              {f.rating && (
                                <div className="flex items-center">
                                  {[1, 2, 3, 4, 5].map((n) => (
                                    <Star key={n} className={`h-3.5 w-3.5 ${n <= f.rating ? 'fill-[#fbbf24] text-[#fbbf24]' : 'text-[#3f3f46]'}`} />
                                  ))}
                                </div>
                              )}
                              <span className="text-xs text-[#a1a1aa]">{fmtDate(f.created_at)}</span>
                            </div>
                            <p className="text-sm text-[#d4d4d8] whitespace-pre-wrap">{f.comment}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Invoice History (kept below tabs) */}
            <div>
              <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-[#a78bfa]" /> Invoice History
              </h3>
              {data.invoices.length === 0 ? (
                <div className="bg-[#09090b] border border-[#27272a] rounded-lg p-8 text-center text-[#a1a1aa]">
                  <FileText className="h-10 w-10 mx-auto mb-2 opacity-40" />
                  No invoices found for this client yet.
                </div>
              ) : (
                <div className="bg-[#09090b] border border-[#27272a] rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-[#1c1c1f] text-[#a1a1aa] text-xs uppercase">
                      <tr>
                        <th className="px-4 py-2 text-left">Invoice #</th>
                        <th className="px-4 py-2 text-left">Date</th>
                        <th className="px-4 py-2 text-left">Due Date</th>
                        <th className="px-4 py-2 text-right">Amount</th>
                        <th className="px-4 py-2 text-right">Paid</th>
                        <th className="px-4 py-2 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.invoices.map((inv) => (
                        <tr key={inv.invoice_id} className="border-t border-[#27272a] hover:bg-[#1c1c1f]/50">
                          <td className="px-4 py-2 font-medium">{inv.invoice_number}</td>
                          <td className="px-4 py-2 text-[#a1a1aa]">{fmtDate(inv.invoice_date)}</td>
                          <td className="px-4 py-2 text-[#a1a1aa]">{fmtDate(inv.due_date)}</td>
                          <td className="px-4 py-2 text-right font-medium">
                            {fmtCurrency(inv.total_amount, data.client.currency)}
                          </td>
                          <td className="px-4 py-2 text-right text-[#4ade80]">
                            {fmtCurrency(inv.paid_amount, data.client.currency)}
                          </td>
                          <td className="px-4 py-2 text-center">
                            <StatusBadge status={inv.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-4 border-t border-[#27272a]">
              <Button
                onClick={onClose}
                className="bg-[#27272a] hover:bg-[#3f3f46] text-[#fafafa]"
                data-testid="close-summary-btn"
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ClientSummaryModal;
