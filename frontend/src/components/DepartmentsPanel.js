import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Building2, Plus, X, Check, Tag, Trash2, Pencil } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import useAutoRefresh from '../hooks/useAutoRefresh';

const API = process.env.REACT_APP_BACKEND_URL;

export default function DepartmentsPanel({
  isDark, textPrimary, textSecondary, bgCard, bgSecondary, borderColor, headers,
}) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingDept, setEditingDept] = useState(null); // { dept_key, label, categories }
  const [categoryDraft, setCategoryDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API}/api/department-categories`, { headers });
      setList(res.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [headers]);

  useEffect(() => { load(); }, [load]);

  // Background polling + focus refresh — pauses while editing a department
  useAutoRefresh(load, { enabled: !editingDept });

  const openEdit = (dept) => {
    setEditingDept({ ...dept, categories: [...(dept.categories || [])] });
    setCategoryDraft('');
    setEditingCategory(null);
  };
  const [editingCategory, setEditingCategory] = useState(null); // { original, value }

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

  const save = async () => {
    if (!editingDept) return;
    setSaving(true);
    try {
      await axios.put(
        `${API}/api/department-categories/${editingDept.dept_key}`,
        { categories: editingDept.categories || [] },
        { headers }
      );
      toast.success(`${editingDept.label} categories saved`);
      setEditingDept(null);
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to save categories');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4" data-testid="departments-panel">
      <div>
        <h2 className={`text-xl font-semibold ${textPrimary}`}>Departments &amp; Categories</h2>
        <p className={textSecondary}>Define categories per department. They appear when creating tasks inside projects.</p>
      </div>

      {loading ? (
        <p className={textSecondary}>Loading...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {list.map(dept => (
            <Card
              key={dept.dept_key}
              className={`${bgCard} border ${borderColor} cursor-pointer hover:border-[#6366f1] transition-colors`}
              onClick={() => openEdit(dept)}
              data-testid={`dept-card-${dept.dept_key}`}
            >
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="h-9 w-9 rounded-lg bg-[#6366f1]/20 flex items-center justify-center">
                      <Building2 className="h-5 w-5 text-[#6366f1]" />
                    </div>
                    <h3 className={`font-semibold ${textPrimary}`}>{dept.label}</h3>
                  </div>
                  <Badge className="bg-[#6366f1]/20 text-[#6366f1]">
                    {(dept.categories || []).length}
                  </Badge>
                </div>
                {(dept.categories || []).length === 0 ? (
                  <p className={`text-xs ${textSecondary}`}>No categories yet — click to add.</p>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {(dept.categories || []).slice(0, 4).map(c => (
                      <Badge key={c} className={`text-xs ${bgSecondary} ${textPrimary}`}>{c}</Badge>
                    ))}
                    {dept.categories.length > 4 && (
                      <Badge className={`text-xs ${bgSecondary} ${textSecondary}`}>+{dept.categories.length - 4}</Badge>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Categories Popup */}
      {editingDept && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[70]" onClick={() => !saving && setEditingDept(null)}>
          <Card className={`${bgCard} border ${borderColor} w-full max-w-md mx-4`} onClick={(e) => e.stopPropagation()}>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-[#6366f1]" />
                  <h3 className={`text-lg font-semibold ${textPrimary}`}>{editingDept.label} — Categories</h3>
                </div>
                <button onClick={() => !saving && setEditingDept(null)} className={textSecondary}>
                  <X className="h-5 w-5" />
                </button>
              </div>
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
    </div>
  );
}
