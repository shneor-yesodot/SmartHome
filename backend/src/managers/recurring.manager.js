const recurringRepository = require('../repositories/recurring.repository');
const transactionRepository = require('../repositories/transaction.repository');
const categoryManager = require('./category.manager');
const budgetManager = require('./budget.manager');
const accountManager = require('./account.manager');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');
const { addFrequency, startOfDay } = require('../utils/dateUtils');

// Safety cap when catching up after the server was down for a long time
const MAX_CATCH_UP_RUNS = 36;

const POPULATE = 'category account';

/** The occurrence after `date`, on the payment's own day of the month. */
const after = (payment, date, frequency = payment.frequency) => addFrequency(date, frequency, payment.dayOfMonth);

/** The first occurrence on or after `day`, keeping the schedule's own day of the month. */
const firstOnOrAfter = (payment, start, day, frequency) => {
  let next = new Date(start);
  while (next < day) next = after(payment, next, frequency);
  return next;
};

const list = (userId) =>
  recurringRepository.findAllByUser(userId, {}, { sort: { isActive: -1, nextRun: 1 }, populate: POPULATE });

const getById = async (userId, id) => {
  const payment = await recurringRepository.findOneByUser(userId, id, { populate: POPULATE });
  if (!payment) throw ApiError.notFound('הוראת הקבע לא נמצאה');
  return payment;
};

const create = async (userId, { startDate, account, ...data }) => {
  await categoryManager.assertOwned(userId, data.category, data.type);
  if (account) await accountManager.getById(userId, account);
  const nextRun = startOfDay(startDate);
  const payment = await recurringRepository.create(userId, { ...data, ...(account ? { account } : {}), nextRun, dayOfMonth: nextRun.getUTCDate() });
  return payment.populate(POPULATE);
};

const update = async (userId, id, { startDate, ...data }) => {
  const current = await getById(userId, id);
  if (data.category || data.type) {
    await categoryManager.assertOwned(userId, data.category || current.category._id, data.type || current.type);
  }
  if (data.account) await accountManager.getById(userId, data.account);
  else if ('account' in data) data.account = null;
  if (startDate) {
    data.nextRun = startOfDay(startDate);
    data.dayOfMonth = data.nextRun.getUTCDate();
  } else if (data.isActive === true && !current.isActive) {
    // Resumed after a pause: the paused periods were not paid, so continue from today on
    data.nextRun = firstOnOrAfter(current, current.nextRun, startOfDay(), data.frequency || current.frequency);
  }
  await recurringRepository.updateByUser(userId, id, data);
  return getById(userId, id);
};

const remove = async (userId, id) => {
  const payment = await recurringRepository.deleteByUser(userId, id);
  if (!payment) throw ApiError.notFound('הוראת הקבע לא נמצאה');
};

/** Records one occurrence of the payment as a regular transaction. */
const createOccurrence = async (payment, date) => {
  const paidWith = payment.account?._id || payment.account;
  // The card may have been removed since; the payment itself still happened
  const charge = await accountManager.resolveCharge(payment.user, paidWith, date).catch(() => ({}));
  return transactionRepository.create(payment.user, {
    ...charge,
    type: payment.type,
    amount: payment.amount,
    category: payment.category._id || payment.category,
    description: payment.description,
    merchant: payment.merchant,
    date,
    source: 'recurring',
    recurring: payment._id,
  });
};

/** Records one claimed occurrence; if that fails, the occurrence goes back to the schedule. */
const recordClaimed = async (payment, { from, next, date, lastRun }) => {
  try {
    return await createOccurrence(payment, date);
  } catch (err) {
    await recurringRepository.releaseRun(payment._id, next, from, lastRun);
    throw err;
  }
};

/**
 * "Run now" button: records today's occurrence. Before the due date it counts as this
 * period paid early; when overdue, the schedule keeps its day (the 10th stays the 10th).
 */
const runNow = async (userId, id, { nextRun: seen } = {}) => {
  const payment = await getById(userId, id);
  const today = startOfDay();
  const from = seen ? new Date(seen) : payment.nextRun;
  const next = from > today ? after(payment, from) : firstOnOrAfter(payment, from, addFrequency(today, 'daily'));
  if (!(await recurringRepository.claimRun(payment._id, from, next, today))) {
    throw ApiError.conflict('הוראת הקבע בוצעה זה עתה. רעננו את המסך');
  }
  const transaction = await recordClaimed(payment, { from, next, date: today, lastRun: payment.lastRun });
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
      let lastRun = payment.lastRun;
      let from = payment.nextRun;
      while (from <= now && runs < MAX_CATCH_UP_RUNS) {
        const next = after(payment, from);
        if (!(await recurringRepository.claimRun(payment._id, from, next, from))) break; // taken by "run now"
        await recordClaimed(payment, { from, next, date: from, lastRun });
        lastRun = from;
        from = next;
        runs += 1;
      }
      createdCount += runs;
      if (payment.type === 'expense') await budgetManager.checkAlerts(payment.user, payment.category);
    } catch (err) {
      logger.error(`Recurring payment ${payment.id} failed:`, err.message);
    }
  }
  return { processed: due.length, created: createdCount };
};

module.exports = { list, create, update, remove, runNow, processDue };
