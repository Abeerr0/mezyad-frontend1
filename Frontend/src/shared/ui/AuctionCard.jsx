import { money, statusLabels } from "./formatters.js";
// تم التعديل من عبير: كرت مشترك لصوره المزاد وسعره وحالته ورابط تفاصيله
import React, { useEffect, useState } from "react";
import { Icon } from "./Icon.jsx";
export function AuctionCard({ auction, onOpen }) {
  // تم التعديل من عبير: نتنقل بين صور الاصل على البطاقه بدون فتح التفاصيل.
  const photos = [
    ...new Set(
      [
        auction.image_url,
        ...(auction.images || []).map((p) =>
          typeof p === "string" ? p : p.image_url,
        ),
      ].filter(Boolean),
    ),
  ];
  const [photo, setPhoto] = useState(0);
  const [hovering, setHovering] = useState(false);
  useEffect(() => {
    if (
      !hovering ||
      photos.length < 2 ||
      matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const t = setInterval(() => setPhoto((n) => (n + 1) % photos.length), 2200);
    return () => clearInterval(t);
  }, [hovering, photos.length]);
  return (
    <article
      className="auction-card"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      <button
        className="card-photo"
        onClick={() => onOpen(auction)}
        aria-label={"عرض " + auction.title}
      >
        <span className="photo-placeholder" aria-hidden="true">
          <Icon name="image" size={40} />
          <span>الصورة غير متاحة</span>
        </span>
        {auction.image_url ? (
          <img
            src={photos[photo % photos.length]}
            alt={auction.title}
            loading="lazy"
            onError={(e) => {
              e.currentTarget.hidden = true;
            }}
          />
        ) : null}
        <span className={"status-tag " + auction.status.toLowerCase()}>
          <i />
          {statusLabels[auction.status] || auction.status}
        </span>
        <span className="photo-arrow">
          <Icon />
        </span>
      </button>
      {photos.length > 1 && (
        <div className="card-gallery" aria-label={"صور المزاد"}>
          {photos.map((p, i) => (
            <button
              key={p}
              aria-label={"الصوره " + (i + 1)}
              aria-pressed={photo === i}
              onClick={() => setPhoto(i)}
            />
          ))}
        </div>
      )}
      <div className="card-category">{auction.categoryLabel}</div>
      <h3>
        <button onClick={() => onOpen(auction)}>{auction.title}</button>
      </h3>
      <div className="card-price">
        <span>{auction.bid_count ? "أعلى عرض حالي" : "سعر البداية"}</span>
        <strong>
          {money(auction.current_price)} <small>ريال</small>
        </strong>
      </div>
      <div className="card-bottom">
        <span>
          <Icon name="clock" size={15} />
          {auction.status === "CLOSED"
            ? "انتهى المزاد"
            : auction.status === "SCHEDULED"
              ? "لم يبدأ بعد"
              : "مزاد نشط"}
        </span>
        <span>{money(auction.bid_count)} عروض</span>
      </div>
      <button
        className="button outline card-details"
        onClick={() => onOpen(auction)}
      >
        التفاصيل <Icon />
      </button>
    </article>
  );
}
