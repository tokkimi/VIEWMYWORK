import { after } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { resolvePermissions, hasLevel, type Capability } from "@/lib/auth/permissions";
import { sendEmail } from "@/lib/email/send";
import { emailTemplates } from "@/lib/email/templates";
import { normalizeLocale, renderMsg, withSourceMsg, type Locale, type Msg } from "@/lib/i18n/core";

export type Category = "PROJECT" | "CLIENT" | "BILLING" | "TEAM" | "SYSTEM";
export type Topic = "APPROVALS" | "TASKS" | "DEADLINES" | "UPDATES" | "FILES" | "COMMENTS" | "MENTIONS" | "INVOICES" | "PAYMENTS" | "TEAM" | "SYSTEM";

export const TOPIC_LABELS: Record<Topic, string> = {
  APPROVALS: "Client approvals",
  TASKS: "Task assignments & completions",
  DEADLINES: "Deadlines",
  UPDATES: "Project updates",
  FILES: "Files",
  COMMENTS: "Comments & messages",
  MENTIONS: "Mentions",
  INVOICES: "Invoices",
  PAYMENTS: "Payments",
  TEAM: "Team",
  SYSTEM: "System alerts",
};

// One registry drives activity, notifications, email and analytics — no duplicated logic.
export const EVENT_DEFS = {
  PROJECT_CREATED: { category: "PROJECT", topic: "UPDATES" },
  PROJECT_UPDATED: { category: "PROJECT", topic: "UPDATES" },
  PROJECT_UPDATE_PUBLISHED: { category: "PROJECT", topic: "UPDATES" },
  PROJECT_COMPLETED: { category: "PROJECT", topic: "UPDATES" },
  PROJECT_ARCHIVED: { category: "PROJECT", topic: "UPDATES" },
  SPEC_CHANGED: { category: "PROJECT", topic: "UPDATES" },
  DEADLINE_CHANGED: { category: "PROJECT", topic: "DEADLINES" },
  TASK_CREATED: { category: "PROJECT", topic: "TASKS" },
  TASK_ASSIGNED: { category: "PROJECT", topic: "TASKS" },
  TASK_COMPLETED: { category: "PROJECT", topic: "TASKS" },
  TASK_STATUS_CHANGED: { category: "PROJECT", topic: "TASKS" },
  DEADLINE_APPROACHING: { category: "PROJECT", topic: "DEADLINES" },
  TASK_OVERDUE: { category: "PROJECT", topic: "DEADLINES" },
  FILE_UPLOADED: { category: "PROJECT", topic: "FILES" },
  FILE_DELETED: { category: "PROJECT", topic: "FILES" },
  FILE_RESTORED: { category: "PROJECT", topic: "FILES" },
  DELIVERABLE_SUBMITTED: { category: "PROJECT", topic: "APPROVALS" },
  APPROVAL_REQUESTED: { category: "PROJECT", topic: "APPROVALS" },
  SCOPE_CHANGE: { category: "PROJECT", topic: "UPDATES" },
  CLIENT_WAIT_STARTED: { category: "PROJECT", topic: "UPDATES" },
  MESSAGE_POSTED: { category: "PROJECT", topic: "COMMENTS" },
  CLIENT_COMMENTED: { category: "CLIENT", topic: "COMMENTS" },
  CLIENT_UPLOADED_FILE: { category: "CLIENT", topic: "FILES" },
  CLIENT_VIEWED_DELIVERABLE: { category: "CLIENT", topic: "APPROVALS" },
  CLIENT_REQUESTED_CHANGES: { category: "CLIENT", topic: "APPROVALS" },
  CLIENT_APPROVED_DELIVERABLE: { category: "CLIENT", topic: "APPROVALS" },
  CLIENT_SUBMITTED_INFO: { category: "CLIENT", topic: "COMMENTS" },
  CLIENT_CHANGE_REQUEST: { category: "CLIENT", topic: "APPROVALS" },
  CHANGE_REQUEST_UPDATED: { category: "PROJECT", topic: "UPDATES" },
  CLIENT_CREATED: { category: "CLIENT", topic: "UPDATES" },
  CLIENT_INVITED: { category: "CLIENT", topic: "TEAM" },
  INVOICE_CREATED: { category: "BILLING", topic: "INVOICES" },
  INVOICE_SENT: { category: "BILLING", topic: "INVOICES" },
  INVOICE_UPDATED: { category: "BILLING", topic: "INVOICES" },
  INVOICE_VIEWED: { category: "BILLING", topic: "INVOICES" },
  INVOICE_DUE_SOON: { category: "BILLING", topic: "INVOICES" },
  INVOICE_OVERDUE: { category: "BILLING", topic: "INVOICES" },
  INVOICE_VOIDED: { category: "BILLING", topic: "INVOICES" },
  PAYMENT_REMINDER_SENT: { category: "BILLING", topic: "INVOICES" },
  PAYMENT_RECEIVED: { category: "BILLING", topic: "PAYMENTS" },
  PAYMENT_FAILED: { category: "BILLING", topic: "PAYMENTS" },
  REFUND_ISSUED: { category: "BILLING", topic: "PAYMENTS" },
  EXPENSE_CREATED: { category: "BILLING", topic: "PAYMENTS" },
  COLLABORATOR_INVITED: { category: "TEAM", topic: "TEAM" },
  COLLABORATOR_ADDED: { category: "TEAM", topic: "TEAM" },
  MENTION_RECEIVED: { category: "TEAM", topic: "MENTIONS" },
  PERMISSION_CHANGED: { category: "TEAM", topic: "TEAM" },
  SUBSCRIPTION_PAYMENT_FAILED: { category: "SYSTEM", topic: "SYSTEM" },
  SUBSCRIPTION_CHANGED: { category: "SYSTEM", topic: "SYSTEM" },
  STORAGE_ALMOST_FULL: { category: "SYSTEM", topic: "SYSTEM" },
  INTEGRATION_DISCONNECTED: { category: "SYSTEM", topic: "SYSTEM" },
  SECURITY_EVENT: { category: "SYSTEM", topic: "SYSTEM" },
} as const satisfies Record<string, { category: Category; topic: Topic }>;

