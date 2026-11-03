import { Router } from "express";
import { isDeepStrictEqual } from "node:util";
import { pool, query } from "./db.js";
import { auth } from "./auth.js";
import {
  uploadImages,
  saveImages,
  removeImages,
  imageLink,
} from "./uploads.js";

export const listings = Router();

// دالة للتحقق من صحة الـ UUID
const uuid = (value) =>
  typeof value === "string" &&
  /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);

// دالة موحدة لإرجاع الأخطاء بالهيكل المطلوب
const fail = (res, status, code, message) =>
  res.status(status).json({ error: { code, message } });

// دالة لجلب تفاصيل الإعلان مع صوره الفردية
export async function withImages(item, connection = { query }) {
  const images = await connection.query(
    "SELECT image_url FROM item_images WHERE item_id=$1 ORDER BY id",
    [item.id],
  );
  return {
    ...item,
    categoryFields: item.category_fields,
    images: images.rows.map((row) => imageLink(row.image_url)),
  };
}

// نجيب صور الإعلانات كلها باستعلام واحد عشان الأداء (Batch Fetch).
export async function withListingImages(items) {
  if (!items.length) return [];
  const result = await query(
    "SELECT item_id,image_url FROM item_images WHERE item_id=ANY($1::uuid[]) ORDER BY id",
    [items.map((item) => item.id)],
  );
  const images = new Map();
  for (const item of items) {
    images.set(item.id, []);
  }
  for (const row of result.rows) {
    images.get(row.item_id).push(imageLink(row.image_url));
  }
  return items.map((item) => ({
    ...item,
    categoryFields: item.category_fields,
    images: images.get(item.id),
  }));
}

// تحليل حقول الفئة والتأكد من أنها بصيغة JSON سليمة
function parseCategoryFields(value) {
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value;
}

// التحقق من صحة حقول الإعلان الواردة في الطلب (إنشاء أو تعديل)
export function parseListingFields(body, editing = false) {
  const hasCategoryFields = Object.hasOwn(body, "categoryFields");
  const hasLegacyFields = Object.hasOwn(body, "category_fields");
  let categoryFields;
  let legacyFields;

  // نقبل الاسم القديم بعد، عشان ما يتعطل نموذج الإعلان.
  if (hasCategoryFields) {
    categoryFields = parseCategoryFields(body.categoryFields);
    if (!categoryFields) return null;
  }
  if (hasLegacyFields) {
    legacyFields = parseCategoryFields(body.category_fields);
    if (!legacyFields) return null;
  }
  if (hasCategoryFields && hasLegacyFields) {
    if (!isDeepStrictEqual(categoryFields, legacyFields)) return null;
  }
  if (!hasCategoryFields) {
    categoryFields = legacyFields;
  }

  const { title, description } = body;
  const categoryId = body.categoryId ?? body.category;
  if (
    body.categoryId !== undefined &&
    body.category !== undefined &&
    body.categoryId !== body.category
  ) {
    return null;
  }

  // نتحقق من كل حقل لحاله قبل ما نحفظ الإعلان.
  if (typeof title !== "string" || !title.trim()) return null;
  const trimmedTitle = title.trim();
  if (Array.from(trimmedTitle).length > 240) return null;

  if (typeof description !== "string" || !description.trim()) return null;
  if (description.length > 20000) return null;

  if (!editing && !uuid(categoryId)) return null;
  if (categoryId !== undefined && !uuid(categoryId)) return null;

  return {
    title: trimmedTitle,
    description: description.trim(),
    categoryId,
    categoryFields,
  };
}

