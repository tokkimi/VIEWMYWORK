import type { Prisma } from "@prisma/client";
import { db, type Tx } from "@/lib/db";
import { notFound, forbidden, AppError } from "@/lib/errors";
import { getProjectAccess, isUuid, projectScope, type WorkspaceCtx } from "@/lib/auth/context";
import { hasLevel } from "@/lib/auth/permissions";

export async function logSpec(tx: Tx, projectId: string, ctx: WorkspaceCtx | null, change: string, metadata?: Prisma.InputJsonValue) {
  await tx.specHistory.create({ data: { projectId, actorId: ctx?.user.id ?? null, actorName: ctx?.user.name ?? "System", change, metadata } });
}

export async function loadPhase(ctx: WorkspaceCtx, id: string, level: "view" | "edit" | "manage" = "edit") {
  if (!isUuid(id)) throw notFound();
  const phase = await db.phase.findFirst({ where: { id, project: projectScope(ctx) } });
  if (!phase) throw notFound("Phase not found.");
  const access = await getProjectAccess(ctx, phase.projectId);
  if (!hasLevel(access.perms, "projects", level === "view" ? "view" : level === "edit" ? "edit" : "manage")) throw forbidden();
  return { phase, ...access };
}

export async function loadTask(ctx: WorkspaceCtx, id: string, level: "view" | "edit" = "edit") {
  if (!isUuid(id)) throw notFound();
  const task = await db.task.findFirst({ where: { id, workspaceId: ctx.workspace.id, project: projectScope(ctx) } });
  if (!task) throw notFound("Task not found.");
  const access = await getProjectAccess(ctx, task.projectId);
  if (!hasLevel(access.perms, "tasks", level)) throw forbidden();
  return { task, ...access };
}

export async function assertAssignable(workspaceId: string, userId: string | null | undefined) {
  if (!userId) return;
  const m = await db.workspaceMember.findFirst({ where: { workspaceId, userId, status: "ACTIVE" } });
  if (!m) throw new AppError("Assignee must be an active member of this workspace.");
}

/** Copies a template's structure into a project — a deep copy, never a live reference. */
export async function applyTemplate(tx: Tx, workspaceId: string, projectId: string, templateId: string) {
  const tpl = await tx.projectTemplate.findFirst({
    where: { id: templateId, OR: [{ workspaceId: null }, { workspaceId }] },
    include: { phases: { orderBy: { position: "asc" }, include: { tasks: { orderBy: { position: "asc" } } } } },
  });
  if (!tpl) throw notFound("Template not found.");
  for (const ph of tpl.phases) {
    const phase = await tx.phase.create({ data: { projectId, title: ph.title, weight: ph.weight, position: ph.position } });
    if (ph.tasks.length)
      await tx.task.createMany({
        data: ph.tasks.map((t) => ({ workspaceId, projectId, phaseId: phase.id, title: t.title, description: t.description, weight: t.weight, position: t.position, visibility: t.visibility, requiresApproval: t.requiresApproval })),
      });
  }
  return tpl;
}

/** Full specification snapshot (used on completion and for history). */
export async function snapshotSpec(tx: Tx, projectId: string) {
  const phases = await tx.phase.findMany({
    where: { projectId },
    orderBy: { position: "asc" },
    include: { milestones: true, tasks: { select: { id: true, title: true, status: true, weight: true, deadline: true, visibility: true, parentId: true, completedAt: true } } },
  });
  return JSON.parse(JSON.stringify(phases)) as Prisma.InputJsonValue;
}
