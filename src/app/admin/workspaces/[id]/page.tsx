import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireSuperAdmin, isUuid } from "@/lib/auth/context";
import { PageHeader, Section, KeyValue } from "@/components/ui/primitives";
import { ChangePlanDialog } from "@/components/admin/user-actions";
import { formatBytes } from "@/lib/plans";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import { pageTitle, getI18n } from "@/lib/i18n/server";
import { Tr } from "@/lib/i18n/client";

export const generateMetadata = pageTitle("Workspace");

/** Metadata only (least-privilege support access): no client data, files or invoice contents are exposed. */
export default async function AdminWorkspace({ params }: { params: Promise<{ id: string }> }) {
  const { t, fmt } = await getI18n();
  await requireSuperAdmin();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const w = await db.workspace.findUnique({ where: { id }, include: { members: { include: { user: { select: { id: true, name: true, email: true } } } }, subscription: { include: { plan: true } }, paymentAccount: true, _count: { select: { clients: true, projects: true, invoices: true, files: true } } } });
  if (!w) notFound();
  const plans = await db.plan.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } });
  const s = w.subscription;
  return (
    <>
      <PageHeader eyebrow={<Link href="/admin/workspaces" className="hover:text-fg"><Tr>Workspaces</Tr></Link>} title={w.name} description={t("Created {date}", { date: fmt.date(w.createdAt) })} actions={s ? <ChangePlanDialog workspaceId={w.id} plans={plans} current={s} /> : undefined} />
      <div className="grid gap-10 lg:grid-cols-2">
        <Section title="Subscription (platform billing)">
          <div className="panel rounded-2xl px-4"><KeyValue items={[{ k: "Plan", v: s?.plan.name }, { k: "Status", v: s?.status }, { k: "Price", v: s ? `${fmt.money(s.priceCents, s.currency)} / ${s.interval}` : "—" }, { k: "Trial ends", v: fmt.date(s?.trialEndsAt) }, { k: "Period end", v: fmt.date(s?.currentPeriodEnd) }, { k: "Stripe subscription", v: s?.stripeSubscriptionId ?? "—" }]} /></div>
        </Section>
        <Section title="Usage">
          <div className="panel rounded-2xl px-4"><KeyValue items={[{ k: "Members", v: w.members.length }, { k: "Clients", v: w._count.clients }, { k: "Projects", v: w._count.projects }, { k: "Invoices", v: w._count.invoices }, { k: "Files", v: w._count.files }, { k: "Storage", v: formatBytes(w.storageUsedBytes) }, { k: "Stripe Connect", v: w.paymentAccount ? (w.paymentAccount.chargesEnabled ? t("Charges enabled") : t("Onboarding")) : t("Not connected") }]} /></div>
        </Section>
      </div>
      <Section title="Members" className="mt-10">
        <ul className="panel divide-y divide-line rounded-2xl text-sm">{w.members.map((m) => <li key={m.id} className="flex justify-between px-4 py-2.5"><Link href={`/admin/users/${m.user.id}`} className="hover:underline">{m.user.name} <span className="text-muted">{m.user.email}</span></Link><span className="text-muted">{t(ROLE_LABELS[m.role])}</span></li>)}</ul>
      </Section>
    </>
  );
}
