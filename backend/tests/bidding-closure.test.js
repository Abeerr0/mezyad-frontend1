// نجرّب المزايدات المتزامنة والإغلاق والتراجع إذا فشل الحفظ.
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { setupQa, databaseSkip, expectError } from "./helpers/qa-fixtures.js";

let q;

// إعداد بيئة اختبار المزايدات قبل البدء
before(async () => {
  if (!databaseSkip) q = await setupQa("bidding");
});
after(async () => {
  if (q) await q.shutdown();
});

const check = (name, fn) =>
  test(name, { skip: databaseSkip, timeout: 20000 }, fn);

// اختبار BID-01: المصادقة، والـ UUID، والتحقق من العملة ترفض الطلبات غير الصالحة
check(
  "BID-01: authentication, UUID and money validation reject invalid requests",
  async () => {
    const a = await q.auction();
    // التأكد من رفض الطلب بدون توكن (401)
    expectError(
      await q.api("/auctions/" + a.id + "/bids", {
        method: "POST",
        body: { amount: 1000, requestId: randomUUID() },
      }),
      401,
      "UNAUTHORIZED",
    );

    // تجربة قيم مبالغ مالية أو معرّفات خاطئة والتأكد من رفضها (400)
    for (const body of [
      { amount: 0, requestId: randomUUID() },
      { amount: 1000.001, requestId: randomUUID() },
      { amount: "1000", requestId: randomUUID() },
      { amount: 1000, requestId: "invalid" },
    ])
      expectError(
        await q.api("/auctions/" + a.id + "/bids", {
          method: "POST",
          token: q.bidder.token,
          body,
        }),
        400,
        "INVALID_INPUT",
      );

    assert.equal((await q.state(a)).bid_count, 0);
  },
);

// اختبار QA-03A: المالك لا يستطيع المزايدة حتى لو كان لديه التزام ناجح وهمي
check(
  "QA-03A: owner cannot bid even with a synthetic SUCCESS commitment",
  async () => {
    const a = await q.auction();
    await q.commitment(a, q.seller);
    expectError(await q.bid(a, 1000, q.seller), 403, "OWNER");
    assert.equal((await q.state(a)).bid_count, 0);
  },
);

// اختبار QA-03B: نفس المستخدم يمكنه تملك مزاد والمزايدة في مزاد مالك آخر
check(
  "QA-03B: the same USER can own an auction and bid in another owner's auction",
  async () => {
    const own = await q.auction({ owner: q.bidder });
    const another = await q.auction();
    await q.commitment(another);
    assert.equal(q.bidder.role, "USER");
    assert.equal((await q.bid(another)).status, 201);
    assert.equal((await q.state(own)).bid_count, 0);
  },
);

// اختبار BID-02: الالتزامات المفقودة أو قيد الانتظار (PENDING) أو الفاشلة (FAILED) لا تفوض المزايدات
check(
  "BID-02: missing, PENDING and FAILED commitments cannot authorize bids",
  async () => {
    const a = await q.auction();
    expectError(await q.bid(a), 403, "COMMITMENT_REQUIRED");
    for (const status of ["PENDING", "FAILED"]) {
      await q.commitment(a, q.bidder, status);
      expectError(await q.bid(a), 403, "COMMITMENT_REQUIRED");
    }
    assert.deepEqual(await q.state(a), {
      current_price: 1000,
      status: "ACTIVE",
      bid_count: 0,
      result_count: 0,
    });
  },
);

// اختبار QA-18: أول مزايدة بسعر البداية مقبولة ويتم تحديث السعر والسجل معاً
check(
  "QA-18: first bid at starting price is accepted and price/history update together",
  async () => {
    const a = await q.auction();
    await q.commitment(a);
    const reply = await q.bid(a);
    assert.equal(reply.status, 201);
    assert.equal(reply.json.data.currentPrice, 1000);

    const history = await q.api("/auctions/" + a.id + "/bids", {
      token: q.bidder.token,
    });
    assert.equal(history.json.data.length, 1);
    assert.equal(history.json.data[0].id, reply.json.data.bidId);
    assert.equal(Number(history.json.data[0].amount), 1000);
    assert.equal((await q.state(a)).current_price, 1000);
  },
);

