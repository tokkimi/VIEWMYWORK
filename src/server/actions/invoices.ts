"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { runAction, AppError } from "@/lib/errors";
import { requireWorkspace, requirePerm, isUuid } from "@/lib/auth/context";
import { formToObject, zId, zOptStr, zCurrency, zEmail, zMoney } from "@/lib/validation";
import { calcInvoice } from "@/lib/invoices/calc";
import { allocateInvoiceNumber } from "@/lib/invoices/numbering";
import { outstandingCents, isPayable } from "@/lib/invoices/status";
import { renderInvoicePdf } from "@/lib/invoices/pdf";
import { formatMoney } from "@/lib/money";
import { fmtDate } from "@/lib/format";
import { emit } from "@/lib/events";
import { sendEmail } from "@/lib/email/send";
import { emailTemplates } from "@/lib/email/templates";
import { env } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";
import { requireActiveSubscription } from "@/lib/plans";
import { buildClientSnapshot, buildSellerSnapshot, clientDisplayName, invoiceParties, loadInvoice, recomputeInvoice } from "@/server/services/invoices";
import { afterPayment, deliverReminder } from "@/server/services/billing";

const lineSchema = z.object({
  description: z.string().trim().min(1, "Each line needs a description.").max(1000),
  quantity: z.coerce.number().min(0, "Quantity can't be negative.").max(1_000_000),
  unitPrice: zMoney.refine((v) => Math.abs(v) <= 100_000_000_00, "Amount too large."),
  taxRate: z.coerce.number().min(0).max(100).default(0),
  discount: z.coerce.number().min(0).max(100).default(0),
});

const invoiceSchema = z.object({
  clientId: zId,
  projectId: z.preprocess((v) => (v === "" ? undefined : v), zId.optional()),
  currency: zCurrency,
  issueDate: z.coerce.date(),
  dueDate: z.coerce.date(),
  notes: zOptStr(5000),
  terms: zOptStr(5000),
  footer: zOptStr(500),
  // Line items arrive as JSON; any totals sent by the browser are ignored and recomputed below.
  lines: z.preprocess((v) => {
    try {
      return JSON.parse(String(v));
    } catch {
      return [];
    }
  }, z.array(lineSchema).min(1, "Add at least one line item.").max(200)),
});

function computeLines(lines: z.infer<typeof lineSchema>[]) {
  const totals = calcInvoice(lines.map((l) => ({ description: l.description, quantity: l.quantity, unitPriceCents: l.unitPrice, taxRateBps: Math.round(l.taxRate * 100), discountBps: Math.round(l.discount * 100) })));
  return {
    totals,
    rows: totals.lines.map((l, i) => ({ position: i, description: l.description, quantityMilli: l.quantityMilli, unitPriceCents: l.unitPriceCents, taxRateBps: l.taxRateBps, discountBps: l.discountBps ?? 0, lineSubtotal: l.lineSubtotal, lineTax: l.lineTax, lineTotal: l.lineTotal })),
  };
}

async function validateRefs(workspaceId: string, clientId: string, projectId?: string) {
  const client = await db.client.findFirst({ where: { id: clientId, workspaceId } });
  if (!client) throw new AppError("Client not found.");
  if (projectId && !(await db.project.findFirst({ where: { id: projectId, workspaceId, clientId } }))) throw new AppError("That project doesn't belong to this client.");
  return client;
}

export async function saveInvoiceAction(fd: FormData) {
  return runAction(async () => {
    const ctx = await requireWorkspace();
    requirePerm(ctx, "invoices", "edit");
    await requireActiveSubscription(ctx.workspace.id);
    const raw = formToObject(fd);
    const input = invoiceSchema.parse(raw);
    if (input.dueDate < input.issueDate) throw new AppError("Due date must be on or after the issue date.");
    const client = await validateRefs(ctx.workspace.id, input.clientId, input.projectId);
    const { totals, rows } = computeLines(input.lines);
    if (totals.totalCents < 0) throw new AppError("Invoice total can't be negative.");
    const id = typeof raw.id === "string" && isUuid(raw.id) ? raw.id : null;
    const data = {
      clientId: input.clientId, projectId: input.projectId ?? null, currency: input.currency, issueDate: input.issueDate, dueDate: input.dueDate,
      notes: input.notes ?? null, terms: input.terms ?? null, footer: input.footer ?? null,
      subtotalCents: totals.subtotalCents, discountCents: totals.discountCents, taxCents: totals.taxCents, totalCents: totals.totalCents,
    };
    if (id) {
      const existing = await loadInvoice(ctx, id);
      if (existing.status !== "DRAFT") throw new AppError("Issued invoices can't be edited. Void it and create a new one instead.");
      await db.$transaction([db.invoiceLineItem.deleteMany({ where: { invoiceId: id } }), db.invoice.update({ where: { id }, data: { ...data, lineItems: { create: rows } } })]);
      return { id, redirect: `/app/invoices/${id}` };
    }
    const inv = await db.invoice.create({ data: { ...data, workspaceId: ctx.workspace.id, createdById: ctx.user.id, lineItems: { create: rows } } });
    await emit({ workspaceId: ctx.workspace.id, type: "INVOICE_CREATED", actor: { id: ctx.user.id, name: ctx.user.name }, projectId: inv.projectId, clientId: client.id, entityType: "INVOICE", entityId: inv.id, summary: `Draft invoice created for ${clientDisplayName(client)} (${formatMoney(inv.totalCents, inv.currency)})` });
    return { id: inv.id, redirect: `/app/invoices/${inv.id}` };
  }, "Invoice saved.");
}

