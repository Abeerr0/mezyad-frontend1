import { Router } from "express";
import bcrypt from "bcryptjs";
import {
  createHmac,
  randomInt,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { pool, query } from "./db.js";
import { hashToken } from "./auth.js";
import { attemptLimit } from "./limits.js";
import { sendCode, mailSettings } from "./mail.js";

export const emailAuth = Router();
const fail = (status, apiCode) =>
  Object.assign(new Error(apiCode), { status, apiCode });
const emailOf = (body) =>
  typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
const validEmail = (email) =>
  email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const validPassword = (value) =>
  typeof value === "string" &&
  value.length >= 8 &&
  Buffer.byteLength(value) <= 72;
const digest = (email, purpose, code) =>
  createHmac("sha256", process.env.EMAIL_OTP_SECRET)
    .update(email + ":" + purpose + ":" + code)
    .digest("hex");
const same = (a, b) =>
  typeof a === "string" &&
  a.length === b.length &&
  timingSafeEqual(Buffer.from(a), Buffer.from(b));
// تم التعديل من عبير: نحدد الارسال والمحاولات ونقفل نفس البريد عشان ما يتكرر الرمز بالتزامن.
emailAuth.use(attemptLimit({ max: 30 }));
async function requestCode(req, res, next, purpose) {
  let c;
  try {
    const email = emailOf(req.body);
    if (!validEmail(email)) throw fail(400, "INVALID_INPUT");
    const resend = req.body?.resend === true;
    let payload = {};
    if (purpose === "SIGNUP" && !resend) {
      const { name, password } = req.body || {};
      if (
        typeof name !== "string" ||
        !name.trim() ||
        name.trim().length > 160 ||
        !validPassword(password)
      )
        throw fail(400, "INVALID_INPUT");
      payload = {
        name: name.trim(),
        passwordHash: await bcrypt.hash(password, 12),
      };
    }
    mailSettings();
    c = await pool.connect();
    await c.query("BEGIN");
    await c.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
      email + purpose,
    ]);
    await c.query(
      "DELETE FROM email_challenges WHERE expires_at < now() - interval '1 day'",
    );
    const user = (await c.query("SELECT id FROM users WHERE email=$1", [email]))
      .rows[0];
    if (purpose === "SIGNUP" && user) throw fail(409, "DUPLICATE_EMAIL");
    if (purpose === "RESET" && !user) {
      await c.query("COMMIT");
      return res.status(202).json({ data: {} });
    }
    const prior = (
      await c.query(
        "SELECT *,sent_at > now()-interval '30 seconds' AS recent FROM email_challenges WHERE email=$1 AND purpose=$2",
        [email, purpose],
      )
    ).rows[0];
    if (prior?.recent) throw fail(429, "RATE_LIMITED");
    if (purpose === "SIGNUP" && resend) {
      if (!prior?.payload?.passwordHash) throw fail(400, "INVALID_INPUT");
      payload = prior.payload;
    }
    const code = String(randomInt(100000, 1000000));
    await c.query(
      `INSERT INTO email_challenges(email,purpose,code_hash,payload,expires_at) VALUES($1,$2,$3,$4,now()+interval '10 minutes')
      ON CONFLICT(email,purpose) DO UPDATE SET code_hash=excluded.code_hash,payload=excluded.payload,expires_at=excluded.expires_at,sent_at=now(),attempts=0,reset_token_hash=NULL`,
      [email, purpose, digest(email, purpose, code), JSON.stringify(payload)],
    );
    await sendCode(email, code, purpose);
    await c.query("COMMIT");
    res.status(202).json({ data: {} });
  } catch (error) {
    if (c) await c.query("ROLLBACK");
    next(error);
  } finally {
    c?.release();
  }
}
// تم التعديل من عبير: المسار القديم والجديد يطلبون تحقق فعلي وما يفتحون حساب قبل الرمز.
emailAuth.post(["/register", "/signup/request"], (req, res, next) =>
  requestCode(req, res, next, "SIGNUP"),
);
emailAuth.post("/password/request", (req, res, next) =>
  requestCode(req, res, next, "RESET"),
);
async function verifyCode(req, res, next, purpose) {
  let c;
  try {
    const email = emailOf(req.body),
      code = req.body?.code;
    if (!validEmail(email) || typeof code !== "string" || !/^\d{6}$/.test(code))
      throw fail(400, "INVALID_CODE");
    mailSettings();
    c = await pool.connect();
    await c.query("BEGIN");
    const row = (
      await c.query(
        "SELECT *,expires_at>now() AS valid FROM email_challenges WHERE email=$1 AND purpose=$2 FOR UPDATE",
        [email, purpose],
      )
    ).rows[0];
    if (!row || !row.valid || row.attempts >= 5 || !row.code_hash)
      throw fail(400, "INVALID_CODE");
    if (!same(row.code_hash, digest(email, purpose, code))) {
      await c.query(
        "UPDATE email_challenges SET attempts=attempts+1 WHERE email=$1 AND purpose=$2",
        [email, purpose],
      );
      await c.query("COMMIT");
      throw fail(400, "INVALID_CODE");
    }
    let data;
    if (purpose === "SIGNUP") {
      data = (
        await c.query(
          "INSERT INTO users(name,email,password_hash) VALUES($1,$2,$3) RETURNING id,name,email,role",
          [row.payload.name, email, row.payload.passwordHash],
        )
      ).rows[0];
      await c.query(
        "DELETE FROM email_challenges WHERE email=$1 AND purpose=$2",
        [email, purpose],
      );
    } else {
      const resetToken = randomBytes(32).toString("hex");
      await c.query(
        "UPDATE email_challenges SET code_hash=NULL,reset_token_hash=$1,expires_at=now()+interval '10 minutes' WHERE email=$2 AND purpose=$3",
        [hashToken(resetToken), email, purpose],
      );
      data = { resetToken };
    }
    await c.query("COMMIT");
    res.json({ data });
  } catch (error) {
    if (c) await c.query("ROLLBACK");
    if (error.code === "23505") error = fail(409, "DUPLICATE_EMAIL");
    next(error);
  } finally {
    c?.release();
  }
}
emailAuth.post("/signup/complete", (req, res, next) =>
  verifyCode(req, res, next, "SIGNUP"),
);
emailAuth.post("/password/verify", (req, res, next) =>
  verifyCode(req, res, next, "RESET"),
);
// تم التعديل من عبير: تغيير الباسورد يحتاج رمز استعاده لمستخدم واحد وينهي جلساته القديمه.
emailAuth.post("/password/confirm", async (req, res, next) => {
  let c;
  try {
    const { resetToken, password } = req.body || {};
    if (
      typeof resetToken !== "string" ||
      !/^[a-f0-9]{64}$/.test(resetToken) ||
      !validPassword(password)
    )
      throw fail(400, "INVALID_INPUT");
    const passwordHash = await bcrypt.hash(password, 12);
    c = await pool.connect();
    await c.query("BEGIN");
    const row = (
      await c.query(
        "SELECT email FROM email_challenges WHERE purpose='RESET' AND reset_token_hash=$1 AND expires_at>now() FOR UPDATE",
        [hashToken(resetToken)],
      )
    ).rows[0];
    if (!row) throw fail(400, "INVALID_CODE");
    const user = (
      await c.query(
        "UPDATE users SET password_hash=$1 WHERE email=$2 RETURNING id",
        [passwordHash, row.email],
      )
    ).rows[0];
    if (!user) throw fail(400, "INVALID_CODE");
    await c.query("DELETE FROM user_sessions WHERE user_id=$1", [user.id]);
    await c.query(
      "DELETE FROM email_challenges WHERE email=$1 AND purpose='RESET'",
      [row.email],
    );
    await c.query("COMMIT");
    res.json({ data: {} });
  } catch (error) {
    if (c) await c.query("ROLLBACK");
    next(error);
  } finally {
    c?.release();
  }
});
