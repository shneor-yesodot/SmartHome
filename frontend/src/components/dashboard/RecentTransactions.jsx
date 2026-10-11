import { Link } from 'react-router-dom';
import { Receipt } from 'lucide-react';
import Card from '../ui/Card';
import CategoryIcon from '../ui/CategoryIcon';
import { EmptyState } from '../ui/States';
import { formatDayMonth, formatTransactionAmount } from '../../utils/format';

export default function RecentTransactions({ transactions, onAdd }) {
  return (
    <Card
      title="עסקאות אחרונות"
      action={
        <Link to="/transactions" className="text-sm font-semibold text-brand-600 hover:underline">
          לכל העסקאות
        </Link>
      }
    >
      {transactions.length === 0 ? (
        <EmptyState
          compact
          icon={Receipt}
          title="עדיין אין עסקאות"
          text="הוסיפו את ההוצאה או ההכנסה הראשונה כדי לראות את התמונה המלאה."
          action={
            <button className="btn btn-primary btn-sm" onClick={onAdd}>
              הוספת עסקה
            </button>
          }
        />
      ) : (
        <ul className="divide-y divide-line">
          {transactions.map((t) => (
            <li key={t.id} className="flex items-center gap-3 py-2.5">
              <CategoryIcon icon={t.category?.icon} color={t.category?.color} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{t.description}</p>
                <p className="truncate text-xs text-ink-muted">
                  {t.category?.name}
                  {t.merchant ? `, ${t.merchant}` : ''}
                </p>
              </div>
              <div className="shrink-0 text-end">
                <p className={`tabular text-sm font-semibold ${t.type === 'income' ? 'text-brand-600' : ''}`}>
                  {formatTransactionAmount(t)}
                </p>
                <p className="text-xs text-ink-muted">{formatDayMonth(t.date)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
