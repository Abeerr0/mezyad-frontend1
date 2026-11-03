// نتأكد إن حقول الإعلان تنقبل وتنرفض بالشكل الصحيح.
import test from "node:test";
import assert from "node:assert/strict";
import { parseListingFields } from "../src/listings.js";

// كائن أساسي جاهز للاستخدام في الاختبارات (يحتوي على فئة وهمية، وعنوان، ووصف)
const base = {
  categoryId: "11111111-1111-1111-1111-111111111111",
  title: " إعلان ",
  description: " وصف ",
};

// اختبار: حقل categoryFields يقبل كائن JSON الصريح (canonical) وكذلك نص JSON القادم من الـ Multipart
test("categoryFields accepts the canonical JSON object and multipart JSON string", () => {
  const fields = { location: "الرياض", area: 250, features: ["حوش"] };
  for (const value of [fields, JSON.stringify(fields)])
    assert.deepEqual(
      parseListingFields({ ...base, categoryFields: value }).categoryFields,
      fields,
    );
});

// اختبار: التوافق مع الاسم القديم (legacy category_fields) ورفض الأسماء أو القيم المتعارضة
test("legacy category_fields remains compatible and conflicting aliases are rejected", () => {
  // قبول الاسم القديم بصيغة نص JSON
  assert.deepEqual(
    parseListingFields({ ...base, category_fields: '{"year":2020}' })
      .categoryFields,
    { year: 2020 },
  );
  // قبول الحالتين معاً إذا كانت القيم متطابقة تماماً بغض النظر عن ترتيب الخصائص
  assert.deepEqual(
    parseListingFields({
      ...base,
      categoryFields: { a: 1, b: 2 },
      category_fields: '{"b":2,"a":1}',
    }).categoryFields,
    { a: 1, b: 2 },
  );
  // رفض الطلب إذا وجد تعارض بين القيمتين (مثلاً سنة مختلفة هنا وهناك) وترجع null
  assert.equal(
    parseListingFields({
      ...base,
      categoryFields: { year: 2020 },
      category_fields: '{"year":2021}',
    }),
    null,
  );
});

// اختبار: حقول الفئة غير الصالحة لا تتحول أبداً إلى كائن فارغ صامتاً، بل ترفض (ترجع null)
test("invalid category fields cannot silently become an empty object", () => {
  // تجربة قيم غير صالحة (مثل null، مصفوفات، أرقام، أو نصوص JSON تالفة) والتأكد من إرجاع null
  for (const categoryFields of [null, [], 42, "broken", "null", "[]", "true"])
    assert.equal(parseListingFields({ ...base, categoryFields }), null);

  // في وضع التعديل (Editing)، السماح بغياب الفئة إذا لم يتم تعديلها
  assert.equal(
    parseListingFields({ ...base, categoryId: undefined }, true).categoryFields,
    undefined,
  );
});
