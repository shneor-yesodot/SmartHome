/**
 * Reads bank and credit-card statements. Every bank exports something different
 * (.xlsx, old .xls, HTML saved as .xls, CSV), with title rows above the table and
 * sometimes several tables in a file, so the header row is searched for by its
 * column names rather than expected at a fixed place.
 */
const XLSX = require('xlsx');
const crypto = require('crypto');
const { cleanText } = require('../utils/text');

const MAX_ROWS = 20000;
const HEADER_SCAN_LIMIT = MAX_ROWS;

const normalizeHeader = (value) =>
  cleanText(value)
    .replace(/[‎‏‪-‮"'׳״₪()]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const ALIASES = {
  date: ['תאריך', 'תאריך עסקה', 'תאריך העסקה', 'תאריך רכישה', 'תאריך ביצוע', 'תאריך פעולה', 'תאריך התנועה', 'date', 'transaction date'],
  chargeDate: ['תאריך חיוב', 'מועד חיוב', 'תאריך החיוב', 'charge date'],
  description: ['תיאור', 'תיאור פעולה', 'תיאור התנועה', 'הפעולה', 'פעולה', 'סוג פעולה', 'פרטים', 'שם בית עסק', 'שם בית העסק', 'בית עסק', 'בית העסק', 'שם העסק', 'description', 'merchant', 'merchant name'],
  debit: ['חובה', 'בחובה', 'סכום חובה', 'חיוב', 'debit'],
  credit: ['זכות', 'בזכות', 'סכום זכות', 'credit'],
  charged: ['סכום חיוב', 'סכום לחיוב', 'סכום החיוב', 'סכום בשח', 'סכום חיוב בשח', 'charged amount'],
  amount: ['סכום', 'סכום עסקה', 'סכום העסקה', 'סכום קנייה', 'סכום קניה', 'סכום מקורי', 'סכום עסקה מקורי', 'זכות/חובה', 'חובה/זכות', 'amount'],
  currency: ['מטבע עסקה', 'מטבע עסקה מקורי', 'מטבע מקור', 'מטבע', 'currency'],
  balance: ['יתרה', 'יתרה בשח', 'יתרה משוערכת', 'balance'],
  reference: ['אסמכתא', 'אסמכתה', 'מספר אסמכתא', 'מספר שובר', 'מס שובר', 'שובר', 'reference'],
  card: ['4 ספרות אחרונות של כרטיס האשראי', '4 ספרות אחרונות', 'ספרות אחרונות', 'מספר כרטיס', 'כרטיס', 'card'],
  details: ['פירוט נוסף', 'הערות', 'פירוט', 'notes', 'details'],
  categoryName: ['קטגוריה', 'ענף', 'category'],
  transactionType: ['סוג עסקה', 'סוג העסקה', 'סוג'],
};

/** Maps a row to { field: columnIndex }, or null when it is not a table header. */
const readHeader = (cells) => {
  const columns = {};
  cells.forEach((cell, index) => {
    const header = normalizeHeader(cell);
    if (!header) return;
    const field = Object.keys(ALIASES).find((key) => ALIASES[key].includes(header));
    if (field && columns[field] === undefined) columns[field] = index;
  });
  const hasMoney = ['debit', 'credit', 'charged', 'amount'].some((f) => columns[f] !== undefined);
  return columns.date !== undefined && columns.description !== undefined && hasMoney ? columns : null;
};

const stripMarks = (value) => String(value ?? '').replace(/[‎‏‪-‮]/g, '').trim();

/** "1,234.50", "₪ 1,234.50", "-50", "50-" and "(50)" -> a number; null when it is not one. */
const parseAmount = (value) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  let text = stripMarks(value).replace(/[₪$€£,\s]|ש"ח|ש״ח|nis|ils/gi, '');
  if (!text) return null;
  let sign = 1;
  if (/^\(.*\)$/.test(text)) {
    sign = -1;
    text = text.slice(1, -1);
  }
  if (text.endsWith('-')) {
    sign = -1;
    text = text.slice(0, -1);
  }
  const number = Number(text);
  return Number.isFinite(number) ? sign * number : null;
};

const validDay = (year, month, day) => {
  const date = new Date(Date.UTC(year, month - 1, day));
  const ok = date.getUTCMonth() === month - 1 && date.getUTCDate() === day && year >= 2000 && year <= 2100;
  return ok ? date.toISOString().slice(0, 10) : null;
};

/** Excel serial day numbers, dd/mm/yy(yy) (always day first in Israel) and yyyy-mm-dd -> "yyyy-mm-dd". */
const parseDate = (value) => {
  if (typeof value === 'number') {
    if (value < 36526 || value > 73415) return null; // 2000-2100
    return new Date(Date.UTC(1899, 11, 30) + Math.floor(value) * 86400000).toISOString().slice(0, 10);
  }
  const text = stripMarks(value);
  let m = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return validDay(+m[1], +m[2], +m[3]);
  m = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2}|\d{4})(?:\s|$)/);
  if (m) return validDay(m[3].length === 2 ? 2000 + +m[3] : +m[3], +m[2], +m[1]);
  return null;
};

