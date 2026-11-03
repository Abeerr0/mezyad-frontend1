// نختبر مسارات الإعلان والمزاد والصلاحيات بطلبات فعلية.
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { setupQa, databaseSkip, expectError } from "./helpers/qa-fixtures.js";

let q;
// إعداد بيئة اختبار السوق قبل البدء
before(async () => {
  if (!databaseSkip) q = await setupQa("marketplace");
});
// إغلاق الاتصال بعد الانتهاء
after(async () => {
  if (q) await q.shutdown();
});

const check = (name, fn) => test(name, { skip: databaseSkip }, fn);

// دالة مساعدة لتوليد جسم طلب المزاد الافتراضي
const auctionBody = (itemId) => ({
  itemId,
  visibility: "PUBLIC",
  startingPrice: 1000,
  minimumIncrement: 50,
  startTime: new Date(Date.now() - 60000).toISOString(),
  endTime: new Date(Date.now() + 3600000).toISOString(),
});

// اختبار LIST-01: المالك المصرح له ينشئ إعلان بصيغة JSON بحالة قيد المراجعة مع حقول الفئة
check(
  "LIST-01: authenticated owner creates a JSON listing in PENDING_REVIEW with category fields",
  async () => {
    const response = await q.api("/items", {
      method: "POST",
      token: q.seller.token,
      body: {
        categoryId: q.category.id,
        title: "  Synthetic listing  ",
        description: " Fixture description ",
        categoryFields: { fixture: true },
      },
    });
    assert.equal(response.status, 201);
    assert.equal(response.json.data.seller_id, q.seller.id);
    assert.equal(response.json.data.status, "PENDING_REVIEW");
    assert.equal(response.json.data.title, "Synthetic listing");
    assert.deepEqual(response.json.data.category_fields, { fixture: true });
  },
);

// اختبار LIST-02: غياب المصادقة أو الحقول غير الصالحة تمنع إنشاء الإعلانات
check(
  "LIST-02: missing auth and invalid listing fields do not create listings",
  async () => {
    expectError(
      await q.api("/items", { method: "POST", body: {} }),
      401,
      "UNAUTHORIZED",
    );
    for (const body of [
      {},
      { categoryId: q.category.id, title: " ", description: "x" },
      {
        categoryId: q.category.id,
        title: "x",
        description: "x",
        categoryFields: [],
      },
    ]) {
      expectError(
        await q.api("/items", { method: "POST", token: q.seller.token, body }),
        400,
        "INVALID_INPUT",
      );
    }
    expectError(
      await q.api("/items", {
        method: "POST",
        token: q.seller.token,
        body: { categoryId: randomUUID(), title: "x", description: "x" },
      }),
      400,
      "INVALID_CATEGORY",
    );
  },
);

// اختبار LIST-03: فقط المالك أو الأدمن يستطيع قراءة الإعلان الفردي؛ والقوائم مخصصة لصاحبها
check(
  "LIST-03: only owner or ADMIN can read an individual listing; lists are owner-scoped",
  async () => {
    const listing = await q.item({ status: "PENDING_REVIEW" });
    expectError(
      await q.api("/items/" + listing.id, { token: q.bidder.token }),
      403,
      "FORBIDDEN",
    );
    assert.equal(
      (await q.api("/items/" + listing.id, { token: q.admin.token })).status,
      200,
    );
    const own = await q.api("/items", { token: q.seller.token });
    assert.ok(own.json.data.every((item) => item.seller_id === q.seller.id));
    const pending = await q.api("/items?status=PENDING_REVIEW", {
      token: q.admin.token,
    });
    assert.ok(pending.json.data.some((item) => item.id === listing.id));
    assert.ok(
      pending.json.data.every((item) => item.status === "PENDING_REVIEW"),
    );
  },
);

