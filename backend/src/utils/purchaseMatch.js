/**
 * When a purchase that was typed or scanned and a statement line are the same money.
 * Used from both sides: a statement imported after the receipt, and a receipt saved
 * after the statement.
 */
const { round2 } = require('./finance');
const { sameMerchant } = require('./text');

const NEARBY_DAYS = 3;
const DAY_MS = 86400000;
const ADJUSTMENT_NAME = 'הפרש מול החיוב בכרטיס';

const isNear = (a, b) => Math.abs(new Date(a) - new Date(b)) <= NEARBY_DAYS * DAY_MS;

/** How far a receipt may be from the charge and still be offered (never linked on its own). */
const tolerance = (total) => Math.max(2, round2(total * 0.05));
const isClose = (a, b) => Math.abs(round2(a - b)) <= tolerance(Math.max(a, b));

/**
 * The best of several candidates: an exact amount first, then the same store,
 * then the nearest date. Each candidate is { amount, merchant, date }.
 */
const rank = (target) => (a, b) => {
  const exact = (c) => (round2(c.amount) === round2(target.amount) ? 0 : 1);
  const store = (c) => (target.merchant && sameMerchant(c.merchant, target.merchant) ? 0 : 1);
  const days = (c) => Math.abs(new Date(c.date) - new Date(target.date));
  return exact(a) - exact(b) || store(a) - store(b) || days(a) - days(b);
};

/**
 * Makes item amounts add up to what the card charged. A missing amount becomes one
 * more item; an extra amount (usually a discount printed apart) comes off the largest
 * item. Returns null when the difference is bigger than that item.
 */
const fitToCharge = (amounts, charge) => {
  const diff = round2(charge - amounts.reduce((s, a) => s + a, 0));
  if (diff >= 0) return { diff, add: diff };
  const index = amounts.indexOf(Math.max(...amounts));
  const amount = round2(amounts[index] + diff);
  return amount > 0 ? { diff, reduce: { index, amount } } : null;
};

module.exports = { NEARBY_DAYS, ADJUSTMENT_NAME, isNear, tolerance, isClose, rank, fitToCharge };
