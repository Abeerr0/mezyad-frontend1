import React from "react";

// تم التعديل من عبير: نفصل كل افتار من اللوحه بعرض جزءه فقط ونستبعد الصوره المكرره.
export const avatarCells = [0, 1, 2, 5, 6, 7, 8, 10, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24];
export function Avatar({ value = 0, name = "", className = "" }) {
  const cell = avatarCells.includes(value) ? value : 0;
  return <span className={"member-avatar " + className} role="img" aria-label={name ? "افتار " + name : "افتار مزياد"} style={{ backgroundPosition: `${(cell % 5) * 25}% ${Math.floor(cell / 5) * 25}%` }} />;
}
