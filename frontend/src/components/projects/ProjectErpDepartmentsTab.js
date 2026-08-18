import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Plus, Trash2, Pencil, X, Building2, ChevronDown, ChevronRight, Users as UsersIcon } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const newId = (prefix) => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;

/**
 * ERP department's "Departments" tab — groups the project's ERP Users (see
 * ProjectErpUsersTab) into departments (e.g. Management, Clinical, Finance).
 * A user's department is assigned from the Users tab (Add/Rename User
 * modal); this tab only manages the department list itself and shows who's
 * currently in each one.
 */
export default function ProjectErpDepartmentsTab({
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

  const erpDepartments = project?.erp_departments || [];
  const erpUsers = project?.erp_users || [];
  const usersInDept = (deptId) => erpUsers.filter(u => u.department_id === deptId);

  const [expandedDeptId, setExpandedDeptId] = useState(null);
  // { mode: 'add' | 'edit', id, name }
  const [deptModal, setDeptModal] = useState(null);
  const [saving, setSaving] = useState(false);

  const persistDepartments = async (next) => {
    try {
      const res = await axios.patch(
        `${API}/api/projects/${project.project_id}`,
        { erp_departments: next },
        { headers },
      );
      onProjectUpdated?.(res.data);
      return true;
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to save');
      return false;
    }
  };

  const openAddDept = () => { if (canEdit) setDeptModal({ mode: 'add', name: '' }); };
  const openEditDept = (d) => { if (canEdit) setDeptModal({ mode: 'edit', id: d.id, name: d.name }); };
  const closeDeptModal = () => setDeptModal(null);

  const saveDeptModal = async () => {
    if (!deptModal.name.trim()) { toast.error('Department name is required'); return; }
    setSaving(true);
    const trimmed = deptModal.name.trim();
    const next = deptModal.mode === 'add'
      ? [...erpDepartments, { id: newId('ed'), name: trimmed }]
      : erpDepartments.map(d => (d.id === deptModal.id ? { ...d, name: trimmed } : d));
    const ok = await persistDepartments(next);
    // Keep each user's cached department_name in sync when a department is renamed.
    if (ok && deptModal.mode === 'edit') {
      const affected = erpUsers.filter(u => u.department_id === deptModal.id);
      if (affected.length > 0) {
        const nextUsers = erpUsers.map(u => (
          u.department_id === deptModal.id ? { ...u, department_name: trimmed } : u
        ));
        await axios.patch(
          `${API}/api/projects/${project.project_id}`,
          { erp_users: nextUsers },
          { headers },
        ).then(res => onProjectUpdated?.(res.data)).catch(() => {});
      }
    }
    setSaving(false);
    if (ok) {
      toast.success(deptModal.mode === 'add' ? 'Department added' : 'Department updated');
      closeDeptModal();
    }
  };

  const deleteDept = async (deptId) => {
    if (!canEdit) return;
    if (usersInDept(deptId).length > 0) {
      toast.error('Cannot delete: users are assigned to this department. Reassign them from the Users tab first.');
      return;
    }
    if (!window.confirm('Remove this department?')) return;
    const next = erpDepartments.filter(d => d.id !== deptId);
    const ok = await persistDepartments(next);
    if (ok) toast.success('Department removed');
  };

  return (
    <div className="space-y-3" data-testid="project-erp-departments-tab">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className={`text-lg font-semibold ${textPrimary} flex items-center gap-2`}>
            <Building2 className="h-5 w-5 text-[#6366f1]" /> Departments
          </h3>
          <p className={`text-xs ${textSecondary}`}>
            Group ERP Users into departments. Assign a user to a department from the Users tab.
          </p>
        </div>
        {canEdit && (
          <Button
            type="button"
            onClick={openAddDept}
            size="sm"
            className="bg-[#6366f1] hover:bg-[#4f46e5] text-white"
            data-testid="erp-dept-add-btn"
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> Add Department
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
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase`}>Department Name</th>
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase`}>Users</th>
                  <th className={`text-right p-3 text-[11px] font-medium ${textSecondary} uppercase w-24`}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {erpDepartments.map((d, idx) => {
                  const isExpanded = expandedDeptId === d.id;
                  const members = usersInDept(d.id);
                  return (
                    <React.Fragment key={d.id}>
                      <tr className={`border-b ${borderColor}`} data-testid={`erp-dept-row-${d.id}`}>
                        <td className={`p-3 text-xs ${textSecondary}`}>{idx + 1}</td>
                        <td className="p-3">
                          <button
                            type="button"
                            onClick={() => setExpandedDeptId(isExpanded ? null : d.id)}
                            className={`inline-flex items-center gap-1.5 text-sm font-medium ${textPrimary} hover:opacity-80`}
                            data-testid={`erp-dept-toggle-${d.id}`}
                          >
                            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            {d.name || '—'}
                          </button>
                        </td>
                        <td className={`p-3 text-xs ${textSecondary}`}>{members.length}</td>
                        <td className="p-3 text-right">
                          <div className="inline-flex gap-1">
                            {canEdit && (
                              <button type="button" onClick={() => openEditDept(d)} className={`p-1 ${textSecondary} hover:opacity-80`} title="Rename" data-testid={`erp-dept-edit-${d.id}`}>
                                <Pencil className="h-4 w-4" />
                              </button>
                            )}
                            {canEdit && (
                              <button
                                type="button"
                                onClick={() => deleteDept(d.id)}
                                disabled={members.length > 0}
                                className={`p-1 ${members.length > 0 ? 'text-red-500/30 cursor-not-allowed' : 'text-red-500 hover:text-red-400'}`}
                                title={members.length > 0 ? 'Cannot delete: users are assigned to this department' : 'Delete'}
                                data-testid={`erp-dept-delete-${d.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className={`border-b ${borderColor} ${bgSecondary}`} data-testid={`erp-dept-users-row-${d.id}`}>
                          <td colSpan={4} className="p-3">
                            <p className={`text-xs font-semibold uppercase tracking-wide ${textSecondary} mb-2`}>Users</p>
                            {members.length === 0 ? (
                              <p className={`text-xs ${textSecondary}`}>No users assigned yet. Assign one from the Users tab.</p>
                            ) : (
                              <div className="flex flex-wrap gap-2">
                                {members.map(u => (
                                  <span
                                    key={u.id}
                                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs border ${borderColor} ${bgCard} ${textPrimary}`}
                                    data-testid={`erp-dept-member-${u.id}`}
                                  >
                                    <UsersIcon className="h-3 w-3 text-[#6366f1]" /> {u.user_name}
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
                {erpDepartments.length === 0 && (
                  <tr>
                    <td colSpan={4} className={`p-8 text-center text-xs ${textSecondary}`}>
                      No departments yet. {canEdit && <span>Click <span className="font-medium">Add Department</span> to add one.</span>}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Add / Rename Department popup */}
      {deptModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[70] p-4" onClick={closeDeptModal}>
          <div className={`${bgCard} border ${borderColor} rounded-xl w-full max-w-sm`} onClick={(e) => e.stopPropagation()}>
            <div className={`p-5 border-b ${borderColor} flex items-center justify-between`}>
              <h3 className={`text-base font-semibold ${textPrimary} flex items-center gap-2`}>
                <Building2 className="h-4 w-4 text-[#6366f1]" />
                {deptModal.mode === 'add' ? 'Add Department' : 'Rename Department'}
              </h3>
              <button onClick={closeDeptModal} className={textSecondary}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5">
              <p className={`text-xs font-medium ${textSecondary} mb-1`}>Department Name</p>
              <Input
                value={deptModal.name}
                onChange={(e) => setDeptModal(m => ({ ...m, name: e.target.value }))}
                placeholder="e.g. Clinical"
                className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                data-testid="erp-dept-form-name"
                autoFocus
              />
            </div>
            <div className={`p-5 border-t ${borderColor} flex items-center justify-end gap-2`}>
              <Button type="button" variant="outline" onClick={closeDeptModal}>Cancel</Button>
              <Button
                type="button"
                onClick={saveDeptModal}
                disabled={saving}
                className="bg-[#6366f1] hover:bg-[#4f46e5] text-white"
                data-testid="erp-dept-form-save"
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
