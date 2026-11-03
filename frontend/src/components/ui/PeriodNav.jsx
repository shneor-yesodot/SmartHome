import { ChevronLeft, ChevronRight } from 'lucide-react';
import Segmented from './Segmented';
import { CALENDAR_OPTIONS } from '../../constants/options';

const DAY_MS = 86400000;
const isoDay = (date) => new Date(date).toISOString().slice(0, 10);

/** The day before / after a month, as an anchor for the previous / next month. */
export const periodAnchor = (period, direction) =>
  isoDay(direction < 0 ? new Date(period.start).getTime() - DAY_MS : new Date(period.end).getTime() + DAY_MS);

/**
 * Month switcher in either calendar. The server works out the month range
 * (`period` from the response); this only moves the anchor day.
 */
export default function PeriodNav({ period, calendar, onCalendarChange, onAnchorChange }) {
  const isCurrent = !period || new Date(period.end).getTime() + DAY_MS > Date.now();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Segmented label="לוח שנה" options={CALENDAR_OPTIONS} value={calendar} onChange={onCalendarChange} />
      <div className="card flex items-center gap-1 p-1">
        <button className="icon-btn" disabled={!period} onClick={() => onAnchorChange(periodAnchor(period, -1))} aria-label="החודש הקודם">
          <ChevronRight className="h-5 w-5" />
        </button>
        <span className="min-w-[124px] text-center text-sm font-bold">{period?.label || '…'}</span>
        <button className="icon-btn disabled:opacity-40" disabled={isCurrent} onClick={() => onAnchorChange(periodAnchor(period, 1))} aria-label="החודש הבא">
          <ChevronLeft className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
