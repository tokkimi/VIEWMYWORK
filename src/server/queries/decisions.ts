import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { deriveStatus, outstandingCents, isPayable } from "@/lib/invoices/status";
import type { DecisionItem, DecisionKind } from "@/lib/decisions";

const WAIT_KIND: Record<string, DecisionKind> = { APPROVAL: "APPROVAL", DOCUMENT: "DOCUMENT", INFORMATION: "INFORMATION", PAYMENT: "PAYMENT", OTHER: "OTHER" };

/**
 * Everything currently awaiting a client's decision, across the given projects: deliverables to
 * approve, requested documents / information, scope changes to arbitrate, invoices to pay.
 * Mirrors exactly what the client sees in their portal ("Waiting for you").
 */
export async function loadDecisions(workspaceId: string, projectWhere: Prisma.ProjectWhereInput = {}): Promise<DecisionItem[]> {
  const projects = await db.project.findMany({
    where: { workspaceId, archivedAt: null, status: { notIn: ["CANCELLED"] }, ...projectWhere },
    select: { id: true, name: true, clientId: true, client: { select: { company: true, firstName: true, lastName: true } } },
  });
  if (!projects.length) return [];
  const ids = projects.map((p) => p.id);
  const byId = new Map(projects.map((p) => [p.id, p]));
  const clientName = (p: (typeof projects)[number]) => p.client.company || `${p.client.firstName} ${p.client.lastName}`.trim();

  const [deliverables, waits, scopes, invoices] = await Promise.all([
    db.deliverable.findMany({ where: { workspaceId, projectId: { in: ids }, visibility: "CLIENT_VISIBLE", status: "WAITING_FOR_CLIENT" }, select: { id: true, title: true, currentVersion: true, projectId: true, updatedAt: true } }),
    db.clientWait.findMany({ where: { projectId: { in: ids }, resolvedAt: null, OR: [{ entityType: null }, { entityType: "TASK" }] }, select: { id: true, label: true, reason: true, projectId: true, entityType: true, entityId: true, startedAt: true } }),
    db.scopeChange.findMany({ where: { projectId: { in: ids }, askClient: true, status: "PROPOSED" }, select: { id: true, description: true, projectId: true, requestedAt: true, additionalCostCents: true } }),
    db.invoice.findMany({ where: { workspaceId, projectId: { in: ids }, status: { in: ["SENT", "VIEWED", "PARTIALLY_PAID", "OVERDUE"] } } }),
  ]);
  const taskIds = waits.filter((w) => w.entityType === "TASK" && w.entityId).map((w) => w.entityId!);
  const visibleTasks = new Set((await db.task.findMany({ where: { id: { in: taskIds }, visibility: "CLIENT_VISIBLE" }, select: { id: true } })).map((t) => t.id));

  const items: Omit<DecisionItem, "reminders" | "lastReminderAt">[] = [];
  for (const d of deliverables) {
    const p = byId.get(d.projectId)!;
    items.push({ key: `deliverable:${d.id}`, kind: "APPROVAL", title: `${d.title} V${d.currentVersion}`, clientId: p.clientId, clientName: clientName(p), projectId: p.id, projectName: p.name, since: d.updatedAt, href: `/app/projects/${p.id}/deliverables#${d.id}`, portalHref: `/portal/projects/${p.id}/deliverables/${d.id}` });
  }
  for (const w of waits) {
    if (w.entityType === "TASK" && !visibleTasks.has(w.entityId!)) continue;
    const p = byId.get(w.projectId)!;
    const kind = WAIT_KIND[w.reason] ?? "OTHER";
    items.push({ key: `wait:${w.id}`, kind, title: w.label, clientId: p.clientId, clientName: clientName(p), projectId: p.id, projectName: p.name, since: w.startedAt, href: `/app/projects/${p.id}`, portalHref: `/portal/projects/${p.id}${kind === "DOCUMENT" ? "/files" : "/messages"}` });
  }
  for (const s of scopes) {
    const p = byId.get(s.projectId)!;
    items.push({ key: `scope:${s.id}`, kind: "SCOPE", title: s.description.split("\n")[0]!.slice(0, 160), clientId: p.clientId, clientName: clientName(p), projectId: p.id, projectName: p.name, since: s.requestedAt, href: `/app/projects/${p.id}/specification`, portalHref: `/portal/projects/${p.id}/scope/${s.id}` });
  }
  for (const i of invoices) {
    if (!i.projectId || !isPayable(deriveStatus(i)) || outstandingCents(i) <= 0) continue;
    const p = byId.get(i.projectId)!;
    items.push({ key: `invoice:${i.id}`, kind: "PAYMENT", title: i.number ?? "Invoice", clientId: p.clientId, clientName: clientName(p), projectId: p.id, projectName: p.name, since: i.issuedAt ?? i.createdAt, href: `/app/invoices/${i.id}`, portalHref: `/portal/invoices/${i.id}`, amount: { cents: outstandingCents(i), currency: i.currency } });
  }

  const logs = items.length
    ? await db.clientReminder.groupBy({ by: ["itemKey"], where: { workspaceId, itemKey: { in: items.map((x) => x.key) } }, _count: true, _max: { sentAt: true } })
    : [];
  const log = new Map(logs.map((l) => [l.itemKey, l]));
  return items
    .map((x) => ({ ...x, reminders: log.get(x.key)?._count ?? 0, lastReminderAt: log.get(x.key)?._max.sentAt ?? null }))
    .sort((a, b) => a.since.getTime() - b.since.getTime());
}
