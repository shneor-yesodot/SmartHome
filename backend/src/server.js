const app = require('./app');
const env = require('./config/env');
const { connectDB, disconnectDB } = require('./config/db');
const { startJobs } = require('./jobs');
const logger = require('./utils/logger');

const start = async () => {
  await connectDB();
  const listening = () => logger.info(`SmartHome API listening on ${env.host || 'port'}:${env.port} (${env.nodeEnv})`);
  const server = env.host ? app.listen(env.port, env.host, listening) : app.listen(env.port, listening);
  if (env.enableJobs) startJobs();

  // Graceful shutdown: finish open requests, then close the database connection
  const shutdown = (signal) => {
    logger.info(`${signal} received - shutting down`);
    server.close(async () => {
      await disconnectDB();
      process.exit(0);
    });
    server.closeAllConnections?.();
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  // Windows has no signals between processes: the launcher closes our input instead
  if (env.stopWithLauncher) {
    process.stdin.on('end', () => shutdown('launcher closed'));
    process.stdin.resume();
  }
};

process.on('unhandledRejection', (reason) => logger.error('Unhandled rejection:', reason));

start().catch((err) => {
  logger.error('Failed to start server:', err.message);
  process.exit(1);
});
