import { readFile, mkdir, writeFile } from "node:fs/promises";
import { saveImages } from "../src/uploads.js";

// تم التعديل من عبير: نعدل اعلانات الاختبار المعروفه بس ونحفظ نسخه قبل التغيير بدون حذف المزادات او العروض.
export async function refreshLocalListings(client, savedImages) {
  const result =
    await client.query(`SELECT i.*,c.name AS category_name FROM items i JOIN categories c ON c.id=i.category_id
    WHERE i.title ~* '^(Retest (public|private|ended|updated Abeer)|Test (public|private|ended)|Updated test listing)'
    OR (i.seller_id IN (SELECT id FROM users WHERE email IN ('abeer@example.com','ghadi@example.com','aseel@example.com','arwa@example.com','ali@example.com','tala@example.com'))
    AND i.title IN ('بورش كاريرا GT فضية','بورش كاريرا GT فضية — 1','إبل وضح من سلالة مختارة','سيارة كلاسيكية حمراء','سيارة كوبيه سوداء','شنطه جلديه عنابيه بيد قصيره')) ORDER BY i.id FOR UPDATE OF i`);
  if (!result.rowCount) return;
  const ids = result.rows.map((row) => row.id);
  const images = (
    await client.query(
      "SELECT * FROM item_images WHERE item_id=ANY($1::uuid[])",
      [ids],
    )
  ).rows;
  const auctions = (
    await client.query("SELECT * FROM auctions WHERE item_id=ANY($1::uuid[])", [
      ids,
    ])
  ).rows;
  const folder = new URL("../../.local-backups/", import.meta.url);
  await mkdir(folder, { recursive: true });
  await writeFile(
    new URL(`listing-refresh-${Date.now()}.json`, folder),
    JSON.stringify({ items: result.rows, images, auctions }, null, 2),
    { flag: "wx" },
  );
  const catalog = JSON.parse(
    await readFile(
      new URL("../../Frontend/src/catalog-items.json", import.meta.url),
      "utf8",
    ),
  );
  const legacy = JSON.parse(
    await readFile(
      new URL("../../Frontend/src/legacy-catalog.json", import.meta.url),
      "utf8",
    ),
  );
  let count = 0;
  for (const row of result.rows) {
    const categoryName =
      row.category_name === "Luxury Handbags"
        ? "Real Estate"
        : row.category_name;
    const candidates = catalog.filter(
      (item) => item.category_name === categoryName,
    );
    const testListing = /^(Retest |Test |Updated test listing)/i.test(
      row.title,
    );
    const item = testListing
      ? legacy[count % legacy.length]
      : (candidates.length ? candidates : catalog)[
          count % (candidates.length || catalog.length)
        ];
    const category = (
      await client.query("SELECT id FROM categories WHERE name=$1", [
        item.category_name,
      ])
    ).rows[0];
    if (!category) throw new Error("Sample category missing");
    const filename = item.image_url.split("/").at(-1);
    const buffer = await readFile(
      new URL(
        "../../Frontend/public/images/catalog/" + filename,
        import.meta.url,
      ),
    );
    const paths = await saveImages([
      {
        buffer,
        mimetype: filename.endsWith(".webp") ? "image/webp" : "image/jpeg",
        originalname: filename,
      },
    ]);
    savedImages.push(...paths);
    await client.query(
      "UPDATE items SET title=$1,description=$2,category_id=$3,category_fields='{}'::jsonb WHERE id=$4",
      [item.title, item.description, category.id, row.id],
    );
    await client.query("DELETE FROM item_images WHERE item_id=$1", [row.id]);
    await client.query(
      "INSERT INTO item_images(item_id,image_url) VALUES($1,$2)",
      [row.id, paths[0]],
    );
    // تم التعديل من عبير: نضبط سعر الحقيبه اللي صارت ارض فقط اذا ما عليها عروض او التزامات ونحفظ الباقي مثل ما هو.
    if (row.category_name === "Luxury Handbags")
      await client.query(
        `UPDATE auctions a SET starting_price=$2,current_price=$2,minimum_increment=$3
      WHERE item_id=$1 AND NOT EXISTS(SELECT 1 FROM bids b WHERE b.auction_id=a.id)
      AND NOT EXISTS(SELECT 1 FROM bid_commitments c WHERE c.auction_id=a.id)`,
        [row.id, item.starting_price, item.minimum_increment],
      );
    count++;
  }
  console.log(
    `Updated ${count} local sample listings Backup saved in .local-backups Existing auction IDs bids and owners preserved`,
  );
}