export async function deleteDraftInvoiceAction(id: string) {
  return runAction(async () => {
    const ctx = await requireWorkspace();
    requirePerm(ctx, "invoices", "edit");
    const inv = await loadInvoice(ctx, id);
    if (inv.status !== "DRAFT") throw new AppError("Only drafts can be deleted. Issued invoices can be voided.");
    await db.invoice.delete({ where: { id } });
    return { redirect: "/app/invoices" };
  }, "Draft deleted.");
}

export async function duplicateInvoiceAction(id: string) {
  return runAction(async () => {
    const ctx = await requireWorkspace();
    requirePerm(ctx, "invoices", "edit");
    const inv = await loadInvoice(ctx, id);
    const settings = await db.invoiceSettings.findUnique({ where: { workspaceId: ctx.workspace.id } });
    const now = new Date();
    const copy = await db.invoice.create({
      data: {
        workspaceId: ctx.workspace.id, clientId: inv.clientId, projectId: inv.projectId, currency: inv.currency, issueDate: now, dueDate: new Date(now.getTime() + (settings?.defaultDueDays ?? 30) * 86400_000),
        notes: inv.notes, terms: inv.terms, footer: inv.footer, subtotalCents: inv.subtotalCents, discountCents: inv.discountCents, taxCents: inv.taxCents, totalCents: inv.totalCents, createdById: ctx.user.id,
        lineItems: { create: inv.lineItems.map(({ id: _id, invoiceId: _inv, ...l }) => l) },
      },
    });
    return { id: copy.id, redirect: `/app/invoices/${copy.id}/edit` };
  }, "Invoice duplicated as a new draft.");
}

export async function voidInvoiceAction(id: string) {
  return runAction(async () => {
    const ctx = await requireWorkspace();
    requirePerm(ctx, "invoices", "edit");
    const inv = await loadInvoice(ctx, id);
    if (inv.status === "DRAFT") throw new AppError("Drafts can simply be deleted.");
    if (inv.status === "VOID") throw new AppError("This invoice is already void.");
    if (inv.paidCents > 0) throw new AppError("This invoice has payments. Refund them before voiding.");
    await db.invoice.update({ where: { id }, data: { status: "VOID", voidedAt: new Date() } });
    await db.clientWait.updateMany({ where: { entityType: "INVOICE", entityId: id, resolvedAt: null }, data: { resolvedAt: new Date() } });
    await emit({
      workspaceId: ctx.workspace.id, type: "INVOICE_VOIDED", actor: { id: ctx.user.id, name: ctx.user.name }, projectId: inv.projectId, clientId: inv.clientId, entityType: "INVOICE", entityId: id,
      summary: `Invoice ${inv.number} voided`, clientVisible: true,
      notify: { client: true, title: `Invoice ${inv.number} was cancelled`, message: `Invoice ${inv.number} (${formatMoney(inv.totalCents, inv.currency)}) has been cancelled. No payment is needed.`, clientActionUrl: `/portal/invoices/${id}`, actionLabel: "View invoice" },
    });
    return null;
  }, "Invoice voided.");
}

export async function updateIssuedInvoiceAction(fd: FormData) {
  return runAction(async () => {
    const ctx = await requireWorkspace();
    requirePerm(ctx, "invoices", "edit");
    const i = z.object({ id: zId, dueDate: z.coerce.date(), notes: zOptStr(5000) }).parse(formToObject(fd));
    const inv = await loadInvoice(ctx, i.id);
    if (inv.status === "DRAFT" || inv.status === "VOID") throw new AppError("Nothing to update.");
    await db.$transaction(async (tx) => {
      await tx.invoice.update({ where: { id: i.id }, data: { dueDate: i.dueDate, notes: i.notes ?? null } });
      await recomputeInvoice(tx, i.id);
    });
    await emit({
      workspaceId: ctx.workspace.id, type: "INVOICE_UPDATED", actor: { id: ctx.user.id, name: ctx.user.name }, projectId: inv.projectId, clientId: inv.clientId, entityType: "INVOICE", entityId: i.id,
      summary: `Invoice ${inv.number} updated (due ${fmtDate(i.dueDate)})`, clientVisible: true,
      notify: { client: true, title: `Invoice ${inv.number} updated`, message: `The due date is now ${fmtDate(i.dueDate)}.`, clientActionUrl: `/portal/invoices/${i.id}`, actionLabel: "View invoice" },
    });
    return null;
  }, "Invoice updated.");
}

