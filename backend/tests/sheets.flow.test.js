/**
 * The Google Sheets sync end to end against a real (in-memory) MongoDB, with
 * Google itself replaced by an in-memory spreadsheet.
 */
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

jest.mock('../src/config/mailer', () => ({ isSmtpConfigured: false, transporter: null }));
jest.mock('../src/services/email.service', () => ({ sendWelcome: jest.fn(), sendBudgetAlert: jest.fn() }));

const mockTabs = {};
jest.mock('../src/services/googleSheets.service', () => ({
  isConfigured: () => true,
  serviceEmail: () => 'robot@example.iam.gserviceaccount.com',
  client: {
    title: async () => 'בדיקה',
    ensureTabs: async () => {},
    read: async (_id, tab) => mockTabs[tab] || [],
    replace: async (_id, tab, values) => {
      mockTabs[tab] = values;
    },
  },
}));

const app = require('../src/app');
const { COL } = require('../src/utils/sheetSync');

jest.setTimeout(60000);

const SHEET_ID = 'abcdefghijklmnopqrstuvwxyz';
const TAB = 'עסקאות';
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

const categoryId = (name, type = 'expense') => categories.find((c) => c.name === name && c.type === type).id;

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
    body: JSON.stringify({ name: 'בדיקה', email: 'sheets@example.com', password: 'Secret123' }),
  }).then((r) => r.json());
  token = reg.data.token;
  categories = (await call('/categories')).body.data;
  await call('/transactions', { method: 'POST', body: { type: 'expense', amount: 100, date: '2026-10-05', description: 'קנייה', category: categoryId('סופר ומזון') } });
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
  await mongo.stop();
});

const rowOf = (description) => mockTabs[TAB].find((r) => r[COL.description] === description);

describe('backup mode', () => {
  it('takes a link and refuses something that is not one', async () => {
    expect((await call('/sheets/connect', { method: 'POST', body: { spreadsheet: 'not a link!' } })).status).toBe(400);
    const res = await call('/sheets/connect', { method: 'POST', body: { spreadsheet: `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit#gid=0` } });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ connected: true, spreadsheetId: SHEET_ID, mode: 'backup' });
  });

  it('writes the transactions and a month summary', async () => {
    expect((await call('/sheets/sync', { method: 'POST' })).body.data.pushed).toBe(1);
    expect(rowOf('קנייה')[COL.amount]).toBe(100);
    expect(rowOf('קנייה')[COL.hebrewDate]).toBeTruthy();
    expect(mockTabs['סיכום חודשי'][0][0]).toBe('חודש');
    expect(mockTabs['סיכום חודשי'].length).toBeGreaterThan(1);
  });

  it('overwrites edits made in the sheet', async () => {
    rowOf('קנייה')[COL.amount] = '999';
    expect((await call('/sheets/sync', { method: 'POST' })).body.data.updated).toBe(0);
    expect(rowOf('קנייה')[COL.amount]).toBe(100);
    expect((await call('/transactions')).body.data[0].amount).toBe(100);
  });
});

describe('two-way mode', () => {
  beforeAll(() => call('/sheets', { method: 'PATCH', body: { mode: 'two-way' } }));

  it('previews without changing anything', async () => {
    rowOf('קנייה')[COL.amount] = '120';
    const res = await call('/sheets/preview');
    expect(res.body.data.toUpdate).toHaveLength(1);
    expect((await call('/transactions')).body.data[0].amount).toBe(100);
  });

  it('brings in an edit and a new row, then gives the new row its id', async () => {
    mockTabs[TAB].push(['', '06/10/2026', '', 'הוצאה', '42.5', 'סופר ומזון', 'חלב', '', '', '', '']);
    const res = await call('/sheets/sync', { method: 'POST' });
    expect(res.body.data).toMatchObject({ created: 1, updated: 1 });
    const list = (await call('/transactions')).body.data;
    expect(list.find((t) => t.description === 'קנייה').amount).toBe(120);
    expect(list.find((t) => t.description === 'חלב').amount).toBe(42.5);
    expect(rowOf('חלב')[COL.id]).toBeTruthy();
    // A second sync finds nothing new
    expect((await call('/sheets/sync', { method: 'POST' })).body.data).toMatchObject({ created: 0, updated: 0 });
  });

  it('the app wins when both sides changed, and says so', async () => {
    const tx = (await call('/transactions')).body.data.find((t) => t.description === 'קנייה');
    rowOf('קנייה')[COL.amount] = '555';
    await call(`/transactions/${tx.id}`, { method: 'PUT', body: { amount: 130 } });
    const res = await call('/sheets/sync', { method: 'POST' });
    expect(res.body.data.conflicts).toHaveLength(1);
    expect((await call(`/transactions/${tx.id}`)).body.data.amount).toBe(130);
    expect(rowOf('קנייה')[COL.amount]).toBe(130);
  });

  it('deleting a row in the sheet deletes nothing from the app, and the row comes back', async () => {
    mockTabs[TAB] = mockTabs[TAB].filter((r) => r[COL.description] !== 'חלב');
    const res = await call('/sheets/sync', { method: 'POST' });
    expect(res.body.data.restored.map((r) => r.description)).toEqual(['חלב']);
    expect(rowOf('חלב')).toBeTruthy();
  });

  it('keeps rows it cannot read in the sheet, and reports them', async () => {
    mockTabs[TAB].push(['', 'מחר', '', 'הוצאה', 'הרבה', 'סופר ומזון', 'לא ברור', '', '', '', '']);
    mockTabs[TAB].push(['', '07/10/2026', '', 'הוצאה', '10', 'קטגוריה שלא קיימת', 'בלי קטגוריה', '', '', '', '']);
    const res = await call('/sheets/sync', { method: 'POST' });
    expect(res.body.data.invalid).toHaveLength(2);
    expect(rowOf('לא ברור')).toBeTruthy();
    expect(rowOf('בלי קטגוריה')).toBeTruthy();
  });

  it('a transaction deleted in the app leaves the sheet too', async () => {
    const tx = (await call('/transactions')).body.data.find((t) => t.description === 'חלב');
    await call(`/transactions/${tx.id}`, { method: 'DELETE' }).catch(() => {});
    await call('/sheets/sync', { method: 'POST' });
    expect(rowOf('חלב')).toBeUndefined();
  });
});

describe('catching up after the server was off', () => {
  const sheetsManager = require('../src/managers/sheets.manager');

  it('skips a spreadsheet synced recently and syncs one that missed its night', async () => {
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
    expect(await sheetsManager.syncAll({ olderThan: hourAgo })).toEqual({ users: 0, synced: 0 });
    const missed = await sheetsManager.syncAll({ olderThan: new Date(Date.now() + 60 * 1000) });
    expect(missed).toEqual({ users: 1, synced: 1 });
  });
});

describe('text from the sheet', () => {
  it('a description that looks like a formula stays plain text in the app', async () => {
    mockTabs[TAB].push(['', '08/10/2026', '', 'הוצאה', '5', 'סופר ומזון', '=IMPORTXML("http://evil")', '', '', '', '']);
    await call('/sheets/sync', { method: 'POST' });
    const list = (await call('/transactions')).body.data;
    expect(list.some((t) => t.description === '=IMPORTXML("http://evil")')).toBe(true);
  });
});
