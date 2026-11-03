// نختبر الطلبات الخاطئة ومحاولات الدخول المتكررة والإصلاحات الأمنية.
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { setupQa, databaseSkip, expectError } from "./helpers/qa-fixtures.js";

let q;

// إعداد بيئة الاختبار قبل البدء
before(async () => {
  if (!databaseSkip) q = await setupQa("fixes");
});

// إغلاق الاتصال بعد انتهاء الاختبارات
after(async () => {
  if (q) await q.shutdown();
});

const check = (name, fn) => test(name, { skip: databaseSkip }, fn);

// اختبار: المسارات التي تحتوي على معرفات UUID غير صالحة ترجع خطأ 400 بتنسيق JSON بدلاً من أخطاء قاعدة البيانات
check(
  "invalid UUID paths return 400 JSON instead of database errors",
  async () => {
    for (const [path, method, token, body] of [
      ["/items/no-id", "GET", q.seller.token],
      ["/items/no-id", "PATCH", q.seller.token, {}],
      [
        "/admin/items/no-id/review",
        "POST",
        q.admin.token,
        { decision: "APPROVED" },
      ],
      ["/auctions/no-id", "GET"],
      ["/auctions/no-id/access", "POST", q.bidder.token, {}],
      ["/auctions/no-id/commitment", "GET", q.bidder.token],
      ["/auctions/no-id/bids", "GET", q.bidder.token],
    ])
      expectError(
        await q.api(path, { method, token, body }),
        400,
        "INVALID_ID",
      );
  },
);

// اختبار QA-05: قيود المعدل (Rate Limit)؛ المحاولات المتكررة الخاطئة تحظر المستخدم ويظل إذن الوصول غائباً
check(
  "QA-05 rate limit: repeated guesses are blocked and grant remains absent",
  async () => {
    const a = await q.auction({ visibility: "PRIVATE" });

    // إرسال 10 محاولات خاطئة لكود الدخول
    for (let i = 0; i < 10; i++)
      expectError(
        await q.api("/auctions/" + a.id + "/access", {
          method: "POST",
          token: q.bidder.token,
          body: { accessCode: "wrong" },
        }),
        403,
        "INVALID_CODE",
      );

    // المحاولة الحادية عشرة يجب أن تقابل بحظر بسبب تجاوز الحد (429 Too Many Requests)
    expectError(
      await q.api("/auctions/" + a.id + "/access", {
        method: "POST",
        token: q.bidder.token,
        body: { accessCode: a.accessCode },
      }),
      429,
      "TOO_MANY_REQUESTS",
    );

    // التأكد من عدم منح أي صلاحية دخول في قاعدة البيانات لهذا المستخدم
    assert.equal(
      (
        await q.pool.query(
          "SELECT count(*)::int AS n FROM private_auction_access WHERE auction_id=$1",
          [a.id],
        )
      ).rows[0].n,
      0,
    );

    // التأكد من أن مستخدم آخر (q.bidder2) لم يتأثر بالحظر ويمكنه الدخول بالكود الصحيح
    assert.equal(
      (
        await q.api("/auctions/" + a.id + "/access", {
          method: "POST",
          token: q.bidder2.token,
          body: { accessCode: a.accessCode },
        })
      ).status,
      200,
    );
  },
);

// اختبار: طلب استعلام الالتزام للمزادات الخاصة يتطلب إذن وصول حتى لو كان السجل التجريبي موجوداً
check(
  "private commitment GET requires grant even when a synthetic row already exists",
  async () => {
    const a = await q.auction({ visibility: "PRIVATE" });
    await q.commitment(a);

    // محاولة الجلب بدون إذن وصول يجب أن تفشل (404)
    expectError(
      await q.api("/auctions/" + a.id + "/commitment", {
        token: q.bidder.token,
      }),
      404,
      "NOT_FOUND",
    );

    // منح الإذن ثم التأكد من نجاح الطلب
    await q.grant(a);
    assert.equal(
      (
        await q.api("/auctions/" + a.id + "/commitment", {
          token: q.bidder.token,
        })
      ).status,
      200,
    );
  },
);

