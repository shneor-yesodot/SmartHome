import { Pencil, Plus, Trash2 } from 'lucide-react';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import { ProgressBar, ProgressRing } from '../ui/Progress';
import { getIcon } from '../../constants/icons';
import { goalStatus } from '../../constants/options';
import { formatDate, formatMoney } from '../../utils/format';

const daysText = (days) => {
  if (days < 0) return `עבר לפני ${-days} ימים`;
  if (days === 0) return 'היום';
  return days > 60 ? `עוד כ-${Math.round(days / 30.44)} חודשים` : `עוד ${days} ימים`;
};

export default function GoalCard({ goal, onDeposit, onEdit, onDelete }) {
  const { progress } = goal;
  const status = goalStatus(progress);
  const Icon = getIcon(goal.icon);

  return (
    <article className="card flex flex-col p-5">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-lg font-bold">{goal.name}</h3>
          <Badge tone={status.tone} className="mt-1.5">
            {status.label}
          </Badge>
        </div>
        <div className="flex shrink-0 gap-1">
          <button className="icon-btn" onClick={() => onEdit(goal)} aria-label={`עריכת היעד ${goal.name}`}>
            <Pencil className="h-4 w-4" />
          </button>
          <button className="icon-btn hover:!bg-danger-50 hover:!text-danger-500" onClick={() => onDelete(goal)} aria-label={`מחיקת היעד ${goal.name}`}>
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="mt-5 flex items-center gap-5">
        <ProgressRing value={progress.percent} size={104} stroke={10} color={goal.color}>
          <Icon className="h-5 w-5" style={{ color: goal.color }} />
          <span className="tabular mt-0.5 text-lg font-extrabold">{Math.round(progress.percent)}%</span>
        </ProgressRing>
        <dl className="tabular flex-1 space-y-2 text-sm">
          <div className="flex justify-between gap-2">
            <dt className="text-ink-muted">נחסך</dt>
            <dd className="font-semibold">{formatMoney(goal.currentAmount, { round: true })}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-ink-muted">יעד</dt>
            <dd className="font-semibold">{formatMoney(goal.targetAmount, { round: true })}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-ink-muted">תאריך יעד</dt>
            <dd>{formatDate(goal.targetDate)}</dd>
          </div>
        </dl>
      </div>

      {/* Actual progress vs. where the goal should be today */}
      <div className="mt-5">
        <ProgressBar value={progress.percent} tone={status.tone} marker={progress.expectedPercent} />
        <p className="mt-2 text-xs text-ink-muted">
          {progress.status === 'completed'
            ? 'כל הכבוד, הגעתם לסכום היעד.'
            : `${daysText(progress.daysLeft)}. הקו מסמן איפה כדאי להיות היום (${Math.round(progress.expectedPercent)}%).`}
        </p>
      </div>

      <footer className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-4">
        <div className="text-sm text-ink-soft">
          {progress.leftThisMonth > 0 ? (
            <>
              <p>
                נשאר להפקיד החודש:{' '}
                <b className="tabular text-ink">{formatMoney(progress.leftThisMonth, { round: true })}</b>
              </p>
              {!progress.affordable && (
                <p className="mt-0.5 text-xs font-semibold text-warn-600">ההוצאות החודש לא משאירות מספיק ליעד הזה</p>
              )}
            </>
          ) : (
            <p>{progress.depositedThisMonth > 0 ? 'ההפקדה של החודש הושלמה' : 'אין צורך בהפקדות נוספות'}</p>
          )}
        </div>
        <Button size="sm" icon={Plus} onClick={() => onDeposit(goal)}>
          הפקדה
        </Button>
      </footer>
    </article>
  );
}
