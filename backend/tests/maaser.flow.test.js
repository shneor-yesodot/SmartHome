/**
 * Maaser against a real (in-memory) MongoDB: the monthly target (percent or
 * fixed), donations, the balance carried between months and the report summary.
 */
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

// No SMTP: new accounts are logged in right away
jest.mock('../src/config/mailer', () => ({ isSmtpConfigured: false, transporter: null }));
jest.mock('../src/services/email.service', () => ({
  sendWelcome: jest.fn(),
  sendBudgetAlert: jest.fn(),
  sendMonthlySummary: jest.fn(),
  sendVerificationCode: jest.fn(),
  sendPasswordReset: jest.fn(),
}));

const app = require('../src/app');

jest.setTimeout(60000);

let mongo;
let server;
let base;
let token;
let categories;

const call = async (path, { method = 'GET', body } = {}) => {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json() };
};

const addTransaction = (type, amount, date, categoryName) =>
  call('/transactions', {
    method: 'POST',
    body: { type, amount, date, description: categoryName, category: categories.find((c) => c.name === categoryName && c.type === type).id },
  });

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await new Promise((resolve) => {
    server = app.listen(0, resolve);
  });
  base = `http://127.0.0.1:${server.address().port}/api`;

  const reg = await fetch(`${base}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'משפחת בדיקה', email: 'maaser@example.com', password: 'Secret123' }),
  }).then((r) => r.json());
  token = reg.data.token;
  categories = (await call('/categories')).body.data;

  // September: 10,000 income, 600 given. October: 20,000 income, 2,500 given.
  await addTransaction('income', 10000, '2026-09-05', 'משכורת');
  await addTransaction('income', 20000, '2026-10-05', 'משכורת');
  await addTransaction('expense', 300, '2026-10-07', 'סופר ומזון'); // not a donation
  await call('/maaser/donations', { method: 'POST', body: { recipient: 'קופת העיר', amount: 600, date: '2026-09-20' } });
  await call('/maaser/donations', { method: 'POST', body: { recipient: 'ישיבה', amount: 1500, date: '2026-10-10' } });
  await call('/maaser/donations', { method: 'POST', body: { recipient: 'קופת העיר', amount: 1000, date: '2026-10-20' } });
  await call('/maaser/settings', { method: 'PUT', body: { startDate: '2026-09-01' } });
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
  await mongo.stop();
});

test('new accounts get the maaser category', () => {
  expect(categories.some((c) => c.name === 'צדקה ומעשרות' && c.isMaaser)).toBe(true);
});

test('10% of income, with last month carried over', async () => {
  const { body } = await call('/maaser?calendar=gregorian&date=2026-10-15');
  expect(body.data).toMatchObject({ income: 20000, target: 2000, given: 2500, carryOver: 400, remaining: -100 });
  expect(body.data.byRecipient).toEqual([
    { recipient: 'ישיבה', total: 1500, count: 1 },
    { recipient: 'קופת העיר', total: 1000, count: 1 },
  ]);
  expect(body.data.donations).toHaveLength(2);
});

test('a month with no income owes only the balance', async () => {
  const { body } = await call('/maaser?calendar=gregorian&date=2026-11-15');
  expect(body.data).toMatchObject({ target: 0, given: 0, carryOver: -100, remaining: -100 });
  const sep = body.data.history.find((h) => h.key === '2026-09-01');
  expect(sep).toMatchObject({ income: 10000, target: 1000, given: 600 });
});

test('months before the start date are not owed', async () => {
  await call('/maaser/settings', { method: 'PUT', body: { startDate: '2026-10-01' } });
  const { body } = await call('/maaser?calendar=gregorian&date=2026-10-15');
  expect(body.data.carryOver).toBe(0);
  await call('/maaser/settings', { method: 'PUT', body: { startDate: '2026-09-01' } });
});

test('a fixed monthly amount', async () => {
  const saved = await call('/maaser/settings', { method: 'PUT', body: { mode: 'fixed', amount: 2000 } });
  expect(saved.body.data).toMatchObject({ mode: 'fixed', amount: 2000, percent: 10 });
  const { body } = await call('/maaser?calendar=gregorian&date=2026-11-15');
  // Sep: 2000 - 600, Oct: 2000 - 2500, Nov: 2000 still to give
  expect(body.data).toMatchObject({ target: 2000, carryOver: 900, remaining: 2900 });
  await call('/maaser/settings', { method: 'PUT', body: { mode: 'percent' } });
});

test('Hebrew months work the same way', async () => {
  const { body } = await call('/maaser?calendar=hebrew&date=2026-10-20');
  expect(body.data.period.label).toBe('חשוון תשפ״ז'); // 12.10 - 10.11
  expect(body.data.given).toBe(1000);
});

test('the report summary lists donations apart from daily expenses', async () => {
  const { body } = await call('/reports/monthly?calendar=gregorian&date=2026-10-15');
  const { totals, donations } = body.data.summary;
  expect(totals).toMatchObject({ donations: 2500, dailyExpenses: 300, expense: 2800 });
  expect(donations.map((d) => d.recipient)).toEqual(['ישיבה', 'קופת העיר']);
});

test('invalid input is rejected', async () => {
  expect((await call('/maaser/settings', { method: 'PUT', body: { mode: 'weekly' } })).status).toBe(400);
  expect((await call('/maaser/settings', { method: 'PUT', body: { percent: 0 } })).status).toBe(400);
  expect((await call('/maaser/donations', { method: 'POST', body: { amount: 50, date: '2026-10-01' } })).status).toBe(400);
});
