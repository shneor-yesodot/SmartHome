const accountRepository = require('../repositories/account.repository');
const categoryRepository = require('../repositories/category.repository');
const transactionRepository = require('../repositories/transaction.repository');
const userRepository = require('../repositories/user.repository');
const transactionManager = require('./transaction.manager');
const reportManager = require('./report.manager');
const googleSheets = require('../services/googleSheets.service');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');
const { planSync, buildSheetValues } = require('../utils/sheetSync');
const { totalsByType, round2 } = require('../utils/finance');
const { periodOf, shiftPeriod } = require('../utils/period');

const TRANSACTIONS_TAB = 'עסקאות';
const SUMMARY_TAB = 'סיכום חודשי';
const SUMMARY_MONTHS = 24;
const MAX_ROWS = 50000;

const hebrewDate = new Intl.DateTimeFormat('he-IL-u-ca-hebrew', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

const requireConfigured = () => {
  if (!googleSheets.isConfigured()) throw ApiError.badRequest('חיבור Google Sheets לא הוגדר בשרת');
};

/** Takes a full spreadsheet link or just the id. */
const parseSpreadsheetId = (value) => {
  const id = String(value).match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/)?.[1] || String(value).trim();
  if (!/^[a-zA-Z0-9_-]{20,100}$/.test(id)) throw ApiError.badRequest('הקישור לגיליון אינו תקין');
  return id;
};

const status = (user) => ({
  configured: googleSheets.isConfigured(),
  serviceEmail: googleSheets.serviceEmail(),
  connected: Boolean(user.sheets?.spreadsheetId),
  spreadsheetId: user.sheets?.spreadsheetId || null,
  mode: user.sheets?.mode || 'backup',
  autoSync: user.sheets?.autoSync ?? true,
  lastSyncAt: user.sheets?.lastSyncAt || null,
  lastError: user.sheets?.lastError || null,
});

const connect = async (user, { spreadsheet, mode, autoSync }) => {
  requireConfigured();
  const spreadsheetId = parseSpreadsheetId(spreadsheet);
  await googleSheets.client.title(spreadsheetId); // fails with a clear message when it is not shared
  user.sheets = { spreadsheetId, mode: mode || 'backup', autoSync: autoSync ?? true };
  await user.save();
  return status(user);
};

const updateSettings = async (user, { mode, autoSync }) => {
  if (mode) user.sheets.mode = mode;
  if (autoSync !== undefined) user.sheets.autoSync = autoSync;
  await user.save();
  return status(user);
};

/** Only stops the sync. The spreadsheet itself stays as it is, in the owner's Drive. */
const disconnect = async (user) => {
  user.sheets = undefined;
  await user.save();
  return status(user);
};

const day = (date) => new Date(date).toISOString().slice(0, 10);

/** The user's transactions in the shape the sheet uses, oldest first. */
const loadAppRows = async (userId, lastSyncAt) => {
  const transactions = await transactionRepository.findAllByUser(userId, {}, { sort: { date: 1, createdAt: 1 }, limit: MAX_ROWS, populate: 'category account', lean: true });
  return transactions.map((t) => ({
    id: String(t._id),
    date: day(t.date),
    type: t.type,
    amount: t.amount,
    category: t.category?.name || '',
    description: t.description,
    merchant: t.merchant || '',
    account: t.account?.name || '',
    notes: t.notes || '',
    // Older than the last sync, so a copy of it has been in the sheet
    pushedBefore: Boolean(lastSyncAt && t.createdAt < lastSyncAt),
  }));
};

/** The month-by-month table, like the household summary sheet, in the user's calendar. */
const summaryValues = async (user) => {
  const calendar = user.calendar || 'gregorian';
  const current = periodOf(new Date(), calendar);
  const periods = Array.from({ length: SUMMARY_MONTHS }, (_, i) => shiftPeriod(current, -i));
  const transactions = await transactionRepository.findInRange(user.id, periods[periods.length - 1].from, current.to, { populate: 'category account' });
  const rows = periods.map((p) => {
    const own = transactions.filter((t) => t.date >= p.from && t.date < p.to);
    const { totals } = reportManager.summarize(own, totalsByType(own));
    return own.length ? [p.label, totals.income, totals.dailyExpenses, totals.standingOrders, totals.donations, round2(totals.expense), totals.balance] : null;
  });
  return [['חודש', 'הכנסות', 'הוצאות שוטפות', 'הוראות קבע', 'מעשרות וצדקה', 'סה״כ הוצאות', 'מאזן'], ...rows.filter(Boolean)];
};

const describePlan = (plan) => ({
  toCreate: plan.create.map((r) => ({ rowNumber: r.rowNumber, ...r.fields })),
  toUpdate: plan.update.map((r) => ({ rowNumber: r.rowNumber, id: r.id, ...r.fields })),
  conflicts: plan.conflicts,
  restored: plan.restored,
  invalid: plan.invalid.map(({ rowNumber, error }) => ({ rowNumber, error })),
});

