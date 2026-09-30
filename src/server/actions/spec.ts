"use server";

import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { runAction, AppError, notFound } from "@/lib/errors";
import { requireWorkspace, requireProjectPerm, isUuid } from "@/lib/auth/context";
import { formToObject, zOptStr, zOptDate, zId, zOptId, zOptMoney } from "@/lib/validation";
import { emit } from "@/lib/events";
import { recalcProject } from "@/lib/progress";
import { loadPhase, loadTask, logSpec, assertAssignable } from "@/server/services/spec";
import { TASK_STATUS } from "@/lib/labels";

const visibility = z.enum(["INTERNAL", "CLIENT_VISIBLE"]);
const status = z.enum(["NOT_STARTED", "IN_PROGRESS", "BLOCKED", "WAITING_FOR_CLIENT", "IN_REVIEW", "COMPLETED"]);

// ───────── Phases ─────────

export async function addPhaseAction(fd: FormData) {
  return runAction(async () => {
    const ctx = await requireWorkspace();
    const i = z.object({ projectId: zId, title: z.string().trim().min(1, "Title is required.").max(140), weight: z.coerce.number().int().min(0).max(1000).default(10) }).parse(formToObject(fd));
    await requireProjectPerm(ctx, i.projectId, "projects", "edit");
    await db.$transaction(async (tx) => {
      const last = await tx.phase.aggregate({ where: { projectId: i.projectId }, _max: { position: true } });
      await tx.phase.create({ data: { projectId: i.projectId, title: i.title, weight: i.weight, position: (last._max.position ?? -1) + 1 } });
      await logSpec(tx, i.projectId, ctx, ["Phase “{name}” added", { name: i.title }]);
      await recalcProject(tx, i.projectId);
    });
    return null;
  });
}

export async function updatePhaseAction(fd: FormData) {
  return runAction(async () => {
    const ctx = await requireWorkspace();
    const i = z
      .object({ id: zId, title: z.string().trim().min(1).max(140), description: zOptStr(5000), weight: z.coerce.number().int().min(0).max(1000), visibility, startDate: zOptDate, deadline: zOptDate })
      .parse(formToObject(fd));
    const { phase } = await loadPhase(ctx, i.id);
    await db.$transaction(async (tx) => {
      await tx.phase.update({ where: { id: i.id }, data: { title: i.title, description: i.description ?? null, weight: i.weight, visibility: i.visibility, startDate: i.startDate ?? null, deadline: i.deadline ?? null } });
      if ((phase.deadline?.getTime() ?? 0) !== (i.deadline?.getTime() ?? 0)) await logSpec(tx, phase.projectId, ctx, i.deadline ? ["Deadline of “{name}” changed to {date}", { name: i.title, date: { date: i.deadline } }] : ["Deadline of “{name}” removed", { name: i.title }]);
      if (phase.weight !== i.weight) await logSpec(tx, phase.projectId, ctx, ["Weight of “{name}” changed {from} → {to}", { name: i.title, from: phase.weight, to: i.weight }]);
      await recalcProject(tx, phase.projectId);
    });
    return null;
  }, "Phase saved.");
}

export async function deletePhaseAction(id: string) {
  return runAction(async () => {
    const ctx = await requireWorkspace();
    const { phase } = await loadPhase(ctx, id, "manage");
    await db.$transaction(async (tx) => {
      await tx.task.deleteMany({ where: { phaseId: id } });
      await tx.phase.delete({ where: { id } });
      await logSpec(tx, phase.projectId, ctx, ["Phase “{name}” deleted", { name: phase.title }]);
      await recalcProject(tx, phase.projectId);
    });
    return null;
  }, "Phase deleted.");
}

