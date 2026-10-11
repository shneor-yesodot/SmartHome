const transactionRepository = require('../repositories/transaction.repository');
const budgetManager = require('./budget.manager');
const goalManager = require('./goal.manager');
const productManager = require('./product.manager');
const { breakdownByCategory } = require('./report.manager');
const geminiService = require('../services/gemini.service');
const logger = require('../utils/logger');
const { monthRange, currentMonth, shiftMonth } = require('../utils/dateUtils');
const { totalsByType, percentChange, round2 } = require('../utils/finance');

const money = (n) => `${Math.round(n).toLocaleString('he-IL')} ₪`;
const ALLOWED_TYPES = ['positive', 'warning', 'tip'];

/** Aggregated figures only - no names, merchants or free text are sent to the AI. */
const buildSummary = async (userId) => {
  const { year, month } = currentMonth();
  const prev = shiftMonth(year, month, -1);
  const current = monthRange(year, month);
  const previous = monthRange(prev.year, prev.month);

  const [thisMonth, lastMonth, budgets, goals, catalogue] = await Promise.all([
    transactionRepository.findInRange(userId, current.from, current.to, { populate: 'category' }),
    transactionRepository.findInRange(userId, previous.from, previous.to, { populate: 'category' }),
    budgetManager.list(userId, { year, month }),
    goalManager.list(userId),
    productManager.list(userId),
  ]);

  return {
    dayOfMonth: new Date().getUTCDate(),
    thisMonth: totalsByType(thisMonth),
    lastMonth: totalsByType(lastMonth),
    topCategories: breakdownByCategory(thisMonth, 'expense').slice(0, 5).map(({ name, total, percent }) => ({ name, total, percent })),
    budgets: budgets.map((b) => ({ category: b.category.name, limit: b.amount, spent: b.spent, percent: b.percent })),
    goals: goals.map((g) => ({ name: g.name, percent: g.progress.percent, status: g.progress.status, monthlyNeeded: g.progress.monthlyNeeded })),
    products: {
      potentialSaving: catalogue.stats.potentialSaving,
      risingPrices: catalogue.products.filter((p) => p.priceChange > 5).slice(0, 3).map((p) => ({ name: p.name, change: p.priceChange })),
    },
  };
};

/** Deterministic insights - used when no AI key is configured or the AI call fails. */
const ruleBasedInsights = (s) => {
  const insights = [];
  const { income, expense, balance } = s.thisMonth;

  if (income > 0) {
    const rate = round2((balance / income) * 100);
    if (rate >= 20) insights.push({ type: 'positive', title: 'שיעור חיסכון גבוה', text: `החודש נשארו בצד ${rate}% מההכנסות (${money(balance)}). זה מעל היעד המקובל של 20%.` });
    else if (rate >= 0) insights.push({ type: 'tip', title: 'אפשר לחסוך יותר', text: `שיעור החיסכון החודש הוא ${rate}%. צמצום של ${money(income * 0.2 - balance)} בהוצאות יביא אתכם ליעד של 20%.` });
    else insights.push({ type: 'warning', title: 'ההוצאות גבוהות מההכנסות', text: `החודש הוצאתם ${money(-balance)} יותר ממה שנכנס.` });
  }

  const change = percentChange(expense, s.lastMonth.expense);
  if (change !== null && change > 10) insights.push({ type: 'warning', title: 'ההוצאות בעלייה', text: `ההוצאות החודש גבוהות ב-${Math.round(change)}% מהחודש הקודם כולו.` });
  if (change !== null && change < -10 && s.dayOfMonth >= 25) insights.push({ type: 'positive', title: 'ההוצאות ירדו', text: `הוצאתם ${Math.round(-change)}% פחות מהחודש הקודם.` });

  const top = s.topCategories[0];
  if (top && top.percent >= 35) insights.push({ type: 'tip', title: `${top.name} היא ההוצאה הגדולה ביותר`, text: `${top.percent}% מההוצאות החודש (${money(top.total)}) הלכו לקטגוריה הזו. שווה לבדוק אם אפשר לצמצם בה.` });

  s.budgets.filter((b) => b.percent >= 100).forEach((b) => insights.push({ type: 'warning', title: `חריגה מתקציב ${b.category}`, text: `הוצאתם ${money(b.spent)} מתוך תקציב של ${money(b.limit)}.` }));
  s.goals.filter((g) => g.status === 'behind').slice(0, 1).forEach((g) => insights.push({ type: 'tip', title: `היעד "${g.name}" מפגר`, text: `כדי לעמוד בתאריך היעד צריך להפקיד כ-${money(g.monthlyNeeded)} בחודש.` }));

  if (s.products.potentialSaving > 0) insights.push({ type: 'tip', title: 'חיסכון בקניות', text: `לפי היסטוריית המחירים, קנייה של המוצרים הקבועים במקום הזול ביותר תחסוך כ-${money(s.products.potentialSaving)} בסל.` });
  if (!insights.length) insights.push({ type: 'tip', title: 'עדיין אין מספיק נתונים', text: 'הוסיפו עסקאות, תקציבים או קבלות, ונוכל להציג תובנות מותאמות אישית.' });

  return insights.slice(0, 5);
};

const generate = async (userId) => {
  const summary = await buildSummary(userId);
  let source = 'rules';
  let insights = ruleBasedInsights(summary);

  if (geminiService.isConfigured()) {
    try {
      const answer = await geminiService.generateInsights(summary);
      const valid = (answer.insights || [])
        .filter((i) => i && i.title && i.text)
        .map((i) => ({ type: ALLOWED_TYPES.includes(i.type) ? i.type : 'tip', title: String(i.title).slice(0, 80), text: String(i.text).slice(0, 400) }));
      if (valid.length) {
        insights = valid.slice(0, 5);
        source = 'gemini';
      }
    } catch (err) {
      logger.warn('AI insights unavailable, using rule-based insights:', err.message);
    }
  }
  return { source, insights, generatedAt: new Date() };
};

module.exports = { generate, ruleBasedInsights };
