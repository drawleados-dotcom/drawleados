import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Plus, Video, Calendar, Clock, ExternalLink, Users, Trash2 } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import MeetingModal from './MeetingModal';

const API = process.env.REACT_APP_BACKEND_URL;

export default function MeetingsPanel({
  isDark, textPrimary, textSecondary, bgCard, bgSecondary, borderColor, headers, users = [],
}) {
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [typeFilter, setTypeFilter] = useState('all'); // all | client | team
  const [whenFilter, setWhenFilter] = useState('upcoming'); // upcoming | past | all
  const [viewing, setViewing] = useState(null);

  const loadMeetings = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API}/api/meetings/my-meetings`, { headers });
      setMeetings(res.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [headers]);

  useEffect(() => { loadMeetings(); }, [loadMeetings]);

  const todayStr = new Date().toISOString().slice(0, 10);
  const filtered = meetings.filter(m => {
    if (typeFilter !== 'all' && (m.category || 'team') !== typeFilter) return false;
    if (whenFilter === 'upcoming' && (m.date || '') < todayStr) return false;
    if (whenFilter === 'past' && (m.date || '') >= todayStr) return false;
    return true;
  }).sort((a, b) => {
    const ka = `${a.date || ''} ${a.start_time || ''}`;
    const kb = `${b.date || ''} ${b.start_time || ''}`;
    return whenFilter === 'past' ? kb.localeCompare(ka) : ka.localeCompare(kb);
  });

  const handleDelete = async (m) => {
    if (!window.confirm(`Delete meeting "${m.title}"? Attendee tasks will be removed.`)) return;
    try {
      await axios.delete(`${API}/api/meetings/${m.meeting_id}`, { headers });
      toast.success('Meeting deleted');
      loadMeetings();
      setViewing(null);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to delete');
    }
  };

  const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : '—';

  return (
    <div className="space-y-4" data-testid="meetings-panel">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {[
            { v: 'upcoming', label: 'Upcoming' },
            { v: 'past', label: 'Past' },
            { v: 'all', label: 'All' },
          ].map(t => (
            <button
              key={t.v}
              onClick={() => setWhenFilter(t.v)}
              className={`px-3 py-1.5 rounded-full text-xs ${
                whenFilter === t.v ? 'bg-[#6366f1] text-white' : `${bgSecondary} ${textSecondary}`
              }`}
              data-testid={`mtg-when-${t.v}`}
            >
              {t.label}
            </button>
          ))}
          <span className={`mx-2 ${textSecondary}`}>·</span>
          {[
            { v: 'all', label: 'All Types' },
            { v: 'team', label: 'Team' },
            { v: 'client', label: 'Client' },
          ].map(t => (
            <button
              key={t.v}
              onClick={() => setTypeFilter(t.v)}
              className={`px-3 py-1.5 rounded-full text-xs ${
                typeFilter === t.v ? 'bg-[#6366f1] text-white' : `${bgSecondary} ${textSecondary}`
              }`}
              data-testid={`mtg-type-${t.v}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <Button
          onClick={() => setShowCreate(true)}
          className="bg-[#10b981] hover:bg-[#059669] text-white"
          data-testid="create-meeting-btn"
        >
          <Plus className="h-4 w-4 mr-1" /> Create Meeting
        </Button>
      </div>

      {loading ? (
        <p className={textSecondary}>Loading meetings...</p>
      ) : filtered.length === 0 ? (
        <Card className={`${bgCard} border ${borderColor}`}>
          <CardContent className="p-12 text-center">
            <Video className={`h-12 w-12 mx-auto mb-3 ${textSecondary}`} />
            <p className={textPrimary}>No meetings {whenFilter !== 'all' ? whenFilter : ''}</p>
            <p className={`text-sm ${textSecondary}`}>Click "Create Meeting" to schedule one</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(m => (
            <Card
              key={m.meeting_id}
              className={`${bgCard} border ${borderColor} cursor-pointer hover:border-[#6366f1] transition-colors`}
              onClick={() => setViewing(m)}
              data-testid={`mtg-card-${m.meeting_id}`}
            >
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h3 className={`font-semibold ${textPrimary} line-clamp-2`}>{m.title}</h3>
                  <Badge className={
                    (m.category || 'team') === 'client'
                      ? 'bg-[#f59e0b]/20 text-[#f59e0b] flex-none'
                      : 'bg-[#3b82f6]/20 text-[#3b82f6] flex-none'
                  }>{(m.category || 'team') === 'client' ? 'Client' : 'Team'}</Badge>
                </div>
                <div className={`flex items-center gap-3 text-xs ${textSecondary}`}>
                  <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{fmtDate(m.date)}</span>
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{m.start_time || '--:--'}</span>
                </div>
                {m.project_name && (
                  <p className={`text-xs ${textSecondary}`}>Project: <span className={textPrimary}>{m.project_name}</span></p>
                )}
                <div className={`flex items-center gap-1 text-xs ${textSecondary}`}>
                  <Users className="h-3 w-3" /> {(m.attendees || []).length} attendees
                </div>
                {m.meeting_link && (
                  <a
                    href={m.meeting_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1 text-xs text-[#6366f1] hover:underline truncate"
                  >
                    <ExternalLink className="h-3 w-3" /> Join Meet
                  </a>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {showCreate && (
        <MeetingModal
          open={showCreate}
          onClose={() => setShowCreate(false)}
          onCreated={() => loadMeetings()}
          projectId={null}
          allowCategoryToggle
          users={users}
          headers={headers}
          bgCard={bgCard}
          bgSecondary={bgSecondary}
          borderColor={borderColor}
          textPrimary={textPrimary}
          textSecondary={textSecondary}
        />
      )}

      {viewing && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[75] p-4" onClick={() => setViewing(null)}>
          <Card className={`${bgCard} border ${borderColor} w-full max-w-lg`} onClick={(e) => e.stopPropagation()}>
            <CardContent className="p-6 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <Badge className={
                    (viewing.category || 'team') === 'client'
                      ? 'bg-[#f59e0b]/20 text-[#f59e0b] mb-2'
                      : 'bg-[#3b82f6]/20 text-[#3b82f6] mb-2'
                  }>{(viewing.category || 'team') === 'client' ? 'Client Meeting' : 'Team Meeting'}</Badge>
                  <h3 className={`text-xl font-semibold ${textPrimary}`}>{viewing.title}</h3>
                  {viewing.client_name && (
                    <p className={`text-sm ${textSecondary}`}>Client: {viewing.client_name}</p>
                  )}
                </div>
                <button onClick={() => setViewing(null)} className={textSecondary}>✕</button>
              </div>
              <div className={`grid grid-cols-2 gap-3 text-sm`}>
                <div><span className={textSecondary}>Date:</span> <span className={textPrimary}>{fmtDate(viewing.date)}</span></div>
                <div><span className={textSecondary}>Time:</span> <span className={textPrimary}>{viewing.start_time}{viewing.end_time ? ` – ${viewing.end_time}` : ''}</span></div>
                {viewing.project_name && (
                  <div className="col-span-2"><span className={textSecondary}>Project:</span> <span className={textPrimary}>{viewing.project_name}</span></div>
                )}
              </div>
              {viewing.meeting_link && (
                <a
                  href={viewing.meeting_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[#6366f1] text-white text-sm w-fit"
                >
                  <ExternalLink className="h-4 w-4" /> Join Google Meet
                </a>
              )}
              {viewing.agenda && (
                <div>
                  <p className={`text-xs ${textSecondary} mb-1`}>Agenda</p>
                  <p className={`text-sm ${textPrimary} whitespace-pre-wrap`}>{viewing.agenda}</p>
                </div>
              )}
              <div>
                <p className={`text-xs ${textSecondary} mb-1`}>Attendees ({(viewing.attendees || []).length})</p>
                <div className="flex flex-wrap gap-1.5">
                  {(viewing.attendees || []).map((a, i) => (
                    <span key={i} className={`px-2 py-0.5 rounded-full text-xs ${bgSecondary} ${textPrimary}`}>
                      {a.name || a.user_id || a.email}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <Button
                  onClick={() => handleDelete(viewing)}
                  className="bg-[#ef4444]/15 text-[#ef4444] hover:bg-[#ef4444]/25"
                >
                  <Trash2 className="h-4 w-4 mr-1" /> Delete Meeting
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
