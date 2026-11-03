export const API = (import.meta.env.VITE_API_URL || "/api/v1").replace(
  /\/+$/,
  "",
);

const messages = {
  DUPLICATE_EMAIL: "هالبريد مسجل من قبل. جرّب تسجيل الدخول.",
  INVALID_CREDENTIALS: "البريد أو كلمة المرور مو صحيحة.",
  UNAUTHORIZED: "انتهت جلستك. سجل دخولك من جديد.",
  FORBIDDEN: "حسابك ما عنده صلاحية لهالطلب.",
  INVALID_INPUT: "راجع الحقول المطلوبة وحاول من جديد.",
  INVALID_IMAGE: "راجع عدد الصور ونوعها وحجمها.",
  PAYLOAD_TOO_LARGE: "حجم الصور أكبر من المسموح.",
  INVALID_CATEGORY: "التصنيف غير متاح أو ما تقدر تغيره بعد الرفض.",
  INVALID_STATE: "حالة الإعلان تغيرت. ارجع لإعلاناتك وحدّثها.",
  NOT_APPROVED: "لازم يكون الإعلان لك ومعتمد قبل إنشاء المزاد.",
  DUPLICATE_AUCTION: "هالإعلان له مزاد بالفعل. راجع نشاطك.",
  NOT_FOUND: "البيانات المطلوبة مو متاحة.",
  RATE_LIMITED: "طلبات كثيرة خلال وقت قصير. انتظر شوي وحاول.",
};

// تم التعديل من عبير: نوحد اتصال API ونفرق بين رفض الطلب وعدم معرفه اذا انحفظ.
export async function request(
  path,
  { token, method = "GET", body, signal } = {},
) {
  let response;
  let result;
  try {
    response = await fetch(API + path, {
      method,
      signal,
      headers: {
        ...(token ? { Authorization: "Bearer " + token } : {}),
        ...(body && !(body instanceof FormData)
          ? { "Content-Type": "application/json" }
          : {}),
      },
      body:
        body instanceof FormData
          ? body
          : body
            ? JSON.stringify(body)
            : undefined,
    });
    result = await response.json();
  } catch (cause) {
    if (cause.name === "AbortError") throw cause;
    const error = new Error(
      method === "GET"
        ? "تعذّر الاتصال. تحقق من اتصالك وحاول مرة ثانية."
        : "انقطع الاتصال وما تأكدنا من حفظ الطلب. تحقق من حسابك قبل إعادة الإرسال.",
    );
    error.uncertain = method !== "GET";
    throw error;
  }
  if (!response.ok) {
    const error = new Error(
      messages[result.error?.code] ||
        (response.status >= 500
          ? "ما اكتمل طلبك. تحقق من حالته قبل المحاولة مرة ثانية."
          : "ما اكتمل الطلب. راجع البيانات وحاول مرة ثانية."),
    );
    error.code = result.error?.code;
    error.status = response.status;
    error.uncertain = method !== "GET" && response.status >= 500;
    throw error;
  }
  if (result.data === undefined) {
    const error = new Error(
      "وصل رد غير متوقع. تحقق من حسابك قبل إعادة الإرسال.",
    );
    error.uncertain = method !== "GET";
    throw error;
  }
  return result.data;
}

// تم التعديل من عبير: نحل روابط الصور على عنوان الباك بدون تغيير الرابط الموقع.
export function imageUrl(value) {
  const path = typeof value === "string" ? value : value?.image_url;
  if (!path) return "";
  if (
    path.startsWith("blob:") ||
    path.startsWith("/images/") ||
    path.startsWith("./public/")
  )
    return path;
  try {
    const url = new URL(path, new URL(API + "/", location.href));
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

export function validEmail(value) {
  return (
    value.trim().length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
  );
}
export function validPassword(value) {
  return value.length >= 8 && new TextEncoder().encode(value).length <= 72;
}

// تم التعديل من عبير: نمنع الكسور الزايده والمبالغ اللي تتجاوز حد الداتا قبل الارسال.
export function validAmount(value) {
  return (
    /^\d+(\.\d{1,2})?$/.test(value) &&
    Number(value) > 0 &&
    Number(value) <= 999999999999.99
  );
}

export function validateImages(files, required = true) {
  if ((required && files.length === 0) || files.length > 6)
    return "اختر من صورة إلى 6 صور للإعلان.";
  if (
    files.some(
      (file) => !["image/jpeg", "image/png", "image/webp"].includes(file.type),
    )
  )
    return "الصور المسموحة JPG أو PNG أو WebP فقط.";
  if (files.some((file) => file.size > 5 * 1024 * 1024))
    return "كل صورة لازم يكون حجمها 5 MiB أو أقل.";
  return "";
}
