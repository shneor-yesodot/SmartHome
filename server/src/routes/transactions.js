import express from 'express';
import { Transaction } from '../models/Transaction.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { ownerFilter, stampOwner } from '../middleware/rls.js';
import { crudRouter } from './crud.js';
import { serializeMany } from '../utils/serialize.js';
import { transactionSchema, transactionUpdateSchema, bulkTransactionsSchema } from '../utils/schemas.js';
import { checkBudgetAlerts } from '../services/budgetAlerts.js';

const router = express.Router();
router.use(requireAuth);

router.post('/bulk', validate(bulkTransactionsSchema), async (req, res, next) => {
  try {
    const docs = await Transaction.insertMany(req.body.items.map((item) => stampOwner(req, item)));
    await checkBudgetAlerts(req, docs);
    res.status(201).json({ status: 'success', data: serializeMany(docs) });
  } catch (err) {
    next(err);
  }
});

router.use(
  '/',
  (req, res, next) => {
    if (req.method === 'POST' && req.path === '/') return validate(transactionSchema)(req, res, next);
    if (req.method === 'PUT') return validate(transactionUpdateSchema, { partial: true })(req, res, next);
    next();
  },
  crudRouter(Transaction, {
    afterCreate: (req, doc) => checkBudgetAlerts(req, [doc]),
    afterUpdate: (req, doc) => checkBudgetAlerts(req, [doc]),
  })
);

export default router;
