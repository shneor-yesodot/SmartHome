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

  /**
   * Inserts what it can: a line whose import fingerprint already exists is skipped,
   * not an error. Returns the documents that were actually added.
   */
  async createManySkippingDuplicates(userId, items) {
    const known = await this.existingImportHashes(userId, items.map((item) => item.importHash));
    const docs = items.filter((item) => !known.has(item.importHash)).map((item) => ({ ...item, user: userId }));
    if (!docs.length) return [];
    try {
      return await this.model.insertMany(docs, { ordered: false });
    } catch (err) {
      // Two imports at the same moment: the unique index stops the second copy
      const writeErrors = [].concat(err.writeErrors || []);
      const onlyDuplicates = err.code === 11000 || (writeErrors.length > 0 && writeErrors.every((e) => e.code === 11000));
      if (!onlyDuplicates) throw err;
      return err.insertedDocs || [];
    }
  }

  /** Which of these import fingerprints the user already has. */
  async existingImportHashes(userId, hashes) {
    const rows = await this.model.find({ user: userId, importHash: { $in: hashes } }).select('+importHash').lean();
    return new Set(rows.map((r) => r.importHash));
  }

  /** Which of these sheet rows were already created in the app. */
  async existingSheetKeys(userId, keys) {
    const rows = await this.model.find({ user: userId, sheetKey: { $in: keys } }).select('+sheetKey').lean();
    return new Set(rows.map((r) => r.sheetKey));
  }

  /** Items of purchases dated in [from, to), with their import fingerprints. */
  findPurchaseItems(userId, from, to) {
    return this.model
      .find({ user: userId, type: 'expense', purchase: { $type: 'objectId' }, date: { $gte: from, $lt: to } })
      .select('+importHash')
      .lean();
  }

  /** All the items of one purchase, oldest first, with their import fingerprints. */
  findPurchase(userId, purchase) {
    return this.model.find({ user: userId, purchase }).sort({ createdAt: 1, _id: 1 }).select('+importHash');
  }

  /** Imported expense lines in [from, to) that are not broken into items yet. */
  findPaymentCandidates(userId, from, to) {
    return this.model
      .find({
        user: userId,
        type: 'expense',
        importHash: { $type: 'string' },
        purchase: { $exists: false },
        date: { $gte: from, $lt: to },
      })
      .populate('account')
      .lean();
  }

  /** The statement line that paid for a purchase: its card reaches every item, its fingerprint one. */
  async linkPurchase(userId, purchase, firstItemId, { account, chargeDate, importHash }) {
    const payment = account ? { account, ...(chargeDate ? { chargeDate } : {}) } : {};
    if (Object.keys(payment).length) await this.model.updateMany({ user: userId, purchase }, { $set: payment });
    await this.model.updateOne({ _id: firstItemId, user: userId }, { $set: { importHash } });
  }

  /** Total charged per charge date of one card, newest first. */
  chargesOfAccount(userId, accountId, limit = 12) {
    return this.model
      .aggregate([
        { $match: { user: BaseRepository.toObjectId(userId), account: BaseRepository.toObjectId(accountId), chargeDate: { $ne: null } } },
        {
          $group: {
            _id: '$chargeDate',
            total: { $sum: { $cond: [{ $eq: ['$type', 'expense'] }, '$amount', { $multiply: ['$amount', -1] }] } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: -1 } },
        { $limit: limit },
      ])
      .exec();
  }

  /** Itemised purchases (transactions that carry product details). */
  findProductPurchases(userId, productKey) {
    const filter = { type: 'expense', productKey: productKey || { $exists: true, $ne: null } };
    return this.findAllByUser(userId, filter, { sort: { date: 1 }, populate: 'category', lean: true });
  }
}

module.exports = new TransactionRepository();
