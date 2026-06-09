import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { X, Video, Users, Calendar, Clock, ExternalLink, Check } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent } from './ui/card';

const API = process.env.REACT_APP_BACKEND_URL;

/**
 * MeetingModal — Schedule a Google Meet-style meeting.
 * Props:
 *  - open (bool)
 *  - onClose (fn)
 *  - onCreated (fn(meeting))
 *  - projectId (str | null)  — when scheduling from a project
 *  - allowCategoryToggle (bool) — show Client/Team selector (true on Meetings tab)
 *  - users (array) — [{user_id, name, email}]
 *  - theme classes (bgCard, bgSecondary, borderColor, textPrimary, textSecondary)
 *  - headers (axios auth headers)
 */
export default function MeetingModal({
  open, onClose, onCreated, projectId = null,
  allowCategoryToggle = true,
  users = [], headers,
  bgCard = 'bg-white', bgSecondary = 'bg-gray-100', borderColor = 'border-gray-200',
  textPrimary = 'text-gray-900', textSecondary = 'text-gray-500',
}) {
  const [form, setForm] = useState({
    title: '',
    category: 'team',
    client_name: '',
    date: '',
    start_time: '',
    end_time: '',
    meeting_link: '',
    agenda: '',
    attendees: [],
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm({
      title: '', category: 'team', client_name: '',
      date: '', start_time: '', end_time: '',
      meeting_link: '', agenda: '', attendees: [],
    });
  }, [open]);

  if (!open) return null;

  const toggleAttendee = (uid) => {
    setForm(prev => ({
      ...prev,
      attendees: prev.attendees.includes(uid)
        ? prev.attendees.filter(x => x !== uid)
        : [...prev.attendees, uid],
    }));
  };

  const handleSchedule = async () => {
    if (!form.title.trim()) { toast.error('Meeting name is required'); return; }
    if (!form.date) { toast.error('Date is required'); return; }
    if (!form.start_time) { toast.error('Start time is required'); return; }
    if (form.attendees.length === 0) { toast.error('Select at least one attendee'); return; }

    const attendees = form.attendees.map(uid => {
      const u = users.find(x => x.user_id === uid);
      return { user_id: uid, name: u?.name || '', email: u?.email || '' };
    });
    const payload = {
      title: form.title.trim(),
      date: form.date,
      start_time: form.start_time,
      end_time: form.end_time || null,
      meeting_type: 'video',
      category: form.category,
      meeting_link: form.meeting_link.trim() || null,
      attendees,
      project_id: projectId,
      client_name: form.category === 'client' ? form.client_name.trim() : null,
      agenda: form.agenda.trim() || null,
    };
    setSaving(true);
    try {
      const res = await axios.post(`${API}/api/meetings/`, payload, { headers });
      toast.success('Meeting scheduled — attendees notified');
      onCreated && onCreated(res.data?.meeting || res.data);
      onClose && onClose();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to schedule meeting');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-[80] p-4"
      onClick={onClose}
      data-testid="meeting-modal"
    >
      <Card className={`${bgCard} border ${borderColor} w-full max-w-2xl max-h-[90vh] overflow-y-auto`} onClick={(e) => e.stopPropagation()}>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#10b981] to-[#3b82f6] flex items-center justify-center">
                <Video className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className={`text-lg font-semibold ${textPrimary}`}>Schedule Meeting</h3>
                <p className={`text-xs ${textSecondary}`}>Attendees will receive this as a Meeting task</p>
              </div>
            </div>
            <button onClick={onClose} className={textSecondary}><X className="h-5 w-5" /></button>
          </div>

          {allowCategoryToggle && (
            <div>
              <Label className={textPrimary}>Meeting Type</Label>
              <div className="flex gap-2 mt-2">
                {[
                  { v: 'team', label: 'Team Meeting' },
                  { v: 'client', label: 'Client Meeting' },
                ].map(opt => (
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, category: opt.v }))}
                    data-testid={`mtg-cat-${opt.v}`}
                    className={`px-4 py-2 rounded-lg text-sm border-2 transition-all ${
                      form.category === opt.v
                        ? 'bg-[#6366f1] text-white border-transparent'
                        : `${bgSecondary} border-transparent ${textSecondary} hover:opacity-80`
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <Label className={textPrimary}>Meeting Name *</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm(prev => ({ ...prev, title: e.target.value }))}
              placeholder="e.g. Kickoff with Acme Corp"
              className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
              data-testid="mtg-title"
            />
          </div>

          {form.category === 'client' && (
            <div>
              <Label className={textPrimary}>Client Name</Label>
              <Input
                value={form.client_name}
                onChange={(e) => setForm(prev => ({ ...prev, client_name: e.target.value }))}
                placeholder="Client / company name"
                className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                data-testid="mtg-client"
              />
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className={`${textPrimary} flex items-center gap-1`}><Calendar className="h-3 w-3" /> Date *</Label>
              <Input
                type="date"
                value={form.date}
                onChange={(e) => setForm(prev => ({ ...prev, date: e.target.value }))}
                className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                data-testid="mtg-date"
              />
            </div>
            <div>
              <Label className={`${textPrimary} flex items-center gap-1`}><Clock className="h-3 w-3" /> Start *</Label>
              <Input
                type="time"
                value={form.start_time}
                onChange={(e) => setForm(prev => ({ ...prev, start_time: e.target.value }))}
                className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                data-testid="mtg-start"
              />
            </div>
            <div>
              <Label className={`${textPrimary} flex items-center gap-1`}><Clock className="h-3 w-3" /> End</Label>
              <Input
                type="time"
                value={form.end_time}
                onChange={(e) => setForm(prev => ({ ...prev, end_time: e.target.value }))}
                className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                data-testid="mtg-end"
              />
            </div>
          </div>

          <div>
            <Label className={`${textPrimary} flex items-center gap-1`}><ExternalLink className="h-3 w-3" /> Google Meet link</Label>
            <Input
              value={form.meeting_link}
              onChange={(e) => setForm(prev => ({ ...prev, meeting_link: e.target.value }))}
              placeholder="https://meet.google.com/xxx-xxxx-xxx (paste manually)"
              className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
              data-testid="mtg-link"
            />
          </div>

          <div>
            <Label className={`${textPrimary} flex items-center gap-1`}><Users className="h-3 w-3" /> Attendees *</Label>
            <div className={`max-h-48 overflow-y-auto border ${borderColor} rounded-lg p-2 space-y-1 mt-1`}>
              {users.length === 0 ? (
                <p className={`text-sm ${textSecondary} p-2`}>No users available.</p>
              ) : users.map(u => {
                const checked = form.attendees.includes(u.user_id);
                return (
                  <label
                    key={u.user_id}
                    className={`flex items-center gap-3 p-2 rounded cursor-pointer hover:bg-[#6366f1]/10`}
                    data-testid={`mtg-attendee-${u.user_id}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleAttendee(u.user_id)}
                      className="h-4 w-4 accent-[#6366f1]"
                    />
                    <span className={`text-sm ${textPrimary} flex-1`}>{u.name}</span>
                    <span className={`text-xs ${textSecondary}`}>{u.email}</span>
                  </label>
                );
              })}
            </div>
            <p className={`text-xs ${textSecondary} mt-1`}>{form.attendees.length} selected</p>
          </div>

          <div>
            <Label className={textPrimary}>Agenda</Label>
            <textarea
              value={form.agenda}
              onChange={(e) => setForm(prev => ({ ...prev, agenda: e.target.value }))}
              rows={3}
              placeholder="Optional — what's this meeting about?"
              className={`w-full px-3 py-2 rounded-lg border ${borderColor} ${bgSecondary} ${textPrimary} text-sm`}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button
              onClick={handleSchedule}
              disabled={saving}
              className="bg-[#10b981] hover:bg-[#059669] text-white"
              data-testid="mtg-schedule"
            >
              <Check className="h-3 w-3 mr-1" /> {saving ? 'Scheduling…' : 'Schedule'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
