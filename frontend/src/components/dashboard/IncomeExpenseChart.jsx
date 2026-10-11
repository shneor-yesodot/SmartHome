import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import Card from '../ui/Card';
import { CHART_COLORS } from '../../constants/options';
import { HEBREW_MONTHS, formatMoney } from '../../utils/format';

export function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-line bg-white px-3 py-2 text-sm shadow-pop" dir="rtl">
      <p className="mb-1 font-semibold">{label}</p>
      {payload.map((entry) => (
        <p key={entry.dataKey} className="flex items-center gap-2 text-ink-soft">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
          {entry.name}: <span className="tabular font-semibold text-ink">{formatMoney(entry.value)}</span>
        </p>
      ))}
    </div>
  );
}

export const axisProps = { tick: { fill: CHART_COLORS.axis, fontSize: 12 }, axisLine: false, tickLine: false };

export default function IncomeExpenseChart({ monthly }) {
  const data = monthly.map((m) => ({ name: HEBREW_MONTHS[m.month], income: m.income, expense: m.expense }));

  return (
    <Card title="הכנסות מול הוצאות - 6 חודשים אחרונים">
      {/* Charts are drawn left-to-right; the newest month is on the right */}
      <div dir="ltr" className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barGap={4} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
            <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="4 4" vertical={false} />
            <XAxis dataKey="name" {...axisProps} />
            <YAxis {...axisProps} width={52} tickFormatter={(v) => v.toLocaleString('he-IL')} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: '#EDF8F2' }} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 13, paddingTop: 8 }} />
            <Bar dataKey="income" name="הכנסות" fill={CHART_COLORS.income} radius={[6, 6, 0, 0]} maxBarSize={28} />
            <Bar dataKey="expense" name="הוצאות" fill={CHART_COLORS.expense} radius={[6, 6, 0, 0]} maxBarSize={28} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
