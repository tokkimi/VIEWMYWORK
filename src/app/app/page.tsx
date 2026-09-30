import Link from "next/link";
import { FolderKanban, CheckSquare, Clock, Receipt, Plus } from "lucide-react";
import { db } from "@/lib/db";
import { requireWorkspace, projectScope, can } from "@/lib/auth/context";
import { PageHeader, Section, Stat, EmptyState, Badge } from "@/components/ui/primitives";
import { ButtonLink } from "@/components/ui/button";
import { ProjectRow, ActivityFeed, ListCard } from "@/components/app/blocks";
import { TaskStatusBadge, InvoiceStatusBadge } from "@/components/status";
import { greeting, fmtShortDate, daysBetween, relativeTime } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { deriveStatus, outstandingCents, daysOverdue } from "@/lib/invoices/status";
import { SendReminderButton } from "@/components/app/invoice-actions";

export const metadata = { title: "Overview" };

export default async function Dashboard() {
  const ctx = await requireWorkspace();
  const ws = ctx.workspace.id;
  const scope = projectScope(ctx);
  const now = new Date();
  const in7 = new Date(now.getTime() + 7 * 86400_000);
  const canInvoices = can(ctx, "invoices", "view");
  const canFinance = can(ctx, "finance", "view");
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const [projects, clientCount, myTasks, waits, deliverablesWaiting, invoices, revenue, deadlines, activity] = await Promise.all([
    db.project.findMany({
      where: { ...scope, archivedAt: null, status: { in: ["PLANNING", "ACTIVE", "ON_HOLD"] } },
      include: { client: true, phases: { orderBy: { position: "asc" }, select: { title: true, status: true } }, _count: { select: { tasks: { where: { deadline: { lt: now }, status: { not: "COMPLETED" } } } } } },
      orderBy: { updatedAt: "desc" },
      take: 50,
    }),
    can(ctx, "clients", "view") ? db.client.count({ where: { workspaceId: ws, archivedAt: null } }) : Promise.resolve(null),
    db.task.findMany({ where: { workspaceId: ws, assigneeId: ctx.user.id, status: { not: "COMPLETED" }, project: { ...scope, archivedAt: null } }, include: { project: { select: { name: true } } }, orderBy: [{ deadline: { sort: "asc", nulls: "last" } }], take: 8 }),
    db.clientWait.findMany({ where: { resolvedAt: null, project: { ...scope, archivedAt: null } }, include: { project: { select: { id: true, name: true } } }, orderBy: { startedAt: "asc" }, take: 8 }),
    db.deliverable.findMany({ where: { workspaceId: ws, status: "WAITING_FOR_CLIENT", project: { ...scope, archivedAt: null } }, include: { project: { select: { id: true, name: true } } }, take: 8 }),
    canInvoices ? db.invoice.findMany({ where: { workspaceId: ws, status: { in: ["SENT", "VIEWED", "PARTIALLY_PAID", "OVERDUE"] } }, include: { client: true }, orderBy: { dueDate: "asc" }, take: 50 }) : Promise.resolve([]),
    canFinance || canInvoices ? db.payment.aggregate({ where: { workspaceId: ws, status: { in: ["SUCCEEDED", "PARTIALLY_REFUNDED"] }, paidAt: { gte: monthStart }, currency: ctx.workspace.defaultCurrency }, _sum: { amountCents: true, refundedCents: true } }) : Promise.resolve(null),
    db.task.findMany({ where: { workspaceId: ws, status: { not: "COMPLETED" }, deadline: { gte: now, lte: in7 }, project: { ...scope, archivedAt: null } }, include: { project: { select: { id: true, name: true } } }, orderBy: { deadline: "asc" }, take: 6 }),
    db.activityLog.findMany({ where: { workspaceId: ws, ...(ctx.isAdmin || ctx.member.allProjects ? {} : { OR: [{ projectId: null }, { projectId: { in: (await db.project.findMany({ where: scope, select: { id: true } })).map((p) => p.id) } }] }) }, orderBy: { createdAt: "desc" }, take: 10 }),
  ]);

  const avgProgress = projects.length ? Math.round(projects.reduce((a, p) => a + p.progress, 0) / projects.length) : 0;
  const tasksDue = myTasks.filter((t) => t.deadline && t.deadline <= in7).length;
  const withStatus = invoices.map((i) => ({ ...i, derived: deriveStatus(i, now) }));
  const unpaid = withStatus.reduce((a, i) => a + (i.currency === ctx.workspace.defaultCurrency ? outstandingCents(i) : 0), 0);
  const overdue = withStatus.filter((i) => i.derived === "OVERDUE");
  const awaiting = waits.length + deliverablesWaiting.length;
  const cur = ctx.workspace.defaultCurrency;
  const projectNames = new Map(projects.map((p) => [p.id, p.name]));

  return (
    <>
      <PageHeader
        title={`${greeting()}, ${ctx.user.name.split(" ")[0]}`}
        description={projects.length ? `${projects.length} active project${projects.length > 1 ? "s" : ""}${awaiting ? ` · ${awaiting} waiting on clients` : ""}${overdue.length ? ` · ${overdue.length} overdue invoice${overdue.length > 1 ? "s" : ""}` : ""}` : "Let's get your first project in front of a client."}
        actions={can(ctx, "projects", "manage") ? <ButtonLink href="/app/projects/new" variant="primary"><Plus className="size-4" />New project</ButtonLink> : undefined}
      />

      <div className="panel mb-10 grid grid-cols-2 divide-line overflow-hidden rounded-2xl sm:grid-cols-4 lg:grid-cols-7 [&>*]:border-line [&>*:not(:last-child)]:border-r [&>*]:border-b lg:[&>*]:border-b-0">
        <Stat label="Active projects" value={projects.length} />
        <Stat label="Clients" value={clientCount ?? "—"} />
        <Stat label="Average progress" value={`${avgProgress}%`} />
        <Stat label="My tasks due" value={tasksDue} hint="next 7 days" tone={tasksDue ? "accent" : undefined} />
        <Stat label="Awaiting client" value={awaiting} tone={awaiting ? "warning" : undefined} />
        <Stat label="Unpaid" value={canInvoices ? formatMoney(unpaid, cur) : "—"} hint={overdue.length ? `${overdue.length} overdue` : undefined} tone={overdue.length ? "danger" : undefined} />
        <Stat label="Revenue" value={revenue ? formatMoney((revenue._sum.amountCents ?? 0) - (revenue._sum.refundedCents ?? 0), cur) : "—"} hint="this month" />
      </div>

      <div className="grid gap-10 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="space-y-10">
          <Section title="Projects" action={<Link href="/app/projects" className="text-xs text-muted hover:text-fg">View all</Link>}>
            {projects.length === 0 ? (
              <EmptyState icon={<FolderKanban />} title="No active projects" description="Create a project, build its specification and share a beautiful portal with your client." action={can(ctx, "projects", "manage") ? <ButtonLink href="/app/projects/new" variant="primary">Create project</ButtonLink> : undefined} />
            ) : (
              <ListCard>
                {projects.slice(0, 8).map((p) => {
                  const current = p.phases.find((ph) => ph.status !== "COMPLETED");
                  const attention = p._count.tasks ? `${p._count.tasks} overdue task${p._count.tasks > 1 ? "s" : ""}` : null;
                  return <ProjectRow key={p.id} href={`/app/projects/${p.id}`} name={p.name} client={p.client.company || `${p.client.firstName} ${p.client.lastName}`} progress={p.progress} phase={current?.title} due={p.targetDate ? `Due ${fmtShortDate(p.targetDate)}` : null} attention={attention} />;
                })}
              </ListCard>
            )}
          </Section>

          <Section title="My tasks" action={<Link href="/app/tasks" className="text-xs text-muted hover:text-fg">All tasks</Link>}>
            {myTasks.length === 0 ? (
              <EmptyState icon={<CheckSquare />} title="Nothing assigned to you" description="Tasks assigned to you across projects will appear here." />
            ) : (
              <ListCard>
                {myTasks.map((t) => {
                  const late = t.deadline && t.deadline < now;
                  return (
                    <Link key={t.id} href={`/app/projects/${t.projectId}/tasks?task=${t.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.025]">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm">{t.title}</div>
                        <div className="truncate text-xs text-muted">{t.project.name}</div>
                      </div>
                      <TaskStatusBadge s={t.status} />
                      <span className={`num w-16 text-right text-xs ${late ? "text-danger" : "text-subtle"}`}>{t.deadline ? fmtShortDate(t.deadline) : "—"}</span>
                    </Link>
                  );
                })}
              </ListCard>
            )}
          </Section>

          {canInvoices && (
            <Section title="Invoices" description="Unpaid and overdue" action={<Link href="/app/invoices" className="text-xs text-muted hover:text-fg">All invoices</Link>}>
              {withStatus.length === 0 ? (
                <EmptyState icon={<Receipt />} title="No unpaid invoices" description="Create an invoice and send it directly to your client's portal and inbox." action={can(ctx, "invoices", "edit") ? <ButtonLink href="/app/invoices/new">Create invoice</ButtonLink> : undefined} />
              ) : (
                <ListCard>
                  {withStatus.slice(0, 6).map((i) => (
                    <div key={i.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                      <Link href={`/app/invoices/${i.id}`} className="min-w-0 flex-1 hover:underline">
                        <div className="truncate text-sm">{i.number}</div>
                        <div className="truncate text-xs text-muted">{i.client.company || `${i.client.firstName} ${i.client.lastName}`}</div>
                      </Link>
                      <InvoiceStatusBadge s={i.derived} />
                      <span className="num w-24 text-right text-sm">{formatMoney(outstandingCents(i), i.currency)}</span>
                      <span className={`w-24 text-right text-xs ${i.derived === "OVERDUE" ? "text-danger" : "text-subtle"}`}>{i.derived === "OVERDUE" ? `${daysOverdue(i, now)}d overdue` : `Due ${fmtShortDate(i.dueDate)}`}</span>
                      {i.derived === "OVERDUE" && can(ctx, "invoices", "edit") && <SendReminderButton invoiceId={i.id} size="sm" />}
                    </div>
                  ))}
                </ListCard>
              )}
            </Section>
          )}
        </div>

        <div className="space-y-10">
          <Section title="Waiting for client">
            {awaiting === 0 ? (
              <p className="panel rounded-2xl px-4 py-6 text-center text-sm text-subtle">Nothing pending on your clients.</p>
            ) : (
              <ListCard>
                {deliverablesWaiting.map((d) => (
                  <Link key={d.id} href={`/app/projects/${d.project.id}/deliverables#${d.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.025]">
                    <div className="min-w-0 flex-1"><div className="truncate text-sm">{d.title}</div><div className="truncate text-xs text-muted">Approval · {d.project.name}</div></div>
                    <Badge tone="warning">Review</Badge>
                  </Link>
                ))}
                {waits.map((w) => (
                  <Link key={w.id} href={`/app/projects/${w.project.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.025]">
                    <div className="min-w-0 flex-1"><div className="truncate text-sm">{w.label}</div><div className="truncate text-xs text-muted">{w.project.name}</div></div>
                    <span className="flex items-center gap-1 text-xs text-warning"><Clock className="size-3" />{Math.max(0, daysBetween(w.startedAt, now))}d</span>
                  </Link>
                ))}
              </ListCard>
            )}
          </Section>

          <Section title="Upcoming deadlines">
            {deadlines.length === 0 ? (
              <p className="panel rounded-2xl px-4 py-6 text-center text-sm text-subtle">No deadlines in the next 7 days.</p>
            ) : (
              <ListCard>
                {deadlines.map((t) => (
                  <Link key={t.id} href={`/app/projects/${t.project.id}/tasks?task=${t.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.025]">
                    <div className="num w-12 shrink-0 text-xs text-muted">{fmtShortDate(t.deadline)}</div>
                    <div className="min-w-0 flex-1"><div className="truncate text-sm">{t.title}</div><div className="truncate text-xs text-subtle">{t.project.name}</div></div>
                  </Link>
                ))}
              </ListCard>
            )}
          </Section>

          <Section title="Recent activity">
            <div className="panel rounded-2xl">
              <ActivityFeed items={activity.map((a) => ({ ...a, projectName: a.projectId ? projectNames.get(a.projectId) : null }))} />
            </div>
            {activity[0] && <p className="mt-2 text-right text-[11px] text-subtle">Updated {relativeTime(activity[0].createdAt)}</p>}
          </Section>
        </div>
      </div>
    </>
  );
}