export async function duplicatePhaseAction(id: string) {
  return runAction(async () => {
    const ctx = await requireWorkspace();
    const { phase } = await loadPhase(ctx, id);
    await db.$transaction(async (tx) => {
      await tx.phase.updateMany({ where: { projectId: phase.projectId, position: { gt: phase.position } }, data: { position: { increment: 1 } } });
      const copy = await tx.phase.create({ data: { projectId: phase.projectId, title: `${phase.title} (copy)`, description: phase.description, weight: phase.weight, visibility: phase.visibility, position: phase.position + 1 } });
      const tasks = await tx.task.findMany({ where: { phaseId: id, parentId: null }, orderBy: { position: "asc" } });
      for (const t of tasks)
        await tx.task.create({ data: { workspaceId: t.workspaceId, projectId: t.projectId, phaseId: copy.id, title: t.title, description: t.description, weight: t.weight, priority: t.priority, position: t.position, visibility: t.visibility, estimatedMinutes: t.estimatedMinutes, requiresApproval: t.requiresApproval } });
      await logSpec(tx, phase.projectId, ctx, ["Phase “{name}” duplicated", { name: phase.title }]);
      await recalcProject(tx, phase.projectId);
    });
    return null;
  }, "Phase duplicated.");
}

export async function reorderPhasesAction(projectId: string, orderedIds: string[]) {
  return runAction(async () => {
    const ctx = await requireWorkspace();
    await requireProjectPerm(ctx, projectId, "projects", "edit");
    const ids = z.array(zId).max(200).parse(orderedIds);
    const existing = await db.phase.findMany({ where: { projectId }, select: { id: true } });
    const set = new Set(existing.map((p) => p.id));
    if (ids.length !== set.size || ids.some((x) => !set.has(x))) throw new AppError("Phase list is out of date. Refresh and try again.", "CONFLICT");
    await db.$transaction(ids.map((id, idx) => db.phase.update({ where: { id }, data: { position: idx } })));
    return null;
  });
}

// ───────── Milestones ─────────

export async function addMilestoneAction(fd: FormData) {
  return runAction(async () => {
    const ctx = await requireWorkspace();
    // Checkbox: absent → INTERNAL.
    const i = z.object({ phaseId: zId, title: z.string().trim().min(1).max(140), dueDate: zOptDate, visibility: z.preprocess((v) => (v === "CLIENT_VISIBLE" ? v : "INTERNAL"), visibility) }).parse(formToObject(fd));
    const { phase } = await loadPhase(ctx, i.phaseId);
    await db.$transaction(async (tx) => {
      const last = await tx.milestone.aggregate({ where: { phaseId: i.phaseId }, _max: { position: true } });
      await tx.milestone.create({ data: { phaseId: i.phaseId, projectId: phase.projectId, title: i.title, dueDate: i.dueDate, visibility: i.visibility, position: (last._max.position ?? -1) + 1 } });
      await logSpec(tx, phase.projectId, ctx, ["Milestone “{name}” added", { name: i.title }]);
    });
    return null;
  }, "Milestone added.");
}

export async function toggleMilestoneAction(id: string) {
  return runAction(async () => {
    const ctx = await requireWorkspace();
    const m = await db.milestone.findFirst({ where: { id, phase: { project: { workspaceId: ctx.workspace.id } } } });
    if (!m) throw notFound();
    await loadPhase(ctx, m.phaseId);
    await db.$transaction(async (tx) => {
      await tx.milestone.update({ where: { id }, data: { completedAt: m.completedAt ? null : new Date() } });
      await logSpec(tx, m.projectId, ctx, [m.completedAt ? "Milestone “{name}” reopened" : "Milestone “{name}” reached", { name: m.title }]);
    });
    return null;
  });
}

export async function deleteMilestoneAction(id: string) {
  return runAction(async () => {
    const ctx = await requireWorkspace();
    const m = await db.milestone.findFirst({ where: { id, phase: { project: { workspaceId: ctx.workspace.id } } } });
    if (!m) throw notFound();
    await loadPhase(ctx, m.phaseId);
    await db.milestone.delete({ where: { id } });
    return null;
  }, "Milestone deleted.");
}

