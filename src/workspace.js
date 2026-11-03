import { useEffect, useState } from "react";
import { request } from "./api";
import { demoCategories } from "./data";

export const previewUser = {
  id: "preview-user",
  name: "ضيف مزياد",
  email: "guest@example.invalid",
  role: "USER",
};
const startingItems = [
  {
    id: "own-approved",
    seller_id: "preview-user",
    title: "بورش كاريرا GT — 2005",
    description:
      "سيارة نادرة بتفاصيل كلاسيكية. راجع الصور والمواصفات قبل تحديد عرضك.",
    category_id: "cars",
    categoryFields: { "سنة الصنع": "2005", اللون: "فضي", الممشى: "18,000 كم" },
    images: ["/images/porsche-carrera-gt.jpg"],
    status: "APPROVED",
    created_at: "2026-11-01T10:00:00+03:00",
  },
  {
    id: "own-pending",
    seller_id: "preview-user",
    title: "فيلا في حي حطين",
    description:
      "فيلا بمساحات واسعة وتشطيب هادئ. مثال لإعلان ينتظر مراجعة المشرف قبل إنشاء المزاد.",
    category_id: "property",
    categoryFields: { المدينة: "الرياض", المساحة: "600 م²" },
    images: ["/images/hittin-villa.jpg"],
    status: "PENDING_REVIEW",
    created_at: "2026-11-02T09:00:00+03:00",
  },
  {
    id: "own-rejected",
    seller_id: "preview-user",
    title: "لوحة مميزة — ن ج د 1",
    description: "لوحة مميزة برقم منفرد وحروف تلفت النظر.",
    category_id: "plates",
    categoryFields: { الحروف: "ن ج د", الرقم: "1" },
    images: ["/images/plate-njd1.jpg"],
    status: "REJECTED",
    review_reason:
      "أضف وصف أوضح لحالة اللوحة ومعلومات نقل الملكية، ثم أعد إرسال الإعلان.",
    created_at: "2026-10-31T15:00:00+03:00",
  },
];

