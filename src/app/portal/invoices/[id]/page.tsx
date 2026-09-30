import { notFound } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Clock, Download, MessageSquare, ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { requirePortal } from "@/lib/auth/portal";
import { isUuid } from "@/lib/auth/context";
import { InvoiceDocument } from "@/components/invoice-document";
import { PayButton } from "@/components/pay-button";
import { ButtonLink } from "@/components/ui/button";
import { AutoRefresh } from "@/components/auto-refresh";
import { invoiceParties } from "@/server/services/invoices";
import { markInvoiceViewed } from "@/server/services/invoice-view";
import { deriveStatus, outstandingCents, isPayable } from "@/lib/invoices/status";
import { formatMoney } from "@/lib/money";
import { fmtDate } from "@/lib/format";
import { PAYMENT_METHOD } from "@/lib/labels";
import { PaymentStatusBadge } from "@/components/status";

export const metadata = { title: "Invoice" };

export default async function PortalInvoice({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ payment?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const ctx = await requirePortal();
  if (!isUuid(id)) notFound();
  const inv = await db.invoice.findFirst({ where: { id, clientId: ctx.client.id, workspaceId: ctx.workspace.id, status: { not: "DRAFT" } }, include: { client: true, lineItems: { orderBy: { position: "asc" } }, project: true, workspace: { include: { paymentAccount: true } } } });
  if (!inv) notFound();
  await markInvoiceViewed(inv.id, ctx.user.id);
  const [{ seller, client }, payments] = await Promise.all([invoiceParties(inv), db.payment.findMany({ where: { invoiceId: id, status: { not: "PENDING" } }, orderBy: { createdAt: "desc" } })]);
  const status = deriveStatus(inv);
  const due = outstandingCents(inv);
  const online = Boolean(inv.workspace.paymentAccount?.chargesEnabled);
  const recent = payments.find((p) => p.status === "SUCCEEDED" && Date.now() - p.createdAt.getTime() < 30 * 60_000);

  return (
    <div className="space-y-6">
      <Link href="/portal/invoices" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg"><ArrowLeft className="size-4" />Invoices</Link>
      {sp.payment === "success" && (recent ? (
        <div className="glass rounded-2xl p-6 text-center">
          <CheckCircle2 className="mx-auto size-8 text-success" />
          <h1 className="mt-3 text-xl font-semibold">Payment received</h1>
          <p className="mt-1 text-sm text-muted">Invoice {inv.number} · {formatMoney(recent.amountCents, recent.currency)} paid · {fmtDate(recent.paidAt, { month: "long", day: "numeric", year: "numeric" })}</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <ButtonLink href={`/api/invoices/${inv.id}/pdf`} prefetch={false}><Download className="size-4" />Download invoice</ButtonLink>
            {inv.projectId && <ButtonLink href={`/portal/projects/${inv.projectId}`} variant="primary">Return to project</ButtonLink>}
          </div>
        </div>
      ) : (
        <div className="glass rounded-2xl p-6 text-center" role="status"><Clock className="mx-auto size-7 text-accent" /><h1 className="mt-3 text-lg font-semibold">Confirming your payment…</h1><p className="mt-1 text-sm text-muted">This page refreshes automatically.</p><AutoRefresh seconds={4} /></div>
      ))}
      {sp.payment === "cancelled" && <p className="rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning">Payment was cancelled. You haven&apos;t been charged.</p>}

      <div className="glass flex flex-col gap-5 rounded-2xl p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <div className="text-xs text-muted">Invoice {inv.number}{inv.project ? ` · ${inv.project.name}` : ""}</div>
          <div className="num mt-1 text-4xl font-semibold tracking-tight">{formatMoney(status === "PAID" ? inv.totalCents : due, inv.currency)}</div>
          <div className="mt-1 text-sm text-muted">{status === "PAID" ? `Paid in full` : status === "VOID" ? "Cancelled" : status === "OVERDUE" ? <span className="text-danger">Overdue — was due {fmtDate(inv.dueDate)}</span> : `Due ${fmtDate(inv.dueDate)}`}</div>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-64">
          {isPayable(status) && due > 0 && (online ? <PayButton token={inv.publicToken} from="portal" label={`Pay ${formatMoney(due, inv.currency)}`} /> : <p className="text-xs text-muted">Pay by bank transfer using the details on the invoice.</p>)}
          <ButtonLink href={`/api/invoices/${inv.id}/pdf`} prefetch={false} className="w-full"><Download className="size-4" />Download PDF</ButtonLink>
          {inv.projectId && <ButtonLink href={`/portal/projects/${inv.projectId}/messages`} variant="ghost" className="w-full"><MessageSquare className="size-4" />Contact {ctx.workspace.name}</ButtonLink>}
        </div>
      </div>

      <InvoiceDocument inv={inv} seller={seller} client={client} lines={inv.lineItems} status={status} projectName={inv.project?.name} />

      {payments.length > 0 && (
        <section>
          <h2 className="mb-3 text-[13px] font-semibold">Payment history</h2>
          <ul className="panel divide-y divide-line rounded-2xl text-sm">
            {payments.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="text-muted">{fmtDate(p.paidAt ?? p.createdAt)}</span>
                <span className="num flex-1">{formatMoney(p.amountCents, p.currency)}</span>
                <span className="text-muted">{PAYMENT_METHOD[p.method]}{p.reference ? ` · ${p.reference}` : ""}</span>
                <PaymentStatusBadge s={p.status} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
