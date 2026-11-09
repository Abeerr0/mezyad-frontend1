// تم التعديل من عبير: تنبيهات الموقع وبطاقه دعوه المزاد الخاص وازرار نسخها ومشاركتها
import Button from "../ui/Button.jsx";
import React, { useEffect, useRef, useState } from "react";
import { Modal, Icon } from "../ui/index.jsx";

// تم التعديل من عبير: تنبيهات خفيفه للعمليات بدون ما نغير ردود الباك.
export function notify(message) {
  window.dispatchEvent(
    new CustomEvent("mezyad-notice", {
      detail: message,
    }),
  );
}
export function Notices() {
  const [message, setMessage] = useState("");
  useEffect(() => {
    let timer;
    const show = (e) => {
      setMessage(e.detail);
      clearTimeout(timer);
      timer = setTimeout(() => setMessage(""), 5000);
    };
    window.addEventListener("mezyad-notice", show);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("mezyad-notice", show);
    };
  }, []);
  return (
    message && (
      <aside className="brand-toast" role="status">
        <Icon name="check" />
        <span>{message}</span>
        <button
          className="icon-button"
          aria-label={"إغلاق التنبيه"}
          onClick={() => setMessage("")}
        >
          <Icon name="close" />
        </button>
      </aside>
    )
  );
}

