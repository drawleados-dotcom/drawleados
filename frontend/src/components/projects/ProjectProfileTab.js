import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Switch } from '../ui/switch';
import { Plus, Pencil, Trash2, Save, X, Eye, EyeOff, UserCircle, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const API = process.env.REACT_APP_BACKEND_URL;

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const PLATFORMS = [
  { id: 'instagram', label: 'Instagram' },
  { id: 'facebook', label: 'Facebook' },
  { id: 'x', label: 'X' },
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'youtube', label: 'YouTube' },
];

const todayIso = () => new Date().toISOString().slice(0, 10);
const newRowId = () => `sr_${Math.random().toString(36).slice(2, 10)}`;

const emptyProfileDraft = () => ({ profile_link: '', username: '', password: '', two_fa_enabled: false });
const emptyReportDraft = () => ({ report_date: todayIso(), followers: '', account_reached: '', leads_converted: '' });

export default function ProjectProfileTab({
  project,
  onProjectUpdated,
  canEdit,
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

  const [platformTab, setPlatformTab] = useState('instagram');
  // Profile / Report is remembered per platform, so each platform keeps its
  // own selected view instead of all of them sharing one toggle.
  const [viewByPlatform, setViewByPlatform] = useState({});
  const innerView = viewByPlatform[platformTab] || 'report'; // 'report' | 'profile' — Report is the first (default) tab
  const setInnerView = (v) => setViewByPlatform(prev => ({ ...prev, [platformTab]: v }));
  const platformLabel = PLATFORMS.find(p => p.id === platformTab)?.label || platformTab;

  const profiles = project?.social_profiles || [];
  const reports = project?.social_reports || [];
  const activeProfile = profiles.find(p => p.platform === platformTab);

  const [profileDraft, setProfileDraft] = useState(emptyProfileDraft());
  const [showPassword, setShowPassword] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  // Reload the draft whenever the platform (or the underlying project data)
  // changes, so switching platform tabs shows that platform's own saved
  // credentials instead of leaking the previous tab's in-progress edits.
  useEffect(() => {
    setProfileDraft(activeProfile ? {
      profile_link: activeProfile.profile_link || '',
      username: activeProfile.username || '',
      password: activeProfile.password || '',
      two_fa_enabled: !!activeProfile.two_fa_enabled,
    } : emptyProfileDraft());
    setShowPassword(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [platformTab, project?.project_id, activeProfile?.profile_link, activeProfile?.username, activeProfile?.password, activeProfile?.two_fa_enabled]);

  const now = new Date();
  const [reportYear, setReportYear] = useState(now.getFullYear());
  const yearOptions = [];
  for (let y = now.getFullYear() - 2; y <= now.getFullYear() + 2; y++) yearOptions.push(y);

  const reportsForView = reports.filter(r => r.platform === platformTab && r.year === reportYear);

  const [reportModal, setReportModal] = useState(null); // { month, existing } | null
  const [reportDraft, setReportDraft] = useState(emptyReportDraft());
  const [savingReport, setSavingReport] = useState(false);

  const persist = async (patch) => {
    if (!canEdit) return false;
    try {
      const res = await axios.patch(`${API}/api/projects/${project.project_id}`, patch, { headers });
      onProjectUpdated?.(res.data);
      return true;
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to save');
      return false;
    }
  };

  const saveProfile = async () => {
    setSavingProfile(true);
    try {
      const others = profiles.filter(p => p.platform !== platformTab);
      const next = [...others, { platform: platformTab, ...profileDraft }];
      const ok = await persist({ social_profiles: next });
      if (ok) toast.success('Profile saved');
    } finally {
      setSavingProfile(false);
    }
  };

  const openReportModal = (month, existing) => {
    setReportDraft(existing ? {
      report_date: existing.report_date || todayIso(),
      followers: existing.followers ?? '',
      account_reached: existing.account_reached ?? '',
      leads_converted: existing.leads_converted ?? '',
    } : emptyReportDraft());
    setReportModal({ month, existing });
  };
  const closeReportModal = () => { setReportModal(null); setReportDraft(emptyReportDraft()); };

  const saveReport = async () => {
    if (!reportModal) return;
    if (!reportDraft.report_date) { toast.error('Report Date is required'); return; }
    setSavingReport(true);
    try {
      const entry = {
        id: reportModal.existing?.id || newRowId(),
        platform: platformTab,
        year: reportYear,
        month: reportModal.month,
        report_date: reportDraft.report_date,
        reported_by_name: currentUser?.name || '',
        followers: Number(reportDraft.followers) || 0,
        account_reached: Number(reportDraft.account_reached) || 0,
        leads_converted: Number(reportDraft.leads_converted) || 0,
      };
      const others = reports.filter(r => r.id !== entry.id);
      const ok = await persist({ social_reports: [...others, entry] });
      if (ok) { toast.success('Report saved'); closeReportModal(); }
    } finally {
      setSavingReport(false);
    }
  };

  const deleteReport = async (id) => {
    const next = reports.filter(r => r.id !== id);
    const ok = await persist({ social_reports: next });
    if (ok) toast.success('Report removed');
  };

  const inputCls = `${bgSecondary} border ${borderColor} ${textPrimary}`;
  const pillBox = isDark ? 'bg-[#18181b] border-[#27272a]' : 'bg-white border-gray-200';
  const activeCls = isDark ? 'bg-[#27272a] text-white' : 'bg-gray-100 text-gray-900';
  const idleCls = isDark ? 'text-[#a1a1aa] hover:text-white' : 'text-gray-500 hover:text-gray-900';

  return (
    <div className="space-y-3" data-testid="project-profile-tab">
      <div>
        <h3 className={`text-lg font-semibold ${textPrimary} flex items-center gap-2`}>
          <UserCircle className="h-5 w-5 text-[#6366f1]" /> Profile
        </h3>
        <p className={`text-xs ${textSecondary}`}>Social account credentials and monthly performance reports, per platform.</p>
      </div>

      {/* Platform sub-tabs */}
      <div className={`inline-flex flex-wrap items-center gap-1 p-1 rounded-lg border ${pillBox}`}>
        {PLATFORMS.map(p => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPlatformTab(p.id)}
            data-testid={`profile-platform-tab-${p.id}`}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${platformTab === p.id ? activeCls : idleCls}`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Everything below belongs to the selected platform: its own
          Profile / Report toggle and content, nested under the platform. */}
      <div className="space-y-3 pl-3 border-l-2 border-[#6366f1]/40" data-testid={`profile-platform-section-${platformTab}`}>
      <h4 className={`text-sm font-semibold ${textPrimary}`}>{platformLabel}</h4>

      {/* Profile / Report inner view */}
      <div className={`inline-flex items-center gap-1 p-1 rounded-lg border ${pillBox}`}>
        {[{ id: 'report', label: 'Report' }, { id: 'profile', label: 'Profile' }].map(v => (
          <button
            key={v.id}
            type="button"
            onClick={() => setInnerView(v.id)}
            data-testid={`profile-inner-view-${v.id}`}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${innerView === v.id ? activeCls : idleCls}`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {innerView === 'profile' && (
        <Card className={`${bgCard} border ${borderColor}`}>
          <CardContent className="p-4 space-y-4 max-w-lg">
            <div className="space-y-1.5">
              <Label className={textPrimary}>Profile Link</Label>
              <Input
                value={profileDraft.profile_link}
                onChange={(e) => setProfileDraft(d => ({ ...d, profile_link: e.target.value }))}
                placeholder="https://instagram.com/yourhandle"
                className={inputCls}
                disabled={!canEdit}
                data-testid="profile-link-input"
              />
            </div>
            <div className="space-y-1.5">
              <Label className={textPrimary}>Username</Label>
              <Input
                value={profileDraft.username}
                onChange={(e) => setProfileDraft(d => ({ ...d, username: e.target.value }))}
                placeholder="Username"
                className={inputCls}
                disabled={!canEdit}
                data-testid="profile-username-input"
              />
            </div>
            <div className="space-y-1.5">
              <Label className={textPrimary}>Password</Label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={profileDraft.password}
                  onChange={(e) => setProfileDraft(d => ({ ...d, password: e.target.value }))}
                  placeholder="Password"
                  className={`${inputCls} pr-9`}
                  disabled={!canEdit}
                  data-testid="profile-password-input"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className={`absolute right-2 top-1/2 -translate-y-1/2 ${textSecondary} hover:opacity-80`}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label className={`${textPrimary} flex items-center gap-1.5`}>
                <ShieldCheck className="h-4 w-4" /> 2FA Enabled
              </Label>
              <Switch
                checked={profileDraft.two_fa_enabled}
                onCheckedChange={(v) => setProfileDraft(d => ({ ...d, two_fa_enabled: v }))}
                disabled={!canEdit}
                data-testid="profile-2fa-switch"
              />
            </div>
            {canEdit && (
              <Button
                type="button"
                onClick={saveProfile}
                disabled={savingProfile}
                size="sm"
                className="bg-[#6366f1] hover:bg-[#5558dd] text-white"
                data-testid="profile-save-btn"
              >
                <Save className="h-3.5 w-3.5 mr-1" /> {savingProfile ? 'Saving…' : 'Save'}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {innerView === 'report' && (
        <>
          <div className="flex items-center gap-2">
            <Label className={`text-xs ${textSecondary} uppercase tracking-wide`}>Year</Label>
            <Select value={String(reportYear)} onValueChange={(v) => setReportYear(Number(v))}>
              <SelectTrigger className={`w-[110px] h-8 text-xs ${bgSecondary} border ${borderColor} ${textPrimary}`} data-testid="report-year-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <Card className={`${bgCard} border ${borderColor}`}>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className={`border-b ${borderColor}`}>
                      <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase`}>Month</th>
                      <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase`}>Report Date</th>
                      <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase`}>Reported By</th>
                      <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase`}>Followers</th>
                      <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase`}>Account Reached</th>
                      <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase`}>Leads Converted</th>
                      <th className={`text-right p-3 text-[11px] font-medium ${textSecondary} uppercase w-20`}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {MONTH_NAMES.map((name, idx) => {
                      const month = idx + 1;
                      const existing = reportsForView.find(r => r.month === month);
                      return (
                        <tr key={month} className={`border-b ${borderColor}`} data-testid={`profile-report-row-${platformTab}-${reportYear}-${month}`}>
                          <td className={`p-3 text-sm font-medium ${textPrimary}`}>{name}</td>
                          {existing ? (
                            <>
                              <td className={`p-3 text-sm ${textPrimary}`}>{existing.report_date || '—'}</td>
                              <td className={`p-3 text-sm ${textSecondary}`}>{existing.reported_by_name || '—'}</td>
                              <td className={`p-3 text-sm ${textPrimary}`}>{existing.followers ?? 0}</td>
                              <td className={`p-3 text-sm ${textPrimary}`}>{existing.account_reached ?? 0}</td>
                              <td className={`p-3 text-sm ${textPrimary}`}>{existing.leads_converted ?? 0}</td>
                              <td className="p-3 text-right">
                                {canEdit && (
                                  <div className="inline-flex items-center gap-1">
                                    <button type="button" onClick={() => openReportModal(month, existing)} className={`p-1 ${textSecondary} hover:opacity-80`} title="Edit" data-testid={`profile-report-edit-${month}`}>
                                      <Pencil className="h-4 w-4" />
                                    </button>
                                    <button type="button" onClick={() => deleteReport(existing.id)} className="p-1 text-red-500 hover:text-red-400" title="Delete" data-testid={`profile-report-delete-${month}`}>
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </div>
                                )}
                              </td>
                            </>
                          ) : (
                            <td colSpan={6} className="p-3">
                              {canEdit ? (
                                <button
                                  type="button"
                                  onClick={() => openReportModal(month, null)}
                                  className="inline-flex items-center gap-1 text-xs text-[#6366f1] hover:underline"
                                  data-testid={`profile-report-add-${month}`}
                                >
                                  <Plus className="h-3.5 w-3.5" /> Add Report
                                </button>
                              ) : (
                                <span className={`text-xs ${textSecondary}`}>No report</span>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
      </div>

      {/* Add/Edit Report modal */}
      {reportModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-40 p-4" onClick={closeReportModal}>
          <div
            className={`${bgCard} border ${borderColor} rounded-xl w-full max-w-md`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`flex items-center justify-between p-4 border-b ${borderColor}`}>
              <h3 className={`text-lg font-semibold ${textPrimary}`}>
                {reportModal.existing ? 'Edit' : 'Add'} Report — {MONTH_NAMES[reportModal.month - 1]} {reportYear}
              </h3>
              <button onClick={closeReportModal} className={textSecondary}><X className="h-5 w-5" /></button>
            </div>
            <div className="p-4 space-y-3">
              <div className="space-y-1.5">
                <Label className={textPrimary}>Report Date</Label>
                <Input
                  type="date"
                  value={reportDraft.report_date}
                  onChange={(e) => setReportDraft(d => ({ ...d, report_date: e.target.value }))}
                  className={inputCls}
                  data-testid="profile-report-date-input"
                />
              </div>
              <div className="space-y-1.5">
                <Label className={textPrimary}>Followers</Label>
                <Input
                  type="number"
                  value={reportDraft.followers}
                  onChange={(e) => setReportDraft(d => ({ ...d, followers: e.target.value }))}
                  placeholder="0"
                  className={inputCls}
                  data-testid="profile-report-followers-input"
                />
              </div>
              <div className="space-y-1.5">
                <Label className={textPrimary}>Account Reached</Label>
                <Input
                  type="number"
                  value={reportDraft.account_reached}
                  onChange={(e) => setReportDraft(d => ({ ...d, account_reached: e.target.value }))}
                  placeholder="0"
                  className={inputCls}
                  data-testid="profile-report-reached-input"
                />
              </div>
              <div className="space-y-1.5">
                <Label className={textPrimary}>Leads Converted</Label>
                <Input
                  type="number"
                  value={reportDraft.leads_converted}
                  onChange={(e) => setReportDraft(d => ({ ...d, leads_converted: e.target.value }))}
                  placeholder="0"
                  className={inputCls}
                  data-testid="profile-report-leads-input"
                />
              </div>
              <p className={`text-xs ${textSecondary}`}>Reported by {currentUser?.name || 'you'} · {todayIso()}</p>
            </div>
            <div className={`flex items-center justify-end gap-2 p-4 border-t ${borderColor}`}>
              <Button type="button" variant="outline" onClick={closeReportModal} disabled={savingReport}>Cancel</Button>
              <Button type="button" onClick={saveReport} disabled={savingReport} className="bg-[#6366f1] hover:bg-[#5558dd] text-white" data-testid="profile-report-save-btn">
                {savingReport ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
