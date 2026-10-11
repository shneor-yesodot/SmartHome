const BaseRepository = require('./base.repository');
const { Budget } = require('../models');

class BudgetRepository extends BaseRepository {
  constructor() {
    super(Budget);
  }

  findByCategory(userId, categoryId) {
    return this.model.findOne({ user: userId, category: categoryId }).populate('category').exec();
  }
}

module.exports = new BudgetRepository();
