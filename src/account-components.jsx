import React, { useState } from "react";
import { Auctioneer, Icon } from "./components";

export const listingLabels = {
  PENDING_REVIEW: "قيد المراجعة",
  APPROVED: "معتمد",
  REJECTED: "يحتاج تعديل",
};

// تم التعديل من عبير: نوضح مكان المستخدم ونربط صفحات حسابه بنفس القائمه.
export function AccountLayout({
  workspace,
  active,
  eyebrow,
  title,
  description,
  children,
}) {
  const [exitError, setExitError] = useState("");
  const [exiting, setExiting] = useState(false);
  async function exit() {
    if (exiting) return;
    setExiting(true);
    setExitError("");
    try {
      await workspace.logout();
    } catch (err) {
      setExitError(err.message);
    } finally {
      setExiting(false);
    }
  }
  if (!workspace.user)
    return (
      <section className="container access-gate">
        <Auctioneer small />
        <p className="eyebrow">مجلسك له مكان</p>
        <h1>سجّل دخولك، وكمّل.</h1>
        <p>
          {workspace.notice ||
            "إعلاناتك وبياناتك تخصك. ادخل لحسابك عشان تقدر تشوفها."}
        </p>
        <a
          className="button dark"
          href={"#/login?next=" + encodeURIComponent(location.hash.slice(1))}
        >
          تسجيل الدخول <Icon />
        </a>
        <a className="text-link" href="#/register">
          ما عندك حساب؟ أنشئ حساب
        </a>
      </section>
    );
  return (
    <div className="container account-layout">
      <aside className="account-sidebar">
        <div className="member-mark">
          <span>{workspace.user.name?.slice(0, 1) || "م"}</span>
          <div>
            <strong>{workspace.user.name}</strong>
            <small>{workspace.demo ? "حساب معاينة" : "حساب مزياد"}</small>
          </div>
        </div>
        <nav aria-label="صفحات حسابي">
          {[
            ["activity", "نشاطي", "gavel"],
            // تم التعديل من عبير: نضيف رابط المتابعه للمجموعه الخامسه بدون تغيير صفحات الحساب.
            ["my-auctions", "مزاداتي ومشاركاتي", "flag"],
            ["listings", "إعلاناتي", "image"],
            ["profile", "الملف الشخصي", "user"],
          ].map(([page, label, icon]) => (
            <a
              key={page}
              href={"#/" + page}
              aria-current={active === page ? "page" : undefined}
            >
              <Icon name={icon} />
              {label}
              <Icon name="arrow" size={15} />
            </a>
          ))}
        </nav>
        <a className="button dark" href="#/create-listing">
          <Icon name="plus" /> اعرض أصلك
        </a>
        <div className="sidebar-tip">
          <Auctioneer small />
          <p>
            كل أصل له حكاية.
            <br />
            خلّ التفاصيل تحكي عن أصلك.
          </p>
        </div>
        <button className="logout-button" disabled={exiting} onClick={exit}>
          {exiting ? "جاري الخروج…" : "تسجيل الخروج"}{" "}
          <Icon name="arrow" size={16} />
        </button>
        {exitError && (
          <p role="alert" className="form-error">
            {exitError}
          </p>
        )}
      </aside>
      <section className="account-main">
        <p className="breadcrumb">
          <a href="#/">الرئيسية</a>
          <span>/</span>
          <a href="#/activity">حسابي</a>
          <span>/</span>
          {title}
        </p>
        <header className="account-title">
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p>{description}</p>
        </header>
        {workspace.demo && (
          <div className="demo-note">
            <Icon name="image" size={17} />
            <span>
              معاينة تفاعلية: تغييراتك تبقى داخل هالصفحة وتُعاد عند تحديث
              المتصفح. ما تنرسل لقاعدة البيانات.
            </span>
          </div>
        )}
        {children}
      </section>
    </div>
  );
}

export function ResourceState({ workspace, children }) {
  if (workspace.loading)
    return (
      <div className="account-loading" role="status">
        <span className="loading-ring" />
        جاري تجهيز بياناتك…
      </div>
    );
  if (workspace.error)
    return (
      <div className="empty-box">
        <Icon name="refresh" size={32} />
        <h2>ما قدرنا نجيب البيانات</h2>
        <p role="alert">{workspace.error}</p>
        <button className="button dark" onClick={workspace.reload}>
          حاول مرة ثانية
        </button>
      </div>
    );
  return children;
}

// تم التعديل من عبير: زر اظهار الباسورد ما يرسل النموذج ولا يحفظ الباسورد بالمتصفح.
export function PasswordField({
  label = "كلمة المرور",
  name = "password",
  autoComplete = "current-password",
  value,
  onChange,
  disabled,
}) {
  const [visible, setVisible] = useState(false);
  return (
    <label className="field">
      <span>{label}</span>
      <div className="password-control">
        <input
          name={name}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          onChange={onChange}
          required
          disabled={disabled}
          dir="ltr"
        />
        <button
          type="button"
          aria-label={visible ? "إخفاء " + label : "إظهار " + label}
          aria-pressed={visible}
          onClick={() => setVisible(!visible)}
        >
          {visible ? "إخفاء" : "إظهار"}
        </button>
      </div>
    </label>
  );
}

export function AuthLayout({ register, children }) {
  return (
    <section className="auth-layout">
      <aside className="auth-art">
        <img
          src="/images/porsche-carrera-gt.jpg"
          alt="بورش كلاسيكية بلون فضي"
        />
        <div className="auth-art-shade" />
        <div className="auth-art-top">
          <span>THE MEZYAD COLLECTION</span>
          <Icon name="gavel" size={28} />
        </div>
        <div className="auth-art-copy">
          <p className="eyebrow">
            {register ? "بداية تستحق" : "رجعت، ونوّر المجلس"}
          </p>
          <h2>
            أصول استثنائية.
            <br />
            <em>ومكانك بينها.</em>
          </h2>
          <p>
            حساب واحد تبيع فيه، وتزايد منه.
            <br />
            كل خطوة واضحة، وكل قرار لك.
          </p>
        </div>
        <div className="auth-art-bottom">
          <span>مزياد · للقيمة عنوان</span>
          <span>01 — 05</span>
        </div>
      </aside>
      <div className="auth-form-panel">
        <a className="back-link" href="#/">
          <Icon size={17} /> الرجوع للمجلس
        </a>
        {children}
      </div>
    </section>
  );
}
