/**
 * Credit cards, statement import and two-factor login against a real (in-memory) MongoDB.
 */
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const XLSX = require('xlsx');

jest.mock('../src/config/mailer', () => ({ isSmtpConfigured: false, transporter: null }));
jest.mock('../src/services/email.service', () => ({
  sendWelcome: jest.fn(),
  sendBudgetAlert: jest.fn(),
  sendMonthlySummary: jest.fn(),
  sendVerificationCode: jest.fn(),
  sendPasswordReset: jest.fn(),
}));

const app = require('../src/app');
const totp = require('../src/utils/totp');

jest.setTimeout(60000);

let mongo;
let server;
let base;
let token;
let categories;

const call = async (path, { method = 'GET', body, bearer = token, cookie } = {}) => {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}), ...(cookie ? { Cookie: cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null, setCookie: res.headers.get('set-cookie') };
};

const upload = async (rows, name = 'statement.xlsx') => {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), 'a');
  const form = new FormData();
  form.append('file', new Blob([XLSX.write(book, { type: 'buffer', bookType: 'xlsx' })]), name);
  const res = await fetch(`${base}/imports/statement/preview`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
  return { status: res.status, body: await res.json() };
};

const pick = ({ type, amount, category, account, description, date, chargeDate, notes, last4, isRefund, standing, importHash }) => ({
  type, amount, category, account, description, date, chargeDate, notes, last4, isRefund, standing, importHash,
});

const categoryId = (name, type = 'expense') => categories.find((c) => c.name === name && c.type === type).id;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await mongoose.model('Transaction').init(); // the unique index must exist before the first import
  await new Promise((resolve) => {
    server = app.listen(0, resolve);
  });
  base = `http://127.0.0.1:${server.address().port}/api`;
  const reg = await call('/auth/register', { method: 'POST', bearer: null, body: { name: 'בדיקה', email: 'cards@example.com', password: 'Secret123' } });
  token = reg.body.data.token;
  categories = (await call('/categories')).body.data;
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
  await mongo.stop();
});

describe('credit cards', () => {
  let card;

  it('opens a card and refuses a full card number', async () => {
    expect((await call('/accounts', { method: 'POST', body: { name: 'ויזה', last4: '4580123412341234' } })).status).toBe(400);
    const res = await call('/accounts', { method: 'POST', body: { name: 'ויזה', kind: 'credit', last4: '1111', billingDay: 10 } });
    expect(res.status).toBe(201);
    card = res.body.data;
  });

  it('works out the charge date from the billing day', async () => {
    const res = await call('/transactions', {
      method: 'POST',
      body: { type: 'expense', amount: 200, date: '2026-10-15', description: 'קנייה', category: categoryId('סופר ומזון'), account: card.id },
    });
    expect(res.status).toBe(201);
    expect(res.body.data.chargeDate.slice(0, 10)).toBe('2026-11-10');
    expect(res.body.data.account.name).toBe('ויזה');
  });

  it("refuses another user's card", async () => {
    const res = await call('/transactions', {
      method: 'POST',
      body: { type: 'expense', amount: 1, date: '2026-10-15', description: 'x', category: categoryId('אחר'), account: new mongoose.Types.ObjectId().toString() },
    });
    expect(res.status).toBe(404);
  });

  it('sums the month per card, in either calendar', async () => {
    const gregorian = (await call('/accounts/overview?calendar=gregorian&date=2026-10-15')).body.data;
    expect(gregorian.period.label).toBe('אוקטובר 2026');
    expect(gregorian.accounts[0]).toMatchObject({ name: 'ויזה', spent: 200, count: 1 });
    expect(gregorian.accounts[0].categories[0].name).toBe('סופר ומזון');

    // 15.10.2026 is in Tishrei; 1.10.2026 is in Elul, a different Hebrew month
    const hebrew = (await call('/accounts/overview?calendar=hebrew&date=2026-10-15')).body.data;
    expect(hebrew.period.calendar).toBe('hebrew');
    expect(hebrew.accounts[0].spent).toBe(200);
  });

  it('filters transactions and totals by card', async () => {
    await call('/transactions', { method: 'POST', body: { type: 'expense', amount: 30, date: '2026-10-15', description: 'מזומן', category: categoryId('אחר') } });
    const res = await call(`/transactions?account=${card.id}`);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta.totals.expense).toBe(200);
  });

  it('lists what each charge date took', async () => {
    const res = await call(`/accounts/${card.id}/charges`);
    expect(res.body.data[0]).toMatchObject({ total: 200, count: 1 });
  });

  it('shows the split by card in the month report', async () => {
    const report = (await call('/reports/monthly?calendar=gregorian&date=2026-10-15')).body.data;
    const names = report.summary.byAccount.map((a) => a.name);
    expect(names).toEqual(expect.arrayContaining(['ויזה', 'ללא אמצעי תשלום']));
  });

  it('keeps the transactions when a card is removed', async () => {
    const other = (await call('/accounts', { method: 'POST', body: { name: 'זמני' } })).body.data;
    const tx = (await call('/transactions', { method: 'POST', body: { type: 'expense', amount: 5, date: '2026-10-16', description: 'נשאר', category: categoryId('אחר'), account: other.id } })).body.data;
    expect((await call(`/accounts/${other.id}`, { method: 'DELETE' })).status).toBe(204);
    const after = (await call(`/transactions/${tx.id}`)).body.data;
    expect(after.description).toBe('נשאר');
    expect(after.account).toBeUndefined();
  });
});

