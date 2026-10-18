import { useEffect, useState } from 'react';
import { formatHebrewDate } from '../../utils/hebrewDate';

const gregorian = new Intl.DateTimeFormat('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });
const time = new Intl.DateTimeFormat('he-IL', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

/**
 * Hebrew date, Gregorian date and a ticking clock. Lives in its own component
 * so the per-second update re-renders only the clock, not the whole top bar.
 * Wide screens: one line. Narrower screens: the dates move under the time.
 */
export default function LiveClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const hebrew = formatHebrewDate(now);
  const date = gregorian.format(now);

  return (
    <div className="flex flex-col items-end leading-tight text-ink-soft lg:flex-row lg:items-center lg:gap-2 lg:text-sm">
      <span className="hidden lg:inline">{hebrew}</span>
      <span className="hidden text-line lg:inline" aria-hidden="true">
        |
      </span>
      <span className="tabular hidden lg:inline">{date}</span>
      <time className="tabular text-sm font-semibold text-ink" dateTime={now.toISOString()} dir="ltr">
        {time.format(now)}
      </time>
      <span className="tabular whitespace-nowrap text-[11px] lg:hidden">
        {hebrew} · {date}
      </span>
    </div>
  );
}
