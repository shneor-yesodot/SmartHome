import { CalendarClock } from 'lucide-react';
import Card from '../ui/Card';
import { formatDayMonth, formatMoney, formatSigned } from '../../utils/format';

/** Where the month is expected to end, plus the next recurring payments. */
export default function ForecastCard({ forecast, upcoming }) {
  const positive = forecast.projectedBalance >= 0;
  return (
    <Card title="תחזית סוף חודש" icon={CalendarClock}>
      <p className="text-sm text-ink-soft">
        {forecast.basedOnHistory ? 'לפי הקצב של החודשים הקודמים, החודש צפוי להסתיים ב:' : 'לפי קצב ההוצאות עד היום, החודש צפוי להסתיים ב:'}
      </p>
      <p className={`tabular mt-1 text-[28px] font-extrabold ${positive ? 'text-brand-600' : 'text-danger-500'}`}>
        {formatSigned(forecast.projectedBalance, { round: true })}
      </p>

      <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-line pt-4 text-sm">
        <div>
          <dt className="text-xs text-ink-muted">הכנסות צפויות</dt>
          <dd className="tabular font-semibold">{formatMoney(forecast.projectedIncome, { round: true })}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-muted">הוצאות צפויות</dt>
          <dd className="tabular font-semibold">{formatMoney(forecast.projectedExpense, { round: true })}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-muted">ימים שנותרו</dt>
          <dd className="tabular font-semibold">{forecast.daysLeft}</dd>
        </div>
      </dl>

      {upcoming.length > 0 && (
        <div className="mt-4 border-t border-line pt-4">
          <p className="mb-2 text-xs font-medium text-ink-muted">הוראות קבע קרובות</p>
          <ul className="space-y-1.5 text-sm">
            {upcoming.slice(0, 3).map((p) => (
              <li key={p.id} className="flex justify-between gap-3">
                <span className="truncate">
                  {p.description} <span className="text-ink-muted">({formatDayMonth(p.nextRun)})</span>
                </span>
                <span className={`tabular shrink-0 font-medium ${p.type === 'income' ? 'text-brand-600' : ''}`}>{formatMoney(p.amount)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
