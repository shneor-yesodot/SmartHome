const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const env = require('../config/env');

const OPTIONS = { algorithm: 'HS256' };

/** Short-lived token sent with every API request. */
const signAccessToken = (userId) =>
  jwt.sign({ sub: String(userId), typ: 'access' }, env.jwt.secret, { ...OPTIONS, expiresIn: env.jwt.accessExpiresIn });

const verifyAccessToken = (token) => {
  const payload = jwt.verify(token, env.jwt.secret, { algorithms: ['HS256'] });
  if (payload.typ !== 'access') throw new Error('not an access token');
  return payload;
};

/**
 * Long-lived token used only to get a new access token. Each one carries a
 * unique id (jti) stored on the user, so it can be rotated and revoked.
 */
const signRefreshToken = (userId) => {
  const jti = crypto.randomUUID();
  const token = jwt.sign({ sub: String(userId), jti, typ: 'refresh' }, env.jwt.refreshSecret, {
    ...OPTIONS,
    expiresIn: env.jwt.refreshExpiresIn,
  });
  const { exp } = jwt.decode(token);
  return { token, jti, expiresAt: new Date(exp * 1000) };
};

const verifyRefreshToken = (token) => {
  const payload = jwt.verify(token, env.jwt.refreshSecret, { algorithms: ['HS256'] });
  if (payload.typ !== 'refresh' || !payload.jti) throw new Error('not a refresh token');
  return payload;
};

/** Short state token for the Google login round trip (CSRF protection). */
const signOAuthState = (data) => jwt.sign({ ...data, typ: 'oauth' }, env.jwt.secret, { ...OPTIONS, expiresIn: '10m' });

const verifyOAuthState = (token) => {
  const payload = jwt.verify(token, env.jwt.secret, { algorithms: ['HS256'] });
  if (payload.typ !== 'oauth') throw new Error('not a state token');
  return payload;
};

/** One-way hash for codes and reset tokens kept in the database. */
const hashSecret = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');

const randomCode = () => String(crypto.randomInt(100000, 1000000));
const randomToken = () => crypto.randomBytes(32).toString('hex');

module.exports = {
  signAccessToken,
  verifyAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  signOAuthState,
  verifyOAuthState,
  hashSecret,
  randomCode,
  randomToken,
};
