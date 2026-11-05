import pg from "pg";

// نستخدم نفس مجموعة الاتصالات لكل استعلامات الباك.
export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

export function query(sql, params = []) {
  return pool.query(sql, params);
}
