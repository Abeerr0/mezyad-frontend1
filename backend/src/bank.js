import "./config.js";
import { Router } from "express";
import { randomBytes } from "node:crypto";
import { pool, query } from "./db.js";
import { auth } from "./auth.js";
import { accessible } from "./auctions.js";
import { attemptLimit } from "./limits.js";
const fail = (status, apiCode) =>
  Object.assign(new Error(apiCode), { status, apiCode });
const uuid = (value) =>
  typeof value === "string" &&
  /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
// تم التعديل من عبير: الربط تجريبي فقط ونرفض مفاتيح الدفع الحقيقي من الاساس.
export function bankSettings() {
  const secret = process.env.MOYASAR_SECRET_KEY || "",
    publishable = process.env.MOYASAR_PUBLISHABLE_KEY || "";
  if (!secret.startsWith("sk_test_") || !publishable.startsWith("pk_test_"))
    throw fail(503, "BANK_SANDBOX_UNAVAILABLE");
  const amount = Number(process.env.MOYASAR_COMMITMENT_HALALAS || 10000);
  if (!Number.isSafeInteger(amount) || amount < 100 || amount > 100000000)
    throw fail(503, "BANK_SANDBOX_UNAVAILABLE");
  return { secret, publishable, amount };
}
export async function fetchPayment(id) {
  if (!uuid(id)) throw fail(400, "INVALID_ID");
  const { secret } = bankSettings();
  try {
    const response = await fetch("https://api.moyasar.com/v1/payments/" + id, {
      headers: {
        Authorization: "Basic " + Buffer.from(secret + ":").toString("base64"),
      },
      signal: AbortSignal.timeout(10000),
      redirect: "error",
    });
    if (response.status === 404) throw fail(400, "PAYMENT_NOT_FOUND");
    if (!response.ok) throw fail(503, "BANK_SANDBOX_UNAVAILABLE");
    return await response.json();
  } catch (error) {
    throw error.apiCode ? error : fail(503, "BANK_SANDBOX_UNAVAILABLE");
  }
}
// تم التعديل من عبير: ما نثق بحاله من المتصفح ونطابق المبلغ والمرجع مع رد ميسر الرسمي.
export function paymentStatus(payment, row) {
  if (
    payment.id !== row.payment_id ||
    payment.currency !== "SAR" ||
    payment.amount !== row.amount_minor ||
    payment.metadata?.commitment_id !== row.id ||
    payment.metadata?.checkout_nonce !== row.checkout_nonce ||
    payment.source?.type !== "creditcard"
  )
    throw fail(409, "PAYMENT_MISMATCH");
  if (
    payment.status === "authorized" &&
    !payment.voided_at &&
    !payment.refunded &&
    !payment.captured
  )
    return "SUCCESS";
  if (payment.status === "initiated") return "PENDING";
  return "FAILED";
}
export async function refreshCommitment(row, paymentId = row.payment_id) {
  if (!paymentId) return row;
  const c = await pool.connect();
  try {
    // تم التعديل من عبير: نقفل الالتزام وقت التحقق عشان الرد المتاخر ما يرجع حاله قديمه.
    await c.query("BEGIN");
    const current = (
      await c.query("SELECT * FROM bid_commitments WHERE id=$1 FOR UPDATE", [
        row.id,
      ])
    ).rows[0];
    if (
      !current ||
      current.checkout_nonce !== row.checkout_nonce ||
      new Date(current.expires_at) <= new Date()
    )
      throw fail(409, "INVALID_STATE");
    if (current.payment_id && current.payment_id !== paymentId)
      throw fail(409, "PAYMENT_MISMATCH");
    const payment = await fetchPayment(paymentId);
    const status = paymentStatus(payment, {
      ...current,
      payment_id: paymentId,
    });
    const result = await c.query(
      `UPDATE bid_commitments SET status=$1::varchar,payment_id=$2::uuid,sandbox_reference=$2::text,
      expires_at=CASE WHEN $1::varchar='SUCCESS' AND status<>'SUCCESS' THEN LEAST(clock_timestamp()+interval '24 hours',created_at+interval '24 hours') ELSE expires_at END
      WHERE id=$3 RETURNING *`,
      [status, paymentId, row.id],
    );
    await c.query("COMMIT");
    // تم التعديل من عبير: اذا التحقق ما اكتمل نرجع رابط ميسر للمتابعه بدل انشاء عمليه مكرره.
    let resumeUrl;
    if (
      status === "PENDING" &&
      typeof payment.source?.transaction_url === "string" &&
      URL.canParse(payment.source.transaction_url)
    ) {
      const url = new URL(payment.source.transaction_url);
      if (url.protocol === "https:" && !url.username && !url.password)
        resumeUrl = url.href;
    }
    return { ...result.rows[0], resumeUrl };
  } catch (error) {
    await c.query("ROLLBACK");
    throw error;
  } finally {
    c.release();
  }
}
async function allowed(req, excludeOwner = true) {
  if (!uuid(req.params.id)) throw fail(400, "INVALID_ID");
  const a = (
    await query(
      "SELECT a.*,i.seller_id FROM auctions a JOIN items i ON i.id=a.item_id WHERE a.id=$1",
      [req.params.id],
    )
  ).rows[0];
  if (!a || !(await accessible(a, req.user))) throw fail(404, "NOT_FOUND");
  if (excludeOwner && a.seller_id === req.user.id) throw fail(403, "OWNER");
  return a;
}
const publicRow = (row) =>
  row && {
    id: row.id,
    status: new Date(row.expires_at) <= new Date() ? "FAILED" : row.status,
    sandbox_reference: row.sandbox_reference,
    created_at: row.created_at,
    expires_at: row.expires_at,
    paymentId: row.payment_id,
    amountMinor: row.amount_minor,
    currency: "SAR",
    ...(row.resumeUrl ? { resumeUrl: row.resumeUrl } : {}),
  };
