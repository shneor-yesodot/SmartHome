const mongoose = require('mongoose');

/**
 * Generic data-access layer.
 * Every query is scoped to the owning user - this is the application's
 * row-level security: a user can never read or change another user's documents.
 */
class BaseRepository {
  constructor(model) {
    this.model = model;
  }

  static toObjectId(id) {
    return new mongoose.Types.ObjectId(String(id));
  }

  findAllByUser(userId, filter = {}, { sort, skip, limit, populate, lean } = {}) {
    const query = this.model.find({ ...filter, user: userId });
    if (sort) query.sort(sort);
    if (skip) query.skip(skip);
    if (limit) query.limit(limit);
    if (populate) query.populate(populate);
    if (lean) query.lean();
    return query.exec();
  }

  findOneByUser(userId, id, { populate } = {}) {
    const query = this.model.findOne({ _id: id, user: userId });
    if (populate) query.populate(populate);
    return query.exec();
  }

  findOneWhere(userId, filter) {
    return this.model.findOne({ ...filter, user: userId }).exec();
  }

  countByUser(userId, filter = {}) {
    return this.model.countDocuments({ ...filter, user: userId }).exec();
  }

  create(userId, data) {
    return this.model.create({ ...data, user: userId });
  }

  createMany(userId, items) {
    return this.model.insertMany(items.map((item) => ({ ...item, user: userId })));
  }

  updateByUser(userId, id, data) {
    return this.model
      .findOneAndUpdate({ _id: id, user: userId }, { $set: data }, { new: true, runValidators: true })
      .exec();
  }

  deleteByUser(userId, id) {
    return this.model.findOneAndDelete({ _id: id, user: userId }).exec();
  }

  deleteManyByUser(userId, filter = {}) {
    return this.model.deleteMany({ ...filter, user: userId }).exec();
  }
}

module.exports = BaseRepository;
