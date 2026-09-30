import { db } from "@/lib/db";
import { emit } from "@/lib/events";
import { makeFmt, normalizeLocale } from "@/lib/i18n/core";
import { outstandingCents, daysOverdue } from "@/lib/invoices/status";
import { sendEmail } from "@/lib/email/send";
import { emailTemplates } from "@/lib/email/templates";
import { env } from "@/lib/env";
import { clientDisplayName } from "./invoices";

// NOTE: server-only helpers — deliberately NOT in a "use server" module so they can't be invoked from the browser.

/** Shared post-payment pipeline (manual + webhook): activity, notifications, receipt. */
export async function afterPayment(workspaceId: string, invoiceId: string, amountCents: number, actor: { id: string; name: string } | null, source: "manual" | "stripe") {
  const inv = await db.invoice.findUniqueOrThrow({ where: { id: invoiceId }, include: { client: true, workspace: { include: { settings: true } } } });
  const amount = { money: amountCents, currency: inv.currency };
  const who = clientDisplayName(inv.client);
  const remaining = { money: outstandingCents(inv), currency: inv.currency };
  if (inv.status === "PAID") await db.clientWait.updateMany({ where: { entityType: "INVOICE", entityId: invoiceId, resolvedAt: null }, data: { resolvedAt: new Date() } });
  await emit({
    workspaceId, type: "PAYMENT_RECEIVED", actor, projectId: inv.projectId, clientId: inv.clientId, entityType: "INVOICE", entityId: invoiceId,
    summary: [source === "manual" ? "Payment of {amount} received for {number} (recorded manually)" : "Payment of {amount} received for {number}", { amount, number: inv.number }], clientVisible: true,
    notify: {
      team: { kind: "workspace", capability: ["invoices", "view"] }, client: true,
      title: ["Payment received — {amount}", { amount }],
      message: inv.status === "PAID" ? ["{who} paid {amount} for invoice {number}. The invoice is now fully paid.", { who, amount, number: inv.number }] : ["{who} paid {amount} for invoice {number}. Remaining: {remaining}.", { who, amount, number: inv.number, remaining }],
      actionUrl: `/app/invoices/${invoiceId}`, clientActionUrl: `/portal/invoices/${invoiceId}`, actionLabel: "Open invoice", email: true,
    },
  });
  const locale = normalizeLocale(inv.client.preferredLanguage);
  const fmt = makeFmt(locale);
  const t = emailTemplates.paymentConfirmation({ brand: { name: inv.workspace.name, logoUrl: inv.workspace.settings?.invoiceLogoUrl ?? inv.workspace.logoUrl }, number: inv.number!, amount: fmt.money(amountCents, inv.currency), date: fmt.date(new Date()), remaining: inv.status === "PAID" ? null : fmt.money(outstandingCents(inv), inv.currency), link: `${env.appUrl}/i/${inv.publicToken}` }, locale);
  await sendEmail({ to: inv.client.billingEmail || inv.client.email, subject: t.subject, html: t.html, template: "payment_confirmation", workspaceId, entityType: "INVOICE", entityId: invoiceId, fromName: inv.workspace.name });
}

/** Sends a payment reminder and records it. AUTO reminders are deduplicated by (invoice, offset). */
export async function deliverReminder(invoiceId: string, kind: "MANUAL" | "AUTO", offsetDays: number | null, actorId: string | null) {
  const inv = await db.invoice.findUniqueOrThrow({ where: { id: invoiceId }, include: { client: true, workspace: { include: { settings: true } } } });
  const to = inv.client.billingEmail || inv.client.email;
  if (kind === "AUTO") {
    // Reserve the slot first; the unique constraint guarantees at most one send per offset.
    const created = await db.invoiceReminder.createMany({ data: [{ invoiceId, kind, offsetDays, sentTo: to }], skipDuplicates: true });
    if (created.count === 0) return { status: "SKIPPED" as const };
  } else await db.invoiceReminder.create({ data: { invoiceId, kind, offsetDays, sentTo: to, sentById: actorId } });
  const locale = normalizeLocale(inv.client.preferredLanguage);
  const fmt = makeFmt(locale);
  const t = emailTemplates.invoiceReminder({ brand: { name: inv.workspace.name, logoUrl: inv.workspace.settings?.invoiceLogoUrl ?? inv.workspace.logoUrl }, number: inv.number!, amount: fmt.money(outstandingCents(inv), inv.currency), dueDate: fmt.date(inv.dueDate), overdueDays: daysOverdue(inv), link: `${env.appUrl}/i/${inv.publicToken}` }, locale);
  const r = await sendEmail({ to, subject: t.subject, html: t.html, template: "invoice_reminder", workspaceId: inv.workspaceId, entityType: "INVOICE", entityId: inv.id, fromName: inv.workspace.name });
  await emit({
    workspaceId: inv.workspaceId, type: "PAYMENT_REMINDER_SENT", actor: null, projectId: inv.projectId, clientId: inv.clientId, entityType: "INVOICE", entityId: inv.id,
    summary: [kind === "AUTO" ? "Automatic payment reminder for {number} sent to {to}" : "Manual payment reminder for {number} sent to {to}", { number: inv.number, to }], clientVisible: true, metadata: { emailStatus: r.status },
    notify: { client: true, title: ["Reminder: invoice {number}", { number: inv.number }], message: ["{amount} is awaiting payment.", { amount: { money: outstandingCents(inv), currency: inv.currency } }], clientActionUrl: `/portal/invoices/${inv.id}`, actionLabel: "View & pay" },
  });
  return r;
}

