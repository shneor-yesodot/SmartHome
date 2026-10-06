import express from 'express';
import { Transaction } from '../models/Transaction.js';
import { requireAuth } from '../middleware/auth.js';
import { ownerFilter } from '../middleware/rls.js';

const router = express.Router();
router.use(requireAuth);

router.get('/monthly/:year/:month', async (req, res, next) => {
  try {
    const year = Number(req.params.year);
    const month = Number(req.params.month);
    if (!year || month < 1 || month > 12) {
      return res.status(400).json({
        status: 'error',
        error: { code: 'VALIDATION_ERROR', message: 'חודש או שנה לא תקינים' },
      });
    }

    const txns = await Transaction.find(ownerFilter(req)).limit(2000);
    const monthTxns = txns.filter((t) => {
      const d = new Date(t.date);
      return d.getFullYear() === year && d.getMonth() === month - 1;
    });
    const income = monthTxns.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expense = monthTxns.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const savings = income - expense;
    const savingsRate = income > 0 ? Math.round((savings / income) * 100) : 0;

    const categories = {};
    monthTxns
      .filter((t) => t.type === 'expense')
      .forEach((t) => {
        categories[t.category] = (categories[t.category] || 0) + t.amount;
      });

    res.json({
      status: 'success',
      data: {
        year,
        month,
        income,
        expense,
        savings,
        savingsRate,
        categories,
        count: monthTxns.length,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
