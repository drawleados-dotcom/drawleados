import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Receipt, X, Send, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { Button } from '../ui/button';

const API = process.env.REACT_APP_BACKEND_URL;

const PAY_MODES = ['cash', 'upi', 'bank', 'cheque'];

/**
 * Opened from the Leads page when a lead's stage flips to "Invoice Raise".
 * Captures billing details and posts an Invoice Request to Finance.
 *
 * Props: lead, onClose, onSubmitted
 */
const LeadInvoiceRaiseModal = ({ lead, onClose, onSubmitted }) => {
  const token = localStorage.getItem('session_token');
  const headers = { Authorization: `Bearer ${token}` };

  const [gstType, setGstType] = useState('gst');
  const [form, setForm] = useState({
    company_name: lead?.company_name || '',
    lead_name: lead?.name || '',
    gst_number: '',
    billing_address: lead?.location || '',
    amount: lead?.estimation || '',
    payment_mode: 'bank',
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!form.company_name.trim()) { toast.error('Company name is required'); return; }
    if (gstType === 'gst' && !form.gst_number.trim()) { toast.error('GST Number is required for GST invoice'); return; }
    setSaving(true);
    try {
      await axios.post(`${API}/api/finance/banks/invoice-requests`, {
        lead_id: lead?.lead_id,
        gst_type: gstType,
        company_name: form.company_name,
        lead_name: form.lead_name,
        gst_number: gstType === 'gst' ? form.gst_number : '',
        billing_address: form.billing_address,
        amount: parseFloat(form.amount) || 0,
        payment_mode: form.payment_mode,
        notes: form.notes,
      }, { headers });
      toast.success('Invoice request sent to Finance');
      onSubmitted && onSubmitted();
      onClose();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to send request');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="bg-white dark:bg-[#18181b] border border-gray-200 dark:border-[#27272a] text-gray-900 dark:text-[#fafafa] max-w-lg" data-testid="lead-invoice-raise-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-[#6366f1]" /> Raise Invoice — {lead?.name || ''}
          </DialogTitle>
          <p className="text-xs text-gray-600 dark:text-[#a1a1aa]">Send a billing request to Finance. They'll review, edit if needed, and raise the actual invoice.</p>
        </DialogHeader>

        {/* GST vs Non-GST toggle */}
        <div className="flex gap-2 mt-1">
          {[
            { v: 'gst', label: 'GST (Registered)' },
            { v: 'non_gst', label: 'Non-GST (Unregistered)' },
          ].map((t) => (
            <button
              key={t.v}
              type="button"
              onClick={() => setGstType(t.v)}
              data-testid={`lead-invreq-${t.v}`}
              className={`flex-1 px-3 py-2 rounded-md text-sm border transition-colors ${
                gstType === t.v
                  ? 'border-[#6366f1] bg-[#6366f1]/15 text-gray-900 dark:text-[#fafafa] font-semibold'
                  : 'border-gray-200 dark:border-[#27272a] text-gray-600 dark:text-[#a1a1aa] hover:text-gray-900 dark:hover:text-[#fafafa]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="space-y-3 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-gray-900 dark:text-[#fafafa]">Name of the Company *</Label>
              <Input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} placeholder="ABC Pvt Ltd" className="bg-gray-50 dark:bg-[#0c0a09] border-gray-200 dark:border-[#27272a]" autoFocus data-testid="invreq-company-input" />
            </div>
            <div>
              <Label className="text-gray-900 dark:text-[#fafafa]">Lead Name</Label>
              <Input value={form.lead_name} onChange={(e) => setForm({ ...form, lead_name: e.target.value })} placeholder="Contact person" className="bg-gray-50 dark:bg-[#0c0a09] border-gray-200 dark:border-[#27272a]" />
            </div>
          </div>
          {gstType === 'gst' && (
            <div>
              <Label className="text-gray-900 dark:text-[#fafafa]">GST Number *</Label>
              <Input value={form.gst_number} onChange={(e) => setForm({ ...form, gst_number: e.target.value.toUpperCase() })} placeholder="29ABCDE1234F1Z5" className="bg-gray-50 dark:bg-[#0c0a09] border-gray-200 dark:border-[#27272a] font-mono" data-testid="invreq-gst-input" />
            </div>
          )}
          <div>
            <Label className="text-gray-900 dark:text-[#fafafa]">Billing Address</Label>
            <Textarea value={form.billing_address} onChange={(e) => setForm({ ...form, billing_address: e.target.value })} placeholder="Full billing address" className="bg-gray-50 dark:bg-[#0c0a09] border-gray-200 dark:border-[#27272a] min-h-[60px]" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-gray-900 dark:text-[#fafafa]">Amount Collected (₹)</Label>
              <Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0" className="bg-gray-50 dark:bg-[#0c0a09] border-gray-200 dark:border-[#27272a]" data-testid="invreq-amount-input" />
            </div>
            <div>
              <Label className="text-gray-900 dark:text-[#fafafa]">Mode of Payment</Label>
              <select value={form.payment_mode} onChange={(e) => setForm({ ...form, payment_mode: e.target.value })}
                className="w-full h-10 px-3 rounded-md border border-gray-200 dark:border-[#27272a] bg-gray-50 dark:bg-[#0c0a09] text-gray-900 dark:text-[#fafafa] text-sm capitalize">
                {PAY_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>
          <div>
            <Label className="text-gray-900 dark:text-[#fafafa]">Notes / Service Details</Label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Service line items / PO #" className="bg-gray-50 dark:bg-[#0c0a09] border-gray-200 dark:border-[#27272a]" />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-gray-200 dark:border-[#27272a] mt-3">
          <Button variant="ghost" onClick={onClose} className="text-gray-600 dark:text-[#a1a1aa]"><X className="h-4 w-4 mr-1" /> Cancel</Button>
          <Button onClick={submit} disabled={saving} className="bg-[#6366f1] hover:bg-[#4f46e5] text-white gap-2" data-testid="invreq-send-btn">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Request
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LeadInvoiceRaiseModal;
