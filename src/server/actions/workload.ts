"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { runAction, AppError, notFound } from "@/lib/errors";
import { requireWorkspace, requirePerm, getProjectAccess, isUuid } from "@/lib/auth/context";
import { hasLevel } from "@/lib/auth/permissions";
import { formToObject, zId, zOptStr } from "@/lib/validation";
import { requireFeature } from "@/lib/plans";
import { emit } from "@/lib/events";
import { assertAssignable } from "@/server/services/spec";

/** Weekly hours available and internal hourly cost of a member (team managers only). */
export async function updateMemberCapacityAction(fd: FormData) {
  return runAction(async () => {
    const ctx = await requireWorkspace();
    requirePerm(ctx, "team", "manage");
    await requireFeature(ctx.workspace.id, "team_workload");
    const i = z
      .object({
        memberId: zId,
        hoursPerWeek: z.coerce.number().min(0, "Enter between 0 and 80 hours.").max(80, "Enter between 0 and 80 hours."),
        hourlyCost: z.preprocess((v) => (v === "" || v === undefined ? undefined : String(v).replace(",", ".")), z.coerce.number().min(0).max(10000).optional()),
      })
      .parse(formToObject(fd));
    const m = await db.workspaceMember.findFirst({ where: { id: i.memberId, workspaceId: ctx.workspace.id } });
    if (!m) throw notFound();
    await db.workspaceMember.update({ where: { id: m.id }, data: { weeklyCapacityMinutes: Math.round(i.hoursPerWeek * 60), hourlyCostCents: i.hourlyCost === undefined ? null : Math.round(i.hourlyCost * 100) } });
    return null;
  }, "Capacity saved.");
}

/** Record an absence. Managers can do it for anyone; every member for themselves. */
export async function addAbsenceAction(fd: FormData) {
  return runAction(async () => {
    const ctx = await requireWorkspace();
    await requireFeature(ctx.workspace.id, "team_workload");
    const i = z
      .object({ memberId: zId, startDate: z.coerce.date(), endDate: z.coerce.date(), reason: z.enum(["LEAVE", "SICK", "TRAINING", "OTHER"]).default("LEAVE"), note: zOptStr(200) })
      .parse(formToObject(fd));
    if (i.endDate < i.startDate) throw new AppError("The end date must be after the start date.");
    if (i.endDate.getTime() - i.startDate.getTime() > 366 * 86_400_000) throw new AppError("An absence can't exceed one year.");
    const m = await db.workspaceMember.findFirst({ where: { id: i.memberId, workspaceId: ctx.workspace.id } });
    if (!m) throw notFound();
    if (m.userId !== ctx.user.id && !hasLevel(ctx.perms, "team", "manage")) throw new AppError("You can only record your own absences.", "FORBIDDEN");
    await db.memberAbsence.create({ data: { workspaceId: ctx.workspace.id, memberId: m.id, startDate: i.startDate, endDate: i.endDate, reason: i.reason, note: i.note } });
    return null;
  }, "Absence recorded.");
}

export async function deleteAbsenceAction(id: string) {
  return runAction(async () => {
    const ctx = await requireWorkspace();
    if (!isUuid(id)) throw notFound();
    const a = await db.memberAbsence.findFirst({ where: { id, workspaceId: ctx.workspace.id }, include: { member: true } });
    if (!a) throw notFound();
    if (a.member.userId !== ctx.user.id && !hasLevel(ctx.perms, "team", "manage")) throw new AppError("You can only remove your own absences.", "FORBIDDEN");
    await db.memberAbsence.delete({ where: { id } });
    return null;
  }, "Absence removed.");
}

/** Apply one or more (task → member) assignments, e.g. the workload suggestions. */
export async function assignTasksAction(assignments: { taskId: string; userId: string }[]) {
  return runAction(async () => {
    const ctx = await requireWorkspace();
    await requireFeature(ctx.workspace.id, "team_workload");
    const list = z.array(z.object({ taskId: zId, userId: zId })).min(1).max(200).parse(assignments);
    let done = 0;
    for (const a of list) {
      const task = await db.task.findFirst({ where: { id: a.taskId, workspaceId: ctx.workspace.id }, include: { project: { select: { id: true, name: true } } } });
      if (!task) continue;
      const { perms } = await getProjectAccess(ctx, task.projectId);
      if (!hasLevel(perms, "tasks", "edit")) continue;
      await assertAssignable(ctx.workspace.id, a.userId);
      await db.task.update({ where: { id: task.id }, data: { assigneeId: a.userId } });
      done++;
      if (a.userId !== ctx.user.id)
        await emit({
          workspaceId: ctx.workspace.id, type: "TASK_ASSIGNED", actor: { id: ctx.user.id, name: ctx.user.name }, projectId: task.projectId, entityType: "TASK", entityId: task.id, summary: ["Task “{name}” assigned", { name: task.title }],
          notify: { team: { kind: "users", userIds: [a.userId] }, title: ["{name} assigned you a task", { name: ctx.user.name }], message: `${task.title} — ${task.project.name}`, actionUrl: `/app/projects/${task.projectId}/tasks?task=${task.id}`, actionLabel: "Open task" },
        });
    }
    if (!done) throw new AppError("No task could be assigned.");
    return { assigned: done };
  }, "Tasks assigned.");
}
