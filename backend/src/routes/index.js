const { Router } = require('express');
const { authenticate } = require('../middleware/auth');

const router = Router();

// Public
router.use('/auth', require('./auth.routes'));

// Everything below requires a logged-in user
router.use(authenticate);
router.use('/dashboard', require('./dashboard.routes'));
router.use('/transactions', require('./transaction.routes'));
router.use('/categories', require('./category.routes'));
router.use('/budgets', require('./budget.routes'));
router.use('/goals', require('./goal.routes'));
router.use('/recurring', require('./recurring.routes'));
router.use('/products', require('./product.routes'));
router.use('/receipts', require('./receipt.routes'));
router.use('/reports', require('./report.routes'));

module.exports = router;
