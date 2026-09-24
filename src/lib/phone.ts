/** Normalize Kenyan numbers: 07xx / 01xx / +2547xx / 7xx → 2547xxxxxxxx */
export function normalizePhone(input: string): string | null {
  const d = input.replace(/\D/g, "");
  let n = d;
  if (n.startsWith("254")) n = n;
  else if (n.startsWith("0")) n = "254" + n.slice(1);
  else if (n.length === 9) n = "254" + n;
  return /^254(7|1)\d{8}$/.test(n) ? n : null;
}

/** Internal auth identifier; users only ever see their phone number. */
export function phoneToAuthEmail(phone: string) {
  return `${phone}@phone.smartearn.app`;
}

export const ksh = (n: number | string) =>
  `KSh ${Number(n).toLocaleString("en-KE", { maximumFractionDigits: 2 })}`;
