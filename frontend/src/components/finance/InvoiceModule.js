import React, { useState, useEffect, useCallback } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Calendar } from '../ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { toast } from 'sonner';
import { format } from 'date-fns';
import axios from 'axios';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Plus,
  Download,
  FileText,
  Eye,
  Trash2,
  Copy,
  Send,
  Calendar as CalendarIcon,
  Search,
  Filter,
  X,
  Building2,
  User,
  Mail,
  Phone,
  MapPin,
  CreditCard,
  FileCheck,
  Printer,
  Edit,
  ChevronDown,
  IndianRupee,
} from 'lucide-react';
import CollectInvoiceModal from './CollectInvoiceModal';

const API = process.env.REACT_APP_BACKEND_URL;

const INVOICE_TYPES = ['GST', 'Non-GST', 'Proforma', 'Credit Note'];
const PAYMENT_TERMS = ['Due on Receipt', 'Net 7', 'Net 15', 'Net 30', 'Net 45', 'Net 60', 'Custom'];
const PAYMENT_METHODS = ['Bank Transfer', 'UPI', 'Cash', 'Cheque', 'Credit Card', 'PayPal'];
const GST_RATES = [0, 5, 12, 18, 28];
const TEMPLATES = ['minimal', 'corporate', 'modern', 'professional'];

