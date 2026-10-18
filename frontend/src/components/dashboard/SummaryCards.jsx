import { PiggyBank, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import StatCard from '../ui/StatCard';
import { formatMoney } from '../../utils/format';

/** The current balance first, centered and largest; this month's income and expenses below it. */
export default function SummaryCards({ summary }) {
  const negative = summary.balance < 0;

  return (
    <div className="space-y-4">
      <section
        className="card border-t-4 border-t-brand-500 bg-gradient-to-b from-brand-50 to-white p-6 text-center sm:p-8"
        aria-label="יתרה נוכחית"
      >
        <span className="inline-flex items-center gap-2 text-sm font-medium text-ink-soft">
          <Wallet className="h-4 w-4 text-brand-600" />
          יתרה נוכחית
        </span>
        <p className={`tabular mt-1 text-4xl font-extrabold leading-tight sm:text-5xl ${negative ? 'text-danger-500' : 'text-ink'}`}>
          {formatMoney(summary.balance, { round: true })}
        </p>

        {summary.savedInGoals > 0 && (
          <dl className="tabular mx-auto mt-5 flex max-w-lg flex-col items-center justify-center gap-x-8 gap-y-2 border-t border-line pt-4 text-sm sm:flex-row">
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 shrink-0 text-brand-600" />
              <dt className="text-ink-soft">פנוי לשימוש:</dt>
              <dd className={`font-bold ${summary.available < 0 ? 'text-danger-500' : ''}`}>{formatMoney(summary.available, { round: true })}</dd>
            </div>
            <div className="flex items-center gap-2">
              <PiggyBank className="h-4 w-4 shrink-0 text-brand-600" />
              <dt className="text-ink-soft">מתוכם ביעדי חיסכון:</dt>
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
