import { TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import StatCard from '../ui/StatCard';
import { formatMoney } from '../../utils/format';

export default function SummaryCards({ summary }) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <StatCard label="הכנסות החודש" value={formatMoney(summary.income, { round: true })} icon={TrendingUp} tone="success" />
      <StatCard label="הוצאות החודש" value={formatMoney(summary.expense, { round: true })} icon={TrendingDown} tone="danger" />
      <StatCard
        label="יתרה נוכחית"
        value={formatMoney(summary.balance, { round: true })}
        icon={Wallet}
        tone={summary.balance < 0 ? 'danger' : 'neutral'}
      />
    </div>
  );
}
