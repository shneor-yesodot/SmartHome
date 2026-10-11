import { Pencil, Trash2 } from 'lucide-react';
import Badge from '../ui/Badge';
import CategoryIcon from '../ui/CategoryIcon';
import { ProgressBar } from '../ui/Progress';
import { BUDGET_STATUS } from '../../constants/options';
import { formatMoney, formatPercent } from '../../utils/format';

export default function BudgetCard({ budget, onEdit, onDelete }) {
  const status = BUDGET_STATUS[budget.status];
  const over = budget.remaining < 0;
  return (
    <article className="card p-5">
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <CategoryIcon icon={budget.category.icon} color={budget.category.color} size={42} />
          <div className="min-w-0">
            <h3 className="truncate font-bold">{budget.category.name}</h3>
            <Badge tone={status.tone} className="mt-1">
              {status.label}
            </Badge>
          </div>
        </div>
        <div className="flex shrink-0 gap-1">
          <button className="icon-btn" onClick={() => onEdit(budget)} aria-label={`עריכת תקציב ${budget.category.name}`}>
            <Pencil className="h-4 w-4" />
          </button>
          <button className="icon-btn hover:!bg-danger-50 hover:!text-danger-500" onClick={() => onDelete(budget)} aria-label={`מחיקת תקציב ${budget.category.name}`}>
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="tabular mt-5 flex items-end justify-between">
        <p>
          <span className="text-2xl font-extrabold">{formatMoney(budget.spent, { round: true })}</span>
          <span className="text-sm text-ink-muted"> מתוך {formatMoney(budget.amount, { round: true })}</span>
        </p>
        <span className="text-sm font-semibold text-ink-soft">{formatPercent(budget.percent)}</span>
      </div>
      <ProgressBar value={budget.percent} tone={status.tone} marker={budget.alertThreshold} className="mt-2" />
      <p className={`tabular mt-3 text-sm ${over ? 'font-semibold text-danger-500' : 'text-ink-soft'}`}>
        {over ? `חריגה של ${formatMoney(-budget.remaining, { round: true })}` : `נותרו ${formatMoney(budget.remaining, { round: true })} עד סוף החודש`}
      </p>
    </article>
  );
}
