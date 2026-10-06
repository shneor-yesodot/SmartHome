import Joi from 'joi';

const email = Joi.string().email().required();
const password = Joi.string().min(8).max(128).required();
const isoDate = Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).messages({
  'string.pattern.base': 'התאריך חייב להיות בפורמט YYYY-MM-DD',
});

export const registerSchema = Joi.object({ email, password });
export const loginSchema = Joi.object({ email, password });
export const otpSchema = Joi.object({
  email,
  otpCode: Joi.string().length(6).required(),
});
export const resendOtpSchema = Joi.object({ email });
export const forgotSchema = Joi.object({ email });
export const resetSchema = Joi.object({
  resetToken: Joi.string().required(),
  newPassword: password,
});

export const transactionSchema = Joi.object({
  type: Joi.string().valid('income', 'expense').required(),
  amount: Joi.number().positive().max(10000000).required(),
  category: Joi.string().max(50).required(),
  description: Joi.string().max(200).allow('').default(''),
  merchant: Joi.string().max(120).allow('').default(''),
  date: isoDate.required(),
  receipt_url: Joi.string().max(300).allow('', null).default(''),
  is_recurring: Joi.boolean().default(false),
  tags: Joi.array().items(Joi.string().max(40)).default([]),
  notes: Joi.string().max(500).allow('').default(''),
});

export const transactionUpdateSchema = transactionSchema.fork(
  ['type', 'amount', 'category', 'date'],
  (s) => s.optional()
);

export const bulkTransactionsSchema = Joi.object({
  items: Joi.array().items(transactionSchema).min(1).max(500).required(),
});

export const categorySchema = Joi.object({
  name: Joi.string().max(50).required(),
  type: Joi.string().valid('income', 'expense').required(),
  icon: Joi.string().max(40).allow('').default(''),
  color: Joi.string().max(20).allow('').default('#16a34a'),
  budget_limit: Joi.number().min(0).optional(),
});

export const categoryUpdateSchema = categorySchema.fork(['name', 'type'], (s) => s.optional());

export const budgetSchema = Joi.object({
  category: Joi.string().max(50).required(),
  amount: Joi.number().min(0).max(10000000).required(),
  period: Joi.string().valid('monthly', 'yearly').default('monthly'),
  start_date: isoDate.allow('').optional(),
});

export const budgetUpdateSchema = budgetSchema.fork(['category', 'amount'], (s) => s.optional());

export const recurringSchema = Joi.object({
  description: Joi.string().max(200).required(),
  amount: Joi.number().positive().max(10000000).required(),
  category: Joi.string().max(50).required(),
  type: Joi.string().valid('income', 'expense').required(),
  frequency: Joi.string().valid('daily', 'weekly', 'monthly', 'yearly').required(),
  next_execution: isoDate.required(),
  is_active: Joi.boolean().default(true),
  last_executed: isoDate.allow('').optional(),
});

export const recurringUpdateSchema = recurringSchema.fork(
  ['description', 'amount', 'category', 'type', 'frequency', 'next_execution'],
  (s) => s.optional()
);

