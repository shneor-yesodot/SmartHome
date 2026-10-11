const { Router } = require('express');
const controller = require('../controllers/auth.controller');
const schema = require('../validators/auth.validator');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');

const router = Router();

// What the login screen should offer (Google button, e-mail verification)
router.get('/config', controller.config);

router.post('/register', authLimiter, validate(schema.register), controller.register);
router.post('/login', authLimiter, validate(schema.login), controller.login);
router.post('/verify-email', authLimiter, validate(schema.verifyEmail), controller.verifyEmail);
router.post('/resend-code', authLimiter, validate(schema.emailOnly), controller.resendCode);
router.post('/forgot-password', authLimiter, validate(schema.emailOnly), controller.forgotPassword);
router.post('/reset-password', authLimiter, validate(schema.resetPassword), controller.resetPassword);
router.post('/refresh', validate(schema.refreshToken), controller.refresh);
router.post('/logout', validate(schema.refreshToken), controller.logout);

router.get('/google', authLimiter, controller.googleStart);
router.get('/google/callback', controller.googleCallback);

router.get('/me', authenticate, controller.me);
router.patch('/me', authenticate, validate(schema.updateProfile), controller.updateProfile);
router.put('/password', authenticate, authLimiter, validate(schema.changePassword), controller.changePassword);

module.exports = router;
