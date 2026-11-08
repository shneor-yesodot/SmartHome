/**
 * Central place for reading and validating environment variables.
 * The rest of the code never touches process.env directly.
 */
const path = require('path');

// Always the backend/.env file, whatever directory the process was started from.
// Real environment variables (Docker, a cloud host) take precedence.
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const nodeEnv = process.env.NODE_ENV || 'development';
const isProd = nodeEnv === 'production';

const secret = (name, devFallback) => {
  const value = process.env[name] || (isProd ? undefined : devFallback);
  if (!value) throw new Error(`${name} must be defined in production`);
  if (isProd && (value.length < 32 || value.includes('change-me'))) {
    throw new Error(`${name} must be a long random value in production`);
  }
  return value;
};

const clientUrls = (process.env.CLIENT_URL || 'http://localhost:5173').split(',').map((s) => s.trim());
const port = Number(process.env.PORT) || 5000;
const allowedEmails = (process.env.ALLOWED_EMAILS || '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

/** Google service account for the Sheets sync: raw JSON or base64 of it. */
const parseServiceAccount = (value) => {
  if (!value) return null;
  const text = value.trim().startsWith('{') ? value : Buffer.from(value, 'base64').toString('utf8');
  const parsed = JSON.parse(text);
  return { email: parsed.client_email, privateKey: String(parsed.private_key).replace(/\\n/g, '\n') };
};

const env = {
  nodeEnv,
  isProd,
  isTest: nodeEnv === 'test',
  port,
  // Empty = every network interface. The desktop launcher sets 127.0.0.1: only this computer
  host: process.env.HOST || '',
  // Started by SmartHome.exe: stop (and close the database cleanly) when the launcher goes away
  stopWithLauncher: process.env.STOP_WITH_LAUNCHER === 'true',
  clientUrls,
  // The first CLIENT_URL is where e-mail links and the Google login send the user back to
  clientUrl: clientUrls[0],
  // How many reverse proxies stand in front of the app (for the real client IP in rate limits)
  trustProxy: process.env.TRUST_PROXY === undefined ? 1 : Number(process.env.TRUST_PROXY),
  // The built React app, when the API serves it itself (the single-container deployment)
  frontendDir: process.env.FRONTEND_DIR || '',
  // Who may open an account. Empty = nobody in production, anybody in development.
  allowedEmails,
  encryptionKey: secret('ENCRYPTION_KEY', 'dev-only-encryption-key-change-me'),
  googleServiceAccount: parseServiceAccount(process.env.GOOGLE_SERVICE_ACCOUNT_JSON),
  // Empty in development = an embedded MongoDB is started automatically (see config/db.js)
  mongoUri: process.env.MONGO_URI || '',
  embeddedMongoPort: Number(process.env.EMBEDDED_MONGO_PORT) || 27018,
  jwt: {
    secret: secret('JWT_SECRET', 'dev-only-access-secret-change-me'),
    refreshSecret: secret('JWT_REFRESH_SECRET', 'dev-only-refresh-secret-change-me'),
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    callbackUrl: process.env.GOOGLE_CALLBACK_URL || `http://localhost:${port}/api/auth/google/callback`,
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
    model: process.env.GEMINI_MODEL || 'gemini-flash-latest',
  },
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT) || 587,
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.MAIL_FROM || 'SmartHome <no-reply@smarthome.local>',
  },
  uploadDir: process.env.UPLOAD_DIR || 'uploads',
  maxFileSizeMb: Number(process.env.MAX_FILE_SIZE_MB) || 8,
  enableJobs: process.env.ENABLE_JOBS !== 'false',
};

if (isProd && !env.mongoUri) throw new Error('MONGO_URI must be defined in production');

module.exports = env;
