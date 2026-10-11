const Joi = require('joi');
const { objectId, money, shortText } = require('./common.validator');

const confirm = Joi.object({
  merchant: shortText(80).allow('').default('').label('בית עסק'),
  date: Joi.date().iso().required().label('תאריך הקנייה'),
  items: Joi.array()
    .items(
      Joi.object({
        name: shortText(120).min(1).required().label('שם המוצר'),
        quantity: Joi.number().positive().max(100000).default(1).label('כמות'),
        total: money().required().label('סכום'),
        category: objectId().allow(null).label('קטגוריה'),
      })
    )
    .min(1)
    .max(200)
    .required()
    .label('מוצרים'),
});

module.exports = { confirm };
