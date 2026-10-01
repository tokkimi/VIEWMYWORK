import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { sendEmail } from "@/lib/email/send";
import { emailTemplates } from "@/lib/email/templates";
import { normalizeLocale, renderMsg, translate } from "@/lib/i18n/core";
import { hasFeature } from "@/lib/plans";
import { isEmptyReport, weeklyDue, DEFAULT_REPORTS } from "@/lib/reports";
import { buildProjectReport } from "@/server/queries/reports";
import { loadPortfolioHealth } from "@/server/queries/health";
import { loadDecisions } from "@/server/queries/decisions";
import type { WorkspaceCtx } from "@/lib/auth/context";

const DAY = 86_400_000;

/**
 * Builds this week's report for a project, stores it (readable in the client portal) and sends it
 * to everyone with portal access plus the client's own address. Automatic reports with nothing to
 * say are skipped.
 */
export async function sendProjectReport(projectId: string, opts: { auto: boolean; sentById?: string | null; note?: string | null; now?: Date }) {
  const now = opts.now ?? new Date();
  const project = await db.project.findUnique({ where: { id: projectId }, include: { client: true, workspace: { include: { settings: true } } } });
  if (!project || project.archivedAt) return { status: "NOT_FOUND" as const };
  if (!project.portalEnabled) return { status: "NO_PORTAL" as const };
  const access = await db.clientPortalAccess.findMany({ where: { clientId: project.clientId, workspaceId: project.workspaceId, revokedAt: null }, include: { user: { select: { id: true, email: true } } } });
  const recipients = [...new Set([...access.map((a) => a.user.email), project.client.email].filter((e): e is string => Boolean(e && e.trim())))];
  if (!access.length && !recipients.length) return { status: "NO_RECIPIENT" as const };

  const data = await buildProjectReport(projectId, now);
  if (opts.auto && isEmptyReport(data)) return { status: "EMPTY" as const };
  const report = await db.projectReport.create({
    data: { workspaceId: project.workspaceId, projectId, periodStart: new Date(data.period.start), periodEnd: new Date(data.period.end), data: data as unknown as Prisma.InputJsonValue, note: opts.note?.trim() || null, auto: opts.auto, sentById: opts.sentById ?? null },
  });
  const l = normalizeLocale(project.client.preferredLanguage);
  const ws = project.workspace;
  const link = `${env.appUrl}/portal/projects/${projectId}/reports/${report.id}`;
  const tpl = emailTemplates.projectReport({ brand: { name: ws.name, logoUrl: ws.settings?.portalLogoUrl ?? ws.logoUrl }, clientName: project.client.firstName || project.client.company || "", data, note: report.note, link }, l);
  let sent = 0;
  for (const to of recipients) {
    const r = await sendEmail({ to, subject: tpl.subject, html: tpl.html, template: "project_report", workspaceId: project.workspaceId, entityType: "PROJECT", entityId: projectId, fromName: ws.name });
    if (r.status === "SENT") sent++;
  }
  for (const a of access)
    await db.notification.create({
      data: { workspaceId: project.workspaceId, userId: a.user.id, audience: "CLIENT", category: "PROJECT", type: "PROJECT_REPORT", title: tpl.subject, message: translate(l, "{progress}% complete · {project}", { progress: data.project.progress, project: data.project.name }), entityType: "PROJECT", entityId: projectId, actionUrl: `/portal/projects/${projectId}/reports/${report.id}`, actionLabel: translate(l, "Open the report") },
    });
  await db.projectReport.update({ where: { id: report.id }, data: { recipients: recipients.length } });
  return { status: "SENT" as const, id: report.id, emails: sent, recipients: recipients.length, notified: access.length };
}

