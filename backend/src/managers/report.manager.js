const transactionRepository = require('../repositories/transaction.repository');
const { monthRange, shiftMonth, daysInMonth } = require('../utils/dateUtils');
const { round2, percentOf, percentChange, totalsByType } = require('../utils/finance');

const HEBREW_MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];

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

const monthly = async (userId, { year, month }) => {
  const { from, to } = monthRange(year, month);
  const prev = shiftMonth(year, month, -1);
  const prevRange = monthRange(prev.year, prev.month);

  const [transactions, previousTransactions] = await Promise.all([
    transactionRepository.findInRange(userId, from, to, { populate: 'category' }),
    transactionRepository.findInRange(userId, prevRange.from, prevRange.to, { populate: 'category' }),
  ]);

  const totals = withSavings(totalsByType(transactions));
  const previous = withSavings(totalsByType(previousTransactions));

  // Day-by-day series for the chart
  const daily = Array.from({ length: daysInMonth(year, month) }, (_, i) => ({ day: i + 1, income: 0, expense: 0 }));
  transactions.forEach((t) => {
    const slot = daily[new Date(t.date).getUTCDate() - 1];
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
    period: { year, month, label: `${HEBREW_MONTHS[month]} ${year}` },
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
    topMerchants: [...merchants.values()]
      .map((m) => ({ ...m, total: round2(m.total) }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5),
    transactionsCount: transactions.length,
  };
};

module.exports = { monthly, breakdownByCategory, HEBREW_MONTHS };
