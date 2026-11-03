import React, { useEffect, useRef, useState } from "react";
import { Icon } from "./components";
import { request } from "./api";

let sdkPromise;
// تم التعديل من عبير: بيانات البطاقه تروح لميسر مباشره وما تمر على الباك او تخزين الموقع.
function loadMoyasar() {
  if (window.Moyasar) return Promise.resolve(window.Moyasar);
  if (!sdkPromise)
    sdkPromise = new Promise((resolve, reject) => {
      const css = document.createElement("link");
      css.rel = "stylesheet";
      css.href =
        "https://cdn.jsdelivr.net/npm/moyasar-payment-form@2.3.0/dist/moyasar.css";
      document.head.append(css);
      const script = document.createElement("script");
      script.src =
        "https://cdn.jsdelivr.net/npm/moyasar-payment-form@2.3.0/dist/moyasar.umd.min.js";
      const timer = setTimeout(() => {
        script.remove();
        sdkPromise = null;
        reject(new Error("تعذّر تحميل خدمة الدفع. حاول مرة ثانية."));
      }, 15000);
      script.onload = () => {
        clearTimeout(timer);
        window.Moyasar
          ? resolve(window.Moyasar)
          : reject(new Error("تعذّر تحميل خدمة الدفع."));
      };
      script.onerror = () => {
        clearTimeout(timer);
        script.remove();
        sdkPromise = null;
        reject(new Error("تعذّر تحميل خدمة الدفع. حاول مرة ثانية."));
      };
      document.head.append(script);
    });
  return sdkPromise;
}
export default function MoyasarCheckout({ market, id, paymentId }) {
  const [open, setOpen] = useState(Boolean(paymentId)),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [checkout, setCheckout] = useState(null),
    [success, setSuccess] = useState(false),
    [resumeUrl, setResumeUrl] = useState("");
  const mount = useRef(),
    sending = useRef(false);
  const path = "/auctions/" + encodeURIComponent(id || "") + "/commitment";
  async function verify(value) {
    const result = await request(path + "/verify", {
      method: "POST",
      token: market.token,
      body: { paymentId: value },
    });
    setSuccess(result.status === "SUCCESS");
    setResumeUrl(result.resumeUrl || "");
    setMessage(
      result.status === "SUCCESS"
        ? "تم تأكيد الالتزام. تقدر ترجع للمزايدة."
        : result.status === "FAILED"
          ? "ما اكتمل التفويض. ارجع للالتزام وحاول ببطاقة ثانية."
          : "طلبك بانتظار التحقق. حدّث الحالة بعد إكمال التحقق من البطاقة.",
    );
    return result;
  }
  useEffect(() => {
    if (!paymentId || !market.token || market.demo) return;
    let active = true;
    setBusy(true);
    verify(paymentId)
      .catch((e) => {
        if (active) setMessage(e.message);
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    history.replaceState(
      null,
      "",
      location.pathname + "#/payment?id=" + encodeURIComponent(id),
    );
    return () => {
      active = false;
    };
  }, [paymentId, market.token, id]);
  async function check(event) {
    event.preventDefault();
    if (sending.current) return;
    if (!id || !market.token || market.demo) {
      setMessage("افتح طلب الالتزام من صفحة المزاد بعد تسجيل الدخول.");
      return;
    }
    sending.current = true;
    setBusy(true);
    setMessage("");
    try {
      if (paymentId) {
        await verify(paymentId);
        return;
      }
      const result = await market.commit(id);
      if (result.status === "SUCCESS") {
        setSuccess(true);
        setMessage("التزامك مؤكد لهذا المزاد.");
        return;
      }
      if (result.paymentId) {
        await verify(result.paymentId);
        return;
      }
      if (!result.checkout?.publishableKey?.startsWith("pk_test_"))
        throw new Error("خدمة الدفع غير متاحة حاليًا.");
      const sdk = await loadMoyasar();
      setCheckout(result.checkout);
      const callback = new URL(location.pathname, location.origin);
      callback.searchParams.set("moyasarAuction", id);
      mount.current.replaceChildren();
      sdk.init({
        element: mount.current,
        amount: result.checkout.amount,
        currency: "SAR",
        language: "ar",
        description: "Mezyad bid commitment",
        publishable_api_key: result.checkout.publishableKey,
        callback_url: callback.href,
        methods: ["creditcard"],
        supported_networks: ["visa", "mastercard", "mada"],
        credit_card: { manual: true },
        metadata: result.checkout.metadata,
        on_completed: async (payment) => {
          await verify(payment.id);
        },
      });
    } catch (error) {
      setMessage(error.message);
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="container payment-page">
      <p className="eyebrow">خطوتك على بيّنة</p>
      <h1>مراجعة الدفع</h1>
      <p>راجع تفاصيل العملية قبل المتابعة.</p>
      <p className="inline-notice">
        بيئة ميسر التجريبية: استخدم بطاقات الاختبار فقط. ما يتم تحصيل قيمة الأصل
        هنا.
      </p>
      <div className="brand-wallet" aria-hidden="true">
        <div className="wallet-card">
          MEZYAD <span>للقيمة أهلها</span>
        </div>
        <div className="wallet-front">
          <Icon name="lock" size={30} />
          <span>محفظتك</span>
          <b>••••</b>
        </div>
      </div>
      <button
        className="pay-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <Icon name="lock" />
        <span>{open ? "إخفاء تفاصيل العملية" : "مراجعة العملية"}</span>
        <Icon />
      </button>
      <section
        className="payment-sheet paper-card"
        hidden={!open}
        style={{ display: open ? undefined : "none" }}
      >
        <p className="eyebrow">تفاصيل العملية</p>
        <h2>كل التفاصيل، قبل القرار.</h2>
        <dl className="payment-summary">
          <div>
            <dt>مبلغ التفويض</dt>
            <dd>
              {checkout
                ? (checkout.amount / 100).toLocaleString("ar-SA") + " ر.س"
                : "يحدده طلب الالتزام"}
            </dd>
          </div>
          <div>
            <dt>وسيلة الدفع</dt>
            <dd>بطاقة عبر ميسر</dd>
          </div>
        </dl>
        <div ref={mount} />
        {!success && (
          <button
            className="button dark full"
            disabled={busy || Boolean(checkout)}
            onClick={check}
          >
            {busy ? (
              <>
                <span className="ui-loader" />
                جاري التحقق…
              </>
            ) : paymentId ? (
              "تحديث حالة الالتزام"
            ) : (
              "متابعة التفويض"
            )}
          </button>
        )}
        {message && (
          <p role="status" className="inline-notice">
            {message}
          </p>
        )}
        {resumeUrl && !success && (
          <a className="button dark full" href={resumeUrl}>
            كمّل التحقق من البطاقة <Icon />
          </a>
        )}
        {success && (
          <a
            className="button dark full"
            href={"#/bid?id=" + encodeURIComponent(id)}
          >
            قدّم عرضك <Icon />
          </a>
        )}
        <p className="field-hint">
          التفويض يخص مشاركتك في هذا المزاد، وما يعني دفع قيمة الأصل.
        </p>
      </section>
      <a
        className="text-link"
        href={
          id ? "#/commitment?id=" + encodeURIComponent(id) : "#/my-auctions"
        }
      >
        الرجوع للالتزام <Icon />
      </a>
    </section>
  );
}
