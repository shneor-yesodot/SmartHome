/** Domain constants shared by models, validators and managers. */

const TRANSACTION_TYPES = Object.freeze(['income', 'expense']);
const TRANSACTION_SOURCES = Object.freeze(['manual', 'receipt', 'import', 'recurring']);
const FREQUENCIES = Object.freeze(['daily', 'weekly', 'monthly', 'yearly']);
const USER_ROLES = Object.freeze(['user', 'admin']);
// Months can be counted by the Gregorian or by the Hebrew calendar
const CALENDARS = Object.freeze(['gregorian', 'hebrew']);

// Weights of the financial health score (must sum to 1)
const HEALTH_WEIGHTS = Object.freeze({ savings: 0.4, budget: 0.3, trend: 0.3 });
// A savings rate of 20% (or more) earns the full savings score
const TARGET_SAVINGS_RATE = 0.2;

const RECEIPT_MIME_TYPES = Object.freeze(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);

const FALLBACK_CATEGORY_NAME = 'אחר';

module.exports = {
  TRANSACTION_TYPES,
  TRANSACTION_SOURCES,
  FREQUENCIES,
  USER_ROLES,
  CALENDARS,
  HEALTH_WEIGHTS,
  TARGET_SAVINGS_RATE,
  RECEIPT_MIME_TYPES,
  FALLBACK_CATEGORY_NAME,
};
