import { db } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/auth/context";
import { PageHeader, Stat, Section } from "@/components/ui/primitives";
import { pageTitle } from "@/lib/i18n/server";

export const generateMetadata = pageTitle("Projects");

/** Aggregates only — the platform owner doesn't browse professionals' project contents. */
export default async function AdminProjects() {
  await requireSuperAdmin();
  const d30 = new Date(Date.now() - 30 * 86400_000);
  const [byStatus, created30, tasks, deliverables, approvals, top] = await Promise.all([
    db.project.groupBy({ by: ["status"], _count: true }),
    db.project.count({ where: { createdAt: { gte: d30 } } }),
    db.task.count(),
    db.deliverable.count(),
    db.approval.count({ where: { createdAt: { gte: d30 } } }),
    db.project.groupBy({ by: ["workspaceId"], _count: true, orderBy: { _count: { workspaceId: "desc" } }, take: 10 }),
  ]);
  const names = new Map((await db.workspace.findMany({ where: { id: { in: top.map((t) => t.workspaceId) } }, select: { id: true, name: true } })).map((w) => [w.id, w.name]));
  return (
    <>
      <PageHeader title="Projects" description="Platform-wide aggregates." />
      <div className="panel grid grid-cols-2 divide-x divide-line overflow-hidden rounded-2xl sm:grid-cols-4 lg:grid-cols-8">
        {byStatus.map((s) => <Stat key={s.status} label={s.status.toLowerCase().replace("_", " ")} value={s._count} />)}
        <Stat label="Created (30d)" value={created30} />
        <Stat label="Tasks" value={tasks} />
        <Stat label="Deliverables" value={deliverables} />
        <Stat label="Approvals (30d)" value={approvals} />
      </div>
      <Section title="Workspaces with most projects" className="mt-10">
        <ul className="panel divide-y divide-line rounded-2xl text-sm">{top.map((t) => <li key={t.workspaceId} className="flex justify-between px-4 py-2.5"><span>{names.get(t.workspaceId)}</span><span className="num text-muted">{t._count}</span></li>)}</ul>
      </Section>
    </>
  );
}
