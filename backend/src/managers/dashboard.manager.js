const transactionRepository = require('../repositories/transaction.repository');
const recurringRepository = require('../repositories/recurring.repository');
const budgetManager = require('./budget.manager');
const goalManager = require('./goal.manager');
const { breakdownByCategory } = require('./report.manager');
const { monthRange, currentMonth, shiftMonth, daysInMonth, monthKey, dayKey } = require('../utils/dateUtils');
const { round2, average, totalsByType, calcHealthScore, calcForecast, sumOneOffExpenses } = require('../utils/finance');

const MONTHS_IN_CHART = 6;

/** Everything the dashboard needs, in a single request. */
const overview = async (userId, now = new Date()) => {
  const { year, month } = currentMonth(now);
  const current = monthRange(year, month);
  const first = shiftMonth(year, month, -(MONTHS_IN_CHART - 1));
  const chartStart = monthRange(first.year, first.month).from;

  const [transactions, allTime, recent, budgets, savings, upcoming] = await Promise.all([
    transactionRepository.findInRange(userId, chartStart, current.to, { populate: 'category' }),
    transactionRepository.sumByType(userId),
    transactionRepository.findAllByUser(userId, {}, { sort: { date: -1, createdAt: -1 }, limit: 6, populate: 'category' }),
    budgetManager.list(userId, { year, month }),
    goalManager.list(userId, now),
    recurringRepository.findUpcoming(userId, current.to),
  ]);

  // Split the six-month window into months
  const byMonth = new Map();
  transactions.forEach((t) => {
    const key = monthKey(t.date);
    if (!byMonth.has(key)) byMonth.set(key, []);
    byMonth.get(key).push(t);
  });

  const monthly = Array.from({ length: MONTHS_IN_CHART }, (_, i) => {
    const m = shiftMonth(first.year, first.month, i);
    const key = monthKey(monthRange(m.year, m.month).from);
    const totals = totalsByType(byMonth.get(key) || []);
    return { key, year: m.year, month: m.month, income: totals.income, expense: totals.expense };
  });

  const thisMonth = byMonth.get(monthKey(current.from)) || [];
  const totals = totalsByType(thisMonth);

  // Daily spending for the calendar heat-map
  const totalDays = daysInMonth(year, month);
  const spentByDay = new Map();
  thisMonth
    .filter((t) => t.type === 'expense')
    .forEach((t) => spentByDay.set(dayKey(t.date), (spentByDay.get(dayKey(t.date)) || 0) + t.amount));
  const heatmap = Array.from({ length: totalDays }, (_, i) => {
    const date = dayKey(new Date(Date.UTC(year, month, i + 1)));
    return { day: i + 1, date, total: round2(spentByDay.get(date) || 0) };
  });

  // What is usually still recorded after this day of the month (average of up to 3 previous months)
  const today = now.getUTCDate();
  const history = monthly
    .slice(0, -1)
    .slice(-3)
    .map((m) => byMonth.get(m.key) || [])
    .filter((items) => items.length > 0)
    .map((items) => totalsByType(items.filter((t) => new Date(t.date).getUTCDate() > today)));
  const expected = history.length
    ? { income: average(history.map((h) => h.income)), expense: average(history.map((h) => h.expense)) }
    : null;

  // Recurring payments still expected before the month ends
  const pending = upcoming.filter((p) => p.nextRun > now);
  const sumPending = (type) => pending.filter((p) => p.type === type).reduce((s, p) => s + p.amount, 0);

  const balance = round2(allTime.income - allTime.expense);
  const savedInGoals = round2(savings.goals.reduce((sum, g) => sum + g.currentAmount, 0));

  return {
    period: { year, month, day: now.getUTCDate(), totalDays },
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
      totalDays,
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
