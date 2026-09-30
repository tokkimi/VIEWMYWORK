import Link from "next/link";
import { Receipt } from "lucide-react";
import { db } from "@/lib/db";
import { requirePortal } from "@/lib/auth/portal";
import { EmptyState } from "@/components/ui/primitives";
import { InvoiceStatusBadge } from "@/components/status";
import { deriveStatus, outstandingCents, isPayable } from "@/lib/invoices/status";
import { formatMoney } from "@/lib/money";
import { fmtShortDate } from "@/lib/format";

export const metadata = { title: "Invoices" };

export default async function PortalInvoices() {
  const ctx = await requirePortal();
  const invoices = await db.invoice.findMany({ where: { workspaceId: ctx.workspace.id, clientId: ctx.client.id, status: { not: "DRAFT" } }, include: { project: { select: { name: true } } }, orderBy: { issueDate: "desc" }, take: 200 });
  return (
    <>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Invoices</h1>
      {invoices.length === 0 ? <EmptyState icon={<Receipt />} title="No invoices yet" /> : (
        <ul className="space-y-2">
          {invoices.map((i) => {
            const s = deriveStatus(i);
            const due = outstandingCents(i);
            const pay = isPayable(s) && due > 0;
            return (
              <li key={i.id}>
                <Link href={`/portal/invoices/${i.id}`} className="panel flex min-h-16 flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl px-4 py-3.5 hover:border-line-strong">
                  <div className="min-w-0 flex-1">
                    <div className="num text-sm font-medium">{i.number}</div>
                    <div className="truncate text-xs text-muted">{i.project?.name ?? "—"} · {s === "PAID" ? `Paid` : `Due ${fmtShortDate(i.dueDate)}`}</div>
                  </div>
                  <span className="num text-sm">{formatMoney(pay ? due : i.totalCents, i.currency)}</span>
                  {pay ? <span className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white">Pay now</span> : <InvoiceStatusBadge s={s} />}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
