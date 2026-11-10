const mongoose = require('mongoose');
const transactionRepository = require('../repositories/transaction.repository');
const categoryRepository = require('../repositories/category.repository');
const categoryManager = require('./category.manager');
const budgetManager = require('./budget.manager');
const accountManager = require('./account.manager');
const excelService = require('../services/excel.service');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');
const { addDays } = require('../utils/dateUtils');
const { round2 } = require('../utils/finance');
const { escapeRegex, toProductKey, sameMerchant } = require('../utils/text');
const { NEARBY_DAYS, ADJUSTMENT_NAME, isNear, isClose, rank, fitToCharge } = require('../utils/purchaseMatch');

const MAX_EXPORT_ROWS = 5000;
const POPULATE = 'category account';

const castForAggregate = (filter) => {
  const out = { ...filter };
  if (out.category) out.category = new mongoose.Types.ObjectId(String(out.category));
  if (out.account) out.account = new mongoose.Types.ObjectId(String(out.account));
  return out;
};

/** Translates query-string filters into a MongoDB filter. */
const buildFilter = ({ type, category, account, chargeDate, source, from, to, search }) => {
  const filter = {};
  if (type) filter.type = type;
  if (category) filter.category = category;
  if (account) filter.account = account;
  if (chargeDate) filter.chargeDate = chargeDate;
  if (source) filter.source = source;
  if (from || to) {
    filter.date = {};
    if (from) filter.date.$gte = from;
    if (to) filter.date.$lt = addDays(to, 1); // `to` is inclusive
  }
  if (search) {
    const rx = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ description: rx }, { merchant: rx }, { productName: rx }];
  }
  return filter;
};

/** The spelling already in use for each product key, so one product keeps one name. */
const knownProductNames = async (userId) => {
  const names = new Map();
  for (const name of await transactionRepository.productNames(userId)) {
    const key = toProductKey(name);
    if (!names.has(key)) names.set(key, name);
  }
  return names;
};

/**
 * Derives the product fields that are stored next to the raw input. With `names`, a product
 * already saved under another spelling ("2 ליטר חלב תנובה") takes that spelling.
 */
const normalize = (data, names) => {
  const doc = { ...data };
  if (doc.productName) {
    doc.productKey = toProductKey(doc.productName);
    const known = names?.get(doc.productKey);
    if (known && known !== doc.productName) {
      if (doc.description === doc.productName) doc.description = known;
      doc.productName = known;
    }
    doc.quantity = doc.quantity || 1;
    doc.unitPrice = doc.unitPrice ?? round2(doc.amount / doc.quantity);
  } else if ('productName' in doc) {
    doc.productName = undefined;
    doc.productKey = undefined;
    doc.unitPrice = undefined;
  }
  return doc;
};

const triggerBudgetAlerts = (userId, categoryIds) => {
  const unique = [...new Set(categoryIds.map(String))];
  Promise.all(unique.map((id) => budgetManager.checkAlerts(userId, id))).catch((err) =>
    logger.error('Budget alert check failed:', err.message)
  );
};

const list = async (userId, query) => {
  const { page = 1, limit = 20 } = query;
  const filter = buildFilter(query);

  const [items, total, totals] = await Promise.all([
    transactionRepository.findAllByUser(userId, filter, {
      sort: { date: -1, createdAt: -1 },
      skip: (page - 1) * limit,
      limit,
      populate: POPULATE,
    }),
    transactionRepository.countByUser(userId, filter),
    // Aggregations do not cast strings the way find() does
    transactionRepository.sumByType(userId, castForAggregate(filter)),
  ]);

  return {
    items,
    pagination: { page, limit, total, pages: Math.max(Math.ceil(total / limit), 1) },
    totals: {
      income: round2(totals.income),
      expense: round2(totals.expense),
      balance: round2(totals.income - totals.expense),
    },
  };
};

const getById = async (userId, id) => {
  const transaction = await transactionRepository.findOneByUser(userId, id, { populate: POPULATE });
  if (!transaction) throw ApiError.notFound('העסקה לא נמצאה');
  return transaction;
};

