/**
 * Finance -> Expense -> Vendors.
 *
 * A simple vendor directory (name, contact, phone, email, address, notes) —
 * no payment logic here, just a reference list next to Tools & Subscription
 * and Payroll.
 */
import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Building2, Plus, Loader2, Pencil, Trash2, Phone, Mail } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '../ui/dialog';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '../ui/alert-dialog';

const API = process.env.REACT_APP_BACKEND_URL;
const emptyDraft = { name: '', contact_person: '', phone: '', email: '', address: '', notes: '' };

const VendorsTab = () => {
  const token = localStorage.getItem('session_token');
  const headers = { Authorization: `Bearer ${token}` };

  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // { vendorId: string|null }
  const [draft, setDraft] = useState(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/api/finance/vendors`, { headers });
      setVendors(res.data || []);
    } catch (e) {
      toast.error('Failed to load Vendors');
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const openAdd = () => { setDraft(emptyDraft); setModal({ vendorId: null }); };
  const openEdit = (v) => {
    setDraft({
      name: v.name, contact_person: v.contact_person || '', phone: v.phone || '',
      email: v.email || '', address: v.address || '', notes: v.notes || '',
    });
    setModal({ vendorId: v.vendor_id });
  };
  const closeModal = () => setModal(null);

  const save = async () => {
    if (!draft.name.trim()) { toast.error('Vendor name is required'); return; }
    setSaving(true);
    try {
      if (modal.vendorId) {
        await axios.put(`${API}/api/finance/vendors/${modal.vendorId}`, draft, { headers });
        toast.success('Vendor updated');
      } else {
        await axios.post(`${API}/api/finance/vendors`, draft, { headers });
        toast.success('Vendor added');
      }
      closeModal();
      await load();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to save vendor');
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async () => {
    if (!confirmDelete) return;
    try {
      await axios.delete(`${API}/api/finance/vendors/${confirmDelete}`, { headers });
      toast.success('Vendor deleted');
      setConfirmDelete(null);
      await load();
    } catch (e) {
      toast.error('Failed to delete vendor');
    }
  };

  return (
    <div className="space-y-4" data-testid="finance-vendors-tab">
      <div className="bg-white dark:bg-[#18181b] border border-gray-200 dark:border-[#27272a] rounded-xl p-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Building2 className="h-5 w-5 text-violet-600 dark:text-[#a78bfa]" />
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-[#fafafa]">Vendors</h3>
            <p className="text-xs text-gray-600 dark:text-[#a1a1aa]">Directory of vendors overhead & tools spend goes to</p>
          </div>
        </div>
        <Button onClick={openAdd} className="bg-[#6366f1] hover:bg-[#4f46e5] text-white" data-testid="vendors-add-btn">
          <Plus className="h-4 w-4 mr-1" /> Add New
        </Button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-gray-600 dark:text-[#a1a1aa] bg-white dark:bg-[#18181b] border border-gray-200 dark:border-[#27272a] rounded-xl">
          <Loader2 className="h-6 w-6 mx-auto animate-spin mb-2" /> Loading…
        </div>
      ) : vendors.length === 0 ? (
        <div className="py-12 text-center text-gray-600 dark:text-[#a1a1aa] bg-white dark:bg-[#18181b] border border-gray-200 dark:border-[#27272a] rounded-xl" data-testid="vendors-empty">
          <Building2 className="h-10 w-10 mx-auto text-gray-400 dark:text-[#52525b] mb-3" />
          No vendors yet — click <b>Add New</b> to add one.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {vendors.map((v) => (
            <div key={v.vendor_id} className="bg-white dark:bg-[#18181b] border border-gray-200 dark:border-[#27272a] rounded-xl p-4" data-testid={`vendors-card-${v.vendor_id}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-[#fafafa]">{v.name}</p>
                  {v.contact_person && <p className="text-xs text-gray-600 dark:text-[#a1a1aa]">{v.contact_person}</p>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(v)} className="h-7 px-2 text-violet-600 dark:text-[#a78bfa]" data-testid={`vendors-edit-${v.vendor_id}`}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(v.vendor_id)} className="h-7 px-2 text-red-500 hover:text-red-600" data-testid={`vendors-delete-${v.vendor_id}`}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <div className="mt-3 space-y-1">
                {v.phone && (
                  <p className="text-xs text-gray-600 dark:text-[#a1a1aa] flex items-center gap-1.5"><Phone className="h-3 w-3" /> {v.phone}</p>
                )}
                {v.email && (
                  <p className="text-xs text-gray-600 dark:text-[#a1a1aa] flex items-center gap-1.5"><Mail className="h-3 w-3" /> {v.email}</p>
                )}
              </div>
              {v.address && <p className="text-[11px] text-gray-500 dark:text-[#71717a] mt-2">{v.address}</p>}
              {v.notes && <p className="text-[11px] text-gray-500 dark:text-[#71717a] mt-1 italic">"{v.notes}"</p>}
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!modal} onOpenChange={(o) => !o && closeModal()}>
        <DialogContent className="bg-white dark:bg-[#18181b] border border-gray-200 dark:border-[#27272a] max-w-md" data-testid="vendors-modal">
          <DialogHeader>
            <DialogTitle className="text-gray-900 dark:text-[#fafafa]">{modal?.vendorId ? 'Edit Vendor' : 'Add New Vendor'}</DialogTitle>
            <DialogDescription className="text-gray-600 dark:text-[#a1a1aa]">Vendor contact details for reference.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-gray-600 dark:text-[#a1a1aa]">Vendor Name</Label>
              <Input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} data-testid="vendors-form-name" />
            </div>
            <div>
              <Label className="text-xs text-gray-600 dark:text-[#a1a1aa]">Contact Person</Label>
              <Input value={draft.contact_person} onChange={(e) => setDraft((d) => ({ ...d, contact_person: e.target.value }))} data-testid="vendors-form-contact" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-gray-600 dark:text-[#a1a1aa]">Phone</Label>
                <Input value={draft.phone} onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))} data-testid="vendors-form-phone" />
              </div>
              <div>
                <Label className="text-xs text-gray-600 dark:text-[#a1a1aa]">Email</Label>
                <Input value={draft.email} onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))} data-testid="vendors-form-email" />
              </div>
            </div>
            <div>
              <Label className="text-xs text-gray-600 dark:text-[#a1a1aa]">Address</Label>
              <Input value={draft.address} onChange={(e) => setDraft((d) => ({ ...d, address: e.target.value }))} data-testid="vendors-form-address" />
            </div>
            <div>
              <Label className="text-xs text-gray-600 dark:text-[#a1a1aa]">Notes</Label>
              <Input value={draft.notes} onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))} data-testid="vendors-form-notes" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={closeModal} className="border-gray-200 dark:border-[#27272a]">Cancel</Button>
              <Button onClick={save} disabled={saving} className="bg-[#6366f1] hover:bg-[#4f46e5] text-white" data-testid="vendors-form-save">
                {saving ? 'Saving…' : (modal?.vendorId ? 'Save Changes' : 'Add Vendor')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent className="bg-white dark:bg-[#18181b] border border-gray-200 dark:border-[#27272a]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-gray-900 dark:text-[#fafafa]">Delete this vendor?</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-600 dark:text-[#a1a1aa]">This can't be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={doDelete} className="bg-red-500 hover:bg-red-600" data-testid="vendors-delete-confirm">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default VendorsTab;
