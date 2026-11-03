/**
 * Months in either calendar. A period is the [from, to) range of UTC days of
 * one Gregorian or one Hebrew month. Hebrew months come from Intl's Hebrew
 * calendar (built into Node), so no library is needed.
 */
const DAY_MS = 86400000;

const GREGORIAN_MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];

const hebrewDay = new Intl.DateTimeFormat('en-u-ca-hebrew', { day: 'numeric', timeZone: 'UTC' });
const hebrewMonthYear = new Intl.DateTimeFormat('he-IL-u-ca-hebrew', { month: 'long', year: 'numeric', timeZone: 'UTC' });

const ONES = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'];
const TENS = ['', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ'];
const HUNDREDS = ['', 'ק', 'ר', 'ש', 'ת', 'תק', 'תר', 'תש', 'תת', 'תתק'];

/** 1-999 in Hebrew letters with geresh / gershayim (15 and 16 are written ט״ו / ט״ז). */
const toHebrewNumeral = (n) => {
  let letters = HUNDREDS[Math.floor(n / 100)];
  const rest = n % 100;
  if (rest === 15) letters += 'טו';
  else if (rest === 16) letters += 'טז';
  else letters += TENS[Math.floor(rest / 10)] + ONES[rest % 10];
  return letters.length === 1 ? `${letters}׳` : `${letters.slice(0, -1)}״${letters.slice(-1)}`;
};

const toDay = (date) => {
  const d = new Date(date);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
};

const addDays = (date, days) => new Date(date.getTime() + days * DAY_MS);

const dayOfHebrewMonth = (date) => Number(hebrewDay.format(date));

/** { name: "חשוון", label: "חשוון תשפ״ז" } */
const hebrewNames = (date) => {
  const parts = Object.fromEntries(hebrewMonthYear.formatToParts(date).map((p) => [p.type, p.value]));
  return { name: parts.month, label: `${parts.month} ${toHebrewNumeral(Number(parts.year) % 1000)}` };
};

/** The month (in the given calendar) that contains `date`. */
const periodOf = (date = new Date(), calendar = 'gregorian') => {
  const day = toDay(date);
  let from;
  let to;
  let names;
  if (calendar === 'hebrew') {
    from = addDays(day, 1 - dayOfHebrewMonth(day));
    to = addDays(from, 29); // a Hebrew month has 29 or 30 days
    if (dayOfHebrewMonth(to) !== 1) to = addDays(to, 1);
    names = hebrewNames(from);
  } else {
    from = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), 1));
    to = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth() + 1, 1));
    const name = GREGORIAN_MONTHS[from.getUTCMonth()];
    names = { name, label: `${name} ${from.getUTCFullYear()}` };
  }
  return { calendar, from, to, days: Math.round((to - from) / DAY_MS), key: from.toISOString().slice(0, 10), ...names };
};

/** The period `delta` months before (negative) or after (positive) this one. */
const shiftPeriod = (period, delta) => {
  let p = period;
  for (let i = 0; i < Math.abs(delta); i += 1) {
    p = periodOf(delta < 0 ? addDays(p.from, -1) : p.to, p.calendar);
  }
  return p;
};

/** 1-based day of the period that `date` falls on. */
const dayOfPeriod = (date, period) => Math.floor((toDay(date) - period.from) / DAY_MS) + 1;

/** Plain JSON for the API: first and last day (inclusive). */
const describePeriod = ({ calendar, from, to, days, key, name, label }) => ({
  calendar,
  name,
  start: from,
  end: addDays(to, -1),
  days,
  key,
  label,
});

/**
 * The period a request asks for: an anchor `date`, or a Gregorian `year` + `month`
 * (0-based), or today. The calendar defaults to the user's setting.
 */
const resolvePeriod = ({ calendar, date, year, month } = {}, fallbackCalendar = 'gregorian', now = new Date()) => {
  if (year !== undefined && month !== undefined) {
    // A year + month pair is always a Gregorian month
    return periodOf(new Date(Date.UTC(year, month, 1)), calendar || 'gregorian');
  }
  return periodOf(date ? new Date(date) : now, calendar || fallbackCalendar);
};

module.exports = { periodOf, resolvePeriod, shiftPeriod, dayOfPeriod, describePeriod, toHebrewNumeral };
