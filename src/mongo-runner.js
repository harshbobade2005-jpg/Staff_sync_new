import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { runSeed } from './seed/seed.js';

console.log('🚀  Starting persistent development MongoDB server on port 27017...');
const mongo = await MongoMemoryServer.create({
  instance: {
    port: 27017,
  },
  spawn: {
    timeout: 60000,
  },
});

console.log('✅  MongoDB listening at:', mongo.getUri());

try {
  await mongoose.connect('mongodb://127.0.0.1:27017/staffsync');
  console.log('🌱  Seeding database with departments, users, leaves, attendance, training...');
  await runSeed({ disconnect: true });
  console.log('🎉  MongoDB database seeded and fully operational!');
} catch (err) {
  console.error('Seed notification:', err.message);
}

// Keep process alive
process.on('SIGINT', async () => {
  await mongo.stop();
  process.exit(0);
});
process.on('SIGTERM', async () => {
  await mongo.stop();
  process.exit(0);
});

setInterval(() => {}, 60000);
