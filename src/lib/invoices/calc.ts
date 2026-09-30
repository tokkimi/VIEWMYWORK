import { roundHalfAwayFromZero } from "@/lib/money";

export type LineInput = {
  description: string;
  quantity: number; // decimal, up to 3 places
  unitPriceCents: number;
  taxRateBps: number; // 2000 = 20%
  discountBps?: number;
};

export type LineResult = LineInput & {
  quantityMilli: number;
  gross: number;
  discount: number;
  lineSubtotal: number;
  lineTax: number;
  lineTotal: number;
};

export function calcLine(l: LineInput): LineResult {
  const quantityMilli = roundHalfAwayFromZero(l.quantity * 1000);
  const gross = roundHalfAwayFromZero((quantityMilli * l.unitPriceCents) / 1000);
  const discount = roundHalfAwayFromZero((gross * (l.discountBps ?? 0)) / 10000);
  const lineSubtotal = gross - discount;
  const lineTax = roundHalfAwayFromZero((lineSubtotal * l.taxRateBps) / 10000);
  return { ...l, quantityMilli, gross, discount, lineSubtotal, lineTax, lineTotal: lineSubtotal + lineTax };
}

/** Authoritative invoice totals — always computed on the server from line items. */
export function calcInvoice(lines: LineInput[]) {
  const computed = lines.map(calcLine);
  const sum = (k: "gross" | "discount" | "lineSubtotal" | "lineTax" | "lineTotal") => computed.reduce((a, l) => a + l[k], 0);
  const taxByRate = new Map<number, number>();
  for (const l of computed) taxByRate.set(l.taxRateBps, (taxByRate.get(l.taxRateBps) ?? 0) + l.lineTax);
  return {
    lines: computed,
    grossCents: sum("gross"),
    discountCents: sum("discount"),
    subtotalCents: sum("lineSubtotal"),
    taxCents: sum("lineTax"),
    totalCents: sum("lineTotal"),
    taxBreakdown: [...taxByRate.entries()].filter(([r]) => r > 0).map(([rateBps, amount]) => ({ rateBps, amount })),
  };
}

export function formatQuantity(quantityMilli: number) {
  const q = quantityMilli / 1000;
  return Number.isInteger(q) ? String(q) : q.toFixed(3).replace(/0+$/, "");
}

export function formatRate(bps: number) {
  const r = bps / 100;
  return `${Number.isInteger(r) ? r : r.toFixed(2)}%`;
}
