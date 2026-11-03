import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { query, pool } from "./db.js";
import { auth, admin, hashToken, newToken } from "./auth.js";
import { validMoney, toCents } from "./money.js";
import { listings, withImages, withListingImages } from "./listings.js";
import { imageLink, serveImage } from "./uploads.js";
import { attemptLimit } from "./limits.js";
import { startCommitment } from "./bank.js";
import { auctionStatus, resultFor, participationFor } from "./auctions.js";

export const app = express();
app.use(
  cors({ origin: process.env.FRONTEND_ORIGIN || "http://localhost:5173" }),
);
app.use(express.json({ limit: "100kb" }));
const err = (res, status, code, message) =>
  res.status(status).json({ error: { code, message } });
const validUuid = (x) =>
  typeof x === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
const numeric = (x) =>
  typeof x === "number" &&
  Number.isFinite(x) &&
  x > 0 &&
  Number.isSafeInteger(Math.round(x * 100)) &&
  Math.abs(x * 100 - Math.round(x * 100)) < 1e-7;
const accessible = async (a, user) => {
  if (
    a.visibility === "PUBLIC" ||
    a.seller_id === user?.id ||
    user?.role === "ADMIN"
  )
    return true;
  if (!user) return false;
  const r = await query(
    "SELECT 1 FROM private_auction_access WHERE auction_id=$1 AND user_id=$2",
    [a.id, user.id],
  );
  return !!r.rowCount;
};
async function auction(id) {
  const r = await query(
    // نجلب بيانات المزاد مع عنوان الإعلان ووصفه وفئته ومواصفاته.
    "SELECT a.*,i.seller_id,i.title,i.description,i.category_id,i.category_fields FROM auctions a JOIN items i ON i.id=a.item_id WHERE a.id=$1",
    //يرسل معرف id المزاد ليستخدم الاستعلام مكانه ١$
    [id],
    //نهايه استدعاء الداله
  );
  // r.rows هي قائمة نتائج الاستعلام، و[0] تعني أول صف.
  // نرجع بيانات المزاد إلى المكان الذي استدعى الدالة.
  return r.rows[0];
  // نهايه داله جلب بيانات المزاد
}
//  نحدد الحالة التي ستظهر مع المزاد حسب مواعيده والوقت الحالي.
function getAuctionDisplayStatus(auctionData, currentTime) {
  // إذا كان المزاد مغلقًا بالفعل، تبقى حالته مغلقًا.
  if (auctionData.status === "CLOSED") {
    return "CLOSED";
  }

  // نحول موعد النهاية إلى رقم حتى نقارنه بالوقت الحالي.
  const endTime = new Date(auctionData.end_time).getTime();

  // نحول موعد البداية إلى رقم للمقارنة أيضًا.
  const startTime = new Date(auctionData.start_time).getTime();

  // إذا وصلنا لموعد النهاية أو تجاوزناه، نرجع مغلقًا.
  if (endTime <= currentTime) {
    return "CLOSED";
  }

  // إذا بدأ المزاد ولم ينتهِ، نرجع نشطًا.
  if (startTime <= currentTime) {
    return "ACTIVE";
  }

  // إذا لم يبدأ المزاد بعد، نرجع مجدولًا.
  return "SCHEDULED";
}
async function closeIfEnded(id) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const r = await client.query(
      "SELECT * FROM auctions WHERE id=$1 FOR UPDATE",
      [id],
    );
    if (!r.rowCount) {
      await client.query("ROLLBACK");
      return;
    }
    const a = r.rows[0];
    const time = await client.query("SELECT clock_timestamp() AS current_time");
    if (
      a.status !== "CLOSED" &&
      new Date(a.end_time) <= time.rows[0].current_time
    ) {
      const w = await client.query(
        "SELECT id FROM bids WHERE auction_id=$1 ORDER BY amount DESC,created_at ASC LIMIT 1",
        [id],
      );
      await client.query("UPDATE auctions SET status='CLOSED' WHERE id=$1", [
        id,
      ]);
      await client.query(
        "INSERT INTO auction_results(auction_id,winner_bid_id) VALUES($1,$2) ON CONFLICT(auction_id) DO NOTHING",
        [id, w.rows[0]?.id || null],
      );
    }
    await client.query(
      "UPDATE auctions SET status='ACTIVE' WHERE id=$1 AND status='SCHEDULED' AND start_time<=clock_timestamp() AND end_time>clock_timestamp()",
      [id],
    );
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
app.get("/health", (_req, res) => res.json({ data: { status: "ok" } }));
// استقبال طلب إنشاء حساب جديد
// نستخدم async عشان نقدر نستخدم await لانتظار نتيجة عملية، مثل حفظ الحساب في قاعدة البيانات.
//عندما يصل طلب POST لمسار تسجيل الحساب، نفّذ التعليمات الموجودة داخل هذه الدالة
// هذا الرمز يعني او || إذا كان الاسم ليس نصًا، أو كان فارغًا بعد إزالة المسافات من الأطراف، نرفض الطلب.
app.post("/auth/register", async (req, res, next) => {
  try {
    const data = req.body || {};
    const name = data.name;
    const email = data.email;
    const password = data.password;
    if (
      //اول شي الاسم لازم يتحقق انو سترينق يعني حروف
      typeof name !== "string" ||
      //يتحقق هل الاسم فارغ ولا مكنوب فيه مسافات فقط
      !name.trim() ||
      // نرفض الاسم إذا تجاوز طوله 160 بعد إزالة المسافات من بدايته ونهايته، لأن هذا هو الحد المحدد له في قاعدة البيانات.
      name.trim().length > 160 ||
      //نوع الايميل المدخل يكون سترينق حروف فقط
      typeof email !== "string" ||
      // نرفض الإيميل إذا تجاوز طوله 254، وهو الحد الموجود في قاعدة البيانات
      email.trim().toLowerCase().length > 254 ||
      // نتحقق من شكل الإيميل: علامة @ واحدة، وجزء قبلها وبعدها ونقطة، وبدون مسافات
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      //. نوع الباس لازم يكون نص ويحتوي ارقام وحروف ورموز وعلامه التعجب تعني انو يتحقق ان القيمه مو نص
      typeof password !== "string" ||
      //طول الباسوورد يكون ٨ او اكثر
      password.length < 8 ||
      // نرفض كلمة المرور إذا تجاوز حجمها 72 بايت، وهو حد bcrypt
      Buffer.byteLength(password, "utf8") > 72
    )
      //داله err تجهز رد الخطا وارساله  return تنهي طلب تنفيذ الداله بعد الاستدعاء
      return err(
        //رد اللي يوفره express نمرره للداله عشان تقدر ترد للمستخدم
        res,
        // رقم حاله http تعني خطا من المستخدم بسبب بيانات غير صحيحه
        400,
        // رمز الخطا اللي يظهر اللي معتمدينه بالمشروع الفرق بينه وبين ٤٠٠ ان هذا يرسل داخل بيانات الرد لتوضيح نوع الخطأ للتطبيق لكن. ٤٠٠ نتوضح نوع الخطا
        "INVALID_INPUT",
        //
        "Valid name, email and password (8+ chars) required",
      );
    const hash = await bcrypt.hash(password, 12);
    const r = await query(
      "INSERT INTO users(name,email,password_hash) VALUES($1,$2,$3) RETURNING id,name,email,role",
      [name.trim(), email.trim().toLowerCase(), hash],
    );
    res.status(201).json({ data: r.rows[0] });
    // إذا كان رمز الخطأ 23505، نرسل رد 409 ورسالة أن الإيميل مسجل مسبقًا.
    // الدالة err تجهز رد الخطأ وترسله.
    // return تنهي معالجة طلب التسجيل الحالي، ويظل الباك إند شغالًا.
    // إذا صار خطأ غير تكرار الإيميل، مثل فشل الاتصال بقاعدة البيانات،
    // نستخدم next(e) لتمريره إلى الجزء المسؤول عن إرسال رد يوضح الخطأ.
  } catch (e) {
    if (e.code === "23505")
      return err(res, 409, "DUPLICATE_EMAIL", "Email already registered");
    next(e);
  }
});
const accounts = express.Router();
app.use("/auth", accounts);
app.use("/api/v1/auth", accounts);
accounts.post("/register", async (req, res, next) => {
  try {
    // نتحقق من بيانات الحساب قبل ما نحفظه.
    const { name, email, password } = req.body || {};
    if (
      typeof name !== "string" ||
      !name.trim() ||
      name.trim().length > 160 ||
      typeof email !== "string" ||
      email.trim().toLowerCase().length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      typeof password !== "string" ||
      password.length < 8 ||
      Buffer.byteLength(password, "utf8") > 72
    )
      return err(
        res,
        400,
        "INVALID_INPUT",
        "Valid name, email and password (8+ chars) required",
      );
    const hash = await bcrypt.hash(password, 12);
    // الحساب العام يطلع USER؛ ما ناخذ صلاحية الأدمن من الطلب.
    const r = await query(
      "INSERT INTO users(name,email,password_hash) VALUES($1,$2,$3) RETURNING id,name,email,role",
      [name.trim(), email.trim().toLowerCase(), hash],
    );
    res.status(201).json({ data: r.rows[0] });
  } catch (e) {
    if (e.code === "23505")
      return err(res, 409, "DUPLICATE_EMAIL", "Email already registered");
    next(e);
  }
});
app.post("/auth/login", async (req, res, next) => {
  try {
    // ياخذ بيانات الطلب وإذا ما وصلت بيانات يستخدم كائن فارغ.
    const data = req.body || {};

    // ياخذ الإيميل الموجود في بيانات الطلب.
    const email = data.email;

    // ياخذ كلمة المرور الموجودة في بيانات الطلب.
    const password = data.password;
    // نرفض الطلب إذا تحقق أي شرط من الشروط التالية.
    if (
      // الإيميل لازم يكون نصًا.
      typeof email !== "string" ||
      // نرفض الإيميل الفارغ أو الذي يحتوي مسافات فقط.
      !email.trim() ||
      // طول الإيميل بعد تنظيفه لا يتجاوز حد قاعدة البيانات.
      email.trim().toLowerCase().length > 254 ||
      // كلمة المرور لازم تكون نصًا.
      typeof password !== "string" ||
      // نرفض كلمة المرور الفارغة.
      password.length === 0 ||
      // حجم كلمة المرور لا يتجاوز الحد الذي تستخدمه bcrypt.
      Buffer.byteLength(password, "utf8") > 72
    ) {
      // نرسل خطأ 400 ونوقف معالجة طلب الدخول الحالي.
      return err(
        res,
        400,
        "INVALID_INPUT",
        "Valid email and password required",
      );
    }
    //     rيبحث  في جدول المستخدمين عن االحساب باستخدام الايميمل ويحفظ نتيجه البحث في r
    const r = await query("SELECT * FROM users WHERE email=$1", [
      //نشيل المسافات من اطرف الايميمل ويحول حروفه الى سمول احرف صغيره يعني
      email.trim().toLowerCase(),
      //هذا اخر جزء من التعليمات اللي عطيناهاquery
    ]);
    // التحقق من وجود سبب لرفض تسجيل الدخول
    if (
      !r.rowCount ||
      !(await bcrypt.compare(password, r.rows[0].password_hash))
    )
      return err(res, 401, "INVALID_CREDENTIALS", "Invalid credentials");
    const token = newToken(),
      u = r.rows[0];
    await query(
      "INSERT INTO user_sessions(user_id,token_hash,expires_at) VALUES($1,$2,now()+interval '7 days')",
      [u.id, hashToken(token)],
    );
    res.json({
      data: {
        token,
        user: { id: u.id, name: u.name, email: u.email, role: u.role },
      },
    });
  } catch (e) {
    next(e);
  }
});
// نتحقق من الجلسة قبل إرجاع بيانات المستخدم.
app.get("/auth/me", auth, (req, res) => {
  // نرسل بيانات المستخدم التي جهزتها دالة auth.
  res.json({ data: { user: req.user } });
});
accounts.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (
      typeof email !== "string" ||
      !email.trim() ||
      email.trim().toLowerCase().length > 254 ||
      typeof password !== "string" ||
      password.length === 0 ||
      Buffer.byteLength(password, "utf8") > 72
    ) {
      return err(
        res,
        400,
        "INVALID_INPUT",
        "Valid email and password required",
      );
    }
    // هنا نطابق كلمة المرور مع البصمة المحفوظة.
    const r = await query("SELECT * FROM users WHERE email=$1", [
      email.trim().toLowerCase(),
    ]);
    if (
      !r.rowCount ||
      !(await bcrypt.compare(password, r.rows[0].password_hash))
    )
      return err(res, 401, "INVALID_CREDENTIALS", "Invalid credentials");
    const token = newToken(),
      u = r.rows[0];
    // نخزن بصمة الجلسة بدل الرمز نفسه.
    await query(
      "INSERT INTO user_sessions(user_id,token_hash,expires_at) VALUES($1,$2,now()+interval '7 days')",
      [u.id, hashToken(token)],
    );
    res.json({
      data: {
        token,
        user: { id: u.id, name: u.name, email: u.email, role: u.role },
      },
    });
  } catch (e) {
    next(e);
  }
});
app.post("/auth/logout", auth, async (req, res, next) => {
  try {
    await query("DELETE FROM user_sessions WHERE token_hash=$1", [
      hashToken(req.token),
    ]);
    res.json({ data: { signedOut: true } });
  } catch (e) {
    next(e);
  }
});
app.get("/categories", async (_req, res, next) => {
  try {
    res.json({
      data: (await query("SELECT id,name FROM categories ORDER BY name")).rows,
    });
  } catch (e) {
    next(e);
  }
});
app.post("/items", listings);
app.post("/items", auth, async (req, res, next) => {
  try {
    const {
      categoryId,
      title,
      description,
      categoryFields = {},
    } = req.body || {};
    if (
      !validUuid(categoryId) ||
      typeof title !== "string" ||
      !title.trim() ||
      typeof description !== "string" ||
      !description.trim() ||
      typeof categoryFields !== "object" ||
      !categoryFields ||
      Array.isArray(categoryFields)
    )
      return err(res, 400, "INVALID_INPUT", "Valid listing fields required");
    const r = await query(
      "INSERT INTO items(seller_id,category_id,title,description,category_fields) VALUES($1,$2,$3,$4,$5) RETURNING *",
      [
        req.user.id,
        categoryId,
        title.trim(),
        description.trim(),
        JSON.stringify(categoryFields),
      ],
    );
    res.status(201).json({ data: r.rows[0] });
  } catch (e) {
    if (e.code === "23503")
      return err(res, 400, "INVALID_CATEGORY", "Unknown category");
    next(e);
  }
});
//الاعلانات المعلقه للادمن وارجاع الاعلانات للمستخدم
//قائمه الاعلانات اللي تتظر مراجعه من الادمن فقط الادمن مسموح له يشوفها المستخدم لا ترجع له ٤٠٣
// مسار لطلب قائمة الإعلانات في الباك إن
app.get("/items", auth, async (req, res, next) => {
  // نفذ التعليمات داخل تراي واذا حدث خطا تنروح لكاتش
  try {
    // قائمة الإعلانات المعلقة مخصصة للأدمن.
    // نرفض الطلب إذا طلب مستخدم غير أدمن قائمة الإعلانات المعلقة.
    if (
      // نتحقق أن الطلب يطلب الإعلانات المعلقة.
      req.query.status === "PENDING_REVIEW" &&
      // نتحقق أن المستخدم ليس أدمن.
      req.user.role !== "ADMIN"
    ) {
      // نرسل رفض برمز 403، وننهي معالجة الطلب الحالي.
      return err(res, 403, "FORBIDDEN", "Admin only");
    }
    // متغير نحفظ فيه نتيجة استعلام الإعلانات.
    let r;
    // إذا كان الطلب للإعلانات المعلقة، نجلبها للأدمن.
    if (req.query.status === "PENDING_REVIEW") {
      // نرسل الاستعلام وننتظر نتيجته ونحفظها في rالمتغير اللي جهزناه
      r = await query(
        // استعلام بلغه sql يقرا الاعلانات المعلقه فقط ويرتبها حسب الا دي تبعها
        "SELECT * FROM items WHERE status='PENDING_REVIEW' ORDER BY id",
      );
      // الفرع يعمل لما الطلب يكون غير مخصص لقائمه الاعلانات المعلقه اذا ماتحقق الشرط السابق نستخدم هذا
    } else {
      // نرسل الاستعلام وننتظر النتيجه ونحفظها في rلكن هذي المره يجيب لنا اعلانات المستخدم نفسه .
      r = await query(
        // بلغه sql يقرا جميع الاعمده المطابقه من جدول الايتمز مرتبه حسب الا دي
        "SELECT * FROM items WHERE seller_id=$1 ORDER BY id",
        //القائمه فيها قيمه وحده معرف المستخدم الحالي هي اللي مقصوده ب ١ دولا بالاستعلام اللي قبل وكذا نطلب الاعلانات اللي صاحبها المستخدم
        [req.user.id],
        //نقفل الاستدعا
      );
      //نهاية فرع else. أصبح r يحتوي نتيجة أحد الاستعلامين، إذا اكتمل الاستعلام بنجاح
    }
    // نكرر الخطوات التالية لكل إعلان موجود في قائمة نتائج الإعلانات.
    for (const item of r.rows) {
      // ننفذ استعلام صور الإعلان الحالي ونحفظ نتيجته بعد اكتماله.
      const imagesResult = await query(
        // نجلب معرف الصورة ورابطها للصور المرتبطة بالإعلان المحدد، ونرتبها حسب معرف الصورة.
        "SELECT id, image_url FROM item_images WHERE item_id=$1 ORDER BY id",
        // نرسل معرف الإعلان الحالي ليستخدمه الاستعلام مكان $1.
        [item.id],
        // نهايه الاستدعاء
      );
      // نضيف الصور التي رجعت من الاستعلام إلى بيانات الإعلان الحالي.
      // نجهز رابط العرض لكل صورة.
      for (const image of imagesResult.rows) {
        image.image_url = imageLink(image.image_url);
      }

      item.images = imagesResult.rows;
    }
    // نرسل قائمة الإعلانات مع صور كل إعلان، وإذا لم توجد إعلانات نرسل قائمة فارغة.
    //يرسل قائمة الإعلانات إلى الجهة التي طلبتها اذا ما وجد الاستعلام اعلانات مطابقه تكون القائمه فارغه
    res.json({ data: r.rows });
    // ننهي try، وإذا حدث خطأ داخلها نستقبله في المتغير e.
  } catch (e) {
    // يروح الخطأ إلى معالج الأخطاء في Express.
    next(e);
  }
});
accounts.post("/logout", auth, async (req, res, next) => {
  try {
    // نحذف الجلسة عشان الرمز ما عاد يدخل بعد الخروج.
    await query("DELETE FROM user_sessions WHERE token_hash=$1", [
      hashToken(req.token),
    ]);
    res.json({ data: { signedOut: true } });
  } catch (e) {
    next(e);
  }
});
const api = express.Router();
app.use("/api/v1", api);
app.use(api);
api.get("/health", (_req, res) => res.json({ data: { status: "ok" } }));
api.get("/categories", async (_req, res, next) => {
  try {
    res.json({
      data: (await query("SELECT id,name FROM categories ORDER BY name")).rows,
    });
  } catch (e) {
    next(e);
  }
});
app.get("/items/:id", auth, async (req, res, next) => {
  try {
    if (!validUuid(req.params.id))
      return err(res, 400, "INVALID_ID", "Invalid ID");
    const r = await query("SELECT * FROM items WHERE id=$1", [req.params.id]);
    if (!r.rowCount) return err(res, 404, "NOT_FOUND", "Item not found");
    if (r.rows[0].seller_id !== req.user.id && req.user.role !== "ADMIN")
      return err(res, 403, "FORBIDDEN", "Not your item");
    res.json({ data: r.rows[0] });
  } catch (e) {
    next(e);
  }
});
app.patch("/items/:id", auth, async (req, res, next) => {
  try {
    const { title, description } = req.body || {};
    if (
      !validUuid(req.params.id) ||
      typeof title !== "string" ||
      !title.trim() ||
      typeof description !== "string" ||
      !description.trim()
    )
      return err(res, 400, "INVALID_INPUT", "Title and description required");
    const r = await query(
      "UPDATE items SET title=$1,description=$2,status='PENDING_REVIEW',review_reason=NULL,reviewed_by=NULL,reviewed_at=NULL WHERE id=$3 AND seller_id=$4 AND status='REJECTED' RETURNING *",
      [title.trim(), description.trim(), req.params.id, req.user.id],
    );
    if (!r.rowCount)
      return err(
        res,
        409,
        "INVALID_STATE",
        "Only your rejected items can be resubmitted",
      );
    res.json({ data: r.rows[0] });
  } catch (e) {
    next(e);
  }
});
// مسار الادمن لقبول الاعلان المعلق او رفضه
//نحدث حاله الاعلان ونحفظ سبب الرفض اذا كان القرار رفض
//نستقبل طلب مراجعه الاعلان بعد التحقق من الجلسه وصلاحيه الادمن
app.post("/admin/items/:id/review", auth, admin, async (req, res, next) => {
  //ننفذ هذي الخطوات واذا حدث خطا تروح لكاتش
  try {
    //نأخذ بيانات الطلب وإذا لم توجد نستخدم كائن فارغ.
    const data = req.body || {};
    //ناخذ قرار الادمن من بيانات الطلب
    const decision = data.decision;
    // نأخذ سبب الرفض المرسل مع الطلب.
    const reason = data.reason;
    // اذا انطبق عليه
    if (
      //اذا كان القرار اللي الادمن القادم من الطلب غير مقبول وغير مرفوض يعني حاله pending او قيمه غير موجوده
      (decision !== "APPROVED" && decision !== "REJECTED") ||
      // هنا عند رفض الاعلان لازم يكون السبب نص مكتوب مو فارغ او مسافات فقط
      (decision === "REJECTED" &&
        (typeof reason !== "string" || !reason.trim()))
    )
      //نرسل رد الخطا وننهي معالجه الطلب
      // err دالة موجودة أعلى الملف، تجهّز رد الخطأ وترسله
      // return: بعد تنفيذ err، تنتهي دالة معالجة هذا الطلب. ويبقى السيرفر شغّالًا يستقبل طلبات أخرى.
      return err(
        // نمرر كائن الرد res إلى دالة err عشان ترسل رد الخطأ.
        res,
        // الرمز ٤٠٠ يعني ان بيانات الطلب غير صحيحه
        400,
        //رمز الخطا اللي نستخدمه داخل بيانات الرد
        "INVALID_INPUT",
        // رساله توضيح ان القرار او سبب الرفض يحتاج تصحيح
        "Valid decision and rejection reason required",
        //مهايه استدعاء الداله
      );
    //rنرسل استعلام تحديث الاعلان وننتظر نتيجته ونحفظها في
    const r = await query(
      // نحدّث حالة الإعلان وبيانات مراجعته، بشرط أن يكون بانتظار المراجعة.
      "UPDATE items SET status=$1,review_reason=$2,reviewed_by=$3,reviewed_at=now() WHERE id=$4 AND status='PENDING_REVIEW' RETURNING *",
      [
        //القيمه الاولى قرار الادمن قبول الاعلان او رفضه
        decision,
        //هذا شرط مختصر هل القرار رفض ؟ اذا رفض نرسل سبب الرفض اذا لا نرسل nullيعني لا يوجد سبب للرفض
        decision === "REJECTED" ? reason : null,
        //معرف المستخدم اللي ارسل الطلب هنا هو الادمن لان الطلب اللي مر بالدالتين auth وadmin يستخدم مكان ٣$
        req.user.id,
        //معرف الاعلان
        req.params.id,
      ],
      // انهاء استدعاءquery
    );
    //اذا ماتحدث اي اعلان نرسل خطا وتوقف الطلب
    // rowCount عدد الصفوف اللي تحدثت
    if (!r.rowCount)
      return err(res, 409, "INVALID_STATE", "Listing not pending review");
    //نرسل بيانات الاعلان بعد تحديثه
    res.json({ data: r.rows[0] });
    //نستقبل المتغير e اذا حدث خطا في تراي
  } catch (e) {
    // نفس الشي يمرر الخطا الى معالج الاخطاء في express
    next(e);
  }
});
// هنا نتأكد إن صيغة المعرّف صحيحة قبل الاستعلام.
api.param("id", (req, res, next, id) =>
  validUuid(id) ? next() : err(res, 400, "INVALID_ID", "Invalid ID"),
);
listings.param("id", (req, res, next, id) =>
  validUuid(id) ? next() : err(res, 400, "INVALID_ID", "Invalid ID"),
);
api.use(listings);

