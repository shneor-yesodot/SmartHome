import { base44 } from '@/api/base44Client';
import { isSameMonth, formatCurrency } from './format';

/**
 * Checks whether the given expense transaction causes a budget overrun
 * for its category in the current month. If so, sends an email alert.
 * @param {object} transaction - the just-created/updated transaction
 */
export async function checkBudgetAlerts(transaction) {
  if (!transaction || transaction.type !== 'expense') return;

  try {
    const [budgets, txns, user] = await Promise.all([
      base44.entities.Budget.list(),
      base44.entities.Transaction.list('-date', 500),
      base44.auth.me().catch(() => null),
    ]);

    const relevantBudget = budgets.find((b) => b.category === transaction.category);
    if (!relevantBudget) return;

    const spent = txns
      .filter((t) => t.type === 'expense' && t.category === transaction.category && isSameMonth(t.date))
      .reduce((sum, t) => sum + (t.amount || 0), 0);

    if (spent > relevantBudget.amount && user?.email) {
      const overage = spent - relevantBudget.amount;
      await base44.integrations.Core.SendEmail({
        to: user.email,
        subject: `התראת חריגת תקציב — ${transaction.category}`,
        body: [
          `<div dir="rtl" style="font-family:Heebo,Arial,sans-serif;max-width:500px;margin:auto">`,
          `<h2 style="color:#16a34a">התראת חריגת תקציב</h2>`,
          `<p>חרגת מהתקציב שהגדרת לקטגוריה <strong>${transaction.category}</strong> בחודש הנוכחי.</p>`,
          `<table style="width:100%;border-collapse:collapse;margin:16px 0">`,
          `<tr><td style="padding:8px;border:1px solid #e5e7eb">תקציב</td><td style="padding:8px;border:1px solid #e5e7eb;text-align:left"><strong>${formatCurrency(relevantBudget.amount)}</strong></td></tr>`,
          `<tr><td style="padding:8px;border:1px solid #e5e7eb">הוצאות בפועל</td><td style="padding:8px;border:1px solid #e5e7eb;text-align:left"><strong>${formatCurrency(spent)}</strong></td></tr>`,
          `<tr><td style="padding:8px;border:1px solid #e5e7eb;color:#dc2626">חריגה</td><td style="padding:8px;border:1px solid #e5e7eb;text-align:left;color:#dc2626"><strong>${formatCurrency(overage)}</strong></td></tr>`,
          `</table>`,
          `<p style="color:#6b7280;font-size:14px">התראה אוטומטית ממערכת SmartHome</p>`,
          `</div>`,
        ].join(''),
      });
    }
  } catch {
    // alerts are best-effort; never block the transaction flow
  }
}