const INSTALLMENT = /(?:תשלום\s*)?(\d{1,2})\s*(?:מתוך|מ-|\/)\s*(\d{1,2})/;
const installmentOf = (text) => {
  if (!/תשלום|מתוך/.test(text)) return null;
  const m = text.match(INSTALLMENT);
  return m ? { number: +m[1], total: +m[2] } : null;
};

const STANDING_ORDER = /הוראת\s*קבע|הו"ק|הו״ק|הרשאה\s*לחיוב/;
// In a bank statement a direct debit reads "<company> חיוב"
const DIRECT_DEBIT = /\sחיוב$/;
const CASH_WITHDRAWAL = /כספומט|משיכת\s*מזומן/;
// A table of planned lines, below the real ones: they have not happened yet
const FUTURE_SECTION = /(?:תנועות|עסקאות)\s*עתידיות/;

// A word on its own: "כאל" must not match "מיכאל"
const word = (w) => `(?:^|[\\s\\-/.,])(?:${w})(?:$|[\\s\\-/.,])`;
const CARD_SETTLEMENT = new RegExp(
  [
    'ויזה', 'visa', 'ישראכרט', 'isracard', 'מאסטרקארד', 'מסטרקארד', 'mastercard', 'לאומי\\s*-?\\s*קארד', 'לאומי\\s*ויזה',
    'כאל', 'כ\\.א\\.ל', 'cal', 'מקס', 'max', 'אמריקן\\s*אקספרס', 'אמקס', 'amex', 'דיינרס', 'diners', 'כרטיסי?\\s*אשראי', '(?:חיוב|זיכוי)\\s*(?:ל|מ)?כרטיס',
  ].map(word).join('|'),
  'i'
);

/** What a card takes from (or returns to) the checking account: its lines are counted from the card's own statement. */
const isCardSettlement = (description) => CARD_SETTLEMENT.test(description);

/** Files that are really text: UTF-8 when valid, otherwise the Hebrew Windows encoding banks still use. */
const decodeText = (buffer) => {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder('windows-1255').decode(buffer);
  }
};

const isBinaryWorkbook = (buffer) =>
  (buffer[0] === 0x50 && buffer[1] === 0x4b) || // zip: .xlsx
  (buffer[0] === 0xd0 && buffer[1] === 0xcf); // compound file: old .xls

const readWorkbook = (buffer) => {
  const options = { sheetRows: MAX_ROWS, raw: true, cellFormula: false, cellHTML: false, cellDates: false };
  return isBinaryWorkbook(buffer)
    ? XLSX.read(buffer, { ...options, type: 'buffer' })
    : XLSX.read(decodeText(buffer), { ...options, type: 'string' });
};

const cardLast4 = (value) => {
  const digits = stripMarks(value).replace(/\D/g, '');
  return digits.length >= 4 ? digits.slice(-4) : '';
};

/** One table row -> a statement line, or null for titles, totals and empty rows. */
const readLine = (cells, columns, kind) => {
  const get = (field) => (columns[field] === undefined ? '' : cells[columns[field]]);
  const date = parseDate(get('date'));
  if (!date) return null;

  const details = cleanText(stripMarks(get('details')));
  const description = cleanText(stripMarks(get('description'))) || details;
  if (!description) return null;

  let signed; // positive = money out
  const debit = parseAmount(get('debit'));
  const credit = parseAmount(get('credit'));
  if (debit || credit) signed = (debit || 0) - (credit || 0);
  else if (kind === 'credit') signed = parseAmount(get('charged')) || parseAmount(get('amount'));
  else signed = -(parseAmount(get('amount')) ?? 0); // a signed bank column: negative = money out
  if (!signed) return null;

  const original = parseAmount(get('amount'));
  const currency = cleanText(stripMarks(get('currency')));
  const foreign = currency && !/₪|ש"?ח|ש״ח|ils|nis/i.test(currency);
  const transactionType = cleanText(stripMarks(get('transactionType')));
  const installment = installmentOf(`${details} ${transactionType}`);
  const chargeDate = parseDate(get('chargeDate'));
  // An installment belongs to the month it is paid, not to the month of the purchase
  const paidLater = Boolean(installment && chargeDate);

  const notes = [
    installment && `תשלום ${installment.number} מתוך ${installment.total}`,
    paidLater && `נרכש ב-${date.split('-').reverse().join('/')}`,
    foreign && original && `סכום מקורי: ${Math.abs(original)} ${currency}`,
    details && details !== description && !installment && details,
  ].filter(Boolean);

  return {
    date: paidLater ? chargeDate : date,
    chargeDate,
    description: description.slice(0, 140),
    amount: Math.round(Math.abs(signed) * 100) / 100,
    type: signed > 0 ? 'expense' : 'income',
    // Money back on a card is a refund, not earnings
    isRefund: kind === 'credit' && signed < 0,
    kind,
    reference: cleanText(stripMarks(get('reference'))).slice(0, 40),
    last4: cardLast4(get('card')),
    categoryName: cleanText(stripMarks(get('categoryName'))),
    standing: STANDING_ORDER.test(`${description} ${transactionType} ${details}`) || (kind === 'bank' && signed > 0 && DIRECT_DEBIT.test(description)),
    settlement: kind === 'bank' && isCardSettlement(description),
    cashWithdrawal: kind === 'bank' && signed > 0 && CASH_WITHDRAWAL.test(description),
    notes: notes.join(' · ').slice(0, 500),
  };
};

