import "../src/config.js";
import bcrypt from "bcryptjs";
import sharp from "sharp";
import { createHash } from "node:crypto";
import { readFile, mkdir, writeFile, unlink } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolve, join } from "node:path";

// تم التعديل من عبير: معرفات ثابته تخلي اعاده التشغيل تضيف الناقص بدون تكرار او تغيير الموجود.
export function demoId(label) {
  const hex = createHash("sha256")
    .update("mezyad-showcase-v1:" + label)
    .digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
export const demoNames = [
  "Tala",
  "Abeer",
  "Ghadi",
  "Aseel",
  "Noura",
  "Sara",
  "Reem",
  "Lama",
  "Haya",
  "Reema",
  "Nouf",
  "Dana",
];
export const demoPassword = "Aa112233";
export const privateIndexes = [1, 6, 10, 15, 19, 25];
export function demoCode(index) {
  return createHash("sha256")
    .update("mezyad-local-demo-invite-v1:" + index)
    .digest("hex")
    .slice(0, 24);
}
export const catalog = [
  ["بورش كاريرا GT فضية", "Rare Vehicles", 4200000, "porsche-carrera-gt.jpg"],
  ["فيلا في حي حطين", "Real Estate", 4200000, "hittin-villa.jpg"],
  ["إبل وضح من سلالة مختارة", "Camels", 180000, "category-camels-hero.png"],
  ["لوحة ن ج د 1", "Vehicle Plates", 95000, "plate-njd1.jpg"],
  ["حقيبة جلد كلاسيكية", "Luxury Handbags", 8500, null],
  ["سيارة كلاسيكية حمراء", "Rare Vehicles", 195000, "notion/red-classic.webp"],
  ["مجلس بتصميم نجدي", "Real Estate", 1350000, "notion/heritage.webp"],
  ["ناقة وضحاء", "Camels", 135000, "category-camels-hero.png"],
  ["حقيبة سهرة جلدية", "Luxury Handbags", 12500, null],
  [
    "كلاسيكية بلون عنابي",
    "Rare Vehicles",
    245000,
    "notion/burgundy-classic.webp",
  ],
  ["لوحة حروف نجد", "Vehicle Plates", 110000, "plate-njd1.jpg"],
  ["فيلا بمجلس واسع", "Real Estate", 3850000, "hittin-villa.jpg"],
  ["سيارة كوبيه سوداء", "Rare Vehicles", 365000, "notion/black-coupe.webp"],
  ["ناقة من مزرعة خاصة", "Camels", 165000, "category-camels-hero.png"],
  ["حقيبة يد بلون هادئ", "Luxury Handbags", 9500, null],
  ["فيلا بتفاصيل داخلية أنيقة", "Real Estate", 2950000, "home-interior.jpg"],
  ["لوحة برقم منفرد", "Vehicle Plates", 78000, "plate-njd1.jpg"],
  [
    "كلاسيكية حمراء للمقتني",
    "Rare Vehicles",
    225000,
    "notion/red-classic.webp",
  ],
  ["أصل عقاري بطابع تراثي", "Real Estate", 1950000, "notion/heritage.webp"],
  ["حقيبة جلد للمقتني", "Luxury Handbags", 15000, null],
  [
    "بورش كاريرا من مجموعة خاصة",
    "Rare Vehicles",
    3950000,
    "porsche-carrera-gt.jpg",
  ],
  ["إبل من مجموعة خاصة", "Camels", 195000, "category-camels-hero.png"],
  ["لوحة مميزة للمقتني", "Vehicle Plates", 125000, "plate-njd1.jpg"],
  ["فيلا بتصميم معاصر", "Real Estate", 3650000, "hittin-villa.jpg"],
  [
    "سيارة كلاسيكية عنابية",
    "Rare Vehicles",
    185000,
    "notion/burgundy-classic.webp",
  ],
  [
    "كوبيه سوداء من مجموعة خاصة",
    "Rare Vehicles",
    325000,
    "notion/black-coupe.webp",
  ],
  ["كلاسيكية حمراء نادرة", "Rare Vehicles", 265000, "notion/red-classic.webp"],
  [
    "بورش كاريرا فضية للمقتني",
    "Rare Vehicles",
    4350000,
    "porsche-carrera-gt.jpg",
  ],
  [
    "سيارة عنابية بطابع كلاسيكي",
    "Rare Vehicles",
    215000,
    "notion/burgundy-classic.webp",
  ],
  [
    "كوبيه سوداء بتفاصيل مميزة",
    "Rare Vehicles",
    395000,
    "notion/black-coupe.webp",
  ],
];
// تم التعديل من عبير: هذي بيانات محليه معروفه الباسورد وما تنزرع ببيئه انتاج او اتصال بعيد.
export function assertLocalDemo(
  databaseUrl,
  production = process.env.NODE_ENV === "production",
) {
  if (!databaseUrl) throw new Error("Set DATABASE_URL and run db:setup first.");
  const url = new URL(databaseUrl);
  if (
    production ||
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !["localhost", "127.0.0.1", "[::1]", "db"].includes(url.hostname)
  ) {
    throw new Error(
      "Demo seed is allowed only on a local development database, never production.",
    );
  }
}
export async function seedDemo({
  pool,
  photosRoot = fileURLToPath(
    new URL("../../Frontend/public/images/", import.meta.url),
  ),
  uploadsRoot = fileURLToPath(new URL("../uploads/", import.meta.url)),
}) {
  const c = await pool.connect(),
    newFiles = [];
  let committed = false;
  try {
    await c.query("BEGIN");
    await c.query(
      "SELECT pg_advisory_xact_lock(hashtext('mezyad-showcase-v1'))",
    );
    await c.query("SELECT access_code_lookup FROM auctions LIMIT 0");
    const passwordHash = await bcrypt.hash(demoPassword, 12);
    const accounts = [];
    for (const name of demoNames) {
      const email = name.toLowerCase() + "@example.com",
        role = name === "Tala" ? "ADMIN" : "USER";
      const created = await c.query(
        "INSERT INTO users(id,name,email,password_hash,role) VALUES($1,$2,$3,$4,$5) ON CONFLICT(email) DO NOTHING RETURNING id",
        [demoId("account:" + name), name, email, passwordHash, role],
      );
      const user = (
        await c.query(
          "SELECT id,name,email,role,password_hash FROM users WHERE email=$1",
          [email],
        )
      ).rows[0];
      if (user.role !== role)
        throw new Error(
          `Existing ${email} has role ${user.role}; no role or password was changed. Use a separate local demo database.`,
        );
      accounts.push({
        ...user,
        created: created.rowCount === 1,
        password: (await bcrypt.compare(demoPassword, user.password_hash))
          ? demoPassword
          : "Existing password unchanged",
      });
    }
    const admin = accounts[0],
      sellers = accounts.slice(1),
      categories = new Map();
    for (const name of [
      "Camels",
      "Real Estate",
      "Luxury Handbags",
      "Vehicle Plates",
      "Rare Vehicles",
    ]) {
      await c.query(
        "INSERT INTO categories(name) VALUES($1) ON CONFLICT(name) DO NOTHING",
        [name],
      );
      categories.set(
        name,
        (await c.query("SELECT id FROM categories WHERE name=$1", [name]))
          .rows[0].id,
      );
    }
    const prepared = new Map();
    async function addImage(itemId, source) {
      if (!source) return;
      if (!prepared.has(source)) {
        const filename = demoId("photo:" + source) + ".jpg";
        // تم التعديل من عبير: نحفظ نسخه من صور المشروع بمجلد الرفع بدون لمس صور التصميم.
        const buffer = await sharp(await readFile(join(photosRoot, source)))
          .resize({ width: 1400, withoutEnlargement: true })
          .flatten({ background: "#eeeade" })
          .jpeg({ quality: 88 })
          .toBuffer();
        await mkdir(uploadsRoot, { recursive: true });
        try {
          await writeFile(join(uploadsRoot, filename), buffer, { flag: "wx" });
          newFiles.push(join(uploadsRoot, filename));
        } catch (error) {
          if (error.code !== "EEXIST") throw error;
        }
        prepared.set(source, "/uploads/" + filename);
      }
      await c.query(
        "INSERT INTO item_images(id,item_id,image_url) VALUES($1,$2,$3) ON CONFLICT(id) DO NOTHING",
        [demoId("image:" + itemId), itemId, prepared.get(source)],
      );
    }
    async function listing(key, title, category, price, photo, seller, status) {
      const itemId = demoId("item:" + key),
        reviewed = status !== "PENDING_REVIEW";
      const fields =
        category === "Rare Vehicles"
          ? {
              اللون: title.includes("حمراء")
                ? "أحمر"
                : title.includes("سوداء")
                  ? "أسود"
                  : "حسب الصور",
            }
          : category === "Real Estate"
            ? { المدينة: "الرياض" }
            : {};
      const inserted = await c.query(
        `INSERT INTO items(id,seller_id,category_id,title,description,category_fields,status,review_reason,reviewed_by,reviewed_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,CASE WHEN $9::uuid IS NULL THEN NULL ELSE clock_timestamp()-interval '2 hours' END)
        ON CONFLICT(id) DO NOTHING RETURNING id`,
        [
          itemId,
          seller.id,
          categories.get(category),
          title,
          "تعرّف على تفاصيل الأصل وصوره، وراجع المعلومات قبل تقديم عرضك.",
          JSON.stringify(fields),
          status,
          status === "REJECTED"
            ? "أضف تفاصيل أوضح عن حالة الأصل وأرفق صورًا إضافية قبل إعادة الإرسال."
            : null,
          reviewed ? admin.id : null,
        ],
      );
      const existing = (
        await c.query("SELECT seller_id FROM items WHERE id=$1", [itemId])
      ).rows[0];
      if (existing.seller_id !== seller.id)
        throw new Error(
          "Seed identifier conflict; existing data was not changed.",
        );
      if (inserted.rowCount) await addImage(itemId, photo);
      return itemId;
    }
    const auctions = [];
    for (let i = 0; i < catalog.length; i++) {
      const [title, category, price, photo] = catalog[i],
        seller = i === 1 ? sellers[0] : sellers[i % sellers.length];
      const itemId = await listing(
        "auction:" + i,
        title,
        category,
        price,
        photo,
        seller,
        "APPROVED",
      );
      const status = i < 12 ? "ACTIVE" : i < 20 ? "SCHEDULED" : "CLOSED",
        isPrivate = privateIndexes.includes(i),
        code = demoCode(i);
      const startHours =
        status === "ACTIVE"
          ? -2
          : status === "SCHEDULED"
            ? 24 + (i - 12) * 6
            : -72 - (i - 20) * 12;
      const endHours =
        status === "ACTIVE"
          ? 72 + i * 2
          : status === "SCHEDULED"
            ? startHours + 72
            : startHours + 24;
      const created = await c.query(
        `INSERT INTO auctions(id,item_id,visibility,access_code_hash,access_code_lookup,starting_price,current_price,minimum_increment,start_time,end_time,status)
        VALUES($1,$2,$3,$4,$5,$6,$6,$7,clock_timestamp()+$8*interval '1 hour',clock_timestamp()+$9*interval '1 hour',$10)
        ON CONFLICT(id) DO NOTHING RETURNING id`,
        [
          demoId("auction:" + i),
          itemId,
          isPrivate ? "PRIVATE" : "PUBLIC",
          isPrivate ? await bcrypt.hash(code, 12) : null,
          isPrivate
            ? createHash("sha256")
                .update("auction:" + code)
                .digest("hex")
            : null,
          price,
          price >= 1000000 ? 10000 : price >= 100000 ? 1000 : 500,
          startHours,
          endHours,
          status,
        ],
      );
      const row = (
        await c.query(
          `SELECT *,CASE WHEN status='CLOSED' OR end_time<=clock_timestamp() THEN 'CLOSED' WHEN start_time<=clock_timestamp() THEN 'ACTIVE' ELSE 'SCHEDULED' END AS display_status FROM auctions WHERE id=$1`,
          [demoId("auction:" + i)],
        )
      ).rows[0];
      if (row.item_id !== itemId)
        throw new Error(
          "Auction identifier conflict; existing data was not changed.",
        );
      if (created.rowCount && status === "CLOSED")
        await c.query(
          "INSERT INTO auction_results(auction_id,winner_bid_id,closed_at) VALUES($1,NULL,$2) ON CONFLICT(auction_id) DO NOTHING",
          [row.id, row.end_time],
        );
      auctions.push({
        id: row.id,
        title,
        seller: seller.name,
        status: row.display_status,
        visibility: row.visibility,
        created: created.rowCount === 1,
        accessCode:
          row.visibility === "PRIVATE" &&
          (await bcrypt.compare(code, row.access_code_hash))
            ? code
            : null,
      });
    }
    // تم التعديل من عبير: نترك اعلانات للمراجعه والرفض واعلانات معتمده يقدر المستخدم ينشئ لها مزاد بنفسه.
    for (let i = 0; i < 14; i++) {
      const status =
        i < 6 ? "PENDING_REVIEW" : i < 10 ? "REJECTED" : "APPROVED";
      const source = catalog[i % catalog.length],
        seller =
          i === 0
            ? sellers[0]
            : i === 6
              ? sellers[1]
              : sellers[i % sellers.length];
      await listing(
        "extra:" + i,
        source[0] + " — " + (i + 1),
        source[1],
        source[2],
        source[3],
        seller,
        status,
      );
    }
    // تم التعديل من عبير: ما ننشئ نجاح بنكي ولا عروض ماليه من ملف التعبئه؛ المزايده تمر بميسر من الموقع.
    await c.query("COMMIT");
    committed = true;
    return {
      accounts: accounts.map(({ password_hash, ...user }) => user),
      auctions,
      listingCount: 44,
    };
  } catch (error) {
    await c.query("ROLLBACK");
    if (!committed)
      for (const path of newFiles) await unlink(path).catch(() => {});
    throw error;
  } finally {
    c.release();
  }
}
async function main() {
  if (!process.argv.includes("--demo"))
    throw new Error("Run npm run db:demo explicitly.");
  assertLocalDemo(process.env.DATABASE_URL);
  const { pool } = await import("../src/db.js");
  try {
    const result = await seedDemo({
      pool,
      uploadsRoot: process.env.UPLOAD_DIR
        ? resolve(process.env.UPLOAD_DIR)
        : undefined,
    });
    console.log(
      "Local demo data saved. Existing data, passwords and auction times were preserved.",
    );
    console.table(
      result.accounts.map(({ name, email, role, password, created }) => ({
        name,
        email,
        role,
        password,
        created,
      })),
    );
    console.table(
      result.auctions.map(
        ({ id, title, seller, status, visibility, accessCode }) => ({
          id,
          title,
          seller,
          status,
          visibility,
          accessCode: accessCode || "-",
        }),
      ),
    );
    console.log(
      "Accounts:",
      result.accounts.length,
      "Listings:",
      result.listingCount,
      "Auctions:",
      result.auctions.length,
    );
    console.log(
      "New auctions this run:",
      result.auctions.filter((a) => a.created).length,
    );
    console.log(
      "Closed demo auctions have no bids and no winner. No bank success was inserted.",
    );
  } finally {
    await pool.end();
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
)
  main().catch((error) => {
    console.error("STOP:", error.message);
    process.exitCode = 1;
  });
