import React, { useState } from "react";
import { AuthLayout, PasswordField } from "../account-components";
import { Icon } from "../components";

// تم التعديل من عبير: نرجع المستخدم لصفحته بعد الدخول ونمنع الروابط الخارجيه.
export default function Login({ workspace, params }) {
  const [email, setEmail] = useState(params.get("email") || "");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const next = params.get("next");
  // تم التعديل من عبير: نرجع المستخدم لصفحه المزاد اللي طلبها بعد تسجيل الدخول.
  const destination =
    next &&
    /^\/(profile|activity|listings|create-listing|edit-listing|create-auction|auction|private-access|commitment|bid|bid-history|auction-result|my-auctions|bank-status)(\?|$)/.test(
      next,
    )
      ? next
      : "/activity";
  async function submit(event) {
    event.preventDefault();
    if (busy || workspace.demo) return;
    setBusy(true);
    setError("");
    try {
      await workspace.login(email.trim().toLowerCase(), password);
      setPassword("");
      location.hash = destination;
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <AuthLayout>
      <p className="eyebrow">حياك من جديد</p>
      <h1>
        المجلس <em>مجلسك.</em>
      </h1>
      <p className="form-intro">ادخل لحسابك، وتابع اللي يهمك.</p>
      {workspace.notice && (
        <p role="status" className="inline-notice">
          {workspace.notice}
        </p>
      )}
      {workspace.user ? (
        <div className="success-box">
          <Icon name="check" />
          <h2>أنت داخل بحسابك</h2>
          <p>{workspace.user.name}</p>
          <a className="button dark" href="#/activity">
            الذهاب لنشاطي <Icon />
          </a>
        </div>
      ) : (
        <>
          {workspace.demo && (
            <div className="auth-demo">
              <span className="pill">وضع المعاينة</span>
              <p>
                شوف رحلة المستخدم بحساب جاهز، بدون بريد أو كلمة مرور حقيقية.
              </p>
              <button
                className="button dark"
                onClick={() => {
                  workspace.enterPreview();
                  location.hash = destination;
                }}
              >
                جرّب حساب المعاينة <Icon />
              </button>
            </div>
          )}
          <form className="form-stack" onSubmit={submit}>
            <fieldset disabled={busy || workspace.demo}>
              <label className="field">
                <span>البريد الإلكتروني</span>
                <input
                  name="email"
                  type="email"
                  dir="ltr"
                  autoComplete="email"
                  maxLength={254}
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </label>
              <PasswordField
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button className="button dark full" type="submit">
                {busy ? "جاري الدخول…" : "تسجيل الدخول"}
                <Icon />
              </button>
            </fieldset>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
          </form>
          <p className="auth-switch">
            أول مرة هنا؟ <a href="#/register">أنشئ حسابك</a>
          </p>
          <details className="auth-help">
            <summary>نسيت كلمة المرور؟</summary>
            <p>
              استعادة كلمة المرور مو متاحة في النسخة الحالية. ما نرسل رابط
              استعادة وهمي. تقدر ترجع لحسابك إذا تذكرت كلمة المرور.
            </p>
          </details>
        </>
      )}
      <p className="form-footnote">
        <Icon name="lock" size={15} /> بيانات الدخول ما تُحفظ في ملفات المشروع.
      </p>
    </AuthLayout>
  );
}
