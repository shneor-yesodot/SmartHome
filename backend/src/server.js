const app = require('./app');
const env = require('./config/env');
const { connectDB, disconnectDB } = require('./config/db');
const { startJobs } = require('./jobs');
const logger = require('./utils/logger');

const start = async () => {
  await connectDB();
  const server = app.listen(env.port, () => logger.info(`SmartHome API listening on port ${env.port} (${env.nodeEnv})`));
  if (env.enableJobs) startJobs();

  // Graceful shutdown: finish open requests, then close the database connection
  const shutdown = (signal) => {
    logger.info(`${signal} received - shutting down`);
    server.close(async () => {
      await disconnectDB();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
};

process.on('unhandledRejection', (reason) => logger.error('Unhandled rejection:', reason));

start().catch((err) => {
  logger.error('Failed to start server:', err.message);
  process.exit(1);
});
