const transactionRepository = require('../repositories/transaction.repository');
const recurringRepository = require('../repositories/recurring.repository');
const budgetManager = require('./budget.manager');
const goalManager = require('./goal.manager');
const { breakdownByCategory } = require('./report.manager');
const { periodOf, shiftPeriod, dayOfPeriod, describePeriod } = require('../utils/period');
const { dayKey } = require('../utils/dateUtils');
const { round2, average, totalsByType, calcHealthScore, calcForecast, sumOneOffExpenses } = require('../utils/finance');

const MONTHS_IN_CHART = 6;

/** Everything the dashboard needs, in a single request. Months follow the user's calendar. */
const overview = async (userId, { now = new Date(), calendar = 'gregorian' } = {}) => {
  const current = periodOf(now, calendar);
  const periods = Array.from({ length: MONTHS_IN_CHART }, (_, i) => shiftPeriod(current, i - (MONTHS_IN_CHART - 1)));

  const [transactions, allTime, recent, budgets, savings, upcoming] = await Promise.all([
    transactionRepository.findInRange(userId, periods[0].from, current.to, { populate: 'category' }),
    transactionRepository.sumByType(userId),
    transactionRepository.findAllByUser(userId, {}, { sort: { date: -1, createdAt: -1 }, limit: 6, populate: 'category' }),
    budgetManager.list(userId, current),
    goalManager.list(userId, { now, calendar }),
    recurringRepository.findUpcoming(userId, current.to),
  ]);

  // Split the six-month window into months
  const byPeriod = periods.map((p) => transactions.filter((t) => t.date >= p.from && t.date < p.to));

  const monthly = periods.map((p, i) => {
    const totals = totalsByType(byPeriod[i]);
    return { key: p.key, name: p.name, label: p.label, income: totals.income, expense: totals.expense };
  });

  const thisMonth = byPeriod[MONTHS_IN_CHART - 1];
  const totals = totalsByType(thisMonth);

  // Daily spending for the calendar heat-map
  const spentByDay = new Map();
  thisMonth
    .filter((t) => t.type === 'expense')
    .forEach((t) => spentByDay.set(dayKey(t.date), (spentByDay.get(dayKey(t.date)) || 0) + t.amount));
  const heatmap = Array.from({ length: current.days }, (_, i) => {
    const date = dayKey(new Date(current.from.getTime() + i * 86400000));
    return { day: i + 1, date, total: round2(spentByDay.get(date) || 0) };
  });

  // What is usually still recorded after this day of the month (average of up to 3 previous months)
  const today = dayOfPeriod(now, current);
  const history = periods
    .map((period, i) => ({ period, items: byPeriod[i] }))
    .slice(-4, -1)
    .filter(({ items }) => items.length > 0)
    .map(({ items, period }) => totalsByType(items.filter((t) => dayOfPeriod(t.date, period) > today)));
  const expected = history.length
    ? { income: average(history.map((h) => h.income)), expense: average(history.map((h) => h.expense)) }
    : null;

  // Recurring payments still expected before the month ends
  const pending = upcoming.filter((p) => p.nextRun > now);
  const sumPending = (type) => pending.filter((p) => p.type === type).reduce((s, p) => s + p.amount, 0);

  const balance = round2(allTime.income - allTime.expense);
  const savedInGoals = round2(savings.goals.reduce((sum, g) => sum + g.currentAmount, 0));

  return {
    period: { ...describePeriod(current), day: today, totalDays: current.days },
    summary: {
      income: totals.income,
      expense: totals.expense,
      monthBalance: totals.balance,
      balance,
      // Money moved to savings goals is still yours, but no longer free to spend
      savedInGoals,
      available: round2(balance - savedInGoals),
    },
    health: calcHealthScore({
      income: totals.income,
      expense: totals.expense,
      budgets,
      previousExpenses: monthly.slice(0, -1).slice(-3).map((m) => m.expense),
    }),
    forecast: calcForecast({
      income: totals.income,
      expense: totals.expense,
      dayOfMonth: today,
      totalDays: current.days,
      expected,
      upcomingIncome: sumPending('income'),
      upcomingExpense: sumPending('expense'),
      oneOffExpense: sumOneOffExpenses(thisMonth.filter((t) => t.type === 'expense').map((t) => t.amount)),
    }),
    monthly,
    categories: breakdownByCategory(thisMonth, 'expense'),
    heatmap,
    budgets,
    goals: savings.goals,
    savingsPlan: savings.month,
    upcomingRecurring: pending.slice(0, 5).map((p) => ({
      id: String(p._id),
      description: p.description,
      amount: p.amount,
      type: p.type,
      nextRun: p.nextRun,
    })),
    recent,
  };
};

module.exports = { overview };
