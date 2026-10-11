const path = require('path');
const mongoose = require('mongoose');
const env = require('./env');
const logger = require('../utils/logger');

mongoose.set('strictQuery', true);

let embedded = null;

/**
 * Development without MONGO_URI: start a real MongoDB process from the
 * mongodb-memory-server package (a dev dependency). Data is kept in
 * backend/.data/db, so it survives restarts, and Compass can connect to
 * mongodb://127.0.0.1:<EMBEDDED_MONGO_PORT>.
 */
const startEmbedded = async () => {
  // Already running (e.g. "npm run seed" while the dev server is up)? Just use it.
  const runningUri = `mongodb://127.0.0.1:${env.embeddedMongoPort}/smarthome`;
  const probe = mongoose.createConnection(runningUri, { serverSelectionTimeoutMS: 1500 });
  try {
    await probe.asPromise();
    await probe.close();
    logger.info(`Using the embedded MongoDB already running on port ${env.embeddedMongoPort}`);
    return runningUri;
  } catch {
    await probe.close().catch(() => {});
  }

  let MongoMemoryServer;
  try {
    ({ MongoMemoryServer } = require('mongodb-memory-server'));
  } catch {
    throw new Error('MONGO_URI is not set and mongodb-memory-server is not installed (run npm install in backend)');
  }
  const dbPath = path.join(__dirname, '../../.data/db');
  require('fs').mkdirSync(dbPath, { recursive: true });
  embedded = await MongoMemoryServer.create({
    instance: { port: env.embeddedMongoPort, dbPath, storageEngine: 'wiredTiger' },
  });
  logger.info(`Embedded MongoDB started on port ${env.embeddedMongoPort} (data: ${dbPath})`);
  return `${embedded.getUri()}smarthome`;
};

const connectDB = async () => {
  mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'));
  mongoose.connection.on('error', (err) => logger.error('MongoDB error', err.message));

  const uri = env.mongoUri || (await startEmbedded());
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
  logger.info(`MongoDB connected: ${mongoose.connection.host}:${mongoose.connection.port}/${mongoose.connection.name}`);
};

const disconnectDB = async () => {
  if (embedded) {
    // Stopping the embedded server kills the process (always so on Windows),
    // so flush pending writes to disk first
    await mongoose.connection.db.admin().command({ fsync: 1 }).catch(() => {});
  }
  await mongoose.disconnect();
  if (embedded) await embedded.stop({ doCleanup: false });
};

module.exports = { connectDB, disconnectDB };
