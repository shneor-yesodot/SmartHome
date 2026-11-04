const Joi = require('joi');
const { color, shortText } = require('./common.validator');
const { ACCOUNT_KINDS } = require('../config/constants');

const fields = {
  name: shortText(60).min(1).label('שם'),
  kind: Joi.string().valid(...ACCOUNT_KINDS).label('סוג'),
  last4: Joi.string().pattern(/^\d{4}$/).allow('', null).label('4 ספרות אחרונות').messages({
    'string.pattern.base': 'יש להזין בדיוק 4 ספרות אחרונות, לא מספר כרטיס מלא',
  }),
  issuer: shortText(40).allow('').label('חברת האשראי'),
  billingDay: Joi.number().integer().min(1).max(31).allow(null).label('יום חיוב'),
  color: color().label('צבע'),
  isActive: Joi.boolean(),
};

const create = Joi.object({ ...fields, name: fields.name.required(), kind: fields.kind.default('credit') });
const update = Joi.object(fields).min(1);

module.exports = { create, update };
