import Link from "next/link";
import { Download, Pencil, ExternalLink } from "lucide-react";
import { db } from "@/lib/db";
import { requireWorkspace, requirePerm, can } from "@/lib/auth/context";
import { PageHeader, Section, EmptyState, Badge } from "@/components/ui/primitives";
import { ButtonLink } from "@/components/ui/button";
import { InvoiceDocument } from "@/components/invoice-document";
import { PaymentStatusBadge } from "@/components/status";
import { SendInvoiceDialog, RecordPaymentDialog, SendReminderButton, InvoiceMoreActions, EditIssuedDialog } from "@/components/app/invoice-actions";
import { CopyButton } from "@/components/ui/copy-button";
import { clientDisplayName, invoiceParties, loadInvoice } from "@/server/services/invoices";
import { deriveStatus, outstandingCents, isPayable, daysOverdue } from "@/lib/invoices/status";
import { PAYMENT_METHOD } from "@/lib/labels";
import { env } from "@/lib/env";
import { normalizeLocale, storedText } from "@/lib/i18n/core";
import { pageTitle, getI18n } from "@/lib/i18n/server";
import { Tr } from "@/lib/i18n/client";

export const generateMetadata = pageTitle("Invoice");

export default async function InvoiceDetail({ params }: { params: Promise<{ id: string }> }) {
  const { t, fmt } = await getI18n();
  const ctx = await requireWorkspace();
  requirePerm(ctx, "invoices", "view");
  const { id } = await params;
  const inv = await loadInvoice(ctx, id);
  const [payments, reminders, emails, activity, paymentAccount] = await Promise.all([
    db.payment.findMany({ where: { invoiceId: id }, orderBy: { createdAt: "desc" } }),
    db.invoiceReminder.findMany({ where: { invoiceId: id }, orderBy: { createdAt: "desc" } }),
    db.emailLog.findMany({ where: { workspaceId: ctx.workspace.id, entityType: "INVOICE", entityId: id }, orderBy: { createdAt: "desc" }, take: 20 }),
    db.activityLog.findMany({ where: { workspaceId: ctx.workspace.id, entityType: "INVOICE", entityId: id }, orderBy: { createdAt: "desc" }, take: 20 }),
    db.paymentAccount.findUnique({ where: { workspaceId: ctx.workspace.id } }),
  ]);
  const { seller, client } = await invoiceParties(inv);
  const status = deriveStatus(inv);
  const edit = can(ctx, "invoices", "edit");
  const outstanding = outstandingCents(inv);
  const publicLink = `${env.appUrl}/i/${inv.publicToken}`;

  return (
    <>
      <PageHeader
        eyebrow={<Link href="/app/invoices" className="hover:text-fg"><Tr>Invoices</Tr></Link>}
        title={inv.number ?? t("Draft invoice")}
        description={<>{clientDisplayName(inv.client)} · {fmt.money(inv.totalCents, inv.currency)}{status === "OVERDUE" && <span className="text-danger"> · {daysOverdue(inv)} <Tr>days overdue</Tr></span>}</>}
        actions={
          <>
            {edit && inv.status === "DRAFT" && <ButtonLink href={`/app/invoices/${id}/edit`}><Pencil className="size-4" /><Tr>Edit</Tr></ButtonLink>}
            <ButtonLink href={`/api/invoices/${id}/pdf`} prefetch={false}><Download className="size-4" /><Tr>PDF</Tr></ButtonLink>
            {edit && isPayable(status) && outstanding > 0 && <RecordPaymentDialog invoiceId={id} outstanding={fmt.money(outstanding, inv.currency)} />}
            {edit && inv.status !== "VOID" && <SendInvoiceDialog invoice={{ id, number: inv.number, status: inv.status }} defaultTo={inv.client.billingEmail || inv.client.email} workspaceName={ctx.workspace.name} userEmail={ctx.user.email} clientLocale={normalizeLocale(inv.client.preferredLanguage)} />}
          </>
        }
      />

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_340px]">
        <InvoiceDocument inv={inv} seller={seller} client={client} lines={inv.lineItems} status={status} projectName={inv.project?.name} />

        <aside className="space-y-8">
          <div className="panel rounded-2xl p-5">
            <div className="text-xs text-muted"><Tr>Amount due</Tr></div>
            <div className="num mt-1 text-3xl font-semibold tracking-tight">{fmt.money(outstanding, inv.currency)}</div>
            <div className="mt-1 text-xs text-subtle"><Tr>of</Tr> {fmt.money(inv.totalCents, inv.currency)} <Tr>· due</Tr> {fmt.date(inv.dueDate)}</div>
            {inv.status !== "DRAFT" && inv.status !== "VOID" && (
              <div className="mt-4 space-y-2 border-t border-line pt-4 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted"><Tr>Client payment link</Tr></span>
                  <CopyButton value={publicLink} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted"><Tr>Online payment</Tr></span>
                  {paymentAccount?.chargesEnabled ? <Badge tone="success"><Tr>Card enabled</Tr></Badge> : <Link href="/app/settings/payments" className="text-accent hover:underline"><Tr>Connect Stripe</Tr></Link>}
                </div>
                {inv.firstViewedAt && <div className="flex justify-between"><span className="text-muted"><Tr>First viewed</Tr></span><span>{fmt.dateTime(inv.firstViewedAt)}</span></div>}
                {inv.sentAt && <div className="flex justify-between"><span className="text-muted"><Tr>Last sent</Tr></span><span>{fmt.dateTime(inv.sentAt)}</span></div>}
              </div>
            )}
            {edit && (
              <div className="mt-4 flex flex-wrap gap-1 border-t border-line pt-3">
                {isPayable(status) && outstanding > 0 && <SendReminderButton invoiceId={id} size="sm" />}
                {inv.status !== "DRAFT" && inv.status !== "VOID" && <EditIssuedDialog id={id} dueDate={inv.dueDate} notes={inv.notes} />}
                <InvoiceMoreActions id={id} status={inv.status} canVoid={inv.status !== "DRAFT" && inv.status !== "VOID" && inv.paidCents === 0} />
              </div>
            )}
          </div>

          <Section title="Payment history">
            {payments.length === 0 ? (
              <p className="panel rounded-2xl px-4 py-5 text-center text-sm text-subtle"><Tr>No payments yet.</Tr></p>
            ) : (
              <ul className="panel divide-y divide-line rounded-2xl text-sm">
                {payments.map((p) => (
                  <li key={p.id} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="num font-medium">{fmt.money(p.amountCents, p.currency)}</span>
                      <PaymentStatusBadge s={p.status} />
                    </div>
                    <div className="mt-1 text-xs text-muted">{fmt.date(p.paidAt ?? p.createdAt)} · {t(PAYMENT_METHOD[p.method])}{p.reference ? ` · ${p.reference}` : ""}</div>
                    {p.refundedCents > 0 && <div className="mt-0.5 text-xs text-warning"><Tr>Refunded</Tr> {fmt.money(p.refundedCents, p.currency)}</div>}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {reminders.length > 0 && (
            <Section title="Reminders">
              <ul className="panel divide-y divide-line rounded-2xl text-sm">
                {reminders.map((r) => (
                  <li key={r.id} className="flex justify-between px-4 py-2.5"><span className="text-muted">{r.kind === "AUTO" ? t("Automatic") : t("Manual")} → {r.sentTo}</span><span className="text-xs text-subtle">{fmt.date(r.createdAt)}</span></li>
                ))}
              </ul>
            </Section>
          )}

          <Section title="Email delivery" description="Proof of delivery attempts for this invoice.">
            {emails.length === 0 ? (
              <p className="panel rounded-2xl px-4 py-5 text-center text-sm text-subtle"><Tr>No emails sent yet.</Tr></p>
            ) : (
              <ul className="panel divide-y divide-line rounded-2xl text-sm">
                {emails.map((e) => (
                  <li key={e.id} className="px-4 py-2.5">
                    <div className="flex items-center justify-between gap-2"><span className="truncate">{e.recipient}</span><Badge tone={e.status === "SENT" ? "success" : e.status === "FAILED" ? "danger" : "warning"}>{e.status === "NOT_CONFIGURED" ? t("Not sent") : e.status === "SENT" ? t("Sent") : t("Failed")}</Badge></div>
                    <div className="mt-0.5 text-xs text-subtle">{e.template.replace(/_/g, " ")} · {fmt.dateTime(e.createdAt)}{e.failureReason ? ` · ${e.failureReason}` : ""}</div>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="History">
            {activity.length === 0 ? <EmptyState title="No history yet" /> : (
              <ol className="space-y-3 border-l border-line pl-4 text-sm">
                {activity.map((a) => (
                  <li key={a.id}><div>{storedText(fmt.locale, a.summary, a.metadata)}</div><div className="text-xs text-subtle">{a.actorName} · {fmt.dateTime(a.createdAt)}</div></li>
                ))}
              </ol>
            )}
          </Section>
          {inv.status !== "DRAFT" && (
            <a href={publicLink} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-xs text-muted hover:text-fg"><ExternalLink className="size-3.5" /><Tr>Open client view</Tr></a>
          )}
        </aside>
      </div>
    </>
  );
}
