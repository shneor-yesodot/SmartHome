const Joi = require('joi');

const password = () =>
  Joi.string()
    .min(8)
    .max(72) // bcrypt ignores anything beyond 72 bytes
    .pattern(/[A-Za-z]/, 'letter')
    .pattern(/\d/, 'digit')
    .messages({ 'string.pattern.name': 'הסיסמה חייבת לכלול לפחות אות אחת באנגלית וספרה אחת' });

const register = Joi.object({
  name: Joi.string().trim().min(2).max(60).required().label('שם מלא'),
  email: Joi.string().trim().lowercase().email().max(120).required().label('אימייל'),
  password: password().required().label('סיסמה'),
});

const login = Joi.object({
  email: Joi.string().trim().lowercase().email().required().label('אימייל'),
  password: Joi.string().max(72).required().label('סיסמה'),
});

const updateProfile = Joi.object({
  name: Joi.string().trim().min(2).max(60).label('שם מלא'),
  notifications: Joi.object({ budgetAlerts: Joi.boolean(), monthlySummary: Joi.boolean() }),
}).min(1);

const changePassword = Joi.object({
  currentPassword: Joi.string().max(72).required().label('סיסמה נוכחית'),
  newPassword: password().required().invalid(Joi.ref('currentPassword')).label('סיסמה חדשה').messages({
    'any.invalid': 'הסיסמה החדשה חייבת להיות שונה מהנוכחית',
  }),
});

const email = () => Joi.string().trim().lowercase().email().max(120).required().label('אימייל');

const verifyEmail = Joi.object({
  email: email(),
  code: Joi.string().trim().pattern(/^\d{6}$/).required().label('קוד אימות').messages({
    'string.pattern.base': 'קוד האימות מורכב מ-6 ספרות',
  }),
});

const emailOnly = Joi.object({ email: email() });

const resetPassword = Joi.object({
  token: Joi.string().hex().length(64).required().label('קישור איפוס'),
  password: password().required().label('סיסמה חדשה'),
});

const refreshToken = Joi.object({ refreshToken: Joi.string().max(2000).required().label('טוקן רענון') });

module.exports = { register, login, updateProfile, changePassword, verifyEmail, emailOnly, resetPassword, refreshToken };
