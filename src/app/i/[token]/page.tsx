import { notFound } from "next/navigation";
import { CheckCircle2, Download, Clock } from "lucide-react";
import { db } from "@/lib/db";
import { InvoiceDocument } from "@/components/invoice-document";
import { invoiceParties } from "@/server/services/invoices";
import { deriveStatus, outstandingCents, isPayable } from "@/lib/invoices/status";
import { isUuid } from "@/lib/auth/context";
import { PayButton } from "@/components/pay-button";
import { ButtonLink } from "@/components/ui/button";
import { markInvoiceViewed } from "@/server/services/invoice-view";
import { AutoRefresh } from "@/components/auto-refresh";
import { Tr } from "@/lib/i18n/client";
import { getI18n } from "@/lib/i18n/server";

export const metadata = { title: "Invoice", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * Public invoice page reachable through the unguessable link in the invoice email,
 * so a client can view & pay without creating an account.
 */
export default async function PublicInvoice({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ payment?: string }> }) {
  const { t, fmt } = await getI18n();
  const { token } = await params;
  const sp = await searchParams;
  if (!isUuid(token)) notFound();
  const inv = await db.invoice.findUnique({ where: { publicToken: token }, include: { client: true, lineItems: { orderBy: { position: "asc" } }, project: true, workspace: { include: { paymentAccount: true, settings: true } } } });
  if (!inv || inv.status === "DRAFT") notFound();
  await markInvoiceViewed(inv.id, null);
  const { seller, client } = await invoiceParties(inv);
  const status = deriveStatus(inv);
  const due = outstandingCents(inv);
  const online = Boolean(inv.workspace.paymentAccount?.chargesEnabled);
  const lastPayment = sp.payment === "success" ? await db.payment.findFirst({ where: { invoiceId: inv.id, status: "SUCCEEDED" }, orderBy: { createdAt: "desc" } }) : null;

  return (
    <div className="min-h-dvh">
      <main id="main" className="mx-auto max-w-4xl px-4 py-10 sm:py-14">
        {sp.payment === "success" && (
          lastPayment && Date.now() - lastPayment.createdAt.getTime() < 30 * 60_000 ? (
            <div className="glass mb-8 rounded-2xl p-6 text-center">
              <CheckCircle2 className="mx-auto size-8 text-success" />
              <h1 className="mt-3 text-xl font-semibold"><Tr>Payment received</Tr></h1>
              <p className="mt-1 text-sm text-muted"><Tr>Invoice</Tr> {inv.number} · {fmt.money(lastPayment.amountCents, lastPayment.currency)} <Tr>paid ·</Tr> {fmt.date(lastPayment.paidAt)}</p>
              <p className="mt-1 text-xs text-subtle"><Tr>A receipt was sent to</Tr> {client.email}.</p>
            </div>
          ) : (
            <div className="glass mb-8 rounded-2xl p-6 text-center" role="status">
              <Clock className="mx-auto size-7 text-accent" />
              <h1 className="mt-3 text-lg font-semibold"><Tr>Confirming your payment…</Tr></h1>
              <p className="mt-1 text-sm text-muted"><Tr>This usually takes a few seconds. This page refreshes automatically.</Tr></p>
              <AutoRefresh seconds={4} />
            </div>
          )
        )}
        {sp.payment === "cancelled" && <p className="mb-6 rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning"><Tr>Payment was cancelled. You haven&apos;t been charged.</Tr></p>}

        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="eyebrow">{inv.workspace.name}</div>
            <div className="num mt-2 text-4xl font-semibold tracking-tight">{fmt.money(due, inv.currency)}</div>
            <div className="mt-1 text-sm text-muted">{status === "PAID" ? t("Paid in full") : status === "VOID" ? t("This invoice was cancelled") : t("Due {date}", { date: fmt.date(inv.dueDate) })}</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <ButtonLink href={`/i/${token}/pdf`} prefetch={false}><Download className="size-4" /><Tr>Download PDF</Tr></ButtonLink>
            {isPayable(status) && due > 0 && (online ? <PayButton token={token} label={t("Pay {amount}", { amount: fmt.money(due, inv.currency) })} /> : null)}
          </div>
        </div>
        {isPayable(status) && due > 0 && !online && <p className="mb-6 rounded-xl border border-line px-4 py-3 text-sm text-muted"><Tr>Online payment isn&apos;t available for this invoice. Please use the payment information shown on the invoice.</Tr></p>}
        <InvoiceDocument inv={inv} seller={seller} client={client} lines={inv.lineItems} status={status} projectName={inv.project?.name} />
        <p className="mt-8 text-center text-xs text-subtle">Questions? Contact {seller.email ?? inv.workspace.name}<Tr>. · Powered by FollowMyFuture</Tr></p>
      </main>
    </div>
  );
}
