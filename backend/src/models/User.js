const { Schema, model } = require('mongoose');
const bcrypt = require('bcryptjs');
const { USER_ROLES } = require('../config/constants');
const { baseOptions } = require('./plugins');

const SALT_ROUNDS = 12;
// Older sessions are dropped once a user is logged in on more devices than this
const MAX_SESSIONS = 10;
const REUSE_GRACE_MS = 30 * 1000;

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 60 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 8, select: false },
    role: { type: String, enum: USER_ROLES, default: 'user' },
    currency: { type: String, default: 'ILS' },
    emailVerified: { type: Boolean, default: false },
    googleId: { type: String, index: { unique: true, sparse: true }, select: false },
    notifications: {
      budgetAlerts: { type: Boolean, default: true },
      monthlySummary: { type: Boolean, default: true },
    },
    lastLoginAt: Date,

    // ---- Secrets: never selected by default, never serialized ----
    // Refresh token ids (jti), one active per logged-in device. Rotated ids stay
    // until they expire, marked `used`, so a replayed token can be recognized.
    sessions: { type: [{ jti: String, expiresAt: Date, used: Boolean, usedAt: Date, _id: false }], select: false, default: [] },
    // E-mail verification code (stored hashed)
    otp: { type: { hash: String, expiresAt: Date, attempts: Number }, select: false },
    // Password reset token (stored hashed)
    passwordReset: { type: { hash: String, expiresAt: Date }, select: false },
  },
  baseOptions
);

// Passwords are never stored in plain text
userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, SALT_ROUNDS);
  next();
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

// The methods below require `sessions` to be selected.

/** Registers a new refresh token, forgets expired ones and keeps at most MAX_SESSIONS active. */
userSchema.methods.addSession = function addSession(jti, expiresAt) {
  const now = Date.now();
  const live = (this.sessions || []).filter((s) => s.expiresAt > now);
  const active = [...live.filter((s) => !s.used), { jti, expiresAt, used: false }].slice(-MAX_SESSIONS);
  this.sessions = [...live.filter((s) => s.used), ...active];
};

/**
 * 'active' | 'used' (already rotated - a replay) | 'unknown' (revoked or never issued).
 * A token rotated in the last few seconds counts as 'unknown': two browser tabs
 * refreshing at once is normal, not theft.
 */
userSchema.methods.sessionState = function sessionState(jti) {
  const now = Date.now();
  const session = (this.sessions || []).find((s) => s.jti === jti && s.expiresAt > now);
  if (!session) return 'unknown';
  if (!session.used) return 'active';
  return now - session.usedAt < REUSE_GRACE_MS ? 'unknown' : 'used';
};

userSchema.methods.markSessionUsed = function markSessionUsed(jti) {
  this.sessions = (this.sessions || []).map((s) =>
    s.jti === jti ? { jti: s.jti, expiresAt: s.expiresAt, used: true, usedAt: new Date() } : s
  );
};

userSchema.methods.removeSession = function removeSession(jti) {
  this.sessions = (this.sessions || []).filter((s) => s.jti !== jti);
};

module.exports = model('User', userSchema);
