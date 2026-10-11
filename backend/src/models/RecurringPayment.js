const { Schema, model } = require('mongoose');
const { TRANSACTION_TYPES, FREQUENCIES } = require('../config/constants');
const { baseOptions } = require('./plugins');

const recurringPaymentSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    description: { type: String, required: true, trim: true, maxlength: 140 },
    merchant: { type: String, trim: true, maxlength: 80, default: '' },
    type: { type: String, enum: TRANSACTION_TYPES, default: 'expense' },
    amount: { type: Number, required: true, min: 0.01 },
    category: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
    frequency: { type: String, enum: FREQUENCIES, default: 'monthly' },
    nextRun: { type: Date, required: true },
    lastRun: Date,
    isActive: { type: Boolean, default: true },
  },
  baseOptions
);

// Used by the daily job to find payments that are due
recurringPaymentSchema.index({ isActive: 1, nextRun: 1 });

module.exports = model('RecurringPayment', recurringPaymentSchema);
