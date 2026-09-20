import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Badge } from '../ui/badge';
import { Plus, Trash2, Save, X, Pencil, CalendarDays, ChevronLeft, ChevronRight, ChevronDown, Calendar, Linkedin, Send, Check, Ban, Eye, Hash } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const API = process.env.REACT_APP_BACKEND_URL;

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const PLATFORMS = [
  { id: 'all', label: 'All' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'facebook', label: 'Facebook' },
  { id: 'x', label: 'X' },
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'youtube', label: 'YouTube' },
];

const POST_TYPES = ['static', 'reel', 'carousel', 'ig', 'long_video'];
const POST_TYPE_LABEL = { static: 'Static', reel: 'Reel', carousel: 'Carousel', ig: 'IG', long_video: 'Long Video' };

// Post Title / Content Link / Creative Link are each reviewed independently —
// their own approve/reject state and (on reject) a required reason, shown
// via a popup rather than squeezed into the table cell.
const REVIEW_FIELDS = {
  post_title: { label: 'Post Title', kind: 'text', placeholder: 'Post title' },
  content_link: { label: 'Content Link', kind: 'url', placeholder: 'https://...' },
  creative_link: { label: 'Creative Link', kind: 'url', placeholder: 'https://...' },
};
const REVIEW_STATUS_STYLE = {
  pending: 'text-slate-400',
  approved: 'text-emerald-500',
  rejected: 'text-red-500',
};

const STATUS_FLOW = ['created', 'scheduled', 'posted'];
const STATUS_LABEL = { created: 'Created', scheduled: 'Scheduled', posted: 'Posted' };
const STATUS_STYLE = {
  created: 'bg-slate-500/20 text-slate-300 border-slate-500/40',
  scheduled: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
  posted: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
};
// Each of these fields can be independently assigned + dated. Setting both
// on save auto-creates a real Operations task for that person (Department =
// Social Media), so the work shows up in their My Tasks. `posting` has no
// accompanying text field — it's just "who publishes this, and by when".
const FIELD_TASK_CONFIG = {
  post_title: { label: 'Post Title', category: 'Content Writing' },
  content_link: { label: 'Content Link', category: 'Content Calendar' },
  creative_link: { label: 'Creative Link', category: 'Designing' },
  posting: { label: 'Posting', category: 'Posting' },
};
// Fields with a text/url value alongside their assignee+date (all of
// FIELD_TASK_CONFIG except `posting`, which is assignee+date only).
const FIELD_HAS_VALUE = { post_title: true, content_link: true, creative_link: true, posting: false };

const dayOfWeek = (iso) => {
  if (!iso) return '—';
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { weekday: 'long' });
};

const newRowId = () => `cc_${Math.random().toString(36).slice(2, 10)}`;
const todayIso = () => new Date().toISOString().slice(0, 10);
const emptyDraftRow = (platform, defaultDate) => ({
  id: newRowId(),
  platforms: platform && platform !== 'all' ? [platform] : [],
  post_date: defaultDate || todayIso(),
  post_title: '',
  content_link: '',
  creative_link: '',
  description: '',
  post_type: 'static',
  status: 'created',
  post_title_assignee: '',
  post_title_date: '',
  content_link_assignee: '',
  content_link_date: '',
  creative_link_assignee: '',
  creative_link_date: '',
  posting_assignee: '',
  posting_date: '',
  hashtags: '',
  keywords: '',
  post_title_status: 'pending',
  post_title_reject_reason: '',
  content_link_status: 'pending',
  content_link_reject_reason: '',
  creative_link_status: 'pending',
  creative_link_reject_reason: '',
  scheduled_by_name: '',
  posted_by_name: '',
  post_link: '',
});