// اختبار QA-03: المستخدم العادي لا يراجع الإعلانات؛ وموافقة الأدمن تسجل اسم المراجع ووقت المراجعه
check(
  "QA-03: USER cannot review; ADMIN approval records reviewer and review time",
  async () => {
    const listing = await q.item({ status: "PENDING_REVIEW" });
    const path = "/admin/items/" + listing.id + "/review";
    expectError(
      await q.api(path, {
        method: "POST",
        token: q.seller.token,
        body: { decision: "APPROVED" },
      }),
      403,
      "FORBIDDEN",
    );
    const response = await q.api(path, {
      method: "POST",
      token: q.admin.token,
      body: { decision: "APPROVED" },
    });
    assert.equal(response.status, 200);
    assert.equal(response.json.data.status, "APPROVED");
    assert.equal(response.json.data.reviewed_by, q.admin.id);
    assert.ok(response.json.data.reviewed_at);
    expectError(
      await q.api(path, {
        method: "POST",
        token: q.admin.token,
        body: { decision: "APPROVED" },
      }),
      409,
      "INVALID_STATE",
    );
  },
);

// اختبار QA-17: الرفض يتطلب سبب؛ وإعادة تقديم الإعلان من المالك تمسح المراجعة السابقة
check(
  "QA-17: rejection includes reason; owner resubmission clears the prior review",
  async () => {
    const listing = await q.item({ status: "PENDING_REVIEW" });
    expectError(
      await q.api("/admin/items/" + listing.id + "/review", {
        method: "POST",
        token: q.admin.token,
        body: { decision: "REJECTED" },
      }),
      400,
      "INVALID_INPUT",
    );
    const rejection = await q.api("/admin/items/" + listing.id + "/review", {
      method: "POST",
      token: q.admin.token,
      body: { decision: "REJECTED", reason: "Add a clear description." },
    });
    assert.equal(rejection.json.data.review_reason, "Add a clear description.");
    const edit = await q.api("/items/" + listing.id, {
      method: "PATCH",
      token: q.seller.token,
      body: {
        title: "Corrected fixture",
        description: "Corrected description",
      },
    });
    assert.equal(edit.status, 200);
    assert.equal(edit.json.data.status, "PENDING_REVIEW");
    assert.equal(edit.json.data.review_reason, null);
    assert.equal(edit.json.data.reviewed_by, null);
    assert.equal(edit.json.data.reviewed_at, null);
  },
);

// اختبار LIST-04: مستخدم آخر لا يستطيع تعديل إعلان مرفوض؛ والإعلان المعتمد للمزاد يكون مقفلاً
check(
  "LIST-04: another user cannot resubmit a rejected listing; approved auction listing is locked",
  async () => {
    const rejected = await q.item({ status: "REJECTED" });
    const body = { title: "Forbidden change", description: "Forbidden change" };
    const response = await q.api("/items/" + rejected.id, {
      method: "PATCH",
      token: q.bidder.token,
      body,
    });
    assert.ok([403, 409].includes(response.status));
    assert.equal(
      (await q.pool.query("SELECT title FROM items WHERE id=$1", [rejected.id]))
        .rows[0].title,
      rejected.title,
    );
    const a = await q.auction();
    expectError(
      await q.api("/items/" + a.item_id, {
        method: "PATCH",
        token: q.seller.token,
        body,
      }),
      409,
      "INVALID_STATE",
    );
  },
);

// اختبار QA-04: الإعلانات غير المعتمدة أو إعلان مالك آخر لا يمكن تحويلها لمزاد
check(
  "QA-04: pending/rejected listings and another owner's approved listing cannot be auctioned",
  async () => {
    for (const status of ["PENDING_REVIEW", "REJECTED"]) {
      const listing = await q.item({ status });
      expectError(
        await q.api("/auctions", {
          method: "POST",
          token: q.seller.token,
          body: auctionBody(listing.id),
        }),
        403,
        "NOT_APPROVED",
      );
    }
    const other = await q.item();
    expectError(
      await q.api("/auctions", {
        method: "POST",
        token: q.bidder.token,
        body: auctionBody(other.id),
      }),
      403,
      "NOT_APPROVED",
    );
  },
);

