import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { useTheme } from '../contexts/ThemeContext';
import api from '../utils/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { ArrowLeft, Plus, Trash2, Package } from 'lucide-react';
import { toast } from 'sonner';

const SHARED_VIA_OPTIONS = ['Contact Shared', 'Meeting Arranged'];
const RECIPIENT_STATUSES = ['Shared', 'Contacted', 'Not Converted', 'Not Contacted'];

const emptyRecipientForm = () => ({ member_id: '', reason: '', give_date: '', shared_via: '' });

const BNIMyGiveDetailPage = () => {
  const { giveId } = useParams();
  const navigate = useNavigate();
  const { isDark } = useTheme();

  const bgCard = isDark ? 'bg-[#18181b]' : 'bg-white';
  const bgSecondary = isDark ? 'bg-[#27272a]' : 'bg-gray-100';
  const borderColor = isDark ? 'border-[#3f3f46]' : 'border-gray-200';
  const textPrimary = isDark ? 'text-[#fafafa]' : 'text-gray-900';
  const textSecondary = isDark ? 'text-[#a1a1aa]' : 'text-gray-500';

  const [give, setGive] = useState(null);
  const [members, setMembers] = useState([]);
  const [recipients, setRecipients] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyRecipientForm());
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [giveRes, membersRes, recipientsRes] = await Promise.all([
        api.get(`/bni/my-gives/${giveId}`),
        api.get('/bni/members'),
        api.get('/bni/give-recipients', { params: { give_id: giveId } }),
      ]);
      setGive(giveRes.data);
      setMembers(membersRes.data || []);
      setRecipients(recipientsRes.data || []);
    } catch (error) {
      toast.error('Failed to load give');
    } finally {
      setLoading(false);
    }
  }, [giveId]);

  useEffect(() => { load(); }, [load]);

  const openAddRecipient = () => {
    setForm(emptyRecipientForm());
    setShowForm(true);
  };

  const saveRecipient = async () => {
    if (!form.member_id) { toast.error('Select a member'); return; }
    setSaving(true);
    try {
      await api.post('/bni/give-recipients', { give_id: giveId, ...form });
      toast.success('Given to member');
      setShowForm(false);
      load();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (recipientId, status) => {
    try {
      await api.put(`/bni/give-recipients/${recipientId}`, { status });
      setRecipients((prev) => prev.map((r) => (r.recipient_id === recipientId ? { ...r, status } : r)));
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const deleteRecipient = async (recipientId) => {
    if (!window.confirm('Remove this member from the give?')) return;
    try {
      await api.delete(`/bni/give-recipients/${recipientId}`);
      toast.success('Removed');
      load();
    } catch (error) {
      toast.error('Failed to remove');
    }
  };

  if (loading || !give) {
    return (
      <Layout>
        <div className={`text-center py-12 ${textSecondary}`}>Loading…</div>
      </Layout>
    );
  }

  const statusColor = (status) => {
    if (status === 'Contacted') return 'bg-[#3b82f6]/15 text-[#3b82f6] border border-[#3b82f6]/40';
    if (status === 'Not Converted') return 'bg-[#ef4444]/15 text-[#ef4444] border border-[#ef4444]/40';
    if (status === 'Not Contacted') return 'bg-[#71717a]/15 text-[#71717a] border border-[#71717a]/40';
    return 'bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/40'; // Shared
  };

  return (
    <Layout>
      <div className="space-y-6" data-testid="bni-give-detail-page">
        <button
          onClick={() => navigate('/bni?tab=my_gives')}
          className={`flex items-center gap-1 text-sm ${textSecondary} hover:${textPrimary}`}
          data-testid="bni-give-back-btn"
        >
          <ArrowLeft className="h-4 w-4" /> Back to My Gives
        </button>

        <div>
          <h1 className={`text-3xl font-bold flex items-center gap-2 ${textPrimary}`} style={{ fontFamily: 'Plus Jakarta Sans' }}>
            <Package className="h-7 w-7 text-[#6366f1]" /> {give.business_person_name}
          </h1>
          <p className={`text-sm ${textSecondary} mt-1`}>
            {give.company_name || '—'} · {give.industry || '—'}
            {give.assigned_week_number && (
              <Badge className="ml-2 bg-[#6366f1]/15 text-[#6366f1] border border-[#6366f1]/40">
                Week {give.assigned_week_number}
              </Badge>
            )}
          </p>
        </div>

        <div className="flex items-center justify-between">
          <h2 className={`text-lg font-semibold ${textPrimary}`}>Given To</h2>
          <Button onClick={openAddRecipient} className="bg-[#6366f1] hover:bg-[#4f46e5] text-white" data-testid="bni-give-add-recipient-btn">
            <Plus className="h-4 w-4 mr-2" /> Add Member
          </Button>
        </div>

        <div className={`${bgCard} border ${borderColor} rounded-xl overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className={bgSecondary}>
                <tr>
                  <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Member</th>
                  <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Reason</th>
                  <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Give Date</th>
                  <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Shared Via</th>
                  <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Status</th>
                  <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}></th>
                </tr>
              </thead>
              <tbody className={`divide-y ${borderColor}`}>
                {recipients.length === 0 ? (
                  <tr>
                    <td colSpan={6} className={`px-4 py-8 text-center ${textSecondary}`}>
                      Not given to any member yet — click "Add Member" to give this to someone.
                    </td>
                  </tr>
                ) : (
                  recipients.map((r) => (
                    <tr key={r.recipient_id} className={`${bgCard} hover:${bgSecondary} transition-colors`}>
                      <td className={`px-4 py-3 font-medium ${textPrimary}`}>{r.member_name}</td>
                      <td className={`px-4 py-3 ${textSecondary}`}>{r.reason || '—'}</td>
                      <td className={`px-4 py-3 ${textSecondary}`}>{r.give_date || '—'}</td>
                      <td className={`px-4 py-3 ${textSecondary}`}>{r.shared_via || '—'}</td>
                      <td className="px-4 py-3">
                        <Select value={r.status} onValueChange={(v) => updateStatus(r.recipient_id, v)}>
                          <SelectTrigger className={`w-[150px] ${statusColor(r.status)}`} data-testid={`bni-give-recipient-status-${r.recipient_id}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {RECIPIENT_STATUSES.map((s) => (
                              <SelectItem key={s} value={s}>{s}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-4 py-3">
                        <Button variant="ghost" size="sm" className="text-[#ef4444]" onClick={() => deleteRecipient(r.recipient_id)} data-testid={`bni-give-recipient-delete-${r.recipient_id}`}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogContent className={`${bgCard} max-w-md`}>
            <DialogHeader>
              <DialogTitle className={textPrimary}>Give to Member</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className={textPrimary}>Member *</Label>
                <Select value={form.member_id} onValueChange={(v) => setForm({ ...form, member_id: v })}>
                  <SelectTrigger className={`${bgSecondary} border ${borderColor} ${textPrimary}`} data-testid="bni-give-recipient-member-select">
                    <SelectValue placeholder="Select a member" />
                  </SelectTrigger>
                  <SelectContent>
                    {members.map((m) => (
                      <SelectItem key={m.member_id} value={m.member_id}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className={textPrimary}>Reason</Label>
                <Textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} className={`${bgSecondary} border ${borderColor}`} rows={2} data-testid="bni-give-recipient-reason-input" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className={textPrimary}>Give Date</Label>
                  <Input type="date" value={form.give_date} onChange={(e) => setForm({ ...form, give_date: e.target.value })} className={`${bgSecondary} border ${borderColor}`} data-testid="bni-give-recipient-date-input" />
                </div>
                <div>
                  <Label className={textPrimary}>Shared Via</Label>
                  <Select value={form.shared_via || 'none'} onValueChange={(v) => setForm({ ...form, shared_via: v === 'none' ? '' : v })}>
                    <SelectTrigger className={`${bgSecondary} border ${borderColor} ${textPrimary}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">—</SelectItem>
                      {SHARED_VIA_OPTIONS.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button onClick={saveRecipient} disabled={saving} className="bg-[#6366f1] hover:bg-[#4f46e5]" data-testid="bni-give-recipient-save-btn">
                {saving ? 'Saving…' : 'Save'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default BNIMyGiveDetailPage;
