import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import api from '../../utils/api';
import { Download, Printer, Mail } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'sonner';

const InvoicePreviewModal = ({ invoice, onClose }) => {
  const [companySettings, setCompanySettings] = useState(null);

  useEffect(() => {
    fetchCompanySettings();
  }, []);

  const fetchCompanySettings = async () => {
    try {
      const response = await api.get('/finance/settings');
      setCompanySettings(response.data);
    } catch (error) {
      console.error('Error fetching company settings:', error);
    }
  };

  const handleDownloadPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header - Company Name
    doc.setFontSize(22);
    doc.setTextColor(99, 102, 241);
    doc.text(companySettings?.company_name || 'Your Company', 14, 25);

    // Company Details
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    if (companySettings?.company_address) {
      doc.text(companySettings.company_address, 14, 32);
    }
    if (companySettings?.gst_number) {
      doc.text(`GSTIN: ${companySettings.gst_number}`, 14, 38);
    }
    if (companySettings?.company_phone) {
      doc.text(`Phone: ${companySettings.company_phone}`, 14, 44);
    }

    // Invoice Title
    doc.setFontSize(28);
    doc.setTextColor(99, 102, 241);
    doc.text('INVOICE', pageWidth - 14, 25, { align: 'right' });

    // Invoice Number & Date
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(`Invoice #: ${invoice.invoice_number}`, pageWidth - 14, 35, { align: 'right' });
    doc.text(`Date: ${new Date(invoice.invoice_date).toLocaleDateString('en-IN')}`, pageWidth - 14, 42, { align: 'right' });
    if (invoice.due_date) {
      doc.text(`Due Date: ${new Date(invoice.due_date).toLocaleDateString('en-IN')}`, pageWidth - 14, 49, { align: 'right' });
    }

    // Status Badge
    const statusColors = {
      paid: [16, 185, 129],
      sent: [59, 130, 246],
      overdue: [239, 68, 68],
      draft: [161, 161, 170],
    };
    const statusColor = statusColors[invoice.status] || statusColors.draft;
    doc.setFillColor(...statusColor);
    doc.roundedRect(pageWidth - 40, 52, 26, 8, 2, 2, 'F');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text(invoice.status?.toUpperCase() || 'DRAFT', pageWidth - 27, 57.5, { align: 'center' });

    // Bill To Section
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text('BILL TO:', 14, 65);
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text(invoice.client_name || 'Client Name', 14, 72);
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    if (invoice.client_address) {
      const addressLines = doc.splitTextToSize(invoice.client_address, 80);
      doc.text(addressLines, 14, 78);
    }
    if (invoice.client_gst_number) {
      doc.text(`GSTIN: ${invoice.client_gst_number}`, 14, 90);
    }

    // Items Table
    const tableColumns = ['#', 'Description', 'Qty', 'Rate (₹)', 'Discount', 'GST', 'Amount (₹)'];
    const tableData = invoice.items.map((item, i) => {
      const baseAmount = item.quantity * item.rate;
      const discountAmount = (baseAmount * (item.discount_percentage || 0)) / 100;
      const afterDiscount = baseAmount - discountAmount;
      const gstAmount = (afterDiscount * (item.gst_percentage || 0)) / 100;
      const totalAmount = afterDiscount + gstAmount;

      return [
        i + 1,
        item.service_name || item.description || 'Service',
        item.quantity,
        item.rate.toLocaleString('en-IN'),
        item.discount_percentage ? `${item.discount_percentage}%` : '-',
        item.gst_percentage ? `${item.gst_percentage}%` : '-',
        totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 }),
      ];
    });

    doc.autoTable({
      startY: 100,
      head: [tableColumns],
      body: tableData,
      theme: 'striped',
      headStyles: {
        fillColor: [99, 102, 241],
        textColor: 255,
        fontSize: 9,
        fontStyle: 'bold',
      },
      bodyStyles: {
        fontSize: 9,
        textColor: [50, 50, 50],
      },
      alternateRowStyles: {
        fillColor: [248, 248, 252],
      },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 55 },
        2: { cellWidth: 15, halign: 'center' },
        3: { cellWidth: 25, halign: 'right' },
        4: { cellWidth: 20, halign: 'center' },
        5: { cellWidth: 20, halign: 'center' },
        6: { cellWidth: 30, halign: 'right' },
      },
      margin: { left: 14, right: 14 },
    });

    const finalY = doc.lastAutoTable.finalY + 10;

    // Totals Section
    const totalsX = pageWidth - 80;
    let currentY = finalY;

    // Subtotal
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text('Subtotal:', totalsX, currentY);
    doc.setTextColor(0, 0, 0);
    doc.text(`₹${(invoice.subtotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, pageWidth - 14, currentY, { align: 'right' });
    currentY += 7;

    // Discount
    if (invoice.discount_amount > 0) {
      doc.setTextColor(100, 100, 100);
      doc.text('Discount:', totalsX, currentY);
      doc.setTextColor(239, 68, 68);
      doc.text(`-₹${invoice.discount_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, pageWidth - 14, currentY, { align: 'right' });
      currentY += 7;
    }

    // GST
    if (invoice.gst_amount > 0) {
      doc.setTextColor(100, 100, 100);
      doc.text(`GST (${invoice.gst_type?.toUpperCase() || 'GST'}):`, totalsX, currentY);
      doc.setTextColor(0, 0, 0);
      doc.text(`₹${invoice.gst_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, pageWidth - 14, currentY, { align: 'right' });
      currentY += 10;
    }

    // Total
    doc.setDrawColor(99, 102, 241);
    doc.line(totalsX - 5, currentY - 3, pageWidth - 14, currentY - 3);
    doc.setFontSize(12);
    doc.setTextColor(99, 102, 241);
    doc.text('TOTAL:', totalsX, currentY + 4);
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text(`₹${(invoice.total_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, pageWidth - 14, currentY + 4, { align: 'right' });

    // Notes Section
    if (invoice.notes) {
      currentY += 25;
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text('Notes:', 14, currentY);
      doc.setFontSize(9);
      doc.setTextColor(50, 50, 50);
      const notesLines = doc.splitTextToSize(invoice.notes, pageWidth - 28);
      doc.text(notesLines, 14, currentY + 6);
    }

    // Footer
    const footerY = doc.internal.pageSize.getHeight() - 15;
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('Thank you for your business!', pageWidth / 2, footerY, { align: 'center' });

    // Save PDF
    doc.save(`${invoice.invoice_number}.pdf`);
    toast.success('Invoice PDF downloaded');
  };

  const handlePrint = () => {
    window.print();
  };

  // Calculate totals for display
  const calculateItemTotal = (item) => {
    const baseAmount = item.quantity * item.rate;
    const discountAmount = (baseAmount * (item.discount_percentage || 0)) / 100;
    const afterDiscount = baseAmount - discountAmount;
    const gstAmount = (afterDiscount * (item.gst_percentage || 0)) / 100;
    return afterDiscount + gstAmount;
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="bg-[#18181b] border border-[#27272a] text-[#fafafa] max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Invoice Preview</span>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handlePrint}
                className="bg-[#27272a] hover:bg-[#3f3f46] text-[#fafafa]"
              >
                <Printer className="h-4 w-4 mr-1" />
                Print
              </Button>
              <Button
                size="sm"
                onClick={handleDownloadPDF}
                className="bg-[#6366f1] hover:bg-[#4f46e5] text-white"
                data-testid="download-invoice-pdf"
              >
                <Download className="h-4 w-4 mr-1" />
                Download PDF
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* Invoice Preview */}
        <div className="bg-white text-black p-8 rounded-lg print:shadow-none" id="invoice-preview">
          {/* Header */}
          <div className="flex justify-between items-start mb-8">
            <div>
              <h1 className="text-2xl font-bold text-[#6366f1]">
                {companySettings?.company_name || 'Your Company'}
              </h1>
              <p className="text-sm text-gray-600 mt-1">{companySettings?.company_address}</p>
              {companySettings?.gst_number && (
                <p className="text-sm text-gray-600">GSTIN: {companySettings.gst_number}</p>
              )}
              {companySettings?.company_phone && (
                <p className="text-sm text-gray-600">Phone: {companySettings.company_phone}</p>
              )}
            </div>
            <div className="text-right">
              <h2 className="text-3xl font-bold text-[#6366f1]">INVOICE</h2>
              <p className="text-sm text-gray-600 mt-2">#{invoice.invoice_number}</p>
              <p className="text-sm text-gray-600">
                Date: {new Date(invoice.invoice_date).toLocaleDateString('en-IN')}
              </p>
              {invoice.due_date && (
                <p className="text-sm text-gray-600">
                  Due: {new Date(invoice.due_date).toLocaleDateString('en-IN')}
                </p>
              )}
              <span
                className="inline-block mt-2 px-3 py-1 rounded-full text-xs font-semibold text-white"
                style={{
                  backgroundColor:
                    invoice.status === 'paid'
                      ? '#10b981'
                      : invoice.status === 'overdue'
                      ? '#ef4444'
                      : invoice.status === 'sent'
                      ? '#3b82f6'
                      : '#a1a1aa',
                }}
              >
                {invoice.status?.toUpperCase()}
              </span>
            </div>
          </div>

          {/* Bill To */}
          <div className="mb-8">
            <p className="text-xs text-gray-500 uppercase mb-1">Bill To</p>
            <p className="font-semibold text-lg">{invoice.client_name}</p>
            {invoice.client_address && <p className="text-sm text-gray-600">{invoice.client_address}</p>}
            {invoice.client_gst_number && (
              <p className="text-sm text-gray-600">GSTIN: {invoice.client_gst_number}</p>
            )}
          </div>

          {/* Items Table */}
          <div className="mb-8 overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-[#6366f1] text-white">
                  <th className="p-3 text-left text-sm">#</th>
                  <th className="p-3 text-left text-sm">Description</th>
                  <th className="p-3 text-center text-sm">Qty</th>
                  <th className="p-3 text-right text-sm">Rate</th>
                  <th className="p-3 text-center text-sm">Discount</th>
                  <th className="p-3 text-center text-sm">GST</th>
                  <th className="p-3 text-right text-sm">Amount</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((item, i) => (
                  <tr key={i} className={i % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                    <td className="p-3 text-sm">{i + 1}</td>
                    <td className="p-3 text-sm">{item.service_name || item.description}</td>
                    <td className="p-3 text-sm text-center">{item.quantity}</td>
                    <td className="p-3 text-sm text-right">₹{item.rate.toLocaleString('en-IN')}</td>
                    <td className="p-3 text-sm text-center">
                      {item.discount_percentage ? `${item.discount_percentage}%` : '-'}
                    </td>
                    <td className="p-3 text-sm text-center">
                      {item.gst_percentage ? `${item.gst_percentage}%` : '-'}
                    </td>
                    <td className="p-3 text-sm text-right font-medium">
                      ₹{calculateItemTotal(item).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-64">
              <div className="flex justify-between py-2 text-sm">
                <span className="text-gray-600">Subtotal:</span>
                <span>₹{(invoice.subtotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              {invoice.discount_amount > 0 && (
                <div className="flex justify-between py-2 text-sm text-red-600">
                  <span>Discount:</span>
                  <span>-₹{invoice.discount_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              )}
              {invoice.gst_amount > 0 && (
                <div className="flex justify-between py-2 text-sm">
                  <span className="text-gray-600">GST ({invoice.gst_type?.toUpperCase()}):</span>
                  <span>₹{invoice.gst_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              )}
              <div className="flex justify-between py-3 text-lg font-bold border-t-2 border-[#6366f1] mt-2">
                <span className="text-[#6366f1]">TOTAL:</span>
                <span>₹{(invoice.total_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {invoice.notes && (
            <div className="mt-8 pt-4 border-t border-gray-200">
              <p className="text-xs text-gray-500 uppercase mb-1">Notes</p>
              <p className="text-sm text-gray-600">{invoice.notes}</p>
            </div>
          )}

          {/* Footer */}
          <div className="mt-8 pt-4 text-center text-sm text-gray-500">
            Thank you for your business!
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default InvoicePreviewModal;
