const Joi = require('joi');
const { type, color, icon } = require('./common.validator');

const create = Joi.object({
  name: Joi.string().trim().min(1).max(40).required().label('שם הקטגוריה'),
  type: type().required().label('סוג'),
  icon: icon(),
  color: color(),
});

// The type of an existing category cannot change (its transactions depend on it)
const update = Joi.object({
  name: Joi.string().trim().min(1).max(40).label('שם הקטגוריה'),
  icon: icon(),
  color: color(),
}).min(1);

const listQuery = Joi.object({ type: type() });

const names = () => Joi.array().items(Joi.string().trim().min(1).max(40)).max(100).default([]);
const importCommit = Joi.object({ expense: names(), income: names() });

module.exports = { create, update, listQuery, importCommit };
