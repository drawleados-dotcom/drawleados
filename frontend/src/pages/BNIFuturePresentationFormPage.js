import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { useTheme } from '../contexts/ThemeContext';
import api from '../utils/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { ArrowLeft, Plus, X } from 'lucide-react';
import { toast } from 'sonner';

const emptyForm = () => ({ member_id: '', presentation_link: '', summary: '', asks: [''], clients: [''] });

const BNIFuturePresentationFormPage = () => {
  const { meetingId, presentationId } = useParams();
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const isNew = presentationId === 'new';

  const bgCard = isDark ? 'bg-[#18181b]' : 'bg-white';
  const bgSecondary = isDark ? 'bg-[#27272a]' : 'bg-gray-100';
  const borderColor = isDark ? 'border-[#3f3f46]' : 'border-gray-200';
  const textPrimary = isDark ? 'text-[#fafafa]' : 'text-gray-900';
  const textSecondary = isDark ? 'text-[#a1a1aa]' : 'text-gray-500';

  const [meeting, setMeeting] = useState(null);
  const [members, setMembers] = useState([]);
  const [form, setForm] = useState(emptyForm());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [meetingRes, membersRes] = await Promise.all([
        api.get(`/bni/weekly-meetings/${meetingId}`),
        api.get('/bni/members'),
      ]);
      setMeeting(meetingRes.data);
      setMembers(membersRes.data || []);

      if (!isNew) {
        const fpRes = await api.get(`/bni/future-presentations/${presentationId}`);
        const fp = fpRes.data;
        setForm({
          member_id: fp.member_id || '',
          presentation_link: fp.presentation_link || '',
          summary: fp.summary || '',
          asks: fp.asks?.length ? fp.asks : [''],
          clients: fp.clients?.length ? fp.clients : [''],
        });
      }
    } catch (error) {
      toast.error('Failed to load');
    } finally {
      setLoading(false);
    }
  }, [meetingId, presentationId, isNew]);

  useEffect(() => { load(); }, [load]);

  const selectedMember = members.find((m) => m.member_id === form.member_id);

  const backToWeek = () => navigate(`/bni/weekly-meeting/${meetingId}?subtab=future_presentation`);

  const updateListItem = (field, idx, value) => {
    setForm((prev) => {
      const next = [...prev[field]];
      next[idx] = value;
      return { ...prev, [field]: next };
    });
  };

  const addListItem = (field) => {
    setForm((prev) => ({ ...prev, [field]: [...prev[field], ''] }));
  };

  const removeListItem = (field, idx) => {
    setForm((prev) => {
      const next = prev[field].filter((_, i) => i !== idx);
      return { ...prev, [field]: next.length ? next : [''] };
    });
  };

  const save = async () => {
    if (!form.member_id) { toast.error('Select a member'); return; }
    setSaving(true);
    try {
      const payload = {
        meeting_id: meetingId,
        member_id: form.member_id,
        presentation_link: form.presentation_link,
        summary: form.summary,
        asks: form.asks,
        clients: form.clients,
      };
      if (isNew) {
        await api.post('/bni/future-presentations', payload);
        toast.success('Future Presentation added');
      } else {
        await api.put(`/bni/future-presentations/${presentationId}`, payload);
        toast.success('Future Presentation updated');
      }
      backToWeek();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !meeting) {
    return (
      <Layout>
        <div className={`text-center py-12 ${textSecondary}`}>Loading…</div>
      </Layout>
    );
  }

  const dateLabel = new Date(meeting.meeting_date).toLocaleDateString('en-GB', {
    weekday: 'long', day: '2-digit', month: 'short', year: 'numeric',
  });

  return (
    <Layout>
      <div className="space-y-6 max-w-2xl" data-testid="bni-fp-form-page">
        <button
          onClick={backToWeek}
          className={`flex items-center gap-1 text-sm ${textSecondary} hover:${textPrimary}`}
          data-testid="bni-fp-back-btn"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Week {meeting.week_number}
        </button>

        <h1 className={`text-3xl font-bold ${textPrimary}`} style={{ fontFamily: 'Plus Jakarta Sans' }}>
          {isNew ? 'Add Future Presentation' : 'Edit Future Presentation'}
        </h1>

        <div className="space-y-4">
          <div>
            <Label className={textPrimary}>Week</Label>
            <p className={`text-sm ${textSecondary} mt-1`}>Week {meeting.week_number} — {dateLabel}</p>
          </div>

          <div>
            <Label className={textPrimary}>Member *</Label>
            <Select value={form.member_id} onValueChange={(v) => setForm({ ...form, member_id: v })}>
              <SelectTrigger className={`${bgSecondary} border ${borderColor} ${textPrimary}`} data-testid="bni-fp-member-select">
                <SelectValue placeholder="Select a member" />
              </SelectTrigger>
              <SelectContent>
                {members.map((m) => (
                  <SelectItem key={m.member_id} value={m.member_id}>{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedMember && (
            <div className={`${bgSecondary} border ${borderColor} rounded-lg p-3 grid grid-cols-2 gap-3 text-sm`}>
              <div>
                <p className={textSecondary}>Category</p>
                <p className={textPrimary}>{selectedMember.category_name || '—'}</p>
              </div>
              <div>
                <p className={textSecondary}>Business</p>
                <p className={textPrimary}>{selectedMember.business_name || '—'}</p>
              </div>
            </div>
          )}

          <div>
            <Label className={textPrimary}>Presentation Link (Drive)</Label>
            <Input
              value={form.presentation_link}
              onChange={(e) => setForm({ ...form, presentation_link: e.target.value })}
              placeholder="https://drive.google.com/…"
              className={`${bgSecondary} border ${borderColor}`}
              data-testid="bni-fp-link-input"
            />
          </div>

          <div>
            <Label className={textPrimary}>Summary</Label>
            <Textarea
              value={form.summary}
              onChange={(e) => setForm({ ...form, summary: e.target.value })}
              className={`${bgSecondary} border ${borderColor}`}
              rows={3}
              data-testid="bni-fp-summary-input"
            />
          </div>

          <div>
            <Label className={textPrimary}>Asks</Label>
            <div className="space-y-2 mt-1">
              {form.asks.map((ask, idx) => (
                <div key={idx} className="flex gap-2">
                  <Input
                    value={ask}
                    onChange={(e) => updateListItem('asks', idx, e.target.value)}
                    className={`${bgSecondary} border ${borderColor}`}
                    data-testid={`bni-fp-ask-input-${idx}`}
                  />
                  <Button variant="ghost" size="sm" onClick={() => removeListItem('asks', idx)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => addListItem('asks')} data-testid="bni-fp-add-ask-btn">
                <Plus className="h-4 w-4 mr-1" /> Add Ask
              </Button>
            </div>
          </div>

          <div>
            <Label className={textPrimary}>Clients</Label>
            <div className="space-y-2 mt-1">
              {form.clients.map((client, idx) => (
                <div key={idx} className="flex gap-2">
                  <Input
                    value={client}
                    onChange={(e) => updateListItem('clients', idx, e.target.value)}
                    className={`${bgSecondary} border ${borderColor}`}
                    data-testid={`bni-fp-client-input-${idx}`}
                  />
                  <Button variant="ghost" size="sm" onClick={() => removeListItem('clients', idx)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => addListItem('clients')} data-testid="bni-fp-add-client-btn">
                <Plus className="h-4 w-4 mr-1" /> Add Client
              </Button>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="ghost" onClick={backToWeek}>Cancel</Button>
          <Button onClick={save} disabled={saving} className="bg-[#6366f1] hover:bg-[#4f46e5]" data-testid="bni-fp-save-btn">
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>
    </Layout>
  );
};

export default BNIFuturePresentationFormPage;
