import mongoose from 'mongoose';

const recurringSchema = new mongoose.Schema(
  {
    created_by_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    description: { type: String, required: true },
    amount: { type: Number, required: true, min: 0.01 },
    category: { type: String, required: true },
    type: { type: String, enum: ['income', 'expense'], required: true },
    frequency: { type: String, enum: ['daily', 'weekly', 'monthly', 'yearly'], required: true },
    next_execution: { type: String, required: true },
    is_active: { type: Boolean, default: true },
    last_executed: { type: String },
  },
  { timestamps: { createdAt: 'created_date', updatedAt: 'updated_date' } }
);

recurringSchema.index({ created_by_id: 1, next_execution: 1 });

export const RecurringPayment = mongoose.model('RecurringPayment', recurringSchema);
