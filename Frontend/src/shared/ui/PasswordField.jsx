// تم التعديل من عبير: حقل باسورد مشترك مع زر اظهار واخفاء بدون ارسال النموذج
import React, { useState } from "react";
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
