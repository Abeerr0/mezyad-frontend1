import { InvitationTicket } from "../InteractionUI";
import React, { useState } from "react";
import { AccountLayout, ResourceState } from "../account-components";
import { Icon, money, dateText } from "../components";
import { validAmount, imageUrl } from "../api";

// تم التعديل من عبير: نجهز مزاد من اعلان معتمد ونراجع النوع والسعر والوقت قبل الارسال.
export default function CreateAuction({ workspace, params }) {
  const [itemId, setItemId] = useState(params.get("item") || "");
  const [visibility, setVisibility] = useState("PUBLIC");
  const [startingPrice, setStartingPrice] = useState("");
  const [minimumIncrement, setMinimumIncrement] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const [result, setResult] = useState(null);
  const [copyStatus, setCopyStatus] = useState("");
  const approved = workspace.items.filter((i) => i.status === "APPROVED");
  const item = approved.find((i) => i.id === itemId);
  const duplicate = workspace.auctions.some((a) => a.item_id === itemId);
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  function validate() {
    if (!item) return "اختر إعلان معتمد يخصك";
    if (duplicate) return "هالإعلان له مزاد بالفعل تقدر تتابعه من نشاطي";
    if (!validAmount(startingPrice) || !validAmount(minimumIncrement))
      return "اكتب مبالغ أكبر من صفر وبمنزلتين عشريتين كحد أقصى";
    if (
      !startTime ||
      !endTime ||
      !Number.isFinite(Date.parse(startTime)) ||
      !Number.isFinite(Date.parse(endTime)) ||
      new Date(endTime) <= new Date(startTime)
    )
      return "النهاية لازم تكون بعد البداية راجع التاريخ والوقت";
    if (new Date(endTime) <= new Date())
      return "وقت النهاية لازم يكون في المستقبل";
    return "";
  }
  async function submit(event) {
    event.preventDefault();
    if (busy || result || uncertain) return;
    const issue = validate();
    if (issue) {
      setError(issue);
      return;
    }
    setError("");
    if (!reviewing) {
      setReviewing(true);
      return;
    }
    setBusy(true);
    try {
      setResult(
        await workspace.createAuction({
          itemId,
          visibility,
          startingPrice: Number(startingPrice),
          minimumIncrement: Number(minimumIncrement),
          startTime: new Date(startTime).toISOString(),
          endTime: new Date(endTime).toISOString(),
        }),
      );
    } catch (err) {
      setError(err.message);
      setUncertain(Boolean(err.uncertain || err.code === "DUPLICATE_AUCTION"));
    } finally {
      setBusy(false);
    }
  }
  // تم التعديل من عبير: رمز الخاص يظهر لصاحب المزاد من رد الانشاء وما نحفظه بملفات المشروع.
  async function copyCode() {
    try {
      await navigator.clipboard.writeText(result.accessCode);
      setCopyStatus("تم نسخ الرمز");
    } catch {
      setCopyStatus("حدد الرمز من الحقل وانسخه يدويًا");
    }
  }
  return (
    <AccountLayout
      workspace={workspace}
      active="listings"
      eyebrow={"بعد الاعتماد، القرار لك"}
      title={"جهّز مزادك"}
      description={"حدد نوع الدخول وشروط المزاد، وراجعها قبل الإنشاء"}
    >
      <ResourceState workspace={workspace}>
        {result ? (
          <section className="paper-card success-screen">
            <div className="success-seal">
              <Icon name="gavel" size={34} />
            </div>
            <p className="eyebrow">جاهزين للمنافسة</p>
            <h2>{workspace.demo ? "مزاد التجربة جاهز" : "تم إنشاء مزادك"}</h2>
            <p>{item?.title}</p>
            <p>
              {result.visibility === "PRIVATE"
                ? "مزاد خاص، ما يظهر في قائمة المزادات العامة"
                : "مزاد عام، يقدر الزوار يشوفونه في قائمة المزادات"}
            </p>
            <p className="field-hint">
              {workspace.demo
                ? "هذا مزاد تجريبي، وما يُنشر للمستخدمين"
                : "يبدأ مزادك وينتهي تلقائيًا في المواعيد اللي حددتها"}
            </p>
            {result.visibility === "PRIVATE" &&
              (result.accessCode ? (
                <>
                  <InvitationTicket
                    code={result.accessCode}
                    title={item?.title}
                  />
                </>
              ) : (
                <p role="alert" className="form-error">
                  تم إنشاء المزاد، لكن الرمز ما وصل لا تنشئ مزاد ثاني؛ راجع
                  الفريق
                </p>
              ))}
            <a className="button dark" href="#/activity">
              تابع من نشاطي <Icon />
            </a>
          </section>
        ) : !approved.length ? (
          <div className="paper-card empty-box">
            <Icon name="shield" size={38} />
            <h2>نحتاج إعلان معتمد أول</h2>
            <p>
              إذا عندك إعلان قيد المراجعة، انتظر القرار وإذا ما أرسلت أصل، ابدأ
              بإعلان جديد
            </p>
            <a className="button dark" href="#/listings">
              شوف إعلاناتك <Icon />
            </a>
          </div>
        ) : (
          <form onSubmit={submit} noValidate className="auction-setup">
            <fieldset disabled={busy || uncertain}>
              {!reviewing ? (
                <>
                  <section className="paper-card">
                    <div className="section-heading">
                      <div>
                        <span className="section-number">01</span>
                        <h2>اختر الأصل</h2>
                      </div>
                      <Icon name="check" />
                    </div>
                    <label className="field">
                      <span>الإعلان المعتمد</span>
                      <select
                        value={itemId}
                        onChange={(e) => setItemId(e.target.value)}
                      >
                        <option value="">اختر من إعلاناتك المعتمدة</option>
                        {approved.map((i) => (
                          <option key={i.id} value={i.id}>
                            {i.title}
                          </option>
                        ))}
                      </select>
                    </label>
                    {item && (
                      <div className="auction-item-summary">
                        {item.images?.[0] && (
                          <img
                            src={imageUrl(item.images[0])}
                            alt={item.title}
                          />
                        )}
                        <div>
                          <span className="status-tag approved">معتمد</span>
                          <h3>{item.title}</h3>
                          <p>جاهز لتحديد شروط المزاد</p>
                        </div>
                      </div>
                    )}
                    {duplicate && (
                      <p role="alert" className="form-error">
                        هالإعلان له مزاد بالفعل اختر أصل ثاني
                      </p>
                    )}
                  </section>
                  <section className="paper-card">
                    <div className="section-heading">
                      <div>
                        <span className="section-number">02</span>
                        <h2>مين يدخل المزاد؟</h2>
                      </div>
                    </div>
                    <div className="auction-type-choices">
                      {[
                        [
                          "PUBLIC",
                          "عام",
                          "المزاد مفتوح",
                          "يظهر في التصفح العام، والمشاركة حسب شروط المزاد",
                          "globe",
                        ],
                        [
                          "PRIVATE",
                          "خاص",
                          "دعوة على ذوقك",
                          "ما يظهر للعامة ترسل رمز الدخول للأشخاص اللي تختارهم",
                          "lock",
                        ],
                      ].map(([value, label, title, text, icon]) => (
                        <button
                          key={value}
                          type="button"
                          aria-pressed={visibility === value}
                          onClick={() => setVisibility(value)}
                        >
                          <div className="type-art">
                            <Icon name={icon} size={50} />
                            <span className="type-stamp">{label}</span>
                          </div>
                          <h3>{title}</h3>
                          <p>{text}</p>
                          <span className="choice-check">
                            <Icon name="check" size={15} />
                          </span>
                        </button>
                      ))}
                    </div>
                  </section>
                  <section className="paper-card">
                    <div className="section-heading">
                      <div>
                        <span className="section-number">03</span>
                        <h2>السعر والموعد</h2>
                      </div>
                    </div>
                    <div className="two-fields">
                      <label className="field">
                        <span>
                          سعر البداية <small>ريال</small>
                        </span>
                        <input
                          inputMode="decimal"
                          dir="ltr"
                          placeholder="1000.00"
                          value={startingPrice}
                          onChange={(e) => setStartingPrice(e.target.value)}
                        />
                      </label>
                      <label className="field">
                        <span>
                          أقل زيادة <small>ريال</small>
                        </span>
                        <input
                          inputMode="decimal"
                          dir="ltr"
                          placeholder="100.00"
                          value={minimumIncrement}
                          onChange={(e) => setMinimumIncrement(e.target.value)}
                        />
                      </label>
                    </div>
                    <div className="two-fields">
                      <label className="field">
                        <span>بداية المزاد</span>
                        <input
                          type="datetime-local"
                          value={startTime}
                          onChange={(e) => setStartTime(e.target.value)}
                        />
                      </label>
                      <label className="field">
                        <span>نهاية المزاد</span>
                        <input
                          type="datetime-local"
                          value={endTime}
                          onChange={(e) => setEndTime(e.target.value)}
                        />
                      </label>
                    </div>
                    <p className="field-hint">
                      الأوقات بتوقيت جهازك: <bdi>{zone}</bdi> نرسلها للخادم
                      بصيغة UTC
                    </p>
                  </section>
                </>
              ) : (
                <section className="paper-card auction-confirm">
                  <p className="eyebrow">قبل ما يبدأ المزاد</p>
                  <h2>راجع شروط مزادك</h2>
                  <h3>{item?.title}</h3>
                  <dl className="spec-list">
                    <div>
                      <dt>نوع المزاد</dt>
                      <dd>
                        {visibility === "PRIVATE" ? "خاص برمز دخول" : "عام"}
                      </dd>
                    </div>
                    <div>
                      <dt>سعر البداية</dt>
                      <dd>{money(startingPrice)} ريال</dd>
                    </div>
                    <div>
                      <dt>أقل زيادة</dt>
                      <dd>{money(minimumIncrement)} ريال</dd>
                    </div>
                    <div>
                      <dt>البداية — الرياض</dt>
                      <dd>{dateText(startTime)}</dd>
                    </div>
                    <div>
                      <dt>النهاية — الرياض</dt>
                      <dd>{dateText(endTime)}</dd>
                    </div>
                  </dl>
                  <p className="inline-notice">
                    راجع السعر والمواعيد قبل التأكيد؛ شروط المزاد ما تتعدل بعد
                    إنشائه
                  </p>
                </section>
              )}
              <div className="form-actions">
                <button
                  className="button dark"
                  disabled={busy || duplicate}
                  type="submit"
                >
                  {busy
                    ? "جاري الإنشاء"
                    : reviewing
                      ? "تأكيد إنشاء المزاد"
                      : "مراجعة شروط المزاد"}{" "}
                  <Icon name={reviewing ? "check" : "arrow"} />
                </button>
                {reviewing && (
                  <button
                    className="button outline"
                    type="button"
                    onClick={() => setReviewing(false)}
                  >
                    تعديل الشروط
                  </button>
                )}
              </div>
            </fieldset>
            {error && (
              <p role="alert" className="form-error">
                {error}
              </p>
            )}
            {uncertain && (
              <a href="#/activity" className="text-link">
                تحقق من نشاطك قبل تكرار الطلب <Icon />
              </a>
            )}
            <a href="#/listings" className="editor-cancel">
              العودة لإعلاناتي
            </a>
          </form>
        )}
      </ResourceState>
    </AccountLayout>
  );
}
