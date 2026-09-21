// One colour per task category so Ad Setup / Ad Creative / Report … are told
// apart at a glance. Hues skip the grey/blue/green/red/amber already used by
// the status and priority badges shown beside them.
const SCHEME = {
  indigo: 'bg-[#6366f1]/20 text-[#6366f1]',
  violet: 'bg-[#8b5cf6]/20 text-[#8b5cf6]',
  fuchsia: 'bg-[#d946ef]/20 text-[#d946ef]',
  teal: 'bg-[#14b8a6]/20 text-[#14b8a6]',
  cyan: 'bg-[#06b6d4]/20 text-[#06b6d4]',
  orange: 'bg-[#f97316]/20 text-[#f97316]',
  lime: 'bg-[#65a30d]/20 text-[#65a30d]',
};

const KNOWN = {
  'ad setup': 'violet',
  'ad creative': 'fuchsia',
  'ad content': 'teal',
  report: 'cyan',
  reports: 'cyan',
  'daily reports': 'cyan',
  creatives: 'orange',
};

const FALLBACK = ['indigo', 'teal', 'cyan', 'orange', 'fuchsia', 'violet', 'lime'];

export const categoryBadgeClass = (name) => {
  const key = String(name || '').trim().toLowerCase();
  if (!key) return SCHEME.indigo;
  if (KNOWN[key]) return SCHEME[KNOWN[key]];
  let h = 0;
  for (let i = 0; i < key.length; i += 1) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return SCHEME[FALLBACK[h % FALLBACK.length]];
};
