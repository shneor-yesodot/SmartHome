const { monthRange, shiftMonth, daysInMonth, addFrequency, diffInDays } = require('../src/utils/dateUtils');

describe('dateUtils', () => {
  it('builds a half-open month range', () => {
    const { from, to } = monthRange(2026, 9);
    expect(from.toISOString()).toBe('2026-10-01T00:00:00.000Z');
    expect(to.toISOString()).toBe('2026-11-01T00:00:00.000Z');
  });

  it('shifts months across year boundaries', () => {
    expect(shiftMonth(2026, 0, -1)).toEqual({ year: 2025, month: 11 });
    expect(shiftMonth(2026, 11, 1)).toEqual({ year: 2027, month: 0 });
  });

  it('knows leap years', () => {
    expect(daysInMonth(2028, 1)).toBe(29);
    expect(daysInMonth(2026, 1)).toBe(28);
  });

  it('clamps monthly recurrences to the end of shorter months', () => {
    const next = addFrequency(new Date('2026-01-31T00:00:00Z'), 'monthly');
    expect(next.toISOString().slice(0, 10)).toBe('2026-02-28');
  });

  it('advances weekly and yearly recurrences', () => {
    expect(addFrequency(new Date('2026-03-01T00:00:00Z'), 'weekly').toISOString().slice(0, 10)).toBe('2026-03-08');
    expect(addFrequency(new Date('2026-03-01T00:00:00Z'), 'yearly').toISOString().slice(0, 10)).toBe('2027-03-01');
  });

  it('counts whole days between dates', () => {
    expect(diffInDays(new Date('2026-01-01T10:00:00Z'), new Date('2026-01-11T02:00:00Z'))).toBe(10);
  });
});