/** Portfolio digest for workspace owners and admins: health, client waits, upcoming deadlines. */
export async function sendTeamDigest(workspaceId: string, now = new Date()) {
  const ws = await db.workspace.findUnique({ where: { id: workspaceId }, include: { settings: true } });
  if (!ws) return { status: "NOT_FOUND" as const };
  const admins = await db.workspaceMember.findMany({ where: { workspaceId, role: { in: ["OWNER", "ADMIN"] } }, include: { user: { select: { id: true, name: true, email: true, locale: true } } } });
  if (!admins.length) return { status: "NO_RECIPIENT" as const };
  // Portfolio-wide view, as an admin would see it.
  const ctx = { workspace: ws, member: admins[0]!, isAdmin: true, user: admins[0]!.user } as unknown as WorkspaceCtx;
  const rows = (await loadPortfolioHealth(ctx, now)).filter((r) => r.health.status !== "done");
  if (!rows.length) return { status: "EMPTY" as const };
  const decisions = await loadDecisions(workspaceId);
  const soon = new Date(now.getTime() + 7 * DAY);
  let sent = 0;
  for (const a of admins) {
    const l = normalizeLocale(a.user.locale);
    const risky = rows.filter((r) => r.health.status !== "on_track").sort((x, y) => x.health.score - y.health.score).slice(0, 6)
      .map((r) => ({ name: r.name, status: r.health.status, score: r.health.score, alert: r.health.alerts[0] ? renderMsg(l, r.health.alerts[0].msg) : null, url: `${env.appUrl}/app/projects/${r.id}` }));
    const deadlines = rows.filter((r) => r.nextDeadline && r.nextDeadline.date <= soon).sort((x, y) => x.nextDeadline!.date.getTime() - y.nextDeadline!.date.getTime()).slice(0, 10)
      .map((r) => ({ label: translate(l, r.nextDeadline!.label), project: r.name, date: r.nextDeadline!.date.toISOString() }));
    const tpl = emailTemplates.teamDigest({
      brand: { name: "FollowMyFuture" }, name: a.user.name.split(" ")[0] ?? a.user.name,
      stats: { live: rows.length, onTrack: rows.filter((r) => r.health.status === "on_track").length, atRisk: rows.filter((r) => r.health.status === "at_risk").length, offTrack: rows.filter((r) => r.health.status === "off_track").length, overdue: rows.reduce((s, r) => s + r.overdueTasks, 0), waiting: decisions.length, oldestWait: decisions.reduce((m, d) => Math.max(m, Math.floor((now.getTime() - d.since.getTime()) / DAY)), 0) },
      risky, deadlines, link: `${env.appUrl}/app/health`,
    }, l);
    const r = await sendEmail({ to: a.user.email, subject: tpl.subject, html: tpl.html, template: "team_digest", workspaceId });
    if (r.status === "SENT") sent++;
    await db.notification.create({ data: { workspaceId, userId: a.user.id, audience: "TEAM", category: "PROJECT", type: "TEAM_DIGEST", title: tpl.subject, message: risky.length ? risky.map((x) => `• ${x.name}${x.alert ? ` — ${x.alert}` : ""}`).join("\n").slice(0, 1500) : translate(l, "All projects are on track."), actionUrl: "/app/health", actionLabel: translate(l, "Open project health") } });
  }
  await db.workspaceSetting.upsert({ where: { workspaceId }, create: { workspaceId, lastTeamDigestAt: now }, update: { lastTeamDigestAt: now } });
  return { status: "SENT" as const, emails: sent, recipients: admins.length };
}

/** Daily-job step: sends whatever is due today, according to each workspace's settings. */
export async function runWeeklyReports(now = new Date()) {
  const out = { clientReports: 0, teamDigests: 0 };
  const workspaces = await db.workspace.findMany({ where: { archivedAt: null }, select: { id: true, settings: true } });
  for (const ws of workspaces) {
    const s = ws.settings;
    const weekday = s?.reportWeekday ?? DEFAULT_REPORTS.weekday;
    if (now.getUTCDay() !== weekday) continue;
    if (!(await hasFeature(ws.id, "weekly_reports"))) continue;
    if ((s?.teamDigest ?? DEFAULT_REPORTS.teamDigest) && weeklyDue(weekday, s?.lastTeamDigestAt ?? null, now)) {
      const r = await sendTeamDigest(ws.id, now).catch((e) => { console.error("[reports] digest", e); return null; });
      if (r?.status === "SENT") out.teamDigests++;
    }
    if (!(s?.clientReports ?? DEFAULT_REPORTS.clientReports)) continue;
    const projects = await db.project.findMany({ where: { workspaceId: ws.id, archivedAt: null, portalEnabled: true, weeklyReport: true, status: { in: ["PLANNING", "ACTIVE", "ON_HOLD"] } }, select: { id: true, reports: { where: { auto: true }, orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } } } });
    for (const p of projects) {
      if (!weeklyDue(weekday, p.reports[0]?.createdAt ?? null, now)) continue;
      const r = await sendProjectReport(p.id, { auto: true, now }).catch((e) => { console.error("[reports] project", e); return null; });
      if (r?.status === "SENT") out.clientReports++;
    }
  }
  return out;
}