/**
 * Stable fingerprint of a line. Two identical coffees on one day are both real, so
 * each repeat in a file is numbered; the same file imported again gives the same numbers.
 */
const addFingerprints = (lines) => {
  const seen = new Map();
  return lines.map((line) => {
    const base = [line.date, line.chargeDate || '', line.amount, line.type, line.description, line.reference, line.last4].join('|');
    const occurrence = seen.get(base) || 0;
    seen.set(base, occurrence + 1);
    return { ...line, importHash: crypto.createHash('sha256').update(`${base}|${occurrence}`).digest('hex') };
  });
};

// The app's own import template (excel.service): these columns never head a bank or card statement together
const TEMPLATE_COLUMNS = ['סוג', 'קטגוריה', 'מוצר', 'כמות'];

/** Whether the file is SmartHome's own Excel template rather than a statement. */
const isAppTemplate = (buffer) => {
  try {
    const workbook = readWorkbook(buffer);
    const first = workbook.Sheets[workbook.SheetNames[0]];
    const [header = []] = XLSX.utils.sheet_to_json(first, { header: 1, raw: true, defval: '', blankrows: false });
    const names = header.map(normalizeHeader);
    return TEMPLATE_COLUMNS.every((c) => names.includes(c));
  } catch {
    return false;
  }
};

/** Reads a whole file. Throws when no table of transactions can be found in it. */
const parseStatement = (buffer) => {
  const workbook = readWorkbook(buffer);
  const lines = [];
  let foundHeader = false;

  for (const name of workbook.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1, raw: true, defval: '', blankrows: false });
    let columns = null;
    let kind = 'bank';
    for (const cells of rows.slice(0, HEADER_SCAN_LIMIT)) {
      const header = readHeader(cells);
      if (FUTURE_SECTION.test(normalizeHeader(cells[0]))) {
        columns = null;
      } else if (header) {
        columns = header;
        foundHeader = true;
        const isCard = header.charged !== undefined || header.chargeDate !== undefined || header.card !== undefined;
        const isBank = header.debit !== undefined || header.credit !== undefined || header.balance !== undefined;
        kind = isCard || (!isBank && /עסק/.test(normalizeHeader(cells[header.description]))) ? 'credit' : 'bank';
      } else if (columns) {
        const line = readLine(cells, columns, kind);
        if (line) lines.push(line);
      }
    }
  }
  if (!foundHeader) throw new Error('no statement table found');
  return addFingerprints(lines);
};

/**
 * Category names from a household summary sheet: a header row whose columns go
 * "חודש, <expenses...>, סה"כ", and then the same for income. Throws when there is none.
 */
const parseSummaryCategories = (buffer) => {
  const workbook = readWorkbook(buffer);
  const names = (cells) => {
    const groups = [];
    let current = null;
    cells.forEach((cell) => {
      const header = normalizeHeader(cell);
      if (header === 'חודש') current = [];
      else if (header === 'סהכ' && current) {
        groups.push(current);
        current = null;
      } else if (current && header) current.push(cleanText(stripMarks(cell)).slice(0, 40));
    });
    return groups;
  };

  for (const name of workbook.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1, raw: true, defval: '', blankrows: false });
    for (const cells of rows.slice(0, 50)) {
      const [expense, income = []] = names(cells);
      if (expense?.length) return { expense: [...new Set(expense)], income: [...new Set(income)] };
    }
  }
  throw new Error('no summary header found');
};

module.exports = { parseStatement, parseSummaryCategories, parseAmount, parseDate, isCardSettlement, isAppTemplate };
