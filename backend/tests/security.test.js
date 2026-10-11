const { detectMime } = require('../src/utils/fileSignature');
const { escapeRegex, toProductKey } = require('../src/utils/text');
const authSchema = require('../src/validators/auth.validator');
const transactionSchema = require('../src/validators/transaction.validator');

describe('file signature detection', () => {
  it('recognises real file types by their magic bytes', () => {
    expect(detectMime(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]))).toBe('image/jpeg');
    expect(detectMime(Buffer.from('%PDF-1.7 example'))).toBe('application/pdf');
  });
  it('rejects a script disguised as an image', () => {
    expect(detectMime(Buffer.from('<script>alert(1)</script>'))).toBeNull();
  });
});

describe('text helpers', () => {
  it('escapes regular-expression characters in search terms', () => {
    expect(escapeRegex('a.*(b)')).toBe('a\\.\\*\\(b\\)');
  });
  it('builds the same key for differently formatted product names', () => {
    expect(toProductKey('  חלב   3% 1 ליטר ')).toBe(toProductKey('חלב 3% 1 ליטר'));
  });
});

describe('request validation', () => {
  it('rejects weak passwords', () => {
    const { error } = authSchema.register.validate({ name: 'Dana', email: 'dana@example.com', password: 'abcdefgh' });
    expect(error).toBeDefined();
  });

  it('strips unknown fields (mass-assignment protection)', () => {
    const { value, error } = transactionSchema.create.validate(
      { type: 'expense', amount: 10, category: 'a'.repeat(24), description: 'test', date: '2026-10-01', user: 'someone-else', role: 'admin' },
      { stripUnknown: true }
    );
    expect(error).toBeUndefined();
    expect(value.user).toBeUndefined();
    expect(value.role).toBeUndefined();
  });

  it('rejects NoSQL operators in place of an id', () => {
    const { error } = transactionSchema.create.validate({ type: 'expense', amount: 10, category: { $ne: null }, description: 'x', date: '2026-10-01' });
    expect(error).toBeDefined();
  });
});
