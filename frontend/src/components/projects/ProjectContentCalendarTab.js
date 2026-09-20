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
import { Plus, Trash2, Save, X, Pencil, CalendarDays, ChevronLeft, ChevronRight, ChevronDown, Calendar, Linkedin, Send, Check, Ban, Eye, Hash, User, UserPlus, ExternalLink } from 'lucide-react';
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
  editing_link: { label: 'Editing', kind: 'url', placeholder: 'https://...' },
  thumbnail_link: { label: 'Thumbnail', kind: 'url', placeholder: 'https://...' },
};
// The four deliverable columns: each can be filled with a link directly, or
// assigned to someone (a linked task they complete by submitting the link).
const LINK_FIELDS = ['content_link', 'creative_link', 'editing_link', 'thumbnail_link'];
// Posting is assignable too (the person schedules/posts it), so its task
// links back to the entry the same way.
const LINKED_TASK_FIELDS = [...LINK_FIELDS, 'posting'];
const REVIEW_STATUS_STYLE = {
  pending: 'text-slate-400',
  approved: 'text-emerald-500',
  rejected: 'text-red-500',
};

const STATUS_FLOW = ['created', 'scheduled', 'posted'];
const STATUS_LABEL = { created: 'Created', scheduled: 'Scheduled', posted: 'Published' };
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
  editing_link: { label: 'Editing', category: 'Editing' },
  thumbnail_link: { label: 'Thumbnail', category: 'Thumbnail' },
  posting: { label: 'Posting', category: 'Posting' },
};
// Fields with a text/url value alongside their assignee+date (all of
// FIELD_TASK_CONFIG except `posting`, which is assignee+date only).
const FIELD_HAS_VALUE = { post_title: true, content_link: true, creative_link: true, editing_link: true, thumbnail_link: true, posting: false };

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
  editing_link: '',
  editing_link_assignee: '',
  editing_link_date: '',
  editing_link_status: 'pending',
  editing_link_reject_reason: '',
  thumbnail_link: '',
  thumbnail_link_assignee: '',
  thumbnail_link_date: '',
  thumbnail_link_status: 'pending',
  thumbnail_link_reject_reason: '',
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

  const [subTab, setSubTab] = useState('instagram');
  // Rows saved from the quick popup before it set a singular `platform` only
  // carried the bulk modal's `platforms` array — recover the platform from it
  // so they still land under the right tab.
  const posts = (project?.content_calendar || []).map(p => (
    p.platform || !p.platforms?.length ? p : { ...p, platform: p.platforms[0] }
  ));

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
  // Only asked when creating a new row from the "All" tab, where there's no
  // single active platform to default to (every existing row/entry carries
  // one singular `platform`, not the multi-select `platforms` the bulk Add
  // Post modal uses before exploding it into one entry per platform).
  const [fieldPopupPlatform, setFieldPopupPlatform] = useState('');
  // Post Type picked on an empty day BEFORE any field is added — held here
  // (no empty row is saved) and applied when that day's post gets created.
  const [pendingPostTypes, setPendingPostTypes] = useState({});
  const takePendingPostType = (dateIso) => {
    const t = pendingPostTypes[dateIso];
    if (t) setPendingPostTypes(prev => { const n = { ...prev }; delete n[dateIso]; return n; });
    return t || 'static';
  };

  // Description / Hashtags / Keywords popup.
  const [descPopupRowId, setDescPopupRowId] = useState(null);
  const [descPopupNewDate, setDescPopupNewDate] = useState(null); // set when creating a new row from an empty day
  const [descPopupValue, setDescPopupValue] = useState({ description: '', hashtags: '', keywords: '' });

  // Status transition popup — Schedule auto-stamps who; Posted also needs
  // the live post link. Also doubles as a read-only "view" for an
  // already-posted row (who posted it, and the link).
  const [statusPopup, setStatusPopup] = useState(null); // { rowId, mode: 'choose' | 'view' }
  const [detailsRowId, setDetailsRowId] = useState(null); // View popup: post link + report
  const [statusChoice, setStatusChoice] = useState(''); // 'scheduled' | 'posted'
  const [statusPopupLink, setStatusPopupLink] = useState('');
  const [statusPopupDate, setStatusPopupDate] = useState('');
  const [statusPopupTime, setStatusPopupTime] = useState('');

  const assigneeName = (userId) => (users || []).find(u => u.user_id === userId)?.name || '';

  const openFieldPopup = (row, field, isNewRow = false, dateIso = null) => {
    setFieldPopup({ rowId: row?.id || null, field, isNewRow, dateIso });
    setFieldPopupValue(row ? (row[field] || '') : '');
    setFieldPopupRejectReason(row ? (row[`${field}_reject_reason`] || '') : '');
    setFieldPopupShowReject(false);
    setFieldPopupPlatform(subTab !== 'all' ? subTab : '');
  };
  const closeFieldPopup = () => {
    setFieldPopup(null);
    setFieldPopupValue('');
    setFieldPopupRejectReason('');
    setFieldPopupShowReject(false);
    setFieldPopupPlatform('');
  };

  // Just saves the text/link value, leaving review status untouched — for
  // the initial "create a row from this field" flow, and for editing the
  // value of an already-reviewed field without re-triggering approve/reject.
  const saveFieldPopupValue = async () => {
    if (fieldPopup.isNewRow) {
      if (!fieldPopupValue.trim()) { toast.error(`${REVIEW_FIELDS[fieldPopup.field].label} is required`); return; }
      if (!fieldPopupPlatform) { toast.error('Please select a platform'); return; }
      const newRow = {
        ...emptyDraftRow(subTab, fieldPopup.dateIso),
        platform: fieldPopupPlatform,
        post_type: takePendingPostType(fieldPopup.dateIso),
        [fieldPopup.field]: fieldPopupValue.trim(),
      };
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

  const openDescPopup = (row, newDateIso = null) => {
    setDescPopupRowId(row ? row.id : null);
    setDescPopupNewDate(row ? null : newDateIso);
    setDescPopupValue({ description: row?.description || '', hashtags: row?.hashtags || '', keywords: row?.keywords || '' });
    setFieldPopupPlatform(subTab !== 'all' ? subTab : '');
  };
  const closeDescPopup = () => {
    setDescPopupRowId(null);
    setDescPopupNewDate(null);
    setDescPopupValue({ description: '', hashtags: '', keywords: '' });
    setFieldPopupPlatform('');
  };
  const saveDescPopup = async () => {
    if (descPopupNewDate) {
      if (!descPopupValue.description.trim() && !descPopupValue.hashtags.trim() && !descPopupValue.keywords.trim()) {
        toast.error('Add a description, hashtags or keywords'); return;
      }
      if (!fieldPopupPlatform) { toast.error('Please select a platform'); return; }
      setSaving(true);
      const ok = await persist([...posts, { ...emptyDraftRow(subTab, descPopupNewDate), platform: fieldPopupPlatform, post_type: takePendingPostType(descPopupNewDate), ...descPopupValue }]);
      setSaving(false);
      if (ok) { toast.success('Post added'); closeDescPopup(); }
      return;
    }
    setSaving(true);
    const next = posts.map(p => (p.id === descPopupRowId ? { ...p, ...descPopupValue } : p));
    const ok = await persist(next);
    setSaving(false);
    if (ok) { toast.success('Saved'); closeDescPopup(); }
  };

  // A post is either Scheduled (auto-stamps the current user) or Published
  // (asks for the live post link). Clicking an already-published pill
  // re-opens the popup read-only (mode 'view').
  const openStatusPopup = (row) => {
    if (row.status === 'posted') {
      setDetailsRowId(row.id);
      return;
    }
    setStatusPopup({ rowId: row.id, mode: 'choose' });
    setStatusChoice(row.status === 'scheduled' ? 'scheduled' : '');
    setStatusPopupLink(row.post_link || '');
    setStatusPopupDate(row.scheduled_date || row.post_date || '');
    setStatusPopupTime(row.scheduled_time || '');
  };
  const closeStatusPopup = () => { setStatusPopup(null); setStatusChoice(''); setStatusPopupLink(''); setStatusPopupDate(''); setStatusPopupTime(''); };
  const confirmStatusTransition = async () => {
    if (!statusChoice) { toast.error('Choose Schedule or Published'); return; }
    if (statusChoice === 'scheduled' && !statusPopupDate) { toast.error('Pick the date it is scheduled for'); return; }
    if (statusChoice === 'posted' && !statusPopupLink.trim()) { toast.error('Post link is required'); return; }
    setSaving(true);
    const patch = statusChoice === 'scheduled'
      ? { status: 'scheduled', scheduled_by_name: currentUser?.name || '', scheduled_date: statusPopupDate, scheduled_time: statusPopupTime }
      : { status: 'posted', posted_by_name: currentUser?.name || '', post_link: statusPopupLink.trim() };
    const next = posts.map(p => (p.id === statusPopup.rowId ? { ...p, ...patch } : p));
    const ok = await persist(next);
    setSaving(false);
    if (ok) { toast.success(statusChoice === 'scheduled' ? 'Scheduled' : 'Marked as Published'); closeStatusPopup(); }
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
  const createFieldTask = async ({ field, assignee, date, postTitle, entryId, description }) => {
    const cfg = FIELD_TASK_CONFIG[field];
    // Link tasks carry which calendar entry + column they're for, so the
    // assignee's My Tasks can show the post's details and take the link.
    const linked = LINKED_TASK_FIELDS.includes(field) && entryId;
    const res = await axios.post(`${API}/api/projects/${project.project_id}/tasks`, {
      task_name: `${cfg.label}: ${postTitle || 'Untitled Post'}`,
      assigned_to: assignee,
      due_date: date,
      department: 'social_media',
      category: cfg.category,
      ...(description ? { description } : {}),
      ...(linked ? { content_calendar_entry_id: entryId, content_calendar_field: field } : {}),
    }, { headers });
    return res.data?.task_id || null;
  };

  // Assign popup for one of the four link columns.
  const [assignPopup, setAssignPopup] = useState(null); // { rowId, field }
  const [assignUser, setAssignUser] = useState('');
  const [assignDue, setAssignDue] = useState('');
  const openAssignPopup = (row, field) => {
    setAssignPopup({ rowId: row.id, field });
    setAssignUser('');
    setAssignDue(row[`${field}_date`] || row.post_date || '');
  };
  const closeAssignPopup = () => { setAssignPopup(null); setAssignUser(''); setAssignDue(''); };
  const confirmAssign = async () => {
    const row = posts.find(p => p.id === assignPopup.rowId);
    const field = assignPopup.field;
    if (!row) return;
    if (!assignUser) { toast.error('Select who to assign this to'); return; }
    if (!assignDue) { toast.error('Due date is required'); return; }
    setSaving(true);
    try {
      const platformLabel = PLATFORMS.find(pl => pl.id === row.platform)?.label || row.platform || '';
      const taskId = await createFieldTask({
        field, assignee: assignUser, date: assignDue, postTitle: row.post_title, entryId: row.id,
        description: `Post: ${row.post_title || 'Untitled'}${platformLabel ? ` · ${platformLabel}` : ''}${row.post_date ? ` · ${row.post_date}` : ''}`,
      });
      const next = posts.map(p => (p.id === row.id ? {
        ...p,
        [`${field}_assignee`]: assignUser,
        [`${field}_date`]: assignDue,
        [`${field}_task_id`]: taskId,
        [`${field}_task_status`]: 'assigned',
      } : p));
      const ok = await persist(next);
      if (ok) {
        toast.success(`Assigned to ${assigneeName(assignUser) || 'user'} — it's in their My Tasks`);
        onTaskCreated?.();
        closeAssignPopup();
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to assign');
    } finally {
      setSaving(false);
    }
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
        const entryIds = row.platforms.map(() => newRowId());
        // One task can only link back to one entry, so only a single-
        // platform post gets link-back tasks (multi-platform ones behave as
        // plain tasks, like before).
        const linkEntryId = row.platforms.length === 1 ? entryIds[0] : null;
        for (const field of Object.keys(FIELD_TASK_CONFIG)) {
          const assignee = row[`${field}_assignee`];
          const date = row[`${field}_date`];
          if (assignee && date) {
            taskIds[field] = await createFieldTask({ field, assignee, date, postTitle: row.post_title, entryId: linkEntryId });
          }
        }
        for (const [platformIdx, platform] of row.platforms.entries()) {
          newEntries.push({
            id: entryIds[platformIdx],
            platform,
            ...Object.fromEntries(LINKED_TASK_FIELDS.map(f => [`${f}_task_status`, taskIds[f] && linkEntryId ? 'assigned' : ''])),
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
            editing_link: row.editing_link,
            editing_link_assignee: row.editing_link_assignee,
            editing_link_date: row.editing_link_date,
            editing_link_task_id: taskIds.editing_link || null,
            editing_link_status: row.editing_link_status || 'pending',
            editing_link_reject_reason: row.editing_link_reject_reason || '',
            thumbnail_link: row.thumbnail_link,
            thumbnail_link_assignee: row.thumbnail_link_assignee,
            thumbnail_link_date: row.thumbnail_link_date,
            thumbnail_link_task_id: taskIds.thumbnail_link || null,
            thumbnail_link_status: row.thumbnail_link_status || 'pending',
            thumbnail_link_reject_reason: row.thumbnail_link_reject_reason || '',
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
    setSaving(true);
    try {
      const updated = { ...editBuffer };
      for (const field of Object.keys(FIELD_TASK_CONFIG)) {
        const assignee = updated[`${field}_assignee`];
        const date = updated[`${field}_date`];
        if (assignee && date && !updated[`${field}_task_id`]) {
          updated[`${field}_task_id`] = await createFieldTask({ field, assignee, date, postTitle: updated.post_title, entryId: updated.id });
          if (LINKED_TASK_FIELDS.includes(field)) updated[`${field}_task_status`] = 'assigned';
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
          { label: 'Published', value: summaryPosted, color: 'text-emerald-500', accent: 'bg-emerald-500/15' },
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
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase`}>Post Type</th>
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase min-w-[160px]`}>Post Title</th>
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase min-w-[160px]`}>Content Link</th>
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase min-w-[160px]`}>Creative Link</th>
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase min-w-[160px]`}>Editing</th>
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase min-w-[160px]`}>Thumbnail</th>
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase min-w-[220px]`}>Description &amp; Hashtags</th>
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

                  // Content / Creative / Editing / Thumbnail: "+ Link" adds the
                  // link directly, the user icon assigns it to someone (a task
                  // they finish by submitting the link) — plus its status.
                  const renderLinkCell = (row, field) => {
                    const cfg = REVIEW_FIELDS[field];
                    const value = row[field];
                    const reviewStatus = row[`${field}_status`] || 'pending';
                    const assigneeId = row[`${field}_assignee`];
                    const hasTask = !!row[`${field}_task_id`] && !!assigneeId;
                    const taskDone = row[`${field}_task_status`] === 'completed';
                    const name = assigneeName(assigneeId);
                    return (
                      <div data-testid={`content-calendar-link-cell-${field}-${row.id}`}>
                        <div className="flex items-center gap-2">
                          {value ? (
                            <>
                              <a href={value} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-[#6366f1] hover:underline">
                                Open <ExternalLink className="h-3 w-3" />
                              </a>
                              {canEdit && (
                                <button
                                  type="button"
                                  onClick={() => openFieldPopup(row, field)}
                                  className={`p-1 ${textSecondary} hover:opacity-80`}
                                  title="Edit / approve / reject"
                                  data-testid={`content-calendar-open-${field}-${row.id}`}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </>
                          ) : canEdit ? (
                            <button
                              type="button"
                              onClick={() => openFieldPopup(row, field)}
                              className="inline-flex items-center gap-1 text-xs text-[#6366f1] hover:underline"
                              title={`Add the ${cfg.label} link directly`}
                              data-testid={`content-calendar-open-${field}-${row.id}`}
                            >
                              <Plus className="h-3.5 w-3.5" /> Link
                            </button>
                          ) : (
                            <span className={`text-xs ${textSecondary}`}>—</span>
                          )}
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => openAssignPopup(row, field)}
                              className={`p-1 rounded-md hover:bg-black/5 ${hasTask ? (taskDone ? 'text-emerald-500' : 'text-amber-500') : 'text-[#6366f1]'}`}
                              title={hasTask ? `${cfg.label} assigned to ${name || 'someone'}` : `Assign ${cfg.label} to someone`}
                              data-testid={`content-calendar-assign-${field}-${row.id}`}
                            >
                              {hasTask ? <User className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
                            </button>
                          )}
                        </div>
                        {hasTask && (
                          <p className={`text-[10px] mt-0.5 font-medium ${taskDone ? 'text-emerald-500' : 'text-amber-500'}`}>
                            {name || 'Assigned'} · {taskDone ? 'Submitted' : 'Assigned'}
                          </p>
                        )}
                        {value && (
                          <p className={`text-[10px] font-medium ${REVIEW_STATUS_STYLE[reviewStatus]}`}>
                            {reviewStatus === 'approved' ? 'Approved' : reviewStatus === 'rejected' ? 'Rejected' : 'Pending review'}
                          </p>
                        )}
                      </div>
                    );
                  };

                  // Posting: the user icon assigns whoever schedules / publishes
                  // the post. Their My Tasks task carries all the post's
                  // details; what they do there (schedule / posted) shows here.
                  const renderPostingCell = (row) => {
                    const assigneeId = row.posting_assignee;
                    const hasTask = !!row.posting_task_id && !!assigneeId;
                    const ts = row.posting_task_status;
                    const tone = ts === 'completed' ? 'text-emerald-500' : ts === 'scheduled' ? 'text-sky-500' : 'text-amber-500';
                    const label = ts === 'completed' ? 'Posted' : ts === 'scheduled' ? 'Scheduled' : 'Assigned';
                    const name = assigneeName(assigneeId);
                    return (
                      <div data-testid={`content-calendar-posting-cell-${row.id}`}>
                        {canEdit ? (
                          <button
                            type="button"
                            onClick={() => openAssignPopup(row, 'posting')}
                            className={`p-1 rounded-md hover:bg-black/5 ${hasTask ? tone : 'text-[#6366f1]'}`}
                            title={hasTask ? `Posting assigned to ${name || 'someone'}` : 'Assign posting to someone'}
                            data-testid={`content-calendar-assign-posting-${row.id}`}
                          >
                            {hasTask ? <User className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
                          </button>
                        ) : !hasTask && <span className={`text-xs ${textSecondary}`}>—</span>}
                        {hasTask && (
                          <>
                            <p className={`text-[10px] font-medium ${tone}`}>{name || 'Assigned'} · {label}</p>
                            {row.posting_date && ts !== 'completed' && <p className={`text-[10px] ${textSecondary}`}>Due {row.posting_date}</p>}
                          </>
                        )}
                      </div>
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
                        {renderReviewCell(row, 'post_title')}
                        {isEditing ? (
                          <AssigneeDateEditor field="post_title" value={buf} onChange={patchBuf} />
                        ) : (
                          <AssigneeDateSummary field="post_title" row={row} />
                        )}
                      </td>
                      <td className="p-3">
                        {renderLinkCell(row, 'content_link')}
                        {isEditing && <AssigneeDateEditor field="content_link" value={buf} onChange={patchBuf} />}
                      </td>
                      <td className="p-3">
                        {renderLinkCell(row, 'creative_link')}
                        {isEditing && <AssigneeDateEditor field="creative_link" value={buf} onChange={patchBuf} />}
                      </td>
                      <td className="p-3">
                        {renderLinkCell(row, 'editing_link')}
                        {isEditing && <AssigneeDateEditor field="editing_link" value={buf} onChange={patchBuf} />}
                      </td>
                      <td className="p-3">
                        {renderLinkCell(row, 'thumbnail_link')}
                        {isEditing && <AssigneeDateEditor field="thumbnail_link" value={buf} onChange={patchBuf} />}
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
                        {row.status === 'scheduled' && row.scheduled_date && (
                          <p className="text-[10px] mt-0.5 text-amber-500" data-testid={`content-calendar-scheduled-for-${row.id}`}>
                            For {row.scheduled_date}{row.scheduled_time ? ` · ${row.scheduled_time}` : ''}
                          </p>
                        )}
                        {row.status === 'posted' && (
                          <div className="flex items-center gap-2 mt-1">
                            {row.post_link && (
                              <a href={row.post_link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-[11px] text-[#6366f1] hover:underline" data-testid={`content-calendar-post-link-${row.id}`}>
                                Post <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                            <button
                              type="button"
                              onClick={() => setDetailsRowId(row.id)}
                              className="inline-flex items-center gap-0.5 text-[11px] text-[#6366f1] hover:underline"
                              data-testid={`content-calendar-view-${row.id}`}
                            >
                              <Eye className="h-3 w-3" /> View
                            </button>
                          </div>
                        )}
                        {row.status === 'posted' && !row.post_report && row.report_task_id && (
                          <p className={`text-[10px] mt-0.5 ${textSecondary}`}>Report due {row.report_date}</p>
                        )}
                      </td>
                      <td className="p-3">
                        {renderPostingCell(row)}
                        {isEditing && <AssigneeDateEditor field="posting" value={buf} onChange={patchBuf} />}
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
                          <td className="p-3">
                            {canEdit && (
                              <Select
                                value={pendingPostTypes[iso] || 'static'}
                                onValueChange={(v) => setPendingPostTypes(prev => ({ ...prev, [iso]: v }))}
                              >
                                <SelectTrigger className={`h-8 text-xs ${bgSecondary} border ${borderColor} ${textPrimary}`} data-testid={`content-calendar-empty-post-type-${iso}`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {POST_TYPES.map(t => <SelectItem key={t} value={t}>{POST_TYPE_LABEL[t]}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            )}
                          </td>
                          {[
                            { field: 'post_title', label: 'Add Post' },
                            { field: 'content_link', label: 'Add Content Link' },
                            { field: 'creative_link', label: 'Add Creative Link' },
                            { field: 'editing_link', label: 'Add Editing' },
                            { field: 'thumbnail_link', label: 'Add Thumbnail' },
                            { field: 'description', label: 'Add' },
                          ].map(({ field, label }) => (
                            <td key={field} className="p-3">
                              {canEdit ? (
                                <button
                                  type="button"
                                  onClick={() => (field === 'description' ? openDescPopup(null, iso) : openFieldPopup(null, field, true, iso))}
                                  className="inline-flex items-center gap-1 text-xs text-[#6366f1] hover:underline"
                                  data-testid={field === 'post_title' ? `content-calendar-add-for-day-${iso}` : `content-calendar-add-${field}-for-day-${iso}`}
                                >
                                  <Plus className="h-3.5 w-3.5" /> {label}
                                </button>
                              ) : (
                                field === 'post_title' ? <span className={`text-xs ${textSecondary}`}>No post</span> : null
                              )}
                            </td>
                          ))}
                          <td colSpan={3} className="p-3" />
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
                {fieldPopup.isNewRow && subTab === 'all' && (
                  <div>
                    <Label className={textPrimary}>Platform <span className="text-red-500">*</span></Label>
                    <Select value={fieldPopupPlatform || 'none'} onValueChange={(v) => setFieldPopupPlatform(v === 'none' ? '' : v)}>
                      <SelectTrigger className={inputCls} data-testid="content-calendar-field-popup-platform">
                        <SelectValue placeholder="Select platform" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— Select —</SelectItem>
                        {PLATFORMS.filter(p => p.id !== 'all').map(p => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
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

      {/* Assign popup — Content / Creative / Editing / Thumbnail. Shows the
          post's context, then creates a linked task for the person: it shows
          in this project's Tasks tab and their My Tasks (Social Media). */}
      {assignPopup && (() => {
        const row = posts.find(p => p.id === assignPopup.rowId);
        if (!row) return null;
        const field = assignPopup.field;
        const cfg = REVIEW_FIELDS[field] || { label: 'Posting' };
        const otherLinks = LINK_FIELDS.filter(f => f !== field && row[f]);
        const existingAssignee = row[`${field}_task_id`] ? assigneeName(row[`${field}_assignee`]) : '';
        const platformLabel = PLATFORMS.find(pl => pl.id === row.platform)?.label || row.platform || '—';
        return (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={closeAssignPopup}>
            <div className={`${bgCard} border ${borderColor} rounded-xl w-full max-w-md`} onClick={(e) => e.stopPropagation()}>
              <div className={`flex items-center justify-between p-4 border-b ${borderColor}`}>
                <h3 className={`text-base font-semibold ${textPrimary} flex items-center gap-2`}><UserPlus className="h-4 w-4" /> Assign {cfg.label}</h3>
                <button onClick={closeAssignPopup} className={textSecondary}><X className="h-5 w-5" /></button>
              </div>
              <div className="p-4 space-y-3">
                <div className={`rounded-lg ${bgSecondary} p-3 space-y-1.5 text-sm`} data-testid="content-calendar-assign-context">
                  <div className="flex justify-between gap-3"><span className={textSecondary}>Post Title</span><span className={`${textPrimary} text-right`}>{row.post_title || '—'}</span></div>
                  <div className="flex justify-between gap-3"><span className={textSecondary}>Post Date</span><span className={textPrimary}>{row.post_date || '—'} · {dayOfWeek(row.post_date)}</span></div>
                  <div className="flex justify-between gap-3"><span className={textSecondary}>Platform</span><span className={textPrimary}>{platformLabel}</span></div>
                  {otherLinks.map(f => (
                    <div key={f} className="flex justify-between gap-3">
                      <span className={textSecondary}>{REVIEW_FIELDS[f].label}</span>
                      <a href={row[f]} target="_blank" rel="noreferrer" className="text-[#6366f1] hover:underline inline-flex items-center gap-1">Open <ExternalLink className="h-3 w-3" /></a>
                    </div>
                  ))}
                </div>
                {existingAssignee && (
                  <p className="text-xs text-amber-500">
                    Already assigned to <b>{existingAssignee}</b>{row[`${field}_date`] ? ` (due ${row[`${field}_date`]})` : ''}. Assigning again creates a new task.
                  </p>
                )}
                <div>
                  <Label className={textPrimary}>Due Date <span className="text-red-500">*</span></Label>
                  <Input type="date" value={assignDue} onChange={(e) => setAssignDue(e.target.value)} className={inputCls} data-testid="content-calendar-assign-due" />
                </div>
                <div>
                  <Label className={textPrimary}>Assign To <span className="text-red-500">*</span></Label>
                  <Select value={assignUser || 'none'} onValueChange={(v) => setAssignUser(v === 'none' ? '' : v)}>
                    <SelectTrigger className={inputCls} data-testid="content-calendar-assign-user">
                      <SelectValue placeholder="Select user" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Select —</SelectItem>
                      {(users || []).map(u => <SelectItem key={u.user_id} value={u.user_id}>{u.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className={`flex items-center justify-end gap-2 p-4 border-t ${borderColor}`}>
                <Button type="button" variant="outline" onClick={closeAssignPopup} disabled={saving}>Cancel</Button>
                <Button type="button" onClick={confirmAssign} disabled={saving} className="bg-[#6366f1] hover:bg-[#5558dd] text-white" data-testid="content-calendar-assign-confirm">
                  {saving ? 'Assigning…' : 'Assign'}
                </Button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Description / Hashtags / Keywords popup */}
      {(descPopupRowId || descPopupNewDate) && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={closeDescPopup}>
          <div className={`${bgCard} border ${borderColor} rounded-xl w-full max-w-lg`} onClick={(e) => e.stopPropagation()}>
            <div className={`flex items-center justify-between p-4 border-b ${borderColor}`}>
              <h3 className={`text-base font-semibold ${textPrimary} flex items-center gap-2`}><Hash className="h-4 w-4" /> Description &amp; Hashtags</h3>
              <button onClick={closeDescPopup} className={textSecondary}><X className="h-5 w-5" /></button>
            </div>
            <div className="p-4 space-y-3">
              {descPopupNewDate && subTab === 'all' && (
                <div>
                  <Label className={textPrimary}>Platform <span className="text-red-500">*</span></Label>
                  <Select value={fieldPopupPlatform || 'none'} onValueChange={(v) => setFieldPopupPlatform(v === 'none' ? '' : v)}>
                    <SelectTrigger className={inputCls} data-testid="content-calendar-desc-popup-platform">
                      <SelectValue placeholder="Select platform" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Select —</SelectItem>
                      {PLATFORMS.filter(pl => pl.id !== 'all').map(pl => <SelectItem key={pl.id} value={pl.id}>{pl.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
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

      {/* View popup — everything about a posted post: who/when, the live link
          and the report (likes / comments / shares / reach) as a 2x2. */}
      {detailsRowId && (() => {
        const row = posts.find(p => p.id === detailsRowId);
        if (!row) return null;
        const platformLabel = PLATFORMS.find(pl => pl.id === row.platform)?.label || row.platform || '—';
        const report = row.post_report;
        const stat = (label, value) => (
          <div className={`rounded-lg border ${borderColor} ${bgSecondary} p-3 text-center`} data-testid={`content-calendar-report-${label.toLowerCase()}`}>
            <p className={`text-xs ${textSecondary}`}>{label}</p>
            <p className={`text-2xl font-bold ${textPrimary}`}>{Number(value ?? 0).toLocaleString()}</p>
          </div>
        );
        const line = (label, value) => (
          <div className="flex justify-between gap-3 text-sm">
            <span className={textSecondary}>{label}</span>
            <span className={`${textPrimary} text-right`}>{value || '—'}</span>
          </div>
        );
        return (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setDetailsRowId(null)}>
            <div className={`${bgCard} border ${borderColor} rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto`} onClick={(e) => e.stopPropagation()} data-testid="content-calendar-view-popup">
              <div className={`flex items-center justify-between p-4 border-b ${borderColor}`}>
                <h3 className={`text-base font-semibold ${textPrimary} flex items-center gap-2`}><Eye className="h-4 w-4" /> Post Details</h3>
                <button onClick={() => setDetailsRowId(null)} className={textSecondary}><X className="h-5 w-5" /></button>
              </div>
              <div className="p-4 space-y-4">
                <div className="space-y-1.5">
                  {line('Post Title', row.post_title)}
                  {line('Platform', platformLabel)}
                  {line('Post Date', row.post_date ? `${row.post_date} · ${dayOfWeek(row.post_date)}` : '')}
                  {line('Status', STATUS_LABEL[row.status] || 'Created')}
                  {row.scheduled_date && line('Scheduled for', `${row.scheduled_date}${row.scheduled_time ? ` · ${row.scheduled_time}` : ''}${row.scheduled_by_name ? ` (${row.scheduled_by_name})` : ''}`)}
                  {line('Published by', row.posted_by_name)}
                  {row.posted_at && line('Published at', new Date(row.posted_at).toLocaleString())}
                  <div className="flex justify-between gap-3 text-sm">
                    <span className={textSecondary}>Post Link</span>
                    {row.post_link ? (
                      <a href={row.post_link} target="_blank" rel="noreferrer" className="text-[#6366f1] hover:underline inline-flex items-center gap-1 break-all text-right">
                        Open <ExternalLink className="h-3 w-3 shrink-0" />
                      </a>
                    ) : <span className={textPrimary}>—</span>}
                  </div>
                </div>
                <div>
                  <p className={`text-xs font-semibold uppercase tracking-wide ${textSecondary} mb-2`}>Report</p>
                  {report ? (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        {stat('Likes', report.likes)}
                        {stat('Comments', report.comments)}
                        {stat('Shares', report.shares)}
                        {stat('Reach', report.reach)}
                      </div>
                      <p className={`text-[11px] ${textSecondary} mt-2`}>
                        Reported by {report.submitted_by_name || '—'}{report.submitted_at ? ` · ${new Date(report.submitted_at).toLocaleDateString()}` : ''}
                      </p>
                    </>
                  ) : (
                    <div className={`rounded-lg border border-dashed ${borderColor} p-4 text-center text-sm ${textSecondary}`}>
                      {row.report_task_id
                        ? `Report not submitted yet — ${assigneeName(row.report_assignee) || 'the poster'} is asked for it on ${row.report_date || 'the next day'}.`
                        : 'No report yet.'}
                    </div>
                  )}
                </div>
              </div>
              <div className={`flex justify-end p-4 border-t ${borderColor}`}>
                <Button type="button" variant="outline" onClick={() => setDetailsRowId(null)}>Close</Button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Status popup — Schedule (auto-stamps who) or Published (asks for the
          live post link). */}
      {statusPopup && (() => {
        const row = posts.find(p => p.id === statusPopup.rowId);
        const choiceBtn = (value, label) => (
          <button
            type="button"
            onClick={() => setStatusChoice(value)}
            className={`flex-1 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
              statusChoice === value
                ? (value === 'scheduled' ? 'bg-amber-500/20 text-amber-500 border-amber-500/50' : 'bg-emerald-500/20 text-emerald-500 border-emerald-500/50')
                : `${bgSecondary} ${textSecondary} ${borderColor} hover:opacity-80`
            }`}
            data-testid={`content-calendar-status-choice-${value}`}
          >
            {label}
          </button>
        );
        return (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={closeStatusPopup}>
            <div className={`${bgCard} border ${borderColor} rounded-xl w-full max-w-sm`} onClick={(e) => e.stopPropagation()}>
              <div className={`flex items-center justify-between p-4 border-b ${borderColor}`}>
                <h3 className={`text-base font-semibold ${textPrimary} flex items-center gap-2`}>
                  Post Status
                </h3>
                <button onClick={closeStatusPopup} className={textSecondary}><X className="h-5 w-5" /></button>
              </div>
              <div className="p-4 space-y-3">
                {statusPopup.mode === 'choose' && (
                  <>
                    <div className="flex items-center gap-2">
                      {choiceBtn('scheduled', 'Schedule')}
                      {choiceBtn('posted', 'Published')}
                    </div>
                    {statusChoice === 'scheduled' && (
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className={textPrimary}>Scheduled Date <span className="text-red-500">*</span></Label>
                            <Input type="date" value={statusPopupDate} onChange={(e) => setStatusPopupDate(e.target.value)} className={inputCls} data-testid="content-calendar-schedule-date" />
                          </div>
                          <div>
                            <Label className={textSecondary}>Time (optional)</Label>
                            <Input type="time" value={statusPopupTime} onChange={(e) => setStatusPopupTime(e.target.value)} className={inputCls} />
                          </div>
                        </div>
                        <p className={`text-xs ${textSecondary}`}>Scheduling as <b className={textPrimary}>{currentUser?.name || 'you'}</b>.</p>
                      </div>
                    )}
                    {statusChoice === 'posted' && (
                      <div>
                        <Label className={textPrimary}>Post Link <span className="text-red-500">*</span></Label>
                        <Input
                          value={statusPopupLink}
                          onChange={(e) => setStatusPopupLink(e.target.value)}
                          placeholder="https://linkedin.com/..."
                          className={inputCls}
                          data-testid="content-calendar-post-link-input"
                          autoFocus
                        />
                        <p className={`text-xs ${textSecondary} mt-1`}>Published by <b className={textPrimary}>{currentUser?.name || 'you'}</b></p>
                      </div>
                    )}
                  </>
                )}
              </div>
              <div className={`flex items-center justify-end gap-2 p-4 border-t ${borderColor}`}>
                <Button type="button" variant="outline" onClick={closeStatusPopup}>Cancel</Button>
                <Button type="button" onClick={confirmStatusTransition} disabled={saving || !statusChoice} className="bg-[#6366f1] hover:bg-[#5558dd] text-white" data-testid="content-calendar-status-confirm">
                  {saving ? 'Saving…' : statusChoice === 'posted' ? 'Confirm Published' : 'Confirm Schedule'}
                </Button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