// دالة مشتركة لكتابة وحفظ الإعلان (سواء إنشاء جديد POST أو تعديل PATCH)
async function writeListing(req, res, next) {
  const editing = req.method === "PATCH";
  const input = parseListingFields(req.body || {}, editing);
  if (!input)
    return fail(res, 400, "INVALID_INPUT", "Valid listing fields required");
  if (!editing && req.is("multipart/form-data") && !req.files?.length)
    return fail(res, 400, "INVALID_IMAGE", "At least one image required");

  let client;
  let saved = [];
  let oldImages = [];
  let committed = false;

  try {
    client = await pool.connect();
    await client.query("BEGIN");
    let item;

    if (editing) {
      // قفل السجل مؤقتاً للتعديل الآمن
      const result = await client.query(
        "SELECT * FROM items WHERE id=$1 FOR UPDATE",
        [req.params.id],
      );
      item = result.rows[0];
      if (!item) {
        await client.query("ROLLBACK");
        return fail(res, 404, "NOT_FOUND", "Item not found");
      }

      // هنا نتأكد إن الإعلان يخص المستخدم.
      if (item.seller_id !== req.user.id) {
        await client.query("ROLLBACK");
        return fail(res, 403, "FORBIDDEN", "Not your item");
      }

      // نسمح بإعادة الإرسال إذا كان الإعلان مرفوض فقط.
      if (item.status !== "REJECTED") {
        await client.query("ROLLBACK");
        return fail(
          res,
          409,
          "INVALID_STATE",
          "Only rejected items can be resubmitted",
        );
      }

      if (
        input.categoryId !== undefined &&
        input.categoryId !== item.category_id
      ) {
        await client.query("ROLLBACK");
        return fail(
          res,
          400,
          "INVALID_CATEGORY",
          "Category cannot change on resubmission",
        );
      }

      // تحديث بيانات الإعلان وإرجاع حالته لمراجعة جديدة
      const updatedItem = await client.query(
        `UPDATE items SET title=$1,description=$2,category_fields=$3,status='PENDING_REVIEW',
        review_reason=NULL,reviewed_by=NULL,reviewed_at=NULL WHERE id=$4 RETURNING *`,
        [
          input.title,
          input.description,
          JSON.stringify(input.categoryFields ?? item.category_fields),
          item.id,
        ],
      );
      item = updatedItem.rows[0];
    } else {
      // إنشاء إعلان جديد في قاعدة البيانات
      const createdItem = await client.query(
        `INSERT INTO items(seller_id,category_id,title,description,category_fields)
        VALUES($1,$2,$3,$4,$5) RETURNING *`,
        [
          req.user.id,
          input.categoryId,
          input.title,
          input.description,
          JSON.stringify(input.categoryFields ?? {}),
        ],
      );
      item = createdItem.rows[0];
    }

    // إذا انرفعت صور جديدة نستبدل مراجع القديمة داخل نفس المعاملة.
    saved = await saveImages(req.files);
    if (saved.length) {
      if (editing) {
        const deletedImages = await client.query(
          "DELETE FROM item_images WHERE item_id=$1 RETURNING image_url",
          [item.id],
        );
        oldImages = deletedImages.rows.map((row) => row.image_url);
      }
      for (const path of saved)
        await client.query(
          "INSERT INTO item_images(item_id,image_url) VALUES($1,$2)",
          [item.id, path],
        );
    }

    const data = await withImages(item, client);

    // نحفظ الإعلان وصوره مع بعض، وبعدها نحذف الملفات القديمة.
    await client.query("COMMIT");
    committed = true;
    await removeImages(oldImages);
    res.status(editing ? 200 : 201).json({ data });
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    // إذا فشل الحفظ نحذف الصور الجديدة بس.
    if (!committed) await removeImages(saved);
    if (error.code === "23503")
      return fail(res, 400, "INVALID_CATEGORY", "Unknown category");
    next(error);
  } finally {
    client?.release();
  }
}

// مسار إنشاء إعلان جديد
listings.post("/items", auth, uploadImages, writeListing);

// مسار تعديل وإعادة إرسال الإعلان المرفوض
listings.patch("/items/:id", auth, uploadImages, writeListing);

// مسار استعراض قائمة الإعلانات (مع دعم فلترة الحالة للأدمن أو الإعلانات الخاصة بالمستخدم)
listings.get("/items", auth, async (req, res, next) => {
  try {
    if (
      req.query.status !== undefined &&
      !["PENDING_REVIEW", "APPROVED", "REJECTED"].includes(req.query.status)
    )
      return fail(res, 400, "INVALID_INPUT", "Invalid listing status");
    let result;
    if (req.user.role === "ADMIN" && req.query.status) {
      result = await query("SELECT * FROM items WHERE status=$1 ORDER BY id", [
        req.query.status,
      ]);
    } else {
      result = await query(
        "SELECT * FROM items WHERE seller_id=$1 ORDER BY id",
        [req.user.id],
      );
    }
    res.json({
      data: await withListingImages(result.rows),
    });
  } catch (error) {
    next(error);
  }
});

// مسار استعراض تفاصيل إعلان معين مع التحقق من الصلاحيات
listings.get("/items/:id", auth, async (req, res, next) => {
  try {
    const result = await query("SELECT * FROM items WHERE id=$1", [
      req.params.id,
    ]);
    if (!result.rowCount) return fail(res, 404, "NOT_FOUND", "Item not found");
    const item = result.rows[0];
    if (item.seller_id !== req.user.id && req.user.role !== "ADMIN")
      return fail(res, 403, "FORBIDDEN", "Not your item");
    res.json({ data: await withImages(item) });
  } catch (error) {
    next(error);
  }
});
