import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { FileText, X, Download, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';

const API = process.env.REACT_APP_BACKEND_URL;
const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

/**
 * Read-only view of an existing quotation, opened from the "View Quotation"
 * link on a lead's row in the Leads table.
 *
 * Props: quotationId, onClose
 */
const ViewQuotationModal = ({ quotationId, onClose }) => {
  const token = localStorage.getItem('session_token');
  const headers = { Authorization: `Bearer ${token}` };
  const [quotation, setQuotation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get(`${API}/api/quotations/${quotationId}`, { headers });
        if (!cancelled) setQuotation(res.data);
      } catch (e) {
        if (!cancelled) toast.error('Failed to load quotation');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quotationId]);

  const downloadPdf = async () => {
    setDownloading(true);
    try {
      const res = await axios.get(`${API}/api/quotations/${quotationId}/pdf`, { headers, responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `quotation_${quotation?.quotation_number || quotationId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error('Failed to download PDF');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="bg-[#18181b] border border-[#27272a] text-[#fafafa] max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="view-quotation-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-[#6366f1]" /> {quotation ? `Quotation ${quotation.quotation_number}` : 'Quotation'}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-10 text-center text-[#a1a1aa]">
            <Loader2 className="h-6 w-6 mx-auto mb-2 animate-spin" /> Loading…
          </div>
        ) : !quotation ? (
          <div className="py-10 text-center text-[#a1a1aa]">Quotation not found</div>
        ) : (
          <div className="space-y-4 mt-1">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-[11px] uppercase text-[#a1a1aa]">Name</p><p className="font-medium">{quotation.name || '—'}</p></div>
              <div><p className="text-[11px] uppercase text-[#a1a1aa]">Business Name</p><p className="font-medium">{quotation.business_name || '—'}</p></div>
              <div><p className="text-[11px] uppercase text-[#a1a1aa]">Quotation Date</p><p className="font-medium">{quotation.quotation_date || '—'}</p></div>
              <div><p className="text-[11px] uppercase text-[#a1a1aa]">Due Date</p><p className="font-medium">{quotation.due_date || '—'}</p></div>
              <div className="col-span-2"><p className="text-[11px] uppercase text-[#a1a1aa]">Address</p><p className="font-medium">{quotation.address || '—'}</p></div>
            </div>

            <div className="rounded-lg border border-[#27272a] overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-[#0c0a09] text-[#a1a1aa] text-[11px] uppercase">
                  <tr>
                    <th className="text-left px-2 py-2 w-8">S.No</th>
                    <th className="text-left px-2 py-2">Service</th>
                    <th className="text-right px-2 py-2">Amount</th>
                    <th className="text-right px-2 py-2">GST %</th>
                    <th className="text-right px-2 py-2">GST Amt</th>
                    <th className="text-right px-2 py-2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(quotation.items || []).map((it) => (
                    <tr key={it.sno} className="border-t border-[#27272a]">
                      <td className="px-2 py-1.5 text-[#a1a1aa]">{it.sno}</td>
                      <td className="px-2 py-1.5">{it.service}</td>
                      <td className="px-2 py-1.5 text-right">{fmt(it.amount)}</td>
                      <td className="px-2 py-1.5 text-right">{it.gst_percent}%</td>
                      <td className="px-2 py-1.5 text-right">{fmt(it.gst_amount)}</td>
                      <td className="px-2 py-1.5 text-right font-semibold">{fmt(it.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end">
              <div className="text-right">
                <p className="text-[11px] uppercase tracking-wide text-[#a1a1aa]">Grand Total</p>
                <p className="text-xl font-bold text-[#10b981]">{fmt(quotation.grand_total)}</p>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-3 border-t border-[#27272a] mt-3">
          <Button variant="ghost" onClick={onClose} className="text-[#a1a1aa]"><X className="h-4 w-4 mr-1" /> Close</Button>
          {quotation && (
            <Button onClick={downloadPdf} disabled={downloading} className="bg-[#6366f1] hover:bg-[#4f46e5] text-white gap-2" data-testid="view-quo-download-btn">
              {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Download PDF
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ViewQuotationModal;
