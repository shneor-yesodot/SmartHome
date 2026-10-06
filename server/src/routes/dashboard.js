import express from 'express';
import { Transaction } from '../models/Transaction.js';
import { Budget } from '../models/Budget.js';
import { requireAuth } from '../middleware/auth.js';
import { ownerFilter } from '../middleware/rls.js';
import { serializeMany } from '../utils/serialize.js';

const router = express.Router();
router.use(requireAuth);

function monthName(d) {
  return d.toLocaleDateString('he-IL', { month: 'short' });
}

function isSameMonth(dateStr, ref = new Date()) {
  const d = new Date(dateStr);
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth();
}

router.get('/summary', async (req, res, next) => {
  try {
    const txns = await Transaction.find(ownerFilter(req)).sort({ date: -1 }).limit(300);
    const monthTxns = txns.filter((t) => isSameMonth(t.date));
    const income = monthTxns.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expense = monthTxns.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    res.json({
      status: 'success',
      data: { income, expense, balance: income - expense, count: monthTxns.length },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/charts/monthly', async (req, res, next) => {
  try {
    const txns = await Transaction.find(ownerFilter(req)).limit(1000);
    const now = new Date();
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        key: `${d.getFullYear()}-${d.getMonth()}`,
        month: monthName(d),
        income: 0,
        expense: 0,
      });
    }
    txns.forEach((t) => {
      const d = new Date(t.date);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const m = months.find((x) => x.key === key);
      if (m) m[t.type] = (m[t.type] || 0) + (t.amount || 0);
    });
    res.json({ status: 'success', data: months });
  } catch (err) {
    next(err);
  }
});

router.get('/charts/categories', async (req, res, next) => {
  try {
    const txns = await Transaction.find({ ...ownerFilter(req), type: 'expense' }).limit(1000);
    const map = {};
    txns
      .filter((t) => isSameMonth(t.date))
      .forEach((t) => {
        map[t.category] = (map[t.category] || 0) + (t.amount || 0);
      });
    const data = Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
    res.json({ status: 'success', data });
  } catch (err) {
    next(err);
  }
});

router.get('/overview', async (req, res, next) => {
  try {
    const [transactions, budgets] = await Promise.all([
      Transaction.find(ownerFilter(req)).sort({ date: -1 }).limit(300),
      Budget.find(ownerFilter(req)),
    ]);
    res.json({
      status: 'success',
      data: { transactions: serializeMany(transactions), budgets: serializeMany(budgets) },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
