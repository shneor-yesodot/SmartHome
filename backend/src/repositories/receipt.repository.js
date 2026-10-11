const BaseRepository = require('./base.repository');
const { Receipt } = require('../models');

class ReceiptRepository extends BaseRepository {
  constructor() {
    super(Receipt);
  }
}

module.exports = new ReceiptRepository();
