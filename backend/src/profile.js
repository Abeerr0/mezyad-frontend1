import { Router } from "express";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { pool, query } from "./db.js";
import { auth, hashToken } from "./auth.js";
import { attemptLimit } from "./limits.js";

export const profile = Router();
const proofs = new Map();
const fail = (res, status, code) =>
  res.status(status).json({ error: { code, message: code } });
export const validName = (value) =>
  typeof value === "string" &&
  value.trim().length >= 2 &&
  value.trim().length <= 160 &&
  /^[\p{L}\p{M}][\p{L}\p{M} .'-]*$/u.test(value.trim());
const validPassword = (value) =>
  typeof value === "string" &&
  value.length >= 8 &&
  Buffer.byteLength(value) <= 72;

// تم التعديل من عبير: نعدل الاسم للحساب الحالي فقط ونرفض تغيير البريد من نفس الطلب.
profile.patch("/me/profile", auth, attemptLimit(), async (req, res, next) => {
  try {
    if (
      !validName(req.body?.name) ||
      Object.keys(req.body).some((key) => key !== "name")
    )
      return fail(res, 400, "INVALID_INPUT");
    const result = await query(
      "UPDATE users SET name=$1 WHERE id=$2 RETURNING id,name,email,role",
      [req.body.name.trim(), req.user.id],
    );
    res.json({ data: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// تم التعديل من عبير: نتحقق من الباسورد الحالي ونعطي اثبات قصير ومربوط بالجلسه قبل فتح التغيير.
profile.post(
  "/me/password/verify",
  auth,
  attemptLimit({ max: 5 }),
  async (req, res, next) => {
    try {
      const value = req.body?.currentPassword;
      if (typeof value !== "string" || !value || Buffer.byteLength(value) > 72)
        return fail(res, 400, "INVALID_INPUT");
      const row = (
        await query("SELECT password_hash FROM users WHERE id=$1", [
          req.user.id,
        ])
      ).rows[0];
      if (!row || !(await bcrypt.compare(value, row.password_hash)))
        return fail(res, 403, "CURRENT_PASSWORD_INCORRECT");
      for (const [key, proof] of proofs)
        if (proof.expires <= Date.now() || proof.user === req.user.id)
          proofs.delete(key);
      if (proofs.size >= 10000) return fail(res, 429, "TOO_MANY_REQUESTS");
      const token = randomBytes(32).toString("hex");
      proofs.set(hashToken(token), {
        user: req.user.id,
        session: hashToken(req.token),
        hash: row.password_hash,
        expires: Date.now() + 300000,
      });
      res.json({ data: { verificationToken: token, expiresIn: 300 } });
    } catch (error) {
      next(error);
    }
  },
);

// تم التعديل من عبير: الاثبات يستخدم مره وحده والتغيير يقفل السجل ويلغي الجلسات الثانيه لحمايه الحساب.
profile.post(
  "/me/password",
  auth,
  attemptLimit({ max: 5 }),
  async (req, res, next) => {
    let client;
    try {
      const { verificationToken, password, confirmPassword } = req.body || {};
      if (
        !validPassword(password) ||
        password !== confirmPassword ||
        typeof verificationToken !== "string" ||
        !/^[a-f0-9]{64}$/.test(verificationToken)
      )
        return fail(res, 400, "INVALID_INPUT");
      const key = hashToken(verificationToken),
        proof = proofs.get(key);
      if (
        !proof ||
        proof.user !== req.user.id ||
        proof.session !== hashToken(req.token) ||
        proof.expires <= Date.now()
      )
        return fail(res, 403, "PASSWORD_VERIFICATION_EXPIRED");
      proofs.delete(key);
      if (await bcrypt.compare(password, proof.hash))
        return fail(res, 400, "PASSWORD_UNCHANGED");
      const hash = await bcrypt.hash(password, 12);
      client = await pool.connect();
      await client.query("BEGIN");
      const row = (
        await client.query(
          "SELECT password_hash FROM users WHERE id=$1 FOR UPDATE",
          [req.user.id],
        )
      ).rows[0];
      if (row?.password_hash !== proof.hash) {
        await client.query("ROLLBACK");
        return fail(res, 403, "PASSWORD_VERIFICATION_EXPIRED");
      }
      await client.query("UPDATE users SET password_hash=$1 WHERE id=$2", [
        hash,
        req.user.id,
      ]);
      await client.query(
        "DELETE FROM user_sessions WHERE user_id=$1 AND token_hash<>$2",
        [req.user.id, hashToken(req.token)],
      );
      await client.query("COMMIT");
      res.json({ data: { changed: true } });
    } catch (error) {
      if (client) await client.query("ROLLBACK").catch(() => {});
      next(error);
    } finally {
      client?.release();
    }
  },
);