describe('statement import', () => {
  const statement = [
    ['תאריך עסקה', 'שם בית העסק', '4 ספרות אחרונות של כרטיס האשראי', 'סכום חיוב', 'תאריך חיוב'],
    ['03/08/2026', 'רמי לוי', '2222', 300, '10/09/2026'],
    ['04/08/2026', 'קפה', '2222', 12, '10/09/2026'],
    ['04/08/2026', 'קפה', '2222', 12, '10/09/2026'],
    ['05/08/2026', 'רמי לוי', '2222', -50, '10/09/2026'],
  ];

  it('shows the lines without saving anything', async () => {
    const { status, body } = await upload(statement);
    expect(status).toBe(200);
    expect(body.data.kind).toBe('credit');
    expect(body.data.summary).toMatchObject({ total: 4, included: 4 });
    expect(body.data.newCards).toEqual(['2222']);
    expect(body.data.rows[0].category).toBe(categoryId('סופר ומזון'));
    expect((await call('/transactions?from=2026-08-01&to=2026-08-31')).body.data).toHaveLength(0);
  });

  it('saves them, opens the new card and uses the charge date from the file', async () => {
    const { body } = await upload(statement);
    const res = await call('/imports/statement/commit', { method: 'POST', body: { rows: body.data.rows.map(pick) } });
    expect(res.status).toBe(201);
    expect(res.body.data).toEqual({ created: 4, skipped: 0 });

    const accounts = (await call('/accounts')).body.data;
    const card = accounts.find((a) => a.last4 === '2222');
    expect(card.kind).toBe('credit');
    const saved = (await call(`/transactions?account=${card.id}`)).body.data;
    expect(saved).toHaveLength(4);
    expect(saved[0].chargeDate.slice(0, 10)).toBe('2026-09-10');
  });

  it('adds nothing when the same file comes again', async () => {
    const { body } = await upload(statement);
    expect(body.data.summary).toMatchObject({ included: 0, imported: 4 });
    // Even if the client sends the lines anyway
    const res = await call('/imports/statement/commit', { method: 'POST', body: { rows: body.data.rows.map(pick) } });
    expect(res.body.data).toEqual({ created: 0, skipped: 4 });
  });

  it('a duplicate that slips past the check is still stopped by the database', async () => {
    const hash = 'd'.repeat(64);
    const doc = (importHash) => ({ type: 'expense', amount: 1, category: categoryId('אחר'), description: 'מרוץ', date: '2026-08-20', importHash });
    const userId = (await call('/auth/me')).body.data.user.id;
    const repository = require('../src/repositories/transaction.repository');
    const known = jest.spyOn(repository, 'existingImportHashes').mockResolvedValue(new Set());
    try {
      const first = await repository.createManySkippingDuplicates(userId, [doc(hash)]);
      expect(first).toHaveLength(1);
      const mixed = await repository.createManySkippingDuplicates(userId, [doc(hash), doc('e'.repeat(64))]);
      expect(mixed).toHaveLength(1);
      expect(await repository.createManySkippingDuplicates(userId, [doc(hash)])).toEqual([]);
    } finally {
      known.mockRestore();
    }
  });

  it('remembers the category the user chose for a merchant', async () => {
    await call('/transactions', { method: 'POST', body: { type: 'expense', amount: 80, date: '2026-07-01', description: 'החנות של יוסי', category: categoryId('ביגוד והנעלה') } });
    const { body } = await upload([['תאריך', 'תיאור', 'חובה', 'זכות'], ['01/08/2026', 'החנות של יוסי', '90', '']]);
    expect(body.data.rows[0].category).toBe(categoryId('ביגוד והנעלה'));
  });

  it('switches off the card lump sum in a bank statement', async () => {
    const { body } = await upload([['תאריך', 'תיאור', 'חובה', 'זכות', 'יתרה'], ['10/09/2026', 'ישראכרט', '262', '', '1000'], ['11/09/2026', 'העברה למיכאל', '100', '', '900']]);
    const [settlement, transfer] = body.data.rows;
    expect(settlement).toMatchObject({ include: false, flag: 'settlement' });
    expect(transfer).toMatchObject({ include: true, flag: null });
  });

  it('switches off a line the app already recorded as a standing order', async () => {
    const payment = (await call('/recurring', {
      method: 'POST',
      body: { description: 'ועד בית', amount: 275, category: categoryId('דיור וחשבונות'), frequency: 'monthly', startDate: '2026-06-01' },
    })).body.data;
    await call(`/recurring/${payment.id}/run`, { method: 'POST' });
    const today = new Date();
    const dd = String(today.getUTCDate()).padStart(2, '0');
    const mm = String(today.getUTCMonth() + 1).padStart(2, '0');
    const { body } = await upload([['תאריך', 'תיאור', 'חובה', 'זכות'], [`${dd}/${mm}/${today.getUTCFullYear()}`, 'הו"ק ועד הבית', '275', '']]);
    expect(body.data.rows[0]).toMatchObject({ include: false, flag: 'duplicate', standing: true });
    expect(body.data.rows[0].duplicateOf.description).toBe('ועד בית');
  });

  it('owes no maaser on a refund, but does on income', async () => {
    const res = await call('/maaser?calendar=gregorian&date=2026-08-15');
    expect(res.body.data.income).toBe(0);
    const report = (await call('/reports/monthly?calendar=gregorian&date=2026-08-15')).body.data;
    expect(report.totals.income).toBe(50);
  });

  it('refuses a file that is not a statement', async () => {
    const { status } = await upload([['שם', 'גיל'], ['דנה', 30]]);
    expect(status).toBe(400);
  });
});

