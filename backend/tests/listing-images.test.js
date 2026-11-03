// نجرّب حفظ صور الإعلان واسترجاعها واستبدالها مع إعادة الإرسال.
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import sharp from "sharp";
import { setupQa, databaseSkip, expectError } from "./helpers/qa-fixtures.js";

let q, png;

// إعداد بيئة الاختبار وإنشاء صورة PNG افتراضية
before(async () => {
  if (databaseSkip) return;
  q = await setupQa("images");
  png = await sharp({
    create: { width: 4, height: 4, channels: 3, background: "#efd5af" },
  })
    .png()
    .toBuffer();
});

// إغلاق بيئة الاختبار بعد الانتهاء
after(async () => {
  if (q) await q.shutdown();
});

const check = (name, fn) => test(name, { skip: databaseSkip }, fn);

// دالة مساعدة لتجهيز نموذج البيانات (FormData) للإرسال في الاختبارات
function form({
  bytes = png,
  name = "photo.png",
  type = "image/png",
  title = "صورة تجريبية",
  fields = { location: "الرياض" },
  count = 1,
} = {}) {
  const value = new FormData();
  value.set("categoryId", q.category.id);
  value.set("title", title);
  value.set("description", "وصف للتجربة فقط");
  value.set("category_fields", JSON.stringify(fields));
  for (let i = 0; i < count; i++)
    value.append("images", new Blob([bytes], { type }), name);
  return value;
}

// دالة مساعدة لإرسال الطلبات إلى السيرفر
const send = (
  value,
  path = "/items",
  token = q.seller.token,
  method = "POST",
) => q.api(path, { method, token, form: value });

// دالة لتحميل الصورة مباشرة وتجربة روابطها
const download = async (path) =>
  fetch(`http://127.0.0.1:${new URL(q.base).port}${path}`);

// اختبار: نظام الـ Multipart يحفظ الصور المفكوكة وحقول الفئة؛ والروابط تتطلب توقيعات صالحة
check(
  "UPLOAD: multipart listing saves decoded images and category fields; links require valid signatures",
  async () => {
    const result = await send(form());
    assert.equal(result.status, 201, JSON.stringify(result.json));
    const item = result.json.data;

    assert.deepEqual(item.category_fields, { location: "الرياض" });
    assert.equal(item.images.length, 1);

    const stored = (
      await q.pool.query("SELECT image_url FROM item_images WHERE item_id=$1", [
        item.id,
      ])
    ).rows[0].image_url;
    assert.match(stored, /^\/uploads\/[a-f0-9-]+\.jpg$/);

    // التحقق من إمكانية تحميل الصورة بالرابط الموقع والموثق
    const image = await download(item.images[0]);
    assert.equal(image.status, 200);
    assert.equal(image.headers.get("cache-control"), "private, no-store");
    assert.equal(
      (await sharp(Buffer.from(await image.arrayBuffer())).metadata()).format,
      "jpeg",
    );

    // التأكد من رفض الروابط غير الموقعة أو التالفة أو منتهية التوقيع (404)
    assert.equal((await download(item.images[0].split("?")[0])).status, 404);
    assert.equal(
      (await download(item.images[0].replace(/signature=./, "signature=z")))
        .status,
      404,
    );

    // التحقق من الصلاحيات: مستخدم آخر لا يرى الإعلان الخاص، والأدمن يراه بصوره الكاملة
    assert.equal(
      (await q.api("/items/" + item.id, { token: q.bidder.token })).status,
      403,
    );
    assert.equal(
      (await q.api("/items/" + item.id, { token: q.admin.token })).json.data
        .images.length,
      1,
    );
  },
);

