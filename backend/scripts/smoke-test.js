/**
 * End-to-end smoke test of the whole API.
 *
 * Requirements: the server is running and the demo data is loaded (npm run seed).
 * Usage:        npm run smoke          (or: API_URL=http://host:5000/api npm run smoke)
 * Note:         the test changes the demo data - run "npm run seed" again afterwards.
 *
 * Every line prints the HTTP status and the key fields of the answer, so the
 * output can be compared with the scenarios table in docs/project-book.md.
 */
const BASE = process.env.API_URL || 'http://localhost:5000/api';
const DEMO = { email: 'demo@smarthome.co.il', password: 'Demo1234' };
let token = '';
const call = async (method, path, body, tok = token, raw = false) => {
  const opts = { method, headers: { Authorization: `Bearer ${tok}` } };
  if (body instanceof FormData) opts.body = body;
  else if (body) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
  const res = await fetch(BASE + path, opts);
  if (raw) return { status: res.status, buf: Buffer.from(await res.arrayBuffer()), headers: res.headers };
  const text = await res.text();
  return { status: res.status, ...(text ? JSON.parse(text) : {}) };
};
const log = (label, v) => console.log(label.padEnd(34), typeof v === 'string' ? v : JSON.stringify(v).slice(0, 230));

(async () => {
  const session = await call('POST', '/auth/login', DEMO, '');
  if (!session.data) throw new Error('Login failed - is the server running and seeded?');
  token = session.data.token;

  const cats = (await call('GET', '/categories')).data;
  const food = cats.find((c) => c.name === 'סופר ומזון');
  const salary = cats.find((c) => c.name === 'משכורת');
  log('categories', cats.length + ' first=' + JSON.stringify(cats[0]).slice(0, 120));

  let r = await call('GET', '/transactions?limit=3&type=expense&search=חלב');
  log('tx search', { status: r.status, n: r.data.length, meta: r.meta, first: r.data[0] && { d: r.data[0].description, cat: r.data[0].category.name, date: r.data[0].date } });
  r = await call('GET', '/transactions?from=2026-09-01&to=2026-09-30&limit=100');
  log('tx range sept', { n: r.data.length, totals: r.meta.totals, pages: r.meta.pagination });

  r = await call('POST', '/transactions', { type: 'expense', amount: 42.5, category: food.id, description: 'בדיקה', date: '2026-10-04', merchant: 'מכולת', productName: 'שוקולד מריר', quantity: 5 });
  log('tx create', { status: r.status, unitPrice: r.data?.unitPrice, key: r.data?.productKey, msg: r.message });
  const txId = r.data.id;
  r = await call('PUT', `/transactions/${txId}`, { amount: 50, productName: '' });
  log('tx update', { status: r.status, amount: r.data?.amount, productName: r.data?.productName, productKey: r.data?.productKey, unitPrice: r.data?.unitPrice });
  r = await call('POST', '/transactions', { type: 'expense', amount: 10, category: salary.id, description: 'x', date: '2026-10-04' });
  log('tx wrong category type', { status: r.status, msg: r.message });
  r = await call('POST', '/transactions', { type: 'expense', amount: -5, description: '', date: 'abc' });
  log('tx validation', { status: r.status, msg: r.message, n: r.details?.length });
  r = await call('DELETE', `/transactions/${txId}`);
  log('tx delete', { status: r.status });
  r = await call('GET', `/transactions/${txId}`);
  log('tx get deleted', { status: r.status, msg: r.message });

  r = await call('GET', '/transactions/export?from=2026-09-01&to=2026-09-10', null, token, true);
  log('export', { status: r.status, bytes: r.buf.length, type: r.headers.get('content-type') });
  const fd = new FormData();
  fd.append('file', new Blob([r.buf]), 'export.xlsx');
  r = await call('POST', '/transactions/import/preview', fd);
  log('import preview', { status: r.status, summary: r.data?.summary, row: r.data?.rows[0], msg: r.message });
  const rows = r.data.rows.filter((x) => !x.error).slice(0, 3).map(({ type, amount, category, description, merchant, date, productName, quantity }) => ({ type, amount, category, description: description + ' (יבוא)', merchant, date, productName, quantity }));
  r = await call('POST', '/transactions/bulk', { rows });
  log('bulk', { status: r.status, data: r.data, msg: r.message });
  const csv = new FormData();
  csv.append('file', new Blob(['תאריך,סכום,תיאור,קטגוריה\n01/10/2026,-120.5,קניות,סופר ומזון\n02/10/2026,5000,בונוס,לא קיים\nxx,abc,\n']), 'bank.csv');
  r = await call('POST', '/transactions/import/preview', csv);
  log('csv preview', { status: r.status, summary: r.data?.summary, rows: r.data?.rows.map((x) => [x.date, x.type, x.amount, x.categoryMatched, x.error]), msg: r.message });
  const bad = new FormData(); bad.append('file', new Blob(['not excel']), 'fake.xlsx');
  r = await call('POST', '/transactions/import/preview', bad);
  log('fake xlsx', { status: r.status, msg: r.message });

  r = await call('GET', '/budgets');
  log('budgets', r.data.map((b) => [b.category.name, b.amount, b.spent, b.percent, b.status]));
  r = await call('POST', '/budgets', { category: food.id, amount: 100 });
  log('budget dup', { status: r.status, msg: r.message });
  const health = cats.find((c) => c.name === 'בריאות וטיפוח');
  r = await call('POST', '/budgets', { category: health.id, amount: 100 });
  log('budget create', { status: r.status, id: r.data?.id, cat: r.data?.category?.name });
  const bId = r.data.id;
  await call('POST', '/transactions', { type: 'expense', amount: 150, category: health.id, description: 'בדיקת התראה', date: new Date().toISOString().slice(0, 10) });
  await new Promise((s) => setTimeout(s, 700));
  r = await call('PUT', `/budgets/${bId}`, { amount: 120 });
  log('budget update', { status: r.status, amount: r.data?.amount, lastAlertKey: r.data?.lastAlertKey });
  r = await call('DELETE', `/budgets/${bId}`); log('budget delete', { status: r.status });

  r = await call('GET', '/goals'); const goal = r.data[0];
  log('goals', r.data.map((g) => [g.name, g.currentAmount, g.progress.status, g.progress.monthlyNeeded]));
  r = await call('POST', `/goals/${goal.id}/deposit`, { amount: 100, note: 'הפקדה' });
  log('goal deposit', { status: r.status, cur: r.data?.currentAmount, deps: r.data?.deposits.length });
  r = await call('POST', `/goals/${goal.id}/deposit`, { amount: -999999 });
  log('goal overdraw', { status: r.status, msg: r.message });
  r = await call('POST', '/goals', { name: 'רכב', targetAmount: 50000, initialAmount: 1000, targetDate: '2028-01-01' });
  log('goal create', { status: r.status, p: r.data?.progress });
  await call('DELETE', `/goals/${r.data.id}`);
  r = await call('POST', '/goals', { name: 'עבר', targetAmount: 50, targetDate: '2020-01-01' });
  log('goal past date', { status: r.status, msg: r.message });

  r = await call('GET', '/recurring');
  log('recurring', r.data.map((p) => [p.description, p.amount, p.nextRun.slice(0, 10), p.category.name]));
  const rec = r.data[0];
  r = await call('POST', `/recurring/${rec.id}/run`);
  log('recurring run', { status: r.status, next: r.data?.payment.nextRun, tx: r.data?.transaction.source, msg: r.message });
  r = await call('POST', '/recurring', { description: 'חדר כושר', amount: 199, category: health.id, startDate: '2026-10-20' });
  log('recurring create', { status: r.status, next: r.data?.nextRun, freq: r.data?.frequency, msg: r.message });
  r = await call('PUT', `/recurring/${r.data.id}`, { isActive: false });
  log('recurring pause', { status: r.status, active: r.data?.isActive });
  await call('DELETE', `/recurring/${r.data.id}`);

  r = await call('GET', '/products?sort=spent');
  log('products', { n: r.data.length, stats: r.meta.stats });
  log('product[0]', r.data[0]);
  r = await call('GET', '/products/detail?key=' + encodeURIComponent(r.data[0].key));
  log('product detail', { status: r.status, history: r.data?.history.length, merchants: r.data?.merchants });
  r = await call('GET', '/products/detail?key=nope'); log('product 404', { status: r.status, msg: r.message });

  const jpg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64)]);
  const rf = new FormData(); rf.append('file', new Blob([jpg], { type: 'image/jpeg' }), 'receipt.jpg');
  r = await call('POST', '/receipts/scan', rf);
  log('receipt scan', { status: r.status, engine: r.data?.engine, merchant: r.data?.merchant, items: r.data?.items.length, total: r.data?.total, msg: r.message });
  const rc = r.data;
  const fake = new FormData(); fake.append('file', new Blob(['<script>'], { type: 'image/jpeg' }), 'x.jpg');
  r = await call('POST', '/receipts/scan', fake); log('receipt fake', { status: r.status, msg: r.message });
  // With a real Gemini key the placeholder image above is rejected (no demo receipt), so skip the follow-ups
  if (rc?.id) {
    r = await call('POST', `/receipts/${rc.id}/confirm`, { merchant: rc.merchant, date: rc.purchaseDate, items: rc.items.map((i) => ({ name: i.name, quantity: i.quantity, total: i.total, category: i.category })) });
    log('receipt confirm', { status: r.status, created: r.data?.created, st: r.data?.receipt.status, msg: r.message });
    r = await call('POST', `/receipts/${rc.id}/confirm`, { merchant: 'x', date: rc.purchaseDate, items: [{ name: 'a', total: 1 }] });
    log('receipt confirm twice', { status: r.status, msg: r.message });
    r = await call('GET', `/receipts/${rc.id}/file`, null, token, true); log('receipt file', { status: r.status, bytes: r.buf.length });
  } else {
    log('receipt confirm', 'skipped - the AI rejected the placeholder image');
  }
  r = await call('GET', '/receipts'); log('receipts', { n: r.data.length });

  r = await call('GET', '/reports/monthly?year=2026&month=8');
  log('report', { label: r.data.period.label, totals: r.data.totals, change: r.data.change, cats: r.data.categories.length, top: r.data.topMerchants[0], daily: r.data.daily.length });
  r = await call('POST', '/dashboard/insights'); log('insights', { source: r.data.source, titles: r.data.insights.map((i) => i.title) });
  r = await call('GET', '/dashboard'); log('forecast', r.data.forecast);

  // --- auth & isolation ---
  r = await call('POST', '/auth/register', { name: 'בודק', email: `t${Date.now()}@example.com`, password: 'Passw0rd1' }, '');
  log('register', { status: r.status, hasToken: !!r.data?.token, pwLeak: 'password' in (r.data?.user || {}) });
  const other = r.data.token;
  r = await call('GET', '/categories', null, other); log('new user categories', r.data.length);
  r = await call('GET', '/transactions', null, other); log('new user tx (isolation)', r.data.length);
  r = await call('GET', `/goals`, null, other); log('new user goals', r.data.length);
  r = await call('POST', `/goals/${goal.id}/deposit`, { amount: 5 }, other); log('cross-user deposit', { status: r.status, msg: r.message });
  r = await call('POST', '/transactions', { type: 'expense', amount: 5, category: food.id, description: 'x', date: '2026-10-01' }, other); log('cross-user category', { status: r.status, msg: r.message });
  r = await call('GET', '/dashboard', null, other); log('new user dashboard', { s: r.data.summary, h: r.data.health.score, f: r.data.forecast.projectedBalance });
  r = await call('POST', '/dashboard/insights', null, other); log('new user insights', r.data.insights.map((i) => i.title));
  r = await call('PUT', '/auth/password', { currentPassword: 'wrong', newPassword: 'Another1x' }, other); log('pw wrong', { status: r.status, msg: r.message });
  r = await call('PUT', '/auth/password', { currentPassword: 'Passw0rd1', newPassword: 'Another1x' }, other); log('pw ok', { status: r.status });
  r = await call('PATCH', '/auth/me', { name: 'שם חדש', role: 'admin', notifications: { budgetAlerts: false } }, other); log('profile', { status: r.status, name: r.data?.user.name, role: r.data?.user.role, n: r.data?.user.notifications });
  r = await call('GET', '/dashboard', null, 'bad.token'); log('bad token', { status: r.status, msg: r.message });
  r = await call('POST', '/auth/login', { email: 'demo@smarthome.co.il', password: 'nope12345' }, ''); log('bad login', { status: r.status, msg: r.message });
  r = await call('POST', '/auth/login', { email: { $gt: '' }, password: 'x' }, ''); log('nosql login', { status: r.status, msg: r.message });
  r = await call('DELETE', `/categories/${food.id}`); log('delete used category', { status: r.status, msg: r.message });
  r = await call('POST', '/categories', { name: 'חיות מחמד', type: 'expense', icon: 'PawPrint', color: '#AA5500' }); log('category create', { status: r.status, id: r.data?.id });
  const cid = r.data.id;
  r = await call('POST', '/categories', { name: 'חיות מחמד', type: 'expense' }); log('category dup', { status: r.status, msg: r.message });
  r = await call('PUT', `/categories/${cid}`, { name: 'חיות' }); log('category update', { status: r.status, name: r.data?.name });
  r = await call('DELETE', `/categories/${cid}`); log('category delete', { status: r.status });
  r = await call('GET', '/nope'); log('404', { status: r.status, msg: r.message });
})().catch((e) => { console.error('SMOKE TEST FAILED', e); process.exit(1); });
