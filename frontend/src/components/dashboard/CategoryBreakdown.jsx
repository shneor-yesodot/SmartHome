import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import Card from '../ui/Card';
import { formatMoney } from '../../utils/format';

const MAX_ROWS = 6;

/** Donut + list of this month's expenses by category. */
export default function CategoryBreakdown({ categories }) {
  const total = categories.reduce((sum, c) => sum + c.total, 0);

  return (
    <Card title="הוצאות לפי קטגוריה" className="flex flex-col" bodyClassName="flex flex-1 flex-col justify-center">
      {categories.length === 0 ? (
        <p className="py-16 text-center text-sm text-ink-muted">אין הוצאות להצגה החודש</p>
      ) : (
        <div className="flex flex-col items-center gap-5 sm:flex-row">
          <div className="relative h-[168px] w-[168px] shrink-0" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={categories} dataKey="total" nameKey="name" innerRadius={56} outerRadius={82} paddingAngle={2} stroke="none">
                  {categories.map((c) => (
                    <Cell key={c.categoryId} fill={c.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xs text-ink-muted">סה״כ</span>
              <span className="tabular text-base font-bold">{formatMoney(total, { round: true })}</span>
            </div>
          </div>

          <ul className="w-full flex-1 space-y-2.5">
            {categories.slice(0, MAX_ROWS).map((c) => (
              <li key={c.categoryId} className="flex items-center justify-between gap-3 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: c.color }} />
                  <span className="truncate">{c.name}</span>
                </span>
                <span className="tabular shrink-0 text-ink-soft">
                  {formatMoney(c.total, { round: true })} <span className="text-ink-muted">({Math.round(c.percent)}%)</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
