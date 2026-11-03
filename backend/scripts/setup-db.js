import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { pool } from '../src/db.js';

if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL before setup');
const client = await pool.connect();
try {
  // الجداول والتصنيفات تنضاف مع بعض؛ التشغيل مرة ثانية ما يكررها.
  await client.query('BEGIN');
  for (const path of ['migrations/001_schema.sql', 'migrations/002_private_auction_code_lookup.sql', 'seeds/001_categories.sql']) {
    await client.query(await readFile(new URL('../../database/' + path, import.meta.url), 'utf8'));
  }
  await client.query('COMMIT');
  console.log('Database schema and categories ready');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
  await pool.end();
}
