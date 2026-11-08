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

describe('purchases made of items', () => {
  const cardHeader = ['תאריך עסקה', 'שם בית העסק', '4 ספרות אחרונות של כרטיס האשראי', 'סכום חיוב', 'תאריך חיוב'];
  const uploadForm = async (path, rows) => {
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), 'a');
    const form = new FormData();
    form.append('file', new Blob([XLSX.write(book, { type: 'buffer', bookType: 'xlsx' })]), 'file.xlsx');
    const res = await fetch(base + path, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
    return { status: res.status, body: await res.json() };
  };
  const itemsNamed = async (merchant) => (await call(`/transactions?search=${encodeURIComponent(merchant)}&limit=100`)).body.data;
  const netOf = async (merchant) => (await itemsNamed(merchant)).reduce((s, t) => s + t.amount, 0);

  it('a typed basket and its card line count once, and the items learn the card', async () => {
    const food = categoryId('סופר ומזון');
    const basket = await call('/transactions/basket', {
      method: 'POST',
      body: { merchant: 'מכולת הפריטים', date: '2026-03-10', items: [{ name: 'קורנפלקס', total: 21.9, category: food }, { name: 'חלב', total: 10.1, category: food }] },
    });
    expect(basket.status).toBe(201);

    const preview = await uploadForm('/imports/statement/preview', [cardHeader, ['11/03/2026', 'מכולת הפריטים', '3333', 32, '10/04/2026']]);
    const [row] = preview.body.data.rows;
    expect(row).toMatchObject({ flag: 'items', include: true, itemCount: 2 });
    expect(preview.body.data.summary.linkedPurchases).toBe(1);

    const commit = await call('/imports/statement/commit', { method: 'POST', body: { rows: [{ ...pick(row), purchase: row.purchase }] } });
    expect(commit.body.data).toMatchObject({ created: 0, linked: 1, skipped: 0 });

    const items = await itemsNamed('מכולת הפריטים');
    expect(items).toHaveLength(2);
    expect(await netOf('מכולת הפריטים')).toBeCloseTo(32);
    items.forEach((t) => {
      expect(t.account.last4).toBe('3333');
      expect(t.chargeDate.slice(0, 10)).toBe('2026-04-10');
    });

    const again = await uploadForm('/imports/statement/preview', [cardHeader, ['11/03/2026', 'מכולת הפריטים', '3333', 32, '10/04/2026']]);
    expect(again.body.data.rows[0].flag).toBe('imported');
  });

  it('splits a statement line, keeps its card and total, and importing again adds nothing', async () => {
    const line = ['12/03/2026', 'סופר הפיצול', '3333', 100, '10/04/2026'];
    const preview = await uploadForm('/imports/statement/preview', [cardHeader, line]);
    await call('/imports/statement/commit', { method: 'POST', body: { rows: preview.body.data.rows.map(pick) } });
    const [imported] = await itemsNamed('סופר הפיצול');

    const clothes = categoryId('ביגוד והנעלה');
    const wrong = await call(`/transactions/${imported.id}/split`, { method: 'POST', body: { items: [{ name: 'א', total: 60 }, { name: 'ב', total: 30 }] } });
    expect(wrong.status).toBe(400);

    const split = await call(`/transactions/${imported.id}/split`, { method: 'POST', body: { items: [{ name: 'חולצה', total: 60, category: clothes }, { name: 'לחם', total: 40 }] } });
    expect(split.status).toBe(200);

    const items = await itemsNamed('סופר הפיצול');
    expect(items).toHaveLength(2);
    expect(await netOf('סופר הפיצול')).toBe(100);
    expect(items.find((t) => t.description === 'חולצה').category.id).toBe(clothes);
    expect(items.find((t) => t.description === 'לחם').category.id).toBe(imported.category.id);
    items.forEach((t) => expect(t.account.last4).toBe('3333'));

    expect((await uploadForm('/imports/statement/preview', [cardHeader, line])).body.data.rows[0].flag).toBe('imported');
    expect((await call(`/transactions/${imported.id}/split`, { method: 'POST', body: { items: [{ name: 'א', total: 30 }, { name: 'ב', total: 30 }] } })).status).toBe(409);

    // Deleting the item that holds the fingerprint must not bring the whole line back
    expect((await call(`/transactions/${imported.id}`, { method: 'DELETE' })).status).toBe(204);
    expect((await uploadForm('/imports/statement/preview', [cardHeader, line])).body.data.rows[0].flag).toBe('imported');
  });

  const importLines = async (...lines) => {
    const preview = await uploadForm('/imports/statement/preview', [cardHeader, ...lines]);
    await call('/imports/statement/commit', { method: 'POST', body: { rows: preview.body.data.rows.map(pick) } });
  };
  const scannedReceipt = async () => {
    const user = await mongoose.model('User').findOne({ email: 'cards@example.com' });
    return mongoose.model('Receipt').create({ user: user._id, mimeType: 'image/png' });
  };

  it('a receipt saved after its card line replaces that line, evened out to the charge', async () => {
    const line = ['15/03/2026', 'שופרסל דיל 123', '3333', 150, '10/04/2026'];
    await importLines(line, ['15/03/2026', 'בית מרקחת', '3333', 149, '10/04/2026']);

    const candidates = await call('/transactions/payment-candidates?date=2026-03-15&total=148&merchant=' + encodeURIComponent('שופרסל'));
    expect(candidates.body.data.map((c) => c.description)).toEqual(['שופרסל דיל 123', 'בית מרקחת']);
    expect(candidates.body.data[0]).toMatchObject({ diff: 2, sameMerchant: true });

    const receipt = await scannedReceipt();
    const saved = await call(`/receipts/${receipt.id}/confirm`, {
      method: 'POST',
      body: { merchant: 'שופרסל', date: '2026-03-15', payment: candidates.body.data[0].id, items: [{ name: 'גבינה', total: 100 }, { name: 'לחם', total: 48 }] },
    });
    expect(saved.body.data).toMatchObject({ created: 3, linked: true, adjusted: 2 });

    const items = (await call('/transactions?from=2026-03-15&to=2026-03-15&limit=100')).body.data.filter((t) => t.purchase);
    expect(items.map((t) => t.description).sort()).toEqual(['גבינה', 'הפרש מול החיוב בכרטיס', 'לחם']);
    expect(items.reduce((s, t) => s + t.amount, 0)).toBeCloseTo(150);
    items.forEach((t) => expect(t.account.last4).toBe('3333'));

    const purchase = await call(`/transactions/${items[0].id}/purchase`);
    expect(purchase.body.data).toMatchObject({ total: 150, matched: true });
    expect(purchase.body.data.items).toHaveLength(3);

    expect((await uploadForm('/imports/statement/preview', [cardHeader, line])).body.data.rows[0].flag).toBe('imported');
    // Linked once: the same line cannot take a second receipt
    const again = await call('/transactions/basket', { method: 'POST', body: { date: '2026-03-15', payment: candidates.body.data[0].id, items: [{ name: 'x', total: 150 }] } });
    expect(again.status).toBe(409);
  });

  it('a discount comes off the largest item, and a far amount is refused', async () => {
    await importLines(['18/03/2026', 'ירקן השכונה', '3333', 90, '10/04/2026']);
    expect((await call('/transactions/payment-candidates?date=2026-03-18&total=95')).body.data).toEqual([]);
    const [candidate] = (await call('/transactions/payment-candidates?date=2026-03-18&total=94')).body.data;
    expect(candidate.diff).toBe(-4);

    const far = await call('/transactions/basket', { method: 'POST', body: { date: '2026-03-18', payment: candidate.id, items: [{ name: 'פירות', total: 140 }] } });
    expect(far.status).toBe(409);

    const saved = await call('/transactions/basket', { method: 'POST', body: { date: '2026-03-18', payment: candidate.id, items: [{ name: 'פירות', total: 60 }, { name: 'ירקות', total: 34 }] } });
    expect(saved.body.data).toMatchObject({ created: 2, linked: true });
    const items = (await call('/transactions?from=2026-03-18&to=2026-03-18&limit=100')).body.data;
    expect(items.find((t) => t.description === 'פירות').amount).toBe(56);
    expect(items.reduce((s, t) => s + t.amount, 0)).toBeCloseTo(90);
  });

  it('a close statement line is only offered, and links when the user chooses it', async () => {
    const food = categoryId('סופר ומזון');
    await call('/transactions/basket', {
      method: 'POST',
      body: { merchant: 'מאפיית הקרוב', date: '2026-03-20', items: [{ name: 'עוגה', total: 50, category: food }, { name: 'פיתות', total: 30.5, category: food }] },
    });
    const preview = await uploadForm('/imports/statement/preview', [cardHeader, ['21/03/2026', 'מאפיית הקרוב', '3333', 80, '10/04/2026']]);
    const [row] = preview.body.data.rows;
    expect(row.flag).toBeNull();
    expect(row.include).toBe(true);
    expect(row.suggestion).toMatchObject({ itemCount: 2, total: 80.5, diff: -0.5 });

    const commit = await call('/imports/statement/commit', { method: 'POST', body: { rows: [{ ...pick(row), purchase: row.suggestion.purchase, adjust: true }] } });
    expect(commit.body.data).toMatchObject({ created: 0, linked: 1 });
    expect(await netOf('מאפיית הקרוב')).toBeCloseTo(80);
  });

  it('the same store wins when two purchases have the same total', async () => {
    const body = (merchant) => ({ merchant, date: '2026-03-25', items: [{ name: 'א', total: 20 }, { name: 'ב', total: 25 }] });
    await call('/transactions/basket', { method: 'POST', body: body('קפה גרג') });
    await call('/transactions/basket', { method: 'POST', body: body('פיצה שמש') });
    const preview = await uploadForm('/imports/statement/preview', [cardHeader, ['25/03/2026', 'פיצה שמש סניף 4', '3333', 45, '10/04/2026']]);
    const pizza = (await itemsNamed('פיצה שמש'))[0];
    expect(preview.body.data.rows[0]).toMatchObject({ flag: 'items', purchase: pizza.purchase });
  });

  it('a linked purchase keeps adding up to the card charge when its items change', async () => {
    await importLines(['05/03/2026', 'חנות הכלים', '3333', 100, '10/04/2026']);
    const [line] = (await call('/transactions/payment-candidates?date=2026-03-05&total=100')).body.data;
    await call('/transactions/basket', { method: 'POST', body: { date: '2026-03-05', payment: line.id, items: [{ name: 'פטיש', total: 60 }, { name: 'מסמרים', total: 40 }] } });
    const items = async () => (await call('/transactions?from=2026-03-05&to=2026-03-05&limit=100')).body.data.filter((t) => t.purchase);
    const byName = async (name) => (await items()).find((t) => t.description === name);
    const total = async () => (await items()).reduce((s, t) => s + t.amount, 0);

    expect((await call(`/transactions/${(await byName('פטיש')).id}`, { method: 'PUT', body: { amount: 61 } })).status).toBe(400);
    expect((await call(`/transactions/${(await byName('פטיש')).id}`, { method: 'PUT', body: { amount: 55 } })).status).toBe(200);
    expect((await byName('הפרש מול החיוב בכרטיס')).amount).toBe(5);
    expect(await total()).toBeCloseTo(100);

    const adjustment = await byName('הפרש מול החיוב בכרטיס');
    expect((await call(`/transactions/${adjustment.id}`, { method: 'PUT', body: { amount: 1 } })).status).toBe(409);
    expect((await call(`/transactions/${adjustment.id}`, { method: 'DELETE' })).status).toBe(409);
    expect((await call(`/transactions/${(await byName('פטיש')).id}`, { method: 'PUT', body: { type: 'income' } })).status).toBe(409);

    // Back to the full price: the difference line is no longer needed
    await call(`/transactions/${(await byName('פטיש')).id}`, { method: 'PUT', body: { amount: 60 } });
    expect(await byName('הפרש מול החיוב בכרטיס')).toBeUndefined();

    // Deleting an item: the card still charged it
    expect((await call(`/transactions/${(await byName('מסמרים')).id}`, { method: 'DELETE' })).status).toBe(204);
    expect((await byName('הפרש מול החיוב בכרטיס')).amount).toBe(40);
    expect(await total()).toBeCloseTo(100);
    expect((await uploadForm('/imports/statement/preview', [cardHeader, ['05/03/2026', 'חנות הכלים', '3333', 100, '10/04/2026']])).body.data.rows[0].flag).toBe('imported');

    // Deleting every item removes the purchase, and the line can be imported again
    for (const t of await items()) {
      if (t.description !== 'הפרש מול החיוב בכרטיס') expect((await call(`/transactions/${t.id}`, { method: 'DELETE' })).status).toBe(204);
    }
    expect((await call(`/transactions/${(await byName('הפרש מול החיוב בכרטיס')).id}`, { method: 'DELETE' })).status).toBe(204);
    expect(await items()).toHaveLength(0);
  });

  it('the same receipt saved twice at once is saved once', async () => {
    const receipt = await scannedReceipt();
    const body = { merchant: 'כפול', date: '2026-03-29', items: [{ name: 'סוללות', total: 20 }] };
    const results = await Promise.all([1, 2].map(() => call(`/receipts/${receipt.id}/confirm`, { method: 'POST', body })));
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await itemsNamed('סוללות')).toHaveLength(1);
  });

  it('a receipt whose items fail to save can be saved again', async () => {
    const receipt = await scannedReceipt();
    // A card line that was already broken into items: refused, after nothing was saved
    const linkedLine = (await itemsNamed('גבינה'))[0];
    const failed = await call(`/receipts/${receipt.id}/confirm`, { method: 'POST', body: { date: '2026-03-15', payment: linkedLine.id, items: [{ name: 'x', total: 150 }] } });
    expect(failed.status).toBe(409);
    const saved = await call(`/receipts/${receipt.id}/confirm`, { method: 'POST', body: { date: '2026-03-30', items: [{ name: 'מחברת', total: 12 }] } });
    expect(saved.status).toBe(201);
  });

  it('a receipt of one product is still found by its card line', async () => {
    const receipt = await scannedReceipt();
    await call(`/receipts/${receipt.id}/confirm`, { method: 'POST', body: { merchant: 'אלקטרו בית', date: '2026-03-27', items: [{ name: 'מטען', total: 89.9 }] } });
    const preview = await uploadForm('/imports/statement/preview', [cardHeader, ['28/03/2026', 'אלקטרו בית', '3333', 89.9, '10/04/2026']]);
    expect(preview.body.data.rows[0]).toMatchObject({ flag: 'items', itemCount: 1 });
  });
});

