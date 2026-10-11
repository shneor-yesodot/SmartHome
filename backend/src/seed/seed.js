/**
 * Fills the database with a demo account and six months of realistic data.
 * Usage: npm run seed
 * Login:  demo@smarthome.co.il / Demo1234
 */
const { connectDB, disconnectDB } = require('../config/db');
const { User, Category, Transaction, Budget, RecurringPayment, SavingsGoal, Receipt } = require('../models');
const defaultCategories = require('./defaultCategories');
const { toProductKey } = require('../utils/text');
const { round2 } = require('../utils/finance');
const { currentMonth, shiftMonth, daysInMonth, startOfDay, addDays } = require('../utils/dateUtils');
const logger = require('../utils/logger');

const DEMO = { name: 'משפחת ישראלי', email: 'demo@smarthome.co.il', password: 'Demo1234', emailVerified: true };
const MONTHS_BACK = 6;

// Small deterministic random generator, so every seed run produces the same data
let state = 20261005;
const random = () => {
  state = (state * 1664525 + 1013904223) % 4294967296;
  return state / 4294967296;
};
const between = (min, max) => round2(min + random() * (max - min));
const pick = (list) => list[Math.floor(random() * list.length)];

// price = base price * merchant factor * small monthly drift
const MERCHANTS = [
  { name: 'שופרסל דיל', factor: 1.06 },
  { name: 'רמי לוי', factor: 0.95 },
  { name: 'ויקטורי', factor: 1.0 },
];
const PRODUCTS = [
  { name: 'חלב 3% 1 ליטר', price: 7.1, qty: [1, 3] },
  { name: 'לחם אחיד פרוס', price: 8.6, qty: [1, 2] },
  { name: 'ביצים L תבנית 12', price: 14.2, qty: [1, 2] },
  { name: 'קוטג׳ 5% 250 גרם', price: 6.2, qty: [2, 4] },
  { name: 'גבינה צהובה 28% 400 גרם', price: 24.9, qty: [1, 1] },
  { name: 'חזה עוף טרי 1 ק״ג', price: 39.9, qty: [1, 2] },
  { name: 'אורז בסמטי 1 ק״ג', price: 11.9, qty: [1, 2] },
  { name: 'שמן זית 750 מ״ל', price: 34.9, qty: [1, 1] },
  { name: 'קפה נמס 200 גרם', price: 27.9, qty: [1, 1] },
  { name: 'עגבניות 1 ק״ג', price: 6.9, qty: [1, 2] },
  { name: 'בננות 1 ק״ג', price: 8.9, qty: [1, 2] },
  { name: 'נייר טואלט 32 גלילים', price: 39.9, qty: [1, 1], category: 'דיור וחשבונות' },
  { name: 'נוזל כביסה 3 ליטר', price: 36.9, qty: [1, 1], category: 'דיור וחשבונות' },
  { name: 'חיתולים מידה 4', price: 54.9, qty: [1, 2], category: 'ילדים וחינוך' },
];

const FIXED = [
  { day: 1, type: 'income', category: 'משכורת', description: 'משכורת - נועה', merchant: 'מעסיק', amount: [9800, 9800], recurring: true },
  { day: 10, type: 'income', category: 'משכורת', description: 'משכורת - יואב', merchant: 'מעסיק', amount: [14500, 14500], recurring: true },
  { day: 20, type: 'income', category: 'קצבאות והחזרים', description: 'קצבת ילדים', merchant: 'ביטוח לאומי', amount: [346, 346] },
  { day: 1, type: 'expense', category: 'דיור וחשבונות', description: 'שכר דירה', merchant: 'בעל הדירה', amount: [5200, 5200], recurring: true },
  { day: 12, type: 'expense', category: 'דיור וחשבונות', description: 'חשבון חשמל', merchant: 'חברת החשמל', amount: [380, 620] },
  { day: 14, type: 'expense', category: 'דיור וחשבונות', description: 'ארנונה', merchant: 'עיריית תל אביב', amount: [640, 640] },
  { day: 5, type: 'expense', category: 'תקשורת ומנויים', description: 'אינטרנט ביתי', merchant: 'בזק', amount: [99, 99], recurring: true },
  { day: 5, type: 'expense', category: 'תקשורת ומנויים', description: 'חבילת סלולר משפחתית', merchant: 'פרטנר', amount: [120, 120], recurring: true },
  { day: 8, type: 'expense', category: 'תקשורת ומנויים', description: 'מנוי סטרימינג', merchant: 'Netflix', amount: [54.9, 54.9], recurring: true },
  { day: 3, type: 'expense', category: 'ילדים וחינוך', description: 'חוג שחייה', merchant: 'מרכז הספורט', amount: [320, 320] },
  { day: 2, type: 'expense', category: 'ילדים וחינוך', description: 'צהרון', merchant: 'צהרון השכונה', amount: [1150, 1150] },
  { day: 18, type: 'expense', category: 'תחבורה ורכב', description: 'ביטוח רכב', merchant: 'הראל', amount: [380, 380] },
];

