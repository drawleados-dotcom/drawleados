import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Switch } from '../ui/switch';
import api from '../../utils/api';
import { toast } from 'sonner';
import {
  Loader2, Plus, Trash2, UserPlus, Send, FileText, Settings, ChevronDown, ChevronUp,
} from 'lucide-react';
import AddClientModal from './AddClientModal';

const PAYMENT_TERMS_MAP = {
  'Due on Receipt': 0,
  'Net 15': 15,
  'Net 30': 30,
  'Net 45': 45,
  'Net 60': 60,
  'Net 90': 90,
  'Custom': null,
};

const GST_RATES = [0, 5, 12, 18, 28];

const addDays = (date, days) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
};

const InvoiceFormModal = ({ invoice, onClose, onSave, presetClientId, presetGstType, presetItems, presetNotes }) => {
  const today = new Date().toISOString().split('T')[0];

  const [formData, setFormData] = useState({
    invoice_number: '',
    invoice_date: today,
    terms: 'Due on Receipt',
    due_date: today,
    client_id: '',
    client_name: '',
    client_email: '',
    client_phone: '',
    client_gst_number: '',
    client_address: '',
    gst_type: 'gst',
    notes: 'Thanks for your business.',
    terms_and_conditions: '',
    template_type: 'minimal',
    enable_payment_gateway: false,
  });

  const [items, setItems] = useState([{
    service_name: '',
    description: '',
    quantity: 1,
    rate: 0,
    discount_percent: 0,
    gst_rate: 18,
  }]);

  const [clients, setClients] = useState([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [showAddClient, setShowAddClient] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitMode, setSubmitMode] = useState('draft'); // 'draft' | 'send'

  // Load clients
  const loadClients = useCallback(async () => {
    setLoadingClients(true);
    try {
      const res = await api.get('/finance/clients?include_summary=false');
      setClients(res.data || []);
    } catch {
      toast.error('Failed to load clients');
    } finally {
      setLoadingClients(false);
    }
  }, []);

  useEffect(() => { loadClients(); }, [loadClients]);

  // Prefill from request (create mode only — when no full invoice supplied)
  useEffect(() => {
    if (invoice) return;
    if (presetClientId) {
      setFormData((p) => ({
        ...p,
        client_id: presetClientId,
        gst_type: presetGstType || p.gst_type,
        notes: presetNotes || p.notes,
      }));
    } else if (presetGstType) {
      setFormData((p) => ({ ...p, gst_type: presetGstType }));
    }
    if (Array.isArray(presetItems) && presetItems.length > 0) {
      setItems(presetItems.map((it) => ({
        service_name: it.service_name || '',
        description: it.description || '',
        quantity: it.quantity ?? 1,
        rate: it.rate ?? 0,
        discount_percent: it.discount_percent ?? 0,
        gst_rate: it.gst_rate ?? (presetGstType === 'non_gst' ? 0 : 18),
      })));
    }
  }, [invoice, presetClientId, presetGstType, presetItems, presetNotes]);

  // Initialize from existing invoice (edit mode)
  useEffect(() => {
    if (invoice) {
      setFormData({
        invoice_number: invoice.invoice_number || '',
        invoice_date: new Date(invoice.invoice_date).toISOString().split('T')[0],
        terms: invoice.payment_terms?.includes('Net') || invoice.payment_terms === 'Due on Receipt'
          ? invoice.payment_terms : 'Custom',
        due_date: new Date(invoice.due_date).toISOString().split('T')[0],
        client_id: invoice.client_id || '',
        client_name: invoice.client_name || '',
        client_email: invoice.client_email || '',
        client_phone: invoice.client_phone || '',
        client_gst_number: invoice.client_gst_number || '',
        client_address: invoice.client_address || '',
        gst_type: invoice.gst_type || 'gst',
        notes: invoice.notes || '',
        terms_and_conditions: invoice.terms_and_conditions || '',
        template_type: invoice.template_type || 'minimal',
        enable_payment_gateway: false,
      });
      setItems(invoice.items?.map((it) => ({
        service_name: it.service_name || '',
        description: it.description || '',
        quantity: it.quantity || 1,
        rate: it.rate || 0,
        discount_percent: it.discount_percent || 0,
        gst_rate: it.gst_rate || 18,
      })) || []);
      if (invoice.terms_and_conditions) setShowTerms(true);
    }
  }, [invoice]);

  // Pre-fill the next invoice number on first open (create mode only).
  // The number is just a preview — server re-validates uniqueness on save —
  // and the user can freely edit it before submitting.
  useEffect(() => {
    if (invoice) return; // edit mode: keep the existing number
    let cancelled = false;
    (async () => {
      try {
        const year = new Date(formData.invoice_date || today).getFullYear();
        const res = await api.get(`/finance/invoices/next-number?year=${year}`);
        if (cancelled) return;
        const next = res?.data?.invoice_number;
        if (next) {
          setFormData((p) => p.invoice_number ? p : { ...p, invoice_number: next });
        }
      } catch {
        // Silently fail — backend will still auto-generate on save.
      }
    })();
    return () => { cancelled = true; };
    // Only run once when modal opens; year switches on invoice_date change handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When the invoice_date year changes (e.g. user picks Jan of next year on a
  // form they opened in Dec), refresh the suggested number — but ONLY if the
  // user hasn't manually typed a custom value yet.
  useEffect(() => {
    if (invoice) return;
    const yr = new Date(formData.invoice_date || today).getFullYear();
    // If the current number already matches the INV-{yr}-#### pattern leave it alone.
    if (formData.invoice_number && !formData.invoice_number.startsWith(`INV-${yr}-`)) {
      // Looks like a custom number — don't clobber it.
      return;
    }
    if (formData.invoice_number && formData.invoice_number.startsWith(`INV-${yr}-`)) return;
    (async () => {
      try {
        const res = await api.get(`/finance/invoices/next-number?year=${yr}`);
        const next = res?.data?.invoice_number;
        if (next) setFormData((p) => ({ ...p, invoice_number: next }));
      } catch { /* ignore */ }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.invoice_date]);

  // Auto-update due_date when invoice_date or terms change (only for known terms)
  useEffect(() => {
    const days = PAYMENT_TERMS_MAP[formData.terms];
    if (days !== null && days !== undefined && formData.invoice_date) {
      setFormData((p) => ({ ...p, due_date: addDays(formData.invoice_date, days) }));
    }
  }, [formData.terms, formData.invoice_date]);

  // When client_id changes, populate read-only client info
  const selectedClient = useMemo(
    () => clients.find((c) => c.client_id === formData.client_id),
    [clients, formData.client_id]
  );

  useEffect(() => {
    if (selectedClient) {
      setFormData((p) => ({
        ...p,
        client_name: selectedClient.display_name,
        client_email: selectedClient.email || '',
        client_phone: selectedClient.mobile || selectedClient.work_phone || '',
        client_gst_number: selectedClient.gstin || '',
        client_address: selectedClient.billing_address || '',
      }));
    }
  }, [selectedClient]);

  const set = (field, value) => setFormData((p) => ({ ...p, [field]: value }));

  const handleItemChange = (idx, field, value) => {
    const newItems = [...items];
    const numericFields = ['quantity', 'rate', 'discount_percent', 'gst_rate'];
    newItems[idx][field] = numericFields.includes(field) ? parseFloat(value) || 0 : value;
    setItems(newItems);
  };

  const addItem = () => setItems([...items, {
    service_name: '', description: '', quantity: 1, rate: 0, discount_percent: 0, gst_rate: 18,
  }]);

  const removeItem = (idx) => {
    if (items.length > 1) setItems(items.filter((_, i) => i !== idx));
  };

  const calc = useMemo(() => {
    let subtotal = 0, totalDiscount = 0, totalGst = 0;
    const lines = items.map((it) => {
      const sub = (it.quantity || 0) * (it.rate || 0);
      const disc = (sub * (it.discount_percent || 0)) / 100;
      const afterDisc = sub - disc;
      const gst = (afterDisc * (it.gst_rate || 0)) / 100;
      subtotal += sub;
      totalDiscount += disc;
      totalGst += gst;
      return { sub, disc, afterDisc, gst, total: afterDisc + gst };
    });
    return {
      lines,
      subtotal,
      totalDiscount,
      afterDiscount: subtotal - totalDiscount,
      totalGst,
      total: subtotal - totalDiscount + totalGst,
    };
  }, [items]);

  const handleSubmit = async (e, mode = 'draft') => {
    e.preventDefault();
    if (!formData.client_id) {
      toast.error('Please select a client');
      return;
    }
    if (items.some((it) => !it.service_name?.trim())) {
      toast.error('Each line item needs a service/item name');
      return;
    }
    setLoading(true);
    setSubmitMode(mode);
    try {
      const payload = {
        invoice_number: (formData.invoice_number || '').trim() || undefined,
        invoice_date: new Date(formData.invoice_date).toISOString(),
        due_date: new Date(formData.due_date).toISOString(),
        client_id: formData.client_id,
        client_name: formData.client_name,
        client_email: formData.client_email,
        client_phone: formData.client_phone,
        client_gst_number: formData.client_gst_number,
        client_address: formData.client_address,
        gst_type: formData.gst_type,
        gst_rate: 18,
        payment_terms: formData.terms === 'Custom' ? 'Custom' : formData.terms,
        notes: formData.notes,
        terms_and_conditions: formData.terms_and_conditions,
        template_type: formData.template_type,
        items: items.map((it) => ({
          service_name: it.service_name,
          description: it.description || '',
          quantity: it.quantity,
          rate: it.rate,
          discount_percent: it.discount_percent || 0,
          gst_rate: it.gst_rate || 0,
        })),
      };

      let result;
      if (invoice) {
        result = await api.put(`/finance/invoices/${invoice.invoice_id}`, payload);
        toast.success('Invoice updated');
      } else {
        result = await api.post('/finance/invoices', payload);
        toast.success('Invoice created');
      }

      // Mark as sent if requested
      if (mode === 'send' && result?.data?.invoice_id) {
        try {
          await api.put(`/finance/invoices/${result.data.invoice_id}`, { status: 'sent' });
          toast.success('Invoice marked as sent');
        } catch {
          // non-fatal
        }
      }

      onSave?.();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save invoice');
    } finally {
      setLoading(false);
    }
  };

  const inputCls = 'bg-gray-50 dark:bg-[#09090b] border-gray-200 dark:border-[#27272a] text-gray-900 dark:text-[#fafafa] focus:border-[#6366f1]';
  const labelCls = 'text-gray-900 dark:text-[#fafafa] mb-1.5 block text-sm font-medium';

  return (
    <>
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent
          className="bg-white dark:bg-[#18181b] border border-gray-200 dark:border-[#27272a] text-gray-900 dark:text-[#fafafa] max-w-5xl max-h-[92vh] overflow-y-auto"
          data-testid="invoice-form-modal"
        >
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold flex items-center gap-2" style={{ fontFamily: 'Plus Jakarta Sans' }}>
              <FileText className="h-6 w-6 text-[#6366f1]" />
              {invoice ? 'Edit Invoice' : 'New Invoice'}
            </DialogTitle>
            <p className="text-sm text-gray-600 dark:text-[#a1a1aa]">
              {(formData.gst_type || 'gst') === 'gst'
                ? 'Create a GST-compliant invoice (Registered Business)'
                : 'Create a simple invoice without tax (Unregistered Business)'}
            </p>
          </DialogHeader>

          {/* Business Type toggle — Registered (GST) hides nothing;
              Unregistered hides the per-line Tax % column and the Total Tax row.
              Stored on formData.gst_type ('gst' | 'no_tax'). */}
          <div className="bg-gray-50 dark:bg-[#09090b] border border-gray-200 dark:border-[#27272a] rounded-lg p-3 mt-3 flex flex-wrap items-center gap-2" data-testid="invoice-business-type">
            <span className="text-sm text-gray-600 dark:text-[#a1a1aa] mr-2">Invoice Type:</span>
            {[
              { id: 'gst', label: 'Registered (GST)', hint: 'with tax column' },
              { id: 'no_tax', label: 'Unregistered', hint: 'no tax' },
            ].map((opt) => {
              const active = (formData.gst_type || 'gst') === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    set('gst_type', opt.id);
                    // Zero-out per-line tax when switching to Unregistered so totals match.
                    if (opt.id !== 'gst') {
                      setItems((prev) => prev.map((it) => ({ ...it, gst_rate: 0 })));
                    }
                  }}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium border ${active ? 'bg-[#6366f1] border-[#6366f1] text-white' : 'bg-white dark:bg-[#18181b] border-gray-200 dark:border-[#27272a] text-gray-600 dark:text-[#a1a1aa] hover:text-white'}`}
                  data-testid={`invoice-type-${opt.id}`}
                >
                  {opt.label}
                  <span className="ml-1 opacity-70">· {opt.hint}</span>
                </button>
              );
            })}
          </div>

          <form className="space-y-5 mt-2">
            {/* Customer Name */}
            <div className="bg-gray-50 dark:bg-[#09090b] border border-gray-200 dark:border-[#27272a] rounded-lg p-4">
              <Label className={labelCls}>
                Customer Name <span className="text-red-500">*</span>
              </Label>
              <div className="flex gap-2">
                <Select
                  value={formData.client_id}
                  onValueChange={(v) => set('client_id', v)}
                >
                  <SelectTrigger className={inputCls + ' flex-1'} data-testid="invoice-client-select">
                    <SelectValue placeholder={loadingClients ? 'Loading clients...' : 'Select a client'} />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-[#18181b] border-gray-200 dark:border-[#27272a] text-gray-900 dark:text-[#fafafa] max-h-72">
                    {clients.length === 0 && (
                      <div className="px-3 py-4 text-sm text-gray-600 dark:text-[#a1a1aa] text-center">
                        No clients yet. Click &quot;+ Add Client&quot; below.
                      </div>
                    )}
                    {clients.map((c) => (
                      <SelectItem key={c.client_id} value={c.client_id}>
                        <div className="flex items-center justify-between gap-3 w-full">
                          <span>{c.display_name}</span>
                          {c.gstin && <span className="text-xs text-gray-600 dark:text-[#a1a1aa] font-mono">{c.gstin}</span>}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  onClick={() => setShowAddClient(true)}
                  className="bg-[#6366f1] hover:bg-[#4f46e5] text-white"
                  data-testid="invoice-add-client-btn"
                >
                  <UserPlus className="h-4 w-4 mr-1.5" />
                  Add Client
                </Button>
              </div>
              {selectedClient && (
                <div className="mt-3 text-xs text-gray-600 dark:text-[#a1a1aa] flex flex-wrap gap-x-4 gap-y-1">
                  {selectedClient.email && <span>📧 {selectedClient.email}</span>}
                  {(selectedClient.mobile || selectedClient.work_phone) && (
                    <span>📞 {selectedClient.mobile || selectedClient.work_phone}</span>
                  )}
                  {selectedClient.gstin && <span>GSTIN: <span className="font-mono">{selectedClient.gstin}</span></span>}
                  {selectedClient.place_of_supply && <span>📍 {selectedClient.place_of_supply}</span>}
                </div>
              )}
            </div>

            {/* Invoice Meta */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label className={labelCls}>Invoice #</Label>
                <Input
                  value={formData.invoice_number}
                  onChange={(e) => set('invoice_number', e.target.value)}
                  placeholder="Auto-generated"
                  className={inputCls}
                  data-testid="invoice-number"
                />
              </div>
              <div>
                <Label className={labelCls}>
                  Invoice Date <span className="text-red-500">*</span>
                </Label>
                <Input
                  type="date"
                  value={formData.invoice_date}
                  onChange={(e) => set('invoice_date', e.target.value)}
                  required
                  className={inputCls}
                  data-testid="invoice-date"
                />
              </div>
              <div>
                <Label className={labelCls}>Terms</Label>
                <Select value={formData.terms} onValueChange={(v) => set('terms', v)}>
                  <SelectTrigger className={inputCls} data-testid="invoice-terms">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-[#18181b] border-gray-200 dark:border-[#27272a] text-gray-900 dark:text-[#fafafa]">
                    {Object.keys(PAYMENT_TERMS_MAP).map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className={labelCls}>
                  Due Date <span className="text-red-500">*</span>
                </Label>
                <Input
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => { set('due_date', e.target.value); set('terms', 'Custom'); }}
                  required
                  className={inputCls}
                  data-testid="invoice-due-date"
                />
              </div>
            </div>

            {/* Item Table */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-gray-900 dark:text-[#fafafa] font-semibold text-base">Item Table</Label>
                <Button
                  type="button"
                  onClick={addItem}
                  size="sm"
                  className="bg-[#6366f1] hover:bg-[#4f46e5] text-white"
                  data-testid="invoice-add-item-btn"
                >
                  <Plus className="h-4 w-4 mr-1" /> Add New Row
                </Button>
              </div>
              <div className="border border-gray-200 dark:border-[#27272a] rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-[#1c1c1f] text-gray-600 dark:text-[#a1a1aa] text-xs uppercase">
                    <tr>
                      <th className="px-3 py-2 text-left">Item Details</th>
                      <th className="px-3 py-2 text-right w-20">Qty</th>
                      <th className="px-3 py-2 text-right w-24">Rate (₹)</th>
                      <th className="px-3 py-2 text-right w-20">Disc %</th>
                      {(formData.gst_type || 'gst') === 'gst' && (
                        <th className="px-3 py-2 text-right w-20">Tax %</th>
                      )}
                      <th className="px-3 py-2 text-right w-28">Amount</th>
                      <th className="px-3 py-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it, idx) => (
                      <tr key={idx} className="border-t border-gray-200 dark:border-[#27272a]">
                        <td className="px-3 py-2">
                          <Input
                            placeholder="Type or select an item"
                            value={it.service_name}
                            onChange={(e) => handleItemChange(idx, 'service_name', e.target.value)}
                            className="bg-gray-50 dark:bg-[#09090b] border-gray-200 dark:border-[#27272a] text-gray-900 dark:text-[#fafafa] mb-1"
                            data-testid={`invoice-item-name-${idx}`}
                          />
                          <Input
                            placeholder="Description (optional)"
                            value={it.description}
                            onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                            className="bg-gray-50 dark:bg-[#09090b] border-gray-200 dark:border-[#27272a] text-gray-900 dark:text-[#fafafa] text-xs"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            type="number" min="0" step="0.01"
                            value={it.quantity}
                            onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                            className="bg-gray-50 dark:bg-[#09090b] border-gray-200 dark:border-[#27272a] text-gray-900 dark:text-[#fafafa] text-right"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            type="number" min="0" step="0.01"
                            value={it.rate}
                            onChange={(e) => handleItemChange(idx, 'rate', e.target.value)}
                            className="bg-gray-50 dark:bg-[#09090b] border-gray-200 dark:border-[#27272a] text-gray-900 dark:text-[#fafafa] text-right"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            type="number" min="0" max="100" step="0.1"
                            value={it.discount_percent}
                            onChange={(e) => handleItemChange(idx, 'discount_percent', e.target.value)}
                            className="bg-gray-50 dark:bg-[#09090b] border-gray-200 dark:border-[#27272a] text-gray-900 dark:text-[#fafafa] text-right"
                          />
                        </td>
                        {(formData.gst_type || 'gst') === 'gst' && (
                          <td className="px-3 py-2">
                            <Select
                              value={String(it.gst_rate)}
                              onValueChange={(v) => handleItemChange(idx, 'gst_rate', v)}
                            >
                              <SelectTrigger className="bg-gray-50 dark:bg-[#09090b] border-gray-200 dark:border-[#27272a] text-gray-900 dark:text-[#fafafa]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-white dark:bg-[#18181b] border-gray-200 dark:border-[#27272a] text-gray-900 dark:text-[#fafafa]">
                                {GST_RATES.map((r) => (
                                  <SelectItem key={r} value={String(r)}>{r}%</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                        )}
                        <td className="px-3 py-2 text-right font-medium text-gray-900 dark:text-[#fafafa]">
                          ₹{(calc.lines[idx]?.total || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <button
                            type="button"
                            onClick={() => removeItem(idx)}
                            disabled={items.length === 1}
                            className="text-red-600 dark:text-[#f87171] disabled:opacity-30 hover:bg-gray-100 dark:hover:bg-[#27272a] p-1 rounded"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Totals + Notes */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <Label className={labelCls}>Customer Notes</Label>
                <Textarea
                  rows={3}
                  value={formData.notes}
                  onChange={(e) => set('notes', e.target.value)}
                  className={inputCls}
                  data-testid="invoice-notes"
                />
                <p className="text-xs text-gray-600 dark:text-[#a1a1aa] mt-1">Will be displayed on the invoice</p>

                <button
                  type="button"
                  onClick={() => setShowTerms((p) => !p)}
                  className="mt-3 text-sm text-[#6366f1] hover:text-[#8b5cf6] flex items-center gap-1"
                  data-testid="invoice-toggle-terms"
                >
                  {showTerms ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  Add Terms and Conditions
                </button>
                {showTerms && (
                  <Textarea
                    rows={3}
                    value={formData.terms_and_conditions}
                    onChange={(e) => set('terms_and_conditions', e.target.value)}
                    className={inputCls + ' mt-2'}
                    placeholder="Enter terms and conditions..."
                    data-testid="invoice-terms-text"
                  />
                )}

                <div className="mt-3 flex items-center gap-2">
                  <Switch
                    checked={formData.enable_payment_gateway}
                    onCheckedChange={(v) => set('enable_payment_gateway', v)}
                    data-testid="invoice-payment-gateway-toggle"
                  />
                  <span className="text-sm text-gray-900 dark:text-[#fafafa]">Add Payment Gateway</span>
                  <span className="text-xs text-gray-600 dark:text-[#a1a1aa]">(coming soon)</span>
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-[#09090b] border border-gray-200 dark:border-[#27272a] rounded-lg p-4 space-y-2.5">
                <div className="flex justify-between text-gray-600 dark:text-[#a1a1aa] text-sm">
                  <span>Sub Total</span>
                  <span>₹{calc.subtotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                </div>
                {calc.totalDiscount > 0 && (
                  <div className="flex justify-between text-gray-600 dark:text-[#a1a1aa] text-sm">
                    <span>Total Discount</span>
                    <span className="text-red-600 dark:text-[#f87171]">- ₹{calc.totalDiscount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                  </div>
                )}
                {(formData.gst_type || 'gst') === 'gst' && (
                  <>
                    <div className="flex justify-between text-gray-600 dark:text-[#a1a1aa] text-sm">
                      <span>Taxable Amount</span>
                      <span>₹{calc.afterDiscount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between text-gray-600 dark:text-[#a1a1aa] text-sm">
                      <span>Total Tax</span>
                      <span>+ ₹{calc.totalGst.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                    </div>
                  </>
                )}
                <div className="border-t border-gray-200 dark:border-[#27272a] pt-2.5 flex justify-between font-bold text-lg">
                  <span className="text-gray-900 dark:text-[#fafafa]">Total (₹)</span>
                  <span className="text-[#6366f1]">
                    ₹{calc.total.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap justify-between items-center gap-3 pt-4 border-t border-gray-200 dark:border-[#27272a]">
              <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-[#a1a1aa]">
                <Settings className="h-3.5 w-3.5" />
                Template:
                <Select value={formData.template_type} onValueChange={(v) => set('template_type', v)}>
                  <SelectTrigger className="bg-gray-50 dark:bg-[#09090b] border-gray-200 dark:border-[#27272a] text-gray-900 dark:text-[#fafafa] h-8 w-32 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-[#18181b] border-gray-200 dark:border-[#27272a] text-gray-900 dark:text-[#fafafa]">
                    <SelectItem value="minimal">Minimal</SelectItem>
                    <SelectItem value="corporate">Corporate</SelectItem>
                    <SelectItem value="modern">Modern</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  className="bg-gray-100 dark:bg-[#27272a] hover:bg-gray-200 dark:hover:bg-[#3f3f46] text-gray-900 dark:text-[#fafafa]"
                  data-testid="invoice-cancel-btn"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={(e) => handleSubmit(e, 'draft')}
                  disabled={loading}
                  variant="outline"
                  className="border-[#6366f1] text-[#6366f1] hover:bg-[#6366f1]/10"
                  data-testid="invoice-save-draft-btn"
                >
                  {loading && submitMode === 'draft' ? (
                    <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Saving...</>
                  ) : 'Save as Draft'}
                </Button>
                <Button
                  type="button"
                  onClick={(e) => handleSubmit(e, 'send')}
                  disabled={loading}
                  className="bg-[#6366f1] hover:bg-[#4f46e5] text-white"
                  data-testid="invoice-save-send-btn"
                >
                  {loading && submitMode === 'send' ? (
                    <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Sending...</>
                  ) : (
                    <><Send className="mr-1.5 h-4 w-4" /> Save and Send</>
                  )}
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {showAddClient && (
        <AddClientModal
          onClose={() => setShowAddClient(false)}
          onSaved={async () => {
            await loadClients();
            setShowAddClient(false);
          }}
        />
      )}
    </>
  );
};

export default InvoiceFormModal;
