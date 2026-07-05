/**
 * Seed script — creates an initial admin user.
 * Run with: npm run seed
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const connectDB = require('../config/db');

const seedAdmin = async () => {
  await connectDB();

  const existing = await User.findOne({ username: 'admin' });
  if (existing) {
    console.log('[SEED] Admin user already exists. Skipping.');
    process.exit(0);
  }

  await User.create({
    name: 'Administrator',
    username: 'admin',
    passwordHash: 'admin123', // Will be hashed by pre-save hook
    role: 'admin',
    isActive: true,
  });

  console.log('[SEED] Admin user created successfully.');
  console.log('[SEED] Username: admin');
  console.log('[SEED] Password: admin123');
  console.log('[SEED] ⚠️  Change this password immediately in production!');

  process.exit(0);
};

seedAdmin().catch((err) => {
  console.error('[SEED] Error:', err.message);
  process.exit(1);
});
