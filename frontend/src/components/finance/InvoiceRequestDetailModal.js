/**
 * InvoiceRequestDetailModal
 *
 *  Opened from Finance → Invoice → "New Invoice Req" tab when admin clicks
 *  "View" on a pending request raised from the Sales pipeline.
 *
 *  Flow:
 *    1. Shows all request details (Company, Lead, GST, Amount, Mode, Address, Notes...)
 *    2. If a Finance Client already exists with matching company → "Use existing client"
 *       Otherwise → "Create Client" button (auto-fills client form from request data)
 *    3. After client linked/created → "Raise Invoice" button enables. Clicking it
 *       closes this modal and asks the parent to open the InvoiceFormModal pre-filled
 *       with the resolved client + request items/amount/notes.
 */
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import {
  X, Receipt, Building2, User, FileText, IndianRupee, CreditCard,
  CheckCircle2, UserPlus, Loader2, AlertCircle, ArrowRight,
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';

const API = process.env.REACT_APP_BACKEND_URL;

const InvoiceRequestDetailModal = ({ request, onClose, onRaiseInvoice }) => {
  const token = localStorage.getItem('session_token');
  const headers = { Authorization: `Bearer ${token}` };

  const [clients, setClients] = useState([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [linkedClient, setLinkedClient] = useState(null); // client object once matched / created
  const [creatingClient, setCreatingClient] = useState(false);

  // On open, load clients to detect if one with matching display_name already exists.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get(`${API}/api/finance/clients?include_summary=false`, { headers });
        if (cancelled) return;
        setClients(res.data || []);
        const target = (request?.company_name || '').trim().toLowerCase();
        if (target) {
          const match = (res.data || []).find(
            (c) => (c.display_name || c.company_name || '').trim().toLowerCase() === target,
          );
          if (match) setLinkedClient(match);
        }
      } catch (e) {
        // non-fatal
      } finally {
        if (!cancelled) setLoadingClients(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request?.request_id]);

  // Create a new Finance Client from the request data.
  const handleCreateClient = async () => {
    if (!request?.company_name?.trim()) {
      toast.error('Company name is required to create a client');
      return;
    }
    setCreatingClient(true);
    try {
      const isGst = (request.gst_type || 'gst') === 'gst';
      const payload = {
        customer_type: 'Business',
        display_name: request.company_name.trim(),
        company_name: request.company_name.trim(),
        first_name: request.lead_name || '',
        currency: 'INR',
        gst_treatment: isGst ? 'Registered Business - Regular' : 'Unregistered Business',
        gstin: isGst ? (request.gst_number || '') : '',
        tax_preference: isGst ? 'Taxable' : 'Tax Exempt',
        billing_address: request.billing_address || '',
        billing_country: 'India',
        remarks: request.notes
          ? `Created from Invoice Request (${request.request_id}). Notes: ${request.notes}`
          : `Created from Invoice Request (${request.request_id}).`,
      };
      const res = await axios.post(`${API}/api/finance/clients`, payload, { headers });
      setLinkedClient(res.data);
      toast.success(`Client "${res.data.display_name}" created`);
    } catch (e) {
      const detail = e.response?.data?.detail || 'Failed to create client';
      // If duplicate, try refetching and matching.
      if (typeof detail === 'string' && detail.toLowerCase().includes('already exists')) {
        toast.error('A client with this name already exists — linking it now.');
        try {
          const res = await axios.get(`${API}/api/finance/clients?include_summary=false`, { headers });
          const match = (res.data || []).find(
            (c) => (c.display_name || '').trim().toLowerCase() === request.company_name.trim().toLowerCase(),
          );
          if (match) setLinkedClient(match);
        } catch {/* ignored */}
      } else {
        toast.error(detail);
      }
    } finally {
      setCreatingClient(false);
    }
  };

  const handleRaiseInvoice = () => {
    if (!linkedClient) return;
    onRaiseInvoice({ request, client: linkedClient });
  };

  const isGst = (request?.gst_type || 'gst') === 'gst';
  const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="bg-white dark:bg-[#18181b] border border-gray-200 dark:border-[#27272a] text-gray-900 dark:text-[#fafafa] max-w-2xl" data-testid="invreq-detail-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-violet-600 dark:text-[#a78bfa]" />
            Invoice Request — {request?.company_name}
          </DialogTitle>
          <p className="text-xs text-gray-600 dark:text-[#a1a1aa]">
            Review the request raised from the Leads pipeline, link / create the client, then raise the actual invoice.
          </p>
        </DialogHeader>

        {/* Details grid */}
        <div className="grid grid-cols-2 gap-3 mt-2">
          <DetailField icon={Building2} label="Company" value={request?.company_name} mono={false} />
          <DetailField icon={User} label="Lead Name" value={request?.lead_name || '—'} />
          <DetailField
            icon={FileText}
            label="GST Type"
            value={(
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                isGst ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'
              }`}>
                {isGst ? 'GST (Registered)' : 'Non-GST'}
              </span>
            )}
          />
          {isGst && (
            <DetailField icon={FileText} label="GST Number" value={request?.gst_number || '—'} mono />
          )}
          <DetailField icon={IndianRupee} label="Amount" value={fmt(request?.amount)} />
          <DetailField icon={CreditCard} label="Mode of Payment" value={request?.payment_mode ? request.payment_mode.charAt(0).toUpperCase() + request.payment_mode.slice(1) : '—'} />
        </div>

        {/* Billing address */}
        <div className="mt-2 p-3 rounded-lg bg-gray-50 dark:bg-[#0c0a09] border border-gray-200 dark:border-[#27272a]">
          <p className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-[#71717a] mb-1">Billing Address</p>
          <p className="text-sm text-gray-900 dark:text-[#fafafa] whitespace-pre-wrap min-h-[20px]">
            {request?.billing_address || <span className="text-gray-500 dark:text-[#71717a] italic">Not provided</span>}
          </p>
        </div>

        {/* Notes */}
        {request?.notes && (
          <div className="mt-2 p-3 rounded-lg bg-gray-50 dark:bg-[#0c0a09] border border-gray-200 dark:border-[#27272a]">
            <p className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-[#71717a] mb-1">Notes / Service Details</p>
            <p className="text-sm text-gray-900 dark:text-[#fafafa] whitespace-pre-wrap">{request.notes}</p>
          </div>
        )}

        {/* Action panel — Step 1: Client, Step 2: Invoice */}
        <div className="mt-4 p-4 rounded-xl bg-gradient-to-br from-indigo-100 dark:from-[#1e1b4b]/40 to-[#0c0a09] border border-indigo-200 dark:border-[#3730a3]/40">
          {loadingClients ? (
            <div className="flex items-center justify-center py-4 text-gray-600 dark:text-[#a1a1aa] text-sm">
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> Checking clients…
            </div>
          ) : !linkedClient ? (
            <>
              <div className="flex items-start gap-3 mb-3">
                <UserPlus className="h-5 w-5 text-violet-600 dark:text-[#a78bfa] flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-[#fafafa]">Step 1 — Create the Finance Client</p>
                  <p className="text-xs text-gray-600 dark:text-[#a1a1aa] mt-0.5">
                    No matching client found for <b className="text-gray-900 dark:text-[#fafafa]">{request?.company_name}</b>. We&apos;ll auto-fill the form from this request.
                  </p>
                </div>
              </div>
              <Button
                onClick={handleCreateClient}
                disabled={creatingClient}
                className="w-full bg-[#6366f1] hover:bg-[#4f46e5] text-white"
                data-testid="invreq-create-client-btn"
              >
                {creatingClient ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating client…</>
                ) : (
                  <><UserPlus className="h-4 w-4 mr-2" /> Create Client</>
                )}
              </Button>
            </>
          ) : (
            <>
              <div className="flex items-start gap-3 mb-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-[#fafafa]">
                    Client linked: <span className="text-emerald-400">{linkedClient.display_name}</span>
                  </p>
                  <p className="text-xs text-gray-600 dark:text-[#a1a1aa] mt-0.5">
                    {linkedClient.gstin && <>GSTIN: <span className="font-mono">{linkedClient.gstin}</span> · </>}
                    {linkedClient.gst_treatment || (isGst ? 'GST' : 'Non-GST')}
                  </p>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/15 text-emerald-400">READY</span>
              </div>
              <div className="flex items-center gap-2 mb-3 text-xs text-gray-600 dark:text-[#a1a1aa]">
                <AlertCircle className="h-3.5 w-3.5" />
                Step 2 — Open the Invoice form pre-filled with this client + the requested amount.
              </div>
              <Button
                onClick={handleRaiseInvoice}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                data-testid="invreq-raise-invoice-btn"
              >
                <Receipt className="h-4 w-4 mr-2" /> Raise Invoice <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </>
          )}
        </div>

        <div className="flex justify-end mt-4 pt-3 border-t border-gray-200 dark:border-[#27272a]">
          <Button variant="ghost" onClick={onClose} className="text-gray-600 dark:text-[#a1a1aa]">
            <X className="h-4 w-4 mr-1" /> Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const DetailField = ({ icon: Icon, label, value, mono = false }) => (
  <div className="p-3 rounded-lg bg-gray-50 dark:bg-[#0c0a09] border border-gray-200 dark:border-[#27272a]">
    <div className="flex items-center gap-1.5 mb-1">
      {Icon && <Icon className="h-3 w-3 text-gray-500 dark:text-[#71717a]" />}
      <p className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-[#71717a]">{label}</p>
    </div>
    <div className={`text-sm text-gray-900 dark:text-[#fafafa] ${mono ? 'font-mono' : ''}`}>{value}</div>
  </div>
);

export default InvoiceRequestDetailModal;
