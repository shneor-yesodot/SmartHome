const transactionRepository = require('../repositories/transaction.repository');
const ApiError = require('../utils/ApiError');
const { round2, average, percentChange } = require('../utils/finance');
const { escapeRegex, toProductKey } = require('../utils/text');

const UNKNOWN_MERCHANT = 'לא צוין';
const priceOf = (t) => t.unitPrice ?? round2(t.amount / (t.quantity || 1));

/** Price statistics per merchant for one product. Purchases must be sorted by date (oldest first). */
const merchantStats = (purchases) => {
  const groups = new Map();
  purchases.forEach((t) => {
    const name = t.merchant || UNKNOWN_MERCHANT;
    const g = groups.get(name) || { merchant: name, prices: [], lastPrice: 0, lastDate: null };
    g.prices.push(priceOf(t));
    g.lastPrice = priceOf(t);
    g.lastDate = t.date;
    groups.set(name, g);
  });
  return [...groups.values()]
    .map((g) => ({
      merchant: g.merchant,
      purchases: g.prices.length,
      avgPrice: round2(average(g.prices)),
      minPrice: Math.min(...g.prices),
      lastPrice: g.lastPrice,
      lastDate: g.lastDate,
    }))
    .sort((a, b) => a.lastPrice - b.lastPrice || a.avgPrice - b.avgPrice);
};

/** Summary card of a product, built from all of its purchases. */
const summarize = (key, purchases) => {
  const prices = purchases.map(priceOf);
  const last = purchases[purchases.length - 1];
  const previous = purchases[purchases.length - 2];
  const merchants = merchantStats(purchases);
  const best = merchants[0]; // cheapest by most recent price

  return {
    key,
    name: last.productName,
    category: last.category ? { name: last.category.name, color: last.category.color, icon: last.category.icon } : null,
    purchases: purchases.length,
    totalSpent: round2(purchases.reduce((s, t) => s + t.amount, 0)),
    totalQuantity: round2(purchases.reduce((s, t) => s + (t.quantity || 1), 0)),
    lastPrice: priceOf(last),
    lastDate: last.date,
    lastMerchant: last.merchant || UNKNOWN_MERCHANT,
    minPrice: Math.min(...prices),
    maxPrice: Math.max(...prices),
    avgPrice: round2(average(prices)),
    priceChange: previous ? percentChange(priceOf(last), priceOf(previous)) : null,
    merchantsCount: merchants.length,
    bestMerchant: best.merchant,
    bestPrice: best.lastPrice,
    // How much one unit would cost less at the cheapest place compared with the last purchase
    potentialSaving: round2(Math.max(priceOf(last) - best.lastPrice, 0)),
  };
};

const groupByProduct = (purchases) => {
  const groups = new Map();
  purchases.forEach((t) => {
    if (!groups.has(t.productKey)) groups.set(t.productKey, []);
    groups.get(t.productKey).push(t);
  });
  return groups;
};

const SORTERS = {
  recent: (a, b) => new Date(b.lastDate) - new Date(a.lastDate),
  spent: (a, b) => b.totalSpent - a.totalSpent,
  purchases: (a, b) => b.purchases - a.purchases,
  name: (a, b) => a.name.localeCompare(b.name, 'he'),
};

const list = async (userId, { search, sort = 'recent' } = {}) => {
  const purchases = await transactionRepository.findProductPurchases(userId);
  let products = [...groupByProduct(purchases)].map(([key, items]) => summarize(key, items));

  if (search) {
    const rx = new RegExp(escapeRegex(search), 'i');
    products = products.filter((p) => rx.test(p.name));
  }
  products.sort(SORTERS[sort] || SORTERS.recent);

  return {
    products,
    stats: {
      productsCount: products.length,
      totalSpent: round2(products.reduce((s, p) => s + p.totalSpent, 0)),
      comparableCount: products.filter((p) => p.merchantsCount > 1).length,
      potentialSaving: round2(products.reduce((s, p) => s + p.potentialSaving, 0)),
    },
  };
};

const detail = async (userId, key) => {
  const productKey = toProductKey(key);
  const purchases = await transactionRepository.findProductPurchases(userId, productKey);
  if (!purchases.length) throw ApiError.notFound('המוצר לא נמצא');

  return {
    ...summarize(productKey, purchases),
    history: purchases.map((t) => ({
      id: String(t._id),
      date: t.date,
      merchant: t.merchant || UNKNOWN_MERCHANT,
      unitPrice: priceOf(t),
      quantity: t.quantity || 1,
      amount: t.amount,
    })),
    merchants: merchantStats(purchases),
  };
};

module.exports = { list, detail };
