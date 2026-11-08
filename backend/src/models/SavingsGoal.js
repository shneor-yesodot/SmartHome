const { Schema, model } = require('mongoose');
const { baseOptions } = require('./plugins');

const depositSchema = new Schema(
  {
    amount: { type: Number, required: true },
    note: { type: String, trim: true, maxlength: 140, default: '' },
    date: { type: Date, default: Date.now },
  },
  { _id: false }
);

const savingsGoalSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    targetAmount: { type: Number, required: true, min: 1 },
    currentAmount: { type: Number, default: 0, min: 0 },
    targetDate: { type: Date, required: true },
    icon: { type: String, default: 'Coins' },
    color: { type: String, default: '#12A05C', match: /^#[0-9A-Fa-f]{6}$/ },
    deposits: { type: [depositSchema], default: [] },
  },
  baseOptions
);

module.exports = model('SavingsGoal', savingsGoalSchema);
