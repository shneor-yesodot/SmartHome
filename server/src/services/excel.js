import fs from 'fs';
import path from 'path';
import xlsx from 'xlsx';

const TYPE_INCOME = /inc|\u05d4\u05db\u05e0\u05e1/i;

function pick(row, keys) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== '') return row[key];
  }
  return undefined;
}

function excelDate(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'number') {
    const parsed = xlsx.SSF.parse_date_code(value);
    if (parsed) {
      const m = String(parsed.m).padStart(2, '0');
      const d = String(parsed.d).padStart(2, '0');
      return `${parsed.y}-${m}-${d}`;
    }
  }
  const s = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const dt = new Date(s);
  if (!Number.isNaN(dt.getTime())) return dt.toISOString().slice(0, 10);
  return new Date().toISOString().slice(0, 10);
}

const COL = {
  type: ['type', 'Type', '\u05e1\u05d5\u05d2'],
  amount: ['amount', 'Amount', '\u05e1\u05db\u05d5\u05dd'],
  category: ['category', 'Category', '\u05e7\u05d8\u05d2\u05d5\u05e8\u05d9\u05d4'],
  description: ['description', 'Description', '\u05ea\u05d9\u05d0\u05d5\u05e8'],
  merchant: ['merchant', 'Merchant', '\u05d1\u05d9\u05ea \u05e2\u05e1\u05e7'],
  date: ['date', 'Date', '\u05ea\u05d0\u05e8\u05d9\u05da'],
};

export function extractTransactionsFromFile(absPath) {
  const workbook = xlsx.readFile(absPath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(sheet, { defval: '' });

  const transactions = rows
    .map((row) => {
      const typeRaw = String(pick(row, COL.type) || 'expense');
      const amount = Number(pick(row, COL.amount) || 0);
      const category = String(pick(row, COL.category) || '\u05d0\u05d7\u05e8');
      return {
        type: TYPE_INCOME.test(typeRaw) ? 'income' : 'expense',
        amount,
        category,
        description: String(pick(row, COL.description) || category || 'imported'),
        merchant: String(pick(row, COL.merchant) || ''),
        date: excelDate(pick(row, COL.date)),
      };
    })
    .filter((row) => row.amount > 0);

  return { transactions };
}

export function resolveUploadPath(fileUrl, uploadsDir) {
  const name = path.basename(String(fileUrl).split('?')[0]);
  return path.join(uploadsDir, name);
}

export function fileExists(p) {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}
