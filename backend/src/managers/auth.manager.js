const bcrypt = require('bcryptjs');
const QRCode = require('qrcode');
const userRepository = require('../repositories/user.repository');
const totp = require('../utils/totp');
const secretBox = require('../utils/secretBox');
const categoryManager = require('./category.manager');
const tokenService = require('../services/token.service');
const emailService = require('../services/email.service');
const googleService = require('../services/google.service');
const { isSmtpConfigured } = require('../config/mailer');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');

// The same message for "no such user" and "wrong password" - avoids user enumeration
const INVALID_CREDENTIALS = 'האימייל או הסיסמה שגויים';
const SESSION_EXPIRED = 'פג תוקף ההתחברות. יש להתחבר מחדש';
const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const RESET_TTL_MS = 60 * 60 * 1000;
const MAX_FAILED_LOGINS = 5;
const LOCK_MS = 15 * 60 * 1000;
const BACKUP_CODES = 8;

/**
 * E-mail verification needs a way to deliver the code. Without SMTP
 * (typical in development) new accounts are trusted right away.
 */
const verificationEnabled = () => isSmtpConfigured;

/**
 * Who may open an account. With ALLOWED_EMAILS set: only those addresses.
 * Without it: nobody in production (the household's finances are not a public
 * sign-up page), anybody in development.
 */
const mayRegister = (email) =>
  env.allowedEmails.length ? env.allowedEmails.includes(String(email).toLowerCase()) : !env.isProd;

// Compared against when the user does not exist, so both cases take the same time
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 12);

/** Issues an access token + a new refresh token, and saves the refresh token's id on the user. */
const buildSession = async (user) => {
  const refresh = tokenService.signRefreshToken(user.id);
  user.addSession(refresh.jti, refresh.expiresAt);
  user.lastLoginAt = new Date();
  await user.save();
  return {
    user: user.toJSON(),
    token: tokenService.signAccessToken(user.id),
    refreshToken: refresh.token, // the controller moves it into an httpOnly cookie
    refreshExpiresAt: refresh.expiresAt,
  };
};

/** A session, or - when the account has an authenticator app - a request for its code. */
const completeLogin = async (user) => {
  if (!user.twoFactorEnabled) return buildSession(user);
  await user.save();
  return { twoFactorRequired: true, challenge: tokenService.signTwoFactorChallenge(user.id) };
};

const isLocked = (user) => Boolean(user.lockedUntil && user.lockedUntil > new Date());

/** Every failed attempt counts; too many lock the account for a while. */
const recordFailure = async (user) => {
  user.failedLogins = (user.failedLogins || 0) + 1;
  if (user.failedLogins >= MAX_FAILED_LOGINS) {
    user.lockedUntil = new Date(Date.now() + LOCK_MS);
    user.failedLogins = 0;
  }
  await user.save();
};

const sendVerificationCode = async (user) => {
  const code = tokenService.randomCode();
  user.otp = { hash: tokenService.hashSecret(code), expiresAt: new Date(Date.now() + OTP_TTL_MS), attempts: 0 };
  await user.save();
  await emailService.sendVerificationCode(user, code);
};

const pendingVerification = (user) => ({ verificationRequired: true, email: user.email });

const publicConfig = () => ({
  google: googleService.isConfigured(),
  emailVerification: verificationEnabled(),
  // false hides the sign-up link. With an allow-list the page stays reachable for the people on it.
  registration: env.allowedEmails.length > 0 || !env.isProd,
});

const register = async ({ name, email, password }) => {
  if (!mayRegister(email)) throw ApiError.forbidden('ההרשמה למערכת סגורה. פנו לבעל המערכת');
  if (await userRepository.findByEmail(email)) {
    throw ApiError.conflict('כבר קיים חשבון עם כתובת האימייל הזו');
  }
  const user = await userRepository.create({ name, email, password, emailVerified: !verificationEnabled() });
  await categoryManager.seedDefaults(user.id);

  if (!user.emailVerified) {
    await sendVerificationCode(user);
    return pendingVerification(user);
  }
  emailService.sendWelcome(user); // fire-and-forget
  return buildSession(await userRepository.findById(user.id, ['sessions']));
};

