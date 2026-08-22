import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Building2, Plus, X, Check, Tag, Trash2, Pencil, Flag, Layers, Cpu, Megaphone, Users } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import useAutoRefresh from '../hooks/useAutoRefresh';

const GROUPS = [
  { value: 'technology', label: 'Technology', icon: Cpu, color: '#6366f1' },
  { value: 'marketing', label: 'Marketing', icon: Megaphone, color: '#f97316' },
];
const groupMeta = (value) => GROUPS.find(g => g.value === value) || null;

const API = process.env.REACT_APP_BACKEND_URL;

export default function DepartmentsPanel({
  isDark, textPrimary, textSecondary, bgCard, bgSecondary, borderColor, headers,
}) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingDept, setEditingDept] = useState(null); // { dept_key, label, categories, statuses }
  const [modalTab, setModalTab] = useState('categories'); // 'categories' | 'status'
  const [categoryDraft, setCategoryDraft] = useState('');
  const [statusDraft, setStatusDraft] = useState('');
  const [saving, setSaving] = useState(false);

  // Add / rename department
  const [addingDept, setAddingDept] = useState(false);
  const [newDeptLabel, setNewDeptLabel] = useState('');
  const [renamingDept, setRenamingDept] = useState(null); // { dept_key, label, group }
  const [deptActionSaving, setDeptActionSaving] = useState(false);

  // Technology / Marketing grouping — filter pills above the table.
  const [groupFilter, setGroupFilter] = useState('all'); // 'all' | 'technology' | 'marketing'

  // Employees, for the Team picker in the view popup.
  const [employees, setEmployees] = useState([]);

  // Row click opens a read-only "view" popup (details + team), separate
  // from the categories/status/sub-departments edit modal below.
  const [viewDept, setViewDept] = useState(null);
  const [teamDraft, setTeamDraft] = useState([]);
  const [teamSaving, setTeamSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [catRes, statusRes] = await Promise.all([
        axios.get(`${API}/api/department-categories`, { headers }),
        axios.get(`${API}/api/department-statuses`, { headers }),
      ]);
      const statusByKey = {};
      (statusRes.data || []).forEach(d => { statusByKey[d.dept_key] = d.statuses || []; });
      setList((catRes.data || []).map(d => ({ ...d, statuses: statusByKey[d.dept_key] || [] })));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [headers]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    axios.get(`${API}/api/users/basic`, { headers }).then(res => setEmployees(res.data || [])).catch(() => {});
  }, [headers]);

  const filteredList = groupFilter === 'all' ? list : list.filter(d => d.group === groupFilter);

  // Background polling + focus refresh — pauses while editing a department
  useAutoRefresh(load, { enabled: !editingDept && !addingDept && !renamingDept && !viewDept });

  const openAddDept = () => { setAddingDept(true); setNewDeptLabel(''); };
  const closeAddDept = () => { setAddingDept(false); setNewDeptLabel(''); };
  const confirmAddDept = async () => {
    const label = newDeptLabel.trim();
    if (!label) { toast.error('Department name is required'); return; }
    setDeptActionSaving(true);
    try {
      await axios.post(`${API}/api/department-categories`, { label }, { headers });
      toast.success('Department added');
      closeAddDept();
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to add department');
    } finally {
      setDeptActionSaving(false);
    }
  };

  const openRenameDept = (dept) => setRenamingDept({ dept_key: dept.dept_key, label: dept.label, group: dept.group || '' });
  const closeRenameDept = () => setRenamingDept(null);
  const confirmRenameDept = async () => {
    const label = (renamingDept?.label || '').trim();
    if (!label) { toast.error('Department name is required'); return; }
    setDeptActionSaving(true);
    try {
      await Promise.all([
        axios.put(`${API}/api/department-categories/${renamingDept.dept_key}/label`, { label }, { headers }),
        axios.put(`${API}/api/department-categories/${renamingDept.dept_key}/group`, { group: renamingDept.group || '' }, { headers }),
      ]);
      toast.success('Department updated');
      closeRenameDept();
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to update department');
    } finally {
      setDeptActionSaving(false);
    }
  };

  const deleteDept = async (dept) => {
    if (!window.confirm(`Delete the "${dept.label}" department? Its categories and statuses will be removed.`)) return;
    try {
      await axios.delete(`${API}/api/department-categories/${dept.dept_key}`, { headers });
      toast.success('Department removed');
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to delete department');
    }
  };

  const openEdit = (dept) => {
    setEditingDept({
      ...dept,
      categories: [...(dept.categories || [])],
      statuses: [...(dept.statuses || [])],
      sub_departments: [...(dept.sub_departments || [])],
    });
    setModalTab('categories');
    setCategoryDraft('');
    setStatusDraft('');
    setSubDeptDraft('');
    setEditingCategory(null);
    setEditingStatus(null);
    setEditingSubDept(null);
  };

  // Row click → read-only view popup, with a Team section (checkbox list
  // of all employees — an employee can be on more than one department's
  // team, each department's list is independent).
  const openView = (dept) => { setViewDept(dept); setTeamDraft([...(dept.assigned_user_ids || [])]); };
  const closeView = () => { setViewDept(null); setTeamDraft([]); };
  const toggleTeamMember = (userId) => {
    setTeamDraft(prev => prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]);
  };
  const saveTeam = async () => {
    if (!viewDept) return;
    setTeamSaving(true);
    try {
      await axios.put(`${API}/api/department-categories/${viewDept.dept_key}/team`, { user_ids: teamDraft }, { headers });
      toast.success('Team updated');
      setList(prev => prev.map(d => d.dept_key === viewDept.dept_key ? { ...d, assigned_user_ids: teamDraft } : d));
      setViewDept(prev => prev ? { ...prev, assigned_user_ids: teamDraft } : prev);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to update team');
    } finally {
      setTeamSaving(false);
    }
  };

  const [editingCategory, setEditingCategory] = useState(null); // { original, value }
  const [editingStatus, setEditingStatus] = useState(null); // { original, value }

  // Sub departments — CRUD hits the server immediately per action (they
  // have stable ids, unlike categories/statuses which are staged locally
  // until the modal's own Save button), same pattern as the department
  // add/rename/delete above.
  const [subDeptDraft, setSubDeptDraft] = useState('');
  const [editingSubDept, setEditingSubDept] = useState(null); // { id, value }
  const [subDeptSaving, setSubDeptSaving] = useState(false);

  const addSubDepartment = async () => {
    const label = subDeptDraft.trim();
    if (!label) return;
    setSubDeptSaving(true);
    try {
      const res = await axios.post(`${API}/api/department-categories/${editingDept.dept_key}/sub-departments`, { label }, { headers });
      setEditingDept(prev => ({ ...prev, sub_departments: [...(prev.sub_departments || []), res.data] }));
      setSubDeptDraft('');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to add sub department');
    } finally {
      setSubDeptSaving(false);
    }
  };

  const startEditSubDept = (sd) => setEditingSubDept({ id: sd.id, value: sd.label });
  const commitEditSubDept = async () => {
    if (!editingSubDept) return;
    const label = (editingSubDept.value || '').trim();
    if (!label) { toast.error('Sub department name cannot be empty'); return; }
    setSubDeptSaving(true);
    try {
      await axios.put(`${API}/api/department-categories/${editingDept.dept_key}/sub-departments/${editingSubDept.id}`, { label }, { headers });
      setEditingDept(prev => ({
        ...prev,
        sub_departments: (prev.sub_departments || []).map(sd => sd.id === editingSubDept.id ? { ...sd, label } : sd),
      }));
      setEditingSubDept(null);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to rename sub department');
    } finally {
      setSubDeptSaving(false);
    }
  };

  const deleteSubDepartment = async (sd) => {
    try {
      await axios.delete(`${API}/api/department-categories/${editingDept.dept_key}/sub-departments/${sd.id}`, { headers });
      setEditingDept(prev => ({ ...prev, sub_departments: (prev.sub_departments || []).filter(x => x.id !== sd.id) }));
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to delete sub department');
    }
  };

  const startEditCategory = (c) => setEditingCategory({ original: c, value: c });
  const commitEditCategory = () => {
    if (!editingCategory) return;
    const next = (editingCategory.value || '').trim();
    if (!next) {
      toast.error('Category name cannot be empty');
      return;
    }
    if (next !== editingCategory.original && (editingDept.categories || []).includes(next)) {
      toast.error('Category already exists');
      return;
    }
    setEditingDept(prev => ({
      ...prev,
      categories: (prev.categories || []).map(c => c === editingCategory.original ? next : c),
    }));
    setEditingCategory(null);
  };

  const addCategory = () => {
    const v = (categoryDraft || '').trim();
    if (!v) return;
    if ((editingDept.categories || []).includes(v)) {
      toast.error('Category already exists');
      return;
    }
    setEditingDept(prev => ({ ...prev, categories: [...(prev.categories || []), v] }));
    setCategoryDraft('');
  };

  const removeCategory = (c) => {
    setEditingDept(prev => ({ ...prev, categories: (prev.categories || []).filter(x => x !== c) }));
  };

  const startEditStatus = (s) => setEditingStatus({ original: s, value: s });
  const commitEditStatus = () => {
    if (!editingStatus) return;
    const next = (editingStatus.value || '').trim();
    if (!next) {
      toast.error('Status name cannot be empty');
      return;
    }
    if (next !== editingStatus.original && (editingDept.statuses || []).includes(next)) {
      toast.error('Status already exists');
      return;
    }
    setEditingDept(prev => ({
      ...prev,
      statuses: (prev.statuses || []).map(s => s === editingStatus.original ? next : s),
    }));
    setEditingStatus(null);
  };

  const addStatus = () => {
    const v = (statusDraft || '').trim();
    if (!v) return;
    if ((editingDept.statuses || []).includes(v)) {
      toast.error('Status already exists');
      return;
    }
    setEditingDept(prev => ({ ...prev, statuses: [...(prev.statuses || []), v] }));
    setStatusDraft('');
  };

  const removeStatus = (s) => {
    setEditingDept(prev => ({ ...prev, statuses: (prev.statuses || []).filter(x => x !== s) }));
  };

  const save = async () => {
    if (!editingDept) return;
    setSaving(true);
    try {
      await Promise.all([
        axios.put(
          `${API}/api/department-categories/${editingDept.dept_key}`,
          { categories: editingDept.categories || [] },
          { headers }
        ),
        axios.put(
          `${API}/api/department-statuses/${editingDept.dept_key}`,
          { statuses: editingDept.statuses || [] },
          { headers }
        ),
      ]);
      toast.success(`${editingDept.label} saved`);
      setEditingDept(null);
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4" data-testid="departments-panel">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className={`text-xl font-semibold ${textPrimary}`}>Departments &amp; Categories</h2>
          <p className={textSecondary}>Define categories and project statuses per department. Categories appear when creating tasks; statuses appear on the project's Status dropdown.</p>
        </div>
        <Button onClick={openAddDept} className="bg-[#6366f1] hover:bg-[#4f46e5] text-white gap-2 shrink-0" data-testid="dept-add-btn">
          <Plus className="h-4 w-4" /> Add Department
        </Button>
      </div>

      {/* Technology / Marketing grouping filter */}
      <div className="flex gap-2">
        {[{ value: 'all', label: 'All' }, ...GROUPS].map(g => (
          <button
            key={g.value}
            type="button"
            onClick={() => setGroupFilter(g.value)}
            className={`px-3 py-1.5 rounded-full text-sm flex items-center gap-1.5 transition-all ${
              groupFilter === g.value ? 'bg-[#6366f1] text-white' : `${bgSecondary} ${textSecondary} hover:bg-[#6366f1]/10`
            }`}
            data-testid={`dept-group-filter-${g.value}`}
          >
            {g.icon && <g.icon className="h-3.5 w-3.5" />}
            {g.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className={textSecondary}>Loading...</p>
      ) : (
        <div className={`${bgCard} border ${borderColor} rounded-xl overflow-hidden`}>
          <table className="w-full text-sm">
            <thead className={`${bgSecondary} ${textSecondary} text-xs uppercase`}>
              <tr>
                <th className="text-left px-4 py-3">Department</th>
                <th className="text-left px-4 py-3">Group</th>
                <th className="text-left px-4 py-3">Categories</th>
                <th className="text-left px-4 py-3">Team</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredList.length > 0 ? filteredList.map(dept => {
                const gm = groupMeta(dept.group);
                return (
                  <tr
                    key={dept.dept_key}
                    className={`border-t ${borderColor} hover:bg-[#6366f1]/5 transition-colors cursor-pointer`}
                    onClick={() => openView(dept)}
                    data-testid={`dept-row-${dept.dept_key}`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="h-8 w-8 rounded-lg bg-[#6366f1]/20 flex items-center justify-center shrink-0">
                          <Building2 className="h-4 w-4 text-[#6366f1]" />
                        </div>
                        <span className={`font-semibold ${textPrimary} truncate`}>{dept.label}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {gm ? (
                        <Badge style={{ backgroundColor: `${gm.color}20`, color: gm.color }} className="text-xs flex items-center gap-1 w-fit">
                          <gm.icon className="h-3 w-3" />{gm.label}
                        </Badge>
                      ) : (
                        <span className={`text-xs ${textSecondary}`}>—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge className="bg-[#6366f1]/20 text-[#6366f1] text-xs">{(dept.categories || []).length}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className="bg-[#10b981]/20 text-[#10b981] text-xs flex items-center gap-1 w-fit">
                        <Users className="h-3 w-3" />{(dept.assigned_user_ids || []).length}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => openRenameDept(dept)}
                          className="text-[#6366f1] p-1.5"
                          title="Rename / set group"
                          data-testid={`dept-rename-${dept.dept_key}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        {!dept.is_builtin && (
                          <button
                            type="button"
                            onClick={() => deleteDept(dept)}
                            className="text-[#ef4444] p-1.5"
                            title="Delete department"
                            data-testid={`dept-delete-${dept.dept_key}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={5} className="p-8 text-center">
                    <Building2 className={`h-12 w-12 mx-auto mb-3 ${textSecondary}`} />
                    <p className={textSecondary}>{groupFilter === 'all' ? 'No departments yet' : `No ${groupMeta(groupFilter)?.label} departments yet`}</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit Categories / Status Popup */}
      {editingDept && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[70]" onClick={() => !saving && setEditingDept(null)}>
          <Card className={`${bgCard} border ${borderColor} w-full max-w-md mx-4`} onClick={(e) => e.stopPropagation()}>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-[#6366f1]" />
                  <h3 className={`text-lg font-semibold ${textPrimary}`}>{editingDept.label}</h3>
                </div>
                <button onClick={() => !saving && setEditingDept(null)} className={textSecondary}>
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Tab switcher */}
              <div className={`inline-flex rounded-lg border ${borderColor} ${bgSecondary} p-1`} data-testid="dept-modal-tabs">
                <button
                  onClick={() => setModalTab('categories')}
                  data-testid="dept-modal-tab-categories"
                  className={`px-3 py-1.5 text-xs rounded-md transition-all ${
                    modalTab === 'categories' ? 'bg-[#6366f1] text-white shadow' : `${textSecondary} hover:bg-[#6366f1]/10`
                  }`}
                >
                  Categories
                </button>
                <button
                  onClick={() => setModalTab('status')}
                  data-testid="dept-modal-tab-status"
                  className={`px-3 py-1.5 text-xs rounded-md transition-all ${
                    modalTab === 'status' ? 'bg-[#6366f1] text-white shadow' : `${textSecondary} hover:bg-[#6366f1]/10`
                  }`}
                >
                  Status
                </button>
                {editingDept.dept_key === 'management' && (
                  <button
                    onClick={() => setModalTab('subdepartments')}
                    data-testid="dept-modal-tab-subdepartments"
                    className={`px-3 py-1.5 text-xs rounded-md transition-all ${
                      modalTab === 'subdepartments' ? 'bg-[#6366f1] text-white shadow' : `${textSecondary} hover:bg-[#6366f1]/10`
                    }`}
                  >
                    Sub Departments
                  </button>
                )}
              </div>

              {modalTab === 'subdepartments' ? (
                <>
                  <p className={`text-xs ${textSecondary}`}>
                    Add sub departments under Management — e.g. HR Management, Client Management, Operations Management.
                  </p>

                  {/* Existing sub departments */}
                  <div className="space-y-2">
                    {(editingDept.sub_departments || []).length === 0 ? (
                      <p className={`text-sm ${textSecondary}`}>No sub departments yet.</p>
                    ) : (
                      (editingDept.sub_departments || []).map(sd => {
                        const isEditing = editingSubDept?.id === sd.id;
                        return (
                          <div
                            key={sd.id}
                            className={`flex items-center justify-between p-2 rounded-lg ${bgSecondary} gap-2`}
                            data-testid={`dept-subdept-row-${sd.id}`}
                          >
                            {isEditing ? (
                              <>
                                <Input
                                  autoFocus
                                  value={editingSubDept.value}
                                  onChange={(e) => setEditingSubDept(prev => ({ ...prev, value: e.target.value }))}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') { e.preventDefault(); commitEditSubDept(); }
                                    if (e.key === 'Escape') { e.preventDefault(); setEditingSubDept(null); }
                                  }}
                                  className="h-8 flex-1"
                                  data-testid={`dept-subdept-edit-input-${sd.id}`}
                                />
                                <button onClick={commitEditSubDept} disabled={subDeptSaving} className="text-[#10b981] p-1" title="Save" data-testid="dept-subdept-edit-confirm">
                                  <Check className="h-4 w-4" />
                                </button>
                                <button onClick={() => setEditingSubDept(null)} className={`${textSecondary} p-1`} title="Cancel">
                                  <X className="h-4 w-4" />
                                </button>
                              </>
                            ) : (
                              <>
                                <span className={`text-sm ${textPrimary} flex items-center gap-2 flex-1 min-w-0`}>
                                  <Layers className="h-3 w-3 text-[#6366f1]" />
                                  <span className="truncate">{sd.label}</span>
                                </span>
                                <button
                                  onClick={() => startEditSubDept(sd)}
                                  className="text-[#6366f1] p-1"
                                  title="Edit"
                                  data-testid={`dept-subdept-edit-${sd.id}`}
                                >
                                  <Pencil className="h-3 w-3" />
                                </button>
                                <button onClick={() => deleteSubDepartment(sd)} className="text-[#ef4444] p-1" title="Delete" data-testid={`dept-subdept-delete-${sd.id}`}>
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Add new sub department */}
                  <div className="flex gap-2">
                    <Input
                      value={subDeptDraft}
                      onChange={(e) => setSubDeptDraft(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSubDepartment(); } }}
                      placeholder="e.g. HR Management"
                      className="flex-1"
                      data-testid="dept-subdept-input"
                    />
                    <Button onClick={addSubDepartment} disabled={subDeptSaving} className="bg-[#6366f1] hover:bg-[#4f46e5] text-white" data-testid="dept-subdept-add">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </>
              ) : modalTab === 'categories' ? (
                <>
                  <p className={`text-xs ${textSecondary}`}>
                    Add categories like Wireframe, UI, Content, Development, Testing.
                    These appear in task creation under projects.
                  </p>

                  {/* Existing categories */}
                  <div className="space-y-2">
                    {(editingDept.categories || []).length === 0 ? (
                      <p className={`text-sm ${textSecondary}`}>No categories yet.</p>
                    ) : (
                      (editingDept.categories || []).map(c => {
                        const isEditing = editingCategory?.original === c;
                        return (
                          <div
                            key={c}
                            className={`flex items-center justify-between p-2 rounded-lg ${bgSecondary} gap-2`}
                            data-testid={`dept-cat-row-${c.toLowerCase().replace(/\s+/g, '-')}`}
                          >
                            {isEditing ? (
                              <>
                                <Input
                                  autoFocus
                                  value={editingCategory.value}
                                  onChange={(e) => setEditingCategory(prev => ({ ...prev, value: e.target.value }))}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') { e.preventDefault(); commitEditCategory(); }
                                    if (e.key === 'Escape') { e.preventDefault(); setEditingCategory(null); }
                                  }}
                                  className="h-8 flex-1"
                                  data-testid={`dept-cat-edit-input-${c.toLowerCase().replace(/\s+/g, '-')}`}
                                />
                                <button onClick={commitEditCategory} className="text-[#10b981] p-1" title="Save" data-testid="dept-cat-edit-confirm">
                                  <Check className="h-4 w-4" />
                                </button>
                                <button onClick={() => setEditingCategory(null)} className={`${textSecondary} p-1`} title="Cancel">
                                  <X className="h-4 w-4" />
                                </button>
                              </>
                            ) : (
                              <>
                                <span className={`text-sm ${textPrimary} flex items-center gap-2 flex-1 min-w-0`}>
                                  <Tag className="h-3 w-3 text-[#6366f1]" />
                                  <span className="truncate">{c}</span>
                                </span>
                                <button
                                  onClick={() => startEditCategory(c)}
                                  className="text-[#6366f1] p-1"
                                  title="Edit"
                                  data-testid={`dept-cat-edit-${c.toLowerCase().replace(/\s+/g, '-')}`}
                                >
                                  <Pencil className="h-3 w-3" />
                                </button>
                                <button onClick={() => removeCategory(c)} className="text-[#ef4444] p-1" title="Delete">
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Add new category */}
                  <div className="flex gap-2">
                    <Input
                      value={categoryDraft}
                      onChange={(e) => setCategoryDraft(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCategory(); } }}
                      placeholder="e.g. Wireframe"
                      className="flex-1"
                      data-testid="dept-cat-input"
                    />
                    <Button onClick={addCategory} className="bg-[#6366f1] hover:bg-[#4f46e5] text-white" data-testid="dept-cat-add">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <p className={`text-xs ${textSecondary}`}>
                    Add statuses like Project Onboarded, Developing, Paused, Delivered, Refunded.
                    These appear in the project's Status dropdown for projects linked to this department.
                  </p>

                  {/* Existing statuses */}
                  <div className="space-y-2">
                    {(editingDept.statuses || []).length === 0 ? (
                      <p className={`text-sm ${textSecondary}`}>No statuses yet.</p>
                    ) : (
                      (editingDept.statuses || []).map(s => {
                        const isEditing = editingStatus?.original === s;
                        return (
                          <div
                            key={s}
                            className={`flex items-center justify-between p-2 rounded-lg ${bgSecondary} gap-2`}
                            data-testid={`dept-status-row-${s.toLowerCase().replace(/\s+/g, '-')}`}
                          >
                            {isEditing ? (
                              <>
                                <Input
                                  autoFocus
                                  value={editingStatus.value}
                                  onChange={(e) => setEditingStatus(prev => ({ ...prev, value: e.target.value }))}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') { e.preventDefault(); commitEditStatus(); }
                                    if (e.key === 'Escape') { e.preventDefault(); setEditingStatus(null); }
                                  }}
                                  className="h-8 flex-1"
                                  data-testid={`dept-status-edit-input-${s.toLowerCase().replace(/\s+/g, '-')}`}
                                />
                                <button onClick={commitEditStatus} className="text-[#10b981] p-1" title="Save" data-testid="dept-status-edit-confirm">
                                  <Check className="h-4 w-4" />
                                </button>
                                <button onClick={() => setEditingStatus(null)} className={`${textSecondary} p-1`} title="Cancel">
                                  <X className="h-4 w-4" />
                                </button>
                              </>
                            ) : (
                              <>
                                <span className={`text-sm ${textPrimary} flex items-center gap-2 flex-1 min-w-0`}>
                                  <Flag className="h-3 w-3 text-[#6366f1]" />
                                  <span className="truncate">{s}</span>
                                </span>
                                <button
                                  onClick={() => startEditStatus(s)}
                                  className="text-[#6366f1] p-1"
                                  title="Edit"
                                  data-testid={`dept-status-edit-${s.toLowerCase().replace(/\s+/g, '-')}`}
                                >
                                  <Pencil className="h-3 w-3" />
                                </button>
                                <button onClick={() => removeStatus(s)} className="text-[#ef4444] p-1" title="Delete">
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Add new status */}
                  <div className="flex gap-2">
                    <Input
                      value={statusDraft}
                      onChange={(e) => setStatusDraft(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addStatus(); } }}
                      placeholder="e.g. Project Onboarded"
                      className="flex-1"
                      data-testid="dept-status-input"
                    />
                    <Button onClick={addStatus} className="bg-[#6366f1] hover:bg-[#4f46e5] text-white" data-testid="dept-status-add">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={() => setEditingDept(null)} disabled={saving}>Cancel</Button>
                <Button onClick={save} disabled={saving} className="bg-[#10b981] hover:bg-[#059669] text-white" data-testid="dept-cat-save">
                  <Check className="h-3 w-3 mr-1" /> {saving ? 'Saving…' : 'Save'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* View Department popup — details + Team (opened by clicking a row) */}
      {viewDept && (() => {
        const gm = groupMeta(viewDept.group);
        return (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[70] p-4" onClick={closeView}>
            <Card className={`${bgCard} border ${borderColor} w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto`} onClick={(e) => e.stopPropagation()}>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-9 w-9 rounded-lg bg-[#6366f1]/20 flex items-center justify-center shrink-0">
                      <Building2 className="h-5 w-5 text-[#6366f1]" />
                    </div>
                    <div>
                      <h3 className={`text-lg font-semibold ${textPrimary}`}>{viewDept.label}</h3>
                      {gm ? (
                        <Badge style={{ backgroundColor: `${gm.color}20`, color: gm.color }} className="text-xs flex items-center gap-1 w-fit mt-0.5">
                          <gm.icon className="h-3 w-3" />{gm.label}
                        </Badge>
                      ) : (
                        <span className={`text-xs ${textSecondary}`}>No group set</span>
                      )}
                    </div>
                  </div>
                  <button onClick={closeView} className={textSecondary}>
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div>
                  <p className={`text-xs font-medium ${textSecondary} mb-1.5 flex items-center gap-1`}><Tag className="h-3 w-3" /> Categories</p>
                  {(viewDept.categories || []).length === 0 ? (
                    <p className={`text-xs ${textSecondary}`}>None yet.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {viewDept.categories.map(c => <Badge key={c} className={`text-xs ${bgSecondary} ${textPrimary}`}>{c}</Badge>)}
                    </div>
                  )}
                </div>

                <div>
                  <p className={`text-xs font-medium ${textSecondary} mb-1.5 flex items-center gap-1`}><Flag className="h-3 w-3" /> Statuses</p>
                  {(viewDept.statuses || []).length === 0 ? (
                    <p className={`text-xs ${textSecondary}`}>None yet.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {viewDept.statuses.map(s => <Badge key={s} className={`text-xs ${bgSecondary} ${textPrimary}`}>{s}</Badge>)}
                    </div>
                  )}
                </div>

                {viewDept.dept_key === 'management' && (
                  <div>
                    <p className={`text-xs font-medium ${textSecondary} mb-1.5 flex items-center gap-1`}><Layers className="h-3 w-3" /> Sub Departments</p>
                    {(viewDept.sub_departments || []).length === 0 ? (
                      <p className={`text-xs ${textSecondary}`}>None yet.</p>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {viewDept.sub_departments.map(sd => <Badge key={sd.id} className={`text-xs ${bgSecondary} ${textPrimary}`}>{sd.label}</Badge>)}
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <p className={`text-xs font-medium ${textSecondary} mb-1.5 flex items-center gap-1`}>
                    <Users className="h-3 w-3" /> Team — pick who's on this department. The same employee can be on more than one department's team.
                  </p>
                  {employees.length === 0 ? (
                    <p className={`text-xs ${textSecondary}`}>No employees found.</p>
                  ) : (
                    <div className="max-h-56 overflow-y-auto space-y-1">
                      {employees.map(emp => (
                        <label
                          key={emp.user_id}
                          className={`flex items-center gap-2.5 p-2 rounded-lg cursor-pointer border ${borderColor} ${bgSecondary}`}
                          data-testid={`dept-team-option-${emp.user_id}`}
                        >
                          <input
                            type="checkbox"
                            checked={teamDraft.includes(emp.user_id)}
                            onChange={() => toggleTeamMember(emp.user_id)}
                            className="h-4 w-4 accent-[#6366f1]"
                          />
                          <span className={`text-sm ${textPrimary}`}>{emp.name}</span>
                          {emp.designation && <span className={`text-[11px] ${textSecondary}`}>({emp.designation})</span>}
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex justify-between gap-2 pt-2">
                  <Button variant="outline" onClick={() => { openEdit(viewDept); setViewDept(null); }} data-testid="dept-view-edit">
                    <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit Categories / Status
                  </Button>
                  <Button onClick={saveTeam} disabled={teamSaving} className="bg-[#6366f1] hover:bg-[#4f46e5] text-white" data-testid="dept-team-save">
                    <Check className="h-3.5 w-3.5 mr-1.5" /> {teamSaving ? 'Saving…' : 'Save Team'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        );
      })()}

      {/* Add Department popup */}
      {addingDept && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[70]" onClick={() => !deptActionSaving && closeAddDept()}>
          <Card className={`${bgCard} border ${borderColor} w-full max-w-sm mx-4`} onClick={(e) => e.stopPropagation()}>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-[#6366f1]" />
                  <h3 className={`text-lg font-semibold ${textPrimary}`}>Add Department</h3>
                </div>
                <button onClick={closeAddDept} className={textSecondary}>
                  <X className="h-5 w-5" />
                </button>
              </div>
              <Input
                autoFocus
                value={newDeptLabel}
                onChange={(e) => setNewDeptLabel(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); confirmAddDept(); } }}
                placeholder="e.g. Management"
                data-testid="dept-add-input"
              />
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={closeAddDept} disabled={deptActionSaving}>Cancel</Button>
                <Button onClick={confirmAddDept} disabled={deptActionSaving} className="bg-[#10b981] hover:bg-[#059669] text-white" data-testid="dept-add-confirm">
                  <Check className="h-3 w-3 mr-1" /> {deptActionSaving ? 'Adding…' : 'Add'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Rename Department popup */}
      {renamingDept && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[70]" onClick={() => !deptActionSaving && closeRenameDept()}>
          <Card className={`${bgCard} border ${borderColor} w-full max-w-sm mx-4`} onClick={(e) => e.stopPropagation()}>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-[#6366f1]" />
                  <h3 className={`text-lg font-semibold ${textPrimary}`}>Rename Department</h3>
                </div>
                <button onClick={closeRenameDept} className={textSecondary}>
                  <X className="h-5 w-5" />
                </button>
              </div>
              <Input
                autoFocus
                value={renamingDept.label}
                onChange={(e) => setRenamingDept(prev => ({ ...prev, label: e.target.value }))}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); confirmRenameDept(); } }}
                data-testid="dept-rename-input"
              />
              <div>
                <p className={`text-xs ${textSecondary} mb-1.5`}>Group</p>
                <Select
                  value={renamingDept.group || 'none'}
                  onValueChange={(v) => setRenamingDept(prev => ({ ...prev, group: v === 'none' ? '' : v }))}
                >
                  <SelectTrigger className={`${bgSecondary} border ${borderColor} ${textPrimary}`} data-testid="dept-rename-group">
                    <SelectValue placeholder="Select group" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No group</SelectItem>
                    {GROUPS.map(g => (
                      <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={closeRenameDept} disabled={deptActionSaving}>Cancel</Button>
                <Button onClick={confirmRenameDept} disabled={deptActionSaving} className="bg-[#10b981] hover:bg-[#059669] text-white" data-testid="dept-rename-confirm">
                  <Check className="h-3 w-3 mr-1" /> {deptActionSaving ? 'Saving…' : 'Save'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
