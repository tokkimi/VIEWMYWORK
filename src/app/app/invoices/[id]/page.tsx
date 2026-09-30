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
import { formatMoney } from "@/lib/money";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { PAYMENT_METHOD } from "@/lib/labels";
import { env } from "@/lib/env";

export const metadata = { title: "Invoice" };

export default async function InvoiceDetail({ params }: { params: Promise<{ id: string }> }) {
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
        eyebrow={<Link href="/app/invoices" className="hover:text-fg">Invoices</Link>}
        title={inv.number ?? "Draft invoice"}
        description={<>{clientDisplayName(inv.client)} · {formatMoney(inv.totalCents, inv.currency)}{status === "OVERDUE" && <span className="text-danger"> · {daysOverdue(inv)} days overdue</span>}</>}
        actions={
          <>
            {edit && inv.status === "DRAFT" && <ButtonLink href={`/app/invoices/${id}/edit`}><Pencil className="size-4" />Edit</ButtonLink>}
            <ButtonLink href={`/api/invoices/${id}/pdf`} prefetch={false}><Download className="size-4" />PDF</ButtonLink>
            {edit && isPayable(status) && outstanding > 0 && <RecordPaymentDialog invoiceId={id} outstanding={formatMoney(outstanding, inv.currency)} />}
            {edit && inv.status !== "VOID" && <SendInvoiceDialog invoice={{ id, number: inv.number, status: inv.status }} defaultTo={inv.client.billingEmail || inv.client.email} workspaceName={ctx.workspace.name} userEmail={ctx.user.email} />}
          </>
        }
      />

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_340px]">
        <InvoiceDocument inv={inv} seller={seller} client={client} lines={inv.lineItems} status={status} projectName={inv.project?.name} />

        <aside className="space-y-8">
          <div className="panel rounded-2xl p-5">
            <div className="text-xs text-muted">Amount due</div>
            <div className="num mt-1 text-3xl font-semibold tracking-tight">{formatMoney(outstanding, inv.currency)}</div>
            <div className="mt-1 text-xs text-subtle">of {formatMoney(inv.totalCents, inv.currency)} · due {fmtDate(inv.dueDate)}</div>
            {inv.status !== "DRAFT" && inv.status !== "VOID" && (
              <div className="mt-4 space-y-2 border-t border-line pt-4 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted">Client payment link</span>
                  <CopyButton value={publicLink} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted">Online payment</span>
                  {paymentAccount?.chargesEnabled ? <Badge tone="success">Card enabled</Badge> : <Link href="/app/settings/payments" className="text-accent hover:underline">Connect Stripe</Link>}
                </div>
                {inv.firstViewedAt && <div className="flex justify-between"><span className="text-muted">First viewed</span><span>{fmtDateTime(inv.firstViewedAt)}</span></div>}
                {inv.sentAt && <div className="flex justify-between"><span className="text-muted">Last sent</span><span>{fmtDateTime(inv.sentAt)}</span></div>}
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
              <p className="panel rounded-2xl px-4 py-5 text-center text-sm text-subtle">No payments yet.</p>
            ) : (
              <ul className="panel divide-y divide-line rounded-2xl text-sm">
                {payments.map((p) => (
                  <li key={p.id} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="num font-medium">{formatMoney(p.amountCents, p.currency)}</span>
                      <PaymentStatusBadge s={p.status} />
                    </div>
                    <div className="mt-1 text-xs text-muted">{fmtDate(p.paidAt ?? p.createdAt)} · {PAYMENT_METHOD[p.method]}{p.reference ? ` · ${p.reference}` : ""}</div>
                    {p.refundedCents > 0 && <div className="mt-0.5 text-xs text-warning">Refunded {formatMoney(p.refundedCents, p.currency)}</div>}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {reminders.length > 0 && (
            <Section title="Reminders">
              <ul className="panel divide-y divide-line rounded-2xl text-sm">
                {reminders.map((r) => (
                  <li key={r.id} className="flex justify-between px-4 py-2.5"><span className="text-muted">{r.kind === "AUTO" ? "Automatic" : "Manual"} → {r.sentTo}</span><span className="text-xs text-subtle">{fmtDate(r.createdAt)}</span></li>
                ))}
              </ul>
            </Section>
          )}

          <Section title="Email delivery" description="Proof of delivery attempts for this invoice.">
            {emails.length === 0 ? (
              <p className="panel rounded-2xl px-4 py-5 text-center text-sm text-subtle">No emails sent yet.</p>
            ) : (
              <ul className="panel divide-y divide-line rounded-2xl text-sm">
                {emails.map((e) => (
                  <li key={e.id} className="px-4 py-2.5">
                    <div className="flex items-center justify-between gap-2"><span className="truncate">{e.recipient}</span><Badge tone={e.status === "SENT" ? "success" : e.status === "FAILED" ? "danger" : "warning"}>{e.status === "NOT_CONFIGURED" ? "Not sent" : e.status === "SENT" ? "Sent" : "Failed"}</Badge></div>
                    <div className="mt-0.5 text-xs text-subtle">{e.template.replace(/_/g, " ")} · {fmtDateTime(e.createdAt)}{e.failureReason ? ` · ${e.failureReason}` : ""}</div>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="History">
            {activity.length === 0 ? <EmptyState title="No history yet" /> : (
              <ol className="space-y-3 border-l border-line pl-4 text-sm">
                {activity.map((a) => (
                  <li key={a.id}><div>{a.summary}</div><div className="text-xs text-subtle">{a.actorName} · {fmtDateTime(a.createdAt)}</div></li>
                ))}
              </ol>
            )}
          </Section>
          {inv.status !== "DRAFT" && (
            <a href={publicLink} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-xs text-muted hover:text-fg"><ExternalLink className="size-3.5" />Open client view</a>
          )}
        </aside>
      </div>
    </>
  );
}