api.get("/images/:filename", serveImage);
// الأدمن يراجع الإعلان، والرفض لازم يكون معه سبب.
api.post("/admin/items/:id/review", auth, admin, async (req, res, next) => {
  try {
    const { decision, reason } = req.body || {};
    if (
      !["APPROVED", "REJECTED"].includes(decision) ||
      (decision === "REJECTED" &&
        (typeof reason !== "string" || !reason.trim() || reason.length > 2000))
    )
      return err(
        res,
        400,
        "INVALID_INPUT",
        "Valid decision and rejection reason required",
      );
    const r = await query(
      "UPDATE items SET status=$1,review_reason=$2,reviewed_by=$3,reviewed_at=now() WHERE id=$4 AND status='PENDING_REVIEW' RETURNING *",
      [
        decision,
        decision === "REJECTED" ? reason.trim() : null,
        req.user.id,
        req.params.id,
      ],
    );
    if (!r.rowCount)
      return err(res, 409, "INVALID_STATE", "Listing not pending review");
    res.json({ data: await withImages(r.rows[0]) });
  } catch (e) {
    next(e);
  }
});
// انشاء مزاد. من اعلان معتمد يملكه المستخدم ويحدد نوعه والسعر والموعد للمزاد
app.post("/auctions", auth, async (req, res, next) => {
  //
  try {
    // ناخذ بيانات الطلب واذا مافي نحط كائن فارغ ناخذ بيانات الطلب ونحطها بالمتغير داتا
    const data = req.body || {};
    //  وراح نستخدمه بعدين للبحث عن مزاد / نأخذ معرف الإعلان الذي سننشئ له المزاد.
    const itemId = data.itemId;
    //  نقرأ نوع المزاد من بيانات الطلب ونحفظه في visibility.
    const visibility = data.visibility;
    // نحفظه في متغير بدايه المزاد او سعر بدايه المزاد نأخذ سعر بداية المزاد.
    const startingPrice = data.startingPrice;
    //  نحفظها بمتغير اقل زياده او مزايده مسموحه نأخذ أقل زيادة مسموحة للمزايدة.
    const minimumIncrement = data.minimumIncrement;
    // نأخذ موعد بداية المزاد.نفس الشى نسجله في متغير باسمه ستارت تايم
    const startTime = data.startTime;
    //  نسجله في متغير نهايه الوقت للمزاد نأخذ موعد نهاية المزاد.
    const endTime = data.endTime;
    if (
      // نرفض الطلب إذا كان معرف الإعلان بصيغة غير صحيحة.
      !validUuid(itemId) ||
      // نرفض الطلب إذا كان نوع المزاد غير عام وغير خاص.
      (visibility !== "PUBLIC" && visibility !== "PRIVATE") ||
      // الدالة تتحقق أن القيمة رقم موجب وصالح كمبلغ مالي، ضمن حدود قاعدة البيانات
      // نرفض الطلب إذا كان سعر بداية المزاد غير صالح.
      !validMoney(startingPrice) ||
      // نرفض الطلب إذا كانت قيمة أقل زيادة غير صالحة.
      !validMoney(minimumIncrement) ||
      //وقت المزاد
      // نرفض موعد البداية إذا لم يكن نصًا.
      typeof startTime !== "string" ||
      // نرفض موعد البداية إذا كان فارغًا أو مسافات فقط.
      !startTime.trim() ||
      // نرفض موعد النهاية إذا لم يكن نصًا.
      typeof endTime !== "string" ||
      // نرفض موعد النهاية إذا كان فارغًا أو مسافات فقط.
      !endTime.trim() ||
      //جافا  ترفض موعد البدايه اذا ما قراءته كتاريخ
      !Number.isFinite(Date.parse(startTime)) ||
      //جافا ترفض موعد النهايه اذا ما قراءته كتاريخ
      !Number.isFinite(Date.parse(endTime)) ||
      //هنا ترفض اذا كانت انهايه قبل البدايه او مساويه لها
      // <= تعني هل النهايه قبل البدايه او مساويه لها اذا اي ترفض الطلب
      new Date(endTime) <= new Date(startTime)
    )
      // اذا تحقق شرط الرفض نرسل رمز الخطا و ننهي معالجه الطلب
      return err(res, 400, "INVALID_INPUT", "Invalid auction parameters");
    //رمز الدخول للمزاد الخاص لو انطبق عليه انو خاص نسوي الرمز المشفر له
    // نبدأ بدون رمز دخول، لأن المزاد قد يكون عام.
    // استخدمنا let لان قيمه المتغير ستتغير من null الى رمز اذا كان المزاذ خاص
    // accessCode: نحفظ فيه رمز الدخول الأصلي الذي يحصل عليه صاحب المزاد الخاص
    let accessCode = null;
    // نبدأ بدون بصمة للرمز.
    // codeHash: نحفظ فيه بصمة الرمز الناتجة من bcrypt، وهي التي سنخزنها في قاعدة البيانات بدل الرمز الأصلي
    let codeHash = null;
    // نبدأ بدون بصمة بحث، لأن المزاد العام ما يحتاج رمز دخول.
    let codeLookup = null;
    // إذا كان المزاد خاصًا، ننشئ له رمز دخول وبصمة.
    if (visibility === "PRIVATE") {
      // نولد بيانات عشوائية بحجم 12 بايت.
      // randomBytes دالة جاهزة من Node.js
      const randomValue = randomBytes(12);
      // نحول البيانات العشوائية إلى نص يمثل رمز الدخول.
      //مكتوب ١٢ بايت لان كل بايت يظهر فيه حرفين بحسب hex التوتال ٢٤ حرف الرمز الخاص بدخول المزاد
      accessCode = randomValue.toString("hex");
      // نحسب بصمة الرمز باستخدام bcrypt لحفظها في قاعدة البيانات.
      //بنفس الوقت ١٢ هنا لا يعني طول الرمز أو عدد البايتات
      codeHash = await bcrypt.hash(accessCode, 12);
      // نحسب بصمة ثابتة عشان نقدر نلقى المزاد بنفس الرمز وقت الدخول.
      codeLookup = hashToken("auction:" + accessCode);
    }
    // نرسل استعلام إنشاء المزاد، وننتظر نتيجته ونحفظها في r.
    const r = await query(
      // نحدد جدول المزادات والأعمدة التي سنضيف فيها بيانات المزاد.
      `INSERT INTO auctions(item_id,visibility,access_code_hash,starting_price,current_price,minimum_increment,start_time,end_time,access_code_lookup)
  -- نختار الإعلان المعتمد الذي يخص المستخدم الحالي. رموز الارقام تاخذ قيمتها من القائمه الموجودهد تحت الاستعلام
SELECT id, $2, $3, $4, $4, $5, $6, $7, $9
FROM items
WHERE id = $1
-- يشترط ان يكون صاحب الاعلان هو المستخدم اللي ارسل الطلب
  AND seller_id = $8
  -- يشترط ان يكون الاعلان معتمد
  AND status = 'APPROVED'
  -- إذا لم يوجد إعلان يحقق الشروط الثلاثة، فلن يُضاف مزاد.
  -- بعد اضافه المزاد بنجاح يرجع البيانات الخاصه بالاعلان للباك اند
   RETURNING id,item_id,visibility,starting_price,current_price,minimum_increment,start_time,end_time,status`,
      // هذه القيم نرسلها للاستعلام، وكل قيمة تقابل رقمًا مثل $1 أو $2.
      // نرسل قيم الاستعلام بالترتيب؛ الأولى لـ $1 والثانية لـ $2، وهكذا.
      [
        // داخل SQL نستخدم رموزًا مثل $1 و$2 لتحديد أين تُستخدم هذه القيم.
        // $1: معرّف الإعلان الذي ننشئ له المزاد.
        itemId,
        // $2: نوع المزاد، عام أو خاص.
        visibility,
        // $3: بصمة رمز الدخول، أو null إذا كان المزاد عامًا.
        codeHash,
        // $4: سعر البداية، ونستخدمه أيضًا كسعر حالي عند الإنشاء.
        startingPrice,
        // $5: أقل زيادة مسموحة للمزايدة.
        minimumIncrement,
        // $6: موعد بداية المزاد.
        startTime,
        // $7: موعد نهاية المزاد.
        endTime,
        // $8: معرّف المستخدم الحالي الذي تحققت منه دالة auth.
        req.user.id,
        // نرسل بصمة البحث عشان تنحفظ مع المزاد.
        codeLookup,
      ],
    );
    // اذا ما اضاف الاستعلام اي مزاد نرفض الطلب
    // r.rowCount: عدد المزادات التي أضافها الاستعلام.
    // كان 0، يعني ما وجد إعلانًا يطابق الشروط، فلم يُنشأ مزاد إذا
    if (!r.rowCount)
      // يرفض الطلب لعدم وجود اعلان معتمد يخص المستخدم الحالي
      return err(
        res,
        // ٤٠٠ الطلب غير مسموح يعني
        403,
        "NOT_APPROVED",
        // يمكن إنشاء مزاد فقط لإعلان معتمد يملكه المستخدم
        "Only approved owned items can be auctioned",
      );
    //رد  نجاح انشاء مزاد جديد
    // نأخذ بيانات المزاد الذي أُضيف من أول صف في نتيجة الاستعلام.
    // ٠ يعني اول صف وهو بيانات المزاد الجديد
    const createdAuction = r.rows[0];
    // إذا كان المزاد خاصًا، نضيف رمز الدخول إلى بيانات الرد.
    // هذه إضافة لبيانات الرد فقط قاعدة البيانات تحفظ البصمة.
    if (visibility === "PRIVATE") {
      createdAuction.accessCode = accessCode;
    }
    // نرسل بيانات المزاد، والرمز 201 يعني نجاح إنشاء سجل جديد.
    res.status(201).json({ data: createdAuction });
    // التعامل مع الخطا اثناء انشاء المزاد
    // إذا حصل خطأ أثناء محاولة إنشاء المزاد، نستقبل الخطأ هنا
  } catch (e) {
    //نفحص هل رمز الخطأ من قاعدة البيانات هو منع التكرار
    if (e.code === "23505")
      // نرسل 409 لأن الإعلان لديه مزاد بالفعل، وننهي الطلب
      // ٤٠٩ هنا يوجد تعارض وتجي اذا كان الخطا بسبب التكرار
      return err(res, 409, "DUPLICATE_AUCTION", "Item already has auction");
    // اذا كان الخطا من نوع اخر نمرره لمعالج الاخطا بالباك هو يتعامل معاه
    next(e);
  }
});
api.post("/auctions", auth, async (req, res, next) => {
  try {
    const {
      itemId,
      visibility,
      startingPrice,
      minimumIncrement,
      startTime,
      endTime,
    } = req.body || {};
    if (
      !validUuid(itemId) ||
      !["PUBLIC", "PRIVATE"].includes(visibility) ||
      !validMoney(startingPrice) ||
      !validMoney(minimumIncrement) ||
      typeof startTime !== "string" ||
      typeof endTime !== "string" ||
      !startTime ||
      !endTime ||
      !Number.isFinite(Date.parse(startTime)) ||
      !Number.isFinite(Date.parse(endTime)) ||
      new Date(endTime) <= new Date(startTime)
    )
      return err(res, 400, "INVALID_INPUT", "Invalid auction parameters");
    // نحفظ بصمة كود الدخول، وما ننشئ المزاد إلا من إعلان معتمد.
    //رمز الدخول للمزاد الخاص لو انطبق عليه انو خاص نسوي الرمز المشفر له
    // نبدأ بدون رمز دخول، لأن المزاد قد يكون عام.
    // استخدمنا let لان قيمه المتغير ستتغير من null الى رمز اذا كان المزاذ خاص
    // accessCode: نحفظ فيه رمز الدخول الأصلي الذي يحصل عليه صاحب المزاد الخاص
    let accessCode = null;
    // نبدأ بدون بصمة للرمز.
    // codeHash: نحفظ فيه بصمة الرمز الناتجة من bcrypt، وهي التي سنخزنها في قاعدة البيانات بدل الرمز الأصلي
    let codeHash = null;
    // نبدأ بدون بصمة بحث، لأن المزاد العام ما يحتاج رمز دخول.
    let codeLookup = null;
    // إذا كان المزاد خاصًا، ننشئ له رمز دخول وبصمة.
    if (visibility === "PRIVATE") {
      // نولد بيانات عشوائية بحجم 12 بايت.
      // randomBytes دالة جاهزة من Node.js
      const randomValue = randomBytes(12);
      // نحول البيانات العشوائية إلى نص يمثل رمز الدخول.
      //مكتوب ١٢ بايت لان كل بايت يظهر فيه حرفين بحسب hex التوتال ٢٤ حرف الرمز الخاص بدخول المزاد
      accessCode = randomValue.toString("hex");
      // نحسب بصمة الرمز باستخدام bcrypt لحفظها في قاعدة البيانات.
      //بنفس الوقت ١٢ هنا لا يعني طول الرمز أو عدد البايتات
      // BE-11 | Test 11: حساب بصمة رمز الدخول باستخدام bcrypt.
      codeHash = await bcrypt.hash(accessCode, 12);
      // نحسب بصمة ثابتة عشان نقدر نلقى المزاد بنفس الرمز وقت الدخول.
      codeLookup = hashToken("auction:" + accessCode);
    }
    // نرسل استعلام إنشاء المزاد، وننتظر نتيجته ونحفظها في r.
    const r = await query(
      // نحدد جدول المزادات والأعمدة التي سنضيف فيها بيانات المزاد.
      `INSERT INTO auctions(item_id,visibility,access_code_hash,starting_price,current_price,minimum_increment,start_time,end_time,access_code_lookup)
  -- نختار الإعلان المعتمد الذي يخص المستخدم الحالي. رموز الارقام تاخذ قيمتها من القائمه الموجودهد تحت الاستعلام
SELECT id, $2, $3, $4, $4, $5, $6, $7, $9
FROM items
WHERE id = $1
-- يشترط ان يكون صاحب الاعلان هو المستخدم اللي ارسل الطلب
  AND seller_id = $8
  -- يشترط ان يكون الاعلان معتمد
  AND status = 'APPROVED'
  -- إذا لم يوجد إعلان يحقق الشروط الثلاثة، فلن يُضاف مزاد.
  -- بعد اضافه المزاد بنجاح يرجع البيانات الخاصه بالاعلان للباك اند
   RETURNING id,item_id,visibility,starting_price,current_price,minimum_increment,start_time,end_time,status`,
      // هذه القيم نرسلها للاستعلام، وكل قيمة تقابل رقمًا مثل $1 أو $2.
      // نرسل قيم الاستعلام بالترتيب؛ الأولى لـ $1 والثانية لـ $2، وهكذا.
      [
        // داخل SQL نستخدم رموزًا مثل $1 و$2 لتحديد أين تُستخدم هذه القيم.
        // $1: معرّف الإعلان الذي ننشئ له المزاد.
        itemId,
        // $2: نوع المزاد، عام أو خاص.
        visibility,
        // $3: بصمة رمز الدخول، أو null إذا كان المزاد عامًا.
        // BE-11 | Test 11: تمرير البصمة إلى الاستعلام لحفظها في قاعدة البيانات.
        codeHash,
        // $4: سعر البداية، ونستخدمه أيضًا كسعر حالي عند الإنشاء.
        startingPrice,
        // $5: أقل زيادة مسموحة للمزايدة.
        minimumIncrement,
        // $6: موعد بداية المزاد.
        startTime,
        // $7: موعد نهاية المزاد.
        endTime,
        // $8: معرّف المستخدم الحالي الذي تحققت منه دالة auth.
        req.user.id,
        // نرسل بصمة البحث عشان تنحفظ مع المزاد.
        codeLookup,
      ],
    );
    if (!r.rowCount)
      return err(
        res,
        403,
        "NOT_APPROVED",
        "Only approved owned items can be auctioned",
      );
    res
      .status(201)
      .json({ data: { ...r.rows[0], ...(accessCode ? { accessCode } : {}) } });
  } catch (e) {
    if (e.code === "22007" || e.code === "22008") {
      return err(res, 400, "INVALID_INPUT", "Invalid auction dates");
    }

    if (e.code === "23505")
      return err(res, 409, "DUPLICATE_AUCTION", "Item already has auction");

    next(e);
  }
});
//عرض قائمة المزادات العامة مع بياناتها وصورها وحالتها.
app.get("/auctions", async (_req, res, next) => {
  // ننفذ التعليمات التالية، وإذا حدث خطأ ننتقل إلى catch.
  try {
    // نرسل استعلام قراءة المزادات إلى قاعدة البيانات ونحفظ نتيجته في r.
    const r = await query(
      // نجلب بيانات المزادات العامة وعنوان إعلان كل مزاد، ونرتبها حسب موعد البداية تنازليًا.
      "SELECT a.id,a.item_id,a.starting_price,a.current_price,a.start_time,a.end_time,a.status,i.title FROM auctions a JOIN items i ON i.id=a.item_id WHERE a.visibility='PUBLIC' ORDER BY a.start_time DESC",
      //نهايه داله الاستدعاء
    );
    // نقرأ الوقت الحالي من قاعدة البيانات مرة واحدة لهذا الطلب.
    const timeResult = await query("SELECT clock_timestamp() AS current_time");
    // نحول الوقت إلى رقم حتى نقارنه بمواعيد المزادات.
    const currentTime = new Date(timeResult.rows[0].current_time).getTime();
    // نمر على كل مزاد رجع من استعلام القائمة.
    for (const auctionData of r.rows) {
      // نحدد حالة المزاد التي سترجع في القائمة باستخدام وقت قاعدة البيانات.
      auctionData.status = getAuctionDisplayStatus(auctionData, currentTime);
      // نجلب صور الإعلان المرتبط بالمزاد الحالي.
      //نرسل استعلامًا لقاعدة البيانات، وننتظر نتيجته، ثم نحفظها في imagesResult.
      const imagesResult = await query(
        // نقرأ معرف الصورة ورابطها.
        "SELECT id, image_url FROM item_images WHERE item_id=$1 ORDER BY id",
        // نرسل معرف الإعلان ليستخدمه الاستعلام مكان $1.
        //استخدمنا item_id لأن الصور مرتبطة بالإعلان.
        [auctionData.item_id],
        //نهايه الاستدعاء
      );

      // نضيف الصور إلى بيانات المزاد.
      //خذ الصور التي وجدناها، وضعها داخل بيانات هذا المزاد في الرد.
      auctionData.images = imagesResult.rows;
    }
    // نرسل قائمة المزادات في الرد، وإذا لم توجد نتائج نرسل قائمة فارغة.
    res.json({ data: r.rows });
    // استقبال الخطا في المتغير e اذا حدث خلل داخل تراي
  } catch (e) {
    // نمرر الخطأ إلى معالج الأخطاء في Express.
    next(e);
  }
  //// ننهي دالة معالجة الطلب واستدعاء app.get
});
// // عرض تفاصيل مزاد واحد حسب معرّفه، مع بيانات الإعلان والصور والحالة.ة.
app.get("/auctions/:id", async (req, res, next) => {
  // ننفذ التعليمات التالية، وإذا حدث خطأ ننتقل إلى catch.
  try {
    //
    if (!validUuid(req.params.id))
      return err(res, 400, "INVALID_ID", "Invalid ID");
    const a = await auction(req.params.id);
    if (!a) return err(res, 404, "NOT_FOUND", "Auction not found");
    const token = req.headers.authorization?.match(/^Bearer (\S+)$/)?.[1];
    let user = null;
    if (token) {
      const r = await query(
        "SELECT u.id FROM user_sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now()",
        [hashToken(token)],
      );
      user = r.rows[0];
    }
    if (!(await accessible(a, user)))
      return err(res, 404, "NOT_FOUND", "Auction not found");
    // نقرأ وقت قاعدة البيانات قبل فحص إغلاق المزاد.
    const timeResult = await query("SELECT clock_timestamp() AS current_time");

    // نحول الوقت إلى رقم لاستخدامه في تحديد الحالة.
    const currentTime = new Date(timeResult.rows[0].current_time).getTime();
    await closeIfEnded(a.id);
    const current = await auction(a.id);
    // نحدد حالة المزاد التي سترجع في تفاصيله.
    current.status = getAuctionDisplayStatus(current, currentTime);
    delete current.access_code_hash;
    // نخفي بصمة البحث من تفاصيل المزاد اللي نرسلها للواجهة.
    delete current.access_code_lookup;
    // إضافة صور الإعلان إلى تفاصيل مزاد واحد
    // نقرأ روابط صور الإعلان من قاعدة البيانات ونضيفها إلى بيانات تفاصيل المزاد المرسلة للواجهة
    const imagesResult = await query(
      // نقرأ معرّف كل صورة ورابطها من جدول الصور.
      "SELECT id, image_url FROM item_images WHERE item_id=$1 ORDER BY id",
      // نرسل معرّف الإعلان ليستخدمه الاستعلام مكان $1.
      [current.item_id],
    );
    // نضيف قائمة الصور إلى بيانات المزاد التي سترجع للواجهة.
    current.images = imagesResult.rows;
    const result = await query(
      "SELECT winner_bid_id,closed_at FROM auction_results WHERE auction_id=$1",
      [a.id],
    );
    res.json({ data: { ...current, result: result.rows[0] || null } });
  } catch (e) {
    next(e);
  }
});
// الحالة تنحسب بوقت قاعدة البيانات حتى لو ما أحد زايد أو فتح الصفحة.
api.get(
  "/auctions",
  (req, res, next) =>
    req.query.scope === "all" ? auth(req, res, next) : next(),
  async (req, res, next) => {
    try {
      if (req.query.scope === "all" && req.user.role !== "ADMIN")
        return err(res, 403, "FORBIDDEN", "Admin only");
      const { categoryId, status } = req.query;
      if (
        (categoryId !== undefined && !validUuid(categoryId)) ||
        (status !== undefined &&
          !["SCHEDULED", "ACTIVE", "CLOSED"].includes(status))
      )
        return err(res, 400, "INVALID_INPUT", "Invalid auction filters");
      const r = await query(
        `SELECT a.id,a.item_id,a.visibility,a.starting_price,a.current_price,a.minimum_increment,a.start_time,a.end_time,${auctionStatus} AS status,
   i.title,c.name AS category_name,
   (SELECT image_url FROM item_images WHERE item_id=i.id ORDER BY id LIMIT 1) AS image_url,
   (SELECT count(*)::int FROM bids WHERE auction_id=a.id) AS bid_count
   FROM auctions a JOIN items i ON i.id=a.item_id JOIN categories c ON c.id=i.category_id
   WHERE (a.visibility='PUBLIC' OR $1::boolean) AND ($2::uuid IS NULL OR i.category_id=$2)
   AND ($3::text IS NULL OR (${auctionStatus})=$3) ORDER BY a.start_time DESC,a.id`,
        [req.query.scope === "all", categoryId || null, status || null],
      );
      res.json({
        data: r.rows.map((a) => ({ ...a, image_url: imageLink(a.image_url) })),
      });
    } catch (e) {
      next(e);
    }
  },
);
api.get("/auctions/:id", async (req, res, next) => {
  try {
    if (!validUuid(req.params.id))
      return err(res, 400, "INVALID_ID", "Invalid ID");
    const a = await auction(req.params.id);
    if (!a) return err(res, 404, "NOT_FOUND", "Auction not found");
    const token = req.headers.authorization?.match(/^Bearer (\S+)$/)?.[1];
    let user = null;
    if (token) {
      const r = await query(
        "SELECT u.id,u.role FROM user_sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now()",
        [hashToken(token)],
      );
      user = r.rows[0];
    }
    if (!(await accessible(a, user)))
      return err(res, 404, "NOT_FOUND", "Auction not found");
    await closeIfEnded(a.id);
    const current = await auction(a.id);
    // بصمة كود الدخول ما تطلع في الرد.
    delete current.access_code_hash;
    // نخفي بصمة البحث من تفاصيل المزاد اللي نرسلها للواجهة.
    delete current.access_code_lookup;
    const result = await resultFor(a.id, user?.id);
    const participation = await participationFor(a.id, user?.id);
    const item = await query(
      "SELECT i.description,i.category_fields,c.name AS category_name FROM items i JOIN categories c ON c.id=i.category_id WHERE i.id=$1",
      [current.item_id],
    );
    const images = await query(
      "SELECT image_url FROM item_images WHERE item_id=$1 ORDER BY id",
      [current.item_id],
    );
    res.json({
      data: {
        ...current,
        ...item.rows[0],
        images: images.rows.map((image) => imageLink(image.image_url)),
        result,
        participation,
      },
    });
  } catch (e) {
    next(e);
  }
});
app.post("/auctions/:id/commitment", auth, async (req, res, next) => {
  try {
    const a = await auction(req.params.id);
    if (!a || !(await accessible(a, req.user)))
      return err(res, 404, "NOT_FOUND", "Auction not found");
    if (a.seller_id === req.user.id)
      return err(res, 403, "OWNER", "Cannot commit to own auction");
    return err(
      res,
      503,
      "BANK_SANDBOX_UNAVAILABLE",
      "Official sandbox provider and operation have not been verified; no commitment approved",
    );
  } catch (e) {
    next(e);
  }
});
api.post(
  // المشارك يدخل برمز المزاد فقط.
  "/auctions/access",
  auth,
  attemptLimit({
    // نحسب محاولات إدخال الرمز لكل مشارك حسب حسابه.
    key: (req) => req.user.id,
  }),
  async (req, res, next) => {
    try {
      // نحفظ هنا معرّف المزاد بعد ما نلقاه برمز الدخول.
      let auctionId;
        // نأخذ رمز الدخول من بيانات الطلب.
        const accessCode = req.body?.accessCode;

        // نرفض الرمز إذا ما كان نص أو كان طوله غير 24 حرف.
        if (typeof accessCode !== "string" || accessCode.length !== 24) {
          return err(res, 403, "INVALID_CODE", "Invalid access code");
        }

        // نحسب بصمة الرمز بنفس الطريقة اللي استخدمناها وقت إنشاء المزاد.
        const codeLookup = hashToken("auction:" + accessCode);

        // نطلب من قاعدة البيانات معرّف المزاد الخاص اللي بصمته تطابق بصمة الرمز.
        const result = await query(
          "SELECT id FROM auctions WHERE visibility = 'PRIVATE' AND access_code_lookup = $1",
          // $1 يأخذ قيمة البصمة اللي حسبناها.
          [codeLookup],
        );

        // إذا ما لقينا مزاد بنفس البصمة، نرفض الدخول.
        if (result.rows.length === 0) {
          return err(res, 403, "INVALID_CODE", "Invalid access code");
        }

        // نأخذ معرّف المزاد من الصف اللي رجع لنا.
        auctionId = result.rows[0].id;
      

      // نجيب بيانات المزاد بمعرّفه عشان نكمل التحقق قبل ما نسمح بالدخول.
      const a = await auction(auctionId);
      if (!a || a.visibility !== "PRIVATE")
        return err(res, 404, "NOT_FOUND", "Private auction not found");
      if (a.seller_id === req.user.id)
        return err(res, 403, "OWNER", "Owner cannot join as bidder");
      if (
        typeof req.body?.accessCode !== "string" ||
        !(await bcrypt.compare(req.body.accessCode, a.access_code_hash))
      )
        return err(res, 403, "INVALID_CODE", "Invalid access code");
      await query(
        "INSERT INTO private_auction_access(auction_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING",
        [a.id, req.user.id],
      );
      // بعد التحقق من الرمز، نرجّع معرّف المزاد عشان الواجهة تفتح تفاصيله للمشارك.
      res.json({ data: { accessGranted: true, auctionId: a.id } });
    } catch (e) {
      next(e);
    }
  },
);
api.post("/auctions/:id/commitment", auth, async (req, res, next) => {
  try {
    const a = await auction(req.params.id);
    if (!a || !(await accessible(a, req.user)))
      return err(res, 404, "NOT_FOUND", "Auction not found");
    if (a.seller_id === req.user.id)
      return err(res, 403, "OWNER", "Cannot commit to own auction");
    if (a.status === "CLOSED" || new Date(a.end_time) <= new Date())
      return err(res, 409, "AUCTION_NOT_ACTIVE", "Auction ended");
    await startCommitment({ auctionId: a.id, userId: req.user.id });
  } catch (e) {
    next(e);
  }
});
app.get("/auctions/:id/commitment", auth, async (req, res, next) => {
  try {
    const r = await query(
      "SELECT id,status,sandbox_reference,created_at FROM bid_commitments WHERE auction_id=$1 AND user_id=$2",
      [req.params.id, req.user.id],
    );
    if (!r.rowCount) return err(res, 404, "NOT_FOUND", "No commitment");
    res.json({ data: r.rows[0] });
  } catch (e) {
    next(e);
  }
});
api.get("/auctions/:id/commitment", auth, async (req, res, next) => {
  try {
    const a = await auction(req.params.id);
    if (!a || !(await accessible(a, req.user)))
      return err(res, 404, "NOT_FOUND", "Auction not found");
    const r = await query(
      "SELECT id,status,sandbox_reference,created_at FROM bid_commitments WHERE auction_id=$1 AND user_id=$2",
      [req.params.id, req.user.id],
    );
    if (!r.rowCount) return err(res, 404, "NOT_FOUND", "No commitment");
    res.json({ data: r.rows[0] });
  } catch (e) {
    next(e);
  }
});
app.post("/auctions/:id/bids", auth, async (req, res, next) => {
  const { amount, requestId } = req.body || {};
  if (!validMoney(amount) || !validUuid(requestId) || !validUuid(req.params.id))
    return err(
      res,
      400,
      "INVALID_INPUT",
      "Valid amount and UUID requestId required",
    );
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const ar = await c.query(
      "SELECT a.*,i.seller_id FROM auctions a JOIN items i ON i.id=a.item_id WHERE a.id=$1 FOR UPDATE OF a",
      [req.params.id],
    );
    if (!ar.rowCount) {
      await c.query("ROLLBACK");
      return err(res, 404, "NOT_FOUND", "Auction not found");
    }
    const a = ar.rows[0];
    if (a.seller_id === req.user.id) {
      await c.query("ROLLBACK");
      return err(res, 403, "OWNER", "Cannot bid on own auction");
    }
    if (a.visibility === "PRIVATE") {
      const access = await c.query(
        "SELECT 1 FROM private_auction_access WHERE auction_id=$1 AND user_id=$2",
        [a.id, req.user.id],
      );
      if (!access.rowCount) {
        await c.query("ROLLBACK");
        return err(res, 403, "NO_ACCESS", "Private access required");
      }
    }
    const prior = await c.query(
      "SELECT id,amount FROM bids WHERE request_id=$1",
      [requestId],
    );
    if (prior.rowCount) {
      await c.query("ROLLBACK");
      return err(
        res,
        409,
        "DUPLICATE_REQUEST",
        "Bid request already processed",
      );
    }
    // BE-14 | نفحص الالتزام البنكي فقط إذا فعّلنا الإعداد.
    // حاليًا الفحص اختياري عشان نكمل تجربة المزايدة واختبارات BE-04.
    if (process.env.REQUIRE_BANK_COMMITMENT === "true") {
      const commitment = await c.query(
        "SELECT 1 FROM bid_commitments WHERE auction_id=$1 AND user_id=$2 AND status='SUCCESS'",
        [a.id, req.user.id],
      );
      if (!commitment.rowCount) {
        await c.query("ROLLBACK");
        return err(
          res,
          403,
          "COMMITMENT_REQUIRED",
          "Verified commitment required",
        );
      }
    }
    const clock = await c.query("SELECT clock_timestamp() AS current_time");
    const now = clock.rows[0].current_time;
    if (
      now < new Date(a.start_time) ||
      now >= new Date(a.end_time) ||
      a.status === "CLOSED"
    ) {
      await c.query("ROLLBACK");
      return err(res, 409, "AUCTION_NOT_ACTIVE", "Auction not active");
    }
    const count = await c.query(
      "SELECT 1 FROM bids WHERE auction_id=$1 LIMIT 1",
      [a.id],
    );
    const minimumCents = count.rowCount
      ? toCents(a.current_price) + toCents(a.minimum_increment)
      : toCents(a.starting_price);
    if (toCents(amount) < minimumCents) {
      await c.query("ROLLBACK");
      return err(res, 409, "BID_TOO_LOW", "Bid below minimum");
    }
    const bid = await c.query(
      "INSERT INTO bids(auction_id,bidder_id,amount,request_id) VALUES($1,$2,$3,$4) RETURNING id,amount",
      [a.id, req.user.id, amount, requestId],
    );
    await c.query(
      "UPDATE auctions SET current_price=$1,status='ACTIVE' WHERE id=$2",
      [amount, a.id],
    );
    await c.query("COMMIT");
    res
      .status(201)
      .json({ data: { bidId: bid.rows[0].id, amount, currentPrice: amount } });
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {});
    if (e.code === "23505")
      return err(
        res,
        409,
        "DUPLICATE_REQUEST",
        "Bid request already processed",
      );
    next(e);
  } finally {
    c.release();
  }
});
api.post("/auctions/:id/bids", auth, async (req, res, next) => {
  const { amount, requestId } = req.body || {};
  if (!validMoney(amount) || !validUuid(requestId) || !validUuid(req.params.id))
    return err(
      res,
      400,
      "INVALID_INPUT",
      "Valid amount and UUID requestId required",
    );
  // نقفل نفس صف المزاد عشان المزايدات والإغلاق ما يتعارضون.
  let c;
  try {
    c = await pool.connect();
    await c.query("BEGIN");
    const ar = await c.query(
      "SELECT a.*,i.seller_id FROM auctions a JOIN items i ON i.id=a.item_id WHERE a.id=$1 FOR UPDATE OF a",
      [req.params.id],
    );
    if (!ar.rowCount) {
      await c.query("ROLLBACK");
      return err(res, 404, "NOT_FOUND", "Auction not found");
    }
    const a = ar.rows[0];
    if (a.seller_id === req.user.id) {
      await c.query("ROLLBACK");
      return err(res, 403, "OWNER", "Cannot bid on own auction");
    }
    if (a.visibility === "PRIVATE") {
      const access = await c.query(
        "SELECT 1 FROM private_auction_access WHERE auction_id=$1 AND user_id=$2",
        [a.id, req.user.id],
      );
      if (!access.rowCount) {
        await c.query("ROLLBACK");
        return err(res, 404, "NOT_FOUND", "Auction not found");
      }
    }
    // نفس رقم الطلب ما ينقبل أكثر من مرة.
    const prior = await c.query(
      "SELECT id,amount FROM bids WHERE request_id=$1",
      [requestId],
    );
    if (prior.rowCount) {
      await c.query("ROLLBACK");
      return err(
        res,
        409,
        "DUPLICATE_REQUEST",
        "Bid request already processed",
      );
    }
        // BE-14 | نفحص الالتزام البنكي فقط إذا فعّلنا الإعداد.
    if (process.env.REQUIRE_BANK_COMMITMENT === "true") {
      const commitment = await c.query(
        "SELECT 1 FROM bid_commitments WHERE auction_id=$1 AND user_id=$2 AND status='SUCCESS'",
        [a.id, req.user.id],
      );
      if (!commitment.rowCount) {
        await c.query("ROLLBACK");
        return err(
          res,
          403,
          "COMMITMENT_REQUIRED",
          "Verified commitment required",
        );
      }
    }
    // نتحقق من الوقت بعد القفل عشان نرفض الطلب اللي تأخر وهو ينتظر.
    const clock = await c.query("SELECT clock_timestamp() AS current_time");
    const now = clock.rows[0].current_time;
    if (
      now < new Date(a.start_time) ||
      now >= new Date(a.end_time) ||
      a.status === "CLOSED"
    ) {
      await c.query("ROLLBACK");
      return err(res, 409, "AUCTION_NOT_ACTIVE", "Auction not active");
    }
    const count = await c.query(
      "SELECT 1 FROM bids WHERE auction_id=$1 LIMIT 1",
      [a.id],
    );
    // أول عرض يبدأ من سعر البداية، وبعده نحسب أقل زيادة بالهللات.
    const minimumCents = count.rowCount
      ? toCents(a.current_price) + toCents(a.minimum_increment)
      : toCents(a.starting_price);
    if (toCents(amount) < minimumCents) {
      await c.query("ROLLBACK");
      return err(res, 409, "BID_TOO_LOW", "Bid below minimum");
    }
    // نحفظ العرض ونحدّث السعر داخل نفس المعاملة.
    const bid = await c.query(
      "INSERT INTO bids(auction_id,bidder_id,amount,request_id) VALUES($1,$2,$3,$4) RETURNING id,amount",
      [a.id, req.user.id, amount, requestId],
    );
    await c.query(
      "UPDATE auctions SET current_price=$1,status='ACTIVE' WHERE id=$2",
      [amount, a.id],
    );
    await c.query("COMMIT");
    res
      .status(201)
      .json({ data: { bidId: bid.rows[0].id, amount, currentPrice: amount } });
  } catch (e) {
    // إذا فشلت أي خطوة نرجع السعر والعرض مثل ما كانوا.
    if (c) await c.query("ROLLBACK").catch(() => {});
    if (e.code === "23505")
      return err(
        res,
        409,
        "DUPLICATE_REQUEST",
        "Bid request already processed",
      );
    next(e);
  } finally {
    c?.release();
  }
});
app.get("/auctions/:id/bids", auth, async (req, res, next) => {
  try {
    const a = await auction(req.params.id);
    if (!a || !(await accessible(a, req.user)))
      return err(res, 404, "NOT_FOUND", "Auction not found");
    const r = await query(
      "SELECT id,amount,created_at FROM bids WHERE auction_id=$1 ORDER BY created_at DESC LIMIT 100",
      [a.id],
    );
    res.json({ data: r.rows });
  } catch (e) {
    next(e);
  }
});
api.get("/auctions/:id/bids", auth, async (req, res, next) => {
  try {
    const a = await auction(req.params.id);
    if (!a || !(await accessible(a, req.user)))
      return err(res, 404, "NOT_FOUND", "Auction not found");
    const limit = Number(req.query.limit ?? 100),
      offset = Number(req.query.offset ?? 0);
    if (
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 100 ||
      !Number.isSafeInteger(offset) ||
      offset < 0
    )
      return err(res, 400, "INVALID_INPUT", "Invalid paging");
    const r = await query(
      "SELECT id,amount,created_at FROM bids WHERE auction_id=$1 ORDER BY created_at DESC,id LIMIT $2 OFFSET $3",
      [a.id, limit, offset],
    );
    res.json({ data: r.rows });
  } catch (e) {
    next(e);
  }
});
app.get("/me/items", auth, async (req, res, next) => {
  try {
    res.json({
      data: (
        await query("SELECT * FROM items WHERE seller_id=$1 ORDER BY id", [
          req.user.id,
        ])
      ).rows,
    });
  } catch (e) {
    next(e);
  }
});
app.get("/me/auctions", auth, async (req, res, next) => {
  try {
    res.json({
      data: (
        await query(
          "SELECT DISTINCT a.id,a.status,a.end_time,i.title FROM auctions a JOIN items i ON i.id=a.item_id LEFT JOIN bids b ON b.auction_id=a.id WHERE i.seller_id=$1 OR b.bidder_id=$1",
          [req.user.id],
        )
      ).rows,
    });
  } catch (e) {
    next(e);
  }
});
api.get("/me/items", auth, async (req, res, next) => {
  try {
    res.json({
      data: await withListingImages(
        (
          await query("SELECT * FROM items WHERE seller_id=$1 ORDER BY id", [
            req.user.id,
          ])
        ).rows,
      ),
    });
  } catch (e) {
    next(e);
  }
});
api.get("/me/auctions", auth, async (req, res, next) => {
  try {
    res.json({
      data: (
        await query(
          `SELECT DISTINCT a.id,${auctionStatus} AS status,a.end_time,i.title FROM auctions a JOIN items i ON i.id=a.item_id LEFT JOIN bids b ON b.auction_id=a.id WHERE i.seller_id=$1 OR b.bidder_id=$1`,
          [req.user.id],
        )
      ).rows,
    });
  } catch (e) {
    next(e);
  }
});
app.use((_req, res) => err(res, 404, "NOT_FOUND", "Route not found"));
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (error.apiCode)
    return err(res, error.status || 400, error.apiCode, error.message);
  if (error.name === "MulterError")
    return err(
      res,
      error.code === "LIMIT_FILE_SIZE" ? 413 : 400,
      error.code === "LIMIT_FILE_SIZE" ? "PAYLOAD_TOO_LARGE" : "INVALID_IMAGE",
      "Up to six JPG, PNG or WebP images, 5 MiB each",
    );
  if (error.type === "entity.parse.failed")
    return err(res, 400, "INVALID_JSON", "Invalid JSON body");
  if (error.type === "entity.too.large")
    return err(res, 413, "PAYLOAD_TOO_LARGE", "Request body too large");
  // تفاصيل الخطأ تبقى بالسيرفر، ونرجع رسالة عامة للمستخدم.
  if (error.code === "22021" || error.code === "22P05") {
    return err(res, 400, "INVALID_INPUT", "Invalid characters in request");
  }
  console.error("API error", error.code || "INTERNAL_ERROR");
  err(res, 500, "INTERNAL_ERROR", "Unexpected server error");
});
