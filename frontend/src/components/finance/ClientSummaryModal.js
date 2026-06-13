import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import api from '../../utils/api';
import { toast } from 'sonner';
import {
  Loader2, FileText, IndianRupee, AlertCircle, CheckCircle2,
  Calendar, Phone, Mail, Building2, MapPin, CreditCard, Receipt,
  Wrench, Wallet, MessageSquare, Star, Plus, Trash2,
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

  // Per-tab state
  const [services, setServices] = useState([]);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [newService, setNewService] = useState({ name: '', description: '', amount: '' });

  const [paymentSchedule, setPaymentSchedule] = useState([]);
  const [psLoading, setPsLoading] = useState(false);

  const [feedback, setFeedback] = useState([]);
  const [fbLoading, setFbLoading] = useState(false);
  const [newFeedback, setNewFeedback] = useState({ comment: '', rating: 5 });

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

  const loadServices = useCallback(async () => {
    setServicesLoading(true);
    try {
      const r = await api.get(`/finance/clients/${clientId}/services`);
      setServices(r.data || []);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to load services');
    } finally {
      setServicesLoading(false);
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
    if (activeTab === 'services') loadServices();
    if (activeTab === 'payment_schedule') loadPaymentSchedule();
    if (activeTab === 'feedback') loadFeedback();
  }, [activeTab, clientId, loadServices, loadPaymentSchedule, loadFeedback]);

  const addService = async () => {
    if (!newService.name.trim()) { toast.error('Service name is required'); return; }
    try {
      await api.post(`/finance/clients/${clientId}/services`, {
        name: newService.name.trim(),
        description: newService.description.trim(),
        amount: parseFloat(newService.amount) || 0,
      });
      toast.success('Service added');
      setNewService({ name: '', description: '', amount: '' });
      loadServices();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to add service');
    }
  };

  const deleteService = async (serviceId) => {
    if (!window.confirm('Remove this service?')) return;
    try {
      await api.delete(`/finance/clients/${clientId}/services/${serviceId}`);
      toast.success('Service removed');
      loadServices();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to remove service');
    }
  };

  const addFeedback = async () => {
    if (!newFeedback.comment.trim()) { toast.error('Comment is required'); return; }
    try {
      await api.post(`/finance/clients/${clientId}/feedback`, {
        comment: newFeedback.comment.trim(),
        rating: Number(newFeedback.rating) || null,
      });
      toast.success('Feedback added');
      setNewFeedback({ comment: '', rating: 5 });
      loadFeedback();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to add feedback');
    }
  };

  const deleteFeedback = async (fid) => {
    if (!window.confirm('Remove this feedback?')) return;
    try {
      await api.delete(`/finance/clients/${clientId}/feedback/${fid}`);
      toast.success('Feedback removed');
      loadFeedback();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to remove feedback');
    }
  };

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
                {/* Add Service */}
                <div className="bg-[#09090b] border border-[#27272a] rounded-lg p-4 space-y-3">
                  <p className="text-sm font-medium">Add a service this client has hired</p>
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
                    <Input
                      placeholder="Service name (e.g. Website Revamp)"
                      value={newService.name}
                      onChange={(e) => setNewService({ ...newService, name: e.target.value })}
                      className="md:col-span-4 bg-[#18181b] border-[#27272a] text-sm"
                      data-testid="new-service-name"
                    />
                    <Input
                      placeholder="Description (optional)"
                      value={newService.description}
                      onChange={(e) => setNewService({ ...newService, description: e.target.value })}
                      className="md:col-span-5 bg-[#18181b] border-[#27272a] text-sm"
                      data-testid="new-service-description"
                    />
                    <Input
                      type="number"
                      placeholder="Amount"
                      value={newService.amount}
                      onChange={(e) => setNewService({ ...newService, amount: e.target.value })}
                      className="md:col-span-2 bg-[#18181b] border-[#27272a] text-sm"
                      data-testid="new-service-amount"
                    />
                    <Button
                      onClick={addService}
                      className="md:col-span-1 bg-[#6366f1] hover:bg-[#4f46e5] text-white"
                      data-testid="add-service-btn"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Service List */}
                {servicesLoading ? (
                  <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-[#6366f1]" /></div>
                ) : services.length === 0 ? (
                  <div className="bg-[#09090b] border border-[#27272a] rounded-lg p-8 text-center text-[#a1a1aa]">
                    <Wrench className="h-10 w-10 mx-auto mb-2 opacity-40" />
                    No services added yet for this client.
                  </div>
                ) : (
                  <div className="bg-[#09090b] border border-[#27272a] rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-[#1c1c1f] text-[#a1a1aa] text-xs uppercase">
                        <tr>
                          <th className="px-4 py-2 text-left">Service</th>
                          <th className="px-4 py-2 text-left">Description</th>
                          <th className="px-4 py-2 text-right">Amount</th>
                          <th className="px-4 py-2 text-center">Status</th>
                          <th className="px-4 py-2 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {services.map((s) => (
                          <tr key={s.service_id} className="border-t border-[#27272a] hover:bg-[#1c1c1f]/50" data-testid={`service-row-${s.service_id}`}>
                            <td className="px-4 py-2 font-medium">{s.name}</td>
                            <td className="px-4 py-2 text-[#a1a1aa]">{s.description || '—'}</td>
                            <td className="px-4 py-2 text-right font-medium">{fmtCurrency(s.amount, s.currency)}</td>
                            <td className="px-4 py-2 text-center">
                              <span className="px-2 py-0.5 rounded text-xs font-medium bg-[#14532d]/40 text-[#4ade80]">{s.status || 'active'}</span>
                            </td>
                            <td className="px-4 py-2 text-right">
                              <button
                                onClick={() => deleteService(s.service_id)}
                                className="text-[#f87171] hover:text-[#fca5a5]"
                                data-testid={`delete-service-${s.service_id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
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
                {/* Add Feedback */}
                <div className="bg-[#09090b] border border-[#27272a] rounded-lg p-4 space-y-3">
                  <p className="text-sm font-medium">Add review or feedback</p>
                  <Textarea
                    placeholder="Write your comment..."
                    value={newFeedback.comment}
                    onChange={(e) => setNewFeedback({ ...newFeedback, comment: e.target.value })}
                    className="bg-[#18181b] border-[#27272a] text-sm min-h-[80px]"
                    data-testid="new-feedback-comment"
                  />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setNewFeedback({ ...newFeedback, rating: n })}
                          data-testid={`rating-star-${n}`}
                          className="p-0.5"
                        >
                          <Star className={`h-5 w-5 ${n <= (newFeedback.rating || 0) ? 'fill-[#fbbf24] text-[#fbbf24]' : 'text-[#3f3f46]'}`} />
                        </button>
                      ))}
                    </div>
                    <Button
                      onClick={addFeedback}
                      className="bg-[#6366f1] hover:bg-[#4f46e5] text-white"
                      data-testid="add-feedback-btn"
                    >
                      <Plus className="h-4 w-4 mr-1" /> Add Feedback
                    </Button>
                  </div>
                </div>

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
                          <button
                            onClick={() => deleteFeedback(f.feedback_id)}
                            className="text-[#f87171] hover:text-[#fca5a5]"
                            data-testid={`delete-feedback-${f.feedback_id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
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
