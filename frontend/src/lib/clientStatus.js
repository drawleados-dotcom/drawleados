// Shared status config for Client Master — table badges (ClientMasterPage) and
// the Analytics board (ClientAnalyticsTab) both read from here so a status
// always maps to the same label/color everywhere it appears.
export const STATUS_OPTIONS = [
  { value: 'active', label: 'Active', cls: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30', hex: '#10b981' },
  { value: 'delivered', label: 'Delivered', cls: 'bg-blue-500/15 text-blue-500 border-blue-500/30', hex: '#3b82f6' },
  { value: 'dropped', label: 'Dropped', cls: 'bg-red-500/15 text-red-500 border-red-500/30', hex: '#ef4444' },
  { value: 'not_satisfied', label: 'Not Satisfied', cls: 'bg-amber-500/15 text-amber-500 border-amber-500/30', hex: '#f59e0b' },
  { value: 'unfinished', label: 'Unfinished', cls: 'bg-slate-500/15 text-slate-400 border-slate-500/30', hex: '#64748b' },
];

export const STATUS_MAP = Object.fromEntries(STATUS_OPTIONS.map((s) => [s.value, s]));
