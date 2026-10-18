import { PiggyBank, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import StatCard from '../ui/StatCard';
import { formatMoney, formatSigned } from '../../utils/format';

/** The current balance first, centered and largest; this month's income and expenses below it. */
export default function SummaryCards({ summary }) {
  const negative = summary.balance < 0;

  return (
    <div className="space-y-4">
      <section
        className="rounded-2xl bg-gradient-to-l from-brand-800 to-brand-600 p-6 text-center text-white shadow-card sm:p-8"
        aria-label="יתרה נוכחית"
      >
        <span className="inline-flex items-center gap-2 text-sm font-medium text-brand-100">
          <Wallet className="h-4 w-4" />
          יתרה נוכחית
        </span>
        <p className={`tabular mt-1 text-4xl font-extrabold leading-tight sm:text-5xl ${negative ? 'text-red-200' : ''}`}>
          {formatMoney(summary.balance, { round: true })}
        </p>
        <p className="tabular mt-2 text-sm text-brand-100">מאזן החודש: {formatSigned(summary.monthBalance, { round: true })}</p>

        {summary.savedInGoals > 0 && (
          <dl className="tabular mx-auto mt-5 flex max-w-lg flex-col items-center justify-center gap-x-8 gap-y-2 border-t border-white/20 pt-4 text-sm sm:flex-row">
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 shrink-0 text-brand-200" />
              <dt className="text-brand-100">פנוי לשימוש:</dt>
              <dd className="font-bold">{formatMoney(summary.available, { round: true })}</dd>
            </div>
            <div className="flex items-center gap-2">
              <PiggyBank className="h-4 w-4 shrink-0 text-brand-200" />
              <dt className="text-brand-100">מתוכם ביעדי חיסכון:</dt>
              <dd className="font-bold">{formatMoney(summary.savedInGoals, { round: true })}</dd>
            </div>
          </dl>
        )}
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard label="הכנסות החודש" value={formatMoney(summary.income, { round: true })} icon={TrendingUp} tone="success" />
        <StatCard label="הוצאות החודש" value={formatMoney(summary.expense, { round: true })} icon={TrendingDown} tone="danger" />
      </div>
    </div>
  );
}
