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

  findUpcoming(userId, until) {
    return this.findAllByUser(
      userId,
      { isActive: true, nextRun: { $lt: until } },
      { sort: { nextRun: 1 }, populate: 'category', lean: true }
    );
  }
}

module.exports = new RecurringRepository();
