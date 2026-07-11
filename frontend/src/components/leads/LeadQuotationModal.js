import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { FileText, X, Plus, Trash2, Loader2, Download } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { Button } from '../ui/button';

const API = process.env.REACT_APP_BACKEND_URL;

const GST_OPTIONS = [0, 18];

const emptyItem = () => ({ service: '', amount: '', gst_percent: 0 });

const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

/**
 * Opened from the Leads page when a lead's stage flips to a "Quotation"
 * stage. Captures billing details + line items, creates the quotation,
 * then downloads the generated PDF.
 *
 * Props: lead, onClose, onCreated
 */
const LeadQuotationModal = ({ lead, onClose, onCreated }) => {
  const token = localStorage.getItem('session_token');
  const headers = { Authorization: `Bearer ${token}` };
  const today = new Date().toISOString().slice(0, 10);

  const [form, setForm] = useState({
    name: lead?.name || '',
    address: lead?.location || '',
    business_name: lead?.company_name || '',
    quotation_date: today,
    due_date: '',
  });
  const [items, setItems] = useState([emptyItem()]);
  const [saving, setSaving] = useState(false);

  const updateItem = (idx, patch) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };
  const addItem = () => setItems((prev) => [...prev, emptyItem()]);
  const removeItem = (idx) => setItems((prev) => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev);

  const rowTotal = (it) => {
    const amount = Number(it.amount) || 0;
    const gstAmount = amount * (Number(it.gst_percent) || 0) / 100;
    return { amount, gstAmount, total: amount + gstAmount };
  };
  const grandTotal = items.reduce((acc, it) => acc + rowTotal(it).total, 0);

  const downloadPdf = async (quotationId, quotationNumber) => {
    try {
      const res = await axios.get(`${API}/api/quotations/${quotationId}/pdf`, { headers, responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `quotation_${quotationNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error('Quotation created, but PDF download failed — try View Quotation from the leads table.');
    }
  };

  const submit = async () => {
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    const validItems = items.filter((it) => it.service.trim());
    if (validItems.length === 0) { toast.error('Add at least one service line item'); return; }
    setSaving(true);
    try {
      const res = await axios.post(`${API}/api/quotations`, {
        lead_id: lead?.lead_id,
        name: form.name.trim(),
        address: form.address,
        business_name: form.business_name,
        quotation_date: form.quotation_date,
        due_date: form.due_date,
        items: validItems.map((it) => ({
          service: it.service,
          amount: Number(it.amount) || 0,
          gst_percent: Number(it.gst_percent) || 0,
        })),
      }, { headers });
      toast.success(`Quotation ${res.data.quotation_number} created`);
      await downloadPdf(res.data.quotation_id, res.data.quotation_number);
      onCreated && onCreated(res.data);
      onClose();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to create quotation');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="bg-[#18181b] border border-[#27272a] text-[#fafafa] max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="lead-quotation-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-[#6366f1]" /> Create Quotation — {lead?.name || ''}
          </DialogTitle>
          <p className="text-xs text-[#a1a1aa]">Add line items and generate a downloadable quotation PDF.</p>
        </DialogHeader>

        <div className="space-y-3 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-[#fafafa]">Name *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Contact person" className="bg-[#0c0a09] border-[#27272a]" autoFocus data-testid="quo-name-input" />
            </div>
            <div>
              <Label className="text-[#fafafa]">Business Name</Label>
              <Input value={form.business_name} onChange={(e) => setForm({ ...form, business_name: e.target.value })} placeholder="Company / business name" className="bg-[#0c0a09] border-[#27272a]" data-testid="quo-business-input" />
            </div>
          </div>
          <div>
            <Label className="text-[#fafafa]">Address</Label>
            <Textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Full address" className="bg-[#0c0a09] border-[#27272a] min-h-[50px]" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-[#fafafa]">Quotation Date</Label>
              <Input type="date" value={form.quotation_date} onChange={(e) => setForm({ ...form, quotation_date: e.target.value })} className="bg-[#0c0a09] border-[#27272a]" data-testid="quo-date-input" />
            </div>
            <div>
              <Label className="text-[#fafafa]">Due Date</Label>
              <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} className="bg-[#0c0a09] border-[#27272a]" data-testid="quo-due-date-input" />
            </div>
          </div>

          {/* Line items */}
          <div className="pt-2 border-t border-[#27272a]">
            <div className="flex items-center justify-between mb-2">
              <Label className="text-[#fafafa]">Line Items</Label>
              <Button type="button" size="sm" variant="outline" onClick={addItem} className="border-[#6366f1] text-[#6366f1]" data-testid="quo-add-item-btn">
                <Plus className="h-3.5 w-3.5 mr-1" /> Add Item
              </Button>
            </div>
            <div className="rounded-lg border border-[#27272a] overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-[#0c0a09] text-[#a1a1aa] text-[11px] uppercase">
                  <tr>
                    <th className="text-left px-2 py-2 w-8">S.No</th>
                    <th className="text-left px-2 py-2">Service</th>
                    <th className="text-right px-2 py-2 w-24">Amount</th>
                    <th className="text-right px-2 py-2 w-20">GST %</th>
                    <th className="text-right px-2 py-2 w-24">GST Amt</th>
                    <th className="text-right px-2 py-2 w-24">Total</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, idx) => {
                    const { gstAmount, total } = rowTotal(it);
                    return (
                      <tr key={idx} className="border-t border-[#27272a]" data-testid={`quo-item-row-${idx}`}>
                        <td className="px-2 py-1.5 text-[#a1a1aa]">{idx + 1}</td>
                        <td className="px-2 py-1.5">
                          <Input value={it.service} onChange={(e) => updateItem(idx, { service: e.target.value })} placeholder="Service description" className="h-8 text-sm bg-[#0c0a09] border-[#27272a]" data-testid={`quo-item-service-${idx}`} />
                        </td>
                        <td className="px-2 py-1.5">
                          <Input type="number" min="0" value={it.amount} onChange={(e) => updateItem(idx, { amount: e.target.value })} placeholder="0" className="h-8 text-sm text-right bg-[#0c0a09] border-[#27272a]" data-testid={`quo-item-amount-${idx}`} />
                        </td>
                        <td className="px-2 py-1.5">
                          <select
                            value={it.gst_percent}
                            onChange={(e) => updateItem(idx, { gst_percent: Number(e.target.value) })}
                            className="w-full h-8 px-1 rounded-md border border-[#27272a] bg-[#0c0a09] text-[#fafafa] text-sm text-right"
                            data-testid={`quo-item-gst-${idx}`}
                          >
                            {GST_OPTIONS.map((g) => <option key={g} value={g}>{g}%</option>)}
                          </select>
                        </td>
                        <td className="px-2 py-1.5 text-right text-[#a1a1aa]">{fmt(gstAmount)}</td>
                        <td className="px-2 py-1.5 text-right font-semibold">{fmt(total)}</td>
                        <td className="px-2 py-1.5 text-center">
                          <button type="button" onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-300" data-testid={`quo-item-remove-${idx}`}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end mt-2">
              <div className="text-right">
                <p className="text-[11px] uppercase tracking-wide text-[#a1a1aa]">Grand Total</p>
                <p className="text-xl font-bold text-[#10b981]" data-testid="quo-grand-total">{fmt(grandTotal)}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-[#27272a] mt-3">
          <Button variant="ghost" onClick={onClose} className="text-[#a1a1aa]"><X className="h-4 w-4 mr-1" /> Cancel</Button>
          <Button onClick={submit} disabled={saving} className="bg-[#6366f1] hover:bg-[#4f46e5] text-white gap-2" data-testid="quo-save-btn">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Create & Download
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LeadQuotationModal;