// ───────── Tasks ─────────

export async function addTaskAction(fd: FormData) {
  return runAction(async () => {
    const ctx = await requireWorkspace();
    const i = z
      .object({
        projectId: zId, phaseId: zOptId, parentId: zOptId, milestoneId: zOptId,
        title: z.string().trim().min(1, "Title is required.").max(200),
        assigneeId: zOptId, deadline: zOptDate, priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
        visibility: visibility.default("CLIENT_VISIBLE"),
      })
      .parse(formToObject(fd));
    const { project } = await requireProjectPerm(ctx, i.projectId, "tasks", "edit");
    if (i.phaseId && !(await db.phase.findFirst({ where: { id: i.phaseId, projectId: i.projectId } }))) throw notFound("Phase not found.");
    let phaseId = i.phaseId ?? null;
    if (i.parentId) {
      const parent = await db.task.findFirst({ where: { id: i.parentId, projectId: i.projectId } });
      if (!parent) throw notFound("Parent task not found.");
      if (parent.parentId) throw new AppError("Subtasks can only be one level deep.");
      phaseId = parent.phaseId;
    }
    await assertAssignable(ctx.workspace.id, i.assigneeId);
    const task = await db.$transaction(async (tx) => {
      const last = await tx.task.aggregate({ where: { projectId: i.projectId, phaseId, parentId: i.parentId ?? null }, _max: { position: true } });
      const t = await tx.task.create({
        data: { workspaceId: ctx.workspace.id, projectId: i.projectId, phaseId, parentId: i.parentId ?? null, milestoneId: i.milestoneId ?? null, title: i.title, assigneeId: i.assigneeId ?? null, deadline: i.deadline ?? null, priority: i.priority, visibility: i.visibility, position: (last._max.position ?? -1) + 1 },
      });
      if (!i.parentId) await logSpec(tx, i.projectId, ctx, ["Task “{name}” added", { name: i.title }]);
      await recalcProject(tx, i.projectId);
      return t;
    });
    if (task.assigneeId && task.assigneeId !== ctx.user.id)
      await emit({
        workspaceId: ctx.workspace.id, type: "TASK_ASSIGNED", actor: { id: ctx.user.id, name: ctx.user.name }, projectId: project.id, entityType: "TASK", entityId: task.id,
        summary: ["Task “{name}” assigned", { name: task.title }],
        notify: { team: { kind: "users", userIds: [task.assigneeId] }, title: ["{name} assigned you a task", { name: ctx.user.name }], message: `${task.title} — ${project.name}`, actionUrl: `/app/projects/${project.id}/tasks?task=${task.id}`, actionLabel: "Open task", email: true },
      });
    return { id: task.id };
  });
}

const taskUpdateSchema = z.object({
  id: zId,
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().max(20000).optional(),
  status: status.optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  weight: z.coerce.number().int().min(0).max(1000).optional(),
  assigneeId: z.union([z.literal(""), zId]).optional(),
  phaseId: z.union([z.literal(""), zId]).optional(),
  milestoneId: z.union([z.literal(""), zId]).optional(),
  startDate: z.union([z.literal(""), z.coerce.date()]).optional(),
  deadline: z.union([z.literal(""), z.coerce.date()]).optional(),
  estimatedHours: z.union([z.literal(""), z.coerce.number().min(0).max(10000)]).optional(),
  actualHours: z.union([z.literal(""), z.coerce.number().min(0).max(10000)]).optional(),
  cost: zOptMoney,
  visibility: visibility.optional(),
  internalNotes: z.string().max(20000).optional(),
  requiresApproval: z.enum(["on", "off"]).optional(),
});

export async function updateTaskAction(fd: FormData) {
  return runAction(async () => {
    const ctx = await requireWorkspace();
    const i = taskUpdateSchema.parse(formToObject(fd));
    return applyTaskUpdate(ctx, i);
  });
}