// اختبار QA-08: أول مزايدة أقل من سعر البداية ترفض بدون تغيير السعر
check(
  "QA-08: first bid below starting price is rejected without changing price",
  async () => {
    const a = await q.auction();
    await q.commitment(a);
    expectError(await q.bid(a, 999.99), 409, "BID_TOO_LOW");
    assert.equal((await q.state(a)).current_price, 1000);
    assert.equal((await q.state(a)).bid_count, 0);
  },
);

// اختبار QA-19: المزايدة اللاحقة تطبق الحد الأدنى للزيادة؛ والزيادة الدقيقة مقبولة
check(
  "QA-19: later bid enforces increment; exact increment is accepted",
  async () => {
    const a = await q.auction();
    await q.commitment(a);
    assert.equal((await q.bid(a, 1000)).status, 201);
    expectError(await q.bid(a, 1049.99), 409, "BID_TOO_LOW");
    assert.equal((await q.state(a)).current_price, 1000);
    assert.equal((await q.bid(a, 1050)).status, 201);
    assert.equal((await q.state(a)).bid_count, 2);
  },
);

// اختبار BID-03: الزيادات العشرية تحافظ على الهللات بدقة بدون انحراف الفاصلة العائمة (Floating Point)
check(
  "BID-03: decimal increments retain exact cents without floating point drift",
  async () => {
    const a = await q.auction({ price: 1000.01, increment: 0.01 });
    await q.commitment(a);
    assert.equal((await q.bid(a, 1000.01)).status, 201);
    assert.equal((await q.bid(a, 1000.02)).status, 201);
    expectError(await q.bid(a, 1000.02), 409, "BID_TOO_LOW");
    assert.equal(
      (
        await q.pool.query(
          "SELECT current_price::text AS price FROM auctions WHERE id=$1",
          [a.id],
        )
      ).rows[0].price,
      "1000.02",
    );
  },
);

// اختبار QA-11: المزادات المجدولة، المنتهية، والمغلقة ترفض المزايدات بناءً على حالة ووقت السيرفر
check(
  "QA-11: scheduled, expired and CLOSED auctions reject bids using server state/time",
  async () => {
    for (const options of [
      { start: "1 hour", end: "2 hours", status: "SCHEDULED" },
      { end: "-1 second" },
      { status: "CLOSED" },
    ]) {
      const a = await q.auction(options);
      await q.commitment(a);
      expectError(await q.bid(a), 409, "AUCTION_NOT_ACTIVE");
      assert.equal((await q.state(a)).bid_count, 0);
    }
  },
);

// اختبار QA-09: معرف الطلب المكرر (Request UUID) يقبل مزايدة واحدة كحد أقصى
check("QA-09: a retried request UUID accepts at most one bid", async () => {
  const a = await q.auction();
  await q.commitment(a);
  const request = randomUUID();
  assert.equal((await q.bid(a, 1000, q.bidder, request)).status, 201);
  expectError(
    await q.bid(a, 1050, q.bidder, request),
    409,
    "DUPLICATE_REQUEST",
  );
  assert.equal((await q.state(a)).bid_count, 1);
  assert.equal((await q.state(a)).current_price, 1000);
});

// اختبار QA-09 متزامن: طلبان معلقان بنفس الرفعم ينتجان مزaيدة مقبولة واحدة فقط
check(
  "QA-09 concurrent replay: two waiting requests with the same UUID produce one accepted bid",
  async () => {
    const a = await q.auction();
    await q.commitment(a);
    const lock = await q.lock(a),
      request = randomUUID();
    try {
      const one = q.bid(a, 1000, q.bidder, request),
        two = q.bid(a, 1000, q.bidder, request);
      await q.awaitBlocked(2);
      await lock.query("COMMIT");
      const responses = await Promise.all([one, two]);
      assert.deepEqual(responses.map((r) => r.status).sort(), [201, 409]);
      assert.equal(
        responses.find((r) => r.status === 409).json.error.code,
        "DUPLICATE_REQUEST",
      );
      assert.equal((await q.state(a)).bid_count, 1);
    } finally {
      await lock.query("ROLLBACK");
      lock.release();
    }
  },
);

