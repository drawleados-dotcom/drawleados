import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Plus, FileText, Download, Mail, Copy, Edit, Trash2, Eye } from 'lucide-react';
import { toast } from 'sonner';
import InvoiceFormModal from './InvoiceFormModal';
import InvoicePreviewModal from './InvoicePreviewModal';

const InvoicesTab = () => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewInvoice, setPreviewInvoice] = useState(null);

  useEffect(() => {
    fetchInvoices();
  }, [statusFilter]);

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

  const filteredInvoices = invoices.filter((invoice) => {
    const search = searchTerm.toLowerCase();
    return (
      invoice.client_name.toLowerCase().includes(search) ||
      invoice.invoice_number.toLowerCase().includes(search)
    );
  });

  const getStatusColor = (status) => {
    switch (status) {
      case 'paid':
        return '#10b981';
      case 'sent':
        return '#3b82f6';
      case 'overdue':
        return '#ef4444';
      case 'draft':
        return '#a1a1aa';
      default:
        return '#a1a1aa';
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

      {/* Invoices Table */}
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
                      {new Date(invoice.due_date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-sm font-semibold text-[#fafafa]">₹{invoice.total_amount.toLocaleString()}</p>
                        {invoice.gst_type === 'gst' && (
                          <p className="text-xs text-[#a1a1aa]">+GST ₹{(invoice.cgst + invoice.sgst + invoice.igst).toLocaleString()}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className="px-3 py-1 rounded-full text-xs font-medium"
                        style={{
                          backgroundColor: invoice.gst_type === 'gst' ? '#6366f120' : '#a1a1aa20',
                          color: invoice.gst_type === 'gst' ? '#6366f1' : '#a1a1aa',
                        }}
                      >
                        {invoice.gst_type.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <select
                        value={invoice.status}
                        onChange={(e) => handleUpdateStatus(invoice.invoice_id, e.target.value)}
                        className="bg-[#09090b] border border-[#27272a] text-[#fafafa] px-3 py-1 rounded-lg text-xs focus:border-[#6366f1] focus:outline-none"
                        style={{ color: getStatusColor(invoice.status) }}
                      >
                        <option value="draft">Draft</option>
                        <option value="sent">Sent</option>
                        <option value="paid">Paid</option>
                        <option value="overdue">Overdue</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          onClick={() => handlePreviewInvoice(invoice)}
                          className="bg-[#27272a] hover:bg-[#3f3f46] text-[#fafafa] h-8 w-8 p-0"
                          title="Preview"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleEditInvoice(invoice)}
                          className="bg-[#27272a] hover:bg-[#3f3f46] text-[#fafafa] h-8 w-8 p-0"
                          title="Edit"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleDuplicateInvoice(invoice.invoice_id)}
                          className="bg-[#27272a] hover:bg-[#3f3f46] text-[#fafafa] h-8 w-8 p-0"
                          title="Duplicate"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleDeleteInvoice(invoice.invoice_id)}
                          className="bg-[#ef4444]/10 hover:bg-[#ef4444]/20 text-[#ef4444] h-8 w-8 p-0"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8" className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <FileText className="h-12 w-12 text-[#a1a1aa]" />
                      <p className="text-[#a1a1aa]">No invoices found</p>
                      <Button
                        onClick={handleCreateInvoice}
                        className="bg-[#6366f1] hover:bg-[#4f46e5] text-white"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Create First Invoice
                      </Button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      {showInvoiceModal && (
        <InvoiceFormModal
          invoice={selectedInvoice}
          onClose={() => setShowInvoiceModal(false)}
          onSave={() => {
            setShowInvoiceModal(false);
            fetchInvoices();
          }}
        />
      )}

      {showPreviewModal && previewInvoice && (
        <InvoicePreviewModal
          invoice={previewInvoice}
          onClose={() => setShowPreviewModal(false)}
        />
      )}
    </div>
  );
};

export default InvoicesTab;
