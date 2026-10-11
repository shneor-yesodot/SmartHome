const transactionRepository = require('../repositories/transaction.repository');
const categoryRepository = require('../repositories/category.repository');
const categoryManager = require('./category.manager');
const budgetManager = require('./budget.manager');
const excelService = require('../services/excel.service');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');
const { addDays } = require('../utils/dateUtils');
const { round2 } = require('../utils/finance');
const { escapeRegex, toProductKey } = require('../utils/text');

const MAX_EXPORT_ROWS = 5000;

/** Translates query-string filters into a MongoDB filter. */
const buildFilter = ({ type, category, source, from, to, search }) => {
  const filter = {};
  if (type) filter.type = type;
  if (category) filter.category = category;
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
      populate: 'category',
    }),
    transactionRepository.countByUser(userId, filter),
    transactionRepository.sumByType(userId, filter),
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
  const transaction = await transactionRepository.findOneByUser(userId, id, { populate: 'category' });
  if (!transaction) throw ApiError.notFound('העסקה לא נמצאה');
  return transaction;
};

const create = async (userId, data) => {
  await categoryManager.assertOwned(userId, data.category, data.type);
  const transaction = await transactionRepository.create(userId, normalize(data));
  if (transaction.type === 'expense') triggerBudgetAlerts(userId, [transaction.category]);
  return transaction.populate('category');
};

const update = async (userId, id, data) => {
  const current = await getById(userId, id);
  const type = data.type || current.type;
  if (data.category || data.type) {
    await categoryManager.assertOwned(userId, data.category || current.category._id, type);
  }
  current.set(normalize({ amount: current.amount, quantity: current.quantity, ...data }));
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
    populate: 'category',
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

module.exports = { list, getById, create, update, remove, bulkCreate, exportToExcel, previewImport };