export default function ProjectContentCalendarTab({
  project,
  onProjectUpdated,
  onTaskCreated,
  canEdit,
  users,
  isDark,
  bgCard,
  bgSecondary,
  textPrimary,
  textSecondary,
  borderColor,
}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('session_token') : null;
  const headers = { Authorization: `Bearer ${token}` };
  const { user: currentUser } = useAuth();

  const [subTab, setSubTab] = useState('all');
  const posts = project?.content_calendar || [];

  const now = new Date();
  const [activeMonth, setActiveMonth] = useState(now.getMonth());
  const [activeYear, setActiveYear] = useState(now.getFullYear());
  const isCurrentMonth = activeMonth === now.getMonth() && activeYear === now.getFullYear();
  const yearOptions = [];
  for (let y = now.getFullYear() - 2; y <= now.getFullYear() + 2; y++) yearOptions.push(y);
  const goPrevMonth = () => {
    if (activeMonth === 0) { setActiveMonth(11); setActiveYear(y => y - 1); }
    else setActiveMonth(m => m - 1);
  };
  const goNextMonth = () => {
    if (activeMonth === 11) { setActiveMonth(0); setActiveYear(y => y + 1); }
    else setActiveMonth(m => m + 1);
  };

  const monthPosts = posts.filter(p => {
    if (!p.post_date) return false;
    const d = new Date(`${p.post_date}T00:00:00`);
    return d.getMonth() === activeMonth && d.getFullYear() === activeYear;
  });
  const list = subTab === 'all' ? monthPosts : monthPosts.filter(p => p.platform === subTab);

  // Every calendar day of the month being viewed, so the table always shows
  // the full month (01..30/31) rather than only days that already have a
  // post — each empty day gets its own row with an inline "Add Post" that
  // pre-fills that exact date.
  const daysInMonth = new Date(activeYear, activeMonth + 1, 0).getDate();
  const dayIso = (day) => `${activeYear}-${String(activeMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const formatDayLabel = (day) => `${String(day).padStart(2, '0')} ${MONTH_NAMES[activeMonth].slice(0, 3)} ${activeYear}`;

  // Per-platform post counts for the month being viewed (drives the number
  // badge on each platform sub-tab).
  const platformCounts = PLATFORMS.reduce((acc, p) => {
    acc[p.id] = p.id === 'all' ? monthPosts.length : monthPosts.filter(post => post.platform === p.id).length;
    return acc;
  }, {});

  // Status breakdown for whatever's currently filtered (platform + month).
  const summaryTotal = list.length;
  const summaryCreated = list.filter(p => (p.status || 'created') === 'created').length;
  const summaryScheduled = list.filter(p => p.status === 'scheduled').length;
  const summaryPosted = list.filter(p => p.status === 'posted').length;

  const [showAddModal, setShowAddModal] = useState(false);
  const [draftRows, setDraftRows] = useState([]);
  // Bulk-add UX: once a post is done, it collapses into a compact summary
  // header so a multi-post popup doesn't turn into an endless scroll of
  // fully-expanded forms. Click the header to re-expand any post.
  const [collapsedIds, setCollapsedIds] = useState([]);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editBuffer, setEditBuffer] = useState(null);

  // Post Title / Content Link / Creative Link popup — either editing an
  // existing row's field (with Approve/Reject) or, for an empty day's
  // "+ Add Post", creating a brand new row from just that field's value.
  const [fieldPopup, setFieldPopup] = useState(null); // { rowId, field, isNewRow, dateIso }
  const [fieldPopupValue, setFieldPopupValue] = useState('');
  const [fieldPopupRejectReason, setFieldPopupRejectReason] = useState('');
  const [fieldPopupShowReject, setFieldPopupShowReject] = useState(false);

  // Description / Hashtags / Keywords popup.
  const [descPopupRowId, setDescPopupRowId] = useState(null);
  const [descPopupValue, setDescPopupValue] = useState({ description: '', hashtags: '', keywords: '' });

  // Status transition popup — Schedule auto-stamps who; Posted also needs
  // the live post link. Also doubles as a read-only "view" for an
  // already-posted row (who posted it, and the link).
  const [statusPopup, setStatusPopup] = useState(null); // { rowId, mode: 'schedule' | 'post' | 'view' }
  const [statusPopupLink, setStatusPopupLink] = useState('');

  const assigneeName = (userId) => (users || []).find(u => u.user_id === userId)?.name || '';

  const openFieldPopup = (row, field, isNewRow = false, dateIso = null) => {
    setFieldPopup({ rowId: row?.id || null, field, isNewRow, dateIso });
    setFieldPopupValue(row ? (row[field] || '') : '');
    setFieldPopupRejectReason(row ? (row[`${field}_reject_reason`] || '') : '');
    setFieldPopupShowReject(false);
  };
  const closeFieldPopup = () => {
    setFieldPopup(null);
    setFieldPopupValue('');
    setFieldPopupRejectReason('');
    setFieldPopupShowReject(false);
  };

  // Just saves the text/link value, leaving review status untouched — for
  // the initial "create a row from this field" flow, and for editing the
  // value of an already-reviewed field without re-triggering approve/reject.
  const saveFieldPopupValue = async () => {
    if (fieldPopup.isNewRow) {
      if (!fieldPopupValue.trim()) { toast.error(`${REVIEW_FIELDS[fieldPopup.field].label} is required`); return; }
      const newRow = { ...emptyDraftRow(subTab, fieldPopup.dateIso), [fieldPopup.field]: fieldPopupValue.trim() };
      setSaving(true);
      const ok = await persist([...posts, newRow]);
      setSaving(false);
      if (ok) { toast.success('Post added'); closeFieldPopup(); }
      return;
    }
    setSaving(true);
    const next = posts.map(p => (p.id === fieldPopup.rowId ? { ...p, [fieldPopup.field]: fieldPopupValue } : p));
    const ok = await persist(next);
    setSaving(false);
    if (ok) { toast.success('Saved'); closeFieldPopup(); }
  };

  const setFieldReview = async (statusValue, reason = '') => {
    if (!fieldPopupValue.trim()) { toast.error(`${REVIEW_FIELDS[fieldPopup.field].label} is required`); return; }
    setSaving(true);
    const next = posts.map(p => (p.id === fieldPopup.rowId
      ? { ...p, [fieldPopup.field]: fieldPopupValue, [`${fieldPopup.field}_status`]: statusValue, [`${fieldPopup.field}_reject_reason`]: reason }
      : p));
    const ok = await persist(next);
    setSaving(false);
    if (ok) {
      toast.success(statusValue === 'approved' ? 'Approved' : 'Rejected');
      closeFieldPopup();
    }
  };

  const openDescPopup = (row) => {
    setDescPopupRowId(row.id);
    setDescPopupValue({ description: row.description || '', hashtags: row.hashtags || '', keywords: row.keywords || '' });
  };
  const closeDescPopup = () => { setDescPopupRowId(null); setDescPopupValue({ description: '', hashtags: '', keywords: '' }); };
  const saveDescPopup = async () => {
    setSaving(true);
    const next = posts.map(p => (p.id === descPopupRowId ? { ...p, ...descPopupValue } : p));
    const ok = await persist(next);
    setSaving(false);
    if (ok) { toast.success('Saved'); closeDescPopup(); }
  };

  // Created -> Scheduled -> Posted. Scheduled auto-stamps the current user;
  // Posted needs the actual post link, asked for in the popup. Clicking an
  // already-posted pill re-opens the same popup read-only (mode 'view').
  const openStatusPopup = (row) => {
    if (row.status === 'created') {
      setStatusPopup({ rowId: row.id, mode: 'schedule' });
      setStatusPopupLink('');
    } else if (row.status === 'scheduled') {
      setStatusPopup({ rowId: row.id, mode: 'post' });
      setStatusPopupLink(row.post_link || '');
    } else {
      setStatusPopup({ rowId: row.id, mode: 'view' });
      setStatusPopupLink(row.post_link || '');
    }
  };
  const closeStatusPopup = () => { setStatusPopup(null); setStatusPopupLink(''); };
  const confirmStatusTransition = async () => {
    if (statusPopup.mode === 'post' && !statusPopupLink.trim()) { toast.error('Post link is required'); return; }
    setSaving(true);
    const patch = statusPopup.mode === 'schedule'
      ? { status: 'scheduled', scheduled_by_name: currentUser?.name || '' }
      : { status: 'posted', posted_by_name: currentUser?.name || '', post_link: statusPopupLink.trim() };
    const next = posts.map(p => (p.id === statusPopup.rowId ? { ...p, ...patch } : p));
    const ok = await persist(next);
    setSaving(false);
    if (ok) { toast.success(statusPopup.mode === 'schedule' ? 'Scheduled' : 'Marked as Posted'); closeStatusPopup(); }
  };

  // LinkedIn "Publish Now" — first slice of the LinkedIn auto-scheduling
  // plan (no background scheduler yet). Posts as the CURRENT user's own
  // connected LinkedIn account, so we only need to know whether THEY are
  // connected, not every project member.
  const [linkedinConnected, setLinkedinConnected] = useState(null); // null = checking
  const [publishingId, setPublishingId] = useState(null);

  useEffect(() => {
    axios.get(`${API}/api/oauth/linkedin/status`, { headers })
      .then((res) => setLinkedinConnected(!!res.data?.connected))
      .catch(() => setLinkedinConnected(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connectLinkedIn = async () => {
    try {
      const res = await axios.get(`${API}/api/oauth/linkedin/connect`, { headers });
      window.location.href = res.data.authorization_url;
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to start LinkedIn connect');
    }
  };

  const publishToLinkedIn = async (row) => {
    setPublishingId(row.id);
    try {
      const res = await axios.post(
        `${API}/api/projects/${project.project_id}/content-calendar/${row.id}/publish-linkedin`,
        {},
        { headers },
      );
      onProjectUpdated?.(res.data);
      toast.success('Published to LinkedIn');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to publish to LinkedIn');
      try {
        const fresh = await axios.get(`${API}/api/projects/${project.project_id}`, { headers });
        onProjectUpdated?.(fresh.data);
      } catch { /* best-effort refresh only */ }
    } finally {
      setPublishingId(null);
    }
  };

  const persist = async (nextPosts) => {
    if (!canEdit) return false;
    try {
      const res = await axios.patch(
        `${API}/api/projects/${project.project_id}`,
        { content_calendar: nextPosts },
        { headers },
      );
      onProjectUpdated?.(res.data);
      return true;
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to save');
      return false;
    }
  };

  // Creates a real Operations task (Department = Social Media) for one of
  // the 3 assignable fields, returning its task_id so it can be linked back
  // onto the calendar post entry.
  const createFieldTask = async ({ field, assignee, date, postTitle }) => {
    const cfg = FIELD_TASK_CONFIG[field];
    const res = await axios.post(`${API}/api/projects/${project.project_id}/tasks`, {
      task_name: `${cfg.label}: ${postTitle || 'Untitled Post'}`,
      assigned_to: assignee,
      due_date: date,
      department: 'social_media',
      category: cfg.category,
    }, { headers });
    return res.data?.task_id || null;
  };

  // Default new posts to the month currently being viewed, so a post added
  // while browsing a past/future month doesn't vanish from the filtered list.
  const defaultPostDateForActiveMonth = () => (
    isCurrentMonth ? todayIso() : `${activeYear}-${String(activeMonth + 1).padStart(2, '0')}-01`
  );

  const openAddModal = () => {
    setDraftRows([emptyDraftRow(subTab, defaultPostDateForActiveMonth())]);
    setCollapsedIds([]);
    setShowAddModal(true);
  };
  const closeAddModal = () => { setShowAddModal(false); setDraftRows([]); setCollapsedIds([]); };
  // Adding a new post collapses every existing one, so only the post being
  // worked on right now stays expanded.
  const addDraftRow = () => {
    setCollapsedIds(ids => [...new Set([...ids, ...draftRows.map(r => r.id)])]);
    setDraftRows(rows => [...rows, emptyDraftRow(subTab, defaultPostDateForActiveMonth())]);
  };
  const removeDraftRow = (id) => {
    setDraftRows(rows => rows.filter(r => r.id !== id));
    setCollapsedIds(ids => ids.filter(x => x !== id));
  };
  const toggleCollapse = (id) => setCollapsedIds(ids => (ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]));
  const updateDraftRow = (id, patch) => setDraftRows(rows => rows.map(r => (r.id === id ? { ...r, ...patch } : r)));
  const togglePlatform = (id, platformId, checked) => setDraftRows(rows => rows.map(r => {
    if (r.id !== id) return r;
    const next = checked ? [...r.platforms, platformId] : r.platforms.filter(p => p !== platformId);
    return { ...r, platforms: next };
  }));

  const saveDraftRows = async () => {
    for (const row of draftRows) {
      if (!row.post_date) { toast.error('Post Date is required for every row'); return; }
      if (!row.post_title.trim()) { toast.error('Post Title is required for every row'); return; }
      if (!row.platforms || row.platforms.length === 0) { toast.error('Select at least one platform for every row'); return; }
    }
    setSaving(true);
    try {
      const newEntries = [];
      for (const row of draftRows) {
        const taskIds = {};
        for (const field of Object.keys(FIELD_TASK_CONFIG)) {
          const assignee = row[`${field}_assignee`];
          const date = row[`${field}_date`];
          if (assignee && date) {
            taskIds[field] = await createFieldTask({ field, assignee, date, postTitle: row.post_title });
          }
        }
        for (const platform of row.platforms) {
          newEntries.push({
            id: newRowId(),
            platform,
            post_date: row.post_date,
            post_title: row.post_title,
            content_link: row.content_link,
            creative_link: row.creative_link,
            description: row.description,
            post_type: row.post_type,
            status: row.status,
            post_title_assignee: row.post_title_assignee,
            post_title_date: row.post_title_date,
            post_title_task_id: taskIds.post_title || null,
            content_link_assignee: row.content_link_assignee,
            content_link_date: row.content_link_date,
            content_link_task_id: taskIds.content_link || null,
            creative_link_assignee: row.creative_link_assignee,
            creative_link_date: row.creative_link_date,
            creative_link_task_id: taskIds.creative_link || null,
            posting_assignee: row.posting_assignee,
            posting_date: row.posting_date,
            posting_task_id: taskIds.posting || null,
            hashtags: row.hashtags,
            keywords: row.keywords,
            post_title_status: row.post_title_status || 'pending',
            post_title_reject_reason: row.post_title_reject_reason || '',
            content_link_status: row.content_link_status || 'pending',
            content_link_reject_reason: row.content_link_reject_reason || '',
            creative_link_status: row.creative_link_status || 'pending',
            creative_link_reject_reason: row.creative_link_reject_reason || '',
            scheduled_by_name: row.scheduled_by_name || '',
            posted_by_name: row.posted_by_name || '',
            post_link: row.post_link || '',
          });
        }
      }
      const next = [...posts, ...newEntries];
      const ok = await persist(next);
      if (ok) {
        toast.success(`${newEntries.length} post${newEntries.length === 1 ? '' : 's'} added`);
        onTaskCreated?.();
        closeAddModal();
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to create linked tasks');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (row) => { setEditingId(row.id); setEditBuffer({ ...row }); };
  const cancelEdit = () => { setEditingId(null); setEditBuffer(null); };
  const saveEdit = async () => {
    if (!editBuffer.post_title.trim()) { toast.error('Post Title is required'); return; }
    setSaving(true);
    try {
      const updated = { ...editBuffer };
      for (const field of Object.keys(FIELD_TASK_CONFIG)) {
        const assignee = updated[`${field}_assignee`];
        const date = updated[`${field}_date`];
        if (assignee && date && !updated[`${field}_task_id`]) {
          updated[`${field}_task_id`] = await createFieldTask({ field, assignee, date, postTitle: updated.post_title });
        }
      }
      const next = posts.map(p => (p.id === updated.id ? updated : p));
      const ok = await persist(next);
      if (ok) { cancelEdit(); toast.success('Saved'); onTaskCreated?.(); }
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };
  const deleteRow = async (id) => {
    const next = posts.filter(p => p.id !== id);
    const ok = await persist(next);
    if (ok) toast.success('Removed');
  };
  const pillBox = isDark ? 'bg-[#18181b] border-[#27272a]' : 'bg-white border-gray-200';
  const activeCls = isDark ? 'bg-[#27272a] text-white' : 'bg-gray-100 text-gray-900';
  const idleCls = isDark ? 'text-[#a1a1aa] hover:text-white' : 'text-gray-500 hover:text-gray-900';
  const inputCls = `h-8 text-xs ${bgSecondary} border ${borderColor} ${textPrimary}`;

  const AssigneeDateEditor = ({ field, value, onChange }) => (
    <div className="flex flex-col gap-1 mt-1">
      <Select value={value[`${field}_assignee`] || 'none'} onValueChange={(v) => onChange({ [`${field}_assignee`]: v === 'none' ? '' : v })}>
        <SelectTrigger className={`h-7 text-[11px] ${bgSecondary} border ${borderColor} ${textPrimary}`}>
          <SelectValue placeholder="Unassigned" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">— Unassigned —</SelectItem>
          {(users || []).map(u => <SelectItem key={u.user_id} value={u.user_id}>{u.name}</SelectItem>)}
        </SelectContent>
      </Select>
      <Input
        type="date"
        value={value[`${field}_date`] || ''}
        onChange={(e) => onChange({ [`${field}_date`]: e.target.value })}
        className="h-7 text-[11px] px-2"
      />
    </div>
  );

  const AssigneeDateSummary = ({ field, row }) => {
    const name = assigneeName(row[`${field}_assignee`]);
    const date = row[`${field}_date`];
    if (!name && !date) return null;
    return (
      <p className={`text-[11px] ${textSecondary} mt-1`}>
        {name || 'Unassigned'}{date ? ` · ${date}` : ''}
      </p>
    );
  };

  return (
    <div className="space-y-3" data-testid="project-content-calendar-tab">
      <div>
        <h3 className={`text-lg font-semibold ${textPrimary} flex items-center gap-2`}>
          <CalendarDays className="h-5 w-5 text-[#6366f1]" /> Content Calendar
        </h3>
        <p className={`text-xs ${textSecondary}`}>Plan and track social posts for this project.</p>
      </div>

      {/* Sticky on scroll — month nav, platform sub-tabs, summary cards and
          the Add Post action row all stay pinned while only the day rows
          below scroll. Needs its own opaque background (matching the page,
          not the card) so scrolled-under rows don't show through. */}
      <div className={`sticky top-0 z-20 space-y-3 pb-3 ${isDark ? 'bg-[#09090b]' : 'bg-gray-50'}`}>
      {/* Month navigator */}
      <div className={`${bgCard} border ${borderColor} rounded-2xl p-4`}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={goPrevMonth} data-testid="content-calendar-month-prev">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-center min-w-[160px]">
              <p className={`text-2xl font-bold ${textPrimary}`}>{MONTH_NAMES[activeMonth]} {activeYear}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={goNextMonth} data-testid="content-calendar-month-next">
              <ChevronRight className="h-4 w-4" />
            </Button>
            {isCurrentMonth && (
              <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30 ml-2">
                <Calendar className="h-3 w-3 mr-1" /> This Month
              </Badge>
            )}
          </div>
          <select
            className={`text-sm rounded-lg border ${borderColor} ${bgSecondary} ${textPrimary} px-3 py-2`}
            value={activeYear}
            onChange={(e) => setActiveYear(Number(e.target.value))}
            data-testid="content-calendar-year-select"
          >
            {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Platform sub-tabs */}
      <div className={`inline-flex flex-wrap items-center gap-1 p-1 rounded-lg border ${pillBox}`}>
        {PLATFORMS.map(p => (
          <button
            key={p.id}
            type="button"
            onClick={() => { setSubTab(p.id); cancelEdit(); }}
            data-testid={`content-calendar-subtab-${p.id}`}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${subTab === p.id ? activeCls : idleCls}`}
          >
            {p.label} ({platformCounts[p.id] || 0})
          </button>
        ))}
      </div>

      {/* Summary cards — reflect whatever's currently filtered (platform + month) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: summaryTotal, color: 'text-[#71717a]', accent: 'bg-[#71717a]/15' },
          { label: 'Created', value: summaryCreated, color: 'text-slate-400', accent: 'bg-slate-500/15' },
          { label: 'Scheduled', value: summaryScheduled, color: 'text-amber-500', accent: 'bg-amber-500/15' },
          { label: 'Posted', value: summaryPosted, color: 'text-emerald-500', accent: 'bg-emerald-500/15' },
        ].map(c => (
          <div key={c.label} className={`rounded-lg border ${borderColor} ${bgSecondary} p-3`} data-testid={`content-calendar-summary-${c.label.toLowerCase()}`}>
            <p className={`text-xs ${textSecondary}`}>{c.label}</p>
            <p className={`text-xl font-bold ${c.color}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Action row */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className={`text-xs ${textSecondary}`}>
          {list.length === 0 ? 'No posts yet.' : `${list.length} post${list.length === 1 ? '' : 's'}`}
        </p>
        <div className="flex items-center gap-2">
          {linkedinConnected === false && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={connectLinkedIn}
              className="text-xs"
              data-testid="content-calendar-connect-linkedin"
            >
              <Linkedin className="h-3.5 w-3.5 mr-1 text-[#0a66c2]" /> Connect LinkedIn
            </Button>
          )}
          {linkedinConnected === true && (
            <span className={`text-[11px] ${textSecondary} flex items-center gap-1`} data-testid="content-calendar-linkedin-connected">
              <Linkedin className="h-3.5 w-3.5 text-[#0a66c2]" /> LinkedIn connected
            </span>
          )}
          {canEdit && (
            <Button
              type="button"
              onClick={openAddModal}
              size="sm"
              className="bg-[#6366f1] hover:bg-[#5558dd] text-white"
              data-testid="content-calendar-add-post-btn"
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Post
            </Button>
          )}
        </div>
      </div>
      </div>

      {/* Table */}
      <Card className={`${bgCard} border ${borderColor}`}>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className={`border-b ${borderColor}`}>
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase w-10`}>#</th>
                  {subTab === 'all' && <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase`}>Platform</th>}
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase`}>Post Date</th>
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase`}>Day</th>
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase min-w-[160px]`}>Post Title</th>
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase min-w-[160px]`}>Content Link</th>
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase min-w-[160px]`}>Creative Link</th>
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase min-w-[220px]`}>Description &amp; Hashtags</th>
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase`}>Post Type</th>
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase`}>Status</th>
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase min-w-[140px]`}>Posting</th>
                  <th className={`text-right p-3 text-[11px] font-medium ${textSecondary} uppercase w-20`}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const renderReviewCell = (row, field) => {
                    const cfg = REVIEW_FIELDS[field];
                    const value = row[field];
                    const status = row[`${field}_status`] || 'pending';
                    return (
                      <button
                        type="button"
                        onClick={() => canEdit && openFieldPopup(row, field)}
                        disabled={!canEdit}
                        className="text-left w-full group"
                        data-testid={`content-calendar-open-${field}-${row.id}`}
                      >
                        {value ? (
                          cfg.kind === 'url' ? (
                            <span className="text-xs text-[#6366f1] group-hover:underline break-all">Open</span>
                          ) : (
                            <span className={`text-sm ${textPrimary}`}>{value}</span>
                          )
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-[#6366f1]">
                            <Plus className="h-3.5 w-3.5" /> Add {cfg.label}
                          </span>
                        )}
                        {value && (
                          <span className={`block text-[10px] mt-0.5 font-medium ${REVIEW_STATUS_STYLE[status]}`}>
                            {status === 'approved' ? 'Approved' : status === 'rejected' ? 'Rejected' : 'Pending review'}
                          </span>
                        )}
                      </button>
                    );
                  };

                  const renderPostRow = (row, idx) => {
                  const isEditing = editingId === row.id;
                  const buf = isEditing ? editBuffer : row;
                  const patchBuf = (p) => setEditBuffer(b => ({ ...b, ...p }));
                  return (
                    <tr key={row.id} className={`border-b ${borderColor}`} data-testid={`content-calendar-row-${row.id}`}>
                      <td className={`p-3 text-xs ${textSecondary}`}>{idx + 1}</td>
                      {subTab === 'all' && (
                        <td className={`p-3 text-sm ${textPrimary} capitalize`}>
                          {PLATFORMS.find(p => p.id === row.platform)?.label || row.platform}
                        </td>
                      )}
                      <td className="p-3">
                        {isEditing ? (
                          <Input
                            type="date"
                            value={editBuffer.post_date}
                            onChange={(e) => setEditBuffer(b => ({ ...b, post_date: e.target.value }))}
                            className={inputCls}
                          />
                        ) : (
                          <span className={`text-sm ${textPrimary}`}>{row.post_date || '—'}</span>
                        )}
                      </td>
                      <td className={`p-3 text-sm ${textSecondary}`}>{dayOfWeek(isEditing ? editBuffer.post_date : row.post_date)}</td>
                      <td className="p-3">
                        {renderReviewCell(row, 'post_title')}
                        {isEditing ? (
                          <AssigneeDateEditor field="post_title" value={buf} onChange={patchBuf} />
                        ) : (
                          <AssigneeDateSummary field="post_title" row={row} />
                        )}
                      </td>
                      <td className="p-3">
                        {renderReviewCell(row, 'content_link')}
                        {isEditing ? (
                          <AssigneeDateEditor field="content_link" value={buf} onChange={patchBuf} />
                        ) : (
                          <AssigneeDateSummary field="content_link" row={row} />
                        )}
                      </td>
                      <td className="p-3">
                        {renderReviewCell(row, 'creative_link')}
                        {isEditing ? (
                          <AssigneeDateEditor field="creative_link" value={buf} onChange={patchBuf} />
                        ) : (
                          <AssigneeDateSummary field="creative_link" row={row} />
                        )}
                      </td>
                      <td className="p-3 max-w-[280px]">
                        <button
                          type="button"
                          onClick={() => canEdit && openDescPopup(row)}
                          disabled={!canEdit}
                          className="text-left w-full"
                          data-testid={`content-calendar-open-description-${row.id}`}
                        >
                          {row.description || row.hashtags || row.keywords ? (
                            <>
                              <p className={`text-xs ${textSecondary} line-clamp-2 whitespace-pre-wrap`}>{row.description || '—'}</p>
                              {row.hashtags && <p className="text-[10px] text-[#6366f1] line-clamp-1">{row.hashtags}</p>}
                            </>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-[#6366f1]">
                              <Plus className="h-3.5 w-3.5" /> Add
                            </span>
                          )}
                        </button>
                      </td>
                      <td className="p-3">
                        <Select
                          value={row.post_type}
                          onValueChange={async (v) => {
                            if (!canEdit) return;
                            const next = posts.map(p => (p.id === row.id ? { ...p, post_type: v } : p));
                            await persist(next);
                          }}
                          disabled={!canEdit}
                        >
                          <SelectTrigger className={`h-8 text-xs ${bgSecondary} border ${borderColor} ${textPrimary}`} data-testid={`content-calendar-post-type-${row.id}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {POST_TYPES.map(t => <SelectItem key={t} value={t}>{POST_TYPE_LABEL[t]}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-3">
                        <button
                          type="button"
                          onClick={() => canEdit && openStatusPopup(row)}
                          disabled={!canEdit}
                          title={canEdit ? 'Click to advance / view status' : 'Read only'}
                          className={`px-2 py-1 rounded-md text-xs font-medium border ${STATUS_STYLE[row.status] || STATUS_STYLE.created} ${canEdit ? 'cursor-pointer hover:opacity-80' : 'cursor-not-allowed opacity-80'}`}
                          data-testid={`content-calendar-status-${row.id}`}
                        >
                          {STATUS_LABEL[row.status] || 'Created'}
                        </button>
                      </td>
                      <td className="p-3">
                        {isEditing ? (
                          <AssigneeDateEditor field="posting" value={buf} onChange={patchBuf} />
                        ) : row.posting_assignee || row.posting_date ? (
                          <p className={`text-xs ${textPrimary}`}>
                            {assigneeName(row.posting_assignee) || 'Unassigned'}{row.posting_date ? ` · ${row.posting_date}` : ''}
                          </p>
                        ) : (
                          <span className={`text-xs ${textSecondary}`}>—</span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        {isEditing ? (
                          <div className="inline-flex gap-1">
                            <button type="button" onClick={saveEdit} disabled={saving} className="p-1 text-emerald-500 hover:text-emerald-400" title="Save" data-testid={`content-calendar-save-edit-${row.id}`}>
                              <Save className="h-4 w-4" />
                            </button>
                            <button type="button" onClick={cancelEdit} className={`p-1 ${textSecondary} hover:opacity-80`} title="Cancel">
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ) : canEdit && (
                          <div className="inline-flex items-center gap-1">
                            {row.platform === 'linkedin' && (
                              <>
                                {row.publish_status === 'published' ? (
                                  <Badge className="bg-emerald-500/20 text-emerald-500 text-[10px]" title={row.linkedin_post_urn || ''} data-testid={`content-calendar-linkedin-status-${row.id}`}>
                                    Published
                                  </Badge>
                                ) : row.publish_status === 'failed' ? (
                                  <Badge className="bg-red-500/20 text-red-500 text-[10px]" title={row.publish_error || ''} data-testid={`content-calendar-linkedin-status-${row.id}`}>
                                    Failed
                                  </Badge>
                                ) : null}
                                <button
                                  type="button"
                                  onClick={() => publishToLinkedIn(row)}
                                  disabled={publishingId === row.id || linkedinConnected !== true}
                                  className={`p-1 ${linkedinConnected === true ? 'text-[#0a66c2] hover:opacity-80' : 'text-gray-400 cursor-not-allowed'}`}
                                  title={linkedinConnected === true ? 'Publish now to LinkedIn' : 'Connect LinkedIn first'}
                                  data-testid={`content-calendar-publish-linkedin-${row.id}`}
                                >
                                  <Send className="h-4 w-4" />
                                </button>
                              </>
                            )}
                            <button type="button" onClick={() => startEdit(row)} className={`p-1 ${textSecondary} hover:opacity-80`} title="Edit" data-testid={`content-calendar-edit-${row.id}`}>
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button type="button" onClick={() => deleteRow(row.id)} className="p-1 text-red-500 hover:text-red-400" title="Delete" data-testid={`content-calendar-delete-${row.id}`}>
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                  };

                  // One row per calendar day of the viewed month — days with
                  // a post render it (one row per post, existing behavior
                  // unchanged); empty days get a compact row with their own
                  // date-scoped "Add Post". A running counter numbers every
                  // row (post or empty) so "#" stays sequential.
                  const rows = [];
                  let rowNum = 0;
                  for (let day = 1; day <= daysInMonth; day++) {
                    const iso = dayIso(day);
                    const dayPosts = list.filter(p => p.post_date === iso);
                    if (dayPosts.length === 0) {
                      rowNum += 1;
                      rows.push(
                        <tr key={`empty-${iso}`} className={`border-b ${borderColor}`} data-testid={`content-calendar-empty-day-${iso}`}>
                          <td className={`p-3 text-xs ${textSecondary}`}>{rowNum}</td>
                          {subTab === 'all' && <td className="p-3" />}
                          <td className="p-3"><span className={`text-sm ${textPrimary}`}>{formatDayLabel(day)}</span></td>
                          <td className={`p-3 text-sm ${textSecondary}`}>{dayOfWeek(iso)}</td>
                          <td colSpan={8} className="p-3">
                            {canEdit ? (
                              <button
                                type="button"
                                onClick={() => openFieldPopup(null, 'post_title', true, iso)}
                                className="inline-flex items-center gap-1 text-xs text-[#6366f1] hover:underline"
                                data-testid={`content-calendar-add-for-day-${iso}`}
                              >
                                <Plus className="h-3.5 w-3.5" /> Add Post
                              </button>
                            ) : (
                              <span className={`text-xs ${textSecondary}`}>No post</span>
                            )}
                          </td>
                        </tr>
                      );
                    } else {
                      dayPosts.forEach((row) => {
                        rowNum += 1;
                        rows.push(renderPostRow(row, rowNum - 1));
                      });
                    }
                  }
                  return rows;
                })()}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Add Post modal — one card per post, each can fan out to multiple
          platforms and independently assign Post Title / Content Link /
          Creative Link to different people with their own due dates.
          z-40, not z-[70]: the Assignee/Post Type/Status <Select> dropdowns
          portal to document.body at z-50 (ui/select.jsx) — z-[70] here would
          render this modal's backdrop ON TOP of those open dropdown lists. */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-40 p-4" onClick={closeAddModal}>
          <div
            className={`${bgCard} border ${borderColor} rounded-xl w-full max-w-3xl max-h-[85vh] flex flex-col`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`flex items-center justify-between p-4 border-b ${borderColor}`}>
              <h3 className={`text-lg font-semibold ${textPrimary}`}>Add Post{draftRows.length > 1 ? 's' : ''}</h3>
              <button onClick={closeAddModal} className={textSecondary}><X className="h-5 w-5" /></button>
            </div>
            <div className="overflow-auto p-4 flex-1 space-y-4">
              {draftRows.map((row, idx) => {
                const isCollapsed = collapsedIds.includes(row.id);
                const platformLabels = row.platforms.map(pid => PLATFORMS.find(p => p.id === pid)?.label || pid).join(', ');
                return (
                <div key={row.id} className={`border ${borderColor} rounded-lg p-4 space-y-3`} data-testid={`content-calendar-draft-row-${idx}`}>
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => toggleCollapse(row.id)}
                      className={`flex items-center gap-2 text-xs font-semibold uppercase tracking-wide ${textSecondary} hover:opacity-80`}
                      data-testid={`content-calendar-draft-toggle-${idx}`}
                    >
                      {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      Post {idx + 1}
                      {isCollapsed && (
                        <span className={`normal-case font-normal ${textPrimary}`}>
                          {' · '}{platformLabels || 'No platform'}{row.post_title ? ` · ${row.post_title}` : ''}
                        </span>
                      )}
                    </button>
                    {draftRows.length > 1 && (
                      <button type="button" onClick={() => removeDraftRow(row.id)} className="p-1 text-red-500 hover:text-red-400" title="Remove post">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  {!isCollapsed && (
                  <>
                  <div>
                    <Label className={textPrimary}>Platforms <span className="text-red-500">*</span></Label>
                    <div className="flex flex-wrap gap-3 mt-1">
                      {PLATFORMS.filter(p => p.id !== 'all').map(p => (
                        <label key={p.id} className={`flex items-center gap-1.5 text-sm ${textPrimary} cursor-pointer`}>
                          <input
                            type="checkbox"
                            checked={row.platforms.includes(p.id)}
                            onChange={(e) => togglePlatform(row.id, p.id, e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-[#6366f1] focus:ring-[#6366f1]"
                            data-testid={`content-calendar-draft-platform-${p.id}-${idx}`}
                          />
                          {p.label}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className={textPrimary}>Post Date</Label>
                      <Input
                        type="date"
                        value={row.post_date}
                        onChange={(e) => updateDraftRow(row.id, { post_date: e.target.value })}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <Label className={textPrimary}>Day</Label>
                      <p className={`h-8 flex items-center text-sm ${textSecondary}`}>{dayOfWeek(row.post_date)}</p>
                    </div>
                  </div>

                  {Object.entries(FIELD_TASK_CONFIG).map(([field, cfg]) => (
                    <div key={field} className="grid grid-cols-3 gap-3">
                      <div>
                        <Label className={textPrimary}>{cfg.label}</Label>
                        {!FIELD_HAS_VALUE[field] ? (
                          <p className={`h-8 flex items-center text-xs ${textSecondary}`}>Publish the post</p>
                        ) : field === 'post_title' ? (
                          <Input
                            value={row.post_title}
                            onChange={(e) => updateDraftRow(row.id, { post_title: e.target.value })}
                            placeholder="Post title"
                            className={inputCls}
                            data-testid={`content-calendar-draft-title-${idx}`}
                          />
                        ) : (
                          <Input
                            value={row[field]}
                            onChange={(e) => updateDraftRow(row.id, { [field]: e.target.value })}
                            placeholder="https://..."
                            className={inputCls}
                          />
                        )}
                      </div>
                      <div>
                        <Label className={textSecondary}>Assignee</Label>
                        <Select
                          value={row[`${field}_assignee`] || 'none'}
                          onValueChange={(v) => updateDraftRow(row.id, { [`${field}_assignee`]: v === 'none' ? '' : v })}
                        >
                          <SelectTrigger className={inputCls}>
                            <SelectValue placeholder="Unassigned" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">— Unassigned —</SelectItem>
                            {(users || []).map(u => <SelectItem key={u.user_id} value={u.user_id}>{u.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className={textSecondary}>Date</Label>
                        <Input
                          type="date"
                          value={row[`${field}_date`] || ''}
                          onChange={(e) => updateDraftRow(row.id, { [`${field}_date`]: e.target.value })}
                          className={inputCls}
                        />
                      </div>
                    </div>
                  ))}

                  <div>
                    <Label className={textPrimary}>Description &amp; Hashtags</Label>
                    <Textarea
                      value={row.description}
                      onChange={(e) => updateDraftRow(row.id, { description: e.target.value })}
                      placeholder="Description and hashtags"
                      className={`text-xs ${bgSecondary} border ${borderColor} ${textPrimary} min-h-[60px]`}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className={textPrimary}>Post Type</Label>
                      <Select value={row.post_type} onValueChange={(v) => updateDraftRow(row.id, { post_type: v })}>
                        <SelectTrigger className={inputCls}><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {POST_TYPES.map(t => <SelectItem key={t} value={t}>{POST_TYPE_LABEL[t]}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className={textPrimary}>Status</Label>
                      <Select value={row.status} onValueChange={(v) => updateDraftRow(row.id, { status: v })}>
                        <SelectTrigger className={inputCls}><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {STATUS_FLOW.map(s => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  </>
                  )}
                </div>
                );
              })}
              <Button type="button" variant="outline" size="sm" onClick={addDraftRow} data-testid="content-calendar-add-draft-row">
                <Plus className="h-3.5 w-3.5 mr-1" /> Add Row
              </Button>
            </div>
            <div className={`flex items-center justify-end gap-2 p-4 border-t ${borderColor}`}>
              <Button type="button" variant="outline" onClick={closeAddModal} disabled={saving}>Cancel</Button>
              <Button type="button" onClick={saveDraftRows} disabled={saving} className="bg-[#6366f1] hover:bg-[#5558dd] text-white" data-testid="content-calendar-save-posts">
                {saving ? 'Saving…' : `Save ${draftRows.length > 1 ? `${draftRows.length} Posts` : 'Post'}`}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Post Title / Content Link / Creative Link popup — value entry plus,
          once the field belongs to a real row, its own Approve/Reject. */}
      {fieldPopup && (() => {
        const cfg = REVIEW_FIELDS[fieldPopup.field];
        const popupRow = !fieldPopup.isNewRow ? posts.find(p => p.id === fieldPopup.rowId) : null;
        const popupStatus = popupRow?.[`${fieldPopup.field}_status`] || 'pending';
        const showReject = fieldPopupShowReject || popupStatus === 'rejected';
        return (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={closeFieldPopup}>
            <div className={`${bgCard} border ${borderColor} rounded-xl w-full max-w-md`} onClick={(e) => e.stopPropagation()}>
              <div className={`flex items-center justify-between p-4 border-b ${borderColor}`}>
                <h3 className={`text-base font-semibold ${textPrimary}`}>{cfg.label}</h3>
                <button onClick={closeFieldPopup} className={textSecondary}><X className="h-5 w-5" /></button>
              </div>
              <div className="p-4 space-y-3">
                <div>
                  <Label className={textPrimary}>{cfg.label}</Label>
                  <Input
                    value={fieldPopupValue}
                    onChange={(e) => setFieldPopupValue(e.target.value)}
                    placeholder={cfg.placeholder}
                    className={inputCls}
                    data-testid="content-calendar-field-popup-input"
                    autoFocus
                  />
                </div>
                {!fieldPopup.isNewRow && (
                  <div>
                    <p className={`text-xs ${textSecondary} mb-1`}>
                      Review — <span className={REVIEW_STATUS_STYLE[popupStatus]}>{popupStatus === 'approved' ? 'Approved' : popupStatus === 'rejected' ? 'Rejected' : 'Pending'}</span>
                    </p>
                    <div className="flex items-center gap-2">
                      <Button type="button" size="sm" onClick={() => setFieldReview('approved')} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white" data-testid="content-calendar-field-approve">
                        <Check className="h-3.5 w-3.5 mr-1" /> Approve
                      </Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => setFieldPopupShowReject(v => !v)} className="text-red-500 border-red-500/40 hover:bg-red-500/10" data-testid="content-calendar-field-reject">
                        <Ban className="h-3.5 w-3.5 mr-1" /> Reject
                      </Button>
                    </div>
                    {showReject && (
                      <div className="mt-2">
                        <Label className={textPrimary}>Reject Reason</Label>
                        <Textarea
                          value={fieldPopupRejectReason}
                          onChange={(e) => setFieldPopupRejectReason(e.target.value)}
                          placeholder="Why is this rejected?"
                          className={`text-xs ${bgSecondary} border ${borderColor} ${textPrimary} min-h-[60px]`}
                          data-testid="content-calendar-field-reject-reason"
                        />
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => {
                            if (!fieldPopupRejectReason.trim()) { toast.error('Reason is required'); return; }
                            setFieldReview('rejected', fieldPopupRejectReason.trim());
                          }}
                          disabled={saving}
                          className="mt-2 bg-red-600 hover:bg-red-700 text-white"
                          data-testid="content-calendar-field-reject-confirm"
                        >
                          Confirm Reject
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className={`flex items-center justify-end gap-2 p-4 border-t ${borderColor}`}>
                <Button type="button" variant="outline" onClick={closeFieldPopup} disabled={saving}>Cancel</Button>
                <Button type="button" onClick={saveFieldPopupValue} disabled={saving} className="bg-[#6366f1] hover:bg-[#5558dd] text-white" data-testid="content-calendar-field-popup-save">
                  {saving ? 'Saving…' : fieldPopup.isNewRow ? 'Add Post' : 'Save'}
                </Button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Description / Hashtags / Keywords popup */}
      {descPopupRowId && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={closeDescPopup}>
          <div className={`${bgCard} border ${borderColor} rounded-xl w-full max-w-lg`} onClick={(e) => e.stopPropagation()}>
            <div className={`flex items-center justify-between p-4 border-b ${borderColor}`}>
              <h3 className={`text-base font-semibold ${textPrimary} flex items-center gap-2`}><Hash className="h-4 w-4" /> Description &amp; Hashtags</h3>
              <button onClick={closeDescPopup} className={textSecondary}><X className="h-5 w-5" /></button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <Label className={textPrimary}>Description</Label>
                <Textarea
                  value={descPopupValue.description}
                  onChange={(e) => setDescPopupValue(v => ({ ...v, description: e.target.value }))}
                  className={`text-xs ${bgSecondary} border ${borderColor} ${textPrimary} min-h-[80px]`}
                  data-testid="content-calendar-desc-input"
                />
              </div>
              <div>
                <Label className={textPrimary}>Hashtags</Label>
                <Input
                  value={descPopupValue.hashtags}
                  onChange={(e) => setDescPopupValue(v => ({ ...v, hashtags: e.target.value }))}
                  placeholder="#drawlead #marketing"
                  className={inputCls}
                  data-testid="content-calendar-hashtags-input"
                />
              </div>
              <div>
                <Label className={textPrimary}>Keywords</Label>
                <Input
                  value={descPopupValue.keywords}
                  onChange={(e) => setDescPopupValue(v => ({ ...v, keywords: e.target.value }))}
                  placeholder="keyword1, keyword2"
                  className={inputCls}
                  data-testid="content-calendar-keywords-input"
                />
              </div>
            </div>
            <div className={`flex items-center justify-end gap-2 p-4 border-t ${borderColor}`}>
              <Button type="button" variant="outline" onClick={closeDescPopup} disabled={saving}>Cancel</Button>
              <Button type="button" onClick={saveDescPopup} disabled={saving} className="bg-[#6366f1] hover:bg-[#5558dd] text-white" data-testid="content-calendar-desc-save">
                {saving ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Status popup — Schedule (auto-stamps who) / Posted (needs the live
          link) / a read-only view of both once posted. */}
      {statusPopup && (() => {
        const row = posts.find(p => p.id === statusPopup.rowId);
        return (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={closeStatusPopup}>
            <div className={`${bgCard} border ${borderColor} rounded-xl w-full max-w-sm`} onClick={(e) => e.stopPropagation()}>
              <div className={`flex items-center justify-between p-4 border-b ${borderColor}`}>
                <h3 className={`text-base font-semibold ${textPrimary} flex items-center gap-2`}>
                  {statusPopup.mode === 'view' && <Eye className="h-4 w-4" />}
                  {statusPopup.mode === 'schedule' ? 'Schedule Post' : statusPopup.mode === 'post' ? 'Mark as Posted' : 'Post Status'}
                </h3>
                <button onClick={closeStatusPopup} className={textSecondary}><X className="h-5 w-5" /></button>
              </div>
              <div className="p-4 space-y-3">
                {statusPopup.mode === 'schedule' && (
                  <p className={`text-sm ${textSecondary}`}>
                    Scheduling this post as <b className={textPrimary}>{currentUser?.name || 'you'}</b>.
                  </p>
                )}
                {statusPopup.mode === 'post' && (
                  <div>
                    <Label className={textPrimary}>Post Link <span className="text-red-500">*</span></Label>
                    <Input
                      value={statusPopupLink}
                      onChange={(e) => setStatusPopupLink(e.target.value)}
                      placeholder="https://linkedin.com/..."
                      className={inputCls}
                      data-testid="content-calendar-post-link-input"
                    />
                    <p className={`text-xs ${textSecondary} mt-1`}>Posted by <b className={textPrimary}>{currentUser?.name || 'you'}</b></p>
                  </div>
                )}
                {statusPopup.mode === 'view' && (
                  <>
                    <p className={`text-sm ${textSecondary}`}>Scheduled by <b className={textPrimary}>{row?.scheduled_by_name || '—'}</b></p>
                    <p className={`text-sm ${textSecondary}`}>Posted by <b className={textPrimary}>{row?.posted_by_name || '—'}</b></p>
                    {row?.post_link ? (
                      <a href={row.post_link} target="_blank" rel="noreferrer" className="text-sm text-[#6366f1] hover:underline break-all block">{row.post_link}</a>
                    ) : (
                      <p className={`text-sm ${textSecondary}`}>No post link yet</p>
                    )}
                  </>
                )}
              </div>
              <div className={`flex items-center justify-end gap-2 p-4 border-t ${borderColor}`}>
                <Button type="button" variant="outline" onClick={closeStatusPopup}>{statusPopup.mode === 'view' ? 'Close' : 'Cancel'}</Button>
                {statusPopup.mode !== 'view' && (
                  <Button type="button" onClick={confirmStatusTransition} disabled={saving} className="bg-[#6366f1] hover:bg-[#5558dd] text-white" data-testid="content-calendar-status-confirm">
                    {saving ? 'Saving…' : statusPopup.mode === 'schedule' ? 'Confirm Schedule' : 'Confirm Posted'}
                  </Button>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
