import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { Category } from '../models/Category.js';
import { ApiError } from '../utils/ApiError.js';
import { DEFAULT_CATEGORIES } from '../utils/defaultCategories.js';
import { serialize } from '../utils/serialize.js';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefresh,
  hashToken,
  randomOtp,
  randomToken,
} from '../utils/tokens.js';
import { sendMail, otpEmail, resetEmail } from '../services/email.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  registerSchema,
  loginSchema,
  otpSchema,
  resendOtpSchema,
  forgotSchema,
  resetSchema,
} from '../utils/schemas.js';
import { env } from '../config/env.js';

const router = express.Router();
const BCRYPT_ROUNDS = 12;
const OTP_TTL_MS = 10 * 60 * 1000;
const RESET_TTL_MS = 60 * 60 * 1000;
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

async function attachRefresh(user, refresh) {
  user.refreshTokens = (user.refreshTokens || [])
    .filter((t) => t.expiresAt > new Date())
    .concat([{ jti: refresh.jti, expiresAt: new Date(Date.now() + REFRESH_TTL_MS) }]);
  await user.save();
}

function authPayload(user, access, refreshToken) {
  return {
    status: 'success',
    data: {
      user: serialize(user),
      access_token: access,
      refresh_token: refreshToken,
    },
  };
}

async function seedCategories(userId) {
  const existing = await Category.countDocuments({ created_by_id: userId });
  if (existing) return;
  await Category.insertMany(DEFAULT_CATEGORIES.map((c) => ({ ...c, created_by_id: userId })));
}

router.post('/register', validate(registerSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;
    let user = await User.findOne({ email });
    if (user?.emailVerified) throw new ApiError(409, 'DUPLICATE', 'האימייל כבר רשום');

    const hashed = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const otp = randomOtp();
    const otpHash = hashToken(otp);
    const otpExpires = new Date(Date.now() + OTP_TTL_MS);

    if (user) {
      user.password = hashed;
      user.otpHash = otpHash;
      user.otpExpires = otpExpires;
      await user.save();
    } else {
      user = await User.create({
        email,
        password: hashed,
        role: 'user',
        emailVerified: false,
        otpHash,
        otpExpires,
      });
    }

    const mail = otpEmail(otp);
    await sendMail({ to: email, ...mail });

    const payload = { status: 'success', data: { email } };
    if (!env.isProd) payload.data.dev_otp = otp;
    res.status(201).json(payload);
  } catch (err) {
    next(err);
  }
});

router.post('/verify-otp', validate(otpSchema), async (req, res, next) => {
  try {
    const { email, otpCode } = req.body;
    const user = await User.findOne({ email });
    if (!user || !user.otpHash || !user.otpExpires) {
      throw new ApiError(400, 'INVALID_OTP', 'קוד אימות שגוי');
    }
    if (user.otpExpires < new Date() || user.otpHash !== hashToken(otpCode)) {
      throw new ApiError(400, 'INVALID_OTP', 'קוד אימות שגוי');
    }

    user.emailVerified = true;
    user.otpHash = undefined;
    user.otpExpires = undefined;
    await user.save();
    await seedCategories(user._id);

    const access = signAccessToken(user);
    const refresh = signRefreshToken(user);
    await attachRefresh(user, refresh);
    res.json(authPayload(user, access, refresh.token));
  } catch (err) {
    next(err);
  }
});

router.post('/resend-otp', validate(resendOtpSchema), async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (user && !user.emailVerified) {
      const otp = randomOtp();
      user.otpHash = hashToken(otp);
      user.otpExpires = new Date(Date.now() + OTP_TTL_MS);
      await user.save();
      await sendMail({ to: email, ...otpEmail(otp) });
      const payload = { status: 'success', data: { email } };
      if (!env.isProd) payload.data.dev_otp = otp;
      return res.json(payload);
    }
    res.json({ status: 'success', data: { email } });
  } catch (err) {
    next(err);
  }
});

router.post('/login', validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user?.password) throw new ApiError(401, 'UNAUTHORIZED', 'אימייל או סיסמה שגויים');
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) throw new ApiError(401, 'UNAUTHORIZED', 'אימייל או סיסמה שגויים');
    if (!user.emailVerified) throw new ApiError(403, 'UNVERIFIED', 'יש לאמת את האימייל');

    const access = signAccessToken(user);
    const refresh = signRefreshToken(user);
    await attachRefresh(user, refresh);
    res.json(authPayload(user, access, refresh.token));
  } catch (err) {
    next(err);
  }
});

router.post('/refresh', async (req, res, next) => {
  try {
    const token = req.body?.refresh_token;
    if (!token) throw new ApiError(401, 'UNAUTHORIZED', 'חסר refresh token');
    let payload;
    try {
      payload = verifyRefresh(token);
    } catch {
      throw new ApiError(401, 'UNAUTHORIZED', 'refresh token לא תקין');
    }
    const user = await User.findById(payload.sub);
    if (!user || !user.refreshTokens.some((t) => t.jti === payload.jti)) {
      throw new ApiError(401, 'UNAUTHORIZED', 'refresh token לא תקין');
    }
    user.refreshTokens = user.refreshTokens.filter((t) => t.jti !== payload.jti);
    const access = signAccessToken(user);
    const refresh = signRefreshToken(user);
    await attachRefresh(user, refresh);
    res.json(authPayload(user, access, refresh.token));
  } catch (err) {
    next(err);
  }
});

