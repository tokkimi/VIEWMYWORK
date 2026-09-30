import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { projectScope, type WorkspaceCtx } from "@/lib/auth/context";

export type TaskFilters = { tab?: string; projectId?: string; clientId?: string; assigneeId?: string; status?: string; priority?: string; q?: string };

export function taskWhere(ctx: WorkspaceCtx, f: TaskFilters): Prisma.TaskWhereInput {
  const now = new Date();
  const where: Prisma.TaskWhereInput = { workspaceId: ctx.workspace.id, project: { ...projectScope(ctx), archivedAt: null } };
  const and: Prisma.TaskWhereInput[] = [];
  switch (f.tab) {
    case "mine": and.push({ assigneeId: ctx.user.id, status: { not: "COMPLETED" } }); break;
    case "overdue": and.push({ status: { not: "COMPLETED" }, deadline: { lt: now } }); break;
    case "upcoming": and.push({ status: { not: "COMPLETED" }, deadline: { gte: now, lte: new Date(now.getTime() + 14 * 86400_000) } }); break;
    case "waiting": and.push({ status: "WAITING_FOR_CLIENT" }); break;
    case "completed": and.push({ status: "COMPLETED" }); break;
    default: break;
  }
  if (f.projectId) and.push({ projectId: f.projectId });
  if (f.clientId) and.push({ project: { clientId: f.clientId } });
  if (f.assigneeId) and.push(f.assigneeId === "none" ? { assigneeId: null } : { assigneeId: f.assigneeId });
  if (f.status) and.push({ status: f.status as never });
  if (f.priority) and.push({ priority: f.priority as never });
  if (f.q) and.push({ title: { contains: f.q, mode: "insensitive" } });
  if (and.length) where.AND = and;
  return where;
}

export async function listTasks(ctx: WorkspaceCtx, f: TaskFilters, take = 300) {
  return db.task.findMany({
    where: taskWhere(ctx, f),
    include: { project: { select: { id: true, name: true, client: { select: { company: true, firstName: true, lastName: true } } } }, assignee: { select: { id: true, name: true } }, phase: { select: { title: true } } },
    orderBy: f.tab === "completed" ? [{ completedAt: "desc" }] : [{ deadline: { sort: "asc", nulls: "last" } }, { priority: "desc" }, { createdAt: "desc" }],
    take,
  });
}
export type TaskRow = Awaited<ReturnType<typeof listTasks>>[number];
