import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Loader2, IndianRupee, Save } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Button } from '../ui/button';

const API = process.env.REACT_APP_BACKEND_URL;

const PAYMENT_MODES = [
  { key: 'cash', label: 'Cash' },
  { key: 'upi', label: 'UPI' },
  { key: 'bank', label: 'Bank Transfer' },
  { key: 'cheque', label: 'Cheque' },
];

/**
 * Collect Invoice Modal — records a payment against an invoice.
 *
 * Props:
 *   invoice  { invoice_id, invoice_number, client_name, total_amount,
 *              paid_amount?, balance_due?, gst_type? }   -- the invoice to collect against
 *   onClose  ()   -- close handler
 *   onSaved  (resp)  -- called with API response on success
 */
const CollectInvoiceModal = ({ invoice, onClose, onSaved }) => {
  const token = localStorage.getItem('session_token');
  const headers = { Authorization: `Bearer ${token}` };

  const today = new Date().toISOString().slice(0, 10);
  const gstType = (invoice?.gst_type || 'gst').toLowerCase();
  const balance = invoice
    ? (invoice.balance_due != null
        ? Number(invoice.balance_due)
        : Math.max(0, Number(invoice.total_amount || 0) - Number(invoice.paid_amount || 0)))
    : 0;

  const [form, setForm] = useState({
    amount: balance,
    date: today,
    payment_mode: 'bank',
    bank_id: '',
    notes: '',
  });
  const [banks, setBanks] = useState([]);
  const [loadingBanks, setLoadingBanks] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!invoice) return;
    setForm((f) => ({ ...f, amount: balance }));
    const loadBanks = async () => {
      setLoadingBanks(true);
      try {
        const r = await axios.get(`${API}/api/finance/banks?gst_type=${gstType}`, { headers });
        setBanks(r.data || []);
        // auto-select first bank if any
        setForm((f) => ({ ...f, bank_id: r.data?.[0]?.bank_id || '' }));
      } catch (e) {
        toast.error(e.response?.data?.detail || 'Failed to load banks');
      } finally {
        setLoadingBanks(false);
      }
    };
    loadBanks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoice?.invoice_id]);

  const submit = async () => {
    const amt = parseFloat(form.amount);
    if (!amt || amt <= 0) { toast.error('Enter a valid amount'); return; }
    if (form.payment_mode === 'bank' && !form.bank_id) {
      toast.error(`Select a ${gstType.toUpperCase()} bank account`);
      return;
    }
    setSaving(true);
    try {
      const r = await axios.post(
        `${API}/api/finance/banks/collect/${invoice.invoice_id}`,
        {
          amount: amt,
          date: form.date,
          payment_mode: form.payment_mode,
          bank_id: form.payment_mode === 'bank' ? form.bank_id : null,
          notes: form.notes,
        },
        { headers },
      );
      toast.success('Payment collected');
      onSaved && onSaved(r.data);
      onClose();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to collect payment');
    } finally {
      setSaving(false);
    }
  };

  if (!invoice) return null;

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent
        className="bg-[#18181b] border border-[#27272a] text-[#fafafa] max-w-md"
        data-testid="collect-invoice-modal"
      >
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <IndianRupee className="h-5 w-5 text-[#10b981]" /> Collect Payment
          </DialogTitle>
          <p className="text-xs text-[#a1a1aa]">
            Invoice {invoice.invoice_number || invoice.invoice_id} • {invoice.client_name || ''} •{' '}
            <span className={`uppercase font-semibold ${gstType === 'gst' ? 'text-[#10b981]' : 'text-[#f59e0b]'}`}>{gstType.replace('_', '-')}</span>
          </p>
        </DialogHeader>

        <div className="space-y-3 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-[#fafafa]">Amount *</Label>
              <Input
                type="number"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="0.00"
                className="bg-[#0c0a09] border-[#27272a] text-sm"
                data-testid="collect-amount-input"
                autoFocus
              />
              <p className="text-[10px] text-[#a1a1aa] mt-1">Balance due: ₹{balance.toLocaleString('en-IN')}</p>
            </div>
            <div>
              <Label className="text-[#fafafa]">Date *</Label>
              <Input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="bg-[#0c0a09] border-[#27272a] text-sm"
                data-testid="collect-date-input"
              />
            </div>
          </div>

          <div>
            <Label className="text-[#fafafa]">Payment Mode *</Label>
            <div className="grid grid-cols-4 gap-1 mt-1">
              {PAYMENT_MODES.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setForm({ ...form, payment_mode: m.key })}
                  data-testid={`collect-mode-${m.key}`}
                  className={`px-2 py-1.5 rounded-md text-xs border transition-colors ${
                    form.payment_mode === m.key
                      ? 'border-[#6366f1] bg-[#6366f1]/15 text-[#fafafa]'
                      : 'border-[#27272a] text-[#a1a1aa] hover:text-[#fafafa]'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {form.payment_mode === 'bank' && (
            <div>
              <Label className="text-[#fafafa]">
                {gstType === 'gst' ? 'GST Bank Account *' : 'Non-GST Bank Account *'}
              </Label>
              {loadingBanks ? (
                <div className="flex items-center gap-2 text-[#a1a1aa] text-xs h-10">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading banks…
                </div>
              ) : banks.length === 0 ? (
                <p className="text-xs text-[#f87171] mt-1">
                  No {gstType.toUpperCase()} bank accounts yet — add one under Finance → Banks → {gstType === 'gst' ? 'GST Accounts' : 'Non-GST Accounts'}.
                </p>
              ) : (
                <select
                  value={form.bank_id}
                  onChange={(e) => setForm({ ...form, bank_id: e.target.value })}
                  className="w-full h-10 px-3 mt-1 rounded-md border border-[#27272a] bg-[#0c0a09] text-[#fafafa] text-sm"
                  data-testid="collect-bank-select"
                >
                  <option value="">Select bank account...</option>
                  {banks.map((b) => (
                    <option key={b.bank_id} value={b.bank_id}>
                      {b.account_holder}{b.bank_name ? ` — ${b.bank_name}` : ''}{b.account_number ? ` (${String(b.account_number).slice(-4)})` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          <div>
            <Label className="text-[#fafafa]">Notes (optional)</Label>
            <Input
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="UTR / Cheque #, internal note"
              className="bg-[#0c0a09] border-[#27272a] text-sm"
              data-testid="collect-notes-input"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-[#27272a] mt-3">
          <Button variant="ghost" onClick={onClose} className="text-[#a1a1aa]">Cancel</Button>
          <Button
            onClick={submit}
            disabled={saving}
            className="bg-[#10b981] hover:bg-[#059669] text-white gap-2"
            data-testid="collect-confirm-btn"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Collect ₹{Number(form.amount || 0).toLocaleString('en-IN')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CollectInvoiceModal;
