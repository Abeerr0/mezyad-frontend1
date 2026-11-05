import React from "react";
import { Icon, dateText } from "../components";
import { commitmentLabel, auctionLink, useAuction } from "../market";
import {
  AuctionLayout,
  AuctionState,
  AuctionNav,
  SignInGate,
} from "../auction-components";

// تم التعديل من عبير: نقرأ حاله البنك من السيرفر فقط ونتجاهل اي نجاح مكتوب بالرابط.
export default function BankStatus({ market, id }) {
  const state = useAuction(market, id, {
    commitment: true,
  });
  const bank = state.commitment;
  return (
    <AuctionLayout
      market={market}
      title={"وين وصل التزامك؟"}
      eyebrow={"متابعة الالتزام"}
      description={"تابع حالة التزامك، واعرف متى تقدر تدخل المنافسة"}
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
            <p className="eyebrow">حالة الالتزام</p>
            <h2>
              {bank?.status === "SUCCESS"
                ? "وصل تأكيد الالتزام"
                : bank
                  ? "طلبك له حالة مسجلة"
                  : "ما وصل تأكيد التزام"}
            </h2>
            <p>
              {market.demo
                ? "طلب الالتزام غير متاح في نسخة التجربة"
                : "بعد تأكيد الالتزام، تقدر تنتقل للمزاد وتقدّم عرضك"}
            </p>
            {bank && (
              <dl className="spec-list">
                <div>
                  <dt>الحالة</dt>
                  <dd>
                    <bdi>{commitmentLabel(bank.status)}</bdi>
                  </dd>
                </div>
                <div>
                  <dt>وقت الطلب</dt>
                  <dd>{dateText(bank.created_at)}</dd>
                </div>
              </dl>
            )}
            <div className="form-actions">
              {/* تم التعديل من عبير: تحديث البيانات تلقائي بدون زر اضافي. */}
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
