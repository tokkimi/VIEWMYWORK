import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireSuperAdmin, isUuid } from "@/lib/auth/context";
import { PageHeader, Section, KeyValue, Badge } from "@/components/ui/primitives";
import { UserActions, ChangePlanDialog } from "@/components/admin/user-actions";
import { formatBytes } from "@/lib/plans";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import { pageTitle, getI18n } from "@/lib/i18n/server";
import { Tr } from "@/lib/i18n/client";

export const generateMetadata = pageTitle("User");

export default async function AdminUser({ params }: { params: Promise<{ id: string }> }) {
  const { t, fmt } = await getI18n();
  await requireSuperAdmin();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const u = await db.user.findUnique({ where: { id }, include: { memberships: { include: { workspace: { include: { subscription: { include: { plan: true } }, _count: { select: { projects: true, clients: true } } } } } }, clientAccess: { include: { client: { select: { workspace: { select: { name: true } } } } } } } });
  if (!u) notFound();
  const [plans, audit] = await Promise.all([db.plan.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }), db.auditLog.findMany({ where: { OR: [{ actorId: id }, { targetId: id }] }, orderBy: { createdAt: "desc" }, take: 20 })]);
  return (
    <>
      <PageHeader eyebrow={<Link href="/admin/users" className="hover:text-fg"><Tr>Users</Tr></Link>} title={u.name} description={u.email} actions={<UserActions id={u.id} status={u.status} role={u.platformRole} />} />
      <div className="grid gap-10 lg:grid-cols-2">
        <Section title="Identity">
          <div className="panel rounded-2xl px-4"><KeyValue items={[{ k: "Email", v: u.email }, { k: "Verified", v: u.emailVerifiedAt ? fmt.date(u.emailVerifiedAt) : <Badge tone="warning"><Tr>No</Tr></Badge> }, { k: "Status", v: u.status }, { k: "Platform role", v: u.platformRole }, { k: "Created", v: fmt.dateTime(u.createdAt) }, { k: "Last activity", v: fmt.dateTime(u.lastActiveAt) }]} /></div>
        </Section>
        <Section title="Workspaces">
          <ul className="space-y-3">
            {u.memberships.map((m) => (
              <li key={m.id} className="panel rounded-2xl p-4 text-sm">
                <div className="flex items-center justify-between gap-2"><Link href={`/admin/workspaces/${m.workspaceId}`} className="font-medium hover:underline">{m.workspace.name}</Link><Badge>{t(ROLE_LABELS[m.role])}</Badge></div>
                <div className="mt-1 text-xs text-muted">{m.workspace.subscription ? `${m.workspace.subscription.plan.name} · ${m.workspace.subscription.status.toLowerCase()}` : t("No subscription")} · {m.workspace._count.projects} <Tr>projects ·</Tr> {m.workspace._count.clients} <Tr>clients ·</Tr> {formatBytes(m.workspace.storageUsedBytes)}</div>
                {m.role === "OWNER" && m.workspace.subscription && <div className="mt-3"><ChangePlanDialog workspaceId={m.workspaceId} plans={plans} current={m.workspace.subscription} /></div>}
              </li>
            ))}
            {u.clientAccess.map((a) => <li key={a.id} className="panel rounded-2xl p-4 text-sm"><Tr>Client portal access ·</Tr> {a.client.workspace.name}{a.revokedAt && <Badge className="ml-2"><Tr>Revoked</Tr></Badge>}</li>)}
            {!u.memberships.length && !u.clientAccess.length && <li className="text-sm text-subtle"><Tr>No workspaces.</Tr></li>}
          </ul>
        </Section>
      </div>
      <Section title="Audit trail" className="mt-10">
        <ul className="panel divide-y divide-line rounded-2xl text-sm">{audit.length === 0 ? <li className="px-4 py-4 text-subtle"><Tr>No sensitive actions recorded.</Tr></li> : audit.map((a) => <li key={a.id} className="flex justify-between gap-3 px-4 py-2.5"><span>{a.action.replace(/_/g, " ").toLowerCase()} <span className="text-subtle"><Tr>by</Tr> {a.actorEmail ?? "system"}</span></span><span className="text-xs text-subtle">{fmt.dateTime(a.createdAt)}</span></li>)}</ul>
      </Section>
    </>
  );
}
