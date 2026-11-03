import clsx from 'clsx';
import { ClipboardList } from 'lucide-react';
import Card from '../ui/Card';
import { formatDay } from '../../utils/hebrewDate';
import { formatMoney } from '../../utils/format';

function Section({ title, total, tone, rows, empty }) {
  return (
    <section>
      <h3 className="flex items-center justify-between gap-3 border-b border-line pb-2 text-sm font-bold">
        {title}
        <span className={clsx('tabular', tone)}>{formatMoney(total)}</span>
      </h3>
      {rows.length === 0 ? (
        <p className="py-2 text-sm text-ink-muted">{empty}</p>
      ) : (
        <ul className="divide-y divide-line/70">
          {rows.map((row) => (
            <li key={row.key} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                {row.color && <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: row.color }} />}
                <span className="truncate">{row.name}</span>
                {row.note && <span className="shrink-0 text-xs text-ink-muted">{row.note}</span>}
              </span>
              <span className="tabular shrink-0">{formatMoney(row.total)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** The month on one page, like the household summary sheet: income, expenses, standing orders, maaser, balance. */
export default function MonthSummary({ summary, period }) {
  const { totals } = summary;
  const byCategory = (list) => list.map((c) => ({ key: c.categoryId, name: c.name, color: c.color, total: c.total }));

  return (
    <Card title={`סיכום ${period.label}`} icon={ClipboardList}>
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <Section title="הכנסות" total={totals.income} tone="text-brand-600" rows={byCategory(summary.income)} empty="לא נרשמו הכנסות." />
        <Section title="הוצאות שוטפות" total={totals.dailyExpenses} tone="text-danger-500" rows={byCategory(summary.dailyExpenses)} empty="לא נרשמו הוצאות." />
        <Section
          title="הוראות קבע"
          total={totals.standingOrders}
          tone="text-danger-500"
          rows={summary.standingOrders.map((o) => ({ key: o.id, name: o.description, note: formatDay(o.date, period.calendar), total: o.amount }))}
          empty="לא ירדו הוראות קבע בחודש הזה."
        />
        <Section
          title="מעשרות וצדקה"
          total={totals.donations}
          tone="text-[#B7791F]"
          rows={summary.donations.map((d) => ({ key: d.id, name: d.recipient, note: formatDay(d.date, period.calendar), total: d.amount }))}
          empty="לא נרשמו תרומות בחודש הזה."
        />
      </div>

      <dl className="tabular mt-6 grid gap-3 rounded-xl bg-surface p-4 text-sm sm:grid-cols-3">
        <div className="flex justify-between gap-2 sm:block">
          <dt className="text-ink-muted">סה״כ הכנסות</dt>
          <dd className="font-semibold text-brand-600">{formatMoney(totals.income)}</dd>
        </div>
        <div className="flex justify-between gap-2 sm:block">
          <dt className="text-ink-muted">סה״כ הוצאות</dt>
          <dd className="font-semibold text-danger-500">{formatMoney(totals.expense)}</dd>
        </div>
        <div className="flex justify-between gap-2 sm:block">
          <dt className="text-ink-muted">מאזן החודש</dt>
          <dd className={clsx('text-base font-bold', totals.balance < 0 ? 'text-danger-500' : 'text-ink')}>{formatMoney(totals.balance)}</dd>
        </div>
      </dl>
    </Card>
  );
}
