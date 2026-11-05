import "dotenv/config";
import { readFile } from "node:fs/promises";
import { pool } from "../src/db.js";
import { localSeedEnabled, seedLocal } from "./seed-local.js";
import { refreshLocalListings } from "./refresh-local.js";
import { removeImages } from "../src/uploads.js";

if (!process.env.DATABASE_URL) throw new Error("Set DATABASE_URL before setup");
const client = await pool.connect();
const savedImages = [];
let committed = false;
try {
  // الجداول والتصنيفات تنضاف مع بعض؛ التشغيل مرة ثانية ما يكررها.
  await client.query("BEGIN");
  // تم التعديل من عبير: نمنع تشغيل التهيئه مرتين بنفس الوقت عشان ما تتكرر البيانات.
  await client.query("SELECT pg_advisory_xact_lock(68291304)");
  for (const path of [
    "migrations/001_schema.sql",
    "migrations/002_private_auction_code_lookup.sql",
    "migrations/003_email_verification.sql",
    "migrations/004_moyasar.sql",
    "seeds/001_categories.sql",
  ]) {
    await client.query(
      await readFile(
        new URL("../../database/" + path, import.meta.url),
        "utf8",
      ),
    );
  }
  // تم التعديل من عبير: بعد الجداول نضيف بيانات محليه بدون تغيير الموجود او منطق البنك والبريد.
  if (localSeedEnabled()) {
    await seedLocal(client, savedImages);
    // تم التعديل من عبير: نشغل اصلاح اعلانات الاختبار القديمه بعد اضافه البيانات المحليه.
    await refreshLocalListings(client, savedImages);
  }
  await client.query("COMMIT");
  committed = true;
  console.log("Database schema and categories ready");
} catch (error) {
  await client.query("ROLLBACK");
  if (!committed) await removeImages(savedImages);
  throw error;
} finally {
  client.release();
  await pool.end();
}
