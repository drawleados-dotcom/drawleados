import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { useMenuLayout } from '../../hooks/useMenuLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Button } from '../ui/button';
import { toast } from 'sonner';
import {
  Sidebar as SidebarIcon, AlignJustify, ArrowUp, ArrowDown, Save, Loader2,
} from 'lucide-react';

// Canonical module list (must mirror the keys used by Sidebar/TopNav)
const DEFAULT_MODULES = [
  { key: 'dashboard',      label: 'Dashboard' },
  { key: 'my_profile',     label: 'My Profile' },
  { key: 'our_tasks',      label: 'Operations' },
  { key: 'web_dev',        label: 'Web Dev' },
  { key: 'leads',          label: 'Leads' },
  { key: 'meetings',       label: 'Meetings' },
  { key: 'approvals',      label: 'Approvals' },
  { key: 'finance',        label: 'Finance' },
  { key: 'hr_admin',       label: 'HR Admin' },
  { key: 'documentations', label: 'Docs' },
  { key: 'sales',          label: 'Sales' },
  { key: 'meta_ads',       label: 'Meta Ads' },
  { key: 'settings',       label: 'Settings' },
];

const API = process.env.REACT_APP_BACKEND_URL;

export default function MenuSettingsTab({
  bgCard, bgSecondary, textPrimary, textSecondary, borderColor,
}) {
  const { layout, setLayout } = useMenuLayout();
  const [departments, setDepartments] = useState([]);
  const [selectedDept, setSelectedDept] = useState('');
  const [order, setOrder] = useState(DEFAULT_MODULES.map((m) => m.key));
  const [saving, setSaving] = useState(false);

  const token = localStorage.getItem('session_token');
  const headers = { Authorization: `Bearer ${token}` };

  // Load department list
  useEffect(() => {
    (async () => {
      try {
        const r = await axios.get(`${API}/api/departments`, { headers });
        setDepartments(r.data || []);
      } catch {}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load order whenever selected dept changes
  const loadOrder = useCallback(async (dept) => {
    try {
      const r = await axios.get(`${API}/api/menu-order?department_id=${encodeURIComponent(dept)}`, { headers });
      const saved = r.data?.order || [];
      const known = DEFAULT_MODULES.map((m) => m.key);
      const ordered = [
        ...saved.filter((k) => known.includes(k)),
        ...known.filter((k) => !saved.includes(k)),
      ];
      setOrder(ordered);
    } catch {
      setOrder(DEFAULT_MODULES.map((m) => m.key));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { if (selectedDept) loadOrder(selectedDept); }, [selectedDept, loadOrder]);

  const move = (idx, dir) => {
    const next = [...order];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    setOrder(next);
  };

  const save = async () => {
    if (!selectedDept) { toast.error('Choose a department first'); return; }
    setSaving(true);
    try {
      await axios.put(`${API}/api/menu-order`, { department_id: selectedDept, order }, { headers });
      toast.success('Menu order saved for this department');
      window.dispatchEvent(new Event('menu-order-change'));
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const layoutOptions = [
    { key: 'sidebar', label: 'Sidebar View', desc: 'Classic left vertical sidebar.', icon: SidebarIcon },
    { key: 'top',     label: 'Top Menu View', desc: 'Horizontal nav with all assigned pages.', icon: AlignJustify },
  ];

  return (
    <div className="space-y-6">
      {/* Layout choice */}
      <Card className={`${bgCard} border ${borderColor}`}>
        <CardHeader>
          <CardTitle className={textPrimary}>Menu Layout</CardTitle>
          <CardDescription className={textSecondary}>Saved on this device.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {layoutOptions.map((opt) => {
              const Icon = opt.icon;
              const selected = layout === opt.key;
              return (
                <button key={opt.key} type="button" onClick={() => setLayout(opt.key)}
                  data-testid={`menu-layout-${opt.key}`}
                  className={`text-left p-4 rounded-xl border-2 transition-all hover:shadow-md
                    ${selected ? 'border-[#6366f1] ring-2 ring-[#6366f1]/30 bg-[#6366f1]/5' : `${borderColor} ${bgSecondary}`}`}>
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${selected ? 'bg-[#6366f1] text-white' : 'bg-[#27272a] text-[#a1a1aa]'}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <div className={`font-semibold ${textPrimary}`}>{opt.label}</div>
                      <p className={`text-xs ${textSecondary} mt-1`}>{opt.desc}</p>
                      {selected && <span className="inline-block mt-2 text-xs text-[#6366f1] font-medium">● Active</span>}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Per-department reorder */}
      <Card className={`${bgCard} border ${borderColor}`}>
        <CardHeader>
          <CardTitle className={textPrimary}>Reorder Menu by Department</CardTitle>
          <CardDescription className={textSecondary}>
            Pick a department, then use the ↑ / ↓ buttons to set the order of menu items for users in that department.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-w-md">
            <Select value={selectedDept} onValueChange={setSelectedDept}>
              <SelectTrigger className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                             data-testid="menu-order-dept-select">
                <SelectValue placeholder="Choose a department..." />
              </SelectTrigger>
              <SelectContent className={`${bgCard} border ${borderColor}`}>
                {departments.map((d) => (
                  <SelectItem key={d.department_id || d.id} value={d.department_id || d.id}>
                    {d.name || d.department_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedDept && (
            <>
              <div className={`rounded-lg border ${borderColor} overflow-hidden`}>
                {order.map((key, idx) => {
                  const m = DEFAULT_MODULES.find((x) => x.key === key);
                  if (!m) return null;
                  return (
                    <div key={key}
                         data-testid={`menu-row-${key}`}
                         className={`flex items-center justify-between px-4 py-2 ${bgSecondary} border-b ${borderColor} last:border-b-0`}>
                      <div className="flex items-center gap-3">
                        <span className={`text-xs ${textSecondary} w-6`}>{idx + 1}.</span>
                        <span className={`text-sm font-medium ${textPrimary}`}>{m.label}</span>
                      </div>
                      <div className="flex gap-1">
                        <button type="button" onClick={() => move(idx, -1)} disabled={idx === 0}
                                className="p-1.5 rounded hover:bg-[#27272a] disabled:opacity-30">
                          <ArrowUp className="h-4 w-4 text-[#a1a1aa]" />
                        </button>
                        <button type="button" onClick={() => move(idx, 1)} disabled={idx === order.length - 1}
                                className="p-1.5 rounded hover:bg-[#27272a] disabled:opacity-30">
                          <ArrowDown className="h-4 w-4 text-[#a1a1aa]" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-end">
                <Button onClick={save} disabled={saving}
                        className="bg-[#6366f1] hover:bg-[#4f46e5] text-white"
                        data-testid="menu-order-save-btn">
                  {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  Save Order
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
