import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import api from '../../utils/api';
import { Download } from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

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

    doc.setFontSize(20);
    doc.setTextColor(99, 102, 241);
    doc.text(companySettings?.company_name || 'Your Company', 14, 20);

    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(companySettings?.company_address || '', 14, 27);

    doc.setFontSize(16);
    doc.setTextColor(99, 102, 241);
    doc.text('INVOICE', 160, 20);

    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(`#: ${invoice.invoice_number}`, 160, 27);

    const tableData = invoice.items.map((item, i) => [
      i + 1,
      item.service_name,
      item.quantity,
      `₹${item.rate}`,
      `₹${item.quantity * item.rate}`
    ]);

    doc.autoTable({
      startY: 80,
      head: [['#', 'Service', 'Qty', 'Rate', 'Amount']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [99, 102, 241] }
    });

    const finalY = doc.lastAutoTable.finalY + 10;
    doc.text('Total:', 130, finalY);
    doc.text(`₹${invoice.total_amount}`, 180, finalY, { align: 'right' });

    doc.save(`${invoice.invoice_number}.pdf`);
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="bg-[#18181b] border border-[#27272a] text-[#fafafa] max-w-4xl">
        <DialogHeader>
          <DialogTitle>Invoice Preview</DialogTitle>
        </DialogHeader>
        <div className="bg-white text-black p-8 rounded-lg">
          <h1 className="text-2xl font-bold text-[#6366f1] mb-4">{invoice.invoice_number}</h1>
          <p><strong>Client:</strong> {invoice.client_name}</p>
          <p><strong>Date:</strong> {new Date(invoice.invoice_date).toLocaleDateString()}</p>
          <div className="mt-4">
            <table className="w-full">
              <thead>
                <tr className="bg-[#6366f1] text-white">
                  <th className="p-2">Service</th>
                  <th className="p-2">Qty</th>
                  <th className="p-2">Rate</th>
                  <th className="p-2">Amount</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((item, i) => (
                  <tr key={i}>
                    <td className="p-2">{item.service_name}</td>
                    <td className="p-2">{item.quantity}</td>
                    <td className="p-2">₹{item.rate}</td>
                    <td className="p-2">₹{item.quantity * item.rate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 text-right">
            <p className="text-xl font-bold">Total: ₹{invoice.total_amount}</p>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-4">
          <Button onClick={onClose} className="bg-[#27272a] hover:bg-[#3f3f46] text-[#fafafa]">Close</Button>
          <Button onClick={handleDownloadPDF} className="bg-[#6366f1] hover:bg-[#4f46e5] text-white">
            <Download className="h-4 w-4 mr-2" />Download PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default InvoicePreviewModal;
