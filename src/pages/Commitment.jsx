import React, { useRef, useState } from "react";
import { Icon } from "../components";
import {
  commitmentLabel,
  auctionLink,
  useAuction,
  displayStatus,
} from "../market";
import {
  AuctionLayout,
  AuctionState,
  AuctionNav,
  AuctionSummary,
  SignInGate,
} from "../auction-components";

// تم التعديل من عبير: نطلب الالتزام من الباك ولا نعرض نجاح بنكي من بيانات المعاينه.
export default function Commitment({ market, id }) {
  const state = useAuction(market, id, { commitment: true });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const sending = useRef(false);
  const a = state.auction,
    approved = state.commitment?.status === "SUCCESS";
  async function start() {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    setMessage("");
    try {
      await market.commit(id);
      state.reload();
      setMessage("تم إرسال طلبك. تابع حالة الالتزام هنا.");
    } catch (err) {
      setMessage(err.message);
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }
  return (
    <AuctionLayout
      market={market}
      title="منافسة لها التزام."
      eyebrow="قبل العرض"
      description="شوف حالة التزامك لهذا المزاد، وخلك على بينة بكل خطوة."
    >
      <SignInGate market={market}>
        <AuctionState state={state}>
          {a && (
            <>
              <AuctionNav id={id} current="commitment" />
              <AuctionSummary auction={a} />
              <div className="commitment-grid">
                <section className="paper-card">
                  <div className="bank-emblem">
                    <Icon name="shield" size={45} />
                  </div>
                  <h2>{approved ? "التزامك موثّق." : "نبدأ من التحقق."}</h2>
                  <p>
                    التزامك يخص هذا المزاد. بعد تأكيده تقدر تقدّم عرضك وتدخل
                    المنافسة.
                  </p>
                  <ol className="bank-steps">
                    <li>
                      <b>01</b>
                      <div>
                        <h3>اطلب الالتزام</h3>
                        <p>ابدأ طلب الالتزام الخاص بهذا المزاد.</p>
                      </div>
                    </li>
                    <li>
                      <b>02</b>
                      <div>
                        <h3>انتظر التحقق</h3>
                        <p>تابع حالة طلبك إلى أن يصلك التأكيد.</p>
                      </div>
                    </li>
                    <li>
                      <b>03</b>
                      <div>
                        <h3>ارجع للمزايدة</h3>
                        <p>بعد التأكيد، قدم عرضك ضمن شروط المزاد.</p>
                      </div>
                    </li>
                  </ol>
                </section>
                <aside className="auction-ticket">
                  <p className="eyebrow">حالة الطلب</p>
                  <h2>
                    {approved
                      ? "جاهز للمشاركة"
                      : state.commitment
                        ? "طلب مسجل"
                        : "ما فيه التزام مؤكد"}
                  </h2>
                  {state.commitment && (
                    <p>
                      حالة التزامك:{" "}
                      <bdi>{commitmentLabel(state.commitment.status)}</bdi>
                    </p>
                  )}
                  {market.demo && (
                    <p className="inline-notice">
                      طلب الالتزام غير متاح في نسخة التجربة.
                    </p>
                  )}
                  {a.seller_id === market.userId ? (
                    <p>ما تحتاج التزام كمزايد لأنك صاحب المزاد.</p>
                  ) : displayStatus(a) === "CLOSED" ? (
                    <p>انتهى المزاد، وما عاد يقبل التزام جديد.</p>
                  ) : approved ? (
                    <a
                      className="button dark full"
                      href={auctionLink("bid", id)}
                    >
                      قدّم عرضك <Icon />
                    </a>
                  ) : (
                    <button
                      className="button dark full"
                      onClick={start}
                      disabled={busy || Boolean(state.error)}
                    >
                      {busy ? "ننتظر الرد…" : "طلب الالتزام"}{" "}
                      <Icon name="shield" />
                    </button>
                  )}
                  {message && (
                    <p className="inline-notice" role="status">
                      {message}
                    </p>
                  )}
                  <a
                    className="button outline full"
                    href={auctionLink("bank-status", id)}
                  >
                    تحقق من حالة البنك
                  </a>
                  <p className="field-hint">
                    طلب الالتزام ما يعني دفع قيمة الأصل.
                  </p>
                </aside>
              </div>
            </>
          )}
        </AuctionState>
      </SignInGate>
    </AuctionLayout>
  );
}
