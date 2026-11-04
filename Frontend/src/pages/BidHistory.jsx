import React, { useState } from "react";
import { Icon } from "../components";
import { useAuction } from "../market";
import {
  AuctionLayout,
  AuctionState,
  AuctionNav,
  AuctionSummary,
  SignInGate,
  BidRows,
} from "../auction-components";

// تم التعديل من عبير: نقسم سجل العروض لصفحات ونحدث اول صفحه بدون كشف هويه المزايدين.
export default function BidHistory({ market, id }) {
  const [offset, setOffset] = useState(0);
  const state = useAuction(market, id, { bids: true, offset });
  return (
    <AuctionLayout
      market={market}
      title="كل عرض، له أثر."
      eyebrow="سجل المنافسة"
      description="العروض المقبولة مرتبة من الأحدث، بدون بيانات المزايدين الشخصية."
    >
      <SignInGate market={market}>
        <AuctionState state={state}>
          {state.auction && (
            <>
              <AuctionNav id={id} current="bid-history" />
              <AuctionSummary auction={state.auction} />
              <section className="paper-card history-paper">
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">THE BID LEDGER</p>
                    <h2>سجل العروض</h2>
                  </div>
                  {/* تم التعديل من عبير: تحديث البيانات تلقائي بدون زر اضافي. */}
                </div>
                {offset > 0 && (
                  <p className="inline-notice">
                    قد تتحرك الصفحات مع وصول عروض جديدة. استخدم «السابق» للوصول
                    لأول صفحة ومتابعة الأحدث.
                  </p>
                )}
                <BidRows rows={state.bids} />
                <div className="history-pagination">
                  <button
                    className="button outline"
                    disabled={!offset || state.loading}
                    onClick={() => setOffset((n) => Math.max(0, n - 20))}
                  >
                    السابق
                  </button>
                  <span>صفحة {offset / 20 + 1}</span>
                  <button
                    className="button outline"
                    disabled={state.bids?.length !== 20 || state.loading}
                    onClick={() => setOffset((n) => n + 20)}
                  >
                    التالي
                  </button>
                </div>
              </section>
            </>
          )}
        </AuctionState>
      </SignInGate>
    </AuctionLayout>
  );
}
