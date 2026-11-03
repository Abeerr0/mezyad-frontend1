import React, { useState } from "react";
import {
  AccountLayout,
  ResourceState,
  listingLabels,
} from "../account-components";
import { Auctioneer, Icon, dateText, statusLabels } from "../components";

// تم التعديل من عبير: نحسب الملخص من بيانات الحساب الفعليه بدون ارقام ثابته في وضع API.
export default function Activity({ workspace, onOpen }) {
  const [filter, setFilter] = useState("");
  const { items, auctions } = workspace;
  const stats = [
    ["كل إعلاناتك", items.length, "image"],
    [
      "قيد المراجعة",
      items.filter((i) => i.status === "PENDING_REVIEW").length,
      "clock",
    ],
    ["معتمدة", items.filter((i) => i.status === "APPROVED").length, "check"],
    [
      "تحتاج تعديل",
      items.filter((i) => i.status === "REJECTED").length,
      "refresh",
    ],
  ];
  const shown = auctions.filter((a) => !filter || a.status === filter);
  return (
    <AccountLayout
      workspace={workspace}
      active="activity"
      eyebrow="حيّاك في مجلسك"
      title="كل اللي يهمك، هنا."
      description="تابع إعلاناتك ومزاداتك، واعرف خطوتك الجاية."
    >
      <ResourceState workspace={workspace}>
        <div className="activity-welcome">
          <div>
            <span className="eyebrow">البداية من عندك</span>
            <h2>عندك أصل يستحق؟</h2>
            <p>جهّز تفاصيله وصوره، وخلّ مزياد يجمع له المهتمين.</p>
            <a href="#/create-listing" className="button dark">
              اعرض أصلك <Icon name="plus" />
            </a>
          </div>
          <Auctioneer character="collector" motion="bid" />
        </div>
        <div className="stat-grid">
          {stats.map(([label, value, icon]) => (
            <div className="stat-card" key={label}>
              <Icon name={icon} />
              <strong>{value.toLocaleString("ar-SA")}</strong>
              <span>{label}</span>
            </div>
          ))}
        </div>
        {items.some((i) => i.status === "REJECTED") && (
          <a href="#/listings?status=REJECTED" className="attention-note">
            <Icon name="refresh" />
            <span>
              <strong>عندك إعلان يحتاج تعديل</strong>
              <small>شوف سبب الرفض، وعدّل التفاصيل ثم أعد إرساله.</small>
            </span>
            <Icon />
          </a>
        )}
        <section className="paper-card">
          <div className="section-heading">
            <div>
              <span className="section-number">01</span>
              <h2>مزاداتك ومشاركاتك</h2>
            </div>
            <button className="text-link" onClick={workspace.reload}>
              تحديث <Icon name="refresh" size={16} />
            </button>
          </div>
          <div className="filter-tabs" aria-label="فلترة مزاداتي">
            {[
              ["", "الكل"],
              ["ACTIVE", "نشطة"],
              ["SCHEDULED", "قادمة"],
              ["CLOSED", "منتهية"],
            ].map(([value, text]) => (
              <button
                key={value}
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
              >
                {text}
              </button>
            ))}
          </div>
          {!shown.length ? (
            <div className="empty-box compact">
              <Icon name="gavel" size={35} />
              <h3>المجلس ينتظر مشاركتك</h3>
              <p>
                {filter
                  ? "ما عندك مزادات بهالحالة."
                  : "إذا أنشأت مزاد أو شاركت فيه، تلقاه هنا."}
              </p>
              <a className="text-link" href="#/auctions">
                استكشف المزادات <Icon />
              </a>
            </div>
          ) : (
            <div className="activity-list">
              {shown.map((auction) => (
                <article key={auction.id}>
                  <div className="activity-icon">
                    <Icon
                      name={auction.visibility === "PRIVATE" ? "lock" : "gavel"}
                    />
                  </div>
                  <div>
                    <h3>{auction.title}</h3>
                    <p>ينتهي: {dateText(auction.end_time)}</p>
                  </div>
                  <span
                    className={"status-tag " + auction.status.toLowerCase()}
                  >
                    {statusLabels[auction.status]}
                  </span>
                  <button
                    className="icon-button"
                    aria-label={"عرض " + auction.title}
                    onClick={() => onOpen(auction)}
                  >
                    <Icon />
                  </button>
                </article>
              ))}
            </div>
          )}
          <p className="field-hint">
            افتح أي مزاد لمتابعة تفاصيله، وراجع النتيجة بعد الإغلاق.
          </p>
        </section>
        <section className="paper-card">
          <div className="section-heading">
            <div>
              <span className="section-number">02</span>
              <h2>آخر إعلاناتك</h2>
            </div>
            <a className="text-link" href="#/listings">
              عرض الكل <Icon size={16} />
            </a>
          </div>
          {!items.length ? (
            <p>ما عندك إعلانات للحين. ابدأ بأول أصل عندك.</p>
          ) : (
            items.slice(0, 3).map((item) => (
              <a
                className="listing-summary"
                key={item.id}
                href={"#/listings?item=" + encodeURIComponent(item.id)}
              >
                <span>{item.title}</span>
                <span className={"status-tag " + item.status.toLowerCase()}>
                  {listingLabels[item.status]}
                </span>
                <Icon size={17} />
              </a>
            ))
          )}
        </section>
      </ResourceState>
    </AccountLayout>
  );
}
