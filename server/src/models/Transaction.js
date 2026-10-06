import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema(
  {
    created_by_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: ['income', 'expense'], required: true },
    amount: { type: Number, required: true, min: 0.01 },
    category: { type: String, required: true },
    description: { type: String, default: '' },
    merchant: { type: String, default: '' },
    date: { type: String, required: true },
    receipt_url: { type: String, default: '' },
    is_recurring: { type: Boolean, default: false },
    tags: { type: [String], default: [] },
    notes: { type: String, default: '' },
  },
  { timestamps: { createdAt: 'created_date', updatedAt: 'updated_date' } }
);

transactionSchema.index({ created_by_id: 1, date: -1 });
transactionSchema.index({ created_by_id: 1, category: 1, type: 1 });

export const Transaction = mongoose.model('Transaction', transactionSchema);
