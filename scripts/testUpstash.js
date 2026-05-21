#!/usr/bin/env node
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { Redis } = require('@upstash/redis');

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

if (!url || !token) {
  console.error('Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN in .env');
  process.exit(2);
}

const r = new Redis({ url, token });

(async () => {
  try {
    // Set a short-lived test key
    await r.set('ddaily_upstash_test_key', 'ok', { ex: 60 });
    const val = await r.get('ddaily_upstash_test_key');
    console.log('Upstash test OK — got value:', val);

    // Optionally delete the key
    await r.del('ddaily_upstash_test_key');
    process.exit(0);
  } catch (err) {
    console.error('Upstash test failed:', err);
    process.exit(1);
  }
})();