// اختبار QA-10: مزايدتان متزامنتان بنفس السعر تتسلسلان؛ الخاسر يرى السعر المحدث
check(
  "QA-10: two simultaneous same-price bids serialize; loser sees the updated price",
  async () => {
    const a = await q.auction();
    await q.commitment(a, q.bidder);
    await q.commitment(a, q.bidder2);
    const lock = await q.lock(a);
    try {
      const one = q.bid(a, 1000, q.bidder),
        two = q.bid(a, 1000, q.bidder2);
      await q.awaitBlocked(2);
      await lock.query("COMMIT");
      const responses = await Promise.all([one, two]);
      assert.deepEqual(responses.map((r) => r.status).sort(), [201, 409]);
      assert.equal(
        responses.find((r) => r.status === 409).json.error.code,
        "BID_TOO_LOW",
      );
      assert.equal((await q.state(a)).bid_count, 1);
      const loser = responses[0].status === 409 ? q.bidder : q.bidder2;
      assert.equal((await q.bid(a, 1050, loser)).status, 201);
      assert.equal((await q.state(a)).current_price, 1050);
    } finally {
      await lock.query("ROLLBACK");
      lock.release();
    }
  },
);

// اختبار BID-04: إعادة استخدام معرف الطلب عبر مزادات مختلفة يتراجع عن سعر المزاد الخاسر
check(
  "BID-04: reused request UUID across auctions rolls back the losing auction price",
  async () => {
    const a = await q.auction(),
      b = await q.auction();
    await q.commitment(a);
    await q.commitment(b);
    const request = randomUUID();
    const responses = await Promise.all([
      q.bid(a, 1100, q.bidder, request),
      q.bid(b, 1100, q.bidder, request),
    ]);
    assert.deepEqual(responses.map((r) => r.status).sort(), [201, 409]);
    const loser = responses[0].status === 409 ? a : b;
    assert.equal((await q.state(loser)).current_price, 1000);
    assert.equal((await q.state(loser)).bid_count, 0);
  },
);

// اختبار BID-05: فشل قاعدة البيانات بعد إدخال المزايدة يتراجع عن المزايدة والسعر ذرياً (Atomically)
check(
  "BID-05: database failure after bid insertion rolls back bid and price atomically",
  async () => {
    const a = await q.auction();
    await q.commitment(a);
    // نحاكي الفشل داخل مساحة الاختبار فقط عشان نتأكد من التراجع.
    await q.pool
      .query(`CREATE FUNCTION qa_fail_price_update() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
    IF NEW.id='${a.id}'::uuid THEN RAISE EXCEPTION 'QA injected update failure'; END IF; RETURN NEW; END $$;
    CREATE TRIGGER qa_fail_price BEFORE UPDATE ON auctions FOR EACH ROW EXECUTE FUNCTION qa_fail_price_update()`);
    try {
      expectError(await q.bid(a, 1100), 500, "INTERNAL_ERROR");
      assert.equal((await q.state(a)).bid_count, 0);
      assert.equal((await q.state(a)).current_price, 1000);
    } finally {
      await q.pool.query(
        "DROP TRIGGER qa_fail_price ON auctions; DROP FUNCTION qa_fail_price_update()",
      );
    }
    assert.equal((await q.bid(a, 1100)).status, 201);
  },
);

// اختبار BID-06 / QA-11: المزايدة المنتظرة على قفل الصف تعيد التحقق من الموعد النهائي بعد انفكاك القفل
check(
  "BID-06 / QA-11: bid waiting on a row lock revalidates the deadline after the lock",
  async () => {
    const a = await q.auction();
    await q.commitment(a);
    const lock = await q.lock(a);
    try {
      const response = q.bid(a);
      await q.awaitBlocked();
      await lock.query(
        `UPDATE "${q.schema}".auctions SET end_time=clock_timestamp()-interval '1 millisecond' WHERE id=$1`,
        [a.id],
      );
      await lock.query("COMMIT");
      expectError(await response, 409, "AUCTION_NOT_ACTIVE");
      assert.equal((await q.state(a)).bid_count, 0);
    } finally {
      await lock.query("ROLLBACK");
      lock.release();
    }
  },
);

// اختبار BID-07: إذن الوصول الخاص مع الالتزام الوهمي يسمح بالمزايدة؛ والسجل يظل خاصاً بالمزاد وحده
check(
  "BID-07: private grant plus synthetic commitment permits a bid; history stays auction-specific",
  async () => {
    const a = await q.auction({ visibility: "PRIVATE" }),
      other = await q.auction();
    await q.grant(a);
    await q.commitment(a);
    await q.commitment(other);
    const accepted = await q.bid(a);
    assert.equal(accepted.status, 201);
    await q.bid(other, 1100);
    const history = await q.api("/auctions/" + a.id + "/bids", {
      token: q.bidder.token,
    });
    assert.equal(history.json.data.length, 1);
    assert.equal(history.json.data[0].id, accepted.json.data.bidId);
    assert.equal("bidder_id" in history.json.data[0], false);
  },
);

