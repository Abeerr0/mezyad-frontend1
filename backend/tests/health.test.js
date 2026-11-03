// نتأكد إن السيرفر يرد على طلب فحص التشغيل (Health Check).
import test from "node:test";
import assert from "node:assert/strict";
import { app } from "../src/app.js";

// اختبار أن مسار فحص الحالة يرجع حالة السيرفر سليمة (ok)
test("GET /health returns status ok", async () => {
  // تشغيل السيرفر على منفذ عشوائي مؤقت للاختبار
  const server = app.listen(0);
  try {
    const port = server.address().port;

    // إرسال طلب GET إلى مسار الفحص
    const response = await fetch("http://127.0.0.1:" + port + "/health");

    // التأكد أن الاستجابة ناجحة (200) وأن الهيكل يرجع الحالة ok
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { data: { status: "ok" } });
  } finally {
    // إغلاق السيرفر تماماً بعد انتهاء الاختبار لضمان عدم تعليق المنفذ
    await new Promise((resolve) => server.close(resolve));
  }
});
