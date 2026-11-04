// تم التعديل من عبير: لكل تصنيف حقوله وامثلته عشان التفاصيل تكون عن نفس الاصل المختار.
export const listingFields = {
  Camels: {
    example: "ناقة وضحاء — 4 سنوات",
    fields: [
      { name: "نوع الإبل", options: ["ناقة", "جمل", "بكرة", "قعود"] },
      { name: "اللون", options: ["وضح", "مجاهيم", "شعل", "صفر", "حمر", "شقح"] },
      { name: "العمر بالسنوات", type: "number", min: 0, max: 40 },
    ],
  },
  "Luxury Handbags": {
    example: "حقيبة هيرميس بيركين — جلد أسود",
    fields: [
      { name: "العلامة التجارية" },
      { name: "الموديل" },
      { name: "الحالة", options: ["جديدة", "مستخدمة بحالة ممتازة", "مستخدمة"] },
      { name: "المقاس" },
    ],
  },
  "Rare Vehicles": {
    example: "بورش كاريرا GT — 2005",
    fields: [
      { name: "الشركة المصنعة" },
      { name: "الموديل" },
      {
        name: "سنة الصنع",
        type: "number",
        min: 1886,
        max: new Date().getFullYear() + 1,
      },
      { name: "الممشى بالكيلومتر", type: "number", min: 0, max: 9999999 },
    ],
  },
  "Real Estate": {
    example: "فيلا في حي حطين — الرياض",
    fields: [
      { name: "نوع العقار", options: ["فيلا", "شقة", "أرض", "عمارة", "مزرعة"] },
      { name: "المدينة" },
      { name: "الحي" },
      { name: "المساحة بالمتر المربع", type: "number", min: 1, max: 99999999 },
    ],
  },
  "Vehicle Plates": {
    example: "لوحة ن ج د — 1",
    fields: [
      { name: "الحروف" },
      { name: "الرقم", type: "number", min: 1, max: 9999 },
      { name: "نوع اللوحة", options: ["خصوصي", "نقل خاص", "دراجة آلية"] },
    ],
  },
};
export function categoryIssue(schema, values) {
  for (const field of schema?.fields || []) {
    const value = String(values[field.name] ?? "").trim();
    if (!value) return "أكمل حقل «" + field.name + "» للأصل المختار.";
    if (field.options && !field.options.includes(value))
      return "اختر قيمة صحيحة لحقل «" + field.name + "».";
    if (
      field.type === "number" &&
      (!/^\d+$/.test(value) ||
        Number(value) < field.min ||
        Number(value) > field.max)
    )
      return "راجع قيمة «" + field.name + "».";
  }
  return "";
}
