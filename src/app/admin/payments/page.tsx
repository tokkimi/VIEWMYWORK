import Link from "next/link";
import { db } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/auth/context";
import { PageHeader, Badge, Table, th, td, EmptyState } from "@/components/ui/primitives";
import { pageTitle, getI18n } from "@/lib/i18n/server";
import { Tr } from "@/lib/i18n/client";

export const generateMetadata = pageTitle("Payments");

export default async function AdminPayments() {
  const { t, fmt } = await getI18n();
  await requireSuperAdmin();
  const payments = await db.platformPayment.findMany({ orderBy: { createdAt: "desc" }, take: 200, include: { subscription: { include: { workspace: { select: { id: true, name: true } }, plan: { select: { name: true } } } } } });
  return (
    <>
      <PageHeader title="Subscription payments" description="Platform billing ledger (from Stripe webhooks)." />
      {payments.length === 0 ? <EmptyState title="No subscription payments yet" /> : (
        <Table>
          <thead><tr><th className={th}><Tr>Date</Tr></th><th className={th}><Tr>Workspace</Tr></th><th className={th}><Tr>Plan</Tr></th><th className={`${th} text-right`}><Tr>Amount</Tr></th><th className={th}><Tr>Status</Tr></th><th className={th}><Tr>Stripe invoice</Tr></th></tr></thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id}>
                <td className={`${td} text-muted`}>{fmt.dateTime(p.paidAt ?? p.createdAt)}</td>
                <td className={td}><Link href={`/admin/workspaces/${p.subscription.workspace.id}`} className="hover:underline">{p.subscription.workspace.name}</Link></td>
                <td className={td}>{p.subscription.plan.name}</td>
                <td className={`${td} num text-right`}>{fmt.money(p.amountCents, p.currency)}</td>
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
