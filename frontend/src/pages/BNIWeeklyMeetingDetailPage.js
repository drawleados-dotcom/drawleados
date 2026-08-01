import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { useTheme } from '../contexts/ThemeContext';
import api from '../utils/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { ArrowLeft, Gift, GraduationCap, Presentation, Plus, Pencil } from 'lucide-react';
import { toast } from 'sonner';

const SUB_TABS = [
  { key: 'give_ask', label: 'Give and Ask', icon: Gift },
  { key: 'education_slot', label: 'Education Slot', icon: GraduationCap },
  { key: 'future_presentation', label: 'Future Presentation', icon: Presentation },
];

const BNIWeeklyMeetingDetailPage = () => {
  const { meetingId } = useParams();
  const navigate = useNavigate();
  const { isDark } = useTheme();

  const bgCard = isDark ? 'bg-[#18181b]' : 'bg-white';
  const bgSecondary = isDark ? 'bg-[#27272a]' : 'bg-gray-100';
  const borderColor = isDark ? 'border-[#3f3f46]' : 'border-gray-200';
  const textPrimary = isDark ? 'text-[#fafafa]' : 'text-gray-900';
  const textSecondary = isDark ? 'text-[#a1a1aa]' : 'text-gray-500';

  const [subTab, setSubTab] = useState('give_ask');
  const [meeting, setMeeting] = useState(null);
  const [members, setMembers] = useState([]);
  const [giveAsks, setGiveAsks] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [activeMember, setActiveMember] = useState(null);
  const [giveText, setGiveText] = useState('');
  const [askText, setAskText] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [meetingRes, membersRes, gaRes] = await Promise.all([
        api.get(`/bni/weekly-meetings/${meetingId}`),
        api.get('/bni/members'),
        api.get('/bni/give-ask', { params: { meeting_id: meetingId } }),
      ]);
      setMeeting(meetingRes.data);
      setMembers(membersRes.data || []);
      setGiveAsks(gaRes.data || []);
    } catch (error) {
      toast.error('Failed to load weekly meeting');
    } finally {
      setLoading(false);
    }
  }, [meetingId]);

  useEffect(() => { load(); }, [load]);

  const giveAskByMember = useMemo(() => {
    const map = {};
    giveAsks.forEach((g) => { map[g.member_id] = g; });
    return map;
  }, [giveAsks]);

  const openGiveAsk = (member) => {
    const existing = giveAskByMember[member.member_id];
    setActiveMember(member);
    setGiveText(existing?.give || '');
    setAskText(existing?.ask || '');
    setShowForm(true);
  };

  const saveGiveAsk = async () => {
    setSaving(true);
    try {
      await api.post('/bni/give-ask', {
        meeting_id: meetingId,
        member_id: activeMember.member_id,
        give: giveText,
        ask: askText,
      });
      toast.success('Saved');
      setShowForm(false);
      load();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className={`text-center py-12 ${textSecondary}`}>Loading…</div>
      </Layout>
    );
  }

  if (!meeting) {
    return (
      <Layout>
        <div className={`text-center py-12 ${textSecondary}`}>Weekly meeting not found.</div>
      </Layout>
    );
  }

  const dateLabel = new Date(meeting.meeting_date).toLocaleDateString('en-GB', {
    weekday: 'long', day: '2-digit', month: 'short', year: 'numeric',
  });

  return (
    <Layout>
      <div className="space-y-6" data-testid="bni-weekly-meeting-detail-page">
        <button
          onClick={() => navigate('/bni?tab=weekly_meeting')}
          className={`flex items-center gap-1 text-sm ${textSecondary} hover:${textPrimary}`}
          data-testid="bni-week-back-btn"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Weekly Meeting
        </button>

        <div>
          <h1 className={`text-3xl font-bold ${textPrimary}`} style={{ fontFamily: 'Plus Jakarta Sans' }}>
            Week {meeting.week_number}
          </h1>
          <p className={`text-sm ${textSecondary} mt-1`}>
            {dateLabel}{meeting.location ? ` — ${meeting.location}` : ''}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {SUB_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = subTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setSubTab(tab.key)}
                className={`px-4 py-2 text-sm font-medium rounded-lg flex items-center gap-2 transition-all whitespace-nowrap border ${
                  isActive
                    ? 'bg-[#6366f1] text-white border-transparent shadow-sm'
                    : `${bgCard} ${textSecondary} ${borderColor} hover:border-[#6366f1]/40`
                }`}
              >
                <Icon className="h-4 w-4" /> {tab.label}
              </button>
            );
          })}
        </div>

        {subTab === 'give_ask' && (
          <div className={`${bgCard} border ${borderColor} rounded-xl overflow-hidden`}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className={bgSecondary}>
                  <tr>
                    <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Member</th>
                    <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Give</th>
                    <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Ask</th>
                    <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}></th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${borderColor}`}>
                  {members.length === 0 ? (
                    <tr>
                      <td colSpan={4} className={`px-4 py-8 text-center ${textSecondary}`}>
                        No members yet — add members from the BNI Members tab.
                      </td>
                    </tr>
                  ) : (
                    members.map((m) => {
                      const entry = giveAskByMember[m.member_id];
                      return (
                        <tr key={m.member_id} className={`${bgCard} hover:${bgSecondary} transition-colors`}>
                          <td className={`px-4 py-3 font-medium ${textPrimary}`}>{m.name}</td>
                          <td className={`px-4 py-3 ${textSecondary}`}>{entry?.give || '—'}</td>
                          <td className={`px-4 py-3 ${textSecondary}`}>{entry?.ask || '—'}</td>
                          <td className="px-4 py-3">
                            <Button variant="ghost" size="sm" onClick={() => openGiveAsk(m)} data-testid={`bni-ga-add-${m.member_id}`}>
                              {entry ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {(subTab === 'education_slot' || subTab === 'future_presentation') && (
          <div className={`${bgCard} border ${borderColor} rounded-xl p-12 text-center`}>
            {subTab === 'education_slot' ? (
              <GraduationCap className={`h-10 w-10 mx-auto mb-3 ${textSecondary}`} />
            ) : (
              <Presentation className={`h-10 w-10 mx-auto mb-3 ${textSecondary}`} />
            )}
            <p className={`font-medium ${textPrimary}`}>
              {SUB_TABS.find((t) => t.key === subTab)?.label} — coming soon
            </p>
            <p className={`text-sm ${textSecondary} mt-1`}>Let us know what fields/workflow you need here and we'll build it out.</p>
          </div>
        )}

        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogContent className={`${bgCard} max-w-md`}>
            <DialogHeader>
              <DialogTitle className={textPrimary}>{activeMember?.name} — Give & Ask</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className={textPrimary}>Give</Label>
                <Textarea value={giveText} onChange={(e) => setGiveText(e.target.value)} className={`${bgSecondary} border ${borderColor}`} rows={3} data-testid="bni-ga-give-input" />
              </div>
              <div>
                <Label className={textPrimary}>Ask</Label>
                <Textarea value={askText} onChange={(e) => setAskText(e.target.value)} className={`${bgSecondary} border ${borderColor}`} rows={3} data-testid="bni-ga-ask-input" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button onClick={saveGiveAsk} disabled={saving} className="bg-[#6366f1] hover:bg-[#4f46e5]" data-testid="bni-ga-save-btn">
                {saving ? 'Saving…' : 'Save'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default BNIWeeklyMeetingDetailPage;