// اختبار QA-22: أنواع الملفات المزيفة، الامتدادات الخاطئة، الصور التالفة، الحجم الكبير، والعدد الزائد ترفض تماماً بدون مخلفات
check(
  "QA-22: spoofed MIME, wrong extension, corrupt image, oversized file and too many images are rejected without leftovers",
  async () => {
    const beforeFiles = await readdir(process.env.UPLOAD_DIR);
    const beforeRows = (
      await q.pool.query("SELECT count(*)::int AS n FROM items")
    ).rows[0].n;

    for (const input of [
      { bytes: Buffer.from("<svg/>"), name: "bad.svg", type: "image/svg+xml" },
      { name: "photo.exe" },
      { bytes: Buffer.from("not an image") },
      { bytes: png, type: "image/jpeg", name: "wrong.jpg" },
      { count: 7 },
      { count: 0 },
      { title: "x".repeat(241) },
    ])
      assert.equal((await send(form(input))).status, 400);

    // تجربة تجاوز الحد الأقصى للحجم (5 ميغابايت) والتأكد من إرجاع خطأ 413
    assert.equal(
      (await send(form({ bytes: Buffer.alloc(5 * 1024 * 1024 + 1) }))).status,
      413,
    );

    // التأكد من نظافة مجلد الرفع وعدم بقاء أي ملفات وهمية أو سجلات معلقة في قاعدة البيانات
    assert.deepEqual(await readdir(process.env.UPLOAD_DIR), beforeFiles);
    assert.equal(
      (await q.pool.query("SELECT count(*)::int AS n FROM items")).rows[0].n,
      beforeRows,
    );
  },
);

// اختبار: التراجع عند الرفع (Rollback)؛ الصورة التالفة الثانية تحذف الملف الأول المحفوظ وتلغي عملية إنشاء الإعلان
check(
  "UPLOAD rollback: a second corrupt image removes the first saved file and rolls back the listing",
  async () => {
    const beforeFiles = await readdir(process.env.UPLOAD_DIR);
    const value = form();
    value.append("images", new Blob(["bad"], { type: "image/png" }), "bad.png");

    expectError(await send(value), 400, "INVALID_IMAGE");
    assert.deepEqual(await readdir(process.env.UPLOAD_DIR), beforeFiles);
  },
);

// اختبار QA-17 صور: فقط المالك للإعلان المرفوض يمكنه استبدال الصور والحقول؛ والملفات القديمة تحذف بعد الاعتماد (Commit)
check(
  "QA-17 images: only rejected owner can replace photos and fields; old files removed after commit",
  async () => {
    const created = (await send(form())).json.data;

    // رفض الإعلان من قبل الأدمن
    await q.api("/admin/items/" + created.id + "/review", {
      method: "POST",
      token: q.admin.token,
      body: { decision: "REJECTED", reason: "صورة أوضح" },
    });

    // محاولة التعديل من مستخدم غير المالك ترفض (403)
    const forbidden = await send(
      form(),
      "/items/" + created.id,
      q.bidder.token,
      "PATCH",
    );
    expectError(forbidden, 403, "FORBIDDEN");

    // تعديل الإعلان وإعادة إرساله بنجاح من المالك
    const changed = await send(
      form({ fields: { location: "جدة" }, title: "بعد التعديل" }),
      "/items/" + created.id,
      q.seller.token,
      "PATCH",
    );

    assert.equal(changed.status, 200);
    assert.equal(changed.json.data.status, "PENDING_REVIEW");
    assert.equal(changed.json.data.review_reason, null);
    assert.deepEqual(changed.json.data.category_fields, { location: "جدة" });
    assert.notEqual(changed.json.data.images[0], created.images[0]);

    // التأكد من حذف الصورة القديمة تماماً وعدم توفرها (404) بينما الصورة الجديدة تعمل (200)
    assert.equal((await download(created.images[0])).status, 404);
    assert.equal((await download(changed.json.data.images[0])).status, 200);
  },
);

