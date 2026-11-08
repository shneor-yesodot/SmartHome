const BaseRepository = require('./base.repository');
const { Receipt } = require('../models');

class ReceiptRepository extends BaseRepository {
  constructor() {
    super(Receipt);
  }

  /** Marks a scanned receipt confirmed, only if no one did it first. True when this call won. */
  async claim(userId, id) {
    const result = await this.model.updateOne({ _id: id, user: userId, status: 'scanned' }, { $set: { status: 'confirmed' } });
    return result.modifiedCount === 1;
  }

  /** Back to scanned, when saving its transactions failed. */
  release(userId, id) {
    return this.model.updateOne({ _id: id, user: userId }, { $set: { status: 'scanned' } });
  }
}

module.exports = new ReceiptRepository();
