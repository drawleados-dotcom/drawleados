import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Plus, Trash2, Pencil, X, Megaphone } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const newId = (prefix) => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;

/**
 * Meta Ads department's "Campaigns" tab — a simple named list of campaigns
 * for the project. Selected from the daily "Submit Report" popup on the
 * Scopes/task list so each report entry can be tied to a specific campaign.
 */
export default function ProjectCampaignsTab({
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

  const campaigns = project?.campaigns || [];
  const [modal, setModal] = useState(null); // { mode: 'add' | 'edit', id, name }
  const [saving, setSaving] = useState(false);

  const persist = async (next) => {
    try {
      const res = await axios.patch(
        `${API}/api/projects/${project.project_id}`,
        { campaigns: next },
        { headers },
      );
      onProjectUpdated?.(res.data);
      return true;
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to save');
      return false;
    }
  };

  const openAdd = () => { if (canEdit) setModal({ mode: 'add', name: '' }); };
  const openRename = (c) => { if (canEdit) setModal({ mode: 'edit', id: c.id, name: c.name }); };
  const closeModal = () => setModal(null);

  const saveModal = async () => {
    if (!modal.name.trim()) { toast.error('Campaign name is required'); return; }
    setSaving(true);
    const next = modal.mode === 'add'
      ? [...campaigns, { id: newId('camp'), name: modal.name.trim() }]
      : campaigns.map(c => (c.id === modal.id ? { ...c, name: modal.name.trim() } : c));
    const ok = await persist(next);
    setSaving(false);
    if (ok) {
      toast.success(modal.mode === 'add' ? 'Campaign added' : 'Campaign updated');
      closeModal();
    }
  };

  const deleteCampaign = async (id) => {
    if (!canEdit) return;
    if (!window.confirm('Remove this campaign?')) return;
    const next = campaigns.filter(c => c.id !== id);
    const ok = await persist(next);
    if (ok) toast.success('Campaign removed');
  };

  return (
    <div className="space-y-3" data-testid="project-campaigns-tab">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className={`text-lg font-semibold ${textPrimary} flex items-center gap-2`}>
            <Megaphone className="h-5 w-5 text-[#6366f1]" /> Campaigns
          </h3>
          <p className={`text-xs ${textSecondary}`}>
            Campaigns picked from the daily Submit Report popup on tasks.
          </p>
        </div>
        {canEdit && (
          <Button
            type="button"
            onClick={openAdd}
            size="sm"
            className="bg-[#6366f1] hover:bg-[#4f46e5] text-white"
            data-testid="campaign-add-btn"
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> Add Campaign
          </Button>
        )}
      </div>

      <Card className={`${bgCard} border ${borderColor}`}>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className={`border-b ${borderColor}`}>
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase w-12`}>S.No</th>
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase`}>Campaign Name</th>
                  <th className={`text-right p-3 text-[11px] font-medium ${textSecondary} uppercase w-24`}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c, idx) => (
                  <tr key={c.id} className={`border-b ${borderColor}`} data-testid={`campaign-row-${c.id}`}>
                    <td className={`p-3 text-xs ${textSecondary}`}>{idx + 1}</td>
                    <td className={`p-3 text-sm font-medium ${textPrimary}`}>{c.name || '—'}</td>
                    <td className="p-3 text-right">
                      <div className="inline-flex gap-1">
                        {canEdit && (
                          <button type="button" onClick={() => openRename(c)} className={`p-1 ${textSecondary} hover:opacity-80`} title="Rename" data-testid={`campaign-edit-${c.id}`}>
                            <Pencil className="h-4 w-4" />
                          </button>
                        )}
                        {canEdit && (
                          <button type="button" onClick={() => deleteCampaign(c.id)} className="p-1 text-red-500 hover:text-red-400" title="Delete" data-testid={`campaign-delete-${c.id}`}>
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {campaigns.length === 0 && (
                  <tr>
                    <td colSpan={3} className={`p-8 text-center text-xs ${textSecondary}`}>
                      No campaigns yet. {canEdit && <span>Click <span className="font-medium">Add Campaign</span> to add one.</span>}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {modal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[70] p-4" onClick={closeModal}>
          <div className={`${bgCard} border ${borderColor} rounded-xl w-full max-w-sm`} onClick={(e) => e.stopPropagation()}>
            <div className={`p-5 border-b ${borderColor} flex items-center justify-between`}>
              <h3 className={`text-base font-semibold ${textPrimary} flex items-center gap-2`}>
                <Megaphone className="h-4 w-4 text-[#6366f1]" />
                {modal.mode === 'add' ? 'Add Campaign' : 'Rename Campaign'}
              </h3>
              <button onClick={closeModal} className={textSecondary}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5">
              <p className={`text-xs font-medium ${textSecondary} mb-1`}>Campaign Name</p>
              <Input
                value={modal.name}
                onChange={(e) => setModal(m => ({ ...m, name: e.target.value }))}
                placeholder="e.g. Summer Sale Leads"
                className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                data-testid="campaign-form-name"
                autoFocus
              />
            </div>
            <div className={`p-5 border-t ${borderColor} flex items-center justify-end gap-2`}>
              <Button type="button" variant="outline" onClick={closeModal}>Cancel</Button>
              <Button
                type="button"
                onClick={saveModal}
                disabled={saving}
                className="bg-[#6366f1] hover:bg-[#4f46e5] text-white"
                data-testid="campaign-form-save"
              >
                Save
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
