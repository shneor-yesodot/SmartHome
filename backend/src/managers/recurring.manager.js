const recurringRepository = require('../repositories/recurring.repository');
const transactionRepository = require('../repositories/transaction.repository');
const categoryManager = require('./category.manager');
const budgetManager = require('./budget.manager');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');
const { addFrequency, startOfDay } = require('../utils/dateUtils');

// Safety cap when catching up after the server was down for a long time
const MAX_CATCH_UP_RUNS = 36;

const list = (userId) =>
  recurringRepository.findAllByUser(userId, {}, { sort: { isActive: -1, nextRun: 1 }, populate: 'category' });

const getById = async (userId, id) => {
  const payment = await recurringRepository.findOneByUser(userId, id, { populate: 'category' });
  if (!payment) throw ApiError.notFound('הוראת הקבע לא נמצאה');
  return payment;
};

const create = async (userId, { startDate, ...data }) => {
  await categoryManager.assertOwned(userId, data.category, data.type);
  const payment = await recurringRepository.create(userId, { ...data, nextRun: startOfDay(startDate) });
  return payment.populate('category');
};

const update = async (userId, id, { startDate, ...data }) => {
  const current = await getById(userId, id);
  if (data.category || data.type) {
    await categoryManager.assertOwned(userId, data.category || current.category._id, data.type || current.type);
  }
  if (startDate) data.nextRun = startOfDay(startDate);
  await recurringRepository.updateByUser(userId, id, data);
  return getById(userId, id);
};

const remove = async (userId, id) => {
  const payment = await recurringRepository.deleteByUser(userId, id);
  if (!payment) throw ApiError.notFound('הוראת הקבע לא נמצאה');
};

/** Records one occurrence of the payment as a regular transaction. */
const createOccurrence = (payment, date) =>
  transactionRepository.create(payment.user, {
    type: payment.type,
    amount: payment.amount,
    category: payment.category._id || payment.category,
    description: payment.description,
    merchant: payment.merchant,
    date,
    source: 'recurring',
    recurring: payment._id,
  });

/** "Run now" button: records today's occurrence and moves the schedule one period ahead. */
const runNow = async (userId, id) => {
  const payment = await getById(userId, id);
  const today = startOfDay();
  const transaction = await createOccurrence(payment, today);
  payment.lastRun = today;
  payment.nextRun = addFrequency(payment.nextRun > today ? payment.nextRun : today, payment.frequency);
  await payment.save();
  if (payment.type === 'expense') await budgetManager.checkAlerts(userId, payment.category._id);
  return { payment: await getById(userId, id), transaction };
};

/**
 * Scheduled job entry point: executes every active payment that is due,
 * for all users. Missed periods are caught up one by one.
 */
const processDue = async (now = new Date()) => {
  const due = await recurringRepository.findDue(now);
  let createdCount = 0;

  for (const payment of due) {
    try {
      let runs = 0;
      while (payment.nextRun <= now && runs < MAX_CATCH_UP_RUNS) {
        await createOccurrence(payment, payment.nextRun);
        payment.lastRun = payment.nextRun;
        payment.nextRun = addFrequency(payment.nextRun, payment.frequency);
        runs += 1;
      }
      await payment.save();
      createdCount += runs;
      if (payment.type === 'expense') await budgetManager.checkAlerts(payment.user, payment.category);
    } catch (err) {
      logger.error(`Recurring payment ${payment.id} failed:`, err.message);
    }
  }
  return { processed: due.length, created: createdCount };
};

module.exports = { list, create, update, remove, runNow, processDue };
