// هنا نختبر علاقات الجداول والقيود ومنع التكرار عشان نتاكد ان داتا بيسنا قويه وما تخبط

// نجيب ادوات الاختبار من نود جي اس (test) عشان نختبر، و(before, after) للخطوات اللي قبل وبعد الاختبار
import test, { before, after } from "node:test";
// نجيب اداه التاكيد (assert)، وظيفتها تقول للكود: "تاكد من هالشيء والا طلع لي خطا!"
import assert from "node:assert/strict";
// اداه تولد لنا ارقام عشوائيه طويله (ID) مستحيل تتكرر
import { randomUUID } from "node:crypto";
// نجيب دوال احنا كتبناها بملف ثاني عشان تجهز لنا داتا بيس تجريبيه نلعب فيها
import { setupQa, databaseSkip, expectSqlCode } from "./helpers/qa-fixtures.js";

// نعرف متغير اسمه q بنحط فيه الداتا بيس حقتنا بعدين
let q;

// قبل ما تبدا الاختبارات: اذا ما سوينا تخطي، جهز لنا الداتا بيس التجريبيه واربطها بالمتغير q
before(async () => {
  if (!databaseSkip) q = await setupQa("database");
});

// بعد ما تخلص كل الاختبارات: قفل الداتا بيس ونظف الدنيا عشان السيرفر ما يعلق
after(async () => {
  if (q) await q.shutdown();
});

// سوينا اختصار سميناه check، وظيفته يشغل الاختبار، بس لو الداتا بيس مو موجوده يسحب عليه (يسوي تخطي)
const check = (name, fn) => test(name, { skip: databaseSkip }, fn);

// --- الاختبار الاول ---
// نتاكد ان الجداول العشره الاساسيه انخلقت وكل واحد له "مفتاح اساسي" (Primary Key)
check(
  "DB-01: migration creates the Stage 3 core tables and email verification table, each with a primary key",
  async () => {
    // هذا استعلام SQL وظيفته يروح يقرا من الداتا بيس ويجيب اسماء الجداول وكم مفتاح اساسي بكل جدول
    const result = await q.pool.query(
      `SELECT t.table_name, count(c.constraint_name)::int AS primary_keys
    FROM information_schema.tables t LEFT JOIN information_schema.table_constraints c
    ON c.table_schema=t.table_schema AND c.table_name=t.table_name AND c.constraint_type='PRIMARY KEY'
    WHERE t.table_schema=$1 AND t.table_type='BASE TABLE' GROUP BY t.table_name ORDER BY t.table_name`,
      [q.schema],
    );

    // نقول له: "تاكد" ان اسماء الجداول اللي رجعت تطابق بالضبط هذي القائمه
    assert.deepEqual(
      result.rows.map((r) => r.table_name),
      [
        "auction_results",
        "auctions",
        "bid_commitments",
        "bids",
        "categories",
        "email_challenges",
        "item_images",
        "items",
        "private_auction_access",
        "user_sessions",
        "users",
      ],
    );

    // وهنا "تاكد" ان كل جدول عنده مفتاح اساسي واحد بالضبط
    assert.ok(result.rows.every((row) => row.primary_keys === 1));
  },
);

// --- الاختبار الثاني ---
// نتاكد ان الايميلات والتصنيفات ما تتكرر (unique)، وان الادوار محدده بس (USER او ADMIN)
check(
  "DB-02: account, category and session identifiers are unique; account roles are constrained",
  async () => {
    // نجيب ايميل بائع موجود عندنا بالداتا بيس عشان نختبر عليه
    const email = (
      await q.pool.query("SELECT email FROM users WHERE id=$1", [q.seller.id])
    ).rows[0].email;

    // نحاول نضيف مستخدم جديد بنفس الايميل، ونتوقع ان الداتا بيس "ترفض" وتطلع خطا رقم 23505 (عشان منعنا التكرار)
    await assert.rejects(
      q.pool.query(
        "INSERT INTO users(name,email,password_hash) VALUES('Duplicate',$1,'fixture')",
        [email],
      ),
      expectSqlCode("23505"),
    );

    // نحاول نغير دور المستخدم الى كلمه 'SELLER'، ونتوقع الرفض لاننا قايلين له ما تقبل الا USER او ADMIN
    await assert.rejects(
      q.pool.query("UPDATE users SET role='SELLER' WHERE id=$1", [q.seller.id]),
      expectSqlCode("23514"),
    );

    // نحاول نضيف قسم (تصنيف) موجود من قبل، ولازم ينرفض
    await assert.rejects(
      q.pool.query(
        "INSERT INTO categories(name) VALUES('QA synthetic category')",
      ),
      expectSqlCode("23505"),
    );

    // نحاول نكرر جلسه (تسجيل دخول) موجوده، وبرضه لازم تنرفض
    await assert.rejects(
      q.pool.query(
        "INSERT INTO user_sessions(user_id,token_hash,expires_at) SELECT user_id,token_hash,expires_at FROM user_sessions LIMIT 1",
      ),
      expectSqlCode("23505"),
    );
  },
);

