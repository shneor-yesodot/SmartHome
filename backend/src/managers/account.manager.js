const accountRepository = require('../repositories/account.repository');
const transactionRepository = require('../repositories/transaction.repository');
const recurringRepository = require('../repositories/recurring.repository');
const ApiError = require('../utils/ApiError');
const { describePeriod } = require('../utils/period');
const { round2 } = require('../utils/finance');
const { chargeDateFor } = require('../utils/billing');

const list = (userId) => accountRepository.findAllByUser(userId, {}, { sort: { isActive: -1, kind: 1, name: 1 } });

const getById = async (userId, id) => {
  const account = await accountRepository.findOneByUser(userId, id);
  if (!account) throw ApiError.notFound('אמצעי התשלום לא נמצא');
  return account;
};

const create = (userId, data) => accountRepository.create(userId, data);

const update = async (userId, id, data) => {
  const account = await accountRepository.updateByUser(userId, id, data);
  if (!account) throw ApiError.notFound('אמצעי התשלום לא נמצא');
  return account;
};

/** Removing a card keeps its transactions and standing orders; they just stop pointing to it. */
const remove = async (userId, id) => {
  const account = await accountRepository.deleteByUser(userId, id);
  if (!account) throw ApiError.notFound('אמצעי התשלום לא נמצא');
  await transactionRepository.model.updateMany({ user: userId, account: id }, { $unset: { account: 1, chargeDate: 1 } });
  await recurringRepository.model.updateMany({ user: userId, account: id }, { $unset: { account: 1 } });
};

/**
 * The account and charge date of a transaction. An explicit charge date (from a
 * statement) wins; otherwise a credit card's date is worked out from its billing day.
 */
const resolveCharge = async (userId, accountId, date, chargeDate) => {
  if (!accountId) return { account: undefined, chargeDate: undefined };
  const account = await getById(userId, accountId);
  if (account.kind !== 'credit') return { account: account._id, chargeDate: undefined };
  return { account: account._id, chargeDate: chargeDate || chargeDateFor(date, account.billingDay) };
};

const net = (items) => round2(items.reduce((s, t) => s + (t.type === 'expense' ? t.amount : -t.amount), 0));

/**
 * What went through each account in one month (either calendar), like the card
 * page on a bank's site: this month's spending, by category, and the next charge.
 */
const overview = async (userId, period, now = new Date()) => {
  const [accounts, inPeriod, upcoming] = await Promise.all([
    list(userId),
    transactionRepository.findInRange(userId, period.from, period.to, { populate: 'category' }),
    transactionRepository.findAllByUser(userId, { chargeDate: { $gte: now } }, { lean: true }),
  ]);

  const summaries = accounts.map((account) => {
    const own = inPeriod.filter((t) => String(t.account) === account.id);
    const categories = new Map();
    own.filter((t) => t.type === 'expense').forEach((t) => {
      const key = String(t.category?._id || 'none');
      const group = categories.get(key) || { categoryId: key, name: t.category?.name || 'ללא קטגוריה', color: t.category?.color || '#7C8B83', total: 0 };
      group.total = round2(group.total + t.amount);
      categories.set(key, group);
    });

    const pending = upcoming.filter((t) => String(t.account) === account.id);
    const nextDate = pending.reduce((min, t) => (!min || t.chargeDate < min ? t.chargeDate : min), null);
    const next = nextDate ? pending.filter((t) => t.chargeDate.getTime() === nextDate.getTime()) : [];

    return {
      ...account.toJSON(),
      spent: net(own),
      count: own.length,
      categories: [...categories.values()].sort((a, b) => b.total - a.total),
      nextCharge: nextDate ? { date: nextDate, total: net(next), count: next.length } : null,
    };
  });

  const unassigned = inPeriod.filter((t) => !t.account && t.type === 'expense');
  return {
    period: describePeriod(period),
    accounts: summaries,
    totalSpent: round2(summaries.reduce((s, a) => s + a.spent, 0)),
    unassigned: { total: net(unassigned), count: unassigned.length },
  };
};

/** The latest charges of one card: what reached the bank account on each date. */
const charges = async (userId, id) => {
  await getById(userId, id);
  const rows = await transactionRepository.chargesOfAccount(userId, id);
  return rows.map((r) => ({ date: r._id, total: round2(r.total), count: r.count }));
};

module.exports = { list, getById, create, update, remove, resolveCharge, overview, charges };
