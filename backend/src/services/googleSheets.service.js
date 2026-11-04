/**
 * Google Sheets over its REST API, signed in with a service account. The owner
 * shares one spreadsheet with the service account's address; it can reach nothing else.
 */
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');

const API = 'https://sheets.googleapis.com/v4/spreadsheets';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
const TIMEOUT_MS = 30000;

const isConfigured = () => Boolean(env.googleServiceAccount);
const serviceEmail = () => env.googleServiceAccount?.email || null;

let cached = { token: null, expiresAt: 0 };

const accessToken = async () => {
  if (cached.token && cached.expiresAt > Date.now() + 60000) return cached.token;
  const { email, privateKey } = env.googleServiceAccount;
  const now = Math.floor(Date.now() / 1000);
  const assertion = jwt.sign({ iss: email, scope: SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600 }, privateKey, { algorithm: 'RS256' });
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new ApiError(502, 'ההתחברות ל-Google נכשלה. בדקו את מפתח חשבון השירות');
  const data = await res.json();
  cached = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return cached.token;
};

const call = async (path, { method = 'GET', body } = {}) => {
  const res = await fetch(`${API}/${path}`, {
    method,
    headers: { Authorization: `Bearer ${await accessToken()}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (res.status === 403) throw ApiError.forbidden(`אין גישה לגיליון. שתפו אותו כעורך עם ${serviceEmail()}`);
  if (res.status === 404) throw ApiError.notFound('הגיליון לא נמצא. בדקו את הקישור');
  if (!res.ok) throw new ApiError(502, 'Google Sheets לא הגיב כצפוי. נסו שוב בעוד כמה דקות');
  return res.json();
};

const range = (tab, cells = '') => encodeURIComponent(`'${tab}'${cells ? `!${cells}` : ''}`);

const client = {
  async title(spreadsheetId) {
    const meta = await call(`${spreadsheetId}?fields=properties.title`);
    return meta.properties.title;
  },

  /** Opens the tabs that are missing. */
  async ensureTabs(spreadsheetId, tabs) {
    const meta = await call(`${spreadsheetId}?fields=sheets.properties.title`);
    const existing = meta.sheets.map((s) => s.properties.title);
    const missing = tabs.filter((tab) => !existing.includes(tab));
    if (missing.length) {
      await call(`${spreadsheetId}:batchUpdate`, {
        method: 'POST',
        body: { requests: missing.map((title) => ({ addSheet: { properties: { title, rightToLeft: true } } })) },
      });
    }
  },

  async read(spreadsheetId, tab) {
    const data = await call(`${spreadsheetId}/values/${range(tab)}`);
    return data.values || [];
  },

  /** Replaces a tab's content. RAW: text starting with "=" stays text and never runs as a formula. */
  async replace(spreadsheetId, tab, values) {
    await call(`${spreadsheetId}/values/${range(tab)}:clear`, { method: 'POST', body: {} });
    await call(`${spreadsheetId}/values/${range(tab, 'A1')}?valueInputOption=RAW`, { method: 'PUT', body: { values } });
  },
};

module.exports = { isConfigured, serviceEmail, client };
