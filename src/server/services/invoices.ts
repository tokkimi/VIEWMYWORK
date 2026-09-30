import type { Invoice, Client, Workspace, WorkspaceSetting, InvoiceSettings, Prisma } from "@prisma/client";
import { db, type Tx } from "@/lib/db";
import { deriveStatus } from "@/lib/invoices/status";
import { notFound } from "@/lib/errors";
import { isUuid, type WorkspaceCtx } from "@/lib/auth/context";

export type SellerSnapshot = {
  name: string;
  legalName?: string | null;
  address?: string | null;
  email?: string | null;
  phone?: string | null;
  vatNumber?: string | null;
  registration?: string | null;
  country?: string | null;
  logoUrl?: string | null;
  bankDetails?: string | null;
};

export type ClientSnapshot = {
  name: string;
  company?: string | null;
  email: string;
  address?: string | null;
  country?: string | null;
  vatNumber?: string | null;
  registration?: string | null;
};

export function buildSellerSnapshot(ws: Workspace, s: WorkspaceSetting | null, inv: InvoiceSettings | null): SellerSnapshot {
  return {
    name: ws.name,
    legalName: s?.companyLegalName ?? ws.name,
    address: s?.companyAddress,
    email: s?.companyEmail,
    phone: s?.companyPhone,
    vatNumber: s?.companyVatNumber,
    registration: s?.companyRegistration,
    country: s?.companyCountry,
    logoUrl: s?.invoiceLogoUrl ?? ws.logoUrl,
    bankDetails: inv?.bankDetails,
  };
}

export function buildClientSnapshot(c: Client): ClientSnapshot {
  return {
    name: `${c.firstName} ${c.lastName}`.trim(),
    company: c.company,
    email: c.billingEmail || c.email,
    address: c.billingAddress,
    country: c.country,
    vatNumber: c.vatNumber,
    registration: c.companyRegistration,
  };
}

/** Seller/client details for display: frozen snapshot once issued, live data while draft. */
export async function invoiceParties(inv: Invoice & { client: Client }) {
  if (inv.sellerSnapshot && inv.clientSnapshot) return { seller: inv.sellerSnapshot as SellerSnapshot, client: inv.clientSnapshot as ClientSnapshot };
  const ws = await db.workspace.findUniqueOrThrow({ where: { id: inv.workspaceId }, include: { settings: true, invoiceSettings: true } });
  return { seller: buildSellerSnapshot(ws, ws.settings, ws.invoiceSettings), client: buildClientSnapshot(inv.client) };
}

/**
 * Recomputes paid/refunded totals and status from the Payment ledger. Locks the invoice row
 * so concurrent payments (two partial payments, duplicate webhooks) are serialised.
 */
export async function recomputeInvoice(tx: Tx, invoiceId: string) {
  await tx.$executeRaw`SELECT 1 FROM "Invoice" WHERE "id" = ${invoiceId}::uuid FOR UPDATE`;
  const inv = await tx.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
  const payments = await tx.payment.findMany({ where: { invoiceId, status: { in: ["SUCCEEDED", "PARTIALLY_REFUNDED", "REFUNDED"] } } });
  const gross = payments.reduce((a, p) => a + p.amountCents, 0);
  const refunded = payments.reduce((a, p) => a + p.refundedCents, 0);
  const paidCents = gross - refunded;
  const next = { ...inv, paidCents, refundedCents: refunded };
  const status = inv.status === "VOID" || inv.status === "DRAFT" ? inv.status : deriveStatus(next);
  const becamePaid = status === "PAID" && inv.status !== "PAID";
  return tx.invoice.update({
    where: { id: invoiceId },
    data: { paidCents, refundedCents: refunded, status, paidAt: status === "PAID" ? (inv.paidAt ?? new Date()) : null },
  }).then((u) => ({ invoice: u, becamePaid }));
}

export async function loadInvoice(ctx: WorkspaceCtx, id: string) {
  if (!isUuid(id)) throw notFound("Invoice not found.");
  const inv = await db.invoice.findFirst({ where: { id, workspaceId: ctx.workspace.id }, include: { client: true, lineItems: { orderBy: { position: "asc" } }, project: true } });
  if (!inv) throw notFound("Invoice not found.");
  return inv;
}

export function clientDisplayName(c: { company?: string | null; firstName: string; lastName: string }) {
  return c.company || `${c.firstName} ${c.lastName}`.trim();
}

export type InvoiceWithRelations = Prisma.InvoiceGetPayload<{ include: { client: true; lineItems: true; project: true } }>;
