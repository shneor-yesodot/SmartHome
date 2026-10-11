const { Schema, model } = require('mongoose');
const { baseOptions } = require('./plugins');

const budgetSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    category: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
    amount: { type: Number, required: true, min: 1 }, // monthly limit
    alertThreshold: { type: Number, min: 1, max: 100, default: 80 }, // % that triggers a warning
    // Remembers the last alert that was e-mailed (e.g. "2026-10:exceeded") to avoid duplicates
    lastAlertKey: { type: String, default: '' },
  },
  baseOptions
);

// One monthly budget per category
budgetSchema.index({ user: 1, category: 1 }, { unique: true });

module.exports = model('Budget', budgetSchema);