describe('two-factor login', () => {
  const EMAIL = '2fa@example.com';
  const PASSWORD = 'Secret123';
  let myToken;
  let secret;
  let backupCodes;

  const login = () => call('/auth/login', { method: 'POST', bearer: null, body: { email: EMAIL, password: PASSWORD } });
  const nextCode = (offsetSteps = 0) => totp.codeAt(secret, totp.stepOf() + offsetSteps);

  beforeAll(async () => {
    myToken = (await call('/auth/register', { method: 'POST', bearer: null, body: { name: 'בדיקה', email: EMAIL, password: PASSWORD } })).body.data.token;
  });

  it('asks for the password before showing a secret', async () => {
    expect((await call('/auth/2fa/setup', { method: 'POST', bearer: myToken, body: { password: 'wrong-pass1' } })).status).toBe(400);
    const res = await call('/auth/2fa/setup', { method: 'POST', bearer: myToken, body: { password: PASSWORD } });
    expect(res.status).toBe(200);
    expect(res.body.data.qr).toMatch(/^data:image\/png/);
    secret = res.body.data.secret;
  });

  it('stores the secret encrypted', async () => {
    const stored = await mongoose.model('User').findOne({ email: EMAIL }).select('+twoFactor').lean();
    expect(stored.twoFactor.secret).not.toContain(secret);
  });

  it('turns on only with a correct code, and never exposes secrets', async () => {
    expect((await call('/auth/2fa/enable', { method: 'POST', bearer: myToken, body: { code: '000000' } })).status).toBe(400);
    const res = await call('/auth/2fa/enable', { method: 'POST', bearer: myToken, body: { code: nextCode(-1) } });
    expect(res.status).toBe(200);
    expect(res.body.data.user.twoFactorEnabled).toBe(true);
    expect(res.body.data.user.twoFactor).toBeUndefined();
    backupCodes = res.body.data.backupCodes;
    expect(backupCodes).toHaveLength(8);
  });

  it('a password alone gives no session', async () => {
    const res = await login();
    expect(res.status).toBe(200);
    expect(res.body.data.twoFactorRequired).toBe(true);
    expect(res.body.data.token).toBeUndefined();
    expect(res.setCookie).toBeNull();
  });

  it('the challenge does not open the API', async () => {
    const { challenge } = (await login()).body.data;
    expect((await call('/auth/me', { bearer: challenge })).status).toBe(401);
  });

  it('a code finishes the login once and cannot be replayed', async () => {
    const { challenge } = (await login()).body.data;
    const code = nextCode(0);
    const ok = await call('/auth/login/2fa', { method: 'POST', bearer: null, body: { challenge, code } });
    expect(ok.status).toBe(200);
    expect(ok.body.data.token).toBeTruthy();
    expect(ok.body.data.refreshToken).toBeUndefined();
    expect(ok.setCookie).toMatch(/sh_refresh=.*HttpOnly/i);
    expect((await call('/auth/login/2fa', { method: 'POST', bearer: null, body: { challenge, code } })).status).toBe(401);
  });

  it('a backup code works once', async () => {
    const { challenge } = (await login()).body.data;
    expect((await call('/auth/login/2fa', { method: 'POST', bearer: null, body: { challenge, code: backupCodes[0] } })).status).toBe(200);
    expect((await call('/auth/login/2fa', { method: 'POST', bearer: null, body: { challenge, code: backupCodes[0] } })).status).toBe(401);
  });
});

describe('account lockout', () => {
  const EMAIL = 'lock@example.com';
  const attempt = (password) => call('/auth/login', { method: 'POST', bearer: null, body: { email: EMAIL, password } });

  it('locks after repeated failures, answering just like a wrong password', async () => {
    await call('/auth/register', { method: 'POST', bearer: null, body: { name: 'בדיקה', email: EMAIL, password: 'Secret123' } });
    for (let i = 0; i < 5; i += 1) expect((await attempt('Wrong1234')).status).toBe(401);
    const locked = await attempt('Secret123');
    expect(locked.status).toBe(401);
    expect(locked.body.message).toBe((await attempt('Wrong1234')).body.message);
  });
});
