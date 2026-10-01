import { db } from "@/lib/db";
import { getI18n } from "@/lib/i18n/server";
import { deriveStatus, outstandingCents, isPayable } from "@/lib/invoices/status";

/**
 * Client-facing read models. Every query here filters on CLIENT_VISIBLE at the database
 * level — internal tasks, notes, comments, expenses and margins are never selected.
 */

export type WaitingItem = { key: string; kind: "REVIEW" | "PAY" | "UPLOAD" | "INFO" | "DECIDE"; title: string; subtitle: string; href: string; cta: string; since: Date; amount?: string };

export async function waitingForClient(workspaceId: string, clientId: string, projectIds: string[], base = "/portal") {
  const { t, fmt } = await getI18n();
  const [deliverables, waits, invoices, scopes] = await Promise.all([
    db.deliverable.findMany({ where: { workspaceId, projectId: { in: projectIds }, visibility: "CLIENT_VISIBLE", status: "WAITING_FOR_CLIENT" }, include: { project: { select: { name: true } } }, orderBy: { updatedAt: "asc" } }),
    db.clientWait.findMany({ where: { projectId: { in: projectIds }, resolvedAt: null, OR: [{ entityType: null }, { entityType: "TASK" }] }, include: { project: { select: { name: true } } }, orderBy: { startedAt: "asc" } }),
    db.invoice.findMany({ where: { workspaceId, clientId, status: { in: ["SENT", "VIEWED", "PARTIALLY_PAID", "OVERDUE"] } }, orderBy: { dueDate: "asc" } }),
    db.scopeChange.findMany({ where: { projectId: { in: projectIds }, askClient: true, status: "PROPOSED" }, include: { project: { select: { name: true } } }, orderBy: { requestedAt: "asc" } }),
  ]);
  // Task waits only surface when the task itself is client-visible.
  const taskIds = waits.filter((w) => w.entityType === "TASK" && w.entityId).map((w) => w.entityId!);
  const visibleTasks = new Set((await db.task.findMany({ where: { id: { in: taskIds }, visibility: "CLIENT_VISIBLE" }, select: { id: true } })).map((t) => t.id));
  const items: WaitingItem[] = [
    ...deliverables.map((d) => ({ key: `d-${d.id}`, kind: "REVIEW" as const, title: `${d.title} V${d.currentVersion}`, subtitle: `${t("Review & approve")} · ${d.project.name}`, href: `${base}/projects/${d.projectId}/deliverables/${d.id}`, cta: t("Review"), since: d.updatedAt })),
    ...invoices.filter((i) => isPayable(deriveStatus(i)) && outstandingCents(i) > 0).map((i) => ({ key: `i-${i.id}`, kind: "PAY" as const, title: t("Invoice {number}", { number: i.number }), subtitle: deriveStatus(i) === "OVERDUE" ? t("Overdue") : t("Due {date}", { date: fmt.short(i.dueDate) }), href: `${base}/invoices/${i.id}`, cta: t("Pay"), since: i.issuedAt ?? i.createdAt, amount: `${outstandingCents(i)}|${i.currency}` })),
    ...waits.filter((w) => w.entityType !== "TASK" || visibleTasks.has(w.entityId!)).map((w) => ({ key: `w-${w.id}`, kind: w.reason === "DOCUMENT" ? ("UPLOAD" as const) : ("INFO" as const), title: w.label, subtitle: `${w.reason === "DOCUMENT" ? t("Upload requested") : t("Information requested")} · ${w.project.name}`, href: `${base}/projects/${w.projectId}${w.reason === "DOCUMENT" ? "/files" : "/messages"}`, cta: w.reason === "DOCUMENT" ? t("Upload") : t("Reply"), since: w.startedAt })),
    ...scopes.map((sc) => ({ key: `s-${sc.id}`, kind: "DECIDE" as const, title: sc.description.split("\n")[0]!.slice(0, 160), subtitle: `${t("Scope change to accept or decline")} · ${sc.project.name}`, href: `${base}/projects/${sc.projectId}/scope/${sc.id}`, cta: t("Decide"), since: sc.requestedAt })),
  ];
  return items;
}

export async function portalProjectHome(projectId: string) {
  const [phases, updates, files, nextMilestone, invoices, deliverables, reports] = await Promise.all([
    db.phase.findMany({
      where: { projectId, visibility: "CLIENT_VISIBLE" },
      orderBy: { position: "asc" },
      select: {
        id: true, title: true, description: true, status: true, progress: true, deadline: true,
        milestones: { where: { visibility: "CLIENT_VISIBLE" }, orderBy: { position: "asc" }, select: { id: true, title: true, dueDate: true, completedAt: true } },
        tasks: { where: { visibility: "CLIENT_VISIBLE", parentId: null }, orderBy: { position: "asc" }, select: { id: true, title: true, status: true, deadline: true } },
      },
    }),
    db.projectUpdate.findMany({ where: { projectId }, orderBy: { publishedAt: "desc" }, take: 10, select: { id: true, title: true, body: true, nextSteps: true, authorName: true, publishedAt: true } }),
    db.file.findMany({ where: { projectId, visibility: "CLIENT_VISIBLE", deletedAt: null, status: "READY", OR: [{ deliverableVersionId: null }, { deliverableVersion: { deliverable: { visibility: "CLIENT_VISIBLE" } } }] }, orderBy: { createdAt: "desc" }, take: 8 }),
    db.milestone.findFirst({ where: { projectId, visibility: "CLIENT_VISIBLE", completedAt: null, phase: { visibility: "CLIENT_VISIBLE" } }, orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { position: "asc" }], select: { title: true, dueDate: true } }),
    db.invoice.findMany({ where: { projectId, status: { not: "DRAFT" } }, orderBy: { issueDate: "desc" }, take: 5 }),
    db.deliverable.findMany({ where: { projectId, visibility: "CLIENT_VISIBLE", status: { not: "DRAFT" } }, orderBy: { updatedAt: "desc" }, select: { id: true, title: true, status: true, currentVersion: true, updatedAt: true } }),
    db.projectReport.findMany({ where: { projectId }, orderBy: { createdAt: "desc" }, take: 3, select: { id: true, createdAt: true } }),
  ]);
  const current = phases.find((p) => p.status !== "COMPLETED") ?? null;
  const happening = current ? current.tasks.filter((t) => t.status === "IN_PROGRESS" || t.status === "IN_REVIEW").slice(0, 4) : [];
  return { phases, updates, files, nextMilestone, invoices, deliverables, reports, current, happening };
}
