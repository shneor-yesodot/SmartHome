import express from 'express';
import { Category } from '../models/Category.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { crudRouter } from './crud.js';
import { categorySchema, categoryUpdateSchema } from '../utils/schemas.js';

const router = express.Router();
router.use(requireAuth);
router.use(
  '/',
  (req, res, next) => {
    if (req.method === 'POST' && req.path === '/') return validate(categorySchema)(req, res, next);
    if (req.method === 'PUT') return validate(categoryUpdateSchema, { partial: true })(req, res, next);
    next();
  },
  crudRouter(Category)
);

export default router;
