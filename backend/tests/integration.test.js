import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { setupQa, databaseSkip, expectError } from "./helpers/qa-fixtures.js";
let q;
before(async () => {
  if (!databaseSkip) q = await setupQa("integration");
});
after(async () => {
  if (q) await q.shutdown();
});
const check = (name, fn) => test(name, { skip: databaseSkip }, fn);
const post = (path, body, token) =>
  q.api(path, { method: "POST", body, token });
check(
  "Email: signup sends an SMTP message, keeps password hashed and creates no account before verification",
  async () => {
    const email = "abeer.integration@example.invalid";
    const response = await post("/auth/signup/request", {
      name: "Abeer",
      email,
      password: "Aa112233",
    });
    assert.equal(response.status, 202);
    assert.equal(JSON.stringify(response.json).includes("code"), false);
    assert.equal(
      (await q.pool.query("SELECT id FROM users WHERE email=$1", [email]))
        .rowCount,
      0,
    );
    const pending = (
      await q.pool.query("SELECT * FROM email_challenges WHERE email=$1", [
        email,
      ])
    ).rows[0];
    assert.notEqual(pending.payload.passwordHash, "Aa112233");
    assert.notEqual(pending.code_hash, q.emailCode(email));
    expectError(
      await post("/auth/signup/complete", { email, code: "000000" }),
      400,
      "INVALID_CODE",
    );
    const result = await post("/auth/signup/complete", {
      email,
      code: q.emailCode(email),
    });
    assert.equal(result.status, 200);
    assert.ok(result.json.data.id);
    expectError(
      await post("/auth/signup/complete", { email, code: q.emailCode(email) }),
      400,
      "INVALID_CODE",
    );
    assert.equal(
      (await post("/auth/login", { email, password: "Aa112233" })).status,
      200,
    );
    expectError(
      await post("/auth/signup/request", {
        name: "Abeer",
        email,
        password: "Aa112233",
      }),
      409,
      "DUPLICATE_EMAIL",
    );
  },
);
check(
  "Email: password recovery is single use and revokes old sessions",
  async () => {
    const email = "abeer.integration@example.invalid";
    const login = await post("/auth/login", { email, password: "Aa112233" });
    assert.equal((await post("/auth/password/request", { email })).status, 202);
    assert.equal(
      (
        await post("/auth/password/request", {
          email: "unknown@example.invalid",
        })
      ).status,
      202,
    );
    const verified = await post("/auth/password/verify", {
      email,
      code: q.emailCode(email),
    });
    assert.equal(verified.status, 200);
    expectError(
      await post("/auth/password/verify", { email, code: q.emailCode(email) }),
      400,
      "INVALID_CODE",
    );
    const body = {
      resetToken: verified.json.data.resetToken,
      password: "Changed-test-only-123",
    };
    assert.equal((await post("/auth/password/confirm", body)).status, 200);
    expectError(
      await post("/auth/password/confirm", body),
      400,
      "INVALID_CODE",
    );
    expectError(
      await q.api("/me/items", { token: login.json.data.token }),
      401,
      "UNAUTHORIZED",
    );
    expectError(
      await post("/auth/login", { email, password: "Aa112233" }),
      401,
      "INVALID_CREDENTIALS",
    );
    assert.equal(
      (await post("/auth/login", { email, password: body.password })).status,
      200,
    );
  },
);
check(
  "Email: five wrong codes lock the challenge and resend is throttled",
  async () => {
    const email = "ghadi.integration@example.invalid",
      body = { name: "Ghadi", email, password: "Aa112233" };
    assert.equal((await post("/auth/signup/request", body)).status, 202);
    expectError(
      await post("/auth/signup/request", { email, resend: true }),
      429,
      "RATE_LIMITED",
    );
    for (let i = 0; i < 5; i++)
      expectError(
        await post("/auth/signup/complete", { email, code: "000000" }),
        400,
        "INVALID_CODE",
      );
    expectError(
      await post("/auth/signup/complete", { email, code: q.emailCode(email) }),
      400,
      "INVALID_CODE",
    );
  },
);
check(
  "Moyasar contract: test-only keys and no approval from browser status",
  async () => {
    const a = await q.auction();
    process.env.MOYASAR_SECRET_KEY = "sk_live_not_allowed";
    process.env.MOYASAR_PUBLISHABLE_KEY = "pk_live_not_allowed";
    expectError(
      await post(`/auctions/${a.id}/commitment`, {}, q.bidder.token),
      503,
      "BANK_SANDBOX_UNAVAILABLE",
    );
    process.env.MOYASAR_SECRET_KEY = "sk_test_LOCAL_QA_NOT_A_REAL_KEY";
    process.env.MOYASAR_PUBLISHABLE_KEY = "pk_test_LOCAL_QA_NOT_A_REAL_KEY";
    const start = await post(
      `/auctions/${a.id}/commitment`,
      { status: "SUCCESS" },
      q.bidder.token,
    );
    assert.equal(start.status, 200);
    assert.equal(start.json.data.status, "PENDING");
    const again = await post(
      `/auctions/${a.id}/commitment`,
      {},
      q.bidder.token,
    );
    assert.equal(again.json.data.id, start.json.data.id);
    expectError(await q.bid(a), 403, "COMMITMENT_REQUIRED");
    const paymentId = randomUUID(),
      row = start.json.data;
    const payment = {
      id: paymentId,
      status: "authorized",
      amount: row.checkout.amount,
      currency: "SAR",
      source: { type: "creditcard" },
      metadata: row.checkout.metadata,
    };
    q.payments.set(paymentId, { ...payment, amount: 1 });
    expectError(
      await post(
        `/auctions/${a.id}/commitment/verify`,
        { paymentId },
        q.bidder.token,
      ),
      409,
      "PAYMENT_MISMATCH",
    );
    q.payments.set(paymentId, payment);
    assert.equal(
      (
        await post(
          `/auctions/${a.id}/commitment/verify`,
          { paymentId },
          q.bidder2.token,
        )
      ).status,
      409,
    );
    const verified = await post(
      `/auctions/${a.id}/commitment/verify`,
      { paymentId },
      q.bidder.token,
    );
    assert.equal(verified.status, 200);
    assert.equal(verified.json.data.status, "SUCCESS");
    assert.equal((await q.bid(a)).status, 201);
    q.payments.set(paymentId, { ...payment, status: "voided" });
    expectError(await q.bid(a, 1050), 403, "COMMITMENT_REQUIRED");
    assert.equal((await q.state(a)).bid_count, 1);
  },
);
check(
  "Moyasar contract: closed/owner/private/invalid requests never start a checkout",
  async () => {
    const a = await q.auction({ visibility: "PRIVATE" });
    expectError(
      await post(`/auctions/${a.id}/commitment`, {}, q.bidder.token),
      404,
      "NOT_FOUND",
    );
    expectError(
      await post(`/auctions/${a.id}/commitment`, {}, q.seller.token),
      403,
      "OWNER",
    );
    expectError(
      await post("/auctions/bad-id/commitment", {}, q.bidder.token),
      400,
      "INVALID_ID",
    );
    const ended = await q.auction({ start: "-2 hours", end: "-1 hour" });
    expectError(
      await post(`/auctions/${ended.id}/commitment`, {}, q.bidder.token),
      409,
      "AUCTION_NOT_ACTIVE",
    );
  },
);
check(
  "Email: expired codes fail and absent SMTP never claims a message was sent",
  async () => {
    const email = "aseel.integration@example.invalid";
    assert.equal(
      (
        await post("/auth/signup/request", {
          name: "Aseel",
          email,
          password: "Aa112233",
        })
      ).status,
      202,
    );
    await q.pool.query(
      "UPDATE email_challenges SET expires_at=now()-interval '1 second' WHERE email=$1",
      [email],
    );
    expectError(
      await post("/auth/signup/complete", { email, code: q.emailCode(email) }),
      400,
      "INVALID_CODE",
    );
    const host = process.env.SMTP_HOST;
    delete process.env.SMTP_HOST;
    try {
      expectError(
        await post("/auth/signup/request", {
          name: "Tala",
          email: "tala.integration@example.invalid",
          password: "Aa112233",
        }),
        503,
        "EMAIL_UNAVAILABLE",
      );
    } finally {
      process.env.SMTP_HOST = host;
    }
    assert.equal(
      (await q.pool.query("SELECT id FROM users WHERE email=$1", [email]))
        .rowCount,
      0,
    );
  },
);
check(
  "Moyasar contract: pending 3DS retains one payment and offers resumption instead of another checkout",
  async () => {
    const a = await q.auction(),
      path = `/auctions/${a.id}/commitment`;
    const start = await post(path, {}, q.bidder.token);
    assert.equal(start.status, 200);
    const paymentId = randomUUID();
    q.payments.set(paymentId, {
      id: paymentId,
      status: "initiated",
      amount: start.json.data.checkout.amount,
      currency: "SAR",
      metadata: start.json.data.checkout.metadata,
      source: {
        type: "creditcard",
        transaction_url: "https://example.invalid/3ds",
      },
    });
    const attached = await post(
      path + "/verify",
      { paymentId },
      q.bidder.token,
    );
    assert.equal(attached.status, 200);
    assert.equal(attached.json.data.status, "PENDING");
    assert.equal(attached.json.data.resumeUrl, "https://example.invalid/3ds");
    const again = await post(path, {}, q.bidder.token);
    assert.equal(again.json.data.paymentId, paymentId);
    assert.equal(again.json.data.checkout, null);
    expectError(await q.bid(a), 403, "COMMITMENT_REQUIRED");
  },
);
