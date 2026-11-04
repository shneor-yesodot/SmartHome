const { Schema, model } = require('mongoose');
const { ACCOUNT_KINDS } = require('../config/constants');
const { baseOptions } = require('./plugins');

/** Where money moves through: a checking account, a credit card or cash. */
const accountSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    kind: { type: String, enum: ACCOUNT_KINDS, default: 'credit' },
    // Only the last four digits are ever stored, never a full card number
    last4: { type: String, match: /^\d{4}$/ },
    issuer: { type: String, trim: true, maxlength: 40, default: '' },
    // Day of the month the card is charged to the bank account
    billingDay: { type: Number, min: 1, max: 31 },
    color: { type: String, default: '#2F7FD1' },
    isActive: { type: Boolean, default: true },
  },
  baseOptions
);

module.exports = model('Account', accountSchema);
