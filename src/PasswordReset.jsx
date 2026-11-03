import React, { useEffect, useRef, useState } from "react";
import { Modal, Icon } from "./components";
import { PasswordField } from "./account-components";
import { request, validEmail, validPassword } from "./api";

// تم التعديل من عبير: نفصل مسارات الاستعاده باعدادات واضحه، وما نعلن نجاح بدون رد فعلي.
const paths = {
  start: import.meta.env.VITE_RESET_REQUEST_PATH,
  verify: import.meta.env.VITE_RESET_VERIFY_PATH,
  save: import.meta.env.VITE_RESET_CONFIRM_PATH,
};
export default function PasswordReset({ demo, initialEmail = "" }) {
  const [open, setOpen] = useState(false),
    [stage, setStage] = useState("email"),
    [email, setEmail] = useState(initialEmail),
    [code, setCode] = useState(""),
    [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [token, setToken] = useState(""),
    [seconds, setSeconds] = useState(0);
  const sending = useRef(false),
    controller = useRef();
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    if (!seconds) return;
    const t = setTimeout(() => setSeconds((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds]);
  const masked = email.replace(/^(.)(.*)(@.*)$/, "$1••••$3");
  function close() {
    controller.current?.abort();
    setOpen(false);
    setStage("email");
    setPassword("");
    setConfirm("");
    setCode("");
    setToken("");
    setError("");
  }
  async function submit(e) {
    e.preventDefault();
    if (sending.current) return;
    setError("");
    if (!validEmail(email)) {
      setError("اكتب بريدك بشكل صحيح، مثل name@example.com.");
      return;
    }
    if (stage === "code" && !/^\d{6}$/.test(code)) {
      setError("اكتب رمز التحقق المكوّن من 6 أرقام.");
      return;
    }
    if (
      stage === "password" &&
      (!validPassword(password) || password !== confirm)
    ) {
      setError("استخدم 8 أحرف على الأقل، وتأكد إن كلمتي المرور متطابقتين.");
      return;
    }
    sending.current = true;
    setBusy(true);
    controller.current = new AbortController();
    try {
      if (demo) {
        await new Promise((resolve, reject) => {
          const t = setTimeout(resolve, 700);
          controller.current.signal.addEventListener(
            "abort",
            () => {
              clearTimeout(t);
              reject(new DOMException("Aborted", "AbortError"));
            },
            { once: true },
          );
        });
        if (stage === "email") {
          setStage("code");
          setSeconds(30);
        } else if (stage === "code") {
          if (code !== "123456")
            throw new Error("الرمز مو صحيح أو انتهت صلاحيته. حاول من جديد.");
          setStage("password");
        } else {
          setPassword("");
          setConfirm("");
          setStage("done");
        }
      } else {
        if (
          !Object.values(paths).every(
            (p) =>
              typeof p === "string" && p.startsWith("/") && !p.startsWith("//"),
          )
        )
          throw new Error("استعادة كلمة المرور غير متاحة حاليًا. حاول لاحقًا.");
        // تم التعديل من عبير: الطلب الاول ما يكشف اذا البريد مسجل، والتاكيد يحتاج رمز استعاده من الباك.
        if (stage === "email") {
          await request(paths.start, {
            method: "POST",
            body: { email: email.trim().toLowerCase() },
            signal: controller.current.signal,
          });
          setStage("code");
          setSeconds(30);
        } else if (stage === "code") {
          const result = await request(paths.verify, {
            method: "POST",
            body: { email: email.trim().toLowerCase(), code },
            signal: controller.current.signal,
          });
          if (!result?.resetToken)
            throw new Error("ما اكتمل التحقق. اطلب رمز جديد.");
          setToken(result.resetToken);
          setStage("password");
        } else {
          await request(paths.save, {
            method: "POST",
            body: { resetToken: token, password },
            signal: controller.current.signal,
          });
          setPassword("");
          setConfirm("");
          setToken("");
          setStage("done");
        }
      }
    } catch (err) {
      if (err.name !== "AbortError") setError(err.message);
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }
  return (
    <>
      <button
        type="button"
        className="text-link reset-link"
        onClick={() => {
          setEmail(initialEmail);
          setOpen(true);
        }}
      >
        نسيت كلمة المرور؟ <Icon name="lock" size={16} />
      </button>
      {open && (
        <Modal
          title={
            stage === "email"
              ? "نرجّعك لمجلسك."
              : stage === "code"
                ? "تأكد من بريدك."
                : stage === "password"
                  ? "بداية جديدة لحسابك."
                  : "جاهز ترجع؟"
          }
          onClose={close}
        >
          <div className="reset-flow">
            <div className="reset-progress" aria-label="خطوات الاستعادة">
              {["email", "code", "password"].map((s, i) => (
                <span key={s} className={s === stage ? "current" : ""}>
                  {i + 1}
                </span>
              ))}
            </div>
            {demo && (
              <p className="field-hint">
                نسخة التجربة: رمز التحقق 123456. ما تتغير كلمة مرور أي حساب
                فعلي.
              </p>
            )}
            {stage === "done" ? (
              <div className="success-box">
                <div className="ui-seal">
                  <Icon name="check" size={30} />
                </div>
                <h3>
                  {demo ? "اكتملت خطوات الاستعادة." : "تم تغيير كلمة المرور."}
                </h3>
                <p>
                  {demo
                    ? "تقدر ترجع لتجربة الموقع."
                    : "سجّل دخولك بكلمة المرور الجديدة."}
                </p>
                <button className="button dark full" onClick={close}>
                  الرجوع للدخول <Icon />
                </button>
              </div>
            ) : (
              <form onSubmit={submit} className="form-stack">
                <fieldset disabled={busy}>
                  {stage === "email" ? (
                    <>
                      <p>اكتب البريد المرتبط بحسابك، وبنساعدك ترجع له.</p>
                      <label className="field">
                        البريد الإلكتروني
                        <input
                          autoFocus
                          dir="ltr"
                          type="email"
                          autoComplete="email"
                          placeholder="name@example.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                          maxLength={254}
                        />
                      </label>
                      <p className="field-hint">
                        تأكد من كتابة البريد كامل، بما فيه الجزء بعد @.
                      </p>
                    </>
                  ) : stage === "code" ? (
                    <>
                      <p>
                        إذا كان البريد مسجل، بتوصلك رسالة تحقق على{" "}
                        <bdi>{masked}</bdi>. شيّك على البريد غير المرغوب بعد.
                      </p>
                      <label className="field">
                        رمز التحقق
                        <input
                          autoFocus
                          dir="ltr"
                          className="otp-input"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          value={code}
                          onChange={(e) =>
                            setCode(e.target.value.replace(/\D/g, ""))
                          }
                          maxLength={6}
                          required
                        />
                      </label>
                      <button
                        className="text-link"
                        type="button"
                        disabled={seconds > 0}
                        onClick={() => {
                          setStage("email");
                          setCode("");
                          setError("");
                        }}
                      >
                        {seconds
                          ? `طلب رمز جديد بعد ${seconds} ثانية`
                          : "طلب رمز جديد"}
                      </button>
                      <button
                        className="text-link"
                        type="button"
                        onClick={() => {
                          setStage("email");
                          setError("");
                        }}
                      >
                        تعديل البريد
                      </button>
                    </>
                  ) : (
                    <>
                      <p>اختر كلمة مرور خاصة بحسابك، من 8 أحرف على الأقل.</p>
                      <PasswordField
                        autoComplete="new-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                      <PasswordField
                        name="resetConfirm"
                        label="تأكيد كلمة المرور"
                        autoComplete="new-password"
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                      />
                    </>
                  )}
                  <button className="button dark full" disabled={busy}>
                    {busy ? (
                      <>
                        <span className="ui-loader" /> لحظات…
                      </>
                    ) : stage === "email" ? (
                      "إرسال رمز التحقق"
                    ) : stage === "code" ? (
                      "تحقق من الرمز"
                    ) : (
                      "حفظ كلمة المرور"
                    )}
                  </button>
                </fieldset>
                {error && (
                  <p className="form-error ui-shake" role="alert">
                    {error}
                  </p>
                )}
              </form>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