// اختبار: المزادات المجدولة تصبح نشطة تلقائياً؛ والمنتهية تحدث حالتها إلى مغلقة وتتطابق مع التفاصيل
check(
  "scheduled auctions become active without a bid; expired list status and final detail agree",
  async () => {
    const active = await q.auction({ status: "SCHEDULED" });
    const expired = await q.auction({ end: "-1 second", status: "SCHEDULED" });

    const list = await q.api(
      "/auctions?status=ACTIVE&categoryId=" + q.category.id,
    );
    assert.equal(list.status, 200);
    assert.ok(list.json.data.some((row) => row.id === active.id));
    assert.equal(
      list.json.data.some((row) => row.id === expired.id),
      false,
    );

    const detail = await q.api("/auctions/" + active.id);
    assert.equal(detail.json.data.status, "ACTIVE");
    assert.equal(
      (await q.api("/auctions/" + expired.id)).json.data.status,
      "CLOSED",
    );

    // التحقق من رفض الفلاتر غير الصالحة
    expectError(await q.api("/auctions?categoryId=bad"), 400, "INVALID_INPUT");
    expectError(await q.api("/auctions?status=bad"), 400, "INVALID_INPUT");
  },
);

// اختبار: الأدمن وحده يستطيع مراقبة جميع المزادات الخاصة عبر scope=all؛ والمستخدم العادي والزائر ترفض طلباتهم
check(
  "admin can monitor private auctions; anonymous and USER cannot request all scope",
  async () => {
    const a = await q.auction({ visibility: "PRIVATE" });

    expectError(await q.api("/auctions?scope=all"), 401, "UNAUTHORIZED");
    expectError(
      await q.api("/auctions?scope=all", { token: q.bidder.token }),
      403,
      "FORBIDDEN",
    );

    const list = await q.api("/auctions?scope=all", { token: q.admin.token });
    assert.ok(list.json.data.some((row) => row.id === a.id));
    assert.equal(
      (await q.api("/auctions/" + a.id, { token: q.admin.token })).status,
      200,
    );
  },
);

// اختبار: مراجعة الإعلان تتطلب سبباً غير فارغ وترفض النصوص الطويلة جداً؛ وفحص حدود التصفح (Pagination) في سجل المزايدات
check(
  "review requires nonblank reason and rejects overlong text; history validates paging",
  async () => {
    const item = await q.item({ status: "PENDING_REVIEW" });

    // تجربة أسباب مرفوضة (فارغة أو أطول من 2000 حرف)
    for (const reason of ["   ", "x".repeat(2001)])
      expectError(
        await q.api("/admin/items/" + item.id + "/review", {
          method: "POST",
          token: q.admin.token,
          body: { decision: "REJECTED", reason },
        }),
        400,
        "INVALID_INPUT",
      );

    const a = await q.auction();

    // التحقق من أن حدود التقسيم غير الصالحة ترجع خطأ 400
    for (const query of ["limit=101", "limit=-1", "offset=-1", "offset=bad"])
      expectError(
        await q.api("/auctions/" + a.id + "/bids?" + query, {
          token: q.bidder.token,
        }),
        400,
        "INVALID_INPUT",
      );
  },
);

// اختبار: أخطاء دعوات المزادات الخاصة ترجع نفس الاستجابة (لتجنب كشف وجود المزاد للأشخاص غير المصرح لهم)
check(
  "private invitation failures use the same response for missing and hidden auctions",
  async () => {
    const a = await q.auction({ visibility: "PRIVATE" });
    const options = {
      method: "POST",
      token: q.bidder.token,
      body: { accessCode: "wrong" },
    };

    const hidden = await q.api("/auctions/" + a.id + "/access", options);
    const missing = await q.api(
      "/auctions/00000000-0000-0000-0000-000000000000/access",
      options,
    );

    // التأكد من تطابق الحالة وهيكل الخطأ تماماً لمنع تسريب معلومات الـ IDs
    assert.equal(hidden.status, missing.status);
    assert.deepEqual(hidden.json, missing.json);
  },
);
