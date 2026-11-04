import "./MyAuctions.css";
import { useAutoRefresh } from "../useAutoRefresh";
import React, { useEffect, useRef, useState } from "react";
import { AccountLayout } from "../account-components";
import { Icon, money } from "../components";
import { imageUrl } from "../api";
import { auctionLink, displayStatus, statusLabels } from "../market";

// تم التعديل من عبير: نجيب المزادات المرتبطه بالمستخدم ونفرق بين مشاركته وملكيته من بيانات الباك.
export default function MyAuctions({ market }) {
  const [rows, setRows] = useState([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [filter, setFilter] = useState("ALL"),
    [refresh, setRefresh] = useState(0);
  useAutoRefresh(
    () => setRefresh((n) => n + 1),
    Boolean(market.userId) && !market.demo,
  );
  const latest = useRef(market);
  latest.current = market;
  useEffect(() => {
    if (!market.userId) {
      setRows([]);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(rows.length === 0);
    setError("");
    async function load() {
      try {
        const list = await latest.current.myAuctions(controller.signal);
        const details = [];
        for (const row of list) {
          if (controller.signal.aborted) return;
          try {
            details.push(
              await latest.current.getAuction(row.id, controller.signal),
            );
          } catch (e) {
            if (controller.signal.aborted) return;
            details.push({ ...row, detailsError: e.message });
          }
        }
        if (!controller.signal.aborted) setRows(details);
      } catch (e) {
        if (!controller.signal.aborted) {
          setRows([]);
          setError(e.message);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    load();
    return () => controller.abort();
  }, [market.userId, market.token, market.demo, market.revision, refresh]);
  const visible = rows.filter(
    (a) => filter === "ALL" || (!a.detailsError && displayStatus(a) === filter),
  );
  return (
    <AccountLayout
      workspace={market.workspace}
      active="my-auctions"
      eyebrow="مجالس لها مكان عندك"
      title="مزاداتي ومشاركاتي"
      description="المزادات اللي أنشأتها أو قدمت فيها عرض مقبول، في مكان واحد."
    >
      <section className="paper-card">
        <div className="section-heading">
          <h2>وين وصلت المنافسة؟</h2>
          {/* تم التعديل من عبير: تحديث البيانات تلقائي بدون زر اضافي. */}
        </div>
        <div className="auction-tabs" role="group" aria-label="فلترة مزاداتي">
          {[
            ["ALL", "الكل"],
            ["ACTIVE", "نشطة"],
            ["SCHEDULED", "قادمة"],
            ["CLOSED", "منتهية"],
          ].map(([value, label]) => (
            <button
              key={value}
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
        {loading ? (
          <p role="status">نجمع لك مجالسك…</p>
        ) : error ? (
          <p role="alert" className="form-error">
            {error}
          </p>
        ) : !visible.length ? (
          <div className="empty-box">
            <Icon name="gavel" size={38} />
            <h3>ما فيه مزادات بهالقائمة.</h3>
            <p>إذا أنشأت مزاد أو انقبل عرضك، تلقاه هنا.</p>
            <a className="button dark" href="#/auctions">
              استكشف المزادات <Icon />
            </a>
          </div>
        ) : (
          <div className="participation-list">
            {visible.map((a) => (
              <article key={a.id}>
                <div className="participation-image">
                  {a.images?.[0] ? (
                    <img src={imageUrl(a.images[0])} alt={a.title} />
                  ) : (
                    <Icon name="gavel" size={40} />
                  )}
                </div>
                <div>
                  <small>
                    {a.seller_id === market.userId
                      ? "أنت صاحب المزاد"
                      : a.participation?.hasBid
                        ? "شاركت في المزاد"
                        : "مزاد مرتبط بحسابك"}
                  </small>
                  <h3>{a.title}</h3>
                  {a.detailsError ? (
                    <p role="alert">
                      تعذر تحديث التفاصيل. افتح المزاد وحاول من جديد.
                    </p>
                  ) : (
                    <>
                      <p>
                        {statusLabels[displayStatus(a)]} ·{" "}
                        {a.visibility === "PRIVATE" ? "خاص" : "عام"}
                      </p>
                      {a.participation?.hasBid && (
                        <p>
                          عروضك: {a.participation.bidCount} · أعلى عرض لك:{" "}
                          {money(a.participation.highestBid)} ر.س
                        </p>
                      )}
                    </>
                  )}
                </div>
                <a
                  className="button outline"
                  href={auctionLink(
                    !a.detailsError && displayStatus(a) === "CLOSED"
                      ? "auction-result"
                      : "auction",
                    a.id,
                  )}
                >
                  {!a.detailsError && displayStatus(a) === "CLOSED"
                    ? "النتيجة"
                    : "افتح المزاد"}{" "}
                  <Icon />
                </a>
              </article>
            ))}
          </div>
        )}
      </section>
    </AccountLayout>
  );
}
