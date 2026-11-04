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
const { escapeRegex, toProductKey } = require('../utils/text');

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

/** Derives the product fields that are stored next to the raw input. */
const normalize = (data) => {
  const doc = { ...data };
  if (doc.productName) {
    doc.productKey = toProductKey(doc.productName);
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

const create = async (userId, { account, chargeDate, ...data }) => {
  await categoryManager.assertOwned(userId, data.category, data.type);
  const charge = await accountManager.resolveCharge(userId, account, data.date, chargeDate);
  const transaction = await transactionRepository.create(userId, { ...normalize(data), ...charge });
  if (transaction.type === 'expense') triggerBudgetAlerts(userId, [transaction.category]);
  return transaction.populate(POPULATE);
};

const update = async (userId, id, data) => {
  const current = await getById(userId, id);
  const type = data.type || current.type;
  if (data.category || data.type) {
    await categoryManager.assertOwned(userId, data.category || current.category._id, type);
  }
  const doc = normalize({ amount: current.amount, quantity: current.quantity, ...data });
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
  if (type === 'expense') triggerBudgetAlerts(userId, [current.category._id || current.category]);
  return getById(userId, id);
};

const remove = async (userId, id) => {
  const transaction = await transactionRepository.deleteByUser(userId, id);
  if (!transaction) throw ApiError.notFound('העסקה לא נמצאה');
};

/**
 * Creates many transactions at once (Excel import, receipt lines).
 * Rows without a valid category fall back to the user's "other" category.
 */
const bulkCreate = async (userId, rows, { source = 'import', extra = {} } = {}) => {
  const categories = await categoryRepository.findAllByUser(userId);
  const byId = new Map(categories.map((c) => [c.id, c]));
  const fallbacks = {};

  const docs = [];
  for (const row of rows) {
    let category = row.category && byId.get(String(row.category));
    if (!category || category.type !== row.type) {
      fallbacks[row.type] = fallbacks[row.type] || (await categoryManager.getFallback(userId, row.type));
      category = fallbacks[row.type];
    }
    docs.push(normalize({ ...row, ...extra, category: category._id, source }));
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

/** Product lines of one purchase (manual basket or receipt) as expense rows. */
const itemsToRows = ({ merchant, date, notes, items }) =>
  items.map((item) => ({
    type: 'expense',
    amount: item.total,
    category: item.category,
    description: item.name,
    productName: item.name,
    quantity: item.quantity,
    unitPrice: round2(item.total / item.quantity),
    merchant,
    date,
    ...(notes ? { notes } : {}),
  }));

/** A purchase with several products, entered by hand - one transaction per product. */
const createBasket = async (userId, basket) => {
  const transactions = await bulkCreate(userId, itemsToRows(basket), { source: 'manual' });
  return { created: transactions.length, total: round2(basket.items.reduce((s, i) => s + i.total, 0)) };
};

module.exports = {
  list,
  getById,
  create,
  update,
  remove,
  bulkCreate,
  itemsToRows,
  createBasket,
  exportToExcel,
  previewImport,
};
