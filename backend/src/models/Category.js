const { Schema, model } = require('mongoose');
const { TRANSACTION_TYPES } = require('../config/constants');
const { baseOptions } = require('./plugins');

const categorySchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 40 },
    type: { type: String, enum: TRANSACTION_TYPES, required: true },
    icon: { type: String, default: 'Tag' }, // lucide-react icon name
    color: { type: String, default: '#12A05C', match: /^#[0-9A-Fa-f]{6}$/ },
    isDefault: { type: Boolean, default: false },
  },
  baseOptions
);

// A user cannot have two categories with the same name and type
categorySchema.index({ user: 1, name: 1, type: 1 }, { unique: true });

module.exports = model('Category', categorySchema);