describe('standing orders', () => {
  const recurringManager = require('../src/managers/recurring.manager');
  const { startOfDay, addFrequency } = require('../src/utils/dateUtils');
  const day = (d) => new Date(d).toISOString().slice(0, 10);
  const daysAgo = (n) => day(new Date(Date.now() - n * 86400000));
  const create = async (description, startDate) =>
    (await call('/recurring', { method: 'POST', body: { description, amount: 50, category: categoryId('דיור וחשבונות'), startDate, frequency: 'monthly' } })).body.data;
  const occurrences = async (description) => (await call(`/transactions?search=${encodeURIComponent(description)}&limit=100`)).body.data;

  it('resuming after a pause continues from today, without paying the paused months', async () => {
    const payment = await create('ועד הבית', daysAgo(100));
    await call(`/recurring/${payment.id}`, { method: 'PUT', body: { isActive: false } });
    const resumed = (await call(`/recurring/${payment.id}`, { method: 'PUT', body: { isActive: true } })).body.data;
    expect(new Date(resumed.nextRun) >= startOfDay()).toBe(true);
    const wanted = new Date(payment.nextRun).getUTCDate();
    const next = new Date(resumed.nextRun);
    const lastOfMonth = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
    expect(next.getUTCDate()).toBe(Math.min(wanted, lastOfMonth));
    await recurringManager.processDue();
    const made = await occurrences('ועד הבית');
    expect(made.length).toBeLessThanOrEqual(1);
    made.forEach((t) => expect(new Date(t.date) >= startOfDay()).toBe(true));
  });

  it('"run now" when overdue keeps the day of the month', async () => {
    const payment = await create('גז', daysAgo(5));
    const res = await call(`/recurring/${payment.id}/run`, { method: 'POST', body: { nextRun: payment.nextRun } });
    expect(res.status).toBe(201);
    expect(day(res.body.data.payment.nextRun)).toBe(day(addFrequency(payment.nextRun, 'monthly')));
  });

  it('"run now" and the job at the same moment record the occurrence once', async () => {
    const payment = await create('אינטרנט', daysAgo(1));
    await Promise.all([call(`/recurring/${payment.id}/run`, { method: 'POST', body: { nextRun: payment.nextRun } }), recurringManager.processDue()]);
    expect(await occurrences('אינטרנט')).toHaveLength(1);
  });

  it('a double tap on "run now" pays once', async () => {
    const payment = await create('חשמל', day(new Date(Date.now() + 10 * 86400000)));
    const tap = () => call(`/recurring/${payment.id}/run`, { method: 'POST', body: { nextRun: payment.nextRun } });
    expect((await tap()).status).toBe(201);
    expect((await tap()).status).toBe(409);
    expect(await occurrences('חשמל')).toHaveLength(1);
  });

  it('a payment on the 31st goes back to the 31st after a short month', () => {
    const payment = { frequency: 'monthly', dayOfMonth: 31 };
    const feb = addFrequency(new Date('2026-01-31T00:00:00Z'), 'monthly', payment.dayOfMonth);
    expect(day(feb)).toBe('2026-02-28');
    expect(day(addFrequency(feb, 'monthly', payment.dayOfMonth))).toBe('2026-03-31');
  });
});

