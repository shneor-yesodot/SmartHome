const categoryRepository = require('../repositories/category.repository');
const transactionRepository = require('../repositories/transaction.repository');
const budgetRepository = require('../repositories/budget.repository');
const recurringRepository = require('../repositories/recurring.repository');
const statementService = require('../services/statement.service');
const ApiError = require('../utils/ApiError');
const { FALLBACK_CATEGORY_NAME, MAASER_CATEGORY_NAME } = require('../config/constants');
const defaultCategories = require('../seed/defaultCategories');

const list = (userId, { type } = {}) =>
  categoryRepository.findAllByUser(userId, type ? { type } : {}, { sort: { type: 1, name: 1 } });

const create = (userId, data) => categoryRepository.create(userId, data);

const update = async (userId, id, data) => {
  const category = await categoryRepository.updateByUser(userId, id, data);
  if (!category) throw ApiError.notFound('הקטגוריה לא נמצאה');
  return category;
};

const remove = async (userId, id) => {
  const inUse = await transactionRepository.countByUser(userId, { category: id });
  if (inUse > 0) {
    throw ApiError.conflict(`לא ניתן למחוק קטגוריה שמשויכות אליה ${inUse} עסקאות. העבירו אותן לקטגוריה אחרת קודם`);
  }
  const category = await categoryRepository.deleteByUser(userId, id);
  if (!category) throw ApiError.notFound('הקטגוריה לא נמצאה');
  await budgetRepository.deleteManyByUser(userId, { category: id });
};

/** Makes sure a category exists, belongs to the user and matches the transaction type. */
const assertOwned = async (userId, categoryId, type) => {
  const category = await categoryRepository.findOneByUser(userId, categoryId);
  if (!category) throw ApiError.badRequest('הקטגוריה שנבחרה אינה קיימת');
  if (type && category.type !== type) throw ApiError.badRequest('הקטגוריה אינה מתאימה לסוג העסקה');
  return category;
};

/** Returns the user's "other" category of the given type, creating it when missing. */
const getFallback = async (userId, type) => {
  const existing = await categoryRepository.findByName(userId, FALLBACK_CATEGORY_NAME, type);
  return existing || categoryRepository.create(userId, { name: FALLBACK_CATEGORY_NAME, type, icon: 'MoreHorizontal', color: '#7C8B83' });
};

/** Every new account starts with a ready-made set of categories. */
const seedDefaults = (userId) =>
  categoryRepository.createMany(userId, defaultCategories.map((c) => ({ ...c, isDefault: true })));

/**
 * The category whose expenses count as maaser / tzedakah. Accounts created
 * before it existed get it on first use (an existing category with the same
 * name is reused).
 */
const getMaaserCategory = async (userId) => {
  const flagged = await categoryRepository.findOneWhere(userId, { isMaaser: true });
  if (flagged) return flagged;
  const named = await categoryRepository.findByName(userId, MAASER_CATEGORY_NAME, 'expense');
  if (named) {
    named.isMaaser = true;
    return named.save();
  }
  return categoryRepository.create(userId, { name: MAASER_CATEGORY_NAME, type: 'expense', icon: 'HandHeart', color: '#B7791F', isMaaser: true });
};

const IS_MAASER = /מעשר/;
const PALETTE = ['#12A05C', '#2F7FD1', '#E08A1E', '#D9508A', '#D93F3F', '#7B61D9', '#1FA6A6', '#5C6BC0', '#B7791F'];
const ICON_BY_NAME = [
  [/שכירות|משכנתא|ארנונה/, 'Home'],
  [/נסיעות/, 'Bus'],
  [/נהיגה|רכב/, 'Car'],
  [/ביגוד/, 'Shirt'],
  [/אוכל|מזון/, 'Utensils'],
  [/בריאות/, 'HeartPulse'],
  [/שמחות|מתנות/, 'Gift'],
  [/ילדים|מטפלת|בייביסיטר|מעונות|קצבת/, 'Baby'],
  [/מוסדות|יעוץ|ייעוץ/, 'GraduationCap'],
  [/קניות/, 'ShoppingCart'],
  [/פילאטיס|כושר/, 'Dumbbell'],
  [/ביטוח/, 'ShieldCheck'],
  [/הלוואה|השקעות/, 'Landmark'],
  [/עבודה|הכנסה/, 'Briefcase'],
  [/חשמל|מים/, 'Zap'],
];
const iconFor = (name) => ICON_BY_NAME.find(([pattern]) => pattern.test(name))?.[1] || 'Tag';

/** Ready-made categories nothing uses: a household's own list takes their place. */
const unusedDefaults = async (userId) => {
  const categories = await categoryRepository.findAllByUser(userId);
  const candidates = categories.filter((c) => c.isDefault && !c.isMaaser && c.name !== FALLBACK_CATEGORY_NAME);
  const inUse = await Promise.all(
    candidates.map(async (c) => {
      const counts = await Promise.all([transactionRepository, budgetRepository, recurringRepository].map((r) => r.countByUser(userId, { category: c.id })));
      return counts.some(Boolean);
    })
  );
  return candidates.filter((_, i) => !inUse[i]);
};

/** What importing a summary sheet would do. Nothing is saved. */
const previewImport = async (userId, file) => {
  let sheet;
  try {
    sheet = statementService.parseSummaryCategories(file.buffer);
  } catch {
    throw ApiError.badRequest('לא מצאנו בקובץ שורת כותרות שמתחילה ב"חודש" ומסתיימת ב"סה״כ"');
  }
  const [categories, removable] = await Promise.all([categoryRepository.findAllByUser(userId), unusedDefaults(userId)]);
  const leaving = new Set(removable.map((c) => c.id));
  const isNew = (name, type) => !categories.some((c) => c.type === type && c.name === name && !leaving.has(c.id));
  return {
    expense: sheet.expense.filter((name) => isNew(name, 'expense')),
    income: sheet.income.filter((name) => isNew(name, 'income')),
    removed: removable.map((c) => c.name),
  };
};

/** Adds the household's categories. The maaser column renames the maaser category, so its history stays. */
const importNames = async (userId, { expense, income }) => {
  const maaserName = expense.find((name) => IS_MAASER.test(name));
  if (maaserName) {
    const maaser = await getMaaserCategory(userId);
    maaser.name = maaserName;
    await maaser.save();
  }

  const removable = await unusedDefaults(userId);
  await Promise.all(removable.map((c) => categoryRepository.deleteByUser(userId, c.id)));

  const existing = await categoryRepository.findAllByUser(userId);
  const wanted = [
    ...expense.map((name) => ({ name, type: 'expense' })),
    ...income.map((name) => ({ name, type: 'income' })),
  ].filter(({ name, type }) => !existing.some((c) => c.type === type && c.name === name));
  const created = await categoryRepository.createMany(
    userId,
    wanted.map((c, i) => ({ ...c, icon: iconFor(c.name), color: PALETTE[i % PALETTE.length] }))
  );
  return { created: created.length, removed: removable.length };
};

module.exports = { list, create, update, remove, assertOwned, getFallback, getMaaserCategory, seedDefaults, previewImport, importNames };
