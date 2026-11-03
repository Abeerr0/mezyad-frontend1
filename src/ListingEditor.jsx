import React, { useEffect, useRef, useState } from "react";
import { Icon, Auctioneer } from "./components";
import { imageUrl, validateImages } from "./api";
import { categoryLabels } from "./data";

// تم التعديل من عبير: نفس النموذج للانشاء واعاده الارسال عشان ما نكرر التحقق.
export default function ListingEditor({ workspace, existing }) {
  const initialFields =
    existing?.categoryFields || existing?.category_fields || {};
  const initialSpecs = Object.entries(initialFields).map(([name, value]) => ({
    name,
    value: typeof value === "object" ? JSON.stringify(value) : String(value),
  }));
  const [step, setStep] = useState(existing ? 1 : 0);
  const [categoryId, setCategoryId] = useState(existing?.category_id || "");
  const [title, setTitle] = useState(existing?.title || "");
  const [description, setDescription] = useState(existing?.description || "");
  const [specs, setSpecs] = useState(
    initialSpecs.length ? initialSpecs : [{ name: "", value: "" }],
  );
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const [saved, setSaved] = useState(null);
  const [confirmed, setConfirmed] = useState(false);
  const fileInput = useRef(null);
  const stepRef = useRef(null);
  const category = workspace.categories.find((c) => c.id === categoryId);
  const shownImages = files.length
    ? previews
    : (existing?.images || []).map(imageUrl);

  // تم التعديل من عبير: روابط الصور المؤقته تنحذف من الذاكره اذا تغيرت الملفات.
  useEffect(() => {
    const urls = files.map((file) => URL.createObjectURL(file));
    setPreviews(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [files]);
  useEffect(() => {
    stepRef.current?.focus({ preventScroll: true });
  }, [step]);
  function chooseFiles(chosen) {
    const next = [...files, ...chosen];
    const issue = validateImages(next, !existing);
    if (issue) {
      setError(issue);
      return;
    }
    setFiles(next);
    setError("");
  }
  function categoryFields() {
    if (existing && JSON.stringify(specs) === JSON.stringify(initialSpecs))
      return initialFields;
    return Object.fromEntries(
      specs
        .filter((s) => s.name.trim())
        .map((s) => [s.name.trim(), s.value.trim()]),
    );
  }
  function checkStep() {
    if (step === 0 && !category) return "اختر تصنيف الأصل عشان نكمل.";
    if (step === 1) {
      if (!title.trim() || Array.from(title.trim()).length > 240)
        return "اكتب عنوان واضح، بحد أقصى 240 حرف.";
      if (!description.trim() || description.length > 20000)
        return "اكتب وصف الأصل، بحد أقصى 20,000 حرف.";
      const filled = specs.filter((s) => s.name.trim() || s.value.trim());
      if (filled.some((s) => !s.name.trim() || !s.value.trim()))
        return "كل مواصفة تحتاج اسم وقيمة، أو احذف السطر الفاضي.";
      if (new Set(filled.map((s) => s.name.trim())).size !== filled.length)
        return "اسم المواصفة مكرر. خلّ لكل مواصفة اسم مختلف.";
    }
    if (step === 2) return validateImages(files, !existing);
    return "";
  }
  function next() {
    const issue = checkStep();
    setError(issue);
    if (!issue) {
      setConfirmed(false);
      setStep(step + 1);
    }
  }
  function changeSpec(index, field, value) {
    setSpecs((old) =>
      old.map((row, n) => (n === index ? { ...row, [field]: value } : row)),
    );
  }
  async function submit(event) {
    event.preventDefault();
    if (step !== 3) {
      next();
      return;
    }
    if (busy || saved || uncertain || !confirmed) return;
    setBusy(true);
    setError("");
    try {
      const result = await workspace.saveListing(
        {
          title: title.trim(),
          description: description.trim(),
          categoryId,
          categoryFields: categoryFields(),
        },
        files,
        existing,
      );
      setSaved(result);
      if (existing)
        location.hash =
          "/listings?item=" + encodeURIComponent(result.id) + "&saved=1";
    } catch (err) {
      setError(err.message);
      setUncertain(Boolean(err.uncertain));
    } finally {
      setBusy(false);
    }
  }
  if (saved)
    return (
      <section className="paper-card success-screen">
        <div className="success-seal">
          <Icon name="check" size={36} />
        </div>
        <p className="eyebrow">وصلت حكاية أصلك</p>
        <h2>{existing ? "تمت إعادة الإرسال." : "إعلانك جاهز للمراجعة."}</h2>
        <p>
          {workspace.demo
            ? "إعلان التجربة جاهز. حالته الآن قيد المراجعة."
            : "حُفظ إعلانك وصوره بحالة قيد المراجعة. تقدر تتابع القرار من إعلاناتك."}
        </p>
        <p>الخطوة الجاية: بعد الاعتماد تقدر تجهّز المزاد.</p>
        <a
          className="button dark"
          href={"#/listings?item=" + encodeURIComponent(saved.id)}
        >
          تابع إعلانك <Icon />
        </a>
      </section>
    );
  return (
    <div className="editor-layout">
      <section className="paper-card editor-card">
        <ol className="editor-steps" aria-label="خطوات الإعلان">
          {["التصنيف", "التفاصيل", "الصور", "المراجعة"].map((label, n) => (
            <li
              key={label}
              aria-current={step === n ? "step" : undefined}
              className={n < step ? "complete" : ""}
            >
              <span>{n < step ? <Icon name="check" size={14} /> : n + 1}</span>
              {label}
            </li>
          ))}
        </ol>
        {existing && (
          <div className="rejection-note">
            <strong>خلّنا نعدّل الملاحظات</strong>
            <p>
              {existing.review_reason ||
                "راجع تفاصيل إعلانك قبل إعادة الإرسال."}
            </p>
          </div>
        )}
        <form onSubmit={submit} noValidate>
          <fieldset disabled={busy || uncertain}>
            <div className="editor-step" ref={stepRef} tabIndex={-1}>
              {step === 0 && (
                <>
                  <p className="eyebrow">01 / البداية</p>
                  <h2>وش الأصل اللي عندك؟</h2>
                  <p>اختر تصنيف يناسبه، وبعدها نحكي تفاصيله.</p>
                  <div className="category-choices">
                    {workspace.categories.map((c, index) => (
                      <button
                        type="button"
                        key={c.id}
                        aria-pressed={categoryId === c.id}
                        onClick={() => {
                          setCategoryId(c.id);
                          setError("");
                        }}
                      >
                        <span className="category-index">0{index + 1}</span>
                        <Icon
                          name={
                            c.name === "Real Estate"
                              ? "globe"
                              : c.name === "Vehicle Plates"
                                ? "flag"
                                : "image"
                          }
                          size={30}
                        />
                        <strong>{categoryLabels[c.name] || c.name}</strong>
                        <span className="choice-check">
                          <Icon name="check" size={14} />
                        </span>
                      </button>
                    ))}
                  </div>
                  {!workspace.categories.length && (
                    <p role="alert">
                      ما فيه تصنيفات متاحة حاليًا. حدّث بيانات الحساب وحاول مرة
                      ثانية.
                    </p>
                  )}
                </>
              )}
              {step === 1 && (
                <>
                  <p className="eyebrow">02 / الحكاية</p>
                  <h2>التفاصيل تصنع الفرق.</h2>
                  <p>
                    {existing
                      ? "التصنيف ثابت بعد الرفض. تقدر تعدّل العنوان والوصف والمواصفات."
                      : "وصف واضح يساعد المهتمين يفهمون قيمة أصلك."}
                  </p>
                  <span className="pill">
                    {categoryLabels[category?.name] || category?.name}
                  </span>
                  <label className="field">
                    <span>
                      عنوان الإعلان <small>مطلوب</small>
                    </span>
                    <input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      maxLength={480}
                      placeholder="مثال: بورش كاريرا GT — 2005"
                    />
                    <small className="field-counter">
                      {Array.from(title).length} / 240
                    </small>
                  </label>
                  <label className="field">
                    <span>
                      وصف الأصل <small>مطلوب</small>
                    </span>
                    <textarea
                      rows={5}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      maxLength={20000}
                      placeholder="اذكر حالة الأصل، تفاصيله، وأي معلومات مهمة للمشتري…"
                    />
                  </label>
                  <div className="section-heading">
                    <h3>
                      المواصفات <small>اختياري</small>
                    </h3>
                    <button
                      type="button"
                      className="text-link"
                      onClick={() =>
                        setSpecs([...specs, { name: "", value: "" }])
                      }
                    >
                      <Icon name="plus" size={16} /> إضافة مواصفة
                    </button>
                  </div>
                  {specs.map((row, index) => (
                    <div className="spec-row" key={index}>
                      <input
                        aria-label={"اسم المواصفة " + (index + 1)}
                        placeholder="المواصفة، مثل اللون"
                        value={row.name}
                        maxLength={100}
                        onChange={(e) =>
                          changeSpec(index, "name", e.target.value)
                        }
                      />
                      <input
                        aria-label={"قيمة المواصفة " + (index + 1)}
                        placeholder="القيمة، مثل فضي"
                        value={row.value}
                        maxLength={1000}
                        onChange={(e) =>
                          changeSpec(index, "value", e.target.value)
                        }
                      />
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={"حذف المواصفة " + (index + 1)}
                        onClick={() =>
                          setSpecs(specs.filter((_, n) => n !== index))
                        }
                      >
                        <Icon name="close" size={17} />
                      </button>
                    </div>
                  ))}
                </>
              )}
              {step === 2 && (
                <>
                  <p className="eyebrow">03 / الصورة تحكي</p>
                  <h2>خلّ أصلك واضح.</h2>
                  <p>
                    {existing
                      ? "اترك الصور الحالية أو ارفع مجموعة جديدة تستبدلها بالكامل عند الحفظ."
                      : "أضف من صورة إلى 6 صور واضحة للأصل نفسه."}
                  </p>
                  <div
                    className="upload-drop"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      chooseFiles(Array.from(e.dataTransfer.files));
                    }}
                  >
                    <Icon name="image" size={38} />
                    <h3>اسحب صورك هنا</h3>
                    <p>JPG، PNG، WebP · حتى 5 MiB للصورة</p>
                    <button
                      type="button"
                      className="button outline"
                      onClick={() => fileInput.current?.click()}
                    >
                      أو اختر من جهازك <Icon name="plus" size={17} />
                    </button>
                    <input
                      ref={fileInput}
                      className="visually-hidden"
                      type="file"
                      multiple
                      accept="image/jpeg,image/png,image/webp"
                      aria-label="صور الإعلان"
                      onChange={(e) => {
                        chooseFiles(Array.from(e.target.files));
                        e.target.value = "";
                      }}
                    />
                  </div>
                  <div className="image-previews">
                    {shownImages.map((url, index) => (
                      <figure key={url}>
                        <img src={url} alt={"صورة الأصل " + (index + 1)} />
                        <figcaption>
                          {index === 0
                            ? "الصورة الرئيسية"
                            : "صورة " + (index + 1)}
                        </figcaption>
                        {files.length > 0 && (
                          <button
                            type="button"
                            className="remove-photo"
                            aria-label={"حذف الصورة " + (index + 1)}
                            onClick={() =>
                              setFiles(files.filter((_, n) => n !== index))
                            }
                          >
                            <Icon name="close" size={16} />
                          </button>
                        )}
                      </figure>
                    ))}
                  </div>
                  {files.length > 0 && existing && (
                    <button
                      className="text-link"
                      type="button"
                      onClick={() => setFiles([])}
                    >
                      الرجوع للصور الحالية
                    </button>
                  )}
                </>
              )}
              {step === 3 && (
                <>
                  <p className="eyebrow">04 / نظرة أخيرة</p>
                  <h2>كل شيء على ما يرام؟</h2>
                  <p>راجع التفاصيل قبل ما ترسل إعلانك للمشرف.</p>
                  <article className="review-listing">
                    {shownImages[0] && <img src={shownImages[0]} alt={title} />}
                    <div>
                      <span className="pill">
                        {categoryLabels[category?.name] || category?.name}
                      </span>
                      <h3>{title}</h3>
                      <p className="preserve-lines">{description}</p>
                    </div>
                  </article>
                  <dl className="spec-list">
                    {Object.entries(categoryFields()).map(([key, value]) => (
                      <div key={key}>
                        <dt>{key}</dt>
                        <dd>
                          {typeof value === "object"
                            ? JSON.stringify(value)
                            : String(value)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  <p className="field-hint">
                    عدد الصور: {shownImages.length}. بعد الإرسال يصير الإعلان
                    قيد المراجعة.
                  </p>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={confirmed}
                      onChange={(e) => setConfirmed(e.target.checked)}
                    />
                    راجعت تفاصيل الأصل وصوره، وجاهز أرسله للمراجعة.
                  </label>
                </>
              )}
            </div>
            <div className="editor-actions">
              {step < 3 ? (
                <button
                  type="submit"
                  className="button dark"
                  disabled={step === 0 && !categoryId}
                >
                  التالي <Icon />
                </button>
              ) : (
                <button
                  type="submit"
                  className="button dark"
                  disabled={!confirmed || busy}
                >
                  {busy
                    ? "جاري الإرسال…"
                    : existing
                      ? "إعادة الإرسال للمراجعة"
                      : "إرسال للمراجعة"}
                  <Icon name="check" />
                </button>
              )}
              {step > (existing ? 1 : 0) && (
                <button
                  type="button"
                  className="button outline"
                  onClick={() => {
                    setStep(step - 1);
                    setError("");
                  }}
                >
                  السابق
                </button>
              )}
            </div>
          </fieldset>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          {uncertain && (
            <a className="text-link" href="#/listings">
              تحقق من إعلاناتك قبل تكرار الطلب <Icon />
            </a>
          )}
        </form>
        <a href="#/listings" className="editor-cancel">
          إلغاء والعودة لإعلاناتي
        </a>
      </section>
      <aside className="editor-aside">
        <div className="editor-tip">
          <Auctioneer small character="auctioneer" motion="inspect" />
          <h3>
            {
              [
                "خلّنا نعرف أصلك.",
                "كل تفصيلة تفرق.",
                "الصورة أول انطباع.",
                "وصلنا للخطوة الأخيرة.",
              ][step]
            }
          </h3>
          <p>
            {
              [
                "اختر التصنيف الأقرب لأصلك، عشان يوصل للمهتمين فيه.",
                "اذكر المعلومات المهمة بوضوح. الوصف الدقيق يختصر أسئلة كثير.",
                "إضاءة واضحة، زوايا مختلفة، وصور للأصل نفسه. أول صورة بتظهر في البطاقة.",
                "الإرسال للمراجعة ما ينشر مزاد. بعد الاعتماد، أنت تحدد شروطه وموعده.",
              ][step]
            }
          </p>
        </div>
        <p className="field-hint">
          التغييرات ما تنحفظ إلا بعد تأكيد الإرسال. إذا طلعت قبلها، تحتاج تعبّي
          النموذج من جديد.
        </p>
      </aside>
    </div>
  );
}
