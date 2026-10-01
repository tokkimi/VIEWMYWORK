import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { sendEmail } from "@/lib/email/send";
import { emailTemplates } from "@/lib/email/templates";
import { normalizeLocale, translate } from "@/lib/i18n/core";
import { DECISION_LABEL, ageDays, type DecisionItem } from "@/lib/decisions";

/**
 * Sends ONE grouped reminder to a client about the given pending items: an email to the people who
 * have access to their portal (or the client's own address) and a notification in the portal.
 * Every item is logged so reminders are throttled and visible to the team.
 */
export async function sendDecisionReminder(workspaceId: string, clientId: string, items: DecisionItem[], opts: { auto: boolean; sentById?: string | null }) {
  if (!items.length) return { status: "EMPTY" as const };
  const client = await db.client.findFirst({ where: { id: clientId, workspaceId }, include: { workspace: { include: { settings: true } } } });
  if (!client) return { status: "NOT_FOUND" as const };
  const access = await db.clientPortalAccess.findMany({ where: { clientId, workspaceId, revokedAt: null }, include: { user: { select: { id: true, email: true, locale: true } } } });
  const recipients = [...new Set([...access.map((a) => a.user.email), client.email].filter((e): e is string => Boolean(e && e.trim())))];
  // Without portal access the client couldn't act on the reminder: share the portal first.
  if (!access.length) return { status: "NO_PORTAL" as const };

  const l = normalizeLocale(client.preferredLanguage);
  const ws = client.workspace;
  const brand = { name: ws.name, logoUrl: ws.settings?.portalLogoUrl ?? ws.logoUrl };
  const now = new Date();
  const tpl = emailTemplates.decisionReminder(
    { brand, clientName: client.firstName || client.company || "", link: `${env.appUrl}/portal`, items: items.map((i) => ({ label: translate(l, DECISION_LABEL[i.kind]), title: i.kind === "PAYMENT" ? translate(l, "Invoice {number}", { number: i.title }) : i.title, project: i.projectName, days: ageDays(i.since, now) })) },
    l,
  );
  let sent = 0;
  for (const to of recipients) {
    const r = await sendEmail({ to, subject: tpl.subject, html: tpl.html, template: "decision_reminder", workspaceId, entityType: "CLIENT", entityId: clientId, fromName: ws.name });
    if (r.status === "SENT") sent++;
  }
  for (const a of access)
    await db.notification.create({
      data: { workspaceId, userId: a.user.id, audience: "CLIENT", category: "PROJECT", type: "DECISION_REMINDER", title: tpl.subject, message: items.map((i) => `• ${i.kind === "PAYMENT" ? translate(l, "Invoice {number}", { number: i.title }) : i.title}`).join("\n").slice(0, 1500), actionUrl: items.length === 1 ? items[0]!.portalHref : "/portal", actionLabel: translate(l, "Open") },
    });
  await db.clientReminder.createMany({ data: items.map((i) => ({ workspaceId, clientId, itemKey: i.key, auto: opts.auto, sentById: opts.sentById ?? null })) });
  return { status: "SENT" as const, emails: sent, recipients: recipients.length, notified: access.length };
}