// --- الاختبار الثالث ---
// نجرب المفاتيح المرجعيه (Foreign keys).. يعني هل يرضى يضيف اشياء لشخص او اعلان محذوف او مو موجود؟
check(
  "DB-03: foreign keys reject orphan listings, images, sessions, bids and grants",
  async () => {
    // نسوي مزاد تجريبي
    const a = await q.auction();

    // نخلق ID عشوائي وهمي (نسميه يتيم لانه ماله حساب مسجل)
    const orphan = randomUUID();

    // هذي مصفوفه فيها اوامر SQL كلها غلط لانها تستخدم الـ ID الوهمي
    const statements = [
      // نحاول نحط اعلان وصاحبه الـ ID الوهمي
      [
        "INSERT INTO items(seller_id,category_id,title,description) VALUES($1,$2,'Orphan','Fixture')",
        [orphan, q.category.id],
      ],
      // نحاول نحط اعلان بس تصنيفه قسم وهمي
      [
        "INSERT INTO items(seller_id,category_id,title,description) VALUES($1,$2,'Orphan','Fixture')",
        [q.seller.id, orphan],
      ],
      // نحاول نضيف صوره لاعلان مو موجود
      [
        "INSERT INTO item_images(item_id,image_url) VALUES($1,'/qa/not-real.jpg')",
        [orphan],
      ],
      // نحاول نفتح جلسه لمستخدم وهمي
      [
        "INSERT INTO user_sessions(user_id,token_hash,expires_at) VALUES($1,'orphan',now())",
        [orphan],
      ],
      // نحاول نزايد (نسوم) في مزاد مو موجود
      [
        "INSERT INTO bids(auction_id,bidder_id,amount,request_id) VALUES($1,$2,1000,$3)",
        [orphan, q.bidder.id, randomUUID()],
      ],
      // نحاول نعطي صلاحيه دخول مزاد خاص لشخص مو موجود
      [
        "INSERT INTO private_auction_access(auction_id,user_id) VALUES($1,$2)",
        [a.id, orphan],
      ],
    ];

    // نلف على كل الاوامر الغلط هذي، ونتاكد ان الداتا بيس تكرشها كلها وترفضها بالخطا 23503 (المفتاح المرجعي مفقود)
    for (const [sql, params] of statements)
      await assert.rejects(q.pool.query(sql, params), expectSqlCode("23503"));
  },
);

// --- الاختبار الرابع ---
// نتاكد ان الحقول المحدده بكلمات معينه (زي الحاله) ما تقبل اي كلام تاليف
check(
  "DB-04: all listing, auction, visibility and commitment status enums reject invalid values",
  async () => {
    const a = await q.auction();
    const c = await q.commitment(a);

    // نلف على اوامر كلها تحاول تدخل كلمات ممنوعه
    for (const [sql, params] of [
      // نحاول نغير حاله الاعلان لكلمه 'SOLD' (مباع)، وهذا مو مسموح عندنا
      ["UPDATE items SET status='SOLD' WHERE id=$1", [a.item_id]],
      // نحاول نوقف المزاد بكلمه 'PAUSED'، وبرضه مو مسموح
      ["UPDATE auctions SET status='PAUSED' WHERE id=$1", [a.id]],
      // نحاول نخلي نوع المزاد 'VIP' بدل عام او خاص
      ["UPDATE auctions SET visibility='VIP' WHERE id=$1", [a.id]],
      // نحاول نحط حاله العربون 'APPROVED'
      ["UPDATE bid_commitments SET status='APPROVED' WHERE id=$1", [c.id]],
      // الداتا بيس لازم ترفضها كلها بخطا القيود 23514
    ])
      await assert.rejects(q.pool.query(sql, params), expectSqlCode("23514"));
  },
);

