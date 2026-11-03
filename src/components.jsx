import React, { useEffect, useRef, useState } from "react";

export function Icon({ name = "arrow", size = 20, ...props }) {
  const paths = {
    arrow: "M19 12H5m6-6-6 6 6 6",
    search: "m21 21-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
    shield: "M12 3 3 7v5c0 5 9 9 9 9s9-4 9-9V7l-9-4Zm-4 9 3 3 5-6",
    gavel: "m13 3 8 8-3 3-8-8 3-3Zm-2 8-8 8m-1 2h12m-5-13 8 8",
    flag: "M5 21V3m0 1c5-4 9 4 15 0v10c-6 4-10-4-15 0",
    image: "M3 3h18v18H3V3Zm0 13 6-6 6 6 3-3 3 3M15 7h.01",
    clock: "M12 7v5l3 2M22 12A10 10 0 1 1 2 12a10 10 0 0 1 20 0",
    user: "M20 21v-2a6 6 0 0 0-6-6h-4a6 6 0 0 0-6 6v2M16 6a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
    plus: "M12 5v14M5 12h14",
    close: "m6 6 12 12M6 18 18 6",
    chevron: "m6 9 6 6 6-6",
    check: "m5 12 4 4L19 6",
    menu: "M4 6h16M4 12h16M4 18h16",
    lock: "M6 10h12v11H6V10Zm2 0V7a4 4 0 0 1 8 0v3m-4 5v2",
    refresh:
      "M20 7v5h-5M4 17v-5h5M5 7a8 8 0 0 1 13-2l2 3M4 16l2 3a8 8 0 0 0 13-2",
    globe:
      "M22 12A10 10 0 1 1 2 12a10 10 0 0 1 20 0ZM2 12h20M12 2c-5 6-5 14 0 20 5-6 5-14 0-20",
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d={paths[name] || paths.arrow} />
    </svg>
  );
}