const login = async ({ email, password }) => {
  const user = await userRepository.findByEmail(email, ['password', 'sessions', 'otp', 'failedLogins', 'lockedUntil']);
  if (!user) {
    await bcrypt.compare(password, DUMMY_HASH);
    throw ApiError.unauthorized(INVALID_CREDENTIALS);
  }
  // A locked account answers exactly like a wrong password: it reveals nothing, even to the right guess
  if (isLocked(user)) throw ApiError.unauthorized(INVALID_CREDENTIALS);
  if (!(await user.comparePassword(password))) {
    await recordFailure(user);
    throw ApiError.unauthorized(INVALID_CREDENTIALS);
  }
  user.failedLogins = 0;
  user.lockedUntil = undefined;
  if (!user.emailVerified) {
    if (!verificationEnabled()) {
      // SMTP was removed after the account was created - nothing to verify with
      user.emailVerified = true;
    } else {
      await sendVerificationCode(user);
      return pendingVerification(user);
    }
  }
  return completeLogin(user);
};

/** A backup code works once. Returns true when the code was one of them. */
const consumeBackupCode = (user, code) => {
  const hash = tokenService.hashSecret(String(code).toLowerCase());
  const codes = user.twoFactor.backupCodes || [];
  if (!codes.includes(hash)) return false;
  const { secret, lastStep } = user.twoFactor;
  user.twoFactor = { secret, lastStep, backupCodes: codes.filter((c) => c !== hash) };
  return true;
};

/** Checks an authenticator or backup code; an accepted authenticator code cannot be replayed. */
const checkSecondFactor = (user, code) => {
  const { secret, lastStep, backupCodes } = user.twoFactor || {};
  if (!secret) return false;
  const step = /^\d{6}$/.test(code) ? totp.verify(secretBox.decrypt(secret), code, { afterStep: lastStep ?? -1 }) : null;
  if (step !== null) {
    user.twoFactor = { secret, lastStep: step, backupCodes };
    return true;
  }
  return consumeBackupCode(user, code);
};

/** Second step of a login: the challenge from the password step + a code. */
const loginTwoFactor = async ({ challenge, code }) => {
  let payload;
  try {
    payload = tokenService.verifyTwoFactorChallenge(challenge);
  } catch {
    throw ApiError.unauthorized('פג תוקף ההתחברות. יש להתחבר מחדש');
  }
  const user = await userRepository.findById(payload.sub, ['twoFactor', 'sessions', 'failedLogins', 'lockedUntil']);
  if (!user || isLocked(user) || !checkSecondFactor(user, code)) {
    if (user && !isLocked(user)) await recordFailure(user);
    throw ApiError.unauthorized('הקוד שגוי');
  }
  user.failedLogins = 0;
  return buildSession(user);
};

/** Step 1 of turning the authenticator on: a new secret to scan. Off until a code confirms it. */
const twoFactorSetup = async (userId, { password }) => {
  const user = await userRepository.findById(userId, ['password', 'twoFactor']);
  if (!(await user.comparePassword(password))) throw ApiError.badRequest('הסיסמה שגויה');
  if (user.twoFactorEnabled) throw ApiError.conflict('אימות דו-שלבי כבר פעיל');
  const secret = totp.generateSecret();
  user.twoFactor = { secret: secretBox.encrypt(secret), backupCodes: [] };
  await user.save();
  const url = totp.otpauthUrl({ secret, account: user.email });
  return { secret, url, qr: await QRCode.toDataURL(url, { margin: 1, width: 220 }) };
};

