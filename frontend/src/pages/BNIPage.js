import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Layout from '../components/Layout';
import { useTheme } from '../contexts/ThemeContext';
import api from '../utils/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Combobox } from '../components/ui/combobox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import CSVImportModal from '../components/bni/CSVImportModal';
import {
  Plus, Users, Calendar, Handshake, Wallet, Share2, Heart, Star, Tag, Award,
  Eye, Pencil, Trash2, MapPin, Link as LinkIcon, Mail, Phone, Globe, Pin, PinOff, Upload,
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

const TABS = [
  { key: 'members', label: 'Members', icon: Users },
  { key: 'weekly_meeting', label: 'Weekly Meeting', icon: Calendar },
  { key: 'one_to_one', label: 'One-to-One', icon: Handshake },
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

export default function BNIPage() {
  const { isDark } = useTheme();
  const [activeTab, setActiveTab] = useState('members');
  const [members, setMembers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [rolePlayers, setRolePlayers] = useState([]);
  const [chapterSettings, setChapterSettings] = useState({ chapter_name: '', region: '' });
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

  const bgCard = isDark ? 'bg-[#18181b]' : 'bg-white';
  const bgSecondary = isDark ? 'bg-[#27272a]' : 'bg-gray-100';
  const textPrimary = isDark ? 'text-[#fafafa]' : 'text-gray-900';
  const textSecondary = isDark ? 'text-[#a1a1aa]' : 'text-gray-600';
  const borderColor = isDark ? 'border-[#27272a]' : 'border-gray-200';

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [membersRes, categoriesRes, rolePlayersRes, settingsRes] = await Promise.all([
        api.get('/bni/members'),
        api.get('/bni/categories'),
        api.get('/bni/role-players'),
        api.get('/bni/settings'),
      ]);
      setMembers(membersRes.data || []);
      setCategories(categoriesRes.data || []);
      setRolePlayers(rolePlayersRes.data || []);
      setChapterSettings(settingsRes.data || { chapter_name: '', region: '' });
    } catch (error) {
      toast.error('Failed to load BNI data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const categoryOptions = useMemo(
    () => categories.map((c) => ({ value: c.category_id, label: c.name })),
    [categories]
  );
  const rolePlayerOptions = useMemo(
    () => rolePlayers.map((r) => ({ value: r.role_player_id, label: r.name })),
    [rolePlayers]
  );

  const pinnedMembers = useMemo(() => members.filter((m) => m.pinned), [members]);
  const unpinnedMembers = useMemo(() => members.filter((m) => !m.pinned), [members]);

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
          <button
            type="button"
            onClick={() => togglePin(m)}
            className={m.pinned ? 'text-amber-500' : textSecondary}
            title={m.pinned ? 'Unpin' : 'Pin'}
            data-testid={`bni-member-pin-${m.member_id}`}
          >
            {m.pinned ? <Pin className="h-4 w-4 fill-current" /> : <PinOff className="h-4 w-4" />}
          </button>
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
        <td className="px-4 py-3">
          {m.role_player_name ? (
            <Badge className={`${roleColor.bg} ${roleColor.text} border ${roleColor.border} font-semibold`}>
              {m.role_player_name}
            </Badge>
          ) : (
            <span className={textSecondary}>—</span>
          )}
        </td>
        <td className={`px-4 py-3 ${textSecondary}`}>{m.phone || '—'}</td>
        <td className={`px-4 py-3 ${textSecondary}`}>{m.email || '—'}</td>
        <td className={`px-4 py-3 ${textSecondary}`}>{m.city || '—'}</td>
        <td className="px-4 py-3">
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" className="text-[#6366f1]" onClick={() => setViewingMember(m)} data-testid={`bni-member-view-${m.member_id}`}>
              <Eye className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => openEditMember(m)} data-testid={`bni-member-edit-${m.member_id}`}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="text-[#ef4444]" onClick={() => deleteMember(m.member_id)} data-testid={`bni-member-delete-${m.member_id}`}>
              <Trash2 className="h-4 w-4" />
            </Button>
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
              <button
                type="button"
                onClick={openEditSettings}
                className={textSecondary}
                title="Edit chapter name & region"
                data-testid="bni-edit-chapter-btn"
              >
                <Pencil className="h-4 w-4" />
              </button>
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
          {activeTab === 'members' && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowMemberImport(true)} data-testid="bni-import-member-btn">
                <Upload className="h-4 w-4 mr-2" /> Import CSV
              </Button>
              <Button onClick={openAddMember} className="bg-[#6366f1] hover:bg-[#4f46e5] text-white" data-testid="bni-add-member-btn">
                <Plus className="h-4 w-4 mr-2" /> Add Member
              </Button>
            </div>
          )}
          {activeTab === 'category' && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowCategoryImport(true)} data-testid="bni-import-category-btn">
                <Upload className="h-4 w-4 mr-2" /> Import CSV
              </Button>
              <Button onClick={openAddCategory} className="bg-[#6366f1] hover:bg-[#4f46e5] text-white" data-testid="bni-add-category-btn">
                <Plus className="h-4 w-4 mr-2" /> Add Category
              </Button>
            </div>
          )}
          {activeTab === 'role_players' && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowRolePlayerImport(true)} data-testid="bni-import-role-player-btn">
                <Upload className="h-4 w-4 mr-2" /> Import CSV
              </Button>
              <Button onClick={openAddRolePlayer} className="bg-[#6366f1] hover:bg-[#4f46e5] text-white" data-testid="bni-add-role-player-btn">
                <Plus className="h-4 w-4 mr-2" /> Add Role Player
              </Button>
            </div>
          )}
        </div>

        {/* Tab bar */}
        <div className="flex flex-wrap gap-2">
          {TABS.map((tab) => {
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
              <div className={`${bgCard} border ${borderColor} rounded-xl overflow-hidden`}>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className={bgSecondary}>
                      <tr>
                        <th className={`px-3 py-3 text-left font-medium ${textSecondary}`}></th>
                        <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Name</th>
                        <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Business Name</th>
                        <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Category</th>
                        <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Role Player</th>
                        <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Phone</th>
                        <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Email</th>
                        <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>City</th>
                        <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Actions</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${borderColor}`}>
                      {members.length === 0 ? (
                        <tr>
                          <td colSpan={9} className={`px-4 py-8 text-center ${textSecondary}`}>
                            No members yet — click "Add Member" to add the first one.
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
            )}

            {activeTab === 'category' && (
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
                      {categories.length === 0 ? (
                        <tr>
                          <td colSpan={3} className={`px-4 py-8 text-center ${textSecondary}`}>
                            No categories yet — click "Add Category" to add the first one.
                          </td>
                        </tr>
                      ) : (
                        categories.map((c) => {
                          const color = tagColor(c.category_id);
                          return (
                            <tr key={c.category_id} className={`${bgCard} hover:${bgSecondary} transition-colors`}>
                              <td className="px-4 py-3">
                                <Badge className={`${color.bg} ${color.text} border ${color.border} font-semibold`}>{c.name}</Badge>
                              </td>
                              <td className={`px-4 py-3 ${textSecondary}`}>{c.description || '—'}</td>
                              <td className="px-4 py-3">
                                <Button variant="ghost" size="sm" onClick={() => openEditCategory(c)} data-testid={`bni-category-edit-${c.category_id}`}>
                                  <Pencil className="h-4 w-4" />
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
                                <Button variant="ghost" size="sm" onClick={() => openEditRolePlayer(r)} data-testid={`bni-role-player-edit-${r.role_player_id}`}>
                                  <Pencil className="h-4 w-4" />
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

            {!['members', 'category', 'role_players'].includes(activeTab) && (() => {
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
      </div>
    </Layout>
  );
}
