import "./MoyasarCheckout.css";
import { useAutoRefresh } from "./useAutoRefresh";
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
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [checkout, setCheckout] = useState(null),
    [success, setSuccess] = useState(false),
    [resumeUrl, setResumeUrl] = useState("");
  const [summary, setSummary] = useState(null);
  const [auctionTitle, setAuctionTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [accepted, setAccepted] = useState(false);
  // تم التعديل من عبير: نعرض مبلغ الطلب المحفوظ بدون انشاء عمليه دفع من فتح الصفحه.
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    if (!id || !market.userId) {
      setLoading(false);
      return;
    }
    Promise.all([
      market.getAuction(id, controller.signal),
      market.getCommitment(id, controller.signal),
    ])
      .then(([auction, row]) => {
        if (!controller.signal.aborted) {
          setAuctionTitle(auction.title);
          setSummary(row);
          if (row?.paymentId) currentPayment.current = row.paymentId;
          setResumeUrl(row?.resumeUrl || "");
          if (row?.status === "SUCCESS") setSuccess(true);
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) setMessage(error.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [id, market.userId, market.token, market.demo]);
  const currentPayment = useRef(paymentId);
  useAutoRefresh(
    () =>
      currentPayment.current &&
      verify(currentPayment.current).catch((error) =>
        setMessage(error.message),
      ),
    Boolean(market.token) && !market.demo && !success && !busy,
  );
  const mount = useRef(),
    sending = useRef(false);
  const path = "/auctions/" + encodeURIComponent(id || "") + "/commitment";
  async function verify(value) {
    currentPayment.current = value;
    const result = await request(path + "/verify", {
      method: "POST",
      token: market.token,
      body: { paymentId: value },
    });
    setSummary(result);
    setSuccess(result.status === "SUCCESS");
    setResumeUrl(result.resumeUrl || "");
    setMessage(
      result.status === "SUCCESS"
        ? "تم تأكيد الالتزام. تقدر ترجع للمزايدة."
        : result.status === "FAILED"
          ? "ما اكتمل التفويض. ارجع للالتزام وحاول ببطاقة ثانية."
          : "طلبك بانتظار التحقق. بنحدّث حالته تلقائيًا بعد إكمال التحقق من البطاقة.",
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
    if (sending.current || !accepted) return;
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
      setSummary(result);
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
          try {
            await verify(payment.id);
          } catch (error) {
            setMessage(error.message);
          }
        },
      });
    } catch (error) {
      setMessage(error.message);
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }
  const amount = checkout?.amount ?? summary?.amountMinor;
  const amountText = Number.isSafeInteger(amount)
    ? (amount / 100).toLocaleString("ar-SA", { minimumFractionDigits: 2 })
    : "—";
  return (
    <section className="container payment-page">
      <div className="breadcrumb">
        <a href="#/activity">حسابي</a>
        <span>/</span>محفظة المشاركة
      </div>
      <div className="payment-heading">
        <div>
          <p className="eyebrow">كل خطوة بثقة</p>
          <h1>محفظة المشاركة</h1>
          <p>راجع مبلغك، وأكمل تأمين مشاركتك في المزاد.</p>
        </div>
        <span className="payment-safe">
          <Icon name="shield" /> اتصال آمن
        </span>
      </div>
      {/* تم التعديل من عبير: المحفظه تعرض مبلغ التامين المرتبط بالمزاد ولا نخترع رصيد قابل للسحب. */}
      <div className="wallet-layout">
        <aside className="wallet-overview">
          <div className="brand-wallet" aria-hidden="true">
            <div className="wallet-card">
              MEZYAD <span>للقيمة أهلها</span>
            </div>
            <div className="wallet-front">
              <Icon name="lock" size={30} />
              <span>محفظة المشاركة</span>
              <b>••••</b>
            </div>
          </div>
          <div className="wallet-balance">
            <p>{success ? "مبلغ مشاركتك المؤكد" : "مبلغ تأمين المشاركة"}</p>
            <strong>
              {amountText} <small>ر.س</small>
            </strong>
            <span
              className={success ? "wallet-status confirmed" : "wallet-status"}
            >
              <i />
              {success
                ? "تم التأكيد"
                : loading
                  ? "جاري جلب التفاصيل"
                  : "بانتظار إكمال العملية"}
            </span>
          </div>
          <p className="wallet-caption">
            المبلغ مرتبط بهذا المزاد، وما يُعتبر رصيدًا عامًا أو دفعة لقيمة
            الأصل.
          </p>
          <div className="wallet-assurances">
            <p>
              <Icon name="lock" /> بيانات بطاقتك ما تنحفظ عندنا
            </p>
            <p>
              <Icon name="shield" /> تأكيد العملية قبل تفعيل المشاركة
            </p>
            <p>
              <Icon name="check" /> راجع التفاصيل قبل المتابعة
            </p>
          </div>
        </aside>
        <section
          className="payment-sheet paper-card"
          aria-label="تفاصيل العملية"
        >
          <div className="payment-section-title">
            <div>
              <p className="eyebrow">تفاصيل العملية</p>
              <h2>{success ? "مشاركتك جاهزة." : "خطوتك للمنافسة."}</h2>
            </div>
            <Icon name={success ? "check" : "lock"} size={26} />
          </div>
          <p className="payment-auction">
            {auctionTitle || "اختر مزادك لعرض تفاصيل التأمين."}
          </p>
          <dl className="payment-summary">
            <div>
              <dt>نوع العملية</dt>
              <dd>تأمين مشاركة في مزاد</dd>
            </div>
            <div>
              <dt>مبلغ التأمين</dt>
              <dd>{amountText} ر.س</dd>
            </div>
            <div>
              <dt>وسيلة الدفع</dt>
              <dd>
                بطاقة بنكية{" "}
                <span className="card-networks" dir="ltr">
                  mada · VISA · Mastercard
                </span>
              </dd>
            </div>
            <div className="payment-total">
              <dt>{success ? "المبلغ المؤكد" : "إجمالي التأمين"}</dt>
              <dd>{amountText} ر.س</dd>
            </div>
          </dl>
          {!market.userId ? (
            <a
              href={
                "#/login?next=" +
                encodeURIComponent("/payment?id=" + (id || ""))
              }
              className="button dark full"
            >
              سجل دخولك للمتابعة <Icon />
            </a>
          ) : !id ? (
            <a className="button dark full" href="#/auctions">
              اختر مزادك <Icon />
            </a>
          ) : (
            <>
              {!success && !paymentId && !checkout && (
                <label className="checkbox-label payment-consent">
                  <input
                    type="checkbox"
                    checked={accepted}
                    onChange={(event) => setAccepted(event.target.checked)}
                  />
                  راجعت تفاصيل العملية، وأفهم أن المبلغ تأمين للمشاركة في هذا
                  المزاد.
                </label>
              )}
              <div ref={mount} className="secure-payment-form" />
              {!success && !paymentId && !checkout && (
                <button
                  className="button dark full payment-submit"
                  disabled={busy || loading || !accepted || market.demo}
                  onClick={check}
                >
                  {busy ? (
                    <>
                      <span className="ui-loader" /> جاري تجهيز الدفع…
                    </>
                  ) : (
                    <>
                      المتابعة للدفع <Icon name="lock" />
                    </>
                  )}
                </button>
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
                  ادخل المنافسة <Icon />
                </a>
              )}
            </>
          )}
          {message && (
            <p role="status" className="inline-notice">
              {message}
            </p>
          )}
          <p className="payment-footnote">
            <Icon name="shield" size={15} /> نؤكد مشاركتك بعد التحقق من العملية.{" "}
            <span>بيئة اختبار · لا تستخدم بطاقة حقيقية.</span>
          </p>
          <a
            className="text-link"
            href={
              id ? "#/commitment?id=" + encodeURIComponent(id) : "#/my-auctions"
            }
          >
            الرجوع لتفاصيل المشاركة <Icon />
          </a>
        </section>
      </div>
    </section>
  );
}