/** A description is optional: without one, the product, the store or the category names the transaction. */
const describe = (row, categoryName) => String(row.description || '').trim() || row.productName || row.merchant || categoryName;

const create = async (userId, { account, chargeDate, ...input }) => {
  const category = await categoryManager.assertOwned(userId, input.category, input.type);
  const data = { ...input, description: describe(input, category.name) };
  const charge = await accountManager.resolveCharge(userId, account, data.date, chargeDate);
  const names = data.productName ? await knownProductNames(userId) : null;
  const transaction = await transactionRepository.create(userId, { ...normalize(data, names), ...charge });
  if (transaction.type === 'expense') triggerBudgetAlerts(userId, [transaction.category]);
  return transaction.populate(POPULATE);
};

const isAdjustment = (t) => t.description === ADJUSTMENT_NAME;

/** The items of a purchase whose card line was linked, or null. Their total must stay the charge. */
const linkedItems = async (userId, transaction) => {
  if (!transaction.purchase) return null;
  const items = await transactionRepository.findPurchase(userId, transaction.purchase);
  return items.length > 1 && items.some((t) => t.importHash) ? items : null;
};

/**
 * An item of a linked purchase changed by `delta`. The "difference" item takes it up,
 * so the items still add up to what the card charged. Checked before anything is saved.
 */
const planAdjustment = (items, changed, delta) => {
  const adjustment = items.find((t) => isAdjustment(t) && t.id !== changed.id);
  const amount = round2((adjustment?.amount || 0) - delta);
  if (amount < 0) {
    throw ApiError.badRequest(`הפריטים יעלו על החיוב בכרטיס. הקטינו קודם פריט אחר ב-${round2(-amount)} ₪`);
  }
  return async () => {
    if (adjustment && amount > 0) {
      adjustment.amount = amount;
      await adjustment.save();
    } else if (adjustment) {
      await remove(adjustment.user, adjustment.id, { rebalance: false });
    } else if (amount > 0) {
      const largest = items.reduce((a, b) => (b.amount > a.amount ? b : a));
      await transactionRepository.create(changed.user, {
        type: 'expense',
        amount,
        category: largest.category?._id || largest.category,
        description: ADJUSTMENT_NAME,
        merchant: changed.merchant,
        date: changed.date,
        purchase: changed.purchase,
        source: changed.source,
        ...(changed.account ? { account: changed.account._id || changed.account, chargeDate: changed.chargeDate } : {}),
        ...(changed.receipt ? { receipt: changed.receipt } : {}),
      });
    }
  };
};

const BALANCING_LINE = 'השורה הזו מאזנת את הפריטים מול החיוב בכרטיס. שנו את הפריטים עצמם, ואם הקנייה לא שלכם, מחקו את כל הפריטים';

const update = async (userId, id, data) => {
  const current = await getById(userId, id);
  const type = data.type || current.type;
  const linked = await linkedItems(userId, current);
  let adjust = null;
  if (linked) {
    if (type !== 'expense') throw ApiError.conflict('פריט מקנייה שקושרה לחיוב בכרטיס חייב להישאר הוצאה');
    const delta = data.amount === undefined ? 0 : round2(data.amount - current.amount);
    if (delta && isAdjustment(current)) throw ApiError.conflict(BALANCING_LINE);
    if (delta) adjust = planAdjustment(linked, current, delta);
  }
  if (data.category || data.type) {
    await categoryManager.assertOwned(userId, data.category || current.category._id, type);
  }
  if ('description' in data && !String(data.description).trim()) {
    data.description = describe({ ...data, productName: data.productName ?? current.productName, merchant: data.merchant ?? current.merchant }, current.category.name);
  }
  const names = data.productName && data.productName !== current.productName ? await knownProductNames(userId) : null;
  const doc = normalize({ amount: current.amount, quantity: current.quantity, ...data }, names);
  // The charge date follows the card and the purchase date, unless it was given explicitly
  const accountChanged = 'account' in data && String(data.account || '') !== String(current.account?._id || '');
  const dateChanged = data.date && new Date(data.date).getTime() !== current.date.getTime();
  if (accountChanged || dateChanged || data.chargeDate) {
    const account = 'account' in data ? data.account : current.account?._id;
    Object.assign(doc, await accountManager.resolveCharge(userId, account, data.date || current.date, data.chargeDate));
  } else {
    delete doc.account;
    delete doc.chargeDate;
  }
  current.set(doc);
  await current.save();
  if (adjust) await adjust();
  if (type === 'expense') triggerBudgetAlerts(userId, [current.category._id || current.category]);
  return getById(userId, id);
};

