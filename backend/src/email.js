// نستورد اداة توليد الارقام العشوائيه
import { randomInt } from "node:crypto";
// نستورد مكتبة ارسال الايميل
import nodemailer from "nodemailer";
// نستورد مكتبة حساب بصمة الرمز
import bcrypt from "bcryptjs";
// نستورد دالة تنفيذ استعلامات قاعدة البيانات
import { query } from "./db.js";
// نحفظ هنا اداة الارسال ونبدأها فاضيه
let transporter = null;
// داله نستخدمها من الملفات الثانيه لتوليد رمز التحقق
export function newEmailCode() {
  // نولد رقم من صفر الى ٩٩٩٩٩٩
  const number = randomInt(0, 1000000);
  // نحوله لنص من ٦ خانات ونكمله باصفار من اليسار اذا احتجنا
  return String(number).padStart(6, "0");
  // نهاية دالة توليد الرمز
}
// تم التعديل من عبير: نعيد استخدام اتصال البريد ونحدد مهل الاتصال عشان الطلب ما يعلق.
function emailTransport() {
  // نبدأ فحص اعدادات خدمة البريد
  if (
    // نرفض اذا عنوان خادم البريد مو موجود
    !process.env.SMTP_HOST ||
    // نرفض اذا اسم مستخدم حساب الارسال مو موجود
    !process.env.SMTP_USER ||
    // نرفض اذا كلمة مرور خدمة البريد مو موجوده
    !process.env.SMTP_PASS
    // اذا فيه اعداد ناقص ندخل هنا
  ) {
    // نوقف الارسال ونوضح ان الاعدادات ناقصه
    throw new Error("Email settings are missing");
    // نهاية فحص اعدادات البريد
  }
  // نجهز اداة الارسال اذا ما تجهزت قبل
  if (!transporter) {
    // ناخذ المنفذ من الاعدادات ونستخدم ٤٦٥ اذا ما تحدد
    const port = Number(process.env.SMTP_PORT || 465);
    // نتاكد ان المنفذ عدد صحيح داخل النطاق
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      // نوقف الداله اذا المنفذ غير صالح
      throw new Error("Invalid SMTP port");
      // نهاية فحص المنفذ
    }
    // نجهز اداة الارسال ونحفظها في المتغير
    transporter = nodemailer.createTransport({
      // عنوان خادم البريد من الاعدادات
      host: process.env.SMTP_HOST,
      // المنفذ اللي تاكدنا منه فوق
      port: port,
      // نبدأ باتصال مشفر اذا المنفذ ٤٦٥
      secure: port === 465,
      // مع المنافذ الثانيه نشترط ترقية الاتصال الى اتصال مشفر
      requireTLS: port !== 465,
      // بيانات الدخول لحساب البريد المرسل
      auth: {
        // اسم مستخدم حساب الارسال
        user: process.env.SMTP_USER,
        // كلمة مرور خدمة البريد ومع Gmail تكون كلمة مرور التطبيق
        pass: process.env.SMTP_PASS,
        // نهاية بيانات الدخول
      },
      // تم التعديل من عبير: مهله الاتصال والتحيه ست ثواني عشان نرجع خطا واضح بسرعه.
      pool: true,
      maxConnections: 2,
      maxMessages: 50,
      greetingTimeout: 6000,
      connectionTimeout: 6000,
      // تم التعديل من عبير: نوقف الاتصال بعد عشر ثواني بدون نشاط.
      socketTimeout: 10000,
      // نهاية تجهيز اداة الارسال
    });
    // نهاية شرط تجهيز الاداة اول مره
  }
  return transporter;
}
// تم التعديل من عبير: نفحص اعدادات SMTP بدون ارسال رساله او طباعه المفاتيح.
export async function verifyMailConfiguration() {
  try {
    await emailTransport().verify();
  } finally {
    transporter?.close();
    transporter = null;
  }
}
// داله تستقبل ايميل المستخدم والرمز وترسل الرساله
export async function sendVerificationCode(email, code) {
  // نبدأ فحص الايميل
  if (
    // نرفض اذا الايميل مو نص
    typeof email !== "string" ||
    // نرفض اذا صيغة الايميل غير صحيحه
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    // اذا تحقق اي سبب للرفض ندخل هنا
  ) {
    // نوقف الداله بخطا يوضح ان الايميل غير صالح
    throw new Error("Invalid email");
    // نهاية فحص الايميل
  }
  // نرفض اذا الرمز مو نص من ٦ ارقام
  if (typeof code !== "string" || !/^\d{6}$/.test(code)) {
    // نوقف الداله اذا صيغة الرمز غلط
    throw new Error("Invalid verification code");
    // نهاية فحص الرمز
  }
  const sender = emailTransport();
  // نرسل الرساله ونحفظ رد خادم البريد
  const result = await sender.sendMail({
    // ناخذ عنوان المرسل ونستخدم حساب الارسال اذا ما تحدد
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    // نرسل الرساله الى ايميل المستخدم
    to: email,
    // عنوان الرساله اللي يظهر في البريد
    subject: "رمز التحقق من مزياد",
    // نجهز محتوى الرساله
    text:
      // نكتب بداية الرساله
      "رمز التحقق الخاص بك في مزياد: " +
      // نضيف رمز التحقق الاصلي
      code +
      // نضيف مدة الصلاحيه والتنبيه في سطور جديده
      "\nالرمز صالح لمدة 10 دقائق.\nإذا لم تسجل في مزياد، تجاهل الرسالة.",
    // نهاية ارسال الرساله وحفظ الرد
  });
  // نتاكد ان خادم البريد قبل المستلم
  if (!result.accepted || result.accepted.length === 0) {
    // نرجع خطا اذا خادم البريد ما قبل المستلم
    throw new Error("Email was not accepted");
    // نهاية فحص قبول المستلم
  }
  // نهاية دالة ارسال الرمز
}
// داله تجهز الرمز وتحفظ بصمته وتحاول ترسله للمستخدم
export async function saveAndSendCode(user) {
  // نولد رمز تحقق جديد
  const code = newEmailCode();
  // نحسب بصمة الرمز والرقم ١٢ يحدد تكلفة الحساب
  const codeHash = await bcrypt.hash(code, 12);
  // ننفذ التحديث ونحفظ نتيجته
  const saved = await query(
    // نحفظ بصمة الرمز في حساب المستخدم
    "UPDATE users SET email_code_hash=$2, " +
      // نحدد انتهاء الرمز بعد عشر دقايق من وقت قاعدة البيانات
      "email_code_expires_at=now()+interval '10 minutes', " +
      // نصفر المحاولات ونسجل وقت تجهيز الارسال
      "email_code_attempts=0, email_code_sent_at=now() " +
      // نحدث المستخدم اللي ايميله ما تحقق ونرجع معرفه
      "WHERE id=$1 AND email_verified_at IS NULL RETURNING id",

    // معرف المستخدم يروح مكان $1 والبصمه تروح مكان $2
    [user.id, codeHash],
    // نهاية تنفيذ استعلام التحديث
  );
  // نفحص اذا ما تم تحديث اي حساب
  if (!saved.rowCount) {
    // نوقف هنا ونرجع فشل
    return false;
    // نهاية فحص نتيجة التحديث
  }
  // نحاول ارسال الرمز بعد حفظ بصمته
  try {
    // نرسل ايميل المستخدم والرمز الاصلي وننتظر النتيجه
    await sendVerificationCode(user.email, code);
    // نرجع نجاح بعد قبول خادم البريد للرساله
    return true;
    // اذا صار خطا في محاولة الارسال ندخل هنا
  } catch (error) {
    // نطبع نوع الخطا بدون رمز التحقق
    console.error("Email send failed", error.code || "SMTP_ERROR");
    // تم التعديل من عبير: اذا فشل الارسال نلغي الرمز ونسمح بطلب جديد بدون انتظار وهمي ونحمي الرمز الاحدث.
    await query(
      "UPDATE users SET email_code_hash=NULL,email_code_expires_at=NULL,email_code_sent_at=NULL WHERE id=$1 AND email_code_hash=$2 AND email_verified_at IS NULL",
      [user.id, codeHash],
    );
    // نرجع ان الارسال فشل
    return false;
    // نهاية معالجة خطا الارسال
  }
  // نهاية دالة حفظ الرمز وارساله
}
