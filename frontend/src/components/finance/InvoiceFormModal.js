import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import api from '../../utils/api';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2 } from 'lucide-react';

const InvoiceFormModal = ({ invoice, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    invoice_date: new Date().toISOString().split('T')[0],
    due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    client_name: '',
    client_address: '',
    client_gst_number: '',
    client_email: '',
    client_phone: '',
    gst_type: 'non-gst',
    gst_rate: 18,
    payment_terms: 'Payment due within 30 days',
    notes: '',
    template_type: 'minimal',
  });
  const [items, setItems] = useState([{ service_name: '', description: '', quantity: 1, rate: 0 }]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (invoice) {
      setFormData({
        invoice_date: new Date(invoice.invoice_date).toISOString().split('T')[0],
        due_date: new Date(invoice.due_date).toISOString().split('T')[0],
        client_name: invoice.client_name || '',
        client_address: invoice.client_address || '',
        client_gst_number: invoice.client_gst_number || '',
        client_email: invoice.client_email || '',
        client_phone: invoice.client_phone || '',
        gst_type: invoice.gst_type || 'non-gst',
        gst_rate: invoice.gst_rate || 18,
        payment_terms: invoice.payment_terms || '',
        notes: invoice.notes || '',
        template_type: invoice.template_type || 'minimal',
      });
      setItems(invoice.items || [{ service_name: '', description: '', quantity: 1, rate: 0 }]);
    }
  }, [invoice]);

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...items];
    newItems[index][field] = field === 'quantity' || field === 'rate' ? parseFloat(value) || 0 : value;
    setItems(newItems);
  };

  const addItem = () => {
    setItems([...items, { service_name: '', description: '', quantity: 1, rate: 0 }]);
  };

  const removeItem = (index) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const calculateSubtotal = () => {
    return items.reduce((sum, item) => sum + (item.quantity * item.rate), 0);
  };

  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    if (formData.gst_type === 'gst') {
      const gstAmount = (subtotal * formData.gst_rate) / 100;
      return subtotal + gstAmount;
    }
    return subtotal;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        ...formData,
        invoice_date: new Date(formData.invoice_date).toISOString(),
        due_date: new Date(formData.due_date).toISOString(),
        items: items.map(item => ({
          service_name: item.service_name,
          description: item.description || '',
          quantity: item.quantity,
          rate: item.rate
        }))
      };

      if (invoice) {
        await api.put(`/finance/invoices/${invoice.invoice_id}`, payload);
        toast.success('Invoice updated successfully');
      } else {
        await api.post('/finance/invoices', payload);
        toast.success('Invoice created successfully');
      }
      onSave();
    } catch (error) {
      console.error('Error saving invoice:', error);
      toast.error(error.response?.data?.detail || 'Failed to save invoice');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent
        className="bg-[#18181b] border border-[#27272a] text-[#fafafa] max-w-4xl max-h-[90vh] overflow-y-auto"
        data-testid="invoice-form-modal"
      >
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold" style={{ fontFamily: 'Plus Jakarta Sans' }}>
            {invoice ? 'Edit Invoice' : 'New Invoice'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          {/* Client Details */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-[#fafafa]">Client Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-[#fafafa] mb-2 block">Client Name *</Label>
                <Input
                  value={formData.client_name}
                  onChange={(e) => handleChange('client_name', e.target.value)}
                  required
                  className="bg-[#09090b] border-[#27272a] text-[#fafafa]"
                />
              </div>
              <div>
                <Label className="text-[#fafafa] mb-2 block">Email</Label>
                <Input
                  type="email"
                  value={formData.client_email}
                  onChange={(e) => handleChange('client_email', e.target.value)}
                  className="bg-[#09090b] border-[#27272a] text-[#fafafa]"
                />
              </div>
              <div>
                <Label className="text-[#fafafa] mb-2 block">Phone</Label>
                <Input
                  value={formData.client_phone}
                  onChange={(e) => handleChange('client_phone', e.target.value)}
                  className="bg-[#09090b] border-[#27272a] text-[#fafafa]"
                />
              </div>
              <div>
                <Label className="text-[#fafafa] mb-2 block">GST Number</Label>
                <Input
                  value={formData.client_gst_number}
                  onChange={(e) => handleChange('client_gst_number', e.target.value)}
                  className="bg-[#09090b] border-[#27272a] text-[#fafafa]"
                />
              </div>
            </div>
            <div>
              <Label className="text-[#fafafa] mb-2 block">Address</Label>
              <Textarea
                value={formData.client_address}
                onChange={(e) => handleChange('client_address', e.target.value)}
                rows={2}
                className="bg-[#09090b] border-[#27272a] text-[#fafafa]"
              />
            </div>
          </div>

          {/* Invoice Details */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-[#fafafa]">Invoice Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label className="text-[#fafafa] mb-2 block">Invoice Date *</Label>
                <Input
                  type="date"
                  value={formData.invoice_date}
                  onChange={(e) => handleChange('invoice_date', e.target.value)}
                  required
                  className="bg-[#09090b] border-[#27272a] text-[#fafafa]"
                />
              </div>
              <div>
                <Label className="text-[#fafafa] mb-2 block">Due Date *</Label>
                <Input
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => handleChange('due_date', e.target.value)}
                  required
                  className="bg-[#09090b] border-[#27272a] text-[#fafafa]"
                />
              </div>
              <div>
                <Label className="text-[#fafafa] mb-2 block">Template</Label>
                <Select value={formData.template_type} onValueChange={(value) => handleChange('template_type', value)}>
                  <SelectTrigger className="bg-[#09090b] border-[#27272a] text-[#fafafa]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#18181b] border-[#27272a] text-[#fafafa]">
                    <SelectItem value="minimal">Minimal</SelectItem>
                    <SelectItem value="corporate">Corporate</SelectItem>
                    <SelectItem value="modern">Modern</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* GST Details */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-[#fafafa]">GST Configuration</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-[#fafafa] mb-2 block">GST Type *</Label>
                <Select value={formData.gst_type} onValueChange={(value) => handleChange('gst_type', value)}>
                  <SelectTrigger className="bg-[#09090b] border-[#27272a] text-[#fafafa]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#18181b] border-[#27272a] text-[#fafafa]">
                    <SelectItem value="gst">GST Invoice</SelectItem>
                    <SelectItem value="non-gst">Non-GST Invoice</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {formData.gst_type === 'gst' && (
                <div>
                  <Label className="text-[#fafafa] mb-2 block">GST Rate (%) *</Label>
                  <Select value={formData.gst_rate.toString()} onValueChange={(value) => handleChange('gst_rate', parseFloat(value))}>
                    <SelectTrigger className="bg-[#09090b] border-[#27272a] text-[#fafafa]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#18181b] border-[#27272a] text-[#fafafa]">
                      <SelectItem value="5">5%</SelectItem>
                      <SelectItem value="12">12%</SelectItem>
                      <SelectItem value="18">18%</SelectItem>
                      <SelectItem value="28">28%</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>

          {/* Line Items */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-[#fafafa]">Line Items</h3>
              <Button
                type="button"
                onClick={addItem}
                className="bg-[#6366f1] hover:bg-[#4f46e5] text-white"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Item
              </Button>
            </div>
            <div className="space-y-3">
              {items.map((item, index) => (
                <div key={index} className="grid grid-cols-12 gap-3 items-end p-4 bg-[#09090b] border border-[#27272a] rounded-lg">
                  <div className="col-span-4">
                    <Label className="text-[#fafafa] mb-2 block text-xs">Service/Item *</Label>
                    <Input
                      value={item.service_name}
                      onChange={(e) => handleItemChange(index, 'service_name', e.target.value)}
                      required
                      placeholder="Web Development"
                      className="bg-[#18181b] border-[#27272a] text-[#fafafa]"
                    />
                  </div>
                  <div className="col-span-3">
                    <Label className="text-[#fafafa] mb-2 block text-xs">Description</Label>
                    <Input
                      value={item.description}
                      onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                      placeholder="Project details"
                      className="bg-[#18181b] border-[#27272a] text-[#fafafa]"
                    />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-[#fafafa] mb-2 block text-xs">Qty *</Label>
                    <Input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                      required
                      min="0.01"
                      step="0.01"
                      className="bg-[#18181b] border-[#27272a] text-[#fafafa]"
                    />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-[#fafafa] mb-2 block text-xs">Rate (₹) *</Label>
                    <Input
                      type="number"
                      value={item.rate}
                      onChange={(e) => handleItemChange(index, 'rate', e.target.value)}
                      required
                      min="0"
                      step="0.01"
                      className="bg-[#18181b] border-[#27272a] text-[#fafafa]"
                    />
                  </div>
                  <div className="col-span-1 flex items-center justify-end">
                    <Button
                      type="button"
                      onClick={() => removeItem(index)}
                      disabled={items.length === 1}
                      className="bg-[#ef4444]/10 hover:bg-[#ef4444]/20 text-[#ef4444] h-8 w-8 p-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Totals */}
          <div className="bg-[#09090b] border border-[#27272a] rounded-lg p-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between text-[#fafafa]">
                <span>Subtotal:</span>
                <span className="font-semibold">₹{calculateSubtotal().toLocaleString()}</span>
              </div>
              {formData.gst_type === 'gst' && (
                <>
                  <div className="flex items-center justify-between text-[#a1a1aa] text-sm">
                    <span>GST ({formData.gst_rate}%):</span>
                    <span>₹{((calculateSubtotal() * formData.gst_rate) / 100).toLocaleString()}</span>
                  </div>
                  <div className="border-t border-[#27272a] pt-3 flex items-center justify-between text-[#fafafa] font-bold text-lg">
                    <span>Total Amount:</span>
                    <span className="text-[#6366f1]">₹{calculateTotal().toLocaleString()}</span>
                  </div>
                </>
              )}
              {formData.gst_type === 'non-gst' && (
                <div className="border-t border-[#27272a] pt-3 flex items-center justify-between text-[#fafafa] font-bold text-lg">
                  <span>Total Amount:</span>
                  <span className="text-[#6366f1]">₹{calculateTotal().toLocaleString()}</span>
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label className="text-[#fafafa] mb-2 block">Notes</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              rows={3}
              placeholder="Additional notes or instructions..."
              className="bg-[#09090b] border-[#27272a] text-[#fafafa]"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-[#27272a]">
            <Button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="bg-[#27272a] hover:bg-[#3f3f46] text-[#fafafa]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-[#6366f1] hover:bg-[#4f46e5] text-white glow-primary"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                invoice ? 'Update Invoice' : 'Create Invoice'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default InvoiceFormModal;
