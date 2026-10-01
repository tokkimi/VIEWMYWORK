"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { runAction, AppError } from "@/lib/errors";
import { requireWorkspace, requirePerm, requireProjectPerm } from "@/lib/auth/context";
import { formToObject, zId } from "@/lib/validation";
import { rateLimit } from "@/lib/rate-limit";
import { requireFeature } from "@/lib/plans";
import { sendProjectReport, sendTeamDigest } from "@/server/services/reports";

/** Sends this week's report to the client now, with an optional word from the team. */
export async function sendProjectReportAction(fd: FormData) {
  return runAction(async () => {
    const ctx = await requireWorkspace();
    const i = z.object({ projectId: zId, note: z.string().trim().max(2000).optional() }).parse(formToObject(fd));
    await requireProjectPerm(ctx, i.projectId, "projects", "edit");
    await requireFeature(ctx.workspace.id, "weekly_reports");
    await rateLimit("report-send", 30, 3600, ctx.workspace.id);
    const recent = await db.projectReport.findFirst({ where: { projectId: i.projectId, auto: false, createdAt: { gte: new Date(Date.now() - 3600_000) } }, select: { id: true } });
    if (recent) throw new AppError("A report was already sent for this project in the last hour.");
    const r = await sendProjectReport(i.projectId, { auto: false, sentById: ctx.user.id, note: i.note });
    if (r.status === "NO_PORTAL") throw new AppError("The client portal is disabled for this project.");
    if (r.status === "NO_RECIPIENT") throw new AppError("This client has no portal access or email address yet. Share the portal first (email, WhatsApp or link).");
    if (r.status !== "SENT") throw new AppError("The report couldn't be sent.");
    return { id: r.id };
  }, "Report sent to the client.");
}

/** Include or exclude a project from the automatic weekly reports. */
export async function toggleProjectReportAction(projectId: string, enabled: boolean) {
  return runAction(async () => {
    const ctx = await requireWorkspace();
    await requireProjectPerm(ctx, zId.parse(projectId), "projects", "manage");
    await db.project.update({ where: { id: projectId }, data: { weeklyReport: Boolean(enabled) } });
    return null;
  }, enabled ? "Project included in weekly reports." : "Project excluded from weekly reports.");
}

export async function saveReportSettingsAction(fd: FormData) {
  return runAction(async () => {
    const ctx = await requireWorkspace();
    requirePerm(ctx, "settings", "manage");
    const on = z.preprocess((v) => v === "on" || v === "true", z.boolean());
    const i = z.object({ clientReports: on, teamDigest: on, reportWeekday: z.coerce.number().int().min(0).max(6) }).parse({ clientReports: "false", teamDigest: "false", ...formToObject(fd) });
    await db.workspaceSetting.upsert({ where: { workspaceId: ctx.workspace.id }, create: { workspaceId: ctx.workspace.id, ...i }, update: i });
    return null;
  }, "Report settings saved.");
}

/** Sends the portfolio digest to the workspace admins right away. */
export async function sendTeamDigestNowAction() {
  return runAction(async () => {
    const ctx = await requireWorkspace();
    requirePerm(ctx, "settings", "manage");
    await requireFeature(ctx.workspace.id, "weekly_reports");
    await rateLimit("team-digest", 5, 3600, ctx.workspace.id);
    const r = await sendTeamDigest(ctx.workspace.id);
    if (r.status === "EMPTY") throw new AppError("There are no active projects to report on.");
    if (r.status !== "SENT") throw new AppError("The digest couldn't be sent.");
    return null;
  }, "Digest sent to the workspace admins.");
}
