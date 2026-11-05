import { notify } from "../InteractionUI";
import {
  GoogleAccess,
  SignupVerification,
  signupPaths,
  signupReady,
} from "../AccountVerification";
import React, { useState } from "react";
import { AuthLayout, PasswordField } from "../account-components";
import { Icon } from "../components";
import { request, validEmail, validPassword } from "../api";
import { previewUser } from "../workspace";

// تم التعديل من عبير: نطابق شروط التسجيل مع الباك ونتاكد من تطابق الباسورد قبل الارسال.
export default function Register({ workspace }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  async function submit(event) {
    event.preventDefault();
    if (busy || done || uncertain) return;
    if (!name.trim() || name.trim().length > 160 || !validEmail(email)) {
      setError("اكتب اسمك وبريد صحيح");
      return;
    }
    if (!workspace.demo && !validPassword(password)) {
      setError(
        "استخدم 8 أحرف على الأقل إذا كانت كلمة المرور طويلة جدًا، اختصرها وحاول من جديد",
      );
      return;
    }
    if (!workspace.demo && password !== confirm) {
      setError("تأكيد كلمة المرور مو مطابق");
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (!workspace.demo) {
        if (!signupReady())
          throw new Error(
            "التحقق بالبريد غير متاح حاليًا حاول إنشاء حسابك لاحقًا",
          );
        const registered = await request(signupPaths.start, {
          method: "POST",
          body: {
            name: name.trim(),
            email: email.trim().toLowerCase(),
            password,
          },
        });
        if (registered.emailSent === false)
          setError(
            "حسابك انحفظ لكن تعذر إرسال الرمز اطلب إرساله من نافذة التحقق",
          );
      }
      setVerifying(true);
    } catch (err) {
      setError(err.message);
      setUncertain(Boolean(err.uncertain));
    } finally {
      setBusy(false);
    }
  }
  return (
    <AuthLayout register>
      {verifying && (
        <SignupVerification
          email={email.trim().toLowerCase()}
          demo={workspace.demo}
          onClose={() => setVerifying(false)}
          onComplete={async () => {
            if (workspace.demo)
              workspace.enterPreview({
                ...previewUser,
                name: name.trim(),
                email: email.trim().toLowerCase(),
              });
            else await workspace.login(email.trim().toLowerCase(), password);
            setPassword("");
            setConfirm("");
            setVerifying(false);
            location.hash = "/";
            notify(
              workspace.demo
                ? "حياك في تجربة مزياد ✦"
                : "تم إنشاء حسابك بنجاح حياك في مزياد ✦",
            );
          }}
        />
      )}
      <p className="eyebrow">يا هلا بالبدايات</p>
      <h1>
        مكانك <em>محفوظ</em>
      </h1>
      <p className="form-intro">حساب واحد يجمع أصولك ومشاركاتك</p>
      {done ? (
        <div className="success-box">
          <div className="success-seal">
            <Icon name="check" size={32} />
          </div>
          <h2>{workspace.demo ? "حياك في التجربة!" : "تم إنشاء حسابك!"}</h2>
          <p>
            {workspace.demo
              ? "حساب التجربة جاهز تقدر تكتشف الخطوات بدون تنفيذ عمليات فعلية"
              : "تقدر الآن تسجل دخولك بنفس البريد وكلمة المرور"}
          </p>
          <a
            className="button dark full"
            href={
              workspace.demo
                ? "#/activity"
                : "#/login?email=" + encodeURIComponent(email)
            }
          >
            {" "}
            {workspace.demo ? "ادخل مزادك" : "تسجيل الدخول"} <Icon />
          </a>
        </div>
      ) : (
        <>
          {workspace.demo && (
            <p className="inline-notice">
              أنت في نسخة التجربة استخدم بيانات تجريبية، وبدون كلمة مرور
            </p>
          )}
          <form className="form-stack" onSubmit={submit}>
            <fieldset disabled={busy || uncertain}>
              <label className="field">
                <span>الاسم الكامل</span>
                <input
                  name="name"
                  autoComplete="name"
                  required
                  maxLength={160}
                  placeholder={"اسمك اللي نعرفك فيه"}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label className="field">
                <span>البريد الإلكتروني</span>
                <input
                  name="email"
                  type="email"
                  dir="ltr"
                  autoComplete="email"
                  required
                  maxLength={254}
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              {!workspace.demo && (
                <>
                  <PasswordField
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <p className="field-hint">
                    8 أحرف على الأقل استخدم كلمة مرور خاصة بحسابك
                  </p>
                  <PasswordField
                    name="confirmPassword"
                    label={"تأكيد كلمة المرور"}
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                  />
                </>
              )}
              <button className="button dark full" type="submit">
                {busy
                  ? "جاري إنشاء الحساب"
                  : workspace.demo
                    ? "تجربة إنشاء الحساب"
                    : "إنشاء حساب"}{" "}
                <Icon />
              </button>
            </fieldset>
            {error && (
              <p role="alert" className="form-error">
                {error}
              </p>
            )}
          </form>
          <p className="auth-switch">
            عندك حساب؟{" "}
            <a href={"#/login?email=" + encodeURIComponent(email)}>
              سجّل دخولك
            </a>
          </p>
        </>
      )}
      {!workspace.user && import.meta.env.VITE_GOOGLE_START_PATH && (
        <GoogleAccess />
      )}
    </AuthLayout>
  );
}
