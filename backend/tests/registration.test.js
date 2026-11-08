/** Who may open an account: closed by default in production, allow-listed when configured. */
const loadAuth = (nodeEnv, allowed) => {
  jest.resetModules();
  jest.doMock('../src/config/env', () => ({
    isProd: nodeEnv === 'production',
    allowedEmails: allowed,
    jwt: { secret: 'x'.repeat(40), refreshSecret: 'y'.repeat(40), accessExpiresIn: '15m', refreshExpiresIn: '7d' },
    google: {},
    smtp: {},
    gemini: {},
    encryptionKey: 'z'.repeat(40),
    clientUrl: 'http://localhost',
  }));
  jest.doMock('../src/config/mailer', () => ({ isSmtpConfigured: false, transporter: null }));
  jest.doMock('../src/services/email.service', () => ({ sendWelcome: jest.fn() }));
  const create = jest.fn(async (data) => ({ ...data, id: 'u1', emailVerified: true }));
  jest.doMock('../src/repositories/user.repository', () => ({
    findByEmail: jest.fn(async () => null),
    create,
    findById: jest.fn(async () => ({ id: 'u1', addSession: jest.fn(), save: jest.fn(), toJSON: () => ({}) })),
  }));
  jest.doMock('../src/managers/category.manager', () => ({ seedDefaults: jest.fn() }));
  return { auth: require('../src/managers/auth.manager'), create };
};

const details = (email) => ({ name: 'מישהו', email, password: 'Secret123' });

afterAll(() => jest.resetModules());

describe('registration', () => {
  it('is closed in production when no list is configured', async () => {
    const { auth, create } = loadAuth('production', []);
    await expect(auth.register(details('stranger@example.com'))).rejects.toMatchObject({ statusCode: 403 });
    expect(create).not.toHaveBeenCalled();
    expect(auth.publicConfig().registration).toBe(false);
  });

  it('accepts only the listed addresses', async () => {
    const { auth, create } = loadAuth('production', ['me@example.com']);
    await expect(auth.register(details('stranger@example.com'))).rejects.toMatchObject({ statusCode: 403 });
    await auth.register(details('ME@example.com'));
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('stays open in development', async () => {
    const { auth, create } = loadAuth('development', []);
    await auth.register(details('dev@example.com'));
    expect(create).toHaveBeenCalledTimes(1);
  });
});
