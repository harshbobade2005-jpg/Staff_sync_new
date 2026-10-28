import mongoose from 'mongoose';
import { env } from './env.js';
import { runSeed } from '../seed/seed.js';
import { User } from '../models/user.model.js';

let embeddedMongo = null;

export async function connectDB() {
  let connected = false;

  // 1. Try external MONGODB_URI with a 2-second timeout
  try {
    await mongoose.connect(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 2000,
    });
    console.log(`✅  MongoDB connected to URI: ${mongoose.connection.host}`);
    connected = true;
  } catch (err) {
    console.log(`⚠️  External MongoDB not available (${err.message}). Launching embedded in-memory MongoDB…`);
  }

  // 2. If not connected, spin up embedded MongoMemoryServer
  if (!connected) {
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    embeddedMongo = await MongoMemoryServer.create();
    const memoryUri = embeddedMongo.getUri();
    await mongoose.connect(memoryUri);
    console.log(`✅  Embedded MongoDB connected: ${memoryUri}`);
  }

  // 3. Ensure database has active seed workforce records
  try {
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      console.log('🌱  Database is empty, auto-seeding workforce data…');
      await runSeed({ disconnect: false });
      console.log('🎉  Initial seed completed successfully!');
    } else {
      console.log(`📊  Database ready with ${userCount} active users.`);
    }
  } catch (seedErr) {
    console.error('Seed verification warning:', seedErr.message);
  }
}

export async function closeDB() {
  try {
    await mongoose.disconnect();
  } catch {}
  if (embeddedMongo) {
    try {
      await embeddedMongo.stop();
    } catch {}
  }
}

export function getDBStatus() {
  const state = mongoose.connection.readyState;
  return state === 1 ? 'connected' : 'disconnected';
}