/** Step 2: a code from the app proves it was set up. The backup codes are shown only this once. */
const twoFactorEnable = async (userId, { code }) => {
  const user = await userRepository.findById(userId, ['twoFactor']);
  if (user.twoFactorEnabled) throw ApiError.conflict('אימות דו-שלבי כבר פעיל');
  const secret = user.twoFactor?.secret;
  if (!secret) throw ApiError.badRequest('התחילו מחדש את הגדרת האימות הדו-שלבי');
  const step = totp.verify(secretBox.decrypt(secret), code);
  if (step === null) throw ApiError.badRequest('הקוד שגוי. ודאו שהשעה בטלפון מדויקת');
  const codes = Array.from({ length: BACKUP_CODES }, () => tokenService.randomToken().slice(0, 10));
  user.twoFactor = { secret, lastStep: step, backupCodes: codes.map((c) => tokenService.hashSecret(c)) };
  user.twoFactorEnabled = true;
  await user.save();
  return { user: user.toJSON(), backupCodes: codes };
};

const twoFactorDisable = async (userId, { password, code }) => {
  const user = await userRepository.findById(userId, ['password', 'twoFactor']);
  if (!user.twoFactorEnabled) throw ApiError.conflict('אימות דו-שלבי אינו פעיל');
  if (!(await user.comparePassword(password))) throw ApiError.badRequest('הסיסמה שגויה');
  if (!checkSecondFactor(user, code)) throw ApiError.badRequest('הקוד שגוי');
  user.twoFactor = undefined;
  user.twoFactorEnabled = false;
  await user.save();
  return { user: user.toJSON() };
};

const verifyEmail = async ({ email, code }) => {
  const user = await userRepository.findByEmail(email, ['otp', 'sessions']);
  const otp = user?.otp;
  if (!user || user.emailVerified || !otp?.hash) throw ApiError.badRequest('אין קוד אימות פעיל. בקשו קוד חדש');
  if (otp.expiresAt < new Date() || otp.attempts >= OTP_MAX_ATTEMPTS) {
    throw ApiError.badRequest('פג תוקף הקוד. בקשו קוד חדש');
  }
  if (tokenService.hashSecret(code) !== otp.hash) {
    user.otp = { hash: otp.hash, expiresAt: otp.expiresAt, attempts: otp.attempts + 1 };
    await user.save();
    throw ApiError.badRequest('הקוד שגוי');
  }
  user.emailVerified = true;
  user.otp = undefined;
  emailService.sendWelcome(user);
  return buildSession(user);
};

/** Always answers the same way, so it cannot reveal which e-mails are registered. */
const resendCode = async ({ email }) => {
  const user = await userRepository.findByEmail(email, ['otp']);
  if (user && !user.emailVerified && verificationEnabled()) await sendVerificationCode(user);
};

const forgotPassword = async ({ email }) => {
  const user = await userRepository.findByEmail(email, ['passwordReset']);
  if (!user) return;
  const token = tokenService.randomToken();
  user.passwordReset = { hash: tokenService.hashSecret(token), expiresAt: new Date(Date.now() + RESET_TTL_MS) };
  await user.save();
  await emailService.sendPasswordReset(user, `${env.clientUrl}/reset-password?token=${token}`);
};

/** A successful reset also proves the e-mail address, and logs out every other device. */
const resetPassword = async ({ token, password }) => {
  const user = await userRepository.findByResetHash(tokenService.hashSecret(token));
  if (!user) throw ApiError.badRequest('הקישור לאיפוס אינו תקף או שפג תוקפו');
  user.password = password;
  user.passwordReset = undefined;
  user.emailVerified = true;
  user.sessions = [];
  user.failedLogins = 0;
  user.lockedUntil = undefined;
  // The e-mail link proves one factor only: it never skips the authenticator app
  return completeLogin(user);
};

/**
 * Exchanges a refresh token for a new pair (rotation). A refresh token that
 * was already rotated signals theft, so every session of that user is revoked.
 * A token revoked by logout or a password change is simply refused.
 */
const refresh = async ({ refreshToken }) => {
  let payload;
  if (!refreshToken) throw ApiError.unauthorized(SESSION_EXPIRED);
  try {
    payload = tokenService.verifyRefreshToken(refreshToken);
  } catch {
    throw ApiError.unauthorized(SESSION_EXPIRED);
  }
  const user = await userRepository.findById(payload.sub, ['sessions']);
  if (!user) throw ApiError.unauthorized(SESSION_EXPIRED);
  const state = user.sessionState(payload.jti);
  if (state === 'used') {
    user.sessions = [];
    await user.save();
  }
  if (state !== 'active') throw ApiError.unauthorized(SESSION_EXPIRED);
  user.markSessionUsed(payload.jti);
  return buildSession(user);
};

