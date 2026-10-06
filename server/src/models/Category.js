import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema(
  {
    created_by_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true },
    type: { type: String, enum: ['income', 'expense'], required: true },
    icon: { type: String, default: '' },
    color: { type: String, default: '#16a34a' },
    budget_limit: { type: Number },
  },
  { timestamps: { createdAt: 'created_date', updatedAt: 'updated_date' } }
);

categorySchema.index({ created_by_id: 1, name: 1 }, { unique: true });

export const Category = mongoose.model('Category', categorySchema);
