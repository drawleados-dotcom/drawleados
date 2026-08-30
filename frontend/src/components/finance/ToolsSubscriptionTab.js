/**
 * Finance -> Expense -> Tools & Subscription.
 *
 * A recurring tool/software subscription tracker: each entry has a monthly
 * or yearly amount anchored to a start date, and a payment history that
 * auto-generates one row per billing period (lazily, on every load, via the
 * backend's _ensure_payments) — so the current month's row is always
 * present without a cron job. Also see MasterExpenseView.js, which surfaces
 * the current month's unpaid total as a pinned row inside Overhead.
 */
import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import {
  Blocks, Plus, Loader2, Pencil, Trash2, X, CheckCircle2, CircleDashed,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '../ui/dialog';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '../ui/alert-dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';

const API = process.env.REACT_APP_BACKEND_URL;
const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const emptyDraft = { name: '', description: '', amount: '', duration: 'monthly', start_date: new Date().toISOString().slice(0, 10) };

const ToolsSubscriptionTab = () => {
  const token = localStorage.getItem('session_token');
  const headers = { Authorization: `Bearer ${token}` };

  const [subs, setSubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // { subscriptionId: string|null }
  const [modalTab, setModalTab] = useState('details');
  const [draft, setDraft] = useState(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [payingPeriod, setPayingPeriod] = useState(null); // period_date being paid
  const [payAmount, setPayAmount] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null); // subscription_id

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/api/finance/subscriptions`, { headers });
      setSubs(res.data || []);
    } catch (e) {
      toast.error('Failed to load Tools & Subscription');
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const activeSub = modal ? subs.find((s) => s.subscription_id === modal.subscriptionId) : null;

  const openAdd = () => {
    setDraft(emptyDraft);
    setModalTab('details');
    setModal({ subscriptionId: null });
  };

  const openView = (sub) => {
    setDraft({
      name: sub.name, description: sub.description || '', amount: String(sub.amount),
      duration: sub.duration, start_date: sub.start_date,
    });
    setModalTab('details');
    setModal({ subscriptionId: sub.subscription_id });
  };

  const closeModal = () => { setModal(null); setPayingPeriod(null); };

  const save = async () => {
    if (!draft.name.trim()) { toast.error('Name is required'); return; }
    if (!draft.amount || Number(draft.amount) < 0) { toast.error('Enter a valid amount'); return; }
    setSaving(true);
    try {
      const payload = {
        name: draft.name.trim(),
        description: draft.description.trim(),
        amount: Number(draft.amount),
        duration: draft.duration,
        start_date: draft.start_date,
      };
      if (modal.subscriptionId) {
        await axios.put(`${API}/api/finance/subscriptions/${modal.subscriptionId}`, payload, { headers });
        toast.success('Subscription updated');
      } else {
        const res = await axios.post(`${API}/api/finance/subscriptions`, payload, { headers });
        toast.success('Subscription added');
        setModal({ subscriptionId: res.data.subscription_id });
      }
      await load();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async () => {
    if (!confirmDelete) return;
    try {
      await axios.delete(`${API}/api/finance/subscriptions/${confirmDelete}`, { headers });
      toast.success('Subscription deleted');
      setConfirmDelete(null);
      if (modal?.subscriptionId === confirmDelete) closeModal();
      await load();
    } catch (e) {
      toast.error('Failed to delete');
    }
  };

  const openPay = (period) => { setPayingPeriod(period.period_date); setPayAmount(String(period.amount)); };

  const confirmPay = async () => {
    if (!activeSub || !payingPeriod) return;
    if (!payAmount || Number(payAmount) < 0) { toast.error('Enter a valid amount'); return; }
    try {
      await axios.post(
        `${API}/api/finance/subscriptions/${activeSub.subscription_id}/payments/${payingPeriod}/pay`,
        { amount_paid: Number(payAmount) },
        { headers },
      );
      toast.success('Marked as paid');
      setPayingPeriod(null);
      await load();
    } catch (e) {
      toast.error('Failed to record payment');
    }
  };

  return (
    <div className="space-y-4" data-testid="finance-tools-subscription-tab">
      <div className="bg-white dark:bg-[#18181b] border border-gray-200 dark:border-[#27272a] rounded-xl p-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Blocks className="h-5 w-5 text-violet-600 dark:text-[#a78bfa]" />
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-[#fafafa]">Tools & Subscription</h3>
            <p className="text-xs text-gray-600 dark:text-[#a1a1aa]">Recurring tool/software subscriptions and their payment history</p>
          </div>
        </div>
        <Button onClick={openAdd} className="bg-[#6366f1] hover:bg-[#4f46e5] text-white" data-testid="tools-sub-add-btn">
          <Plus className="h-4 w-4 mr-1" /> Add New
        </Button>
      </div>

      <div className="bg-white dark:bg-[#18181b] border border-gray-200 dark:border-[#27272a] rounded-xl overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-gray-600 dark:text-[#a1a1aa]">
            <Loader2 className="h-6 w-6 mx-auto animate-spin mb-2" /> Loading…
          </div>
        ) : subs.length === 0 ? (
          <div className="py-12 text-center text-gray-600 dark:text-[#a1a1aa]" data-testid="tools-sub-empty">
            <Blocks className="h-10 w-10 mx-auto text-gray-400 dark:text-[#52525b] mb-3" />
            No tools or subscriptions yet — click <b>Add New</b> to track one.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-[#0c0a09] text-gray-600 dark:text-[#a1a1aa] uppercase text-[11px] tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3">Tool</th>
                  <th className="text-left px-4 py-3">Duration</th>
                  <th className="text-left px-4 py-3">Start Date</th>
                  <th className="text-right px-4 py-3">Amount</th>
                  <th className="text-center px-4 py-3">Current Period</th>
                  <th className="text-center px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {subs.map((s) => {
                  const history = s.payment_history || [];
                  const current = history[history.length - 1];
                  return (
                    <tr key={s.subscription_id} className="border-t border-gray-200 dark:border-[#27272a] hover:bg-[#6366f1]/5 transition-colors" data-testid={`tools-sub-row-${s.subscription_id}`}>
                      <td className="px-4 py-3 cursor-pointer" onClick={() => openView(s)}>
                        <p className="text-sm font-medium text-gray-900 dark:text-[#fafafa]">{s.name}</p>
                        {s.description && <p className="text-[10px] text-gray-600 dark:text-[#a1a1aa] max-w-xs truncate">{s.description}</p>}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-[#a1a1aa] capitalize">{s.duration}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-[#a1a1aa]">{fmtDate(s.start_date)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-[#fafafa]">{fmt(s.amount)}</td>
                      <td className="px-4 py-3 text-center">
                        {current ? (
                          <Badge className={current.paid ? 'bg-[#10b981]/20 text-[#10b981]' : 'bg-[#ef4444]/20 text-[#ef4444]'}>
                            {current.paid ? 'Paid' : 'Not Paid'}
                          </Badge>
                        ) : <span className="text-xs text-gray-500">—</span>}
                        {s.unpaid_count > 1 && (
                          <p className="text-[10px] text-[#f59e0b] mt-1">{s.unpaid_count} periods unpaid</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button size="sm" variant="ghost" onClick={() => openView(s)} className="h-7 px-2 text-violet-600 dark:text-[#a78bfa]" data-testid={`tools-sub-edit-${s.subscription_id}`}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(s.subscription_id)} className="h-7 px-2 text-red-500 hover:text-red-600" data-testid={`tools-sub-delete-${s.subscription_id}`}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / View / Edit modal */}
      <Dialog open={!!modal} onOpenChange={(o) => !o && closeModal()}>
        <DialogContent className="bg-white dark:bg-[#18181b] border border-gray-200 dark:border-[#27272a] max-w-xl" data-testid="tools-sub-modal">
          <DialogHeader>
            <DialogTitle className="text-gray-900 dark:text-[#fafafa]">
              {modal?.subscriptionId ? 'Edit Subscription' : 'Add New Subscription'}
            </DialogTitle>
            <DialogDescription className="text-gray-600 dark:text-[#a1a1aa]">
              Track a recurring tool or software subscription and its payment history.
            </DialogDescription>
          </DialogHeader>

          <Tabs value={modalTab} onValueChange={setModalTab}>
            <TabsList>
              <TabsTrigger value="details" data-testid="tools-sub-tab-details">Details</TabsTrigger>
              <TabsTrigger value="history" disabled={!modal?.subscriptionId} data-testid="tools-sub-tab-history">Payment History</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-3 pt-2">
              <div>
                <Label className="text-xs text-gray-600 dark:text-[#a1a1aa]">Tools Name</Label>
                <Input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} placeholder="e.g. Figma, AWS, Notion" data-testid="tools-sub-form-name" />
              </div>
              <div>
                <Label className="text-xs text-gray-600 dark:text-[#a1a1aa]">Description</Label>
                <Input value={draft.description} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} placeholder="What's it for?" data-testid="tools-sub-form-description" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-gray-600 dark:text-[#a1a1aa]">Amount</Label>
                  <Input type="number" min="0" value={draft.amount} onChange={(e) => setDraft((d) => ({ ...d, amount: e.target.value }))} placeholder="0" data-testid="tools-sub-form-amount" />
                </div>
                <div>
                  <Label className="text-xs text-gray-600 dark:text-[#a1a1aa]">Subscription Duration</Label>
                  <div className="flex gap-2 mt-1">
                    {['monthly', 'yearly'].map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setDraft((dr) => ({ ...dr, duration: d }))}
                        className={`flex-1 text-xs font-medium rounded-md border px-2 py-2 capitalize transition-colors ${draft.duration === d ? 'bg-[#6366f1] text-white border-[#6366f1]' : 'bg-white dark:bg-[#0c0a09] text-gray-600 dark:text-[#a1a1aa] border-gray-200 dark:border-[#27272a]'}`}
                        data-testid={`tools-sub-form-duration-${d}`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <Label className="text-xs text-gray-600 dark:text-[#a1a1aa]">Subscription Date</Label>
                <Input type="date" value={draft.start_date} onChange={(e) => setDraft((d) => ({ ...d, start_date: e.target.value }))} data-testid="tools-sub-form-startdate" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={closeModal} className="border-gray-200 dark:border-[#27272a]">Cancel</Button>
                <Button onClick={save} disabled={saving} className="bg-[#6366f1] hover:bg-[#4f46e5] text-white" data-testid="tools-sub-form-save">
                  {saving ? 'Saving…' : (modal?.subscriptionId ? 'Save Changes' : 'Add Subscription')}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="history" className="pt-2">
              {!activeSub ? (
                <p className="text-sm text-gray-600 dark:text-[#a1a1aa] py-6 text-center">Save the subscription first to see its payment history.</p>
              ) : (
                <div className="max-h-80 overflow-y-auto divide-y divide-gray-200 dark:divide-[#27272a] border border-gray-200 dark:border-[#27272a] rounded-lg">
                  {(activeSub.payment_history || []).slice().reverse().map((p) => (
                    <div key={p.period_date} className="flex items-center gap-3 px-3 py-2.5" data-testid={`tools-sub-period-${p.period_date}`}>
                      {p.paid ? <CheckCircle2 className="h-4 w-4 text-[#10b981] shrink-0" /> : <CircleDashed className="h-4 w-4 text-gray-400 shrink-0" />}
                      <div className="flex-1">
                        <p className="text-sm text-gray-900 dark:text-[#fafafa]">{fmtDate(p.period_date)}</p>
                        {p.paid && p.paid_at && <p className="text-[10px] text-gray-500 dark:text-[#71717a]">Paid {fmtDate(p.paid_at)}</p>}
                      </div>
                      <p className="text-sm font-medium text-gray-900 dark:text-[#fafafa]">{fmt(p.paid ? (p.paid_amount ?? p.amount) : p.amount)}</p>
                      {p.paid ? (
                        <Badge className="bg-[#10b981]/20 text-[#10b981]">Paid</Badge>
                      ) : payingPeriod === p.period_date ? (
                        <div className="flex items-center gap-1">
                          <Input
                            type="number" min="0" value={payAmount}
                            onChange={(e) => setPayAmount(e.target.value)}
                            className="h-8 w-24 text-sm"
                            data-testid="tools-sub-pay-amount"
                          />
                          <Button size="sm" onClick={confirmPay} className="h-8 bg-[#10b981] hover:bg-[#0d9668] text-white" data-testid="tools-sub-pay-confirm">Save</Button>
                          <Button size="sm" variant="ghost" onClick={() => setPayingPeriod(null)} className="h-8 px-2"><X className="h-3.5 w-3.5" /></Button>
                        </div>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => openPay(p)} className="h-7 text-xs border-gray-200 dark:border-[#27272a]" data-testid={`tools-sub-pay-btn-${p.period_date}`}>
                          Mark Paid
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent className="bg-white dark:bg-[#18181b] border border-gray-200 dark:border-[#27272a]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-gray-900 dark:text-[#fafafa]">Delete this subscription?</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-600 dark:text-[#a1a1aa]">
              This removes the subscription and its entire payment history. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={doDelete} className="bg-red-500 hover:bg-red-600" data-testid="tools-sub-delete-confirm">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ToolsSubscriptionTab;
