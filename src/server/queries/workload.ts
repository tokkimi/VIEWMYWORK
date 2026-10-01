import { db } from "@/lib/db";
import type { WorkspaceCtx } from "@/lib/auth/context";
import { hasLevel } from "@/lib/auth/permissions";
import { memberWeeks, suggestAssignees, remainingMinutes, weekStart, isOpen, day, DAY_MS, type WorkTask, type Absence, type Candidate } from "@/lib/workload";

const OPEN_STATUSES = ["NOT_STARTED", "IN_PROGRESS", "BLOCKED", "WAITING_FOR_CLIENT", "IN_REVIEW"] as const;
const LIVE_PROJECTS = { status: { in: ["PLANNING" as const, "ACTIVE" as const, "ON_HOLD" as const] }, archivedAt: null };

export type WorkloadTask = WorkTask & { title: string; projectId: string; projectName: string; priority: string; remaining: number };

/**
 * Everything the team workload page needs. Members who can't see the whole team only get their
 * own row. Only open tasks of live projects count.
 */
export async function loadWorkload(ctx: WorkspaceCtx, weeks = 6, today = new Date()) {
  const seeAll = hasLevel(ctx.perms, "team", "view");
  const horizonEnd = new Date(weekStart(today).getTime() + weeks * 7 * DAY_MS);

  const members = await db.workspaceMember.findMany({
    where: { workspaceId: ctx.workspace.id, status: "ACTIVE", role: { not: "VIEWER" }, ...(seeAll ? {} : { userId: ctx.user.id }) },
    include: { user: { select: { id: true, name: true, avatarUrl: true } }, projectMemberships: { select: { projectId: true } }, absences: { where: { endDate: { gte: new Date(today.getTime() - 31 * DAY_MS) } }, orderBy: { startDate: "asc" } } },
    orderBy: { createdAt: "asc" },
  });

  const rows = await db.task.findMany({
    where: { workspaceId: ctx.workspace.id, status: { in: [...OPEN_STATUSES] }, project: LIVE_PROJECTS, ...(seeAll ? {} : { OR: [{ assigneeId: ctx.user.id }, { assigneeId: null }] }) },
    select: { id: true, title: true, status: true, priority: true, assigneeId: true, startDate: true, deadline: true, estimatedMinutes: true, actualMinutes: true, projectId: true, project: { select: { name: true } }, _count: { select: { subtasks: true } } },
    orderBy: [{ deadline: "asc" }, { createdAt: "asc" }],
    take: 3000,
  });
  const tasks: WorkloadTask[] = rows.map((t) => ({
    id: t.id, title: t.title, status: t.status, priority: t.priority, assigneeId: t.assigneeId, startDate: t.startDate, deadline: t.deadline,
    estimatedMinutes: t.estimatedMinutes, actualMinutes: t.actualMinutes, projectId: t.projectId, projectName: t.project.name, hasSubtasks: t._count.subtasks > 0,
    remaining: 0,
  }));
  for (const t of tasks) t.remaining = remainingMinutes(t);

  const t0 = day(today);
  const thisWeekEnd = new Date(weekStart(today).getTime() + 7 * DAY_MS);
  const people = members.map((m) => {
    const mine = tasks.filter((t) => t.assigneeId === m.userId);
    const absences: Absence[] = m.absences.map((a) => ({ memberUserId: m.userId, startDate: a.startDate, endDate: a.endDate }));
    const weekly = memberWeeks({ tasks: mine, weeklyCapacityMinutes: m.weeklyCapacityMinutes, absences, today, weeks });
    const overdue = mine.filter((t) => t.deadline && day(t.deadline) < t0 && t.remaining > 0);
    const thisWeek = mine.filter((t) => t.deadline && day(t.deadline) >= t0 && t.deadline < thisWeekEnd && t.remaining > 0);
    const unscheduled = mine.filter((t) => !t.deadline && t.remaining > 0);
    const allProjects = m.allProjects || m.role === "OWNER" || m.role === "ADMIN";
    return {
      memberId: m.id, userId: m.userId, name: m.user.name, avatarUrl: m.user.avatarUrl, title: m.title, role: m.role,
      weeklyCapacityMinutes: m.weeklyCapacityMinutes, hourlyCostCents: m.hourlyCostCents,
      absences: m.absences.filter((a) => a.endDate >= t0 && a.startDate < horizonEnd).map((a) => ({ id: a.id, startDate: a.startDate, endDate: a.endDate, reason: a.reason, note: a.note })),
      weeks: weekly, overdue, thisWeek, unscheduledMinutes: unscheduled.reduce((s, t) => s + t.remaining, 0), unscheduledCount: unscheduled.length,
      candidate: { userId: m.userId, weeklyCapacityMinutes: m.weeklyCapacityMinutes, absences, tasks: mine, projectIds: allProjects ? ("all" as const) : new Set(m.projectMemberships.map((p) => p.projectId)) } satisfies Candidate,
      isMe: m.userId === ctx.user.id,
    };
  });

  const unassigned = tasks.filter((t) => !t.assigneeId && isOpen(t.status) && !t.hasSubtasks);
  const suggestions = seeAll ? suggestAssignees(unassigned, people.map((p) => p.candidate), today) : new Map<string, string>();

  return { people, unassigned, suggestions, seeAll, weeks: people[0]?.weeks.map((w) => w.week) ?? [] };
}