/** Issues (if draft) and emails the invoice with its PDF. Numbering + snapshots happen atomically. */
export async function sendInvoiceAction(fd: FormData) {
  return runAction(async () => {
    const ctx = await requireWorkspace();
    requirePerm(ctx, "invoices", "edit");
    await requireActiveSubscription(ctx.workspace.id);
    await rateLimit("send-invoice", 60, 3600, ctx.workspace.id);
    const splitEmails = (v: unknown) => (typeof v === "string" ? v.split(/[,;\s]+/).filter(Boolean) : []);
    const i = z
      .object({
        id: zId,
        to: zEmail,
        cc: z.preprocess(splitEmails, z.array(zEmail).max(10)),
        bcc: z.preprocess(splitEmails, z.array(zEmail).max(10)),
        subject: z.string().trim().min(1).max(200),
        message: zOptStr(5000),
        sendCopy: z.string().optional(),
      })
      .parse(formToObject(fd));
    const inv0 = await loadInvoice(ctx, i.id);
    if (inv0.status === "VOID") throw new AppError("Void invoices can't be sent.");
    if (inv0.totalCents <= 0) throw new AppError("The invoice total must be greater than zero.");

    const now = new Date();
    const inv = await db.$transaction(async (tx) => {
      if (inv0.status !== "DRAFT") return tx.invoice.update({ where: { id: inv0.id }, data: { sentAt: now }, include: { client: true, lineItems: { orderBy: { position: "asc" } }, project: true } });
      const ws = await tx.workspace.findUniqueOrThrow({ where: { id: ctx.workspace.id }, include: { settings: true, invoiceSettings: true } });
      const number = await allocateInvoiceNumber(tx, ctx.workspace.id, now);
      return tx.invoice.update({
        where: { id: inv0.id },
        data: { number, status: "SENT", issuedAt: now, sentAt: now, sellerSnapshot: buildSellerSnapshot(ws, ws.settings, ws.invoiceSettings), clientSnapshot: buildClientSnapshot(inv0.client) },
        include: { client: true, lineItems: { orderBy: { position: "asc" } }, project: true },
      });
    });

    const { seller, client } = await invoiceParties(inv);
    const pdf = await renderInvoicePdf({ ...inv, seller, client, lines: inv.lineItems, projectName: inv.project?.name, locale: inv.client.preferredLanguage });
    const due = outstandingCents(inv);
    const t = emailTemplates.invoiceSent({ brand: { name: ctx.workspace.name, logoUrl: seller.logoUrl }, number: inv.number!, amount: formatMoney(due, inv.currency), dueDate: fmtDate(inv.dueDate), message: i.message, link: `${env.appUrl}/i/${inv.publicToken}` });
    const mail = await sendEmail({
      to: i.to, cc: i.cc, bcc: [...i.bcc, ...(i.sendCopy ? [ctx.user.email] : [])], subject: i.subject, html: t.html, template: "invoice_sent", workspaceId: ctx.workspace.id, entityType: "INVOICE", entityId: inv.id,
      attachments: [{ filename: `${inv.number}.pdf`, content: pdf }], fromName: ctx.workspace.name, replyTo: seller.email ?? ctx.user.email,
    });

    if (inv.projectId && inv0.status === "DRAFT") await db.clientWait.create({ data: { projectId: inv.projectId, reason: "PAYMENT", label: `Invoice ${inv.number}`, entityType: "INVOICE", entityId: inv.id } });
    await emit({
      workspaceId: ctx.workspace.id, type: "INVOICE_SENT", actor: { id: ctx.user.id, name: ctx.user.name }, projectId: inv.projectId, clientId: inv.clientId, entityType: "INVOICE", entityId: inv.id,
      summary: `Invoice ${inv.number} sent to ${i.to} (${formatMoney(inv.totalCents, inv.currency)})`, clientVisible: true,
      metadata: { emailStatus: mail.status },
      notify: { client: true, title: `New invoice ${inv.number}`, message: `${formatMoney(due, inv.currency)} due ${fmtDate(inv.dueDate)}.`, clientActionUrl: `/portal/invoices/${inv.id}`, actionLabel: "View & pay" },
    });
    return { number: inv.number, emailStatus: mail.status, emailError: mail.error };
  });
}

