import { describe, it, expect } from "vitest";
import { db } from "@/lib/db";
import { updateMemberCapacityAction, addAbsenceAction, deleteAbsenceAction, assignTasksAction } from "@/server/actions/workload";
import { makeWorkspace, addMember, signIn, fd, plan } from "./helpers";
import { loadWorkload } from "@/server/queries/workload";
import { loadPortfolioHealth } from "@/server/queries/health";
import { requireWorkspace } from "@/lib/auth/context";

async function enable(...keys: string[]) {
  const p = await plan();
  for (const key of keys) await db.planFeature.upsert({ where: { planId_key: { planId: p.id, key } }, create: { planId: p.id, key, enabled: true }, update: { enabled: true } });
}

describe("team workload actions", () => {
  it("requires the plan feature", async () => {
    const { ws, owner, member } = await makeWorkspace();
    const p = await plan();
    await db.planFeature.deleteMany({ where: { planId: p.id, key: "team_workload" } });
    await signIn(owner.id, { workspaceId: ws.id });
    expect((await updateMemberCapacityAction(fd({ memberId: member.id, hoursPerWeek: 20 }))).ok).toBe(false);
  });

  it("managers set capacity; members manage only their own absences", async () => {
    await enable("team_workload");
    const { ws, owner, member } = await makeWorkspace();
    const { user: collab, member: cm } = await addMember(ws.id, "COLLABORATOR");
    await signIn(owner.id, { workspaceId: ws.id });
    expect((await updateMemberCapacityAction(fd({ memberId: cm.id, hoursPerWeek: 28, hourlyCost: "45,5" }))).ok).toBe(true);
    const saved = await db.workspaceMember.findUniqueOrThrow({ where: { id: cm.id } });
    expect(saved.weeklyCapacityMinutes).toBe(1680);
    expect(saved.hourlyCostCents).toBe(4550);

    await signIn(collab.id, { workspaceId: ws.id });
    expect((await updateMemberCapacityAction(fd({ memberId: cm.id, hoursPerWeek: 10 }))).ok).toBe(false);
    expect((await addAbsenceAction(fd({ memberId: member.id, startDate: "2026-11-02", endDate: "2026-11-03" }))).ok).toBe(false); // someone else's
    expect((await addAbsenceAction(fd({ memberId: cm.id, startDate: "2026-11-05", endDate: "2026-11-02" }))).ok).toBe(false); // end before start
    expect((await addAbsenceAction(fd({ memberId: cm.id, startDate: "2026-11-02", endDate: "2026-11-03", reason: "LEAVE" }))).ok).toBe(true);
    const a = await db.memberAbsence.findFirstOrThrow({ where: { memberId: cm.id } });
    expect((await deleteAbsenceAction(a.id)).ok).toBe(true);
  });

  it("assigns suggested tasks only to active workspace members, within permissions", async () => {
    await enable("team_workload", "portfolio_health");
    const { ws, owner, project } = await makeWorkspace();
    const { user: collab } = await addMember(ws.id, "COLLABORATOR");
    const other = await makeWorkspace();
    await db.project.update({ where: { id: project.id }, data: { status: "ACTIVE" } });
    const t = await db.task.create({ data: { workspaceId: ws.id, projectId: project.id, title: "Unowned", estimatedMinutes: 240, deadline: new Date(Date.now() + 3 * 86400_000) } });
    await signIn(owner.id, { workspaceId: ws.id });
    const ctx = await requireWorkspace();
    const wl = await loadWorkload(ctx);
    expect(wl.unassigned.map((x) => x.id)).toContain(t.id);
    expect(wl.suggestions.get(t.id)).toBeTruthy();

    expect((await assignTasksAction([{ taskId: t.id, userId: other.owner.id }])).ok).toBe(false); // not a member here
    expect((await assignTasksAction([{ taskId: t.id, userId: collab.id }])).ok).toBe(true);
    expect((await db.task.findUniqueOrThrow({ where: { id: t.id } })).assigneeId).toBe(collab.id);

    const health = await loadPortfolioHealth(ctx);
    expect(health.find((h) => h.id === project.id)?.openTasks).toBeGreaterThan(0);
  });
});
