import { Link } from 'react-router-dom';
import { PiggyBank } from 'lucide-react';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import { ProgressBar } from '../ui/Progress';
import { EmptyState } from '../ui/States';
import { GOAL_STATUS } from '../../constants/options';
import { formatDate, formatMoney } from '../../utils/format';

/** One progress bar per savings goal. The small marker shows where the goal should be today. */
export default function GoalsWidget({ goals }) {
  return (
    <Card
      title="יעדי חיסכון"
      icon={PiggyBank}
      action={
        <Link to="/goals" className="text-sm font-semibold text-brand-600 hover:underline">
          לכל היעדים
        </Link>
      }
    >
      {goals.length === 0 ? (
        <EmptyState compact title="עדיין לא הוגדרו יעדים" text="הגדירו סכום ותאריך, ונעקוב אחרי הקצב בשבילכם." />
      ) : (
        <ul className="space-y-4">
          {goals.slice(0, 4).map((goal) => {
            const status = GOAL_STATUS[goal.progress.status];
            return (
              <li key={goal.id}>
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold">{goal.name}</span>
                  <Badge tone={status.tone}>{status.label}</Badge>
                </div>
                <ProgressBar value={goal.progress.percent} tone={status.tone} marker={goal.progress.expectedPercent} />
                <div className="tabular mt-1.5 flex justify-between text-xs text-ink-muted">
                  <span>
                    {formatMoney(goal.currentAmount, { round: true })} מתוך {formatMoney(goal.targetAmount, { round: true })}
                  </span>
                  <span>עד {formatDate(goal.targetDate)}</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
