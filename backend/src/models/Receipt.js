const { Schema, model } = require('mongoose');
const { baseOptions } = require('./plugins');

const receiptItemSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    quantity: { type: Number, default: 1 },
    unitPrice: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    category: { type: Schema.Types.ObjectId, ref: 'Category' },
  },
  { _id: false }
);

const receiptSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    originalName: { type: String, trim: true },
    fileName: { type: String, required: true }, // random name on disk
    mimeType: { type: String, required: true },
    size: Number,
    merchant: { type: String, trim: true, default: '' },
    purchaseDate: Date,
    total: { type: Number, default: 0 },
    items: { type: [receiptItemSchema], default: [] },
    engine: { type: String, enum: ['gemini', 'demo'], default: 'gemini' },
    status: { type: String, enum: ['scanned', 'confirmed'], default: 'scanned' },
    transactionsCount: { type: Number, default: 0 },
  },
  baseOptions
);

module.exports = model('Receipt', receiptSchema);
