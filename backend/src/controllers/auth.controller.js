const authManager = require('../managers/auth.manager');
const asyncHandler = require('../utils/asyncHandler');
const env = require('../config/env');
const logger = require('../utils/logger');
const { ok, created } = require('../utils/response');

const GENERIC_SENT = 'אם הכתובת רשומה במערכת, נשלחה אליה הודעה';
const NONCE_COOKIE = 'oauth_nonce';
const NONCE_COOKIE_PATH = '/api/auth/google';

const config = (_req, res) => ok(res, authManager.publicConfig());

const register = asyncHandler(async (req, res) => created(res, await authManager.register(req.body)));
const login = asyncHandler(async (req, res) => ok(res, await authManager.login(req.body)));
const verifyEmail = asyncHandler(async (req, res) => ok(res, await authManager.verifyEmail(req.body)));
const resendCode = asyncHandler(async (req, res) => {
  await authManager.resendCode(req.body);
  ok(res, { message: 'אם יש חשבון שממתין לאימות, נשלח אליו קוד חדש' });
});
const forgotPassword = asyncHandler(async (req, res) => {
  await authManager.forgotPassword(req.body);
  ok(res, { message: GENERIC_SENT });
});
const resetPassword = asyncHandler(async (req, res) => ok(res, await authManager.resetPassword(req.body)));
const refresh = asyncHandler(async (req, res) => ok(res, await authManager.refresh(req.body)));
const logout = asyncHandler(async (req, res) => {
  await authManager.logout(req.body);
  ok(res, { message: 'התנתקת בהצלחה' });
});

const me = asyncHandler(async (req, res) => ok(res, { user: req.user }));
const updateProfile = asyncHandler(async (req, res) =>
  ok(res, { user: await authManager.updateProfile(req.user.id, req.body) })
);
const changePassword = asyncHandler(async (req, res) => ok(res, await authManager.changePassword(req.user.id, req.body)));

// ---------- Google sign-in ----------

const readCookie = (req, name) => {
  const pair = (req.headers.cookie || '').split(';').map((c) => c.trim().split('=')).find(([key]) => key === name);
  return pair ? decodeURIComponent(pair.slice(1).join('=')) : '';
};

const googleStart = (req, res) => {
  const { url, nonce } = authManager.googleStart(req.query.returnTo);
  if (nonce) {
    res.cookie(NONCE_COOKIE, nonce, {
      httpOnly: true,
      sameSite: 'lax',
      secure: env.isProd,
      path: NONCE_COOKIE_PATH,
      maxAge: 10 * 60 * 1000,
    });
  }
  res.redirect(url);
};

/** Tokens go back in the URL fragment, which browsers never send to any server. */
const googleCallback = async (req, res) => {
  res.clearCookie(NONCE_COOKIE, { path: NONCE_COOKIE_PATH });
  if (req.query.error || !req.query.code) return res.redirect(`${env.clientUrl}/login?error=google`);
  try {
    const { session, returnTo } = await authManager.googleCallback({
      code: String(req.query.code),
      state: String(req.query.state || ''),
      nonce: readCookie(req, NONCE_COOKIE),
    });
    const fragment = new URLSearchParams({ token: session.token, refreshToken: session.refreshToken });
    res.redirect(`${env.clientUrl}/oauth-callback?returnTo=${encodeURIComponent(returnTo)}#${fragment}`);
  } catch (err) {
    logger.warn('Google sign-in failed:', err.message);
    res.redirect(`${env.clientUrl}/login?error=google`);
  }
};

module.exports = {
  config,
  register,
  login,
  verifyEmail,
  resendCode,
  forgotPassword,
  resetPassword,
  refresh,
  logout,
  me,
  updateProfile,
  changePassword,
  googleStart,
  googleCallback,
};
