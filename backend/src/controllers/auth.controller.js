const authManager = require('../managers/auth.manager');
const asyncHandler = require('../utils/asyncHandler');
const env = require('../config/env');
const logger = require('../utils/logger');
const { ok, created } = require('../utils/response');

const GENERIC_SENT = 'אם הכתובת רשומה במערכת, נשלחה אליה הודעה';
const NONCE_COOKIE = 'oauth_nonce';
const NONCE_COOKIE_PATH = '/api/auth/google';
const REFRESH_COOKIE = 'sh_refresh';
const REFRESH_COOKIE_OPTIONS = { httpOnly: true, secure: env.isProd, sameSite: 'strict', path: '/api/auth' };

const readCookie = (req, name) => {
  const pair = (req.headers.cookie || '').split(';').map((c) => c.trim().split('=')).find(([key]) => key === name);
  return pair ? decodeURIComponent(pair.slice(1).join('=')) : '';
};

/**
 * The refresh token lives only in an httpOnly cookie, out of reach of any script
 * in the page, so even a script injected into the page cannot steal a lasting login.
 */
const withSessionCookie = (res, result) => {
  if (!result.refreshToken) return result;
  const { refreshToken, refreshExpiresAt, ...body } = result;
  res.cookie(REFRESH_COOKIE, refreshToken, { ...REFRESH_COOKIE_OPTIONS, expires: new Date(refreshExpiresAt) });
  return body;
};

const config = (_req, res) => ok(res, authManager.publicConfig());

const register = asyncHandler(async (req, res) => created(res, withSessionCookie(res, await authManager.register(req.body))));
const login = asyncHandler(async (req, res) => ok(res, withSessionCookie(res, await authManager.login(req.body))));
const loginTwoFactor = asyncHandler(async (req, res) => ok(res, withSessionCookie(res, await authManager.loginTwoFactor(req.body))));
const verifyEmail = asyncHandler(async (req, res) => ok(res, withSessionCookie(res, await authManager.verifyEmail(req.body))));
const resendCode = asyncHandler(async (req, res) => {
  await authManager.resendCode(req.body);
  ok(res, { message: 'אם יש חשבון שממתין לאימות, נשלח אליו קוד חדש' });
});
const forgotPassword = asyncHandler(async (req, res) => {
  await authManager.forgotPassword(req.body);
  ok(res, { message: GENERIC_SENT });
});
const resetPassword = asyncHandler(async (req, res) => ok(res, withSessionCookie(res, await authManager.resetPassword(req.body))));
const refresh = asyncHandler(async (req, res) => {
  ok(res, withSessionCookie(res, await authManager.refresh({ refreshToken: readCookie(req, REFRESH_COOKIE) })));
});
const logout = asyncHandler(async (req, res) => {
  await authManager.logout({ refreshToken: readCookie(req, REFRESH_COOKIE) });
  res.clearCookie(REFRESH_COOKIE, REFRESH_COOKIE_OPTIONS);
  ok(res, { message: 'התנתקת בהצלחה' });
});

const me = asyncHandler(async (req, res) => ok(res, { user: req.user }));
const updateProfile = asyncHandler(async (req, res) =>
  ok(res, { user: await authManager.updateProfile(req.user.id, req.body) })
);
const changePassword = asyncHandler(async (req, res) =>
  ok(res, withSessionCookie(res, await authManager.changePassword(req.user.id, req.body)))
);
const twoFactorSetup = asyncHandler(async (req, res) => ok(res, await authManager.twoFactorSetup(req.user.id, req.body)));
const twoFactorEnable = asyncHandler(async (req, res) => ok(res, await authManager.twoFactorEnable(req.user.id, req.body)));
const twoFactorDisable = asyncHandler(async (req, res) => ok(res, await authManager.twoFactorDisable(req.user.id, req.body)));

// ---------- Google sign-in ----------

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

/** The refresh token goes in its cookie; a two-factor challenge goes in the URL fragment, which browsers never send to a server. */
const googleCallback = async (req, res) => {
  res.clearCookie(NONCE_COOKIE, { path: NONCE_COOKIE_PATH });
  if (req.query.error || !req.query.code) return res.redirect(`${env.clientUrl}/login?error=google`);
  try {
    const { session, returnTo } = await authManager.googleCallback({
      code: String(req.query.code),
      state: String(req.query.state || ''),
      nonce: readCookie(req, NONCE_COOKIE),
    });
    if (session.twoFactorRequired) {
      return res.redirect(`${env.clientUrl}/login?returnTo=${encodeURIComponent(returnTo)}#challenge=${session.challenge}`);
    }
    withSessionCookie(res, session);
    res.redirect(`${env.clientUrl}/oauth-callback?returnTo=${encodeURIComponent(returnTo)}`);
  } catch (err) {
    logger.warn('Google sign-in failed:', err.message);
    res.redirect(`${env.clientUrl}/login?error=${err.statusCode === 403 ? 'google_closed' : 'google'}`);
  }
};

module.exports = {
  config,
  register,
  login,
  loginTwoFactor,
  verifyEmail,
  resendCode,
  forgotPassword,
  resetPassword,
  refresh,
  logout,
  me,
  updateProfile,
  changePassword,
  twoFactorSetup,
  twoFactorEnable,
  twoFactorDisable,
  googleStart,
  googleCallback,
};
