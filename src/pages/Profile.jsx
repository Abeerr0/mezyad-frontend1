import { Avatar, avatarCells } from "../Avatar";
import React, { useState } from "react";
import { AccountLayout } from "../account-components";
import { Icon } from "../components";
import { validEmail } from "../api";

// تم التعديل من عبير: تعديل البروفايل يعمل بالمعاينه بس لان الباك ما يوفر مسار تحديث حساب.
export default function Profile({ workspace }) {
  const [name, setName] = useState(workspace.user?.name || "");
  const [email, setEmail] = useState(workspace.user?.email || "");
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  // تم التعديل من عبير: الاسهم تقلب الافتارات والحفظ يحدث صوره الحساب بكل الصفحات.
  const [avatarChoice, setAvatarChoice] = useState(workspace.avatar || 0);
  const [avatarMessage, setAvatarMessage] = useState("");
  React.useEffect(() => { setAvatarChoice(workspace.avatar || 0); }, [workspace.avatar]);
  function turnAvatar(direction) {
    const index = avatarCells.indexOf(avatarChoice);
    setAvatarChoice(avatarCells[(index + direction + avatarCells.length) % avatarCells.length]);
    setAvatarMessage("");
  }
  function save(event) {
    event.preventDefault();
    if (!workspace.demo) return;
    if (!name.trim() || name.trim().length > 160 || !validEmail(email)) {
      setError("راجع اسمك وبريدك قبل الحفظ.");
      return;
    }
    workspace.updatePreviewProfile(name.trim(), email.trim().toLowerCase());
    setEditing(false);
    setError("");
    setMessage("تم تحديث بيانات حساب التجربة.");
  }
  return (
    <AccountLayout
      workspace={workspace}
      active="profile"
      eyebrow="بياناتك، على راحتك"
      title="الملف الشخصي"
      description="هنا معلومات حسابك والطريقة اللي نعرفك فيها."
    >
      {workspace.user && (
        <>
          <div className="profile-banner">
            <Avatar value={workspace.avatar} name={workspace.user.name} className="profile-avatar" />
            <div>
              <h2>{workspace.user.name}</h2>
              <p dir="ltr">{workspace.user.email}</p>
            </div>
            <span className="pill">
              {workspace.demo ? "حساب تجربة" : "عضو مزياد"}
            </span>
          </div>
          {/* تم التعديل من عبير: اختيار افتار مستقل للحساب مع تنبيه واضح لمكان حفظه. */}
          <section className="paper-card avatar-picker" aria-labelledby="avatar-heading">
            <div><p className="eyebrow">صورتك في المجلس</p><h2 id="avatar-heading">اختر اللي يمثلك.</h2><p>تظهر صورتك مع حسابك في صفحات مزياد.</p></div>
            <div className="avatar-carousel" dir="ltr">
              <button type="button" className="icon-button" aria-label="الافتار السابق" onClick={() => turnAvatar(-1)}>←</button>
              <Avatar value={avatarChoice} name={workspace.user.name} />
              <button type="button" className="icon-button" aria-label="الافتار التالي" onClick={() => turnAvatar(1)}>→</button>
            </div>
            <p className="avatar-counter" dir="ltr" aria-live="polite">{avatarCells.indexOf(avatarChoice) + 1} / {avatarCells.length}</p>
            <div className="avatar-options" aria-label="صور الحساب">{avatarCells.map((value, i) => <button type="button" key={value} aria-label={"اختيار الافتار " + (i + 1)} aria-pressed={avatarChoice === value} onClick={() => { setAvatarChoice(value); setAvatarMessage(""); }}><Avatar value={value} /></button>)}</div>
            <button type="button" className="button dark" onClick={() => setAvatarMessage(workspace.chooseAvatar(avatarChoice) ? "تم حفظ صورتك." : "تعذّر حفظ الصورة. اسمح للمتصفح بحفظ بيانات الموقع وحاول من جديد.")}>اعتمد صورتي <Icon name="check" /></button>
            <p className="avatar-storage-note">اختيارك محفوظ لهذا الحساب على هذا المتصفح.</p>
            <p role="status">{avatarMessage}</p>
          </section>
          <section className="paper-card">
            <div className="section-heading">
              <div>
                <span className="section-number">01</span>
                <h2>معلومات الحساب</h2>
              </div>
              {!editing && (
                <button
                  className="text-link"
                  disabled={!workspace.demo}
                  onClick={() => {
                    setName(workspace.user.name);
                    setEmail(workspace.user.email);
                    setEditing(true);
                    setMessage("");
                  }}
                >
                  تعديل البيانات <Icon size={16} />
                </button>
              )}
            </div>
            <form onSubmit={save} className="form-stack">
              <div className="two-fields">
                <label className="field">
                  <span>الاسم الكامل</span>
                  <input
                    value={editing ? name : workspace.user.name}
                    onChange={(e) => setName(e.target.value)}
                    readOnly={!editing}
                    required
                    maxLength={160}
                    autoComplete="name"
                  />
                </label>
                <label className="field">
                  <span>البريد الإلكتروني</span>
                  <input
                    type="email"
                    value={editing ? email : workspace.user.email}
                    onChange={(e) => setEmail(e.target.value)}
                    readOnly={!editing}
                    required
                    maxLength={254}
                    dir="ltr"
                    autoComplete="email"
                  />
                </label>
              </div>
              {editing && (
                <div className="form-actions">
                  <button className="button dark" type="submit">
                    حفظ التعديل <Icon name="check" />
                  </button>
                  <button
                    className="button outline"
                    type="button"
                    onClick={() => {
                      setEditing(false);
                      setError("");
                    }}
                  >
                    إلغاء
                  </button>
                </div>
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
            </form>
            {!workspace.demo && (
              <p className="inline-notice">
                تعديل بيانات الحساب غير متاح حاليًا. تقدر تشوف اسمك وبريدك هنا.
              </p>
            )}
          </section>
          <section className="paper-card security-card">
            <Icon name="lock" size={30} />
            <div>
              <h2>أمان حسابك</h2>
              <p>
                احتفظ بكلمة مرورك لنفسك. تغيير كلمة المرور واستعادتها غير متاحين
                حاليًا.
              </p>
              <a className="text-link" href="#/help">
                روح للمساعدة <Icon size={16} />
              </a>
            </div>
          </section>
        </>
      )}
    </AccountLayout>
  );
}
