const fs = require('fs');
const path = require('path');
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
app.set('trust proxy', env.trustProxy); // behind nginx / a cloud load balancer

// ---- Security ----
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        'default-src': ["'self'"],
        'script-src': ["'self'"],
        'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'], // charts set inline styles
        'font-src': ["'self'", 'https://fonts.gstatic.com'],
        'img-src': ["'self'", 'data:', 'blob:'], // receipts are shown from blobs, the 2FA QR is a data URL
        'frame-src': ['blob:'], // PDF receipts
        'connect-src': ["'self'"],
        'worker-src': ["'self'"],
        'manifest-src': ["'self'"],
        'object-src': ["'none'"],
        'frame-ancestors': ["'none'"],
        'form-action': ["'self'"],
        'base-uri': ["'self'"],
      },
    },
    referrerPolicy: { policy: 'no-referrer' },
  })
);
app.use(
  cors({
    origin: env.clientUrls,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Content-Disposition'],
  })
);
app.use(express.json({ limit: '2mb' })); // large enough for a statement of 2,000 lines
app.use(mongoSanitize()); // strips "$" and "." keys -> blocks NoSQL operator injection
app.use(hpp()); // blocks HTTP parameter pollution

// ---- Infrastructure ----
app.use(compression());
if (!env.isTest) {
  // Query strings stay out of the log: they can hold password-reset tokens and OAuth codes
  morgan.token('path', (req) => req.originalUrl.split('?')[0]);
  app.use(
    morgan(env.isProd ? ':remote-addr [:date[clf]] ":method :path" :status :res[content-length] :response-time ms' : 'dev', {
      skip: (req) => req.path === '/api/health',
    })
  );
}

// ---- Routes ----
app.get('/api/health', (_req, res) => res.json({ success: true, data: { status: 'ok' } }));
// Financial data never stays in the browser's disk cache
app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});
app.use('/api', apiLimiter, routes);

// ---- The React app, when this server hosts it too (single-container deployment) ----
if (env.frontendDir && fs.existsSync(path.join(env.frontendDir, 'index.html'))) {
  const noCache = (res) => res.setHeader('Cache-Control', 'no-cache');
  app.use(
    '/assets',
    express.static(path.join(env.frontendDir, 'assets'), { immutable: true, maxAge: '1y', fallthrough: false })
  );
  app.use(express.static(env.frontendDir, { index: false, setHeaders: noCache }));
  app.get(/^\/(?!api\/).*/, (_req, res) => {
    noCache(res);
    res.sendFile(path.resolve(env.frontendDir, 'index.html'));
  });
}

// ---- Errors ----
app.use(notFound);
app.use(errorHandler);

module.exports = app;