export async function setTaskStatusAction(id: string, s: string) {
  return runAction(async () => {
    const ctx = await requireWorkspace();
    return applyTaskUpdate(ctx, { id, status: status.parse(s) });
  });
}

async function applyTaskUpdate(ctx: Awaited<ReturnType<typeof requireWorkspace>>, i: z.infer<typeof taskUpdateSchema>) {
  const { task, project } = await loadTask(ctx, i.id);
  const data: Prisma.TaskUncheckedUpdateInput = {};
  if (i.title !== undefined) data.title = i.title;
  if (i.description !== undefined) data.description = i.description || null;
  if (i.priority) data.priority = i.priority;
  if (i.weight !== undefined) data.weight = i.weight;
  if (i.visibility) data.visibility = i.visibility;
  if (i.internalNotes !== undefined) data.internalNotes = i.internalNotes || null;
  if (i.requiresApproval) data.requiresApproval = i.requiresApproval === "on";
  if (i.startDate !== undefined) data.startDate = i.startDate || null;
  if (i.deadline !== undefined) data.deadline = i.deadline || null;
  if (i.estimatedHours !== undefined) data.estimatedMinutes = i.estimatedHours === "" ? null : Math.round(i.estimatedHours * 60);
  if (i.actualHours !== undefined) data.actualMinutes = i.actualHours === "" ? null : Math.round(i.actualHours * 60);
  if (i.cost !== undefined) data.costCents = i.cost;
  if (i.assigneeId !== undefined) {
    await assertAssignable(ctx.workspace.id, i.assigneeId || null);
    data.assigneeId = i.assigneeId || null;
  }
  if (i.phaseId !== undefined && !task.parentId) {
    if (i.phaseId && !(await db.phase.findFirst({ where: { id: i.phaseId, projectId: task.projectId } }))) throw notFound("Phase not found.");
    data.phaseId = i.phaseId || null;
  }
  if (i.milestoneId !== undefined) {
    if (i.milestoneId && !(await db.milestone.findFirst({ where: { id: i.milestoneId, projectId: task.projectId } }))) throw notFound("Milestone not found.");
    data.milestoneId = i.milestoneId || null;
  }
  const statusChanged = i.status && i.status !== task.status;
  if (statusChanged) {
    data.status = i.status;
    data.completedAt = i.status === "COMPLETED" ? new Date() : null;
    if (i.status === "COMPLETED") {
      const blockers = await db.taskDependency.findMany({ where: { taskId: task.id, dependsOn: { status: { not: "COMPLETED" } } }, include: { dependsOn: { select: { title: true } } } });
      if (blockers.length) throw new AppError(["Complete “{task}” first — this task depends on it.", { task: blockers[0].dependsOn.title }]);
    }
  }

  await db.$transaction(async (tx) => {
    await tx.task.update({ where: { id: task.id }, data });
    if (statusChanged) {
      // Client delay tracking — waits open/close with the WAITING_FOR_CLIENT status.
      if (i.status === "WAITING_FOR_CLIENT") await tx.clientWait.create({ data: { projectId: task.projectId, reason: task.requiresApproval ? "APPROVAL" : "INFORMATION", label: task.title, entityType: "TASK", entityId: task.id } });
      if (task.status === "WAITING_FOR_CLIENT") await tx.clientWait.updateMany({ where: { entityType: "TASK", entityId: task.id, resolvedAt: null }, data: { resolvedAt: new Date() } });
    }
    if (i.deadline !== undefined && (task.deadline?.getTime() ?? 0) !== ((i.deadline || null)?.getTime() ?? 0)) await logSpec(tx, task.projectId, ctx, i.deadline ? ["Deadline of “{name}” changed to {date}", { name: task.title, date: { date: i.deadline } }] : ["Deadline of “{name}” removed", { name: task.title }]);
    await recalcProject(tx, task.projectId);
  });

  const actor = { id: ctx.user.id, name: ctx.user.name };
  if (statusChanged && i.status === "COMPLETED")
    await emit({
      workspaceId: ctx.workspace.id, type: "TASK_COMPLETED", actor, projectId: project.id, clientId: project.clientId, entityType: "TASK", entityId: task.id,
      summary: ["Task “{name}” completed", { name: task.title }], clientVisible: task.visibility === "CLIENT_VISIBLE",
      notify: { team: { kind: "users", userIds: [project.managerId, task.assigneeId].filter((x): x is string => Boolean(x)) }, title: "Task completed", message: ["{user} completed “{task}” in {project}.", { user: ctx.user.name, task: task.title, project: project.name }], actionUrl: `/app/projects/${project.id}/tasks?task=${task.id}`, actionLabel: "Open task" },
    });
  else if (statusChanged)
    await emit({ workspaceId: ctx.workspace.id, type: "TASK_STATUS_CHANGED", actor, projectId: project.id, clientId: project.clientId, entityType: "TASK", entityId: task.id, summary: ["“{task}” moved to {status}", { task: task.title, status: { t: TASK_STATUS[i.status!].label } }], clientVisible: task.visibility === "CLIENT_VISIBLE" && i.status === "WAITING_FOR_CLIENT" });
  if (i.assigneeId && i.assigneeId !== task.assigneeId && i.assigneeId !== ctx.user.id)
    await emit({
      workspaceId: ctx.workspace.id, type: "TASK_ASSIGNED", actor, projectId: project.id, entityType: "TASK", entityId: task.id, summary: ["Task “{name}” assigned", { name: task.title }],
      notify: { team: { kind: "users", userIds: [i.assigneeId] }, title: ["{name} assigned you a task", { name: ctx.user.name }], message: `${task.title} — ${project.name}`, actionUrl: `/app/projects/${project.id}/tasks?task=${task.id}`, actionLabel: "Open task", email: true },
    });
  return { id: task.id };
}

