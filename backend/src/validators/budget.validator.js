const Joi = require('joi');
const { objectId, money } = require('./common.validator');

const create = Joi.object({
  category: objectId().required().label('קטגוריה'),
  amount: money().min(1).required().label('סכום התקציב'),
  alertThreshold: Joi.number().integer().min(1).max(100).default(80).label('סף התראה'),
});

const update = Joi.object({
  amount: money().min(1).label('סכום התקציב'),
  alertThreshold: Joi.number().integer().min(1).max(100).label('סף התראה'),
}).min(1);

module.exports = { create, update };