// تم التعديل من عبير: لكل شخصيه لبسها وحركتها حسب مكانها بالمزاد، بدون مكتبه اضافيه.
export function Auctioneer({
  small = false,
  character = "auctioneer",
  motion = "gavel",
}) {
  const woman = ["collector", "curator"].includes(character);
  const outfit =
    character === "curator"
      ? "#806344"
      : character === "expert"
        ? "#d5c4a4"
        : woman
          ? "#34392e"
          : "#f8f3e6";
  return (
    <svg
      className={`auctioneer mascot-${motion} ${small ? "small" : ""}`}
      viewBox="0 0 300 300"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <ellipse
        cx="150"
        cy="277"
        rx="100"
        ry="11"
        fill="#262b22"
        opacity=".12"
      />
      <g
        className="mascot-body"
        stroke="#252820"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M90 270 108 166h83l22 104Z" fill={outfit} />
        <path d="m121 178 28 22 27-22m-27 22v68" stroke="#c5ac7c" />
        <path
          d="M108 177 83 205 62 184 49 197c19 32 41 32 61 9"
          fill={outfit}
        />
        <path d="m62 184-6-12c-5-10-21-3-16 8l9 17" fill="#ca926c" />
        <path d="M117 273h24m19 0h30" strokeWidth="8" />
        <g className="mascot-head">
          {/* تم التعديل من عبير: الخبير بنظاره والمنسقه ببروش نجمه عشان تتميز كل شخصيه. */}
          {woman && (
            <path
              d="M99 91c0-73 103-73 103 0l9 85-26-12h-69l-26 12Z"
              fill="#34392e"
            />
          )}
          <path
            d="M109 91c0-45 81-45 81 0v45c0 27-81 27-81 0Z"
            fill="#ca926c"
          />
          {woman ? (
            <>
              <path
                d="M99 97c-3-69 101-70 102-1l-13-9-12-26c-11 15-31 24-63 26l-9 64-10 15Z"
                fill="#34392e"
              />
              <path d="m187 89 7 65-17 16-27 15-30-19" stroke="#c5ac7c" />
              <path d="m124 100 6 3m40-3-5 3" />
            </>
          ) : (
            <>
              <path
                d="M101 95 114 58c11-28 62-29 75 0l12 38-13-7-12-24h-49l-14 26Z"
                fill="#f7f1df"
              />
              <path d="M115 62c22-12 46-12 69 0" strokeWidth="8" />
              <path
                d="M109 98v52l-13 21 26-7 4-56m63-10v54l13 20-27-7-4-56"
                fill="#f7f1df"
              />
              <path d="M126 128c9-5 14-5 23-1 8-4 14-4 23 1" strokeWidth="4" />
            </>
          )}
          {character === "expert" && (
            <g>
              <circle cx="131" cy="106" r="12" />
              <circle cx="166" cy="106" r="12" />
              <path d="M143 106h11" />
            </g>
          )}
          {character === "curator" && (
            <path
              d="m187 151 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z"
              fill="#b18a4b"
            />
          )}
          <g className="mascot-eyes">
            <path d="M128 105h5m32 0h5" strokeWidth="5" />
          </g>
          <path d="m148 107-2 15h7m-17 12c8 8 18 8 26 0" />
        </g>
        <g className="mascot-arm">
          <path d="m199 181 35-44-13-12-37 35" fill={outfit} />
          <path d="m220 133 11-18c8-12 24-2 17 10l-13 17" fill="#ca926c" />
          {motion === "inspect" ? (
            <>
              <path d="m239 119 10-24" strokeWidth="7" />
              <circle
                cx="257"
                cy="76"
                r="24"
                fill="#eee8d7"
                fillOpacity=".9"
                strokeWidth="5"
              />
              <path d="m246 72 6 6 13-14" stroke="#b18a4b" />
            </>
          ) : motion === "bid" ? (
            <>
              <path d="M239 119V86" strokeWidth="7" />
              <rect
                x="218"
                y="39"
                width="44"
                height="51"
                rx="17"
                fill="#b18a4b"
              />
              <path d="M232 73V56l8-4v21m-12 0h19" stroke="#f8f3e6" />
            </>
          ) : motion === "celebrate" ? (
            <>
              <path d="m239 118 7-34" strokeWidth="6" />
              <path
                d="m247 36 8 15 17 3-12 12 2 17-15-8-15 8 3-17-13-12 18-3Z"
                fill="#b18a4b"
              />
            </>
          ) : (
            <>
              <path d="m242 119 25-57" strokeWidth="8" />
              <rect
                x="238"
                y="47"
                width="45"
                height="23"
                rx="5"
                transform="rotate(24 238 47)"
                fill="#b18a4b"
              />
            </>
          )}
        </g>
      </g>
      <g
        className="mascot-flourish"
        stroke="#b18a4b"
        strokeWidth="3"
        strokeLinecap="round"
      >
        <path d="M55 64v20m-10-10h20m163 138v16m-8-8h16" />
        {motion === "celebrate" && (
          <path d="m33 121 9-6m29 118 5-9m169 3 9 9M199 36l3-10" />
        )}
      </g>
    </svg>
  );
}

export const money = (value) =>
  new Intl.NumberFormat("ar-SA", { maximumFractionDigits: 2 }).format(
    Number(value || 0),
  );
export const dateText = (value) =>
  new Intl.DateTimeFormat("ar-SA", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Riyadh",
  }).format(new Date(value));
export const statusLabels = {
  ACTIVE: "جارٍ الآن",
  SCHEDULED: "قريبًا",
  CLOSED: "منتهٍ",
};

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
        <div className="card-gallery" aria-label="صور المزاد">
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
          {money(auction.current_price)} <small>ر.س</small>
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

export function StatePanel({ loading, error, onRetry }) {
  if (loading)
    return (
      <div
        className="skeleton-grid"
        aria-label="جاري تحميل المزادات"
        role="status"
      >
        {[1, 2, 3].map((n) => (
          <div className="skeleton-card" key={n}>
            <div />
            <span />
            <span />
          </div>
        ))}
      </div>
    );
  if (error)
    return (
      <div className="state-panel" role="alert">
        <Icon name="globe" size={32} />
        <h3>ما قدرنا نحمّل المزادات</h3>
        <p>{error}</p>
        <div className="button-row">
          <button className="button dark" onClick={onRetry}>
            <Icon name="refresh" />
            إعادة المحاولة
          </button>
        </div>
      </div>
    );
  return null;
}

// تم التعديل من عبير: نستخدم نافذه تدعم الكيبورد وترجع التركيز للزر بعد الاغلاق.
export function Modal({ title, children, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    const dialog = ref.current;
    dialog.showModal();
    return () => {
      dialog.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby="modal-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <button
        className="icon-button modal-close"
        onClick={onClose}
        aria-label="إغلاق"
      >
        <Icon name="close" />
      </button>
      <h2 id="modal-title">{title}</h2>
      {children}
    </dialog>
  );
}
