const BaseRepository = require('./base.repository');
const { Transaction } = require('../models');

class TransactionRepository extends BaseRepository {
  constructor() {
    super(Transaction);
  }

  /** All transactions in [from, to) - used by the dashboard and reports. */
  findInRange(userId, from, to, { filter = {}, populate } = {}) {
    return this.findAllByUser(
      userId,
      { ...filter, date: { $gte: from, $lt: to } },
      { sort: { date: 1 }, populate, lean: true }
    );
  }

  /** Expense/income total per category, optionally limited to a date range. */
  sumByCategory(userId, { from, to, type = 'expense' } = {}) {
    const match = { user: BaseRepository.toObjectId(userId), type };
    if (from && to) match.date = { $gte: from, $lt: to };
    return this.model
      .aggregate([{ $match: match }, { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 } } }])
      .exec();
  }

  /** Total per transaction type for any filter (already scoped to the user). */
  async sumByType(userId, filter = {}) {
    const rows = await this.model
      .aggregate([
        { $match: { ...filter, user: BaseRepository.toObjectId(userId) } },
        { $group: { _id: '$type', total: { $sum: '$amount' } } },
      ])
      .exec();
    const totals = { income: 0, expense: 0 };
    rows.forEach((row) => {
      totals[row._id] = row.total;
    });
    return totals;
  }

  /** Itemised purchases (transactions that carry product details). */
  findProductPurchases(userId, productKey) {
    const filter = { type: 'expense', productKey: productKey || { $exists: true, $ne: null } };
    return this.findAllByUser(userId, filter, { sort: { date: 1 }, populate: 'category', lean: true });
  }
}

module.exports = new TransactionRepository();
