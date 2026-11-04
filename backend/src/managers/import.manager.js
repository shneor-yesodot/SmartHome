const accountRepository = require('../repositories/account.repository');
const categoryRepository = require('../repositories/category.repository');
const transactionRepository = require('../repositories/transaction.repository');
const accountManager = require('./account.manager');
const categoryManager = require('./category.manager');
const budgetManager = require('./budget.manager');
const statementService = require('../services/statement.service');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');
const { addDays } = require('../utils/dateUtils');
const { round2 } = require('../utils/finance');

const NEARBY_DAYS = 3;
const HISTORY_LIMIT = 3000;

// First guess for a merchant nobody has categorized yet; the user's own history always wins.
// The first group fits categories imported from a household summary sheet.
const KEYWORDS = [
  [/חברת החשמל/, 'חשמל'],
  [/(?:^|\s)מי /, 'מים'],
  [/ארנונה|עירי/, 'ארנונה'],
  [/למשכ|משכנתא/, 'משכנתא'],
  [/פירעון הלוואה/, 'החזר הלוואה'],
  [/הראל|מגדל חברה|מנורה/, 'ביטוחים (הראל, מנורה, מגדל)'],
  [/פייר פיננ/, 'השקעות - פייר'],
  [/מעונות/, 'מעונות'],
  [/קופ"ח|מאוחדת|מכבי|כללית/, 'בריאות'],
  [/סופר|מרקט|מאפי/, 'אוכל'],
  [/ביטוח לאומי.*ילדים/, 'קצבת ילדים'],
  [/משכורת|שכר עבודה/, 'הכנסה קבועה'],
  [/שופרסל|רמי לוי|ויקטורי|יוחננוף|מגה|טיב טעם|חצי חינם|אושר עד|יינות ביתן|סופר/, 'סופר ומזון'],
  [/דלק|סונול|פז |ten|דור אלון|רכבת|אגד|דן |חניה|חניון|פנגו|סלופארק|כביש 6|ביטוח רכב|מוסך/i, 'תחבורה ורכב'],
  [/חשמל|ארנונה|תאגיד|(?:^|\s)מי |מים|עירי|גז|ועד בית|משכנתא|למשכ|שכר דירה/, 'דיור וחשבונות'],
  [/סלקום|פרטנר|פלאפון|בזק|הוט|yes|גולן טלקום|netflix|נטפליקס|spotify|ספוטיפיי|apple|google/i, 'תקשורת ומנויים'],
  [/סופר פארם|מכבי|כללית|מאוחדת|לאומית|בית מרקחת|רופא|קופת חולים/, 'בריאות וטיפוח'],
  [/גן |צהרון|בית ספר|תלמוד תורה|חוג|ישיבה|אולפנה/, 'ילדים וחינוך'],
  [/קסטרו|זארה|h&m|fox|גולף|נעליים|רנואר/i, 'ביגוד והנעלה'],
  [/מסעד|קפה|פיצה|בורגר|ארומה|קולנוע|וולט|wolt/i, 'מסעדות ובילויים'],
  [/צדקה|מעשר|תרומה|גמ"ח|גמ״ח|כולל/, 'צדקה ומעשרות'],
  [/משכורת|שכר עבודה/, 'משכורת'],
  [/ביטוח לאומי|קצב|החזר|זיכוי/, 'קצבאות והחזרים'],
];

const keywordCategory = (description, categories, type) => {
  for (const [pattern, name] of KEYWORDS) {
    const category = pattern.test(description) && categories.find((c) => c.type === type && c.name === name);
    if (category) return category;
  }
  return undefined;
};

/** The category last used for each description or merchant: statements repeat the same names. */
const learnedCategories = async (userId, lines) => {
  const names = [...new Set(lines.map((l) => l.description))];
  const past = await transactionRepository.findAllByUser(
    userId,
    { $or: [{ description: { $in: names } }, { merchant: { $in: names } }] },
    { sort: { date: -1 }, limit: HISTORY_LIMIT, lean: true }
  );
  const learned = new Map();
  past.forEach((t) => {
    [t.description, t.merchant].forEach((name) => {
      const key = `${t.type}|${name}`;
      if (name && !learned.has(key)) learned.set(key, String(t.category));
    });
  });
  return learned;
};

/**
 * Already-recorded transactions a statement line probably repeats: a standing
 * order the app posted, or an expense typed by hand. Each one matches one line only.
 */
const nearbyMatcher = async (userId, lines) => {
  if (!lines.length) return { single: () => null, purchase: () => null };
  const dates = lines.map((l) => new Date(l.date).getTime());
  const from = addDays(new Date(Math.min(...dates)), -NEARBY_DAYS);
  const to = addDays(new Date(Math.max(...dates)), NEARBY_DAYS + 1);
  const [existing, items] = await Promise.all([
    transactionRepository.findInRange(userId, from, to, { filter: { source: { $in: ['manual', 'recurring'] }, purchase: { $exists: false } } }),
    transactionRepository.findPurchaseItems(userId, from, to),
  ]);
  const isNear = (date, line) => Math.abs(new Date(date) - new Date(line.date)) <= NEARBY_DAYS * 86400000;

  // Purchases still waiting for their statement line
  const purchases = new Map();
  items.forEach((t) => {
    const key = String(t.purchase);
    const group = purchases.get(key) || { id: key, date: t.date, total: 0, count: 0, linked: false };
    group.total = round2(group.total + t.amount);
    group.count += 1;
    group.linked = group.linked || Boolean(t.importHash);
    purchases.set(key, group);
  });

  const used = new Set();
  return {
    single: (line) => {
      const match = existing.find((t) => !used.has(String(t._id)) && t.type === line.type && round2(t.amount) === line.amount && isNear(t.date, line));
      if (match) used.add(String(match._id));
      return match || null;
    },
    purchase: (line) => {
      if (line.type !== 'expense') return null;
      const match = [...purchases.values()].find((p) => !p.linked && !used.has(p.id) && p.total === line.amount && isNear(p.date, line));
      if (match) used.add(match.id);
      return match || null;
    },
  };
};

/**
 * Reads a statement and says what would happen to each line. Nothing is saved yet.
 * Lines that would count money twice start switched off, with the reason next to them.
 */
const preview = async (userId, file) => {
  let lines;
  try {
    lines = statementService.parseStatement(file.buffer);
  } catch (err) {
    logger.warn('Statement could not be read:', err.message);
    throw ApiError.badRequest('לא זיהינו טבלת תנועות בקובץ. ודאו שזה דף תנועות של הבנק או חברת האשראי, עם עמודות תאריך, תיאור וסכום');
  }
  if (!lines.length) throw ApiError.badRequest('הקובץ נקרא, אבל לא נמצאו בו תנועות');

  const [categories, accounts, known, learned, matchNearby] = await Promise.all([
    categoryRepository.findAllByUser(userId),
    accountRepository.findAllByUser(userId),
    transactionRepository.existingImportHashes(userId, lines.map((l) => l.importHash)),
    learnedCategories(userId, lines),
    nearbyMatcher(userId, lines),
  ]);
  const byLast4 = new Map(accounts.filter((a) => a.last4).map((a) => [a.last4, a]));

  const rows = lines.map((line, index) => {
    const category =
      categories.find((c) => c.id === learned.get(`${line.type}|${line.description}`)) ||
      categories.find((c) => c.type === line.type && c.name === line.categoryName) ||
      keywordCategory(line.description, categories, line.type);
    const row = {
      ...line,
      row: index + 1,
      category: category ? category.id : null,
      account: line.last4 ? byLast4.get(line.last4)?.id || null : null,
      include: true,
      flag: null,
    };
    if (known.has(line.importHash)) return { ...row, include: false, flag: 'imported' };
    if (line.settlement) return { ...row, include: false, flag: 'settlement' };
    if (line.cashWithdrawal) return { ...row, include: false, flag: 'cash' };
    const purchase = matchNearby.purchase(line);
    if (purchase) return { ...row, category: null, flag: 'items', purchase: purchase.id, itemCount: purchase.count };
    const nearby = matchNearby.single(line);
    if (nearby) return { ...row, include: false, flag: 'duplicate', duplicateOf: { description: nearby.description, date: nearby.date } };
    return row;
  });

  const kinds = new Set(rows.map((r) => r.kind));
  const newCards = [...new Set(rows.filter((r) => r.last4 && !r.account).map((r) => r.last4))];
  return {
    kind: kinds.size === 1 ? [...kinds][0] : 'mixed',
    rows,
    newCards,
    summary: {
      total: rows.length,
      included: rows.filter((r) => r.include).length,
      imported: rows.filter((r) => r.flag === 'imported').length,
      settlements: rows.filter((r) => r.flag === 'settlement').length,
      cashWithdrawals: rows.filter((r) => r.flag === 'cash').length,
      linkedPurchases: rows.filter((r) => r.flag === 'items').length,
      duplicates: rows.filter((r) => r.flag === 'duplicate').length,
    },
  };
};

/** Finds the card with these last digits, or opens one on first sight. */
const accountsForRows = async (userId, rows) => {
  const accounts = await accountRepository.findAllByUser(userId);
  const byLast4 = new Map(accounts.filter((a) => a.last4).map((a) => [a.last4, a]));
  const needed = [...new Set(rows.filter((r) => r.last4 && !r.account).map((r) => r.last4))];
  for (const last4 of needed) {
    if (!byLast4.has(last4)) {
      byLast4.set(last4, await accountRepository.create(userId, { name: `כרטיס ${last4}`, kind: 'credit', last4 }));
    }
  }
  return { byId: new Map(accounts.map((a) => [a.id, a])), byLast4 };
};

/**
 * A statement line that pays for items already typed in: nothing new is counted, the
 * items learn which card paid. Checked again here, since the items may have changed.
 */
const linkToPurchase = async (userId, row, accountId) => {
  const items = await transactionRepository.findPurchase(userId, row.purchase);
  const total = round2(items.reduce((s, t) => s + t.amount, 0));
  if (!items.length || total !== row.amount || items.some((t) => t.importHash)) return false;
  const known = await transactionRepository.existingImportHashes(userId, [row.importHash]);
  if (known.size) return false;
  const charge = await accountManager.resolveCharge(userId, accountId, row.date, row.chargeDate);
  await transactionRepository.linkPurchase(userId, row.purchase, items[0]._id, { ...charge, importHash: row.importHash });
  return true;
};

/** Saves the lines the user kept. Lines that were already imported are skipped, not doubled. */
const commit = async (userId, { rows, account: defaultAccount }) => {
  if (defaultAccount) await accountManager.getById(userId, defaultAccount);
  const categories = await categoryRepository.findAllByUser(userId);
  const validCategories = new Map(categories.map((c) => [c.id, c]));
  const { byId, byLast4 } = await accountsForRows(userId, rows);

  const fallbacks = {};
  const docs = [];
  let linked = 0;
  let unlinked = 0;
  for (const row of rows) {
    if (row.purchase) {
      const accountId = (row.account && byId.has(row.account) && row.account) || (row.last4 && byLast4.get(row.last4)?.id) || defaultAccount;
      if (await linkToPurchase(userId, row, accountId)) linked += 1;
      else unlinked += 1;
      continue;
    }
    let category = validCategories.get(row.category);
    if (!category || category.type !== row.type) {
      fallbacks[row.type] = fallbacks[row.type] || (await categoryManager.getFallback(userId, row.type));
      category = fallbacks[row.type];
    }
    const accountId = (row.account && byId.has(row.account) && row.account) || (row.last4 && byLast4.get(row.last4)?.id) || defaultAccount;
    const charge = await accountManager.resolveCharge(userId, accountId, row.date, row.chargeDate);
    docs.push({
      type: row.type,
      amount: row.amount,
      category: category._id,
      description: row.description,
      merchant: row.description.slice(0, 80),
      date: row.date,
      notes: row.notes || '',
      isRefund: Boolean(row.isRefund),
      importHash: row.importHash,
      source: row.standing && row.type === 'expense' ? 'recurring' : 'import',
      ...charge,
    });
  }

  const created = await transactionRepository.createManySkippingDuplicates(userId, docs);
  const expenseCategories = [...new Set(created.filter((t) => t.type === 'expense').map((t) => String(t.category)))];
  Promise.all(expenseCategories.map((id) => budgetManager.checkAlerts(userId, id))).catch((err) =>
    logger.error('Budget alert check failed:', err.message)
  );
  return { created: created.length, linked, skipped: docs.length - created.length + unlinked };
};

module.exports = { preview, commit };
