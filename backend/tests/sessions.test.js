// نجرّب الدخول وانتهاء الجلسة والخروج من الحساب.
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { setupQa, databaseSkip, expectError } from "./helpers/qa-fixtures.js";

let q;

// إعداد بيئة الاختبار قبل البدء
before(async () => {
  if (!databaseSkip) q = await setupQa("sessions");
});

// إغلاق الاتصال بعد انتهاء الاختبارات
after(async () => {
  if (q) await q.shutdown();
});

// اختبار DB-06: التحقق من أن تسجيل الدخول يخزن بصمة التوكن ووقت الانتهاء، وأن تسجيل الخروج أو انتهاء الوقت يلغي الصلاحية
test(
  "DB-06: login stores only a session hash, expiry and logout revoke access",
  { skip: databaseSkip },
  async () => {
    const email = "session-check@example.invalid",
      password = "Session-test-only";

    // تسجيل مستخدم جديد للاختبار
    const registered = await q.api("/auth/register", {
      method: "POST",
      body: { name: "Session fixture", email, password },
    });
    assert.equal(registered.status, 201);

    // تسجيل الدخول بالحساب الجديد
    const login = await q.api("/auth/login", {
      method: "POST",
      body: { email, password },
    });
    assert.equal(login.status, 200);

    const token = login.json.data.token,
      id = registered.json.data.id;

    // نتأكد أن الجلسة مخزنة في قاعدة البيانات
    const row = (
      await q.pool.query("SELECT * FROM user_sessions WHERE user_id=$1", [id])
    ).rows[0];
    assert.ok(row);

    // نتأكد أن المخزن هو بصمة التوكن (Hash) وليس التوكن نفسه صريحاً لضمان الأمان
    assert.notEqual(row.token_hash, token);

    // نتأكد أن وقت انتهاء الجلسة في المستقبل (أكبر من الوقت الحالي)
    assert.ok(row.expires_at > new Date());

    // نتأكد أن التوكن شغال ويسمح بالوصول للصفحات المحمية
    assert.equal((await q.api("/me/items", { token })).status, 200);

    // نجبر الجلسة على انتهاء الصلاحية بتعديل الوقت في قاعدة البيانات إلى الماضي
    await q.pool.query(
      "UPDATE user_sessions SET expires_at=clock_timestamp()-interval '1 second' WHERE user_id=$1",
      [id],
    );

    // نتأكد أن الطلب يرفض ويطرد المستخدم لأن الجلسة انتهت (401)
    expectError(await q.api("/me/items", { token }), 401, "UNAUTHORIZED");

    // تسجيل دخول جديد للحصول على توكن جديد
    const again = await q.api("/auth/login", {
      method: "POST",
      body: { email, password },
    });
    const nextToken = again.json.data.token;

    // تجربة تسجيل الخروج (Logout)
    assert.equal(
      (await q.api("/auth/logout", { method: "POST", token: nextToken }))
        .status,
      200,
    );

    // نتأكد بعد تسجيل الخروج أن التوكن لم يعد صالحاً للوصول
    expectError(
      await q.api("/me/items", { token: nextToken }),
      401,
      "UNAUTHORIZED",
    );
  },
);
