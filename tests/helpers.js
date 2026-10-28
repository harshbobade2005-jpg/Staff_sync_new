import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';

let mongod;
let app;

export async function setupTestDB() {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();
  process.env.JWT_ACCESS_SECRET = 'test-access-secret-min-32-chars-xx';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-min-32-chars-x';
  process.env.NODE_ENV = 'test';
  await mongoose.connect(mongod.getUri());
  app = createApp();
  return app;
}

export async function teardownTestDB() {
  await mongoose.disconnect();
  await mongod.stop();
}

export async function clearDB() {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
}

export { app };
