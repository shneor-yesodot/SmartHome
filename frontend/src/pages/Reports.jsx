import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BarChart3, Coins, Percent, TrendingDown, TrendingUp } from 'lucide-react';
import Card from '../components/ui/Card';
import PageHeader from '../components/ui/PageHeader';
import PeriodNav from '../components/ui/PeriodNav';
import StatCard from '../components/ui/StatCard';
import { ProgressBar } from '../components/ui/Progress';
import { EmptyState, ErrorState, PageLoader } from '../components/ui/States';
import { ChartTooltip, axisProps } from '../components/ui/ChartTooltip';
import { PriceChange } from '../components/products/ProductCard';
import MonthSummary from '../components/reports/MonthSummary';
import AiInsights from '../components/dashboard/AiInsights';
import { useAuth } from '../context/AuthContext';
import { useFetch } from '../hooks/useFetch';
import { reportService } from '../services/report.service';
import { CHART_COLORS } from '../constants/options';
import { formatChange, formatMoney } from '../utils/format';
import { dayNumber, formatDay } from '../utils/hebrewDate';

const versusPrevious = (change) => {
  if (change === null) return 'אין נתוני השוואה';
  return Math.round(change) === 0 ? 'ללא שינוי מהחודש הקודם' : `${formatChange(change)} מהחודש הקודם`;
};

export default function Reports() {
  const { user } = useAuth();
  const [calendar, setCalendar] = useState(user?.calendar || 'gregorian');
  const [anchor, setAnchor] = useState(null); // any day of the month shown; null = this month

  const { data, loading, error, reload } = useFetch(() => reportService.monthly({ calendar, date: anchor || undefined }), [calendar, anchor]);
  const period = data?.period;

  return (
    <>
      <PageHeader title="דוחות" subtitle="סיכום חודשי, מגמה שנתית, והשוואה לחודש הקודם">
        <PeriodNav
          period={period}
          calendar={calendar}
          onCalendarChange={(value) => {
            // The current month stays current; an older month moves to the month around its middle
            if (period && anchor && new Date(period.end) < new Date(new Date().toDateString())) {
              setAnchor(new Date(new Date(period.start).getTime() + (period.days / 2) * 86400000).toISOString().slice(0, 10));
            } else setAnchor(null);
            setCalendar(value);
          }}
          onAnchorChange={setAnchor}
        />
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
              icon={Coins}
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
              <MonthSummary summary={data.summary} period={period} />

              <Card title={`הכנסות מול הוצאות - 12 חודשים עד ${period.label}`}>
                <div dir="ltr" className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.year} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
                      <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="4 4" vertical={false} />
                      <XAxis dataKey="name" {...axisProps} interval="preserveStartEnd" minTickGap={4} />
                      <YAxis {...axisProps} width={52} tickFormatter={(v) => v.toLocaleString('he-IL')} />
                      <Tooltip content={<ChartTooltip />} labelFormatter={(_, payload) => payload?.[0]?.payload.label} />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 13, paddingTop: 8 }} />
                      <Line type="monotone" dataKey="income" name="הכנסות" stroke={CHART_COLORS.income} strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                      <Line type="monotone" dataKey="expense" name="הוצאות" stroke={CHART_COLORS.expense} strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card title="הוצאות יומיות">
                <div dir="ltr" className="h-[240px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.daily} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
                      <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="4 4" vertical={false} />
                      <XAxis dataKey="day" {...axisProps} interval="preserveStartEnd" minTickGap={6} tickFormatter={(day) => dayNumber(day, period.calendar)} />
                      <YAxis {...axisProps} width={52} tickFormatter={(v) => v.toLocaleString('he-IL')} />
                      <Tooltip content={<ChartTooltip />} cursor={{ fill: '#EDF8F2' }} labelFormatter={(day) => formatDay(data.daily[day - 1].date, period.calendar)} />
                      <Bar dataKey="expense" name="הוצאות" fill={CHART_COLORS.expense} radius={[4, 4, 0, 0]} maxBarSize={18} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
                <Card title="פילוח הוצאות לפי קטגוריה" className="min-w-0">
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

              <AiInsights />
            </>
          )}
        </div>
      )}
    </>
  );
}
