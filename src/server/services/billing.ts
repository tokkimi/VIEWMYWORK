import { db } from "@/lib/db";
import { emit } from "@/lib/events";
import { formatMoney } from "@/lib/money";
import { fmtDate } from "@/lib/format";
import { outstandingCents, daysOverdue } from "@/lib/invoices/status";
import { sendEmail } from "@/lib/email/send";
import { emailTemplates } from "@/lib/email/templates";
import { env } from "@/lib/env";
import { clientDisplayName } from "./invoices";

// NOTE: server-only helpers — deliberately NOT in a "use server" module so they can't be invoked from the browser.

/** Shared post-payment pipeline (manual + webhook): activity, notifications, receipt. */
export async function afterPayment(workspaceId: string, invoiceId: string, amountCents: number, actor: { id: string; name: string } | null, source: "manual" | "stripe") {
  const inv = await db.invoice.findUniqueOrThrow({ where: { id: invoiceId }, include: { client: true, workspace: { include: { settings: true } } } });
  const amount = formatMoney(amountCents, inv.currency);
  const who = clientDisplayName(inv.client);
  if (inv.status === "PAID") await db.clientWait.updateMany({ where: { entityType: "INVOICE", entityId: invoiceId, resolvedAt: null }, data: { resolvedAt: new Date() } });
  await emit({
    workspaceId, type: "PAYMENT_RECEIVED", actor, projectId: inv.projectId, clientId: inv.clientId, entityType: "INVOICE", entityId: invoiceId,
    summary: `Payment of ${amount} received for ${inv.number}${source === "manual" ? " (recorded manually)" : ""}`, clientVisible: true,
    notify: {
      team: { kind: "workspace", capability: ["invoices", "view"] }, client: true,
      title: `Payment received — ${amount}`, message: `${who} paid ${amount} for invoice ${inv.number}.${inv.status === "PAID" ? " The invoice is now fully paid." : ` Remaining: ${formatMoney(outstandingCents(inv), inv.currency)}.`}`,
      actionUrl: `/app/invoices/${invoiceId}`, clientActionUrl: `/portal/invoices/${invoiceId}`, actionLabel: "Open invoice", email: true,
    },
  });
  const t = emailTemplates.paymentConfirmation({ brand: { name: inv.workspace.name, logoUrl: inv.workspace.settings?.invoiceLogoUrl ?? inv.workspace.logoUrl }, number: inv.number!, amount, date: fmtDate(new Date()), remaining: inv.status === "PAID" ? null : formatMoney(outstandingCents(inv), inv.currency), link: `${env.appUrl}/i/${inv.publicToken}` });
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
  const t = emailTemplates.invoiceReminder({ brand: { name: inv.workspace.name, logoUrl: inv.workspace.settings?.invoiceLogoUrl ?? inv.workspace.logoUrl }, number: inv.number!, amount: formatMoney(outstandingCents(inv), inv.currency), dueDate: fmtDate(inv.dueDate), overdueDays: daysOverdue(inv), link: `${env.appUrl}/i/${inv.publicToken}` });
  const r = await sendEmail({ to, subject: t.subject, html: t.html, template: "invoice_reminder", workspaceId: inv.workspaceId, entityType: "INVOICE", entityId: inv.id, fromName: inv.workspace.name });
  await emit({
    workspaceId: inv.workspaceId, type: "PAYMENT_REMINDER_SENT", actor: null, projectId: inv.projectId, clientId: inv.clientId, entityType: "INVOICE", entityId: inv.id,
    summary: `${kind === "AUTO" ? "Automatic" : "Manual"} payment reminder for ${inv.number} sent to ${to}`, clientVisible: true, metadata: { emailStatus: r.status },
    notify: { client: true, title: `Reminder: invoice ${inv.number}`, message: `${formatMoney(outstandingCents(inv), inv.currency)} is awaiting payment.`, clientActionUrl: `/portal/invoices/${inv.id}`, actionLabel: "View & pay" },
  });
  return r;
}

