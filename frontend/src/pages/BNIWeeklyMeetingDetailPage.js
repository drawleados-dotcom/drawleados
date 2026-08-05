import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout';
import { useTheme } from '../contexts/ThemeContext';
import api from '../utils/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { ArrowLeft, Gift, GraduationCap, Presentation, Mic, Plus, Pencil, Clock, MapPin, UserCheck, Trash2, ExternalLink, Handshake } from 'lucide-react';
import { toast } from 'sonner';

const SUB_TABS = [
  { key: 'give_ask', label: 'Give and Ask', icon: Gift },
  { key: 'education_slot', label: 'Education Slot', icon: GraduationCap },
  { key: 'future_presentation', label: 'Future Presentation', icon: Presentation },
  { key: 'weekly_presentation', label: 'Weekly Presentation', icon: Mic },
  { key: 'contribution', label: 'Contribution', icon: Handshake },
];

const BNIWeeklyMeetingDetailPage = () => {
  const { meetingId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isDark } = useTheme();

  const bgCard = isDark ? 'bg-[#18181b]' : 'bg-white';
  const bgSecondary = isDark ? 'bg-[#27272a]' : 'bg-gray-100';
  const borderColor = isDark ? 'border-[#3f3f46]' : 'border-gray-200';
  const textPrimary = isDark ? 'text-[#fafafa]' : 'text-gray-900';
  const textSecondary = isDark ? 'text-[#a1a1aa]' : 'text-gray-500';

  const [subTab, setSubTab] = useState(searchParams.get('subtab') || 'give_ask');
  const [meeting, setMeeting] = useState(null);
  const [members, setMembers] = useState([]);
  const [giveAsks, setGiveAsks] = useState([]);
  const [futurePresentations, setFuturePresentations] = useState([]);
  const [giveOfWeek, setGiveOfWeek] = useState(null);
  const [oneToOnes, setOneToOnes] = useState([]);
  const [showOtoContribution, setShowOtoContribution] = useState(false);
  const [chapterSettings, setChapterSettings] = useState({ chapter_name: '' });
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [activeMember, setActiveMember] = useState(null);
  const [giveText, setGiveText] = useState('');
  const [askText, setAskText] = useState('');
  const [saving, setSaving] = useState(false);

  const [showAttendance, setShowAttendance] = useState(false);
  const [attendanceForm, setAttendanceForm] = useState({ time: '', attended_by: 'vinoth', substitute_name: '' });
  const [attendanceSaving, setAttendanceSaving] = useState(false);

  const [showLocation, setShowLocation] = useState(false);
  const [locationValue, setLocationValue] = useState('');
  const [locationSaving, setLocationSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const meetingRes = await api.get(`/bni/weekly-meetings/${meetingId}`);
      const weekNumber = meetingRes.data.week_number;
      const [membersRes, gaRes, fpRes, giveRes, otoRes, settingsRes] = await Promise.all([
        api.get('/bni/members'),
        api.get('/bni/give-ask', { params: { meeting_id: meetingId } }),
        api.get('/bni/future-presentations', { params: { meeting_id: meetingId } }),
        // Filtered by week_number, not meeting_id — a give can be assigned to
        // this week before this meeting document even existed.
        api.get('/bni/my-gives', { params: { week_number: weekNumber } }),
        api.get('/bni/one-to-ones'),
        api.get('/bni/settings'),
      ]);
      setMeeting(meetingRes.data);
      setMembers(membersRes.data || []);
      setGiveAsks(gaRes.data || []);
      setFuturePresentations(fpRes.data || []);
      setGiveOfWeek((giveRes.data || [])[0] || null);
      setOneToOnes(otoRes.data || []);
      setChapterSettings(settingsRes.data || { chapter_name: '' });
    } catch (error) {
      toast.error('Failed to load weekly meeting');
    } finally {
      setLoading(false);
    }
  }, [meetingId]);

  useEffect(() => { load(); }, [load]);

  // A One-to-One "counts" toward a week once its meeting status is marked
  // Completed and its date falls in that week's 7-day window (Sat–Fri,
  // ending on the week's meeting_date) — mirrors the week-boundary logic
  // used to auto-generate weekly meetings.
  const weekCompletedOtos = useMemo(() => {
    if (!meeting?.meeting_date) return [];
    const weekEnd = new Date(meeting.meeting_date);
    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekStart.getDate() - 6);
    return oneToOnes.filter((o) => {
      if (o.meeting_status !== 'Completed' || !o.meeting_date) return false;
      const d = new Date(o.meeting_date);
      return d >= weekStart && d <= weekEnd;
    });
  }, [oneToOnes, meeting]);

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

  const openAttendance = () => {
    setAttendanceForm({
      time: meeting?.attendance?.time || '',
      attended_by: meeting?.attendance?.attended_by || 'vinoth',
      substitute_name: meeting?.attendance?.substitute_name || '',
    });
    setShowAttendance(true);
  };

  const saveAttendance = async () => {
    if (attendanceForm.attended_by === 'substitute' && !attendanceForm.substitute_name.trim()) {
      toast.error('Enter the substitute\'s name');
      return;
    }
    setAttendanceSaving(true);
    try {
      const res = await api.put(`/bni/weekly-meetings/${meetingId}/attendance`, attendanceForm);
      setMeeting(res.data);
      toast.success('Attendance saved');
      setShowAttendance(false);
    } catch (error) {
      toast.error('Failed to save attendance');
    } finally {
      setAttendanceSaving(false);
    }
  };

  const deleteFuturePresentation = async (id) => {
    if (!window.confirm('Delete this Future Presentation?')) return;
    try {
      await api.delete(`/bni/future-presentations/${id}`);
      toast.success('Deleted');
      load();
    } catch (error) {
      toast.error('Failed to delete');
    }
  };

  const openLocation = () => {
    setLocationValue(meeting?.location || '');
    setShowLocation(true);
  };

  const saveLocation = async () => {
    setLocationSaving(true);
    try {
      const res = await api.put(`/bni/weekly-meetings/${meetingId}`, { location: locationValue });
      setMeeting(res.data);
      toast.success('Location saved');
      setShowLocation(false);
    } catch (error) {
      toast.error('Failed to save location');
    } finally {
      setLocationSaving(false);
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
          <p className={`text-sm ${textSecondary} mt-1`}>{dateLabel}</p>

          <div className="flex flex-wrap items-center gap-3 mt-3">
            <button
              onClick={openLocation}
              className={`flex items-center gap-1.5 text-sm ${bgSecondary} border ${borderColor} rounded-full px-3 py-1.5 ${textPrimary} hover:border-[#6366f1]/40`}
              data-testid="bni-week-location-btn"
            >
              <MapPin className="h-3.5 w-3.5" />
              {meeting.location || 'Add Location'}
              <Pencil className="h-3 w-3 opacity-60" />
            </button>

            <button
              onClick={openAttendance}
              className={`flex items-center gap-1.5 text-sm ${bgSecondary} border ${borderColor} rounded-full px-3 py-1.5 ${textPrimary} hover:border-[#6366f1]/40`}
              data-testid="bni-week-attendance-btn"
            >
              <UserCheck className="h-3.5 w-3.5" />
              {meeting.attendance?.attended_by ? (
                <>
                  {meeting.attendance.attended_by === 'substitute'
                    ? `${meeting.attendance.substitute_name} (Substitute)`
                    : 'Vinoth'}
                  {meeting.attendance.time && (
                    <span className={textSecondary}><Clock className="h-3 w-3 inline mx-1" />{meeting.attendance.time}</span>
                  )}
                </>
              ) : (
                'Add Attendance'
              )}
              <Pencil className="h-3 w-3 opacity-60" />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
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
          {subTab === 'future_presentation' && (
            <Button
              onClick={() => navigate(`/bni/weekly-meeting/${meetingId}/future-presentation/new`)}
              className="bg-[#6366f1] hover:bg-[#4f46e5] text-white"
              data-testid="bni-fp-add-btn"
            >
              <Plus className="h-4 w-4 mr-2" /> Add Future Presentation
            </Button>
          )}
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

        {subTab === 'future_presentation' && (
          <div className={`${bgCard} border ${borderColor} rounded-xl overflow-hidden`}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className={bgSecondary}>
                  <tr>
                    <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Member</th>
                    <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Category</th>
                    <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Business</th>
                    <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Link</th>
                    <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Asks</th>
                    <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Clients</th>
                    <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Actions</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${borderColor}`}>
                  {futurePresentations.length === 0 ? (
                    <tr>
                      <td colSpan={7} className={`px-4 py-8 text-center ${textSecondary}`}>
                        No Future Presentations yet — click "Add Future Presentation" to log the first one.
                      </td>
                    </tr>
                  ) : (
                    futurePresentations.map((fp) => (
                      <tr key={fp.presentation_id} className={`${bgCard} hover:${bgSecondary} transition-colors`}>
                        <td className={`px-4 py-3 font-medium ${textPrimary}`}>{fp.member_name}</td>
                        <td className={`px-4 py-3 ${textSecondary}`}>{fp.category_name || '—'}</td>
                        <td className={`px-4 py-3 ${textSecondary}`}>{fp.business_name || '—'}</td>
                        <td className="px-4 py-3">
                          {fp.presentation_link ? (
                            <a href={fp.presentation_link} target="_blank" rel="noreferrer" className="text-[#6366f1] inline-flex items-center gap-1 hover:underline">
                              View <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : (
                            <span className={textSecondary}>—</span>
                          )}
                        </td>
                        <td className={`px-4 py-3 ${textSecondary}`}>{fp.asks?.length || 0}</td>
                        <td className={`px-4 py-3 ${textSecondary}`}>{fp.clients?.length || 0}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" onClick={() => navigate(`/bni/weekly-meeting/${meetingId}/future-presentation/${fp.presentation_id}`)} data-testid={`bni-fp-edit-${fp.presentation_id}`}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" className="text-[#ef4444]" onClick={() => deleteFuturePresentation(fp.presentation_id)} data-testid={`bni-fp-delete-${fp.presentation_id}`}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {subTab === 'weekly_presentation' && (
          <div className="space-y-4">
            <div className={`${bgCard} border ${borderColor} rounded-xl p-6`}>
              <p className={`text-xl font-semibold ${textPrimary}`}>
                Good Morning, {(chapterSettings.chapter_name || 'Chapter').toUpperCase()}!
              </p>
              {giveOfWeek ? (
                <p className={`text-lg ${textSecondary} mt-3`}>
                  My Give of the Week is <span className={`font-semibold ${textPrimary}`}>{giveOfWeek.business_person_name}</span>
                  {giveOfWeek.company_name && <> (<span className={textPrimary}>{giveOfWeek.company_name}</span>)</>}
                  {giveOfWeek.industry && <> (<span className={textPrimary}>{giveOfWeek.industry}</span>)</>}
                </p>
              ) : (
                <div className="flex items-center gap-2 mt-3">
                  <Mic className={`h-5 w-5 ${textSecondary}`} />
                  <p className={`text-sm ${textSecondary}`}>No Give of the Week assigned yet — assign one from the My Gives tab.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {subTab === 'contribution' && (
          <div className="space-y-4">
            <div
              className={`${bgCard} border ${borderColor} rounded-xl p-5 inline-flex items-center gap-3 ${weekCompletedOtos.length > 0 ? 'cursor-pointer hover:border-[#6366f1]/40 transition-colors' : ''}`}
              onClick={() => weekCompletedOtos.length > 0 && setShowOtoContribution(true)}
              data-testid="bni-week-contribution-oto-card"
            >
              <div className="h-10 w-10 rounded-lg bg-[#6366f1]/15 flex items-center justify-center">
                <Handshake className="h-5 w-5 text-[#6366f1]" />
              </div>
              <div>
                <p className={`text-xs uppercase tracking-wide ${textSecondary}`}>One to One</p>
                <p className={`text-2xl font-bold ${textPrimary}`}>{weekCompletedOtos.length}</p>
              </div>
            </div>
            {weekCompletedOtos.length === 0 && (
              <p className={`text-sm ${textSecondary}`}>No completed One-to-Ones for this week yet.</p>
            )}
          </div>
        )}

        {subTab === 'education_slot' && (() => {
          const tab = SUB_TABS.find((t) => t.key === subTab);
          const Icon = tab?.icon || GraduationCap;
          return (
            <div className={`${bgCard} border ${borderColor} rounded-xl p-12 text-center`}>
              <Icon className={`h-10 w-10 mx-auto mb-3 ${textSecondary}`} />
              <p className={`font-medium ${textPrimary}`}>{tab?.label} — coming soon</p>
              <p className={`text-sm ${textSecondary} mt-1`}>Let us know what fields/workflow you need here and we'll build it out.</p>
            </div>
          );
        })()}

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

        <Dialog open={showLocation} onOpenChange={setShowLocation}>
          <DialogContent className={`${bgCard} max-w-sm`}>
            <DialogHeader>
              <DialogTitle className={textPrimary}>Meeting Location</DialogTitle>
            </DialogHeader>
            <Input value={locationValue} onChange={(e) => setLocationValue(e.target.value)} className={`${bgSecondary} border ${borderColor}`} data-testid="bni-week-location-input" autoFocus />
            <DialogFooter>
              <Button variant="ghost" onClick={() => setShowLocation(false)}>Cancel</Button>
              <Button onClick={saveLocation} disabled={locationSaving} className="bg-[#6366f1] hover:bg-[#4f46e5]" data-testid="bni-week-location-save-btn">
                {locationSaving ? 'Saving…' : 'Save'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showAttendance} onOpenChange={setShowAttendance}>
          <DialogContent className={`${bgCard} max-w-sm`}>
            <DialogHeader>
              <DialogTitle className={textPrimary}>Attendance — Week {meeting.week_number}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className={textPrimary}>Time</Label>
                <Input type="time" value={attendanceForm.time} onChange={(e) => setAttendanceForm({ ...attendanceForm, time: e.target.value })} className={`${bgSecondary} border ${borderColor}`} data-testid="bni-attendance-time-input" />
              </div>
              <div>
                <Label className={textPrimary}>Attended By</Label>
                <Select value={attendanceForm.attended_by} onValueChange={(v) => setAttendanceForm({ ...attendanceForm, attended_by: v })}>
                  <SelectTrigger className={`${bgSecondary} border ${borderColor} ${textPrimary}`} data-testid="bni-attendance-by-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vinoth">Vinoth</SelectItem>
                    <SelectItem value="substitute">Substitute</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {attendanceForm.attended_by === 'substitute' && (
                <div>
                  <Label className={textPrimary}>Substitute Name</Label>
                  <Input value={attendanceForm.substitute_name} onChange={(e) => setAttendanceForm({ ...attendanceForm, substitute_name: e.target.value })} className={`${bgSecondary} border ${borderColor}`} data-testid="bni-attendance-substitute-input" />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setShowAttendance(false)}>Cancel</Button>
              <Button onClick={saveAttendance} disabled={attendanceSaving} className="bg-[#6366f1] hover:bg-[#4f46e5]" data-testid="bni-attendance-save-btn">
                {attendanceSaving ? 'Saving…' : 'Save'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog open={showOtoContribution} onOpenChange={setShowOtoContribution}>
          <DialogContent className={`${bgCard} max-w-lg max-h-[80vh] overflow-y-auto`}>
            <DialogHeader>
              <DialogTitle className={textPrimary}>One-to-Ones Completed — Week {meeting.week_number}</DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              {weekCompletedOtos.map((o) => (
                <div key={o.entry_id} className={`flex items-center justify-between p-3 rounded-lg ${bgSecondary} border ${borderColor}`}>
                  <div>
                    <p className={`font-medium ${textPrimary}`}>{o.member_name}</p>
                    <p className={`text-xs ${textSecondary}`}>
                      {o.meeting_date ? new Date(o.meeting_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                      {o.meeting_time ? ` · ${o.meeting_time}` : ''}
                      {o.location ? ` · ${o.location}` : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default BNIWeeklyMeetingDetailPage;