// اختبار QA-12: المزاد المنتهي بدون مزايدات يغلق مع فائز فارغ (null)
check(
  "QA-12: ended auction without bids closes with a null winner",
  async () => {
    const a = await q.auction({ end: "-1 second" });
    const response = await q.api("/auctions/" + a.id);
    assert.equal(response.status, 200);
    assert.equal(response.json.data.status, "CLOSED");
    assert.equal(response.json.data.result.winner_bid_id, null);
    assert.equal((await q.state(a)).result_count, 1);
  },
);

// اختبار CLOSE-01: أعلى عرض مقبول يحدد الفائز وينتمي لذلك المزاد حصرياً
check(
  "CLOSE-01: highest accepted bid determines winner and belongs to that auction",
  async () => {
    const a = await q.auction();
    await q.commitment(a);
    await q.bid(a, 1000);
    const winner = await q.bid(a, 1200);
    await q.pool.query(
      "UPDATE auctions SET end_time=clock_timestamp()-interval '1 millisecond' WHERE id=$1",
      [a.id],
    );
    const response = await q.api("/auctions/" + a.id);
    assert.equal(
      response.json.data.result.winner_bid_id,
      winner.json.data.bidId,
    );
    const persisted = (
      await q.pool.query(
        "SELECT b.auction_id,b.amount FROM auction_results r JOIN bids b ON b.id=r.winner_bid_id WHERE r.auction_id=$1",
        [a.id],
      )
    ).rows[0];
    assert.equal(persisted.auction_id, a.id);
    assert.equal(Number(persisted.amount), 1200);
  },
);

// اختبار QA-13: طلبات التفاصيل المتكررة والمتزامنة تحافظ على نتيجة إغلاق مستقرة واحدة
check(
  "QA-13: repeated and concurrent detail requests preserve one stable closure result",
  async () => {
    const a = await q.auction({ end: "-1 second" });
    const results = await Promise.all(
      Array.from({ length: 6 }, () => q.api("/auctions/" + a.id)),
    );
    assert.ok(results.every((r) => r.status === 200));
    for (const result of results)
      assert.deepEqual(result.json.data.result, results[0].json.data.result);
    const repeat = await q.api("/auctions/" + a.id);
    assert.deepEqual(repeat.json.data.result, results[0].json.data.result);
    assert.equal((await q.state(a)).result_count, 1);
  },
);

// اختبار QA-23: لا حاجة لزيارة الصفحة لرفض المزايدات المتأخرة؛ الوصول التالي للتفاصيل ينهي النتيجة
check(
  "QA-23: no page visit is needed to reject late bids; next detail access finalizes result",
  async () => {
    const a = await q.auction({ end: "-1 second" });
    await q.commitment(a);
    expectError(await q.bid(a), 409, "AUCTION_NOT_ACTIVE");
    assert.equal((await q.state(a)).result_count, 0);
    const response = await q.api("/auctions/" + a.id);
    assert.equal(response.json.data.status, "CLOSED");
    assert.equal((await q.state(a)).result_count, 1);
  },
);

// اختبار CLOSE-02: طلب تفاصيل المزاد النشط لا يغلقه قبل أوانه
check(
  "CLOSE-02: active auction detail request does not close it prematurely",
  async () => {
    const a = await q.auction();
    const response = await q.api("/auctions/" + a.id);
    assert.equal(response.status, 200);
    assert.equal(response.json.data.result, null);
    assert.equal((await q.state(a)).result_count, 0);
  },
);

// اختبار CLOSE-03: فشل تخزين النتيجة يتراجع عن حالة الإغلاق (CLOSED)؛ والوصول لاحقاً يعيد المحاولة
check(
  "CLOSE-03: failure while storing result rolls back CLOSED status; later access can retry",
  async () => {
    const a = await q.auction({ end: "-1 second" });
    await q.pool
      .query(`CREATE FUNCTION qa_fail_result() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
    IF NEW.auction_id='${a.id}'::uuid THEN RAISE EXCEPTION 'QA injected closure failure'; END IF; RETURN NEW; END $$;
    CREATE TRIGGER qa_fail_result BEFORE INSERT ON auction_results FOR EACH ROW EXECUTE FUNCTION qa_fail_result()`);
    try {
      expectError(await q.api("/auctions/" + a.id), 500, "INTERNAL_ERROR");
      assert.equal((await q.state(a)).status, "ACTIVE");
      assert.equal((await q.state(a)).result_count, 0);
    } finally {
      await q.pool.query(
        "DROP TRIGGER qa_fail_result ON auction_results; DROP FUNCTION qa_fail_result()",
      );
    }
    assert.equal((await q.api("/auctions/" + a.id)).json.data.status, "CLOSED");
  },
);

