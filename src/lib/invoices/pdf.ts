import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type PDFImage } from "pdf-lib";
import type { InvoiceLineItem, InvoiceStatus } from "@prisma/client";
import { formatMoneyExact } from "@/lib/money";
import { fmtDate } from "@/lib/format";
import { formatQuantity, formatRate } from "./calc";
import { INVOICE_STATUS_LABEL } from "./status";
import type { ClientSnapshot, SellerSnapshot } from "@/server/services/invoices";

type PdfInput = {
  number: string | null;
  status: InvoiceStatus;
  currency: string;
  issueDate: Date;
  dueDate: Date;
  seller: SellerSnapshot;
  client: ClientSnapshot;
  lines: InvoiceLineItem[];
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
  paidCents: number;
  notes?: string | null;
  terms?: string | null;
  footer?: string | null;
  projectName?: string | null;
  locale?: string;
};

const WIN_ANSI_EXTRA = new Set("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ");
/** Standard PDF fonts only cover WinAnsi; replace anything else so rendering never throws. */
function clean(s: string | null | undefined) {
  return (s ?? "")
    .replace(/[   ]/g, " ")
    .split("")
    .map((c) => (c.charCodeAt(0) < 256 || WIN_ANSI_EXTRA.has(c) ? c : "?"))
    .join("")
    .replace(/[\u0000-\u0009\u000b-\u001f]/g, "");
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number) {
  const out: string[] = [];
  for (const para of clean(text).split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/)) {
      const test = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(test, size) > maxWidth && line) {
        out.push(line);
        line = word;
      } else line = test;
    }
    out.push(line);
  }
  return out;
}

async function loadLogo(pdf: PDFDocument, url?: string | null): Promise<PDFImage | null> {
  if (!url || !/^https:\/\//.test(url)) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.length > 2_000_000) return null;
    const type = res.headers.get("content-type") ?? "";
    if (type.includes("png")) return await pdf.embedPng(buf);
    if (type.includes("jpeg") || type.includes("jpg")) return await pdf.embedJpg(buf);
  } catch {
    // Logo is optional — never fail the invoice because of it.
  }
  return null;
}

