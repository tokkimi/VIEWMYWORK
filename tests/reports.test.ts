import { describe, it, expect } from "vitest";
import { db } from "@/lib/db";
import { isEmptyReport, weeklyDue, progressDelta } from "@/lib/reports";
import { buildProjectReport } from "@/server/queries/reports";
import { sendProjectReport, runWeeklyReports } from "@/server/services/reports";
import { sendProjectReportAction, saveReportSettingsAction } from "@/server/actions/reports";
import { makeWorkspace, makeUser, addMember, signIn, plan, fd } from "./helpers";

const DAY = 86_400_000;

async function enable(key: string) {
  const p = await plan();
  await db.planFeature.upsert({ where: { planId_key: { planId: p.id, key } }, create: { planId: p.id, key, enabled: true }, update: { enabled: true } });
}

async function setup() {
  const w = await makeWorkspace();
  const portalUser = await makeUser("Client user");
  await db.clientPortalAccess.create({ data: { workspaceId: w.ws.id, clientId: w.client.id, userId: portalUser.id } });
  return { ...w, portalUser };
}

describe("report rules", () => {
  const monday = new Date("2026-10-05T07:00:00Z"); // a Monday
  it("is due on the chosen weekday, once a week", () => {
    expect(weeklyDue(1, null, monday)).toBe(true);
    expect(weeklyDue(2, null, monday)).toBe(false);
    expect(weeklyDue(1, new Date(monday.getTime() - 2 * 3600_000), monday)).toBe(false);
    expect(weeklyDue(1, new Date(monday.getTime() - 7 * DAY), monday)).toBe(true);
  });
  it("detects empty weeks and progress change", () => {
    expect(isEmptyReport({ done: [], inProgress: [], next: [], waiting: [], update: null })).toBe(true);
    expect(isEmptyReport({ done: [], inProgress: ["x"], next: [], waiting: [], update: null })).toBe(false);
    expect(progressDelta({ project: { id: "", name: "", status: "", progress: 40, targetDate: null }, previousProgress: 25 })).toBe(15);
    expect(progressDelta({ project: { id: "", name: "", status: "", progress: 40, targetDate: null }, previousProgress: null })).toBeNull();
  });
});

describe("weekly project report", () => {
  it("only includes client-visible work from the last 7 days", async () => {
    const { ws, project } = await setup();
    const now = new Date();
    await db.task.createMany({ data: [
      { workspaceId: ws.id, projectId: project.id, title: "Visible done", status: "COMPLETED", completedAt: new Date(now.getTime() - 2 * DAY) },
      { workspaceId: ws.id, projectId: project.id, title: "Internal done", status: "COMPLETED", completedAt: new Date(now.getTime() - DAY), visibility: "INTERNAL" },
      { workspaceId: ws.id, projectId: project.id, title: "Old done", status: "COMPLETED", completedAt: new Date(now.getTime() - 20 * DAY) },
      { workspaceId: ws.id, projectId: project.id, title: "Doing", status: "IN_PROGRESS" },
      { workspaceId: ws.id, projectId: project.id, title: "Upcoming", deadline: new Date(now.getTime() + 3 * DAY) },
    ] });
    const r = await buildProjectReport(project.id, now);
    expect(r.done.map((d) => d.title)).toEqual(["Visible done"]);
    expect(r.inProgress).toEqual(["Doing"]);
    expect(r.next.map((n) => n.title)).toEqual(["Upcoming"]);
    expect(r.previousProgress).toBeNull();
  });

  it("is sent manually with a note, stored and readable in the portal; refused without access", async () => {
    await enable("weekly_reports");
    const { ws, owner, project, portalUser } = await setup();
    await signIn(owner.id, { workspaceId: ws.id });
    const r = await sendProjectReportAction(fd({ projectId: project.id, note: "Great week" }));
    expect(r.ok).toBe(true);
    const rep = await db.projectReport.findFirstOrThrow({ where: { projectId: project.id } });
    expect(rep.note).toBe("Great week");
    expect(rep.auto).toBe(false);
    expect(await db.notification.count({ where: { userId: portalUser.id, type: "PROJECT_REPORT" } })).toBe(1);
    expect((await sendProjectReportAction(fd({ projectId: project.id }))).ok).toBe(false); // once an hour

    const { user: viewer } = await addMember(ws.id, "VIEWER", { projectIds: [project.id] });
    await signIn(viewer.id, { workspaceId: ws.id });
    expect((await sendProjectReportAction(fd({ projectId: project.id }))).ok).toBe(false);
  });

  it("skips empty automatic reports and respects the opt-in", async () => {
    await enable("weekly_reports");
    const { ws, owner, project } = await setup();
    expect((await sendProjectReport(project.id, { auto: true })).status).toBe("EMPTY");

    await db.task.create({ data: { workspaceId: ws.id, projectId: project.id, title: "Doing", status: "IN_PROGRESS" } });
    const monday = new Date("2026-10-05T07:00:00Z");
    await runWeeklyReports(monday); // client reports are off by default
    expect(await db.projectReport.count({ where: { projectId: project.id } })).toBe(0);

    await signIn(owner.id, { workspaceId: ws.id });
    expect((await saveReportSettingsAction(fd({ clientReports: "on", teamDigest: "on", reportWeekday: 1 }))).ok).toBe(true);
    await runWeeklyReports(monday);
    expect(await db.projectReport.count({ where: { projectId: project.id, auto: true } })).toBe(1);
    await runWeeklyReports(monday); // idempotent
    expect(await db.projectReport.count({ where: { projectId: project.id, auto: true } })).toBe(1);
    expect(await db.notification.count({ where: { userId: owner.id, type: "TEAM_DIGEST" } })).toBe(1);

    await db.project.update({ where: { id: project.id }, data: { weeklyReport: false } });
    await runWeeklyReports(new Date(monday.getTime() + 7 * DAY));
    expect(await db.projectReport.count({ where: { projectId: project.id, auto: true } })).toBe(1);
  });
});
