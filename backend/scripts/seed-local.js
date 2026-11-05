import bcrypt from "bcryptjs";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { saveImages } from "../src/uploads.js";

// تم التعديل من عبير: نجهز بيانات محليه فقط ونقدر نوقفها بدون لمس شغل البنك والبريد.
export function localSeedEnabled(env = process.env) {
  if (env.NODE_ENV === "production" || env.SEED_LOCAL_DATA === "false")
    return false;
  const host = new URL(env.DATABASE_URL).hostname;
  return ["localhost", "127.0.0.1", "[::1]", "db"].includes(host);
}
const id = (value) => {
  const hex = createHash("sha256")
    .update("mezyad-local-v1:" + value)
    .digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
};

// تم التعديل من عبير: الحساب الموجود ما نغير اسمه او كلمه مروره او صلاحياته والتوثيق هنا لحسابات البيانات المحليه الجديده بس.
export async function seedLocal(client, savedImages) {
  const passwordHash = await bcrypt.hash("Aa112233", 12);
  const users = new Map();
  for (const [emailName, name] of [
    ["tala", "تالا"],
    ["abeer", "عبير"],
    ["ghadi", "غدي"],
    ["aseel", "اسيل"],
    ["arwa", "اروى"],
    ["ali", "علي"],
  ]) {
    const email = emailName + "@example.com";
    const created = await client.query(
      `INSERT INTO users(name,email,password_hash,role,email_verified_at) VALUES($1,$2,$3,$4,now())
       ON CONFLICT(email) DO NOTHING RETURNING id`,
      [name, email, passwordHash, emailName === "tala" ? "ADMIN" : "USER"],
    );
    const user = (
      await client.query("SELECT id,role FROM users WHERE email=$1", [email])
    ).rows[0];
    users.set(emailName, user);
    console.log(
      `Local account ${email} ${created.rowCount ? "created password Aa112233" : "exists unchanged"} role ${user.role}`,
    );
  }
  const catalog = JSON.parse(
    await readFile(
      new URL("../../Frontend/src/catalog-items.json", import.meta.url),
      "utf8",
    ),
  );
  const admin =
    users.get("tala").role === "ADMIN" ? users.get("tala").id : null;
  const specs = [
    ["public", "abeer", 0, "APPROVED", "PUBLIC", "ACTIVE"],
    ["private", "ghadi", 2, "APPROVED", "PRIVATE", "ACTIVE"],
    ["upcoming", "aseel", 1, "APPROVED", "PUBLIC", "SCHEDULED"],
    ["closed", "arwa", 3, "APPROVED", "PUBLIC", "CLOSED"],
    ["bag", "ali", 4, "APPROVED", "PUBLIC", "ACTIVE"],
    ["pending", "abeer", 4, "PENDING_REVIEW"],
    ["rejected", "ghadi", 2, "REJECTED"],
  ];
  // تم التعديل من عبير: معرفات ثابته تمنع التكرار والصور تنحفظ بنفس طريقه رفع الصور المعتاده.
  for (const [key, owner, index, status, visibility, auctionStatus] of specs) {
    const item = catalog[index],
      itemId = id("item-" + key);
    const category = (
      await client.query("SELECT id FROM categories WHERE name=$1", [
        item.category_name,
      ])
    ).rows[0];
    if (!category)
      throw new Error("Missing sample category " + item.category_name);
    const inserted = await client.query(
      `INSERT INTO items(id,seller_id,category_id,title,description,status,review_reason,reviewed_by,reviewed_at)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(id) DO NOTHING RETURNING id`,
      [
        itemId,
        users.get(owner).id,
        category.id,
        item.title,
        item.description,
        status,
        status === "REJECTED"
          ? "وضح تفاصيل الفحص وارفق صور اضافيه ثم اعد ارسال الاعلان"
          : null,
        status === "PENDING_REVIEW" ? null : admin,
        status === "PENDING_REVIEW" ? null : new Date(),
      ],
    );
    if (!inserted.rowCount) continue;
    const filename = item.image_url.split("/").at(-1);
    const buffer = await readFile(
      new URL(
        "../../Frontend/public/images/catalog/" + filename,
        import.meta.url,
      ),
    );
    const images = await saveImages([
      { buffer, mimetype: "image/jpeg", originalname: filename },
    ]);
    savedImages.push(...images);
    await client.query(
      "INSERT INTO item_images(item_id,image_url) VALUES($1,$2)",
      [itemId, images[0]],
    );
    if (!visibility) continue;
    const code = "112233445566778899aabbcc";
    const privateAuction = visibility === "PRIVATE";
    const startHours =
      auctionStatus === "SCHEDULED"
        ? 24
        : auctionStatus === "CLOSED"
          ? -72
          : -1;
    const endHours =
      auctionStatus === "CLOSED"
        ? -24
        : auctionStatus === "SCHEDULED"
          ? 96
          : 168;
    await client.query(
      `INSERT INTO auctions(id,item_id,visibility,access_code_hash,access_code_lookup,starting_price,current_price,minimum_increment,start_time,end_time,status)
       VALUES($1,$2,$3,$4,$5,$6,$6,$7,now()+$8*interval '1 hour',now()+$9*interval '1 hour',$10)`,
      [
        id("auction-" + key),
        itemId,
        visibility,
        privateAuction ? await bcrypt.hash(code, 12) : null,
        privateAuction
          ? createHash("sha256")
              .update("auction:" + code)
              .digest("hex")
          : null,
        item.starting_price,
        item.minimum_increment,
        startHours,
        endHours,
        auctionStatus,
      ],
    );
    if (auctionStatus === "CLOSED")
      await client.query(
        "INSERT INTO auction_results(auction_id,closed_at) VALUES($1,now()-interval '24 hours')",
        [id("auction-" + key)],
      );
  }
  // تم التعديل من عبير: ما ننشئ التزامات او عروض وهميه والمزاد الخاص له رمز معروف للتجربه المحليه.
  console.log(
    "Local samples ready Private code 112233445566778899aabbcc No bank commitments inserted",
  );
}
