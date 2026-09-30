import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { loadProject } from "@/server/queries/project";
import { hasLevel } from "@/lib/auth/permissions";
import { Section, Stat, EmptyState } from "@/components/ui/primitives";
import { ListCard } from "@/components/app/blocks";
import { ExpenseDialog } from "@/components/app/finance-forms";
import { formatMoney } from "@/lib/money";
import { fmtDate } from "@/lib/format";
import { EXPENSE_CATEGORIES } from "@/lib/labels";

export default async function ProjectFinance({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { ctx, project, perms } = await loadProject(id);
  if (!hasLevel(perms, "finance", "view")) notFound();
  const cur = project.currency;
  const [invoiced, payments, expenses, taskCosts] = await Promise.all([
    db.invoice.aggregate({ where: { projectId: id, workspaceId: ctx.workspace.id, currency: cur, status: { notIn: ["DRAFT", "VOID"] } }, _sum: { totalCents: true, paidCents: true } }),
    db.payment.aggregate({ where: { invoice: { projectId: id }, workspaceId: ctx.workspace.id, currency: cur, status: { in: ["SUCCEEDED", "PARTIALLY_REFUNDED"] } }, _sum: { amountCents: true, refundedCents: true } }),
    db.expense.findMany({ where: { projectId: id, workspaceId: ctx.workspace.id }, orderBy: { date: "desc" } }),
    db.task.aggregate({ where: { projectId: id }, _sum: { costCents: true, estimatedMinutes: true, actualMinutes: true } }),
  ]);
  const revenue = (payments._sum.amountCents ?? 0) - (payments._sum.refundedCents ?? 0);
  const expTotal = expenses.filter((e) => e.currency === cur).reduce((a, e) => a + e.amountCents, 0);
  const outstanding = (invoiced._sum.totalCents ?? 0) - (invoiced._sum.paidCents ?? 0);
  const margin = revenue - expTotal;

  return (
    <div className="space-y-10">
      <div className="panel grid grid-cols-2 divide-line overflow-hidden rounded-2xl sm:grid-cols-3 lg:grid-cols-6 [&>*]:border-line [&>*:not(:last-child)]:border-r">
        <Stat label="Budget" value={project.budgetCents !== null ? formatMoney(project.budgetCents, cur) : "—"} />
        <Stat label="Invoiced" value={formatMoney(invoiced._sum.totalCents ?? 0, cur)} />
        <Stat label="Paid" value={formatMoney(revenue, cur)} />
        <Stat label="Outstanding" value={formatMoney(Math.max(0, outstanding), cur)} tone={outstanding > 0 ? "warning" : undefined} />
        <Stat label="Expenses" value={formatMoney(expTotal, cur)} />
        <Stat label="Estimated margin" value={formatMoney(margin, cur)} tone={margin < 0 ? "danger" : undefined} hint={revenue ? `${Math.round((margin / revenue) * 100)}% of revenue` : undefined} />
      </div>
      <div className="grid gap-4 text-sm text-muted sm:grid-cols-3">
        <div>Planned task costs: <span className="num text-fg">{formatMoney(taskCosts._sum.costCents ?? 0, cur)}</span></div>
        <div>Estimated time: <span className="num text-fg">{Math.round((taskCosts._sum.estimatedMinutes ?? 0) / 60)}h</span></div>
        <div>Actual time: <span className="num text-fg">{Math.round((taskCosts._sum.actualMinutes ?? 0) / 60)}h</span></div>
      </div>
      <Section title="Expenses" action={hasLevel(perms, "finance", "edit") ? <ExpenseDialog projects={[{ id, name: project.name }]} defaultProjectId={id} currency={cur} /> : undefined}>
        {expenses.length === 0 ? <EmptyState title="No expenses" description="Track software, freelancers, travel and materials to see your real margin." /> : (
          <ListCard>
            {expenses.map((e) => (
              <div key={e.id} className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 text-sm sm:grid-cols-[1fr_140px_120px_120px]">
                <div className="min-w-0"><div className="truncate">{e.name}</div><div className="truncate text-xs text-subtle">{e.supplier ?? "—"}</div></div>
                <span className="hidden text-muted sm:block">{EXPENSE_CATEGORIES[e.category as keyof typeof EXPENSE_CATEGORIES] ?? e.category}</span>
                <span className="hidden text-muted sm:block">{fmtDate(e.date)}</span>
                <span className="num text-right">{formatMoney(e.amountCents, e.currency)}</span>
              </div>
            ))}
          </ListCard>
        )}
      </Section>
    </div>
  );
}
