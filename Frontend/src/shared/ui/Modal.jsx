// تم التعديل من عبير: نافذه مشتركه تحفظ التركيز وتدعم الاغلاق والكيبورد
import React, { useEffect, useRef } from "react";
import { Icon } from "./Icon.jsx";
export function Modal({ title, children, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    const dialog = ref.current;
    dialog.showModal();
    return () => {
      dialog.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby="modal-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <button
        className="icon-button modal-close"
        onClick={onClose}
        aria-label={"إغلاق"}
      >
        <Icon name="close" />
      </button>
      <h2 id="modal-title">{title}</h2>
      {children}
    </dialog>
  );
}
