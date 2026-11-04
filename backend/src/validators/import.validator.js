const Joi = require('joi');
const { objectId, money, type, shortText } = require('./common.validator');

const commit = Joi.object({
  account: objectId().allow(null, ''),
  rows: Joi.array()
    .items(
      Joi.object({
        type: type().required(),
        amount: money().required(),
        category: objectId().allow(null),
        account: objectId().allow(null),
        description: shortText(140).min(1).required(),
        date: Joi.date().iso().required(),
        chargeDate: Joi.date().iso().allow(null),
        notes: shortText(500).allow(''),
        last4: Joi.string().pattern(/^\d{4}$/).allow(''),
        isRefund: Joi.boolean(),
        standing: Joi.boolean(),
        importHash: Joi.string().hex().length(64).required(),
        purchase: objectId().allow(null),
      })
    )
    .min(1)
    .max(2000)
    .required()
    .label('שורות'),
});

module.exports = { commit };
