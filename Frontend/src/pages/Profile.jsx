import "./Profile.css";
import { Avatar, avatarCells } from "../Avatar";
import React, { useState } from "react";
import { AccountLayout } from "../account-components";
import { Icon } from "../components";
import { validPassword } from "../api";

// تم التعديل من عبير: نجمع بيانات الحساب والامان ونحفظ الاسم والباسورد من المسارات الفعليه.
export default function Profile({ workspace }) {
  const [name, setName] = useState(workspace.user?.name || "");
  const [busy, setBusy] = useState(false);
  const [passwordStep, setPasswordStep] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [verificationToken, setVerificationToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  // تم التعديل من عبير: الاسهم تقلب الافتارات والحفظ يحدث صوره الحساب بكل الصفحات.
  const [avatarChoice, setAvatarChoice] = useState(workspace.avatar || 0);
  const [avatarMessage, setAvatarMessage] = useState("");
  React.useEffect(() => {
    setAvatarChoice(workspace.avatar || 0);
  }, [workspace.avatar]);
  function turnAvatar(direction) {
    const index = avatarCells.indexOf(avatarChoice);
    setAvatarChoice(
      avatarCells[
        (index + direction + avatarCells.length) % avatarCells.length
      ],
    );
    setAvatarMessage("");
  }
  async function save(event) {
    event.preventDefault();
    if (busy) return;
    if (
      !/^[\p{L}\p{M}][\p{L}\p{M} .'-]*$/u.test(name.trim()) ||
      name.trim().length < 2 ||
      name.trim().length > 160
    ) {
      setError("اكتب اسمك بشكل صحيح، بحروف عربية أو إنجليزية");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await workspace.updateProfile(name.trim());
      setEditing(false);
      setMessage("تم حفظ اسمك");
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }
  // تم التعديل من عبير: ما نفتح الباسورد الجديد الا بعد تحقق السيرفر من الحالي ونطابق التاكيد قبل الحفظ.
  async function secure(event) {
    event.preventDefault();
    if (busy) return;
    setError("");
    setMessage("");
    if (
      verificationToken &&
      (!validPassword(password) || password !== confirmation)
    ) {
      setError(
        "اكتب كلمة مرور من 8 أحرف على الأقل، وتأكد أن الخانتين متطابقتين",
      );
      return;
    }
    setBusy(true);
    try {
      if (!verificationToken) {
        const result = await workspace.verifyPassword(currentPassword);
        setVerificationToken(result.verificationToken);
        setCurrentPassword("");
      } else {
        await workspace.changePassword({
          verificationToken,
          password,
          confirmPassword: confirmation,
        });
        resetPassword();
        setMessage("تم تغيير كلمة مرورك وإنهاء الجلسات الثانية");
      }
    } catch (error) {
      setError(error.message);
      if (verificationToken) {
        setVerificationToken("");
        setPassword("");
        setConfirmation("");
      }
    } finally {
      setBusy(false);
    }
  }
  function resetPassword() {
    setPasswordStep(false);
    setVerificationToken("");
    setCurrentPassword("");
    setPassword("");
    setConfirmation("");
  }
  return (
    <AccountLayout
      workspace={workspace}
      active="profile"
      eyebrow={"بياناتك، على راحتك"}
      title={"الملف الشخصي"}
      description={"هنا معلومات حسابك والطريقة اللي نعرفك فيها"}
    >
      {workspace.user && (
        <>
          <div className="profile-banner">
            <Avatar
              value={workspace.avatar}
              name={workspace.user.name}
              className="profile-avatar"
            />
            <div>
              <h2>{workspace.user.name}</h2>
              <p dir="ltr">{workspace.user.email}</p>
            </div>
            <span className="pill">
              {workspace.demo ? "حساب تجربة" : "عضو مزياد"}
            </span>
          </div>
          {/* تم التعديل من عبير: اختيار افتار مستقل للحساب مع تنبيه واضح لمكان حفظه. */}
          <section
            className="paper-card avatar-picker"
            aria-labelledby="avatar-heading"
          >
            <div>
              <p className="eyebrow">صورتك في المزاد</p>
              <h2 id="avatar-heading">اختر اللي يمثلك</h2>
              <p>تظهر صورتك مع حسابك في صفحات مزياد</p>
            </div>
            <div className="avatar-carousel" dir="ltr">
              <button
                type="button"
                className="icon-button"
                aria-label={"الافتار السابق"}
                onClick={() => turnAvatar(-1)}
              >
                ←
              </button>
              <Avatar value={avatarChoice} name={workspace.user.name} />
              <button
                type="button"
                className="icon-button"
                aria-label={"الافتار التالي"}
                onClick={() => turnAvatar(1)}
              >
                →
              </button>
            </div>
            <p className="avatar-counter" dir="ltr" aria-live="polite">
              {avatarCells.indexOf(avatarChoice) + 1} / {avatarCells.length}
            </p>
            <div className="avatar-options" aria-label={"صور الحساب"}>
              {avatarCells.map((value, i) => (
                <button
                  type="button"
                  key={value}
                  aria-label={"اختيار الافتار " + (i + 1)}
                  aria-pressed={avatarChoice === value}
                  onClick={() => {
                    setAvatarChoice(value);
                    setAvatarMessage("");
                  }}
                >
                  <Avatar value={value} />
                </button>
              ))}
            </div>
            <button
              type="button"
              className="button dark"
              onClick={() =>
                setAvatarMessage(
                  workspace.chooseAvatar(avatarChoice)
                    ? "تم حفظ صورتك"
                    : "تعذّر حفظ الصورة اسمح للمتصفح بحفظ بيانات الموقع وحاول من جديد",
                )
              }
            >
              اعتمد صورتي <Icon name="check" />
            </button>
            {/* تم التعديل من عبير: نشيل تحديد المتصفح من نص اختيار الافتار. */}
            <p className="avatar-storage-note">اختيارك محفوظ لهذا الحساب</p>
            <p role="status">{avatarMessage}</p>
          </section>
          {/* تم التعديل من عبير: الاسم قابل للتعديل والبريد ثابت والامان بنفس كرت الحساب. */}
          <section className="paper-card profile-settings">
            <div className="section-heading">
              <div>
                <p className="eyebrow">حسابك تحت يدك</p>
                <h2>بيانات الحساب والأمان</h2>
              </div>
              <Icon name="shield" size={28} />
            </div>
            <form onSubmit={save} className="form-stack">
              <div className="two-fields">
                <label className="field">
                  <span>الاسم الكامل</span>
                  <input
                    value={editing ? name : workspace.user.name}
                    onChange={(event) => setName(event.target.value)}
                    readOnly={!editing}
                    required
                    minLength={2}
                    maxLength={160}
                    autoComplete="name"
                  />
                </label>
                <label className="field">
                  <span>
                    البريد الإلكتروني <Icon name="lock" size={14} />
                  </span>
                  <input
                    value={workspace.user.email}
                    type="email"
                    readOnly
                    dir="ltr"
                    autoComplete="email"
                  />
                  <small>بريدك مرتبط بحسابك ولا يمكن تغييره</small>
                </label>
              </div>
              <div className="form-actions">
                {workspace.demo &&
                  (editing ? (
                    <>
                      <button
                        type="submit"
                        disabled={busy}
                        className="button dark"
                      >
                        {busy ? "جاري الحفظ" : "حفظ الاسم"}
                        <Icon name="check" />
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        className="button outline"
                        onClick={() => {
                          setEditing(false);
                          setError("");
                        }}
                      >
                        إلغاء
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="button outline"
                      onClick={(event) => {
                        event.preventDefault();
                        setName(workspace.user.name);
                        setEditing(true);
                        setError("");
                        setMessage("");
                      }}
                    >
                      تعديل الاسم <Icon size={16} />
                    </button>
                  ))}
              </div>
            </form>
            {workspace.demo && (
              <div className="profile-security">
                <div>
                  <h3>
                    <Icon name="lock" /> كلمة المرور
                  </h3>
                  <p>
                    غيّر كلمة مرورك من هنا نتحقق من الحالية أولًا لحماية حسابك
                  </p>
                </div>
                {!passwordStep ? (
                  <button
                    type="button"
                    className="button outline"
                    onClick={() => {
                      setPasswordStep(true);
                      setError("");
                      setMessage("");
                    }}
                  >
                    تغيير كلمة المرور <Icon />
                  </button>
                ) : (
                  <form onSubmit={secure} className="form-stack">
                    {!verificationToken ? (
                      <label className="field">
                        <span>كلمة المرور الحالية</span>
                        <input
                          autoFocus
                          type="password"
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          required
                          autoComplete="current-password"
                          maxLength={72}
                        />
                      </label>
                    ) : (
                      <>
                        <p className="success-text">
                          <Icon name="check" /> تم التحقق اختر كلمة مرورك
                          الجديدة
                        </p>
                        <div className="two-fields">
                          <label className="field">
                            <span>كلمة المرور الجديدة</span>
                            <input
                              autoFocus
                              type="password"
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              required
                              minLength={8}
                              maxLength={72}
                              autoComplete="new-password"
                            />
                          </label>
                          <label className="field">
                            <span>تأكيد كلمة المرور</span>
                            <input
                              type="password"
                              value={confirmation}
                              onChange={(e) => setConfirmation(e.target.value)}
                              required
                              minLength={8}
                              maxLength={72}
                              autoComplete="new-password"
                            />
                          </label>
                        </div>
                      </>
                    )}
                    <div className="form-actions">
                      <button
                        type="submit"
                        className="button dark"
                        disabled={busy}
                      >
                        {busy
                          ? "جاري التحقق"
                          : verificationToken
                            ? "حفظ كلمة المرور"
                            : "تحقق وتابع"}
                        <Icon name="lock" />
                      </button>
                      <button
                        type="button"
                        className="button outline"
                        disabled={busy}
                        onClick={() => {
                          resetPassword();
                          setError("");
                        }}
                      >
                        إلغاء
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
            {!workspace.demo && (
              <p className="field-hint">
                للمساعدة في بيانات حسابك تواصل مع الدعم من صفحة المساعدة
              </p>
            )}
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            {message && (
              <p className="success-text" role="status">
                {message}
              </p>
            )}
          </section>
        </>
      )}
    </AccountLayout>
  );
}