async function remove(userId, id, { rebalance = true } = {}) {
  const transaction = await transactionRepository.findOneByUser(userId, id);
  if (!transaction) throw ApiError.notFound('העסקה לא נמצאה');
  const items = transaction.purchase ? await transactionRepository.findPurchase(userId, transaction.purchase) : [];
  const holder = items.find((t) => t.importHash && t.id === String(id));
  const heir = items.find((t) => t.id !== String(id) && !isAdjustment(t)) || items.find((t) => t.id !== String(id));

  // The card still charged it: a deleted item's amount moves to the difference line
  const linked = rebalance && (await linkedItems(userId, transaction));
  if (linked && isAdjustment(transaction)) throw ApiError.conflict(BALANCING_LINE);
  const adjust = linked ? planAdjustment(linked, transaction, -transaction.amount) : null;

  await transactionRepository.deleteByUser(userId, id);
  if (adjust) await adjust();
  // The other items are still that statement line: importing the file again must not add it back
  if (holder && heir) {
    heir.importHash = holder.importHash;
    await heir.save();
  }
}

/** A category of the user for an expense item, or "other" when none was chosen. */
const expenseCategory = async (userId, id) => (id ? categoryManager.assertOwned(userId, id, 'expense') : categoryManager.getFallback(userId, 'expense'));

/**
 * Turns one transaction, usually a statement line, into items whose total equals it.
 * The original stays as the first item, so its statement fingerprint, card and charge
 * date stay too, and importing the statement again does not add it back.
 */
const replaceWithItems = async (userId, original, rows, { source = original.source, extra = {} } = {}) => {
  const [first, ...rest] = rows;
  const before = original.toObject();
  const names = await knownProductNames(userId);
  const category = await expenseCategory(userId, first.category);
  original.set(normalize({ ...first, description: describe(first, category.name), category: category._id, source, ...extra }, names));
  await original.save();
  try {
    const created = await bulkCreate(userId, rest, {
      source,
      names,
      extra: { account: original.account, chargeDate: original.chargeDate, receipt: original.receipt, recurring: original.recurring, ...extra },
    });
    triggerBudgetAlerts(userId, [original.category]);
    return created.length + 1;
  } catch (err) {
    original.overwrite(before);
    await original.save();
    throw err;
  }
};

/** A statement line that may still be broken into items: one of its own, or a purchase of one item. */
const loadSplittable = async (userId, id) => {
  const original = await transactionRepository.findOneByUser(userId, id, { select: '+importHash' });
  if (!original) return null;
  if (original.purchase && (await transactionRepository.findPurchase(userId, original.purchase)).length > 1) {
    throw ApiError.conflict('העסקה הזו כבר חלק מקנייה עם כמה פריטים');
  }
  return original;
};

/**
 * Turns one transaction, usually a statement line, into the items it was made of.
 * Their total must equal the original, so the books and the card stay the same.
 */