// اختبار: روابط صور المزادات الخاصة لا تظهر في الاكتشاف العام ولا للمستخدمين غير المصرح لهم
check(
  "private listing image URL is absent from public discovery and unauthorized private details",
  async () => {
    const item = (await send(form())).json.data;
    await q.api("/admin/items/" + item.id + "/review", {
      method: "POST",
      token: q.admin.token,
      body: { decision: "APPROVED" },
    });

    const a = await q.api("/auctions", {
      method: "POST",
      token: q.seller.token,
      body: {
        itemId: item.id,
        visibility: "PRIVATE",
        startingPrice: 1000,
        minimumIncrement: 10,
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() + 3600000).toISOString(),
      },
    });

    assert.equal(a.status, 201);
    const id = a.json.data.id;

    // التأكد من غياب المزاد الخاص عن القوائم العامة وعدم قدرة الزائر على رؤيته
    assert.equal(
      (await q.api("/auctions")).json.data.some((row) => row.id === id),
      false,
    );
    expectError(await q.api("/auctions/" + id), 404, "NOT_FOUND");

    // المالك يستطيع رؤية تفاصيل مزاده الخاص وصوره
    const detail = await q.api("/auctions/" + id, { token: q.seller.token });
    assert.equal(detail.json.data.images.length, 1);
  },
);

// اختبار: الأسماء القياسية (canonical) لحقول الفئة والصور تستمر عند الإنشاء وإعادة الإرسال؛ والأسماء غير الصالحة لا تحدث تغييراً
check(
  "canonical categoryFields and images persist on create and resubmission; invalid aliases make no change",
  async () => {
    const input = form();
    input.delete("category_fields");
    input.set(
      "categoryFields",
      JSON.stringify({ year: 2024, condition: "جديد" }),
    );

    const created = await send(input);
    assert.equal(created.status, 201);
    const item = created.json.data;

    assert.deepEqual(item.categoryFields, { year: 2024, condition: "جديد" });
    assert.deepEqual(item.category_fields, item.categoryFields);

    const review = await q.api("/admin/items/" + item.id + "/review", {
      method: "POST",
      token: q.admin.token,
      body: { decision: "REJECTED", reason: "تحديث الحالة" },
    });
    assert.equal(review.json.data.images.length, 1);

    const corrected = form();
    corrected.delete("category_fields");
    corrected.set("categoryFields", '{"year":2024,"condition":"مستعمل"}');

    const response = await send(
      corrected,
      "/items/" + item.id,
      q.seller.token,
      "PATCH",
    );
    assert.equal(response.status, 200);
    assert.deepEqual(response.json.data.categoryFields, {
      year: 2024,
      condition: "مستعمل",
    });

    const stored = (
      await q.pool.query("SELECT category_fields FROM items WHERE id=$1", [
        item.id,
      ])
    ).rows[0];
    assert.deepEqual(stored.category_fields, response.json.data.categoryFields);

    const invalid = form();
    invalid.set("categoryFields", '{"conflict":true}');
    expectError(await send(invalid), 400, "INVALID_INPUT");
  },
);

// اختبار DB-08: قوائم البائع والأدمن ترجع صور الإعلانات الصحيحة وحالة المراجعة بدقة
check(
  "DB-08: seller and admin lists return the correct listing images and review state",
  async () => {
    const own = (await send(form())).json.data;
    const other = (await send(form(), "/items", q.bidder.token)).json.data;

    for (const path of ["/items", "/me/items"]) {
      const response = await q.api(path, { token: q.seller.token });
      assert.equal(response.status, 200);
      assert.equal(
        response.json.data.some((item) => item.id === other.id),
        false,
      );
      assert.equal(
        response.json.data.find((item) => item.id === own.id).images.length,
        1,
      );
    }

    const pending = await q.api("/items?status=PENDING_REVIEW", {
      token: q.admin.token,
    });
    for (const id of [own.id, other.id]) {
      assert.equal(
        pending.json.data.find((item) => item.id === id).images.length,
        1,
      );
    }

    await q.api("/admin/items/" + own.id + "/review", {
      method: "POST",
      token: q.admin.token,
      body: { decision: "REJECTED", reason: "Add a clearer photograph" },
    });

    const list = await q.api("/me/items", { token: q.seller.token });
    const listing = list.json.data.find((item) => item.id === own.id);

    assert.equal(listing.status, "REJECTED");
    assert.equal(listing.review_reason, "Add a clearer photograph");
    assert.equal(listing.images.length, 1);
  },
);
