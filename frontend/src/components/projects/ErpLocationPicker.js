import React, { useState } from 'react';
import { Label } from '../ui/label';

/**
 * Cascading Department -> User -> Page -> Sub Tab -> Ultra Sub Tab -> Ultra
 * Tab -> Ultra Tab Pro picker for tagging a task to an exact node in a
 * project's ERP Users hierarchy. Shared by the ERP Users tab's quick
 * Add/Edit Task popup and the Project's own Tasks tab, so both tag tasks
 * the same way.
 *
 * `value` holds only the fields that actually get saved on the task
 * (erp_user_id/name, erp_page_id/name, erp_sub_tab_id/name,
 * erp_ultra_sub_tab_id/name, erp_ultra_tab_id/name,
 * erp_ultra_tab_pro_id/name). Department is a local-only filter narrowing
 * the User dropdown — an erp_user's department_id, not something stored on
 * the task itself.
 */
export default function ErpLocationPicker({
  project, value, onChange,
  bgSecondary, borderColor, textPrimary, textSecondary,
  testPrefix = 'erp-location',
}) {
  const erpUsers = project?.erp_users || [];
  const erpDepartments = project?.erp_departments || [];
  const [departmentFilter, setDepartmentFilter] = useState('all');

  const visibleUsers = departmentFilter === 'all'
    ? erpUsers
    : erpUsers.filter(u => u.department_id === departmentFilter);

  const selectedUser = erpUsers.find(u => u.id === value.erp_user_id);
  const pages = selectedUser?.pages || [];
  const selectedPage = pages.find(p => p.id === value.erp_page_id);
  const subTabs = selectedPage?.sub_tabs || [];
  const selectedSubTab = subTabs.find(st => st.id === value.erp_sub_tab_id);
  const ultraSubTabs = selectedSubTab?.ultra_sub_tabs || [];
  const selectedUltraSubTab = ultraSubTabs.find(ut => ut.id === value.erp_ultra_sub_tab_id);
  const ultraTabs = selectedUltraSubTab?.ultra_tabs || [];
  const selectedUltraTab = ultraTabs.find(it => it.id === value.erp_ultra_tab_id);
  const ultraTabPros = selectedUltraTab?.ultra_tab_pro || [];

  const set = (patch) => onChange({ ...value, ...patch });

  const selectClass = `w-full h-9 px-2 rounded-md text-sm border ${borderColor} ${bgSecondary} ${textPrimary} disabled:opacity-50`;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
      <div>
        <Label className={`text-xs ${textSecondary}`}>Department</Label>
        <select
          value={departmentFilter}
          onChange={(e) => setDepartmentFilter(e.target.value)}
          className={selectClass}
          data-testid={`${testPrefix}-department`}
        >
          <option value="all">All Departments</option>
          {erpDepartments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>
      <div>
        <Label className={`text-xs ${textSecondary}`}>User</Label>
        <select
          value={value.erp_user_id || ''}
          onChange={(e) => {
            const eu = erpUsers.find(u => u.id === e.target.value);
            set({
              erp_user_id: e.target.value, erp_user_name: eu?.user_name || '',
              erp_page_id: '', erp_page_name: '',
              erp_sub_tab_id: '', erp_sub_tab_name: '',
              erp_ultra_sub_tab_id: '', erp_ultra_sub_tab_name: '',
              erp_ultra_tab_id: '', erp_ultra_tab_name: '',
              erp_ultra_tab_pro_id: '', erp_ultra_tab_pro_name: '',
            });
          }}
          className={selectClass}
          data-testid={`${testPrefix}-user`}
        >
          <option value="">— select user —</option>
          {visibleUsers.map(u => <option key={u.id} value={u.id}>{u.user_name}</option>)}
        </select>
      </div>
      <div>
        <Label className={`text-xs ${textSecondary}`}>Page</Label>
        <select
          value={value.erp_page_id || ''}
          disabled={!value.erp_user_id}
          onChange={(e) => {
            const pg = pages.find(p => p.id === e.target.value);
            set({
              erp_page_id: e.target.value,
              erp_page_name: e.target.value === 'others' ? 'Others' : (pg?.page_name || ''),
              erp_sub_tab_id: '', erp_sub_tab_name: '',
              erp_ultra_sub_tab_id: '', erp_ultra_sub_tab_name: '',
              erp_ultra_tab_id: '', erp_ultra_tab_name: '',
              erp_ultra_tab_pro_id: '', erp_ultra_tab_pro_name: '',
            });
          }}
          className={selectClass}
          data-testid={`${testPrefix}-page`}
        >
          <option value="">— select page —</option>
          {pages.map(p => <option key={p.id} value={p.id}>{p.page_name}</option>)}
          <option value="others">Others</option>
        </select>
      </div>
      <div>
        <Label className={`text-xs ${textSecondary}`}>Sub Tab</Label>
        <select
          value={value.erp_sub_tab_id || ''}
          disabled={subTabs.length === 0}
          onChange={(e) => {
            const st = subTabs.find(s => s.id === e.target.value);
            set({
              erp_sub_tab_id: e.target.value, erp_sub_tab_name: st?.name || '',
              erp_ultra_sub_tab_id: '', erp_ultra_sub_tab_name: '',
              erp_ultra_tab_id: '', erp_ultra_tab_name: '',
              erp_ultra_tab_pro_id: '', erp_ultra_tab_pro_name: '',
            });
          }}
          className={selectClass}
          data-testid={`${testPrefix}-subtab`}
        >
          <option value="">— none —</option>
          {subTabs.map(st => <option key={st.id} value={st.id}>{st.name}</option>)}
        </select>
      </div>
      <div>
        <Label className={`text-xs ${textSecondary}`}>Ultra Sub Tab</Label>
        <select
          value={value.erp_ultra_sub_tab_id || ''}
          disabled={ultraSubTabs.length === 0}
          onChange={(e) => {
            const ut = ultraSubTabs.find(u => u.id === e.target.value);
            set({
              erp_ultra_sub_tab_id: e.target.value, erp_ultra_sub_tab_name: ut?.name || '',
              erp_ultra_tab_id: '', erp_ultra_tab_name: '',
              erp_ultra_tab_pro_id: '', erp_ultra_tab_pro_name: '',
            });
          }}
          className={selectClass}
          data-testid={`${testPrefix}-ultrasubtab`}
        >
          <option value="">— none —</option>
          {ultraSubTabs.map(ut => <option key={ut.id} value={ut.id}>{ut.name}</option>)}
        </select>
      </div>
      <div>
        <Label className={`text-xs ${textSecondary}`}>Ultra Tab</Label>
        <select
          value={value.erp_ultra_tab_id || ''}
          disabled={ultraTabs.length === 0}
          onChange={(e) => {
            const it = ultraTabs.find(i => i.id === e.target.value);
            set({
              erp_ultra_tab_id: e.target.value, erp_ultra_tab_name: it?.name || '',
              erp_ultra_tab_pro_id: '', erp_ultra_tab_pro_name: '',
            });
          }}
          className={selectClass}
          data-testid={`${testPrefix}-ultratab`}
        >
          <option value="">— none —</option>
          {ultraTabs.map(it => <option key={it.id} value={it.id}>{it.name}</option>)}
        </select>
      </div>
      <div>
        <Label className={`text-xs ${textSecondary}`}>Ultra Tab Pro</Label>
        <select
          value={value.erp_ultra_tab_pro_id || ''}
          disabled={ultraTabPros.length === 0}
          onChange={(e) => {
            const pro = ultraTabPros.find(p => p.id === e.target.value);
            set({ erp_ultra_tab_pro_id: e.target.value, erp_ultra_tab_pro_name: pro?.name || '' });
          }}
          className={selectClass}
          data-testid={`${testPrefix}-ultratabpro`}
        >
          <option value="">— none —</option>
          {ultraTabPros.map(pro => <option key={pro.id} value={pro.id}>{pro.name}</option>)}
        </select>
      </div>
    </div>
  );
}
