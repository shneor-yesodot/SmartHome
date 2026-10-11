/**
 * End-to-end tests of the authentication flows against a real (in-memory) MongoDB:
 * e-mail verification, refresh-token rotation and reuse detection, logout,
 * password reset, password change and the Google sign-in guards.
 */
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

// SMTP "configured", so e-mail verification is on; e-mails are captured instead of sent
jest.mock('../src/config/mailer', () => ({ isSmtpConfigured: true, transporter: { sendMail: jest.fn() } }));
jest.mock('../src/services/email.service', () => ({
  sendWelcome: jest.fn(),
  sendBudgetAlert: jest.fn(),
  sendMonthlySummary: jest.fn(),
  sendVerificationCode: jest.fn(),
  sendPasswordReset: jest.fn(),
}));

const emailService = require('../src/services/email.service');
const app = require('../src/app');

jest.setTimeout(60000);

let mongo;
let server;
let base;

const call = async (path, { method = 'GET', body, token } = {}) => {
  const res = await fetch(base + path, {
    method,
    redirect: 'manual',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = res.headers.get('content-type')?.includes('json') ? await res.json() : null;
  return { status: res.status, body: json, location: res.headers.get('location') };
};

// jest.config clears mock calls between tests, so the captured values are kept here
const sent = { code: null, resetLink: null };
emailService.sendVerificationCode.mockImplementation(async (_user, code) => {
  sent.code = code;
});
emailService.sendPasswordReset.mockImplementation(async (_user, link) => {
  sent.resetLink = link;
});
const lastCode = () => sent.code;
const lastResetToken = () => new URL(sent.resetLink).searchParams.get('token');

const EMAIL = 'flow@example.com';
const PASSWORD = 'Secret123';

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await new Promise((resolve) => {
    server = app.listen(0, resolve);
  });
  base = `http://127.0.0.1:${server.address().port}/api`;
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
  await mongo.stop();
});

describe('registration with e-mail verification', () => {
  it('asks for a code instead of logging in', async () => {
    const res = await call('/auth/register', { method: 'POST', body: { name: 'Flow', email: EMAIL, password: PASSWORD } });
    expect(res.status).toBe(201);
    expect(res.body.data).toEqual({ verificationRequired: true, email: EMAIL });
    expect(res.body.data.token).toBeUndefined();
    expect(lastCode()).toMatch(/^\d{6}$/);
  });

  it('does not let an unverified user in', async () => {
    const res = await call('/auth/login', { method: 'POST', body: { email: EMAIL, password: PASSWORD } });
    expect(res.status).toBe(200);
    expect(res.body.data.verificationRequired).toBe(true);
    expect(res.body.data.token).toBeUndefined();
  });

  it('rejects a wrong code and accepts the right one', async () => {
    const wrong = lastCode() === '000000' ? '111111' : '000000';
    expect((await call('/auth/verify-email', { method: 'POST', body: { email: EMAIL, code: wrong } })).status).toBe(400);

    const res = await call('/auth/verify-email', { method: 'POST', body: { email: EMAIL, code: lastCode() } });
    expect(res.status).toBe(200);
    expect(res.body.data.token).toBeTruthy();
    expect(res.body.data.refreshToken).toBeTruthy();
    expect(res.body.data.user.emailVerified).toBe(true);
    expect(res.body.data.user.sessions).toBeUndefined();
  });
});

describe('sessions', () => {
  let session;

  beforeAll(async () => {
    session = (await call('/auth/login', { method: 'POST', body: { email: EMAIL, password: PASSWORD } })).body.data;
  });

  it('opens protected routes with the access token only', async () => {
    expect((await call('/auth/me', { token: session.token })).status).toBe(200);
    expect((await call('/auth/me', { token: session.refreshToken })).status).toBe(401);
  });

  it('rotates the refresh token and detects reuse of an old one', async () => {
    const refreshWith = (refreshToken) => call('/auth/refresh', { method: 'POST', body: { refreshToken } });
    const first = await refreshWith(session.refreshToken);
    expect(first.status).toBe(200);

    // A second tab using the same token a moment later is refused, but nothing is revoked
    expect((await refreshWith(session.refreshToken)).status).toBe(401);
    const second = await refreshWith(first.body.data.refreshToken);
    expect(second.status).toBe(200);

    // The same replay a minute later is treated as theft: every session is revoked
    const realNow = Date.now();
    const clock = jest.spyOn(Date, 'now').mockReturnValue(realNow + 60 * 1000);
    try {
      expect((await refreshWith(session.refreshToken)).status).toBe(401);
      expect((await refreshWith(second.body.data.refreshToken)).status).toBe(401);
    } finally {
      clock.mockRestore();
    }
  });

  it('logout revokes the refresh token', async () => {
    const fresh = (await call('/auth/login', { method: 'POST', body: { email: EMAIL, password: PASSWORD } })).body.data;
    expect((await call('/auth/logout', { method: 'POST', body: { refreshToken: fresh.refreshToken } })).status).toBe(200);
    expect((await call('/auth/refresh', { method: 'POST', body: { refreshToken: fresh.refreshToken } })).status).toBe(401);
  });
});

describe('passwords', () => {
  it('resets the password through the e-mailed link and logs out other devices', async () => {
    const other = (await call('/auth/login', { method: 'POST', body: { email: EMAIL, password: PASSWORD } })).body.data;

    const forgot = await call('/auth/forgot-password', { method: 'POST', body: { email: EMAIL } });
    expect(forgot.status).toBe(200);
    // Unknown addresses get the very same answer
    const unknown = await call('/auth/forgot-password', { method: 'POST', body: { email: 'nobody@example.com' } });
    expect(unknown.body).toEqual(forgot.body);

    const token = lastResetToken();
    const reset = await call('/auth/reset-password', { method: 'POST', body: { token, password: 'NewSecret456' } });
    expect(reset.status).toBe(200);
    expect(reset.body.data.token).toBeTruthy();

    expect((await call('/auth/reset-password', { method: 'POST', body: { token, password: 'Another789' } })).status).toBe(400);
    expect((await call('/auth/refresh', { method: 'POST', body: { refreshToken: other.refreshToken } })).status).toBe(401);
    expect((await call('/auth/login', { method: 'POST', body: { email: EMAIL, password: 'NewSecret456' } })).status).toBe(200);
  });

  it('changing the password returns a new session and revokes the old ones', async () => {
    const before = (await call('/auth/login', { method: 'POST', body: { email: EMAIL, password: 'NewSecret456' } })).body.data;
    const res = await call('/auth/password', {
      method: 'PUT',
      token: before.token,
      body: { currentPassword: 'NewSecret456', newPassword: 'Changed789' },
    });
    expect(res.status).toBe(200);
    expect(res.body.data.refreshToken).toBeTruthy();
    expect((await call('/auth/refresh', { method: 'POST', body: { refreshToken: before.refreshToken } })).status).toBe(401);
    expect((await call('/auth/refresh', { method: 'POST', body: { refreshToken: res.body.data.refreshToken } })).status).toBe(200);
  });
});

describe('Google sign-in guards', () => {
  it('sends the user back with a clear error when Google is not configured', async () => {
    const res = await call('/auth/google?returnTo=/budgets');
    expect(res.status).toBe(302);
    expect(res.location).toMatch(/\/login\?error=google_unavailable$/);
  });

  it('rejects a callback with a forged state', async () => {
    const res = await call('/auth/google/callback?code=abc&state=forged');
    expect(res.status).toBe(302);
    expect(res.location).toMatch(/\/login\?error=google$/);
  });
});