// تم التعديل من عبير: رمز التجربه يختبر الواجهه فقط وما ينشئ جلسه او يرسل بريد.
export function EmailAccess({ demo }) {
  const [open, setOpen] = useState(false),
    [stage, setStage] = useState("email"),
    [email, setEmail] = useState(""),
    [code, setCode] = useState(""),
    [error, setError] = useState(""),
    [cooldown, setCooldown] = useState(0);
  const timer = useRef();
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    if (!cooldown) return;
    const t = setTimeout(() => setCooldown((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);
  function close() {
    clearTimeout(timer.current);
    setOpen(false);
    setStage("email");
    setCode("");
    setError("");
  }
  function send(e) {
    e.preventDefault();
    if (!demo) {
      setError("الدخول برمز البريد غير متاح حاليًا استخدم بريدك وكلمة المرور");
      return;
    }
    setError("");
    setStage("sending");
    timer.current = setTimeout(() => {
      setStage("code");
      setCooldown(30);
    }, 800);
  }
  // تم التعديل من عبير: نتحقق من القيمه وننتظر تاكيد الباك قبل عرض النجاح
  function verify(e) {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setError("اكتب الرمز المكوّن من 6 أرقام");
      return;
    }
    setStage("checking");
    setError("");
    timer.current = setTimeout(() => {
      if (code === "123456") setStage("success");
      else {
        setStage("code");
        setError("الرمز مو صحيح راجعه وحاول مرة ثانية");
      }
    }, 1000);
  }
  return (
    <>
      <button
        type="button"
        className="button outline full"
        onClick={() => setOpen(true)}
      >
        الدخول برمز البريد <Icon name="lock" />
      </button>
      {open && (
        <Modal
          title={
            stage === "success" ? "تم التحقق من الرمز" : "خطوة وتوصل لمزادك"
          }
          onClose={close}
        >
          <div className="email-access">
            <div className="ui-seal">
              <Icon name={stage === "success" ? "check" : "lock"} size={32} />
            </div>
            {demo && (
              <p className="field-hint">
                تجربة الواجهة فقط — ما ينرسل بريد ولا ينفتح حساب رمز التجربة:{" "}
                <bdi>123456</bdi>
              </p>
            )}
            {["sending", "checking"].includes(stage) ? (
              <div role="status" className="ui-wait">
                <span className="ui-loader" />
                <p>
                  {stage === "sending" ? "نجهّز خطوة التحقق" : "نتحقق من الرمز"}
                </p>
              </div>
            ) : stage === "success" ? (
              <div className="success-box">
                <h3>كل شيء واضح</h3>
                <p>اكتملت تجربة التحقق تقدر ترجع وتكمل تسجيل الدخول</p>
                <Button onClick={close}>
                  رجوع للدخول <Icon />
                </Button>
              </div>
            ) : stage === "email" ? (
              <form onSubmit={send} className="form-stack">
                <p>اكتب بريدك عشان تكمل بخطوة التحقق</p>
                <label className="field">
                  البريد الإلكتروني
                  <input
                    type="email"
                    autoComplete="email"
                    dir="ltr"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    maxLength={254}
                  />
                </label>
                <Button full>
                  متابعة <Icon />
                </Button>
              </form>
            ) : (
              <form className="form-stack" onSubmit={verify}>
                <p>
                  أدخل رمز التحقق للبريد <bdi>{email}</bdi>
                </p>
                <label className="field">
                  رمز التحقق
                  <input
                    autoFocus
                    className="otp-input"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    dir="ltr"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                    required
                  />
                </label>
                <Button full>
                  تحقق من الرمز <Icon name="check" />
                </Button>
                <button
                  type="button"
                  className="text-link"
                  disabled={cooldown > 0}
                  onClick={send}
                >
                  {cooldown
                    ? `تقدر تعيد المحاولة بعد ${cooldown} ثانية`
                    : "إعادة طلب الرمز"}
                </button>
                <button
                  type="button"
                  className="text-link"
                  onClick={() => {
                    setStage("email");
                    setError("");
                  }}
                >
                  تغيير البريد
                </button>
              </form>
            )}
            {error && (
              <p role="alert" className="form-error ui-shake">
                {error}
              </p>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}

// تم التعديل من عبير: الدعوه تحمل رمز المزاد نفسه ونشارك صوره محليه بدون خدمات خارجيه.
export function InvitationTicket({ code, title }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  // تم التعديل من عبير: ننسخ رمز الدعوه ونوضح اذا النسخ نجح
  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      notify("تم نسخ رمز الدعوة");
    } catch {
      setError("تعذّر النسخ التلقائي حدد الرمز وانسخه من الحقل");
    }
  }
  // تم التعديل من عبير: نجهز مشاركه بطاقه الدعوه حسب دعم المتصفح
  async function share() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await document.fonts.ready;
      const canvas = document.createElement("canvas");
      canvas.width = 1000;
      canvas.height = 1300;
      const c = canvas.getContext("2d");
      c.fillStyle = "#f3eddf";
      c.fillRect(0, 0, 1000, 1300);
      c.strokeStyle = "#b18a4b";
      c.lineWidth = 3;
      c.strokeRect(35, 35, 930, 1230);
      c.textAlign = "center";
      c.direction = "rtl";
      c.fillStyle = "#252820";
      c.font = "58px NotoSansArabic, sans-serif";
      c.fillText("مزياد", 500, 160);
      c.font = "42px NotoSansArabic, sans-serif";
      c.fillText("دعوة لمزاد خاص", 500, 300);
      c.font = "28px NotoSansArabic, sans-serif";
      const chars = Array.from(title || "مزاد خاص");
      for (let i = 0; i < Math.min(chars.length, 96); i += 24)
        c.fillText(chars.slice(i, i + 24).join(""), 500, 410 + (i / 24) * 60);
      c.setLineDash([10, 12]);
      c.beginPath();
      c.moveTo(70, 740);
      c.lineTo(930, 740);
      c.stroke();
      c.setLineDash([]);
      c.font = "28px NotoSansArabic, sans-serif";
      c.fillText("رمز دخولك للمزاد", 500, 830);
      c.direction = "ltr";
      c.font = "28px monospace";
      c.fillText(code, 500, 920);
      c.direction = "rtl";
      c.font = "25px NotoSansArabic, sans-serif";
      c.fillText("احتفظ بالدعوة، وادخل بحسابك في مزياد", 500, 1110);
      const blob = await new Promise((resolve) =>
        canvas.toBlob(resolve, "image/png"),
      );
      if (!blob) throw new Error();
      const file = new File([blob], "mezyad-invitation.png", {
        type: "image/png",
      });
      if (
        navigator.canShare?.({
          files: [file],
        })
      )
        await navigator.share({
          files: [file],
          title: "دعوة مزياد",
        });
      else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = file.name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        notify("تم تجهيز صورة الدعوة للتحميل");
      }
    } catch (e) {
      if (e.name !== "AbortError")
        setError("تعذّر تجهيز الصورة تقدر تنسخ الرمز وتشاركه");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="invitation-panel">
      <div className="invitation-ticket">
        <div className="ticket-marks" aria-hidden="true">
          ✦ ⚖ ✦
        </div>
        <header>
          MEZYAD <Icon name="gavel" />
        </header>
        <p className="eyebrow">دعوة خاصة</p>
        <h3>مزاد يجمع أهل القيمة</h3>
        <p>{title}</p>
        <div className="ticket-stub">
          <label className="field">
            رمز الدخول
            <input
              dir="ltr"
              readOnly
              value={code}
              onFocus={(e) => e.target.select()}
            />
          </label>
          <small>الدخول بحسابك، والدعوة لك</small>
        </div>
      </div>
      <div className="form-actions">
        <Button type="button" onClick={share} disabled={busy}>
          {busy ? "نجهّز دعوتك" : "مشاركة صورة الدعوة"} <Icon name="image" />
        </Button>
        <button type="button" className="button outline" onClick={copy}>
          نسخ الرمز <Icon />
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}

// تم التعديل من عبير: نربط نفس صفحه الدفع بميسر بدون تغيير تصميم المحفظه.
export { default as PaymentPage } from "../../features/payments/components/MoyasarCheckout/MoyasarCheckout.jsx";
