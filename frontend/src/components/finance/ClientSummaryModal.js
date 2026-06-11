import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import api from '../../utils/api';
import { toast } from 'sonner';
import {
  Loader2, FileText, IndianRupee, AlertCircle, CheckCircle2,
  Calendar, Phone, Mail, Building2, MapPin, CreditCard, Receipt,
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

const ClientSummaryModal = ({ clientId, onClose }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => { if (clientId) load(); }, [clientId, load]);

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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <SummaryCard
                icon={Calendar}
                label="Last Invoice Date"
                value={fmtDate(data.summary.last_invoice_date)}
                accent="text-[#a78bfa]"
              />
              <SummaryCard
                icon={IndianRupee}
                label="Last Payment Date"
                value={fmtDate(data.summary.last_payment_date)}
                accent="text-[#4ade80]"
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
                {data.client.pan && (
                  <div className="flex items-center gap-2 text-[#d4d4d8]">
                    <CreditCard className="h-3.5 w-3.5 text-[#a1a1aa]" />
                    <span className="text-[#a1a1aa]">PAN:</span> {data.client.pan}
                  </div>
                )}
                {data.client.place_of_supply && (
                  <div className="flex items-center gap-2 text-[#d4d4d8]">
                    <MapPin className="h-3.5 w-3.5 text-[#a1a1aa]" />
                    <span className="text-[#a1a1aa]">Place of Supply:</span> {data.client.place_of_supply}
                  </div>
                )}
                {data.client.payment_terms && (
                  <div className="flex items-center gap-2 text-[#d4d4d8]">
                    <span className="text-[#a1a1aa]">Payment Terms:</span> {data.client.payment_terms}
                  </div>
                )}
              </div>
            </div>

            {/* Invoice List */}
            <div>
              <h3 className="text-base font-semibold mb-3">Invoice History</h3>
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