export async function deleteTaskAction(id: string) {
  return runAction(async () => {
    const ctx = await requireWorkspace();
    const { task } = await loadTask(ctx, id);
    await db.$transaction(async (tx) => {
      await tx.task.delete({ where: { id } });
      await tx.clientWait.updateMany({ where: { entityType: "TASK", entityId: id, resolvedAt: null }, data: { resolvedAt: new Date() } });
      if (!task.parentId) await logSpec(tx, task.projectId, ctx, ["Task “{name}” deleted", { name: task.title }]);
      await recalcProject(tx, task.projectId);
    });
    return null;
  }, "Task deleted.");
}

export async function duplicateTaskAction(id: string) {
  return runAction(async () => {
    const ctx = await requireWorkspace();
    const { task } = await loadTask(ctx, id);
    await db.$transaction(async (tx) => {
      await tx.task.updateMany({ where: { projectId: task.projectId, phaseId: task.phaseId, parentId: task.parentId, position: { gt: task.position } }, data: { position: { increment: 1 } } });
      const copy = await tx.task.create({
        data: { workspaceId: task.workspaceId, projectId: task.projectId, phaseId: task.phaseId, parentId: task.parentId, milestoneId: task.milestoneId, title: `${task.title} (copy)`, description: task.description, priority: task.priority, weight: task.weight, position: task.position + 1, visibility: task.visibility, estimatedMinutes: task.estimatedMinutes, requiresApproval: task.requiresApproval, deadline: task.deadline, assigneeId: task.assigneeId },
      });
      const items = await tx.checklistItem.findMany({ where: { taskId: id } });
      if (items.length) await tx.checklistItem.createMany({ data: items.map((c) => ({ taskId: copy.id, label: c.label, position: c.position })) });
      await recalcProject(tx, task.projectId);
    });
    return null;
  }, "Task duplicated.");
}

