import type { InvoiceStatus } from "@prisma/client";

type InvoiceLike = {
  status: InvoiceStatus;
  totalCents: number;
  paidCents: number;
  refundedCents: number;
  dueDate: Date;
};

export function outstandingCents(inv: Pick<InvoiceLike, "totalCents" | "paidCents">) {
  return Math.max(0, inv.totalCents - inv.paidCents);
}

function startOfDayUTC(d: Date) {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export function isOverdue(inv: InvoiceLike, now = new Date()) {
  if (["DRAFT", "VOID", "PAID", "REFUNDED"].includes(inv.status)) return false;
  return startOfDayUTC(inv.dueDate) < startOfDayUTC(now) && outstandingCents(inv) > 0;
}

export function daysOverdue(inv: InvoiceLike, now = new Date()) {
  if (!isOverdue(inv, now)) return 0;
  return Math.floor((startOfDayUTC(now) - startOfDayUTC(inv.dueDate)) / 86400_000);
}

/**
 * Single source of truth for an invoice status. Stored status is recomputed with
 * this after every payment/refund and by the daily job, and every UI renders via it.
 * `paidCents` is the net amount collected (succeeded payments minus refunds).
 */
export function deriveStatus(inv: InvoiceLike & { firstViewedAt?: Date | null }, now = new Date()): InvoiceStatus {
  if (inv.status === "DRAFT" || inv.status === "VOID") return inv.status;
  if (inv.totalCents > 0 && inv.paidCents >= inv.totalCents) return "PAID";
  if (inv.refundedCents > 0 && inv.paidCents <= 0) return "REFUNDED";
  if (isOverdue({ ...inv, status: "SENT" }, now)) return "OVERDUE";
  if (inv.paidCents > 0) return "PARTIALLY_PAID";
  if (inv.status === "VIEWED" || inv.firstViewedAt) return "VIEWED";
  return "SENT";
}

export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  VIEWED: "Viewed",
  PARTIALLY_PAID: "Partially paid",
  PAID: "Paid",
  OVERDUE: "Overdue",
  VOID: "Void",
  REFUNDED: "Refunded",
};

export function isPayable(status: InvoiceStatus) {
  return ["SENT", "VIEWED", "PARTIALLY_PAID", "OVERDUE"].includes(status);
}
