const rateLimit = require('express-rate-limit');
const env = require('../config/env');

const build = ({ windowMinutes, max, message }) =>
  rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => env.isTest,
    message: { success: false, message },
  });

// General protection for the whole API
const apiLimiter = build({ windowMinutes: 15, max: 600, message: 'יותר מדי בקשות. נסו שוב בעוד כמה דקות' });

// Brute-force protection for login / register
const authLimiter = build({ windowMinutes: 15, max: 20, message: 'יותר מדי ניסיונות התחברות. נסו שוב בעוד רבע שעה' });

// Calls that reach the paid external AI API
const aiLimiter = build({ windowMinutes: 60, max: 40, message: 'הגעתם למכסת השימוש השעתית בשירותי ה-AI' });

module.exports = { apiLimiter, authLimiter, aiLimiter };
