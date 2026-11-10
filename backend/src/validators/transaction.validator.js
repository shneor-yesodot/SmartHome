const Joi = require('joi');
const { objectId, money, type, shortText } = require('./common.validator');
const { TRANSACTION_SOURCES } = require('../config/constants');

const fields = {
  type: type().label('סוג'),
  amount: money().label('סכום'),
  category: objectId().label('קטגוריה'),
  description: shortText(140).allow('').label('תיאור'),
  merchant: shortText(80).allow('').label('בית עסק'),
  date: Joi.date().iso().max('2100-01-01').label('תאריך'),
  notes: shortText(500).allow('').label('הערות'),
  productName: shortText(120).allow('').label('שם מוצר'),
  quantity: Joi.number().positive().max(100000).label('כמות'),
  unitPrice: Joi.number().min(0).precision(2).label('מחיר ליחידה'),
  account: objectId().allow(null, '').label('כרטיס או חשבון'),
  chargeDate: Joi.date().iso().max('2100-01-01').allow(null).label('תאריך חיוב'),
};

const create = Joi.object({
  ...fields,
  type: fields.type.required(),
  amount: fields.amount.required(),
  category: fields.category.required(),
  date: fields.date.required(),
});

const update = Joi.object(fields).min(1);

const listQuery = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  type: type(),
  category: objectId(),
  account: objectId(),
  chargeDate: Joi.date().iso(),
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
        description: shortText(140).allow(''),
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

const purchaseItem = Joi.object({
  name: shortText(120).allow('').default('').label('שם המוצר'),
  quantity: fields.quantity.default(1),
  total: money().required().label('סכום'),
  category: objectId().allow(null).label('קטגוריה'),
});

// One purchase split into products (e.g. a grocery run) - every item becomes a transaction
const basket = Joi.object({
  merchant: fields.merchant.default(''),
  date: fields.date.required(),
  notes: fields.notes,
  account: fields.account,
  // An imported statement line these items replace, instead of counting the money again
  payment: objectId().allow(null),
  items: Joi.array().items(purchaseItem).min(1).max(200).required().label('מוצרים'),
});

// An existing transaction, usually a statement line, broken into the items it was made of
const split = Joi.object({
  items: Joi.array().items(purchaseItem).min(2).max(200).required().label('מוצרים'),
});

// A purchase about to be saved: which imported statement lines it may be
const paymentQuery = Joi.object({
  date: fields.date.required(),
  total: money().required(),
  merchant: shortText(80).allow(''),
});

module.exports = { create, update, listQuery, bulkCreate, basket, split, paymentQuery };
