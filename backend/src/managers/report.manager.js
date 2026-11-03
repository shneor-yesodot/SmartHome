const transactionRepository = require('../repositories/transaction.repository');
const { periodOf, shiftPeriod, dayOfPeriod, describePeriod } = require('../utils/period');
const { round2, percentOf, percentChange, totalsByType } = require('../utils/finance');

/** Groups transactions of one type by category, largest first. */
const breakdownByCategory = (transactions, type) => {
  const groups = new Map();
  let grandTotal = 0;
  for (const t of transactions) {
    if (t.type !== type) continue;
    const key = String(t.category?._id || 'none');
    const group = groups.get(key) || {
      categoryId: key,
      name: t.category?.name || 'ללא קטגוריה',
      color: t.category?.color || '#7C8B83',
      icon: t.category?.icon || 'Tag',
      total: 0,
      count: 0,
    };
    group.total += t.amount;
    group.count += 1;
    grandTotal += t.amount;
    groups.set(key, group);
  }
  return [...groups.values()]
    .map((g) => ({ ...g, total: round2(g.total), percent: percentOf(g.total, grandTotal) }))
    .sort((a, b) => b.total - a.total);
};

const withSavings = (totals) => ({
  ...totals,
  savings: totals.balance,
  savingsRate: totals.income > 0 ? round2((totals.balance / totals.income) * 100) : 0,
});

/**
 * The month summary in the shape of a household summary sheet: income,
 * day-to-day expenses by category, standing orders, maaser and the balance.
 */
const summarize = (transactions, totals) => {
  const expenses = transactions.filter((t) => t.type === 'expense');
  const isDonation = (t) => Boolean(t.category?.isMaaser);
  const standing = expenses.filter((t) => t.source === 'recurring' && !isDonation(t));
  const donations = expenses.filter(isDonation);
  const daily = expenses.filter((t) => t.source !== 'recurring' && !isDonation(t));
  const sum = (items) => round2(items.reduce((s, t) => s + t.amount, 0));
  const byDate = (a, b) => new Date(a.date) - new Date(b.date);
  return {
    income: breakdownByCategory(transactions, 'income'),
    dailyExpenses: breakdownByCategory(daily, 'expense'),
    standingOrders: standing.map((t) => ({ id: String(t._id), description: t.description, amount: t.amount, date: t.date })).sort(byDate),
    donations: donations.map((t) => ({ id: String(t._id), recipient: t.merchant || t.description, amount: t.amount, date: t.date })).sort(byDate),
    totals: {
      income: totals.income,
      dailyExpenses: sum(daily),
      standingOrders: sum(standing),
      donations: sum(donations),
      expense: totals.expense,
      balance: totals.balance,
    },
  };
};

/** Report of one month - Gregorian or Hebrew - compared with the month before it. */
const monthly = async (userId, period) => {
  const prevPeriod = shiftPeriod(period, -1);

  const [transactions, previousTransactions] = await Promise.all([
    transactionRepository.findInRange(userId, period.from, period.to, { populate: 'category' }),
    transactionRepository.findInRange(userId, prevPeriod.from, prevPeriod.to, { populate: 'category' }),
  ]);

  const totals = withSavings(totalsByType(transactions));
  const previous = withSavings(totalsByType(previousTransactions));

  // Day-by-day series for the chart
  const daily = Array.from({ length: period.days }, (_, i) => ({
    day: i + 1,
    date: new Date(period.from.getTime() + i * 86400000),
    income: 0,
    expense: 0,
  }));
  transactions.forEach((t) => {
    const slot = daily[dayOfPeriod(t.date, period) - 1];
    slot[t.type] = round2(slot[t.type] + t.amount);
  });

  // Category table, including the change from the previous month
  const previousByCategory = new Map(breakdownByCategory(previousTransactions, 'expense').map((c) => [c.categoryId, c.total]));
  const categories = breakdownByCategory(transactions, 'expense').map((c) => ({
    ...c,
    previousTotal: previousByCategory.get(c.categoryId) || 0,
    change: percentChange(c.total, previousByCategory.get(c.categoryId) || 0),
  }));

  // Merchants where most money was spent
  const merchants = new Map();
  transactions
    .filter((t) => t.type === 'expense' && t.merchant)
    .forEach((t) => {
      const m = merchants.get(t.merchant) || { merchant: t.merchant, total: 0, count: 0 };
      m.total += t.amount;
      m.count += 1;
      merchants.set(t.merchant, m);
    });

  return {
    period: describePeriod(period),
    previousPeriod: describePeriod(prevPeriod),
    totals,
    previous,
    change: {
      income: percentChange(totals.income, previous.income),
      expense: percentChange(totals.expense, previous.expense),
      savings: previous.savings > 0 ? percentChange(totals.savings, previous.savings) : null,
    },
    daily,
    categories,
    incomeCategories: breakdownByCategory(transactions, 'income'),
    summary: summarize(transactions, totals),
    topMerchants: [...merchants.values()]
      .map((m) => ({ ...m, total: round2(m.total) }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5),
    transactionsCount: transactions.length,
  };
};

/** The last `count` months in a calendar, newest first - for month pickers. */
const periods = ({ calendar = 'gregorian', count = 12 } = {}, now = new Date()) => {
  const current = periodOf(now, calendar);
  return Array.from({ length: count }, (_, i) => describePeriod(shiftPeriod(current, -i)));
};

module.exports = { monthly, periods, breakdownByCategory };
