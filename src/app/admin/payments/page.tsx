import Link from "next/link";
import { db } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/auth/context";
import { PageHeader, Badge, Table, th, td, EmptyState } from "@/components/ui/primitives";
import { formatMoney } from "@/lib/money";
import { fmtDateTime } from "@/lib/format";

export const metadata = { title: "Payments" };

export default async function AdminPayments() {
  await requireSuperAdmin();
  const payments = await db.platformPayment.findMany({ orderBy: { createdAt: "desc" }, take: 200, include: { subscription: { include: { workspace: { select: { id: true, name: true } }, plan: { select: { name: true } } } } } });
  return (
    <>
      <PageHeader title="Subscription payments" description="Platform billing ledger (from Stripe webhooks)." />
      {payments.length === 0 ? <EmptyState title="No subscription payments yet" /> : (
        <Table>
          <thead><tr><th className={th}>Date</th><th className={th}>Workspace</th><th className={th}>Plan</th><th className={`${th} text-right`}>Amount</th><th className={th}>Status</th><th className={th}>Stripe invoice</th></tr></thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id}>
                <td className={`${td} text-muted`}>{fmtDateTime(p.paidAt ?? p.createdAt)}</td>
                <td className={td}><Link href={`/admin/workspaces/${p.subscription.workspace.id}`} className="hover:underline">{p.subscription.workspace.name}</Link></td>
                <td className={td}>{p.subscription.plan.name}</td>
                <td className={`${td} num text-right`}>{formatMoney(p.amountCents, p.currency)}</td>
                <td className={td}><Badge tone={p.status === "PAID" ? "success" : "danger"}>{p.status.toLowerCase()}</Badge></td>
                <td className={`${td} font-mono text-xs text-subtle`}>{p.stripeInvoiceId}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
