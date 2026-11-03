import React, { useRef, useState } from "react";
import { Icon, money } from "../components";
import {
  auctionLink,
  cents,
  newRequestId,
  minimumBid,
  displayStatus,
  useAuction,
} from "../market";
import {
  AuctionLayout,
  AuctionState,
  AuctionNav,
  AuctionSummary,
  SignInGate,
  BidRows,
} from "../auction-components";

// تم التعديل من عبير: نفس العرض يحتفظ برقم طلبه اذا انقطع الاتصال عشان ما ينحفظ مرتين.
export default function Bidding({ market, id }) {
  const state = useAuction(market, id, { bids: true, commitment: true });
  const key = "mezyad-bid-attempt:" + market.userId + ":" + id;
  const [attempt, setAttempt] = useState(() => {
    if (market.demo) return null;
    try {
      const saved = JSON.parse(sessionStorage.getItem(key));
      return saved &&
        typeof saved.requestId === "string" &&
        cents(saved.amount) > 0
        ? saved
        : null;
    } catch {
      return null;
    }
  });
  const [amount, setAmount] = useState(""),
    [review, setReview] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(null);
  const sending = useRef(false);
  const a = state.auction;
  const minimum = minimumBid(a, state.bids);
  const owner = a?.seller_id === market.userId;
  const bankReady = market.demo || state.commitment?.status === "SUCCESS";
  const allowed =
    a &&
    displayStatus(a) === "ACTIVE" &&
    !owner &&
    bankReady &&
    !state.error &&
    !state.loading &&
    minimum !== null &&
    minimum <= 99999999999999;
  function remember(value) {
    if (!market.demo) {
      if (value) {
        try {
          sessionStorage.setItem(key, JSON.stringify(value));
        } catch {
          throw new Error(
            "التخزين غير متاح. فعله عشان نحفظ رقم العرض قبل ارساله.",
          );
        }
      } else {
        try {
          sessionStorage.removeItem(key);
        } catch {
          /* تم التعديل من عبير: لو فشل مسح الرقم يبقى امن من تكرار الطلب. */
        }
      }
    }
    setAttempt(value);
  }
  function prepare(event) {
    event.preventDefault();
    setError("");
    setSuccess(null);
    if (!allowed || attempt) return;
    const value = cents(amount);
    if (value === null || value < minimum || value <= 0) {
      setError(
        "راجع المبلغ. أقل عرض الآن " +
          money(minimum / 100) +
          " ر.س، وبمنزلتين عشريتين كحد أقصى.",
      );
      return;
    }
    setReview(true);
  }
  async function send(retry = false) {
    if (sending.current) return;
    if (!retry && (!allowed || cents(amount) < minimum)) {
      setReview(false);
      setError("تغير السعر. راجع الحد الجديد قبل التأكيد.");
      return;
    }
    sending.current = true;
    setBusy(true);
    setError("");
    let current = attempt;
    try {
      if (!current) {
        current = {
          amount: (cents(amount) / 100).toFixed(2),
          requestId: newRequestId(),
        };
        remember(current);
      }
      const result = await market.bid(id, current.amount, current.requestId);
      remember(null);
      setSuccess(result);
      setReview(false);
      setAmount("");
      state.reload();
    } catch (err) {
      setError(err.message);
      setReview(false);
      if (!err.uncertain && err.code !== "DUPLICATE_REQUEST") {
        try {
          remember(null);
        } catch {
          setError(
            "تعذر حفظ حالة الطلب في المتصفح. راجع سجل العروض قبل المحاولة.",
          );
        }
      }
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }
  return (
    <AuctionLayout
      market={market}
      title="ارفع عرضك، عن قناعة."
      eyebrow="خطوة محسوبة"
      description="خذ قرارك على بيّنة. راجع آخر سعر ومبلغ عرضك قبل التأكيد."
    >
      <SignInGate market={market}>
        <AuctionState state={state}>
          {a && (
            <>
              <AuctionNav id={id} current="bid" />
              <AuctionSummary auction={a} />
              <div className="bidding-grid">
                <section className="bid-console">
                  <span className="live-indicator">
                    <i /> تحديث كل 4 ثواني
                  </span>
                  <p>السعر الحالي</p>
                  <div className="live-price">
                    {money(a.current_price)} <small>ر.س</small>
                  </div>
                  <div className="bid-metrics">
                    <div>
                      <small>أقل عرض متاح</small>
                      <strong>
                        {minimum !== null ? money(minimum / 100) : "—"} ر.س
                      </strong>
                    </div>
                    <div>
                      <small>أقل زيادة</small>
                      <strong>{money(a.minimum_increment)} ر.س</strong>
                    </div>
                  </div>
                  {market.demo && (
                    <p className="demo-bid-note">
                      عرض تجريبي — ما يدخل في مزاد فعلي.
                    </p>
                  )}
                  {owner ? (
                    <p className="inline-notice">
                      هذا أصلك. المالك ما يقدر يزايد عليه.
                    </p>
                  ) : displayStatus(a) !== "ACTIVE" ? (
                    <p className="inline-notice">
                      المزاد مو مفتوح الآن. راجع التفاصيل أو النتيجة.
                    </p>
                  ) : !bankReady ? (
                    <div className="inline-notice">
                      <p>تحتاج التزام بنكي ناجح لهذا المزاد قبل تقديم العرض.</p>
                      <a
                        className="button outline"
                        href={auctionLink("commitment", id)}
                      >
                        راجع الالتزام <Icon name="shield" />
                      </a>
                    </div>
                  ) : null}
                  {attempt ? (
                    <div className="attempt-notice">
                      <h3>عندك طلب يحتاج تحقق.</h3>
                      <p>
                        المبلغ: {money(attempt.amount)} ر.س. راجع السجل أول.
                        إعادة المحاولة تستخدم نفس رقم الطلب لمنع التكرار.
                      </p>
                      <div className="form-actions">
                        <button
                          className="button outline"
                          disabled={busy || Boolean(state.error)}
                          onClick={() => send(true)}
                        >
                          تحقق بإعادة نفس الطلب
                        </button>
                        <a
                          className="text-link"
                          href={auctionLink("bid-history", id)}
                        >
                          شوف سجل العروض
                        </a>
                      </div>
                      <button
                        className="text-link"
                        disabled={busy}
                        onClick={() => {
                          try {
                            remember(null);
                            setError("");
                          } catch {
                            setError("تعذر تحديث التخزين.");
                          }
                        }}
                      >
                        راجعت السجل، ابدأ عرض جديد
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={prepare}>
                      <label className="field">
                        <span>عرضك بالريال السعودي</span>
                        <input
                          dir="ltr"
                          inputMode="decimal"
                          value={amount}
                          onChange={(e) => {
                            setAmount(e.target.value);
                            setReview(false);
                            setSuccess(null);
                          }}
                          disabled={!allowed || busy}
                          placeholder={
                            minimum !== null
                              ? (minimum / 100).toFixed(2)
                              : "0.00"
                          }
                        />
                      </label>
                      <button
                        type="button"
                        className="text-link"
                        disabled={!allowed || busy}
                        onClick={() => {
                          setAmount((minimum / 100).toFixed(2));
                          setReview(false);
                        }}
                      >
                        استخدم أقل عرض متاح
                      </button>
                      {review ? (
                        <div className="bid-confirmation">
                          <h3>تأكد قبل ما ترفع يدك.</h3>
                          <p>
                            بتقدم عرض بقيمة <strong>{money(amount)} ر.س</strong>{" "}
                            على «{a.title}».
                          </p>
                          <p>تأكد من مبلغك؛ ما تقدر تلغي العرض بعد قبوله.</p>
                          <div className="form-actions">
                            <button
                              type="button"
                              className="button gold"
                              disabled={!allowed || busy}
                              onClick={() => send()}
                            >
                              {busy ? "ننتظر التأكيد…" : "تأكيد العرض"}{" "}
                              <Icon name="gavel" />
                            </button>
                            <button
                              type="button"
                              className="button outline"
                              disabled={busy}
                              onClick={() => setReview(false)}
                            >
                              تعديل المبلغ
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          className="button gold full"
                          disabled={!allowed || busy}
                        >
                          راجع عرضك <Icon />
                        </button>
                      )}
                    </form>
                  )}
                  {error && (
                    <p className="form-error" role="alert">
                      {error}
                    </p>
                  )}
                  {success && (
                    <div className="bid-success" role="status">
                      <Icon name="check" />
                      <h3>
                        {market.demo
                          ? "تم قبول عرضك في التجربة."
                          : "وصل تأكيد قبول عرضك."}
                      </h3>
                      <p>
                        {money(success.amount)} ر.س — تابع المنافسة، والنتيجة
                        تظهر بعد إغلاق المزاد.
                      </p>
                      <a href={auctionLink("my-auctions", id)}>تابع مزاداتك</a>
                    </div>
                  )}
                </section>
                <section className="paper-card">
                  <p className="eyebrow">حركة المجلس</p>
                  <h2>آخر العروض</h2>
                  <BidRows rows={state.bids?.slice(0, 5)} />
                  <a
                    className="text-link"
                    href={auctionLink("bid-history", id)}
                  >
                    السجل كامل <Icon />
                  </a>
                </section>
              </div>
            </>
          )}
        </AuctionState>
      </SignInGate>
    </AuctionLayout>
  );
}