export async function renderInvoicePdf(inv: PdfInput): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Invoice ${inv.number ?? "draft"}`);
  pdf.setAuthor(clean(inv.seller.legalName || inv.seller.name));
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.06, 0.07, 0.09);
  const muted = rgb(0.45, 0.48, 0.53);
  const line = rgb(0.9, 0.91, 0.93);
  const accent = rgb(0.3, 0.49, 1);
  const W = 595.28;
  const H = 841.89;
  const M = 48;
  const money = (c: number) => clean(formatMoneyExact(c, inv.currency, inv.locale ?? "en"));

  let page: PDFPage = pdf.addPage([W, H]);
  let y = H - M;
  const text = (t: string, x: number, yy: number, o: { size?: number; font?: PDFFont; color?: ReturnType<typeof rgb>; align?: "left" | "right" } = {}) => {
    const size = o.size ?? 9.5;
    const font = o.font ?? regular;
    const s = clean(t);
    const w = font.widthOfTextAtSize(s, size);
    page.drawText(s, { x: o.align === "right" ? x - w : x, y: yy, size, font, color: o.color ?? ink });
  };

  // Header
  const logo = await loadLogo(pdf, inv.seller.logoUrl);
  if (logo) {
    const h = 34;
    const w = Math.min(160, (logo.width / logo.height) * h);
    page.drawImage(logo, { x: M, y: y - h, width: w, height: h });
  } else text(inv.seller.name, M, y - 20, { size: 16, font: bold });
  text("INVOICE", W - M, y - 12, { size: 20, font: bold, align: "right" });
  text(inv.number ?? "DRAFT", W - M, y - 30, { size: 10, color: muted, align: "right" });
  y -= 70;

  // Parties
  const col2 = W / 2 + 10;
  text("FROM", M, y, { size: 7.5, font: bold, color: muted });
  text("BILL TO", col2, y, { size: 7.5, font: bold, color: muted });
  y -= 15;
  const sellerLines = [inv.seller.legalName || inv.seller.name, ...(inv.seller.address ?? "").split("\n"), inv.seller.country, inv.seller.email, inv.seller.phone, inv.seller.vatNumber ? `VAT: ${inv.seller.vatNumber}` : null, inv.seller.registration ? `Reg: ${inv.seller.registration}` : null].filter(Boolean) as string[];
  const clientLines = [inv.client.company, inv.client.name, ...(inv.client.address ?? "").split("\n"), inv.client.country, inv.client.email, inv.client.vatNumber ? `VAT: ${inv.client.vatNumber}` : null, inv.client.registration ? `Reg: ${inv.client.registration}` : null].filter(Boolean) as string[];
  const rows = Math.max(sellerLines.length, clientLines.length);
  for (let i = 0; i < rows; i++) {
    if (sellerLines[i]) text(sellerLines[i], M, y, { font: i === 0 ? bold : regular });
    if (clientLines[i]) text(clientLines[i], col2, y, { font: i === 0 ? bold : regular });
    y -= 13;
  }
  y -= 14;

  // Meta
  const meta: [string, string][] = [
    ["Issue date", fmtDate(inv.issueDate)],
    ["Due date", fmtDate(inv.dueDate)],
    ["Status", INVOICE_STATUS_LABEL[inv.status]],
  ];
  if (inv.projectName) meta.push(["Project", inv.projectName]);
  page.drawRectangle({ x: M, y: y - 38, width: W - 2 * M, height: 44, color: rgb(0.97, 0.975, 0.98) });
  const mw = (W - 2 * M) / meta.length;
  meta.forEach(([k, v], i) => {
    text(k.toUpperCase(), M + 12 + i * mw, y - 12, { size: 7, font: bold, color: muted });
    text(v, M + 12 + i * mw, y - 27, { size: 9.5, font: bold, color: k === "Status" && inv.status === "PAID" ? rgb(0.15, 0.6, 0.4) : ink });
  });
  y -= 64;

  // Line items
  const cx = { desc: M, qty: W - M - 250, unit: W - M - 170, tax: W - M - 90, total: W - M };
  const header = () => {
    text("DESCRIPTION", cx.desc, y, { size: 7.5, font: bold, color: muted });
    text("QTY", cx.qty, y, { size: 7.5, font: bold, color: muted, align: "right" });
    text("UNIT PRICE", cx.unit, y, { size: 7.5, font: bold, color: muted, align: "right" });
    text("TAX", cx.tax, y, { size: 7.5, font: bold, color: muted, align: "right" });
    text("AMOUNT", cx.total, y, { size: 7.5, font: bold, color: muted, align: "right" });
    y -= 8;
    page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.8, color: line });
    y -= 16;
  };
  header();
  for (const l of inv.lines) {
    const descLines = wrap(l.description, regular, 9.5, cx.qty - M - 50);
    if (y - descLines.length * 12 < 170) {
      page = pdf.addPage([W, H]);
      y = H - M;
      header();
    }
    descLines.forEach((d, i) => text(d, cx.desc, y - i * 12));
    text(formatQuantity(l.quantityMilli), cx.qty, y, { align: "right" });
    text(money(l.unitPriceCents), cx.unit, y, { align: "right" });
    text(l.taxRateBps ? formatRate(l.taxRateBps) : "—", cx.tax, y, { align: "right", color: muted });
    text(money(l.lineSubtotal), cx.total, y, { align: "right" });
    if (l.discountBps) text(`Discount ${formatRate(l.discountBps)}`, cx.desc, y - descLines.length * 12, { size: 8, color: muted });
    y -= Math.max(1, descLines.length + (l.discountBps ? 1 : 0)) * 12 + 8;
    page.drawLine({ start: { x: M, y: y + 4 }, end: { x: W - M, y: y + 4 }, thickness: 0.4, color: line });
  }

  // Totals
  y -= 10;
  const tx = W - M - 180;
  const totalRow = (k: string, v: string, strong = false) => {
    text(k, tx, y, { font: strong ? bold : regular, color: strong ? ink : muted, size: strong ? 11 : 9.5 });
    text(v, W - M, y, { font: strong ? bold : regular, align: "right", size: strong ? 11 : 9.5 });
    y -= strong ? 20 : 15;
  };
  if (inv.discountCents) totalRow("Discount", `- ${money(inv.discountCents)}`);
  totalRow("Subtotal", money(inv.subtotalCents));
  totalRow("Tax", money(inv.taxCents));
  page.drawLine({ start: { x: tx, y: y + 8 }, end: { x: W - M, y: y + 8 }, thickness: 0.8, color: line });
  y -= 4;
  totalRow("Total", money(inv.totalCents), true);
  if (inv.paidCents > 0) {
    totalRow("Paid", `- ${money(inv.paidCents)}`);
    totalRow("Amount due", money(Math.max(0, inv.totalCents - inv.paidCents)), true);
  }
  if (inv.status === "PAID") {
    page.drawRectangle({ x: M, y: y + 12, width: 60, height: 20, borderColor: rgb(0.15, 0.6, 0.4), borderWidth: 1.2 });
    text("PAID", M + 16, y + 18, { font: bold, size: 10, color: rgb(0.15, 0.6, 0.4) });
  }

  // Notes & payment info
  y -= 16;
  const block = (title: string, body?: string | null) => {
    if (!body) return;
    if (y < 110) {
      page = pdf.addPage([W, H]);
      y = H - M;
    }
    text(title.toUpperCase(), M, y, { size: 7.5, font: bold, color: muted });
    y -= 13;
    for (const l of wrap(body, regular, 9, W - 2 * M)) {
      text(l, M, y, { size: 9, color: rgb(0.25, 0.27, 0.31) });
      y -= 12;
    }
    y -= 10;
  };
  block("Payment information", [inv.terms, inv.seller.bankDetails].filter(Boolean).join("\n\n") || null);
  block("Notes", inv.notes);

  // Footer on every page
  for (const p of pdf.getPages()) {
    const f = clean(inv.footer || `${inv.seller.legalName || inv.seller.name}${inv.seller.vatNumber ? ` · VAT ${inv.seller.vatNumber}` : ""}`);
    p.drawLine({ start: { x: M, y: 40 }, end: { x: W - M, y: 40 }, thickness: 0.4, color: line });
    p.drawText(f.slice(0, 140), { x: M, y: 26, size: 7.5, font: regular, color: muted });
    p.drawRectangle({ x: W - M - 18, y: 28, width: 18, height: 3, color: accent });
  }
  return Buffer.from(await pdf.save());
}
