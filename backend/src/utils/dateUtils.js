/**
 * Date helpers. All business dates are handled in UTC so that results are
 * deterministic regardless of the server's time zone.
 */

/** [from, to) range of a calendar month. `month` is 0-based. */
const monthRange = (year, month) => ({
  from: new Date(Date.UTC(year, month, 1)),
  to: new Date(Date.UTC(year, month + 1, 1)),
});

const currentMonth = (now = new Date()) => ({ year: now.getUTCFullYear(), month: now.getUTCMonth() });

const shiftMonth = (year, month, delta) => {
  const d = new Date(Date.UTC(year, month + delta, 1));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
};

const daysInMonth = (year, month) => new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

const monthKey = (date) => new Date(date).toISOString().slice(0, 7); // YYYY-MM
const dayKey = (date) => new Date(date).toISOString().slice(0, 10); // YYYY-MM-DD

const startOfDay = (date = new Date()) => {
  const d = new Date(date);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
};

const addDays = (date, days) => new Date(new Date(date).getTime() + days * 86400000);

const diffInDays = (from, to) => Math.round((startOfDay(to) - startOfDay(from)) / 86400000);

/** Next occurrence of a recurring payment. Month ends are clamped (31 Jan -> 28/29 Feb). */
const addFrequency = (date, frequency) => {
  const d = new Date(date);
  const day = d.getUTCDate();
  const jumpMonths = (count) => {
    const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + count, 1));
    const lastDay = daysInMonth(target.getUTCFullYear(), target.getUTCMonth());
    target.setUTCDate(Math.min(day, lastDay));
    return target;
  };

  switch (frequency) {
    case 'daily':
      return addDays(d, 1);
    case 'weekly':
      return addDays(d, 7);
    case 'monthly':
      return jumpMonths(1);
    case 'yearly':
      return jumpMonths(12);
    default:
      throw new Error(`Unknown frequency: ${frequency}`);
  }
};

module.exports = {
  monthRange,
  currentMonth,
  shiftMonth,
  daysInMonth,
  monthKey,
  dayKey,
  startOfDay,
  addDays,
  diffInDays,
  addFrequency,
};