export async function recordManualPaymentAction(fd: FormData) {
  return runAction(async () => {
    const ctx = await requireWorkspace();
    requirePerm(ctx, "invoices", "edit");
    const i = z
      .object({ invoiceId: zId, amount: zMoney.refine((v) => v > 0, "Amount must be greater than zero."), date: z.coerce.date(), method: z.enum(["BANK_TRANSFER", "CASH", "CHECK", "CARD", "OTHER"]), reference: zOptStr(120), notes: zOptStr(2000) })
      .parse(formToObject(fd));
    const inv = await loadInvoice(ctx, i.invoiceId);
    if (!isPayable(inv.status)) throw new AppError(inv.status === "DRAFT" ? "Send the invoice before recording payments." : "This invoice can't receive payments.");
    const res = await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT 1 FROM "Invoice" WHERE "id" = ${inv.id}::uuid FOR UPDATE`;
      const fresh = await tx.invoice.findUniqueOrThrow({ where: { id: inv.id } });
      if (i.amount > outstandingCents(fresh)) throw new AppError(`Amount exceeds the outstanding balance of ${formatMoney(outstandingCents(fresh), fresh.currency)}.`);
      const p = await tx.payment.create({ data: { workspaceId: ctx.workspace.id, invoiceId: inv.id, clientId: inv.clientId, amountCents: i.amount, currency: inv.currency, provider: "manual", method: i.method, status: "SUCCEEDED", reference: i.reference, notes: i.notes, paidAt: i.date, recordedById: ctx.user.id } });
      const r = await recomputeInvoice(tx, inv.id);
      return { payment: p, ...r };
    });
    await afterPayment(ctx.workspace.id, res.invoice.id, res.payment.amountCents, { id: ctx.user.id, name: ctx.user.name }, "manual");
    await db.auditLog.create({ data: { actorId: ctx.user.id, actorEmail: ctx.user.email, scope: "WORKSPACE", workspaceId: ctx.workspace.id, action: "MANUAL_PAYMENT_RECORDED", targetType: "INVOICE", targetId: inv.id, metadata: { amountCents: i.amount, method: i.method } } });
    return null;
  }, "Payment recorded.");
}

export async function sendReminderAction(invoiceId: string) {
  return runAction(async () => {
    const ctx = await requireWorkspace();
    requirePerm(ctx, "invoices", "edit");
    await rateLimit("reminder", 1, 3600, invoiceId); // at most one manual reminder per invoice per hour
    const inv = await loadInvoice(ctx, invoiceId);
    if (!isPayable(inv.status) || outstandingCents(inv) <= 0) throw new AppError("This invoice has nothing outstanding.");
    const r = await deliverReminder(inv.id, "MANUAL", null, ctx.user.id);
    if (r.status === "NOT_CONFIGURED") throw new AppError("Email delivery isn't configured, so the reminder couldn't be sent.", "CONFIG");
    if (r.status === "FAILED") throw new AppError(`The reminder couldn't be delivered: ${r.error ?? "unknown error"}`);
    return null;
  }, "Reminder sent.");
}

export async function saveInvoiceSettingsAction(fd: FormData) {
  return runAction(async () => {
    const ctx = await requireWorkspace();
    requirePerm(ctx, "settings", "manage");
    const raw = formToObject(fd);
    const i = z
      .object({
        prefix: z.string().trim().max(12).regex(/^[A-Za-z0-9_-]*$/, "Use letters, numbers, - or _ only."),
        includeYear: z.preprocess((v) => v === "on", z.boolean()),
        nextNumber: z.coerce.number().int().min(1).max(10_000_000),
        padding: z.coerce.number().int().min(1).max(8),
        defaultDueDays: z.coerce.number().int().min(0).max(365),
        defaultTaxRate: z.coerce.number().min(0).max(100),
        defaultCurrency: zCurrency,
        defaultNotes: zOptStr(5000),
        defaultTerms: zOptStr(5000),
        footer: zOptStr(500),
        bankDetails: zOptStr(2000),
        remindersEnabled: z.preprocess((v) => v === "on", z.boolean()),
        reminderOffsets: z.preprocess((v) => (Array.isArray(v) ? v.map(Number) : v ? [Number(v)] : []), z.array(z.number().int().min(-30).max(90)).max(10)),
      })
      .parse({ ...raw, reminderOffsets: fd.getAll("reminderOffsets") });
    const { defaultTaxRate, ...rest } = i;
    const data = { ...rest, defaultTaxRateBps: Math.round(defaultTaxRate * 100), defaultNotes: i.defaultNotes ?? null, defaultTerms: i.defaultTerms ?? null, footer: i.footer ?? null, bankDetails: i.bankDetails ?? null };
    await db.invoiceSettings.upsert({ where: { workspaceId: ctx.workspace.id }, create: { workspaceId: ctx.workspace.id, ...data }, update: data });
    return null;
  }, "Invoice settings saved.");
}