// اختبار AUCT-01: المزاد يبدأ بسعر البداية؛ والقيم المالية أو الجداول الخاطئة مرفوضة
check(
  "AUCT-01: auction starts at starting price; invalid money/schedule and duplicate item are rejected",
  async () => {
    const listing = await q.item();
    const body = auctionBody(listing.id);
    for (const change of [
      { startingPrice: 0 },
      { startingPrice: 1000.001 },
      { minimumIncrement: -1 },
      { endTime: body.startTime },
      { startTime: [body.startTime] },
      { endTime: 123456789 },
    ])
      expectError(
        await q.api("/auctions", {
          method: "POST",
          token: q.seller.token,
          body: { ...body, ...change },
        }),
        400,
        "INVALID_INPUT",
      );
    const response = await q.api("/auctions", {
      method: "POST",
      token: q.seller.token,
      body,
    });
    assert.equal(response.status, 201);
    assert.equal(Number(response.json.data.current_price), 1000);
    assert.equal(response.json.data.status, "SCHEDULED");
    expectError(
      await q.api("/auctions", { method: "POST", token: q.seller.token, body }),
      409,
      "DUPLICATE_AUCTION",
    );
  },
);

// اختبار PRIVATE-01: المزادات الخاصة تظهر الكود للمالك فقط وتخزن بصمته ولا تظهر في القوائم العامة
check(
  "PRIVATE-01: private creation returns code only to owner, stores a hash and stays out of discovery",
  async () => {
    const listing = await q.item();
    const response = await q.api("/auctions", {
      method: "POST",
      token: q.seller.token,
      body: { ...auctionBody(listing.id), visibility: "PRIVATE" },
    });
    assert.equal(response.status, 201);
    const a = response.json.data;
    const stored = (
      await q.pool.query("SELECT access_code_hash FROM auctions WHERE id=$1", [
        a.id,
      ])
    ).rows[0];
    assert.notEqual(stored.access_code_hash, a.accessCode);
    assert.equal(
      await bcrypt.compare(a.accessCode, stored.access_code_hash),
      true,
    );
    assert.equal("access_code_hash" in a, false);
    assert.equal(
      (await q.api("/auctions")).json.data.some((row) => row.id === a.id),
      false,
    );
    const details = await q.api("/auctions/" + a.id, { token: q.seller.token });
    assert.equal(details.status, 200);
    assert.equal("accessCode" in details.json.data, false);
    assert.equal("access_code_hash" in details.json.data, false);
  },
);

// اختبار QA-05: كود الدعوة الخاطئ للمزادات الخاصة لا يمنح أي صلاحية وصول
check(
  "QA-05: wrong private invitation code creates no access grant",
  async () => {
    const a = await q.auction({ visibility: "PRIVATE" });
    expectError(
      await q.api("/auctions/" + a.id + "/access", {
        method: "POST",
        token: q.bidder.token,
        body: { accessCode: "wrong-code" },
      }),
      403,
      "INVALID_CODE",
    );
    assert.equal(
      (
        await q.pool.query(
          "SELECT count(*)::int AS n FROM private_auction_access WHERE auction_id=$1",
          [a.id],
        )
      ).rows[0].n,
      0,
    );
  },
);

// اختبار PRIVATE-02: كود الدعوة الصحيح يمنح الصلاحية؛ والمالك لا يمكنه الانضمام كمزايد
check(
  "PRIVATE-02: correct invitation grants access idempotently; owner cannot join as bidder",
  async () => {
    const a = await q.auction({ visibility: "PRIVATE" });
    const path = "/auctions/" + a.id + "/access",
      body = { accessCode: a.accessCode };
    expectError(
      await q.api(path, { method: "POST", token: q.seller.token, body }),
      403,
      "OWNER",
    );
    for (let i = 0; i < 2; i++)
      assert.equal(
        (await q.api(path, { method: "POST", token: q.bidder.token, body }))
          .status,
        200,
      );
    assert.equal(
      (
        await q.pool.query(
          "SELECT count(*)::int AS n FROM private_auction_access WHERE auction_id=$1",
          [a.id],
        )
      ).rows[0].n,
      1,
    );
    assert.equal(
      (await q.api("/auctions/" + a.id, { token: q.bidder.token })).status,
      200,
    );
  },
);

