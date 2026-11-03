import React from "react";
import { Icon, Auctioneer, money, dateText } from "../components";
import { auctionLink, useAuction, displayStatus } from "../market";
import { AuctionLayout, AuctionState, AuctionNav } from "../auction-components";

// تم التعديل من عبير: النتيجه من السيرفر فقط، وما نعلن فوز من السعر او انتهاء العداد.
export default function AuctionResult({ market, id }) {
  const state = useAuction(market, id);
  const a = state.auction,
    r = a?.result;
  const closed = a && displayStatus(a) === "CLOSED";
  const title = !closed
    ? "المجلس لسه ما انتهى."
    : !r
      ? "ننتظر اعتماد النتيجة."
      : !r.winner_bid_id
        ? "انتهى المجلس بدون عروض."
        : r.isWinner === true
          ? "مبروك، عرضك هو الأعلى."
          : "انتهت المنافسة.";
  return (
    <AuctionLayout
      market={market}
      title="وكل مجلس، له ختام."
      eyebrow="نتيجة المزاد"
      description="تابع نتيجة مشاركتك بعد إغلاق المزاد."
    >
      <AuctionState state={state}>
        {a && (
          <>
            <AuctionNav id={id} current="auction-result" />
            <section
              className={"result-paper " + (r?.isWinner ? "is-winner" : "")}
            >
              <div className="result-illustration">
                <Auctioneer
                  character="collector"
                  motion={r?.isWinner ? "celebrate" : "inspect"}
                />
              </div>
              <p className="eyebrow">
                {closed ? "THE FINAL CALL" : "THE AUCTION CONTINUES"}
              </p>
              <h2>{title}</h2>
              <h3>{a.title}</h3>
              {r?.winner_bid_id && (
                <div className="winning-price">
                  <small>العرض الفائز</small>
                  <strong>
                    {money(r.winning_amount)} <span>ر.س</span>
                  </strong>
                </div>
              )}
              {closed && !r && (
                <p>
                  انتهاء الموعد ما يكفي لإعلان الفائز. بنعرض النتيجة لما يرجع
                  سجل الإغلاق.
                </p>
              )}
              {r?.closed_at && (
                <p>وقت الإغلاق — الرياض: {dateText(r.closed_at)}</p>
              )}
              {r?.isWinner === false && a.participation?.hasBid && (
                <p>شاركت بالمجلس، لكن عرضك ما كان العرض الفائز.</p>
              )}
              {r?.winner_bid_id && !market.userId && (
                <p>سجّل دخولك عشان تعرف نتيجة مشاركتك.</p>
              )}
              {r?.isWinner && (
                <a className="pay-trigger" href="#/payment">
                  مراجعة الدفع <Icon name="lock" />
                </a>
              )}
              <p className="result-footnote">
                هذي نتيجة المنافسة. الدفع ونقل الملكية ما يتمّون من خلال الموقع
                حاليًا.
              </p>
              <div className="form-actions">
                <a
                  className="button dark"
                  href={auctionLink(closed ? "bid-history" : "auction", id)}
                >
                  {closed ? "راجع سجل العروض" : "ارجع للمزاد"} <Icon />
                </a>
                <a className="button outline" href="#/auctions">
                  اكتشف مجلس جديد
                </a>
              </div>
            </section>
          </>
        )}
      </AuctionState>
    </AuctionLayout>
  );
}
