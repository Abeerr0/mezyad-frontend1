import React, { useEffect, useRef, useState } from "react";
import { Modal, Icon } from "./components";
import { request } from "./api";

// تم التعديل من عبير: الربط الحقيقي يحتاج مسارات تحقق، وما نستخدم رمز الواجهه لانشاء حساب فعلي.
export const signupPaths = {
  start: import.meta.env.VITE_SIGNUP_REQUEST_PATH,
  complete: import.meta.env.VITE_SIGNUP_COMPLETE_PATH,
};
export function signupReady() {
  return Object.values(signupPaths).every(
    (p) => typeof p === "string" && p.startsWith("/") && !p.startsWith("//"),
  );
}
export function GoogleAccess() {
  const [error, setError] = useState("");
  function start() {
    const path = import.meta.env.VITE_GOOGLE_START_PATH;
    if (!path || !path.startsWith("/") || path.startsWith("//")) {
      setError(
        "الدخول بحساب Google غير متاح حاليًا. استخدم بريدك وكلمة المرور.",
      );
      return;
    }
    location.assign(path);
  }
  return (
    <div className="google-access">
      <button className="google-button" type="button" onClick={start}>
        <span className="google-mark" aria-hidden="true">
          G
        </span>
        المتابعة باستخدام Google
        <Icon size={17} />
      </button>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
    </div>
  );
}
export function SignupVerification({ email, demo, onComplete, onClose }) {
  const [code, setCode] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(false),
    [seconds, setSeconds] = useState(30);
  const working = useRef(false),
    timer = useRef(),
    controller = useRef();
  useEffect(
    () => () => {
      clearTimeout(timer.current);
      controller.current?.abort();
    },
    [],
  );
  useEffect(() => {
    if (!seconds) return;
    const t = setTimeout(() => setSeconds((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds]);
  async function verify(e) {
    e.preventDefault();
    if (working.current) return;
    if (!/^\d{6}$/.test(code)) {
      setError("اكتب الرمز المكوّن من 6 أرقام.");
      return;
    }
    working.current = true;
    setBusy(true);
    setError("");
    controller.current = new AbortController();
    try {
      if (demo) {
        await new Promise((r) => {
          timer.current = setTimeout(r, 700);
        });
        if (code !== "123456")
          throw new Error("الرمز مو صحيح. راجعه وحاول من جديد.");
      } else {
        const result = await request(signupPaths.complete, {
          method: "POST",
          body: { email, code },
          signal: controller.current.signal,
        });
        if (!result?.id)
          throw new Error(
            "ما اكتمل إنشاء الحساب. جرّب تسجيل الدخول قبل إعادة المحاولة.",
          );
      }
      setSuccess(true);
      timer.current = setTimeout(() => {
        Promise.resolve(onComplete()).catch((err) => {
          setSuccess(false);
          setError(err.message);
          working.current = false;
          setBusy(false);
        });
      }, 1100);
    } catch (err) {
      if (err.name !== "AbortError") setError(err.message);
      working.current = false;
      setBusy(false);
    }
  }
  async function resend() {
    if (seconds || working.current) return;
    working.current = true;
    setBusy(true);
    setError("");
    try {
      if (!demo)
        await request(signupPaths.start, {
          method: "POST",
          body: { email, resend: true },
        });
      setSeconds(30);
    } catch (err) {
      setError(err.message);
    } finally {
      working.current = false;
      setBusy(false);
    }
  }
  return (
    <Modal
      title={success ? "حياك في مزياد!" : "باقي خطوة لمجلسك."}
      onClose={onClose}
    >
      <div className="signup-verify">
        {success ? (
          <div className="welcome-success" role="status">
            <div className="welcome-check">
              <Icon name="check" size={50} />
            </div>
            <h3>تم التحقق من الرمز.</h3>
            <p>نجهّز لك مجلسك…</p>
            <span aria-hidden="true">✦ ✧ ✦</span>
          </div>
        ) : (
          <form onSubmit={verify} className="form-stack">
            <div className="ui-seal">
              <Icon name="lock" size={30} />
            </div>
            <p>
              {demo
                ? "أدخل الرمز لإكمال تجربة إنشاء الحساب."
                : "أدخل رمز التحقق اللي وصلك لإكمال إنشاء حسابك."}
            </p>
            <bdi>{email.replace(/^(.)(.*)(@.*)$/, "$1••••$3")}</bdi>
            {demo && (
              <p className="field-hint">
                رمز نسخة التجربة: 123456. ما ينشئ حساب فعلي.
              </p>
            )}
            <label className="field">
              رمز التحقق
              <input
                autoFocus
                dir="ltr"
                className="otp-input"
                autoComplete="one-time-code"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                disabled={busy}
                required
              />
            </label>
            {error && (
              <p role="alert" className="form-error ui-shake">
                {error}
              </p>
            )}
            <button className="button dark full" disabled={busy}>
              {busy ? (
                <>
                  <span className="ui-loader" />
                  نتحقق من الرمز…
                </>
              ) : (
                "تأكيد وإنشاء الحساب"
              )}
            </button>
            <button
              className="text-link"
              type="button"
              onClick={resend}
              disabled={busy || seconds > 0}
            >
              {seconds
                ? `إعادة الطلب بعد ${seconds} ثانية`
                : "إعادة إرسال الرمز"}
            </button>
          </form>
        )}
      </div>
    </Modal>
  );
}
