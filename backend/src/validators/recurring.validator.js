const Joi = require('joi');
const { objectId, money, type, shortText } = require('./common.validator');
const { FREQUENCIES } = require('../config/constants');

const fields = {
  description: shortText(140).min(1).label('תיאור'),
  merchant: shortText(80).allow('').label('בית עסק'),
  type: type().label('סוג'),
  amount: money().label('סכום'),
  category: objectId().label('קטגוריה'),
  account: objectId().allow(null, '').label('כרטיס או חשבון'),
  frequency: Joi.string().valid(...FREQUENCIES).label('תדירות'),
  startDate: Joi.date().iso().label('תאריך החיוב הבא'),
  isActive: Joi.boolean(),
};

const create = Joi.object({
  ...fields,
  description: fields.description.required(),
  type: fields.type.default('expense'),
  amount: fields.amount.required(),
  category: fields.category.required(),
  frequency: fields.frequency.default('monthly'),
  startDate: fields.startDate.required(),
});

const update = Joi.object(fields).min(1);

// The next date the screen showed: if it moved since (the job ran, or a second tap), nothing is recorded
const run = Joi.object({ nextRun: Joi.date().iso() });

module.exports = { create, update, run };