// تم التعديل من عبير: نفصل حساب المعاينه وبياناته عن حساب API عشان ما تختلط البيانات.
export function useWorkspace(demo) {
  const [session, setSession] = useState(null);
  const [demoUser, setDemoUser] = useState(previewUser);
  const [previewItems, setPreviewItems] = useState(startingItems);
  const [previewAuctions, setPreviewAuctions] = useState([]);
  const [items, setItems] = useState([]);
  const [auctions, setAuctions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    setSession(null);
    setNotice("");
    if (!demo) {
      try {
        const saved = JSON.parse(sessionStorage.getItem("mezyad-api-session"));
        if (saved?.token && saved?.user?.id) setSession(saved);
      } catch {
        /* تم التعديل من عبير: اذا التخزين مو متاح يقدر المستخدم يسجل من جديد. */
      }
    }
  }, [demo]);

  function remember(next) {
    setSession(next);
    if (!demo) {
      try {
        if (next)
          sessionStorage.setItem("mezyad-api-session", JSON.stringify(next));
        else sessionStorage.removeItem("mezyad-api-session");
      } catch {
        setNotice("الجلسة شغالة هنا، لكن المتصفح ما حفظها للتحديث القادم.");
      }
    }
  }

  // تم التعديل من عبير: كل طلب خاص يمر بالتوكن، واذا انتهت الجلسه نرجع المستخدم للدخول.
  async function call(path, options = {}) {
    try {
      return await request(path, { ...options, token: session?.token });
    } catch (err) {
      if (err.status === 401) {
        remember(null);
        setNotice("انتهت جلستك. سجل دخولك من جديد.");
      }
      throw err;
    }
  }

  useEffect(() => {
    if (!session) {
      setItems([]);
      setAuctions([]);
      setCategories([]);
      setError("");
      setLoading(false);
      return;
    }
    if (demo) {
      setItems(previewItems);
      setAuctions(previewAuctions);
      setCategories(demoCategories);
      setLoading(false);
      setError("");
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError("");
    Promise.all([
      request("/me/items", { token: session.token, signal: controller.signal }),
      request("/me/auctions", {
        token: session.token,
        signal: controller.signal,
      }),
      request("/categories", { signal: controller.signal }),
    ])
      .then(([nextItems, nextAuctions, nextCategories]) => {
        if (![nextItems, nextAuctions, nextCategories].every(Array.isArray))
          throw new Error(
            "تعذّر تحميل بيانات حسابك. حاول تسجيل الدخول مرة ثانية.",
          );
        if (!controller.signal.aborted) {
          setItems(nextItems);
          setAuctions(nextAuctions);
          setCategories(nextCategories);
        }
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setItems([]);
        setAuctions([]);
        setCategories([]);
        setError(err.message);
        if (err.status === 401) {
          remember(null);
          setNotice("انتهت جلستك. سجل دخولك من جديد.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [
    demo,
    session?.token,
    session?.user?.id,
    refresh,
    previewItems,
    previewAuctions,
  ]);

  function enterPreview(user = demoUser) {
    setDemoUser(user);
    remember({ user });
    setNotice("");
  }
  async function login(email, password) {
    const result = await request("/auth/login", {
      method: "POST",
      body: { email, password },
    });
    if (!result.token || !result.user?.id)
      throw new Error("وصل رد دخول غير مكتمل.");
    remember(result);
    setNotice("");
  }
  async function logout() {
    if (!demo) await call("/auth/logout", { method: "POST" });
    remember(null);
    location.hash = "/login";
  }
  function updatePreviewProfile(name, email) {
    const user = { ...session.user, name, email };
    setDemoUser(user);
    remember({ user });
  }

  // تم التعديل من عبير: المعاينه تحفظ بالذاكره فقط، والربط الحقيقي يرسل نفس حقول الباك.
  async function saveListing(input, files, existing) {
    if (demo) {
      const saved = {
        ...existing,
        id: existing?.id || "preview-item-" + Date.now(),
        seller_id: session.user.id,
        ...input,
        category_id: input.categoryId,
        images: files.length
          ? files.map((file) => URL.createObjectURL(file))
          : existing?.images || [],
        status: "PENDING_REVIEW",
        review_reason: null,
        reviewed_at: null,
        created_at: existing?.created_at || new Date().toISOString(),
      };
      setPreviewItems((old) =>
        existing
          ? old.map((item) => (item.id === existing.id ? saved : item))
          : [saved, ...old],
      );
      return saved;
    }
    const form = new FormData();
    form.set("title", input.title);
    form.set("description", input.description);
    form.set("categoryId", input.categoryId);
    form.set("categoryFields", JSON.stringify(input.categoryFields));
    files.forEach((file) => form.append("images", file));
    const saved = await call(
      "/items" + (existing ? "/" + encodeURIComponent(existing.id) : ""),
      { method: existing ? "PATCH" : "POST", body: form },
    );
    if (
      !saved?.id ||
      saved.status !== "PENDING_REVIEW" ||
      (existing && saved.id !== existing.id)
    ) {
      const err = new Error(
        "ما تأكدنا من حفظ الإعلان. راجع إعلاناتك قبل إعادة الإرسال.",
      );
      err.uncertain = true;
      throw err;
    }
    // تم التعديل من عبير: نحدث القائمه بدون اعاده تحميل النموذج عشان يبقى تاكيد الحفظ ظاهر.
    setItems((old) =>
      existing
        ? old.map((item) => (item.id === existing.id ? saved : item))
        : [saved, ...old],
    );
    return saved;
  }
  async function createAuction(input) {
    if (demo) {
      if (previewAuctions.some((a) => a.item_id === input.itemId))
        throw new Error("هالإعلان له مزاد بالفعل.");
      const item = previewItems.find((i) => i.id === input.itemId);
      if (item?.status !== "APPROVED")
        throw new Error("الإعلان لازم يكون معتمد.");
      const result = {
        id: "preview-auction-" + Date.now(),
        item_id: item.id,
        title: item.title,
        description: item.description,
        image_url: item.images[0],
        visibility: input.visibility,
        starting_price: input.startingPrice,
        current_price: input.startingPrice,
        minimum_increment: input.minimumIncrement,
        start_time: input.startTime,
        end_time: input.endTime,
        status: new Date(input.startTime) > new Date() ? "SCHEDULED" : "ACTIVE",
        ...(input.visibility === "PRIVATE"
          ? { accessCode: "PREVIEW-" + Date.now().toString(36).toUpperCase() }
          : {}),
      };
      setPreviewAuctions((old) => [result, ...old]);
      return result;
    }
    const result = await call("/auctions", { method: "POST", body: input });
    if (!result?.id || result.item_id !== input.itemId) {
      const err = new Error(
        "ما تأكدنا من إنشاء المزاد. راجع نشاطك قبل إعادة الإرسال.",
      );
      err.uncertain = true;
      throw err;
    }
    // تم التعديل من عبير: نخلي رمز المزاد ظاهر بعد الانشاء ونحدث القائمه محليا.
    const item = items.find((item) => item.id === input.itemId);
    setAuctions((old) => [
      {
        ...result,
        title: item?.title || "",
        description: item?.description || "",
        image_url: item?.images?.[0],
      },
      ...old,
    ]);
    return result;
  }

  return {
    demo,
    session,
    user: session?.user,
    items,
    auctions,
    categories,
    loading,
    error,
    notice,
    reload: () => setRefresh((n) => n + 1),
    enterPreview,
    login,
    logout,
    updatePreviewProfile,
    saveListing,
    createAuction,
  };
}
