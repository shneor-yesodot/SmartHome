import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { env } from './env.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const embeddedDbPath = path.join(__dirname, '../../.data/db');

function isLocalUri(uri) {
  return /^mongodb:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(uri);
}

// Development fallback for machines without a MongoDB server: starts a real
// mongod (downloaded once by mongodb-memory-server) that stores its data in
// server/.data/db, on the same port as MONGODB_URI so Compass can connect to it.
async function startEmbeddedMongo(uri) {
  // Pin the binary cache so the (large) download happens once regardless of cwd.
  process.env.MONGOMS_DOWNLOAD_DIR ??= path.join(__dirname, '../../node_modules/.cache/mongodb-memory-server');
  const { MongoMemoryServer } = await import('mongodb-memory-server');
  fs.mkdirSync(embeddedDbPath, { recursive: true });
  const port = Number(new URL(uri).port) || 27017;
  const server = await MongoMemoryServer.create({
    instance: { port, dbPath: embeddedDbPath, storageEngine: 'wiredTiger' },
  });
  const stop = () => server.stop({ doCleanup: false }).finally(() => process.exit(0));
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  console.log(`Embedded MongoDB started on port ${port} (data: ${embeddedDbPath})`);
}

export async function connectDb() {
  mongoose.set('strictQuery', true);
  const uri = env.mongoUri;
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 3000 });
  } catch (err) {
    if (env.isProd || !isLocalUri(uri)) throw err;
    console.warn(`No MongoDB server at ${uri} — starting an embedded one for development.`);
    await startEmbeddedMongo(uri);
    await mongoose.connect(uri);
  }
  console.log('MongoDB connected');
}
