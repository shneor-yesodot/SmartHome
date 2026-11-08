const Joi = require('joi');
const { TRANSACTION_TYPES, CALENDARS } = require('../config/constants');

/** Reusable building blocks for the request schemas. */
const objectId = () => Joi.string().hex().length(24);
const money = () => Joi.number().positive().precision(2).max(10000000);
const type = () => Joi.string().valid(...TRANSACTION_TYPES);
const color = () => Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/);
const icon = () => Joi.string().pattern(/^[A-Za-z0-9]+$/).max(40);
const shortText = (max = 140) => Joi.string().trim().max(max);

const idParam = Joi.object({ id: objectId().required() });

const monthQuery = Joi.object({
  year: Joi.number().integer().min(2000).max(2100),
  month: Joi.number().integer().min(0).max(11), // 0-based, like JavaScript dates
}).and('year', 'month');

/** A month in either calendar: any day inside it (`date`) or a Gregorian year + month. */
const periodQuery = Joi.object({
  calendar: Joi.string().valid(...CALENDARS),
  date: Joi.date().iso(),
  year: Joi.number().integer().min(2000).max(2100),
  month: Joi.number().integer().min(0).max(11),
})
  .and('year', 'month')
  .oxor('date', 'year');

/** A list of recent months, for month pickers. */
const periodsQuery = Joi.object({
  calendar: Joi.string().valid(...CALENDARS),
  count: Joi.number().integer().min(1).max(60).default(12),
});

module.exports = { objectId, money, type, color, icon, shortText, idParam, monthQuery, periodQuery, periodsQuery };
