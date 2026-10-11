const goalRepository = require('../repositories/goal.repository');
const ApiError = require('../utils/ApiError');
const { calcGoalProgress, round2 } = require('../utils/finance');

const decorate = (goal) => ({ ...goal.toJSON(), progress: calcGoalProgress(goal) });

const list = async (userId) => {
  const goals = await goalRepository.findAllByUser(userId, {}, { sort: { targetDate: 1 } });
  return goals.map(decorate);
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
