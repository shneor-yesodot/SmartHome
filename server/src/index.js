import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { loadEnv, env } from './config/env.js';
import { connectDb } from './config/db.js';
import { ApiError, errorHandler } from './utils/ApiError.js';
import authRoutes from './routes/auth.js';
import transactionRoutes from './routes/transactions.js';
import categoryRoutes from './routes/categories.js';
import budgetRoutes from './routes/budgets.js';
import recurringRoutes from './routes/recurring.js';
import dashboardRoutes from './routes/dashboard.js';
import reportsRoutes from './routes/reports.js';
import { createUploadRouter } from './routes/upload.js';

loadEnv();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, '../uploads');
const frontendDist = path.join(__dirname, '../../dist');

const app = express();

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);
app.use(
  cors({
    origin: env.frontendUrl,
    credentials: true,
  })
);
app.use(express.json({ limit: '2mb' }));

const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300, standardHeaders: true });
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true });

app.use('/api', apiLimiter);
for (const p of ['login', 'register', 'verify-otp', 'resend-otp', 'forgot-password', 'reset-password']) {
  app.use(`/api/auth/${p}`, authLimiter);
}

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', authRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/budgets', budgetRoutes);
app.use('/api/recurring', recurringRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/reports', reportsRoutes);

app.use('/api/upload', createUploadRouter(uploadsDir));
app.use('/api', (_req, _res, next) => next(new ApiError(404, 'NOT_FOUND', 'נתיב API לא קיים')));

app.use('/uploads', express.static(uploadsDir));

if (env.isProd) {
  app.use(express.static(frontendDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

app.use(errorHandler);

await connectDb();
app.listen(env.port, () => {
  console.log(`SmartHome API listening on http://localhost:${env.port}`);
});
