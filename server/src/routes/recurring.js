import express from 'express';
import { RecurringPayment } from '../models/RecurringPayment.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { crudRouter } from './crud.js';
import { recurringSchema, recurringUpdateSchema } from '../utils/schemas.js';

const router = express.Router();
router.use(requireAuth);
router.use(
  '/',
  (req, res, next) => {
    if (req.method === 'POST' && req.path === '/') return validate(recurringSchema)(req, res, next);
    if (req.method === 'PUT') return validate(recurringUpdateSchema, { partial: true })(req, res, next);
    next();
  },
  crudRouter(RecurringPayment)
);

export default router;
