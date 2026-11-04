const { planSync, buildSheetValues, stampOf, COL } = require('../src/utils/sheetSync');

const appRow = (over = {}) => ({
  id: 'a'.repeat(24),
  date: '2026-10-01',
  type: 'expense',
  amount: 100,
  category: 'סופר ומזון',
  description: 'קנייה',
  merchant: 'שופרסל',
  account: 'ויזה',
  notes: '',
  pushedBefore: true,
  ...over,
});

const pushed = (rows) => buildSheetValues(rows, () => 'תאריך עברי').slice(1);

describe('planSync', () => {
  it('finds nothing to do when both sides match', () => {
    const rows = [appRow()];
    expect(planSync(rows, pushed(rows))).toEqual({ create: [], update: [], conflicts: [], restored: [], invalid: [] });
  });

  it('ignores a change in the derived Hebrew date', () => {
    const rows = [appRow()];
    const sheet = pushed(rows);
    sheet[0][COL.hebrewDate] = 'אחר';
    expect(planSync(rows, sheet).update).toEqual([]);
  });

  it('takes an edit made only in the sheet', () => {
    const rows = [appRow()];
    const sheet = pushed(rows);
    sheet[0][COL.amount] = '150';
    const plan = planSync(rows, sheet);
    expect(plan.update).toHaveLength(1);
    expect(plan.update[0].fields.amount).toBe(150);
  });

  it('leaves an edit made only in the app for the next push', () => {
    const sheet = pushed([appRow()]);
    const plan = planSync([appRow({ amount: 175 })], sheet);
    expect(plan.update).toEqual([]);
    expect(plan.conflicts).toEqual([]);
  });

  it('reports a row edited on both sides and does not touch the app', () => {
    const sheet = pushed([appRow()]);
    sheet[0][COL.amount] = '150';
    const plan = planSync([appRow({ amount: 175 })], sheet);
    expect(plan.update).toEqual([]);
    expect(plan.conflicts).toHaveLength(1);
  });

  it('treats the same edit on both sides as no conflict', () => {
    const sheet = pushed([appRow()]);
    sheet[0][COL.amount] = '175';
    const plan = planSync([appRow({ amount: 175 })], sheet);
    expect(plan.conflicts).toEqual([]);
    expect(plan.update).toEqual([]);
  });

  it('creates rows added to the sheet without an id', () => {
    const newRow = ['', '05/10/2026', '', 'הוצאה', '42.5', 'סופר ומזון', 'חלב', '', '', '', ''];
    const plan = planSync([], [newRow]);
    expect(plan.create).toHaveLength(1);
    expect(plan.create[0].fields).toMatchObject({ date: '2026-10-05', amount: 42.5, type: 'expense' });
  });

  it('never deletes from the app when a row is removed from the sheet', () => {
    const plan = planSync([appRow()], []);
    expect(plan.restored).toHaveLength(1);
    expect(plan.update).toEqual([]);
  });

  it('does not report a transaction that was never in the sheet', () => {
    expect(planSync([appRow({ pushedBefore: false })], []).restored).toEqual([]);
  });

  it('reports a row it cannot read and keeps its content', () => {
    const bad = ['', 'לא תאריך', '', 'הוצאה', 'abc', '', 'משהו', '', '', '', ''];
    const plan = planSync([], [bad]);
    expect(plan.create).toEqual([]);
    expect(plan.invalid[0].cells).toEqual(bad);
    expect(plan.invalid[0].rowNumber).toBe(2);
  });

  it('skips empty rows', () => {
    expect(planSync([], [['', ''], []])).toEqual({ create: [], update: [], conflicts: [], restored: [], invalid: [] });
  });

  it('forgets a row whose transaction was deleted in the app', () => {
    const sheet = pushed([appRow()]);
    const plan = planSync([], sheet);
    expect(plan.create).toEqual([]);
    expect(plan.invalid).toEqual([]);
  });
});

describe('buildSheetValues', () => {
  it('stamps each row and keeps unreadable rows at the bottom', () => {
    const kept = ['', 'x'];
    const values = buildSheetValues([appRow()], () => 'י׳ תשרי', [kept]);
    expect(values).toHaveLength(3);
    expect(values[1][COL.stamp]).toBe(stampOf(appRow()));
    expect(values[1][COL.hebrewDate]).toBe('י׳ תשרי');
    expect(values[2]).toBe(kept);
  });
});
