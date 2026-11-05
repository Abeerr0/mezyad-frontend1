// نفحص إعداد مفتاح ميسر قبل محاولة الاتصال.
export function moyasarReady() {
  // نقرأ المفتاح من إعدادات التشغيل.
  const key = process.env.MOYASAR_SECRET_KEY || "";
  // نرفض إذا المفتاح فارغ أو ما يبدأ ببادئة الاختبار.
  if (!key || !key.startsWith("sk_test_")) {
    return false;
  }
  // نسمح بمحاولة الاتصال باستخدام مفتاح الاختبار.
  return true;
}
// هنا داله فقط تفحص وجود المفتاح وبدايته فقط لكن هل المفتاح صحيح او لا هذي من رد ميسر
// هنا الفحص يفحص فقط المفتاح التجريبي اللي يبدا بتسيت
// هنا نرسل طلب لميسر وننتظر الرد عشان نعرف نتيجة العملية
async function moyasarRequest(path, method) {
  //  نفحص مفتاح الاختبار قبل ما نحاول نتصل بميسر
  if (!moyasarReady()) {
    //  نوقف الدالة بخطأ إذا مفتاح الاختبار مو جاهز
    throw Object.assign(
      new Error("Moyasar test key is not configured"),
      {
        // هنا نحط رقم الحالة اللي يوضح أن الخدمة مو جاهزة
        status: 503,
        // هنا نحط رمز يوضح سبب الخطأ للجزء اللي استدعى الدالة
        apiCode: "BANK_SANDBOX_UNAVAILABLE",
      },
    );
  }
  // هنا ناخذ المفتاح من الإعدادات ونجهزه بطريقة الدخول اللي تطلبها ميسر
  // النقطتين بعد المفتاح تعني أن كلمة المرور فارغة
  const login = Buffer.from(process.env.MOYASAR_SECRET_KEY + ":").toString(
    "base64",
  );
  // هنا نرسل الطلب لرابط ميسر وننتظر ردهم
  const response = await fetch("https://api.moyasar.com/v1" + path, {
    // هنا نحدد نوع الطلب مثل قراءة العملية أو إلغاء الحجز
    method: method,
    headers: {
      // هنا نرسل بيانات الدخول مع الطلب
      Authorization: "Basic " + login,
    },
    // هنا نوقف الانتظار إذا الطلب أخذ أكثر من عشر ثواني
    signal: AbortSignal.timeout(10000),
  });
  // هنا نقرأ بيانات الرد وإذا ما قدرنا نقرأها نستخدم كائن فاضي
  const body = await response.json().catch(() => ({}));
  //  نرجع رقم حالة الرد وبياناته للجزء اللي طلب العملية
  return { status: response.status, body: body };
}
// هنا نجيب بيانات العملية من ميسر باستخدام رقمها
export function getPayment(paymentId) {
  // هنا نطلب قراءة العملية ونجهز رقمها عشان ينحط بالرابط بشكل صحيح
  return moyasarRequest("/payments/" + encodeURIComponent(paymentId), "GET");
}

// هنا نطلب من ميسر إلغاء حجز العملية
export function voidPayment(paymentId) {
  // هنا نرسل طلب إلغاء الحجز ونمرر رقم العملية بالرابط
  return moyasarRequest(
    "/payments/" + encodeURIComponent(paymentId) + "/void",
    "POST",
  );
}
// هنا نفحص بيانات الحجز اللي رجعت من ميسر
export function checkPayment(payment, data) {
  // هنا نرفض إذا بيانات العملية أو بيانات المقارنة مو موجودة
  if (!payment || typeof payment !== "object" || !data) {
    return "PAYMENT_NOT_USABLE";
  }
  // هنا ناخذ البيانات المتوقعة من الباك عشان نقارنها برد ميسر
  const auctionId = data.auctionId;
  const userId = data.userId;
  const minimumCents = data.minimumCents;
  const metadata = payment.metadata || {};

  // هنا نتأكد أن الحجز يخص نفس المزاد ونفس المستخدم
  if (
    typeof auctionId !== "string" ||
    typeof userId !== "string" ||
    String(metadata.auction_id).toLowerCase() !== auctionId.toLowerCase() ||
    String(metadata.user_id).toLowerCase() !== userId.toLowerCase()
  ) {
    return "PAYMENT_MISMATCH";
  }
  // هنا نرفض إذا ميسر رجعت أن العملية فشلت
  if (payment.status === "failed") {
    return "COMMITMENT_DECLINED";
  }
  // هنا نرفض إذا العملية بدأت لكن المستخدم ما كملها
  if (payment.status === "initiated") {
    return "PAYMENT_NOT_COMPLETED";
  }
  // هنا نرفض إذا المبلغ انخصم لأن المطلوب حجز فقط
  if (payment.status === "paid" || payment.status === "captured") {
    return "MANUAL_PAYMENT_REQUIRED";
  }
  // هنا نقبل حالة الحجز فقط ونرفض باقي الحالات
  if (payment.status !== "authorized") {
    return "PAYMENT_NOT_USABLE";
  }
  // هنا نتأكد أن عملة العملية ريال سعودي
  if (payment.currency !== "SAR") {
    return "WRONG_CURRENCY";
  }
  // هنا نتأكد أن المبلغ والحد الأدنى أرقام صحيحة بالهللات
  // ونرفض إذا المبلغ المحجوز أقل من الحد المطلوب
  if (
    !Number.isSafeInteger(minimumCents) ||
    minimumCents <= 0 ||
    !Number.isSafeInteger(payment.amount) ||
    payment.amount < minimumCents
  ) {
        return "COMMITMENT_TOO_LOW";
  }

  // هنا بيانات الحجز طابقت الشروط اللي فحصناها
  return "OK";
}