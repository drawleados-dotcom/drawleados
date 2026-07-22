import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Switch } from '../ui/switch';
import api from '../../utils/api';
import { toast } from 'sonner';
import { Loader2, User, Building2, MapPin, FileText } from 'lucide-react';

const GST_TREATMENTS = [
  'Registered Business - Regular',
  'Registered Business - Composition',
  'Unregistered Business',
  'Consumer',
  'Overseas',
  'Special Economic Zone',
  'Deemed Export',
  'Tax Deductor',
];

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa',
  'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala',
  'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland',
  'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Delhi', 'Jammu and Kashmir',
  'Ladakh', 'Chandigarh', 'Puducherry', 'Andaman and Nicobar Islands',
  'Dadra and Nagar Haveli and Daman and Diu', 'Lakshadweep',
];

const PAYMENT_TERMS = ['Due on Receipt', 'Net 15', 'Net 30', 'Net 45', 'Net 60', 'Net 90'];

const emptyForm = {
  customer_type: 'Business',
  salutation: '',
  first_name: '',
  last_name: '',
  company_name: '',
  display_name: '',
  currency: 'INR',
  email: '',
  work_phone: '',
  mobile: '',
  customer_language: 'English',
  gst_treatment: '',
  place_of_supply: '',
  gstin: '',
  pan: '',
  tax_preference: 'Taxable',
  payment_terms: 'Due on Receipt',
  enable_portal: false,
  billing_address: '',
  billing_city: '',
  billing_state: '',
  billing_pincode: '',
  billing_country: 'India',
  shipping_address: '',
  shipping_city: '',
  shipping_state: '',
  shipping_pincode: '',
  shipping_country: 'India',
  remarks: '',
};