// --- الاختبار الخامس ---
// نتاكد ان الاسعار موجبه، ووقت نهايه المزاد لازم يكون بعد بدايته (ما ينفع ينتهي قبل لا يبدا)
check(
  "DB-05: prices/increments are positive and auction end must follow start",
  async () => {
    const a = await q.auction();

    // نلف على اوامر تحاول تكسر القواعد المنطقيه للاسعار والوقت
    for (const sql of [
      // نبي نحط سعر البدايه صفر (ممنوع)
      "UPDATE auctions SET starting_price=0 WHERE id=$1",
      // نبي نحط السعر الحالي بالسالب (ممنوع)
      "UPDATE auctions SET current_price=-1 WHERE id=$1",
      // نبي نحط اقل زياده للسومه صفر (ممنوع)
      "UPDATE auctions SET minimum_increment=0 WHERE id=$1",
      // نبي نحط وقت النهايه هو نفسه وقت البدايه (يعني المزاد صفر ثانيه، ممنوع)
      "UPDATE auctions SET end_time=start_time WHERE id=$1",
    ])
      await assert.rejects(q.pool.query(sql, [a.id]), expectSqlCode("23514"));

    // وهنا نحاول نسوم بمبلغ "صفر"، واكيد لازم ينرفض
    await assert.rejects(
      q.pool.query(
        "INSERT INTO bids(auction_id,bidder_id,amount,request_id) VALUES($1,$2,0,$3)",
        [a.id, q.bidder.id, randomUUID()],
      ),
      expectSqlCode("23514"),
    );
  },
);

// --- الاختبار السادس ---
// السلعه لها مزاد واحد بس، والمزاد الخاص يبي له رمز سري، والعام ما يبي له
check(
  "DB-06: one auction per listing; private codes require hashes and public codes must be null",
  async () => {
    const a = await q.auction();

    // نحاول نفتح مزاد ثاني لنفس السلعه، ولازم ينرفض لاننا حطينا شرط (UNIQUE) لـ item_id
    await assert.rejects(
      q.pool.query(
        `INSERT INTO auctions(item_id,visibility,starting_price,current_price,minimum_increment,start_time,end_time)
    SELECT item_id,visibility,starting_price,current_price,minimum_increment,start_time,end_time FROM auctions WHERE id=$1`,
        [a.id],
      ),
      expectSqlCode("23505"),
    );

    // المزاد العام (الافتراضي) نحاول نحط له رقم سري، والداتا بيس لازم ترفض
    await assert.rejects(
      q.pool.query(
        "UPDATE auctions SET access_code_hash='raw-fixture' WHERE id=$1",
        [a.id],
      ),
      expectSqlCode("23514"),
    );

    // نحاول نحول المزاد من عام الى خاص بدون ما نعطيه رقم سري مشفر، وبرضه لازم ينرفض
    await assert.rejects(
      q.pool.query("UPDATE auctions SET visibility='PRIVATE' WHERE id=$1", [
        a.id,
      ]),
      expectSqlCode("23514"),
    );

    // نسوي مزاد خاص جديد عشان نتاكد من التشفير
    const privateAuction = await q.auction({ visibility: "PRIVATE" });
    // "تاكد" ان الرمز المشفر المحفوظ لا يساوي الرمز العادي (عشان نثبت ان التشفير شغال صح)
    assert.notEqual(privateAuction.access_code_hash, privateAuction.accessCode);
  },
);

// --- الاختبار السابع ---
// اليوزر له دعوه وحده للمزاد الخاص، والتزام دفع (عربون) واحد لكل مزاد
check(
  "DB-07: a user can have only one private grant and one commitment per auction",
  async () => {
    // نسوي مزاد خاص
    const a = await q.auction({ visibility: "PRIVATE" });

    // نعطي المستخدم صلاحيه (دعوه) يدخل هالمزاد
    await q.grant(a);

    // نحاول نعطيه الدعوه مره ثانيه لنفس المزاد، ولازم ينرفض لاننا رابطين رقم المزاد مع رقم المستخدم لمنع التكرار
    await assert.rejects(
      q.pool.query(
        "INSERT INTO private_auction_access(auction_id,user_id) VALUES($1,$2)",
        [a.id, q.bidder.id],
      ),
      expectSqlCode("23505"),
    );

    // نسوي له التزام دفع (عربون)
    await q.commitment(a);

    // نحاول نسوي له عربون ثاني لنفس المزاد، وبرضه بينرفض
    await assert.rejects(
      q.pool.query(
        "INSERT INTO bid_commitments(auction_id,user_id,status) VALUES($1,$2,'PENDING')",
        [a.id, q.bidder.id],
      ),
      expectSqlCode("23505"),
    );
  },
);

