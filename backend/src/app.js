const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const mongoSanitize = require('express-mongo-sanitize');
const hpp = require('hpp');

const env = require('./config/env');
const routes = require('./routes');
const { apiLimiter } = require('./middleware/rateLimiter');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1); // behind nginx / a cloud load balancer

// ---- Security ----
app.use(helmet());
app.use(
  cors({
    origin: env.clientUrls,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Content-Disposition'],
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(mongoSanitize()); // strips "$" and "." keys -> blocks NoSQL operator injection
app.use(hpp()); // blocks HTTP parameter pollution

// ---- Infrastructure ----
app.use(compression());
if (!env.isTest) app.use(morgan(env.isProd ? 'combined' : 'dev'));

// ---- Routes ----
app.get('/api/health', (_req, res) => res.json({ success: true, data: { status: 'ok', uptime: process.uptime() } }));
app.use('/api', apiLimiter, routes);

// ---- Errors ----
app.use(notFound);
app.use(errorHandler);

module.exports = app;