const split = async (userId, id, { items }) => {
  const original = await loadSplittable(userId, id);
  if (!original) throw ApiError.notFound('העסקה לא נמצאה');
  if (original.type !== 'expense') throw ApiError.badRequest('אפשר לפצל רק הוצאה');

  const total = round2(items.reduce((s, i) => s + i.total, 0));
  if (total !== round2(original.amount)) {
    throw ApiError.badRequest(`סכום הפריטים (${total}) חייב להיות שווה לסכום העסקה (${round2(original.amount)})`);
  }
  const rows = itemsToRows({
    merchant: original.merchant || original.description.slice(0, 80),
    date: original.date,
    notes: original.notes,
    items: items.map((i) => ({ ...i, category: i.category || original.category })),
  });
  return { created: await replaceWithItems(userId, original, rows), total };
};

/** Lines of the card or bank statement that a purchase being saved now probably is. */
const paymentCandidates = async (userId, { date, total, merchant }) => {
  const lines = await transactionRepository.findPaymentCandidates(userId, addDays(date, -NEARBY_DAYS), addDays(date, NEARBY_DAYS + 1));
  const target = { amount: total, merchant, date };
  return lines
    .filter((t) => isNear(t.date, date) && isClose(t.amount, total))
    .map((t) => ({ ...t, merchant: t.merchant || t.description }))
    .sort(rank(target))
    .slice(0, 5)
    .map((t) => ({
      id: String(t._id),
      description: t.description,
      date: t.date,
      chargeDate: t.chargeDate,
      amount: t.amount,
      account: t.account ? { name: t.account.name, color: t.account.color } : null,
      diff: round2(t.amount - total),
      sameMerchant: Boolean(merchant) && sameMerchant(t.merchant, merchant),
    }));
};

/**
 * The items being saved replace a statement line that already paid for them, so the
 * money counts once. A small difference is taken up by the items (see fitToCharge).
 */
const attachToPayment = async (userId, paymentId, rows, options) => {
  const payment = await loadSplittable(userId, paymentId);
  const total = round2(rows.reduce((s, r) => s + r.amount, 0));
  const fit = payment && fitToCharge(rows.map((r) => r.amount), payment.amount);
  if (!payment || payment.type !== 'expense' || !payment.importHash || !isNear(payment.date, rows[0].date) || !isClose(payment.amount, total) || !fit) {
    throw ApiError.conflict('החיוב שנבחר לא מתאים לקנייה הזו. אפשר לשמור בלי לקשר');
  }

  const fitted = rows.map((r, i) => (fit.reduce?.index === i ? { ...r, amount: fit.reduce.amount, unitPrice: round2(fit.reduce.amount / r.quantity) } : r));
  if (fit.add > 0) {
    const largest = rows.reduce((a, b) => (b.amount > a.amount ? b : a));
    fitted.push({ ...rows[0], amount: fit.add, category: largest.category, description: ADJUSTMENT_NAME, productName: undefined, quantity: 1, unitPrice: undefined });
  }
  const purchase = new mongoose.Types.ObjectId();
  const created = await replaceWithItems(userId, payment, fitted.map((r) => ({ ...r, purchase })), options);
  return { created, total: payment.amount, linked: true, adjusted: fit.diff };
};

/** All the items of the purchase a transaction belongs to, with what paid for them. */
const getPurchase = async (userId, id) => {
  const transaction = await getById(userId, id);
  const items = transaction.purchase ? await transactionRepository.findPurchase(userId, transaction.purchase).populate(POPULATE) : [transaction];
  const paidBy = items.find((t) => t.account) || transaction;
  return {
    merchant: transaction.merchant,
    date: transaction.date,
    account: paidBy.account || null,
    chargeDate: paidBy.chargeDate || null,
    total: round2(items.reduce((s, t) => s + t.amount, 0)),
    // The card or bank statement line was linked to these items
    matched: items.some((t) => t.importHash),
    items: items.map((t) => ({
      id: t.id,
      description: t.description,
      productName: t.productName,
      quantity: t.quantity,
      unitPrice: t.unitPrice,
      amount: t.amount,
      category: t.category,
    })),
  };
};

/**
 * Creates many transactions at once (Excel import, receipt lines).
 * Rows without a valid category fall back to the user's "other" category.
 */
