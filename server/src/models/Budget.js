import mongoose from 'mongoose';

const budgetSchema = new mongoose.Schema(
  {
    created_by_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    category: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
    period: { type: String, enum: ['monthly', 'yearly'], default: 'monthly' },
    start_date: { type: String },
  },
  { timestamps: { createdAt: 'created_date', updatedAt: 'updated_date' } }
);

budgetSchema.index({ created_by_id: 1, category: 1 }, { unique: true });

export const Budget = mongoose.model('Budget', budgetSchema);
