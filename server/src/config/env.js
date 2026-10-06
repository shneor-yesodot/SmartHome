import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config();
dotenv.config({ path: path.join(__dirname, '../../.env') });
dotenv.config({ path: path.join(__dirname, '../../../.env') });

const required = ['MONGODB_URI', 'JWT_SECRET', 'JWT_REFRESH_SECRET'];

export function loadEnv() {
  const missing = required.filter((key) => !process.env[key]);
  if (process.env.NODE_ENV === 'production') {
    if (missing.length) throw new Error(`Missing required env vars: ${missing.join(', ')}`);
    const weak = ['JWT_SECRET', 'JWT_REFRESH_SECRET'].filter(
      (key) => process.env[key].length < 32 || process.env[key].includes('change-me')
    );
    if (weak.length) throw new Error(`Set long random values for: ${weak.join(', ')}`);
  }
  if (!process.env.JWT_SECRET) process.env.JWT_SECRET = 'dev-access-secret-change-me';
  if (!process.env.JWT_REFRESH_SECRET) process.env.JWT_REFRESH_SECRET = 'dev-refresh-secret-change-me';
  if (!process.env.MONGODB_URI) process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/smarthome';
}

export const env = {
  get port() {
    return Number(process.env.PORT) || 4000;
  },
  get mongoUri() {
    return process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/smarthome';
  },
  get jwtSecret() {
    return process.env.JWT_SECRET;
  },
  get jwtRefreshSecret() {
    return process.env.JWT_REFRESH_SECRET;
  },
  get accessTtl() {
    return process.env.JWT_ACCESS_TTL || '15m';
  },
  get refreshTtl() {
    return process.env.JWT_REFRESH_TTL || '7d';
  },
  get frontendUrl() {
    return process.env.FRONTEND_URL || 'http://localhost:5173';
  },
  get nodeEnv() {
    return process.env.NODE_ENV || 'development';
  },
  get isProd() {
    return process.env.NODE_ENV === 'production';
  },
};