const bulkCreate = async (userId, rows, { source = 'import', extra = {}, names: given } = {}) => {
  const categories = await categoryRepository.findAllByUser(userId);
  const names = given || (rows.some((r) => r.productName) ? await knownProductNames(userId) : null);
  const byId = new Map(categories.map((c) => [c.id, c]));
  const fallbacks = {};

  const docs = [];
  for (const row of rows) {
    let category = row.category && byId.get(String(row.category));
    if (!category || category.type !== row.type) {
      fallbacks[row.type] = fallbacks[row.type] || (await categoryManager.getFallback(userId, row.type));
      category = fallbacks[row.type];
    }
    docs.push(normalize({ ...row, ...extra, description: describe(row, category.name), category: category._id, source }, names));
  }

  const created = await transactionRepository.createMany(userId, docs);
  triggerBudgetAlerts(userId, created.filter((t) => t.type === 'expense').map((t) => t.category));
  return created;
};

const exportToExcel = async (userId, query) => {
  const transactions = await transactionRepository.findAllByUser(userId, buildFilter(query), {
    sort: { date: -1 },
    limit: MAX_EXPORT_ROWS,
    populate: POPULATE,
  });
  return excelService.buildTransactionsWorkbook(transactions);
};

/** Parses an uploaded sheet and matches each row to one of the user's categories. */
const previewImport = async (userId, file) => {
  const isCsv = /\.csv$/i.test(file.originalname);
  let rows;
  try {
    rows = await excelService.parseTransactionsFile(file.buffer, { isCsv });
  } catch {
    throw ApiError.badRequest('לא ניתן לקרוא את הקובץ. ודאו שזהו קובץ Excel (‎.xlsx) או CSV תקין');
  }
  if (!rows.length) throw ApiError.badRequest('לא נמצאו שורות בקובץ. ודאו ששורת הכותרות תואמת לתבנית');

  const categories = await categoryRepository.findAllByUser(userId);
  const find = (name, type) => categories.find((c) => c.type === type && c.name === name);

  const preview = rows.map((row) => {
    const category = find(row.categoryName, row.type);
    return { ...row, category: category ? category.id : null, categoryMatched: Boolean(category) };
  });
  return {
    rows: preview,
    summary: {
      total: preview.length,
      valid: preview.filter((r) => !r.error).length,
      invalid: preview.filter((r) => r.error).length,
      unmatchedCategories: preview.filter((r) => !r.error && !r.categoryMatched).length,
    },
  };
};

/**
 * Product lines of one purchase (manual basket or receipt) as expense rows. A receipt
 * is a purchase even with one product, so its card charge can find it later.
 */
const itemsToRows = ({ merchant, date, notes, items }, { group = items.length > 1 } = {}) => {
  const purchase = group ? new mongoose.Types.ObjectId() : undefined;
  return items.map((item) => ({
    ...(purchase ? { purchase } : {}),
    type: 'expense',
    amount: item.total,
    category: item.category,
    description: item.name || '',
    productName: item.name || undefined,
    quantity: item.quantity,
    unitPrice: round2(item.total / item.quantity),
    merchant,
    date,
    ...(notes ? { notes } : {}),
  }));
};

/** A purchase with several products, entered by hand - one transaction per product. */
const createBasket = async (userId, { payment, ...basket }) => {
  if (payment) return attachToPayment(userId, payment, itemsToRows(basket, { group: true }), { source: 'manual' });
  const charge = await accountManager.resolveCharge(userId, basket.account, basket.date);
  const transactions = await bulkCreate(userId, itemsToRows(basket), { source: 'manual', extra: charge });
  return { created: transactions.length, total: round2(basket.items.reduce((s, i) => s + i.total, 0)) };
};

module.exports = {
  list,
  getById,
  create,
  update,
  remove,
  split,
  paymentCandidates,
  attachToPayment,
  getPurchase,
  bulkCreate,
  itemsToRows,
  createBasket,
  exportToExcel,
  previewImport,
};
