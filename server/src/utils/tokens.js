import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '../config/env.js';

export function signAccessToken(user) {
  return jwt.sign(
    { sub: String(user._id), role: user.role, email: user.email },
    env.jwtSecret,
    { expiresIn: env.accessTtl }
  );
}

export function signRefreshToken(user) {
  const jti = crypto.randomBytes(16).toString('hex');
  const token = jwt.sign(
    { sub: String(user._id), jti, typ: 'refresh' },
    env.jwtRefreshSecret,
    { expiresIn: env.refreshTtl }
  );
  return { token, jti };
}

export function verifyAccess(token) {
  return jwt.verify(token, env.jwtSecret);
}

export function verifyRefresh(token) {
  return jwt.verify(token, env.jwtRefreshSecret);
}

export function hashToken(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function randomOtp() {
  return String(crypto.randomInt(100000, 1000000));
}

export function randomToken() {
  return crypto.randomBytes(32).toString('hex');
}
