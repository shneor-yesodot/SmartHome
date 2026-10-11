const Joi = require('joi');

const listQuery = Joi.object({
  search: Joi.string().trim().max(60),
  sort: Joi.string().valid('recent', 'spent', 'purchases', 'name').default('recent'),
});

const detailQuery = Joi.object({
  key: Joi.string().trim().min(1).max(140).required(),
});

module.exports = { listQuery, detailQuery };