router.post('/forgot-password', validate(forgotSchema), async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (user) {
      const resetToken = randomToken();
      user.resetTokenHash = hashToken(resetToken);
      user.resetExpires = new Date(Date.now() + RESET_TTL_MS);
      await user.save();
      const link = `${env.frontendUrl}/reset-password?token=${resetToken}`;
      await sendMail({ to: email, ...resetEmail(link) });
    }
    res.json({ status: 'success', data: { ok: true } });
  } catch (err) {
    next(err);
  }
});

router.post('/reset-password', validate(resetSchema), async (req, res, next) => {
  try {
    const { resetToken, newPassword } = req.body;
    const user = await User.findOne({
      resetTokenHash: hashToken(resetToken),
      resetExpires: { $gt: new Date() },
    });
    if (!user) throw new ApiError(400, 'INVALID_TOKEN', 'קישור איפוס לא תקין');
    user.password = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    user.resetTokenHash = undefined;
    user.resetExpires = undefined;
    user.refreshTokens = [];
    await user.save();
    res.json({ status: 'success', data: { ok: true } });
  } catch (err) {
    next(err);
  }
});

router.get('/me', requireAuth, async (req, res) => {
  res.json({ status: 'success', data: serialize(req.user) });
});

router.post('/logout', requireAuth, async (req, res, next) => {
  try {
    const token = req.body?.refresh_token;
    if (token) {
      try {
        const payload = verifyRefresh(token);
        req.user.refreshTokens = (req.user.refreshTokens || []).filter((t) => t.jti !== payload.jti);
        await req.user.save();
      } catch {
        /* ignore */
      }
    }
    res.json({ status: 'success', data: { ok: true } });
  } catch (err) {
    next(err);
  }
});

const OAUTH_COOKIE = 'oauth_nonce';
const OAUTH_TTL_S = 10 * 60;

function googleRedirectUri(req) {
  return process.env.GOOGLE_CALLBACK_URL || `${req.protocol}://${req.get('host')}/api/auth/google/callback`;
}

function readCookie(req, name) {
  const match = (req.headers.cookie || '').split(';').map((c) => c.trim().split('=')).find(([k]) => k === name);
  return match ? decodeURIComponent(match[1] || '') : null;
}

function safeReturnPath(value) {
  const s = String(value || '/');
  return s.startsWith('/') && !s.startsWith('//') && !s.includes('\\') ? s : '/';
}

// Login CSRF protection: `state` is a signed token holding a random nonce that must match
// an httpOnly cookie set on this browser when the flow started.
router.get('/google', (req, res, next) => {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      console.warn('Google OAuth requested but GOOGLE_CLIENT_ID is not set');
      return res.redirect(`${env.frontendUrl}/login?error=google_unavailable`);
    }
    const nonce = randomToken();
    const state = jwt.sign({ nonce, returnTo: safeReturnPath(req.query.returnTo) }, env.jwtSecret, {
      expiresIn: OAUTH_TTL_S,
    });
    res.cookie(OAUTH_COOKIE, nonce, {
      httpOnly: true,
      sameSite: 'lax',
      secure: env.isProd,
      path: '/api/auth/google',
      maxAge: OAUTH_TTL_S * 1000,
    });
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', googleRedirectUri(req));
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'openid email profile');
    url.searchParams.set('state', state);
    res.redirect(url.toString());
  } catch (err) {
    next(err);
  }
});

router.get('/google/callback', async (req, res) => {
  const fail = (reason) => {
    console.warn('Google OAuth failed:', reason);
    res.redirect(`${env.frontendUrl}/login?error=google`);
  };
  try {
    const { code, state } = req.query;
    const nonce = readCookie(req, OAUTH_COOKIE);
    res.clearCookie(OAUTH_COOKIE, { path: '/api/auth/google' });
    if (!code || !state || !nonce) return fail('missing code, state or nonce cookie');
    let returnTo;
    try {
      const payload = jwt.verify(String(state), env.jwtSecret);
      if (payload.nonce !== nonce) return fail('state nonce mismatch');
      returnTo = safeReturnPath(payload.returnTo);
    } catch {
      return fail('invalid state');
    }

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: String(code),
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: googleRedirectUri(req),
        grant_type: 'authorization_code',
      }),
    });
    const tokenJson = await tokenRes.json();
    if (!tokenJson.access_token) return fail('token exchange failed');

    const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenJson.access_token}` },
    });
    const profile = await profileRes.json();
    // Accounts are matched by email, so only trust addresses Google has verified.
    if (!profile.email || !profile.verified_email) return fail('email missing or unverified');

    let user = await User.findOne({ email: profile.email.toLowerCase() });
    if (!user) {
      user = await User.create({
        email: profile.email.toLowerCase(),
        googleId: profile.id,
        emailVerified: true,
        role: 'user',
      });
      await seedCategories(user._id);
    } else {
      user.googleId = profile.id;
      user.emailVerified = true;
      await user.save();
    }

    const access = signAccessToken(user);
    const refresh = signRefreshToken(user);
    await attachRefresh(user, refresh);

    const fragment = new URLSearchParams({ access_token: access, refresh_token: refresh.token });
    res.redirect(`${env.frontendUrl}/oauth-callback?returnTo=${encodeURIComponent(returnTo)}#${fragment}`);
  } catch (err) {
    fail(err.message);
  }
});

export default router;
