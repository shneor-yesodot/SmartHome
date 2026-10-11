/** Pure financial calculations - no database access, easy to unit-test. */
const { HEALTH_WEIGHTS, TARGET_SAVINGS_RATE } = require('../config/constants');
const { diffInDays } = require('./dateUtils');

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
const percentOf = (part, total) => (total > 0 ? round2((part / total) * 100) : 0);

/** Percentage change between two values; null when there is no baseline. */
const percentChange = (current, previous) =>
  previous > 0 ? round2(((current - previous) / previous) * 100) : null;

const totalsByType = (transactions) => {
  let income = 0;
  let expense = 0;
  for (const t of transactions) {
    if (t.type === 'income') income += t.amount;
    else expense += t.amount;
  }
  return { income: round2(income), expense: round2(expense), balance: round2(income - expense) };
};

const average = (numbers) => (numbers.length ? numbers.reduce((s, n) => s + n, 0) / numbers.length : 0);

const healthLevel = (score) => {
  if (score >= 80) return { level: 'excellent', label: 'מצב מצוין' };
  if (score >= 60) return { level: 'good', label: 'מצב טוב' };
  if (score >= 40) return { level: 'fair', label: 'דורש תשומת לב' };
  return { level: 'poor', label: 'מצב מאתגר' };
};

/**
 * Financial health score (0-100) built from three factors:
 *  - savings: share of income that is saved (20% and up = full score)
 *  - budget:  share of budgets that were not exceeded
 *  - trend:   this month's expenses compared with the average of previous months
 */
const calcHealthScore = ({ income, expense, budgets = [], previousExpenses = [] }) => {
  const savingsRate = income > 0 ? (income - expense) / income : 0;
  const savings = clamp(savingsRate / TARGET_SAVINGS_RATE, 0, 1) * 100;

  const withinBudget = budgets.filter((b) => b.spent <= b.amount).length;
  const budget = budgets.length ? (withinBudget / budgets.length) * 100 : 100;

  const baseline = average(previousExpenses.filter((n) => n > 0));
  const trend =
    !baseline || expense <= baseline ? 100 : clamp(100 - ((expense - baseline) / baseline) * 200, 0, 100);

  const score = Math.round(
    savings * HEALTH_WEIGHTS.savings + budget * HEALTH_WEIGHTS.budget + trend * HEALTH_WEIGHTS.trend
  );

  return {
    score,
    ...healthLevel(score),
    factors: [
      { key: 'savings', label: 'שיעור חיסכון', value: Math.round(savings) },
      { key: 'budget', label: 'עמידה בתקציב', value: Math.round(budget) },
      { key: 'trend', label: 'מגמת הוצאות', value: Math.round(trend) },
    ],
  };
};

/**
 * Month-end projection.
 * With history: what was already recorded + what is usually still recorded after this
 * day of the month (so a rent payment on the 1st is not multiplied by 30).
 * Without history: average daily spend so far, extended to the whole month.
 * Known recurring payments that are still due act as a lower bound.
 */
const calcForecast = ({ income, expense, dayOfMonth, totalDays, expected = null, upcomingIncome = 0, upcomingExpense = 0 }) => {
  const dailyAverage = dayOfMonth > 0 ? expense / dayOfMonth : 0;
  const remainingExpense = expected
    ? Math.max(expected.expense, upcomingExpense)
    : dailyAverage * (totalDays - dayOfMonth) + upcomingExpense;
  const remainingIncome = expected ? Math.max(expected.income, upcomingIncome) : upcomingIncome;

  const projectedExpense = expense + remainingExpense;
  const projectedIncome = income + remainingIncome;
  return {
    basedOnHistory: Boolean(expected),
    dailyAverage: round2(dailyAverage),
    daysLeft: totalDays - dayOfMonth,
    projectedExpense: round2(projectedExpense),
    projectedIncome: round2(projectedIncome),
    projectedBalance: round2(projectedIncome - projectedExpense),
  };
};

/**
 * Progress of a savings goal. A goal is "on track" when the saved share is at
 * least the share of time that has passed between its creation and target date.
 */
const calcGoalProgress = (goal, now = new Date()) => {
  const percent = clamp(percentOf(goal.currentAmount, goal.targetAmount), 0, 100);
  const remaining = round2(Math.max(goal.targetAmount - goal.currentAmount, 0));
  const totalDays = Math.max(diffInDays(goal.createdAt || now, goal.targetDate), 1);
  const daysLeft = diffInDays(now, goal.targetDate);
  const expectedPercent = clamp(round2(((totalDays - daysLeft) / totalDays) * 100), 0, 100);

  let status = 'on_track';
  if (remaining === 0) status = 'completed';
  else if (daysLeft < 0) status = 'overdue';
  else if (percent + 0.5 < expectedPercent) status = 'behind';

  const monthsLeft = Math.max(daysLeft / 30.44, 1);
  return {
    percent,
    remaining,
    expectedPercent,
    daysLeft,
    status,
    monthlyNeeded: remaining > 0 && daysLeft >= 0 ? round2(remaining / monthsLeft) : 0,
  };
};

module.exports = {
  round2,
  clamp,
  percentOf,
  percentChange,
  totalsByType,
  average,
  calcHealthScore,
  calcForecast,
  calcGoalProgress,
};
