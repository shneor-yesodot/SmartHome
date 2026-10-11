export const HEBREW_MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];

const number = (value, digits) =>
  Number(value || 0).toLocaleString('he-IL', { minimumFractionDigits: digits, maximumFractionDigits: digits });

/** 1234.5 -> "1,234.50 ₪". Whole numbers are shown without decimals. */
export const formatMoney = (value, { round = false } = {}) => {
  const n = Number(value || 0);
  const digits = round || Number.isInteger(n) ? 0 : 2;
  return `${number(round ? Math.round(n) : n, digits)} ₪`;
};

/**
 * Amount with an explicit sign: "+1,200 ₪" / "-85.90 ₪".
 * The left-to-right mark keeps the sign next to the digits inside right-to-left text.
 */
export const formatSigned = (value, options) => {
  const n = Number(value || 0);
  return `\u200E${n < 0 ? '-' : '+'}${formatMoney(Math.abs(n), options)}`;
};

/** Signed amount of a transaction: income is positive, expense is negative. */
export const formatTransactionAmount = (t) => formatSigned(t.type === 'income' ? t.amount : -t.amount);

export const formatPercent = (value) => `${Math.round(Number(value || 0))}%`;

/** Signed change, e.g. "+12%" / "-4%". Returns null when there is nothing to compare with. */
export const formatChange = (value) => (value === null || value === undefined ? null : `\u200E${value > 0 ? '+' : ''}${Math.round(value)}%`);

// Business dates are stored as UTC midnight, so they are always formatted in UTC
export const formatDate = (date) =>
  date ? new Date(date).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }) : '';

export const formatDayMonth = (date) =>
  date ? new Date(date).toLocaleDateString('he-IL', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : '';

/** Compact numeric date for chart axes: 26/9 */
export const formatDayNumeric = (date) => {
  const d = new Date(date);
  return `${d.getUTCDate()}/${d.getUTCMonth() + 1}`;
};

export const monthLabel = (year, month) => `${HEBREW_MONTHS[month]} ${year}`;

/** Value for <input type="date"> */
export const toInputDate = (date) => (date ? new Date(date).toISOString().slice(0, 10) : '');
export const todayInput = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
