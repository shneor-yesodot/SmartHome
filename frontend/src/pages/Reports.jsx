import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BarChart3, ChevronLeft, ChevronRight, Percent, PiggyBank, TrendingDown, TrendingUp } from 'lucide-react';
import Card from '../components/ui/Card';
import PageHeader from '../components/ui/PageHeader';
import StatCard from '../components/ui/StatCard';
import { ProgressBar } from '../components/ui/Progress';
import { EmptyState, ErrorState, PageLoader } from '../components/ui/States';
import { ChartTooltip, axisProps } from '../components/dashboard/IncomeExpenseChart';
import { PriceChange } from '../components/products/ProductCard';
import { useFetch } from '../hooks/useFetch';
import { reportService } from '../services/report.service';
import { CHART_COLORS } from '../constants/options';
import { formatChange, formatMoney, monthLabel } from '../utils/format';

const shift = ({ year, month }, delta) => {
  const d = new Date(Date.UTC(year, month + delta, 1));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
};

const versusPrevious = (change) => {
  if (change === null) return 'אין נתוני השוואה';
  return Math.round(change) === 0 ? 'ללא שינוי מהחודש הקודם' : `${formatChange(change)} מהחודש הקודם`;
};

export default function Reports() {
  const now = new Date();
  const current = { year: now.getFullYear(), month: now.getMonth() };
  const [period, setPeriod] = useState(current);
  const isCurrent = period.year === current.year && period.month === current.month;

  const { data, loading, error, reload } = useFetch(() => reportService.monthly(period.year, period.month), [period.year, period.month]);

  return (
    <>
      <PageHeader title="דוחות" subtitle="סיכום חודשי והשוואה לחודש הקודם">
        <div className="card flex items-center gap-1 p-1">
          <button className="icon-btn" onClick={() => setPeriod((p) => shift(p, -1))} aria-label="החודש הקודם">
            <ChevronRight className="h-5 w-5" />
          </button>
          <span className="min-w-[124px] text-center text-sm font-bold">{monthLabel(period.year, period.month)}</span>
          <button className="icon-btn disabled:opacity-40" disabled={isCurrent} onClick={() => setPeriod((p) => shift(p, 1))} aria-label="החודש הבא">
            <ChevronLeft className="h-5 w-5" />
          </button>
        </div>
      </PageHeader>

      {error ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : !data ? (
        <PageLoader />
      ) : (
        <div className={`space-y-6 ${loading ? 'opacity-60' : ''}`}>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="הכנסות" value={formatMoney(data.totals.income, { round: true })} icon={TrendingUp} tone="success" footnote={versusPrevious(data.change.income)} />
            <StatCard label="הוצאות" value={formatMoney(data.totals.expense, { round: true })} icon={TrendingDown} tone="danger" footnote={versusPrevious(data.change.expense)} />
            <StatCard
              label="חיסכון"
              value={formatMoney(data.totals.savings, { round: true })}
              icon={PiggyBank}
              tone={data.totals.savings < 0 ? 'danger' : 'neutral'}
              footnote={`בחודש הקודם: ${formatMoney(data.previous.savings, { round: true })}`}
            />
            <StatCard label="אחוז חיסכון" value={`${Math.round(data.totals.savingsRate)}%`} icon={Percent} footnote={`בחודש הקודם: ${Math.round(data.previous.savingsRate)}%`} />
          </div>

          {data.transactionsCount === 0 ? (
            <div className="card">
              <EmptyState icon={BarChart3} title={`אין עסקאות בחודש ${data.period.label}`} text="בחרו חודש אחר, או הוסיפו עסקאות כדי לראות את הדוח." />
            </div>
          ) : (
            <>
              <Card title="הוצאות יומיות">
                <div dir="ltr" className="h-[240px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.daily} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
                      <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="4 4" vertical={false} />
                      <XAxis dataKey="day" {...axisProps} interval={1} />
                      <YAxis {...axisProps} width={52} tickFormatter={(v) => v.toLocaleString('he-IL')} />
                      <Tooltip content={<ChartTooltip />} cursor={{ fill: '#EDF8F2' }} labelFormatter={(day) => `${day}/${period.month + 1}`} />
                      <Bar dataKey="expense" name="הוצאות" fill={CHART_COLORS.expense} radius={[4, 4, 0, 0]} maxBarSize={18} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
                <Card title="פילוח הוצאות לפי קטגוריה">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[480px]">
                      <thead>
                        <tr className="border-b border-line">
                          <th className="table-head !ps-0">קטגוריה</th>
                          <th className="table-head">סכום</th>
                          <th className="table-head w-[32%]">חלק מההוצאות</th>
                          <th className="table-head">שינוי</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {data.categories.map((c) => (
                          <tr key={c.categoryId}>
                            <td className="table-cell !ps-0">
                              <span className="flex items-center gap-2 font-medium">
                                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                                {c.name}
                              </span>
                            </td>
                            <td className="table-cell tabular font-semibold">{formatMoney(c.total, { round: true })}</td>
                            <td className="table-cell">
                              <div className="flex items-center gap-2">
                                <ProgressBar value={c.percent} className="flex-1" />
                                <span className="tabular w-9 text-xs text-ink-muted">{Math.round(c.percent)}%</span>
                              </div>
                            </td>
                            <td className="table-cell">{c.change === null ? <span className="text-xs text-ink-muted">חדש</span> : <PriceChange value={c.change} />}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>

                <div className="space-y-6">
                  <Card title="היכן הוצאתם הכי הרבה">
                    {data.topMerchants.length === 0 ? (
                      <p className="py-4 text-sm text-ink-muted">לא צוינו בתי עסק בעסקאות החודש.</p>
                    ) : (
                      <ol className="space-y-3">
                        {data.topMerchants.map((m) => (
                          <li key={m.merchant} className="flex items-center justify-between gap-3 text-sm">
                            <span className="min-w-0">
                              <span className="block truncate font-medium">{m.merchant}</span>
                              <span className="text-xs text-ink-muted">{m.count} עסקאות</span>
                            </span>
                            <span className="tabular shrink-0 font-semibold">{formatMoney(m.total, { round: true })}</span>
                          </li>
                        ))}
                      </ol>
                    )}
                  </Card>
                  <Card title="מקורות הכנסה">
                    {data.incomeCategories.length === 0 ? (
                      <p className="py-4 text-sm text-ink-muted">לא נרשמו הכנסות בחודש הזה.</p>
                    ) : (
                      <ul className="space-y-3">
                        {data.incomeCategories.map((c) => (
                          <li key={c.categoryId} className="flex items-center justify-between gap-3 text-sm">
                            <span className="font-medium">{c.name}</span>
                            <span className="tabular font-semibold text-brand-600">{formatMoney(c.total, { round: true })}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Card>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
