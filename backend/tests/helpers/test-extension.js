// نجهز الإضافة مرة وحدة عشان الاختبارات ما تتعارض.
export async function ensureTestExtension(pool) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(683921, 1)');
    await client.query('CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public');
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