check(
  "DB-08 / QA-09: request UUID is globally unique and money uses numeric(14,2)",
  async () => {
    const a = await q.auction({ price: 1000.01, increment: 0.01 });
    const request = randomUUID();
    await q.pool.query(
      "INSERT INTO bids(auction_id,bidder_id,amount,request_id) VALUES($1,$2,1000.01,$3)",
      [a.id, q.bidder.id, request],
    );
    await assert.rejects(
      q.pool.query(
        "INSERT INTO bids(auction_id,bidder_id,amount,request_id) VALUES($1,$2,1001,$3)",
        [a.id, q.bidder2.id, request],
      ),
      expectSqlCode("23505"),
    );
    const fields = (
      await q.pool.query(
        `SELECT numeric_precision,numeric_scale FROM information_schema.columns
    WHERE table_schema=$1 AND data_type='numeric'`,
        [q.schema],
      )
    ).rows;
    assert.equal(fields.length, 4);
    assert.ok(
      fields.every(
        (field) => field.numeric_precision === 14 && field.numeric_scale === 2,
      ),
    );
  },
);

check(
  "DB-09 / QA-20: composite foreign key prevents a winner from another auction",
  async () => {
    const a = await q.auction(),
      b = await q.auction();
    const bid = (
      await q.pool.query(
        "INSERT INTO bids(auction_id,bidder_id,amount,request_id) VALUES($1,$2,1000,$3) RETURNING id",
        [a.id, q.bidder.id, randomUUID()],
      )
    ).rows[0];
    await assert.rejects(
      q.pool.query(
        "INSERT INTO auction_results(auction_id,winner_bid_id) VALUES($1,$2)",
        [b.id, bid.id],
      ),
      expectSqlCode("23503"),
    );
    await q.pool.query(
      "INSERT INTO auction_results(auction_id,winner_bid_id) VALUES($1,$2)",
      [a.id, bid.id],
    );
    assert.equal((await q.state(b)).result_count, 0);
  },
);

check(
  "DB-10 / QA-12/13: nullable winner supports no bids; result is unique per auction",
  async () => {
    const a = await q.auction();
    await q.pool.query(
      "INSERT INTO auction_results(auction_id,winner_bid_id) VALUES($1,NULL)",
      [a.id],
    );
    await assert.rejects(
      q.pool.query("INSERT INTO auction_results(auction_id) VALUES($1)", [
        a.id,
      ]),
      expectSqlCode("23505"),
    );
    assert.equal(
      (
        await q.pool.query(
          "SELECT winner_bid_id FROM auction_results WHERE auction_id=$1",
          [a.id],
        )
      ).rows[0].winner_bid_id,
      null,
    );
  },
);

check(
  "DB-11: deleting an unauctioned item cascades its image references; deleting a free account cascades sessions",
  async () => {
    const listing = await q.item();
    await q.pool.query(
      "INSERT INTO item_images(item_id,image_url) VALUES($1,'/qa/fixture.jpg')",
      [listing.id],
    );
    await q.pool.query("DELETE FROM items WHERE id=$1", [listing.id]);
    assert.equal(
      (
        await q.pool.query(
          "SELECT count(*)::int AS n FROM item_images WHERE item_id=$1",
          [listing.id],
        )
      ).rows[0].n,
      0,
    );
    const user = await q.account();
    await q.pool.query("DELETE FROM users WHERE id=$1", [user.id]);
    assert.equal(
      (
        await q.pool.query(
          "SELECT count(*)::int AS n FROM user_sessions WHERE user_id=$1",
          [user.id],
        )
      ).rows[0].n,
      0,
    );
  },
);

check(
  "DB-12: timestamps are timezone-aware and the four defined lookup indexes exist",
  async () => {
    const timestamps = (
      await q.pool.query(
        "SELECT data_type FROM information_schema.columns WHERE table_schema=$1 AND column_name IN ('created_at','expires_at','start_time','end_time','closed_at','granted_at','reviewed_at')",
        [q.schema],
      )
    ).rows;
    assert.equal(timestamps.length, 11);
    assert.ok(
      timestamps.every(
        (field) => field.data_type === "timestamp with time zone",
      ),
    );
    const indexes = (
      await q.pool.query(
        "SELECT indexname FROM pg_indexes WHERE schemaname=$1 AND indexname LIKE 'idx_%'",
        [q.schema],
      )
    ).rows
      .map((row) => row.indexname)
      .sort();
    assert.deepEqual(indexes, [
      "idx_auctions_status_end",
      "idx_bids_auction_time",
      "idx_commitments_user",
      "idx_email_challenges_expiry",
      "idx_items_seller",
    ]);
  },
);

