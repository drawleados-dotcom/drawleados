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
 * Returns { rows, date, dateError, skippedSummaryRows, detectedLevel, levelMismatch }.
 * `rows` are already in the shape the backend import endpoints expect
 * ({ name, spend, leads, impressions, reach, budget_amount, budget_is_daily, date_created }).
 */
export function parseMetaCsv(csvText, level) {
  const parsed = Papa.parse((csvText || '').trim(), { header: true, skipEmptyLines: true });
  const headers = parsed.meta?.fields || [];
  if (headers.length === 0 || !parsed.data || parsed.data.length === 0) {
    return { rows: [], date: null, dateError: 'The file is empty or not a CSV export.', skippedSummaryRows: 0, detectedLevel: null, levelMismatch: false };
  }

  const nameCol = headers.find((h) => NAME_SUFFIX.test(norm(h)));
  const detectedLevel = nameCol
    ? (norm(nameCol) === 'campaign name' ? 'campaign' : norm(nameCol) === 'ad set name' ? 'adset' : norm(nameCol) === 'ad name' ? 'ad' : null)
    : null;
  const levelMismatch = !!detectedLevel && detectedLevel !== level;
  if (!nameCol) {
    return { rows: [], date: null, dateError: `Couldn't find a "…name" column — is this a Meta Ads Manager ${LEVEL_LABEL[level]} export?`, skippedSummaryRows: 0, detectedLevel, levelMismatch };
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

  let date = null;
  let dateError = null;
  const rows = [];
  let skippedSummaryRows = 0;

  for (const raw of parsed.data) {
    const name = (raw[nameCol] || '').toString().trim();
    if (!name) { skippedSummaryRows += 1; continue; } // Meta's own account-total row has a blank name
    const start = startCol ? (raw[startCol] || '').toString().trim() : '';
    const end = endCol ? (raw[endCol] || '').toString().trim() : '';
    if (start && end) {
      if (start !== end) { dateError = `This file reports ${start} to ${end} — export a single day (set "Reporting starts" and "Reporting ends" to the same date) and re-upload.`; continue; }
      if (date && date !== start) { dateError = 'This file mixes more than one reporting date — export a single day and re-upload.'; continue; }
      date = start;
    }
    let leads = leadsCol ? toNum(raw[leadsCol]) : null;
    if (leads == null && resultsCol && resultIndicatorCol && /leadgen/i.test(raw[resultIndicatorCol] || '')) {
      leads = toNum(raw[resultsCol]);
    }
    const budgetType = budgetTypeCol ? (raw[budgetTypeCol] || '').toString().trim() : '';
    rows.push({
      name,
      spend: spendCol ? toNum(raw[spendCol]) : null,
      leads,
      impressions: impressionsCol ? toNum(raw[impressionsCol]) : null,
      reach: reachCol ? toNum(raw[reachCol]) : null,
      budget_amount: budgetAmountCol ? toNum(raw[budgetAmountCol]) : null,
      budget_is_daily: budgetType ? /^daily$/i.test(budgetType) : null,
      date_created: dateCreatedCol ? toIsoDate(raw[dateCreatedCol]) : null,
    });
  }

  if (!date && !dateError) dateError = 'Could not find a reporting date in this file.';
  return { rows, date, dateError, skippedSummaryRows, detectedLevel, levelMismatch };
}

export { LEVEL_LABEL };
