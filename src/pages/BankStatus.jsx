import React from "react";
import { Icon, dateText } from "../components";
import { auctionLink, useAuction } from "../market";
import {
  AuctionLayout,
  AuctionState,
  AuctionNav,
  SignInGate,
} from "../auction-components";

// تم التعديل من عبير: نقرأ حاله البنك من السيرفر فقط ونتجاهل اي نجاح مكتوب بالرابط.
export default function BankStatus({ market, id }) {
  const state = useAuction(market, id, { commitment: true });
  const bank = state.commitment;
  return (
    <AuctionLayout
      market={market}
      title="خلّ التأكيد من مصدره."
      eyebrow="متابعة الالتزام"
      description="هنا تظهر الحالة المسجلة عند الخادم، مو مجرد رجوع من صفحة البنك."
    >
      <SignInGate market={market}>
        <AuctionState state={state}>
          <AuctionNav id={id} current="commitment" />
          <div className="bank-status-card paper-card">
            <div className="bank-emblem">
              <Icon
                name={bank?.status === "SUCCESS" ? "check" : "clock"}
                size={48}
              />
            </div>
            <p className="eyebrow">
              {market.demo ? "وضع المعاينة" : "آخر حالة من الباك"}
            </p>
            <h2>
              {bank?.status === "SUCCESS"
                ? "وصل تأكيد الالتزام."
                : bank
                  ? "طلبك له حالة مسجلة."
                  : "ما وصل تأكيد التزام."}
            </h2>
            <p>
              {market.demo
                ? "ما ننشئ نجاح بنكي تجريبي. تقدر ترجع للمزاد وتجرب الواجهة بدون اتصال بالبنك."
                : "إذا ما اكتمل الربط البنكي، بتبقى المزايدة الفعلية متوقفة هنا حتى يظهر التزام ناجح."}
            </p>
            {bank && (
              <dl className="spec-list">
                <div>
                  <dt>الحالة</dt>
                  <dd>
                    <bdi>{bank.status}</bdi>
                  </dd>
                </div>
                <div>
                  <dt>وقت الطلب</dt>
                  <dd>{dateText(bank.created_at)}</dd>
                </div>
              </dl>
            )}
            <div className="form-actions">
              <button
                className="button outline"
                onClick={state.reload}
                disabled={state.loading}
              >
                تحديث الحالة <Icon name="refresh" />
              </button>
              <a
                className="button dark"
                href={auctionLink(
                  bank?.status === "SUCCESS" ? "bid" : "commitment",
                  id,
                )}
              >
                {bank?.status === "SUCCESS" ? "للمزايدة" : "ارجع للالتزام"}{" "}
                <Icon />
              </a>
            </div>
          </div>
        </AuctionState>
      </SignInGate>
    </AuctionLayout>
  );
}
