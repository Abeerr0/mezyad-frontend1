import React, { useEffect, useRef } from "react";

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

// تم التعديل من عبير: هذي شخصيه الدلال للمساعده البصريه بدون ما تغطي المحتوى.
export function Auctioneer({ small = false }) {
  return (
    <svg
      className={"auctioneer " + (small ? "small" : "")}
      viewBox="0 0 300 300"
      fill="none"
      aria-hidden="true"
    >
      <ellipse
        cx="150"
        cy="276"
        rx="100"
        ry="12"
        fill="#262b22"
        opacity=".12"
      />
      <path
        d="M90 271 108 166h83l22 105Z"
        fill="#f8f3e6"
        stroke="#252820"
        strokeWidth="3"
      />
      <path
        d="m121 178 28 22 27-22m-27 22v70"
        stroke="#c5ac7c"
        strokeWidth="3"
      />
      <path
        d="M104 179c-19 13-38 8-48-8l-12-27 18-9 22 27 27-5"
        fill="#f8f3e6"
        stroke="#252820"
        strokeWidth="3"
      />
      <path
        d="m43 145-8-21c-4-14 14-20 21-8l7 20"
        fill="#c98f65"
        stroke="#252820"
        strokeWidth="3"
      />
      <g className="gavel-hand">
        <path
          d="m199 181 35-44-13-12-37 35"
          fill="#f8f3e6"
          stroke="#252820"
          strokeWidth="3"
        />
        <path
          d="m220 133 11-18c8-12 24-2 17 10l-13 17"
          fill="#c98f65"
          stroke="#252820"
          strokeWidth="3"
        />
        <path d="m242 119 25-57" stroke="#252820" strokeWidth="8" />
        <rect
          x="240"
          y="47"
          width="49"
          height="23"
          rx="5"
          transform="rotate(24 240 47)"
          fill="#b18a4b"
          stroke="#252820"
          strokeWidth="3"
        />
      </g>
      <path
        d="M109 91c0-45 81-45 81 0v45c0 27-81 27-81 0Z"
        fill="#ca926c"
        stroke="#252820"
        strokeWidth="3"
      />
      <path
        d="M101 95 114 58c11-28 62-29 75 0l12 38-13-7-12-24h-49l-14 26Z"
        fill="#f7f1df"
        stroke="#252820"
        strokeWidth="3"
      />
      <path d="M115 62c22-12 46-12 69 0" stroke="#252820" strokeWidth="8" />
      <path
        d="M109 98v52l-13 21 26-7 4-56m63-10v54l13 20-27-7-4-56"
        fill="#f7f1df"
        stroke="#252820"
        strokeWidth="3"
      />
      <path
        d="M128 104h6m30 0h6"
        stroke="#252820"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        d="m148 107-2 15h7m-17 11c8 8 18 8 26 0"
        stroke="#252820"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M126 128c9-5 14-5 23-1 8-4 14-4 23 1"
        stroke="#252820"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        d="M117 273h24m19 0h30"
        stroke="#252820"
        strokeWidth="8"
        strokeLinecap="round"
      />
      <path
        className="sparkle"
        d="M55 64v20m-10-10h20m163 138v16m-8-8h16"
        stroke="#b18a4b"
        strokeWidth="3"
      />
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
  return (
    <article className="auction-card">
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
            src={auction.image_url}
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
    </article>
  );
}

export function StatePanel({ loading, error, onRetry, onDemo }) {
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
          <button className="button outline" onClick={onDemo}>
            فتح المعاينة التجريبية
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
