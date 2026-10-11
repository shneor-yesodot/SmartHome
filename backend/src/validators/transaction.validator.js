const Joi = require('joi');
const { objectId, money, type, shortText } = require('./common.validator');
const { TRANSACTION_SOURCES } = require('../config/constants');

const fields = {
  type: type().label('סוג'),
  amount: money().label('סכום'),
  category: objectId().label('קטגוריה'),
  description: shortText(140).min(1).label('תיאור'),
  merchant: shortText(80).allow('').label('בית עסק'),
  date: Joi.date().iso().max('2100-01-01').label('תאריך'),
  notes: shortText(500).allow('').label('הערות'),
  productName: shortText(120).allow('').label('שם מוצר'),
  quantity: Joi.number().positive().max(100000).label('כמות'),
  unitPrice: Joi.number().min(0).precision(2).label('מחיר ליחידה'),
};

const create = Joi.object({
  ...fields,
  type: fields.type.required(),
  amount: fields.amount.required(),
  category: fields.category.required(),
  description: fields.description.required(),
  date: fields.date.required(),
});

const update = Joi.object(fields).min(1);

const listQuery = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  type: type(),
  category: objectId(),
  source: Joi.string().valid(...TRANSACTION_SOURCES),
  from: Joi.date().iso(),
  to: Joi.date().iso(),
  search: Joi.string().trim().max(60),
});

// Rows coming from the Excel preview screen
const bulkCreate = Joi.object({
  rows: Joi.array()
    .items(
      Joi.object({
        type: type().required(),
        amount: money().required(),
        category: objectId().allow(null),
        description: shortText(140).min(1).required(),
        merchant: shortText(80).allow(''),
        date: Joi.date().iso().required(),
        productName: shortText(120).allow(''),
        quantity: Joi.number().positive(),
      })
    )
    .min(1)
    .max(1000)
    .required()
    .label('שורות'),
});

module.exports = { create, update, listQuery, bulkCreate };
