// تم التعديل من عبير: عرض موحد للتحميل والخطا واعاده المحاوله
import Button from "./Button.jsx";
import React from "react";
import { Icon } from "./Icon.jsx";
export function StatePanel({ loading, error, onRetry }) {
  if (loading)
    return (
      <div
        className="skeleton-grid"
        aria-label={"جاري تحميل المزادات"}
        role="status"
      >
        {[1, 2, 3].map((n) => (
          <div className="skeleton-card" key={n}>
            <div />
            <span />
            <span />
          </div>
        ))}
      </div>
    );
  if (error)
    return (
      <div className="state-panel" role="alert">
        <Icon name="globe" size={32} />
        <h3>ما قدرنا نحمّل المزادات</h3>
        <p>{error}</p>
        <div className="button-row">
          <Button onClick={onRetry}>
            <Icon name="refresh" />
            إعادة المحاولة
          </Button>
        </div>
      </div>
    );
  return null;
}
