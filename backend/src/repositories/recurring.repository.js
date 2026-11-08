const BaseRepository = require('./base.repository');
const { RecurringPayment } = require('../models');

class RecurringRepository extends BaseRepository {
  constructor() {
    super(RecurringPayment);
  }

  /** Active payments of ALL users that are due - used only by the scheduled job. */
  findDue(now = new Date()) {
    return this.model.find({ isActive: true, nextRun: { $lte: now } }).exec();
  }

  /**
   * Takes one occurrence: moves the schedule from `from` to `next` only if nobody moved
   * it first, so the job and the "run now" button never record the same occurrence twice.
   */
  claimRun(id, from, next, lastRun) {
    return this.model.findOneAndUpdate({ _id: id, nextRun: from }, { $set: { nextRun: next, lastRun } }, { new: true }).exec();
  }

  /** Gives a claimed occurrence back when recording it failed. */
  releaseRun(id, next, from, lastRun) {
    return this.model.updateOne({ _id: id, nextRun: next }, { $set: { nextRun: from, lastRun } }).exec();
  }

  findUpcoming(userId, until) {
    return this.findAllByUser(
      userId,
      { isActive: true, nextRun: { $lt: until } },
      { sort: { nextRun: 1 }, populate: 'category', lean: true }
    );
  }
}

module.exports = new RecurringRepository();
