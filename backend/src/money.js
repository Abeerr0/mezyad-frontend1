export function validMoney(value) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0)
    return false;
  try {
    return toCents(value) > 0;
  } catch {
    return false;
  }
}

export function toCents(value) {
  if (typeof value !== "number" && typeof value !== "string")
    throw new TypeError("Invalid amount");
  // نحسب المبلغ بالهللات عشان الكسور ما تغيّر النتيجة.
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(String(value));
  if (!match) throw new RangeError("Invalid currency precision");
  const riyals = Number(match[1]);
  const halalas = Number((match[2] || "").padEnd(2, "0"));
  const cents = riyals * 100 + halalas;
  if (!Number.isSafeInteger(cents) || cents > 99999999999999)
    throw new RangeError("Amount exceeds currency limit");
  return cents;
}
