import { createRequire } from "node:module";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(
  new URL("../backend/package.json", import.meta.url),
);
require("dotenv").config({ path: resolve(root, "backend/.env") });
require("dotenv").config({ path: resolve(root, ".env") });
const value = process.env.DATABASE_URL;
if (!value) throw new Error("Set DATABASE_URL in backend/.env first");
const url = new URL(value);
if (
  process.env.NODE_ENV === "production" ||
  !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
)
  throw new Error("Local database only");
const { Pool } = require("pg"),
  pool = new Pool({ connectionString: value });
// تم التعديل من عبير: نعدل اعلانات التجربه القديمه بس ونحفظ نسخه قبل التغيير بدون لمس الاسعار والعروض والملكيات.
try {
  const catalog = JSON.parse(
    await readFile(
      new URL("../Frontend/src/catalog-items.json", import.meta.url),
      "utf8",
    ),
  );
  const result = await pool.query(
    `SELECT i.*,c.name AS category_name FROM items i JOIN categories c ON c.id=i.category_id WHERE i.title ~* '^(retest|updated test|test listing|synthetic|demo)' OR (i.seller_id IN (SELECT id FROM users WHERE email IN ('abeer@example.com','ghadi@example.com','aseel@example.com','arwa@example.com','ali@example.com','tala@example.com')) AND i.title IN ('بورش كاريرا GT فضية — 1','إبل وضح من سلالة مختارة','سيارة كلاسيكية حمراء','سيارة كوبيه سوداء')) ORDER BY i.id`,
  );
  console.table(
    result.rows.map((row) => ({
      id: row.id,
      title: row.title,
      category: row.category_name,
    })),
  );
  if (!process.argv.includes("--apply")) {
    console.log(
      "Preview only Run with --apply to update these sample listings",
    );
  } else if (result.rows.length) {
    const ids = result.rows.map((row) => row.id),
      images = (
        await pool.query(
          "SELECT * FROM item_images WHERE item_id=ANY($1::uuid[])",
          [ids],
        )
      ).rows;
    const folder = resolve(root, ".local-backups");
    await mkdir(folder, { recursive: true });
    await writeFile(
      resolve(folder, "sample-listings-" + Date.now() + ".json"),
      JSON.stringify({ items: result.rows, images }, null, 2),
      { flag: "wx" },
    );
    process.chdir(resolve(root, "backend"));
    const { saveImages, removeImages } = await import(
      "../backend/src/uploads.js"
    );
    const client = await pool.connect(),
      created = [];
    try {
      await client.query("BEGIN");
      for (const [index, row] of result.rows.entries()) {
        const matches = catalog.filter(
          (item) => item.category_name === row.category_name,
        );
        const item = (matches.length ? matches : catalog)[
          index % (matches.length || catalog.length)
        ];
        const file = item.image_url.split("/").at(-1),
          buffer = await readFile(
            resolve(root, "Frontend/public/images/catalog", file),
          );
        const paths = await saveImages([
          { buffer, mimetype: "image/jpeg", originalname: file },
        ]);
        created.push(...paths);
        const category = (
          await client.query("SELECT id FROM categories WHERE name=$1", [
            item.category_name,
          ])
        ).rows[0];
        if (!category) throw new Error("Run db:setup before updating samples");
        await client.query(
          "UPDATE items SET title=$1,description=$2,category_id=$3,category_fields='{}'::jsonb WHERE id=$4",
          [item.title, item.description, category.id, row.id],
        );
        await client.query("DELETE FROM item_images WHERE item_id=$1", [
          row.id,
        ]);
        await client.query(
          "INSERT INTO item_images(item_id,image_url) VALUES($1,$2)",
          [row.id, paths[0]],
        );
      }
      await client.query("COMMIT");
      console.log("Updated sample listings:", result.rows.length);
    } catch (error) {
      await client.query("ROLLBACK");
      await removeImages(created);
      throw error;
    } finally {
      client.release();
    }
  }
} finally {
  await pool.end();
}
