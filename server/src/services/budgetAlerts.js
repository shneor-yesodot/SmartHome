import { Budget } from '../models/Budget.js';
import { Transaction } from '../models/Transaction.js';
import { sendMail } from './email.js';
import { ownerFilter } from '../middleware/rls.js';

function monthPrefix(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

const ils = new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS' });

function alertEmail(category, budget, spent) {
  const cell = 'padding:8px;border:1px solid #e5e7eb';
  const row = (label, value, color = '') =>
    `<tr><td style="${cell};${color}">${label}</td><td style="${cell};text-align:left;${color}"><strong>${ils.format(value)}</strong></td></tr>`;
  const name = escapeHtml(category);
  return {
    subject: `התראת חריגת תקציב — ${category}`,
    html: [
      '<div dir="rtl" style="font-family:Heebo,Arial,sans-serif;max-width:500px;margin:auto">',
      '<h2 style="color:#16a34a">התראת חריגת תקציב</h2>',
      `<p>חרגת מהתקציב שהגדרת לקטגוריה <strong>${name}</strong> בחודש הנוכחי.</p>`,
      '<table style="width:100%;border-collapse:collapse;margin:16px 0">',
      row('תקציב', budget),
      row('הוצאות בפועל', spent),
      row('חריגה', spent - budget, 'color:#dc2626'),
      '</table>',
      '<p style="color:#6b7280;font-size:14px">התראה אוטומטית ממערכת SmartHome</p>',
      '</div>',
    ].join(''),
  };
}

/**
 * Emails the user if this month's expenses in any of the touched categories exceed
 * that category's budget. Best-effort: failures are logged, never thrown.
 * @param {import('express').Request} req - authenticated request (req.user, req.userId)
 * @param {Array<{type: string, category: string}>} transactions - created or updated transactions
 */
export async function checkBudgetAlerts(req, transactions) {
  const categories = [
    ...new Set(transactions.filter((t) => t?.type === 'expense').map((t) => t.category)),
  ];
  if (!categories.length || !req.user?.email) return;

  try {
    const filter = ownerFilter(req);
    const budgets = await Budget.find({ ...filter, category: { $in: categories } });
    for (const budget of budgets) {
      const [{ spent = 0 } = {}] = await Transaction.aggregate([
        {
          $match: {
            ...filter,
            type: 'expense',
            category: budget.category,
            date: { $regex: `^${monthPrefix()}` },
          },
        },
        { $group: { _id: null, spent: { $sum: '$amount' } } },
      ]);
      if (spent > budget.amount) {
        await sendMail({ to: req.user.email, ...alertEmail(budget.category, budget.amount, spent) });
      }
    }
  } catch (err) {
    console.error('budget alert failed', err.message);
  }
}
