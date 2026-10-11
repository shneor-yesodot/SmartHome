const budgetRepository = require('../repositories/budget.repository');
const transactionRepository = require('../repositories/transaction.repository');
const userRepository = require('../repositories/user.repository');
const categoryManager = require('./category.manager');
const emailService = require('../services/email.service');
const ApiError = require('../utils/ApiError');
const { monthRange, currentMonth, monthKey } = require('../utils/dateUtils');
const { round2, percentOf } = require('../utils/finance');

/** Adds usage figures to a budget document. */
const decorate = (budget, spent) => {
  const percent = percentOf(spent, budget.amount);
  let status = 'ok';
  if (percent >= 100) status = 'exceeded';
  else if (percent >= budget.alertThreshold) status = 'warning';
  return {
    ...budget.toJSON(),
    spent: round2(spent),
    remaining: round2(budget.amount - spent),
    percent,
    status,
  };
};

/** Budgets with the amount spent in the requested month (defaults to the current one). */
const list = async (userId, { year, month } = {}) => {
  const period = year !== undefined && month !== undefined ? { year, month } : currentMonth();
  const { from, to } = monthRange(period.year, period.month);

  const [budgets, sums] = await Promise.all([
    budgetRepository.findAllByUser(userId, {}, { populate: 'category', sort: { createdAt: 1 } }),
    transactionRepository.sumByCategory(userId, { from, to, type: 'expense' }),
  ]);
  const spentByCategory = new Map(sums.map((row) => [String(row._id), row.total]));

  return budgets
    .filter((b) => b.category)
    .map((b) => decorate(b, spentByCategory.get(String(b.category._id)) || 0));
};

const create = async (userId, data) => {
  await categoryManager.assertOwned(userId, data.category, 'expense');
  if (await budgetRepository.findOneWhere(userId, { category: data.category })) {
    throw ApiError.conflict('כבר הוגדר תקציב לקטגוריה הזו');
  }
  const budget = await budgetRepository.create(userId, data);
  return budget.populate('category');
};

const update = async (userId, id, data) => {
  const budget = await budgetRepository.updateByUser(userId, id, data);
  if (!budget) throw ApiError.notFound('התקציב לא נמצא');
  return budget.populate('category');
};

const remove = async (userId, id) => {
  const budget = await budgetRepository.deleteByUser(userId, id);
  if (!budget) throw ApiError.notFound('התקציב לא נמצא');
};

/**
 * Called after an expense is recorded. Sends at most one "warning" and one
 * "exceeded" e-mail per budget per month.
 */
const checkAlerts = async (userId, categoryId) => {
  const budget = await budgetRepository.findByCategory(userId, categoryId);
  if (!budget || !budget.category) return null;

  const { year, month } = currentMonth();
  const { from, to } = monthRange(year, month);
  const [row] = (await transactionRepository.sumByCategory(userId, { from, to, type: 'expense' })).filter(
    (r) => String(r._id) === String(categoryId)
  );
  const spent = row ? row.total : 0;
  const percent = percentOf(spent, budget.amount);

  const level = percent >= 100 ? 'exceeded' : percent >= budget.alertThreshold ? 'warning' : null;
  if (!level) return null;

  const alertKey = `${monthKey(from)}:${level}`;
  const alreadySent = budget.lastAlertKey === alertKey || budget.lastAlertKey === `${monthKey(from)}:exceeded`;
  if (alreadySent) return null;

  budget.lastAlertKey = alertKey;
  await budget.save();

  const user = await userRepository.findById(userId);
  if (user?.notifications?.budgetAlerts) {
    await emailService.sendBudgetAlert(user, {
      categoryName: budget.category.name,
      spent,
      limit: budget.amount,
      percent,
      exceeded: level === 'exceeded',
    });
  }
  return { level, percent, categoryName: budget.category.name };
};

module.exports = { list, create, update, remove, checkAlerts };
