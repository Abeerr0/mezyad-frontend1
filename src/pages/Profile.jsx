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
    setMessage("تم تحديث بيانات المعاينة فقط.");
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
            <div className="profile-avatar">
              {workspace.user.name?.slice(0, 1)}
            </div>
            <div>
              <h2>{workspace.user.name}</h2>
              <p dir="ltr">{workspace.user.email}</p>
            </div>
            <span className="pill">
              {workspace.demo ? "معاينة" : "حساب مسجل"}
            </span>
          </div>
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
                بياناتك معروضة من جلسة الدخول. تحديث الاسم والبريد يحتاج مسار في
                الباك، وهو غير موجود حاليًا؛ لذلك الحفظ غير مفعّل.
              </p>
            )}
          </section>
          <section className="paper-card security-card">
            <Icon name="lock" size={30} />
            <div>
              <h2>أمان حسابك</h2>
              <p>
                كلمة المرور ما تنعرض هنا. تغييرها واستعادتها مو متاحين في الباك
                الحالي.
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
