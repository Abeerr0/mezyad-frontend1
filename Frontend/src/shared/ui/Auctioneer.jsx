// تم التعديل من عبير: يعرض الشخصيه وحركتها حسب مكانها بالصفحه
import React from "react";
export function Auctioneer({
  small = false,
  character = "auctioneer",
  motion = "gavel",
}) {
  const woman = ["collector", "curator"].includes(character);
  const outfit =
    character === "curator"
      ? "#806344"
      : character === "expert"
        ? "#d5c4a4"
        : woman
          ? "#34392e"
          : "#f8f3e6";
  return (
    <svg
      className={`auctioneer mascot-${motion} ${small ? "small" : ""}`}
      viewBox="0 0 300 300"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <ellipse
        cx="150"
        cy="277"
        rx="100"
        ry="11"
        fill="#262b22"
        opacity=".12"
      />
      <g
        className="mascot-body"
        stroke="#252820"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M90 270 108 166h83l22 104Z" fill={outfit} />
        <path d="m121 178 28 22 27-22m-27 22v68" stroke="#c5ac7c" />
        <path
          d="M108 177 83 205 62 184 49 197c19 32 41 32 61 9"
          fill={outfit}
        />
        <path d="m62 184-6-12c-5-10-21-3-16 8l9 17" fill="#ca926c" />
        <path d="M117 273h24m19 0h30" strokeWidth="8" />
        <g className="mascot-head">
          {/* تم التعديل من عبير: الخبير بنظاره والمنسقه ببروش نجمه عشان تتميز كل شخصيه. */}
          {woman && (
            <path
              d="M99 91c0-73 103-73 103 0l9 85-26-12h-69l-26 12Z"
              fill="#34392e"
            />
          )}
          <path
            d="M109 91c0-45 81-45 81 0v45c0 27-81 27-81 0Z"
            fill="#ca926c"
          />
          {woman ? (
            <>
              <path
                d="M99 97c-3-69 101-70 102-1l-13-9-12-26c-11 15-31 24-63 26l-9 64-10 15Z"
                fill="#34392e"
              />
              <path d="m187 89 7 65-17 16-27 15-30-19" stroke="#c5ac7c" />
              <path d="m124 100 6 3m40-3-5 3" />
            </>
          ) : (
            <>
              <path
                d="M101 95 114 58c11-28 62-29 75 0l12 38-13-7-12-24h-49l-14 26Z"
                fill="#f7f1df"
              />
              <path d="M115 62c22-12 46-12 69 0" strokeWidth="8" />
              <path
                d="M109 98v52l-13 21 26-7 4-56m63-10v54l13 20-27-7-4-56"
                fill="#f7f1df"
              />
              <path d="M126 128c9-5 14-5 23-1 8-4 14-4 23 1" strokeWidth="4" />
            </>
          )}
          {character === "expert" && (
            <g>
              <circle cx="131" cy="106" r="12" />
              <circle cx="166" cy="106" r="12" />
              <path d="M143 106h11" />
            </g>
          )}
          {character === "curator" && (
            <path
              d="m187 151 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z"
              fill="#b18a4b"
            />
          )}
          <g className="mascot-eyes">
            <path d="M128 105h5m32 0h5" strokeWidth="5" />
          </g>
          <path d="m148 107-2 15h7m-17 12c8 8 18 8 26 0" />
        </g>
        <g className="mascot-arm">
          <path d="m199 181 35-44-13-12-37 35" fill={outfit} />
          <path d="m220 133 11-18c8-12 24-2 17 10l-13 17" fill="#ca926c" />
          {motion === "inspect" ? (
            <>
              <path d="m239 119 10-24" strokeWidth="7" />
              <circle
                cx="257"
                cy="76"
                r="24"
                fill="#eee8d7"
                fillOpacity=".9"
                strokeWidth="5"
              />
              <path d="m246 72 6 6 13-14" stroke="#b18a4b" />
            </>
          ) : motion === "bid" ? (
            <>
              <path d="M239 119V86" strokeWidth="7" />
              <rect
                x="218"
                y="39"
                width="44"
                height="51"
                rx="17"
                fill="#b18a4b"
              />
              <path d="M232 73V56l8-4v21m-12 0h19" stroke="#f8f3e6" />
            </>
          ) : motion === "celebrate" ? (
            <>
              <path d="m239 118 7-34" strokeWidth="6" />
              <path
                d="m247 36 8 15 17 3-12 12 2 17-15-8-15 8 3-17-13-12 18-3Z"
                fill="#b18a4b"
              />
            </>
          ) : (
            <>
              <path d="m242 119 25-57" strokeWidth="8" />
              <rect
                x="238"
                y="47"
                width="45"
                height="23"
                rx="5"
                transform="rotate(24 238 47)"
                fill="#b18a4b"
              />
            </>
          )}
        </g>
      </g>
      <g
        className="mascot-flourish"
        stroke="#b18a4b"
        strokeWidth="3"
        strokeLinecap="round"
      >
        <path d="M55 64v20m-10-10h20m163 138v16m-8-8h16" />
        {motion === "celebrate" && (
          <path d="m33 121 9-6m29 118 5-9m169 3 9 9M199 36l3-10" />
        )}
      </g>
    </svg>
  );
}
