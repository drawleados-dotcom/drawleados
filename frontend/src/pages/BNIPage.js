import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Combobox } from '../components/ui/combobox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import CSVImportModal from '../components/shared/CSVImportModal';
import {
  Plus, Users, Calendar, Handshake, Wallet, Share2, Heart, Star, Tag, Award, Gift,
  Eye, Pencil, Trash2, MapPin, Link as LinkIcon, Mail, Phone, Globe, Pin, PinOff, Upload, Search, ChevronRight,
  RotateCcw, MessageSquare, Package, X, Send,
} from 'lucide-react';
import { toast } from 'sonner';

const TITLE_OPTIONS = ['Mr', 'Miss', 'Mrs'];

const MEMBER_IMPORT_FIELDS = [
  { key: 'title', label: 'Title (Mr/Miss/Mrs)', synonyms: ['title', 'salutation'] },
  { key: 'name', label: 'Name', required: true, synonyms: ['name', 'full name', 'member name'] },
  { key: 'business_name', label: 'Business Name', synonyms: ['business name', 'company', 'company name'] },
  { key: 'email', label: 'Email', synonyms: ['email', 'email address'] },
  { key: 'phone', label: 'Phone Number', synonyms: ['phone number', 'phone', 'mobile', 'contact number'] },
  { key: 'website', label: 'Website', synonyms: ['website', 'site'] },
  { key: 'category_name', label: 'Category', synonyms: ['category', 'category name', 'business category'] },
  { key: 'role_player_name', label: 'Role Player', synonyms: ['role player', 'role player name', 'role'] },
  { key: 'address', label: 'Address', synonyms: ['address'] },
  { key: 'location_link', label: 'Location Link', synonyms: ['location link', 'map link', 'google maps link'] },
  { key: 'city', label: 'City', synonyms: ['city'] },
];

const CATEGORY_IMPORT_FIELDS = [
  { key: 'name', label: 'Category Name', required: true, synonyms: ['category name', 'category', 'name'] },
  { key: 'description', label: 'Description', synonyms: ['description', 'desc'] },
];

const ROLE_PLAYER_IMPORT_FIELDS = [
  { key: 'name', label: 'Role Player Name', required: true, synonyms: ['role player name', 'role player', 'role', 'name'] },
  { key: 'description', label: 'Description', synonyms: ['description', 'desc'] },
];

const OUTREACH_IMPORT_FIELDS = [
  { key: 'name', label: 'Name', required: true, synonyms: ['name'] },
  { key: 'brand_name', label: 'Brand Name', synonyms: ['brand name', 'brand'] },
  { key: 'chapter_name', label: 'Chapter Name', synonyms: ['chapter name', 'chapter'] },
  { key: 'email', label: 'Email', synonyms: ['email', 'email address'] },
  { key: 'profile_link', label: 'Profile Link', synonyms: ['profile link', 'profile'] },
  { key: 'phone', label: 'Phone', synonyms: ['phone', 'phone number', 'mobile', 'contact number'] },
  { key: 'website', label: 'Website', synonyms: ['website', 'site'] },
  { key: 'status', label: 'Status', synonyms: ['status'] },
  { key: 'location', label: 'Location', synonyms: ['location'] },
  { key: 'category_name', label: 'Category', synonyms: ['category', 'category name', 'business category'] },
];

const MONTHS = [
  { v: 1, l: 'January' }, { v: 2, l: 'February' }, { v: 3, l: 'March' },
  { v: 4, l: 'April' }, { v: 5, l: 'May' }, { v: 6, l: 'June' },
  { v: 7, l: 'July' }, { v: 8, l: 'August' }, { v: 9, l: 'September' },
  { v: 10, l: 'October' }, { v: 11, l: 'November' }, { v: 12, l: 'December' },
];

const GIVE_ASK_STATUSES = ['Contacted', 'Not Related', 'Asked the give'];
const ONE_TO_ONE_STATUSES = ['Lead', 'One to One', 'Relationship'];
const OUTREACH_STATUSES = ['To do', 'Contacted', 'Interested', 'Not Interested', 'Converted'];

const TABS = [
  { key: 'members', label: 'Members', icon: Users },
  { key: 'weekly_meeting', label: 'Weekly Meeting', icon: Calendar },
  { key: 'give_ask', label: 'Give and Ask', icon: Gift },
  { key: 'my_gives', label: 'My Gives', icon: Package },
  { key: 'one_to_one', label: 'One-to-One', icon: Handshake },
  { key: 'outreach', label: 'BNI Outreach', icon: Send },
  { key: 'payment_history', label: 'Payment History', icon: Wallet },
  { key: 'referrals', label: 'Referrals', icon: Share2 },
  { key: 'thank_you_note', label: 'Thank You Note', icon: Heart },
  { key: 'testimonials', label: 'Testimonials', icon: Star },
  { key: 'role_players', label: 'Role Players', icon: Award },
  { key: 'category', label: 'Category', icon: Tag },
];

// Deterministic distinct color per category/role-player so the highlighted
// columns read at a glance — same approach used for sub-department badges
// in Operations.
const TAG_PALETTE = [
  { bg: 'bg-[#3b82f6]/15', text: 'text-[#3b82f6]', border: 'border-[#3b82f6]/40' },
  { bg: 'bg-[#10b981]/15', text: 'text-[#10b981]', border: 'border-[#10b981]/40' },
  { bg: 'bg-[#f59e0b]/15', text: 'text-[#f59e0b]', border: 'border-[#f59e0b]/40' },
  { bg: 'bg-[#8b5cf6]/15', text: 'text-[#8b5cf6]', border: 'border-[#8b5cf6]/40' },
  { bg: 'bg-[#ec4899]/15', text: 'text-[#ec4899]', border: 'border-[#ec4899]/40' },
  { bg: 'bg-[#06b6d4]/15', text: 'text-[#06b6d4]', border: 'border-[#06b6d4]/40' },
  { bg: 'bg-[#ef4444]/15', text: 'text-[#ef4444]', border: 'border-[#ef4444]/40' },
];
const tagColor = (key) => {
  const s = String(key || '');
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  return TAG_PALETTE[hash % TAG_PALETTE.length];
};

const emptyMemberForm = () => ({
  title: 'Mr',
  name: '',
  business_name: '',
  email: '',
  phone: '',
  website: '',
  category_id: '',
  category_name: '',
  role_player_id: '',
  role_player_name: '',
  address: '',
  location_link: '',
  city: '',
});

const emptyNameDescForm = () => ({ name: '', description: '' });

const emptyOutreachForm = () => ({ name: '', brand_name: '', chapter_name: '', email: '', profile_link: '', phone: '', website: '', status: 'To do', location: '', category_id: '' });

