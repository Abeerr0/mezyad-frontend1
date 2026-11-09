// تم التعديل من عبير: نجمع تنسيق الاسعار والتواريخ وتسميات الحاله بملف واحد بدل تفريق الدوال الصغيره.
export const money = (value) =>
  new Intl.NumberFormat("ar-SA", {
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

export const dateText = (value) =>
  new Intl.DateTimeFormat("ar-SA", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Riyadh",
  }).format(new Date(value));

export const statusLabels = {
  ACTIVE: "جارٍ الآن",
  SCHEDULED: "قريبًا",
  CLOSED: "منتهٍ",
};
