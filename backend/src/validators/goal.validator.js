const Joi = require('joi');
const { money, color, icon, shortText } = require('./common.validator');

const create = Joi.object({
  name: shortText(60).min(1).required().label('שם היעד'),
  targetAmount: money().min(1).required().label('סכום היעד'),
  initialAmount: Joi.number().min(0).precision(2).default(0).label('סכום פתיחה'),
  targetDate: Joi.date().iso().greater('now').required().label('תאריך היעד').messages({
    'date.greater': 'תאריך היעד חייב להיות בעתיד',
  }),
  icon: icon(),
  color: color(),
});

const update = Joi.object({
  name: shortText(60).min(1).label('שם היעד'),
  targetAmount: money().min(1).label('סכום היעד'),
  targetDate: Joi.date().iso().label('תאריך היעד'),
  icon: icon(),
  color: color(),
}).min(1);

const deposit = Joi.object({
  amount: Joi.number().precision(2).invalid(0).min(-10000000).max(10000000).required().label('סכום'),
  note: shortText(140).allow('').default(''),
});

module.exports = { create, update, deposit };