export const bankRoutes = Router();
bankRoutes.post(
  "/auctions/:id/commitment",
  auth,
  attemptLimit(),
  async (req, res, next) => {
    let c;
    try {
      const a = await allowed(req);
      if (a.status === "CLOSED" || new Date(a.end_time) <= new Date())
        throw fail(409, "AUCTION_NOT_ACTIVE");
      const settings = bankSettings();
      c = await pool.connect();
      await c.query("BEGIN");
      await c.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
        a.id + req.user.id,
      ]);
      let row = (
        await c.query(
          "SELECT * FROM bid_commitments WHERE auction_id=$1 AND user_id=$2 FOR UPDATE",
          [a.id, req.user.id],
        )
      ).rows[0];
      if (
        !row ||
        row.status === "FAILED" ||
        new Date(row.expires_at) <= new Date() ||
        row.provider !== "MOYASAR"
      ) {
        row = (
          await c.query(
            `INSERT INTO bid_commitments(auction_id,user_id,status,provider,amount_minor,checkout_nonce,expires_at)
        VALUES($1,$2,'PENDING','MOYASAR',$3,$4,clock_timestamp()+interval '30 minutes') ON CONFLICT(auction_id,user_id) DO UPDATE
        SET status='PENDING',provider='MOYASAR',amount_minor=excluded.amount_minor,checkout_nonce=excluded.checkout_nonce,expires_at=excluded.expires_at,payment_id=NULL,sandbox_reference=NULL,created_at=clock_timestamp() RETURNING *`,
            [
              a.id,
              req.user.id,
              settings.amount,
              randomBytes(24).toString("hex"),
            ],
          )
        ).rows[0];
      }
      await c.query("COMMIT");
      res.json({
        data: {
          ...publicRow(row),
          checkout:
            row.status === "PENDING" && !row.payment_id
              ? {
                  amount: row.amount_minor,
                  currency: "SAR",
                  publishableKey: settings.publishable,
                  metadata: {
                    commitment_id: row.id,
                    checkout_nonce: row.checkout_nonce,
                  },
                }
              : null,
        },
      });
    } catch (error) {
      if (c) await c.query("ROLLBACK");
      next(error);
    } finally {
      c?.release();
    }
  },
);
bankRoutes.post(
  "/auctions/:id/commitment/verify",
  auth,
  attemptLimit({ max: 30 }),
  async (req, res, next) => {
    try {
      await allowed(req);
      if (!uuid(req.body?.paymentId)) throw fail(400, "INVALID_ID");
      const row = (
        await query(
          "SELECT * FROM bid_commitments WHERE auction_id=$1 AND user_id=$2 AND provider='MOYASAR'",
          [req.params.id, req.user.id],
        )
      ).rows[0];
      if (!row || new Date(row.expires_at) <= new Date())
        throw fail(409, "INVALID_STATE");
      if (row.payment_id && row.payment_id !== req.body.paymentId)
        throw fail(409, "PAYMENT_MISMATCH");
      res.json({
        data: publicRow(await refreshCommitment(row, req.body.paymentId)),
      });
    } catch (error) {
      if (error.code === "23505") error = fail(409, "PAYMENT_MISMATCH");
      next(error);
    }
  },
);
bankRoutes.get("/auctions/:id/commitment", auth, async (req, res, next) => {
  try {
    await allowed(req, false);
    let row = (
      await query(
        "SELECT * FROM bid_commitments WHERE auction_id=$1 AND user_id=$2",
        [req.params.id, req.user.id],
      )
    ).rows[0];
    if (!row) throw fail(404, "NOT_FOUND");
    if (
      row.provider === "MOYASAR" &&
      row.payment_id &&
      new Date(row.expires_at) > new Date()
    )
      row = await refreshCommitment(row);
    res.json({ data: publicRow(row) });
  } catch (error) {
    next(error);
  }
});
// تم التعديل من عبير: نعيد تحقق ميسر قبل المزايده عشان التفويض الملغي ما يسمح بعرض جديد.
bankRoutes.post("/auctions/:id/bids", auth, async (req, res, next) => {
  try {
    if (uuid(req.params.id)) {
      const row = (
        await query(
          "SELECT * FROM bid_commitments WHERE auction_id=$1 AND user_id=$2 AND provider='MOYASAR' AND status='SUCCESS' AND expires_at>clock_timestamp()",
          [req.params.id, req.user.id],
        )
      ).rows[0];
      if (row) await refreshCommitment(row);
    }
    next();
  } catch (error) {
    next(error);
  }
});
// تم التعديل من عبير: نبقي التصدير القديم واضح اذا استدعاه اختبار او مسار قديم.
export function startCommitment() {
  throw fail(503, "BANK_SANDBOX_UNAVAILABLE");
}

