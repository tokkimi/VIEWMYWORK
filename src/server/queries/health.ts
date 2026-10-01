import { db } from "@/lib/db";
import type { WorkspaceCtx } from "@/lib/auth/context";
import { projectScope } from "@/lib/auth/context";
import { projectHealth, type Health } from "@/lib/health";
import { deriveStatus, outstandingCents } from "@/lib/invoices/status";

const DAY = 86_400_000;
const OPEN = ["NOT_STARTED", "IN_PROGRESS", "BLOCKED", "WAITING_FOR_CLIENT", "IN_REVIEW"] as const;

export type ProjectHealthRow = {
  id: string; name: string; status: string; progress: number; currency: string;
  clientId: string; clientName: string; managerId: string | null; managerName: string | null;
  targetDate: Date | null; nextDeadline: { date: Date; label: string } | null;
  budgetCents: number | null; costToDateCents: number; invoicedCents: number; paidCents: number;
  overdueTasks: number; openTasks: number; clientWaits: number; pendingApprovals: number;
  health: Health;
};

/**
 * Health of every project the member can see (live ones, plus those completed in the last 30 days).
 * All figures are computed in a handful of queries for the whole portfolio.
 */
export async function loadPortfolioHealth(ctx: WorkspaceCtx, now = new Date(), projectIds?: string[]): Promise<ProjectHealthRow[]> {
  const projects = await db.project.findMany({
    where: {
      ...projectScope(ctx), archivedAt: null,
      ...(projectIds ? { id: { in: projectIds } } : {}),
      OR: [{ status: { in: ["PLANNING", "ACTIVE", "ON_HOLD"] } }, { status: "COMPLETED", completedAt: { gte: new Date(now.getTime() - 30 * DAY) } }],
    },
    include: { client: { select: { company: true, firstName: true, lastName: true } }, manager: { select: { name: true } } },
  });
  if (!projects.length) return [];
  const ids = projects.map((p) => p.id);
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const [tasks, members, expenses, invoices, waits, approvals, changes, milestones] = await Promise.all([
    db.task.findMany({ where: { projectId: { in: ids } }, select: { projectId: true, status: true, deadline: true, title: true, assigneeId: true, estimatedMinutes: true, actualMinutes: true, costCents: true, _count: { select: { subtasks: true } } } }),
    db.workspaceMember.findMany({ where: { workspaceId: ctx.workspace.id }, select: { userId: true, hourlyCostCents: true } }),
    db.expense.groupBy({ by: ["projectId", "currency"], where: { projectId: { in: ids } }, _sum: { amountCents: true } }),
    db.invoice.findMany({ where: { projectId: { in: ids }, status: { notIn: ["DRAFT", "VOID"] } }, select: { projectId: true, currency: true, status: true, totalCents: true, paidCents: true, refundedCents: true, dueDate: true, issueDate: true } }),
    db.clientWait.findMany({ where: { projectId: { in: ids }, resolvedAt: null }, select: { projectId: true, startedAt: true } }),
    db.deliverable.groupBy({ by: ["projectId"], where: { projectId: { in: ids }, status: "WAITING_FOR_CLIENT" }, _count: true }),
    db.changeRequest.groupBy({ by: ["projectId"], where: { projectId: { in: ids }, status: { in: ["OPEN", "IN_PROGRESS"] } }, _count: true }),
    db.milestone.findMany({ where: { projectId: { in: ids }, completedAt: null, dueDate: { gte: today } }, select: { projectId: true, title: true, dueDate: true }, orderBy: { dueDate: "asc" } }),
  ]);
  const rate = new Map(members.map((m) => [m.userId, m.hourlyCostCents ?? 0]));

  return projects.map((p) => {
    const pt = tasks.filter((t) => t.projectId === p.id);
    const leaf = pt.filter((t) => t._count.subtasks === 0);
    const open = leaf.filter((t) => (OPEN as readonly string[]).includes(t.status));
    const overdue = open.filter((t) => t.deadline && t.deadline < today);
    const blocked = open.filter((t) => t.status === "BLOCKED");
    // Cost so far = time spent × each person's hourly cost + expenses. Planned = estimates × cost + planned task costs.
    const labour = leaf.reduce((s, t) => s + ((t.actualMinutes ?? 0) * (t.assigneeId ? rate.get(t.assigneeId) ?? 0 : 0)) / 60, 0);
    const planned = leaf.reduce((s, t) => s + ((t.estimatedMinutes ?? 0) * (t.assigneeId ? rate.get(t.assigneeId) ?? 0 : 0)) / 60 + (t.costCents ?? 0), 0);
    const exp = expenses.filter((e) => e.projectId === p.id && e.currency === p.currency).reduce((s, e) => s + (e._sum.amountCents ?? 0), 0);
    const inv = invoices.filter((i) => i.projectId === p.id && i.currency === p.currency);
    const invoiced = inv.reduce((s, i) => s + i.totalCents, 0);
    const paid = inv.reduce((s, i) => s + i.paidCents, 0);
    const overdueInv = inv.filter((i) => deriveStatus(i as never, now) === "OVERDUE").reduce((s, i) => s + outstandingCents(i), 0);
    const pw = waits.filter((w) => w.projectId === p.id).map((w) => ({ days: Math.floor((now.getTime() - w.startedAt.getTime()) / DAY) }));
    const nextTask = open.filter((t) => t.deadline && t.deadline >= today).sort((a, b) => a.deadline!.getTime() - b.deadline!.getTime())[0];
    const nextMs = milestones.find((m) => m.projectId === p.id);
    const next = [nextTask && { date: nextTask.deadline!, label: nextTask.title }, nextMs && { date: nextMs.dueDate!, label: nextMs.title }, p.targetDate && p.targetDate >= today && { date: p.targetDate, label: "Delivery" }]
      .filter((x): x is { date: Date; label: string } => Boolean(x))
      .sort((a, b) => a.date.getTime() - b.date.getTime())[0] ?? null;
    const costToDate = Math.round(labour + exp);
    const health = projectHealth({
      status: p.status, progress: p.progress, startDate: p.startDate, targetDate: p.targetDate, createdAt: p.createdAt,
      overdueTasks: overdue.length, openTasks: open.length, blockedTasks: blocked.length,
      budgetCents: p.budgetCents, costToDateCents: costToDate, plannedCostCents: Math.round(planned + exp),
      invoicedCents: invoiced, paidCents: paid, overdueInvoiceCents: overdueInv, clientWaits: pw,
      pendingApprovals: approvals.find((a) => a.projectId === p.id)?._count ?? 0,
      openChangeRequests: changes.find((c) => c.projectId === p.id)?._count ?? 0,
      nextDeadline: next?.date ?? null,
    }, now);
    return {
      id: p.id, name: p.name, status: p.status, progress: p.progress, currency: p.currency,
      clientId: p.clientId, clientName: p.client.company || `${p.client.firstName} ${p.client.lastName}`.trim(), managerId: p.managerId, managerName: p.manager?.name ?? null,
      targetDate: p.targetDate, nextDeadline: next, budgetCents: p.budgetCents, costToDateCents: costToDate, invoicedCents: invoiced, paidCents: paid,
      overdueTasks: overdue.length, openTasks: open.length, clientWaits: pw.length, pendingApprovals: approvals.find((a) => a.projectId === p.id)?._count ?? 0,
      health,
    };
  });
}
