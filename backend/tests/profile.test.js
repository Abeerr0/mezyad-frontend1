import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { setupQa, databaseSkip } from "./helpers/qa-fixtures.js";

// تم التعديل من عبير: نختبر تغيير البيانات فعليا ونمنع تغيير البريد وتجاوز التحقق او استخدام اثبات حساب ثاني.
test(
  "Profile changes preserve email and protect password changes and sessions",
  { skip: databaseSkip },
  async () => {
    const q = await setupQa("profile");
    try {
      const user = q.seller,
        token = user.token;
      assert.equal(
        (
          await q.api("/me/profile", {
            method: "PATCH",
            body: { name: "Abeer" },
          })
        ).status,
        401,
      );
      assert.equal(
        (
          await q.api("/me/profile", {
            method: "PATCH",
            token,
            body: { name: "????" },
          })
        ).status,
        400,
      );
      assert.equal(
        (
          await q.api("/me/profile", {
            method: "PATCH",
            token,
            body: { name: "Abeer", email: "changed@example.invalid" },
          })
        ).status,
        400,
      );
      const prior = (
        await q.pool.query("SELECT * FROM users WHERE id=$1", [user.id])
      ).rows[0];
      const updated = await q.api("/me/profile", {
        method: "PATCH",
        token,
        body: { name: "عبير الصيعري" },
      });
      assert.equal(updated.status, 200);
      assert.equal(updated.json.data.name, "عبير الصيعري");
      assert.equal(updated.json.data.email, prior.email);
      const wrong = await q.api("/me/password/verify", {
        method: "POST",
        token,
        body: { currentPassword: "wrong-password" },
      });
      assert.equal(wrong.status, 403);
      assert.equal(wrong.json.error.code, "CURRENT_PASSWORD_INCORRECT");
      const newPassword = "Profile-new-password-2026";
      assert.equal(
        (
          await q.api("/me/password", {
            method: "POST",
            token,
            body: { password: newPassword, confirmPassword: newPassword },
          })
        ).status,
        400,
      );
      const verified = await q.api("/me/password/verify", {
        method: "POST",
        token,
        body: { currentPassword: "Local-QA-fixture-only" },
      });
      assert.equal(verified.status, 200);
      const verificationToken = verified.json.data.verificationToken;
      const change = {
        verificationToken,
        password: newPassword,
        confirmPassword: newPassword,
      };
      assert.equal(
        (
          await q.api("/me/password", {
            method: "POST",
            token: q.bidder.token,
            body: change,
          })
        ).status,
        403,
      );
      assert.equal(
        (
          await q.api("/me/password", {
            method: "POST",
            token,
            body: { ...change, confirmPassword: "does-not-match" },
          })
        ).status,
        400,
      );
      const second = randomBytes(32).toString("hex"),
        digest = createHash("sha256").update(second).digest("hex");
      await q.pool.query(
        "INSERT INTO user_sessions(user_id,token_hash,expires_at) VALUES($1,$2,now()+interval '1 hour')",
        [user.id, digest],
      );
      const changed = await q.api("/me/password", {
        method: "POST",
        token,
        body: change,
      });
      assert.equal(changed.status, 200);
      assert.equal(changed.json.data.changed, true);
      assert.equal((await q.api("/me/items", { token })).status, 200);
      assert.equal((await q.api("/me/items", { token: second })).status, 401);
      assert.equal(
        (await q.api("/me/password", { method: "POST", token, body: change }))
          .status,
        403,
      );
      assert.equal(
        (
          await q.api("/auth/login", {
            method: "POST",
            body: { email: prior.email, password: "Local-QA-fixture-only" },
          })
        ).status,
        401,
      );
      assert.equal(
        (
          await q.api("/auth/login", {
            method: "POST",
            body: { email: prior.email, password: newPassword },
          })
        ).status,
        200,
      );
      const row = (
        await q.pool.query("SELECT * FROM users WHERE id=$1", [user.id])
      ).rows[0];
      assert.equal(row.email, prior.email);
      assert.notEqual(row.password_hash, newPassword);
      assert.notEqual(row.password_hash, prior.password_hash);
    } finally {
      await q.shutdown();
    }
  },
);
