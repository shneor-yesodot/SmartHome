const Joi = require('joi');
const { money, shortText } = require('./common.validator');
const { MAASER_MODES } = require('../config/constants');

const settings = Joi.object({
  mode: Joi.string().valid(...MAASER_MODES),
  percent: Joi.number().min(1).max(100).precision(2),
  amount: Joi.number().min(0).max(10000000).precision(2),
  startDate: Joi.date().iso(),
}).min(1);

const donation = Joi.object({
  recipient: shortText(80).min(1).required().label('למי ניתן'),
  amount: money().required().label('סכום'),
  date: Joi.date().iso().required().label('תאריך'),
  notes: shortText(500).allow(''),
});

module.exports = { settings, donation };
