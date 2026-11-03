const transactionRepository = require('../repositories/transaction.repository');
const userRepository = require('../repositories/user.repository');
const categoryManager = require('./category.manager');
const transactionManager = require('./transaction.manager');
const { periodOf, shiftPeriod, describePeriod } = require('../utils/period');
const { round2 } = require('../utils/finance');

// Never walk back more than this many months when carrying balances over
const MAX_MONTHS = 120;
const HISTORY_MONTHS = 12;

/** The user's maaser settings, with the tracking start date filled in. */
const settingsOf = (user) => ({
  mode: user.maaser?.mode || 'percent',
  percent: user.maaser?.percent ?? 10,
  amount: user.maaser?.amount ?? 2000,
  startDate: user.maaser?.startDate || user.createdAt,
});

const targetFor = (income, settings) =>
  settings.mode === 'fixed' ? settings.amount : round2((income * settings.percent) / 100);

const sum = (items) => round2(items.reduce((s, t) => s + t.amount, 0));

/**
 * Maaser for one month (Gregorian or Hebrew): the target, what was given, and
 * the balance carried over from earlier months since the tracking start date.
 */
const overview = async (user, period) => {
  const settings = settingsOf(user);
  const category = await categoryManager.getMaaserCategory(user.id);

  // Every month from the start of tracking (or the last HISTORY_MONTHS) up to the one asked for
  let first = periodOf(settings.startDate, period.calendar);
  const historyStart = shiftPeriod(period, -(HISTORY_MONTHS - 1));
  if (historyStart.from < first.from) first = historyStart;
  const periods = [];
  for (let p = first; p.from <= period.from && periods.length < MAX_MONTHS; p = shiftPeriod(p, 1)) periods.push(p);
  if (!periods.length) periods.push(period);

  const transactions = await transactionRepository.findInRange(user.id, periods[0].from, period.to, {
    filter: { $or: [{ type: 'income' }, { category: category._id }] },
  });
  const isDonation = (t) => t.type === 'expense' && String(t.category) === String(category._id);
  const startDay = new Date(settings.startDate);

  let carryOver = 0;
  const months = periods.map((p) => {
    const inMonth = transactions.filter((t) => t.date >= p.from && t.date < p.to);
    const income = sum(inMonth.filter((t) => t.type === 'income'));
    return {
      period: p,
      income,
      target: targetFor(income, settings),
      given: sum(inMonth.filter(isDonation)),
      tracked: p.to > startDay, // months before the start date are shown but not owed
    };
  });
  months.slice(0, -1).forEach((m) => {
    if (m.tracked) carryOver = round2(carryOver + m.target - m.given);
  });

  const current = months[months.length - 1];
  const donations = transactions
    .filter((t) => isDonation(t) && t.date >= period.from && t.date < period.to)
    .sort((a, b) => b.date - a.date);

  const recipients = new Map();
  donations.forEach((t) => {
    const name = t.merchant || 'ללא נמען';
    const r = recipients.get(name) || { recipient: name, total: 0, count: 0 };
    r.total = round2(r.total + t.amount);
    r.count += 1;
    recipients.set(name, r);
  });

  return {
    settings,
    category: { id: String(category._id), name: category.name },
    period: describePeriod(period),
    income: current.income,
    target: current.target,
    given: current.given,
    carryOver,
    // What is still left to give, this month's target plus earlier months' balance (negative = given ahead)
    remaining: round2(current.target + carryOver - current.given),
    donations: donations.map((t) => ({
      id: String(t._id),
      recipient: t.merchant,
      description: t.description,
      amount: t.amount,
      date: t.date,
      notes: t.notes,
    })),
    byRecipient: [...recipients.values()].sort((a, b) => b.total - a.total),
    history: months.slice(-HISTORY_MONTHS).map((m) => ({
      key: m.period.key,
      name: m.period.name,
      label: m.period.label,
      income: m.income,
      target: m.tracked ? m.target : 0,
      given: m.given,
    })),
  };
};

const updateSettings = async (userId, data) => {
  const user = await userRepository.findById(userId);
  user.maaser = { ...settingsOf(user), ...data };
  await user.save();
  return settingsOf(user);
};

/** A donation is an expense in the maaser category; the recipient is kept as the merchant. */
const addDonation = async (userId, { recipient, amount, date, notes }) => {
  const category = await categoryManager.getMaaserCategory(userId);
  return transactionManager.create(userId, {
    type: 'expense',
    amount,
    category: category.id,
    merchant: recipient,
    description: `תרומה ל${recipient}`,
    date,
    notes,
  });
};

module.exports = { overview, updateSettings, addDonation, targetFor };
