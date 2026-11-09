// تم التعديل من عبير: يرسم الايقونه المطلوبه من مجموعه واحده
import React from "react";
export function Icon({ name = "arrow", size = 20, ...props }) {
  const paths = {
    arrow: "M19 12H5m6-6-6 6 6 6",
    search: "m21 21-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
    shield: "M12 3 3 7v5c0 5 9 9 9 9s9-4 9-9V7l-9-4Zm-4 9 3 3 5-6",
    gavel: "m13 3 8 8-3 3-8-8 3-3Zm-2 8-8 8m-1 2h12m-5-13 8 8",
    flag: "M5 21V3m0 1c5-4 9 4 15 0v10c-6 4-10-4-15 0",
    image: "M3 3h18v18H3V3Zm0 13 6-6 6 6 3-3 3 3M15 7h.01",
    clock: "M12 7v5l3 2M22 12A10 10 0 1 1 2 12a10 10 0 0 1 20 0",
    user: "M20 21v-2a6 6 0 0 0-6-6h-4a6 6 0 0 0-6 6v2M16 6a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
    plus: "M12 5v14M5 12h14",
    close: "m6 6 12 12M6 18 18 6",
    chevron: "m6 9 6 6 6-6",
    check: "m5 12 4 4L19 6",
    menu: "M4 6h16M4 12h16M4 18h16",
    lock: "M6 10h12v11H6V10Zm2 0V7a4 4 0 0 1 8 0v3m-4 5v2",
    refresh:
      "M20 7v5h-5M4 17v-5h5M5 7a8 8 0 0 1 13-2l2 3M4 16l2 3a8 8 0 0 0 13-2",
    globe:
      "M22 12A10 10 0 1 1 2 12a10 10 0 0 1 20 0ZM2 12h20M12 2c-5 6-5 14 0 20 5-6 5-14 0-20",
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d={paths[name] || paths.arrow} />
    </svg>
  );
}
