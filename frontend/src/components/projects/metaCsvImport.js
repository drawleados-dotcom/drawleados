import Papa from 'papaparse';

// Meta Ads Manager exports one file per level (Campaign / Ad Set / Ad). The
// column set is the same across all three except for the "…name" and
// "…delivery" columns, which are prefixed with the level — so one parser
// handles all three by finding columns by a flexible match instead of an
// exact header string (an ad account can export in a currency other than
// INR, or the export can be re-ordered/re-labelled slightly).

const NAME_SUFFIX = /\bname$/i;
const LEVEL_LABEL = { campaign: 'Campaign', adset: 'Ad Set', ad: 'Ad' };

const norm = (s) => (s || '').trim().toLowerCase();
const findCol = (headers, ...candidates) => {
  for (const cand of candidates) {
    const hit = headers.find((h) => norm(h) === norm(cand));
    if (hit) return hit;
  }
  return null;
};
const findByPrefix = (headers, prefix) => headers.find((h) => norm(h).startsWith(norm(prefix))) || null;

const toNum = (v) => {
  const s = (v ?? '').toString().trim();
  if (!s) return null;
  const n = Number(s.replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const toIsoDate = (v) => {
  const s = (v ?? '').toString().trim();
  return ISO_DATE.test(s) ? s : null;
};

/**
 * Parses raw CSV text from a Meta Ads Manager export for the given level.
 * Every row still has to be a genuine single day (Meta's own "Reporting
 * starts" == "Reporting ends") — that's what makes its numbers meaningful.
 * The file itself can span many such days at once: Meta's "breakdown by day"
 * export produces one row per entity per day, so rows are grouped by date
 * into `days` (sorted chronologically) instead of requiring the whole file
 * to be one date. A plain single-day export just comes back as `days` of
 * length 1.
 *
 * Returns { days: [{ date, rows }], totalRows, dateError, skippedSummaryRows,
 * detectedLevel, levelMismatch }. Each row is already in the shape the
 * backend import endpoints expect
 * ({ name, spend, leads, impressions, reach, budget_amount, budget_is_daily, date_created }).
 */
export function parseMetaCsv(csvText, level) {
  const empty = { days: [], totalRows: 0, dateError: null, skippedSummaryRows: 0, detectedLevel: null, levelMismatch: false };
  const parsed = Papa.parse((csvText || '').trim(), { header: true, skipEmptyLines: true });
  const headers = parsed.meta?.fields || [];
  if (headers.length === 0 || !parsed.data || parsed.data.length === 0) {
    return { ...empty, dateError: 'The file is empty or not a CSV export.' };
  }

  const nameCol = headers.find((h) => NAME_SUFFIX.test(norm(h)));
  const detectedLevel = nameCol
    ? (norm(nameCol) === 'campaign name' ? 'campaign' : norm(nameCol) === 'ad set name' ? 'adset' : norm(nameCol) === 'ad name' ? 'ad' : null)
    : null;
  const levelMismatch = !!detectedLevel && detectedLevel !== level;
  if (!nameCol) {
    return { ...empty, dateError: `Couldn't find a "…name" column — is this a Meta Ads Manager ${LEVEL_LABEL[level]} export?`, detectedLevel, levelMismatch };
  }

  const startCol = findCol(headers, 'Reporting starts');
  const endCol = findCol(headers, 'Reporting ends');
  const spendCol = findByPrefix(headers, 'Amount spent');
  const leadsCol = findCol(headers, 'Leads');
  const resultsCol = findCol(headers, 'Results');
  const resultIndicatorCol = findCol(headers, 'Result indicator');
  const impressionsCol = findCol(headers, 'Impressions');
  const reachCol = findCol(headers, 'Reach');
  const budgetAmountCol = findCol(headers, 'Ad set budget');
  const budgetTypeCol = findCol(headers, 'Ad set budget type');
  const dateCreatedCol = findCol(headers, 'Date created');
  if (!startCol || !endCol) {
    return { ...empty, dateError: 'Could not find "Reporting starts" / "Reporting ends" columns in this file.', detectedLevel, levelMismatch };
  }

  let dateError = null;
  const byDate = new Map(); // date -> rows[]
  let skippedSummaryRows = 0;
  let totalRows = 0;

  for (const raw of parsed.data) {
    const name = (raw[nameCol] || '').toString().trim();
    if (!name) { skippedSummaryRows += 1; continue; } // Meta's own account-total row has a blank name
    const start = (raw[startCol] || '').toString().trim();
    const end = (raw[endCol] || '').toString().trim();
    if (!start || !end) { dateError = 'A row is missing its reporting date.'; break; }
    if (start !== end) {
      dateError = `This file has a row reporting ${start} to ${end} — export a single day per row (set "Reporting starts" and "Reporting ends" to the same date, or use Meta's "Breakdown > Day" for a month at once) and re-upload.`;
      break;
    }
    let leads = leadsCol ? toNum(raw[leadsCol]) : null;
    if (leads == null && resultsCol && resultIndicatorCol && /leadgen/i.test(raw[resultIndicatorCol] || '')) {
      leads = toNum(raw[resultsCol]);
    }
    const budgetType = budgetTypeCol ? (raw[budgetTypeCol] || '').toString().trim() : '';
    const row = {
      name,
      spend: spendCol ? toNum(raw[spendCol]) : null,
      leads,
      impressions: impressionsCol ? toNum(raw[impressionsCol]) : null,
      reach: reachCol ? toNum(raw[reachCol]) : null,
      budget_amount: budgetAmountCol ? toNum(raw[budgetAmountCol]) : null,
      budget_is_daily: budgetType ? /^daily$/i.test(budgetType) : null,
      date_created: dateCreatedCol ? toIsoDate(raw[dateCreatedCol]) : null,
    };
    if (!byDate.has(start)) byDate.set(start, []);
    byDate.get(start).push(row);
    totalRows += 1;
  }

  if (dateError) return { ...empty, dateError, skippedSummaryRows, detectedLevel, levelMismatch };
  if (byDate.size === 0) return { ...empty, dateError: 'Could not find a reporting date in this file.', skippedSummaryRows, detectedLevel, levelMismatch };

  const days = Array.from(byDate.keys()).sort().map((date) => ({ date, rows: byDate.get(date) }));
  return { days, totalRows, dateError: null, skippedSummaryRows, detectedLevel, levelMismatch };
}

export { LEVEL_LABEL };
