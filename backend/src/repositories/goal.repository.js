const BaseRepository = require('./base.repository');
const { SavingsGoal } = require('../models');

class GoalRepository extends BaseRepository {
  constructor() {
    super(SavingsGoal);
  }
}

module.exports = new GoalRepository();