const InvoiceModule = () => {
  const { isDark } = useTheme();
  const token = localStorage.getItem('session_token');
  const headers = { Authorization: `Bearer ${token}` };

  // State
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [collectInvoice, setCollectInvoice] = useState(null);
  const [leads, setLeads] = useState([]);

  // Form state
  const [invoiceForm, setInvoiceForm] = useState({
    invoice_date: new Date(),
    due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    invoice_type: 'GST',
    gst_type: 'gst',
    gst_rate: 18,
    // Client
    client_name: '',
    client_company: '',
    client_email: '',
    client_phone: '',
    client_address: '',
    client_city: '',
    client_state: '',
    client_pincode: '',
    client_gst_number: '',
    client_pan: '',
    // Billing
    billing_address: '',
    shipping_address: '',
    po_number: '',
    reference_number: '',
    // Payment
    payment_terms: 'Net 30',
    payment_method: '',
    bank_details: '',
    // Items
    items: [{ service_name: '', description: '', quantity: 1, rate: 0, gst_rate: 18, discount_percent: 0 }],
    // Additional
    notes: '',
    terms_and_conditions: '',
    template_type: 'minimal',
  });

  // Load invoices
  const loadInvoices = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/finance/invoices`, { headers });
      setInvoices(res.data || []);
    } catch (error) {
      console.error('Error loading invoices:', error);
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Load leads for client selection
  const loadLeads = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/leads`, { headers });
      setLeads(res.data || []);
    } catch (error) {
      console.error('Error loading leads:', error);
    }
  }, [token]);

  useEffect(() => {
    loadInvoices();
    loadLeads();
  }, [loadInvoices, loadLeads]);

  // Calculate totals
  const calculateTotals = () => {
    let subtotal = 0;
    let totalTax = 0;
    let totalDiscount = 0;

    invoiceForm.items.forEach(item => {
      const itemTotal = item.quantity * item.rate;
      const discount = (itemTotal * (item.discount_percent || 0)) / 100;
      const afterDiscount = itemTotal - discount;
      const tax = (afterDiscount * (item.gst_rate || 0)) / 100;
      
      subtotal += itemTotal;
      totalDiscount += discount;
      totalTax += tax;
    });

    return {
      subtotal,
      totalDiscount,
      totalTax,
      total: subtotal - totalDiscount + totalTax
    };
  };

  // Add item
  const addItem = () => {
    setInvoiceForm({
      ...invoiceForm,
      items: [...invoiceForm.items, { service_name: '', description: '', quantity: 1, rate: 0, gst_rate: 18, discount_percent: 0 }]
    });
  };

  // Remove item
  const removeItem = (index) => {
    if (invoiceForm.items.length > 1) {
      setInvoiceForm({
        ...invoiceForm,
        items: invoiceForm.items.filter((_, i) => i !== index)
      });
    }
  };

  // Update item
  const updateItem = (index, field, value) => {
    const newItems = [...invoiceForm.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setInvoiceForm({ ...invoiceForm, items: newItems });
  };

  // Select lead as client
  const selectLead = (leadId) => {
    const lead = leads.find(l => l.lead_id === leadId);
    if (lead) {
      setInvoiceForm({
        ...invoiceForm,
        lead_id: lead.lead_id,
        client_name: lead.name || '',
        client_company: lead.company_name || '',
        client_email: lead.email || '',
        client_phone: lead.phone || '',
      });
    }
  };

  // Create invoice
  const createInvoice = async () => {
    try {
      if (!invoiceForm.client_name) {
        toast.error('Client name is required');
        return;
      }
      if (invoiceForm.items.some(item => !item.service_name || !item.rate)) {
        toast.error('All items must have service name and rate');
        return;
      }

      await axios.post(`${API}/api/finance/invoices`, {
        ...invoiceForm,
        invoice_date: invoiceForm.invoice_date.toISOString(),
        due_date: invoiceForm.due_date.toISOString(),
      }, { headers });

      toast.success('Invoice created successfully');
      setShowCreateModal(false);
      resetForm();
      loadInvoices();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create invoice');
    }
  };

  // Reset form
  const resetForm = () => {
    setInvoiceForm({
      invoice_date: new Date(),
      due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      invoice_type: 'GST',
      gst_type: 'gst',
      gst_rate: 18,
      client_name: '',
      client_company: '',
      client_email: '',
      client_phone: '',
      client_address: '',
      client_city: '',
      client_state: '',
      client_pincode: '',
      client_gst_number: '',
      client_pan: '',
      billing_address: '',
      shipping_address: '',
      po_number: '',
      reference_number: '',
      payment_terms: 'Net 30',
      payment_method: '',
      bank_details: '',
      items: [{ service_name: '', description: '', quantity: 1, rate: 0, gst_rate: 18, discount_percent: 0 }],
      notes: '',
      terms_and_conditions: '',
      template_type: 'minimal',
    });
  };

  // Download invoice as PDF
  const downloadInvoicePDF = async (invoice) => {
    try {
      toast.info('Generating PDF...');
      
      // Get full invoice data with items
      const res = await axios.get(`${API}/api/finance/invoices/${invoice.invoice_id}/pdf-data`, { headers });
      const data = res.data;

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.width;

      // Header
      doc.setFontSize(24);
      doc.setTextColor(99, 102, 241);
      doc.text('INVOICE', pageWidth / 2, 25, { align: 'center' });

      // Invoice details
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      doc.text(`Invoice #: ${data.invoice_number}`, 14, 40);
      doc.text(`Date: ${data.invoice_date ? format(new Date(data.invoice_date), 'dd MMM yyyy') : '-'}`, 14, 47);
      doc.text(`Due Date: ${data.due_date ? format(new Date(data.due_date), 'dd MMM yyyy') : '-'}`, 14, 54);
      doc.text(`Status: ${(data.status || 'draft').toUpperCase()}`, 14, 61);

      // Company details (right side)
      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      doc.text(data.company?.name || 'Drawlead', pageWidth - 14, 40, { align: 'right' });
      doc.setFont(undefined, 'normal');
      doc.setFontSize(9);
      if (data.company?.address) doc.text(data.company.address, pageWidth - 14, 47, { align: 'right' });
      if (data.company?.gst_number) doc.text(`GST: ${data.company.gst_number}`, pageWidth - 14, 54, { align: 'right' });

      // Bill To
      doc.setFontSize(11);
      doc.setFont(undefined, 'bold');
      doc.text('Bill To:', 14, 80);
      doc.setFont(undefined, 'normal');
      doc.setFontSize(10);
      doc.text(data.client_name || '', 14, 87);
      if (data.client_company) doc.text(data.client_company, 14, 94);
      if (data.client_address) doc.text(data.client_address, 14, 101);
      if (data.client_email) doc.text(data.client_email, 14, 108);
      if (data.client_gst_number) doc.text(`GST: ${data.client_gst_number}`, 14, 115);

      // Items table
      const items = data.items || [];
      const tableData = items.map((item, idx) => [
        idx + 1,
        item.service_name || '',
        item.description || '-',
        item.quantity || 1,
        `Rs.${(item.rate || 0).toLocaleString()}`,
        `${item.gst_rate || 0}%`,
        `Rs.${(item.amount || (item.quantity * item.rate) || 0).toLocaleString()}`
      ]);

      // Use autoTable function
      autoTable(doc, {
        startY: 125,
        head: [['#', 'Service', 'Description', 'Qty', 'Rate', 'GST', 'Amount']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [99, 102, 241] },
        styles: { fontSize: 9 },
        columnStyles: {
          0: { cellWidth: 10 },
          4: { halign: 'right' },
          6: { halign: 'right' }
        }
      });

      // Totals
      const finalY = (doc.lastAutoTable?.finalY || 150) + 10;
      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      doc.text(`Subtotal: ${data.formatted?.subtotal || 'Rs.0.00'}`, pageWidth - 14, finalY, { align: 'right' });
      
      let yOffset = 7;
      if (data.total_discount > 0) {
        doc.text(`Discount: -${data.formatted?.discount || 'Rs.0.00'}`, pageWidth - 14, finalY + yOffset, { align: 'right' });
        yOffset += 7;
      }
      if (data.cgst > 0) {
        doc.text(`CGST: ${data.formatted?.cgst || 'Rs.0.00'}`, pageWidth - 14, finalY + yOffset, { align: 'right' });
        yOffset += 7;
        doc.text(`SGST: ${data.formatted?.sgst || 'Rs.0.00'}`, pageWidth - 14, finalY + yOffset, { align: 'right' });
        yOffset += 7;
      }
      if (data.igst > 0) {
        doc.text(`IGST: ${data.formatted?.igst || 'Rs.0.00'}`, pageWidth - 14, finalY + yOffset, { align: 'right' });
        yOffset += 7;
      }
      
      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      doc.text(`Total: ${data.formatted?.total || 'Rs.0.00'}`, pageWidth - 14, finalY + yOffset + 7, { align: 'right' });

      // Notes
      if (data.notes) {
        doc.setFontSize(9);
        doc.setFont(undefined, 'normal');
        doc.text('Notes:', 14, finalY + yOffset + 25);
        doc.text(data.notes, 14, finalY + yOffset + 32);
      }

      // Footer
      doc.setFontSize(8);
      doc.setTextColor(128, 128, 128);
      doc.text('Thank you for your business!', pageWidth / 2, doc.internal.pageSize.height - 20, { align: 'center' });

      doc.save(`Invoice_${data.invoice_number}.pdf`);
      toast.success('Invoice downloaded successfully');
    } catch (error) {
      console.error('Error downloading invoice:', error);
      toast.error('Failed to download invoice: ' + (error.message || 'Unknown error'));
    }
  };

  // Delete invoice
  const deleteInvoice = async (invoiceId) => {
    if (!window.confirm('Are you sure you want to delete this invoice?')) return;
    try {
      await axios.delete(`${API}/api/finance/invoices/${invoiceId}`, { headers });
      toast.success('Invoice deleted');
      loadInvoices();
    } catch (error) {
      toast.error('Failed to delete invoice');
    }
  };

  // Duplicate invoice
  const duplicateInvoice = async (invoiceId) => {
    try {
      await axios.post(`${API}/api/finance/invoices/${invoiceId}/duplicate`, {}, { headers });
      toast.success('Invoice duplicated');
      loadInvoices();
    } catch (error) {
      toast.error('Failed to duplicate invoice');
    }
  };

  // View invoice
  const viewInvoice = async (invoice) => {
    try {
      const res = await axios.get(`${API}/api/finance/invoices/${invoice.invoice_id}`, { headers });
      setSelectedInvoice(res.data);
      setShowViewModal(true);
    } catch (error) {
      toast.error('Failed to load invoice details');
    }
  };

  // Filter invoices
  const filteredInvoices = invoices.filter(inv => {
    const matchesSearch = 
      inv.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.client_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || inv.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Stats
  const stats = {
    total: invoices.length,
    paid: invoices.filter(i => i.status === 'paid').length,
    pending: invoices.filter(i => i.status === 'pending' || i.status === 'sent').length,
    overdue: invoices.filter(i => i.status === 'overdue').length,
    draft: invoices.filter(i => i.status === 'draft').length,
    totalAmount: invoices.reduce((sum, i) => sum + (i.total_amount || 0), 0),
    paidAmount: invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + (i.total_amount || 0), 0),
  };

  const formatCurrency = (amt) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amt || 0);

  // Theme classes
  const cardClass = isDark ? 'bg-[#18181b] border-[#27272a]' : 'bg-white border-gray-200';
  const textClass = isDark ? 'text-[#fafafa]' : 'text-gray-900';
  const mutedClass = isDark ? 'text-[#71717a]' : 'text-gray-500';
  const inputClass = isDark ? 'bg-[#27272a] border-[#3f3f46] text-white' : 'bg-white border-gray-300';

  const totals = calculateTotals();

  return (
    <div className="space-y-4" data-testid="invoice-module">
      {/* Header */}
      <div className={`p-4 rounded-xl border ${cardClass}`}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className={`text-xl font-bold ${textClass}`}>Invoices</h3>
            <p className={`text-sm ${mutedClass}`}>Create, manage and track all invoices</p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              className={isDark ? 'border-[#3f3f46]' : ''}
              onClick={() => {
                const data = filteredInvoices.map(inv => ({
                  'Invoice #': inv.invoice_number,
                  'Client': inv.client_name,
                  'Date': inv.invoice_date,
                  'Due Date': inv.due_date,
                  'Amount': inv.total_amount,
                  'Status': inv.status
                }));
                // Export logic here
              }}
            >
              <Download className="h-4 w-4 mr-2" /> Export
            </Button>
            <Button 
              className="bg-[#6366f1] hover:bg-[#5855eb]"
              onClick={() => setShowCreateModal(true)}
              data-testid="create-invoice-btn"
            >
              <Plus className="h-4 w-4 mr-2" /> Create Invoice
            </Button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className={`p-4 rounded-xl border text-center ${cardClass}`}>
          <p className={`text-sm ${mutedClass}`}>Total Invoices</p>
          <p className={`text-2xl font-bold ${textClass}`}>{stats.total}</p>
        </div>
        <div className={`p-4 rounded-xl border text-center ${cardClass}`}>
          <p className={`text-sm ${mutedClass}`}>Paid</p>
          <p className="text-2xl font-bold text-[#22c55e]">{stats.paid}</p>
        </div>
        <div className={`p-4 rounded-xl border text-center ${cardClass}`}>
          <p className={`text-sm ${mutedClass}`}>Pending</p>
          <p className="text-2xl font-bold text-[#f59e0b]">{stats.pending}</p>
        </div>
        <div className={`p-4 rounded-xl border text-center ${cardClass}`}>
          <p className={`text-sm ${mutedClass}`}>Overdue</p>
          <p className="text-2xl font-bold text-[#ef4444]">{stats.overdue}</p>
        </div>
        <div className={`p-4 rounded-xl border text-center ${cardClass}`}>
          <p className={`text-sm ${mutedClass}`}>Total Value</p>
          <p className={`text-xl font-bold ${textClass}`}>{formatCurrency(stats.totalAmount)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ${mutedClass}`} />
          <Input
            placeholder="Search by invoice number or client..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`pl-10 ${inputClass}`}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className={`w-[150px] ${inputClass}`}>
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Invoice List */}
      <div className={`rounded-xl overflow-hidden border ${isDark ? 'border-[#27272a]' : 'border-gray-200'}`}>
        <table className="w-full text-sm">
          <thead className={isDark ? 'bg-[#27272a]' : 'bg-gray-100'}>
            <tr>
              <th className={`p-3 text-left ${textClass}`}>Invoice #</th>
              <th className={`p-3 text-left ${textClass}`}>Client</th>
              <th className={`p-3 text-left ${textClass}`}>Type</th>
              <th className={`p-3 text-left ${textClass}`}>Date</th>
              <th className={`p-3 text-left ${textClass}`}>Due Date</th>
              <th className={`p-3 text-right ${textClass}`}>Amount</th>
              <th className={`p-3 text-center ${textClass}`}>Status</th>
              <th className={`p-3 text-center ${textClass}`}>Actions</th>
            </tr>
          </thead>
          <tbody className={`divide-y ${isDark ? 'divide-[#27272a]' : 'divide-gray-100'}`}>
            {filteredInvoices.map(inv => (
              <tr key={inv.invoice_id} className={isDark ? 'hover:bg-[#1f1f23]' : 'hover:bg-gray-50'}>
                <td className={`p-3 font-medium ${textClass}`}>{inv.invoice_number}</td>
                <td className={`p-3 ${mutedClass}`}>
                  <div>
                    <p className={textClass}>{inv.client_name}</p>
                    {inv.client_company && <p className={`text-xs ${mutedClass}`}>{inv.client_company}</p>}
                  </div>
                </td>
                <td className={`p-3 ${mutedClass}`}>
                  <Badge variant="outline" className="text-xs">{inv.invoice_type || 'GST'}</Badge>
                </td>
                <td className={`p-3 ${mutedClass}`}>
                  {inv.invoice_date ? format(new Date(inv.invoice_date), 'dd MMM yyyy') : '-'}
                </td>
                <td className={`p-3 ${mutedClass}`}>
                  {inv.due_date ? format(new Date(inv.due_date), 'dd MMM yyyy') : '-'}
                </td>
                <td className={`p-3 text-right font-medium ${textClass}`}>{formatCurrency(inv.total_amount)}</td>
                <td className="p-3 text-center">
                  <Badge className={`text-xs ${
                    inv.status === 'paid' ? 'bg-green-500/20 text-green-500' :
                    inv.status === 'partial' ? 'bg-orange-500/20 text-orange-500' :
                    inv.status === 'sent' || inv.status === 'pending' ? 'bg-yellow-500/20 text-yellow-500' :
                    inv.status === 'overdue' ? 'bg-red-500/20 text-red-500' :
                    'bg-gray-500/20 text-gray-500'
                  }`}>
                    {(() => {
                      const total = Number(inv.total_amount) || 0;
                      const paid = Number(inv.paid_amount) || 0;
                      const pct = total > 0 ? Math.round((paid / total) * 100) : 0;
                      if (inv.status === 'paid') return 'Paid 100%';
                      if (inv.status === 'partial' || (paid > 0 && paid < total)) return `Partial ${pct}%`;
                      if (inv.status === 'sent' || inv.status === 'pending') return `Pending 0%`;
                      return inv.status;
                    })()}
                  </Badge>
                </td>
                <td className="p-3">
                  <div className="flex justify-center gap-1">
                    {inv.status !== 'paid' && inv.status !== 'cancelled' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setCollectInvoice(inv)}
                        title="Collect Payment"
                        className="text-emerald-500 hover:bg-emerald-500/10"
                        data-testid={`collect-btn-${inv.invoice_id}`}
                      >
                        <IndianRupee className="h-4 w-4" />
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => viewInvoice(inv)} title="View">
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => downloadInvoicePDF(inv)} title="Download PDF">
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => duplicateInvoice(inv.invoice_id)} title="Duplicate">
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => deleteInvoice(inv.invoice_id)} title="Delete" className="text-red-500">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredInvoices.length === 0 && (
              <tr>
                <td colSpan={8} className={`p-8 text-center ${mutedClass}`}>
                  {loading ? 'Loading invoices...' : 'No invoices found. Create your first invoice!'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Create Invoice Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className={`max-w-4xl max-h-[90vh] overflow-y-auto ${isDark ? 'bg-[#18181b] border-[#27272a]' : 'bg-white'}`}>
          <DialogHeader>
            <DialogTitle className={textClass}>Create New Invoice</DialogTitle>
          </DialogHeader>
          
          <Tabs defaultValue="client" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="client">Client</TabsTrigger>
              <TabsTrigger value="items">Items</TabsTrigger>
              <TabsTrigger value="payment">Payment</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>

            {/* Client Tab */}
            <TabsContent value="client" className="space-y-4 mt-4">
              {/* Quick Select from Leads */}
              {leads.length > 0 && (
                <div>
                  <Label className={mutedClass}>Quick Select from Leads</Label>
                  <Select onValueChange={selectLead}>
                    <SelectTrigger className={inputClass}>
                      <SelectValue placeholder="Select a lead..." />
                    </SelectTrigger>
                    <SelectContent>
                      {leads.map(lead => (
                        <SelectItem key={lead.lead_id} value={lead.lead_id}>
                          {lead.name} {lead.company_name && `- ${lead.company_name}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className={mutedClass}>Client Name *</Label>
                  <Input
                    value={invoiceForm.client_name}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, client_name: e.target.value })}
                    className={inputClass}
                    placeholder="John Doe"
                  />
                </div>
                <div>
                  <Label className={mutedClass}>Company Name</Label>
                  <Input
                    value={invoiceForm.client_company}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, client_company: e.target.value })}
                    className={inputClass}
                    placeholder="ABC Corp"
                  />
                </div>
                <div>
                  <Label className={mutedClass}>Email</Label>
                  <Input
                    type="email"
                    value={invoiceForm.client_email}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, client_email: e.target.value })}
                    className={inputClass}
                    placeholder="john@example.com"
                  />
                </div>
                <div>
                  <Label className={mutedClass}>Phone</Label>
                  <Input
                    value={invoiceForm.client_phone}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, client_phone: e.target.value })}
                    className={inputClass}
                    placeholder="+91 98765 43210"
                  />
                </div>
                <div className="col-span-2">
                  <Label className={mutedClass}>Address</Label>
                  <Textarea
                    value={invoiceForm.client_address}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, client_address: e.target.value })}
                    className={inputClass}
                    placeholder="123 Main Street"
                    rows={2}
                  />
                </div>
                <div>
                  <Label className={mutedClass}>City</Label>
                  <Input
                    value={invoiceForm.client_city}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, client_city: e.target.value })}
                    className={inputClass}
                    placeholder="Chennai"
                  />
                </div>
                <div>
                  <Label className={mutedClass}>State</Label>
                  <Input
                    value={invoiceForm.client_state}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, client_state: e.target.value })}
                    className={inputClass}
                    placeholder="Tamil Nadu"
                  />
                </div>
                <div>
                  <Label className={mutedClass}>Pincode</Label>
                  <Input
                    value={invoiceForm.client_pincode}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, client_pincode: e.target.value })}
                    className={inputClass}
                    placeholder="600001"
                  />
                </div>
                <div>
                  <Label className={mutedClass}>GST Number</Label>
                  <Input
                    value={invoiceForm.client_gst_number}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, client_gst_number: e.target.value })}
                    className={inputClass}
                    placeholder="33AABCU9603R1ZM"
                  />
                </div>
                <div>
                  <Label className={mutedClass}>PAN</Label>
                  <Input
                    value={invoiceForm.client_pan}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, client_pan: e.target.value })}
                    className={inputClass}
                    placeholder="AABCU9603R"
                  />
                </div>
              </div>
            </TabsContent>

            {/* Items Tab */}
            <TabsContent value="items" className="space-y-4 mt-4">
              <div className="space-y-3">
                {invoiceForm.items.map((item, index) => (
                  <div key={index} className={`p-4 rounded-lg border ${isDark ? 'border-[#3f3f46] bg-[#1f1f23]' : 'border-gray-200 bg-gray-50'}`}>
                    <div className="grid grid-cols-12 gap-3">
                      <div className="col-span-4">
                        <Label className={`text-xs ${mutedClass}`}>Service/Product *</Label>
                        <Input
                          value={item.service_name}
                          onChange={(e) => updateItem(index, 'service_name', e.target.value)}
                          className={inputClass}
                          placeholder="Web Development"
                        />
                      </div>
                      <div className="col-span-2">
                        <Label className={`text-xs ${mutedClass}`}>Qty</Label>
                        <Input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                          className={inputClass}
                        />
                      </div>
                      <div className="col-span-2">
                        <Label className={`text-xs ${mutedClass}`}>Rate *</Label>
                        <Input
                          type="number"
                          value={item.rate}
                          onChange={(e) => updateItem(index, 'rate', parseFloat(e.target.value) || 0)}
                          className={inputClass}
                        />
                      </div>
                      <div className="col-span-2">
                        <Label className={`text-xs ${mutedClass}`}>GST %</Label>
                        <Select value={item.gst_rate?.toString()} onValueChange={(v) => updateItem(index, 'gst_rate', parseFloat(v))}>
                          <SelectTrigger className={inputClass}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {GST_RATES.map(rate => (
                              <SelectItem key={rate} value={rate.toString()}>{rate}%</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-1">
                        <Label className={`text-xs ${mutedClass}`}>Disc %</Label>
                        <Input
                          type="number"
                          value={item.discount_percent}
                          onChange={(e) => updateItem(index, 'discount_percent', parseFloat(e.target.value) || 0)}
                          className={inputClass}
                        />
                      </div>
                      <div className="col-span-1 flex items-end">
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          onClick={() => removeItem(index)}
                          disabled={invoiceForm.items.length === 1}
                          className="text-red-500"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="mt-2">
                      <Input
                        value={item.description}
                        onChange={(e) => updateItem(index, 'description', e.target.value)}
                        className={inputClass}
                        placeholder="Description (optional)"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <Button variant="outline" onClick={addItem} className="w-full">
                <Plus className="h-4 w-4 mr-2" /> Add Item
              </Button>

              {/* Totals */}
              <div className={`p-4 rounded-lg border ${cardClass}`}>
                <div className="space-y-2 text-right">
                  <div className="flex justify-between">
                    <span className={mutedClass}>Subtotal</span>
                    <span className={textClass}>{formatCurrency(totals.subtotal)}</span>
                  </div>
                  {totals.totalDiscount > 0 && (
                    <div className="flex justify-between">
                      <span className={mutedClass}>Discount</span>
                      <span className="text-red-500">-{formatCurrency(totals.totalDiscount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className={mutedClass}>Tax (GST)</span>
                    <span className={textClass}>{formatCurrency(totals.totalTax)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold pt-2 border-t">
                    <span className={textClass}>Total</span>
                    <span className="text-[#6366f1]">{formatCurrency(totals.total)}</span>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Payment Tab */}
            <TabsContent value="payment" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className={mutedClass}>Invoice Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={`w-full justify-start ${inputClass}`}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(invoiceForm.invoice_date, 'dd MMM yyyy')}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={invoiceForm.invoice_date}
                        onSelect={(date) => date && setInvoiceForm({ ...invoiceForm, invoice_date: date })}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label className={mutedClass}>Due Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={`w-full justify-start ${inputClass}`}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(invoiceForm.due_date, 'dd MMM yyyy')}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={invoiceForm.due_date}
                        onSelect={(date) => date && setInvoiceForm({ ...invoiceForm, due_date: date })}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label className={mutedClass}>Payment Terms</Label>
                  <Select value={invoiceForm.payment_terms} onValueChange={(v) => setInvoiceForm({ ...invoiceForm, payment_terms: v })}>
                    <SelectTrigger className={inputClass}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_TERMS.map(term => (
                        <SelectItem key={term} value={term}>{term}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className={mutedClass}>Payment Method</Label>
                  <Select value={invoiceForm.payment_method} onValueChange={(v) => setInvoiceForm({ ...invoiceForm, payment_method: v })}>
                    <SelectTrigger className={inputClass}>
                      <SelectValue placeholder="Select method..." />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map(method => (
                        <SelectItem key={method} value={method}>{method}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className={mutedClass}>PO Number</Label>
                  <Input
                    value={invoiceForm.po_number}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, po_number: e.target.value })}
                    className={inputClass}
                    placeholder="PO-2025-001"
                  />
                </div>
                <div>
                  <Label className={mutedClass}>Reference Number</Label>
                  <Input
                    value={invoiceForm.reference_number}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, reference_number: e.target.value })}
                    className={inputClass}
                    placeholder="REF-001"
                  />
                </div>
                <div className="col-span-2">
                  <Label className={mutedClass}>Bank Details</Label>
                  <Textarea
                    value={invoiceForm.bank_details}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, bank_details: e.target.value })}
                    className={inputClass}
                    placeholder="Bank Name: XYZ Bank&#10;Account Number: 1234567890&#10;IFSC: XYZB0001234"
                    rows={3}
                  />
                </div>
              </div>
            </TabsContent>

            {/* Settings Tab */}
            <TabsContent value="settings" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className={mutedClass}>Invoice Type</Label>
                  <Select value={invoiceForm.invoice_type} onValueChange={(v) => setInvoiceForm({ ...invoiceForm, invoice_type: v })}>
                    <SelectTrigger className={inputClass}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {INVOICE_TYPES.map(type => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className={mutedClass}>Template</Label>
                  <Select value={invoiceForm.template_type} onValueChange={(v) => setInvoiceForm({ ...invoiceForm, template_type: v })}>
                    <SelectTrigger className={inputClass}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TEMPLATES.map(template => (
                        <SelectItem key={template} value={template}>{template.charAt(0).toUpperCase() + template.slice(1)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Label className={mutedClass}>Notes (visible on invoice)</Label>
                  <Textarea
                    value={invoiceForm.notes}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, notes: e.target.value })}
                    className={inputClass}
                    placeholder="Thank you for your business!"
                    rows={2}
                  />
                </div>
                <div className="col-span-2">
                  <Label className={mutedClass}>Terms & Conditions</Label>
                  <Textarea
                    value={invoiceForm.terms_and_conditions}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, terms_and_conditions: e.target.value })}
                    className={inputClass}
                    placeholder="1. Payment is due within the specified period.&#10;2. Late payments may incur additional charges."
                    rows={3}
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-3 mt-4 pt-4 border-t">
            <Button variant="outline" onClick={() => { setShowCreateModal(false); resetForm(); }}>
              Cancel
            </Button>
            <Button className="bg-[#6366f1] hover:bg-[#5855eb]" onClick={createInvoice}>
              Create Invoice
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Invoice Modal */}
      <Dialog open={showViewModal} onOpenChange={setShowViewModal}>
        <DialogContent className={`max-w-3xl ${isDark ? 'bg-[#18181b] border-[#27272a]' : 'bg-white'}`}>
          <DialogHeader>
            <DialogTitle className={textClass}>Invoice Details</DialogTitle>
          </DialogHeader>
          
          {selectedInvoice && (
            <div className="space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className={`text-2xl font-bold ${textClass}`}>{selectedInvoice.invoice_number}</h3>
                  <Badge className={`mt-1 ${
                    selectedInvoice.status === 'paid' ? 'bg-green-500/20 text-green-500' :
                    selectedInvoice.status === 'overdue' ? 'bg-red-500/20 text-red-500' :
                    'bg-yellow-500/20 text-yellow-500'
                  }`}>
                    {selectedInvoice.status}
                  </Badge>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => downloadInvoicePDF(selectedInvoice)}>
                    <Download className="h-4 w-4 mr-1" /> Download
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h4 className={`font-semibold mb-2 ${textClass}`}>Client Information</h4>
                  <div className={`space-y-1 text-sm ${mutedClass}`}>
                    <p className={textClass}>{selectedInvoice.client_name}</p>
                    {selectedInvoice.client_company && <p>{selectedInvoice.client_company}</p>}
                    {selectedInvoice.client_email && <p>{selectedInvoice.client_email}</p>}
                    {selectedInvoice.client_phone && <p>{selectedInvoice.client_phone}</p>}
                    {selectedInvoice.client_address && <p>{selectedInvoice.client_address}</p>}
                    {selectedInvoice.client_gst_number && <p>GST: {selectedInvoice.client_gst_number}</p>}
                  </div>
                </div>
                <div>
                  <h4 className={`font-semibold mb-2 ${textClass}`}>Invoice Details</h4>
                  <div className={`space-y-1 text-sm ${mutedClass}`}>
                    <p>Date: {selectedInvoice.invoice_date ? format(new Date(selectedInvoice.invoice_date), 'dd MMM yyyy') : '-'}</p>
                    <p>Due: {selectedInvoice.due_date ? format(new Date(selectedInvoice.due_date), 'dd MMM yyyy') : '-'}</p>
                    <p>Type: {selectedInvoice.invoice_type || 'GST'}</p>
                    {selectedInvoice.po_number && <p>PO: {selectedInvoice.po_number}</p>}
                    {selectedInvoice.payment_terms && <p>Terms: {selectedInvoice.payment_terms}</p>}
                  </div>
                </div>
              </div>

              {/* Items */}
              {selectedInvoice.items && selectedInvoice.items.length > 0 && (
                <div>
                  <h4 className={`font-semibold mb-2 ${textClass}`}>Items</h4>
                  <div className={`rounded-lg border ${isDark ? 'border-[#3f3f46]' : 'border-gray-200'}`}>
                    <table className="w-full text-sm">
                      <thead className={isDark ? 'bg-[#27272a]' : 'bg-gray-100'}>
                        <tr>
                          <th className="p-2 text-left">Item</th>
                          <th className="p-2 text-right">Qty</th>
                          <th className="p-2 text-right">Rate</th>
                          <th className="p-2 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedInvoice.items.map((item, idx) => (
                          <tr key={idx} className={isDark ? 'border-t border-[#3f3f46]' : 'border-t'}>
                            <td className={`p-2 ${textClass}`}>{item.service_name}</td>
                            <td className={`p-2 text-right ${mutedClass}`}>{item.quantity}</td>
                            <td className={`p-2 text-right ${mutedClass}`}>{formatCurrency(item.rate)}</td>
                            <td className={`p-2 text-right ${textClass}`}>{formatCurrency(item.amount || item.quantity * item.rate)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Totals */}
              <div className={`p-4 rounded-lg ${isDark ? 'bg-[#1f1f23]' : 'bg-gray-50'}`}>
                <div className="space-y-2 text-right">
                  <div className="flex justify-between">
                    <span className={mutedClass}>Subtotal</span>
                    <span className={textClass}>{formatCurrency(selectedInvoice.subtotal)}</span>
                  </div>
                  {selectedInvoice.total_discount > 0 && (
                    <div className="flex justify-between">
                      <span className={mutedClass}>Discount</span>
                      <span className="text-red-500">-{formatCurrency(selectedInvoice.total_discount)}</span>
                    </div>
                  )}
                  {selectedInvoice.cgst > 0 && (
                    <>
                      <div className="flex justify-between">
                        <span className={mutedClass}>CGST</span>
                        <span className={textClass}>{formatCurrency(selectedInvoice.cgst)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className={mutedClass}>SGST</span>
                        <span className={textClass}>{formatCurrency(selectedInvoice.sgst)}</span>
                      </div>
                    </>
                  )}
                  {selectedInvoice.igst > 0 && (
                    <div className="flex justify-between">
                      <span className={mutedClass}>IGST</span>
                      <span className={textClass}>{formatCurrency(selectedInvoice.igst)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-lg font-bold pt-2 border-t">
                    <span className={textClass}>Total</span>
                    <span className="text-[#6366f1]">{formatCurrency(selectedInvoice.total_amount)}</span>
                  </div>
                </div>
              </div>

              {selectedInvoice.notes && (
                <div>
                  <h4 className={`font-semibold mb-1 ${textClass}`}>Notes</h4>
                  <p className={`text-sm ${mutedClass}`}>{selectedInvoice.notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Collect Payment Modal */}
      {collectInvoice && (
        <CollectInvoiceModal
          invoice={collectInvoice}
          onClose={() => setCollectInvoice(null)}
          onSaved={() => { setCollectInvoice(null); loadInvoices(); }}
        />
      )}
    </div>
  );
};

export default InvoiceModule;