const VARIABLE = [
  { times: [2, 4], category: 'תחבורה ורכב', description: 'תדלוק', merchants: ['פז', 'סונול', 'דלק'], amount: [210, 340] },
  { times: [3, 6], category: 'מסעדות ובילויים', description: 'ארוחה בחוץ', merchants: ['קפה נואר', 'ג׳פניקה', 'פיצה שמש', 'בית קפה ארומה'], amount: [58, 290] },
  { times: [1, 2], category: 'בריאות וטיפוח', description: 'בית מרקחת', merchants: ['סופר-פארם', 'Be'], amount: [45, 190] },
  { times: [0, 2], category: 'ביגוד והנעלה', description: 'בגדים', merchants: ['קסטרו', 'FOX', 'זארה'], amount: [120, 460] },
  { times: [0, 1], category: 'מסעדות ובילויים', description: 'כרטיסים לקולנוע', merchants: ['סינמה סיטי'], amount: [84, 168] },
];

const seed = async () => {
  await connectDB();

  // Remove the previous demo account and everything it owned
  const existing = await User.findOne({ email: DEMO.email });
  if (existing) {
    const owned = { user: existing._id };
    await Promise.all([Category, Transaction, Budget, RecurringPayment, SavingsGoal, Receipt].map((M) => M.deleteMany(owned)));
    await User.deleteOne({ _id: existing._id });
  }

  const user = await User.create(DEMO);
  const categories = await Category.insertMany(defaultCategories.map((c) => ({ ...c, user: user._id, isDefault: true })));
  const categoryId = (name, type) => categories.find((c) => c.name === name && c.type === type)._id;

  const today = startOfDay();
  const { year, month } = currentMonth(today);
  const transactions = [];
  const add = (t) => t.date <= today && transactions.push({ user: user._id, ...t });

  for (let back = MONTHS_BACK - 1; back >= 0; back -= 1) {
    const m = shiftMonth(year, month, -back);
    const lastDay = daysInMonth(m.year, m.month);
    const dateOf = (day) => new Date(Date.UTC(m.year, m.month, Math.min(day, lastDay)));
    const drift = 1 + (MONTHS_BACK - 1 - back) * 0.008; // prices creep up ~0.8% a month

    FIXED.forEach((f) =>
      add({
        type: f.type,
        amount: between(...f.amount),
        category: categoryId(f.category, f.type),
        description: f.description,
        merchant: f.merchant,
        date: dateOf(f.day),
        source: f.recurring ? 'recurring' : 'manual',
      })
    );

    VARIABLE.forEach((v) => {
      const times = Math.round(between(...v.times));
      for (let i = 0; i < times; i += 1) {
        add({
          type: 'expense',
          amount: between(...v.amount),
          category: categoryId(v.category, 'expense'),
          description: v.description,
          merchant: pick(v.merchants),
          date: dateOf(1 + Math.floor(random() * lastDay)),
          source: 'manual',
        });
      }
    });

    // Four supermarket receipts a month - every product line is its own transaction
    [4, 11, 19, 26].forEach((day) => {
      const merchant = pick(MERCHANTS);
      const basket = PRODUCTS.filter(() => random() < 0.62);
      basket.forEach((p) => {
        const quantity = Math.round(between(...p.qty));
        const unitPrice = round2(p.price * merchant.factor * drift * between(0.97, 1.04));
        add({
          type: 'expense',
          amount: round2(unitPrice * quantity),
          category: categoryId(p.category || 'סופר ומזון', 'expense'),
          description: p.name,
          merchant: merchant.name,
          date: dateOf(day),
          productName: p.name,
          productKey: toProductKey(p.name),
          quantity,
          unitPrice,
          source: 'receipt',
        });
      });
    });
  }
  await Transaction.insertMany(transactions);

  await Budget.insertMany(
    [
      ['סופר ומזון', 2400],
      ['מסעדות ובילויים', 700],
      ['תחבורה ורכב', 1400],
      ['תקשורת ומנויים', 300],
      ['ביגוד והנעלה', 500],
    ].map(([name, amount]) => ({ user: user._id, category: categoryId(name, 'expense'), amount }))
  );

  const nextOn = (day) => {
    const thisMonth = new Date(Date.UTC(year, month, day));
    return thisMonth > today ? thisMonth : new Date(Date.UTC(year, month + 1, day));
  };
  await RecurringPayment.insertMany(
    FIXED.filter((f) => f.recurring).map((f) => ({
      user: user._id,
      description: f.description,
      merchant: f.merchant,
      type: f.type,
      amount: f.amount[0],
      category: categoryId(f.category, f.type),
      frequency: 'monthly',
      nextRun: nextOn(f.day),
      lastRun: addDays(nextOn(f.day), -30),
    }))
  );

  await SavingsGoal.insertMany([
    { name: 'חופשה משפחתית ביוון', targetAmount: 12000, currentAmount: 7400, icon: 'Plane', color: '#2F7FD1', createdAt: addDays(today, -150), targetDate: addDays(today, 120) },
    { name: 'קרן חירום', targetAmount: 30000, currentAmount: 6500, icon: 'ShieldCheck', color: '#12A05C', createdAt: addDays(today, -200), targetDate: addDays(today, 400) },
    { name: 'מחשב נייד חדש', targetAmount: 5500, currentAmount: 4900, icon: 'Laptop', color: '#7B61D9', createdAt: addDays(today, -90), targetDate: addDays(today, 45) },
  ].map((g) => ({ ...g, user: user._id, deposits: [{ amount: g.currentAmount, note: 'סכום פתיחה', date: g.createdAt }] })));

  logger.info(`Seed completed: ${transactions.length} transactions, ${categories.length} categories`);
  logger.info(`Demo login -> ${DEMO.email} / ${DEMO.password}`);
  await disconnectDB();
};

seed().catch(async (err) => {
  logger.error('Seed failed:', err);
  await disconnectDB();
  process.exit(1);
});
