const Joi = require('joi');
const { TRANSACTION_TYPES } = require('../config/constants');

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

module.exports = { objectId, money, type, color, icon, shortText, idParam, monthQuery };
