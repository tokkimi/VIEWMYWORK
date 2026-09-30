import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { db } from "@/lib/db";
import { fmtDate } from "@/lib/format";
import { EXPENSE_CATEGORIES, PAYMENT_METHOD } from "@/lib/labels";

export type Period = "this_month" | "last_month" | "quarter" | "year" | "custom";

export function periodRange(period: Period, from?: string, to?: string, now = new Date()) {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  if (period === "last_month") return { start: new Date(Date.UTC(y, m - 1, 1)), end: new Date(Date.UTC(y, m, 1)) };
  if (period === "quarter") { const q = Math.floor(m / 3) * 3; return { start: new Date(Date.UTC(y, q, 1)), end: new Date(Date.UTC(y, q + 3, 1)) }; }
  if (period === "year") return { start: new Date(Date.UTC(y, 0, 1)), end: new Date(Date.UTC(y + 1, 0, 1)) };
  if (period === "custom" && from && to) { const e = new Date(to); e.setUTCDate(e.getUTCDate() + 1); return { start: new Date(from), end: e }; }
  return { start: new Date(Date.UTC(y, m, 1)), end: new Date(Date.UTC(y, m + 1, 1)) };
}

/** Accounting data for a period — client invoices, payments and expenses only (never platform billing). */
export async function accountingData(workspaceId: string, start: Date, end: Date) {
  const [invoices, payments, expenses] = await Promise.all([
    db.invoice.findMany({ where: { workspaceId, issuedAt: { gte: start, lt: end }, status: { not: "DRAFT" } }, include: { client: true, project: { select: { name: true } } }, orderBy: { issuedAt: "asc" } }),
    db.payment.findMany({ where: { workspaceId, paidAt: { gte: start, lt: end }, status: { in: ["SUCCEEDED", "PARTIALLY_REFUNDED", "REFUNDED"] } }, include: { invoice: { select: { number: true } }, client: true }, orderBy: { paidAt: "asc" } }),
    db.expense.findMany({ where: { workspaceId, date: { gte: start, lt: end } }, include: { project: { select: { name: true } } }, orderBy: { date: "asc" } }),
  ]);
  return { invoices, payments, expenses };
}

const csvCell = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  // Neutralise spreadsheet formula injection.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n;]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};
const money = (c: number) => (c / 100).toFixed(2);

export function toCsv(d: Awaited<ReturnType<typeof accountingData>>) {
  const rows: unknown[][] = [["Type", "Date", "Reference", "Party", "Project", "Category/Method", "Currency", "Net", "Tax", "Total", "Status"]];
  for (const i of d.invoices) rows.push(["Invoice", fmtDate(i.issuedAt), i.number, i.client.company || `${i.client.firstName} ${i.client.lastName}`, i.project?.name ?? "", "", i.currency, money(i.subtotalCents), money(i.taxCents), money(i.totalCents), i.status]);
  for (const p of d.payments) rows.push(["Payment", fmtDate(p.paidAt), p.invoice.number ?? "", p.client.company || `${p.client.firstName} ${p.client.lastName}`, "", PAYMENT_METHOD[p.method], p.currency, money(p.amountCents - p.refundedCents), "", money(p.amountCents - p.refundedCents), p.status + (p.reference ? ` (${p.reference})` : "")]);
  for (const e of d.expenses) rows.push(["Expense", fmtDate(e.date), e.reference ?? "", e.supplier ?? "", e.project?.name ?? "", EXPENSE_CATEGORIES[e.category as keyof typeof EXPENSE_CATEGORIES] ?? e.category, e.currency, money(e.amountCents - e.taxCents), money(e.taxCents), money(e.amountCents), ""]);
  return "﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
}

export async function toPdf(d: Awaited<ReturnType<typeof accountingData>>, title: string, workspaceName: string) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const clean = (s: string) => s.replace(/[^\x20-\x7E -ÿ€]/g, "?");
  let page = pdf.addPage([842, 595]);
  let y = 555;
  const line = (cols: string[], widths: number[], f = font, size = 8.5) => {
    if (y < 40) { page = pdf.addPage([842, 595]); y = 555; }
    let x = 36;
    cols.forEach((c, i) => { page.drawText(clean(c).slice(0, Math.floor(widths[i] / 4.6)), { x, y, size, font: f, color: rgb(0.1, 0.1, 0.12) }); x += widths[i]; });
    y -= 14;
  };
  page.drawText(clean(`${workspaceName} — ${title}`), { x: 36, y, size: 14, font: bold });
  y -= 28;
  const w = [60, 70, 90, 150, 120, 90, 50, 60, 50, 60];
  const section = (name: string, head: string[], rows: string[][], totals?: Map<string, number[]>) => {
    line([name], [400], bold, 11);
    line(head, w, bold);
    rows.forEach((r) => line(r, w));
    if (totals) for (const [cur, [n, t, g]] of totals) line(["", "", "", "", "", `Total ${cur}`, "", money(n), money(t), money(g)], w, bold);
    y -= 10;
  };
  const sum = (arr: { currency: string; n: number; t: number; g: number }[]) => {
    const m = new Map<string, number[]>();
    for (const a of arr) { const c = m.get(a.currency) ?? [0, 0, 0]; m.set(a.currency, [c[0] + a.n, c[1] + a.t, c[2] + a.g]); }
    return m;
  };
  const head = ["Date", "Reference", "Party", "Project", "Category", "Status", "Cur.", "Net", "Tax", "Total"];
  section("Invoices", head, d.invoices.map((i) => [fmtDate(i.issuedAt), i.number ?? "", i.client.company || `${i.client.firstName} ${i.client.lastName}`, i.project?.name ?? "", "", i.status, i.currency, money(i.subtotalCents), money(i.taxCents), money(i.totalCents)]), sum(d.invoices.map((i) => ({ currency: i.currency, n: i.subtotalCents, t: i.taxCents, g: i.totalCents }))));
  section("Payments received", head, d.payments.map((p) => [fmtDate(p.paidAt), p.invoice.number ?? "", p.client.company || `${p.client.firstName} ${p.client.lastName}`, "", PAYMENT_METHOD[p.method], p.status, p.currency, money(p.amountCents - p.refundedCents), "", money(p.amountCents - p.refundedCents)]), sum(d.payments.map((p) => ({ currency: p.currency, n: p.amountCents - p.refundedCents, t: 0, g: p.amountCents - p.refundedCents }))));
  section("Expenses", head, d.expenses.map((e) => [fmtDate(e.date), e.reference ?? "", e.supplier ?? "", e.project?.name ?? "", EXPENSE_CATEGORIES[e.category as keyof typeof EXPENSE_CATEGORIES] ?? e.category, "", e.currency, money(e.amountCents - e.taxCents), money(e.taxCents), money(e.amountCents)]), sum(d.expenses.map((e) => ({ currency: e.currency, n: e.amountCents - e.taxCents, t: e.taxCents, g: e.amountCents }))));
  return Buffer.from(await pdf.save());
}
