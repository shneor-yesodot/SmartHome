/**
 * Google sign-in (OAuth 2.0 authorization code flow), external service #3.
 * Only used when GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set.
 */
const env = require('../config/env');
const ApiError = require('../utils/ApiError');

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

const isConfigured = () => Boolean(env.google.clientId && env.google.clientSecret);

const buildAuthUrl = (state) => {
  const params = new URLSearchParams({
    client_id: env.google.clientId,
    redirect_uri: env.google.callbackUrl,
    response_type: 'code',
    scope: 'openid email profile',
    prompt: 'select_account',
    state,
  });
  return `${AUTH_URL}?${params}`;
};

/** Exchanges the one-time code for the user's Google profile. */
const fetchProfile = async (code) => {
  const tokenRes = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.google.clientId,
      client_secret: env.google.clientSecret,
      redirect_uri: env.google.callbackUrl,
      grant_type: 'authorization_code',
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!tokenRes.ok) throw new ApiError(502, 'ההתחברות עם Google נכשלה');
  const { access_token: accessToken } = await tokenRes.json();

  const profileRes = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(15000),
  });
  if (!profileRes.ok) throw new ApiError(502, 'ההתחברות עם Google נכשלה');
  return profileRes.json(); // { id, email, verified_email, name, ... }
};

module.exports = { isConfigured, buildAuthUrl, fetchProfile };
