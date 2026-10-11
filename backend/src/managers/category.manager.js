const categoryRepository = require('../repositories/category.repository');
const transactionRepository = require('../repositories/transaction.repository');
const budgetRepository = require('../repositories/budget.repository');
const ApiError = require('../utils/ApiError');
const { FALLBACK_CATEGORY_NAME } = require('../config/constants');
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

module.exports = { list, create, update, remove, assertOwned, getFallback, seedDefaults };
