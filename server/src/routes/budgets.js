import express from 'express';
import { Budget } from '../models/Budget.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { crudRouter } from './crud.js';
import { budgetSchema, budgetUpdateSchema } from '../utils/schemas.js';

const router = express.Router();
router.use(requireAuth);
router.use(
  '/',
  (req, res, next) => {
    if (req.method === 'POST' && req.path === '/') return validate(budgetSchema)(req, res, next);
    if (req.method === 'PUT') return validate(budgetUpdateSchema, { partial: true })(req, res, next);
    next();
  },
  crudRouter(Budget)
);

export default router;
