// تم التعديل من عبير: يسجل الدخول ويرجع المستخدم للصفحه المطلوبه
import Button from "../../../../shared/ui/Button.jsx";
import { notify } from "../../../../shared/components/InteractionUI.jsx";
import {
  GoogleAccess,
  SignupVerification,
} from "../../components/AccountVerification.jsx";
import React, { useState } from "react";
import {
  AuthLayout,
  PasswordField,
} from "../../../account/components/account-components.jsx";
import { Icon } from "../../../../shared/ui/index.jsx";

// تم التعديل من عبير: نرجع المستخدم لصفحته بعد الدخول ونمنع الروابط الخارجيه.
export default function Login({ workspace, params }) {
  const [email, setEmail] = useState(params.get("email") || "");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [verifying, setVerifying] = useState(false);
  const next = params.get("next");
  // تم التعديل من عبير: نرجع المستخدم لصفحه المزاد اللي طلبها بعد تسجيل الدخول.
  const destination =
    next &&
    /^\/(profile|activity|listings|create-listing|edit-listing|create-auction|auction|private-access|commitment|bid|bid-history|auction-result|my-auctions|bank-status|payment)(\?|$)/.test(
      next,
    )
      ? next
      : "/activity";
  // تم التعديل من عبير: نتحقق من النموذج ونرسل الطلب ونوضح نتيجته
  async function submit(event) {
    event.preventDefault();
    if (busy || workspace.demo) return;
    setBusy(true);
    setError("");
    try {
      const user = await workspace.login(email.trim().toLowerCase(), password);
      notify("حياك في مزادك");
      setPassword("");
      location.hash = destination;
    } catch (err) {
      if (err.code === "EMAIL_NOT_VERIFIED") setVerifying(true);
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <AuthLayout>
      {verifying && (
        <SignupVerification
          email={email.trim().toLowerCase()}
          demo={workspace.demo}
          initialSeconds={0}
          onClose={() => setVerifying(false)}
          onComplete={async () => {
            const user = await workspace.login(
              email.trim().toLowerCase(),
              password,
            );
            setVerifying(false);
            setPassword("");
            location.hash = destination;
          }}
        />
      )}
      <p className="eyebrow">حياك من جديد</p>
      <h1>
        المزاد <em>مزادك</em>
      </h1>
      {import.meta.env.VITE_GOOGLE_START_PATH && <GoogleAccess />}
      <p className="form-intro">ادخل لحسابك، وتابع اللي يهمك</p>
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
          <a className="button dark" href={"#/activity"}>
            {"الذهاب لنشاطي"} <Icon />
          </a>
        </div>
      ) : (
        <>
          {workspace.demo && (
            <div className="auth-demo">
              <span className="pill">تجربة الموقع</span>
              <p>
                اكتشف خطوات البيع والمزايدة بحساب تجربة عملياتك هنا ما تنحفظ
                بحساب فعلي
              </p>
              <Button
                onClick={() => {
                  // تم التعديل من عبير: حساب المعاينه يروح للمسار المطلوب بدون متغير من طلب الدخول الحقيقي.
                  workspace.enterPreview();
                  location.hash = destination;
                }}
              >
                ابدأ التجربة <Icon />
              </Button>
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
              <Button full type="submit">
                {busy ? "جاري الدخول" : "تسجيل الدخول"}
                <Icon />
              </Button>
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
        </>
      )}
    </AuthLayout>
  );
}
