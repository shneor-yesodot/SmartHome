const { Schema, model } = require('mongoose');
const { TRANSACTION_TYPES, TRANSACTION_SOURCES } = require('../config/constants');
const { baseOptions } = require('./plugins');

const transactionSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: TRANSACTION_TYPES, required: true },
    amount: { type: Number, required: true, min: 0.01 },
    category: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
    description: { type: String, required: true, trim: true, maxlength: 140 },
    merchant: { type: String, trim: true, maxlength: 80, default: '' },
    date: { type: Date, required: true },
    notes: { type: String, trim: true, maxlength: 500, default: '' },

    // Product details - filled for itemised receipt lines (enables the price catalogue)
    productName: { type: String, trim: true, maxlength: 120 },
    productKey: { type: String },
    quantity: { type: Number, min: 0.001, default: 1 },
    unitPrice: { type: Number, min: 0 },

    // Where the transaction came from
    source: { type: String, enum: TRANSACTION_SOURCES, default: 'manual' },
    receipt: { type: Schema.Types.ObjectId, ref: 'Receipt' },
    recurring: { type: Schema.Types.ObjectId, ref: 'RecurringPayment' },
  },
  baseOptions
);

transactionSchema.index({ user: 1, date: -1 });
transactionSchema.index({ user: 1, category: 1, date: -1 });
transactionSchema.index({ user: 1, productKey: 1 });

module.exports = model('Transaction', transactionSchema);
