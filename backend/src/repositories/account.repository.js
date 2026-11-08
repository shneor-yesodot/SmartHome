const BaseRepository = require('./base.repository');
const { Account } = require('../models');

class AccountRepository extends BaseRepository {
  constructor() {
    super(Account);
  }
}

module.exports = new AccountRepository();