export type EventType = keyof typeof EVENT_DEFS;

type TeamAudience =
  | { kind: "users"; userIds: string[] }
  | { kind: "project" | "workspace"; capability?: [Capability, string] };

export type EventInput = {
  workspaceId: string;
  type: EventType;
  actor?: { id: string; name: string } | null;
  projectId?: string | null;
  clientId?: string | null;
  entityType: string;
  entityId?: string | null;
  /** English source text (with optional {vars}); rendered in each reader's language. */
  summary: Msg;
  clientVisible?: boolean;
  metadata?: Record<string, Prisma.InputJsonValue>;
  notify?: {
    team?: TeamAudience;
    client?: boolean; // portal users of clientId (requires clientVisible content)
    title: Msg;
    message: Msg;
    actionUrl?: string; // team action URL
    clientActionUrl?: string;
    actionLabel?: Msg;
    email?: boolean; // important events only
  };
};

/**
 * Records an activity entry and fans out notifications (in-app + optional email),
 * honouring each recipient's preferences. Never throws into the caller's flow.
 */
export async function emit(e: EventInput) {
  const def = EVENT_DEFS[e.type];
  await db.activityLog.create({
    data: {
      workspaceId: e.workspaceId,
      projectId: e.projectId ?? null,
      clientId: e.clientId ?? null,
      actorId: e.actor?.id ?? null,
      actorName: e.actor?.name ?? "System",
      action: e.type,
      entityType: e.entityType,
      entityId: e.entityId ?? null,
      summary: renderMsg("en", e.summary),
      clientVisible: e.clientVisible ?? false,
      // The source message is kept so the summary can be shown in the reader's language.
      metadata: withSourceMsg(e.summary, e.metadata) as Prisma.InputJsonValue | undefined,
    },
  });
  if (!e.notify) return;
  try {
    await dispatch(e, def.category, def.topic);
  } catch (err) {
    console.error("[events] notification dispatch failed", err);
  }
}

