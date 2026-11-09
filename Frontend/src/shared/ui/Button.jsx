// تم التعديل من عبير: زر موحد يستخدم نفس تنسيق الازرار الحالي بدون تكرار شكله
import React from "react";
// تم التعديل من عبير: زر موحد بنفس الكلاسات الحاليه عشان شكله ما يتغير بين الصفحات.
export default function Button({ full = false, children, ...props }) {
  return (
    <button className={full ? "button dark full" : "button dark"} {...props}>
      {children}
    </button>
  );
}
