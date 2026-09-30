import { db } from "@/lib/db";
import { emit } from "@/lib/events";
import { deriveStatus, outstandingCents } from "@/lib/invoices/status";
import { deleteObject } from "@/lib/storage";
import { integrations } from "@/lib/env";
import { daysBetween } from "@/lib/format";
import { deliverReminder } from "./billing";
import { driveMetadata } from "./google-drive";

async function alreadyEmitted(type: string, entityId: string, since?: Date) {
  return Boolean(await db.activityLog.findFirst({ where: { action: type, entityId, ...(since ? { createdAt: { gte: since } } : {}) }, select: { id: true } }));
}

/** Idempotent daily job: safe to run more than once a day. */
export async function runDailyJobs(now = new Date()) {
  const report = { overdue: 0, dueSoon: 0, reminders: 0, taskAlerts: 0, cleaned: 0, driveChecked: 0 };

  // 0. Website screenshots are a cache: drop the ones nobody has refreshed for a week.
  await db.siteShot.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - 7 * 86400_000) } } });

  // 1. Invoice statuses & overdue alerts (status is derived from due date + balance, never from the UI).
  const open = await db.invoice.findMany({ where: { status: { in: ["SENT", "VIEWED", "PARTIALLY_PAID", "OVERDUE"] } }, include: { client: true } });
  for (const inv of open) {
    const next = deriveStatus(inv, now);
    if (next !== inv.status) await db.invoice.update({ where: { id: inv.id }, data: { status: next } });
    if (next === "OVERDUE" && !(await alreadyEmitted("INVOICE_OVERDUE", inv.id))) {
      report.overdue++;
      await emit({
        workspaceId: inv.workspaceId, type: "INVOICE_OVERDUE", actor: null, projectId: inv.projectId, clientId: inv.clientId, entityType: "INVOICE", entityId: inv.id,
        summary: ["Invoice {number} is overdue", { number: inv.number }],
        notify: { team: { kind: "workspace", capability: ["invoices", "view"] }, title: ["{number} is overdue", { number: inv.number }], message: ["{amount} from {client} is past due.", { amount: { money: outstandingCents(inv), currency: inv.currency }, client: inv.client.company || inv.client.lastName }], actionUrl: `/app/invoices/${inv.id}`, actionLabel: "Open invoice", email: true },
      });
    }
    const until = daysBetween(now, inv.dueDate);
    if (until >= 0 && until <= 3 && next !== "OVERDUE" && !(await alreadyEmitted("INVOICE_DUE_SOON", inv.id))) {
      report.dueSoon++;
      await emit({ workspaceId: inv.workspaceId, type: "INVOICE_DUE_SOON", actor: null, projectId: inv.projectId, clientId: inv.clientId, entityType: "INVOICE", entityId: inv.id, summary: ["Invoice {number} is due soon", { number: inv.number }], notify: { team: { kind: "workspace", capability: ["invoices", "view"] }, title: until === 0 ? ["{number} is due today", { number: inv.number }] : ["{number} is due in {n} days", { number: inv.number, n: until }], message: ["{amount} outstanding.", { amount: { money: outstandingCents(inv), currency: inv.currency } }], actionUrl: `/app/invoices/${inv.id}`, actionLabel: "Open invoice" } });
    }
  }

  // 2. Automatic payment reminders (deduplicated per invoice + offset by a unique constraint).
  const settings = await db.invoiceSettings.findMany({ where: { remindersEnabled: true } });
  for (const s of settings) {
    const invoices = await db.invoice.findMany({ where: { workspaceId: s.workspaceId, status: { in: ["SENT", "VIEWED", "PARTIALLY_PAID", "OVERDUE"] } } });
    for (const inv of invoices) {
      if (outstandingCents(inv) <= 0) continue;
      const daysFromDue = daysBetween(inv.dueDate, now); // negative = before due date
      // Send the latest offset reached, within a 2-day grace window (covers a missed cron day, never spams old invoices).
      const due = s.reminderOffsets.filter((o) => daysFromDue >= o && daysFromDue - o <= 2).sort((a, b) => b - a)[0];
      if (due === undefined) continue;
      const r = await deliverReminder(inv.id, "AUTO", due, null);
      if (r.status !== "SKIPPED") report.reminders++;
    }
  }

  // 3. Task deadlines: approaching (tomorrow) and overdue (yesterday) — once each.
  const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  const dayAfter = new Date(tomorrow.getTime() + 86400_000);
  const yesterday = new Date(tomorrow.getTime() - 2 * 86400_000);
  const today = new Date(tomorrow.getTime() - 86400_000);
  const [soon, late] = await Promise.all([
    db.task.findMany({ where: { status: { not: "COMPLETED" }, assigneeId: { not: null }, deadline: { gte: tomorrow, lt: dayAfter }, project: { archivedAt: null } }, include: { project: { select: { name: true, managerId: true } } } }),
    db.task.findMany({ where: { status: { not: "COMPLETED" }, deadline: { gte: yesterday, lt: today }, project: { archivedAt: null } }, include: { project: { select: { name: true, managerId: true } } } }),
  ]);
  for (const t of soon) {
    if (await alreadyEmitted("DEADLINE_APPROACHING", t.id)) continue;
    report.taskAlerts++;
    await emit({ workspaceId: t.workspaceId, type: "DEADLINE_APPROACHING", actor: null, projectId: t.projectId, entityType: "TASK", entityId: t.id, summary: ["“{task}” is due tomorrow", { task: t.title }], notify: { team: { kind: "users", userIds: [t.assigneeId!] }, title: "Deadline tomorrow", message: `${t.title} — ${t.project.name}`, actionUrl: `/app/projects/${t.projectId}/tasks?task=${t.id}`, actionLabel: "Open task", email: true } });
  }
  for (const t of late) {
    if (await alreadyEmitted("TASK_OVERDUE", t.id)) continue;
    report.taskAlerts++;
    await emit({ workspaceId: t.workspaceId, type: "TASK_OVERDUE", actor: null, projectId: t.projectId, entityType: "TASK", entityId: t.id, summary: ["“{task}” is overdue", { task: t.title }], notify: { team: { kind: "users", userIds: [t.assigneeId, t.project.managerId].filter((x): x is string => Boolean(x)) }, title: "Task overdue", message: `${t.title} — ${t.project.name}`, actionUrl: `/app/projects/${t.projectId}/tasks?task=${t.id}`, actionLabel: "Open task" } });
  }

  // 4. Cleanup: abandoned uploads, expired sessions/tokens, stale rate-limit rows.
  const stale = await db.file.findMany({ where: { status: "PENDING", createdAt: { lt: new Date(now.getTime() - 86400_000) } }, take: 500 });
  for (const f of stale) {
    if (f.storageKey && integrations.storage()) await deleteObject(f.storageKey).catch(() => {});
    await db.file.delete({ where: { id: f.id } }).catch(() => {});
    report.cleaned++;
  }
  await db.session.deleteMany({ where: { expiresAt: { lt: now } } });
  await db.authToken.deleteMany({ where: { expiresAt: { lt: new Date(now.getTime() - 7 * 86400_000) } } });
  await db.rateLimit.deleteMany({ where: { resetAt: { lt: now } } });

  // 5. Google Drive link health (bounded to control API usage).
  if (integrations.googleDrive()) {
    const linked = await db.file.findMany({ where: { source: "GOOGLE_DRIVE", deletedAt: null, externalMissing: false, workspace: { integrations: { some: { provider: "GOOGLE_DRIVE", status: "CONNECTED" } } } }, orderBy: { createdAt: "asc" }, take: 100 });
    for (const f of linked) {
      try {
        const meta = await driveMetadata(f.workspaceId, f.externalId!);
        if (!meta) await db.file.update({ where: { id: f.id }, data: { externalMissing: true } });
        else if (meta.name !== f.name) await db.file.update({ where: { id: f.id }, data: { name: meta.name, externalUrl: meta.webViewLink } });
        report.driveChecked++;
      } catch {
        // Disconnected / permission errors are handled inside driveMetadata; keep going.
      }
    }
  }
  return report;
}
