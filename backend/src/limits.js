// نوقف المحاولات المتكررة مؤقتًا إذا تعدّت الحد المسموح (Rate Limiter).
export function attemptLimit({
  max = 10, // الحد الأقصى للمحاولات المسموحة (الافتراضي 10 محاولات)
  windowMs = 60000, // الفترة الزمنية بالمللي ثانية (الافتراضي دقيقة واحدة 60 ثانية)
  key = (req) => req.user?.id || req.ip, // المفتاح اللي نميز فيه المستخدم (إما الأيدي حقه أو عنوان الـ IP)
} = {}) {
  // نخزن المحاولات في ذاكرة السيرفر (Map)
  const attempts = new Map();

  return (req, res, next) => {
    const now = Date.now();

    // ننظف السجلات القديمة اللي انتهى وقت حظرها عشان ما تملا الذاكرة
    for (const [id, entry] of attempts)
      if (entry.reset <= now) attempts.delete(id);

    // نحدد هوية المستخدم الحالي بناءً على المفتاح
    const id = key(req);
    const entry = attempts.get(id) || { count: 0, reset: now + windowMs };

    // إذا تجاوز الحد الأقصى للمحاولات أو وصلت الذاكرة للحد الأقصى (10 آلاف مستخدم) نرفض الطلب
    if (entry.count >= max || (!attempts.has(id) && attempts.size >= 10000)) {
      // نرجع للمستخدم متى يقدر يحاول مرة ثانية بالثواني
      res.set(
        "Retry-After",
        String(Math.max(1, Math.ceil((entry.reset - now) / 1000))),
      );
      return res.status(429).json({
        error: {
          code: "TOO_MANY_REQUESTS",
          message: "Too many attempts. Try again later.",
        },
      });
    }

    // نزيد عدد المحاولات بواحدة ونحدثها في الذاكرة
    entry.count++;
    attempts.set(id, entry);

    // نسمح للطلب بالمرور للخطوة التالية
    next();
  };
}
