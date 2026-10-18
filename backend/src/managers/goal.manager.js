const goalRepository = require('../repositories/goal.repository');
const transactionRepository = require('../repositories/transaction.repository');
const ApiError = require('../utils/ApiError');
const { monthRange, currentMonth } = require('../utils/dateUtils');
const { calcGoalProgress, calcSavingsPlan, round2 } = require('../utils/finance');

const decorate = (goal) => ({ ...goal.toJSON(), progress: calcGoalProgress(goal) });

/**
 * Goals together with this month's savings plan: what is left after this
 * month's expenses, and whether it covers what each goal still needs.
 */
const list = async (userId, now = new Date()) => {
  const { year, month } = currentMonth(now);
  const { from, to } = monthRange(year, month);
  const [goals, totals] = await Promise.all([
    goalRepository.findAllByUser(userId, {}, { sort: { targetDate: 1 } }),
    transactionRepository.sumByType(userId, { date: { $gte: from, $lt: to } }),
  ]);
  const plan = calcSavingsPlan({ ...totals, goals, now });
  return {
    goals: goals.map((goal) => {
      const item = decorate(goal);
      return { ...item, progress: { ...item.progress, ...plan.goals[item.id] } };
    }),
    month: plan.month,
  };
};

const getDocument = async (userId, id) => {
  const goal = await goalRepository.findOneByUser(userId, id);
  if (!goal) throw ApiError.notFound('היעד לא נמצא');
  return goal;
};

const create = async (userId, { initialAmount = 0, ...data }) => {
  const goal = await goalRepository.create(userId, {
    ...data,
    currentAmount: initialAmount,
    deposits: initialAmount > 0 ? [{ amount: initialAmount, note: 'סכום פתיחה' }] : [],
  });
  return decorate(goal);
};

const update = async (userId, id, data) => {
  const goal = await goalRepository.updateByUser(userId, id, data);
  if (!goal) throw ApiError.notFound('היעד לא נמצא');
  return decorate(goal);
};

const remove = async (userId, id) => {
  const goal = await goalRepository.deleteByUser(userId, id);
  if (!goal) throw ApiError.notFound('היעד לא נמצא');
};

/** Positive amount = deposit, negative amount = withdrawal. */
const deposit = async (userId, id, { amount, note }) => {
  const goal = await getDocument(userId, id);
  const nextAmount = round2(goal.currentAmount + amount);
  if (nextAmount < 0) throw ApiError.badRequest('לא ניתן למשוך יותר מהסכום שנצבר ביעד');

  goal.currentAmount = nextAmount;
  goal.deposits.push({ amount, note });
  await goal.save();
  return decorate(goal);
};

module.exports = { list, create, update, remove, deposit };
