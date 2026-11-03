const { periodOf, shiftPeriod, dayOfPeriod, resolvePeriod, describePeriod, toHebrewNumeral } = require('../src/utils/period');

const iso = (date) => date.toISOString().slice(0, 10);

describe('periodOf - Gregorian', () => {
  test('a calendar month', () => {
    const p = periodOf(new Date('2026-11-03T15:00:00Z'));
    expect(iso(p.from)).toBe('2026-11-01');
    expect(iso(p.to)).toBe('2026-12-01');
    expect(p.days).toBe(30);
    expect(p.label).toBe('נובמבר 2026');
  });
});

describe('periodOf - Hebrew', () => {
  test('Cheshvan 5787 starts on 12.10.2026 and has 30 days', () => {
    const p = periodOf(new Date('2026-11-03'), 'hebrew');
    expect(iso(p.from)).toBe('2026-10-12');
    expect(iso(p.to)).toBe('2026-11-11');
    expect(p.days).toBe(30);
    expect(p.label).toBe('חשוון תשפ״ז');
  });

  test('the first and the last day belong to the same month', () => {
    const first = periodOf(new Date('2026-10-12'), 'hebrew');
    const last = periodOf(new Date('2026-11-10'), 'hebrew');
    expect(first.key).toBe(last.key);
    expect(periodOf(new Date('2026-11-11'), 'hebrew').key).not.toBe(first.key);
  });

  test('a leap year has Adar I and Adar II', () => {
    const adar1 = periodOf(new Date('2027-03-08'), 'hebrew');
    const adar2 = shiftPeriod(adar1, 1);
    expect(adar1.label).toBe('אדר א׳ תשפ״ז');
    expect(adar2.label).toBe('אדר ב׳ תשפ״ז');
  });

  test('every month has 29 or 30 days and the months follow each other', () => {
    let p = periodOf(new Date('2026-09-12'), 'hebrew'); // Tishrei 5787
    for (let i = 0; i < 13; i += 1) {
      const next = shiftPeriod(p, 1);
      expect([29, 30]).toContain(p.days);
      expect(iso(next.from)).toBe(iso(p.to));
      p = next;
    }
  });
});

describe('shiftPeriod / dayOfPeriod', () => {
  test('moves back across a year boundary', () => {
    expect(iso(shiftPeriod(periodOf(new Date('2026-01-15')), -1).from)).toBe('2025-12-01');
  });

  test('day of the period is 1-based', () => {
    const p = periodOf(new Date('2026-11-03'), 'hebrew');
    expect(dayOfPeriod(new Date('2026-10-12'), p)).toBe(1);
    expect(dayOfPeriod(new Date('2026-11-03T22:00:00Z'), p)).toBe(23);
  });
});

describe('resolvePeriod', () => {
  const now = new Date('2026-11-03');

  test('defaults to the current month in the user calendar', () => {
    expect(resolvePeriod({}, 'hebrew', now).label).toBe('חשוון תשפ״ז');
    expect(resolvePeriod({}, 'gregorian', now).label).toBe('נובמבר 2026');
  });

  test('an explicit calendar and an anchor date win', () => {
    expect(resolvePeriod({ calendar: 'gregorian', date: '2026-10-20' }, 'hebrew', now).label).toBe('אוקטובר 2026');
  });

  test('a year and month (0-based) are Gregorian, whatever the user setting', () => {
    expect(resolvePeriod({ year: 2026, month: 0 }, 'hebrew', now).label).toBe('ינואר 2026');
  });
});

test('describePeriod returns the last day inclusive', () => {
  const d = describePeriod(periodOf(new Date('2026-11-03')));
  expect(iso(d.start)).toBe('2026-11-01');
  expect(iso(d.end)).toBe('2026-11-30');
});

test('toHebrewNumeral', () => {
  expect(toHebrewNumeral(787)).toBe('תשפ״ז');
  expect(toHebrewNumeral(15)).toBe('ט״ו');
  expect(toHebrewNumeral(5)).toBe('ה׳');
});
