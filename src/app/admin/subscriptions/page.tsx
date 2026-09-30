import Link from "next/link";
import type { SubscriptionStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/auth/context";
import { PageHeader, Badge, Table, th, td } from "@/components/ui/primitives";
import { inputClass } from "@/components/ui/form";
import { formatMoney } from "@/lib/money";
import { fmtDate } from "@/lib/format";

export const metadata = { title: "Subscriptions" };

export default async function AdminSubscriptions({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireSuperAdmin();
  const sp = await searchParams;
  const statuses = ["TRIALING", "ACTIVE", "PAST_DUE", "CANCELED", "INCOMPLETE"];
  const subs = await db.subscription.findMany({ where: statuses.includes(sp.status ?? "") ? { status: sp.status as SubscriptionStatus } : {}, include: { plan: { select: { name: true } }, workspace: { select: { id: true, name: true } } }, orderBy: { updatedAt: "desc" }, take: 200 });
  return (
    <>
      <PageHeader title="Subscriptions" />
      <form className="mb-5"><select name="status" defaultValue={sp.status ?? ""} aria-label="Status" className={`${inputClass} w-auto`}><option value="">All statuses</option>{statuses.map((s) => <option key={s}>{s}</option>)}</select> <button className="ml-2 h-9 rounded-[10px] border border-line px-3 text-sm text-muted">Apply</button></form>
      <Table>
        <thead><tr><th className={th}>Workspace</th><th className={th}>Plan</th><th className={th}>Status</th><th className={th}>Price (locked)</th><th className={th}>Trial / period end</th><th className={th}>Stripe</th></tr></thead>
        <tbody>
          {subs.map((s) => (
            <tr key={s.id}>
              <td className={td}><Link href={`/admin/workspaces/${s.workspace.id}`} className="hover:underline">{s.workspace.name}</Link></td>
              <td className={td}>{s.plan.name}</td>
              <td className={td}><Badge tone={s.status === "ACTIVE" ? "success" : s.status === "TRIALING" ? "accent" : s.status === "PAST_DUE" ? "warning" : "neutral"}>{s.status.toLowerCase()}</Badge>{s.cancelAtPeriodEnd && <Badge className="ml-1">cancels</Badge>}</td>
              <td className={`${td} num`}>{formatMoney(s.priceCents, s.currency)}/{s.interval === "year" ? "yr" : "mo"}</td>
              <td className={`${td} text-muted`}>{fmtDate(s.status === "TRIALING" ? s.trialEndsAt : s.currentPeriodEnd)}</td>
              <td className={`${td} text-xs text-muted`}>{s.stripeSubscriptionId ? "Linked" : "—"}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </>
  );
}
