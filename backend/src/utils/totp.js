/** Time-based one-time passwords (RFC 6238), as used by Google Authenticator and similar apps. */
const crypto = require('crypto');

const STEP_SECONDS = 30;
const DIGITS = 6;
const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

const base32Encode = (buffer) => {
  let bits = '';
  buffer.forEach((byte) => {
    bits += byte.toString(2).padStart(8, '0');
  });
  return (bits.match(/.{1,5}/g) || []).map((chunk) => BASE32[parseInt(chunk.padEnd(5, '0'), 2)]).join('');
};

const base32Decode = (text) => {
  let bits = '';
  for (const char of text.toUpperCase()) bits += BASE32.indexOf(char).toString(2).padStart(5, '0');
  const bytes = (bits.match(/.{8}/g) || []).map((chunk) => parseInt(chunk, 2));
  return Buffer.from(bytes);
};

const generateSecret = () => base32Encode(crypto.randomBytes(20));

const codeAt = (secret, step) => {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const hmac = crypto.createHmac('sha1', base32Decode(secret)).update(counter).digest();
  const offset = hmac[hmac.length - 1] % 16;
  const value = hmac.readUInt32BE(offset) % 2147483648;
  return String(value % 10 ** DIGITS).padStart(DIGITS, '0');
};

const stepOf = (now = Date.now()) => Math.floor(now / 1000 / STEP_SECONDS);

/**
 * Returns the matched time step, or null. Allows one step of clock drift either
 * way; steps up to `afterStep` are refused, so a code can only be used once.
 */
const verify = (secret, code, { afterStep = -1, now = Date.now() } = {}) => {
  const current = stepOf(now);
  for (const step of [current - 1, current, current + 1]) {
    if (step <= afterStep) continue;
    const expected = Buffer.from(codeAt(secret, step));
    const given = Buffer.from(String(code));
    if (expected.length === given.length && crypto.timingSafeEqual(expected, given)) return step;
  }
  return null;
};

const otpauthUrl = ({ secret, account, issuer = 'SmartHome' }) =>
  `otpauth://totp/${encodeURIComponent(`${issuer}:${account}`)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${DIGITS}&period=${STEP_SECONDS}`;

module.exports = { generateSecret, verify, otpauthUrl, codeAt, stepOf };