/** Reorders tasks within a container and optionally moves them into it (drag & drop). */
export async function reorderTasksAction(projectId: string, phaseId: string | null, orderedIds: string[]) {
  return runAction(async () => {
    const ctx = await requireWorkspace();
    await requireProjectPerm(ctx, projectId, "tasks", "edit");
    const ids = z.array(zId).max(500).parse(orderedIds);
    if (phaseId && !isUuid(phaseId)) throw notFound();
    if (phaseId && !(await db.phase.findFirst({ where: { id: phaseId, projectId } }))) throw notFound("Phase not found.");
    const tasks = await db.task.findMany({ where: { id: { in: ids }, projectId, parentId: null }, select: { id: true } });
    if (tasks.length !== ids.length) throw new AppError("Task list is out of date. Refresh and try again.", "CONFLICT");
    await db.$transaction(async (tx) => {
      for (const [idx, id] of ids.entries()) {
        await tx.task.update({ where: { id }, data: { position: idx, phaseId } });
        await tx.task.updateMany({ where: { parentId: id }, data: { phaseId } });
      }
      await recalcProject(tx, projectId);
    });
    return null;
  });
}

// ───────── Checklist & dependencies ─────────

export async function addChecklistItemAction(fd: FormData) {
  return runAction(async () => {
    const ctx = await requireWorkspace();
    const i = z.object({ taskId: zId, label: z.string().trim().min(1).max(300) }).parse(formToObject(fd));
    await loadTask(ctx, i.taskId);
    const count = await db.checklistItem.count({ where: { taskId: i.taskId } });
    if (count >= 100) throw new AppError("Checklist limit reached.");
    await db.checklistItem.create({ data: { taskId: i.taskId, label: i.label, position: count } });
    return null;
  });
}

export async function toggleChecklistItemAction(id: string) {
  return runAction(async () => {
    const ctx = await requireWorkspace();
    const item = await db.checklistItem.findFirst({ where: { id, task: { workspaceId: ctx.workspace.id } } });
    if (!item) throw notFound();
    await loadTask(ctx, item.taskId);
    await db.checklistItem.update({ where: { id }, data: { done: !item.done } });
    return null;
  });
}

export async function deleteChecklistItemAction(id: string) {
  return runAction(async () => {
    const ctx = await requireWorkspace();
    const item = await db.checklistItem.findFirst({ where: { id, task: { workspaceId: ctx.workspace.id } } });
    if (!item) throw notFound();
    await loadTask(ctx, item.taskId);
    await db.checklistItem.delete({ where: { id } });
    return null;
  });
}

export async function addDependencyAction(taskId: string, dependsOnId: string) {
  return runAction(async () => {
    const ctx = await requireWorkspace();
    const { task } = await loadTask(ctx, taskId);
    if (taskId === dependsOnId) throw new AppError("A task can't depend on itself.");
    const other = await db.task.findFirst({ where: { id: dependsOnId, projectId: task.projectId } });
    if (!other) throw notFound("Task not found.");
    // Reject direct and transitive cycles.
    const seen = new Set<string>();
    const stack = [dependsOnId];
    while (stack.length) {
      const cur = stack.pop()!;
      if (cur === taskId) throw new AppError("That would create a circular dependency.");
      if (seen.has(cur)) continue;
      seen.add(cur);
      const deps = await db.taskDependency.findMany({ where: { taskId: cur }, select: { dependsOnId: true } });
      stack.push(...deps.map((d) => d.dependsOnId));
    }
    await db.taskDependency.upsert({ where: { taskId_dependsOnId: { taskId, dependsOnId } }, create: { taskId, dependsOnId }, update: {} });
    return null;
  }, "Dependency added.");
}

export async function removeDependencyAction(taskId: string, dependsOnId: string) {
  return runAction(async () => {
    const ctx = await requireWorkspace();
    await loadTask(ctx, taskId);
    await db.taskDependency.deleteMany({ where: { taskId, dependsOnId } });
    return null;
  });
}
