import { CHART_COLORS } from '../../constants/options';
import { formatMoney } from '../../utils/format';

/** The tooltip and axis style every chart shares. */
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
