#!/usr/bin/env node
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('MONGODB_URI not set in .env');
  process.exit(1);
}

const argv = process.argv.slice(2);
function getArg(name) {
  const idx = argv.indexOf(`--${name}`);
  if (idx === -1) return undefined;
  return argv[idx + 1];
}

const targetEmail = getArg('target-email') || 'admin@ddaily.co.ke';
const newEmail = getArg('new-email') || getArg('new_email') || 'dandailybusiness02@gmail.com';
const newPassword = getArg('password') || getArg('new-password') || 'Admin@DDailyLtd2026';

async function run() {
  await mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('Connected to MongoDB');

  // Load compiled Admin model from dist if available, otherwise try source
  let AdminModel;
  try {
    AdminModel = require('../dist/models/Admin').Admin;
  } catch (e) {
    try {
      AdminModel = require('../src/models/Admin').Admin;
    } catch (err) {
      console.error('Failed to load Admin model from dist or src:', err);
      process.exit(1);
    }
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);

  const res = await AdminModel.findOneAndUpdate(
    { email: targetEmail.toLowerCase() },
    { $set: { email: newEmail.toLowerCase(), passwordHash } },
    { new: true }
  );

  if (res) {
    console.log('Admin updated successfully:');
    console.log({ id: res._id, email: res.email });
  } else {
    console.log('Admin with target email not found. Consider seeding new admin or check email.');
  }

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
