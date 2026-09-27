// Where a logged-in user lands: at the "/" route, on any unmatched route, and
// right after LoginPage's own explicit navigate() — all three call this same
// function so the destination never disagrees between "just logged in" and
// "refreshed the page" or "hit a stale link".
//
// vinoth@drawlead.com and every Super Admin land on Sales > Overview (the
// LAPS view) — their most-used daily screen. Admin (non-super) keeps landing
// on Dashboard. Everyone else lands on Leads if they can see it, else
// Operations, same as before.
export const landingPathFor = (user) => {
  const role = (user?.role || '').toLowerCase();
  const email = (user?.email || '').toLowerCase();
  if (email === 'vinoth@drawlead.com' || role === 'super_admin') return '/leads';
  if (role === 'admin') return '/dashboard';
  const moduleAccess = (user?.module_access || []).map((m) => String(m).toLowerCase());
  return moduleAccess.includes('leads') ? '/leads' : '/our-tasks';
};
