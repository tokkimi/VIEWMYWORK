import { db } from "@/lib/db";
import { loadDecisions } from "@/server/queries/decisions";
import { ageDays } from "@/lib/decisions";
import type { ReportData } from "@/lib/reports";

const DAY = 86_400_000;

/**
 * What happened on a project over the last 7 days, as the client sees it: only client-visible
 * tasks, milestones and deliverables are included, never internal notes or costs.
 */
export async function buildProjectReport(projectId: string, now = new Date()): Promise<ReportData> {
  const project = await db.project.findUniqueOrThrow({ where: { id: projectId }, select: { id: true, name: true, status: true, progress: true, targetDate: true, workspaceId: true } });
  const start = new Date(now.getTime() - 7 * DAY);
  const horizon = new Date(now.getTime() + 14 * DAY);
  const [tasks, milestonesDone, approvals, active, nextTasks, nextMilestones, update, previous, waiting] = await Promise.all([
    db.task.findMany({ where: { projectId, visibility: "CLIENT_VISIBLE", status: "COMPLETED", completedAt: { gte: start, lte: now } }, select: { title: true }, orderBy: { completedAt: "asc" } }),
    db.milestone.findMany({ where: { projectId, visibility: "CLIENT_VISIBLE", completedAt: { gte: start, lte: now } }, select: { title: true } }),
    db.approval.findMany({ where: { deliverable: { projectId, visibility: "CLIENT_VISIBLE" }, decision: "APPROVED", createdAt: { gte: start, lte: now } }, select: { version: true, deliverable: { select: { title: true } } } }),
    db.task.findMany({ where: { projectId, visibility: "CLIENT_VISIBLE", status: { in: ["IN_PROGRESS", "IN_REVIEW"] } }, select: { title: true }, orderBy: [{ deadline: "asc" }, { position: "asc" }], take: 8 }),
    db.task.findMany({ where: { projectId, visibility: "CLIENT_VISIBLE", status: { not: "COMPLETED" }, deadline: { gt: now, lte: horizon } }, select: { title: true, deadline: true }, orderBy: { deadline: "asc" }, take: 8 }),
    db.milestone.findMany({ where: { projectId, visibility: "CLIENT_VISIBLE", completedAt: null, dueDate: { gt: now, lte: horizon } }, select: { title: true, dueDate: true }, orderBy: { dueDate: "asc" }, take: 4 }),
    db.projectUpdate.findFirst({ where: { projectId, publishedAt: { gte: start, lte: now } }, orderBy: { publishedAt: "desc" }, select: { title: true, body: true, nextSteps: true } }),
    db.projectReport.findFirst({ where: { projectId }, orderBy: { createdAt: "desc" }, select: { data: true } }),
    loadDecisions(project.workspaceId, { id: projectId }),
  ]);
  const done: ReportData["done"] = [
    ...milestonesDone.map((m) => ({ title: m.title, kind: "milestone" as const })),
    ...approvals.map((a) => ({ title: `${a.deliverable.title} V${a.version}`, kind: "deliverable" as const })),
    ...tasks.map((t) => ({ title: t.title, kind: "task" as const })),
  ];
  const next = [...nextMilestones.map((m) => ({ title: m.title, date: m.dueDate })), ...nextTasks.map((t) => ({ title: t.title, date: t.deadline }))]
    .sort((a, b) => (a.date?.getTime() ?? 0) - (b.date?.getTime() ?? 0))
    .slice(0, 8)
    .map((x) => ({ title: x.title, date: x.date?.toISOString() ?? null }));
  const prev = (previous?.data as ReportData | null)?.project?.progress;
  return {
    project: { id: project.id, name: project.name, status: project.status, progress: project.progress, targetDate: project.targetDate?.toISOString() ?? null },
    previousProgress: typeof prev === "number" ? prev : null,
    period: { start: start.toISOString(), end: now.toISOString() },
    done: done.slice(0, 12),
    doneTotal: done.length,
    inProgress: active.map((t) => t.title),
    next,
    waiting: waiting.map((w) => ({ kind: w.kind, title: w.title, days: ageDays(w.since, now) })),
    update: update ? { title: update.title, body: update.body.slice(0, 1500), nextSteps: update.nextSteps?.slice(0, 800) ?? null } : null,
  };
}