const AddClientModal = ({ client, onClose, onSaved }) => {
  const [formData, setFormData] = useState(emptyForm);
  const [activeTab, setActiveTab] = useState('details');
  const [loading, setLoading] = useState(false);
  const [shippingSameAsBilling, setShippingSameAsBilling] = useState(false);

  useEffect(() => {
    if (client) {
      setFormData({ ...emptyForm, ...client });
    }
  }, [client]);

  const set = (field, value) => setFormData((p) => ({ ...p, [field]: value }));

  const autoDisplayName = () => {
    if (formData.display_name) return;
    if (formData.customer_type === 'Business' && formData.company_name) {
      set('display_name', formData.company_name);
    } else if (formData.first_name || formData.last_name) {
      set('display_name', `${formData.first_name} ${formData.last_name}`.trim());
    }
  };

  const handleShippingSameAsBilling = (checked) => {
    setShippingSameAsBilling(checked);
    if (checked) {
      setFormData((p) => ({
        ...p,
        shipping_address: p.billing_address,
        shipping_city: p.billing_city,
        shipping_state: p.billing_state,
        shipping_pincode: p.billing_pincode,
        shipping_country: p.billing_country,
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.display_name?.trim()) {
      toast.error('Display Name is required');
      setActiveTab('details');
      return;
    }
    setLoading(true);
    try {
      if (client?.client_id) {
        await api.put(`/finance/clients/${client.client_id}`, formData);
        toast.success('Client updated');
      } else {
        await api.post('/finance/clients', formData);
        toast.success('Client created');
      }
      onSaved?.();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save client');
    } finally {
      setLoading(false);
    }
  };

  const TABS = [
    { id: 'details', label: 'Other Details', icon: FileText },
    { id: 'address', label: 'Address', icon: MapPin },
    { id: 'remarks', label: 'Remarks', icon: FileText },
  ];

  const inputCls = 'bg-gray-50 dark:bg-[#09090b] border-gray-200 dark:border-[#27272a] text-gray-900 dark:text-[#fafafa] focus:border-[#6366f1]';
  const labelCls = 'text-gray-900 dark:text-[#fafafa] mb-1.5 block text-sm';

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent
        className="bg-white dark:bg-[#18181b] border border-gray-200 dark:border-[#27272a] text-gray-900 dark:text-[#fafafa] max-w-4xl max-h-[92vh] overflow-y-auto"
        data-testid="add-client-modal"
      >
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold" style={{ fontFamily: 'Plus Jakarta Sans' }}>
            {client ? 'Edit Client' : 'New Client'}
          </DialogTitle>
          <p className="text-sm text-gray-600 dark:text-[#a1a1aa]">
            {client ? 'Update client details' : 'Add a new client to your finance directory'}
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 mt-4">
          {/* Customer Type */}
          <div>
            <Label className={labelCls}>Customer Type</Label>
            <div className="flex gap-4">
              {['Business', 'Individual'].map((t) => (
                <label key={t} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="customer_type"
                    value={t}
                    checked={formData.customer_type === t}
                    onChange={(e) => set('customer_type', e.target.value)}
                    className="accent-[#6366f1]"
                    data-testid={`client-type-${t.toLowerCase()}`}
                  />
                  <span className="text-gray-900 dark:text-[#fafafa] flex items-center gap-1.5">
                    {t === 'Business' ? <Building2 className="h-4 w-4" /> : <User className="h-4 w-4" />}
                    {t}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Primary Contact */}
          <div>
            <Label className={labelCls}>Primary Contact</Label>
            <div className="grid grid-cols-3 gap-3">
              <Select value={formData.salutation || ''} onValueChange={(v) => set('salutation', v)}>
                <SelectTrigger className={inputCls}><SelectValue placeholder="Salutation" /></SelectTrigger>
                <SelectContent className="bg-white dark:bg-[#18181b] border-gray-200 dark:border-[#27272a] text-gray-900 dark:text-[#fafafa]">
                  {['Mr.', 'Mrs.', 'Ms.', 'Dr.', 'Prof.'].map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="First Name"
                value={formData.first_name}
                onChange={(e) => set('first_name', e.target.value)}
                onBlur={autoDisplayName}
                className={inputCls}
                data-testid="client-first-name"
              />
              <Input
                placeholder="Last Name"
                value={formData.last_name}
                onChange={(e) => set('last_name', e.target.value)}
                onBlur={autoDisplayName}
                className={inputCls}
                data-testid="client-last-name"
              />
            </div>
          </div>

          {/* Company + Display */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className={labelCls}>Company Name</Label>
              <Input
                value={formData.company_name}
                onChange={(e) => set('company_name', e.target.value)}
                onBlur={autoDisplayName}
                className={inputCls}
                data-testid="client-company-name"
              />
            </div>
            <div>
              <Label className={labelCls}>
                Display Name <span className="text-red-500">*</span>
              </Label>
              <Input
                required
                value={formData.display_name}
                onChange={(e) => set('display_name', e.target.value)}
                className={inputCls}
                data-testid="client-display-name"
                placeholder="Used as identifier across the system"
              />
            </div>
          </div>

          {/* Currency + Email */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className={labelCls}>Currency</Label>
              <Select value={formData.currency} onValueChange={(v) => set('currency', v)}>
                <SelectTrigger className={inputCls}><SelectValue /></SelectTrigger>
                <SelectContent className="bg-white dark:bg-[#18181b] border-gray-200 dark:border-[#27272a] text-gray-900 dark:text-[#fafafa]">
                  <SelectItem value="INR">INR — Indian Rupee</SelectItem>
                  <SelectItem value="USD">USD — US Dollar</SelectItem>
                  <SelectItem value="EUR">EUR — Euro</SelectItem>
                  <SelectItem value="GBP">GBP — British Pound</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className={labelCls}>Email Address</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => set('email', e.target.value)}
                className={inputCls}
                data-testid="client-email"
              />
            </div>
          </div>

          {/* Phone */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className={labelCls}>Work Phone</Label>
              <Input
                value={formData.work_phone}
                onChange={(e) => set('work_phone', e.target.value)}
                className={inputCls}
                placeholder="+91 ..."
                data-testid="client-work-phone"
              />
            </div>
            <div>
              <Label className={labelCls}>Mobile</Label>
              <Input
                value={formData.mobile}
                onChange={(e) => set('mobile', e.target.value)}
                className={inputCls}
                placeholder="+91 ..."
                data-testid="client-mobile"
              />
            </div>
          </div>

          {/* Tabs */}
          <div className="border-t border-gray-200 dark:border-[#27272a] pt-4">
            <div className="flex gap-1 mb-4 border-b border-gray-200 dark:border-[#27272a]">
              {TABS.map((t) => {
                const Icon = t.icon;
                const active = activeTab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setActiveTab(t.id)}
                    className={`px-4 py-2 text-sm flex items-center gap-1.5 border-b-2 transition-colors ${
                      active
                        ? 'border-[#6366f1] text-gray-900 dark:text-[#fafafa]'
                        : 'border-transparent text-gray-600 dark:text-[#a1a1aa] hover:text-gray-900 dark:hover:text-[#fafafa]'
                    }`}
                    data-testid={`client-tab-${t.id}`}
                  >
                    <Icon className="h-4 w-4" />
                    {t.label}
                  </button>
                );
              })}
            </div>

            {activeTab === 'details' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className={labelCls}>
                      GST Treatment <span className="text-red-500">*</span>
                    </Label>
                    <Select value={formData.gst_treatment || ''} onValueChange={(v) => set('gst_treatment', v)}>
                      <SelectTrigger className={inputCls}>
                        <SelectValue placeholder="Select a GST treatment" />
                      </SelectTrigger>
                      <SelectContent className="bg-white dark:bg-[#18181b] border-gray-200 dark:border-[#27272a] text-gray-900 dark:text-[#fafafa]">
                        {GST_TREATMENTS.map((g) => (
                          <SelectItem key={g} value={g}>{g}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className={labelCls}>
                      Place of Supply <span className="text-red-500">*</span>
                    </Label>
                    <Select value={formData.place_of_supply || ''} onValueChange={(v) => set('place_of_supply', v)}>
                      <SelectTrigger className={inputCls}>
                        <SelectValue placeholder="Select state" />
                      </SelectTrigger>
                      <SelectContent className="bg-white dark:bg-[#18181b] border-gray-200 dark:border-[#27272a] text-gray-900 dark:text-[#fafafa] max-h-60">
                        {INDIAN_STATES.map((s) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className={labelCls}>GSTIN</Label>
                    <Input
                      value={formData.gstin}
                      onChange={(e) => set('gstin', e.target.value.toUpperCase())}
                      placeholder="22AAAAA0000A1Z5"
                      className={inputCls}
                      data-testid="client-gstin"
                    />
                  </div>
                  <div>
                    <Label className={labelCls}>PAN</Label>
                    <Input
                      value={formData.pan}
                      onChange={(e) => set('pan', e.target.value.toUpperCase())}
                      placeholder="ABCDE1234F"
                      className={inputCls}
                      data-testid="client-pan"
                    />
                  </div>
                </div>

                <div>
                  <Label className={labelCls}>Tax Preference</Label>
                  <div className="flex gap-4">
                    {['Taxable', 'Tax Exempt'].map((t) => (
                      <label key={t} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="tax_preference"
                          value={t}
                          checked={formData.tax_preference === t}
                          onChange={(e) => set('tax_preference', e.target.value)}
                          className="accent-[#6366f1]"
                        />
                        <span className="text-gray-900 dark:text-[#fafafa]">{t}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className={labelCls}>Payment Terms</Label>
                    <Select value={formData.payment_terms} onValueChange={(v) => set('payment_terms', v)}>
                      <SelectTrigger className={inputCls}><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-white dark:bg-[#18181b] border-gray-200 dark:border-[#27272a] text-gray-900 dark:text-[#fafafa]">
                        {PAYMENT_TERMS.map((p) => (
                          <SelectItem key={p} value={p}>{p}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end gap-3 pb-1.5">
                    <Switch
                      checked={formData.enable_portal}
                      onCheckedChange={(v) => set('enable_portal', v)}
                      data-testid="client-enable-portal"
                    />
                    <Label className="text-gray-900 dark:text-[#fafafa] text-sm">Allow portal access for this client</Label>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'address' && (
              <div className="space-y-5">
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-[#fafafa] mb-3">Billing Address</h4>
                  <Textarea
                    rows={2}
                    placeholder="Street, Building..."
                    value={formData.billing_address}
                    onChange={(e) => set('billing_address', e.target.value)}
                    className={inputCls + ' mb-3'}
                  />
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Input placeholder="City" value={formData.billing_city}
                      onChange={(e) => set('billing_city', e.target.value)} className={inputCls} />
                    <Input placeholder="State" value={formData.billing_state}
                      onChange={(e) => set('billing_state', e.target.value)} className={inputCls} />
                    <Input placeholder="Pincode" value={formData.billing_pincode}
                      onChange={(e) => set('billing_pincode', e.target.value)} className={inputCls} />
                    <Input placeholder="Country" value={formData.billing_country}
                      onChange={(e) => set('billing_country', e.target.value)} className={inputCls} />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    checked={shippingSameAsBilling}
                    onCheckedChange={handleShippingSameAsBilling}
                  />
                  <Label className="text-gray-900 dark:text-[#fafafa] text-sm">Shipping address same as billing</Label>
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-[#fafafa] mb-3">Shipping Address</h4>
                  <Textarea
                    rows={2}
                    placeholder="Street, Building..."
                    value={formData.shipping_address}
                    onChange={(e) => set('shipping_address', e.target.value)}
                    className={inputCls + ' mb-3'}
                    disabled={shippingSameAsBilling}
                  />
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Input placeholder="City" value={formData.shipping_city} disabled={shippingSameAsBilling}
                      onChange={(e) => set('shipping_city', e.target.value)} className={inputCls} />
                    <Input placeholder="State" value={formData.shipping_state} disabled={shippingSameAsBilling}
                      onChange={(e) => set('shipping_state', e.target.value)} className={inputCls} />
                    <Input placeholder="Pincode" value={formData.shipping_pincode} disabled={shippingSameAsBilling}
                      onChange={(e) => set('shipping_pincode', e.target.value)} className={inputCls} />
                    <Input placeholder="Country" value={formData.shipping_country} disabled={shippingSameAsBilling}
                      onChange={(e) => set('shipping_country', e.target.value)} className={inputCls} />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'remarks' && (
              <div>
                <Label className={labelCls}>Internal Remarks</Label>
                <Textarea
                  rows={6}
                  value={formData.remarks}
                  onChange={(e) => set('remarks', e.target.value)}
                  className={inputCls}
                  placeholder="Notes about this client (not visible on invoice)"
                />
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-[#27272a]">
            <Button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="bg-gray-100 dark:bg-[#27272a] hover:bg-gray-200 dark:hover:bg-[#3f3f46] text-gray-900 dark:text-[#fafafa]"
              data-testid="client-cancel-btn"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-[#6366f1] hover:bg-[#4f46e5] text-white"
              data-testid="client-save-btn"
            >
              {loading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
              ) : (
                client ? 'Update Client' : 'Save Client'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddClientModal;
