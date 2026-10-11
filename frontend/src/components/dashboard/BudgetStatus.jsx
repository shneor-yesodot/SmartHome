import { Link } from 'react-router-dom';
import { Target } from 'lucide-react';
import Card from '../ui/Card';
import { ProgressBar } from '../ui/Progress';
import { EmptyState } from '../ui/States';
import { BUDGET_STATUS } from '../../constants/options';
import { formatMoney } from '../../utils/format';

export default function BudgetStatus({ budgets }) {
  return (
    <Card
      title="מצב התקציבים החודש"
      icon={Target}
      action={
        <Link to="/budgets" className="text-sm font-semibold text-brand-600 hover:underline">
          ניהול תקציבים
        </Link>
      }
    >
      {budgets.length === 0 ? (
        <EmptyState compact title="עדיין לא הוגדרו תקציבים" text="קבעו תקרה חודשית לקטגוריה וקבלו התראה לפני חריגה." />
      ) : (
        <ul className="space-y-4">
          {budgets.slice(0, 5).map((b) => (
            <li key={b.id}>
              <div className="mb-1.5 flex justify-between gap-2 text-sm">
                <span className="truncate font-medium">{b.category.name}</span>
                <span className={`tabular shrink-0 ${b.status === 'exceeded' ? 'font-semibold text-danger-500' : 'text-ink-soft'}`}>
                  {formatMoney(b.spent, { round: true })} / {formatMoney(b.amount, { round: true })}
                </span>
              </div>
              <ProgressBar value={b.percent} tone={BUDGET_STATUS[b.status].tone} />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
