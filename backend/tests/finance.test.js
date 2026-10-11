const { calcHealthScore, calcForecast, calcGoalProgress, totalsByType, percentChange } = require('../src/utils/finance');

describe('totalsByType', () => {
  it('sums income and expenses separately', () => {
    const totals = totalsByType([
      { type: 'income', amount: 1000 },
      { type: 'expense', amount: 250.5 },
      { type: 'expense', amount: 49.5 },
    ]);
    expect(totals).toEqual({ income: 1000, expense: 300, balance: 700 });
  });
});

describe('percentChange', () => {
  it('returns null when there is no baseline', () => expect(percentChange(100, 0)).toBeNull());
  it('calculates growth', () => expect(percentChange(150, 100)).toBe(50));
});

describe('calcHealthScore', () => {
  it('gives 60 to an account with no savings but no budget or trend problems', () => {
    const { score, level } = calcHealthScore({ income: 0, expense: 0 });
    expect(score).toBe(60);
    expect(level).toBe('good');
  });

  it('gives 100 when 20% is saved, budgets are kept and expenses are stable', () => {
    const { score } = calcHealthScore({
      income: 10000,
      expense: 8000,
      budgets: [{ amount: 500, spent: 400 }],
      previousExpenses: [8200, 8100],
    });
    expect(score).toBe(100);
  });

  it('lowers the budget factor when budgets are exceeded', () => {
    const { factors } = calcHealthScore({
      income: 10000,
      expense: 8000,
      budgets: [{ amount: 500, spent: 600 }, { amount: 500, spent: 100 }],
    });
    expect(factors.find((f) => f.key === 'budget').value).toBe(50);
  });

  it('lowers the trend factor when expenses jump', () => {
    const { factors } = calcHealthScore({ income: 10000, expense: 6000, previousExpenses: [4000, 4000] });
    expect(factors.find((f) => f.key === 'trend').value).toBe(0);
  });
});

describe('calcForecast', () => {
  it('extends the daily average when there is no history', () => {
    const forecast = calcForecast({ income: 9000, expense: 3000, dayOfMonth: 10, totalDays: 30, upcomingExpense: 500 });
    expect(forecast.dailyAverage).toBe(300);
    expect(forecast.projectedExpense).toBe(9500);
    expect(forecast.projectedBalance).toBe(-500);
    expect(forecast.basedOnHistory).toBe(false);
  });

  it('uses the typical rest-of-month figures when history exists', () => {
    const forecast = calcForecast({
      income: 9800,
      expense: 7000,
      dayOfMonth: 5,
      totalDays: 31,
      expected: { income: 14500, expense: 4500 },
      upcomingExpense: 300,
    });
    expect(forecast.projectedExpense).toBe(11500);
    expect(forecast.projectedIncome).toBe(24300);
    expect(forecast.projectedBalance).toBe(12800);
  });
});

describe('calcGoalProgress', () => {
  const now = new Date('2026-06-01T00:00:00Z');
  const base = { targetAmount: 1000, createdAt: new Date('2026-01-01T00:00:00Z'), targetDate: new Date('2026-12-31T00:00:00Z') };

  it('marks a goal as behind when savings lag the elapsed time', () => {
    expect(calcGoalProgress({ ...base, currentAmount: 100 }, now).status).toBe('behind');
  });
  it('marks a goal as on track when savings keep up', () => {
    expect(calcGoalProgress({ ...base, currentAmount: 600 }, now).status).toBe('on_track');
  });
  it('marks a full goal as completed', () => {
    const progress = calcGoalProgress({ ...base, currentAmount: 1000 }, now);
    expect(progress.status).toBe('completed');
    expect(progress.percent).toBe(100);
  });
});