const logout = async ({ refreshToken }) => {
  try {
    const payload = tokenService.verifyRefreshToken(refreshToken);
    const user = await userRepository.findById(payload.sub, ['sessions']);
    if (user) {
      user.removeSession(payload.jti);
      await user.save();
    }
  } catch {
    // An invalid or expired token is already logged out
  }
};

/** Only the whitelisted fields (validated by Joi) can be changed - never e-mail or role. */
const updateProfile = async (userId, { name, notifications, calendar }) => {
  const user = await userRepository.findById(userId);
  if (name) user.name = name;
  if (calendar) user.calendar = calendar;
  if (notifications) Object.assign(user.notifications, notifications);
  return user.save();
};

/** Changing the password logs out every other device and returns a fresh session for this one. */
const changePassword = async (userId, { currentPassword, newPassword }) => {
  const user = await userRepository.findByIdWithPassword(userId);
  if (!(await user.comparePassword(currentPassword))) {
    throw ApiError.badRequest('הסיסמה הנוכחית שגויה');
  }
  user.password = newPassword; // hashed by the model's pre-save hook
  user.sessions = [];
  return buildSession(user);
};

// ---------- Google sign-in ----------

/** Only same-site paths are allowed as the place to return to (blocks open redirects). */
const safeReturnTo = (value) =>
  typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') && !value.includes('\\') ? value : '/';

const googleStart = (returnTo) => {
  if (!googleService.isConfigured()) return { url: `${env.clientUrl}/login?error=google_unavailable` };
  const nonce = tokenService.randomToken();
  const state = tokenService.signOAuthState({ nonce, returnTo: safeReturnTo(returnTo) });
  return { url: googleService.buildAuthUrl(state), nonce };
};

/**
 * Finishes the Google round trip. `state` must be the token we issued and its
 * nonce must match the cookie set on this browser (CSRF protection).
 */
const googleCallback = async ({ code, state, nonce }) => {
  let payload;
  try {
    payload = tokenService.verifyOAuthState(state);
  } catch {
    throw ApiError.badRequest('בקשת ההתחברות פגה. נסו שוב');
  }
  if (!nonce || payload.nonce !== nonce) throw ApiError.badRequest('בקשת ההתחברות אינה תקפה. נסו שוב');

  const profile = await googleService.fetchProfile(code);
  if (!profile.email || !profile.verified_email) throw ApiError.badRequest('חשבון ה-Google אינו מאומת');

  let user = await userRepository.findByGoogleId(profile.id);
  if (!user) {
    user = await userRepository.findByEmail(profile.email, ['sessions', 'googleId']);
    if (user) {
      // Same e-mail, verified by Google: link the accounts
      user.googleId = profile.id;
      user.emailVerified = true;
    } else {
      if (!mayRegister(profile.email)) throw ApiError.forbidden('ההרשמה למערכת סגורה');
      const name = (profile.name || profile.email.split('@')[0]).trim().slice(0, 60);
      user = await userRepository.create({
        name: name.length >= 2 ? name : 'משתמש',
        email: profile.email,
        password: tokenService.randomToken(), // unusable until the user sets one through "forgot password"
        googleId: profile.id,
        emailVerified: true,
      });
      await categoryManager.seedDefaults(user.id);
      emailService.sendWelcome(user);
      user = await userRepository.findById(user.id, ['sessions']);
    }
  }
  return { session: await completeLogin(user), returnTo: payload.returnTo };
};

module.exports = {
  publicConfig,
  register,
  login,
  loginTwoFactor,
  twoFactorSetup,
  twoFactorEnable,
  twoFactorDisable,
  verifyEmail,
  resendCode,
  forgotPassword,
  resetPassword,
  refresh,
  logout,
  updateProfile,
  changePassword,
  googleStart,
  googleCallback,
};
