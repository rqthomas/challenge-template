// Number and date formatting.

const MINUS = '−';

export function num(x, digits = 2) {
  return x === null || x === undefined || Number.isNaN(x) ? '–' : Number(x).toFixed(digits);
}

// Skill with an explicit sign: +0.31, −0.06.
export function skill(x) {
  if (x === null || x === undefined || Number.isNaN(x)) return '–';
  return (x >= 0 ? '+' : MINUS) + Math.abs(x).toFixed(2);
}

export function integer(x) {
  return x === null || x === undefined ? '–' : Math.round(x).toLocaleString('en-GB');
}

const DAY = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const DAY_YEAR = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

export const MS_DAY = 86400000;

export function day(ms) { return DAY.format(new Date(ms)); }
export function dayYear(value) { return DAY_YEAR.format(new Date(value)); }

// "2 h ago", "3 days ago" for an ISO time.
export function ago(iso, now = Date.now()) {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  const s = Math.max(0, (now - t) / 1000);
  if (s < 90) return 'just now';
  if (s < 5400) return `${Math.round(s / 60)} min ago`;
  if (s < 129600) return `${Math.round(s / 3600)} h ago`;
  const d = Math.round(s / 86400);
  return d === 1 ? 'yesterday' : `${d} days ago`;
}

// Number of days as words: "7 days", "1 year".
export function span(days) {
  return days === 1 ? '1 day' : `${days} days`;
}
