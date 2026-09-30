import Link from "next/link";
import type { SubscriptionStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/auth/context";
import { PageHeader, Badge, Table, th, td } from "@/components/ui/primitives";
import { inputClass } from "@/components/ui/form";
import { pageTitle, getI18n } from "@/lib/i18n/server";
import { Tr } from "@/lib/i18n/client";

export const generateMetadata = pageTitle("Subscriptions");

export default async function AdminSubscriptions({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { t, fmt } = await getI18n();
  await requireSuperAdmin();
  const sp = await searchParams;
  const statuses = ["TRIALING", "ACTIVE", "PAST_DUE", "CANCELED", "INCOMPLETE"];
  const subs = await db.subscription.findMany({ where: statuses.includes(sp.status ?? "") ? { status: sp.status as SubscriptionStatus } : {}, include: { plan: { select: { name: true } }, workspace: { select: { id: true, name: true } } }, orderBy: { updatedAt: "desc" }, take: 200 });
  return (
    <>
      <PageHeader title="Subscriptions" />
      <form className="mb-5"><select name="status" defaultValue={sp.status ?? ""} aria-label={t("Status")} className={`${inputClass} w-auto`}><option value="">{t("All statuses")}</option>{statuses.map((s) => <option key={s}>{s}</option>)}</select> <button className="ml-2 h-9 rounded-[10px] border border-line px-3 text-sm text-muted"><Tr>Apply</Tr></button></form>
      <Table>
        <thead><tr><th className={th}><Tr>Workspace</Tr></th><th className={th}><Tr>Plan</Tr></th><th className={th}><Tr>Status</Tr></th><th className={th}><Tr>Price (locked)</Tr></th><th className={th}><Tr>Trial / period end</Tr></th><th className={th}><Tr>Stripe</Tr></th></tr></thead>
        <tbody>
          {subs.map((s) => (
            <tr key={s.id}>
              <td className={td}><Link href={`/admin/workspaces/${s.workspace.id}`} className="hover:underline">{s.workspace.name}</Link></td>
              <td className={td}>{s.plan.name}</td>
              <td className={td}><Badge tone={s.status === "ACTIVE" ? "success" : s.status === "TRIALING" ? "accent" : s.status === "PAST_DUE" ? "warning" : "neutral"}>{s.status.toLowerCase()}</Badge>{s.cancelAtPeriodEnd && <Badge className="ml-1"><Tr>cancels</Tr></Badge>}</td>
              <td className={`${td} num`}>{fmt.money(s.priceCents, s.currency)}/{s.interval === "year" ? "yr" : "mo"}</td>
              <td className={`${td} text-muted`}>{fmt.date(s.status === "TRIALING" ? s.trialEndsAt : s.currentPeriodEnd)}</td>
              <td className={`${td} text-xs text-muted`}>{s.stripeSubscriptionId ? "Linked" : "—"}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </>
  );
}
