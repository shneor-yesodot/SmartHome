const BaseRepository = require('./base.repository');
const { Category } = require('../models');

class CategoryRepository extends BaseRepository {
  constructor() {
    super(Category);
  }

  findByName(userId, name, type) {
    return this.model.findOne({ user: userId, name, type }).exec();
  }
}

module.exports = new CategoryRepository();