// اختبار CLOSE-04: المزايدة في طابور الانتظار والإغلاق بعد الموعد النهائي لا يمكنهما إنشاء فائز متأخر
check(
  "CLOSE-04: queued bid and closure after deadline cannot create a late winner",
  async () => {
    const a = await q.auction();
    await q.commitment(a);
    const lock = await q.lock(a);
    try {
      const bid = q.bid(a);
      await q.awaitBlocked();
      await lock.query(
        `UPDATE "${q.schema}".auctions SET end_time=clock_timestamp()-interval '1 millisecond' WHERE id=$1`,
        [a.id],
      );
      const closure = q.api("/auctions/" + a.id);
      await q.awaitBlocked(2);
      await lock.query("COMMIT");
      const [bidResult, closed] = await Promise.all([bid, closure]);
      expectError(bidResult, 409, "AUCTION_NOT_ACTIVE");
      assert.equal(closed.json.data.status, "CLOSED");
      assert.equal(closed.json.data.result.winner_bid_id, null);
      assert.deepEqual(await q.state(a), {
        current_price: 1000,
        status: "CLOSED",
        bid_count: 0,
        result_count: 1,
      });
    } finally {
      await lock.query("ROLLBACK");
      lock.release();
    }
  },
);

// اختبار CLOSE-05: المزايدة المتحقق منها قبل الموعد النهائي تُعتمد قبل إغلاق الانتظار وتصبح الفائزة
check(
  "CLOSE-05: bid validated before deadline commits before waiting closure and becomes the winner",
  async () => {
    const a = await q.auction({ end: "2 seconds" });
    await q.commitment(a);
    const gate = await q.control.connect();
    const gateId = 714301; // هذا القفل للاختبار بس.
    await gate.query("SELECT pg_advisory_lock($1)", [gateId]);
    await q.pool
      .query(`CREATE FUNCTION qa_pause_update() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
    IF NEW.id='${a.id}'::uuid THEN PERFORM pg_advisory_xact_lock(${gateId}); END IF; RETURN NEW; END $$;
    CREATE TRIGGER qa_pause_update BEFORE UPDATE ON auctions FOR EACH ROW EXECUTE FUNCTION qa_pause_update()`);
    try {
      const bid = q.bid(a, 1100);
      const waitUntil = async (predicate) => {
        const deadline = Date.now() + 5000;
        while (Date.now() < deadline) {
          if (await predicate()) return;
          await new Promise((resolve) => setTimeout(resolve, 20));
        }
        assert.fail(
          "Controlled transaction did not reach expected synchronization point",
        );
      };
      await waitUntil(
        async () =>
          !!(
            await q.control.query(
              "SELECT 1 FROM pg_stat_activity WHERE application_name=$1 AND wait_event='advisory'",
              [q.schema],
            )
          ).rowCount,
      );
      await waitUntil(
        async () =>
          (
            await q.control.query(
              `SELECT clock_timestamp()>=end_time AS ended FROM "${q.schema}".auctions WHERE id=$1`,
              [a.id],
            )
          ).rows[0].ended,
      );
      const closure = q.api("/auctions/" + a.id);
      await q.awaitBlocked();
      await gate.query("SELECT pg_advisory_unlock($1)", [gateId]);
      const [accepted, closed] = await Promise.all([bid, closure]);
      assert.equal(accepted.status, 201);
      assert.equal(closed.status, 200);
      assert.equal(
        closed.json.data.result.winner_bid_id,
        accepted.json.data.bidId,
      );
      assert.deepEqual(await q.state(a), {
        current_price: 1100,
        status: "CLOSED",
        bid_count: 1,
        result_count: 1,
      });
    } finally {
      await gate.query("SELECT pg_advisory_unlock($1)", [gateId]);
      gate.release();
      await q.pool.query(
        "DROP TRIGGER qa_pause_update ON auctions; DROP FUNCTION qa_pause_update()",
      );
    }
  },
);
