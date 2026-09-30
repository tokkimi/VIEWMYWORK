import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireSuperAdmin, isUuid } from "@/lib/auth/context";
import { PageHeader, Section, KeyValue } from "@/components/ui/primitives";
import { ChangePlanDialog } from "@/components/admin/user-actions";
import { fmtDate } from "@/lib/format";
import { formatBytes } from "@/lib/plans";
import { formatMoney } from "@/lib/money";
import { ROLE_LABELS } from "@/lib/auth/permissions";

export const metadata = { title: "Workspace" };

/** Metadata only (least-privilege support access): no client data, files or invoice contents are exposed. */
export default async function AdminWorkspace({ params }: { params: Promise<{ id: string }> }) {
  await requireSuperAdmin();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const w = await db.workspace.findUnique({ where: { id }, include: { members: { include: { user: { select: { id: true, name: true, email: true } } } }, subscription: { include: { plan: true } }, paymentAccount: true, _count: { select: { clients: true, projects: true, invoices: true, files: true } } } });
  if (!w) notFound();
  const plans = await db.plan.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } });
  const s = w.subscription;
  return (
    <>
      <PageHeader eyebrow={<Link href="/admin/workspaces" className="hover:text-fg">Workspaces</Link>} title={w.name} description={`Created ${fmtDate(w.createdAt)}`} actions={s ? <ChangePlanDialog workspaceId={w.id} plans={plans} current={s} /> : undefined} />
      <div className="grid gap-10 lg:grid-cols-2">
        <Section title="Subscription (platform billing)">
          <div className="panel rounded-2xl px-4"><KeyValue items={[{ k: "Plan", v: s?.plan.name }, { k: "Status", v: s?.status }, { k: "Price", v: s ? `${formatMoney(s.priceCents, s.currency)} / ${s.interval}` : "—" }, { k: "Trial ends", v: fmtDate(s?.trialEndsAt) }, { k: "Period end", v: fmtDate(s?.currentPeriodEnd) }, { k: "Stripe subscription", v: s?.stripeSubscriptionId ?? "—" }]} /></div>
        </Section>
        <Section title="Usage">
          <div className="panel rounded-2xl px-4"><KeyValue items={[{ k: "Members", v: w.members.length }, { k: "Clients", v: w._count.clients }, { k: "Projects", v: w._count.projects }, { k: "Invoices", v: w._count.invoices }, { k: "Files", v: w._count.files }, { k: "Storage", v: formatBytes(w.storageUsedBytes) }, { k: "Stripe Connect", v: w.paymentAccount ? (w.paymentAccount.chargesEnabled ? "Charges enabled" : "Onboarding") : "Not connected" }]} /></div>
        </Section>
      </div>
      <Section title="Members" className="mt-10">
        <ul className="panel divide-y divide-line rounded-2xl text-sm">{w.members.map((m) => <li key={m.id} className="flex justify-between px-4 py-2.5"><Link href={`/admin/users/${m.user.id}`} className="hover:underline">{m.user.name} <span className="text-muted">{m.user.email}</span></Link><span className="text-muted">{ROLE_LABELS[m.role]}</span></li>)}</ul>
      </Section>
    </>
  );
}