describe('categories from a household summary sheet', () => {
  const sheet = [
    ['הוצאות', '', '', '', '', '', 'הכנסות'],
    ['חודש', 'שכירות', 'אוכל ', 'מעשר', 'סה"כ', '', 'חודש', 'הכנסה קבועה', 'קצבת ילדים', 'סה"כ', '', 'חודש', 'סכום'],
    ['תשרי', 3000, 800, 1400, 5200, '', 'תשרי', 12000, 115, 12115, '', 'תשרי', 6915],
  ];
  const importSheet = async () => {
    const reg = await call('/auth/register', { method: 'POST', bearer: null, body: { name: 'קטגוריות', email: 'cats@example.com', password: 'Secret123' } });
    const own = reg.body.data.token;
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(sheet), 'a');
    const form = new FormData();
    form.append('file', new Blob([XLSX.write(book, { type: 'buffer', bookType: 'xlsx' })]), 'summary.xlsx');
    const res = await fetch(`${base}/categories/import/preview`, { method: 'POST', headers: { Authorization: `Bearer ${own}` }, body: form });
    return { own, preview: (await res.json()).data };
  };

  it('replaces unused defaults, keeps what is used, and maaser keeps its role', async () => {
    const { own, preview } = await importSheet();
    expect(preview).toMatchObject({ expense: ['שכירות', 'אוכל', 'מעשר'], income: ['הכנסה קבועה', 'קצבת ילדים'] });
    expect(preview.removed).toContain('סופר ומזון');
    expect(preview.removed).not.toContain('צדקה ומעשרות');
    expect(preview.removed).not.toContain('אחר');

    // A default that is in use must survive
    const before = (await call('/categories', { bearer: own })).body.data;
    const salary = before.find((c) => c.name === 'משכורת');
    await call('/transactions', { method: 'POST', bearer: own, body: { type: 'income', amount: 10, category: salary.id, description: 'משכורת', date: '2026-03-01' } });

    const res = await call('/categories/import/commit', { method: 'POST', bearer: own, body: { expense: preview.expense, income: preview.income } });
    expect(res.status).toBe(200);

    const after = (await call('/categories', { bearer: own })).body.data;
    const names = after.map((c) => c.name);
    expect(names).toEqual(expect.arrayContaining(['שכירות', 'אוכל', 'מעשר', 'הכנסה קבועה', 'קצבת ילדים', 'משכורת', 'אחר']));
    expect(names).not.toContain('סופר ומזון');
    expect(names).not.toContain('סכום');
    expect(after.filter((c) => c.isMaaser).map((c) => c.name)).toEqual(['מעשר']);
    expect(after.filter((c) => c.name === 'מעשר')).toHaveLength(1);

    // Maaser still works, in the renamed category
    const donated = await call('/maaser/donations', { method: 'POST', bearer: own, body: { recipient: 'בדיקה', amount: 50, date: '2026-03-02' } });
    expect(donated.status).toBe(201);
    expect(donated.body.data.category.name ?? after.find((c) => c.id === donated.body.data.category)?.name).toBe('מעשר');

    // Running it again changes nothing
    const again = await call('/categories/import/commit', { method: 'POST', bearer: own, body: { expense: preview.expense, income: preview.income } });
    expect(again.body.data.created).toBe(0);
  });
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
    expect(res.body.data).toEqual({ created: 4, linked: 0, skipped: 0 });

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
    expect(res.body.data).toEqual({ created: 0, linked: 0, skipped: 4 });
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
