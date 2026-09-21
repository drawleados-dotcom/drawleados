// Shared helpers for the Meta Ads Campaigns and Ads tabs. A daily budget is a
// history of { id, amount, from_date } entries: each runs from its start date
// until the day before the next entry starts, and the one that has already
// started and is latest is "current".

export const newId = (prefix) => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;

// Repo convention: "today" is always the IST calendar date, never raw UTC.
export const todayIST = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

export const sortHistory = (history) => [...(history || [])].sort((a, b) => a.from_date.localeCompare(b.from_date));

// The budget entry in effect today (latest one that has already started).
export const currentEntryOf = (history) => {
  const today = todayIST();
  const started = sortHistory(history).filter(e => e.from_date <= today);
  return started.length ? started[started.length - 1] : null;
};

export const prevDay = (iso) => {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const fmtDate = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

export const money = (n) => `₹${Number(n).toLocaleString('en-IN')}`;

// One budget per start date — setting a budget for a date that already has
// one replaces it; every other entry stays as history.
export const upsertBudget = (history, amount, fromDate) => sortHistory([
  ...(history || []).filter(e => e.from_date !== fromDate),
  { id: newId('bud'), amount, from_date: fromDate },
]);

// The Campaigns tab only edits names, budgets, locations and the ad set / ad
// structure. Everything else on an ad — content / creative links, uploaded
// files, assignees, task ids, setup status — is written elsewhere (the Ads
// tab, and assignees submitting from My Tasks), and a campaign's `budget_type`
// is set on the Ads tab. So before saving, take those from the server's
// current copy instead of this tab's possibly stale one.
export const mergeFreshAdWork = (next, fresh) => (next || []).map((c) => {
  const fc = (fresh || []).find(x => x.id === c.id);
  if (!fc) return c;
  return {
    ...c,
    ...(fc.budget_type !== undefined ? { budget_type: fc.budget_type } : {}),
    ad_sets: (c.ad_sets || []).map((s) => {
      const fs = (fc.ad_sets || []).find(x => x.id === s.id);
      if (!fs) return s;
      return {
        ...s,
        ads: (s.ads || []).map((ad) => {
          const fa = (fs.ads || []).find(x => x.id === ad.id);
          return fa ? { ...fa, name: ad.name } : ad;
        }),
      };
    }),
  };
});