export default function BNIPage() {
  const { isDark } = useTheme();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'members');
  const [members, setMembers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [rolePlayers, setRolePlayers] = useState([]);
  const [chapterSettings, setChapterSettings] = useState({ chapter_name: '', region: '' });
  const [myDesignation, setMyDesignation] = useState(null);
  const [loading, setLoading] = useState(true);

  const [showMemberModal, setShowMemberModal] = useState(false);
  const [editingMemberId, setEditingMemberId] = useState(null);
  const [memberForm, setMemberForm] = useState(emptyMemberForm());
  const [viewingMember, setViewingMember] = useState(null);

  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [categoryForm, setCategoryForm] = useState(emptyNameDescForm());

  const [showRolePlayerModal, setShowRolePlayerModal] = useState(false);
  const [editingRolePlayerId, setEditingRolePlayerId] = useState(null);
  const [rolePlayerForm, setRolePlayerForm] = useState(emptyNameDescForm());

  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsForm, setSettingsForm] = useState({ chapter_name: '', region: '' });

  const [showMemberImport, setShowMemberImport] = useState(false);
  const [showCategoryImport, setShowCategoryImport] = useState(false);
  const [showRolePlayerImport, setShowRolePlayerImport] = useState(false);

  const [memberSearch, setMemberSearch] = useState('');
  const [categorySearch, setCategorySearch] = useState('');

  const today = new Date();
  const [phMonth, setPhMonth] = useState(today.getMonth() + 1);
  const [phYear, setPhYear] = useState(today.getFullYear());
  const [phAllTime, setPhAllTime] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState({ entries: [], summary: { total_amount: 0, count: 0 }, has_bni_category: true });
  const [phLoading, setPhLoading] = useState(false);

  const [weeklyMeetings, setWeeklyMeetings] = useState([]);
  const [wmLoading, setWmLoading] = useState(false);

  const [giveAsks, setGiveAsks] = useState([]);
  const [gaLoading, setGaLoading] = useState(false);
  const [gaView, setGaView] = useState('gives');

  const [myGives, setMyGives] = useState([]);
  const [mgLoading, setMgLoading] = useState(false);
  const [showNewGive, setShowNewGive] = useState(false);
  const [newGiveForm, setNewGiveForm] = useState({ business_person_name: '', company_name: '', industry: '' });
  const [newGiveSaving, setNewGiveSaving] = useState(false);
  const [assigningGiveId, setAssigningGiveId] = useState(null);

  const [oneToOnes, setOneToOnes] = useState([]);
  const [ooLoading, setOoLoading] = useState(false);
  const [showNewOto, setShowNewOto] = useState(false);
  const [otoCreateTab, setOtoCreateTab] = useState('chapter');
  const [otoForm, setOtoForm] = useState({ member_id: '', meeting_date: '', meeting_time: '', location: '', invited_by: 'me' });
  const [otoSaving, setOtoSaving] = useState(false);

  const [showEditOto, setShowEditOto] = useState(false);
  const [editOtoForm, setEditOtoForm] = useState({ member_id: '', meeting_date: '', meeting_time: '', location: '', invited_by: 'me' });
  const [editOtoSaving, setEditOtoSaving] = useState(false);

  const [showReschedule, setShowReschedule] = useState(false);
  const [rescheduleForm, setRescheduleForm] = useState({ meeting_date: '', meeting_time: '', location: '' });
  const [rescheduleSaving, setRescheduleSaving] = useState(false);

  const [showOtoRemarks, setShowOtoRemarks] = useState(false);
  const [remarksForm, setRemarksForm] = useState({ remark: '', gives: [''], referrals: [''], status: '' });
  const [remarksSaving, setRemarksSaving] = useState(false);

  const [activeOto, setActiveOto] = useState(null);

  const [outreach, setOutreach] = useState([]);
  const [ouLoading, setOuLoading] = useState(false);
  const [showOutreachModal, setShowOutreachModal] = useState(false);
  const [editingOutreachId, setEditingOutreachId] = useState(null);
  const [outreachForm, setOutreachForm] = useState(emptyOutreachForm());
  const [outreachSaving, setOutreachSaving] = useState(false);
  const [showOutreachImport, setShowOutreachImport] = useState(false);

  const bgCard = isDark ? 'bg-[#18181b]' : 'bg-white';
  const bgSecondary = isDark ? 'bg-[#27272a]' : 'bg-gray-100';
  const textPrimary = isDark ? 'text-[#fafafa]' : 'text-gray-900';
  const textSecondary = isDark ? 'text-[#a1a1aa]' : 'text-gray-600';
  const borderColor = isDark ? 'border-[#27272a]' : 'border-gray-200';

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [membersRes, categoriesRes, rolePlayersRes, settingsRes, designationsRes] = await Promise.all([
        api.get('/bni/members'),
        api.get('/bni/categories'),
        api.get('/bni/role-players'),
        api.get('/bni/settings'),
        api.get('/designations/').catch(() => ({ data: [] })),
      ]);
      setMembers(membersRes.data || []);
      setCategories(categoriesRes.data || []);
      setRolePlayers(rolePlayersRes.data || []);
      setChapterSettings(settingsRes.data || { chapter_name: '', region: '' });
      const userDesg = (user?.designation || '').toLowerCase().trim();
      const found = (designationsRes.data || []).find(
        (d) => (d.title || '').toLowerCase().trim() === userDesg
      );
      setMyDesignation(found || null);
    } catch (error) {
      toast.error('Failed to load BNI data');
    } finally {
      setLoading(false);
    }
  }, [user?.designation]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Payment History — reads Finance → Expense → Expense Split spend tagged
  // to a "BNI" sub-category, so dues paid there show up here automatically.
  const loadPaymentHistory = useCallback(async () => {
    setPhLoading(true);
    try {
      const params = phAllTime ? {} : { month: phMonth, year: phYear };
      const res = await api.get('/bni/payment-history', { params });
      setPaymentHistory(res.data || { entries: [], summary: { total_amount: 0, count: 0 }, has_bni_category: true });
    } catch (error) {
      toast.error('Failed to load payment history');
    } finally {
      setPhLoading(false);
    }
  }, [phAllTime, phMonth, phYear]);

  useEffect(() => {
    if (activeTab === 'payment_history') loadPaymentHistory();
  }, [activeTab, loadPaymentHistory]);

  // Weekly Meeting — every Friday, Week 1 = 31 Jul 2026. Only weeks that
  // have actually been added (via "Add Week") show up here.
  const loadWeeklyMeetings = useCallback(async () => {
    setWmLoading(true);
    try {
      const res = await api.get('/bni/weekly-meetings');
      setWeeklyMeetings(res.data || []);
    } catch (error) {
      toast.error('Failed to load weekly meetings');
    } finally {
      setWmLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'weekly_meeting') loadWeeklyMeetings();
  }, [activeTab, loadWeeklyMeetings]);

  // Give & Ask — aggregate across all weeks, for the main "Give and Ask" tab.
  const loadGiveAsks = useCallback(async () => {
    setGaLoading(true);
    try {
      const res = await api.get('/bni/give-ask');
      setGiveAsks(res.data || []);
    } catch (error) {
      toast.error('Failed to load Give & Ask entries');
    } finally {
      setGaLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'give_ask') loadGiveAsks();
  }, [activeTab, loadGiveAsks]);

  const gives = useMemo(() => giveAsks.filter((g) => (g.give || '').trim()), [giveAsks]);
  const asks = useMemo(() => giveAsks.filter((g) => (g.ask || '').trim()), [giveAsks]);

  const updateGiveAskStatus = async (entryId, field, value) => {
    try {
      await api.put(`/bni/give-ask/${entryId}`, { [field]: value });
      setGiveAsks((prev) => prev.map((g) => (g.entry_id === entryId ? { ...g, [field]: value } : g)));
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  // ---------- My Gives ----------

  const loadMyGives = useCallback(async () => {
    setMgLoading(true);
    try {
      const [givesRes, weeksRes] = await Promise.all([
        api.get('/bni/my-gives'),
        api.get('/bni/weekly-meetings'),
      ]);
      setMyGives(givesRes.data || []);
      setWeeklyMeetings(weeksRes.data || []);
    } catch (error) {
      toast.error('Failed to load My Gives');
    } finally {
      setMgLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'my_gives') loadMyGives();
  }, [activeTab, loadMyGives]);

  const openNewGive = () => {
    setNewGiveForm({ business_person_name: '', company_name: '', industry: '' });
    setShowNewGive(true);
  };

  const saveNewGive = async () => {
    if (!newGiveForm.business_person_name.trim()) { toast.error('Business Person Name is required'); return; }
    setNewGiveSaving(true);
    try {
      await api.post('/bni/my-gives', newGiveForm);
      toast.success('Give added');
      setShowNewGive(false);
      loadMyGives();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add give');
    } finally {
      setNewGiveSaving(false);
    }
  };

  const assignGiveWeek = async (giveId, meetingId) => {
    try {
      await api.put(`/bni/my-gives/${giveId}/assign-week`, { meeting_id: meetingId });
      toast.success('Assigned to weekly presentation');
      loadMyGives();
    } catch (error) {
      toast.error('Failed to assign week');
    } finally {
      setAssigningGiveId(null);
    }
  };

  const deleteMyGive = async (giveId) => {
    if (!window.confirm('Delete this give?')) return;
    try {
      await api.delete(`/bni/my-gives/${giveId}`);
      toast.success('Give deleted');
      loadMyGives();
    } catch (error) {
      toast.error('Failed to delete give');
    }
  };

  // ---------- One-to-One ----------

  const loadOneToOnes = useCallback(async () => {
    setOoLoading(true);
    try {
      const res = await api.get('/bni/one-to-ones');
      setOneToOnes(res.data || []);
    } catch (error) {
      toast.error('Failed to load One-to-Ones');
    } finally {
      setOoLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'one_to_one') loadOneToOnes();
  }, [activeTab, loadOneToOnes]);

  const openNewOto = () => {
    setOtoCreateTab('chapter');
    setOtoForm({ member_id: '', meeting_date: '', meeting_time: '', location: '', invited_by: 'me' });
    setShowNewOto(true);
  };

  const saveNewOto = async () => {
    if (!otoForm.member_id) { toast.error('Select a member'); return; }
    if (!otoForm.meeting_date) { toast.error('Meeting date is required'); return; }
    setOtoSaving(true);
    try {
      await api.post('/bni/one-to-ones', { entry_type: 'chapter', ...otoForm });
      toast.success('One-to-One scheduled');
      setShowNewOto(false);
      loadOneToOnes();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to schedule One-to-One');
    } finally {
      setOtoSaving(false);
    }
  };

  const openEditOto = (entry) => {
    setActiveOto(entry);
    setEditOtoForm({
      member_id: entry.member_id || '',
      meeting_date: entry.meeting_date || '',
      meeting_time: entry.meeting_time || '',
      location: entry.location || '',
      invited_by: entry.invited_by || 'me',
    });
    setShowEditOto(true);
  };

  const saveEditOto = async () => {
    if (!editOtoForm.member_id) { toast.error('Select a member'); return; }
    if (!editOtoForm.meeting_date) { toast.error('Meeting date is required'); return; }
    setEditOtoSaving(true);
    try {
      await api.put(`/bni/one-to-ones/${activeOto.entry_id}`, editOtoForm);
      toast.success('One-to-One updated');
      setShowEditOto(false);
      loadOneToOnes();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update One-to-One');
    } finally {
      setEditOtoSaving(false);
    }
  };

  const openReschedule = (entry) => {
    setActiveOto(entry);
    setRescheduleForm({ meeting_date: entry.meeting_date || '', meeting_time: entry.meeting_time || '', location: entry.location || '' });
    setShowReschedule(true);
  };

  const saveReschedule = async () => {
    setRescheduleSaving(true);
    try {
      await api.put(`/bni/one-to-ones/${activeOto.entry_id}/reschedule`, rescheduleForm);
      toast.success('Rescheduled');
      setShowReschedule(false);
      loadOneToOnes();
    } catch (error) {
      toast.error('Failed to reschedule');
    } finally {
      setRescheduleSaving(false);
    }
  };

  const openOtoRemarks = (entry) => {
    setActiveOto(entry);
    setRemarksForm({
      remark: entry.remark || '',
      gives: entry.gives?.length ? entry.gives : [''],
      referrals: entry.referrals?.length ? entry.referrals : [''],
      status: entry.status || '',
    });
    setShowOtoRemarks(true);
  };

  const updateRemarksListItem = (field, idx, value) => {
    setRemarksForm((prev) => {
      const next = [...prev[field]];
      next[idx] = value;
      return { ...prev, [field]: next };
    });
  };

  const addRemarksListItem = (field) => {
    setRemarksForm((prev) => ({ ...prev, [field]: [...prev[field], ''] }));
  };

  const removeRemarksListItem = (field, idx) => {
    setRemarksForm((prev) => {
      const next = prev[field].filter((_, i) => i !== idx);
      return { ...prev, [field]: next.length ? next : [''] };
    });
  };

  const saveOtoRemarks = async () => {
    setRemarksSaving(true);
    try {
      await api.put(`/bni/one-to-ones/${activeOto.entry_id}/remarks`, remarksForm);
      toast.success(remarksForm.status === 'Lead' ? 'Saved — added to Leads (source: BNI)' : 'Saved');
      setShowOtoRemarks(false);
      loadOneToOnes();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save remarks');
    } finally {
      setRemarksSaving(false);
    }
  };

  // ---------- BNI Outreach ----------

  const loadOutreach = useCallback(async () => {
    setOuLoading(true);
    try {
      const res = await api.get('/bni/outreach');
      setOutreach(res.data || []);
    } catch (error) {
      toast.error('Failed to load BNI Outreach');
    } finally {
      setOuLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'outreach') loadOutreach();
  }, [activeTab, loadOutreach]);

  const openAddOutreach = () => {
    setEditingOutreachId(null);
    setOutreachForm(emptyOutreachForm());
    setShowOutreachModal(true);
  };

  const openEditOutreach = (o) => {
    setEditingOutreachId(o.outreach_id);
    setOutreachForm({
      name: o.name || '', brand_name: o.brand_name || '', chapter_name: o.chapter_name || '',
      email: o.email || '', profile_link: o.profile_link || '', phone: o.phone || '',
      website: o.website || '', status: o.status || 'To do', location: o.location || '',
      category_id: o.category_id || '',
    });
    setShowOutreachModal(true);
  };

  const saveOutreach = async () => {
    if (!outreachForm.name.trim()) { toast.error('Name is required'); return; }
    setOutreachSaving(true);
    try {
      if (editingOutreachId) {
        await api.put(`/bni/outreach/${editingOutreachId}`, outreachForm);
        toast.success('Outreach entry updated');
      } else {
        await api.post('/bni/outreach', outreachForm);
        toast.success('Outreach entry added');
      }
      setShowOutreachModal(false);
      loadOutreach();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save outreach entry');
    } finally {
      setOutreachSaving(false);
    }
  };

  const updateOutreachStatus = async (outreachId, status) => {
    try {
      await api.put(`/bni/outreach/${outreachId}`, { status });
      setOutreach((prev) => prev.map((o) => (o.outreach_id === outreachId ? { ...o, status } : o)));
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const deleteOutreach = async (outreachId) => {
    if (!window.confirm('Delete this outreach entry?')) return;
    try {
      await api.delete(`/bni/outreach/${outreachId}`);
      toast.success('Outreach entry deleted');
      loadOutreach();
    } catch (error) {
      toast.error('Failed to delete outreach entry');
    }
  };

  const importOutreach = async (rows) => {
    const normalizeCategoryText = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
    const results = await Promise.allSettled(rows.map((r) => {
      const catMatch = categories.find((c) => normalizeCategoryText(c.name) === normalizeCategoryText(r.category_name));
      return api.post('/bni/outreach', {
        ...emptyOutreachForm(),
        ...r,
        category_id: catMatch?.category_id || '',
      });
    }));
    const success = results.filter((r) => r.status === 'fulfilled').length;
    toast.success(`Imported ${success} of ${rows.length} outreach entries`);
    loadOutreach();
  };

  // Access control: Super Admin / Admin always get full access to every
  // tab. Everyone else is scoped by their designation's bni_tabs (empty =
  // all tabs) and bni_access ('view' hides Add/Edit/Delete/Import/Pin).
  const isPrivilegedRole = ['super_admin', 'admin'].includes((user?.role || '').toLowerCase());
  const allowedTabKeys = useMemo(() => {
    if (isPrivilegedRole) return null; // null = unrestricted
    const configured = myDesignation?.bni_tabs || [];
    return configured.length > 0 ? new Set(configured) : new Set(TABS.map((t) => t.key));
  }, [isPrivilegedRole, myDesignation]);
  const visibleTabs = useMemo(
    () => (allowedTabKeys ? TABS.filter((t) => allowedTabKeys.has(t.key)) : TABS),
    [allowedTabKeys]
  );
  const isViewOnly = !isPrivilegedRole && myDesignation?.bni_access === 'view';

  // If the active tab isn't visible to this user (e.g. their designation's
  // access changed), fall back to the first tab they can actually see.
  useEffect(() => {
    if (visibleTabs.length > 0 && !visibleTabs.find((t) => t.key === activeTab)) {
      setActiveTab(visibleTabs[0].key);
    }
  }, [visibleTabs, activeTab]);

  const categoryOptions = useMemo(
    () => categories.map((c) => ({ value: c.category_id, label: c.name })),
    [categories]
  );
  const rolePlayerOptions = useMemo(
    () => rolePlayers.map((r) => ({ value: r.role_player_id, label: r.name })),
    [rolePlayers]
  );

  const filteredMembers = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) => [
      m.name, m.business_name, m.category_name, m.role_player_name, m.phone, m.email, m.city,
    ].some((v) => (v || '').toLowerCase().includes(q)));
  }, [members, memberSearch]);
  const pinnedMembers = useMemo(() => filteredMembers.filter((m) => m.pinned), [filteredMembers]);
  const unpinnedMembers = useMemo(() => filteredMembers.filter((m) => !m.pinned), [filteredMembers]);

  const filteredCategories = useMemo(() => {
    const q = categorySearch.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter((c) => [c.name, c.description].some((v) => (v || '').toLowerCase().includes(q)));
  }, [categories, categorySearch]);

  // ---------- Members ----------

  const openAddMember = () => {
    setEditingMemberId(null);
    setMemberForm(emptyMemberForm());
    setShowMemberModal(true);
  };

  const openEditMember = (m) => {
    setEditingMemberId(m.member_id);
    setMemberForm({
      title: m.title || 'Mr',
      name: m.name || '',
      business_name: m.business_name || '',
      email: m.email || '',
      phone: m.phone || '',
      website: m.website || '',
      category_id: m.category_id || '',
      category_name: m.category_name || '',
      role_player_id: m.role_player_id || '',
      role_player_name: m.role_player_name || '',
      address: m.address || '',
      location_link: m.location_link || '',
      city: m.city || '',
    });
    setShowMemberModal(true);
  };

  const saveMember = async () => {
    if (!memberForm.name.trim()) {
      toast.error('Name is required');
      return;
    }
    try {
      if (editingMemberId) {
        await api.put(`/bni/members/${editingMemberId}`, memberForm);
        toast.success('Member updated');
      } else {
        await api.post('/bni/members', memberForm);
        toast.success('Member added');
      }
      setShowMemberModal(false);
      loadAll();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save member');
    }
  };

  const deleteMember = async (memberId) => {
    if (!window.confirm('Are you sure you want to delete this member?')) return;
    try {
      await api.delete(`/bni/members/${memberId}`);
      toast.success('Member deleted');
      loadAll();
    } catch (error) {
      toast.error('Failed to delete member');
    }
  };

  const togglePin = async (m) => {
    try {
      await api.put(`/bni/members/${m.member_id}`, { pinned: !m.pinned });
      loadAll();
    } catch (error) {
      toast.error('Failed to update pin');
    }
  };

  // ---------- Categories ----------

  const openAddCategory = () => {
    setEditingCategoryId(null);
    setCategoryForm(emptyNameDescForm());
    setShowCategoryModal(true);
  };

  const openEditCategory = (c) => {
    setEditingCategoryId(c.category_id);
    setCategoryForm({ name: c.name || '', description: c.description || '' });
    setShowCategoryModal(true);
  };

  const saveCategory = async () => {
    if (!categoryForm.name.trim()) {
      toast.error('Category name is required');
      return;
    }
    try {
      if (editingCategoryId) {
        await api.put(`/bni/categories/${editingCategoryId}`, categoryForm);
        toast.success('Category updated');
      } else {
        await api.post('/bni/categories', categoryForm);
        toast.success('Category added');
      }
      setShowCategoryModal(false);
      loadAll();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save category');
    }
  };

  // ---------- Role Players ----------

  const openAddRolePlayer = () => {
    setEditingRolePlayerId(null);
    setRolePlayerForm(emptyNameDescForm());
    setShowRolePlayerModal(true);
  };

  const openEditRolePlayer = (r) => {
    setEditingRolePlayerId(r.role_player_id);
    setRolePlayerForm({ name: r.name || '', description: r.description || '' });
    setShowRolePlayerModal(true);
  };

  const saveRolePlayer = async () => {
    if (!rolePlayerForm.name.trim()) {
      toast.error('Role player name is required');
      return;
    }
    try {
      if (editingRolePlayerId) {
        await api.put(`/bni/role-players/${editingRolePlayerId}`, rolePlayerForm);
        toast.success('Role player updated');
      } else {
        await api.post('/bni/role-players', rolePlayerForm);
        toast.success('Role player added');
      }
      setShowRolePlayerModal(false);
      loadAll();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save role player');
    }
  };

  // ---------- Chapter Settings ----------

  const openEditSettings = () => {
    setSettingsForm({ chapter_name: chapterSettings.chapter_name || '', region: chapterSettings.region || '' });
    setShowSettingsModal(true);
  };

  const saveSettings = async () => {
    try {
      const res = await api.put('/bni/settings', settingsForm);
      setChapterSettings(res.data);
      setShowSettingsModal(false);
      toast.success('Chapter details updated');
    } catch (error) {
      toast.error('Failed to update chapter details');
    }
  };

  // ---------- CSV Import ----------

  const importMembers = async (rows) => {
    const results = await Promise.allSettled(rows.map((r) => {
      const catMatch = categories.find((c) => c.name.toLowerCase() === (r.category_name || '').trim().toLowerCase());
      const roleMatch = rolePlayers.find((rp) => rp.name.toLowerCase() === (r.role_player_name || '').trim().toLowerCase());
      return api.post('/bni/members', {
        ...emptyMemberForm(),
        ...r,
        category_id: catMatch?.category_id || '',
        role_player_id: roleMatch?.role_player_id || '',
      });
    }));
    const success = results.filter((r) => r.status === 'fulfilled').length;
    toast.success(`Imported ${success} of ${rows.length} members`);
    loadAll();
  };

  const importCategories = async (rows) => {
    const results = await Promise.allSettled(
      rows.map((r) => api.post('/bni/categories', { name: r.name, description: r.description || '' }))
    );
    const success = results.filter((r) => r.status === 'fulfilled').length;
    toast.success(`Imported ${success} of ${rows.length} categories`);
    loadAll();
  };

  const importRolePlayers = async (rows) => {
    const results = await Promise.allSettled(
      rows.map((r) => api.post('/bni/role-players', { name: r.name, description: r.description || '' }))
    );
    const success = results.filter((r) => r.status === 'fulfilled').length;
    toast.success(`Imported ${success} of ${rows.length} role players`);
    loadAll();
  };

  const renderMemberRow = (m) => {
    const catColor = tagColor(m.category_id || m.category_name);
    const roleColor = tagColor(m.role_player_id || m.role_player_name);
    return (
      <tr key={m.member_id} className={`${bgCard} hover:${bgSecondary} transition-colors`}>
        <td className="px-3 py-3">
          {isViewOnly ? (
            m.pinned ? <Pin className="h-4 w-4 text-amber-500 fill-current" /> : null
          ) : (
            <button
              type="button"
              onClick={() => togglePin(m)}
              className={m.pinned ? 'text-amber-500' : textSecondary}
              title={m.pinned ? 'Unpin' : 'Pin'}
              data-testid={`bni-member-pin-${m.member_id}`}
            >
              {m.pinned ? <Pin className="h-4 w-4 fill-current" /> : <PinOff className="h-4 w-4" />}
            </button>
          )}
        </td>
        <td className={`px-4 py-3 ${textPrimary} font-medium`}>
          {m.title ? `${m.title}. ` : ''}{m.name}
        </td>
        <td className={`px-4 py-3 ${textSecondary}`}>{m.business_name || '—'}</td>
        <td className="px-4 py-3">
          {m.category_name ? (
            <Badge className={`${catColor.bg} ${catColor.text} border ${catColor.border} font-semibold`}>
              {m.category_name}
            </Badge>
          ) : (
            <span className={textSecondary}>—</span>
          )}
        </td>
        <td className={`px-4 py-3 ${textSecondary}`}>{m.phone || '—'}</td>
        <td className={`px-4 py-3 ${textSecondary}`}>{m.email || '—'}</td>
        <td className={`px-4 py-3 ${textSecondary}`}>{m.city || '—'}</td>
        <td className="px-4 py-3">
          {m.role_player_name ? (
            <Badge className={`${roleColor.bg} ${roleColor.text} border ${roleColor.border} font-semibold`}>
              {m.role_player_name}
            </Badge>
          ) : (
            <span className={textSecondary}>—</span>
          )}
        </td>
        <td className="px-4 py-3">
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" className="text-[#6366f1]" onClick={() => setViewingMember(m)} data-testid={`bni-member-view-${m.member_id}`}>
              <Eye className="h-4 w-4" />
            </Button>
            {!isViewOnly && (
              <>
                <Button variant="ghost" size="sm" onClick={() => openEditMember(m)} data-testid={`bni-member-edit-${m.member_id}`}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" className="text-[#ef4444]" onClick={() => deleteMember(m.member_id)} data-testid={`bni-member-delete-${m.member_id}`}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </td>
      </tr>
    );
  };

  return (
    <Layout>
      <div className="space-y-6" data-testid="bni-page">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className={`text-3xl font-bold ${textPrimary}`} style={{ fontFamily: 'Plus Jakarta Sans' }}>
                {chapterSettings.chapter_name || 'BNI'}
              </h1>
              {!isViewOnly && (
                <button
                  type="button"
                  onClick={openEditSettings}
                  className={textSecondary}
                  title="Edit chapter name & region"
                  data-testid="bni-edit-chapter-btn"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className={`text-sm ${textSecondary} flex items-center gap-2 flex-wrap mt-1`}>
              {chapterSettings.region && <span>{chapterSettings.region}</span>}
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${bgSecondary} ${textPrimary} text-xs font-semibold`}
                data-testid="bni-member-count"
              >
                <Users className="h-3 w-3" /> {members.length} Members
              </span>
            </div>
          </div>
          {activeTab === 'members' && !isViewOnly && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowMemberImport(true)} data-testid="bni-import-member-btn">
                <Upload className="h-4 w-4 mr-2" /> Import CSV
              </Button>
              <Button onClick={openAddMember} className="bg-[#6366f1] hover:bg-[#4f46e5] text-white" data-testid="bni-add-member-btn">
                <Plus className="h-4 w-4 mr-2" /> Add Member
              </Button>
            </div>
          )}
          {activeTab === 'category' && !isViewOnly && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowCategoryImport(true)} data-testid="bni-import-category-btn">
                <Upload className="h-4 w-4 mr-2" /> Import CSV
              </Button>
              <Button onClick={openAddCategory} className="bg-[#6366f1] hover:bg-[#4f46e5] text-white" data-testid="bni-add-category-btn">
                <Plus className="h-4 w-4 mr-2" /> Add Category
              </Button>
            </div>
          )}
          {activeTab === 'role_players' && !isViewOnly && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowRolePlayerImport(true)} data-testid="bni-import-role-player-btn">
                <Upload className="h-4 w-4 mr-2" /> Import CSV
              </Button>
              <Button onClick={openAddRolePlayer} className="bg-[#6366f1] hover:bg-[#4f46e5] text-white" data-testid="bni-add-role-player-btn">
                <Plus className="h-4 w-4 mr-2" /> Add Role Player
              </Button>
            </div>
          )}
          {activeTab === 'one_to_one' && !isViewOnly && (
            <Button onClick={openNewOto} className="bg-[#6366f1] hover:bg-[#4f46e5] text-white" data-testid="bni-add-oto-btn">
              <Plus className="h-4 w-4 mr-2" /> New One-to-One
            </Button>
          )}
          {activeTab === 'my_gives' && !isViewOnly && (
            <Button onClick={openNewGive} className="bg-[#6366f1] hover:bg-[#4f46e5] text-white" data-testid="bni-add-give-btn">
              <Plus className="h-4 w-4 mr-2" /> Add Give
            </Button>
          )}
          {activeTab === 'outreach' && !isViewOnly && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowOutreachImport(true)} data-testid="bni-import-outreach-btn">
                <Upload className="h-4 w-4 mr-2" /> Import CSV
              </Button>
              <Button onClick={openAddOutreach} className="bg-[#6366f1] hover:bg-[#4f46e5] text-white" data-testid="bni-add-outreach-btn">
                <Plus className="h-4 w-4 mr-2" /> Add New
              </Button>
            </div>
          )}
        </div>

        {/* Tab bar */}
        <div className="flex flex-wrap gap-2">
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                data-testid={`bni-tab-${tab.key.replace(/_/g, '-')}`}
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

        {loading ? (
          <div className={`text-center py-12 ${textSecondary}`}>Loading…</div>
        ) : (
          <>
            {activeTab === 'members' && (
              <div className="space-y-3">
                <div className="relative max-w-sm">
                  <Search className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ${textSecondary}`} />
                  <Input
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    placeholder="Search members…"
                    className={`pl-9 ${bgSecondary} border ${borderColor} ${textPrimary}`}
                    data-testid="bni-member-search"
                  />
                </div>
                <div className={`${bgCard} border ${borderColor} rounded-xl overflow-hidden`}>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className={bgSecondary}>
                      <tr>
                        <th className={`px-3 py-3 text-left font-medium ${textSecondary}`}></th>
                        <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Name</th>
                        <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Business Name</th>
                        <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Category</th>
                        <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Phone</th>
                        <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Email</th>
                        <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>City</th>
                        <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Role Player</th>
                        <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Actions</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${borderColor}`}>
                      {filteredMembers.length === 0 ? (
                        <tr>
                          <td colSpan={9} className={`px-4 py-8 text-center ${textSecondary}`}>
                            {members.length === 0
                              ? 'No members yet — click "Add Member" to add the first one.'
                              : 'No members match your search.'}
                          </td>
                        </tr>
                      ) : (
                        <>
                          {pinnedMembers.length > 0 && (
                            <tr className={bgSecondary}>
                              <td colSpan={9} className={`px-4 py-1.5 text-xs font-semibold tracking-wide ${textSecondary}`}>
                                📌 PINNED
                              </td>
                            </tr>
                          )}
                          {pinnedMembers.map(renderMemberRow)}
                          {pinnedMembers.length > 0 && unpinnedMembers.length > 0 && (
                            <tr className={bgSecondary}>
                              <td colSpan={9} className={`px-4 py-1.5 text-xs font-semibold tracking-wide ${textSecondary}`}>
                                MEMBERS
                              </td>
                            </tr>
                          )}
                          {unpinnedMembers.map(renderMemberRow)}
                        </>
                      )}
                    </tbody>
                  </table>
                </div>
                </div>
              </div>
            )}

            {activeTab === 'category' && (
              <div className="space-y-3">
                <div className="relative max-w-sm">
                  <Search className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ${textSecondary}`} />
                  <Input
                    value={categorySearch}
                    onChange={(e) => setCategorySearch(e.target.value)}
                    placeholder="Search categories…"
                    className={`pl-9 ${bgSecondary} border ${borderColor} ${textPrimary}`}
                    data-testid="bni-category-search"
                  />
                </div>
                <div className={`${bgCard} border ${borderColor} rounded-xl overflow-hidden`}>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className={bgSecondary}>
                      <tr>
                        <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Category Name</th>
                        <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Description</th>
                        <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Actions</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${borderColor}`}>
                      {filteredCategories.length === 0 ? (
                        <tr>
                          <td colSpan={3} className={`px-4 py-8 text-center ${textSecondary}`}>
                            {categories.length === 0
                              ? 'No categories yet — click "Add Category" to add the first one.'
                              : 'No categories match your search.'}
                          </td>
                        </tr>
                      ) : (
                        filteredCategories.map((c) => {
                          const color = tagColor(c.category_id);
                          return (
                            <tr key={c.category_id} className={`${bgCard} hover:${bgSecondary} transition-colors`}>
                              <td className="px-4 py-3">
                                <Badge className={`${color.bg} ${color.text} border ${color.border} font-semibold`}>{c.name}</Badge>
                              </td>
                              <td className={`px-4 py-3 ${textSecondary}`}>{c.description || '—'}</td>
                              <td className="px-4 py-3">
                                {!isViewOnly && (
                                  <Button variant="ghost" size="sm" onClick={() => openEditCategory(c)} data-testid={`bni-category-edit-${c.category_id}`}>
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
                </div>
              </div>
            )}

            {activeTab === 'role_players' && (
              <div className={`${bgCard} border ${borderColor} rounded-xl overflow-hidden`}>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className={bgSecondary}>
                      <tr>
                        <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Role Player Name</th>
                        <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Description</th>
                        <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Actions</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${borderColor}`}>
                      {rolePlayers.length === 0 ? (
                        <tr>
                          <td colSpan={3} className={`px-4 py-8 text-center ${textSecondary}`}>
                            No role players yet — click "Add Role Player" to add the first one.
                          </td>
                        </tr>
                      ) : (
                        rolePlayers.map((r) => {
                          const color = tagColor(r.role_player_id);
                          return (
                            <tr key={r.role_player_id} className={`${bgCard} hover:${bgSecondary} transition-colors`}>
                              <td className="px-4 py-3">
                                <Badge className={`${color.bg} ${color.text} border ${color.border} font-semibold`}>{r.name}</Badge>
                              </td>
                              <td className={`px-4 py-3 ${textSecondary}`}>{r.description || '—'}</td>
                              <td className="px-4 py-3">
                                {!isViewOnly && (
                                  <Button variant="ghost" size="sm" onClick={() => openEditRolePlayer(r)} data-testid={`bni-role-player-edit-${r.role_player_id}`}>
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                )}
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

            {activeTab === 'payment_history' && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant={phAllTime ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setPhAllTime(true)}
                    className={phAllTime ? 'bg-[#6366f1] hover:bg-[#4f46e5] text-white' : ''}
                    data-testid="bni-ph-all-time"
                  >
                    All Time
                  </Button>
                  <Select value={String(phMonth)} onValueChange={(v) => { setPhMonth(parseInt(v, 10)); setPhAllTime(false); }}>
                    <SelectTrigger className={`w-[140px] ${bgSecondary} border ${borderColor} ${textPrimary}`} data-testid="bni-ph-month">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTHS.map((m) => (
                        <SelectItem key={m.v} value={String(m.v)}>{m.l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={String(phYear)} onValueChange={(v) => { setPhYear(parseInt(v, 10)); setPhAllTime(false); }}>
                    <SelectTrigger className={`w-[100px] ${bgSecondary} border ${borderColor} ${textPrimary}`} data-testid="bni-ph-year">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[...Array(6)].map((_, i) => {
                        const y = today.getFullYear() - 3 + i;
                        return <SelectItem key={y} value={String(y)}>{y}</SelectItem>;
                      })}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className={`${bgCard} border ${borderColor} rounded-xl p-4`}>
                    <p className={`text-xs ${textSecondary}`}>
                      Total Paid{phAllTime ? ' (All Time)' : ` — ${MONTHS[phMonth - 1].l} ${phYear}`}
                    </p>
                    <p className="text-2xl font-bold text-[#10b981]" data-testid="bni-ph-total">
                      ₹{Number(paymentHistory.summary?.total_amount || 0).toLocaleString('en-IN')}
                    </p>
                  </div>
                  <div className={`${bgCard} border ${borderColor} rounded-xl p-4`}>
                    <p className={`text-xs ${textSecondary}`}>Payments</p>
                    <p className={`text-2xl font-bold ${textPrimary}`} data-testid="bni-ph-count">
                      {paymentHistory.summary?.count || 0}
                    </p>
                  </div>
                </div>

                {!paymentHistory.has_bni_category && (
                  <div className={`${bgCard} border ${borderColor} rounded-xl p-4 text-sm ${textSecondary}`}>
                    No "BNI" sub-category found under Finance → Expense → Expense Split yet. Add one (e.g. under Marketing) and record an expense against it to see payments here.
                  </div>
                )}

                <div className={`${bgCard} border ${borderColor} rounded-xl overflow-hidden`}>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className={bgSecondary}>
                        <tr>
                          <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Date</th>
                          <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Paid To</th>
                          <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Amount</th>
                          <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Payment Mode</th>
                          <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Notes</th>
                        </tr>
                      </thead>
                      <tbody className={`divide-y ${borderColor}`}>
                        {phLoading ? (
                          <tr><td colSpan={5} className={`px-4 py-8 text-center ${textSecondary}`}>Loading…</td></tr>
                        ) : paymentHistory.entries.length === 0 ? (
                          <tr>
                            <td colSpan={5} className={`px-4 py-8 text-center ${textSecondary}`}>
                              No BNI payments recorded{phAllTime ? '' : ' for this period'}.
                            </td>
                          </tr>
                        ) : (
                          paymentHistory.entries.map((e) => (
                            <tr key={e.entry_id} className={`${bgCard} hover:${bgSecondary} transition-colors`}>
                              <td className={`px-4 py-3 ${textSecondary}`}>{e.date || '—'}</td>
                              <td className={`px-4 py-3 ${textPrimary}`}>{e.to || '—'}</td>
                              <td className={`px-4 py-3 ${textPrimary} font-medium`}>₹{Number(e.amount || 0).toLocaleString('en-IN')}</td>
                              <td className={`px-4 py-3 ${textSecondary} capitalize`}>{e.bank_label || e.payment_mode || '—'}</td>
                              <td className={`px-4 py-3 ${textSecondary}`}>{e.notes || '—'}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'weekly_meeting' && (
              <div className={`${bgCard} border ${borderColor} rounded-xl overflow-hidden`}>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className={bgSecondary}>
                      <tr>
                        <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Week</th>
                        <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Date</th>
                        <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Location</th>
                        <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}></th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${borderColor}`}>
                      {wmLoading ? (
                        <tr><td colSpan={4} className={`px-4 py-8 text-center ${textSecondary}`}>Loading…</td></tr>
                      ) : weeklyMeetings.length === 0 ? (
                        <tr>
                          <td colSpan={4} className={`px-4 py-8 text-center ${textSecondary}`}>No weeks yet.</td>
                        </tr>
                      ) : (
                        weeklyMeetings.map((w, idx) => {
                          const isUpcoming = idx === 0; // sorted newest-first — the top row is the current/next Friday
                          return (
                            <tr
                              key={w.meeting_id}
                              className={`transition-colors cursor-pointer ${isUpcoming ? 'bg-[#6366f1]/10 hover:bg-[#6366f1]/15' : `${bgCard} hover:${bgSecondary} opacity-60`}`}
                              onClick={() => navigate(`/bni/weekly-meeting/${w.meeting_id}`)}
                              data-testid={`bni-week-row-${w.week_number}`}
                            >
                              <td className={`px-4 py-3 font-medium ${isUpcoming ? 'text-[#6366f1]' : textPrimary}`}>
                                Week {w.week_number}{isUpcoming && <span className="ml-2 text-xs font-normal">Upcoming</span>}
                              </td>
                              <td className={`px-4 py-3 ${textSecondary}`}>
                                {new Date(w.meeting_date).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
                              </td>
                              <td className={`px-4 py-3 ${textSecondary}`}>{w.location || '—'}</td>
                              <td className="px-4 py-3 text-right">
                                <ChevronRight className={`h-4 w-4 inline ${textSecondary}`} />
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

            {activeTab === 'give_ask' && (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <button
                    onClick={() => setGaView('gives')}
                    className={`px-4 py-2 text-sm font-medium rounded-lg border ${gaView === 'gives' ? 'bg-[#6366f1] text-white border-transparent' : `${bgCard} ${textSecondary} ${borderColor}`}`}
                    data-testid="bni-ga-view-gives"
                  >
                    Gives ({gives.length})
                  </button>
                  <button
                    onClick={() => setGaView('asks')}
                    className={`px-4 py-2 text-sm font-medium rounded-lg border ${gaView === 'asks' ? 'bg-[#6366f1] text-white border-transparent' : `${bgCard} ${textSecondary} ${borderColor}`}`}
                    data-testid="bni-ga-view-asks"
                  >
                    Asks ({asks.length})
                  </button>
                </div>

                <div className={`${bgCard} border ${borderColor} rounded-xl overflow-hidden`}>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className={bgSecondary}>
                        <tr>
                          <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>{gaView === 'gives' ? 'Give' : 'Ask'}</th>
                          <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Member Name</th>
                          <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Date</th>
                          <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Status</th>
                        </tr>
                      </thead>
                      <tbody className={`divide-y ${borderColor}`}>
                        {gaLoading ? (
                          <tr><td colSpan={4} className={`px-4 py-8 text-center ${textSecondary}`}>Loading…</td></tr>
                        ) : (gaView === 'gives' ? gives : asks).length === 0 ? (
                          <tr>
                            <td colSpan={4} className={`px-4 py-8 text-center ${textSecondary}`}>
                              No {gaView === 'gives' ? 'gives' : 'asks'} recorded yet — add them from a week's Give and Ask tab.
                            </td>
                          </tr>
                        ) : (
                          (gaView === 'gives' ? gives : asks).map((g) => {
                            const statusField = gaView === 'gives' ? 'give_status' : 'ask_status';
                            return (
                              <tr key={g.entry_id} className={`${bgCard} hover:${bgSecondary} transition-colors`}>
                                <td className={`px-4 py-3 ${textPrimary}`}>{gaView === 'gives' ? g.give : g.ask}</td>
                                <td className={`px-4 py-3 ${textSecondary}`}>{g.member_name}</td>
                                <td className={`px-4 py-3 ${textSecondary}`}>
                                  {g.meeting_date ? new Date(g.meeting_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                                </td>
                                <td className="px-4 py-3">
                                  <Select value={g[statusField] || 'none'} onValueChange={(v) => updateGiveAskStatus(g.entry_id, statusField, v === 'none' ? '' : v)}>
                                    <SelectTrigger className={`w-[160px] ${bgSecondary} border ${borderColor} ${textPrimary}`} data-testid={`bni-ga-status-${g.entry_id}`}>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="none">— Set status —</SelectItem>
                                      {GIVE_ASK_STATUSES.map((s) => (
                                        <SelectItem key={s} value={s}>{s}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'my_gives' && (
              <div className={`${bgCard} border ${borderColor} rounded-xl overflow-hidden`}>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className={bgSecondary}>
                      <tr>
                        <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Business Person</th>
                        <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Company</th>
                        <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Industry</th>
                        <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Assigned Week</th>
                        <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Given To</th>
                        <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Actions</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${borderColor}`}>
                      {mgLoading ? (
                        <tr><td colSpan={6} className={`px-4 py-8 text-center ${textSecondary}`}>Loading…</td></tr>
                      ) : myGives.length === 0 ? (
                        <tr>
                          <td colSpan={6} className={`px-4 py-8 text-center ${textSecondary}`}>
                            No gives yet — click "Add Give" to log the first business opportunity.
                          </td>
                        </tr>
                      ) : (
                        myGives.map((g) => (
                          <tr key={g.give_id} className={`${bgCard} hover:${bgSecondary} transition-colors`}>
                            <td className={`px-4 py-3 font-medium ${textPrimary} cursor-pointer`} onClick={() => navigate(`/bni/my-gives/${g.give_id}`)}>
                              {g.business_person_name}
                            </td>
                            <td className={`px-4 py-3 ${textSecondary}`}>{g.company_name || '—'}</td>
                            <td className={`px-4 py-3 ${textSecondary}`}>{g.industry || '—'}</td>
                            <td className="px-4 py-3">
                              {assigningGiveId === g.give_id ? (
                                <Select value="" onValueChange={(v) => assignGiveWeek(g.give_id, v)}>
                                  <SelectTrigger className={`w-[180px] ${bgSecondary} border ${borderColor} ${textPrimary}`} data-testid={`bni-give-week-select-${g.give_id}`}>
                                    <SelectValue placeholder="Select week" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {weeklyMeetings.map((w) => (
                                      <SelectItem key={w.meeting_id} value={w.meeting_id}>
                                        Week {w.week_number} — {new Date(w.meeting_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : g.assigned_week_number ? (
                                <Badge
                                  className="bg-[#6366f1]/15 text-[#6366f1] border border-[#6366f1]/40 cursor-pointer"
                                  onClick={() => setAssigningGiveId(g.give_id)}
                                >
                                  Week {g.assigned_week_number}
                                </Badge>
                              ) : (
                                <Button variant="outline" size="sm" onClick={() => setAssigningGiveId(g.give_id)} data-testid={`bni-give-assign-week-btn-${g.give_id}`}>
                                  Add to Weekly Presentation
                                </Button>
                              )}
                            </td>
                            <td className={`px-4 py-3 ${textSecondary}`}>{g.recipient_count || 0} member{g.recipient_count === 1 ? '' : 's'}</td>
                            <td className="px-4 py-3">
                              <div className="flex gap-1">
                                <Button variant="ghost" size="sm" onClick={() => navigate(`/bni/my-gives/${g.give_id}`)} data-testid={`bni-give-open-${g.give_id}`}>
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="sm" className="text-[#ef4444]" onClick={() => deleteMyGive(g.give_id)} data-testid={`bni-give-delete-${g.give_id}`}>
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

            {activeTab === 'outreach' && (
              <div className={`${bgCard} border ${borderColor} rounded-xl overflow-hidden`}>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className={bgSecondary}>
                      <tr>
                        <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Name</th>
                        <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Brand Name</th>
                        <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Chapter Name</th>
                        <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Email</th>
                        <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Profile Link</th>
                        <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Phone</th>
                        <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Website</th>
                        <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Status</th>
                        <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Location</th>
                        <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Category</th>
                        <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Actions</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${borderColor}`}>
                      {ouLoading ? (
                        <tr><td colSpan={11} className={`px-4 py-8 text-center ${textSecondary}`}>Loading…</td></tr>
                      ) : outreach.length === 0 ? (
                        <tr>
                          <td colSpan={11} className={`px-4 py-8 text-center ${textSecondary}`}>
                            No outreach entries yet — click "Add New" or "Import CSV" to get started.
                          </td>
                        </tr>
                      ) : (
                        outreach.map((o) => (
                          <tr key={o.outreach_id} className={`${bgCard} hover:${bgSecondary} transition-colors`}>
                            <td className={`px-4 py-3 font-medium ${textPrimary}`}>{o.name}</td>
                            <td className={`px-4 py-3 ${textSecondary}`}>{o.brand_name || '—'}</td>
                            <td className={`px-4 py-3 ${textSecondary}`}>{o.chapter_name || '—'}</td>
                            <td className={`px-4 py-3 ${textSecondary}`}>{o.email || '—'}</td>
                            <td className="px-4 py-3">
                              {o.profile_link ? (
                                <a href={o.profile_link} target="_blank" rel="noopener noreferrer" className="text-[#6366f1] hover:underline flex items-center gap-1">
                                  <LinkIcon className="h-3.5 w-3.5" /> View
                                </a>
                              ) : '—'}
                            </td>
                            <td className={`px-4 py-3 ${textSecondary}`}>{o.phone || '—'}</td>
                            <td className={`px-4 py-3 ${textSecondary}`}>{o.website || '—'}</td>
                            <td className="px-4 py-3">
                              <Select value={o.status || 'To do'} onValueChange={(v) => updateOutreachStatus(o.outreach_id, v)}>
                                <SelectTrigger className={`w-[150px] ${bgSecondary} border ${borderColor} ${textPrimary}`} data-testid={`bni-outreach-status-${o.outreach_id}`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {OUTREACH_STATUSES.map((s) => (
                                    <SelectItem key={s} value={s}>{s}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </td>
                            <td className={`px-4 py-3 ${textSecondary}`}>{o.location || '—'}</td>
                            <td className={`px-4 py-3 ${textSecondary}`}>{o.category_name || '—'}</td>
                            <td className="px-4 py-3">
                              <div className="flex gap-1">
                                <Button variant="ghost" size="sm" onClick={() => openEditOutreach(o)} data-testid={`bni-outreach-edit-${o.outreach_id}`}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="sm" className="text-[#ef4444]" onClick={() => deleteOutreach(o.outreach_id)} data-testid={`bni-outreach-delete-${o.outreach_id}`}>
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

            {activeTab === 'one_to_one' && (
              <div className={`${bgCard} border ${borderColor} rounded-xl overflow-hidden`}>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className={bgSecondary}>
                      <tr>
                        <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Member</th>
                        <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Meeting Date</th>
                        <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Time</th>
                        <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Location</th>
                        <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Invited By</th>
                        <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Status</th>
                        <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Actions</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${borderColor}`}>
                      {ooLoading ? (
                        <tr><td colSpan={7} className={`px-4 py-8 text-center ${textSecondary}`}>Loading…</td></tr>
                      ) : oneToOnes.length === 0 ? (
                        <tr>
                          <td colSpan={7} className={`px-4 py-8 text-center ${textSecondary}`}>
                            No One-to-Ones yet — click "New One-to-One" to schedule the first one.
                          </td>
                        </tr>
                      ) : (
                        oneToOnes.map((o) => (
                          <tr key={o.entry_id} className={`${bgCard} hover:${bgSecondary} transition-colors`}>
                            <td className={`px-4 py-3 font-medium ${textPrimary}`}>{o.member_name}</td>
                            <td className="px-4 py-3">
                              <Badge className="bg-[#6366f1]/15 text-[#6366f1] border border-[#6366f1]/40 font-semibold">
                                {o.meeting_date ? new Date(o.meeting_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                              </Badge>
                            </td>
                            <td className={`px-4 py-3 ${textSecondary}`}>{o.meeting_time || '—'}</td>
                            <td className={`px-4 py-3 ${textSecondary}`}>{o.location || '—'}</td>
                            <td className={`px-4 py-3 ${textSecondary}`}>{o.invited_by === 'me' ? 'Me' : o.member_name}</td>
                            <td className="px-4 py-3">
                              {o.status ? (
                                <Badge className={
                                  o.status === 'Lead'
                                    ? 'bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/40'
                                    : o.status === 'Relationship'
                                    ? 'bg-[#8b5cf6]/15 text-[#8b5cf6] border border-[#8b5cf6]/40'
                                    : 'bg-[#f59e0b]/15 text-[#f59e0b] border border-[#f59e0b]/40'
                                }>
                                  {o.status}
                                </Badge>
                              ) : (
                                <Badge className="bg-[#71717a]/15 text-[#71717a] border border-[#71717a]/40">
                                  Scheduled
                                </Badge>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex gap-1">
                                <Button variant="ghost" size="sm" onClick={() => openEditOto(o)} title="Edit" data-testid={`bni-oto-edit-${o.entry_id}`}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => openReschedule(o)} title="Reschedule" data-testid={`bni-oto-reschedule-${o.entry_id}`}>
                                  <RotateCcw className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => openOtoRemarks(o)} title="Remarks" data-testid={`bni-oto-remarks-${o.entry_id}`}>
                                  <MessageSquare className="h-4 w-4" />
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

            {!['members', 'category', 'role_players', 'payment_history', 'weekly_meeting', 'give_ask', 'my_gives', 'one_to_one', 'outreach'].includes(activeTab) && (() => {
              const tab = TABS.find((t) => t.key === activeTab);
              const Icon = tab?.icon || Star;
              return (
                <div className={`${bgCard} border ${borderColor} rounded-xl p-12 text-center`}>
                  <Icon className={`h-10 w-10 mx-auto mb-3 ${textSecondary}`} />
                  <p className={`font-medium ${textPrimary}`}>{tab?.label} — coming soon</p>
                  <p className={`text-sm ${textSecondary} mt-1`}>Let us know what fields/workflow you need here and we'll build it out.</p>
                </div>
              );
            })()}
          </>
        )}

        {/* Add/Edit Member Modal */}
        <Dialog open={showMemberModal} onOpenChange={setShowMemberModal}>
          <DialogContent className={`${bgCard} max-w-lg max-h-[90vh] overflow-y-auto`}>
            <DialogHeader>
              <DialogTitle className={textPrimary}>{editingMemberId ? 'Edit Member' : 'Add Member'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className={textPrimary}>Title</Label>
                  <Select value={memberForm.title} onValueChange={(v) => setMemberForm((p) => ({ ...p, title: v }))}>
                    <SelectTrigger className={`${bgSecondary} border ${borderColor} ${textPrimary}`} data-testid="bni-member-title">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TITLE_OPTIONS.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Label className={textPrimary}>Name <span className="text-red-500">*</span></Label>
                  <Input
                    value={memberForm.name}
                    onChange={(e) => setMemberForm((p) => ({ ...p, name: e.target.value }))}
                    className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                    data-testid="bni-member-name"
                  />
                </div>
              </div>
              <div>
                <Label className={textPrimary}>Business Name</Label>
                <Input
                  value={memberForm.business_name}
                  onChange={(e) => setMemberForm((p) => ({ ...p, business_name: e.target.value }))}
                  className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                  data-testid="bni-member-business-name"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className={textPrimary}>Email</Label>
                  <Input
                    type="email"
                    value={memberForm.email}
                    onChange={(e) => setMemberForm((p) => ({ ...p, email: e.target.value }))}
                    className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                    data-testid="bni-member-email"
                  />
                </div>
                <div>
                  <Label className={textPrimary}>Phone Number</Label>
                  <Input
                    value={memberForm.phone}
                    onChange={(e) => setMemberForm((p) => ({ ...p, phone: e.target.value }))}
                    className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                    data-testid="bni-member-phone"
                  />
                </div>
              </div>
              <div>
                <Label className={textPrimary}>Website</Label>
                <Input
                  value={memberForm.website}
                  onChange={(e) => setMemberForm((p) => ({ ...p, website: e.target.value }))}
                  placeholder="https://…"
                  className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                  data-testid="bni-member-website"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className={textPrimary}>Category</Label>
                  <Combobox
                    value={memberForm.category_name}
                    onChange={(v) => {
                      const match = categories.find((c) => c.name === v);
                      setMemberForm((p) => ({ ...p, category_name: v, category_id: match?.category_id || '' }));
                    }}
                    options={categoryOptions}
                    placeholder="Search category"
                    className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                    data-testid="bni-member-category"
                  />
                </div>
                <div>
                  <Label className={textPrimary}>Role Player</Label>
                  <Combobox
                    value={memberForm.role_player_name}
                    onChange={(v) => {
                      const match = rolePlayers.find((r) => r.name === v);
                      setMemberForm((p) => ({ ...p, role_player_name: v, role_player_id: match?.role_player_id || '' }));
                    }}
                    options={rolePlayerOptions}
                    placeholder="Search role player"
                    className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                    data-testid="bni-member-role-player"
                  />
                </div>
              </div>
              <div>
                <Label className={textPrimary}>Address</Label>
                <Textarea
                  value={memberForm.address}
                  onChange={(e) => setMemberForm((p) => ({ ...p, address: e.target.value }))}
                  rows={2}
                  className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                  data-testid="bni-member-address"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className={textPrimary}>Location Link</Label>
                  <Input
                    value={memberForm.location_link}
                    onChange={(e) => setMemberForm((p) => ({ ...p, location_link: e.target.value }))}
                    placeholder="Google Maps link"
                    className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                    data-testid="bni-member-location-link"
                  />
                </div>
                <div>
                  <Label className={textPrimary}>City</Label>
                  <Input
                    value={memberForm.city}
                    onChange={(e) => setMemberForm((p) => ({ ...p, city: e.target.value }))}
                    className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                    data-testid="bni-member-city"
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setShowMemberModal(false)}>Cancel</Button>
              <Button onClick={saveMember} className="bg-[#6366f1] hover:bg-[#4f46e5] text-white" data-testid="bni-member-save">
                {editingMemberId ? 'Save Changes' : 'Add Member'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* View Member Modal */}
        <Dialog open={!!viewingMember} onOpenChange={(open) => !open && setViewingMember(null)}>
          <DialogContent className={`${bgCard} max-w-md`}>
            <DialogHeader>
              <DialogTitle className={textPrimary}>
                {viewingMember?.title ? `${viewingMember.title}. ` : ''}{viewingMember?.name}
              </DialogTitle>
            </DialogHeader>
            {viewingMember && (
              <div className="space-y-3 text-sm">
                <div className="flex flex-wrap gap-2">
                  {viewingMember.category_name && (
                    <Badge className={`${tagColor(viewingMember.category_id || viewingMember.category_name).bg} ${tagColor(viewingMember.category_id || viewingMember.category_name).text} border ${tagColor(viewingMember.category_id || viewingMember.category_name).border} font-semibold`}>
                      {viewingMember.category_name}
                    </Badge>
                  )}
                  {viewingMember.role_player_name && (
                    <Badge className={`${tagColor(viewingMember.role_player_id || viewingMember.role_player_name).bg} ${tagColor(viewingMember.role_player_id || viewingMember.role_player_name).text} border ${tagColor(viewingMember.role_player_id || viewingMember.role_player_name).border} font-semibold`}>
                      {viewingMember.role_player_name}
                    </Badge>
                  )}
                </div>
                {viewingMember.business_name && (
                  <p className={textPrimary}>{viewingMember.business_name}</p>
                )}
                {viewingMember.email && (
                  <p className={`flex items-center gap-2 ${textSecondary}`}><Mail className="h-4 w-4" /> {viewingMember.email}</p>
                )}
                {viewingMember.phone && (
                  <p className={`flex items-center gap-2 ${textSecondary}`}><Phone className="h-4 w-4" /> {viewingMember.phone}</p>
                )}
                {viewingMember.website && (
                  <a
                    href={viewingMember.website}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 text-[#6366f1] hover:underline"
                  >
                    <Globe className="h-4 w-4" /> {viewingMember.website}
                  </a>
                )}
                {viewingMember.address && (
                  <p className={`flex items-start gap-2 ${textSecondary}`}><MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" /> {viewingMember.address}{viewingMember.city ? `, ${viewingMember.city}` : ''}</p>
                )}
                {viewingMember.location_link && (
                  <a
                    href={viewingMember.location_link}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 text-[#6366f1] hover:underline"
                  >
                    <LinkIcon className="h-4 w-4" /> Open location
                  </a>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Add/Edit Category Modal */}
        <Dialog open={showCategoryModal} onOpenChange={setShowCategoryModal}>
          <DialogContent className={`${bgCard} max-w-md`}>
            <DialogHeader>
              <DialogTitle className={textPrimary}>{editingCategoryId ? 'Edit Category' : 'Add Category'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className={textPrimary}>Category Name <span className="text-red-500">*</span></Label>
                <Input
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm((p) => ({ ...p, name: e.target.value }))}
                  className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                  data-testid="bni-category-name"
                />
              </div>
              <div>
                <Label className={textPrimary}>Description</Label>
                <Textarea
                  value={categoryForm.description}
                  onChange={(e) => setCategoryForm((p) => ({ ...p, description: e.target.value }))}
                  rows={3}
                  className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                  data-testid="bni-category-description"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setShowCategoryModal(false)}>Cancel</Button>
              <Button onClick={saveCategory} className="bg-[#6366f1] hover:bg-[#4f46e5] text-white" data-testid="bni-category-save">
                {editingCategoryId ? 'Save Changes' : 'Add Category'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add/Edit Role Player Modal */}
        <Dialog open={showRolePlayerModal} onOpenChange={setShowRolePlayerModal}>
          <DialogContent className={`${bgCard} max-w-md`}>
            <DialogHeader>
              <DialogTitle className={textPrimary}>{editingRolePlayerId ? 'Edit Role Player' : 'Add Role Player'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className={textPrimary}>Role Player Name <span className="text-red-500">*</span></Label>
                <Input
                  value={rolePlayerForm.name}
                  onChange={(e) => setRolePlayerForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. President, Visitor Host"
                  className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                  data-testid="bni-role-player-name"
                />
              </div>
              <div>
                <Label className={textPrimary}>Description</Label>
                <Textarea
                  value={rolePlayerForm.description}
                  onChange={(e) => setRolePlayerForm((p) => ({ ...p, description: e.target.value }))}
                  rows={3}
                  className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                  data-testid="bni-role-player-description"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setShowRolePlayerModal(false)}>Cancel</Button>
              <Button onClick={saveRolePlayer} className="bg-[#6366f1] hover:bg-[#4f46e5] text-white" data-testid="bni-role-player-save">
                {editingRolePlayerId ? 'Save Changes' : 'Add Role Player'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Chapter Modal */}
        <Dialog open={showSettingsModal} onOpenChange={setShowSettingsModal}>
          <DialogContent className={`${bgCard} max-w-md`}>
            <DialogHeader>
              <DialogTitle className={textPrimary}>Edit Chapter Details</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className={textPrimary}>Chapter Name</Label>
                <Input
                  value={settingsForm.chapter_name}
                  onChange={(e) => setSettingsForm((p) => ({ ...p, chapter_name: e.target.value }))}
                  placeholder="e.g. BNI Titans"
                  className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                  data-testid="bni-settings-chapter-name"
                />
              </div>
              <div>
                <Label className={textPrimary}>Region</Label>
                <Input
                  value={settingsForm.region}
                  onChange={(e) => setSettingsForm((p) => ({ ...p, region: e.target.value }))}
                  placeholder="e.g. Chennai"
                  className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                  data-testid="bni-settings-region"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setShowSettingsModal(false)}>Cancel</Button>
              <Button onClick={saveSettings} className="bg-[#6366f1] hover:bg-[#4f46e5] text-white" data-testid="bni-settings-save">
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <CSVImportModal
          open={showMemberImport}
          onClose={() => setShowMemberImport(false)}
          title="Import Members from CSV"
          fields={MEMBER_IMPORT_FIELDS}
          onImport={importMembers}
          bgCard={bgCard}
          bgSecondary={bgSecondary}
          textPrimary={textPrimary}
          textSecondary={textSecondary}
          borderColor={borderColor}
        />
        <CSVImportModal
          open={showCategoryImport}
          onClose={() => setShowCategoryImport(false)}
          title="Import Categories from CSV"
          fields={CATEGORY_IMPORT_FIELDS}
          onImport={importCategories}
          bgCard={bgCard}
          bgSecondary={bgSecondary}
          textPrimary={textPrimary}
          textSecondary={textSecondary}
          borderColor={borderColor}
        />
        <CSVImportModal
          open={showRolePlayerImport}
          onClose={() => setShowRolePlayerImport(false)}
          title="Import Role Players from CSV"
          fields={ROLE_PLAYER_IMPORT_FIELDS}
          onImport={importRolePlayers}
          bgCard={bgCard}
          bgSecondary={bgSecondary}
          textPrimary={textPrimary}
          textSecondary={textSecondary}
          borderColor={borderColor}
        />
        <CSVImportModal
          open={showOutreachImport}
          onClose={() => setShowOutreachImport(false)}
          title="Import BNI Outreach from CSV"
          fields={OUTREACH_IMPORT_FIELDS}
          onImport={importOutreach}
          bgCard={bgCard}
          bgSecondary={bgSecondary}
          textPrimary={textPrimary}
          textSecondary={textSecondary}
          borderColor={borderColor}
        />

        {/* Add/Edit Outreach */}
        <Dialog open={showOutreachModal} onOpenChange={setShowOutreachModal}>
          <DialogContent className={`${bgCard} max-w-lg`}>
            <DialogHeader>
              <DialogTitle className={textPrimary}>{editingOutreachId ? 'Edit Outreach' : 'Add Outreach'}</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label className={textPrimary}>Name *</Label>
                <Input value={outreachForm.name} onChange={(e) => setOutreachForm({ ...outreachForm, name: e.target.value })} className={`${bgSecondary} border ${borderColor}`} data-testid="bni-outreach-name-input" autoFocus />
              </div>
              <div>
                <Label className={textPrimary}>Brand Name</Label>
                <Input value={outreachForm.brand_name} onChange={(e) => setOutreachForm({ ...outreachForm, brand_name: e.target.value })} className={`${bgSecondary} border ${borderColor}`} data-testid="bni-outreach-brand-input" />
              </div>
              <div>
                <Label className={textPrimary}>Chapter Name</Label>
                <Input value={outreachForm.chapter_name} onChange={(e) => setOutreachForm({ ...outreachForm, chapter_name: e.target.value })} className={`${bgSecondary} border ${borderColor}`} data-testid="bni-outreach-chapter-input" />
              </div>
              <div>
                <Label className={textPrimary}>Email</Label>
                <Input type="email" value={outreachForm.email} onChange={(e) => setOutreachForm({ ...outreachForm, email: e.target.value })} className={`${bgSecondary} border ${borderColor}`} data-testid="bni-outreach-email-input" />
              </div>
              <div>
                <Label className={textPrimary}>Phone</Label>
                <Input value={outreachForm.phone} onChange={(e) => setOutreachForm({ ...outreachForm, phone: e.target.value })} className={`${bgSecondary} border ${borderColor}`} data-testid="bni-outreach-phone-input" />
              </div>
              <div className="col-span-2">
                <Label className={textPrimary}>Profile Link</Label>
                <Input value={outreachForm.profile_link} onChange={(e) => setOutreachForm({ ...outreachForm, profile_link: e.target.value })} className={`${bgSecondary} border ${borderColor}`} data-testid="bni-outreach-profile-input" />
              </div>
              <div>
                <Label className={textPrimary}>Website</Label>
                <Input value={outreachForm.website} onChange={(e) => setOutreachForm({ ...outreachForm, website: e.target.value })} className={`${bgSecondary} border ${borderColor}`} data-testid="bni-outreach-website-input" />
              </div>
              <div>
                <Label className={textPrimary}>Location</Label>
                <Input value={outreachForm.location} onChange={(e) => setOutreachForm({ ...outreachForm, location: e.target.value })} className={`${bgSecondary} border ${borderColor}`} data-testid="bni-outreach-location-input" />
              </div>
              <div className="col-span-2">
                <Label className={textPrimary}>Category</Label>
                <Select value={outreachForm.category_id || 'none'} onValueChange={(v) => setOutreachForm({ ...outreachForm, category_id: v === 'none' ? '' : v })}>
                  <SelectTrigger className={`${bgSecondary} border ${borderColor} ${textPrimary}`} data-testid="bni-outreach-category-select">
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c.category_id} value={c.category_id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label className={textPrimary}>Status</Label>
                <Select value={outreachForm.status || 'To do'} onValueChange={(v) => setOutreachForm({ ...outreachForm, status: v })}>
                  <SelectTrigger className={`${bgSecondary} border ${borderColor} ${textPrimary}`} data-testid="bni-outreach-status-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OUTREACH_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setShowOutreachModal(false)}>Cancel</Button>
              <Button onClick={saveOutreach} disabled={outreachSaving} className="bg-[#6366f1] hover:bg-[#4f46e5]" data-testid="bni-outreach-save-btn">
                {outreachSaving ? 'Saving…' : editingOutreachId ? 'Save Changes' : 'Add Outreach'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Give */}
        <Dialog open={showNewGive} onOpenChange={setShowNewGive}>
          <DialogContent className={`${bgCard} max-w-md`}>
            <DialogHeader>
              <DialogTitle className={textPrimary}>Add Give</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className={textPrimary}>Business Person Name *</Label>
                <Input value={newGiveForm.business_person_name} onChange={(e) => setNewGiveForm({ ...newGiveForm, business_person_name: e.target.value })} className={`${bgSecondary} border ${borderColor}`} data-testid="bni-give-person-input" autoFocus />
              </div>
              <div>
                <Label className={textPrimary}>Company Name</Label>
                <Input value={newGiveForm.company_name} onChange={(e) => setNewGiveForm({ ...newGiveForm, company_name: e.target.value })} className={`${bgSecondary} border ${borderColor}`} data-testid="bni-give-company-input" />
              </div>
              <div>
                <Label className={textPrimary}>Industry</Label>
                <Input value={newGiveForm.industry} onChange={(e) => setNewGiveForm({ ...newGiveForm, industry: e.target.value })} className={`${bgSecondary} border ${borderColor}`} data-testid="bni-give-industry-input" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setShowNewGive(false)}>Cancel</Button>
              <Button onClick={saveNewGive} disabled={newGiveSaving} className="bg-[#6366f1] hover:bg-[#4f46e5]" data-testid="bni-give-save-btn">
                {newGiveSaving ? 'Saving…' : 'Add Give'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* New One-to-One */}
        <Dialog open={showNewOto} onOpenChange={setShowNewOto}>
          <DialogContent className={`${bgCard} max-w-md`}>
            <DialogHeader>
              <DialogTitle className={textPrimary}>New One-to-One</DialogTitle>
            </DialogHeader>

            <div className="flex gap-2">
              <button
                onClick={() => setOtoCreateTab('chapter')}
                className={`px-4 py-2 text-sm font-medium rounded-lg border ${otoCreateTab === 'chapter' ? 'bg-[#6366f1] text-white border-transparent' : `${bgSecondary} ${textSecondary} ${borderColor}`}`}
                data-testid="bni-oto-tab-chapter"
              >
                Chapter
              </button>
              <button
                onClick={() => setOtoCreateTab('cross_chapter')}
                className={`px-4 py-2 text-sm font-medium rounded-lg border ${otoCreateTab === 'cross_chapter' ? 'bg-[#6366f1] text-white border-transparent' : `${bgSecondary} ${textSecondary} ${borderColor}`}`}
                data-testid="bni-oto-tab-cross-chapter"
              >
                Cross Chapter
              </button>
            </div>

            {otoCreateTab === 'chapter' ? (
              <div className="space-y-3">
                <div>
                  <Label className={textPrimary}>Chapter Member *</Label>
                  <Select value={otoForm.member_id} onValueChange={(v) => setOtoForm({ ...otoForm, member_id: v })}>
                    <SelectTrigger className={`${bgSecondary} border ${borderColor} ${textPrimary}`} data-testid="bni-oto-member-select">
                      <SelectValue placeholder="Select a member" />
                    </SelectTrigger>
                    <SelectContent>
                      {members.map((m) => (
                        <SelectItem key={m.member_id} value={m.member_id}>{m.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {otoForm.member_id && (
                    <p className={`text-xs ${textSecondary} mt-1`}>
                      Category: {members.find((m) => m.member_id === otoForm.member_id)?.category_name || '—'}
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className={textPrimary}>Meeting Date *</Label>
                    <Input type="date" value={otoForm.meeting_date} onChange={(e) => setOtoForm({ ...otoForm, meeting_date: e.target.value })} className={`${bgSecondary} border ${borderColor}`} data-testid="bni-oto-date-input" />
                  </div>
                  <div>
                    <Label className={textPrimary}>Time</Label>
                    <Input type="time" value={otoForm.meeting_time} onChange={(e) => setOtoForm({ ...otoForm, meeting_time: e.target.value })} className={`${bgSecondary} border ${borderColor}`} />
                  </div>
                </div>
                <div>
                  <Label className={textPrimary}>Location</Label>
                  <Input value={otoForm.location} onChange={(e) => setOtoForm({ ...otoForm, location: e.target.value })} className={`${bgSecondary} border ${borderColor}`} />
                </div>
                <div>
                  <Label className={textPrimary}>Invited By</Label>
                  <Select value={otoForm.invited_by} onValueChange={(v) => setOtoForm({ ...otoForm, invited_by: v })}>
                    <SelectTrigger className={`${bgSecondary} border ${borderColor} ${textPrimary}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="me">Me</SelectItem>
                      <SelectItem value="member">{members.find((m) => m.member_id === otoForm.member_id)?.name || 'Selected member'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : (
              <div className={`${bgSecondary} rounded-xl p-8 text-center`}>
                <p className={`font-medium ${textPrimary}`}>Cross Chapter — coming soon</p>
                <p className={`text-sm ${textSecondary} mt-1`}>Let us know what fields you need here and we'll build it out.</p>
              </div>
            )}

            <DialogFooter>
              <Button variant="ghost" onClick={() => setShowNewOto(false)}>Cancel</Button>
              {otoCreateTab === 'chapter' && (
                <Button onClick={saveNewOto} disabled={otoSaving} className="bg-[#6366f1] hover:bg-[#4f46e5]" data-testid="bni-oto-save-btn">
                  {otoSaving ? 'Scheduling…' : 'Schedule'}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit One-to-One */}
        <Dialog open={showEditOto} onOpenChange={setShowEditOto}>
          <DialogContent className={`${bgCard} max-w-md`}>
            <DialogHeader>
              <DialogTitle className={textPrimary}>Edit One-to-One</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className={textPrimary}>Chapter Member *</Label>
                <Select value={editOtoForm.member_id} onValueChange={(v) => setEditOtoForm({ ...editOtoForm, member_id: v })}>
                  <SelectTrigger className={`${bgSecondary} border ${borderColor} ${textPrimary}`} data-testid="bni-oto-edit-member-select">
                    <SelectValue placeholder="Select a member" />
                  </SelectTrigger>
                  <SelectContent>
                    {members.map((m) => (
                      <SelectItem key={m.member_id} value={m.member_id}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {editOtoForm.member_id && (
                  <p className={`text-xs ${textSecondary} mt-1`}>
                    Category: {members.find((m) => m.member_id === editOtoForm.member_id)?.category_name || '—'}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className={textPrimary}>Meeting Date *</Label>
                  <Input type="date" value={editOtoForm.meeting_date} onChange={(e) => setEditOtoForm({ ...editOtoForm, meeting_date: e.target.value })} className={`${bgSecondary} border ${borderColor}`} />
                </div>
                <div>
                  <Label className={textPrimary}>Time</Label>
                  <Input type="time" value={editOtoForm.meeting_time} onChange={(e) => setEditOtoForm({ ...editOtoForm, meeting_time: e.target.value })} className={`${bgSecondary} border ${borderColor}`} />
                </div>
              </div>
              <div>
                <Label className={textPrimary}>Location</Label>
                <Input value={editOtoForm.location} onChange={(e) => setEditOtoForm({ ...editOtoForm, location: e.target.value })} className={`${bgSecondary} border ${borderColor}`} />
              </div>
              <div>
                <Label className={textPrimary}>Invited By</Label>
                <Select value={editOtoForm.invited_by} onValueChange={(v) => setEditOtoForm({ ...editOtoForm, invited_by: v })}>
                  <SelectTrigger className={`${bgSecondary} border ${borderColor} ${textPrimary}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="me">Me</SelectItem>
                    <SelectItem value="member">{members.find((m) => m.member_id === editOtoForm.member_id)?.name || 'Selected member'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setShowEditOto(false)}>Cancel</Button>
              <Button onClick={saveEditOto} disabled={editOtoSaving} className="bg-[#6366f1] hover:bg-[#4f46e5]" data-testid="bni-oto-edit-save-btn">
                {editOtoSaving ? 'Saving…' : 'Save'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Reschedule */}
        <Dialog open={showReschedule} onOpenChange={setShowReschedule}>
          <DialogContent className={`${bgCard} max-w-sm`}>
            <DialogHeader>
              <DialogTitle className={textPrimary}>Reschedule — {activeOto?.member_name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className={textPrimary}>Meeting Date</Label>
                  <Input type="date" value={rescheduleForm.meeting_date} onChange={(e) => setRescheduleForm({ ...rescheduleForm, meeting_date: e.target.value })} className={`${bgSecondary} border ${borderColor}`} />
                </div>
                <div>
                  <Label className={textPrimary}>Time</Label>
                  <Input type="time" value={rescheduleForm.meeting_time} onChange={(e) => setRescheduleForm({ ...rescheduleForm, meeting_time: e.target.value })} className={`${bgSecondary} border ${borderColor}`} />
                </div>
              </div>
              <div>
                <Label className={textPrimary}>Location</Label>
                <Input value={rescheduleForm.location} onChange={(e) => setRescheduleForm({ ...rescheduleForm, location: e.target.value })} className={`${bgSecondary} border ${borderColor}`} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setShowReschedule(false)}>Cancel</Button>
              <Button onClick={saveReschedule} disabled={rescheduleSaving} className="bg-[#6366f1] hover:bg-[#4f46e5]" data-testid="bni-oto-reschedule-save-btn">
                {rescheduleSaving ? 'Saving…' : 'Save'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* One-to-One Remarks */}
        <Dialog open={showOtoRemarks} onOpenChange={setShowOtoRemarks}>
          <DialogContent className={`${bgCard} max-w-4xl`}>
            <DialogHeader>
              <DialogTitle className={textPrimary}>Remarks — {activeOto?.member_name}</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Column 1: Summary */}
              <div className="space-y-3">
                <h3 className={`text-sm font-semibold ${textPrimary}`}>Summary</h3>
                <div>
                  <Label className={textPrimary}>Remark</Label>
                  <Textarea value={remarksForm.remark} onChange={(e) => setRemarksForm({ ...remarksForm, remark: e.target.value })} className={`${bgSecondary} border ${borderColor}`} rows={4} data-testid="bni-oto-remark-input" />
                </div>
                <div>
                  <Label className={textPrimary}>One to One Status</Label>
                  <Select value={remarksForm.status || 'none'} onValueChange={(v) => setRemarksForm({ ...remarksForm, status: v === 'none' ? '' : v })}>
                    <SelectTrigger className={`${bgSecondary} border ${borderColor} ${textPrimary}`} data-testid="bni-oto-status-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Set status —</SelectItem>
                      {ONE_TO_ONE_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {remarksForm.status === 'Lead' && (
                    <p className="text-xs text-[#10b981] mt-1">Saving will add {activeOto?.member_name} as a new Lead (source: BNI).</p>
                  )}
                </div>
              </div>

              {/* Column 2: Givers — gives from me to this member */}
              <div className="space-y-2">
                <h3 className={`text-sm font-semibold ${textPrimary}`}>Givers</h3>
                <p className={`text-xs ${textSecondary}`}>What I've given to {activeOto?.member_name || 'this member'}</p>
                <div className="space-y-2">
                  {remarksForm.gives.map((g, idx) => (
                    <div key={idx} className="flex gap-2">
                      <Textarea
                        value={g}
                        onChange={(e) => updateRemarksListItem('gives', idx, e.target.value)}
                        className={`${bgSecondary} border ${borderColor}`}
                        rows={2}
                        placeholder="What did you give?"
                        data-testid={`bni-oto-give-input-${idx}`}
                      />
                      <Button variant="ghost" size="sm" onClick={() => removeRemarksListItem('gives', idx)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={() => addRemarksListItem('gives')} data-testid="bni-oto-add-give-btn">
                    <Plus className="h-4 w-4 mr-1" /> Add Give
                  </Button>
                </div>
              </div>

              {/* Column 3: Referrals — referrals from this member */}
              <div className="space-y-2">
                <h3 className={`text-sm font-semibold ${textPrimary}`}>Referrals</h3>
                <p className={`text-xs ${textSecondary}`}>Referrals from {activeOto?.member_name || 'this member'}</p>
                <div className="space-y-2">
                  {remarksForm.referrals.map((r, idx) => (
                    <div key={idx} className="flex gap-2">
                      <Textarea
                        value={r}
                        onChange={(e) => updateRemarksListItem('referrals', idx, e.target.value)}
                        className={`${bgSecondary} border ${borderColor}`}
                        rows={2}
                        placeholder="Referral details"
                        data-testid={`bni-oto-referral-input-${idx}`}
                      />
                      <Button variant="ghost" size="sm" onClick={() => removeRemarksListItem('referrals', idx)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={() => addRemarksListItem('referrals')} data-testid="bni-oto-add-referral-btn">
                    <Plus className="h-4 w-4 mr-1" /> Add Referral
                  </Button>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setShowOtoRemarks(false)}>Cancel</Button>
              <Button onClick={saveOtoRemarks} disabled={remarksSaving} className="bg-[#6366f1] hover:bg-[#4f46e5]" data-testid="bni-oto-remarks-save-btn">
                {remarksSaving ? 'Saving…' : 'Save'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