async function resolveTeam(e: EventInput, aud: TeamAudience): Promise<string[]> {
  if (aud.kind === "users") return aud.userIds;
  const members = await db.workspaceMember.findMany({
    where: { workspaceId: e.workspaceId, status: "ACTIVE" },
    include: { projectMemberships: e.projectId ? { where: { projectId: e.projectId } } : false },
  });
  let managerId: string | null = null;
  if (e.projectId) managerId = (await db.project.findUnique({ where: { id: e.projectId }, select: { managerId: true } }))?.managerId ?? null;
  return members
    .filter((m) => {
      const admin = m.role === "OWNER" || m.role === "ADMIN";
      if (aud.kind === "project" && e.projectId && !admin && !m.allProjects && !m.projectMemberships?.length && m.userId !== managerId) return false;
      if (aud.kind === "workspace" && !admin && !aud.capability) return false;
      if (aud.capability) {
        const perms = resolvePermissions(m.role, m.permissions, m.projectMemberships?.[0]?.permissions);
        if (!hasLevel(perms, aud.capability[0], aud.capability[1] as never)) return false;
      }
      return true;
    })
    .map((m) => m.userId);
}

async function dispatch(e: EventInput, category: Category, topic: Topic) {
  const n = e.notify!;
  const team = n.team ? await resolveTeam(e, n.team) : [];
  const clientUsers =
    n.client && e.clientId && e.clientVisible
      ? (await db.clientPortalAccess.findMany({ where: { clientId: e.clientId, workspaceId: e.workspaceId, revokedAt: null }, select: { userId: true } })).map((a) => a.userId)
      : [];
  const recipients = new Map<string, "TEAM" | "CLIENT">();
  for (const u of team) recipients.set(u, "TEAM");
  for (const u of clientUsers) if (!recipients.has(u)) recipients.set(u, "CLIENT");
  if (e.actor) recipients.delete(e.actor.id);
  if (!recipients.size) return;

  const ids = [...recipients.keys()];
  const [prefs, users, ws] = await Promise.all([
    db.notificationPreference.findMany({ where: { userId: { in: ids }, topic } }),
    db.user.findMany({ where: { id: { in: ids }, status: "ACTIVE" }, select: { id: true, email: true, locale: true } }),
    db.workspace.findUnique({ where: { id: e.workspaceId }, include: { settings: true } }),
  ]);
  const prefBy = new Map(prefs.map((p) => [p.userId, p]));
  const emails: { to: string; audience: "TEAM" | "CLIENT"; locale: Locale }[] = [];
  const rows: Prisma.NotificationCreateManyInput[] = [];
  for (const u of users) {
    const audience = recipients.get(u.id)!;
    const p = prefBy.get(u.id);
    const locale = normalizeLocale(u.locale);
    const actionUrl = audience === "CLIENT" ? n.clientActionUrl ?? "/portal" : n.actionUrl;
    // Notifications are written in each recipient's own language.
    if (p?.inApp !== false)
      rows.push({ workspaceId: e.workspaceId, userId: u.id, audience, category, type: e.type, title: renderMsg(locale, n.title), message: renderMsg(locale, n.message), entityType: e.entityType, entityId: e.entityId ?? null, actionUrl, actionLabel: n.actionLabel ? renderMsg(locale, n.actionLabel) : null });
    if (n.email && p?.email !== false) emails.push({ to: u.email, audience, locale });
  }
  if (rows.length) await db.notification.createMany({ data: rows });
  if (!emails.length || !ws) return;
  const brand = { name: ws.name, logoUrl: ws.settings?.portalLogoUrl ?? ws.logoUrl };
  const job = async () => {
    for (const m of emails) {
      const tpl = emailTemplates.notification({ brand, title: renderMsg(m.locale, n.title), message: renderMsg(m.locale, n.message), actionUrl: m.audience === "CLIENT" ? n.clientActionUrl ?? "/portal" : n.actionUrl, actionLabel: n.actionLabel ? renderMsg(m.locale, n.actionLabel) : null }, m.locale);
      await sendEmail({ to: m.to, subject: tpl.subject, html: tpl.html, template: `notification:${e.type}`, workspaceId: e.workspaceId, entityType: e.entityType, entityId: e.entityId ?? undefined, fromName: ws.name });
    }
  };
  runAfter(job);
}

/** Defers non-critical work until after the response when inside a request; otherwise runs inline. */
export function runAfter(job: () => Promise<void>) {
  try {
    after(job);
  } catch {
    void job().catch((err) => console.error("[after]", err));
  }
}

/** Platform-level system notification to all admins of a workspace. */
export async function notifyWorkspaceAdmins(workspaceId: string, type: EventType, title: Msg, message: Msg, actionUrl?: string) {
  await emit({ workspaceId, type, entityType: "WORKSPACE", entityId: workspaceId, summary: title, notify: { team: { kind: "workspace" }, title, message, actionUrl, email: true } });
}

