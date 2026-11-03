import React from "react";
import { Icon, Auctioneer, money, dateText } from "./components";
import { auctionLink, statusLabels, displayStatus } from "./market";

// تم التعديل من عبير: نوحد تنقل صفحات المزاد وحالات التحميل والخطا عشان الرحله تكون واضحه.
export function AuctionLayout({
  market,
  title,
  eyebrow,
  description,
  children,
}) {
  return (
    <section className="container auction-experience">
      <p className="breadcrumb">
        <a href="#/auctions">المزادات</a>
        <span>/</span>
        {title}
      </p>
      <header className="auction-heading">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <div className="auction-heading-mark">
          <Auctioneer small />
        </div>
      </header>
      {market.demo && (
        <p className="inline-notice">
          معاينة تفاعلية فقط. العروض هنا توضيحية، وما تنحفظ في الباك أو تثبت
          موافقة بنك.
        </p>
      )}
      {children}
    </section>
  );
}
export function AuctionState({ state, children }) {
  if (state.loading && !state.auction)
    return (
      <div className="state-panel" role="status">
        نجهّز لك تفاصيل المجلس…
      </div>
    );
  if (!state.auction)
    return (
      <div className="state-panel">
        <Icon name="lock" size={36} />
        <h2>ما قدرنا نفتح المزاد.</h2>
        <p role="alert">{state.error}</p>
        <button className="button dark" onClick={state.reload}>
          حاول من جديد
        </button>
        <a className="text-link" href="#/private-access">
          معك رمز؟ ادخل هنا
        </a>
      </div>
    );
  return (
    <>
      {state.error && (
        <p role="alert" className="form-error">
          {state.error} البيانات الظاهرة من آخر تحديث ناجح؛ تقديم العروض متوقف
          حتى يرجع الاتصال.
        </p>
      )}
      {children}
    </>
  );
}
export function SignInGate({ market, children }) {
  if (market.userId) return children;
  return (
    <div className="paper-card access-gate">
      <Icon name="user" size={40} />
      <h2>مجلسك ينتظرك.</h2>
      <p>سجّل دخولك عشان تكمل هالخطوة.</p>
      <a
        className="button dark"
        href={"#/login?next=" + encodeURIComponent(location.hash.slice(1))}
      >
        تسجيل الدخول <Icon />
      </a>
    </div>
  );
}
export function AuctionNav({ id, current }) {
  return (
    <nav className="auction-tabs" aria-label="صفحات المزاد">
      {[
        ["auction", "التفاصيل"],
        ["commitment", "الالتزام"],
        ["bid", "قدّم عرضك"],
        ["bid-history", "سجل العروض"],
        ["auction-result", "النتيجة"],
      ].map(([page, label]) => (
        <a
          key={page}
          href={auctionLink(page, id)}
          aria-current={current === page ? "page" : undefined}
        >
          {label}
        </a>
      ))}
    </nav>
  );
}
export function AuctionSummary({ auction }) {
  return (
    <div className="auction-summary">
      <div>
        <small>
          {auction.visibility === "PRIVATE" ? "مزاد خاص" : "مزاد عام"}
        </small>
        <h2>{auction.title}</h2>
        <span
          className={"auction-state " + displayStatus(auction).toLowerCase()}
        >
          {statusLabels[displayStatus(auction)] || "بانتظار التحديث"}
        </span>
      </div>
      <div>
        <small>السعر الحالي</small>
        <strong>
          {money(auction.current_price)} <small>ر.س</small>
        </strong>
      </div>
    </div>
  );
}
export function BidRows({ rows }) {
  if (!rows?.length)
    return (
      <div className="empty-box">
        <Icon name="gavel" size={34} />
        <h3>أول عرض له مكان.</h3>
        <p>ما فيه عروض في هالصفحة إلى الآن.</p>
      </div>
    );
  return (
    <div className="bid-table">
      <table>
        <thead>
          <tr>
            <th>العرض</th>
            <th>المبلغ</th>
            <th>الوقت — الرياض</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                <span className="bid-dot" />
                عرض <bdi>{row.id.slice(-6)}</bdi>
              </td>
              <td>
                {money(row.amount)} <small>ر.س</small>
              </td>
              <td>{dateText(row.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="field-hint">هوية المزايدين ما تظهر في السجل.</p>
    </div>
  );
}
