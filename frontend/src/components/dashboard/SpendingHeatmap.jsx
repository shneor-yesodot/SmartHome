import { CalendarDays } from 'lucide-react';
import Card from '../ui/Card';
import { formatMoney } from '../../utils/format';
import { dayNumber, formatDay } from '../../utils/hebrewDate';

const WEEKDAYS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];
// Light -> dark green, by share of the busiest day
const SHADES = ['#F1F5F2', '#D6F0E2', '#ADE1C6', '#5CC090', '#12A05C', '#0C6F41'];

const shadeFor = (total, max) => {
  if (!total) return SHADES[0];
  return SHADES[Math.min(Math.ceil((total / max) * 5), 5)];
};

/** Calendar of the current month (Gregorian or Hebrew) - the darker the day, the more was spent. */
export default function SpendingHeatmap({ heatmap, period }) {
  const max = Math.max(...heatmap.map((d) => d.total), 1);
  const leadingBlanks = new Date(period.start).getUTCDay(); // Sunday = 0

  return (
    <Card title="לוח הוצאות יומי" icon={CalendarDays}>
      <div className="grid grid-cols-7 gap-1.5 text-center">
        {WEEKDAYS.map((d) => (
          <span key={d} className="pb-1 text-xs text-ink-muted">
            {d}
          </span>
        ))}
        {Array.from({ length: leadingBlanks }, (_, i) => (
          <span key={`blank-${i}`} />
        ))}
        {heatmap.map((d) => {
          const level = SHADES.indexOf(shadeFor(d.total, max));
          const isToday = d.day === period.day;
          return (
            <span
              key={d.day}
              title={`${formatDay(d.date, period.calendar)}: ${formatMoney(d.total)}`}
              className={`tabular flex aspect-square items-center justify-center rounded-lg text-xs ${level >= 4 ? 'text-white' : 'text-ink-soft'} ${isToday ? 'ring-2 ring-ink/60' : ''}`}
              style={{ backgroundColor: SHADES[level] }}
            >
              {dayNumber(d.day, period.calendar)}
            </span>
          );
        })}
      </div>
      <div className="mt-4 flex items-center justify-end gap-1.5 text-xs text-ink-muted">
        <span>פחות</span>
        {SHADES.map((s) => (
          <span key={s} className="h-3 w-3 rounded" style={{ backgroundColor: s }} />
        ))}
        <span>יותר</span>
      </div>
    </Card>
  );
}
