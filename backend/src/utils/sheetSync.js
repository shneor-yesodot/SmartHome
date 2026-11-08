/**
 * The logic of the Google Sheets sync, with no network or database, so it can
 * be tested on its own.
 *
 * Every pushed row carries a stamp: a hash of its values at that moment. Comparing
 * a row with its stamp shows whether the sheet was edited; comparing the app's
 * transaction with the same stamp shows whether the app was edited.
 */
const crypto = require('crypto');
const { round2 } = require('./finance');
const { parseAmount, parseDate } = require('../services/statement.service');

const HEADERS = ['מזהה', 'תאריך', 'תאריך עברי', 'סוג', 'סכום', 'קטגוריה', 'תיאור', 'בית עסק', 'אמצעי תשלום', 'הערות', 'חתימה'];
const COL = { id: 0, date: 1, hebrewDate: 2, type: 3, amount: 4, category: 5, description: 6, merchant: 7, account: 8, notes: 9, stamp: 10 };
const TYPE_LABELS = { income: 'הכנסה', expense: 'הוצאה' };
const TYPE_BY_LABEL = { הכנסה: 'income', הוצאה: 'expense', income: 'income', expense: 'expense' };

/** The values that are compared. The Hebrew date is derived, so editing it changes nothing. */
const stampOf = ({ date, type, amount, category, description, merchant, account, notes }) =>
  crypto
    .createHash('sha256')
    .update(JSON.stringify([date, type, round2(amount), category, description, merchant || '', account || '', notes || '']))
    .digest('hex')
    .slice(0, 16);

const text = (value) => String(value ?? '').trim();

/** A sheet row -> comparable fields, or an error in Hebrew explaining what is wrong with it. */
const readSheetRow = (cells, rowNumber) => {
  const get = (name) => text(cells[COL[name]]);
  const date = parseDate(get('date'));
  const type = TYPE_BY_LABEL[get('type')];
  const amount = parseAmount(get('amount'));
  const errors = [];
  if (!date) errors.push('תאריך לא תקין');
  if (!type) errors.push('סוג חייב להיות "הכנסה" או "הוצאה"');
  if (!amount || amount <= 0) errors.push('סכום לא תקין');
  if (!get('description')) errors.push('חסר תיאור');
  if (!get('category')) errors.push('חסרה קטגוריה');
  return {
    rowNumber,
    id: get('id'),
    stamp: get('stamp'),
    cells,
    error: errors.join(', ') || null,
    fields: {
      date,
      type,
      amount,
      category: get('category'),
      description: get('description').slice(0, 140),
      merchant: get('merchant').slice(0, 80),
      account: get('account'),
      notes: get('notes').slice(0, 500),
    },
  };
};

const isEmptyRow = (cells) => !cells || cells.every((c) => !text(c));

/**
 * Compares the sheet with the app.
 * - new row in the sheet (no id): created in the app
 * - edited only in the sheet: the app takes the change
 * - edited on both sides: the app wins, and the row is reported
 * - removed from the sheet: nothing is deleted from the app, and the row is reported
 *   (losing a row by accident in a spreadsheet must not lose real data)
 * - a row the app cannot read: kept in the sheet as it is, and reported
 */
const planSync = (appRows, sheetCells) => {
  const app = new Map(appRows.map((row) => [row.id, row]));
  const seen = new Set();
  const plan = { create: [], update: [], conflicts: [], restored: [], invalid: [] };

  sheetCells.forEach((cells, index) => {
    if (isEmptyRow(cells)) return;
    const row = readSheetRow(cells, index + 2); // +1 for the header, +1 because sheets count from 1
    const current = row.id ? app.get(row.id) : null;

    if (row.id && !current) return; // deleted in the app since the last sync: disappears on the next push
    if (current) seen.add(row.id);
    if (row.error) {
      plan.invalid.push({ rowNumber: row.rowNumber, error: row.error, cells: row.id ? null : cells });
      return;
    }
    if (!current) {
      plan.create.push(row);
      return;
    }
    const editedInSheet = stampOf(row.fields) !== row.stamp;
    const editedInApp = stampOf(current) !== row.stamp;
    if (!editedInSheet) return;
    if (stampOf(row.fields) === stampOf(current)) return; // same edit on both sides
    if (editedInApp) plan.conflicts.push({ rowNumber: row.rowNumber, id: row.id, description: current.description });
    else plan.update.push({ ...row, current });
  });

  appRows.forEach((row) => {
    if (row.pushedBefore && !seen.has(row.id)) plan.restored.push({ id: row.id, description: row.description, date: row.date });
  });
  return plan;
};

/** What a push writes: the header, every transaction, then the rows the app could not read. */
const buildSheetValues = (appRows, hebrewDate, keptRows = []) => [
  HEADERS,
  ...appRows.map((r) => [
    r.id,
    r.date,
    hebrewDate(r.date),
    TYPE_LABELS[r.type],
    r.amount,
    r.category,
    r.description,
    r.merchant || '',
    r.account || '',
    r.notes || '',
    stampOf(r),
  ]),
  ...keptRows,
];

module.exports = { HEADERS, COL, stampOf, planSync, buildSheetValues, readSheetRow };
