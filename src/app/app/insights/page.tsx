import Link from "next/link";
import { db } from "@/lib/db";
import { requireWorkspace, projectScope, can } from "@/lib/auth/context";
import { hasFeature } from "@/lib/plans";
import { PageHeader, Section, Stat } from "@/components/ui/primitives";
import { BarChart } from "@/components/charts";
import { outstandingCents } from "@/lib/invoices/status";
import { pageTitle, getI18n } from "@/lib/i18n/server";
import { Tr } from "@/lib/i18n/client";

export const generateMetadata = pageTitle("Insights");

const key = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

export default async function Insights() {
  const { t, fmt } = await getI18n();
  const ctx = await requireWorkspace();
  const allowed = await hasFeature(ctx.workspace.id, "advanced_stats");
  if (!allowed)
    return (
      <>
        <PageHeader title="Insights" />
        <p className="panel rounded-2xl px-5 py-6 text-sm text-muted"><Tr>Advanced statistics are available on higher plans.</Tr> <Link href="/app/settings/billing" className="text-accent hover:underline"><Tr>Upgrade</Tr></Link></p>
      </>
    );
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1));
  const scope = projectScope(ctx);
  const cur = ctx.workspace.defaultCurrency;
  const finance = can(ctx, "invoices", "view");
  const [active, completedProjects, tasksDone, overdueTasks, pendingApprovals, waiting, payments, open] = await Promise.all([
    db.project.findMany({ where: { ...scope, archivedAt: null, status: { in: ["ACTIVE", "PLANNING", "ON_HOLD"] } }, select: { progress: true } }),
    db.project.findMany({ where: { ...scope, completedAt: { gte: start } }, select: { completedAt: true } }),
    db.task.findMany({ where: { workspaceId: ctx.workspace.id, project: scope, completedAt: { gte: start } }, select: { completedAt: true } }),
    db.task.count({ where: { workspaceId: ctx.workspace.id, project: { ...scope, archivedAt: null }, status: { not: "COMPLETED" }, deadline: { lt: now } } }),
    db.deliverable.count({ where: { workspaceId: ctx.workspace.id, project: scope, status: "WAITING_FOR_CLIENT" } }),
    db.clientWait.count({ where: { resolvedAt: null, project: { ...scope, archivedAt: null } } }),
    finance ? db.payment.findMany({ where: { workspaceId: ctx.workspace.id, currency: cur, status: { in: ["SUCCEEDED", "PARTIALLY_REFUNDED"] }, paidAt: { gte: start } }, select: { amountCents: true, refundedCents: true, paidAt: true } }) : Promise.resolve([]),
    finance ? db.invoice.findMany({ where: { workspaceId: ctx.workspace.id, currency: cur, status: { in: ["SENT", "VIEWED", "PARTIALLY_PAID", "OVERDUE"] } }, select: { totalCents: true, paidCents: true, dueDate: true } }) : Promise.resolve([]),
  ]);
  const months = Array.from({ length: 12 }, (_, i) => key(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11 + i, 1))));
  const series = (dates: (Date | null)[], values?: number[]) => months.map((m) => ({ label: m.slice(5), value: dates.reduce((a, d, i) => a + (d && key(d) === m ? values?.[i] ?? 1 : 0), 0) }));
  const outstanding = open.reduce((a, i) => a + outstandingCents(i), 0);
  const overdue = open.filter((i) => i.dueDate < now).reduce((a, i) => a + outstandingCents(i), 0);

  return (
    <>
      <PageHeader title="Insights" description="Factual indicators across your projects — no black-box scores." />
      <div className="panel mb-10 grid grid-cols-2 divide-line overflow-hidden rounded-2xl sm:grid-cols-3 lg:grid-cols-6 [&>*]:border-line [&>*:not(:last-child)]:border-r">
        <Stat label="Active projects" value={active.length} />
        <Stat label="Completed (12 mo)" value={completedProjects.length} />
        <Stat label="Average progress" value={`${active.length ? Math.round(active.reduce((a, p) => a + p.progress, 0) / active.length) : 0}%`} />
        <Stat label="Overdue tasks" value={overdueTasks} tone={overdueTasks ? "danger" : undefined} />
        <Stat label="Pending approvals" value={pendingApprovals} />
        <Stat label="Waiting for client" value={waiting} tone={waiting ? "warning" : undefined} />
      </div>
      <div className="grid gap-10 xl:grid-cols-2">
        <Section title="Projects completed"><div className="panel rounded-2xl p-5"><BarChart data={series(completedProjects.map((p) => p.completedAt))} format={(v) => `${v} project${v === 1 ? "" : "s"}`} /></div></Section>
        <Section title="Tasks completed"><div className="panel rounded-2xl p-5"><BarChart data={series(tasksDone.map((t) => t.completedAt))} format={(v) => `${v} task${v === 1 ? "" : "s"}`} /></div></Section>
        {finance && (
          <>
            <Section title="Payments received" description={cur}><div className="panel rounded-2xl p-5"><BarChart data={series(payments.map((p) => p.paidAt), payments.map((p) => p.amountCents - p.refundedCents))} format={(v) => fmt.money(v, cur)} /></div></Section>
            <Section title="Outstanding invoices">
              <div className="panel grid grid-cols-2 divide-x divide-line rounded-2xl">
                <Stat label="Outstanding" value={fmt.money(outstanding, cur)} />
                <Stat label="Of which overdue" value={fmt.money(overdue, cur)} tone={overdue ? "danger" : undefined} />
              </div>
            </Section>
          </>
        )}
      </div>
    </>
  );
}
