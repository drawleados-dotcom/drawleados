import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Plus, FileText, Download, Copy, Edit, Trash2, Eye, Calendar, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';
import InvoiceFormModal from './InvoiceFormModal';
import InvoicePreviewModal from './InvoicePreviewModal';
import InvoiceRequestDetailModal from './InvoiceRequestDetailModal';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const InvoicesTab = () => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear().toString());
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewInvoice, setPreviewInvoice] = useState(null);
  const [activeView, setActiveView] = useState('list');
  // 'all' = both, 'new' = invoices NOT from payment schedule, 'payment_schedule' = ones raised via Payment Schedule
  const [sourceFilter, setSourceFilter] = useState('all');
  // 'all' | 'gst' | 'non_gst' — drives the new pill strip on the Invoice List view.
  // Non-GST also includes Unregistered (`gst_type='no_tax'`) invoices.
  const [taxFilter, setTaxFilter] = useState('all');

  // Sales → Finance bridge: pending Invoice Requests raised from Leads
  const [invoiceRequests, setInvoiceRequests] = useState([]);
  // detail-popup state
  const [viewingRequest, setViewingRequest] = useState(null);
  // prefill payload passed to InvoiceFormModal after Raise Invoice
  const [invoicePreset, setInvoicePreset] = useState(null); // { clientId, gstType, items, notes, requestId }

  const months = [
    { value: '0', label: 'January' },
    { value: '1', label: 'February' },
    { value: '2', label: 'March' },
    { value: '3', label: 'April' },
    { value: '4', label: 'May' },
    { value: '5', label: 'June' },
    { value: '6', label: 'July' },
    { value: '7', label: 'August' },
    { value: '8', label: 'September' },
    { value: '9', label: 'October' },
    { value: '10', label: 'November' },
    { value: '11', label: 'December' },
  ];

  const years = Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - 2 + i).toString());

  useEffect(() => {
    fetchInvoices();
  }, [statusFilter]);

  useEffect(() => {
    fetchInvoiceRequests();
  }, []);

  const fetchInvoiceRequests = async () => {
    try {
      const res = await api.get('/finance/banks/invoice-requests', { params: { status: 'pending' } });
      setInvoiceRequests(res.data || []);
    } catch (error) {
      console.error('Error fetching invoice requests:', error);
    }
  };

  const fetchInvoices = async () => {
    try {
      const params = statusFilter !== 'all' ? { status: statusFilter } : {};
      const response = await api.get('/finance/invoices', { params });
      setInvoices(response.data);
    } catch (error) {
      console.error('Error fetching invoices:', error);
      toast.error('Failed to load invoices');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateInvoice = () => {
    setSelectedInvoice(null);
    setShowInvoiceModal(true);
  };

  const handleEditInvoice = (invoice) => {
    setSelectedInvoice(invoice);
    setShowInvoiceModal(true);
  };

  const handlePreviewInvoice = (invoice) => {
    setPreviewInvoice(invoice);
    setShowPreviewModal(true);
  };

  const handleDuplicateInvoice = async (invoiceId) => {
    try {
      await api.post(`/finance/invoices/${invoiceId}/duplicate`);
      toast.success('Invoice duplicated successfully');
      fetchInvoices();
    } catch (error) {
      toast.error('Failed to duplicate invoice');
    }
  };

  const handleDeleteInvoice = async (invoiceId) => {
    if (!window.confirm('Are you sure you want to delete this invoice?')) return;
    try {
      await api.delete(`/finance/invoices/${invoiceId}`);
      toast.success('Invoice deleted');
      fetchInvoices();
    } catch (error) {
      toast.error('Failed to delete invoice');
    }
  };

  const handleUpdateStatus = async (invoiceId, newStatus) => {
    try {
      await api.put(`/finance/invoices/${invoiceId}`, { status: newStatus });
      toast.success('Status updated');
      fetchInvoices();
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  // NEW two-step flow: open detail popup → Create Client → Raise Invoice.
  // The InvoiceRequestDetailModal handles the Create Client step internally.
  // When the user clicks "Raise Invoice" inside it, we open InvoiceFormModal
  // with the resolved client + request data pre-filled.
  const handleRaiseInvoiceFromRequest = ({ request, client }) => {
    const isGst = (request.gst_type || 'gst') === 'gst';
    setInvoicePreset({
      requestId: request.request_id,
      clientId: client.client_id,
      gstType: isGst ? 'gst' : 'non_gst',
      notes: request.notes || '',
      items: [{
        service_name: request.notes ? request.notes.slice(0, 80) : 'Service',
        description: request.notes || '',
        quantity: 1,
        rate: parseFloat(request.amount) || 0,
        discount_percent: 0,
        gst_rate: isGst ? 18 : 0,
      }],
    });
    setViewingRequest(null);
    setSelectedInvoice(null);    // create-mode
    setShowInvoiceModal(true);
  };

  const handleRejectInvoiceRequest = async (req) => {
    if (!window.confirm(`Reject invoice request from ${req.company_name}?`)) return;
    try {
      await api.delete(`/finance/banks/invoice-requests/${req.request_id}`);
      toast.success('Request removed');
      fetchInvoiceRequests();
    } catch (error) {
      toast.error('Failed to remove request');
    }
  };

  const handleExport = async () => {
    try {
      const response = await api.get('/finance/exports/invoices');
      const dataStr = JSON.stringify(response.data, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `invoices-export-${new Date().toISOString()}.json`;
      link.click();
      toast.success('Invoices exported successfully');
    } catch (error) {
      toast.error('Failed to export invoices');
    }
  };

  // Filter invoices
  const filteredInvoices = invoices.filter((invoice) => {
    const search = searchTerm.toLowerCase();
    const matchesSearch = 
      invoice.client_name?.toLowerCase().includes(search) ||
      invoice.invoice_number?.toLowerCase().includes(search);
    
    // Month and year filter
    const invoiceDate = new Date(invoice.invoice_date);
    const matchesMonth = monthFilter === 'all' || invoiceDate.getMonth().toString() === monthFilter;
    const matchesYear = invoiceDate.getFullYear().toString() === yearFilter;

    // Source filter: 'all' | 'new' | 'payment_schedule'.
    // Invoices without an explicit `source` are legacy = treated as 'new'.
    const src = invoice.source || 'new';
    const matchesSource =
      sourceFilter === 'all' ? true
      : sourceFilter === 'payment_schedule' ? src === 'payment_schedule'
      : src !== 'payment_schedule';

    // Tax filter (Invoice List view) — GST = strict registered, Non-GST = no_gst + no_tax (Unregistered)
    const gt = (invoice.gst_type || 'gst').toLowerCase();
    const matchesTax =
      taxFilter === 'all' ? true
      : taxFilter === 'gst' ? gt === 'gst'
      : (gt === 'non_gst' || gt === 'no_tax');

    return matchesSearch && matchesMonth && matchesYear && matchesSource && matchesTax;
  });

  // Calculate month-wise report data
  const getMonthlyReportData = () => {
    const monthlyData = {};
    
    invoices.forEach((invoice) => {
      const date = new Date(invoice.invoice_date);
      if (date.getFullYear().toString() !== yearFilter) return;
      
      const monthKey = date.getMonth();
      const monthName = months[monthKey].label.substring(0, 3);
      
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = {
          month: monthName,
          total: 0,
          paid: 0,
          pending: 0,
          overdue: 0,
          count: 0,
        };
      }
      
      monthlyData[monthKey].total += invoice.total_amount || 0;
      monthlyData[monthKey].count += 1;
      
      if (invoice.status === 'paid') {
        monthlyData[monthKey].paid += invoice.total_amount || 0;
      } else if (invoice.status === 'overdue') {
        monthlyData[monthKey].overdue += invoice.total_amount || 0;
      } else {
        monthlyData[monthKey].pending += invoice.total_amount || 0;
      }
    });

    // Convert to array and sort by month
    return Object.keys(monthlyData)
      .sort((a, b) => parseInt(a) - parseInt(b))
      .map((key) => monthlyData[key]);
  };

  // Calculate status distribution
  const getStatusDistribution = () => {
    const statusData = {
      draft: { name: 'Draft', value: 0, color: '#71717a' },
      sent: { name: 'Sent', value: 0, color: '#3b82f6' },
      paid: { name: 'Paid', value: 0, color: '#10b981' },
      overdue: { name: 'Overdue', value: 0, color: '#ef4444' },
    };

    filteredInvoices.forEach((invoice) => {
      if (statusData[invoice.status]) {
        statusData[invoice.status].value += invoice.total_amount || 0;
      }
    });

    return Object.values(statusData).filter((s) => s.value > 0);
  };

  // Calculate totals for the filtered data
  const getTotals = () => {
    return filteredInvoices.reduce(
      (acc, inv) => {
        acc.total += inv.total_amount || 0;
        if (inv.status === 'paid') acc.paid += inv.total_amount || 0;
        if (inv.status === 'overdue') acc.overdue += inv.total_amount || 0;
        return acc;
      },
      { total: 0, paid: 0, overdue: 0 }
    );
  };

  const totals = getTotals();
  const monthlyData = getMonthlyReportData();
  const statusDistribution = getStatusDistribution();

  const getStatusColor = (status) => {
    switch (status) {
      case 'paid': return '#10b981';
      case 'sent': return '#3b82f6';
      case 'overdue': return '#ef4444';
      case 'draft': return '#a1a1aa';
      default: return '#a1a1aa';
    }
  };

  if (loading) {
    return <div className="text-[#a1a1aa]">Loading invoices...</div>;
  }

  return (
    <div className="space-y-6" data-testid="invoices-tab">
      {/* Header Actions */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1">
          <Input
            placeholder="Search invoices..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            data-testid="search-invoices"
            className="max-w-xs bg-[#18181b] border-[#27272a] text-[#fafafa]"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-[#18181b] border border-[#27272a] text-[#fafafa] px-4 py-2 rounded-lg focus:border-[#6366f1] focus:outline-none"
          >
            <option value="all">All Status</option>
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="paid">Paid</option>
            <option value="overdue">Overdue</option>
          </select>
          <Select value={monthFilter} onValueChange={setMonthFilter}>
            <SelectTrigger className="w-32 bg-[#18181b] border-[#27272a] text-[#fafafa]">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Month" />
            </SelectTrigger>
            <SelectContent className="bg-[#18181b] border-[#27272a]">
              <SelectItem value="all" className="text-[#fafafa]">All Months</SelectItem>
              {months.map((m) => (
                <SelectItem key={m.value} value={m.value} className="text-[#fafafa]">
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={yearFilter} onValueChange={setYearFilter}>
            <SelectTrigger className="w-24 bg-[#18181b] border-[#27272a] text-[#fafafa]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#18181b] border-[#27272a]">
              {years.map((y) => (
                <SelectItem key={y} value={y} className="text-[#fafafa]">
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={handleExport}
            data-testid="export-invoices"
            className="bg-[#27272a] hover:bg-[#3f3f46] text-[#fafafa]"
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button
            onClick={handleCreateInvoice}
            data-testid="create-invoice-btn"
            className="bg-[#6366f1] hover:bg-[#4f46e5] text-white glow-primary"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Invoice
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-4">
          <p className="text-xs text-[#a1a1aa] mb-1">Total Invoices</p>
          <p className="text-2xl font-bold text-[#fafafa]">{filteredInvoices.length}</p>
        </div>
        <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-4">
          <p className="text-xs text-[#a1a1aa] mb-1">Total Amount</p>
          <p className="text-2xl font-bold text-[#fafafa]">₹{totals.total.toLocaleString()}</p>
        </div>
        <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-4">
          <p className="text-xs text-[#a1a1aa] mb-1">Paid</p>
          <p className="text-2xl font-bold text-[#10b981]">₹{totals.paid.toLocaleString()}</p>
        </div>
        <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-4">
          <p className="text-xs text-[#a1a1aa] mb-1">Overdue</p>
          <p className="text-2xl font-bold text-[#ef4444]">₹{totals.overdue.toLocaleString()}</p>
        </div>
      </div>

      {/* View Tabs */}
      <Tabs value={activeView} onValueChange={setActiveView}>
        <TabsList className="bg-[#09090b] border border-[#27272a] p-1">
          <TabsTrigger
            value="list"
            className="data-[state=active]:bg-[#27272a] data-[state=active]:text-white text-xs"
          >
            <FileText className="h-4 w-4 mr-2" />
            Invoice List
          </TabsTrigger>
          <TabsTrigger
            value="report"
            className="data-[state=active]:bg-[#27272a] data-[state=active]:text-white text-xs"
          >
            <BarChart3 className="h-4 w-4 mr-2" />
            Monthly Report
          </TabsTrigger>
          <TabsTrigger
            value="requests"
            className="data-[state=active]:bg-[#27272a] data-[state=active]:text-white text-xs relative"
            data-testid="tab-new-invoice-req"
          >
            <FileText className="h-4 w-4 mr-2" />
            New Invoice Req
            {invoiceRequests.length > 0 && (
              <span className="ml-2 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-[#6366f1] text-white text-[10px] font-bold">
                {invoiceRequests.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Invoice List View */}
        <TabsContent value="list">
          {/* Tax filter pill strip: GST · Non-GST · All — drives the Invoice List */}
          <div className="mb-3 flex items-center gap-2 flex-wrap">
            <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-[#18181b] border border-[#27272a]">
              {[
                { id: 'gst', label: 'GST' },
                { id: 'non_gst', label: 'Non-GST' },
                { id: 'all', label: 'All' },
              ].map((t) => {
                const active = taxFilter === t.id;
                const count = invoices.filter((inv) => {
                  const gt = (inv.gst_type || 'gst').toLowerCase();
                  if (t.id === 'all') return true;
                  if (t.id === 'gst') return gt === 'gst';
                  return gt === 'non_gst' || gt === 'no_tax';
                }).length;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTaxFilter(t.id)}
                    data-testid={`invoice-tax-tab-${t.id}`}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${active ? 'bg-[#27272a] text-white' : 'text-[#a1a1aa] hover:text-white'}`}
                  >
                    {t.label}
                    <span className="ml-1.5 text-[10px] opacity-70">({count})</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="bg-[#18181b] border border-[#27272a] rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full" data-testid="invoices-table">
                <thead className="bg-[#09090b] border-b border-[#27272a]">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-medium text-[#a1a1aa] uppercase tracking-wider">
                      Invoice #
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-[#a1a1aa] uppercase tracking-wider">
                      Client
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-[#a1a1aa] uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-[#a1a1aa] uppercase tracking-wider">
                      Due Date
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-[#a1a1aa] uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-[#a1a1aa] uppercase tracking-wider">
                      GST Type
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-[#a1a1aa] uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-medium text-[#a1a1aa] uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#27272a]">
                  {filteredInvoices.length > 0 ? (
                    filteredInvoices.map((invoice) => (
                      <tr key={invoice.invoice_id} className="hover:bg-[#27272a]/20 transition-colors">
                        <td className="px-6 py-4">
                          <p className="text-sm font-medium text-[#6366f1]">{invoice.invoice_number}</p>
                        </td>
                        <td className="px-6 py-4">
                          <div>
                            <p className="text-sm font-medium text-[#fafafa]">{invoice.client_name}</p>
                            {invoice.client_gst_number && (
                              <p className="text-xs text-[#a1a1aa] mt-1">GST: {invoice.client_gst_number}</p>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-[#fafafa]">
                          {new Date(invoice.invoice_date).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 text-sm text-[#fafafa]">
                          {invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : '-'}
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm font-semibold text-[#fafafa]">
                            ₹{invoice.total_amount?.toLocaleString()}
                          </p>
                          {invoice.gst_amount > 0 && (
                            <p className="text-xs text-[#a1a1aa]">GST: ₹{invoice.gst_amount?.toLocaleString()}</p>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-xs text-[#a1a1aa] uppercase">{invoice.gst_type || 'N/A'}</span>
                        </td>
                        <td className="px-6 py-4">
                          <Select
                            value={invoice.status}
                            onValueChange={(v) => handleUpdateStatus(invoice.invoice_id, v)}
                          >
                            <SelectTrigger
                              className="h-7 text-xs border-0 bg-transparent p-0"
                              style={{ color: getStatusColor(invoice.status) }}
                            >
                              <span
                                className="px-2 py-1 rounded-full text-xs font-medium"
                                style={{
                                  backgroundColor: `${getStatusColor(invoice.status)}20`,
                                  color: getStatusColor(invoice.status),
                                }}
                              >
                                {invoice.status?.toUpperCase()}
                              </span>
                            </SelectTrigger>
                            <SelectContent className="bg-[#18181b] border-[#27272a]">
                              <SelectItem value="draft" className="text-[#fafafa]">Draft</SelectItem>
                              <SelectItem value="sent" className="text-[#fafafa]">Sent</SelectItem>
                              <SelectItem value="paid" className="text-[#fafafa]">Paid</SelectItem>
                              <SelectItem value="overdue" className="text-[#fafafa]">Overdue</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              onClick={() => handlePreviewInvoice(invoice)}
                              title="View & Download"
                              data-testid={`preview-invoice-${invoice.invoice_id}`}
                              className="bg-[#27272a] hover:bg-[#3f3f46] text-[#fafafa] h-8"
                            >
                              <Eye className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleEditInvoice(invoice)}
                              title="Edit"
                              className="bg-[#27272a] hover:bg-[#3f3f46] text-[#fafafa] h-8"
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleDuplicateInvoice(invoice.invoice_id)}
                              title="Duplicate"
                              className="bg-[#27272a] hover:bg-[#3f3f46] text-[#fafafa] h-8"
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleDeleteInvoice(invoice.invoice_id)}
                              title="Delete"
                              className="bg-[#27272a] hover:bg-[#ef4444] text-[#fafafa] h-8"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="px-6 py-8 text-center text-[#a1a1aa]">
                        No invoices found for the selected filters
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* Monthly Report View */}
        <TabsContent value="report">
          <div className="grid grid-cols-2 gap-6">
            {/* Monthly Revenue Chart */}
            <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-6">
              <h3 className="text-lg font-semibold text-[#fafafa] mb-4">
                Monthly Revenue - {yearFilter}
              </h3>
              {monthlyData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="month" tick={{ fill: '#a1a1aa', fontSize: 12 }} />
                    <YAxis tick={{ fill: '#a1a1aa', fontSize: 12 }} tickFormatter={(v) => `₹${v/1000}k`} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#18181b',
                        border: '1px solid #27272a',
                        borderRadius: '8px',
                      }}
                      labelStyle={{ color: '#fafafa' }}
                      formatter={(value) => [`₹${value.toLocaleString()}`, '']}
                    />
                    <Bar dataKey="paid" fill="#10b981" name="Paid" radius={[4, 4, 0, 0]} stackId="a" />
                    <Bar dataKey="pending" fill="#3b82f6" name="Pending" radius={[0, 0, 0, 0]} stackId="a" />
                    <Bar dataKey="overdue" fill="#ef4444" name="Overdue" radius={[4, 4, 0, 0]} stackId="a" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-[#a1a1aa]">
                  No data available for {yearFilter}
                </div>
              )}
            </div>

            {/* Status Distribution Pie Chart */}
            <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-6">
              <h3 className="text-lg font-semibold text-[#fafafa] mb-4">
                Invoice Status Distribution
              </h3>
              {statusDistribution.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={statusDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {statusDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#18181b',
                          border: '1px solid #27272a',
                          borderRadius: '8px',
                        }}
                        formatter={(value) => [`₹${value.toLocaleString()}`, '']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap justify-center gap-4 mt-4">
                    {statusDistribution.map((entry, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full" style={{ backgroundColor: entry.color }} />
                        <span className="text-xs text-[#a1a1aa]">
                          {entry.name}: ₹{entry.value.toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="h-[250px] flex items-center justify-center text-[#a1a1aa]">
                  No data available
                </div>
              )}
            </div>

            {/* Monthly Summary Table */}
            <div className="col-span-2 bg-[#18181b] border border-[#27272a] rounded-xl overflow-hidden">
              <div className="p-4 border-b border-[#27272a]">
                <h3 className="text-lg font-semibold text-[#fafafa]">
                  Month-wise Summary - {yearFilter}
                </h3>
              </div>
              <table className="w-full">
                <thead className="bg-[#09090b]">
                  <tr>
                    <th className="text-left p-4 text-xs font-medium text-[#a1a1aa] uppercase">Month</th>
                    <th className="text-left p-4 text-xs font-medium text-[#a1a1aa] uppercase">Invoices</th>
                    <th className="text-left p-4 text-xs font-medium text-[#a1a1aa] uppercase">Total</th>
                    <th className="text-left p-4 text-xs font-medium text-[#a1a1aa] uppercase">Paid</th>
                    <th className="text-left p-4 text-xs font-medium text-[#a1a1aa] uppercase">Pending</th>
                    <th className="text-left p-4 text-xs font-medium text-[#a1a1aa] uppercase">Overdue</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyData.map((month, index) => (
                    <tr key={index} className="border-t border-[#27272a] hover:bg-[#27272a]/30">
                      <td className="p-4 text-sm font-medium text-[#fafafa]">{month.month}</td>
                      <td className="p-4 text-sm text-[#fafafa]">{month.count}</td>
                      <td className="p-4 text-sm text-[#fafafa]">₹{month.total.toLocaleString()}</td>
                      <td className="p-4 text-sm text-[#10b981]">₹{month.paid.toLocaleString()}</td>
                      <td className="p-4 text-sm text-[#3b82f6]">₹{month.pending.toLocaleString()}</td>
                      <td className="p-4 text-sm text-[#ef4444]">₹{month.overdue.toLocaleString()}</td>
                    </tr>
                  ))}
                  {monthlyData.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-[#a1a1aa]">
                        No invoices found for {yearFilter}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* New Invoice Req tab — pending requests raised from Leads */}
        <TabsContent value="requests" data-testid="invoice-requests-pane">
          <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-4 mb-3 text-xs text-[#a1a1aa]">
            Requests raised from the Leads pipeline (when a lead is moved to <span className="text-[#fafafa] font-semibold">Invoice Raise</span>). Click <span className="text-[#fafafa] font-semibold">Accept</span> to auto-create a Draft invoice pre-filled with company, amount and GST data — you can finalize it from the Edit modal.
          </div>

          {/* Source pill strip for the Payment Request view:
              All · New Invoice (from Leads) · Payment Schedule (from a project split).
              Filters the requests list below by their origin. */}
          <div className="mb-3 flex items-center gap-2 flex-wrap">
            <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-[#18181b] border border-[#27272a]">
              {[
                { id: 'all', label: 'All' },
                { id: 'new', label: 'New Invoice Req' },
                { id: 'payment_schedule', label: 'Payment Schedule' },
              ].map((t) => {
                const active = sourceFilter === t.id;
                const count = invoiceRequests.filter((req) => {
                  const src = req.source || 'lead';
                  if (t.id === 'all') return true;
                  if (t.id === 'payment_schedule') return src === 'payment_schedule';
                  return src !== 'payment_schedule';
                }).length;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSourceFilter(t.id)}
                    data-testid={`invoice-request-source-${t.id}`}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${active ? 'bg-[#27272a] text-white' : 'text-[#a1a1aa] hover:text-white'}`}
                  >
                    {t.label}
                    <span className="ml-1.5 text-[10px] opacity-70">({count})</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="bg-[#18181b] border border-[#27272a] rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#09090b] border-b border-[#27272a]">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#a1a1aa] uppercase tracking-wider">Company</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#a1a1aa] uppercase tracking-wider">Lead</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#a1a1aa] uppercase tracking-wider">GST</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#a1a1aa] uppercase tracking-wider">GST #</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-[#a1a1aa] uppercase tracking-wider">Amount</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#a1a1aa] uppercase tracking-wider">Mode</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#a1a1aa] uppercase tracking-wider">Notes</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#a1a1aa] uppercase tracking-wider">Raised</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-[#a1a1aa] uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#27272a]">
                  {(() => {
                    const filteredRequests = invoiceRequests.filter((req) => {
                      const src = req.source || 'lead';
                      if (sourceFilter === 'all') return true;
                      if (sourceFilter === 'payment_schedule') return src === 'payment_schedule';
                      return src !== 'payment_schedule';
                    });
                    if (filteredRequests.length === 0) {
                      return (
                        <tr>
                          <td colSpan={9} className="px-4 py-12 text-center text-[#a1a1aa]">
                            No pending invoice requests.
                          </td>
                        </tr>
                      );
                    }
                    return filteredRequests.map((req) => (
                    <tr key={req.request_id} className="hover:bg-[#27272a]/20 transition-colors" data-testid={`invreq-row-${req.request_id}`}>
                      <td className="px-4 py-3 text-sm font-medium text-[#fafafa]">{req.company_name}</td>
                      <td className="px-4 py-3 text-sm text-[#a1a1aa]">{req.lead_name || '-'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${req.gst_type === 'gst' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'}`}>
                          {req.gst_type === 'gst' ? 'GST' : 'Non-GST'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs font-mono text-[#a1a1aa]">{req.gst_number || '-'}</td>
                      <td className="px-4 py-3 text-right text-sm font-semibold text-[#fafafa]">₹{Number(req.amount || 0).toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3 text-sm capitalize text-[#a1a1aa]">{req.payment_mode || '-'}</td>
                      <td className="px-4 py-3 text-xs text-[#a1a1aa] max-w-[260px] truncate" title={req.notes}>{req.notes || '-'}</td>
                      <td className="px-4 py-3 text-xs text-[#a1a1aa]">{req.created_at ? new Date(req.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            onClick={() => setViewingRequest(req)}
                            data-testid={`invreq-view-${req.request_id}`}
                            className="bg-[#6366f1] hover:bg-[#4f46e5] text-white h-8 px-3 text-xs"
                          >
                            <Eye className="h-3.5 w-3.5 mr-1" /> View
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleRejectInvoiceRequest(req)}
                            data-testid={`invreq-reject-${req.request_id}`}
                            className="text-red-400 hover:bg-red-500/10 h-8 px-2 text-xs"
                            title="Reject"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Invoice Form Modal */}
      {showInvoiceModal && (
        <InvoiceFormModal
          invoice={selectedInvoice}
          presetClientId={invoicePreset?.clientId}
          presetGstType={invoicePreset?.gstType}
          presetItems={invoicePreset?.items}
          presetNotes={invoicePreset?.notes}
          onClose={() => { setShowInvoiceModal(false); setInvoicePreset(null); }}
          onSave={async () => {
            // If this invoice was created from a request, mark the request invoiced.
            if (invoicePreset?.requestId) {
              try {
                await api.post(`/finance/banks/invoice-requests/${invoicePreset.requestId}/mark-invoiced`);
              } catch (e) {
                // non-fatal
              }
              fetchInvoiceRequests();
            }
            setShowInvoiceModal(false);
            setInvoicePreset(null);
            fetchInvoices();
          }}
        />
      )}

      {/* Invoice Request Detail Modal — opens from "View" on a pending request */}
      {viewingRequest && (
        <InvoiceRequestDetailModal
          request={viewingRequest}
          onClose={() => setViewingRequest(null)}
          onRaiseInvoice={handleRaiseInvoiceFromRequest}
        />
      )}

      {/* Invoice Preview Modal */}
      {showPreviewModal && previewInvoice && (
        <InvoicePreviewModal
          invoice={previewInvoice}
          onClose={() => {
            setShowPreviewModal(false);
            setPreviewInvoice(null);
          }}
        />
      )}
    </div>
  );
};

export default InvoicesTab;
