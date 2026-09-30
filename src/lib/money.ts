// All money is handled as integer minor units (cents). No floating point sums.

export function roundHalfAwayFromZero(n: number) {
  return n < 0 ? -Math.round(-n) : Math.round(n);
}

/** Parses a user-entered amount ("1 200,50", "1200.5") into cents. Returns null if invalid. */
export function parseMoneyToCents(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined || input === "") return null;
  if (typeof input === "number") return Number.isFinite(input) ? roundHalfAwayFromZero(input * 100) : null;
  let s = input.trim().replace(/[\s €$£]/g, "");
  if (/,\d{1,2}$/.test(s) && !/\.\d{1,2}$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(/,/g, "");
  if (!/^-?\d+(\.\d{1,2})?$/.test(s)) return null;
  const [int, dec = ""] = s.replace("-", "").split(".");
  const cents = Number(int) * 100 + Number((dec + "00").slice(0, 2));
  return s.startsWith("-") ? -cents : cents;
}

export function formatMoney(cents: number, currency = "EUR", locale = "en") {
  return new Intl.NumberFormat(locale, { style: "currency", currency, minimumFractionDigits: cents % 100 === 0 ? 0 : 2, maximumFractionDigits: 2 }).format(cents / 100);
}

export function formatMoneyExact(cents: number, currency = "EUR", locale = "en") {
  return new Intl.NumberFormat(locale, { style: "currency", currency, minimumFractionDigits: 2 }).format(cents / 100);
}

export function centsToInput(cents: number | null | undefined) {
  if (cents === null || cents === undefined) return "";
  return (cents / 100).toFixed(2);
}

export const CURRENCIES = ["EUR", "USD", "GBP", "CHF", "CAD", "AUD", "SEK", "NOK", "DKK", "PLN", "JPY"] as const;