const readPlan = async (user) => {
  const spreadsheetId = user.sheets?.spreadsheetId;
  if (!spreadsheetId) throw ApiError.badRequest('לא חובר גיליון');
  requireConfigured();
  await googleSheets.client.ensureTabs(spreadsheetId, [TRANSACTIONS_TAB, SUMMARY_TAB]);
  const [appRows, sheet] = await Promise.all([
    loadAppRows(user.id, user.sheets.lastSyncAt),
    googleSheets.client.read(spreadsheetId, TRANSACTIONS_TAB),
  ]);
  return { spreadsheetId, appRows, plan: planSync(appRows, sheet.slice(1)) };
};

/** What a two-way sync would do. Nothing changes on either side. */
const preview = async (user) => describePlan((await readPlan(user)).plan);

/** Applies edits from the sheet. A row with an unknown category is reported instead of guessed. */
const applyPlan = async (user, plan) => {
  const [categories, accounts] = await Promise.all([categoryRepository.findAllByUser(user.id), accountRepository.findAllByUser(user.id)]);
  const toPayload = ({ fields }) => {
    const category = categories.find((c) => c.name === fields.category && c.type === fields.type);
    if (!category) throw ApiError.badRequest(`הקטגוריה "${fields.category}" לא קיימת`);
    const account = accounts.find((a) => a.name === fields.account);
    return {
      type: fields.type,
      amount: round2(fields.amount),
      category: category.id,
      description: fields.description,
      merchant: fields.merchant,
      date: fields.date,
      notes: fields.notes,
      account: account ? account.id : null,
    };
  };

  const failed = [];
  const attempt = async (row, action) => {
    try {
      await action(toPayload(row));
      return 1;
    } catch (err) {
      failed.push({ rowNumber: row.rowNumber, error: err.message, cells: row.id ? null : row.cells });
      return 0;
    }
  };
  let created = 0;
  let updated = 0;
  for (const row of plan.create) created += await attempt(row, (data) => transactionManager.create(user.id, data));
  for (const row of plan.update) updated += await attempt(row, (data) => transactionManager.update(user.id, row.id, data));
  return { created, updated, failed };
};

/** Writes the app's state to the sheet. */
const push = async (user, spreadsheetId, keptRows = []) => {
  const appRows = await loadAppRows(user.id, null);
  const format = (date) => hebrewDate.format(new Date(date));
  await googleSheets.client.replace(spreadsheetId, TRANSACTIONS_TAB, buildSheetValues(appRows, format, keptRows));
  await googleSheets.client.replace(spreadsheetId, SUMMARY_TAB, await summaryValues(user));
  return appRows.length;
};

/**
 * Backup mode: the app overwrites the sheet.
 * Two-way mode: edits from the sheet come in first, then the sheet is rewritten.
 */
const sync = async (user) => {
  const fresh = await userRepository.findById(user.id);
  try {
    const { spreadsheetId, plan } = await readPlan(fresh);
    let applied = { created: 0, updated: 0, failed: [] };
    let report = { conflicts: [], restored: [], invalid: [] };
    let keptRows = [];

    if (fresh.sheets.mode === 'two-way') {
      applied = await applyPlan(fresh, plan);
      const unreadable = [...plan.invalid, ...applied.failed];
      keptRows = unreadable.filter((r) => r.cells).map((r) => r.cells);
      report = { conflicts: plan.conflicts, restored: plan.restored, invalid: unreadable.map(({ rowNumber, error }) => ({ rowNumber, error })) };
    }
    const pushed = await push(fresh, spreadsheetId, keptRows);

    fresh.sheets.lastSyncAt = new Date();
    fresh.sheets.lastError = undefined;
    await fresh.save();
    return { pushed, created: applied.created, updated: applied.updated, ...report, status: status(fresh) };
  } catch (err) {
    fresh.sheets.lastError = err.message;
    await fresh.save();
    throw err;
  }
};

/**
 * The nightly job: one user's failure never stops the others.
 * With `olderThan`, only spreadsheets not synced since then (catching up after the server slept).
 */
const syncAll = async ({ olderThan } = {}) => {
  const all = await userRepository.findForSheetsSync();
  const users = olderThan ? all.filter((u) => !u.sheets.lastSyncAt || u.sheets.lastSyncAt < olderThan) : all;
  let synced = 0;
  for (const user of users) {
    try {
      await sync(user);
      synced += 1;
    } catch (err) {
      logger.error(`[job:sheets] user ${user.id}:`, err.message);
    }
  }
  return { users: users.length, synced };
};

module.exports = { status, connect, updateSettings, disconnect, preview, sync, syncAll, parseSpreadsheetId };