// اختبار QA-06: تفاصيل المزاد الخاص المباشرة والسجل والمزايدات تتطلب إذن وصول
check(
  "QA-06: direct private details/history/bidding/commitment require an access grant",
  async () => {
    const a = await q.auction({ visibility: "PRIVATE" });
    await q.commitment(a); // الالتزام التجريبي ما يلغي شرط الوصول الخاص.
    for (const request of [
      q.api("/auctions/" + a.id),
      q.api("/auctions/" + a.id, { token: q.bidder.token }),
      q.api("/auctions/" + a.id + "/bids", { token: q.bidder.token }),
      q.api("/auctions/" + a.id + "/commitment", {
        method: "POST",
        token: q.bidder.token,
        body: {},
      }),
    ])
      expectError(await request, 404, "NOT_FOUND");
    expectError(await q.bid(a), 404, "NOT_FOUND");
    assert.equal((await q.state(a)).bid_count, 0);
  },
);

// اختبار COMMIT-01: تعطل البنك يرفض الطلب؛ وطلبات المتصفح المزيفة لا تعتمد
check(
  "COMMIT-01 / QA-07 partial: unavailable bank fails closed; browser SUCCESS and repeated requests do not approve",
  async () => {
    const a = await q.auction();
    const savedSecret=process.env.MOYASAR_SECRET_KEY;
    delete process.env.MOYASAR_SECRET_KEY;
    for (let i = 0; i < 2; i++)
      expectError(
        await q.api("/auctions/" + a.id + "/commitment", {
          method: "POST",
          token: q.bidder.token,
          body: { status: "SUCCESS", sandbox_reference: "untrusted-browser" },
        }),
        503,
        "BANK_SANDBOX_UNAVAILABLE",
      );
    assert.equal(
      (
        await q.pool.query(
          "SELECT count(*)::int AS n FROM bid_commitments WHERE auction_id=$1",
          [a.id],
        )
      ).rows[0].n,
      0,
    );
    if(savedSecret) process.env.MOYASAR_SECRET_KEY=savedSecret;
    expectError(await q.bid(a), 403, "COMMITMENT_REQUIRED");
  },
);

// اختبار COMMIT-02: حالة الالتزام تتبع للمستخدم الحالي والمالك لا يمكنه البدء
check(
  "COMMIT-02: commitment status is scoped to the caller and owner cannot initiate",
  async () => {
    const a = await q.auction();
    expectError(
      await q.api("/auctions/" + a.id + "/commitment", {
        method: "POST",
        token: q.seller.token,
        body: {},
      }),
      403,
      "OWNER",
    );
    const c = await q.commitment(a, q.bidder, "PENDING");
    const result = await q.api("/auctions/" + a.id + "/commitment", {
      token: q.bidder.token,
    });
    assert.equal(result.status, 200);
    assert.equal(result.json.data.id, c.id);
    assert.equal(result.json.data.status, "PENDING");
    expectError(
      await q.api("/auctions/" + a.id + "/commitment", {
        token: q.bidder2.token,
      }),
      404,
      "NOT_FOUND",
    );
  },
);

// اختبار QA-21: نشاطي (My Activity) يتضمن الإعلانات والمزادات الخاصة والمزايدات في مزادات أخرى
check(
  "QA-21 API only: My Activity includes own listing/auction and bids in another auction",
  async () => {
    const own = await q.auction({ owner: q.bidder });
    const other = await q.auction();
    await q.commitment(other);
    assert.equal((await q.bid(other)).status, 201);
    const items = await q.api("/me/items", { token: q.bidder.token });
    assert.ok(items.json.data.some((item) => item.id === own.item_id));
    assert.ok(items.json.data.every((item) => item.seller_id === q.bidder.id));
    const auctions = await q.api("/me/auctions", { token: q.bidder.token });
    assert.ok(auctions.json.data.some((item) => item.id === own.id));
    assert.ok(auctions.json.data.some((item) => item.id === other.id));
    assert.equal(
      new Set(auctions.json.data.map((item) => item.id)).size,
      auctions.json.data.length,
    );
  },
);

